import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
  for (const path of ["/register", "/login"]) {
    test(`the password eye works without submitting at ${path}, ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const password = page.locator("#password");
      const value = "Visibility-Test-123";
      await password.fill(value);
      await expect(password).toHaveAttribute("type", "password");
      const toggle = password.locator("..").getByRole("button", { name: "Show password" });
      await expect(toggle).toHaveAttribute("type", "button");
      let submissions = 0;
      page.on("request", (request) => { if (request.method() === "POST") submissions++; });
      await toggle.click();
      await expect(password).toHaveAttribute("type", "text");
      await expect(password).toHaveValue(value);
      await expect(password.locator("..").getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
      await expect(password).toBeFocused();
      await password.locator("..").getByRole("button", { name: "Hide password" }).click();
      await expect(password).toHaveAttribute("type", "password");
      await expect(password).toHaveValue(value);
      expect(submissions).toBe(0);
      const bounds = (await password.locator("..").getByRole("button", { name: "Show password" }).boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    });
  }
}

test("password fields in account settings reveal independently", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill("student@papervault.dev");
  await page.locator("#password").fill("papervault123");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");
  const current = page.locator("#currentPassword");
  const next = page.locator("#new-password");
  const confirm = page.locator("#confirm-password");
  await current.fill("Current-123");
  await next.fill("New-password-123");
  await confirm.fill("New-password-123");
  await current.locator("..").getByRole("button", { name: "Show password" }).click();
  await expect(current).toHaveAttribute("type", "text");
  await expect(next).toHaveAttribute("type", "password");
  await expect(confirm).toHaveAttribute("type", "password");
  await next.locator("..").getByRole("button", { name: "Show password" }).click();
  await expect(next).toHaveAttribute("type", "text");
  await expect(confirm).toHaveAttribute("type", "password");
});
