import { calculatePlatformFeeSplit } from '../platform-commission';

describe('global commission off fee split', () => {
  it('charges $0 with feePercent 0 without marking commissionFree', () => {
    const split = calculatePlatformFeeSplit(2500, {
      forceCommissionFree: false,
      feePercent: 0,
    });
    expect(split.platformFeeCents).toBe(0);
    expect(split.barberEarningsCents).toBe(2500);
    expect(split.commissionFree).toBe(false);
    expect(split.feePercentDisplay).toBe(0);
  });

  it('still supports true commission-free slots separately', () => {
    const split = calculatePlatformFeeSplit(2500, { forceCommissionFree: true });
    expect(split.platformFeeCents).toBe(0);
    expect(split.commissionFree).toBe(true);
  });
});
