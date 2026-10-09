import { expect, test } from "@playwright/test";

test("the policy pages are reachable from the footer", async ({ page }) => {
  await page.goto("/");
  for (const [label, heading] of [
    ["Terms", /Terms of Use/i],
    ["Privacy", /Privacy Policy/i],
    ["Takedown", /Takedown Policy/i],
  ] as const) {
    await page.goto("/");
    await expect(async () => {
      await page.getByRole("contentinfo").getByRole("link", { name: label }).click({ timeout: 5_000 });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading, { timeout: 10_000 });
    }).toPass({ timeout: 45_000 });
  }
});

test("a rights holder can file a takedown notice without an account", async ({ page }) => {
  await page.goto("/legal/takedown");
  const marker = `E2E takedown ${Date.now()}`;

  await page.locator("#paperUrl").fill("https://papervault.dev/papers/does-not-exist-yet");
  await page.locator("#claimantName").fill("Registrar Test");
  await page.locator("#claimantEmail").fill(`registrar+${Date.now()}@example.edu`);
  await page.locator("#claimantRole").selectOption("RIGHTS_HOLDER");
  await page
    .locator("#reason")
    .fill(`${marker}: this paper is an internal assessment that was never released to students.`);
  await page.getByRole("checkbox").check();

  await expect(async () => {
    await page.getByRole("button", { name: /send the notice/i }).click({ timeout: 5_000 });
    await expect(page.getByText(/Notice received/i)).toBeVisible({ timeout: 15_000 });
  }).toPass({ timeout: 60_000 });
});

test("a moderator sees the notice in the takedown queue", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill("moderator@papervault.dev");
  await page.locator("#password").fill("papervault123");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

  await page.goto("/moderation/takedowns");
  await expect(page.getByRole("heading", { name: /takedown notices/i })).toBeVisible();
});

test("the health endpoint reports the database as up", async ({ request }) => {
  const response = await request.get("/api/healthz");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(body.checks.database).toBe("up");
});

test("full-text search finds a phrase from inside a paper", async ({ page }) => {
  // "two-phase locking" appears only in the extracted text layer, never in a
  // title, so a hit proves the PDF contents are being indexed.
  await page.goto("/search?q=two-phase+locking");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Results for/i);
  await expect(page.getByRole("heading", { name: /^Papers \(/ })).toBeVisible();
  await expect(page.locator('a[href^="/papers/"]').first()).toBeVisible();
});
