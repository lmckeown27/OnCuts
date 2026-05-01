/**
 * Apply one SQL file from src/database/migrations/ against DATABASE_URL.
 *
 * Loads `.env` before opening the pool (static imports would run `connection.ts`
 * before dotenv and produce SCRAM "client password must be a string" when URL is missing).
 *
 * Usage (from backend/):
 *   npx ts-node src/scripts/apply-sql-migration.ts 026
 *   npx ts-node src/scripts/apply-sql-migration.ts 026_apple_oauth_users.sql
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

function loadEnv(): void {
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '..', '.env'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      return;
    }
  }
  dotenv.config();
}

loadEnv();

function resolveMigrationFile(arg: string, migrationsDir: string): string {
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
  if (arg.endsWith('.sql')) {
    if (!files.includes(arg)) {
      throw new Error(`No migration named "${arg}". Available: ${files.sort().join(', ')}`);
    }
    return arg;
  }
  const asFile = `${arg}.sql`;
  if (files.includes(asFile)) return asFile;
  const byPrefix = files.filter((f) => f.startsWith(`${arg}_`) || f.startsWith(arg));
  if (byPrefix.length === 1) return byPrefix[0]!;
  if (byPrefix.length === 0) {
    throw new Error(`No migration matching "${arg}". Available: ${files.sort().join(', ')}`);
  }
  throw new Error(`Ambiguous migration "${arg}". Matches: ${byPrefix.join(', ')}`);
}

async function main() {
  const arg = process.argv[2]?.trim();
  if (!arg) {
    console.error('Usage: npx ts-node src/scripts/apply-sql-migration.ts <prefix or filename.sql>');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      'DATABASE_URL is not set. Export it or add it to backend/.env (or repo-root .env), then retry.'
    );
    process.exit(1);
  }

  const { pool, closePool } = await import('../database/connection');

  const migrationsDir = path.join(__dirname, '../database/migrations');
  const filename = resolveMigrationFile(arg, migrationsDir);
  const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf-8');

  await pool.query(sql);
  console.log(`Applied migration: ${filename}`);
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
