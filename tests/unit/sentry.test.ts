import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/node";
import { scrubEvent } from "@/lib/sentry";

describe("Sentry scrubbing", () => {
  it("removes cookies, credentials, query strings and email addresses", () => {
    const event = scrubEvent({
      type: undefined,
      message: "failed for alice@example.org",
      request: {
        url: "https://x.test/search?q=alice@example.org",
        query_string: "q=alice@example.org",
        cookies: { pv_session: "secret" },
        headers: { cookie: "pv_session=secret", authorization: "Bearer t", "user-agent": "ua" },
        data: { password: "hunter2" },
      },
      user: { id: "u1", email: "alice@example.org", ip_address: "1.2.3.4" },
      extra: { token: "abc", note: "mail bob@example.org" },
      exception: { values: [{ type: "Error", value: "no user bob@example.org" }] },
      breadcrumbs: [{ data: { url: "/reset?token=abc" } }],
    } as ErrorEvent);
    const json = JSON.stringify(event);
    for (const leaked of ["alice@example.org", "bob@example.org", "secret", "hunter2", "Bearer t", "1.2.3.4", "token=abc"]) {
      expect(json).not.toContain(leaked);
    }
    expect(event.user).toEqual({ id: "u1" });
    expect(event.request?.url).toBe("https://x.test/search");
  });
});
