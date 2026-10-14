import { dismissActionPopup } from "./popups";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "papervault123";

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill("admin@papervault.dev");
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
}

test("the control center searches every entity type at once", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /^Control center$/ })).toBeVisible();

  // Inventory counts prove the full taxonomy is really there.
  await expect(page.getByRole("main").getByText("Subjects", { exact: true })).toBeVisible();

  await page.getByLabel(/Find anything/i).fill("KCS501");
  await page.getByRole("main").getByRole("button", { name: /^search$/i }).click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: /^Subjects/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /KCS501 — Database Management Systems/ }).first()).toBeVisible();
});

test("an admin can walk from a search hit to the branch that owns it", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin?q=KCS501");
  await page.waitForLoadState("networkidle");

  await expect(async () => {
    await page
      .getByRole("link", { name: /KCS501 — Database Management Systems/ })
      .first()
      .click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/admin\/branches\/[a-z0-9]+/, { timeout: 10_000 });
  }).toPass({ timeout: 30_000 });

  await expect(page.getByRole("heading", { name: /Semester 5/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Subjects by semester$/ })).toBeVisible();
});

test("every semester of a seeded branch carries subjects", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/colleges");
  await page.waitForLoadState("networkidle");

  await expect(async () => {
    await page
      .getByRole("link", { name: /Raj Kumar Goel Institute of Technology/ })
      .first()
      .click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/admin\/colleges\/[a-z0-9]+/, { timeout: 10_000 });
  }).toPass({ timeout: 30_000 });

  // The college workspace lists degrees and branches, not every subject.
  await expect(page.getByRole("heading", { name: /^B\.Tech / })).toBeVisible();
  // AIML exists only under B.Tech, which is the eight-semester degree.
  const branch = page.getByRole("link", { name: /^AIML — / });
  await expect(async () => {
    await branch.click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/admin\/branches\/[a-z0-9]+/, { timeout: 10_000 });
  }).toPass({ timeout: 30_000 });

  for (const number of [1, 4, 8]) {
    await expect(page.getByRole("heading", { name: new RegExp(`^Semester ${number}`) })).toBeVisible();
  }
  // Eight semesters, none of them empty.
  await expect(page.getByText(/^No subjects yet/)).toHaveCount(0);
});

test("the catalogue template fills a branch that was emptied", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin?q=VLSI");
  await page.waitForLoadState("networkidle");

  await expect(async () => {
    await page.getByRole("link", { name: /VLSI —/ }).first().click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/admin\/branches\/[a-z0-9]+/, { timeout: 10_000 });
  }).toPass({ timeout: 30_000 });

  await expect(page.getByText(/shared catalogue holds/i)).toBeVisible();

  // Applying it twice is safe: the second run reports nothing to do.
  await expect(async () => {
    await page.getByRole("button", { name: /apply catalogue/i }).click({ timeout: 5_000 });
    await expect(page).toHaveURL(/done=/, { timeout: 15_000 });
  }).toPass({ timeout: 45_000 });
  await expect(page.getByText(/Already up to date with the catalogue/i)).toBeVisible();
});

test("pasted subjects are imported and unreadable lines are reported", async ({ page }) => {
  const code = `E2E${Date.now() % 100000}`;
  await signInAsAdmin(page);
  await page.goto("/admin?q=VLSI");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: /VLSI —/ }).first().click();
  await page.waitForURL(/\/admin\/branches\//);

  await page.getByRole("button", { name: /open importer/i }).click();
  await page
    .locator("#import-subjects-rows")
    .fill(`2, ${code}, End To End Imported Subject\nnot a subject line at all`);

  await expect(async () => {
    await page.getByRole("button", { name: /^import subjects$/i }).click({ timeout: 5_000 });
    await expect(page).toHaveURL(/done=/, { timeout: 15_000 });
  }).toPass({ timeout: 45_000 });

  await expect(page.getByText(/1 added/)).toBeVisible();
  await expect(page.getByText(/1 line\(s\) skipped/)).toBeVisible();
  await expect(page.getByText(new RegExp(`${code} — End To End Imported Subject`))).toBeVisible();
});

test("an admin can create a member, ban them and delete them", async ({ page, browser, baseURL }) => {
  const stamp = Date.now();
  const email = `e2e-member-${stamp}@papervault.dev`;

  await signInAsAdmin(page);
  await page.goto("/admin/users");
  await page.waitForLoadState("networkidle");

  await page.getByRole("group").filter({ hasText: /create a member/i }).locator("summary").click();
  await page.locator("#new-member-name").fill(`E2E Member ${stamp}`);
  await page.locator("#new-member-email").fill(email);
  await page.locator("#new-member-password").fill("papervault123");

  await expect(async () => {
    await page.getByRole("button", { name: /^create member$/i }).click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/admin\/users\/[a-z0-9]+\?done=/, { timeout: 15_000 });
  }).toPass({ timeout: 45_000 });

  await dismissActionPopup(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`E2E Member ${stamp}`);
  await expect(page.getByText("email unconfirmed")).toBeVisible();

  // Force the email to confirmed.
  await expect(async () => {
    const button = page.getByRole("button", { name: /mark email confirmed/i });
    if (await button.count()) await button.click({ timeout: 5_000 });
    await expect(page.getByText("email confirmed")).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 45_000 });

  await dismissActionPopup(page);

  // Ban through the standing form (confirm dialog auto-accepted).
  page.on("dialog", (dialog) => dialog.accept());
  const standing = page.getByTestId("member-standing-form");
  await standing.locator("select[name=action]").selectOption("BAN");
  await standing.locator("textarea[name=reason]").fill("End-to-end test");
  await expect(async () => {
    const button = standing.getByRole("button", { name: /^apply$/i });
    if (await button.count()) await button.click({ timeout: 5_000 });
    await expect(page.getByText(/^banned$/).first()).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 45_000 });

  await page.reload();
  await expect(page.getByText(/End-to-end test/)).toBeVisible();

  // The banned account cannot sign in. Use a fresh, signed-out browser
  // context: navigating away straight after clicking "Sign out" can cancel
  // the sign-out request, leaving the admin signed in on slower machines.
  const visitor = await browser.newContext({ baseURL });
  const guest = await visitor.newPage();
  await guest.goto("/login");
  await guest.waitForLoadState("networkidle");
  await guest.locator("#email").fill(email);
  await guest.locator("#password").fill("papervault123");
  await guest.getByRole("button", { name: /^sign in$/i }).click();
  await expect(guest.getByText(/this account has been banned/i)).toBeVisible();
  await expect(guest.getByRole("button", { name: /sign out/i })).toHaveCount(0);
  await visitor.close();

  // And the admin (still signed in on the original page) removes it for good.
  await page.goto("/admin/users?q=" + encodeURIComponent(email));
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    const button = page.getByRole("button", { name: /^delete$/i }).first();
    if (await button.count()) await button.click({ timeout: 5_000 });
    await expect(page.getByText(email)).toHaveCount(0, { timeout: 10_000 });
  }).toPass({ timeout: 45_000 });
});

test("students cannot reach the control center or a branch workspace", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").fill("student@papervault.dev");
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByText(/Admin is restricted/i)).toBeVisible();
  await page.goto("/admin/branches/anything");
  await expect(page.getByText(/Admin is restricted/i)).toBeVisible();
});
