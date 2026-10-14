# PaperVault

<p align="center">
  <img src="public/brand/papervault-wordmark.png"
       alt="PaperVault — your college, your papers." width="260">
</p>

**A student-powered archive of college question papers.** Find past papers, contribute your
own, and help build a useful, moderated academic archive.

[![CI](https://github.com/alexinwebs/papervault/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/alexinwebs/papervault/actions/workflows/ci.yml)
[![CodeQL](https://github.com/alexinwebs/papervault/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/alexinwebs/papervault/actions/workflows/codeql.yml)

**[Live website](https://papervault.duckdns.org)** ·
[Report a bug](https://github.com/alexinwebs/papervault/issues) ·
[In-app support](https://papervault.duckdns.org/support) ·
[Deployment guide](docs/DEPLOYMENT.md)

```text
College → Program → Branch → Semester → Subject → Exam type → Year/session → Paper
```

This README covers v14 and its subsequent dependency-security and CI fixes. The source of truth
for installed dependency versions is `package-lock.json`.

## Contents

- [Features](#features)
- [How paper uploads work](#how-paper-uploads-work)
- [Free local PDF detection](#free-local-pdf-detection)
- [Roles and permissions](#roles-and-permissions)
- [Technology stack](#technology-stack)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Testing and continuous integration](#testing-and-continuous-integration)
- [Production deployment](#production-deployment)
- [Updating an existing deployment](#updating-an-existing-deployment)
- [Backups and monitoring](#backups-and-monitoring)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Security and responsible use](#security-and-responsible-use)
- [Support](#support)
- [License](#license)

## Features

### Find and organise papers

- Browse by college, program, branch, semester, subject, exam type and academic year.
- Search the archive, including extracted paper text when available.
- Distinguish CT, ST, PUT, Mid-Sem and End-Sem papers with labelled, coloured badges.
- Pin colleges, bookmark papers and return to your library.
- Read papers in the viewer and download papers you are permitted to access.
- List a shared paper under matching subjects in multiple branches without uploading it again.

### Contribute with less typing

- Upload a PDF, JPG or PNG, or use the camera-capture flow.
- Choose **Auto-detect**, **Enter manually**, or **Choose existing groups**.
- Preview a selected PDF or image before submitting; PDFs support page navigation and zoom.
- Review and edit detected details. Recognition does not overwrite fields already edited.
- Search themed college/branch suggestions or type a new entry for manual group creation.
- Create missing academic groups as part of a valid, confirmed submission.
- Receive loading, success and error popups; modal dialogs lock background scrolling.

### Community, moderation and administration

- Discuss papers, request missing papers, report problems and contact support.
- Receive in-app notifications; opening an individual notification marks it as read.
- Receive account and moderation emails when a mail provider is configured.
- Review, approve, reject, restrict or return submissions for changes.
- Manage colleges, curriculum, papers, members, reports, email outbox and recycle bin.
- Use optional teacher-verification workflows with private supporting documents.
- Export account data or request account erasure through settings.
- Use responsive phone, tablet and desktop layouts and password-visibility controls.

## How paper uploads work

1. **Choose a file or capture pages.** The default file limit is 10 MiB, configurable by the
   operator. Only PDF, JPG and PNG are accepted; file signatures are checked, not just extensions.
2. **Read or enter details.** Automatic detection is optional. Manual entry and existing-group
   selection remain available if recognition is unavailable or incomplete.
3. **Preview and confirm.** Check the college, program, branch, semester, subject name/code,
   exam type, year and test/session. Keep ST-1 and ST-2 distinguishable.
4. **Validate and scan.** Production uses ClamAV before accepting an upload. PDFs are parsed and
   sanitised. Declared current or upcoming exam material is refused.
5. **Check duplicates.** File hashes, complete extracted-text fingerprints when available, and
   exam-slot checks protect the archive. Database locks also guard concurrent submissions.
6. **Create or reuse groups.** Confirmed missing groups are created transactionally during a
   successful submission, not during detection. Rejected uploads roll back new groups.
7. **Send for review.** Papers are never automatically published. Current-year or uncertain
   exam material is held as restricted; ordinary past papers enter the review queue.

New colleges remain **unverified** until staff review them. Conflicting catalogue entries are
not silently overwritten, and archived entries are not automatically restored.

Only upload past or released material you have permission to share. Do not upload live exam
papers, answer scripts containing personal information, or other restricted documents.

## Free local PDF detection

PaperVault uses a **local text-and-OCR pipeline**, not a paid vision API:

```text
File validation and configured malware scan
  → native PDF text extraction when useful
  → local rendering/OCR for scanned headers
  → metadata parsing and catalogue matching
  → editable details for user confirmation
```

- **Text PDFs:** `unpdf` extracts useful text from the first pages.
- **Scans and photos:** Poppler renders PDF pages; Tesseract reads printed text.
- **Image preparation:** Sharp supports orientation, grayscale, contrast, sharpening and
  conservative deskew/header comparisons when initial readings are incomplete.
- **Catalogue matching:** known colleges and subject codes help resolve details and expand
  unambiguous abbreviations. Catalogue-only suggestions and conflicting readings need review.
- **Academic sessions:** an unambiguous session such as `2025-26` uses `2025` in the year field
  while retaining the session label separately.
- **Non-blocking editing:** detection uses a separate abortable request. Users can keep editing,
  switch to manual entry, or retry detection without losing their corrections.

The upload page asks for a **clear PDF or a well-lit, straight photo with the header visible**.

### Detection limits and privacy

- No cloud OCR API key or per-document OCR-service charge is required. Server CPU, storage,
  hosting and any configured email services still have their normal costs.
- OCR runs on your PaperVault server. Configured storage, email and monitoring services are
  separate operator-controlled integrations; this is not a claim that the whole app is offline.
- English printed headers work best. Blurry, cropped, handwritten or unusual layouts may fail.
- A missing college or branch cannot always be inferred. A university name alone is not a
  college identity. Shared branch lists require the contributor to choose a primary branch.
- Similar photos can produce different OCR text. Duplicate protection is layered, not a
  guarantee that every re-scan of a paper will be recognised.
- Detection uses bounded rendering, process timeouts, temporary-file cleanup and at most two
  concurrent OCR jobs per process. Successful reads are cached briefly; failed reads may be
  cached for 30 seconds. Retries do not bypass rate limits or malware checks.
- Metadata scan detection starts on page one and consults page two only if needed. Full scan
  OCR for submission fingerprints is capped at 12 pages; incomplete OCR is not treated as a
  whole-document fingerprint. The local upload preview supports up to 60 PDF pages.
- Browser preview displays the selected local file. Preview itself does not upload it;
  Auto-detect separately sends it to your own server for recognition.

**Always review detected details. Recognition is an assistant, not an accuracy guarantee.**

## Roles and permissions

| Role | Purpose |
| --- | --- |
| Student | Browse permitted papers, contribute, bookmark, discuss and contact support |
| Verified teacher | Teacher status granted through an approved verification workflow |
| Moderator | Review and manage papers within assigned permissions/college scope |
| College admin | Manage the assigned college within its permission scope |
| Platform admin | Manage platform-wide catalogue, users, settings and moderation tools |

Email verification is required for contributions by default. Sensitive routes enforce
server-side permissions. Administrator 2FA is enabled by default for production; local browser
checks explicitly use test-only settings instead.

## Technology stack

| Area | Technology |
| --- | --- |
| Application | Next.js 15 App Router, React 19, TypeScript, Server Actions |
| Database | PostgreSQL 16, Prisma 6, Zod validation |
| Styling | Tailwind CSS, cream/navy neo-brutalist design system, Lucide icons |
| Recognition | `unpdf`, Poppler, Tesseract, Sharp |
| PDF handling | PDF.js viewer, `pdf-lib` processing |
| Rate limiting | Redis when configured; per-process fallback |
| File storage | Persistent local volume or private S3-compatible storage |
| Upload malware checks | ClamAV |
| Authentication | bcrypt password hashes, signed database-backed sessions, TOTP 2FA |
| Email | Gmail App Password, SMTP, Resend, Postmark or local log driver |
| Tests | Vitest unit/integration tests, Playwright browser tests |
| Delivery | Docker Compose, Caddy HTTPS, GitHub Actions and CodeQL |
| Monitoring | Health endpoint, structured logs, optional Sentry |

## Local development

### Requirements

- **Node.js 22** and npm; CI and the Docker image use Node 22.
- Docker Engine/Desktop with the **Docker Compose v2** plugin.
- Git and a disposable development PostgreSQL database.
- Poppler and Tesseract for local OCR and OCR-backed tests.
- On Windows, use WSL2 or an equivalent Linux development environment for the shell commands.

### Install the project

```bash
git clone https://github.com/alexinwebs/papervault.git
cd papervault
npm ci
cp .env.example .env
docker compose up -d
```

Review `.env` before continuing. Its database URL must target your **local development database**,
not a live archive. Docker Compose starts PostgreSQL and Redis; ClamAV is an optional local profile.

```bash
npm run setup
npm run dev
```

Open **http://localhost:3000**.

> **Destructive development command:** `npm run setup` and `npm run db:seed` load demo data and
> reset database tables. Never run them against production or any database you need to preserve.
> Demo papers and statistics are generated fixtures, not real contributions or live usage data.

### Install OCR tools outside Docker

For Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  poppler-utils tesseract-ocr tesseract-ocr-eng tesseract-ocr-osd
```

For Fedora:

```bash
sudo dnf install -y poppler-utils tesseract tesseract-langpack-eng
```

Verify the installation:

```bash
pdftoppm -v
tesseract --list-langs
```

The language list should include `eng` and `osd`. If your distribution does not bundle `osd`,
install its orientation-data package or the official
[Tesseract orientation model](https://github.com/tesseract-ocr/tessdata_fast/blob/main/osd.traineddata)
in the installation's tessdata directory. The production Dockerfile installs the required
English and orientation packages automatically.

### Local malware scanning and email

The local example defaults to `MALWARE_SCANNER=none` and `MAIL_DRIVER=log`; this is not the
production safety configuration. To exercise ClamAV locally:

```bash
docker compose --profile scan up -d
```

Set `MALWARE_SCANNER=clamav`, `CLAMAV_HOST=127.0.0.1` and `CLAMAV_PORT=3310` in `.env`, then restart
the app. First-time signature downloads can take several minutes.

With the log mail driver, real email is not delivered. Inspect **Admin → Email outbox** instead,
or configure a real provider to test verification and password-reset delivery.

### Demo accounts

Development seed accounts all use **`papervault123`**:

| Email | Role |
| --- | --- |
| `student@papervault.dev` | Student |
| `moderator@papervault.dev` | Moderator |
| `collegeadmin@papervault.dev` | College admin |
| `admin@papervault.dev` | Platform admin |

These credentials are public test fixtures. Do not expose demo accounts on a public deployment.
Create your own account with `npm run admin:create` when appropriate.

## Configuration

Use `.env.example` for local development and `.env.production.example` for production. Copy a
**template once**, edit your private copy, and never overwrite a working production environment
with an example file. Exported environment variables take precedence where supported by the
runtime and test helper; avoid duplicate keys in configuration files.

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection; production Compose supplies its internal database URL |
| `AUTH_SECRET` | Session-signing secret; generate a strong, unique production value |
| `NEXT_PUBLIC_SITE_URL` | Actual site origin; HTTPS for public production deployments |
| `SITE_DOMAIN` | Domain served by Caddy in the production stack |
| `POSTGRES_PASSWORD` | Production Compose database password; required |
| `CRON_SECRET` | Authorises maintenance; use a strong production value |
| `STORAGE_DRIVER` | `local` or `s3`; keep files persistent and backed up |
| `STORAGE_LOCAL_DIR` | Local storage path; Compose mounts `/app/storage` |
| `S3_*` | Bucket, endpoint, region and credentials when using S3-compatible storage |
| `MAX_UPLOAD_BYTES` | Default `10485760` bytes: 10 MiB |
| `MALWARE_SCANNER`, `CLAMAV_*` | Upload scanning; production Compose configures ClamAV |
| `REDIS_URL` | Shared rate-limit backend; supplied by production Compose |
| `MAIL_DRIVER`, provider credentials, `MAIL_FROM` | Verification, reset and notification delivery |
| `ADMIN_EMAIL` | Operations mailbox; also a default for the admin-creation command |
| `CONTACT_EMAIL`, operator/grievance/security settings | Public legal and security contacts |
| `REQUIRE_EMAIL_VERIFICATION` | Contribution/account verification policy; keep enabled in production |
| `REQUIRE_ADMIN_2FA` | Administrator 2FA policy; keep enabled in production |
| `TRUSTED_PROXY_HOPS` | Trusted proxy count; match your actual proxy topology |
| `TEACHER_VERIFICATION_ENABLED` | Open or close new teacher-verification applications |
| `TEACHER_DOC_RETENTION_DAYS`, `TEACHER_REAPPLY_COOLDOWN_DAYS` | Verification-document lifecycle |
| `SENTRY_DSN` | Optional error reporting; review its privacy implications |
| `APP_VERSION` | Build identifier reported by the health endpoint |
| `DONATION_UPI_ID`, `DONATION_PAYEE_NAME`, `DONATION_QR_PATH` | Optional support page; set the UPI ID empty to hide it |

Generate separate secrets; do not reuse these outputs across installations:

```bash
openssl rand -base64 48   # AUTH_SECRET
openssl rand -hex 32     # CRON_SECRET
openssl rand -hex 24     # POSTGRES_PASSWORD
```

For email, choose one provider and configure its matching credentials. Gmail requires an App
Password; SMTP requires a working transport; Resend/Postmark require their API credentials and
an authorised sender. Production signup and password recovery need real mail delivery.

## Testing and continuous integration

### Unit and integration checks

```bash
npm run verify
npm audit --omit=dev --audit-level=high
```

`verify` runs TypeScript, lint and unit tests. Database integration checks additionally need
PostgreSQL, a migrated disposable database, the catalogue and the native OCR tools:

```bash
npm run db:deploy
npm run db:catalogue
npm run test:integration
```

Integration tests create and remove records. They are not safe to run against a live archive.

### Browser checks

> **Browser-test setup resets and demo-seeds the configured database.** Use only a disposable
> test database. Stop existing development/production test servers before changing test settings;
> Playwright can otherwise reuse a server with an older environment.

After local setup, configure the following **test-only** values in the test terminal:

```bash
export REQUIRE_ADMIN_2FA=false
export CRON_SECRET=local-cron-secret
export LOGIN_ATTEMPTS_PER_MINUTE=1000
export REGISTRATIONS_PER_IP_PER_HOUR=1000
npx playwright install --with-deps chromium
npm run test:e2e
```

The suite builds and starts the app when no reusable server is running. `DATABASE_URL` can come
from the local `.env` or an exported environment variable. CI does not need a real `.env` file.
CI runs one worker because these workflows share a seeded catalogue/database.

Do not copy the test-only limits or disabled admin-2FA setting into production configuration.
To generate a local HTML report:

```bash
npm run test:e2e -- --reporter=line,html
npx playwright show-report
```

### Optional real-scan fixtures

Private sample PDFs are not bundled in the repository. Supply your own local copies to enable
the optional genuine-scan tests:

```bash
export REAL_SCAN_FIXTURE=/absolute/path/to/four-page-end-sem-scan.pdf
export REAL_ST_SCAN_FIXTURE=/absolute/path/to/st1-scan.pdf
npm run test:integration
npm run test:e2e
```

Without these paths, the corresponding tests are skipped. Never commit private exam documents,
student identifiers or other personal data as test fixtures.

### What GitHub checks

Pull requests and pushes to `main` run verification/integration tests, end-to-end tests,
production dependency audit and a production-image build. CodeQL also checks JavaScript and
TypeScript, including a scheduled scan. CI installs Poppler and Tesseract for OCR-backed tests.

**CI success does not deploy the website.** The image workflow validates a build; it does not
publish the image or update your server. Merge after checks pass, then deploy deliberately.

## Production deployment

The recommended setup is a single Docker host with **at least about 2 vCPU / 4 GB RAM** as a
starting point. ClamAV, OCR and builds consume significant memory; monitor real usage and allow
more capacity for concurrent uploads. Local file storage assumes one app instance.

### First deployment

1. Install Docker and the Compose v2 plugin.
2. Point the domain's DNS at the server. Allow inbound HTTP/HTTPS on ports **80/443**.
3. Clone the repository and create the private production configuration:

   ```bash
   git clone https://github.com/alexinwebs/papervault.git
   cd papervault
   cp .env.production.example .env.production
   ```

4. Edit `.env.production`: set the domain/site origin, fresh secrets, contacts, working email and
   storage. The template defaults to S3; choose `STORAGE_DRIVER=local` explicitly if you want the
   persistent uploads volume instead. Review the optional donation/teacher-verification settings.
5. Start the stack:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
   ```

6. Create your real platform administrator and enrol 2FA:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npm run admin:create
   ```

7. Check health, email delivery, a test upload, moderation and download permissions.

| Service | Responsibility |
| --- | --- |
| `caddy` | Public entry point and automatic HTTPS |
| `app` | Non-root Next.js standalone application with local OCR tools |
| `migrate` | One-shot schema migrations and catalogue-only initialisation |
| `db` | PostgreSQL with a persistent volume |
| `redis` | Shared rate limits |
| `clamav` | Malware scanning and persistent signatures |
| `cron` | Periodic purge/retention and notification-retry maintenance |

The migration container normally exits successfully after completing its work. The app waits
for required dependencies; ClamAV's initial signature download can take several minutes.
Production Compose does not publish PostgreSQL, Redis or ClamAV ports to the host.

The production migration service does **not** demo-seed. `db:catalogue` loads initial catalogue
records only when no college catalogue exists; it is not an overwrite/synchronisation command
for an existing catalogue. Use administration tools or reviewed migrations for later changes.

Keep S3 buckets private and file access permission-checked. Protect `.env.production`, persistent
volumes, storage credentials and backups. Review the legal policies and operational contacts
before accepting public submissions. See [the deployment guide](docs/DEPLOYMENT.md) for details.

## Updating an existing deployment

For a clean Git checkout on `main`, back up first, pull the reviewed release and rebuild:

```bash
git switch main &&
sh deploy/backup.sh &&
git pull --ff-only origin main &&
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Use the following to inspect the running stack:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --since=10m --tail=100 app
```

For a ZIP-based installation without Git metadata, export the merged source from your local
clone, transfer it and extract it over the intended source folder, then rebuild:

```bash
git archive --format=zip --prefix=papervault/ -o ../papervault-release.zip HEAD
```

Export from the intended, updated `main` commit. Use an `&&` chain when extracting and rebuilding
so a missing ZIP cannot accidentally lead to rebuilding old source. Keep production environment
files and volumes; do not replace them with development examples.

**Never run demo seeding, database reset commands or `docker compose down -v` during an ordinary
upgrade.** Rebuilding is necessary for source/dependency changes; restarting an old image is not
an upgrade. The original v14 ZIP does not include later security/CI commits—use current merged
source when preparing a new deployment.

## Backups and monitoring

### Back up both records and files

```bash
sh deploy/backup.sh
```

The supplied script creates a custom-format PostgreSQL dump in `./backups` by default and
removes its local dumps older than `KEEP_DAYS` (default 14). `BACKUP_DIR` changes the destination.
Schedule it separately with cron or a systemd timer using your actual checkout path.

- Copy backups off the server; a dump on the same failed disk is not a recovery plan.
- Back up the local `uploads` volume separately, or configure backup/versioning for S3 objects.
- Protect configuration/credentials separately and restrict backup access.
- Rehearse restoration into an isolated database and storage location before an incident.
- Keep the database and file-backup strategy consistent; one without the other is incomplete.

**The bundled maintenance `cron` service is not a backup service.** It performs application
maintenance and notification retries; database/file backup scheduling is your responsibility.

### Monitor dependency readiness

`GET /api/healthz` reports the build version, database, storage, scanner and other backend states.
A database outage returns HTTP 503. Storage/scanner outages can return HTTP 200 with
`status: "degraded"` while browsing remains available, so monitor the JSON checks as well as the
HTTP status. A configured scanner outage blocks uploads rather than accepting unscanned files.

Use application logs, uptime monitoring and optional Sentry. Keep `APP_VERSION` meaningful so
you can distinguish a rebuilt release from an old running image.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `pdftoppm ENOENT` | Poppler is missing from the machine/container running the test or app; install `poppler-utils` |
| `tesseract ENOENT` or missing `osd` | Install Tesseract and its English/orientation data; check `tesseract --list-langs` |
| Detection is incomplete | Use a clear, upright scan with its header visible; preview, correct fields or enter manually |
| College/branch remains empty | It may not be printed or may be ambiguous; select it instead of treating it as a guessed value |
| Retry returns the same result | Reads are briefly cached; edited metadata is preserved and failed reads may be cached for 30 seconds |
| Uploads are paused | Inspect ClamAV readiness/signatures, storage permissions and `/api/healthz` |
| Emails are not delivered | Check `MAIL_DRIVER`, provider credentials, sender authorisation and Admin → Email outbox |
| Prisma gets an undefined database URL | Export `DATABASE_URL` or configure the local `.env`; use the updated test helper in CI |
| CI says `.env not found` | Expected when variables are supplied by CI; inspect the actual failed step, not this message alone |
| Browser tests fail at setup | Check disposable DB access, migrations, OCR tools and test-only environment values; stop stale servers |
| Dependency audit fails | Read the advisory, update compatible dependencies and lockfile, then retest; do not disable the audit |
| A ZIP cannot be found | Verify the exact uploaded filename; stop before rebuilding or you may redeploy old code |
| UI still looks like an older release | Confirm the deployed source, rebuild the image, check container/build version and refresh the browser |

For a bug report, include steps to reproduce, expected/actual behaviour, device/browser and a
redacted screenshot or relevant error excerpt. Never post environment files, tokens, passwords,
private documents or database dumps in issues.

## Project structure

```text
.github/workflows/   Verification, browser tests, audits, image-build checks and CodeQL
prisma/             Database schema, migrations, catalogue/demo seed and admin scripts
public/             Brand artwork, static assets and self-hosted PDF.js worker
src/app/            Pages, layouts and API route handlers
src/components/     Navigation, forms, viewers, dialogs and themed controls
src/data/           Built-in curriculum/catalogue data
src/lib/            Auth, permissions, storage, mail, scanner, rate limiting and utilities
src/server/         Server Actions, repositories and domain services
src/server/services/ Detection, OCR, upload/grouping and moderation workflows
tests/unit/         Fast isolated regression checks
tests/integration/  Database-backed service and upload checks
tests/e2e/          Browser workflows and responsive checks
deploy/             Caddy configuration and database-backup script
docs/               Deployment, security, architecture and upgrade notes
storage/            Runtime local files; generated and not committed
```

## Documentation

- [Deployment and operations](docs/DEPLOYMENT.md)
- [Security model and known gaps](docs/SECURITY.md)
- [Technical reference and feature details](docs/REFERENCE.md)
- [v14 ZIP upgrade instructions](docs/UPGRADE-v14.md) — base release instructions; include later
  fixes
- [Release history](CHANGELOG.md)
- [Project phases and planning notes](docs/phases.md) — planning, not a promise of shipped features

Package scripts in `package.json` provide `dev`, `build`, `start`, `verify`, `test:unit`,
`test:integration`, `test:e2e`, `db:deploy`, `db:catalogue`, `db:studio` and `admin:create`.
`db:seed`/`setup` are destructive demo workflows. Reserve migration-development/schema-push tools
for development; deploy reviewed migrations to production instead.

## Contributing

1. Open an issue for a reproducible bug or a focused feature proposal.
2. Create a branch from the current `main`; keep changes scoped and documented.
3. Add regression tests for changed behaviour, including manual-entry and failure paths where
   relevant.
4. Run verification, relevant database/browser checks and the production dependency audit.
5. Submit a pull request and address failing checks before merging.

If your change affects the Prisma schema, include its migration. Commit dependency lockfile
changes with dependency updates. Never commit private `.env` files, uploads, generated build
output, reports, backups, private exam scans or credentials. Do not use force pushes or weakened
checks as a substitute for understanding a failing build.

UI feedback can be sent through the site's **Support** section. Testing real flows and reporting
clear, reproducible feedback is valuable even if you do not contribute code.

## Security and responsible use

The application uses permission-checked file access, password hashing, revocable sessions,
optional/required-by-role 2FA, rate limiting, security headers, private support/verification
attachments and an append-only audit log. These controls reduce risk; passing automated checks
is not a penetration test, accessibility certification or legal-compliance assessment.

Report suspected vulnerabilities privately through the contact published in
[security.txt](https://papervault.duckdns.org/.well-known/security.txt), not in public issues.
Self-hosting operators must configure their own accurate security/legal contacts, access
policies, data-retention practices and backups. See [security notes](docs/SECURITY.md).

Use takedown/reporting channels for papers that should not be hosted. Avoid sharing personal
identifiers in scans and supporting documents. Only contribute material you are allowed to share.

## Support

- **Product help or feedback:** [PaperVault Support](https://papervault.duckdns.org/support).
- **Reproducible software bugs:** [GitHub Issues](https://github.com/alexinwebs/papervault/issues).
- **Optional project support:** [Buy me a coffee](https://papervault.duckdns.org/coffee), when
  enabled.

Self-hosters should review or clear the donation configuration and bundled QR asset before
publishing their own installation; do not assume a bundled payment identity belongs to you.

## License

No `LICENSE` file has been added. Unless and until an explicit license is provided, rights remain
with the relevant copyright holders; a public repository alone is not a general reuse license.
Ask the maintainer before redistribution or reuse beyond permissions otherwise granted to you.
