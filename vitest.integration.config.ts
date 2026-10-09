import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Database-backed tests. They need a migrated Postgres in DATABASE_URL (and
 * whatever MALWARE_SCANNER / storage the .env selects) and create and remove
 * their own rows, so they are kept apart from the fast unit suite.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    testTimeout: 60_000,
    fileParallelism: false,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
