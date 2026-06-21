import type { ReactNode } from 'react';
import { Bell, Calendar, MessageCircle, Scissors, Smartphone, Wallet } from 'lucide-react';

/** Set these when App Store URLs are ready. */
export const IOS_APP_STORE_LINKS = {
  consumer: '',
  barber: '',
} as const;

type AppCardProps = {
  title: string;
  subtitle: string;
  features: { icon: ReactNode; label: string }[];
  storeHref: string;
  storeLabel: string;
};

function AppStoreBadge({ href, label }: { href: string; label: string }) {
  const badge = (
    <div className="inline-flex items-center gap-3 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-md transition-transform hover:scale-[1.02]">
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
        <path d="M16.365 1.43c0 1.14-.467 2.223-1.207 3.04-.788.867-2.086 1.538-3.243 1.447-.152-1.09.402-2.248 1.113-3.012.74-.793 2.028-1.396 3.145-1.475h.192zm4.09 16.763c-.74 1.604-1.087 2.325-2.034 3.747-1.316 1.986-3.172 4.463-5.476 4.477-1.048.008-1.757-.337-2.593-.337-.852 0-2.234.347-3.405.318-1.716-.037-3.3-1.002-4.616-2.988-2.574-3.726-2.855-10.195-1.256-14.676.792-2.155 2.204-3.577 3.872-3.607 1.015-.02 1.973.352 2.872.352.867 0 2.498-.434 4.212-.37 1.716.033 2.928.708 3.843 1.805-3.39 2.053-2.84 7.396.572 8.91-.67 1.746-1.534 3.47-2.646 5.369z" />
      </svg>
      <div className="text-left leading-tight">
        <p className="text-[10px] uppercase tracking-wide text-white/80">Download on the</p>
        <p className="text-lg font-semibold">App Store</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className="inline-block"
      >
        {badge}
      </a>
    );
  }

  return (
    <div aria-label={`${label} — App Store link coming soon`} className="inline-block cursor-default">
      {badge}
    </div>
  );
}

function AppCard({ title, subtitle, features, storeHref, storeLabel }: AppCardProps) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <Smartphone className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 sm:text-xl">{title}</h3>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>

      <ul className="mb-8 space-y-3">
        {features.map((feature) => (
          <li key={feature.label} className="flex items-center gap-3 text-sm text-gray-600">
            <span className="text-primary-500">{feature.icon}</span>
            {feature.label}
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        <AppStoreBadge href={storeHref} label={storeLabel} />
        {!storeHref && (
          <p className="mt-3 text-xs text-gray-400">App Store link coming soon</p>
        )}
      </div>
    </article>
  );
}

export default function IosAppPromoSection() {
  return (
    <section
      className="border-y border-white/60 bg-gradient-to-br from-primary-50 via-white to-pink-50 px-4 py-10 sm:py-12"
      aria-label="Download the CampusCuts iOS apps"
      id="ios-apps"
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center sm:mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-600 sm:text-sm">
            Now on iOS
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl md:text-4xl">
            Take CampusCuts wherever you go
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-600 sm:text-base">
            Book cuts, manage your schedule, and get paid — all from native iOS apps built for campus life.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          <AppCard
            title="CampusCuts"
            subtitle="For students & customers"
            storeHref={IOS_APP_STORE_LINKS.consumer}
            storeLabel="Download CampusCuts on the App Store"
            features={[
              { icon: <Scissors className="h-4 w-4" />, label: 'Browse and book campus barbers' },
              { icon: <MessageCircle className="h-4 w-4" />, label: 'Message your barber directly' },
              { icon: <Wallet className="h-4 w-4" />, label: 'Pay securely after your cut' },
            ]}
          />
          <AppCard
            title="CampusCuts for Barbers"
            subtitle="For student barbers"
            storeHref={IOS_APP_STORE_LINKS.barber}
            storeLabel="Download CampusCuts for Barbers on the App Store"
            features={[
              { icon: <Calendar className="h-4 w-4" />, label: 'Manage bookings and availability' },
              { icon: <Bell className="h-4 w-4" />, label: 'Get notified for new requests' },
              { icon: <Wallet className="h-4 w-4" />, label: 'Track earnings and payouts' },
            ]}
          />
        </div>
      </div>
    </section>
  );
}
