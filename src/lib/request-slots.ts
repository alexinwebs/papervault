/** Stable internal key; requesters' identities never form part of public demand. */
export type RequestSlot = { subjectId: string; examTypeId: string; academicYear: number };
export function requestSlotKey(slot: RequestSlot) {
  return JSON.stringify([slot.subjectId, slot.examTypeId, slot.academicYear]);
}
