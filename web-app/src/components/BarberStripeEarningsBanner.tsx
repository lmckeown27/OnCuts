import { useEffect, useState } from 'react';
import { DollarSign } from 'lucide-react';
import { fetchBarberPayoutSummary } from '../services/barber-payout.service';

type Props = {
  /** Opens Payment Management (payout address, etc.) */
  onManagePayments?: () => void;
  className?: string;
};

/**
 * Barber dashboard header: USD earnings from the same backend as Payment Management (bookings + ledger).
 * No on-chain balance reads — avoids tying the schedule UI to crypto.
 */
export default function BarberStripeEarningsBanner({ onManagePayments, className }: Props) {
  const [displayDollars, setDisplayDollars] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await fetchBarberPayoutSummary();
        if (cancelled) return;
        setHasProfile(s.has_barber_profile);
        setDisplayDollars(s.display_total_dollars);
      } catch {
        if (!cancelled) {
          setDisplayDollars(null);
          setHasProfile(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && !hasProfile) {
    return null;
  }

  const amount =
    displayDollars === null || Number.isNaN(displayDollars)
      ? '—'
      : displayDollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div
      className={
        className ||
        'flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50/60 px-4 py-3 text-sm'
      }
    >
      <div className="flex items-center gap-2 text-gray-800 min-w-0">
        <DollarSign className="h-5 w-5 text-primary-600 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">Estimated earnings (USD)</p>
          <p className="text-xs text-gray-600">
            {loading
              ? 'Loading…'
              : 'From paid bookings after the platform fee. Customers pay by card (Stripe).'}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0 pl-2">
        <p className="text-lg font-bold text-primary-800 tabular-nums">
          {loading ? '…' : `$${amount}`}
        </p>
        {onManagePayments ? (
          <button
            type="button"
            onClick={onManagePayments}
            className="text-xs text-primary-700 underline hover:text-primary-900"
          >
            Payment settings
          </button>
        ) : null}
      </div>
    </div>
  );
}
