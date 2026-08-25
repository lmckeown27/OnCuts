import {
  shouldApplyDeviceLocationJumpGuard,
  shouldPreserveDevicePrivacyLabel,
} from '../service-location-jump-guard';

describe('shouldApplyDeviceLocationJumpGuard', () => {
  it('skips jump guard when previous pin was manual (manual → device resume)', () => {
    expect(
      shouldApplyDeviceLocationJumpGuard({
        hasServiceAnchor: true,
        previousSource: 'manual',
        resumeDeviceTracking: false,
      })
    ).toBe(false);
  });

  it('skips jump guard when explicitly resuming device tracking', () => {
    expect(
      shouldApplyDeviceLocationJumpGuard({
        hasServiceAnchor: true,
        previousSource: 'device',
        resumeDeviceTracking: true,
      })
    ).toBe(false);
  });

  it('applies jump guard for device → device updates', () => {
    expect(
      shouldApplyDeviceLocationJumpGuard({
        hasServiceAnchor: true,
        previousSource: 'device',
        resumeDeviceTracking: false,
      })
    ).toBe(true);
  });

  it('does not apply when there is no anchor', () => {
    expect(
      shouldApplyDeviceLocationJumpGuard({
        hasServiceAnchor: false,
        previousSource: 'device',
        resumeDeviceTracking: false,
      })
    ).toBe(false);
  });
});

describe('shouldPreserveDevicePrivacyLabel', () => {
  it('preserves label only for device-sourced pins', () => {
    expect(shouldPreserveDevicePrivacyLabel('UCSB', 'device')).toBe(true);
    expect(shouldPreserveDevicePrivacyLabel('San Jose, CA', 'manual')).toBe(false);
    expect(shouldPreserveDevicePrivacyLabel('San Jose, CA', 'campus_default')).toBe(false);
  });

  it('does not preserve empty labels', () => {
    expect(shouldPreserveDevicePrivacyLabel('', 'device')).toBe(false);
    expect(shouldPreserveDevicePrivacyLabel('   ', 'device')).toBe(false);
  });
});
