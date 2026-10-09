# Changelog

## Paper viewer works on phones

### Fixed

- PDFs now render on Android phones. The viewer used the browser's built-in
  PDF plugin, which mobile Chrome doesn't have, so phones only saw "Your
  browser cannot display PDFs inline". Pages are now drawn with pdf.js
  (`pdfjs-dist`, served from `/public/pdfjs`, no CDN, CSP unchanged), so the
  same viewer, with zoom, works on every device.

### Added

- The upload confirmation links straight to the new paper ("View your upload").

## One paper, several branches

### Added

- **Multi-branch papers.** When a paper was set for several branches (say
  DBMS for CSE, IT, IoT and DS), the uploader ticks the other branches on the
  upload form instead of uploading it again. The form suggests subjects in
  sibling branches of the same program with the same code or name, with a
  "Select all branches" shortcut.
- The paper then shows on each listed subject's page, in related papers and in
  subject/branch search. Its page has an "Also for" row linking each branch.
- Moderators (own college) and admins can change the branches from the review
  page ("Also for other branches"); every change is audited
  (`paper.listings_updated`).
- New `PaperListing` table (migration `20261009120000_paper_listings`). It is
  additive, so existing papers are unaffected; `prisma migrate deploy` applies
  it on the next deploy.

## Launch switches

### Added

- **`TEACHER_VERIFICATION_ENABLED`** — set `false` to close new teacher
  verification applications. The page says "not open yet", the Settings link
  is hidden, the server refuses new submissions, and admins can still finish
  reviewing existing requests. Defaults to on locally; the production template
  ships it off.
- **Buy me a coffee** (`/coffee`) — UPI QR code, UPI ID with a copy button and
  an "Open my UPI app" deep link, linked from the sidebar and footer.
  Configured with `DONATION_UPI_ID` / `DONATION_PAYEE_NAME` /
  `DONATION_QR_PATH`; an empty `DONATION_UPI_ID` hides it.
- Both shown on `/admin/settings`.

### Fixed

- `npm start` binds `0.0.0.0` by default (Fedora exports `HOSTNAME`).
- Production compose uses the multi-arch ClamAV image (ARM servers).

## Production workflows: support, verification, trust & safety

### Added

- **Support tickets** — `/support`, `/my-tickets`, `/admin/tickets`. Atomic
  `PV-YYYY-NNNNNN` numbering, private attachments (permission-checked route,
  admin access audited), public replies vs internal notes, status / priority /
  assignee, events timeline, idempotent replies, per-user and per-IP limits,
  email + in-app notifications to the member and `ADMIN_EMAIL`.
- **College and subject requests** — `/admin/requests`. Duplicate checks on
  submit; approval creates the record once and resolves the ticket.
- **Teacher verification** — application with private documents, admin review
  (start review, request information, approve with typed APPROVE, reject,
  revoke with typed REVOKE, internal notes, delete documents), retention purge
  in the nightly job, re-apply cooldown, *Verified Teacher* badge.
- **Member standing** — warn / restrict / suspend (N days) / ban / restore with
  reasons; suspend and ban revoke sessions; standing banner in Settings.
- **Member reports** — "Report member" on contributor profiles; reports tab in
  `/admin/reports`.
- **Exam classification** on upload and in moderation; publishing requires
  *past* or *released*.
- **Audit log page** `/admin/audit`; audit rows are append-only (DB trigger).
- **Admin overview** "Needs attention" cards; read-only `/admin/settings`.
- **Policy pages** — Community Guidelines, Academic Integrity, Report Content,
  Teacher Verification, Data Rights, Contact; footer links.
- **Takedown statuses** — under review, actioned, rejected, review requested,
  restored, closed; recently actioned list.
- **Mail drivers** `resend` and `postmark` (HTTPS APIs).
- **`npm run db:purge-demo`** — removes demo accounts and their content while
  keeping the catalogue (dry run by default).
- Data export / erasure cover tickets and teacher verification.
- Tests: integration suites for tickets, requests, reports, standing, audit
  immutability and teacher verification; e2e journeys for each workflow.

### Changed

- The member page's Ban / Lift buttons are replaced by the standing form.
- Upload form requires an exam classification.

### Migration

- `20261008112600_production_workflows` (additive). Run
  `npx prisma migrate deploy`.

## Back navigation

### Added

- **← Back** button on every deeper page (college → program → branch →
  semester → subject → paper, admin detail pages, moderation sub-pages,
  contributor profiles, legal pages). Sits beside the breadcrumb trail.
- History-aware: when you arrived from inside PaperVault, Back behaves exactly
  like the browser's Back, so search queries, filters, pagination and scroll
  come back as you left them. Landed directly (shared link, new tab, after
  sign-in), it goes to the logical parent instead and replaces the current
  history entry, so Back can never loop or send you off-site or into a
  finished sign-in form. It is a real link to the parent, so it works without
  JavaScript, and modified clicks open the parent in a new tab.
- Top-level pages (Home, Explore, Search, Library, Upload, Moderation, Admin…)
  have no Back button; the browser's Back is never overridden.

### Changed

- Removed the duplicate "Back to all colleges / all members / college" links at
  the bottom of admin detail pages and the "Back to queue" buttons in the
  recycle bin and takedown queue.

## Pinned colleges

### Added

- **Pin / unpin colleges** from the college page, the college list and search
  results. Private to the user: no public counts, no effect on ranking.
  Pins show under **My Colleges** in the sidebar and mobile menu (up to six)
  and in full on **My Library**. Optimistic, no full reload; URL, filters and
  back navigation are untouched.
- `UserPinnedCollege` table with a composite primary key on
  `(userId, collegeId)` so duplicates are impossible at the database level;
  indexes on `(userId, createdAt)` and `collegeId`; cascades on user/college
  deletion. Included in data export and wiped by account erasure.
- Up to 50 pins per user; 60 pin changes per minute.
- `REGISTRATIONS_PER_IP_PER_HOUR` (default 60, so a class can sign up together
  from one campus network).

## Round 6 — full curriculum, hard duplicate blocking, admin control center

### Added

- **A real curriculum catalogue.** `src/data/curriculum.ts` carries the AKTU
  subject lists semester by semester for fourteen branch tracks: B.Tech CSE,
  IT, AIML, Data Science, ECE, EE, ME and CE (eight semesters, 47 subjects
  each, sharing the common first year), M.Tech CSE and VLSI, MCA, MBA, BCA and
  BBA. Every college in the seed now carries every program and branch, so the
  archive browses **7,530 subjects across 1,380 semesters** instead of a
  handful of showcase rows. `curriculumFor()`, `curriculumRows()` and
  `curriculumSubjectCount()` are the only ways the tables are read, so the seed
  and the admin importer cannot drift apart.
- **Duplicate uploads are refused, not flagged.** Three independent checks run
  *before* anything is written to storage or the database:
  - **File hash** — the same bytes, anywhere in the archive, including the
    recycle bin.
  - **Content fingerprint** — a normalised hash of the extracted text, so a
    re-export, a re-scan or a re-save with different bytes and identical pages
    is still caught. Documents with too little text to be distinctive (under
    200 normalised characters) are skipped rather than guessed at.
  - **Slot** — the same subject, exam type, academic year and set label.
  Each refusal names the paper it collided with, says whether that paper is in
  the recycle bin, and — for a slot clash — explains how to file a genuinely
  different paper as Set B or Set C.
- **Admin control center.** `/admin` is now a working surface rather than a
  menu: one search box that resolves colleges, programs, branches, subjects,
  papers and members in a single query; a "needs attention" panel; nine live
  inventory counters; and the audit trail.
  - **`/admin/branches/[branchId]`** — the taxonomy editor. Rename or recode
    any subject inline, delete one, paste a whole semester in as
    `code, name` lines, or apply the built-in curriculum template for that
    branch in one click (it adds what is missing and never touches what is
    already there). Empty exam slots are listed with a delete control.
  - **`/admin/users/[userId]`** — the member record. Edit name, email, role and
    college; ban, unban, verify an email, reset two-factor, revoke every
    session, or delete the account. The last remaining platform admin cannot be
    demoted, banned or deleted.
  - **`/admin/colleges/[collegeId]`** — restructured around counts and row
    actions instead of an unusable subject tree, with UG programs listed first.
  - Programs, branches, subjects, exam types, exam sessions, paper sets and
    curriculum versions can all be created, edited and deleted.

### Fixed

- **Sanitising a PDF stamped the current time into it.** pdf-lib writes a fresh
  `CreationDate` and `ModDate` into every document it creates, so the same file
  uploaded twice produced different bytes and therefore a different SHA-256 —
  which quietly defeated hash-based duplicate detection. Sanitised output now
  pins both dates, so the hash is a property of the document.
- **Touch targets.** Breadcrumb links and admin checkboxes were under 24px. Both
  audits — 12 pages at six viewports and 29 routes at 390px — are now clean.
- **Subject URLs.** Slugs are the subject name, with the paper code appended
  only when one semester really does carry the same name twice.

## Round 5 — official brand integration and interaction polish

### Added

- **Official logo assets.** The supplied monogram and wordmark are the single
  source of truth. They live unmodified (beyond trimming and re-adding uniform
  black padding) at `public/brand/papervault-mark.png` and
  `public/brand/papervault-wordmark.png`, and are also exported as the app
  icon, Apple touch icon and Open Graph image.
- **`src/components/Brand.tsx`.** `LogoMark`, `LogoWordmark` and `BrandLockup`
  are the only ways the logo is drawn, so aspect ratio, framing and alt text
  cannot drift. The artwork sits on black and the `navy` token is `#00002A`, so
  the mark reads as one solid tile.
- **`src/components/AuthScreen.tsx`.** Login, registration, password reset,
  email confirmation and the two-step challenge now share one branded frame.
- **Notifications in the sidebar.** The header bell is hidden below `sm`, so
  `/inbox` was unreachable on a phone. It is now a nav item with an unread
  badge in both the sidebar and the drawer.
- **`.pv-link` / `.pv-link-title` / `.pv-checkbox`** component classes, so every
  text link and checkbox meets the 24px target guidance without changing the
  type scale.
- **Route-scoped loading skeletons** for the browse screens, shaped like the
  pages they stand in for.

### Fixed

- **Post-action redirects hung on a skeleton.** A root `src/app/loading.tsx`
  applied to every route. A server action that ends in `redirect()` back to its
  own route re-entered that boundary and never resolved, so admin college
  creation and deletion, admin paper decisions, moderation decisions, comment
  edits and recycle-bin actions all landed on an empty skeleton until the user
  reloaded. Loading boundaries are now scoped to read-only browse routes. The
  end-to-end suite also got ~40% faster as a result.
- **Empty PWA icon list.** `manifest.ts` declared `icons: []`, so an installed
  app had no icon. It now points at the 512px mark with `any` and `maskable`.
- **Seeded credentials were printed on the production sign-in page.** They are
  now shown only when `NODE_ENV === "development"`.
- **`/admin` scrolled sideways on a phone.** `.sr-only` labels inside the
  horizontally scrolling members table were positioned against the page rather
  than the scroll container, widening the document. `.pv-table-wrap` is now a
  positioned ancestor.
- **Heading order on `/colleges`.** The card titles jumped from `h1` to `h3`;
  the results are now inside a labelled section with an `h2`.
- **Duplicate "Already have an account?" link** on the registration form.
- **`truncate` on flex containers** never clipped the contributor names on the
  home and statistics pages; the text is now in a child span.
- Footer links no longer prefetch six dynamic routes on every page view.

### Verified

Typecheck and lint clean, 74 unit tests, 40 end-to-end tests with zero flakes,
production build clean. Scripted audit across 375 / 430 / 768 / 1280 / 1536 /
1920px on 10 pages: no horizontal overflow, no broken images, no console errors,
no failed requests. Scripted accessibility audit over 28 routes at 390px: one
`h1` per page, no heading skips, no duplicate ids, no unlabelled fields, no
missing alt text, no unnamed controls. The remaining report is 20px checkboxes,
each wrapped in its own `<label>`, so the actual hit area is the label row.

## Round 4 — production readiness and security hardening

### Added

- **Version control.** The project is now a git repository with a baseline commit.
- **Real Prisma migrations.** `prisma/migrations/` is committed and the existing
  database was baselined. `npm run setup` and CI use `prisma migrate deploy`
  instead of `db push`; `npm run db:migrate` creates new migrations.
- **Nonce-based Content-Security-Policy.** `src/middleware.ts` issues a fresh
  random nonce per request and `script-src` no longer allows `'unsafe-inline'`.
  Added `worker-src`, `frame-src` and `manifest-src`; pinned `base-uri`,
  `form-action` and `frame-ancestors`.
- **Explicit same-origin enforcement.** Any `POST`/`PUT`/`PATCH`/`DELETE` that a
  browser did not initiate from this site is refused with `403`, as a second
  layer behind Next's own server-action origin check. `/api/cron/*` is exempt
  because it is authenticated by a bearer secret.
- **Account data export.** `GET /api/account/export` returns everything held
  about the caller as one JSON download, with credentials excluded.
- **Account erasure.** Settings → Your data. Anonymises the account in place,
  destroys credentials, sessions, tokens, bookmarks, reading history, reports
  and messages, and withdraws comment text. Contributed papers stay in the
  archive under an anonymous author. Guarded by password re-entry and a typed
  confirmation, and refused for the last platform admin. This closes the gap
  between what the privacy policy promised and what the app did.
- **Email retry.** Failed and queued mail is retried by the nightly cron job,
  up to five attempts per message, tracked on `Notification.attempts`.
- **Pagination** on the admin Papers and Members tables, plus a member search.
- **`/.well-known/security.txt`** with a disclosure contact and policy.
- **`docs/SECURITY.md`** — threat model, controls, and known gaps.
- **`docs/DEPLOYMENT.md`** — Postgres and S3 migration, secrets, cron, and a
  pre-launch checklist.
- **Dependency audit job** in CI, failing on a fixable high or critical advisory.
- 14 new tests: 8 unit (origin checks, CSP construction, password verification
  against an unusable hash) and 6 end-to-end (CSP nonce and absence of
  violations, per-request nonce rotation, cross-origin POST rejection, the
  maintenance endpoint's secret gate, the file route's strict policy,
  `security.txt`, admin pagination, data export, export authorisation, erasure).

### Changed

- `Permissions-Policy` additionally denies display-capture, serial, Bluetooth
  and idle detection.
- Production browser source maps disabled.
- `CRON_SECRET` is compared with `timingSafeEqual`.
- `verifyPassword` returns `false` instead of throwing when the stored hash is
  not a valid bcrypt hash, which is what an erased account holds.
- Sign-in explicitly refuses an erased account.
- CSP moved out of `next.config.ts` into middleware; the static headers stayed.
- The privacy policy now describes export and erasure precisely.
- `docs/phases.md` next-steps list rewritten to reflect reality.
- Vitest upgraded 2 → 5 and `deepmerge-ts` pinned via an override, taking
  `npm audit` from 10 advisories (1 critical, 5 high) to 2 build-time `postcss`
  advisories with no published fix.
- Removed the unused `@napi-rs/canvas` dependency.
- Security decision logic extracted to `src/lib/security.ts` so it is unit
  testable without an edge request object.

### Notes

The two remaining `npm audit` advisories are against `postcss`, reached only
through the Next build toolchain, and no fixed version exists upstream. They
affect build time, not request handling. Re-check on every dependency bump.
