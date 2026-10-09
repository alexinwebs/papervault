import { createHash } from "node:crypto";
import { prisma, prismaRaw } from "@/lib/db";
import {
  PAPER_TRANSITIONS,
  PUBLISHABLE_CLASSIFICATIONS,
  type ExamClassification,
  type PaperStatus,
  type Verification,
} from "@/lib/constants";
import { conflict, notFound, validation } from "@/lib/errors";
import { recordAudit } from "./audit";

export function collegeIdOfPaper(paper: {
  paperSet: {
    examSession: {
      subject: { semester: { branch: { program: { collegeId: string } } } };
    };
  };
}) {
  return paper.paperSet.examSession.subject.semester.branch.program.collegeId;
}

export function assertTransition(from: PaperStatus, to: PaperStatus) {
  if (!PAPER_TRANSITIONS[from]?.includes(to)) {
    throw conflict(`A paper cannot move from ${from} to ${to}.`);
  }
}

export const NOT_PUBLISHABLE_MESSAGE =
  "Only papers from exams that have already been held, or that were officially released, can be published. Confirm the exam classification first.";

export function isPublishableClassification(value: string) {
  return (PUBLISHABLE_CLASSIFICATIONS as string[]).includes(value);
}

/**
 * Settles the exam classification before a paper is released. A reviewer's
 * explicit choice wins. Without one, UNKNOWN is read as PAST only when the
 * exam's academic year is already over (an exam from an earlier year has
 * necessarily been held); CURRENT and UPCOMING are never inferred away.
 * Throws if the result may not be published.
 */
export async function settleClassificationForRelease(
  paperId: string,
  actorId: string,
  explicit?: ExamClassification | null,
) {
  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    select: { examClassification: true, paperSet: { select: { examSession: { select: { academicYear: true } } } } },
  });
  if (!paper) throw notFound("Paper");
  const year = paper.paperSet.examSession.academicYear;
  const chosen: string =
    explicit ??
    (paper.examClassification === "UNKNOWN" && year < new Date().getFullYear() ? "PAST" : paper.examClassification);
  if (!isPublishableClassification(chosen)) throw validation(NOT_PUBLISHABLE_MESSAGE);
  if (chosen !== paper.examClassification) {
    await prisma.paper.update({ where: { id: paperId }, data: { examClassification: chosen } });
    await recordAudit({
      actorId,
      action: "paper.classification_set",
      entityType: "Paper",
      entityId: paperId,
      before: { examClassification: paper.examClassification },
      after: { examClassification: chosen },
    });
  }
  return chosen;
}

/** Every transition is auditable and appended to the paper timeline. */
export async function transitionPaper(input: {
  paperId: string;
  to: PaperStatus;
  actorId?: string | null;
  note?: string | null;
  verification?: Verification;
  restrictedReason?: string | null;
  canonicalId?: string | null;
}) {
  const paper = await prisma.paper.findUnique({ where: { id: input.paperId } });
  if (!paper) throw notFound("Paper");
  assertTransition(paper.status as PaperStatus, input.to);
  // Binding academic-integrity rule: nothing is released unless it is past or officially released.
  if (input.to === "PUBLISHED" && !isPublishableClassification(paper.examClassification)) {
    throw validation(NOT_PUBLISHABLE_MESSAGE);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.paper.update({
      where: { id: paper.id },
      data: {
        status: input.to,
        reviewedById: input.actorId ?? paper.reviewedById,
        reviewNote: input.note ?? paper.reviewNote,
        verification: input.verification ?? paper.verification,
        restricted: input.to === "RESTRICTED" ? true : input.to === "PUBLISHED" ? false : paper.restricted,
        restrictedReason:
          input.to === "RESTRICTED" ? (input.restrictedReason ?? input.note ?? null) : paper.restrictedReason,
        canonicalId: input.canonicalId ?? paper.canonicalId,
        publishedAt: input.to === "PUBLISHED" ? new Date() : paper.publishedAt,
      },
    });
    await tx.paperEvent.create({
      data: {
        paperId: paper.id,
        fromState: paper.status,
        toState: input.to,
        actorId: input.actorId ?? null,
        note: input.note ?? null,
      },
    });
    return next;
  });

  await recordAudit({
    actorId: input.actorId,
    action: `paper.${input.to.toLowerCase()}`,
    entityType: "Paper",
    entityId: paper.id,
    before: { status: paper.status, verification: paper.verification },
    after: { status: updated.status, verification: updated.verification },
  });

  return updated;
}

/**
 * Duplicate detection: exact file hash first, then metadata fingerprint
 * (same subject + exam type + year + set). Perceptual hashing and OCR text
 * similarity slot in here without changing call sites.
 */
/**
 * Normalised fingerprint of a paper's text layer.
 *
 * Re-scanning, re-compressing or re-exporting a paper changes every byte of
 * the file but not the words on the page, so a file hash alone lets the same
 * paper in over and over. Case, punctuation and whitespace are dropped before
 * hashing so cosmetic differences do not create a "new" paper.
 */
export function contentFingerprint(text: string | null | undefined) {
  if (!text) return null;
  const normalised = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  // Too little text to be a reliable fingerprint — a photographed paper with
  // no OCR layer would otherwise collide with every other photographed paper.
  if (normalised.length < 200) return null;
  return createHash("sha256").update(normalised).digest("hex");
}

export type DuplicateMatch = "FILE_HASH" | "CONTENT" | "SLOT";

export type DuplicateHit = {
  id: string;
  title: string;
  status: string;
  match: DuplicateMatch;
  /** Set when the match is a binned paper rather than a live one. */
  binned: boolean;
};

/**
 * Every reason an upload would be a duplicate, strongest match first.
 *
 * Reads go through `prismaRaw` on purpose: `prisma` hides soft-deleted rows,
 * and a paper sitting in the recycle bin must still block a re-upload —
 * otherwise "delete and upload again" is a trivial way to bypass the check.
 * Purged papers are gone from the table entirely and correctly stop blocking.
 */
/**
 * `db` lets the upload pass its transaction so the check runs under the same
 * advisory locks as the insert. It must be an unfiltered client: hash and
 * content matches deliberately include papers in the recycle bin.
 */
export async function findDuplicateCandidates(
  input: {
    sha256: string;
    contentHash?: string | null;
    examSessionId: string;
    setLabel: string;
  },
  db: Pick<typeof prismaRaw, "paper"> = prismaRaw,
): Promise<DuplicateHit[]> {
  const select = { id: true, title: true, status: true, deletedAt: true };
  const live = { status: { notIn: ["REMOVED", "REJECTED"] }, deletedAt: null };

  const [byHash, byContent, bySlot] = await Promise.all([
    db.paper.findMany({
      where: { files: { some: { sha256: input.sha256 } }, status: { not: "REMOVED" } },
      select,
    }),
    input.contentHash
      ? db.paper.findMany({
          where: { contentHash: input.contentHash, status: { not: "REMOVED" } },
          select,
        })
      : Promise.resolve([]),
    db.paper.findMany({
      where: { paperSet: { examSessionId: input.examSessionId, label: input.setLabel }, ...live },
      select,
    }),
  ]);

  const seen = new Set<string>();
  return [
    ...byHash.map((p) => ({ ...p, match: "FILE_HASH" as const })),
    ...byContent.map((p) => ({ ...p, match: "CONTENT" as const })),
    ...bySlot.map((p) => ({ ...p, match: "SLOT" as const })),
  ]
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .map(({ deletedAt, ...p }) => ({ ...p, binned: Boolean(deletedAt) }));
}

/**
 * Refuses the upload if it duplicates something already in the archive.
 * The message always says which paper it collided with so the contributor can
 * go and look, and how to proceed when they genuinely have a different paper.
 */
export function assertNotDuplicate(hits: DuplicateHit[]) {
  const hit = hits[0];
  if (!hit) return;
  const where = hit.binned ? " It is currently in the recycle bin." : "";
  switch (hit.match) {
    case "FILE_HASH":
      throw conflict(`This exact file is already in the archive as "${hit.title}".${where}`);
    case "CONTENT":
      throw conflict(
        `This paper is already in the archive as "${hit.title}" — the pages are identical, even though the file is not.${where}`,
      );
    case "SLOT":
      throw conflict(
        `"${hit.title}" is already filed under this subject, exam and year for this set. If yours is a different set, upload it as Set B or Set C instead.`,
      );
  }
}

export async function incrementDownload(paperId: string) {
  await prisma.paper.update({ where: { id: paperId }, data: { downloadCount: { increment: 1 } } });
}

export async function trackView(userId: string, paperId: string) {
  await prisma.paperView.upsert({
    where: { userId_paperId: { userId, paperId } },
    create: { userId, paperId },
    update: { viewedAt: new Date() },
  });
}
