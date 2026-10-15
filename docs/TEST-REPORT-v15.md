# v15 release validation

## Scope and environment

Validation was performed against this release source in an isolated local workspace, not the
live PaperVault installation. The patch base is GitHub main commit `d8a7d87`.

Environment: Node.js 24.14.1, PostgreSQL 16 on a dedicated local port/database, Chromium through
Playwright, Poppler 24.08.0 and Tesseract 5.5.1 with English/orientation models. GitHub CI uses
Node.js 22 and must run again on the submitted pull request; local results do not replace it.
Test-only settings and seeded accounts were confined to disposable test databases.

## Initial v15 local results

| Check | Result |
| --- | --- |
| `npm run verify` | TypeScript and lint passed; 203 unit tests passed in 25 files |
| `npm run test:integration` with optional real ST-1 fixture | 69 passed; 1 skipped in 8 files |
| `npm run test:e2e -- --retries=0` | 117 passed; 5 skipped; no retries |
| Production Next.js build | Passed as part of the fresh-build browser run |
| `npm audit --omit=dev --audit-level=high` | 0 reported production dependency vulnerabilities at validation time |
| `git diff --check` | Passed |
| Read-only launch checker on demo test data | Correctly exited nonzero and reported demo/configuration blockers |

The genuine ST-1 integration tests exercised the original header, 90-degree orientation,
misleading native footer, long native watermark and slight tilt. Passing these examples is
not a measured accuracy rate across colleges, handwriting or poor-quality scans.

## Skipped coverage

- One integration test needs an optional four-page genuine scan that was not available.
- Four browser tests need optional private genuine-scan fixtures; these were not supplied to
  the full browser run. Generated multipage PDF previews and late-detection/edit-protection
  tests did run. The separate integration run did exercise the genuine ST-1 fixture.
- One browser teacher-approval flow is intentionally skipped when teacher verification is
  disabled in the test configuration.

User documents, test databases, local environment files, test storage, screenshots, traces and
browser reports are not bundled in the source release.

## GitHub CI follow-up

The initial local results above did not reproduce a later GitHub CI failure: semester-to-subject
navigation stalled in the hierarchy journey and was flaky in the student journey. Disabling
prefetch alone was insufficient. The follow-up correction uses ordinary document links for
semester subject rows and search subject results and adds a document-request desktop/phone
regression. It does not weaken CSP, remove assertions or increase test timeouts.

Follow-up local validation after the correction:

- `npm run verify`: TypeScript and lint passed; 203 unit tests passed.
- Fresh-build `npm run test:e2e -- --retries=0`: 118 passed, 5 skipped in 8.1 minutes.
- The original hierarchy and student journeys passed, along with the new phone/desktop
  document-request and browser Back regression.
- GitHub `release/v15` commit `144ea35` matched the original release tree; the correction patch
  targets that branch. CI must run again after pushing; these are local results, not a claim
  that the GitHub follow-up run has passed.

An exploratory no-JavaScript check also showed that the existing streamed layout needs
JavaScript to reveal content. This correction does not establish full no-JavaScript support;
the new regression verifies document navigation directly with ordinary browser settings.

## Regressions investigated

Earlier runs exposed stalled collection navigation and search pagination. Academic-hierarchy
speculative prefetch was disabled, and query pagination now uses ordinary document links,
including forward and backward navigation coverage. A stale locally launched server was also
removed; CI now refuses to reuse an unrelated server on port 3000. The final full run used a
fresh build and passed the previously failing flows without retries or relaxed assertions.
Browser failures retain traces/screenshots and a report for future CI diagnosis.

## What this does not establish

- No local production Docker image build, production deployment, external penetration test,
  formal accessibility audit, load benchmark or backup-restore drill was performed.
- No real SMTP delivery, production ClamAV outage behavior or off-server recovery was validated
  by these local results; complete the operational launch checklist.
- Automated tests cannot establish document rights, syllabus compatibility, user demand,
  contributor retention, zero bugs or guaranteed security.
- Request identities still group subject/exam type/year rather than individual test sessions
  and sets. There is no new automatic request notification system.

See [UPGRADE-v15.md](UPGRADE-v15.md) and [LAUNCH-PLAN.md](LAUNCH-PLAN.md) before promotion.
