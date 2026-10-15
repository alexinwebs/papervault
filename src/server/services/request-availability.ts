import { prisma } from "@/lib/db";
import { PUBLIC_PAPER_WHERE } from "../repositories/papers";
import { underSubject } from "./listings";
import { requestSlotKey, type RequestSlot } from "@/lib/request-slots";

/** Derive fulfillment from currently public papers, not stale upload-time flags.
 * Includes cross-listings, excludes restricted/unreviewed/deleted papers. */
export async function availableRequestSlots(slots: RequestSlot[]) {
  const unique = [...new Map(slots.map(slot => [requestSlotKey(slot), slot])).values()];
  const available = new Set<string>();
  // Keep both SQL parameter counts and temporary arrays bounded.
  for (let start = 0; start < unique.length; start += 50) {
    const batch = unique.slice(start, start + 50);
    const papers = await prisma.paper.findMany({
      where: {
        ...PUBLIC_PAPER_WHERE,
        OR: batch.map(slot => ({
          AND: [underSubject(slot.subjectId), {
            paperSet: { examSession: { examTypeId: slot.examTypeId, academicYear: slot.academicYear } },
          }],
        })),
      },
      select: {
        paperSet: { select: { examSession: { select: { subjectId: true, examTypeId: true, academicYear: true } } } },
        listings: { select: { subjectId: true } },
      },
    });
    for (const paper of papers) {
      const session = paper.paperSet.examSession;
      for (const subjectId of [session.subjectId, ...paper.listings.map(l => l.subjectId)]) {
        available.add(requestSlotKey({ ...session, subjectId }));
      }
    }
  }
  return available;
}
