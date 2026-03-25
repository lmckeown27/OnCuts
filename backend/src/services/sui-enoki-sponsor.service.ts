import { EnokiClient } from '@mysten/enoki';
import type { SuiClient } from '@mysten/sui/client';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { Transaction } from '@mysten/sui/transactions';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import {
  getEnokiAllowedMoveCallTargets,
  getEnokiNetwork,
  getEnokiSecretKey,
  isEnokiSponsorConfigured,
} from '../config/enoki';
import { logger } from '../utils/logger';

let enokiClient: EnokiClient | null = null;

function getClient(): EnokiClient {
  if (!enokiClient) {
    enokiClient = new EnokiClient({ apiKey: getEnokiSecretKey() });
  }
  return enokiClient;
}

/**
 * Build transaction kind → Enoki gas sponsor → treasury signs sponsored bytes → Enoki executes.
 * Barber receives USDC; barber never pays gas. Treasury still authorizes USDC movements.
 */
export async function executeTransactionWithEnokiSponsor(
  tx: Transaction,
  treasurySigner: Ed25519Keypair,
  suiClient: SuiClient
): Promise<{ digest: string }> {
  if (!isEnokiSponsorConfigured()) {
    throw new Error('Enoki sponsor requested but ENOKI_SECRET_KEY is not set');
  }

  const kindBytes = await tx.build({
    client: suiClient,
    onlyTransactionKind: true,
  });
  const kindB64 = Buffer.from(kindBytes).toString('base64');
  const sender = normalizeSuiAddress(treasurySigner.toSuiAddress());
  const enoki = getClient();
  const allowed = getEnokiAllowedMoveCallTargets();

  logger.info('Enoki: createSponsoredTransaction', { sender, network: getEnokiNetwork() });

  const sponsored = await enoki.createSponsoredTransaction({
    network: getEnokiNetwork(),
    sender,
    transactionKindBytes: kindB64,
    allowedMoveCallTargets: allowed,
  });

  const rawBytes = new Uint8Array(Buffer.from(sponsored.bytes, 'base64'));
  const userSig = await treasurySigner.signTransaction(rawBytes);

  const executed = await enoki.executeSponsoredTransaction({
    digest: sponsored.digest,
    signature: userSig.signature,
  });

  logger.info('Enoki: executeSponsoredTransaction complete', { digest: executed.digest });
  return { digest: executed.digest };
}
