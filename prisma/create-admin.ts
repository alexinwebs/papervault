/**
 * Creates or promotes a platform admin account using your own credentials.
 *
 *   npm run admin:create
 *
 * Reads ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD from the environment (or
 * .env) when present, otherwise prompts interactively. The password is never
 * echoed and only its bcrypt hash is stored.
 */
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function ask(question: string, { mask = false } = {}): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let muted = false;
  if (mask) {
    const stdout = process.stdout as NodeJS.WriteStream & {
      write: (chunk: string | Uint8Array, ...rest: unknown[]) => boolean;
    };
    const original = stdout.write.bind(stdout);
    // Swallow echoed characters so the password never lands in the scrollback.
    stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) =>
      muted && typeof chunk === "string" && !chunk.includes(question)
        ? true
        : original(chunk, ...rest)) as typeof stdout.write;
    rl.once("close", () => {
      stdout.write = original as typeof stdout.write;
    });
    process.nextTick(() => {
      muted = true;
    });
  }
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      muted = false;
      if (mask) process.stdout.write("\n");
      rl.close();
      resolve(answer.trim());
    });
  });
}

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

async function main() {
  console.log("\n  PaperVault — create platform admin\n");

  const email = (process.env.ADMIN_EMAIL || (await ask("  Email: "))).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("That does not look like an email address.");

  const existing = await prisma.user.findUnique({ where: { email } });

  const name =
    process.env.ADMIN_NAME ||
    existing?.name ||
    (await ask("  Display name: ")) ||
    email.split("@")[0];

  let password = process.env.ADMIN_PASSWORD || "";
  if (!password) {
    password = await ask("  Password (min 8 chars): ", { mask: true });
    const confirm = await ask("  Confirm password: ", { mask: true });
    if (password !== confirm) fail("Passwords did not match. Nothing was changed.");
  }
  if (password.length < 8) fail("Password must be at least 8 characters.");

  const passwordHash = await bcrypt.hash(password, 10);

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name, passwordHash, role: "PLATFORM_ADMIN", trustLevel: "TRUSTED_CONTRIBUTOR" },
      })
    : await prisma.user.create({
        data: { email, name, passwordHash, role: "PLATFORM_ADMIN", trustLevel: "TRUSTED_CONTRIBUTOR" },
      });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: existing ? "user.admin_reset_cli" : "user.admin_created_cli",
      entityType: "User",
      entityId: user.id,
      after: JSON.stringify({ email: user.email, role: user.role }),
    },
  });

  console.log(
    `\n  ${existing ? "Updated" : "Created"} platform admin ${user.email}.` +
      `\n  Sign in at /login, then open /admin.\n`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
