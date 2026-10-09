# Deploying PaperVault

PaperVault needs five things in production: the Next.js server, PostgreSQL,
ClamAV (upload scanning), Redis (shared rate limits) and somewhere to keep
uploaded PDFs (S3-compatible bucket or a persistent volume). The server checks
its own configuration at boot and **refuses to start** on unsafe settings, so a
misconfigured deploy fails loudly instead of running open.

## Option A — one server with Docker Compose (recommended)

Any VPS with 2 vCPU / 4 GB RAM (ClamAV alone needs ~1.5 GB) and Docker.

```bash
git clone <repo> /opt/papervault && cd /opt/papervault
cp .env.production.example .env.production
$EDITOR .env.production        # every blank value; see the table below
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

What that starts:

| Service | Role |
| --- | --- |
| `caddy` | Public entry on 80/443, automatic Let's Encrypt TLS for `SITE_DOMAIN` |
| `app` | Next.js standalone server, non-root, health-checked |
| `migrate` | Runs once per deploy: `prisma migrate deploy`, then loads the college/curriculum catalogue if the database is empty |
| `db` / `redis` / `clamav` | Private network only, never published |
| `cron` | Calls the nightly maintenance endpoint |

First deploy only — create the platform admin (then enrol 2FA on first sign-in):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npm run admin:create
```

ClamAV downloads signatures on first boot; `app` waits for it to be healthy,
which can take several minutes the first time.

Updating: `git pull && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`.

Backups: schedule `deploy/backup.sh` (pg_dump) from cron and copy the files off
the machine. With `STORAGE_DRIVER=local` also back up the `uploads` volume.
Rehearse a restore before launch.

## Option B — managed platforms

Build the `runner` target of the `Dockerfile` (Render, Fly.io, Railway, ECS,
Cloud Run…) and provide managed Postgres, managed Redis and an S3 bucket. Run
`npx prisma migrate deploy && npm run db:catalogue` as the release command
(the `migrate` image target does exactly this).

ClamAV is a long-running daemon, so serverless hosts (Vercel, Netlify) cannot
run it themselves: point `CLAMAV_HOST` at a clamd container you run elsewhere
on a private network. `/api/cron/purge` accepts Vercel Cron's `GET` with
`Authorization: Bearer $CRON_SECRET`.

## Configuration

Everything is in `.env.production.example`. The boot check enforces:

| Variable | Rule |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://` origin. Read at runtime, so one image serves any domain |
| `DATABASE_URL` | `postgresql://…` (add `sslmode=require` for managed databases) |
| `AUTH_SECRET` | 24+ chars and not the development value — `openssl rand -base64 48` |
| `CRON_SECRET` | 32+ chars — `openssl rand -hex 32` |
| `MALWARE_SCANNER=clamav` | Required, unless `ALLOW_UNSCANNED_UPLOADS=true` is set deliberately |
| `SMTP_HOST` (or Gmail) | Required while `REQUIRE_EMAIL_VERIFICATION` is on, or nobody can verify |
| `STORAGE_DRIVER=s3` + `S3_BUCKET` | Or `local` with a backed-up volume (warns) |
| `CONTACT_EMAIL` | Shown on Terms, Privacy and `/.well-known/security.txt` |
| `TRUSTED_PROXY_HOPS` | Proxies in front of the app (default 1 = Caddy). Behind a load balancer **and** Caddy use 2. Wrong values make per-IP rate limits spoofable or over-broad |

Every response carries an `x-request-id` (kept from the proxy if it sent a
sane one); it is attached to errors sent to Sentry from server actions.

Warnings (logged, not fatal): no `REDIS_URL`, no `SENTRY_DSN`, local storage,
`REQUIRE_ADMIN_2FA=false`.

Keep the bucket **private** and `S3_SIGNED_URLS=false`: every file read goes
through `/api/files/[fileId]`, which enforces restricted-paper rules.

Mail: use a transactional provider with SPF, DKIM and DMARC on your sending
domain — over SMTP (`MAIL_DRIVER=smtp`), or the HTTPS APIs built in:
`MAIL_DRIVER=resend` + `RESEND_API_KEY`, or `MAIL_DRIVER=postmark` +
`POSTMARK_SERVER_TOKEN` (+ optional `POSTMARK_MESSAGE_STREAM`). Gmail app
passwords cap at ~500/day. `ADMIN_EMAIL` (e.g. `papervaultt@gmail.com`) is
the operations mailbox for new tickets, teacher verification requests,
college/subject requests, member reports and takedown notices.

Support and teacher verification: documents and ticket attachments are stored
under `private/` and are only ever served through permission-checked routes
(never public URLs). `TEACHER_DOC_RETENTION_DAYS` (default 30) controls how
long verification documents are kept after a decision; the nightly
maintenance endpoint deletes them. `TEACHER_REAPPLY_COOLDOWN_DAYS` (default 7)
is the wait after a rejection.

## Health and monitoring

`GET /api/healthz` → `200 {"status":"ok"}` when database, storage and scanner
are reachable; `"degraded"` if storage or the scanner is down (uploads pause,
browsing continues); `503` if the database is down. Point uptime monitoring at
it. Set `SENTRY_DSN` for error reporting; events are scrubbed of cookies,
credentials, query strings and email addresses before they leave the server.

## Going live from a development database

If you have been running the demo seed locally and want to keep the catalogue
but start with real accounts only:

```bash
npx prisma migrate deploy
npm run admin:create                 # your real admin, e.g. papervaultt@gmail.com
npm run db:purge-demo                # dry run: shows what would be deleted
npm run db:purge-demo -- --confirm   # deletes @papervault.dev demo accounts, their papers, files and audit rows
```

The purge refuses to run until a non-demo platform admin exists. Colleges,
programs, branches, semesters and subjects are kept. A brand-new production
database never gets demo data: the `migrate` service loads only the catalogue
(`npm run db:catalogue`).

Audit log rows are append-only at the database level (a trigger rejects
updates and deletes); the purge script is the only code path that opts out,
inside its own transaction.

## Pre-launch checklist

- [ ] `.env.production` filled in; secrets freshly generated; never committed
- [ ] DNS points at the server and `https://SITE_DOMAIN` loads with a valid certificate
- [ ] `curl https://SITE_DOMAIN/api/healthz` shows database, storage and scanner `up`
- [ ] Platform admin created and 2FA enrolled (`REQUIRE_ADMIN_2FA=true`)
- [ ] Demo accounts purged if the database ever held seed data (`npm run db:purge-demo -- --confirm`)
- [ ] `ADMIN_EMAIL` set and receiving: open a test ticket and check the alert arrives
- [ ] Sign-up → verification email arrives (check spam placement) → upload works
- [ ] EICAR test file is rejected on upload
- [ ] Backups scheduled, copied off-server, and one restore rehearsed
- [ ] Sentry receiving events (trigger one) and uptime monitor on `/api/healthz`
- [ ] Terms, Privacy, Takedown, Community Guidelines, Academic Integrity, Teacher Verification and Data Rights pages reviewed by a lawyer; DPDP Act (India) obligations assessed; grievance officer named
