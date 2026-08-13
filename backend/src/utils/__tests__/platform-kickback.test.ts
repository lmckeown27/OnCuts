import { calculateKickbackCents, clampKickbackPercent } from '../platform-kickback';

describe('clampKickbackPercent', () => {
  it('clamps to 0–100 and rounds to 2 decimals', () => {
    expect(clampKickbackPercent(-4)).toBe(0);
    expect(clampKickbackPercent(150)).toBe(100);
    expect(clampKickbackPercent(10.456)).toBe(10.46);
    expect(clampKickbackPercent(Number.NaN)).toBe(0);
  });
});

describe('calculateKickbackCents', () => {
  it('pays 10% of a $25 service', () => {
    expect(calculateKickbackCents(2500, 10)).toBe(250);
  });

  it('returns 0 when percent or amount is 0', () => {
    expect(calculateKickbackCents(2500, 0)).toBe(0);
    expect(calculateKickbackCents(0, 10)).toBe(0);
  });
});
