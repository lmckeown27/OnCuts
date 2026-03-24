import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { logger } from '../utils/logger';

/**
 * Gas sponsor keypair for Sui sponsored transactions (GasData pattern).
 * Barbers receive full USDC; platform pays SUI gas.
 *
 * @see https://docs.sui.io/concepts/transactions/sponsored-transactions
 */
export function getGasSponsorKeypair(): Ed25519Keypair {
  const secret = process.env.GAS_SPONSOR_SECRET;
  if (!secret) {
    throw new Error('GAS_SPONSOR_SECRET is not configured');
  }
  const trimmed = secret.trim();
  try {
    if (trimmed.startsWith('suiprivkey')) {
      return Ed25519Keypair.fromSecretKey(trimmed);
    }
    const hex = trimmed.replace(/^0x/, '');
    if (/^[0-9a-fA-F]{64}$/.test(hex)) {
      return Ed25519Keypair.fromSecretKey(Buffer.from(hex, 'hex'));
    }
  } catch (e) {
    logger.error('Failed to parse GAS_SPONSOR_SECRET', e);
  }
  throw new Error('GAS_SPONSOR_SECRET must be suiprivkey… or 64-char hex');
}

/**
 * Placeholder: build sponsored transaction bytes with sponsor GasData.
 * Wire to your Move USDC package + Transaction builder when contracts are deployed.
 */
export async function sponsorTransactionStub(_txDescription: string): Promise<{ digest: string }> {
  logger.debug('sui-gas-sponsor: sponsorTransactionStub (implement with PTB + gasStation)');
  return { digest: '0x0' };
}
