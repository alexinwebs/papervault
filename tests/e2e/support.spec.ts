import { expect, test, type Browser, type Page } from "@playwright/test";

const PASSWORD = "papervault123";
// A real 1x1 PNG, standing in for a staff ID card.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
}

async function asUser(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Admin decisions ask window.confirm() before submitting.
  page.on("dialog", (dialog) => void dialog.accept());
  await signIn(page, email);
  return { page, close: () => context.close() };
}

test("a member opens a ticket; the admin's reply reaches them but the internal note never does", async ({ browser }) => {
  const marker = `E2E ticket ${Date.now()}`;
  const member = await asUser(browser, "priya@papervault.dev");
  await member.page.goto("/support");
  await member.page.waitForLoadState("networkidle");
  await member.page.locator("#category").selectOption("TECHNICAL");
  await member.page.locator("#subject").fill(marker);
  await member.page.locator("#body").fill("The PDF viewer shows a blank page on my phone for one paper.");
  await member.page.getByTestId("create-ticket").click();
  await expect(member.page).toHaveURL(/\/my-tickets\/[a-z0-9]+\?created=1/, { timeout: 30_000 });
  await expect(member.page.getByTestId("ticket-created")).toContainText(/PV-\d{4}-\d{6}/);
  const ticketUrl = member.page.url().replace("?created=1", "");

  const admin = await asUser(browser, "admin@papervault.dev");
  await admin.page.goto("/admin/tickets");
  await admin.page.getByTestId("admin-ticket-list").getByRole("link", { name: new RegExp(marker) }).click();
  await expect(admin.page.getByTestId("admin-ticket-thread")).toContainText("blank page");

  await admin.page.locator("#admin-note-body").fill(`secret-note ${marker}`);
  await admin.page.getByTestId("admin-note").getByRole("button", { name: /add internal note/i }).click();
  await expect(admin.page.locator('[data-internal="1"]').filter({ hasText: "secret-note" })).toBeVisible();

  await admin.page.locator("#admin-reply-body").fill(`public-reply ${marker}`);
  await admin.page.getByTestId("admin-reply").getByRole("button", { name: /send reply/i }).click();
  await expect(admin.page.getByTestId("admin-ticket-thread")).toContainText("public-reply");

  await member.page.goto(ticketUrl);
  const thread = member.page.getByTestId("ticket-thread");
  await expect(thread).toContainText("public-reply");
  await expect(thread).not.toContainText("secret-note");
  await expect(member.page.getByText("secret-note")).toHaveCount(0);

  await member.page.locator("#reply-body").fill("Thanks — clearing the cache fixed it.");
  await member.page.getByTestId("ticket-reply").getByRole("button", { name: /send reply/i }).click();
  await expect(thread).toContainText("clearing the cache");

  await member.page.goto("/my-tickets");
  await expect(member.page.getByTestId("my-tickets")).toContainText(marker);
  await member.close();
  await admin.close();
});

test("another member cannot open someone else's ticket", async ({ browser }) => {
  const owner = await asUser(browser, "aditya@papervault.dev");
  await owner.page.goto("/support");
  await owner.page.waitForLoadState("networkidle");
  await owner.page.locator("#category").selectOption("GENERAL");
  await owner.page.locator("#subject").fill(`Private ${Date.now()}`);
  await owner.page.locator("#body").fill("Only the team and I should be able to read this.");
  await owner.page.getByTestId("create-ticket").click();
  await expect(owner.page).toHaveURL(/\/my-tickets\/[a-z0-9]+/, { timeout: 30_000 });
  const url = owner.page.url().replace("?created=1", "");

  const other = await asUser(browser, "sameer@papervault.dev");
  const res = await other.page.goto(url);
  expect(res?.status()).toBe(404);
  await owner.close();
  await other.close();
});

test("a college request becomes a real college when an admin approves it", async ({ browser }) => {
  const name = `Test Institute of Engineering ${Date.now()}`;
  const member = await asUser(browser, "ananya@papervault.dev");
  await member.page.goto("/support?category=ADD_COLLEGE");
  await member.page.waitForLoadState("networkidle");
  await member.page.locator("#category").selectOption("ADD_COLLEGE");
  await expect(member.page.getByTestId("college-fields")).toBeVisible();
  await member.page.locator("#collegeName").fill(name);
  await member.page.locator("#collegeUniversity").fill("Test University");
  await member.page.locator("#collegeCity").fill("Nagpur");
  await member.page.locator("#collegeState").fill("Maharashtra");
  await member.page.locator("#subject").fill(`Please add ${name}`);
  await member.page.locator("#body").fill("My college isn't listed yet; I have papers to upload.");
  await member.page.getByTestId("create-ticket").click();
  await expect(member.page).toHaveURL(/\/my-tickets\/[a-z0-9]+/, { timeout: 30_000 });
  const ticketUrl = member.page.url().replace("?created=1", "");

  const admin = await asUser(browser, "admin@papervault.dev");
  await admin.page.goto("/admin/requests");
  const form = admin.page.locator('[data-testid^="college-request-"]').filter({ has: admin.page.locator(`input[value="${name}"]`) });
  await expect(form).toBeVisible();
  await form.getByRole("button", { name: /save decision/i }).click();
  await expect(form).toHaveCount(0, { timeout: 20_000 });

  await member.page.goto(ticketUrl);
  await expect(member.page.getByTestId("ticket-thread")).toContainText("has been added to PaperVault");
  await member.page.goto(`/search?q=${encodeURIComponent(name)}`);
  await expect(member.page.getByText(name).first()).toBeVisible();
  await member.close();
  await admin.close();
});

test("a teacher applies, an admin approves, and the badge appears", async ({ browser }) => {
  const applicant = await asUser(browser, "sameer@papervault.dev");
  await applicant.page.goto("/teacher-verification");
  await applicant.page.waitForLoadState("networkidle");
  if (await applicant.page.getByTestId("teacher-closed").isVisible()) {
    // TEACHER_VERIFICATION_ENABLED=false on this server: the closed notice
    // replaces the form. Check that, then skip the approval flow.
    await expect(applicant.page.locator("#fullName")).toHaveCount(0);
    await applicant.close();
    test.skip(true, "TEACHER_VERIFICATION_ENABLED=false: applications are closed on this server");
    return;
  }
  const fullName = `Dr Sameer Test ${Date.now()}`;
  await applicant.page.locator("#fullName").fill(fullName);
  await applicant.page.locator("#institutionName").fill("Test Institute of Technology");
  await applicant.page.locator("#department").fill("Computer Science");
  await applicant.page.locator("#designation").fill("Assistant Professor");
  await applicant.page.locator("#subjectsTaught").fill("DBMS, Operating Systems");
  await applicant.page.locator('input[type="file"][name="documents"]').setInputFiles({ name: "staff-id.png", mimeType: "image/png", buffer: PNG });
  await applicant.page.locator('input[name="attest"]').check();
  await applicant.page.getByTestId("teacher-submit").click();
  await expect(applicant.page.getByTestId("teacher-status").or(applicant.page.getByTestId("teacher-submitted"))).toBeVisible({ timeout: 30_000 });

  const admin = await asUser(browser, "admin@papervault.dev");
  await admin.page.goto("/admin/teacher-verifications");
  await admin.page.getByTestId("teacher-verification-list").getByRole("link", { name: fullName }).click();
  await expect(admin.page.getByTestId("tv-documents")).toContainText("staff-id");
  const approve = admin.page.getByTestId("tv-approve");
  const button = approve.getByRole("button", { name: /approve teacher/i });
  await expect(button).toBeDisabled();
  await admin.page.locator("#tv-approve-confirm").fill("APPROVE");
  await button.click();
  await expect(admin.page.getByTestId("tv-approve")).toHaveCount(0, { timeout: 20_000 });

  await applicant.page.goto("/teacher-verification");
  await expect(applicant.page.getByTestId("teacher-approved")).toBeVisible();
  await applicant.close();
  await admin.close();
});

test("a member can report another member and the report reaches the admin queue", async ({ browser }) => {
  const reporter = await asUser(browser, "raj@papervault.dev");
  await reporter.page.goto("/statistics");
  const hrefs = await reporter.page.locator('a[href^="/contributors/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  let reported = "";
  for (const href of hrefs) {
    if (!href) continue;
    await reporter.page.goto(href);
    const button = reporter.page.getByRole("button", { name: /report member/i });
    if ((await button.count()) === 0) continue;
    reported = (await reporter.page.getByRole("heading", { level: 1 }).textContent())?.trim() ?? "";
    await button.click();
    const dialog = reporter.page.getByRole("dialog");
    await dialog.locator("select").selectOption("SPAM");
    await dialog.locator("textarea").fill("Posting the same link under every paper.");
    await dialog.getByRole("button", { name: /send report/i }).click();
    await expect(dialog.getByRole("status")).toBeVisible();
    break;
  }
  expect(reported).not.toBe("");

  const admin = await asUser(browser, "admin@papervault.dev");
  await admin.page.goto("/admin/reports?tab=users");
  await expect(admin.page.getByTestId("user-reports")).toContainText("Spam");
  await reporter.close();
  await admin.close();
});

test("the new policy pages render", async ({ page }) => {
  for (const [path, heading] of [
    ["/legal/guidelines", /Community Guidelines/],
    ["/legal/academic-integrity", /Academic Integrity Policy/],
    ["/legal/report-content", /Report Content/],
    ["/legal/teacher-verification", /Teacher Verification Policy/],
    ["/legal/data-rights", /Data Rights/],
    ["/legal/contact", /Contact/],
  ] as const) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
});

test("the admin workspaces load for admins and are closed to everyone else", async ({ browser }) => {
  const admin = await asUser(browser, "admin@papervault.dev");
  for (const path of ["/admin/tickets", "/admin/requests", "/admin/reports", "/admin/teacher-verifications", "/admin/audit", "/admin/settings"]) {
    const res = await admin.page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(admin.page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await admin.page.goto("/admin");
  await expect(admin.page.getByTestId("needs-attention")).toBeVisible();
  await admin.close();

  const student = await asUser(browser, "student@papervault.dev");
  for (const path of ["/admin/tickets", "/admin/teacher-verifications", "/admin/audit"]) {
    await student.page.goto(path);
    await expect(student.page.getByTestId("admin-ticket-list")).toHaveCount(0);
    await expect(student.page.getByTestId("audit-table")).toHaveCount(0);
    await expect(student.page.getByText(/Admin is restricted/i)).toBeVisible();
  }
  await student.close();
});

test("the coffee page shows the UPI QR, the ID and a pay link", async ({ page }) => {
  const res = await page.goto("/coffee");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Buy me a coffee/);
  await expect(page.getByTestId("upi-id")).toHaveText("youralexhere-2@oksbi");
  await expect(page.getByRole("img", { name: /UPI QR code/ })).toBeVisible();
  await expect(page.getByTestId("upi-pay")).toHaveAttribute("href", /^upi:\/\/pay\?pa=youralexhere-2%40oksbi/);
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Buy me a coffee" })).toBeVisible();
});
