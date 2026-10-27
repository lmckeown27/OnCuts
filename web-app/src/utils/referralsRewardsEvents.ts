export const OPEN_REFERRALS_EVENT = 'oncuts-open-referrals';
export const OPEN_REWARDS_EVENT = 'oncuts-open-rewards';

export function notifyOpenReferrals(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_REFERRALS_EVENT));
}

export function notifyOpenRewards(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_REWARDS_EVENT));
}
