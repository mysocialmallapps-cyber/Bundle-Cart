"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const pool_1 = require("./pool");
const logger_1 = require("../config/logger");
/**
 * Minimal SQL migration runner.
 *
 * Trade-off: avoids heavy migration deps, but requires disciplined migration files.
 * Files are applied in lexicographic order from `src/db/migrations/*.sql`.
 */
async function main() {
    const client = await pool_1.pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
        const migrationsDir = node_path_1.default.join(__dirname, "migrations");
        const files = (await (0, promises_1.readdir)(migrationsDir))
            .filter((f) => f.endsWith(".sql"))
            .sort((a, b) => a.localeCompare(b));
        for (const file of files) {
            const id = file;
            const already = await client.query("SELECT 1 FROM schema_migrations WHERE id = $1", [id]);
            if (already.rowCount && already.rowCount > 0)
                continue;
            const sql = await (0, promises_1.readFile)(node_path_1.default.join(migrationsDir, file), "utf8");
            logger_1.logger.info({ migration: id }, "Applying migration");
            await client.query(sql);
            await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [id]);
        }
        await client.query("COMMIT");
        logger_1.logger.info("Migrations complete");
    }
    catch (err) {
        await client.query("ROLLBACK");
        logger_1.logger.error({ err }, "Migration failed");
        process.exitCode = 1;
    }
    finally {
        client.release();
        await pool_1.pool.end();
    }
}
void main();
