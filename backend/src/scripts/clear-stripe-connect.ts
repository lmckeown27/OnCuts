/**
 * Clear saved Stripe Connect account IDs so barbers can re-onboard on the current
 * platform (e.g. migration from Intera Platforms LLC → Pismo Platforms).
 *
 * Usage:
 *   npm run clear-stripe-connect -- liam.mckeown38415@gmail.com calpolyblockchain@gmail.com
 *   npm run clear-stripe-connect -- --all-with-accounts
 *   npm run clear-stripe-connect -- --validate-stale
 *
 * After clearing, barbers use Continue with Stripe in the app (POST /barber/connect/create or /reset).
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { getDefaultStripeClient } from '../config/stripe';
import { isStaleConnectAccountError } from '../services/stripe.service';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function clearConnectForUserIds(userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0;
  const result = await pool.query(
    `UPDATE users
     SET stripe_account_id = NULL,
         stripe_charges_enabled = false,
         stripe_payouts_enabled = false,
         "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = ANY($1::uuid[])
     RETURNING email, stripe_account_id`,
    [userIds]
  );
  return result.rowCount ?? 0;
}

async function clearByEmails(emails: string[]): Promise<void> {
  const normalized = emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (normalized.length === 0) {
    console.error('No emails provided.');
    process.exit(1);
  }

  const found = await pool.query<{ id: string; email: string; stripe_account_id: string | null }>(
    `SELECT id, email, stripe_account_id FROM users WHERE LOWER(email) = ANY($1::text[])`,
    [normalized]
  );

  if (found.rows.length === 0) {
    console.error('No users matched those emails.');
    process.exit(1);
  }

  for (const row of found.rows) {
    console.log(`Clearing Connect for ${row.email} (was ${row.stripe_account_id ?? 'NULL'})`);
  }

  const count = await clearConnectForUserIds(found.rows.map((r) => r.id));
  console.log(`\nCleared ${count} user(s). Re-onboard via Stripe hub → Continue with Stripe.`);
}

async function clearAllWithAccounts(): Promise<void> {
  const found = await pool.query<{ id: string; email: string; stripe_account_id: string }>(
    `SELECT id, email, stripe_account_id FROM users WHERE stripe_account_id IS NOT NULL ORDER BY email`
  );

  console.log(`Found ${found.rows.length} user(s) with a saved stripe_account_id.\n`);
  for (const row of found.rows) {
    console.log(`  ${row.email}  ${row.stripe_account_id}`);
  }

  const count = await clearConnectForUserIds(found.rows.map((r) => r.id));
  console.log(`\nCleared ${count} user(s).`);
}

async function validateAndClearStale(): Promise<void> {
  const stripe = getDefaultStripeClient();
  const found = await pool.query<{ id: string; email: string; stripe_account_id: string }>(
    `SELECT id, email, stripe_account_id FROM users WHERE stripe_account_id IS NOT NULL ORDER BY email`
  );

  console.log(`Validating ${found.rows.length} saved Connect account(s) against current STRIPE_SECRET_KEY…\n`);

  const staleUserIds: string[] = [];

  for (const row of found.rows) {
    try {
      await stripe.accounts.retrieve(row.stripe_account_id);
      console.log(`OK       ${row.email}  ${row.stripe_account_id}`);
    } catch (error) {
      if (isStaleConnectAccountError(error)) {
        console.log(`STALE    ${row.email}  ${row.stripe_account_id}`);
        staleUserIds.push(row.id);
      } else {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`ERROR    ${row.email}  ${row.stripe_account_id}  (${msg})`);
      }
    }
  }

  if (staleUserIds.length === 0) {
    console.log('\nNo stale accounts to clear.');
    return;
  }

  const count = await clearConnectForUserIds(staleUserIds);
  console.log(`\nCleared ${count} stale account(s) from Postgres.`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`Usage:
  npm run clear-stripe-connect -- user@example.com [more@emails…]
  npm run clear-stripe-connect -- --all-with-accounts
  npm run clear-stripe-connect -- --validate-stale`);
    process.exit(1);
  }

  try {
    if (args[0] === '--all-with-accounts') {
      await clearAllWithAccounts();
    } else if (args[0] === '--validate-stale') {
      await validateAndClearStale();
    } else {
      await clearByEmails(args);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
