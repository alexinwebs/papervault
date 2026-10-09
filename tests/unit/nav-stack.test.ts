import { describe, expect, it } from "vitest";
import { NAV_STACK_MAX, canGoBack, isAuthPath, nextNavStack } from "@/lib/nav-stack";

describe("nextNavStack", () => {
  it("starts with the first page", () => {
    expect(nextNavStack([], "/a")).toEqual(["/a"]);
  });
  it("pushes new pages, keeping the query string distinct", () => {
    expect(nextNavStack(["/search?q=dbms"], "/papers/1")).toEqual(["/search?q=dbms", "/papers/1"]);
    expect(nextNavStack(["/search?q=dbms"], "/search?q=os")).toEqual(["/search?q=dbms", "/search?q=os"]);
  });
  it("ignores refreshes of the same URL", () => {
    expect(nextNavStack(["/a", "/b"], "/b")).toEqual(["/a", "/b"]);
  });
  it("treats returning to the previous entry as a back step (no loops)", () => {
    expect(nextNavStack(["/a", "/b", "/c"], "/b")).toEqual(["/a", "/b"]);
  });
  it("replaces the top entry for fallback navigation", () => {
    expect(nextNavStack(["/paper"], "/subject", true)).toEqual(["/subject"]);
  });
  it("is capped", () => {
    let stack: string[] = [];
    for (let i = 0; i < NAV_STACK_MAX + 10; i++) stack = nextNavStack(stack, `/p/${i}`);
    expect(stack).toHaveLength(NAV_STACK_MAX);
    expect(stack.at(-1)).toBe(`/p/${NAV_STACK_MAX + 9}`);
  });
});

describe("canGoBack", () => {
  it("needs an in-app previous page", () => {
    expect(canGoBack(["/a"])).toBe(false);
    expect(canGoBack(["/a", "/b"])).toBe(true);
  });
  it("never goes back into a completed sign-in flow", () => {
    expect(canGoBack(["/login?next=/library", "/library"])).toBe(false);
    expect(canGoBack(["/login/two-factor", "/admin"])).toBe(false);
    expect(isAuthPath("/loginx")).toBe(false);
  });
});
