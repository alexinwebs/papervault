import { existsSync } from "node:fs";

if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");
if (!process.env.DATABASE_URL) throw new Error("Integration tests need DATABASE_URL.");
