import { expect, type Page } from "@playwright/test";

/** User acknowledgment is required before interacting with a modal's background. */
export async function dismissActionPopup(page: Page) {
  const dialog = page.locator("dialog[open]");
  await expect(dialog.getByRole("button", { name: "Dismiss confirmation" })).toBeVisible();
  await dialog.getByRole("button", { name: "Dismiss confirmation" }).click();
  await expect(dialog).toHaveCount(0);
}
