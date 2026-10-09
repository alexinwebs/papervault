import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "papervault123";
const ABES = "/colleges/abes-engineering-college";

/** Fresh account per test so pins from earlier runs never leak in. */
async function register(page: Page, label: string) {
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.locator("#name").fill(`Tester ${label.toUpperCase()}`);
  await page.locator("#email").fill(`pin-${label}-${Date.now()}@papervault.dev`);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/verify-email/, { timeout: 30_000 });
}

const navPins = (page: Page) => page.getByTestId("nav-my-colleges").first();

test("pin a college from its page, find it in My Colleges, then unpin it", async ({ page }) => {
  await register(page, "a");
  await page.goto(ABES);
  await page.waitForLoadState("networkidle");

  const pin = page.getByTestId("pin-college");
  await expect(pin).toHaveAttribute("data-pinned", "false");
  await expect(pin).toHaveText(/pin/i);
  await pin.click();
  await expect(pin).toHaveAttribute("data-pinned", "true");
  await expect(pin).toHaveAttribute("data-saving", "false");
  await expect(pin).toHaveText(/pinned/i);
  // No full reload: the URL is unchanged and the nav picks the pin up in place.
  await expect(page).toHaveURL(new RegExp(`${ABES}$`));

  // Persisted server-side: survives a reload.
  await page.reload();
  await expect(page.getByTestId("pin-college")).toHaveAttribute("data-pinned", "true");

  // My Library lists it and links straight to the college.
  await page.goto("/library");
  const mine = page.getByTestId("my-colleges");
  await expect(mine.getByRole("link", { name: /ABES Engineering College/i })).toBeVisible();
  await mine.getByRole("link", { name: /ABES Engineering College/i }).click();
  await expect(page).toHaveURL(new RegExp(`${ABES}$`));

  // Unpin; it disappears from the library list.
  await page.getByTestId("pin-college").click();
  await expect(page.getByTestId("pin-college")).toHaveAttribute("data-pinned", "false");
  await expect(page.getByTestId("pin-college")).toHaveAttribute("data-saving", "false");
  await page.goto("/library");
  await expect(page.getByText("No pinned colleges yet.")).toBeVisible();
});

test("pinning from the college list keeps filters, URL and card navigation intact", async ({ page }) => {
  await register(page, "b");
  const listUrl = "/colleges?q=kiet";
  await page.goto(listUrl);
  await page.waitForLoadState("networkidle");

  const card = page.locator(".pv-card-interactive", { hasText: "KIET" }).first();
  const pin = card.getByTestId("pin-college");
  await pin.click();
  await expect(pin).toHaveAttribute("data-pinned", "true");
  await expect(pin).toHaveAttribute("data-saving", "false");
  // The pin click must not follow the card link or drop the query string.
  await expect(page).toHaveURL(/\/colleges\?q=kiet$/);

  // Desktop sidebar shows the pinned college; clicking goes to its page.
  await expect(navPins(page)).toContainText("KIET");
  await navPins(page).getByRole("link").first().click();
  await expect(page).toHaveURL(/\/colleges\/kiet-group-of-institutions$/);

  // Back navigation returns to the filtered list.
  await page.goBack();
  await expect(page).toHaveURL(/\/colleges\?q=kiet$/);

  // The card itself still navigates normally.
  await page.locator(".pv-card-interactive", { hasText: "KIET" }).first().getByRole("link").click();
  await expect(page).toHaveURL(/\/colleges\/kiet-group-of-institutions$/);
});

test("pins are private to the user who made them", async ({ browser }) => {
  const a = await browser.newContext();
  const pageA = await a.newPage();
  await register(pageA, "c");
  await pageA.goto(ABES);
  await pageA.getByTestId("pin-college").click();
  await expect(pageA.getByTestId("pin-college")).toHaveAttribute("data-pinned", "true");
  await expect(pageA.getByTestId("pin-college")).toHaveAttribute("data-saving", "false");

  const b = await browser.newContext();
  const pageB = await b.newPage();
  await register(pageB, "d");
  await pageB.goto(ABES);
  await expect(pageB.getByTestId("pin-college")).toHaveAttribute("data-pinned", "false");
  await expect(pageB.getByTestId("nav-my-colleges")).toHaveCount(0);
  await pageB.goto("/library");
  await expect(pageB.getByText("No pinned colleges yet.")).toBeVisible();
  // No public pin count anywhere on the college page.
  await pageB.goto(ABES);
  const body = await pageB.locator("main").innerText();
  expect(body).not.toMatch(/pinned by|\d+\s+pins?\b|\bpins?:\s*\d/i);
  await expect(pageB.getByTestId("pin-college")).toHaveText(/^\s*pin\s*$/i);

  await a.close();
  await b.close();
});

test("signed-out visitors are sent to sign in and brought back", async ({ page }) => {
  await page.goto(ABES);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("pin-college").click();
  await expect(page).toHaveURL(/\/login\?next=%2Fcolleges%2Fabes-engineering-college/);
});

test("the pin control fits on a phone", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await register(page, "m");
  await page.goto("/colleges");
  await page.waitForLoadState("networkidle");
  const pin = page.getByTestId("pin-college").first();
  await pin.tap();
  await expect(pin).toHaveAttribute("data-pinned", "true");
  const box = await pin.boundingBox();
  expect(box && box.x + box.width).toBeLessThanOrEqual(375);
  expect(box && box.height).toBeGreaterThanOrEqual(30);
  // The drawer menu shows My Colleges too.
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByTestId("nav-my-colleges").last()).toBeVisible();
  await ctx.close();
});
