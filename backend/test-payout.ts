/**
 * Temporary dev script: trigger the real Sui relayer (same executeSplitPayout as DIY payouts).
 * Isolates on-chain / treasury issues from Stripe webhooks.
 *
 * Run from repo root (CampusCuts/):
 *   npx ts-node backend/test-payout.ts
 *   bash scripts/test-payout-relayer.sh
 * Or from backend/:
 *   npx ts-node test-payout.ts
 *   npm run test:payout-relayer
 *
 * Args: [barberSuiAddress] [usdAmount] — or TEST_RELAYER_BARBER_ADDRESS / TEST_RELAYER_USD.
 * Amount is USDC base units internally (6 decimals). Needs backend/.env (treasury, RPC, etc.).
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

import suiRelayerService from './src/services/sui-relayer.service';

const DEFAULT_BARBER =
  '0x3f493dc1c9e816873a735223735e7e8e39c400d0f3b4c8bc0d19103f494f7526';

async function main(): Promise<void> {
  const barber =
    process.env.TEST_RELAYER_BARBER_ADDRESS?.trim() ||
    process.argv[2]?.trim() ||
    DEFAULT_BARBER;

  const usdRaw = process.env.TEST_RELAYER_USD ?? process.argv[3] ?? '20';
  const usd = Number(usdRaw);
  if (!Number.isFinite(usd) || usd <= 0) {
    throw new Error(`Invalid USD amount: ${usdRaw}`);
  }
  const baseUnits = BigInt(Math.round(usd * 1e6));

  console.log('Manually triggering Sui relayer split payout...');
  console.log({ barber, usd, baseUnits: baseUnits.toString() });

  const { digest } = await suiRelayerService.executeSplitPayout(barber, baseUnits);
  console.log('Success', { digest });
}

void main().catch((e) => {
  console.error('Failed', e);
  process.exit(1);
});
