import { readPaperText } from "./paper-text";
import { resolveAutomaticCatalogue, type AutomaticCatalogue } from "./automatic-catalogue";
import { textKey } from "@/lib/paper-detection";
import { prisma, prismaRaw } from "@/lib/db";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, type ExamClassification } from "@/lib/constants";
import { validation } from "@/lib/errors";
import { sha256 } from "@/lib/hash";
import { safeFilename } from "@/lib/utils";
import { buildStorageKey, storage } from "@/lib/storage";
import { assertAcademicChain } from "../repositories/academics";
import {
  assertNotDuplicate,
  contentFingerprint,
  findDuplicateCandidates,
  transitionPaper,
} from "./papers";
import { recordAudit } from "./audit";
import { notifyApprovalRequested } from "./notifications";
import type { SessionUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { pdfPageCount, sanitizePdf } from "@/lib/pdf";
import { assertClean, scanUpload } from "@/lib/scanner";
import { resolveListingSubjects } from "./listings";

const MAGIC: Array<{ mime: string; test: (b: Buffer) => boolean }> = [
  { mime: "application/pdf", test: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
];

/** Content sniffing: the declared extension/MIME is never trusted on its own. */
export function detectMime(buffer: Buffer) {
  return MAGIC.find((m) => m.test(buffer))?.mime ?? null;
}

export function extensionFor(mime: string) {
  return mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
}

export type UploadMetadata = {
  autoCatalogue?: AutomaticCatalogue;
  collegeId: string;
  programId: string;
  branchId: string;
  semesterId: string;
  subjectId: string;
  examTypeId: string;
  academicYear: number;
  sessionLabel?: string;
  setLabel: string;
  notes?: string;
  /** Uploader's declaration. CURRENT / UPCOMING are refused outright. */
  examClassification?: ExamClassification;
  /** The same subject in other branches this paper is also for (e.g. IT, IoT). */
  alsoSubjectIds?: string[];
};

/**
 * Full submission flow: validate chain -> validate file bytes -> hash ->
 * duplicate check -> store object -> create paper + file -> submit for review.
 * Student uploads are never auto-published.
 */
export async function submitPaper(input: {
  user: SessionUser;
  metadata: UploadMetadata;
  file: { name: string; type: string; bytes: Buffer };
}) {
  const classification: ExamClassification = input.metadata.examClassification ?? "UNKNOWN";
  if (classification === "CURRENT" || classification === "UPCOMING") {
    throw validation(
      "Papers from an exam that is still running or hasn't happened yet can't be uploaded. Please upload it after the exam is over.",
    );
  }
  const existingChain = input.metadata.autoCatalogue ? null : await assertAcademicChain(input.metadata);
  if (!existingChain && !input.metadata.autoCatalogue) throw validation("That subject does not belong to the selected college structure.");
  const alsoSubjectIds = existingChain ? await resolveListingSubjects({
    collegeId: existingChain.college.id,
    primarySubjectId: existingChain.subject.id,
    subjectIds: input.metadata.alsoSubjectIds ?? [],
  }) : [];

  const { bytes: original } = input.file;
  if (original.byteLength === 0) throw validation("The uploaded file is empty.");
  if (original.byteLength > MAX_UPLOAD_BYTES) {
    throw validation(`File must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
  }
  const detected = detectMime(original);
  if (!detected || !ALLOWED_MIME.includes(detected as (typeof ALLOWED_MIME)[number])) {
    throw validation("Only PDF, JPG, and PNG files are accepted.");
  }

  // Malware scan before anything is written anywhere.
  assertClean(await scanUpload(original));

  // PDFs are re-written through a parser, which drops embedded JavaScript,
  // launch actions and attached files. A PDF we cannot parse is rejected.
  let bytes = original;
  let pageCount: number | null = null;
  let extractedText: string | null = null;
  if (detected === "application/pdf") {
    const cleaned = await sanitizePdf(bytes);
    if (!cleaned.sanitized) throw validation("That PDF could not be read. Try re-exporting it.");
    bytes = cleaned.bytes;
    pageCount = await pdfPageCount(bytes);
    // Best-effort: photographed papers have no text layer at all.

  }

  const reading = await readPaperText(bytes, detected, "submit");
  extractedText = reading.text || null;
  const digest = sha256(bytes);
  const sessionLabel = input.metadata.sessionLabel?.trim() || null;
  const setLabel = input.metadata.setLabel?.trim() || "Set A";
  const contentHash = reading.complete ? contentFingerprint(extractedText) : null;
  const lockKeys = [
    `upload:sha:${digest}`,
    contentHash ? `upload:content:${contentHash}` : null,
    input.metadata.autoCatalogue ? `catalogue:${textKey(input.metadata.autoCatalogue.collegeName)}` : null,
  ].filter((key): key is string => Boolean(key)).sort();

  const { paper, key, chain } = await prismaRaw.$transaction(
    async (tx) => {
      for (const lockKey of lockKeys) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      }

      const chain = existingChain ?? await resolveAutomaticCatalogue(tx, input.metadata.autoCatalogue!, input.user.id);
      const sessionWhere = { subjectId: chain.subject.id, examTypeId: chain.examType.id, academicYear: input.metadata.academicYear, sessionLabel };
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`upload:slot:${sessionWhere.subjectId}:${sessionWhere.examTypeId}:${sessionWhere.academicYear}:${sessionLabel ?? ""}`}))`;
      const examSession =
        (await tx.examSession.findFirst({ where: sessionWhere })) ??
        (await tx.examSession.create({ data: sessionWhere }));

      // Refused before the object is written and before any row is created,
      // so a rejected duplicate leaves nothing behind.
      assertNotDuplicate(
        await findDuplicateCandidates(
          { sha256: digest, contentHash, examSessionId: examSession.id, setLabel },
          tx,
        ),
      );

      const paperSet = await tx.paperSet.upsert({
        where: { examSessionId_label: { examSessionId: examSession.id, label: setLabel } },
        create: { examSessionId: examSession.id, label: setLabel },
        update: {},
      });

      const created = await tx.paper.create({
        data: {
          paperSetId: paperSet.id,
          title: chain.subject.name,
          status: "DRAFT",
          uploadedById: input.user.id,
          reviewNote: input.metadata.notes?.trim() || null,
          examClassification: classification,
          extractedText,
          contentHash,
        },
      });

      const storageKey = buildStorageKey({
        collegeSlug: chain.college.slug,
        paperId: created.id,
        sha256: digest,
        extension: extensionFor(detected),
      });

      // The file row is written with the paper so the hash is visible to the
      // next upload's duplicate check the moment this transaction commits.
      await tx.paperFile.create({
        data: {
          paperId: created.id,
          storageKey,
          originalName: safeFilename(input.file.name),
          mimeType: detected,
          sizeBytes: bytes.byteLength,
          sha256: digest,
          pageCount,
        },
      });
      if (alsoSubjectIds.length > 0) {
        await tx.paperListing.createMany({
          data: alsoSubjectIds.map((subjectId) => ({ paperId: created.id, subjectId })),
          skipDuplicates: true,
        });
      }
      return { paper: created, key: storageKey, chain };
    },
    { maxWait: 10_000, timeout: 20_000 },
  );

  // A DRAFT paper is invisible to everyone but its uploader, so the short
  // window before the object exists is harmless. If the write fails the paper
  // (and its file row, by cascade) is removed so the slot is free again.
  try {
    await storage().put({ key, body: bytes, contentType: detected });
  } catch (err) {
    await prismaRaw.paper.delete({ where: { id: paper.id } }).catch(() => undefined);
    throw err;
  }

  await transitionPaper({ paperId: paper.id, to: "SUBMITTED", actorId: input.user.id });

  // Automated checks: current/upcoming/unknown exam material is held back, never published.
  const currentYear = new Date().getFullYear();
  const sensitive = input.metadata.academicYear >= currentYear || classification === "UNKNOWN";
  await transitionPaper({
    paperId: paper.id,
    to: sensitive ? "RESTRICTED" : "PENDING_REVIEW",
    actorId: null,
    note: sensitive
      ? classification === "UNKNOWN"
        ? "Held for review: the uploader wasn't sure whether this exam has been held."
        : "Held for review: paper is from the current or an upcoming exam cycle."
      : "Automated checks passed.",
    restrictedReason: sensitive
      ? "This paper may relate to a current or upcoming exam and is awaiting moderator review."
      : null,
  });

  // A submission is not available until moderation publishes it. Request views
  // derive availability from public papers rather than setting fulfillment here.

  // Approval request: tell the admins and college moderators there is work to
  // do. Delivery problems must never fail the upload the student just made.
  try {
    await notifyApprovalRequested({
      paperId: paper.id,
      title: chain.subject.name,
      collegeId: chain.college.id,
      collegeName: chain.college.name,
      context: `${chain.subject.code} · ${chain.subject.semester.branch.program.name} ${chain.subject.semester.branch.code} · Semester ${chain.subject.semester.number} · ${chain.examType.name} ${input.metadata.academicYear}`,
      uploaderName: input.user.name,
      note: input.metadata.notes?.trim() || null,
    });
  } catch (err) {
    logger.error("approval_notification_failed", { error: String(err) });
  }

  await recordAudit({
    actorId: input.user.id,
    action: "paper.uploaded",
    entityType: "Paper",
    entityId: paper.id,
    after: {
      subject: chain.subject.name,
      year: input.metadata.academicYear,
      ...(alsoSubjectIds.length > 0 ? { alsoListedUnder: alsoSubjectIds } : {}),
    },
  });

  return { paperId: paper.id };
}
