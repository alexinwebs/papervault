import { dismissActionPopup } from "./popups";
import { expect, test, type Page } from "@playwright/test";
import { makePdf } from "./fixtures";

const PASSWORD = "papervault123";

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill("admin@papervault.dev");
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
}

test("the admin sees every college with RKGIT pinned first", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/colleges");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: /^Colleges$/ })).toBeVisible();

  const names = page.locator('a[href^="/admin/colleges/"]');
  await expect(names.first()).toContainText(/Raj Kumar Goel Institute of Technology/i);
  expect(await names.count()).toBeGreaterThanOrEqual(15);
  await expect(page.getByText("home campus").first()).toBeVisible();
});

test("an admin can add a college and then delete it", async ({ page }) => {
  const stamp = Date.now();
  const name = `E2E Institute of Technology ${stamp}`;

  await signInAsAdmin(page);
  await page.goto("/admin/colleges");
  await page.waitForLoadState("networkidle");

  await page.locator("#new-college-name").fill(name);
  await page.locator("#new-college-shortName").fill(`E2E${stamp % 1000}`);
  await page.locator("#new-college-city").fill("Ghaziabad");
  await page.locator("#new-college-state").fill("Uttar Pradesh");
  await page.locator("#new-college-university").fill("Dr. A.P.J. Abdul Kalam Technical University");

  // The action navigates on success, so retry the click only while the button
  // is still there and then assert the landing page.
  const addButton = page.getByRole("button", { name: /add college/i });
  await expect(async () => {
    if (await addButton.count()) await addButton.click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/admin\/colleges\?added=/, { timeout: 15_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByText(new RegExp(`E2E${stamp % 1000} added`, "i"))).toBeVisible();

  await dismissActionPopup(page);

  // The new college is listed, and its default exam types were created.
  const row = page.getByRole("link", { name });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
  await expect(page.getByText("MID_SEM · Mid-Sem")).toBeVisible();

  // Delete it again from the list.
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/admin/colleges");
  await page.waitForLoadState("networkidle");
  const deleteButton = page
    .locator("li")
    .filter({ hasText: name })
    .getByRole("button", { name: /^delete$/i });
  await expect(async () => {
    if (await deleteButton.count()) await deleteButton.click({ timeout: 5_000 });
    await expect(deleteButton).toHaveCount(0, { timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
  // Assert the persisted state rather than the post-action client transition.
  // The row can disappear optimistically before the action commits, so a
  // single reload may race it; reload until the server agrees.
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("link", { name })).toHaveCount(0, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
});

test("an upload records an approval-request email for the admins", async ({ page }) => {
  // Upload first so the outbox has something to show regardless of test order.
  const marker = `OUTBOX ${Date.now()}`;
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill("student@papervault.dev");
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

  await page.goto("/upload");
  await page.waitForLoadState("networkidle");
  await page
    .locator("#collegeId")
    .selectOption({ label: "Raj Kumar Goel Institute of Technology, Ghaziabad" });
  await page.locator("#programId").selectOption({ label: "B.Tech" });
  await page.locator("#branchId").selectOption({ label: "Computer Science & Engineering" });
  await page.locator("#semesterId").selectOption({ label: "Semester 5" });
  await page.locator("#subjectId").selectOption({ index: 1 });
  await page.locator("#examTypeId").selectOption({ index: 1 });
  await page.locator("#academicYear").selectOption({ index: 3 });
  await page.locator("#examClassification").selectOption("PAST");
  await page.getByTestId("more-details").locator("summary").click();
  await page.locator("#sessionLabel").fill(marker);
  await page.locator("#file").setInputFiles({
    name: "outbox.pdf",
    mimeType: "application/pdf",
    buffer: await makePdf(marker),
  });
  await page.getByRole("button", { name: /submit paper/i }).click();
  // Ingest hashes, sanitises and scans the PDF, so allow a generous window.
  await expect(page.getByText(/Paper secured/i)).toBeVisible({ timeout: 90_000 });
  await dismissActionPopup(page);
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page.getByRole("link", { name: /^sign in$/i })).toBeVisible();

  await signInAsAdmin(page);
  await page.goto("/admin/notifications");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: /email outbox/i })).toBeVisible();
  await expect(page.getByText(/paper\.submitted/).first()).toBeVisible();
  await expect(page.getByText(/approval needed/i).first()).toBeVisible();
});

test("a student cannot reach the admin management screens", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill("student@papervault.dev");
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

  for (const path of ["/admin/colleges", "/admin/papers", "/admin/users", "/admin/notifications"]) {
    await page.goto(path);
    await expect(page.getByText(/Admin is restricted/i)).toBeVisible();
  }
});
