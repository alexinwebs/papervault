import { expect, test, type Page } from "@playwright/test";
import { makePdf } from "./fixtures";

const PASSWORD = "papervault123";
const CAMPUS = "/colleges/raj-kumar-goel-institute-of-technology";

async function signOut(page: Page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page.getByRole("link", { name: /^sign in$/i })).toBeVisible();
}

/**
 * Applies a moderation decision. The click is retried because one that lands
 * mid-hydration is swallowed; the URL guard makes the retry idempotent. The
 * outcome is confirmed against the server-rendered status chip after a reload,
 * so the assertion never races an in-flight client transition.
 */
async function applyDecision(page: Page, value: string, expected: string) {
  await expect(async () => {
    if (!page.url().includes(`decided=${expected}`)) {
      await page.getByLabel("Decision").selectOption(value);
      await page.getByRole("button", { name: /apply decision/i }).click({ timeout: 5_000 });
      await expect(page).toHaveURL(new RegExp(`decided=${expected}`), { timeout: 10_000 });
    }
    await page.reload();
    await expect(page.getByTestId("status-chip").first()).toHaveText(
      expected.replace(/_/g, " ").toLowerCase(),
      { timeout: 10_000 },
    );
  }).toPass({ timeout: 60_000 });
}

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
}

test("a student walks the hierarchy to a paper and can download it", async ({ page }) => {
  await page.goto("/");
  await expect(async () => {
    await page.getByRole("link", { name: /search colleges/i }).click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/colleges$/, { timeout: 5_000 });
  }).toPass({ timeout: 30_000 });

  for (const href of [
    CAMPUS,
    `${CAMPUS}/btech`,
    `${CAMPUS}/btech/cse`,
    `${CAMPUS}/btech/cse/semester-5`,
    `${CAMPUS}/btech/cse/semester-5/database-management-systems`,
  ]) {
    // Retry the click: a click that lands mid-hydration can be swallowed. The
    // generous inner timeout covers a cold server render of the next level.
    await page.waitForLoadState("domcontentloaded");
    await expect(async () => {
      await page.locator(`a[href="${href}"]`).first().click({ timeout: 5_000 });
      await expect(page).toHaveURL(new RegExp(`${href}$`), { timeout: 15_000 });
    }).toPass({ timeout: 60_000 });
  }

  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Database Management Systems/i);
  await page.locator('a[href^="/papers/"]').first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Database Management Systems/i);
  await expect(page.getByRole("link", { name: /download/i }).first()).toBeVisible();
});

test("exam-type tabs filter the subject page", async ({ page }) => {
  await page.goto(`${CAMPUS}/btech/cse/semester-5/database-management-systems?exam=ST`);
  await expect(page.getByRole("link", { name: "ST", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("global search resolves a college + subject + exam query", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.locator("#global-search-header").fill("RKGIT DBMS ST");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Results for/i);
  await expect(page.getByRole("heading", { name: /^Papers \(/ })).toBeVisible();
});

test("a missing paper offers a request instead of a dead end", async ({ page }) => {
  await page.goto("/search?q=zzqq-nonexistent-subject");
  await expect(page.getByText(/not in the archive yet/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /i have this paper/i })).toBeVisible();
});

test("restricted papers never expose the file", async ({ page }) => {
  await page.goto("/");
  const response = await page.request.get("/api/files/does-not-exist");
  expect(response.status()).toBe(404);
});

test("students cannot reach moderation or admin routes", async ({ page }) => {
  await signIn(page, "student@papervault.dev");
  await page.goto("/moderation");
  await expect(page.getByText(/Moderation is restricted/i)).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByText(/Admin is restricted/i)).toBeVisible();
});

test("upload → moderation → publish → discoverable", async ({ page }) => {
  const marker = `E2E ${Date.now()}`;

  // 1. A student uploads a past paper.
  await signIn(page, "student@papervault.dev");
  await page.goto("/upload");
  await page.waitForLoadState("networkidle");
  await page.locator("#collegeId").selectOption({ label: "Raj Kumar Goel Institute of Technology, Ghaziabad" });
  await page.locator("#programId").selectOption({ label: "B.Tech" });
  await page.locator("#branchId").selectOption({ label: "Computer Science & Engineering" });
  await page.locator("#semesterId").selectOption({ label: "Semester 5" });
  await page.locator("#subjectId").selectOption({ index: 1 });
  await page.locator("#examTypeId").selectOption({ index: 1 });
  await page.locator("#academicYear").selectOption({ index: 3 });
  await page.locator("#examClassification").selectOption("PAST");
  await page.locator("#sessionLabel").fill(marker);
  await page.locator("#file").setInputFiles({
    name: "sample.pdf",
    mimeType: "application/pdf",
    buffer: await makePdf(marker),
  });
  await page.getByRole("button", { name: /submit paper/i }).click();
  // Ingest hashes, sanitises and scans the PDF, so allow a generous window.
  await expect(page.getByText(/Paper secured/i)).toBeVisible({ timeout: 90_000 });

  // 2. It is queued, not published.
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: /My uploads/i })).toBeVisible();
  await expect(page.getByText(/pending review/i).first()).toBeVisible();

  // 3. A moderator from the same college reviews it.
  await signOut(page);
  await signIn(page, "moderator@papervault.dev");
  await page.goto("/moderation?status=PENDING_REVIEW");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: /review queue/i })).toBeVisible();
  // Retry: a click that lands mid-hydration can be swallowed.
  await expect(async () => {
    await page.getByRole("link", { name: /^Review$/ }).first().click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/moderation\/[a-z0-9]+/, { timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Decision")).toBeVisible();

  await applyDecision(page, "APPROVE", "APPROVED");

  await page.reload();
  await page.waitForLoadState("networkidle");
  await applyDecision(page, "PUBLISH", "PUBLISHED");

  // 4. The published paper is visible to everyone, with its file.
  const paperUrl = page.url().replace("/moderation/", "/papers/").split("?")[0];
  await signOut(page);
  await page.goto(paperUrl);
  await expect(page.getByRole("link", { name: /download/i }).first()).toBeVisible();
});
