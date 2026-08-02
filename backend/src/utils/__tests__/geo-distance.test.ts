import {
  haversineDistanceKm,
  MAX_DEVICE_SERVICE_LOCATION_JUMP_KM,
} from '../geo-distance';

describe('haversineDistanceKm', () => {
  it('measures San Luis Obispo to Beijing as an implausible device jump', () => {
    // Approx SLO downtown vs Beijing (39.98, 116.44) from the bad pin incident
    const km = haversineDistanceKm(35.2828, -120.6596, 39.98, 116.44);
    expect(km).toBeGreaterThan(MAX_DEVICE_SERVICE_LOCATION_JUMP_KM);
    expect(km).toBeGreaterThan(9000);
  });

  it('allows long but plausible US travel under the threshold', () => {
    // San Luis Obispo → Honolulu
    const km = haversineDistanceKm(35.2828, -120.6596, 21.3069, -157.8583);
    expect(km).toBeLessThan(MAX_DEVICE_SERVICE_LOCATION_JUMP_KM);
  });
});
