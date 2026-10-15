# Upgrade to v15: discovery and contribution foundations

This is a focused product upgrade, not a claim that every bug or adoption problem is solved.
It keeps local OCR, file permissions and moderator publication checks. It adds no paid API,
new database migration or new third-party analytics service.

## What changed

- Clearer homepage: find a useful college collection, read public papers without signup,
  share a link with classmates, and help with a specific missing paper.
- Public `/requests` board with college filtering and aggregate demand counts. It checks the
  100 most-requested candidate groups per view; it is not an exhaustive missing-paper inventory.
  No requester names or emails are included in board responses.
- Share controls on college, semester, subject and public paper pages. Only explicit public
  routes are shared, not the current page's arbitrary query string. Native sharing falls back
  to clipboard or manual copy. No third-party share-tracking widget is used.
- Search pagination using ordinary document links (also works before hydration), browsing recent papers without a query, explicit subject aliases,
  hyphenated-code normalization and academic-session start-year recognition.
- Search keeps college and branch scopes together and does not silently drop an unknown
  subject just because a college matched. Paper matching is not capped at eight suggestions.
- A subject-page year selector and request sign-in links that preserve subject/exam/year.
- Request availability derives from actual published, unrestricted, non-deleted papers,
  including cross-listings. Legacy `fulfilled` flags are no longer treated as authoritative
  in My Library, the public board or subject request counts.
- Pending uploads no longer mark requests as publicly available. Removing or restricting a
  published paper makes the request appear open again without a data-repair migration.
- Requests validate account standing/email policy, active curriculum and same-college exam
  type; future-year requests are refused. Already-held current-year material can be requested,
  but the ordinary publication safeguards still apply.
- My Library shows actual published-paper/download totals, explicitly not unique-student counts.
- `/guide` explains finding, sharing, contributing, review labels and reporting problems.
- More explanatory badge labels, visible subject codes/test sessions in paper rows, dropdown
  keyboard controls and suggestion announcements.
- `npm run launch:check`: read-only deployment checks for demo content and unsafe configuration.
- MIT license metadata in both package manifests; existing third-party notices remain intact.
- Semester subject rows and search subject results use ordinary document links, so selecting
  a subject does not depend on a streamed client-router transition. Other
  academic-hierarchy links do not speculatively prefetch database-backed pages. Browser failures
  retain screenshots/traces and an HTML report for CI troubleshooting. CI refuses to reuse an
  unrelated server on port 3000.

See [TEST-REPORT-v15.md](TEST-REPORT-v15.md) for validation results and exclusions.

## Before updating

1. Back up the database and uploaded files, with protected off-server copies.
2. Preserve `.env.production`, storage, volumes and credentials. Do not copy example settings
   over a working environment.
3. Use a clean branch or stage a ZIP into a separate folder. Review changes before overlaying
   an existing installation. Do not replace a modified source tree without saving your work.
4. Do not run `setup`, `db:seed`, browser tests or database resets on the production database.

## GitHub workflow from a local checkout

The supplied patch is based on GitHub `main` commit `d8a7d87`.
Start from your current merged `main`, on a clean working tree. Create a feature branch and
apply the supplied patch (recommended) or copy reviewed source files from the release ZIP.

```bash
git switch main
git pull --ff-only origin main
git switch -c release/v15
git apply --check /path/to/papervault-v15.patch
git apply /path/to/papervault-v15.patch
npm ci
npm run verify
npm audit --omit=dev --audit-level=high
git diff --check
git add src tests scripts docs .github/workflows/ci.yml playwright.config.ts \
  README.md CHANGELOG.md package.json package-lock.json
git commit -m "feat: improve discovery, sharing and contribution workflows"
git push -u origin release/v15
```

The patch includes new files. A conflict means your checkout differs from the tested base;
stop and reconcile the differences rather than forcing the patch or discarding local work.
Do not use `git add .` blindly; never commit private configuration, uploads or database dumps.
Open a pull request into `main` and let CI complete before merging.

## Production Docker Compose update

For a clean Git-based server checkout, back up before pulling and rebuilding:

```bash
sh deploy/backup.sh &&
git pull --ff-only origin main &&
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

For a ZIP-based server, export the merged source from your local Git checkout, then transfer
and extract it into the intended source directory. Chain extraction and rebuild with `&&` so
an extraction failure cannot rebuild old code. Do not delete persistent Docker volumes.

Inspect the result:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --since=10m --tail=100 app
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npm run launch:check
```

The last command reads data/configuration and exits nonzero when automatic blockers are found.
It does not purge demo data or test actual email delivery, scanner readiness or backup recovery.
Use `/api/healthz` plus the manual checklist in [LAUNCH-PLAN.md](LAUNCH-PLAN.md).

## Post-deployment smoke checks

- Signed out: open the homepage, a college, `/guide`, `/requests`, `/search` and a public PDF.
- Search a real college/branch/code and a deliberately nonexistent subject within that college.
  Unrelated papers should not substitute for the missing subject. Check page two of results.
- Share a semester and subject collection on desktop and a phone; copied URLs must remain public.
- Open an empty subject/exam/year, then sign in to request it. Verify the return path.
- Contribute a permitted test paper using a real contributor account. Confirm it remains pending
  or restricted until reviewed. Verify the manual route and document preview still work.
- Publish, restrict and remove a test paper through authorised moderation. Request availability
  must follow public access, not just the existence of a submitted file.
- Check My Library counts, email delivery, reporting, scanner status and storage persistence.

## Known boundaries

- The existing streamed layout requires JavaScript; ordinary navigation links do not mean
  the entire application supports JavaScript-disabled browsers.

- Request records currently identify subject + exam type + year, not an individual ST-1/ST-2
  session or set. The board discloses this. Printed session labels must still be checked.
- Requests indicate demand, not guaranteed availability. There is no new automatic contributor
  notification or promised review deadline.
- Share support varies by browser. Clipboard may require HTTPS; manual copying remains available.
- This release does not add an automatic image-quality classifier, catalogue merge tool,
  per-field OCR correction analytics, an accessibility certification or a security audit.
- Existing local OCR accuracy depends on scan quality and catalogue coverage. Manual confirmation
  is still required. Real private-scan tests run only when optional fixture paths are provided.
- A software upgrade cannot supply legitimate papers, recruit reviewers or establish demand.
  Complete the pilot described in the launch plan before expanding.
