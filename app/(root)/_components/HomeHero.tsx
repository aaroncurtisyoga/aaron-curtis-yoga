import Link from "next/link";
import ImageResponsiveHandstand from "@/app/(root)/_components/ImageResponsiveHandstand";

export default function HomeHero() {
  return (
    <section
      data-testid="home-hero"
      className="relative overflow-hidden bg-navy"
    >
      {/* Photo panel — natural color; vertical image fits the vertical slot */}
      <div className="absolute inset-y-0 right-0 hidden w-[46%] md:block">
        <ImageResponsiveHandstand />
        <div
          className="absolute inset-0 bg-gradient-to-r from-navy via-navy/15 to-transparent"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-navy/60 to-transparent"
          aria-hidden="true"
        />
      </div>

      {/* Type panel — same centered container as the rest of the page */}
      <div className="relative z-10 mx-auto flex w-full max-w-screen-2xl flex-col justify-end px-4 pb-16 pt-24 md:min-h-[72vh] md:px-6 md:pb-24 md:pt-32 lg:px-12">
        <div className="md:max-w-[50%]">
          <h1 className="max-w-[11ch] font-display text-6xl uppercase leading-[0.98] text-white sm:text-7xl lg:text-8xl">
            An honest <span className="text-sky">practice.</span>
          </h1>
          <p className="mt-5 text-base font-medium lowercase tracking-wide text-white/75 md:text-lg">
            yoga, movement &amp; sound — washington, dc
          </p>
          <Link
            href="/#this-week"
            className="mt-9 inline-block bg-cta px-10 py-4 font-display text-lg uppercase tracking-[0.08em] text-white transition hover:brightness-90"
          >
            Begin
          </Link>
        </div>
      </div>
    </section>
  );
}
