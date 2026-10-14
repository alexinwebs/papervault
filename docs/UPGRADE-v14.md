# Upgrade an existing PaperVault server to v14

Use **papervault-v14.zip** at every step. This is a full source release, not a
patch. Back up the production database and uploaded-file volume first using your
existing backup procedure. Keep `.env.production` and the existing Docker volumes.
No new environment variable, API key, schema migration or catalogue seed is needed.

## 1. Fedora: transfer the release

If your prompt says `azureuser@papervault`, run `exit` to return to Fedora first.
Save the downloaded release in `~/Downloads`, then run:

```bash
scp -i ~/.ssh/papervault ~/Downloads/papervault-v14.zip azureuser@172.198.76.152:~
ssh -i ~/.ssh/papervault azureuser@172.198.76.152
```

## 2. Ubuntu server: extract and rebuild

The `&&` chain deliberately stops if extraction fails, so an old source tree is
not accidentally rebuilt after a missing-file error.

```bash
cd ~ &&
unzip -o papervault-v14.zip &&
cd ~/papervault &&
test -f src/components/SuggestionInput.tsx &&
test -f .env.production &&
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Check the result:

```bash
cd ~/papervault
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --since=10m --tail=100 app
```

Do **not** run `db:seed`, reset the database, copy an example environment file
over production settings, or run `down -v` during this upgrade. A source ZIP
cannot update an already-running image without a rebuild.

## 3. Verify in the site

- Refresh `/upload`. Auto-detect should show the clear-PDF/photo tip.
- Choose **Enter manually**. College and branch suggestions should be cream/navy,
  searchable and usable with arrow keys, Enter and Escape. Unknown values remain
  editable for manual group creation.
- Upload a supplied test scan. Check the detected code, semester, test/session and
  year; correct fields before confirming. A paper without a printed college name
  still needs you to select its college.
- Try **Preview paper**, then close it and confirm the form is preserved.
- Retry detection after editing a field; the edit should remain unchanged.
- Check duplicate rejection and moderation using your normal test workflow.

Detection stays local and free of OCR API charges. Hosting and CPU costs remain.
Scans, handwriting and missing/ambiguous metadata cannot be detected perfectly;
manual entry and moderator review are still required safeguards. This release
fixes the reported dropdown and detection issues, not a guarantee of zero bugs
throughout every possible production configuration.
