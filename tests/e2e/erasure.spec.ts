import { expect, test } from "@playwright/test";

const PASSWORD = "papervault123";

async function register(page: import("@playwright/test").Page, email: string) {
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.locator("#name").fill("Erasure Tester");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/verify-email/, { timeout: 30_000 });
}

test("a signed-in student can download everything we hold about them", async ({ page }) => {
  const email = `export-${Date.now()}@papervault.dev`;
  await register(page, email);

  const response = await page.request.get("/api/account/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toContain("attachment");

  const payload = await response.json();
  expect(payload.format).toBe("papervault.account-export.v1");
  expect(payload.account.email).toBe(email);
  // The export must never become a credential leak.
  expect(JSON.stringify(payload)).not.toContain("passwordHash");
  expect(JSON.stringify(payload)).not.toContain("totpSecret");
});

test("the export endpoint refuses anonymous callers", async ({ request, baseURL }) => {
  const response = await request.get(`${baseURL}/api/account/export`);
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("erasing an account wipes the identity and locks the password out", async ({ page }) => {
  const email = `erase-${Date.now()}@papervault.dev`;
  await register(page, email);

  await page.goto("/settings");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("erase-account").click();

  // A wrong confirmation word must not destroy anything.
  await page.locator("#erase-password").fill(PASSWORD);
  await page.locator("#erase-confirm").fill("erase please");
  await page.getByTestId("erase-submit").click();
  await expect(page.getByTestId("erase-submit")).toBeEnabled({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/settings/);

  // The account survived, so the export still resolves.
  expect((await page.request.get("/api/account/export")).status()).toBe(200);

  // Now confirm properly. Both fields are refilled: a failed submit may have
  // re-rendered the form.
  await page.locator("#erase-password").fill(PASSWORD);
  await page.locator("#erase-confirm").fill("ERASE");
  await page.getByTestId("erase-submit").click();

  // Erasure signs every device out, so we land back on the public home page.
  await expect(page).toHaveURL(/\/\?erased=1/, { timeout: 60_000 });
  await expect(page.getByRole("link", { name: /^sign in$/i })).toBeVisible();

  // The old credentials are dead: the address no longer exists on any account.
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByText(/email or password is incorrect/i).first()).toBeVisible({
    timeout: 30_000,
  });
});
