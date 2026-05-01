/**
 * Apply SQL file(s) from src/database/migrations/ against DATABASE_URL.
 *
 * Loads `.env` before opening the pool (static imports would run `connection.ts`
 * before dotenv and produce SCRAM "client password must be a string" when URL is missing).
 *
 * Strips `schema=` from DATABASE_URL (Prisma) so node-pg accepts the same string as libpq/psql.
 *
 * Usage (from backend/):
 *   npm run migrate:sql -- 026
 *   npm run migrate:sql -- 026 027
 *   npm run migrate:sql -- 026_apple_oauth_users.sql
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

/** libpq does not accept Prisma's `schema=` query parameter. */
function stripUnsupportedDatabaseUrlParams(urlStr: string): string {
  const t = urlStr.trim();
  if (!t) return t;
  try {
    const u = new URL(t);
    u.searchParams.delete('schema');
    return u.toString();
  } catch {
    return t
      .replace(/[?&]schema=[^&]*/gi, '')
      .replace(/\?&/g, '?')
      .replace(/\?$/g, '');
  }
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
  const args = process.argv.slice(2).map((a) => a.trim()).filter(Boolean);
  if (args.length === 0) {
    console.error(
      'Usage: npx ts-node src/scripts/apply-sql-migration.ts <prefix|file.sql> [more...]\n' +
        'Example: npm run migrate:sql -- 026 027'
    );
    process.exit(1);
  }

  const rawUrl = process.env.DATABASE_URL?.trim();
  if (!rawUrl) {
    console.error(
      'DATABASE_URL is not set. Export it or add it to backend/.env (or repo-root .env), then retry.'
    );
    process.exit(1);
  }

  const cleaned = stripUnsupportedDatabaseUrlParams(rawUrl);
  if (cleaned !== rawUrl) {
    process.env.DATABASE_URL = cleaned;
    console.log('Note: stripped unsupported URL params (e.g. schema=) from DATABASE_URL for this run.');
  }

  const { pool, closePool } = await import('../database/connection');

  const migrationsDir = path.join(__dirname, '../database/migrations');

  for (const arg of args) {
    const filename = resolveMigrationFile(arg, migrationsDir);
    const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf-8');
    await pool.query(sql);
    console.log(`Applied migration: ${filename}`);
  }

  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
