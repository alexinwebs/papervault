import { dismissActionPopup } from "./popups";
import { expect, test } from "@playwright/test";
import { currentTotp } from "@/lib/totp";

test("a student can enrol an authenticator and is then challenged at sign-in", async ({ page }) => {
  // A fresh account keeps this test idempotent: enrolling 2FA is a one-way
  // change, so a retry must not depend on a seeded user's state.
  const email = `totp+${Date.now()}@papervault.dev`;
  const password = "papervault123";

  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.locator("#name").fill("TOTP Test User");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i }).first()).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: /two-factor authentication/i })).toBeVisible();

  await expect(async () => {
    await page
      .getByRole("button", { name: /set up two-factor authentication/i })
      .click({ timeout: 5_000 });
    await expect(page.getByAltText(/two-factor setup qr code/i)).toBeVisible({ timeout: 15_000 });
  }).toPass({ timeout: 60_000 });

  // Read the shared secret off the manual-entry line and compute a live code,
  // exactly as an authenticator app would.
  const shown = (await page.locator("code").first().textContent())!.replace(/\s/g, "");
  const code = await currentTotp(shown);

  await page.locator("#totp-token").fill(code);
  await expect(async () => {
    await page.getByRole("button", { name: /turn on two-factor/i }).click({ timeout: 5_000 });
    await expect(page.getByText(/save these recovery codes/i)).toBeVisible({ timeout: 15_000 });
  }).toPass({ timeout: 60_000 });

  const recoveryCodes = await page.locator("li.pv-panel-flat").allTextContents();
  expect(recoveryCodes.length).toBeGreaterThan(5);

  await dismissActionPopup(page);

  // Sign out and back in: the password alone is no longer enough.
  await page.getByRole("button", { name: /sign out/i }).first().click();
  await expect(page.getByRole("link", { name: /^sign in$/i })).toBeVisible();

  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/login\/two-factor/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /enter your code/i })).toBeVisible();

  // A wrong code is rejected.
  await page.locator("#token").fill("000000");
  await expect(async () => {
    await page.getByRole("button", { name: /verify and sign in/i }).click({ timeout: 5_000 });
    await expect(page.getByText(/that code is not valid/i)).toBeVisible({ timeout: 15_000 });
  }).toPass({ timeout: 60_000 });

  await dismissActionPopup(page);

  // An unused recovery code gets the user in.
  await page.locator("#token").fill(recoveryCodes[0].trim());
  await expect(async () => {
    await page.getByRole("button", { name: /verify and sign in/i }).click({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /sign out/i }).first()).toBeVisible({ timeout: 15_000 });
  }).toPass({ timeout: 60_000 });
});
