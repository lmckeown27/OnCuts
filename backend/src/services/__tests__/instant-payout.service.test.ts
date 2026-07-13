/**
 * Instant Payout helper — soft-fail paths and amount capping.
 */

import type Stripe from 'stripe';

const originalEnv = process.env.STRIPE_INSTANT_PAYOUTS_ENABLED;

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.STRIPE_INSTANT_PAYOUTS_ENABLED;
  } else {
    process.env.STRIPE_INSTANT_PAYOUTS_ENABLED = originalEnv;
  }
  jest.resetModules();
});

function mockStripe(overrides: {
  instantAvailable?: number;
  createPayout?: jest.Mock;
  balanceError?: Error;
  payoutError?: Error;
}) {
  const createPayout =
    overrides.createPayout ??
    jest.fn().mockResolvedValue({ id: 'po_test_instant' });

  if (overrides.payoutError) {
    createPayout.mockRejectedValue(overrides.payoutError);
  }

  const balanceRetrieve = overrides.balanceError
    ? jest.fn().mockRejectedValue(overrides.balanceError)
    : jest.fn().mockResolvedValue({
        instant_available: [
          { amount: overrides.instantAvailable ?? 0, currency: 'usd' },
        ],
      } as Stripe.Balance);

  return {
    balance: { retrieve: balanceRetrieve },
    payouts: { create: createPayout },
  } as unknown as Stripe;
}

describe('attemptInstantPayout', () => {
  it('returns disabled when env flag is off', async () => {
    process.env.STRIPE_INSTANT_PAYOUTS_ENABLED = 'false';
    const { attemptInstantPayout } = await import('../instant-payout.service');
    const result = await attemptInstantPayout({
      connectedAccountId: 'acct_1',
      amountCents: 5000,
      bookingId: 'booking-1',
      livemode: false,
      stripe: mockStripe({ instantAvailable: 5000 }),
    });
    expect(result.status).toBe('disabled');
  });

  it('skips when Instant balance is 0', async () => {
    process.env.STRIPE_INSTANT_PAYOUTS_ENABLED = 'true';
    const { attemptInstantPayout } = await import('../instant-payout.service');
    const stripe = mockStripe({ instantAvailable: 0 });
    const result = await attemptInstantPayout({
      connectedAccountId: 'acct_1',
      amountCents: 5000,
      bookingId: 'booking-1',
      livemode: false,
      stripe,
    });
    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('instant_balance_zero');
    expect(stripe.payouts.create).not.toHaveBeenCalled();
  });

  it('skips when amount is below $0.50', async () => {
    process.env.STRIPE_INSTANT_PAYOUTS_ENABLED = 'true';
    const { attemptInstantPayout, INSTANT_PAYOUT_MIN_CENTS } = await import(
      '../instant-payout.service'
    );
    const stripe = mockStripe({ instantAvailable: 5000 });
    const result = await attemptInstantPayout({
      connectedAccountId: 'acct_1',
      amountCents: INSTANT_PAYOUT_MIN_CENTS - 1,
      bookingId: 'booking-1',
      livemode: false,
      stripe,
    });
    expect(result.status).toBe('skipped');
    expect(stripe.payouts.create).not.toHaveBeenCalled();
  });

  it('creates Instant payout capped to eligible balance', async () => {
    process.env.STRIPE_INSTANT_PAYOUTS_ENABLED = 'true';
    const { attemptInstantPayout } = await import('../instant-payout.service');
    const createPayout = jest.fn().mockResolvedValue({ id: 'po_ok' });
    const stripe = mockStripe({ instantAvailable: 1200, createPayout });
    const result = await attemptInstantPayout({
      connectedAccountId: 'acct_1',
      amountCents: 5000,
      bookingId: 'booking-abc',
      livemode: true,
      stripe,
    });
    expect(result.status).toBe('instant');
    expect(result.payoutId).toBe('po_ok');
    expect(result.amountCents).toBe(1200);
    expect(createPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1200,
        currency: 'usd',
        method: 'instant',
      }),
      expect.objectContaining({
        stripeAccount: 'acct_1',
        idempotencyKey: 'instant_payout_booking_booking-abc',
      })
    );
  });

  it('returns failed without throwing when Stripe errors', async () => {
    process.env.STRIPE_INSTANT_PAYOUTS_ENABLED = 'true';
    const { attemptInstantPayout } = await import('../instant-payout.service');
    const stripe = mockStripe({
      instantAvailable: 5000,
      payoutError: new Error('instant_payouts_unsupported'),
    });
    await expect(
      attemptInstantPayout({
        connectedAccountId: 'acct_1',
        amountCents: 5000,
        bookingId: 'booking-1',
        livemode: false,
        stripe,
      })
    ).resolves.toMatchObject({
      status: 'failed',
      reason: 'instant_payouts_unsupported',
    });
  });
});
