# Changelog

## v15 navigation correction

- Uses ordinary document links for semester subject rows and search subject results, rather
  than relying on a client-router streamed transition. Disabling prefetch alone did not prevent
  stalled subject navigation in GitHub CI. No CSP relaxation or longer test timeouts are used.
- Adds desktop/phone document-request subject navigation and browser Back coverage.

## v15 — Discovery and contribution foundations

- Adds public Papers Wanted, college filtering, prefilled contribution links and safe native/copy sharing.
- Improves homepage guidance and public reading; adds `/guide` with review-label explanations.
- Adds search pagination, recent-paper browsing, code/session normalization and explicit aliases.
- Retains college/branch scopes and all subject terms, including empty matches; removes the
  suggestion-ID cap on paper matching.
- Fixes premature request fulfillment: public availability, including cross-listings, determines
  request state rather than upload-time flags. Pending/restricted/deleted copies do not qualify.
- Validates request account standing, email policy, active subject and same-college exam type.
- Preserves subject/exam/year through request sign-in and adds subject-page year filtering.
- Shows honest contribution/download totals and explains verification limitations.
- Adds dropdown keyboard announcements, read-only launch checks, pilot and upgrade documentation.
- Displays printed session labels/subject codes in listings and disables speculative subject-link
  prefetch; browser failures retain screenshots, traces and an HTML report for diagnostics.
- Adds regression tests; existing MIT and third-party notices are retained.


## v14 — Themed suggestions and safer detection retries

- Replaces native college/branch datalist popups with searchable, keyboard-
  accessible cream/navy suggestions, wrapped labels, touch-sized options and
  viewport-aware placement. Unknown values still support manual group creation.
- Adds a clear-PDF/photo tip in Auto-detect and a Retry detection action.
  Edited values, including mouse-selected suggestions and exam type, are
  protected from late responses and retries.
- Reads scanned page one first, using page two only when core fields remain
  missing after header retries. Adds a total OCR subprocess budget, retaining
  existing per-process limits, concurrency, cache and temporary-file cleanup.
- Handles damaged/encrypted PDFs with a manual-entry warning. Improves adjacent
  table-cell parsing and consistent start-year handling of academic sessions.
- For a known college, shared exact-code catalogue matches can suggest missing
  programme/semester only by agreement; they require confirmation and do not
  guess a primary branch or overwrite conflicting printed metadata.
- Preserves local-only OCR, moderation, malware scanning, preview and existing
  file/content/exam-slot duplicate protections. No migration, API key or new
  environment variable is required; rebuild the application image.
- Validation: TypeScript, lint and production build passed; 174 unit tests,
  67 database integration checks (including both supplied PDFs and rotated,
  tilted and watermark variants), and 115 full-site browser checks passed.
  The final browser run used zero retries; one optional teacher workflow was
  skipped. Responsive checks covered 11 core routes at 320, 390, 768, 1024,
  1280, 1440, 1920 and 2560px, plus landscape preview. Visually reviewed
  dropdowns and the clear-scan tip on phone/tablet/desktop; separately checked
  upward dropdown placement on phone and tablet.

## v13 — Free local recognition, paper preview and responsive upload workspace

- Adds local orientation, grayscale/contrast/sharpening and conservative deskew
  header comparisons. Native PDF text stays the fast path for real headers;
  footer-only or watermark text does not hide scanned metadata.
- Uses bounded, versioned caching and shares concurrent same-file reads. No cloud
  OCR API, key or document-service charge; normal hosting/CPU costs still apply.
- Moves optional detection to its own abortable request, so reading does not
  block editing or hold the upload action queue. Late results preserve user edits.
- Flags conflicting readings and catalogue names rather than overwriting printed
  evidence. Ambiguous branches still need confirmation.
- Adds Preview paper for selected PDFs and images, with paginated PDF rendering,
  zoom, keyboard close and background scroll lock. Preview keeps local bytes in
  the browser and preserves form values.
- Replaces the narrow desktop form with file/details columns and a centred fluid
  workspace; phone/tablet layouts stack. Fixes small-screen home/library grid
  overflow, long paper-title/detail overflow, search shrinking and touch controls.
  Paper lists now adapt to their own container width, so sidebar cards retain
  readable titles instead of squeezing them beside all the badges.
- Bounds streamed detection requests before multipart parsing, including chunked
  requests that do not declare their size.
- Existing manual group creation, moderation, malware and duplicate checks remain.
  No schema migration or new environment variable is required. Rebuild the image
  to install the explicit Sharp dependency.
- Validation: TypeScript, lint and production build passed; 173 unit and 65
  database integration checks passed, including both supplied scans and rotated,
  tilted and watermark variants. Full-site regressions exercised existing account,
  moderation and security workflows (one optional teacher test was skipped).
  Rebuilt upload/duplicate/feedback/preview run: 37 checks passed without retries.
  After the container-width card adjustment, all 16 final responsive and preview
  checks passed on a fresh build with zero retries. Audited 11 core routes at 320, 390, 768, 1024, 1280,
  1440, 1920 and 2560px; checked the preview at 812×375 landscape. Visually reviewed
  responsive forms, published-paper/admin layouts and genuine scanned-PDF previews.


## v12 — Simpler upload form and manual group creation

- Adds clearly labelled Auto-detect, Enter manually and Choose existing groups
  controls. Manual entry skips OCR and stale results cannot overwrite its values.
- Keeps essential paper fields up front. Replaces the duplicate primary-branch,
  branch-name and branch-code questions with one editable branch field and
  catalogue suggestions. Generates a shorthand for new user-entered branches.
- Collapses university, branch-code overrides, test/session, paper set, moderator
  notes and extra branch listings into More details. Detected sessions remain
  visible in a compact summary with an Edit action.
- Uses a shorter Paper status selector; existing current/upcoming exam refusal,
  user confirmation, malware checks, moderation and duplicate safeguards remain.
- Manual submissions create or reuse the full catalogue chain atomically, just
  like confirmed detected submissions. New colleges remain unverified.
- Guards against reusing a conflicting branch code under a different name.
- Keeps the desktop form to a readable width and retains the phone layout.
- No new database migration, API key or environment variable is required.
- Validation: TypeScript, lint and production build passed; 167 unit tests,
  61 database integration tests and 29 browser regression tests passed. Final
  rebuild: 10 automatic/manual/genuine-scan checks passed with no retries.
  Manual creation and duplicate rejection were checked at 390px and 1280px;
  collapsed/expanded form previews were visually inspected.


## v11 — Hybrid scan recognition and table headers

- Combines native PDF text with local image OCR when only a short native footer
  is readable. Adds orientation-aware full-page reading alongside focused,
  high-resolution table/header layouts; no remote document API.
- Parses adjacent subject/code/semester table cells separately and recognises
  numbered ST/CT/PUT sessions without merging ST-1 and ST-2 into one exam slot.
- Resolves unique catalogue abbreviations while retaining the printed subject
  code. New curriculum codes create distinct subject records; existing records
  are not silently rewritten.
- Uses conservative full-name college matching for minor OCR errors, labelled
  for verification. Ambiguous handwriting or shared branch lists never select
  a primary branch automatically; the upload form offers a catalogue picker.
- Includes the Tesseract orientation model in Docker. Existing moderation,
  validation, file/content/slot duplicate checks and rollback remain in place.
- Adds genuine scan, rotated scan, mixed native/image PDF and submission/duplicate
  regression tests. Private user documents are not bundled.
- Unreadable, absent or ambiguous fields still need contributor confirmation.
  No recognition method guarantees every kind of paper.
- Validation: TypeScript, lint and production build passed; 161 unit tests,
  59 database integration tests and 25 browser regression tests passed with
  zero browser retries. Both supplied scans were exercised; the ST-1 scan was
  submitted successfully, kept pending review, and rejected on repeat upload.


## v10 — Genuine scanned university header recognition

- Adds a focused, higher-resolution sparse OCR retry when a printed subject code
  is unreadable in the first pass, rather than silently guessing letter/digit
  substitutions. Fixes the supplied scan where BCS503 was read as BCSS03.
- Keeps the printed title, programme and semester even when another field is
  missing, so partial recognition is not treated as a completely unreadable paper.
- Auto-fills printed academic-session ranges such as 2025-26.
- Offers existing college names in the editable college field without assigning
  the default college when the document contains no college identity.
- Filename exam hints (for example DAAsem5END.pdf) are explicitly marked as
  suggestions to verify; they never infer the college, branch or publication safety.
- Focused retry applies only to metadata detection. Full-document archival OCR
  and existing file/content/exam-slot duplicate checks are preserved.
- Adds regression coverage for the actual four-page bilingual scan; the user
  document is not distributed in the release archive.
- Validation: TypeScript, lint and production build passed; 158 unit, 54 database
  and 24 browser regression tests passed, including the exact supplied PDF.


## v9 — Free local paper detection and automatic catalogue groups

- File-first upload automatically reads text PDFs and OCRs scanned PDF/JPG/PNG
  papers and camera captures, with a centered loading dialog.
- Detects printed college, subject name/code, semester, programme/branch, exam
  type and unambiguous year; matches existing catalogue entries without guessing
  when multiple entries match. Detected fields remain editable.
- Contributors can confirm missing catalogue details; the upload transaction
  creates/reuses the college, programme, branch, semester, subject and exam type.
  Duplicate rejection rolls back new catalogue groups.
- Preserves hash/content/exam-slot duplicate checks, malware validation, archive
  protection, current/upcoming exam restrictions and moderator approval.
- New colleges are unverified and creations are audit logged and rate limited.
- Docker runner includes free Tesseract/Poppler; no paid AI API or API key needed.
  Non-Docker installations need equivalent OCR packages. Rebuild to upgrade; no
  new database migration required.
- Retains v8 password eyes, scroll-locked modal dialogs, exam colours, notification
  read-on-open and editable upload prefill.
- Validation: TypeScript, lint and production build passed; 155 unit tests and
  53 database integration tests passed. Full browser regression: 88 passed, one
  pre-existing skipped test. Final upload/UI regression after heading refinements:
  23 passed, no retries.


## Password visibility and locked pop-up backgrounds

### Added

- Eye buttons on password fields for registration, sign-in, password reset,
  account security, two-factor disable confirmation and admin-created accounts.
  Passwords remain hidden by default. Show/hide preserves the value and editing
  position, has accessible labels, and never submits the form.
- Each password field has its own independent visibility toggle.

### Fixed

- Loading, success and error dialogs now lock background scrolling until closed.
  Mouse wheel scrolling and phone touch gestures cannot move the underlying page.
- Closing a pop-up restores the original scroll position and prior page styles.
  Long dialog content remains scrollable without scrolling the background.
- Mobile navigation shares the same reference-counted lock, so overlapping
  overlays cannot accidentally unlock each other's backgrounds.
- Admin temporary passwords are now masked by default rather than plain text.

No new database migration or runtime dependency is required.

## Proper centered loading and result dialogs

### Fixed

- Replaced small success notifications and top-of-form error banners with a
  centered modal dialog and dimmed backdrop, on desktop and phones.
- Submission shows a spinner and progress message while the action runs.
  The loading dialog cannot be dismissed accidentally; it switches to the
  success or error result once processing finishes.
- Duplicate-file and other submission errors now appear in the result dialog,
  with an explicit "Go back and fix" action. Field-specific validation messages
  remain next to the relevant fields.
- Successful paper submission includes "View your upload" inside the dialog.
- Failed uploads retain selections, entered details and the chosen file, so
  users do not need to start again.
- Native dialogs keep keyboard focus inside the pop-up and restore it when
  closed; result dialogs can be closed with Escape or the close/action button.

No new database migration or runtime dependency is required.

## Editable upload prefill, exam colors and completion pop-ups

### Added

- "I have this paper" and "Contribute a paper" now open the upload form
  with the current college, program, branch, semester and subject selected.
  The selected exam type and requested year are carried across when known.
  Every field stays editable, and sign-in preserves the prefilled destination.
- Shared, dismissible success pop-ups for uploads, requests, support tickets,
  bookmarks, pins, comments, account settings and admin actions. Confirmations
  fit phone screens, do not steal focus, and survive client-side navigation.
  Validation errors remain next to the form and its fields.

### Fixed

- Exam badges are consistently ST = pink, PUT = yellow and END-SEM = blue.
  The green verification badge remains independent of the exam badge.
- Opening a notification marks that specific message read before navigating,
  refreshes the unread bell/count, and leaves other messages unread. The action
  verifies ownership and uses the saved, internal destination; simply visiting
  the inbox never clears unread messages.

No new database migration or runtime dependency is required.

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
