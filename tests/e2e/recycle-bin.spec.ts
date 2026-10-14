import { dismissActionPopup } from "./popups";
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("papervault123");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
}

test("a moderator can bin a paper and restore it", async ({ page }) => {
  await signIn(page, "moderator@papervault.dev");

  // Take the first paper in the queue and read its title before removing it.
  await page.goto("/moderation?status=PUBLISHED");
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.getByRole("link", { name: /^Review$/ }).first().click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/moderation\/[a-z0-9]+/, { timeout: 10_000 });
  }).toPass({ timeout: 45_000 });

  const title = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();
  page.on("dialog", (dialog) => dialog.accept());

  await page.getByLabel(/reason for removal/i).fill("E2E removal check");
  await expect(async () => {
    await page.getByRole("button", { name: /move to recycle bin/i }).click({ timeout: 5_000 });
    await expect(page).toHaveURL(/recycle-bin\?done=deleted/, { timeout: 15_000 });
  }).toPass({ timeout: 60_000 });

  await dismissActionPopup(page);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // It is gone from the public archive while it sits in the bin.
  const binned = page.locator("li").filter({ hasText: title }).first();
  await expect(async () => {
    await binned.getByRole("button", { name: /^restore$/i }).click({ timeout: 5_000 });
    await expect(page).toHaveURL(/recycle-bin\?done=restored/, { timeout: 15_000 });
  }).toPass({ timeout: 60_000 });

  await page.reload();
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
});

test("students cannot reach the recycle bin", async ({ page }) => {
  await signIn(page, "student@papervault.dev");
  await page.goto("/moderation/recycle-bin");
  await expect(page.getByText(/moderation/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^restore$/i })).toHaveCount(0);
});
