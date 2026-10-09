import { localEnv } from "./env";
import { expect, test } from "@playwright/test";

const PASSWORD = "papervault123";

test("every server-rendered script carries the per-request CSP nonce", async ({ page }) => {
  const violations: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as unknown as { __cspViolations: string[] }).__cspViolations ??= [];
      (window as unknown as { __cspViolations: string[] }).__cspViolations.push(
        `${event.violatedDirective}:${event.blockedURI}`,
      );
    });
  });

  const response = await page.goto("/");
  const csp = response?.headers()["content-security-policy"] ?? "";

  // The whole point of the nonce is that inline script is no longer blanket-allowed.
  const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
  expect(scriptSrc).not.toContain("'unsafe-inline'");
  expect(scriptSrc).toMatch(/'nonce-[^']+'/);
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).toContain("frame-ancestors 'self'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain("form-action 'self'");

  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1] as string;

  // Every script in the delivered HTML must be nonced. Chunk loaders that the
  // framework creates at runtime are covered by 'strict-dynamic' instead, so
  // the live DOM is the wrong thing to assert on.
  const html = (await response?.text()) ?? "";
  const tags = html.match(/<script\b[^>]*>/g) ?? [];
  expect(tags.length).toBeGreaterThan(0);
  expect(tags.filter((tag) => !tag.includes(`nonce="${nonce}"`))).toEqual([]);

  // And the policy must not actually be blocking anything the app needs.
  await page.waitForLoadState("networkidle");
  violations.push(
    ...(await page.evaluate(
      () => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? [],
    )),
  );
  expect(violations).toEqual([]);
});

test("the nonce is different on every request", async ({ page }) => {
  const first = (await page.goto("/"))?.headers()["content-security-policy"] ?? "";
  const second = (await page.goto("/colleges"))?.headers()["content-security-policy"] ?? "";
  expect(/'nonce-([^']+)'/.exec(first)?.[1]).not.toBe(/'nonce-([^']+)'/.exec(second)?.[1]);
});

test("a cross-origin POST is refused", async ({ request, baseURL }) => {
  const response = await request.post(`${baseURL}/login`, {
    headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    form: { email: "student@papervault.dev", password: PASSWORD },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(403);
  expect(await response.text()).toContain("Cross-origin request blocked");
});

test("the maintenance endpoint needs the shared secret", async ({ request, baseURL }) => {
  await expect
    .poll(async () => (await request.post(`${baseURL}/api/cron/purge`)).status())
    .toBe(401);

  const wrong = await request.post(`${baseURL}/api/cron/purge`, {
    headers: { authorization: "Bearer not-the-secret" },
  });
  expect(wrong.status()).toBe(401);

  const right = await request.post(`${baseURL}/api/cron/purge`, {
    headers: { authorization: `Bearer ${localEnv().CRON_SECRET}` },
  });
  expect(right.status()).toBe(200);
  expect(await right.json()).toMatchObject({
    purgedPapers: expect.any(Number),
    purgedTokens: expect.any(Number),
    retriedEmails: expect.any(Number),
  });
});

test("the uploaded-file route is served with the strictest policy", async ({ request, baseURL }) => {
  const response = await request.get(`${baseURL}/api/files/does-not-exist`, {
    maxRedirects: 0,
  });
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
});

test("a disclosure contact is published at the well-known path", async ({ request, baseURL }) => {
  const response = await request.get(`${baseURL}/.well-known/security.txt`);
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Contact:");
});

test("the admin tables page instead of rendering every row", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill("admin@papervault.dev");
  await page.locator("#password").fill(PASSWORD);
  // Retry only the submit, guarded by the URL: under a loaded parallel run the
  // very first click can land before the form is interactive.
  await expect(async () => {
    if (new URL(page.url()).pathname === "/login") {
      await page.getByRole("button", { name: /^sign in$/i }).click({ timeout: 10_000 });
    }
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
  }).toPass({ timeout: 60_000 });

  await page.goto("/admin/papers");
  await page.waitForLoadState("networkidle");

  // The seed holds ~900 papers, so page one must be a slice, not the lot.
  await expect(page.getByTestId("pagination-summary")).toContainText(/of \d{3,} papers/);
  await expect(page.getByTestId("pagination-position")).toContainText("Page 1 of");
  const firstPageRows = await page.locator("main ul > li").count();
  expect(firstPageRows).toBeLessThanOrEqual(40);

  // Retry only the click, guarded by the URL: a nav that has not happened yet
  // is the flake, not the assertion.
  await expect(async () => {
    if (!/page=2/.test(page.url())) {
      await page.getByRole("link", { name: /^next$/i }).click({ timeout: 5_000 });
    }
    expect(page.url()).toMatch(/page=2/);
  }).toPass({ timeout: 30_000 });
  await expect(page.getByTestId("pagination-position")).toContainText("Page 2 of");

  // Members are paged with the same control.
  await page.goto("/admin/users");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("pagination-summary")).toContainText(/of \d+ accounts/);
});
