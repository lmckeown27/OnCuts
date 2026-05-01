/**
 * Apply one SQL file from src/database/migrations/ against DATABASE_URL.
 *
 * Usage (from backend/):
 *   npx ts-node src/scripts/apply-sql-migration.ts 026
 *   npx ts-node src/scripts/apply-sql-migration.ts 026_apple_oauth_users.sql
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { closePool, pool } from '../database/connection';

dotenv.config();

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
