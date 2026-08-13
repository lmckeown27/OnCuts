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
    expect(split.serviceFeeCents).toBe(0);
    expect(split.chargeAmountCents).toBe(2500);
    expect(split.feeBurden).toBe('operator');
  });

  it('still supports true commission-free slots separately', () => {
    const split = calculatePlatformFeeSplit(2500, { forceCommissionFree: true });
    expect(split.platformFeeCents).toBe(0);
    expect(split.commissionFree).toBe(true);
  });
});

describe('client burden Service Fee', () => {
  it('adds x% on top and keeps the listed price for the operator', () => {
    const split = calculatePlatformFeeSplit(2000, {
      feePercent: 15,
      feeBurden: 'client',
    });
    expect(split.feeBurden).toBe('client');
    expect(split.serviceFeeCents).toBe(300);
    expect(split.platformFeeCents).toBe(300);
    expect(split.barberEarningsCents).toBe(2000);
    expect(split.chargeAmountCents).toBe(2300);
    expect(split.commissionFree).toBe(false);
  });

  it('charges listed price only when the Service Fee rate is 0', () => {
    const split = calculatePlatformFeeSplit(2000, {
      feePercent: 0,
      feeBurden: 'client',
    });
    expect(split.serviceFeeCents).toBe(0);
    expect(split.chargeAmountCents).toBe(2000);
    expect(split.barberEarningsCents).toBe(2000);
    expect(split.platformFeeCents).toBe(0);
  });

  it('does not deduct from the operator on operator burden', () => {
    const operator = calculatePlatformFeeSplit(2000, {
      feePercent: 15,
      feeBurden: 'operator',
    });
    expect(operator.serviceFeeCents).toBe(0);
    expect(operator.chargeAmountCents).toBe(2000);
    expect(operator.barberEarningsCents).toBe(1700);
    expect(operator.platformFeeCents).toBe(300);
  });
});
