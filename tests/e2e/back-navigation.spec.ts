import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "papervault123";
const COLLEGE = "/colleges/raj-kumar-goel-institute-of-technology";
const PROGRAM = `${COLLEGE}/btech`;
const BRANCH = `${PROGRAM}/cse`;
const SEMESTER = `${BRANCH}/semester-5`;
const SUBJECT = `${SEMESTER}/database-management-systems`;

const back = (page: Page) => page.getByTestId("back-button");

async function clickLink(page: Page, href: string, scope = "main, aside") {
  const url = new RegExp(`${href.replace(/[?]/g, "\\?")}$`);
  // Soft navigations scroll the new page to the top just after it renders;
  // under load a click can land mid-scroll, so retry until the URL changes.
  // Each attempt gets 10s: re-clicking sooner would abort a navigation that is
  // merely slow (the URL only changes once the new page has arrived).
  await expect(async () => {
    if (!url.test(page.url())) {
      await page.locator(scope.split(",").map((s) => `${s.trim()} a[href="${href}"]`).join(", ")).first().click();
    }
    await expect(page).toHaveURL(url, { timeout: 10_000 });
  }).toPass({ timeout: 45_000 });
  await page.waitForLoadState("networkidle");
}

async function pressBack(page: Page, expected: string | RegExp) {
  const url = typeof expected === "string" ? new RegExp(`${expected}$`) : expected;
  await expect(back(page)).toHaveCount(1);
  await page.waitForLoadState("networkidle");
  const before = page.url();
  // Re-click only if the first click was swallowed (URL unchanged), never twice.
  await expect(async () => {
    if (page.url() === before) await back(page).click();
    await expect(page).toHaveURL(url, { timeout: 8_000 });
  }).toPass({ timeout: 30_000 });
}

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
}

test("top-level pages have no Back button", async ({ page }) => {
  for (const path of ["/", "/colleges", "/search?q=dbms"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(back(page)).toHaveCount(0);
  }
});

test("hierarchy: Back walks up step by step and returns home", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await clickLink(page, "/colleges");
  await clickLink(page, COLLEGE);
  await clickLink(page, PROGRAM);
  await clickLink(page, BRANCH);
  await clickLink(page, SEMESTER);
  await clickLink(page, SUBJECT);
  await page.locator('a[href^="/papers/"]').first().click();
  await expect(page).toHaveURL(/\/papers\/[^/]+$/);

  await pressBack(page, SUBJECT);
  await pressBack(page, SEMESTER);
  await pressBack(page, BRANCH);
  await pressBack(page, PROGRAM);
  await pressBack(page, COLLEGE);
  await pressBack(page, "/colleges");
  // /colleges is a top-level page: the native Back takes over from here.
  await expect(back(page)).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test("search: Back from a paper restores the exact results URL", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.locator("#global-search-header").fill("RKGIT DBMS");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=RKGIT\+DBMS/);
  const resultsUrl = page.url();
  await page.locator('a[href^="/papers/"]').first().click();
  await expect(page).toHaveURL(/\/papers\//);
  await back(page).click();
  await expect(page).toHaveURL(resultsUrl);
  await expect(page.locator("#global-search-header")).toHaveValue("RKGIT DBMS");
});

test("direct landing: Back goes to the parent, never loops", async ({ page }) => {
  await page.goto(SUBJECT);
  const paperHref = await page.locator('a[href^="/papers/"]').first().getAttribute("href");
  // Fresh tab straight onto a paper (a shared link).
  const fresh = await page.context().newPage();
  await fresh.goto(paperHref!);
  await pressBack(fresh, SUBJECT);
  await pressBack(fresh, SEMESTER);
  // The fallback replaced history entries, so browser Back cannot bounce
  // between the paper and its subject.
  await fresh.goBack().catch(() => undefined);
  await expect(fresh).not.toHaveURL(/\/papers\//);
  await fresh.close();
});

test("browser Back and PaperVault Back mix without loops", async ({ page }) => {
  await page.goto(COLLEGE);
  await page.waitForLoadState("networkidle");
  await clickLink(page, PROGRAM);
  await clickLink(page, BRANCH);
  await clickLink(page, SEMESTER);

  await page.goBack(); // native: semester -> branch
  await expect(page).toHaveURL(new RegExp(`${BRANCH}$`));
  await pressBack(page, PROGRAM); // ours: branch -> program
  await page.goForward(); // native forward: program -> branch
  await expect(page).toHaveURL(new RegExp(`${BRANCH}$`));
  await pressBack(page, PROGRAM);
  await pressBack(page, COLLEGE);
  await pressBack(page, "/colleges"); // college page was the first entry: parent fallback
  await expect(back(page)).toHaveCount(0);
});

test("going up via breadcrumbs, then Back retraces real history without bouncing", async ({ page }) => {
  await page.goto(COLLEGE);
  await page.waitForLoadState("networkidle");
  await clickLink(page, PROGRAM);
  await clickLink(page, BRANCH);
  // Breadcrumb up to the college, the page we already came from.
  await clickLink(page, COLLEGE, 'nav[aria-label="Breadcrumb"]');
  // Back behaves like the browser: to the branch we just left, then onwards
  // up the trail — never college <-> branch ping-pong.
  await pressBack(page, BRANCH);
  await pressBack(page, PROGRAM);
  await pressBack(page, COLLEGE);
  await pressBack(page, "/colleges");
});

test("admin: member list query survives Back from a member", async ({ page }) => {
  await signIn(page, "admin@papervault.dev");
  // Landed directly on the filtered list (bookmark): its parent is the admin hub.
  const fresh = await page.context().newPage();
  page = fresh;
  await page.goto("/admin/users?q=papervault.dev");
  await page.waitForLoadState("networkidle");
  await page.locator('a[href^="/admin/users/"]').first().click();
  await expect(page).toHaveURL(/\/admin\/users\/[^/?]+$/);
  await expect(page.getByText(/back to all members/i)).toHaveCount(0);
  await pressBack(page, /\/admin\/users\?q=papervault\.dev$/);
  await expect(page.locator("#admin-user-q")).toHaveValue("papervault.dev");
  await pressBack(page, "/admin");
  await page.close();
});

test("moderation: recycle bin and takedowns go back to the queue", async ({ page }) => {
  await signIn(page, "moderator@papervault.dev");
  await page.goto("/moderation");
  await clickLink(page, "/moderation/recycle-bin");
  await expect(page.getByRole("link", { name: /back to queue/i })).toHaveCount(0);
  await pressBack(page, "/moderation");
  // Landed directly in a fresh tab: falls back to the queue.
  const fresh = await page.context().newPage();
  await fresh.goto("/moderation/takedowns");
  await pressBack(fresh, "/moderation");
  await fresh.close();
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("Back is a comfortable tap target", async ({ page }) => {
    await page.goto(COLLEGE);
    await page.waitForLoadState("networkidle");
    await clickLink(page, PROGRAM);
    const box = await back(page).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(36);
    expect(box!.width).toBeGreaterThanOrEqual(64);
    await back(page).tap();
    await expect(page).toHaveURL(new RegExp(`${COLLEGE}$`));
  });
});
