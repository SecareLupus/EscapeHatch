import { Pool } from "pg";
import { config } from "../config.js";

export const pool = config.databaseUrl
  ? new Pool({ connectionString: config.databaseUrl })
  : null;

export async function withDb<T>(fn: (db: Pool) => Promise<T>): Promise<T> {
  if (!pool) {
    throw new Error("DATABASE_URL must be configured for persistence-backed APIs.");
  }

  return fn(pool);
}

import { runner } from "node-pg-migrate";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDb(): Promise<void> {
  if (!config.databaseUrl) {
    return;
  }

  await runner({
    databaseUrl: config.databaseUrl,
    dir: path.resolve(__dirname, "../../migrations"),
    direction: "up",
    migrationsTable: "pgmigrations",
    verbose: true,
  });
}
