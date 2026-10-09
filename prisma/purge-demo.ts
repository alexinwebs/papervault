/**
 * Removes the development demo data from a database before (or after) it goes
 * live: every account on the seed domain (@papervault.dev), everything those
 * accounts uploaded or wrote, their stored files, and their audit entries.
 * The college / degree / subject catalogue is kept because it is real data.
 *
 *   npm run db:purge-demo              # dry run: shows what would be removed
 *   npm run db:purge-demo -- --confirm # actually deletes
 *
 * Refuses to run unless a real (non-demo) platform admin exists, so you can't
 * lock yourself out. Create one first with `npm run admin:create`.
 */
import { PrismaClient } from "@prisma/client";
import { storage } from "../src/lib/storage";

const prisma = new PrismaClient();
const DEMO_DOMAIN = (process.env.DEMO_EMAIL_DOMAIN || "papervault.dev").toLowerCase();
const confirm = process.argv.includes("--confirm") || process.env.PURGE_DEMO_CONFIRM === "yes";

async function main() {
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: `@${DEMO_DOMAIN}`, mode: "insensitive" } },
    select: { id: true, email: true, role: true },
  });
  const demoIds = demoUsers.map((u) => u.id);

  const realAdmins = await prisma.user.count({
    where: {
      role: "PLATFORM_ADMIN",
      anonymizedAt: null,
      bannedAt: null,
      NOT: { email: { endsWith: `@${DEMO_DOMAIN}`, mode: "insensitive" } },
    },
  });

  const papers = await prisma.paper.findMany({
    where: { uploadedById: { in: demoIds } },
    select: { id: true, files: { select: { storageKey: true } } },
  });
  const paperIds = papers.map((p) => p.id);
  const fileKeys = papers.flatMap((p) => p.files.map((f) => f.storageKey));
  const [teacherDocs, ticketFiles, comments, audit] = await Promise.all([
    prisma.teacherVerificationDocument.findMany({
      where: { request: { userId: { in: demoIds } }, deletedAt: null },
      select: { storageKey: true },
    }),
    prisma.ticketAttachment.findMany({ where: { ticket: { requesterId: { in: demoIds } } }, select: { storageKey: true } }),
    prisma.comment.count({ where: { OR: [{ authorId: { in: demoIds } }, { paperId: { in: paperIds } }] } }),
    prisma.auditLog.count({ where: { actorId: { in: demoIds } } }),
  ]);
  const privateKeys = [...teacherDocs, ...ticketFiles].map((d) => d.storageKey);

  console.log(`\n  PaperVault — purge demo data (@${DEMO_DOMAIN})\n`);
  console.log(`  Demo accounts:      ${demoUsers.length}`);
  for (const u of demoUsers) console.log(`    - ${u.email} (${u.role})`);
  console.log(`  Papers they uploaded: ${papers.length} (${fileKeys.length} stored files)`);
  console.log(`  Comments:           ${comments}`);
  console.log(`  Private files:      ${privateKeys.length}`);
  console.log(`  Audit entries:      ${audit}`);
  console.log(`  Real platform admins remaining: ${realAdmins}\n`);

  if (demoUsers.length === 0) {
    console.log("  Nothing to purge.\n");
    return;
  }
  if (realAdmins === 0) {
    console.error("  Refusing: no non-demo platform admin exists. Run `npm run admin:create` first.\n");
    process.exitCode = 1;
    return;
  }
  if (!confirm) {
    console.log("  Dry run only. Re-run with --confirm to delete.\n");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      // The audit log is append-only; this transaction-scoped flag is the only
      // way to delete from it, and it is used here for demo actors only.
      await tx.$executeRaw`SELECT set_config('papervault.allow_audit_delete', 'on', true)`;
      await tx.auditLog.deleteMany({ where: { actorId: { in: demoIds } } });
      await tx.auditLog.deleteMany({ where: { entityId: { in: [...demoIds, ...paperIds] } } });
      // Real papers a demo moderator reviewed keep their state, just not the reviewer.
      await tx.paper.updateMany({ where: { reviewedById: { in: demoIds } }, data: { reviewedById: null } });
      await tx.paper.updateMany({ where: { canonicalId: { in: paperIds } }, data: { canonicalId: null } });
      await tx.comment.deleteMany({ where: { OR: [{ authorId: { in: demoIds } }, { paperId: { in: paperIds } }] } });
      await tx.paper.deleteMany({ where: { id: { in: paperIds } } });
      await tx.user.deleteMany({ where: { id: { in: demoIds } } });
      // Exam sessions and paper sets that only held demo papers.
      await tx.paperSet.deleteMany({ where: { papers: { none: {} } } });
      await tx.examSession.deleteMany({ where: { sets: { none: {} } } });
    },
    { timeout: 120_000 },
  );

  let removed = 0;
  for (const key of [...fileKeys, ...privateKeys]) {
    try {
      await storage().delete(key);
      removed += 1;
    } catch (err) {
      console.warn(`  could not delete ${key}: ${String(err)}`);
    }
  }
  console.log(`  Done. Removed ${demoUsers.length} accounts, ${papers.length} papers and ${removed} files.\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
