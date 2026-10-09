import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prismaRaw } from "@/lib/db";
import { MAX_PINS, myPinnedColleges, pinnedCollegeIds, setCollegePin } from "@/server/services/pins";
import type { SessionUser } from "@/lib/auth";

const tag = randomUUID().slice(0, 8);
const collegeIds: string[] = [];
let alice: SessionUser;
let bob: SessionUser;

const asSession = (u: { id: string; email: string; name: string }): SessionUser => ({
  id: u.id, email: u.email, name: u.name, role: "STUDENT", collegeId: null, trustLevel: "NEW",
  emailVerifiedAt: new Date(), totpConfirmedAt: null, status: "ACTIVE", sessionId: "test",
});

beforeAll(async () => {
  for (let i = 0; i < 3; i++) {
    const c = await prismaRaw.college.create({
      data: { slug: `pin-${tag}-${i}`, name: `Pin College ${tag} ${i}`, shortName: `PC${i}`, city: "X", state: "Y", university: "Z" },
    });
    collegeIds.push(c.id);
  }
  const mk = (n: string) =>
    prismaRaw.user.create({ data: { email: `${n}-${tag}@example.test`, name: n, passwordHash: "x" } });
  alice = asSession(await mk("alice"));
  bob = asSession(await mk("bob"));
});

afterAll(async () => {
  await prismaRaw.user.deleteMany({ where: { id: { in: [alice.id, bob.id] } } });
  await prismaRaw.college.deleteMany({ where: { id: { in: collegeIds } } });
  await prismaRaw.$disconnect();
});

describe("pinned colleges", () => {
  it("never creates duplicates, even for simultaneous requests", async () => {
    await Promise.all(Array.from({ length: 8 }, () => setCollegePin(alice, collegeIds[0], true)));
    expect(await prismaRaw.userPinnedCollege.count({ where: { userId: alice.id } })).toBe(1);
  });

  it("refuses a duplicate row at the database level", async () => {
    await expect(
      prismaRaw.userPinnedCollege.create({ data: { userId: alice.id, collegeId: collegeIds[0] } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("keeps each user's pins private to them", async () => {
    await setCollegePin(bob, collegeIds[1], true);
    const alicePins = (await myPinnedColleges(alice.id)).map((p) => p.college.id);
    const bobPins = (await myPinnedColleges(bob.id)).map((p) => p.college.id);
    expect(alicePins).toEqual([collegeIds[0]]);
    expect(bobPins).toEqual([collegeIds[1]]);
    expect((await pinnedCollegeIds(bob.id, collegeIds)).has(collegeIds[0])).toBe(false);
    expect((await pinnedCollegeIds(null, collegeIds)).size).toBe(0);
  });

  it("only removes the caller's own pin", async () => {
    // Bob "unpinning" Alice's college touches only Bob's (non-existent) row.
    await setCollegePin(bob, collegeIds[0], false);
    expect(await prismaRaw.userPinnedCollege.count({ where: { userId: alice.id } })).toBe(1);
    await setCollegePin(alice, collegeIds[0], false);
    expect(await prismaRaw.userPinnedCollege.count({ where: { userId: alice.id } })).toBe(0);
    // Unpinning again is a harmless no-op.
    await expect(setCollegePin(alice, collegeIds[0], false)).resolves.toEqual({ pinned: false });
  });

  it("rejects pins for colleges that do not exist", async () => {
    await expect(setCollegePin(alice, "no-such-college", true)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("supports several pins and returns newest first", async () => {
    await setCollegePin(alice, collegeIds[0], true);
    await new Promise((r) => setTimeout(r, 5));
    await setCollegePin(alice, collegeIds[2], true);
    const pins = await myPinnedColleges(alice.id);
    expect(pins.map((p) => p.college.id)).toEqual([collegeIds[2], collegeIds[0]]);
    expect(MAX_PINS).toBeGreaterThanOrEqual(10);
  });

  it("removes pins when the user is deleted", async () => {
    const temp = await prismaRaw.user.create({
      data: { email: `temp-${tag}@example.test`, name: "temp", passwordHash: "x" },
    });
    await setCollegePin(asSession(temp), collegeIds[1], true);
    await prismaRaw.user.delete({ where: { id: temp.id } });
    expect(await prismaRaw.userPinnedCollege.count({ where: { userId: temp.id } })).toBe(0);
  });
});
