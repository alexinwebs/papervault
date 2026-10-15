/** Explain existing stored labels without inventing an accreditation claim. */
export function verificationDescription(verification: string, restricted = false) {
  if (restricted) return "Restricted: file access is limited; this is not a public paper.";
  const descriptions: Record<string, string> = {
    UNVERIFIED: "Unverified: no additional verification label has been assigned. Check the printed header.",
    COMMUNITY_VERIFIED: "Community verified: labelled through community review, not a college endorsement.",
    MODERATOR_VERIFIED: "Verified: labelled by a moderator; not a guarantee of authenticity or syllabus compatibility.",
    COLLEGE_VERIFIED: "College verified: a college-level review label, not proof of official institutional endorsement.",
  };
  return descriptions[verification] ?? descriptions.UNVERIFIED;
}
