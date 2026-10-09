# Build phases and status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Foundation: Next.js + TS + Tailwind tokens, lint, tests, env, error/logging primitives | Done |
| 1 | Database + academic taxonomy (college → program → branch → curriculum → semester → subject → exam type) | Done |
| 2 | Authentication, sessions, RBAC, college tenant boundary | Done |
| 3 | Paper repository + storage abstraction + authorized file delivery + viewer | Done |
| 4 | Moderation: queue, review page, lifecycle decisions, duplicates, reports, audit log | Done |
| 5 | Search: global query resolution across college / subject / exam / year | Done (V1, LIKE-based) |
| 6 | Student contribution: upload, requests, bookmarks, library, contributor profiles | Done |
| 7 | Production hardening: validation, rate limits, SEO, a11y, responsive, states, tests | Done |
| 8 | Future intelligence infrastructure: curriculum versions, paper sets, canonical papers, question-level extension point | Modelled, not populated |
| 9 | Multi-college readiness: tenant scoping, per-college taxonomy, coverage metrics | Done |
| 10 | Account safety: DB-backed sessions, email verification, password reset, device management, TOTP 2FA + recovery codes | Done |
| 11 | Content safety: PDF sanitisation, ClamAV seam, soft-delete recycle bin, takedown pipeline, legal pages | Done (ClamAV path unexercised) |
| 12 | Community: threaded discussion, in-app notifications and inbox, camera capture to PDF | Done |
| 13 | Operability: `/api/healthz`, nightly purge + email retry cron, observability seam, CI + CodeQL | Done (error reporting not installed) |
| 14 | Security hardening: nonce-based CSP, same-origin enforcement in middleware, timing-safe cron auth, dependency audit | Done |
| 15 | Privacy rights: account data export and erasure by anonymisation | Done |
| 16 | Version control + real Prisma migrations, admin pagination | Done |

## Round 7 — deployment readiness

| Area | Scope | Status |
| --- | --- | --- |
| Database | PostgreSQL everywhere; fresh baseline migration; trigram GIN indexes for search; case-insensitive matching; CI checks schema/migration drift | Done |
| Storage | S3-compatible driver (S3, R2, B2, MinIO), private bucket, streamed through the authorising route | Done, tested against an S3 API |
| Uploads | ClamAV scanning fails closed when clamd is down; EICAR verified rejected | Done |
| Operations | Docker image (standalone, non-root, health-checked), production compose with Caddy TLS, Postgres, Redis, ClamAV, cron; backup script | Done |
| Config | Boot refuses unsafe production settings; site URL read at runtime; demo seed refuses to run in production; catalogue-only seed | Done |
| Monitoring | Sentry with PII scrubbing; healthz covers database, storage and scanner | Done |
| Legal | Operator, contact and grievance-officer details configurable and shown on Terms/Privacy/security.txt | Done; text still needs legal review |

## Round 6 — curriculum, duplicate blocking, control center

| Area | Scope | Status |
| --- | --- | --- |
| Curriculum | AKTU subject tables for 14 branch tracks, semester by semester; every college carries every program | Done |
| Duplicates | File hash + content fingerprint + slot, all refused before any write; recycle bin included | Done |
| Admin | Control center with cross-entity search, branch curriculum editor with paste-import and template apply, member records with lifecycle actions | Done |

## Round 5 — brand integration and interaction polish

| Area | Scope | Status |
| --- | --- | --- |
| Brand | Official mark and wordmark wired through one component module; app icon, Apple touch icon, OG image and PWA icons generated from the same files | Done |
| Auth | Shared branded frame across the six signed-out account screens | Done |
| Navigation | `/inbox` reachable on phones with an unread badge; footer stopped prefetching | Done |
| Routing | Root loading boundary removed: it left every post-action redirect stuck on a skeleton. Scoped skeletons added to the browse routes | Done |
| Accessibility | 24px target guarantee for links and checkboxes, heading order, one `h1` per route, scripted 28-route audit | Done |
| Responsiveness | Scripted audit at six viewports across ten pages; `/admin` sideways scroll fixed | Done |

## Next steps

Ordered by what blocks a launch. `docs/DEPLOYMENT.md` has the operational
checklist; `docs/SECURITY.md` has the threat model and known gaps.

1. **Legal review.** Terms, Privacy and Takedown are drafted, not reviewed, and
   the DPDP Act (India) has not been assessed. Replace the placeholder contact
   addresses.
2. **Accessibility audit.** The scripted structural audit in round 5 is clean;
   what remains is axe plus a keyboard-only and screen-reader pass.
3. Bulk moderation actions and auto-approve for trusted contributors — the
   trust level exists on `User` but nothing acts on it.
4. College-admin taxonomy editing UI on top of the existing audited services.
5. OCR pipeline as an async worker → question extraction → historical question
   intelligence. This is phase 8's payoff and the largest remaining feature.
