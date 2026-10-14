import { expect, test, type Page } from "@playwright/test";
import { makePdf } from "./fixtures";

const PASSWORD = "papervault123";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
}

/** Fills the upload form. `sessionLabel` decides which exam slot it lands in. */
async function fillUpload(page: Page, sessionLabel: string, file: Buffer, fileName = "sample.pdf") {
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
  await page.locator("#sessionLabel").fill(sessionLabel);
  await page.locator("#file").setInputFiles({
    name: fileName,
    mimeType: "application/pdf",
    buffer: file,
  });
  await page.getByRole("button", { name: /submit paper/i }).click();
}

test("the same file cannot be uploaded twice", async ({ page }) => {
  const marker = `DUP ${Date.now()}`;
  const file = await makePdf(marker);

  await signIn(page, "student@papervault.dev");

  await fillUpload(page, marker, file);
  await expect(page.getByText(/Paper secured/i)).toBeVisible({ timeout: 90_000 });

  // Same bytes, a different exam slot: still refused, because the file itself
  // is already in the archive.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/upload", async (route) => {
    // Header detection is a separate POST; only hold the final upload.
    if (route.request().method() === "POST" && route.request().postData()?.includes("collegeId")) await gate;
    await route.continue();
  });
  await fillUpload(page, `${marker} second slot`, file);
  await expect(page.getByRole("dialog").getByTestId("loading-popup")).toContainText("Uploading and checking your paper");
  await page.screenshot({ path: test.info().outputPath("upload-loading.png") });
  release();
  await expect(page.getByText(/exact file is already in the archive/i)).toBeVisible({
    timeout: 90_000,
  });
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("error-popup")).toContainText(/exact file is already in the archive/i);
  expect(await dialog.evaluate((node) => node.matches(":modal"))).toBe(true);
  await page.screenshot({ path: test.info().outputPath("duplicate-error-popup.png") });
  await dialog.getByRole("button", { name: "Go back and fix" }).click();
  await expect(dialog).toHaveCount(0);
  // An error must not clear the user's selections or chosen file.
  await expect(page.locator("#programId")).not.toHaveValue("");
  await expect(page.locator("#subjectId")).not.toHaveValue("");
  await expect(page.locator("#sessionLabel")).toHaveValue(`${marker} second slot`);
  await expect(page.locator("#file")).not.toHaveValue("");
  await expect(page.locator("form > [role=status]")).toHaveCount(0);

});

test("a re-exported copy of the same paper is refused on its content", async ({ page }) => {
  const marker = `CONTENT ${Date.now()}`;
  await signIn(page, "student@papervault.dev");

  await fillUpload(page, marker, await makePdf(marker));
  await expect(page.getByText(/Paper secured/i)).toBeVisible({ timeout: 90_000 });

  // A fresh PDF build of identical text: different bytes, different hash, same
  // pages. This is the case a file hash alone would let through.
  await fillUpload(page, `${marker} reexport`, await makePdf(marker, { shift: 3 }), "rescanned.pdf");
  await expect(page.getByText(/pages are identical/i)).toBeVisible({ timeout: 90_000 });
});

test("a second paper cannot occupy the same subject, exam, year and set", async ({ page }) => {
  const marker = `SLOT ${Date.now()}`;
  await signIn(page, "student@papervault.dev");

  await fillUpload(page, marker, await makePdf(`${marker} a`));
  await expect(page.getByText(/Paper secured/i)).toBeVisible({ timeout: 90_000 });

  // Genuinely different pages, but the same slot, so the upload is refused and
  // the message explains how to file it as another set.
  await fillUpload(page, marker, await makePdf(`${marker} b`));
  await expect(page.getByText(/already filed under this subject/i)).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText(/Set B or Set C/i)).toBeVisible();
});
