import { expect, test } from "@playwright/test";

const PASSWORD = "papervault123";

test("a new account must confirm its email before uploading", async ({ page }) => {
  const email = `e2e-${Date.now()}@papervault.dev`;

  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.locator("#name").fill("E2E Newcomer");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("SuperSecret123");
  await page.getByRole("button", { name: /create account/i }).click();

  // Registration lands on the confirmation notice, signed in.
  await expect(page).toHaveURL(/\/verify-email/, { timeout: 30_000 });
  await expect(page.getByText(/check your inbox/i)).toBeVisible();

  // Uploading is blocked until the address is confirmed.
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/confirm your email address/i).first()).toBeVisible();
});

test("the forgot-password form never reveals whether an account exists", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill("definitely-not-a-user@papervault.dev");
  await expect(async () => {
    await page.getByRole("button", { name: /email me a reset link/i }).click({ timeout: 5_000 });
    await expect(page.getByText(/if that address has an account/i)).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
});

test("a reset link that is not real is rejected", async ({ page }) => {
  await page.goto("/reset-password?token=not-a-real-token-at-all");
  await page.waitForLoadState("networkidle");
  await page.locator("#password").fill("BrandNewPass123");
  await page.locator("#confirmPassword").fill("BrandNewPass123");
  await expect(async () => {
    await page.getByRole("button", { name: /set new password/i }).click({ timeout: 5_000 });
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
});

test("signing out revokes the session immediately", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill("student@papervault.dev");
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

  await page.goto("/settings");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: /signed-in devices/i })).toBeVisible();
  await expect(page.getByText(/this device/i).first()).toBeVisible();

  await page.getByRole("button", { name: /sign out/i }).first().click();
  await expect(page.getByRole("link", { name: /^sign in$/i })).toBeVisible();

  // The cookie is gone and the protected page no longer resolves a user.
  await page.goto("/settings");
  await expect(page.getByText(/sign in to manage your account/i)).toBeVisible();
});

test("security headers are set on every response", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["permissions-policy"]).toContain("camera=(self)");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});
