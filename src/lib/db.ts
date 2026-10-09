import { PrismaClient } from "@prisma/client";

/**
 * Papers are soft-deleted so a moderator can undo a mistake. Filtering that out
 * at every call site would eventually be forgotten, so the client itself hides
 * deleted rows. Recycle-bin queries opt back in with `prismaRaw`.
 */
const READ_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

function createClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  return base.$extends({
    name: "soft-delete-papers",
    query: {
      paper: {
        async $allOperations({ operation, args, query }) {
          if (!READ_OPERATIONS.has(operation)) return query(args);
          const typed = args as { where?: Record<string, unknown> };
          // A caller that names deletedAt explicitly knows what it is doing.
          if (typed.where && "deletedAt" in typed.where) return query(args);
          return query({ ...typed, where: { ...(typed.where ?? {}), deletedAt: null } } as never);
        },
      },
    },
  });
}

type ExtendedClient = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: ExtendedClient;
  prismaRaw?: PrismaClient;
};

export const prisma: ExtendedClient = globalForPrisma.prisma ?? createClient();

/** Unfiltered client. Only the recycle bin and purge job should use it. */
export const prismaRaw: PrismaClient =
  globalForPrisma.prismaRaw ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaRaw = prismaRaw;
}
