import type { FeeBurden } from '../hooks/useFrontendConfig';

export function quoteClientServiceFee(
  serviceCents: number,
  opts: {
    feeBurden?: FeeBurden | string | null;
    platformCommissionEnabled?: boolean;
    platformFeePercent?: number;
  }
): { serviceFeeCents: number; chargeAmountCents: number } {
  const amount = Math.max(0, Math.round(serviceCents));
  const enabled = opts.platformCommissionEnabled !== false;
  const percent = Number(opts.platformFeePercent);
  if (opts.feeBurden !== 'client' || !enabled || !Number.isFinite(percent) || percent <= 0) {
    return { serviceFeeCents: 0, chargeAmountCents: amount };
  }
  const serviceFeeCents = Math.round(amount * (Math.min(100, Math.max(0, percent)) / 100));
  return { serviceFeeCents, chargeAmountCents: amount + serviceFeeCents };
}
