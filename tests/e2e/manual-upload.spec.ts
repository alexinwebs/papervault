import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { localEnv } from "./env";
import { makePdf } from "./fixtures";
import { dismissActionPopup } from "./popups";
const db = new PrismaClient({ datasources: { db: { url: localEnv().DATABASE_URL } } });
async function signIn(page: Page) {
  await page.goto("/login"); await page.waitForLoadState("networkidle");
  await page.locator("#email").fill("student@papervault.dev"); await page.locator("#password").fill("papervault123");
  await page.getByRole("button", { name: /^sign in$/i }).click(); await expect(page).toHaveURL(/\/$/);
  await page.goto("/upload"); await page.waitForLoadState("networkidle");
}
for (const width of [1280, 390]) test(`simple manual entry creates missing groups and rejects duplicates at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await signIn(page);
  let detectionRequests = 0;
  page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith("/api/papers/detect")) detectionRequests++; });
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const name = `Manual ${Date.now()} ${width} College`; const bytes = await makePdf(name);
  try {
    await expect(page.getByTestId("more-details")).not.toHaveAttribute("open", "");
    await page.screenshot({ path: test.info().outputPath("manual-empty.png"), fullPage: true });
    await expect(page.locator("#detected-branchCode")).not.toBeVisible(); await expect(page.locator("#notes")).not.toBeVisible();
    await expect(page.locator("#automatic-primary-branch")).toHaveCount(0);
    await page.locator("#file").setInputFiles({ name: "manual.pdf", mimeType: "application/pdf", buffer: bytes });
    await page.locator("#detected-collegeName").fill(name); await page.locator("#detected-programName").selectOption("B.Tech");
    await page.locator("#detected-branchName").fill("Internet of Things"); await page.locator("#detected-semesterNumber").selectOption("5");
    await page.locator("#detected-subjectName").fill("Manual Algorithms"); await page.locator("#detected-subjectCode").fill("MAN501");
    await page.locator("#examTypeId").selectOption("END_SEM"); await page.locator("#academicYear").selectOption("2024");
    await page.locator("#examClassification").selectOption("PAST"); await page.getByLabel("I checked these details against the paper.").check();
    await expect(page.getByTestId("loading-popup")).toHaveCount(0); await expect(page.locator("#detected-branchCode")).toHaveValue("IOT");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: test.info().outputPath("simple-manual-form.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: /submit paper/i }).click(); await expect(page.getByTestId("success-popup")).toBeVisible(); await dismissActionPopup(page);
    const college = await db.college.findFirstOrThrow({ where: { name }, include: { programs: { include: { branches: { include: { semesters: { include: { subjects: true } } } } } } } });
    expect(college.verified).toBe(false); expect(college.programs[0].branches[0].name).toBe("Internet of Things"); expect(college.programs[0].branches[0].semesters[0].subjects[0].code).toBe("MAN501");
    const saved = await db.paper.findFirstOrThrow({ where: { paperSet: { examSession: { subject: { semester: { branch: { program: { collegeId: college.id } } } } } } } }); expect(saved.status).toBe("PENDING_REVIEW");
    expect(detectionRequests).toBe(0);
    await page.getByRole("button", { name: /submit paper/i }).click(); await expect(page.getByTestId("error-popup")).toContainText(/already in the archive/i); await dismissActionPopup(page);
    await expect(page.locator("#detected-collegeName")).toHaveValue(name);
  } finally { await db.paper.deleteMany({ where: { paperSet: { examSession: { subject: { semester: { branch: { program: { college: { name } } } } } } } } }); await db.college.deleteMany({ where: { name } }); }
});
test("switching to manual mode cancels a pending detection result", async ({ page }) => {
  await signIn(page); let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
  let requested!: () => void; const started = new Promise<void>((resolve) => { requested = resolve; });
  await page.route("**/api/papers/detect", async (route) => { if (route.request().method() === "POST") { requested(); await gate; } await route.continue(); });
  try {
    await page.locator("#file").setInputFiles({ name: "pending.pdf", mimeType: "application/pdf", buffer: await makePdf("pending detection") });
    await started; await expect(page.getByTestId("detection-progress")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", {name: "Enter manually", exact: true}).click();
    await expect(page.getByTestId("loading-popup")).toHaveCount(0); await page.locator("#detected-collegeName").fill("Keep My Manual College");
    release(); await page.waitForLoadState("networkidle");
    await expect(page.locator("#detected-collegeName")).toHaveValue("Keep My Manual College"); await expect(page.getByRole("button", { name: "Enter manually", exact: true })).toHaveAttribute("aria-pressed", "true");
  } finally { release(); }
});
test.afterAll(async () => { await db.$disconnect(); });

test("optional details expand without losing the core form", async ({ page }) => {
  await signIn(page); await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  await page.getByTestId("more-details").locator("summary").click(); await expect(page.locator("#notes")).toBeVisible(); await expect(page.locator("#detected-branchCode")).toBeVisible();
  await page.locator("#sessionLabel").fill("ST-2 · 2025-26"); await page.getByTestId("more-details").locator("summary").click();
  await expect(page.locator("#notes")).not.toBeVisible(); await expect(page.getByText("ST-2 · 2025-26", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click(); await expect(page.locator("#sessionLabel")).toBeFocused(); await expect(page.locator("#sessionLabel")).toHaveValue("ST-2 · 2025-26");
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: test.info().outputPath("manual-expanded.png"), fullPage: true });
});
