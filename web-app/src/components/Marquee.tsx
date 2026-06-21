import calPolyLogo from '../assets/logos/CalPoly_Logo.png';
import csufLogo from '../assets/logos/CSUF_Logo.png';
import uclaLogo from '../assets/logos/UCLA_Logo.png';
import calLogo from '../assets/logos/Cal_Logo.png';

const SCHOOL_LOGOS = [
  { src: calPolyLogo, alt: 'Cal Poly' },
  { src: csufLogo, alt: 'CSU Fullerton' },
  { src: uclaLogo, alt: 'UCLA' },
  { src: calLogo, alt: 'UC Berkeley' },
] as const;

/** Repeat enough times so one strip always fills the viewport (prevents gaps mid-loop). */
const REPEAT_COUNT = 8;

type LogoEntry = (typeof SCHOOL_LOGOS)[number] & { id: string };

function buildLogoStrip(): LogoEntry[] {
  return Array.from({ length: REPEAT_COUNT }, (_, repeatIndex) =>
    SCHOOL_LOGOS.map((logo) => ({
      ...logo,
      id: `${logo.alt}-${repeatIndex}`,
    }))
  ).flat();
}

const LOGO_STRIP = buildLogoStrip();

function LogoStrip({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center"
      aria-hidden={ariaHidden || undefined}
    >
      {LOGO_STRIP.map((logo) => (
        <div
          key={logo.id}
          className="flex shrink-0 items-center justify-center px-8 sm:px-12"
        >
          <img
            src={logo.src}
            alt={ariaHidden ? '' : logo.alt}
            className="h-10 sm:h-12 w-auto max-w-[140px] object-contain grayscale opacity-70 transition-all duration-300 hover:grayscale-0 hover:opacity-100"
            loading="eager"
            decoding="async"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}

export default function Marquee() {
  return (
    <section
      className="border-y border-gray-100 bg-white py-10 sm:py-12"
      aria-label="Partner universities"
    >
      <p className="mb-8 text-center text-xs font-medium uppercase tracking-widest text-gray-400 sm:text-sm">
        Currently Servicing These Campuses
      </p>

      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max animate-marquee will-change-transform">
          <LogoStrip />
          <LogoStrip ariaHidden />
        </div>
      </div>
    </section>
  );
}
