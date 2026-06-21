import appleWhiteLogo from '../assets/logos/Apple_White_Logo.svg.png';
import campusCutsAppLogo from '../assets/logos/iOS_CampusCuts_Logo.png';
import interaProviderAppLogo from '../assets/logos/iOS_InteraProvider_Logo.png';

export const IOS_APP_STORE_LINKS = {
  consumer: 'https://apps.apple.com/us/app/campuscuts/id6763953203',
  interaProvider: 'https://apps.apple.com/us/app/interaprovider/id6770430152',
} as const;

type AppCardProps = {
  title: string;
  description: string;
  appLogo: string;
  appLogoAlt: string;
  storeHref: string;
  storeLabel: string;
};

function AppStoreBadge({ href, label }: { href: string; label: string }) {
  const badge = (
    <div className="inline-flex items-center gap-3 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-md transition-transform hover:scale-[1.02]">
      <img
        src={appleWhiteLogo}
        alt=""
        className="h-7 w-7 object-contain"
        aria-hidden="true"
        decoding="async"
      />
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

function AppCard({ title, description, appLogo, appLogoAlt, storeHref, storeLabel }: AppCardProps) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50">
          <img
            src={appLogo}
            alt={appLogoAlt}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
        <h3 className="text-lg font-bold text-gray-900 sm:text-xl">{title}</h3>
      </div>

      <p className="mb-8 flex-grow text-sm leading-relaxed text-gray-600 sm:text-base">
        {description}
      </p>

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
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl md:text-4xl">
            CampusCuts on iOS
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          <AppCard
            title="CampusCuts"
            description="Download CampusCuts to find your university's barbers, browse their work, and book a cut on campus."
            appLogo={campusCutsAppLogo}
            appLogoAlt="CampusCuts app icon"
            storeHref={IOS_APP_STORE_LINKS.consumer}
            storeLabel="Download CampusCuts on the App Store"
          />
          <AppCard
            title="InteraProvider"
            description="Already an established campus barber? Join InteraProvider and connect with an established university network of customers ready to book."
            appLogo={interaProviderAppLogo}
            appLogoAlt="InteraProvider app icon"
            storeHref={IOS_APP_STORE_LINKS.interaProvider}
            storeLabel="Download InteraProvider on the App Store"
          />
        </div>
      </div>
    </section>
  );
}
