# PaperVault

**A student-powered archive of college question papers.** Students upload past papers, moderators
review them, and everyone can browse, search and download them, organised the way a college
actually works:

```text
COLLEGE → PROGRAM → BRANCH → SEMESTER → SUBJECT → EXAM TYPE → YEAR → PAPER
```

Live: **<https://papervault.duckdns.org>**

---

## Features

- **Browse and search:** drill down from college to individual papers, run full-text search, and
  pin your colleges to the sidebar.
- **Contribute:** upload PDFs or images. Every file is virus-scanned (ClamAV), checked for
  duplicates and sent to moderation.
- **Multi-branch papers:** one upload can be listed under the same subject in several branches
  (e.g. DBMS for CSE, IT, IoT and DS), so shared papers aren't uploaded again.
- **Moderation:** approve, reject, restrict, or send back for changes. Moderators can be scoped to
  a college. Current-exam papers are protected.
- **Discussion:** comments on papers, paper requests, bookmarks and an in-app inbox.
- **Notifications:** email for signup confirmation, password reset, approval requests and review
  outcomes.
- **Administration:** manage colleges, curriculum, papers and members. Includes an audit log, an
  email outbox, a recycle bin and site-wide settings.
- **Trust and safety:** reporting, support tickets, account bans, optional teacher verification,
  and grievance and legal pages.
- **Security:** bcrypt passwords, 2FA (TOTP, required for admins), rate limiting, CSRF-safe server
  actions, strict security headers and upload malware scanning.
- **Support the project:** an optional "Buy me a coffee" page with a UPI QR code.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Actions), React 19, TypeScript |
| Data | PostgreSQL 16 + Prisma 6, Zod validation |
| Cache / rate limits | Redis 7 |
| Storage | Local disk or any S3-compatible bucket |
| Upload scanning | ClamAV |
| Email | Gmail (App Password), SMTP, Resend or Postmark |
| Styling | Tailwind CSS, retro-editorial / neo-brutalist design system |
| Testing | Vitest (unit + integration), Playwright (end-to-end) |
| Deployment | Docker Compose + Caddy (automatic HTTPS) |

---

## Run it locally

**Requirements:** Node 22+, npm, Docker.

```bash
git clone https://github.com/<your-username>/papervault.git
cd papervault
npm install
cp .env.example .env      # local defaults; add Gmail settings to send real email
docker compose up -d      # Postgres + Redis (add --profile scan for ClamAV)
npm run setup             # generate client, migrate, load demo data (wipes the local DB)
npm run dev               # http://localhost:3000
```

Demo accounts (password `papervault123`, **local development only**):

| Email | Role |
| --- | --- |
| `student@papervault.dev` | Student |
| `moderator@papervault.dev` | Moderator (one college) |
| `collegeadmin@papervault.dev` | College admin |
| `admin@papervault.dev` | Platform admin |

Create your own admin with `npm run admin:create`.

Without mail credentials, emails are not sent. They are recorded at **Admin → Email outbox**
instead.

### Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run verify` | Typecheck + lint + unit tests |
| `npm run test:e2e` | Playwright end-to-end tests (run `npx playwright install chromium` once) |
| `npm run test:integration` | Database-backed tests |
| `npm run admin:create` | Create or promote a platform admin |
| `npm run db:catalogue` | Load only the college and curriculum catalogue (no demo data) |
| `npm run db:studio` | Inspect the database |

---

## Deploy to production

One Docker host (about 2 vCPU / 4 GB RAM or more) runs the whole stack: Caddy, the app, Postgres,
Redis, ClamAV and a nightly maintenance job.

```bash
cp .env.production.example .env.production   # fill in every value; never commit it
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npm run admin:create
```

- Point your domain's DNS at the server and open ports **80** and **443**. Caddy gets the HTTPS
  certificate automatically.
- Production **never** loads demo data. A fresh database gets only the college and curriculum
  catalogue.
- Back up nightly with `deploy/backup.sh` (Postgres) and keep a copy of the uploads volume.
- Health check: `GET /api/healthz`.

The full guide, covering environment variables, email, storage, backups and updates, is in
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

---

## Project structure

```text
src/app/          Routes (pages, server actions, API handlers)
src/components/   UI components
src/lib/          Auth, permissions, mailer, storage, scanner, rate limiting, env checks
prisma/           Schema, migrations, seed and admin scripts
tests/            unit/, integration/, e2e/ (Playwright)
deploy/           Caddyfile and backup script
docs/             Deployment guide, security notes, technical reference
```

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): production setup and operations
- [docs/SECURITY.md](docs/SECURITY.md): threat model, security controls and how to report
  vulnerabilities
- [docs/REFERENCE.md](docs/REFERENCE.md): architecture, domain model, paper lifecycle, the full
  feature list and known gaps
- [CHANGELOG.md](CHANGELOG.md): release history

## Contributing

Issues and pull requests are welcome. Before opening a pull request:

```bash
npm run verify       # typecheck, lint, unit tests
npm run test:e2e     # end-to-end tests
```

Please don't commit `.env`, `.env.production`, uploads or database dumps. They are already listed in
`.gitignore`.

## Security

Please report vulnerabilities privately to the contact in
[`/.well-known/security.txt`](https://papervault.duckdns.org/.well-known/security.txt), not in
public issues. See [docs/SECURITY.md](docs/SECURITY.md) for the security model.

## Support

If PaperVault helped you, you can [buy me a coffee](https://papervault.duckdns.org/coffee) ☕

## License

No license has been chosen yet, so all rights are reserved by the author. Add a `LICENSE` file
(for example MIT) if you want others to reuse the code.


## Automatic paper detection and catalogue grouping (v9–v14)

The upload form offers **Auto-detect**, **Enter manually**, and **Choose existing
groups**. Auto-detect reads the selected PDF, JPG, PNG or camera capture with a
non-blocking background request. Reading progress is shown beside the file; users
can keep editing or switch to manual entry. The reader never overwrites a field
that the user has already edited. Manual entry skips OCR and never applies a
late detection result. Enter the college, programme, branch, semester, subject
name/code, exam type and year; the same transaction creates missing groups when
the paper is submitted. There is no separate admin setup or create-group step.

College and branch suggestions use a cream/navy searchable dropdown, not the
browser’s native datalist popup. Use arrow keys and Enter, click a suggestion,
or type a new value for manual creation. Suggestions wrap on phones and remain
inside the viewport.

The branch is a single field: choose a catalogue suggestion or type a new name.
Its grouping code is filled automatically and can be overridden in **More details**.
University, session, paper set, moderator notes and extra branch listings are
optional and collapsed by default. Detected session labels remain visible in a
short summary with an Edit action. Paper status and metadata confirmation remain
required where applicable to protect current exams and prevent incorrect groups.

Auto-detect asks for a clear PDF or well-lit, straight photo with the header
visible. **Retry detection** preserves edited details, and choosing a suggestion
with the mouse protects that field from late detection responses. Successful
reads remain cached for ten minutes; failed reads may remain cached for 30
seconds. A retry does not bypass malware checks, concurrency or rate limits.

Text PDFs use `unpdf`;
scanned pages use Poppler and Tesseract with English and orientation models.
A selectable watermark/footer does not prevent scanning the image header if it
lacks meaningful header fields. Missing metadata triggers local Sharp grayscale,
contrast, light sharpening, orientation and conservative deskew preparation.
Original, cleaned and bounded angle-bracket header crops are compared; the
archived paper and duplicate fingerprint are not rewritten by preprocessing.
When key fields are missing, the reader compares orientation-aware full-page OCR
with high-resolution block and sparse header layouts. Table-cell labels are
parsed independently, and agreeing alternatives fill missing fields. Other
readable details are retained when one field is missing. Printed session ranges
and numbered tests (such as ST-1 and ST-2) are filled when readable. Exam types inferred
only from a file name are labelled as suggestions and must be verified.
Unambiguous academic sessions (2025-26 or 2025-2026) use the start year in
the year field and preserve the printed session separately. For a known college,
shared exact subject-code matches may fill a missing programme or semester only
when all candidates agree; these suggestions still require confirmation, and
no primary branch is guessed. Printed conflicts are not silently replaced.

No paid AI API, API key, third-party document upload or per-document service
charge is used. OCR still consumes your server's CPU and ordinary hosting costs.

Detected college, programme, branch, semester, subject name/code, exam type
and an unambiguous year are matched to the current catalogue. Existing entries
are reused. If entries are missing, the contributor can review/edit the printed
values and confirm them; college → programme → branch → semester → subject and
exam type are created inside the existing submission transaction. Staff do not
need to add those groups beforehand. New colleges remain **unverified**, and
papers still enter moderator review, never automatic publication. Missing
location/university information is stored as “Not specified”, not invented.

Fields that are absent, ambiguous, handwritten or unreadable must be supplied
or corrected by the contributor. A university heading alone cannot identify
the college. The manual catalogue picker and “I have this paper” prefill remain
available. Shared multi-branch headers do not select a branch automatically;
the contributor chooses or types the primary branch. Unique
subject abbreviations can be expanded from the relevant college catalogue,
without replacing the printed code. A new curriculum code may create a distinct
subject with the same name; the old code is preserved. A subject code conflicting
with an existing name is rejected rather
than silently overwriting the catalogue. Archived entries are not resurrected.

### Deploying

Rebuild the app image using your existing production compose command. With the
standard production files: `docker compose -f docker-compose.prod.yml
--env-file .env.production up -d --build`. The Dockerfile installs `tesseract-ocr`,
`tesseract-ocr-eng`, `tesseract-ocr-osd` and `poppler-utils` automatically in the non-root runner.
For a non-Docker Debian/Ubuntu host, install those packages with `apt-get`;
Amazon Linux uses `tesseract`, `tesseract-langpack-eng`, and `poppler-utils`;
it also needs the official Tesseract `osd.traineddata` orientation model. The
Docker image includes this automatically.
No new Prisma schema migration, API key or environment variable is needed.
Existing migrations continue to run normally. Do not reset or demo-seed a live
archive during an upgrade.

### Safety and bounds

- Detection requires an active, email-verified contributor, malware checks,
  accepted file signatures and the existing 10 MB upload limit. The background
  endpoint also caps multipart bodies while streaming (including requests with
  no Content-Length), before parsing their contents.
- Detection is read-only and limited to 30 requests per user/hour; automatic
  grouping submissions are limited to 10 per hour, with normal upload limits
  also applied. New groups are attributed in the audit log.
- Exact sanitized-file hash, normalized text-content fingerprint and exam-slot
  duplicate checks still run under database advisory locks. Rejected duplicates
  roll back newly created groups as well as the paper/session records.
- Native header detection reads up to two pages. Scan detection starts with page
  one and uses page two only if core fields remain missing after header retries.
  Detection has a 75-second OCR subprocess budget (90 seconds at submission),
  in addition to bounded image preparation. Damaged or encrypted PDFs fall back
  to editable manual details. Text extraction accepts up to 100
  PDF pages; scan OCR for final content checks is capped at 12 pages. Partial
  OCR is never used as a whole-document fingerprint. File-hash and exam-slot
  protection still applies when OCR is unavailable or incomplete.
- OCR uses bounded concurrency, image rendering size, process timeouts, and
  short-lived private temporary files. At most two OCR jobs run per process.
  Same-file concurrent reads share one job. Versioned results use a bounded
  in-memory cache (64 entries, successful reads 10 minutes, failures 30 seconds).
  Malware scanning still happens before a detection cache hit is used. Unclear images fall back to editable manual details.
- English printed papers work best. Similar-looking text is not guaranteed to
  produce identical OCR; contributors must review detected metadata. This is an
  automation assistant, not a guarantee that every scan can be classified.


## Preview before submission and responsive layout (v13)

After choosing a PDF, JPG or PNG, click **Preview paper**. A scroll-locked dialog
shows the selected local file before it is submitted. PDFs use the self-hosted
PDF.js viewer with page navigation and zoom, rendering one page at a time to keep
phone memory use bounded. Preview itself does not send the document to a server
or third-party service (Auto-detect separately sends it to your own server).
Closing the preview preserves the form. Malformed PDFs offer a replacement or
Open original rather than removing typed details. Viewer navigation is capped
at 60 pages; Open original remains available.

The upload page uses a two-column file/details layout at desktop widths and a
stacked form below 1280px. Content fills the available desktop workspace up to a
centred 1600px maximum. Phone inputs use 16px text and 44px controls; navigation,
search, cards and tables retain their responsive layouts. Optional fields remain
collapsed. Conflicting OCR/catalogue readings are labelled for confirmation, not
silently promoted to high confidence.

Upgrade by rebuilding your existing production Compose deployment. Sharp is an
explicit application dependency; do not just restart an old image. Keep your
production environment, database and uploaded files. No cloud key, OCR-service
subscription or additional schema migration is required.

For the v14 ZIP upgrade, see [step-by-step instructions](docs/UPGRADE-v14.md).
