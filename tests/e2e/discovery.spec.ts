import { expect, test } from "@playwright/test";
const subject = "/colleges/raj-kumar-goel-institute-of-technology/btech/cse/semester-5/compiler-design";
for (const width of [320, 768, 1440]) test(`public discovery fits ${width}px without signup`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  for (const path of ["/", "/guide", "/requests", "/search", `${subject}?exam=ST&year=1999`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
  const login = page.getByRole("link", { name: "Sign in to request", exact: true });
  await expect(login).toHaveAttribute("href", new RegExp(`next=${encodeURIComponent(`${subject}?exam=ST&year=1999`)}`));
});
test("search exposes subsequent results and keeps its query", async ({ page }) => {
  await page.goto("/search?q=2025");
  const next = page.getByRole("link", { name: "Next", exact: true });
  await expect(next).toBeVisible(); await next.click();
  await expect(page).toHaveURL(/q=2025&page=2/);
  await expect(page.getByTestId("pagination-position")).toContainText("Page 2");
  await expect(page.locator("#global-search-page")).toHaveValue("2025");
  await page.getByRole("link", { name: "Previous", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=2025$/);
  await expect(page.getByTestId("pagination-position")).toContainText("Page 1");
});
test("collection sharing copies only its public canonical path", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (value: string) => { (window as unknown as { sharedUrl: string }).sharedUrl = value; } }, configurable: true });
  });
  await page.goto(`${subject}?exam=ST&tracking=private`);
  await page.getByRole("button", { name: "Share collection", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { sharedUrl: string }).sharedUrl)).toBe(`http://localhost:3000${subject}?exam=ST`);
});
test("invalid campus filter does not silently show other colleges", async ({ page }) => {
  await page.goto("/requests?college=no-such-college");
  await expect(page.getByText("College not found.", { exact: true })).toBeVisible();
  await expect(page.getByTestId("wanted-paper")).toHaveCount(0);
});

// Subject selection must use a document request, not a client-router Flight transition.
test("semester subject selection uses document navigation on desktop and phone", async ({ browser, baseURL }) => {
  const semester = "/colleges/raj-kumar-goel-institute-of-technology/btech/cse/semester-5";
  const target = `${semester}/database-management-systems`;
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ baseURL, viewport: { width, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto(semester);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Semester 5");
      const documentRequest = page.waitForRequest(request =>
        request.isNavigationRequest() && request.resourceType() === "document" &&
        new URL(request.url()).pathname === target);
      await page.locator(`main a[href="${target}"]`).click();
      await documentRequest;
      await expect(page).toHaveURL(new RegExp(`${target}$`));
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Database Management Systems");
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`${semester}$`));
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Semester 5");
    } finally { await context.close(); }
  }
});
