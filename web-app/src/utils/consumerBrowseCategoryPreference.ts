import type { BrowseProviderCategory } from '../config/providerCategories';
import { BROWSE_PROVIDER_CATEGORIES } from '../config/providerCategories';

const BROWSE_CATEGORY_KEY = 'consumer.browse.providerCategory';

export const BROWSE_CATEGORY_CHANGED_EVENT = 'oncuts-browse-provider-category-changed';

const VALID_IDS = new Set<BrowseProviderCategory>(
  BROWSE_PROVIDER_CATEGORIES.map((option) => option.id),
);

/** Map legacy stored ids (Haircuts) to current browse ids. */
function normalizeStoredBrowseCategory(raw: string): BrowseProviderCategory | null {
  if (raw === 'Haircuts' || raw === 'haircuts') return 'Barber';
  if (VALID_IDS.has(raw as BrowseProviderCategory)) {
    return raw as BrowseProviderCategory;
  }
  return null;
}

export function getBrowseProviderCategory(): BrowseProviderCategory {
  try {
    const raw = localStorage.getItem(BROWSE_CATEGORY_KEY);
    if (raw) {
      const normalized = normalizeStoredBrowseCategory(raw);
      if (normalized) {
        if (raw !== normalized) {
          localStorage.setItem(BROWSE_CATEGORY_KEY, normalized);
        }
        return normalized;
      }
    }
  } catch {
    // ignore
  }
  return 'all';
}

export function setBrowseProviderCategory(category: BrowseProviderCategory): void {
  if (!VALID_IDS.has(category)) return;
  localStorage.setItem(BROWSE_CATEGORY_KEY, category);
  window.dispatchEvent(new CustomEvent(BROWSE_CATEGORY_CHANGED_EVENT, { detail: category }));
}
