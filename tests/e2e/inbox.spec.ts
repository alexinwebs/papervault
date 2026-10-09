import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("papervault123");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
}

test("the bell shows an unread count and the inbox can clear it", async ({ page }) => {
  await signIn(page, "raj@papervault.dev");

  const bell = page.getByRole("link", { name: /Notifications, \d+ unread/i });
  await expect(bell).toBeVisible();

  await expect(async () => {
    await bell.click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/inbox$/, { timeout: 10_000 });
  }).toPass({ timeout: 45_000 });

  await expect(page.getByRole("heading", { name: /^Notifications$/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();

  await expect(async () => {
    const button = page.getByRole("button", { name: /mark all as read/i });
    if (await button.count()) await button.click({ timeout: 5_000 });
    await expect(button).toHaveCount(0, { timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
  // The button only shows "Working…" while the action runs; wait for it to finish
  // before reloading, or the reload can race the write.
  await expect(page.getByRole("button", { name: /working/i })).toHaveCount(0, { timeout: 20_000 });
  await page.waitForLoadState("networkidle");

  await page.reload();
  await expect(page.getByRole("link", { name: /Notifications, \d+ unread/i })).toHaveCount(0);
});

test("signed-out visitors get no bell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Notifications/i })).toHaveCount(0);
});
