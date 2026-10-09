# Security posture

This is the working security document for PaperVault: what is defended, how, and
what is knowingly still open. Keep it current — a stale threat model is worse
than none.

## Threat model

The archive is public reading and authenticated writing, run by students for
students. The realistic adversaries are:

| Adversary | Goal | Primary defence |
| --- | --- | --- |
| Bored student with a browser console | Read restricted papers, post as someone else, reach an admin screen | Server-side RBAC on every route and action; no client-trusted role |
| Automated scanner / credential stuffer | Take over accounts, enumerate members | Rate limits per identifier, bcrypt, non-enumerating reset, optional 2FA |
| Malicious uploader | Serve malware or scripted PDFs to other students | Type/size checks, ClamAV scan (fails closed when clamd is unreachable; required in production), PDF re-write through a parser, strict rejection of unparseable files, `default-src 'none'; sandbox` on the file route |
| Cross-site attacker | Drive a logged-in moderator's browser into approving or deleting | `SameSite=Lax` session cookie, Next's server-action origin check, plus an explicit same-origin check in middleware |
| XSS via injected markup | Steal a session, act as a moderator | React escaping by default, no `dangerouslySetInnerHTML` anywhere, nonce-based CSP with no `'unsafe-inline'` for scripts, `httpOnly` cookie |
| Rights holder or exam board | Legal exposure from hosted content | Takedown pipeline, moderation queue, restricted status for live exams, audit trail |
| Curious insider (moderator) | Act outside their college, or quietly | College-scoped queries, append-only audit log, soft delete with restore |

Explicitly out of scope: a hostile platform admin, physical access to the
database, and a state-level adversary.

## Controls in place

### Transport and headers

Set in `src/middleware.ts` (per-request) and `next.config.ts` (static):

- **Content-Security-Policy** with a fresh random nonce per request. `script-src`
  is `'self' 'nonce-…' 'strict-dynamic'` — there is **no** `'unsafe-inline'` for
  scripts. `'unsafe-inline'` remains for `style-src` only, because Next and
  Tailwind inject inline `<style>` with no nonce hook.
- `base-uri`, `form-action`, `frame-ancestors`, `object-src`, `worker-src` all
  pinned to `'self'`, so an injected tag cannot repoint a form or a base URL.
- `/api/files/*` gets its own policy: `default-src 'none'; object-src 'none'; sandbox`
  plus `X-Content-Type-Options: nosniff` and `Cross-Origin-Resource-Policy: same-origin`.
- `Strict-Transport-Security` with a two-year max-age and `preload` in production.
- `Permissions-Policy` grants `camera=(self)` for capture-to-PDF and denies
  microphone, geolocation, payment, USB, display-capture, serial, Bluetooth and
  idle detection.
- `Cross-Origin-Opener-Policy: same-origin`, `X-Permitted-Cross-Domain-Policies: none`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`.
- `poweredByHeader: false` and no production browser source maps.

### Cross-site request forgery

Two independent layers:

1. Next.js verifies the `Origin` of every server-action POST.
2. `src/middleware.ts` rejects any `POST`/`PUT`/`PATCH`/`DELETE` that is not
   provably same-origin, with `403 Cross-origin request blocked.` The decision
   logic lives in `src/lib/security.ts` and is unit tested, including the
   subdomain-lookalike and missing-header cases.

`/api/cron/*` is exempt because it is authenticated by a bearer secret a browser
cannot be tricked into sending. Its comparison is `timingSafeEqual`.

### Authentication

- bcrypt (cost 10) password hashes. `verifyPassword` returns `false` rather than
  throwing on a malformed hash, which is what an erased account holds.
- Sessions are **database rows**; the cookie (`pv_session`, `httpOnly`,
  `SameSite=Lax`, `Secure` in production, 14 days) carries a signed JWT holding
  only the user id and session id. Sign-out, a ban, a password change or a
  revoked device takes effect on the next request.
- `credentialsSetAt` invalidates every token minted before a credential change.
- TOTP 2FA with single-use recovery codes. It is mandatory for COLLEGE_ADMIN and
  PLATFORM_ADMIN when `REQUIRE_ADMIN_2FA=true` (the production default). The
  admin and moderation layouts show the enrolment prompt, and
  `assertSecondFactor` in `src/server/authz.ts` enforces it in every
  privileged server action and in staff file access, so calling an action
  directly does not skip it.
- Post-login and form `next`/`returnTo` targets go through `safeLocalPath`,
  which refuses `//host`, `/\host`, schemes and control characters.
- JWT verification is pinned to HS256.
- Password reset is single-use, 30-minute, and returns an identical response for
  a known and unknown address, so the form cannot enumerate members.

### Authorisation

Every page and every server action resolves the user server-side and re-reads
the role from the database. College-scoped roles are constrained through
`paperSet.examSession.subject.semester.branch.program.collegeId`. There is no
role or tenant value that the client can influence. Moderators and college
admins are confined to their own college for moderation, reports, comment
removal, the recycle bin and takedown notices (which carry claimant PII);
notices that do not resolve to a paper are platform-admin only. Resolving a
notice is conditional on it still being OPEN, so it cannot be replayed.

### Uploads

MIME and extension allow-list → size ceiling (`MAX_UPLOAD_BYTES`) → ClamAV scan
when `MALWARE_SCANNER=clamav` → parse and re-write through pdf-lib, which drops
embedded JavaScript, actions and attachments. A PDF that cannot be parsed is
**rejected**, not passed through. The duplicate check and the inserts run in
one transaction holding Postgres advisory locks on the file hash, content hash
and exam slot, so simultaneous identical uploads cannot both get through
(`npm run test:integration` fires them concurrently). Files are never served from a public path;
`/api/files/[fileId]` authorises the request first.

### Rate limiting

Named buckets covering sign-in, registration, reset, verification resend,
2FA, upload, comment, report, takedown, export and erasure. Redis-backed when
`REDIS_URL` is set, with the in-process window always applied as a second layer.

Sign-in, registration, forgot-password, reset and takedown also have per-IP
buckets; there are no global buckets, so one client cannot exhaust sign-ups or
resets for everyone. The client IP is taken from `X-Forwarded-For` counting
`TRUSTED_PROXY_HOPS` entries from the **right** (default 1 — Caddy in the
production compose file, which discards client-supplied forwarding headers).
Set it to the number of proxies you actually run; 0 ignores the headers.
Per-account sign-in limits mean someone who knows an address can slow that
one account's sign-in for a minute — a deliberate trade-off against lockout of
whole campuses behind one NAT.

### Privacy

- Data export (`GET /api/account/export`) returns only the caller's rows and
  never a password hash, TOTP secret or session token.
- Erasure overwrites the identity in place, destroys credentials, sessions,
  tokens, bookmarks, reading history, reports and messages, and withdraws
  comment text. Contributed papers stay in the archive under an anonymous
  author. Documented in the privacy policy — keep the two in step.
- Audit log is append-only and records the actor, action and entity.

### Supply chain

`npm audit` is clean apart from two advisories against `postcss` (reached only
through the Next build toolchain) for which no fixed version exists upstream at
the time of writing. They are build-time, not request-time. Re-check on every
dependency bump. CodeQL runs in CI.

## Known gaps

| Gap | Impact | Plan |
| --- | --- | --- |
| `'unsafe-inline'` still allowed for `style-src` | An injected `<style>` could restyle or exfiltrate via CSS tricks | Blocked on Next/Tailwind emitting nonced style tags |
| Advisories in build-only tooling (tailwindcss 3 → braces/micromatch, eslint-config-next 14 → fast-glob) | Denial of service on glob patterns we write ourselves; none of it ships in the runtime image | Upgrade to Tailwind 4 and ESLint flat config; CI audits production dependencies (`--omit=dev`), which are clean |
| No formal accessibility audit | Unknown barriers for assistive tech | Run axe plus a keyboard-only pass |
| No penetration test | Unknown unknowns | Commission one once hosted |
| DPDP Act (India) not formally assessed | Compliance risk with student personal data | Legal review before launch |

## Reporting a vulnerability

See `/.well-known/security.txt`. Update the contact address there before you
deploy — the shipped value is a placeholder.
