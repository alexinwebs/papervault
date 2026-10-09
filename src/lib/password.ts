import bcrypt from "bcryptjs";

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);

/**
 * bcrypt throws rather than returning false when the stored value is not a
 * valid hash, which is exactly the case for an erased account's placeholder.
 * A malformed hash simply means "no password will ever match".
 */
export async function verifyPassword(plain: string, hash: string) {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
