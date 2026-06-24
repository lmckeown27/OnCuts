/** How broad the barber's public service area appears for discovery */
export const SERVICE_AREA_PRESETS = [
  {
    id: 'spot',
    label: 'This spot',
    description: 'A specific building, dorm, or block',
    km: 0.5,
  },
  {
    id: 'walking',
    label: 'Walking distance',
    description: 'A few blocks around you',
    km: 2,
  },
  {
    id: 'campus',
    label: 'Campus area',
    description: 'Whole campus or neighborhood',
    km: 5,
  },
  {
    id: 'city',
    label: 'City or region',
    description: 'Broad public area',
    km: 15,
  },
] as const;

export type ServiceAreaPresetId = (typeof SERVICE_AREA_PRESETS)[number]['id'];

export function presetFromRadiusKm(km: number): ServiceAreaPresetId {
  const match = SERVICE_AREA_PRESETS.reduce((best, preset) => {
    const diff = Math.abs(preset.km - km);
    return diff < best.diff ? { id: preset.id, diff } : best;
  }, { id: SERVICE_AREA_PRESETS[2].id as ServiceAreaPresetId, diff: Infinity });
  return match.id;
}

export function radiusKmFromPreset(id: ServiceAreaPresetId): number {
  return SERVICE_AREA_PRESETS.find((p) => p.id === id)?.km ?? 5;
}
