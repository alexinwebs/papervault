export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "EMAIL_UNVERIFIED"
  | "STORAGE_ERROR"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  EMAIL_UNVERIFIED: 403,
  STORAGE_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export const notFound = (what = "Resource") => new AppError("NOT_FOUND", `${what} not found.`);
export const unauthorized = () => new AppError("UNAUTHORIZED", "Sign in to continue.");
export const forbidden = (msg = "You do not have access to this.") => new AppError("FORBIDDEN", msg);
export const conflict = (msg: string) => new AppError("CONFLICT", msg);
export const validation = (msg: string, details?: unknown) =>
  new AppError("VALIDATION_ERROR", msg, details);

/**
 * Prisma's known request errors carry a stable code. The two that ordinary
 * races produce (a unique clash, a row deleted mid-request) are user-facing
 * conditions, not crashes. Matched structurally so this file stays free of a
 * Prisma import and usable from edge code.
 */
function fromPrisma(err: unknown): AppError | null {
  const code = (err as { code?: unknown; name?: unknown })?.code;
  const name = (err as { name?: unknown })?.name;
  if (name !== "PrismaClientKnownRequestError" || typeof code !== "string") return null;
  if (code === "P2002") return conflict("That already exists. Refresh and try again.");
  if (code === "P2025") return notFound("That item");
  return null;
}

/** Never leak internals to the client. */
export function toPublicError(err: unknown): { code: ErrorCode; message: string; status: number } {
  const known = err instanceof AppError ? err : fromPrisma(err);
  if (known) return { code: known.code, message: known.message, status: known.status };
  return { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again.", status: 500 };
}
