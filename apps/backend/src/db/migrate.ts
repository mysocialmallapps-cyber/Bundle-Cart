import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./pool";
import { logger } from "../config/logger";

/**
 * Minimal SQL migration runner.
 *
 * Trade-off: avoids heavy migration deps, but requires disciplined migration files.
 * Files are applied in lexicographic order from `src/db/migrations/*.sql`.
 */
async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, "migrations");
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      const id = file;
      const already = await client.query(
        "SELECT 1 FROM schema_migrations WHERE id = $1",
        [id]
      );
      if (already.rowCount && already.rowCount > 0) continue;

      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      logger.info({ migration: id }, "Applying migration");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [id]);
    }

    await client.query("COMMIT");
    logger.info("Migrations complete");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Migration failed");
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();

