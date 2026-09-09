const VALUES = [
  {
    name: "Breath",
    blurb:
      "Every practice starts and ends here. When in doubt, come back to it.",
  },
  {
    name: "Move",
    blurb:
      "My flows lean power — and there’s always an option for where you’re at today.",
  },
  {
    name: "Sound",
    blurb: "Handpan, bowls, and a few quiet moments to integrate and return.",
  },
];

export default function HomeIntro() {
  return (
    <section data-testid="home-intro" className="bg-background py-14 md:py-20">
      <div className="mx-auto w-full max-w-screen-2xl px-4 md:px-6 lg:px-12">
        <p className="max-w-[36ch] text-2xl font-medium leading-normal text-foreground md:text-3xl">
          Hey ~ I&rsquo;m Aaron. I teach yoga around DC &mdash; sunrise flows,
          power-leaning vinyasa, and lately a lot of sound: handpan, bowls, and
          live sound baths.{" "}
          <span className="bg-gradient-to-t from-[#c3daf9] from-[38%] to-transparent to-[38%] font-semibold">
            Space to move, breathe, connect.
          </span>
        </p>

        <div className="mt-14 grid grid-cols-1 gap-x-7 gap-y-9 border-t border-border pt-11 sm:grid-cols-3">
          {VALUES.map((value) => (
            <div key={value.name}>
              <div className="h-[5px] w-7 bg-primary" aria-hidden="true" />
              <h3 className="mt-3 font-display text-xl uppercase tracking-[0.05em] text-foreground">
                {value.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {value.blurb}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
