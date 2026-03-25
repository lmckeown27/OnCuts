import type { EnokiNetwork } from '@mysten/enoki';

/**
 * Server-side Enoki API key (Enoki Portal “secret” / server key).
 * Prefer ENOKI_SECRET_KEY; ENOKI_API_KEY accepted as alias for older configs.
 */
export function getEnokiSecretKey(): string {
  return (
    process.env.ENOKI_SECRET_KEY?.trim() ||
    process.env.ENOKI_API_KEY?.trim() ||
    ''
  );
}

export function isEnokiSponsorConfigured(): boolean {
  return getEnokiSecretKey().length > 0;
}

/** Map env to Enoki `network` for sponsor + zkLogin APIs. */
export function getEnokiNetwork(): EnokiNetwork {
  const n = process.env.ENOKI_NETWORK?.trim().toLowerCase();
  if (n === 'mainnet' || n === 'testnet' || n === 'devnet') {
    return n;
  }
  const rpc = process.env.SUI_RPC_URL?.toLowerCase() ?? '';
  if (rpc.includes('mainnet')) return 'mainnet';
  if (rpc.includes('devnet')) return 'devnet';
  return 'testnet';
}

/**
 * Optional allowlist for sponsored move calls (comma-separated `pkg::mod::fn`).
 * Defaults cover framework USDC merge/split/transfer patterns.
 */
export function getEnokiAllowedMoveCallTargets(): string[] | undefined {
  const raw = process.env.ENOKI_ALLOWED_MOVE_CALL_TARGETS?.trim();
  if (raw) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [
    '0x2::coin::merge_coins',
    '0x2::coin::split_coins',
    '0x2::pay::split',
    '0x2::transfer::public_transfer',
  ];
}
