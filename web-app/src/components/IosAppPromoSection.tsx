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

function AppStoreBadge() {
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-white shadow-md transition-transform duration-300 group-hover/card:scale-[1.02] sm:gap-3 sm:rounded-xl sm:px-5 sm:py-3">
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
}

const cardBaseClassName =
  'group/card flex h-full min-w-0 flex-col items-center text-center rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 sm:p-6 md:p-8';

function AppCardContent({
  title,
  description,
  mobileDescription,
  appLogo,
  appLogoAlt,
  storeHref,
}: Omit<AppCardProps, 'storeLabel'>) {
  return (
    <>
      <div className="mb-3 flex flex-col items-center transition-transform duration-300 group-hover/card:scale-[1.02] sm:mb-5">
        <div className="mb-2 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 sm:mb-3 sm:h-11 sm:w-11">
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
      <p className="mb-6 hidden flex-grow text-sm leading-snug text-gray-600 md:block">
        {description}
      </p>

      <div className="mt-auto flex w-full justify-center">
        <AppStoreBadge />
        {!storeHref && (
          <p className="mt-3 text-xs text-gray-400">App Store link coming soon</p>
        )}
      </div>
    </>
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
  if (storeHref) {
    return (
      <a
        href={storeHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={storeLabel}
        className={`${cardBaseClassName} cursor-pointer no-underline`}
      >
        <AppCardContent
          title={title}
          description={description}
          mobileDescription={mobileDescription}
          appLogo={appLogo}
          appLogoAlt={appLogoAlt}
          storeHref={storeHref}
        />
      </a>
    );
  }

  return (
    <article className={cardBaseClassName} aria-label={`${storeLabel} — App Store link coming soon`}>
      <AppCardContent
        title={title}
        description={description}
        mobileDescription={mobileDescription}
        appLogo={appLogo}
        appLogoAlt={appLogoAlt}
        storeHref={storeHref}
      />
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
            description="Browse campus barbers and book your next cut."
            appLogo={campusCutsAppLogo}
            appLogoAlt="CampusCuts app icon"
            storeHref={IOS_APP_STORE_LINKS.consumer}
            storeLabel="Download CampusCuts on the App Store"
          />
          <AppCard
            title="InteraProvider"
            mobileDescription="For campus barbers."
            description="Manage bookings and reach campus customers."
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
