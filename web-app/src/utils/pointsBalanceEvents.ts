export type PointsBalanceKind = 'operator' | 'client';

export const POINTS_BALANCE_CHANGED_EVENT = 'oncuts-points-balance-changed';

export interface PointsBalanceChangedDetail {
  userId: string;
  kind?: PointsBalanceKind;
  /** When known, listeners can update immediately without refetching. */
  balancePts?: number;
}

export function notifyPointsBalanceChanged(detail: PointsBalanceChangedDetail): void {
  if (typeof window === 'undefined' || !detail?.userId) return;
  window.dispatchEvent(
    new CustomEvent<PointsBalanceChangedDetail>(POINTS_BALANCE_CHANGED_EVENT, { detail })
  );
}
