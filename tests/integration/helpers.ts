import { randomUUID } from "node:crypto";
import { prismaRaw } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export const tag = () => randomUUID().slice(0, 8);

/** A real 1x1 PNG, so content sniffing, scanning and storage all run for real. */
export function tinyPng(seed = 0) {
  const base = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  // Trailing bytes after IEND keep it a valid PNG but change the hash.
  return Buffer.concat([base, Buffer.from(`seed-${seed}-${randomUUID()}`)]);
}

export function asSession(
  u: { id: string; email: string; name: string },
  overrides: Partial<SessionUser> = {},
): SessionUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: "STUDENT",
    collegeId: null,
    trustLevel: "NEW",
    emailVerifiedAt: new Date(),
    totpConfirmedAt: new Date(),
    status: "ACTIVE",
    sessionId: "test",
    ...overrides,
  } as SessionUser;
}

export async function makeUser(
  name: string,
  t: string,
  data: { role?: string; status?: string; emailVerifiedAt?: Date | null } = {},
) {
  const u = await prismaRaw.user.create({
    data: {
      email: `${name}-${t}@example.test`,
      name: `${name} ${t}`,
      passwordHash: "x",
      role: data.role ?? "STUDENT",
      status: data.status ?? "ACTIVE",
      emailVerifiedAt: data.emailVerifiedAt === undefined ? new Date() : data.emailVerifiedAt,
    },
  });
  return asSession(u, {
    role: (data.role ?? "STUDENT") as SessionUser["role"],
    status: (data.status ?? "ACTIVE") as SessionUser["status"],
    emailVerifiedAt: data.emailVerifiedAt === undefined ? new Date() : data.emailVerifiedAt,
  });
}
