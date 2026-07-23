import appleWhiteLogo from '../assets/logos/Apple_White_Logo.svg.png';
import onCutsAppLogo from '../assets/logos/OnCuts_Logo.png';
import interaProviderAppLogo from '../assets/logos/iOS_InteraProvider_Logo.png';

export const IOS_APP_STORE_LINKS = {
  consumer: 'https://apps.apple.com/us/app/oncuts/id6789238174',
  interaProvider: 'https://apps.apple.com/us/app/oncuts-operator/id6789008195',
} as const;

type AppCardProps = {
  title: string;
  appLogo: string;
  appLogoAlt: string;
  storeHref: string;
  storeLabel: string;
};

function AppStoreBadge() {
  return (
    <div className="inline-flex max-w-full items-center gap-2.5 rounded-xl bg-gray-900 px-4 py-2.5 text-white shadow-md transition-transform duration-300 group-hover/card:scale-[1.02] sm:gap-3.5 sm:rounded-2xl sm:px-6 sm:py-3.5">
      <img
        src={appleWhiteLogo}
        alt=""
        className="h-6 w-6 shrink-0 object-contain sm:h-8 sm:w-8"
        aria-hidden="true"
        decoding="async"
      />
      <div className="min-w-0 text-left leading-tight">
        <p className="text-[9px] uppercase tracking-wide text-white/80 sm:text-xs">Download on the</p>
        <p className="text-base font-semibold sm:text-xl">App Store</p>
      </div>
    </div>
  );
}

const cardBaseClassName =
  'group/card flex h-full min-w-0 w-full flex-col items-center text-center rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 sm:p-8 md:p-10';

function AppCardContent({
  title,
  appLogo,
  appLogoAlt,
  storeHref,
}: Omit<AppCardProps, 'storeLabel'>) {
  return (
    <>
      <div className="mb-5 flex flex-col items-center transition-transform duration-300 group-hover/card:scale-[1.02] sm:mb-7">
        <div className="mb-3 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-50 sm:mb-4 sm:h-20 sm:w-20 md:h-24 md:w-24">
          <img
            src={appLogo}
            alt={appLogoAlt}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
        <h4 className="text-base font-bold leading-tight text-gray-900 sm:text-xl md:text-2xl">{title}</h4>
      </div>

      <div className="mt-auto flex w-full justify-center">
        <AppStoreBadge />
        {!storeHref && (
          <p className="mt-3 text-sm text-gray-400">App Store link coming soon</p>
        )}
      </div>
    </>
  );
}

function AppCard({ title, appLogo, appLogoAlt, storeHref, storeLabel }: AppCardProps) {
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
          appLogo={appLogo}
          appLogoAlt={appLogoAlt}
          storeHref={storeHref}
        />
      </a>
    );
  }

  return (
    <article className={cardBaseClassName} aria-label={`${storeLabel}: App Store link coming soon`}>
      <AppCardContent
        title={title}
        appLogo={appLogo}
        appLogoAlt={appLogoAlt}
        storeHref={storeHref}
      />
    </article>
  );
}

type AppColumnProps = {
  heading: string;
  card: AppCardProps;
};

function AppColumn({ heading, card }: AppColumnProps) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <h3 className="mb-4 text-center text-base font-bold text-gray-900 underline underline-offset-4 sm:mb-5 sm:text-lg md:text-xl">
        {heading}
      </h3>
      <AppCard {...card} />
    </div>
  );
}

export default function IosAppPromoSection() {
  return (
    <section
      className="border-y border-white/60 bg-gradient-to-br from-primary-50 via-white to-pink-50 px-4 py-14 sm:py-16"
      aria-label="Download the OnCuts iOS apps"
      id="ios-apps"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center sm:mb-12">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl md:text-5xl">
            OnCuts on iOS
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-8 md:gap-10">
          <AppColumn
            heading="For Clients"
            card={{
              title: 'OnCuts',
              appLogo: onCutsAppLogo,
              appLogoAlt: 'OnCuts app icon',
              storeHref: IOS_APP_STORE_LINKS.consumer,
              storeLabel: 'Download OnCuts on the App Store',
            }}
          />
          <AppColumn
            heading="For Operators"
            card={{
              title: 'OnCuts Operator',
              appLogo: interaProviderAppLogo,
              appLogoAlt: 'OnCuts Provider app icon',
              storeHref: IOS_APP_STORE_LINKS.interaProvider,
              storeLabel: 'Download OnCuts Provider on the App Store',
            }}
          />
        </div>
      </div>
    </section>
  );
}
