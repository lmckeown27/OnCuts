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
  mobileDescription: string;
  appLogo: string;
  appLogoAlt: string;
  storeHref: string;
  storeLabel: string;
};

function AppStoreBadge({ href, label }: { href: string; label: string }) {
  const badge = (
    <div className="inline-flex max-w-full items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-white shadow-md transition-transform hover:scale-[1.02] sm:gap-3 sm:rounded-xl sm:px-5 sm:py-3">
      <img
        src={appleWhiteLogo}
        alt=""
        className="h-5 w-5 shrink-0 object-contain sm:h-7 sm:w-7"
        aria-hidden="true"
        decoding="async"
      />
      <div className="min-w-0 text-left leading-tight">
        <p className="text-[8px] uppercase tracking-wide text-white/80 sm:text-[10px]">Download on the</p>
        <p className="text-sm font-semibold sm:text-lg">App Store</p>
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
        className="inline-block max-w-full"
      >
        {badge}
      </a>
    );
  }

  return (
    <div aria-label={`${label} — App Store link coming soon`} className="inline-block max-w-full cursor-default">
      {badge}
    </div>
  );
}

function AppCard({
  title,
  description,
  mobileDescription,
  appLogo,
  appLogoAlt,
  storeHref,
  storeLabel,
}: AppCardProps) {
  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 md:p-8">
      <div className="mb-3 flex items-center gap-2 sm:mb-5 sm:gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 sm:h-11 sm:w-11">
          <img
            src={appLogo}
            alt={appLogoAlt}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
        <h3 className="text-sm font-bold leading-tight text-gray-900 sm:text-lg md:text-xl">{title}</h3>
      </div>

      <p className="mb-4 flex-grow text-xs leading-snug text-gray-600 md:hidden">
        {mobileDescription}
      </p>
      <p className="mb-8 hidden flex-grow text-sm leading-relaxed text-gray-600 md:block md:text-base">
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

        <div className="grid grid-cols-2 gap-3 sm:gap-6 md:gap-8">
          <AppCard
            title="CampusCuts"
            mobileDescription="Book campus barbers."
            description="Download CampusCuts to find your university's barbers, browse their work, and book a cut on campus."
            appLogo={campusCutsAppLogo}
            appLogoAlt="CampusCuts app icon"
            storeHref={IOS_APP_STORE_LINKS.consumer}
            storeLabel="Download CampusCuts on the App Store"
          />
          <AppCard
            title="InteraProvider"
            mobileDescription="For campus barbers."
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
