/**
 * CampusCut Assets Barrel Export
 * 
 * This file provides centralized exports for all assets.
 * Import assets using: import { LogoIcon } from '@assets'
 */

// ============ LOGOS ============
export { default as Logo1 } from './logos/Logo1.png';
export { default as Logo2 } from './logos/Logo2.png';
export { default as Logo3 } from './logos/Logo3.png';
export { default as Logo4 } from './logos/Logo4.png';

// Primary logo (Chair Logo - Main Brand Logo)
export { default as CampusCutLogo } from './logos/Main_Chair.png';

// ============ ICONS ============
export { default as ScissorsIcon } from './icons/scissors.svg';
export { default as BarberPoleIcon } from './icons/barber-pole.svg';
export { default as CalendarIcon } from './icons/calendar.svg';

// ============ IMAGES ============
export { default as PlaceholderBarber } from './images/placeholder-barber.svg';
export { default as PlaceholderPortfolio } from './images/placeholder-portfolio.svg';

// ============ ASSET PATHS (for dynamic imports) ============
export const ASSET_PATHS = {
  logos: {
    campusCuts: '/src/assets/logos/campus-cuts-logo.svg',
  },
  icons: {
    scissors: '/src/assets/icons/scissors.svg',
    barberPole: '/src/assets/icons/barber-pole.svg',
    calendar: '/src/assets/icons/calendar.svg',
  },
  images: {
    placeholderBarber: '/src/assets/images/placeholder-barber.svg',
    placeholderPortfolio: '/src/assets/images/placeholder-portfolio.svg',
  },
} as const;

// ============ HELPER FUNCTIONS ============

/**
 * Get asset URL for a given path
 */
export const getAssetUrl = (relativePath: string): string => {
  return new URL(relativePath, import.meta.url).href;
};

/**
 * Preload an image asset
 */
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Preload multiple images
 */
export const preloadImages = async (sources: string[]): Promise<void[]> => {
  return Promise.all(sources.map(preloadImage));
};

