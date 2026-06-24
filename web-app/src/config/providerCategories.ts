import type { ServiceProviderCategory } from '../types/service-provider';

export type BrowseProviderCategory = 'all' | ServiceProviderCategory;

export type BrowseProviderCategoryOption = {
  id: BrowseProviderCategory;
  label: string;
  description: string;
};

/** Consumer browse category chips — aligned with Intera ServiceProviderCategory. */
export const BROWSE_PROVIDER_CATEGORIES: BrowseProviderCategoryOption[] = [
  {
    id: 'all',
    label: 'All',
    description: 'Every provider type',
  },
  {
    id: 'Haircuts',
    label: 'Haircuts',
    description: 'Barbers and hair stylists',
  },
  {
    id: 'Beauty',
    label: 'Beauty',
    description: 'Makeup, nails, lashes, and more',
  },
  {
    id: 'Wellness',
    label: 'Wellness',
    description: 'Massage and wellness services',
  },
  {
    id: 'Fitness',
    label: 'Fitness',
    description: 'Trainers and fitness coaches',
  },
];

export function browseCategoryApiParam(
  category: BrowseProviderCategory,
): { category?: ServiceProviderCategory } {
  if (category === 'all') return {};
  return { category };
}
