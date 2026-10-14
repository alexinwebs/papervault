import { dismissActionPopup } from "./popups";
import { expect, test, type Page } from "@playwright/test";
import { makePdf } from "./fixtures";

/** One paper, several branches: a CSE upload also listed under IT and DS. */
const PASSWORD = "papervault123";
const SUBJECT = /Constitution of India, Law and Engineering/;

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
}

test("a paper can be listed under several branches", async ({ page }) => {
  const marker = `Multi ${Date.now()}`;
  await signIn(page, "student@papervault.dev");
  await page.goto("/upload");
  await page.waitForLoadState("networkidle");
  await page.locator("#collegeId").selectOption({ label: "Raj Kumar Goel Institute of Technology, Ghaziabad" });
  await page.locator("#programId").selectOption({ label: "B.Tech" });
  await page.locator("#branchId").selectOption({ label: "Computer Science & Engineering" });
  await page.locator("#semesterId").selectOption({ label: "Semester 5" });
  const option = page.locator("#subjectId option", { hasText: SUBJECT });
  await page.locator("#subjectId").selectOption(await option.getAttribute("value"));

  await page.getByTestId("more-details").locator("summary").click();
  const also = page.getByTestId("also-branches");
  await expect(also).toBeVisible();
  await also.getByRole("checkbox", { name: /Information Technology/ }).check();
  await also.getByRole("checkbox", { name: /Data Science/ }).check();

  await page.locator("#examTypeId").selectOption({ index: 1 });
  await page.locator("#academicYear").selectOption({ index: 2 });
  await page.locator("#examClassification").selectOption("PAST");
  await page.locator("#sessionLabel").fill(marker);
  await page.locator("#file").setInputFiles({ name: "multi.pdf", mimeType: "application/pdf", buffer: await makePdf(marker) });
  await page.getByRole("button", { name: /submit paper/i }).click();
  await expect(page.getByText(/Paper secured/i)).toBeVisible({ timeout: 90_000 });

  const href = await page.getByTestId("uploaded-paper-link").getAttribute("href");
  const paperId = href!.split("/").pop()!;

  await dismissActionPopup(page);
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page.getByRole("link", { name: /^sign in$/i })).toBeVisible();
  await signIn(page, "moderator@papervault.dev");
  await page.goto(`/moderation/${paperId}`);
  await page.waitForLoadState("networkidle");
  const panel = page.getByTestId("listings-panel");
  await expect(panel.getByRole("checkbox", { name: /^IT/ })).toBeChecked();
  await expect(panel.getByRole("checkbox", { name: /^DS/ })).toBeChecked();
  await expect(panel.getByRole("checkbox", { name: /^ME/ })).not.toBeChecked();

  // A moderator can correct the branches later.
  await expect(async () => {
    await page.reload();
    await panel.getByRole("checkbox", { name: /^DS/ }).uncheck();
    await panel.getByRole("button", { name: /save branches/i }).click({ timeout: 5_000 });
    await page.waitForTimeout(500);
    await page.reload();
    await expect(panel.getByRole("checkbox", { name: /^DS/ })).not.toBeChecked({ timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
  await expect(panel.getByRole("checkbox", { name: /^IT/ })).toBeChecked();

  // The paper page names the other branches.
  await page.goto(`/papers/${paperId}`);
  await expect(page.getByTestId("also-for")).toContainText("IT");
  await expect(page.getByTestId("also-for")).not.toContainText("DS");
});
