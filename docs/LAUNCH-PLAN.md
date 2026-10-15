# PaperVault launch plan

## Purpose

Prove that one batch can repeatedly find the right past paper and that a small group can maintain
its collection. More features, registrations or listed colleges are not proof of usefulness.

## Before public promotion

- [ ] Back up database, files and required configuration; keep protected off-server copies.
- [ ] Complete an isolated restore and document the recovery procedure and operator.
- [ ] Create a real platform admin, enroll 2FA and verify recovery access.
- [ ] Run the read-only `npm run launch:check` inside the production environment.
- [ ] Inspect demo content. `db:purge-demo` defaults to a dry run; back up and review its output
  before any separately confirmed purge. Do not run demo seeding on production.
- [ ] Configure accurate operator, support, grievance and security contacts and review policies.
- [ ] Send verification/reset emails to an actual mailbox; check spam and reply handling.
- [ ] Check `/api/healthz` JSON as well as HTTP status; degraded dependencies can return HTTP 200.
- [ ] Verify scanner failure blocks uploads and storage remains private/permission-checked.
- [ ] Review document permissions and personal information; software MIT licensing does not license
  third-party papers. Keep a practical takedown and reporting process.
- [ ] Assign at least one reviewer and communicate realistic review availability, not a guarantee.
- [ ] Check public reading without signup, signed-in contribution, manual entry, preview, moderation,
  mobile layouts, keyboard navigation and slow/failing connections.
- [ ] Check the actual code/session/semester against your batch's syllabus.
- [ ] Configure your own optional donation identity or clear it; never inherit someone else's QR.

These checks reduce risk. They are not a penetration test, legal review or accessibility audit.

## One-batch pilot

1. Pick one college, branch and semester. Ask students which past papers they actually need.
2. Collect permitted copies and inventory each subject, test number, session and set. Do not
   fabricate coverage or use seeded statistics to market the service.
3. Recruit 3–5 people who already collect papers: class representatives, seniors or club members.
   Offer a reusable collection link and less repeated forwarding—not artificial rewards.
4. Share direct semester/subject links in the existing class group with that group's permission.
5. Observe a few students finding a specific paper without help. Record where they hesitate,
   encounter wrong labels, fail to read a file or abandon contribution.
6. Ask for a particular missing paper at its subject page or through the wanted board.
7. Check whether students return for another subject/test and whether maintainers contribute
   again without personal reminders. Decide whether to improve, narrow or expand the scope.

## Measure useful outcomes

| Question | Observation |
| --- | --- |
| Can students find their paper? | Observe task completion and unsuccessful searches |
| Is content correct? | Compare actual headers, codes, sessions and syllabus |
| Does recognition help? | Record per-field corrections on a consented test set |
| Is contribution manageable? | Observe completion, abandonment and time spent |
| Can maintainers keep up? | Record review delay, unresolved reports and repeat contributors |
| Does value persist? | Ask whether students return at the next relevant exam or subject |

No new tracking system is installed by this release. Use a small consented pilot first; do not
log uploaded document contents or identify students unnecessarily. Download totals are events,
not unique beneficiaries, learning outcomes or proof of authentic engagement.

## Further engineering backlog — not shipped in v15

Prioritise based on observed failures rather than implementing everything at once:

1. Session/set-specific request identities, notifications and reconciliation with published papers.
2. Catalogue merge/alias workflows preserving associations and old links, with staff review.
3. A clear resubmission/replacement flow for better scans, with history and permissions preserved.
4. Measured OCR field confidence and a consented representative scan dataset; avoid storing names.
5. Automated file-quality hints that warn without discarding useful imperfect scans.
6. Registration/email-verification continuity for an interrupted contribution flow.
7. Database query/load profiling on realistic catalogue sizes and low-memory server limits.
8. External accessibility/security review and tested operational recovery exercises.

Keep paid AI, compulsory uploads, fake activity, unlimited notifications and broad multi-campus
expansion out of the critical path until there is evidence they solve a real problem.
