import type { ServiceProviderCategory } from '../types/service-provider';

export type BrowseProviderCategory = 'all' | ServiceProviderCategory;

export type BrowseProviderCategoryOption = {
  id: BrowseProviderCategory;
  label: string;
  description: string;
};

/** Consumer browse chips — All / Barber / Beauty (provider_type buckets). */
export const BROWSE_PROVIDER_CATEGORIES: BrowseProviderCategoryOption[] = [
  {
    id: 'all',
    label: 'All',
    description: 'Every provider type',
  },
  {
    id: 'Barber',
    label: 'Barber',
    description: 'Barbers and haircuts',
  },
  {
    id: 'Beauty',
    label: 'Beauty',
    description: 'Makeup, nails, lashes, and more',
  },
];

/** Map browse chip to list API filters (prefer providerType slug). */
export function browseCategoryApiParam(
  category: BrowseProviderCategory,
): { providerType?: 'barber' | 'beauty'; category?: ServiceProviderCategory } {
  if (category === 'all') return {};
  if (category === 'Barber') return { providerType: 'barber', category: 'Barber' };
  if (category === 'Beauty') return { providerType: 'beauty', category: 'Beauty' };
  return {};
}
