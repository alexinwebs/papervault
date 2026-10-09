# PAPER/VAULT — technical reference

A student-powered archive of college question papers. Built as a modular monolith on
Next.js (App Router) + TypeScript + Prisma + Zod, with a retro-editorial / neo-brutalist
design system.

```text
COLLEGE → PROGRAM → BRANCH → SEMESTER → SUBJECT → EXAM TYPE → YEAR → PAPER
```

---

## 1. Run it locally

Requirements: **Node 22+**, npm and Docker (for Postgres). No S3 account needed for development.

```bash
npm install
cp .env.example .env      # local defaults
docker compose up -d      # Postgres + Redis (add --profile scan for ClamAV)
npm run setup             # prisma generate + migrate deploy + demo seed (wipes the database)
npm run dev               # http://localhost:3000
```

Then open <http://localhost:3000>.

### Seeded accounts (password `papervault123`)

| Email | Role | Scope |
| --- | --- | --- |
| `student@papervault.dev` | Student | RKGIT |
| `moderator@papervault.dev` | Moderator | RKGIT only |
| `collegeadmin@papervault.dev` | College admin | RKGIT only |
| `admin@papervault.dev` | Platform admin | Global |

**Raj Kumar Goel Institute of Technology, Ghaziabad (RKGIT)** — affiliated to AKTU — is the home
campus. It is flagged `featured` in the database, so it is pinned to the top of every college
list, dropdown and search result. Any college can be promoted or demoted later from
**Admin → Manage colleges**.

Seed data includes 15 colleges (RKGIT, AKTU, ABES, KIET, GLBITM, JSSATEN, AKGEC, GCET, MIET,
Amity, IIT Delhi, DTU, NSUT, NIT Kurukshetra, Bennett), B.Tech / M.Tech / MCA / MBA programs,
CSE / IT / AIML / ECE / ME / CE branches, real AKTU subject codes, four exam types
(CT, ST, Mid-Sem, End-Sem), two academic years, generated PDF papers, one pending submission,
one restricted current-year submission, paper requests, bookmarks and a report — so every screen
has data. Seed numbers are development data, never presented as production statistics: all
counters in the UI are live database counts.

### Your own admin account

Create or promote a platform admin with your own credentials — the password is typed into the
terminal, never echoed, and only its bcrypt hash is stored:

```bash
npm run admin:create
```

It prompts for email, display name and password. For scripted setups, set `ADMIN_EMAIL`,
`ADMIN_NAME` and `ADMIN_PASSWORD` in `.env` and it runs without prompting. Running it against an
existing email promotes that account to platform admin and resets its password.

### Approval requests by email

Every upload enters the moderation queue as an approval request, and the platform admins plus the
college's moderators receive an email with a direct link to the review screen. Contributors get a
second email when their paper is approved, published, rejected, restricted or sent back for
changes.

Configure Gmail in `.env`:

```env
MAIL_DRIVER="gmail"
GMAIL_USER="you@gmail.com"
GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"   # myaccount.google.com/apppasswords
MAIL_FROM="PaperVault <you@gmail.com>"
ADMIN_NOTIFY_EMAIL="you@gmail.com"         # optional extra inbox
```

Gmail requires 2-Step Verification before it will issue an App Password; your normal Google
password will not work for SMTP. Any other provider works with `MAIL_DRIVER="smtp"` plus
`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`.

With no credentials the mailer falls back to a log-only driver: nothing is delivered, but every
message is still recorded and readable at **Admin → Email outbox** (`/admin/notifications`), so
you can verify the flow without a mailbox.

### Admin powers

Signed in as a platform admin you get, in the sidebar:

- **Admin** (`/admin`) — operations dashboard, stats, audit log.
- **Manage Colleges** (`/admin/colleges`) — every college on the platform; add one (default exam
  types are created automatically), edit it, pin it as the home campus, or delete it. Drill into a
  college to add or delete programs, branches (semesters are generated), semesters, subjects and
  exam types.
- **Manage Papers** (`/admin/papers`) — filter by status or text, then publish, restrict, remove,
  restore or permanently delete any paper along with its stored files.
- **Members** (`/admin/users`) — change any account's role and college scope, or delete an account.
- **Email Outbox** (`/admin/notifications`) — every notification the platform generated.

Deletes that would destroy papers are refused until you tick **Delete anyway**, and every
destructive action is written to the audit log.

`.env` is created from `.env.example` and is git-ignored. Change `AUTH_SECRET` (and never
commit a real one) before deploying.

### Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm test` / `npm run test:unit` | Vitest unit tests |
| `npm run verify` | Typecheck + lint + unit tests in one go |
| `npm run test:e2e` | Playwright journey tests (run `npx playwright install chromium` once; the config builds, starts and re-seeds automatically) |
| `npm run admin:create` | Create or promote a platform admin with your own credentials |
| `npm run db:catalogue` | Load only the college/curriculum catalogue (no demo accounts or papers) |
| `npm run db:purge-demo` | Dry run listing demo (`@papervault.dev`) accounts and their content; add `-- --confirm` to delete them. Refuses until a real admin exists |
| `npm run test:integration` | Database-backed tests (needs a migrated Postgres in `DATABASE_URL`) |
| `npm run db:studio` | Inspect the database |
| `npm run db:seed` | Re-seed (destructive) |
| `npm run db:migrate` | Create a migration from a schema change (`prisma migrate dev`) |
| `npm run db:deploy` | Apply pending migrations without generating one (`prisma migrate deploy`) — use this in production |

---

## 2. Deploying

See **[docs/DEPLOYMENT.md](DEPLOYMENT.md)**. Short version, on any Docker host:

```bash
cp .env.production.example .env.production   # fill in every value
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npm run admin:create
```

That runs Caddy (automatic HTTPS), the app, Postgres, Redis, ClamAV and the nightly
maintenance job. Production never runs the demo seed: it refuses to, and a fresh database gets
only the college and curriculum catalogue (`npm run db:catalogue`).

---

## 3. Architecture

Modular monolith, one direction of dependency:

```text
UI (app/, components/)
  ↓
Server action / route handler (server/actions, app/api)
  ↓
Zod validation (server/validators)
  ↓
Service — business rules, lifecycle, audit (server/services)
  ↓
Repository — queries (server/repositories)
  ↓
Prisma → database
```

```text
src/
  app/           routes, layouts, metadata, sitemap, robots, manifest
  components/    design-system components (server + client)
  lib/           db, auth, storage drivers, hashing, errors, logging, rate limit, tokens
  server/
    actions/     server actions (the only mutation entry points from the UI)
    services/    papers, uploads, moderation, search, stats, library, requests, reports, audit
    repositories/ colleges, academics, papers
    validators/  Zod schemas
    authz.ts     RBAC + college tenant boundary
prisma/          schema + seed
tests/           unit (vitest) + e2e (playwright)
```

Business logic never lives in components. Authorization is always recomputed on the server from
the session cookie; role and `collegeId` are never read from client input.

### Domain model

`User · College · Program · Branch · CurriculumVersion · Semester · Subject · ExamType ·
ExamSession · PaperSet · Paper · PaperFile · PaperEvent · PaperRequest · Bookmark · PaperView ·
Report · AuditLog`

Key decisions:

- **Exam session + paper set** — one subject/year can legitimately have Set A, Set B, Set C.
- **Canonical papers** — `Paper.canonicalId` plus `PaperFile.sha256` lets duplicates merge into one
  canonical paper with several files instead of five competing records.
- **Curriculum versioning** — subjects point at a `CurriculumVersion`, so papers from incompatible
  curricula are not silently compared.
- **Question intelligence is future-ready, not faked** — the paper → question → topic → unit path is
  a deliberate extension point; there is no fake prediction anywhere in the product.

### Paper lifecycle

```text
DRAFT → SUBMITTED → (automated checks) → PENDING_REVIEW → APPROVED → PUBLISHED
                                        ↘ RESTRICTED / REJECTED / CHANGES_REQUESTED
PUBLISHED → RESTRICTED | REMOVED | MERGED
```

Transitions are whitelisted in `PAPER_TRANSITIONS`, executed in `transitionPaper()`, appended to
`PaperEvent`, and written to `AuditLog`. Student uploads never auto-publish.

### Current-exam protection

- Uploads dated to the current or an upcoming cycle go to `RESTRICTED`, not the public archive.
- A `CURRENT_OR_UPCOMING_EXAM` report immediately restricts a published paper pending review.
- Restricted papers explain *why* they are restricted and never expose the file.

### Security

**Identity and sessions.** Signed httpOnly cookie (`jose` HS256) that carries a *session id*, not
just a user id: every session is a database row, so sign-out, a ban, a password change or "revoke
this device" takes effect on the very next request instead of waiting for the JWT to expire.
Settings lists your signed-in devices with browser, approximate location and last-seen time, and
lets you revoke any one of them or all the others at once.

**Passwords and email.** bcrypt hashing. Email verification and password reset use single-use
tokens stored as hashes with short expiries; a reset request for an unknown address returns the
same response as a known one, so the form cannot be used to enumerate accounts. Changing your
password revokes every other session.

**Two-factor authentication.** TOTP (RFC 6238) via `otplib`, enrolled by scanning a QR code or
typing the key. Confirmation issues ten single-use recovery codes, shown exactly once and stored as
SHA-256 hashes, compared in constant time and burned on use. Sign-in becomes two steps: the
intermediate state lives in its own five-minute signed cookie and can never be mistaken for a
session. Admin roles must enrol before the admin screens open (`REQUIRE_ADMIN_2FA`, on by default
in production).

**Uploads.** Magic-byte MIME sniffing, so a disguised HTML file is rejected even with a `.pdf`
name. Optional ClamAV scanning over `INSTREAM` (`MALWARE_SCANNER=clamav`). Every PDF is re-written
through a parser, which drops embedded JavaScript, launch actions and attached files; a PDF that
cannot be parsed is refused rather than stored. Size limits, sanitised filenames and traversal-safe
storage keys, and file delivery only through an authorising route.

**Abuse limits.** Fixed-window limits on login, register, upload, comment, report, request,
takedown, 2FA confirmation and 2FA verification — backed by Redis when `REDIS_URL` is set, with an
in-memory fallback for single-instance deployments.

**Headers.** Content-Security-Policy, HSTS, `X-Content-Type-Options`, `Referrer-Policy` and a
Permissions-Policy that allows `camera=(self)` only. `/api/files/*` gets a stricter set with
`Content-Disposition` and no-store caching.

**Boot-time validation.** `instrumentation.ts` refuses to start a production server with the
development `AUTH_SECRET`, a missing `DATABASE_URL`, or an S3 driver with no bucket.

**Errors and logs.** Categorised errors (`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`,
`EMAIL_UNVERIFIED`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `STORAGE_ERROR`, `INTERNAL_ERROR`)
that never leak stack traces, plus audit logging and structured logs with secrets redacted.

### Design system

Tokens live in `tailwind.config.ts`; component classes in `src/app/globals.css` (`.pv-panel`,
`.pv-card`, `.pv-btn-*`, `.pv-input`, `.pv-chip`, `.pv-h1`…). Space Mono for display, Inter for UI.
Cream canvas, light-blue sidebar, deep-navy frame, pastel category colors, 2px ink borders, hard
offset shadows, minimal rounding, restrained hover movement. Every page reuses the same shell,
typography, borders, buttons and spacing.

Accessibility and responsiveness: semantic landmarks, labelled controls, visible focus rings,
`prefers-reduced-motion` support, and recomposed (not shrunk) layouts at 360 / 390 / 768 / 1024 /
1440px.

#### Brand assets

The official monogram and wordmark are the single source of truth and live at
`public/brand/papervault-mark.png` (512x512) and `public/brand/papervault-wordmark.png` (1053x613).
The same artwork is exported as `src/app/icon.png`, `src/app/apple-icon.png` and
`src/app/opengraph-image.png`.

Always draw the logo through `src/components/Brand.tsx` — `LogoMark`, `LogoWordmark` or
`BrandLockup` — never with a raw `<img>`. Those components pin the aspect ratio, the framing and
the alt text. Do not recolour, redraw, stretch, crop or add effects to the artwork. The mark is
designed for a near-black field, which is why it is framed on the `navy` (`#00002A`) token.
To regenerate the derived sizes, re-export from the originals; do not upscale the committed PNGs.

---

## 4. What is implemented

### Discovery and reading

Home · college search with filters and pagination · college profile with live coverage bars ·
program → branch → semester → subject navigation · subject page with exam-type tabs and papers
grouped by year · "not in the archive yet" request flow · paper detail with inline zoomable viewer,
save, report and related papers · authorized download · my library (saved, recently viewed,
uploads, requests) · contributor profiles with subtle trust levels · statistics · SEO metadata,
sitemap, robots and PWA manifest · loading, empty, error and restricted states throughout.

**Search** parses a query into colleges, branches, subjects, exam types and years and filters on
what it resolves. When nothing in the hierarchy matches, it falls back to the paper title *and the
text layer extracted from the PDF at upload time* — so searching `two-phase locking` finds papers
that contain the phrase without it appearing in any title.

### Contributing

Upload with cascading metadata, content validation and hard duplicate blocking. Two ways to add
pages:

- **Choose a file** — a PDF, JPEG or PNG from the device.
- **Take photos** — opens the camera in the browser, captures page after page, lets you reorder or
  delete thumbnails and flip between front and rear cameras, then converts the shots into a single
  A4 PDF server-side (landscape shots get a rotated page so text stays upright). Falls back
  gracefully when there is no camera or permission is refused.

**Duplicates are refused, not flagged.** Three checks run before a single byte is written:

| Check | Catches |
| --- | --- |
| File hash | The same bytes anywhere in the archive, including papers sitting in the recycle bin |
| Content fingerprint | A normalised hash of the extracted text — a re-export or re-scan with different bytes and identical pages. Skipped for documents with under 200 normalised characters, which are not distinctive enough to judge |
| Slot | The same subject, exam type, academic year and set label |

Every refusal names the paper it collided with, says if that paper is in the recycle bin, and for a
slot clash explains how to file a genuinely different paper as Set B or Set C. Because the checks
run first, a rejected upload leaves nothing behind.

### Discussion

A threaded discussion under every published paper, two levels deep. Sign-in and a verified email
address are required to post. Authors can edit for fifteen minutes and delete at any time;
moderators can remove any comment and must record a reason, which is shown in its place so the
thread still reads. Comments can be reported into the same moderation queue as papers, and replies
notify the parent author in-app and by email.

### Notifications

Every moderation decision and comment reply writes an **in-app notification**, which is the durable
record: the header bell shows an unread count and `/inbox` lists them with mark-as-read and
mark-all-as-read. Email is layered on top and is opt-out per category in Settings, so switching
email off never loses a notification.

### Moderation

Queue with search, filter and pagination · review page with duplicate candidates and decisions
(approve / publish / request changes / reject / restrict / merge) · report resolution · reported
comments · **takedown queue** · **recycle bin**.

- **Takedowns.** A public form at `/legal/takedown` lets a rights holder or an affected individual
  file a notice without an account, with a good-faith statement, rate limits keyed on both email
  and IP, and an automatic acknowledgement carrying a reference number. Moderators action or
  decline each notice and the claimant is emailed the outcome.
- **Recycle bin.** Removing a paper is a soft delete: it leaves every listing immediately but stays
  recoverable for thirty days. Restoring puts it back in the review queue rather than straight back
  live. Platform admins can purge early; a nightly job purges the rest along with expired tokens.
  The filter is enforced by a Prisma client extension, so a query that forgets `deletedAt` still
  cannot surface a deleted paper.

### Administration

`/admin` is a control center, not a menu. One search box resolves colleges, programs, branches,
subjects, papers and members in a single query; alongside it sit a "needs attention" panel, nine
live inventory counters and the audit trail.

- **`/admin/branches/[branchId]`** — the taxonomy editor. Rename or recode a subject inline, delete
  one, paste a whole semester in as `code, name` lines (unreadable lines are reported rather than
  silently dropped), or apply the built-in curriculum template for that branch, which adds what is
  missing and never touches what is already there. Empty exam slots are listed for cleanup.
- **`/admin/users/[userId]`** — the member record. Edit name, email, role and college; ban, unban,
  verify an email, reset two-factor, revoke every session, or delete the account. The last platform
  admin cannot be demoted, banned or deleted.
- **`/admin/colleges/[collegeId]`** — counts and row actions for every program, branch and exam
  type, UG first.

Colleges, programs, branches, semesters, subjects, exam types, exam sessions, paper sets and
curriculum versions can all be created, edited and deleted. Admin screens sit behind two-factor
authentication, and every mutation writes to the audit log.

### Curriculum catalogue

`src/data/curriculum.ts` holds the AKTU subject lists, semester by semester, for fourteen branch
tracks — B.Tech CSE, IT, AIML, Data Science, ECE, EE, ME and CE (eight semesters, 47 subjects each,
sharing the common first year), M.Tech CSE and VLSI, MCA, MBA, BCA and BBA. Each college in the
seed carries every program and branch, so a fresh database browses **7,530 subjects across 1,380
semesters**. The same tables back the admin "apply catalogue" action, so the seed and the importer
cannot drift.

### Support, verification and trust & safety

- **Support tickets** (`/support`, `/my-tickets`): categories for adding a college or subject,
  reporting a member/comment/paper, account, technical, copyright and general questions. Numbered
  `PV-YYYY-NNNNNN` atomically, private to the requester (others get 404), up to 3 private
  attachments, idempotent replies, rate limited. Admins (`/admin/tickets`) reply publicly or add
  internal notes the member never sees, set status/priority/assignee; every change is an event
  and audited. Restricted members can still open tickets (e.g. to appeal).
- **College and subject requests** (`/admin/requests`): approving creates the college or subject
  through the normal admin tools exactly once (concurrent approvals conflict) and resolves the
  ticket; rejecting or asking for more information requires a note to the member.
- **Teacher verification** (`/teacher-verification`, `/admin/teacher-verifications`): application
  with private documents, review with typed confirmation for approve/revoke, request for more
  information, rejection with cooldown, document retention purge, *Verified Teacher* badge on the
  contributor profile.
- **Member standing**: warn, restrict, suspend (days) and ban with a reason, applied from the member
  page; suspensions and bans sign the member out everywhere; members see a standing banner.
  Members can report other members (`/admin/reports?tab=users`).
- **Exam classification**: uploaders say whether the exam is past/released/unknown; current or
  upcoming exams are refused, unknown and current-year papers are held, and nothing can be
  published unless classified as past or released.
- **Audit log** (`/admin/audit`): append-only at the database level, with reasons.
- **Launch switches**: `TEACHER_VERIFICATION_ENABLED=false` closes new teacher applications;
  `DONATION_UPI_ID` powers the *Buy me a coffee* page (`/coffee`, UPI QR + deep link) and is
  hidden when empty.

### Operations

- `GET /api/healthz` — liveness plus dependency readiness (database, rate-limiter backend, malware
  scanner, error reporting). Returns 503 when the database is unreachable.
- `POST /api/cron/purge` — nightly maintenance, authorised with `Bearer $CRON_SECRET` compared in
  constant time. Purges expired recycle-bin papers and auth tokens, and retries failed email.
- `src/lib/observability.ts` — one `captureError` seam for the whole app. Set `SENTRY_DSN` and
  install `@sentry/nextjs` and it activates; otherwise errors are logged. `onRequestError` in
  `instrumentation.ts` catches uncaught server-component, route-handler and server-action errors.
- `.github/workflows/ci.yml` — typecheck, lint and unit tests in one job; build plus Playwright in
  another, with the report uploaded on failure. `codeql.yml` runs security-and-quality analysis.

### Legal

`/legal/terms`, `/legal/privacy` and `/legal/takedown`, linked from the footer and the sitemap,
written for a student-run archive rather than copied boilerplate.

The privacy rights they promise are implemented, not aspirational:

- **Data export** — `GET /api/account/export` returns everything held about the caller as one JSON
  download. Password hashes, TOTP secrets and session tokens are excluded by construction.
- **Erasure** — Settings → Your data. Overwrites the identity in place, destroys credentials,
  sessions, tokens, bookmarks, reading history, reports and messages, withdraws comment text, and
  signs out every device. Contributed papers stay in the archive under an anonymous author, because
  other students depend on them; a specific paper comes down through the takedown process instead.
  Guarded by password re-entry plus a typed confirmation, and refused for the last platform admin.

### Known gaps (deliberate, documented)

- **OCR.** Photographed papers have no text layer, so they are searchable by metadata only.
  `extractPdfText` is the seam an OCR pass would plug into.
- **Search scale.** The full-text fallback is `LIKE` over an extracted-text column, which is right
  for thousands of papers. On PostgreSQL, switch it to `tsvector` with a GIN index.
- **College-only paper visibility** (a paper visible only to members of its college) is not built;
  papers are public once published, and current-cycle papers are held back instead.
- **Takedown review requests by uploaders** have no dedicated form; uploaders contest an
  actioned takedown through a support ticket (category Copyright), and admins can move the notice
  to *Review requested* / *Restored*.
- **Bulk moderation actions** (select several papers, one decision) are not built. The admin
  tables and the moderation queue both paginate.
- **Auto-approve for trusted contributors** is modelled (`trustLevel`) but not yet wired to skip
  review.
- **Job queue.** There is no worker process. Email is dispatched inline and retried by the nightly
  cron endpoint (five attempts per message); purges run from the same endpoint. A real queue would
  be the next step if volume grows.
- **Accessibility** has been built to WCAG AA by construction — semantic landmarks, labelled
  controls, visible focus rings, `prefers-reduced-motion` — but has not had a formal audit with a
  screen reader.

---

## 5. Verified in this state

- `npm run typecheck` — clean
- `npm run lint` — no ESLint warnings or errors
- `npm run test:unit` — **136 unit tests pass**
- `npm run test:integration` — **36 database-backed tests pass** (ticket numbering under
  concurrency, ticket privacy / IDOR, internal notes and private attachments, idempotent replies,
  admin-only ticket changes, restricted-member appeals, college/subject request approval races,
  member reports, suspension revoking sessions, append-only audit log, the full teacher
  verification lifecycle, upload races and the publish guard, pins)
- `npm run test:e2e` — **71 Playwright journeys**, including support tickets end to end (admin
  reply visible, internal note never shown, another member gets 404), a college request approved
  into a real college, teacher apply → admin approve → badge, reporting a member, the new policy
  pages, and admin-only access to every new admin workspace, alongside the existing upload,
  moderation, account, 2FA, takedown, pins and back-navigation journeys. Last run: 70 passed,
  1 flaky (a pins list test that passed on retry)
- `npm run build` — production build succeeds
- `npm audit` — no fixable advisories; the two remaining are build-time `postcss` issues with no
  published fix (see `docs/SECURITY.md`)
- Scripted responsive audit — 12 pages at 375 / 430 / 768 / 1280 / 1536 / 1920px: no horizontal
  overflow, no broken images, no console errors, no failed requests
- Scripted accessibility audit — 29 routes at 390px: exactly one `h1` per page, no heading skips,
  no duplicate ids, no unlabelled fields, no missing alt text, no unnamed controls, and every
  interactive target at least 24px

See `docs/SECURITY.md` for the threat model and known gaps, and `docs/DEPLOYMENT.md` for the
pre-launch checklist.
