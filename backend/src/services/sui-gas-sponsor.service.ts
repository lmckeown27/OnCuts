import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { logger } from '../utils/logger';

function keypairFromSecret(trimmed: string, envLabel: string): Ed25519Keypair {
  try {
    if (trimmed.startsWith('suiprivkey')) {
      return Ed25519Keypair.fromSecretKey(trimmed);
    }
    const hex = trimmed.replace(/^0x/, '');
    if (/^[0-9a-fA-F]{64}$/.test(hex)) {
      return Ed25519Keypair.fromSecretKey(Buffer.from(hex, 'hex'));
    }
  } catch (e) {
    logger.error(`Failed to parse ${envLabel}`, e);
  }
  throw new Error(`${envLabel} must be suiprivkey… or 64-char hex`);
}

/**
 * Gas sponsor keypair for Sui sponsored transactions (GasData pattern).
 * Barbers receive full USDC; platform pays SUI gas.
 *
 * If `GAS_SPONSOR_SECRET` is unset, uses `SUI_TREASURY_SIGNER_SECRET` so a single
 * wallet can sign both treasury USDC and gas without duplicating the secret in .env.
 *
 * @see https://docs.sui.io/concepts/transactions/sponsored-transactions
 */
export function getGasSponsorKeypair(): Ed25519Keypair {
  const gas = process.env.GAS_SPONSOR_SECRET?.trim();
  if (gas) {
    return keypairFromSecret(gas, 'GAS_SPONSOR_SECRET');
  }
  const treasury = process.env.SUI_TREASURY_SIGNER_SECRET?.trim();
  if (treasury) {
    return keypairFromSecret(treasury, 'SUI_TREASURY_SIGNER_SECRET');
  }
  throw new Error(
    'Configure GAS_SPONSOR_SECRET (gas payer) and/or SUI_TREASURY_SIGNER_SECRET. ' +
      'The relayer needs at least one; use both if the treasury signer and gas wallet differ.'
  );
}

/**
 * Placeholder: build sponsored transaction bytes with sponsor GasData.
 * Wire to your Move USDC package + Transaction builder when contracts are deployed.
 */
export async function sponsorTransactionStub(_txDescription: string): Promise<{ digest: string }> {
  logger.debug('sui-gas-sponsor: sponsorTransactionStub (implement with PTB + gasStation)');
  return { digest: '0x0' };
}
