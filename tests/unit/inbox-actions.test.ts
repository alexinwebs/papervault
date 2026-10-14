import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(), findFirst: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn(),
  revalidatePath: vi.fn(), redirect: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db", () => ({ prisma: { inboxMessage: { findFirst: mocks.findFirst } } }));
vi.mock("@/server/services/inbox", () => ({ markRead: mocks.markRead, markAllRead: mocks.markAllRead }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/actions/types", () => ({ run: (fn: () => unknown) => fn() }));
import { openInboxMessageAction } from "@/server/actions/inbox";

const actor = { id: "my-user" };
function data() { const fd = new FormData(); fd.set("id", "notification-1"); fd.set("href", "https://evil.test"); return fd; }
beforeEach(() => { vi.clearAllMocks(); mocks.requireUser.mockResolvedValue(actor); });
describe("open notification", () => {
  it("scopes lookup to the current user and marks read before redirecting to the stored destination", async () => {
    mocks.findFirst.mockResolvedValue({ href: "/papers/abc" });
    await openInboxMessageAction({ ok: false }, data());
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: "notification-1", userId: "my-user" } });
    expect(mocks.markRead).toHaveBeenCalledWith(actor, "notification-1");
    expect(mocks.redirect).toHaveBeenCalledWith("/papers/abc");
    expect(mocks.markRead.mock.invocationCallOrder[0]).toBeLessThan(mocks.redirect.mock.invocationCallOrder[0]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
  it("does not read or navigate someone else's notification", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect((await openInboxMessageAction({ ok: false }, data())).ok).toBe(false);
    expect(mocks.markRead).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it.each([null, "https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)"])("refuses invalid destination %s", async (href) => {
    mocks.findFirst.mockResolvedValue({ href });
    expect((await openInboxMessageAction({ ok: false }, data())).ok).toBe(false);
    expect(mocks.markRead).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
