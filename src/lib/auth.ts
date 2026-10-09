import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";
import { unauthorized, forbidden, AppError } from "./errors";
import type { Role } from "./constants";
import { clientIpFrom } from "./client-ip";
import { safeLocalPath } from "./utils";

const COOKIE = "pv_session";
const MAX_AGE = 60 * 60 * 24 * 14;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 24) {
    throw new Error("AUTH_SECRET is missing or too short. See .env.example.");
  }
  return new TextEncoder().encode(value);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  collegeId: string | null;
  trustLevel: string;
  emailVerifiedAt: Date | null;
  totpConfirmedAt: Date | null;
  /** Account standing (ACTIVE | WARNED | RESTRICTED). Suspended and banned accounts never get a session. */
  status: string;
  sessionId: string;
};

async function clientMeta() {
  try {
    const h = await headers();
    return {
      userAgent: h.get("user-agent")?.slice(0, 200) ?? null,
      ip: clientIpFrom(h.get("x-forwarded-for"), h.get("x-real-ip")),
    };
  } catch {
    return { userAgent: null, ip: null };
  }
}

/**
 * Issues a database-backed session. The cookie only carries the session id, so
 * signing out, a ban or a password change revokes access immediately instead of
 * waiting for a stateless JWT to expire.
 */
export async function createSession(userId: string) {
  const meta = await clientMeta();
  const expiresAt = new Date(Date.now() + MAX_AGE * 1000);
  const session = await prisma.session.create({
    data: { userId, expiresAt, userAgent: meta.userAgent, ip: meta.ip },
  });

  const token = await new SignJWT({ sub: userId, sid: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return session;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
      const sid = typeof payload.sid === "string" ? payload.sid : null;
      if (sid) {
        await prisma.session
          .updateMany({ where: { id: sid, revokedAt: null }, data: { revokedAt: new Date() } })
          .catch(() => undefined);
      }
    } catch {
      /* an unreadable cookie is simply dropped */
    }
  }
  jar.delete(COOKIE);
}

/** Signs every other device out; used after a password change or on demand. */
export async function revokeOtherSessions(userId: string, keepSessionId?: string) {
  return prisma.session.updateMany({
    where: { userId, revokedAt: null, ...(keepSessionId ? { NOT: { id: keepSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

/** How stale lastSeenAt may get before a request refreshes it. */
const TOUCH_INTERVAL_MS = 60_000;

/**
 * Resolves the session from the signed cookie, checks it is still live, and
 * re-reads the user from the database so role/tenant data is never trusted
 * from the client.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const id = String(payload.sub ?? "");
    const sid = typeof payload.sid === "string" ? payload.sid : null;
    if (!id || !sid) return null;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            collegeId: true,
            trustLevel: true,
            emailVerifiedAt: true,
            totpConfirmedAt: true,
            credentialsSetAt: true,
            bannedAt: true,
            status: true,
            statusUntil: true,
          },
        },
      },
    });
    if (!session || session.userId !== id) return null;
    if (session.revokedAt || session.expiresAt < new Date()) return null;
    if (session.user.bannedAt || session.user.status === "BANNED") return null;
    if (isSuspended(session.user)) return null;
    // Sessions issued before the last credential change are no longer valid.
    if (session.createdAt < session.user.credentialsSetAt) return null;

    // Throttled last-seen write: useful for the device list, not worth a write
    // on every single request.
    if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      prisma.session
        .update({ where: { id: sid }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }

    const { credentialsSetAt: _c, bannedAt: _b, statusUntil: _u, ...user } = session.user;
    return { ...user, role: user.role as Role, sessionId: sid } satisfies SessionUser;
  } catch {
    return null;
  }
}

/** A suspension is active until statusUntil; an open-ended one has no end date. */
export function isSuspended(user: { status: string; statusUntil: Date | null }) {
  if (user.status !== "SUSPENDED") return false;
  return !user.statusUntil || user.statusUntil > new Date();
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw forbidden("This area is restricted to staff accounts.");
  return user;
}

/**
 * Gate for actions that write public content. Unverified accounts can browse
 * but cannot upload, comment or report.
 */
export function assertVerifiedEmail(user: SessionUser, opts: { allowRestricted?: boolean } = {}) {
  // Support tickets stay open to restricted members so they can appeal.
  if (!(opts.allowRestricted && user.status === "RESTRICTED")) assertGoodStanding(user);
  if (process.env.REQUIRE_EMAIL_VERIFICATION === "false") return;
  if (!user.emailVerifiedAt) {
    throw new AppError(
      "EMAIL_UNVERIFIED",
      "Confirm your email address first — check your inbox, or resend the link from Settings.",
    );
  }
}

/**
 * Restricted accounts may browse and talk to support, but cannot publish
 * anything (uploads, comments, reports, requests). Enforced server-side in
 * every write path through assertVerifiedEmail.
 */
export function assertGoodStanding(user: Pick<SessionUser, "status">) {
  if (user.status === "RESTRICTED" || user.status === "SUSPENDED" || user.status === "BANNED") {
    throw new AppError(
      "FORBIDDEN",
      "Your account is restricted, so you can't post or upload right now. Open a support ticket if you think this is a mistake.",
    );
  }
}

const PENDING_COOKIE = "pv_2fa";
const PENDING_MAX_AGE = 5 * 60; // a sign-in attempt should not stay open for long

/**
 * Between password and second factor the user is authenticated but not yet
 * signed in. That intermediate state lives in its own short-lived signed
 * cookie so it can never be mistaken for a real session.
 */
export async function startTwoFactorChallenge(userId: string, next: string) {
  const token = await new SignJWT({ sub: userId, next, stage: "2fa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_MAX_AGE}s`)
    .sign(secret());

  (await cookies()).set(PENDING_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_MAX_AGE,
  });
}

export async function readTwoFactorChallenge(): Promise<{ userId: string; next: string } | null> {
  const token = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.stage !== "2fa" || typeof payload.sub !== "string") return null;
    const next = typeof payload.next === "string" ? payload.next : "/";
    return { userId: payload.sub, next: safeLocalPath(next) };
  } catch {
    return null;
  }
}

export async function clearTwoFactorChallenge() {
  (await cookies()).delete(PENDING_COOKIE);
}
