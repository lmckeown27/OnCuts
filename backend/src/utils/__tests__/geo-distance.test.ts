import {
  haversineDistanceKm,
  isNullIslandCoordinate,
  MAX_DEVICE_SERVICE_LOCATION_JUMP_KM,
} from '../geo-distance';

describe('haversineDistanceKm', () => {
  it('measures San Luis Obispo to Beijing as an implausible device jump', () => {
    // Approx SLO downtown vs Beijing (39.98, 116.44) from the bad pin incident
    const km = haversineDistanceKm(35.2828, -120.6596, 39.98, 116.44);
    expect(km).toBeGreaterThan(MAX_DEVICE_SERVICE_LOCATION_JUMP_KM);
    expect(km).toBeGreaterThan(9000);
  });

  it('blocks cross-country GPS teleports that used to sneak under a 5000km cap', () => {
    // San Luis Obispo → New York
    const km = haversineDistanceKm(35.2828, -120.6596, 40.7128, -74.006);
    expect(km).toBeGreaterThan(MAX_DEVICE_SERVICE_LOCATION_JUMP_KM);
  });

  it('allows a local commute under the threshold', () => {
    // San Luis Obispo → Santa Barbara (~120 km is over; use nearby)
    const km = haversineDistanceKm(35.2828, -120.6596, 35.1214, -120.5913); // Pismo Beach
    expect(km).toBeLessThan(MAX_DEVICE_SERVICE_LOCATION_JUMP_KM);
  });

  it('measures San Jose to San Luis Obispo as over the device jump threshold', () => {
    // Manual pin resume: this distance must not block updates when jump guard is skipped
    const km = haversineDistanceKm(37.33, -121.89, 35.2828, -120.6596);
    expect(km).toBeGreaterThan(MAX_DEVICE_SERVICE_LOCATION_JUMP_KM);
    expect(km).toBeGreaterThan(200);
    expect(km).toBeLessThan(300);
  });
});

describe('isNullIslandCoordinate', () => {
  it('detects 0,0 GPS glitches', () => {
    expect(isNullIslandCoordinate(0, 0)).toBe(true);
    expect(isNullIslandCoordinate(35.28, -120.66)).toBe(false);
  });
});
