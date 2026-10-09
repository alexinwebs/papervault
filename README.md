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
