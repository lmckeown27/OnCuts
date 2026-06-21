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

function LogoStrip() {
  return (
    <>
      {SCHOOL_LOGOS.map((logo) => (
        <div
          key={logo.alt}
          className="flex shrink-0 items-center justify-center px-8 sm:px-12"
        >
          <img
            src={logo.src}
            alt={logo.alt}
            className="h-10 sm:h-12 w-auto max-w-[140px] object-contain grayscale opacity-70 transition-all duration-300 hover:grayscale-0 hover:opacity-100"
            loading="lazy"
            decoding="async"
          />
        </div>
      ))}
    </>
  );
}

export default function Marquee() {
  return (
    <section
      className="border-y border-gray-100 bg-white py-10 sm:py-12"
      aria-label="Partner universities"
    >
      <p className="mb-8 text-center text-xs font-medium uppercase tracking-widest text-gray-400 sm:text-sm">
        On campuses nationwide
      </p>

      <div
        className="group/marquee relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
      >
        <div className="flex w-max animate-marquee group-hover/marquee:[animation-play-state:paused]">
          <LogoStrip />
          <LogoStrip />
        </div>
      </div>
    </section>
  );
}
