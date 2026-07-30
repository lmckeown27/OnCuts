/**
 * Backfill platform-funded kickback Transfers for commissionless paid bookings
 * that never got kickback stamped (kickback_status = 'none').
 *
 * Usage (from backend/ on the server, with .env loaded):
 *   npx ts-node src/scripts/backfill-provider-kickbacks.ts --dry-run
 *   npx ts-node src/scripts/backfill-provider-kickbacks.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../database/connection';
import { getDefaultStripeClient } from '../config/stripe';
import { processProviderKickback } from '../utils/platform-kickback';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const stripe = getDefaultStripeClient();

  const result = await pool.query(
    `SELECT b.id,
            b."barberId" AS barber_id,
            b."priceUsdCents" AS service_cents,
            b.payment_intent_id,
            bar.kickback_percent,
            u.stripe_account_id
     FROM bookings b
     JOIN barbers bar ON bar.id = b."barberId"
     JOIN users u ON u.id = bar."userId"
     WHERE b.commission_free_applied = true
       AND b.status IN ('PAID', 'COMPLETED')
       AND b.kickback_status = 'none'
       AND b.kickback_transfer_id IS NULL
       AND COALESCE(b.kickback_cents, 0) = 0
       AND bar.kickback_percent > 0
     ORDER BY b."paidAt" DESC NULLS LAST`
  );

  console.log(
    `Found ${result.rows.length} booking(s) eligible for kickback backfill${dryRun ? ' (dry-run)' : ''}\n`
  );

  for (const row of result.rows) {
    const bookingId = row.id as string;
    const paymentIntentId = row.payment_intent_id as string | null;
    let connectedAccountId = row.stripe_account_id as string | null;
    let livemode = true;

    if (!paymentIntentId) {
      console.warn(`  ${bookingId}: no payment_intent_id — skipping`);
      continue;
    }

    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      livemode = !!pi.livemode;
      const destinationRaw = pi.transfer_data?.destination;
      const fromPi =
        typeof destinationRaw === 'string'
          ? destinationRaw
          : destinationRaw?.id || null;
      if (fromPi) connectedAccountId = fromPi;
    } catch (err: any) {
      console.warn(`  ${bookingId}: could not retrieve PI ${paymentIntentId}: ${err.message}`);
    }

    const expectedCents = Math.round(
      (Number(row.service_cents) * Number(row.kickback_percent)) / 100
    );
    console.log(
      `  ${bookingId}: $${Number(row.service_cents) / 100} @ ${row.kickback_percent}%` +
        ` → ~$${expectedCents / 100} | destination=${connectedAccountId || 'none'} | pi=${paymentIntentId}`
    );

    if (dryRun) continue;

    const outcome = await processProviderKickback({
      client: pool,
      bookingId,
      barberRecordId: row.barber_id,
      serviceAmountCents: Number(row.service_cents),
      connectedAccountId,
      paymentIntentId,
      livemode,
    });

    console.log(
      `    → transferred=${outcome.transferred} kickbackCents=${outcome.kickbackCents}` +
        (outcome.transferId ? ` transferId=${outcome.transferId}` : '')
    );
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
