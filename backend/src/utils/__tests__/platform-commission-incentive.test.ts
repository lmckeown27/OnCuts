import {
  computeIncentiveExpiresAt,
  isCommissionFreeEligible,
} from '../platform-commission';

describe('commission incentive eligibility', () => {
  const now = new Date('2026-08-05T12:00:00.000Z');

  it('count mode uses remaining quota', () => {
    expect(
      isCommissionFreeEligible(
        {
          incentiveMode: 'count',
          incentiveExpiresAt: null,
          commissionFreeBookingsRemaining: 3,
        },
        now
      )
    ).toBe(true);
    expect(
      isCommissionFreeEligible(
        {
          incentiveMode: 'count',
          incentiveExpiresAt: null,
          commissionFreeBookingsRemaining: 0,
        },
        now
      )
    ).toBe(false);
  });

  it('timeframe mode uses expires_at', () => {
    expect(
      isCommissionFreeEligible(
        {
          incentiveMode: 'timeframe',
          incentiveExpiresAt: new Date('2026-08-06T12:00:00.000Z'),
          commissionFreeBookingsRemaining: 0,
        },
        now
      )
    ).toBe(true);
    expect(
      isCommissionFreeEligible(
        {
          incentiveMode: 'timeframe',
          incentiveExpiresAt: new Date('2026-08-05T11:00:00.000Z'),
          commissionFreeBookingsRemaining: 5,
        },
        now
      )
    ).toBe(false);
  });

  it('computeIncentiveExpiresAt adds units', () => {
    const from = new Date('2026-08-05T00:00:00.000Z');
    expect(computeIncentiveExpiresAt(2, 'days', from).toISOString()).toBe(
      '2026-08-07T00:00:00.000Z'
    );
    expect(computeIncentiveExpiresAt(1, 'weeks', from).toISOString()).toBe(
      '2026-08-12T00:00:00.000Z'
    );
    expect(computeIncentiveExpiresAt(1, 'months', from).toISOString()).toBe(
      '2026-09-05T00:00:00.000Z'
    );
  });
});
