import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { localEnv } from "./env";

const db = new PrismaClient({ datasources: { db: { url: localEnv().DATABASE_URL } } });
test.afterAll(() => db.$disconnect());

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill("student@papervault.dev");
  await page.locator("#password").fill("papervault123");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
}

test("ST, PUT and END-SEM have distinct badge backgrounds", async ({ page }) => {
  const source = await db.paper.findFirstOrThrow({
    where: { status: "PUBLISHED", paperSet: { examSession: { examType: { code: "ST" } } } },
    include: { paperSet: { include: { examSession: { include: { examType: true } } } } },
  });
  const original = source.paperSet.examSession;
  // PUT is custom in the user's catalogue; the standard demo catalogue has no PUT.
  const exam = await db.examType.create({ data: { collegeId: original.examType.collegeId, code: "PUT", name: "Pre-University Test" } });
  const session = await db.examSession.create({ data: {
    subjectId: original.subjectId, examTypeId: exam.id, academicYear: original.academicYear, sessionLabel: `Badge test ${Date.now()}`,
    sets: { create: { label: "Set A", papers: { create: {
      title: "PUT badge regression", uploadedById: source.uploadedById, status: "PUBLISHED", examClassification: "PAST", publishedAt: new Date(),
    } } } },
  } });
  try {
    const colors: string[] = [];
    for (const code of ["ST", "PUT", "END_SEM"]) {
      await page.goto(`/search?q=${code}`);
      const badge = page.locator(".pv-row .pv-chip").filter({ hasText: new RegExp(`^${code.replace("_", "-")}$`) }).first();
      await expect(badge).toBeVisible();
      colors.push(await badge.evaluate((node) => getComputedStyle(node).backgroundColor));
    }
    expect(new Set(colors).size).toBe(3);
    expect(colors).toEqual(["rgb(242, 182, 198)", "rgb(255, 212, 71)", "rgb(157, 214, 243)"]);
  } finally {
    await db.examSession.delete({ where: { id: session.id } });
    await db.examType.delete({ where: { id: exam.id } });
  }
});

for (const width of [390, 1440]) {
  test(`actions use centered loading and completion dialogs at ${width}px`, async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/search?q=RKGIT+DBMS");
    await page.locator('.pv-row a[href^="/papers/"]').first().click();
    await page.waitForLoadState("networkidle");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/papers/*", async (route) => {
      if (route.request().method() === "POST") await gate;
      await route.continue();
    });
    // Start below the top to verify both scroll locking and exact restoration.
    await page.getByRole("button", { name: /^(Save|Saved)$/ }).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 120));
    const initialScroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    await page.getByRole("button", { name: /^(Save|Saved)$/ }).click();
    const modal = page.getByRole("dialog");
    await expect(modal.getByTestId("loading-popup")).toBeVisible();
    await expect(modal).toContainText("Working");
    await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
    const lockedScroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    await page.mouse.move(15, 650);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(200); // allow browser wheel scrolling to settle
    expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual(lockedScroll);
    await expect(modal).toHaveJSProperty("open", true);
    expect(await modal.evaluate((node) => node.matches(":modal"))).toBe(true);
    const bounds = (await modal.boundingBox())!;
    expect(Math.abs(bounds.x + bounds.width / 2 - width / 2)).toBeLessThan(2);
    expect(Math.abs(bounds.y + bounds.height / 2 - 450)).toBeLessThan(2);
    if (width === 1440) await page.screenshot({ path: test.info().outputPath("desktop-loading.png") });
    await page.keyboard.press("Escape");
    await expect(modal.getByTestId("loading-popup")).toBeVisible();
    release();
    await expect(modal.getByTestId("success-popup")).toContainText(/Saved|Removed/);
    await expect(modal.getByRole("button", { name: "Done", exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
    await page.mouse.move(15, 650);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual(lockedScroll);
    if (width === 1440) await page.screenshot({ path: test.info().outputPath("desktop-success.png") });
    await modal.getByRole("button", { name: "Done", exact: true }).click();
    await expect(modal).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden");
    expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual(initialScroll);
    await page.mouse.move(width - 20, 650);
    await page.mouse.wheel(0, 700);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(initialScroll.y);
    await expect(page.getByRole("button", { name: /^(Save|Saved)$/ })).toBeEnabled();
  });
}

test("opening a notification marks only that notification read and updates the bell", async ({ page }) => {
  const user = await db.user.findUniqueOrThrow({ where: { email: "student@papervault.dev" } });
  const title = `Open notification ${Date.now()}`;
  const items = await Promise.all([title, `${title} untouched`].map((t) => db.inboxMessage.create({
    data: { userId: user.id, type: "TEST", title: t, body: "Regression test", href: "/library" },
  })));
  try {
    await signIn(page);
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");
    const message = page.getByTestId("inbox-message").filter({ has: page.getByRole("heading", { name: new RegExp(`^(Unread )?${title}$`) }) });
    await expect(message).toHaveAttribute("data-unread", "true");
    // Merely listing the notification must not mark it read.
    expect((await db.inboxMessage.findUniqueOrThrow({ where: { id: items[0].id } })).readAt).toBeNull();
    await message.getByRole("button", { name: "Open", exact: true }).click();
    await expect(page).toHaveURL(/\/library$/);
    expect((await db.inboxMessage.findUniqueOrThrow({ where: { id: items[0].id } })).readAt).not.toBeNull();
    expect((await db.inboxMessage.findUniqueOrThrow({ where: { id: items[1].id } })).readAt).toBeNull();
    await page.goto("/inbox");
    await expect(message).toHaveAttribute("data-unread", "false");
    await expect(message.getByRole("button", { name: "Mark as read" })).toHaveCount(0);
    const unread = await db.inboxMessage.count({ where: { userId: user.id, readAt: null } });
    await expect(page.getByRole("link", { name: `Notifications, ${unread} unread`, exact: true }).first()).toBeVisible();
  } finally {
    await db.inboxMessage.deleteMany({ where: { id: { in: items.map((item) => item.id) } } });
  }
});

test("phone touch gestures cannot slide the page behind a pop-up", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 740 });
    await page.goto("/colleges");
    await page.waitForLoadState("networkidle");
    const pin = page.getByTestId("pin-college").first();
    await pin.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await pin.tap();
    const modal = page.locator("dialog[open]");
    await expect(modal.getByTestId("success-popup")).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("position", "fixed");
    const top = await page.locator("main").evaluate((node) => node.getBoundingClientRect().top);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 5, y: 650 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 5, y: 400 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 5, y: 150 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(200);
    expect(await page.locator("main").evaluate((node) => node.getBoundingClientRect().top)).toBe(top);
    await modal.getByRole("button", { name: "Done", exact: true }).tap();
    await expect(modal).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveCSS("position", "fixed");
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  } finally { await context.close(); }
});
