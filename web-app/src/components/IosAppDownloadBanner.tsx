import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { IOS_APP_STORE_LINKS } from './IosAppPromoSection';
import onCutsAppLogo from '../assets/logos/OnCuts_Logo.png';
import interaProviderAppLogo from '../assets/logos/iOS_InteraProvider_Logo.png';
import { isAppInstalled, isIOSDevice } from '../utils/appUtils';
import { useViewport } from '../hooks';

type IosAppDownloadBannerProps = {
  /** Consumer booking flow → OnCuts; provider schedule → OnCuts Operator */
  variant: 'consumer' | 'operator';
};

const DISMISS_KEYS = {
  consumer: 'oncuts_ios_app_banner_dismissed_consumer',
  operator: 'oncuts_ios_app_banner_dismissed_operator',
} as const;

const COPY = {
  consumer: {
    title: 'Get the OnCuts app',
    subtitle: 'Open in the OnCuts app',
    href: IOS_APP_STORE_LINKS.consumer,
    cta: 'Open',
    logo: onCutsAppLogo,
    logoAlt: 'OnCuts app',
  },
  operator: {
    title: 'Get OnCuts Operator',
    subtitle: 'Open in the OnCuts Operator app',
    href: IOS_APP_STORE_LINKS.interaProvider,
    cta: 'Open',
    logo: interaProviderAppLogo,
    logoAlt: 'OnCuts Operator app',
  },
} as const;

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // private mode / quota
  }
}

/**
 * Top-of-flow App Store prompt for iOS Safari (mobile viewport, not installed PWA).
 * Dismiss persists per flow in localStorage.
 */
export default function IosAppDownloadBanner({ variant }: IosAppDownloadBannerProps) {
  const { isMobile, isTablet } = useViewport();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const compactScreen = isMobile || isTablet;
    const shouldShow =
      typeof window !== 'undefined' &&
      isIOSDevice() &&
      !isAppInstalled() &&
      compactScreen &&
      !readDismissed(DISMISS_KEYS[variant]);
    setVisible(shouldShow);
  }, [variant, isMobile, isTablet]);

  if (!visible) return null;

  const copy = COPY[variant];

  const dismiss = () => {
    writeDismissed(DISMISS_KEYS[variant]);
    setVisible(false);
  };

  return (
    <div
      className="sticky top-0 z-40 border-b border-black bg-black text-white"
      role="region"
      aria-label={copy.title}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:px-4">
        <a
          href={copy.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <img
            src={copy.logo}
            alt={copy.logoAlt}
            className="h-10 w-10 shrink-0 rounded-[10px] object-cover"
            decoding="async"
          />
          <span className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-white">{copy.title}</p>
            <p className="truncate text-xs text-white/70">{copy.subtitle}</p>
          </span>
        </a>
        <a
          href={copy.href}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full bg-[#007AFF] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0066d6] active:scale-[0.98]"
        >
          {copy.cta}
        </a>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Dismiss app download banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
