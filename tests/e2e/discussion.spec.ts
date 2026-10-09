import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "papervault123";
const CAMPUS = "/colleges/raj-kumar-goel-institute-of-technology";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
}

/** Opens a published paper that anyone can read. */
async function openPaper(page: Page) {
  await page.goto(`${CAMPUS}/btech/cse/semester-5/database-management-systems`);
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.locator('a[href^="/papers/"]').first().click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/papers\/[a-z0-9]+/, { timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

test("signed-out visitors can read the discussion but not post", async ({ page }) => {
  await openPaper(page);
  const discussion = page.locator("#discussion");
  await expect(discussion).toBeVisible();
  await expect(discussion.getByRole("link", { name: /^sign in$/i })).toBeVisible();
  await expect(discussion.getByRole("button", { name: /post comment/i })).toHaveCount(0);
});

test("a student can post a comment and another can reply to it", async ({ page }) => {
  const marker = `E2E doubt ${Date.now()}`;

  await signIn(page, "student@papervault.dev");
  await openPaper(page);
  const paperUrl = page.url();

  await page.locator("#comment-root").fill(marker);
  await expect(async () => {
    await page.getByRole("button", { name: /post comment/i }).click({ timeout: 5_000 });
    await expect(page.getByText(marker)).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });

  // A different account replies in the thread.
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page.getByRole("link", { name: /^sign in$/i })).toBeVisible();
  await signIn(page, "raj@papervault.dev");
  await page.goto(paperUrl);
  await page.waitForLoadState("networkidle");

  const card = page.locator("li").filter({ hasText: marker }).first();
  const reply = `E2E reply ${Date.now()}`;
  await expect(async () => {
    await card.getByRole("button", { name: /^reply$/i }).first().click({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /post reply/i })).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });

  await page.getByPlaceholder(/^Reply to /).fill(reply);
  await expect(async () => {
    await page.getByRole("button", { name: /post reply/i }).click({ timeout: 5_000 });
    await expect(page.getByText(reply)).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
});

test("an author can delete their own comment", async ({ page }) => {
  const marker = `E2E delete me ${Date.now()}`;
  await signIn(page, "ananya@papervault.dev");
  await openPaper(page);

  await page.locator("#comment-root").fill(marker);
  await expect(async () => {
    await page.getByRole("button", { name: /post comment/i }).click({ timeout: 5_000 });
    await expect(page.getByText(marker)).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });

  page.on("dialog", (dialog) => dialog.accept());
  // Retry only the click: once the delete lands the button disappears, so a
  // combined click+assert retry would fail on its second pass.
  const deleteButton = page.locator("li").filter({ hasText: marker }).first().getByRole("button", { name: /^delete$/i });
  await expect(async () => {
    if (await deleteButton.count()) await deleteButton.click({ timeout: 5_000 });
    await expect(deleteButton).toHaveCount(0, { timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
  // Assert the persisted state rather than the post-action client transition.
  await page.reload();
  await expect(page.getByText(marker)).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(/this comment was removed/i).first()).toBeVisible();
});

test("the seeded thread renders with its reply nested", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // The seed puts a two-message thread on the first published paper.
  await page.goto("/search?q=RKGIT+DBMS");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Results for/i);
});
