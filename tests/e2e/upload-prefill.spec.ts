import { expect, test } from "@playwright/test";

/** "I have this paper" / "Contribute a paper" open the upload form already filled in. */
const PASSWORD = "papervault123";
const SUBJECT = "/colleges/raj-kumar-goel-institute-of-technology/btech/cse/semester-5/compiler-design";

test("the upload form is pre-filled from the subject page and stays editable", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill("student@papervault.dev");
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

  await page.goto(`${SUBJECT}?exam=END_SEM`);
  await page.getByTestId("contribute-link").click();
  await expect(page).toHaveURL(/\/upload\?subject=.+examType=END_SEM/);
  await page.waitForLoadState("networkidle");

  await expect(page.getByTestId("upload-prefill")).toContainText("Compiler Design");
  await expect(page.locator("#collegeId option:checked")).toHaveText(/Raj Kumar Goel/);
  await expect(page.locator("#programId option:checked")).toHaveText("B.Tech");
  await expect(page.locator("#branchId option:checked")).toHaveText(/Computer Science/);
  await expect(page.locator("#semesterId option:checked")).toHaveText("Semester 5");
  await expect(page.locator("#subjectId option:checked")).toHaveText(/Compiler Design/);
  await expect(page.locator("#examTypeId option:checked")).toHaveText(/End/i);

  // Every field can still be changed before submitting.
  await page.locator("#subjectId").selectOption({ index: 2 });
  await expect(page.locator("#subjectId option:checked")).not.toHaveText(/Compiler Design/);
  await page.locator("#semesterId").selectOption({ label: "Semester 3" });
  await expect(page.locator("#subjectId")).toHaveValue("");
});

test("signed-out visitors keep the pre-filled link through sign-in", async ({ page }) => {
  await page.goto(`${SUBJECT}?exam=END_SEM`);
  await page.getByTestId("contribute-link").click();
  await expect(page.getByRole("link", { name: /^sign in$/i }).last()).toHaveAttribute(
    "href",
    /next=%2Fupload%3Fsubject%3D/,
  );
});

test('"I have this paper" carries the subject and requested year into editable fields', async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill("student@papervault.dev");
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
  // An absent exam slot exercises the missing-paper CTA rather than the generic contribute button.
  await page.goto(`${SUBJECT}?exam=ABSENT_TEST_SLOT`);
  const link = page.getByTestId("have-paper-link");
  await expect(link).toBeVisible();
  const target = new URL((await link.getAttribute("href"))!, "http://localhost:3000");
  const requestedYear = target.searchParams.get("year")!;
  await link.click();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#subjectId option:checked")).toHaveText(/Compiler Design/);
  await expect(page.locator("#academicYear")).toHaveValue(requestedYear);
  await page.locator("#academicYear").selectOption({ index: 2 });
  await expect(page.locator("#academicYear")).not.toHaveValue(requestedYear);
  await page.locator("#examTypeId").selectOption({ index: 1 });
  await expect(page.locator("#examTypeId")).not.toHaveValue("");
});
