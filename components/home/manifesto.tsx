import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { SectionLabel } from "@/components/ui/section-label";
import { ScrollWords } from "@/components/motion/scroll-words";

export function Manifesto({ dict, text, foundedYear }: { dict: Dictionary; text: string; foundedYear: string }) {
  const disciplines = [...dict.about.disciplines, ...dict.about.disciplines];

  return (
    <section id="manifesto" aria-label={dict.manifesto.label} className="relative scroll-mt-20 py-28 sm:py-44">
      <div className="shell">
        <SectionLabel index="∎">{dict.manifesto.label}</SectionLabel>
        <ScrollWords text={text} className="font-display mt-10 max-w-[18ch] text-title text-balance sm:max-w-6xl" />
        <p className="label mt-10">
          — UnseenBox, {dict.hero.est} {foundedYear}
        </p>
      </div>

      <div aria-hidden className="mt-24 overflow-hidden border-y border-line py-5 sm:mt-32">
        <div className="marquee [--marquee-duration:55s]">
          {disciplines.map((item, i) => (
            <span key={i} className="flex items-center gap-8 pe-8 font-display text-2xl text-fog sm:text-4xl">
              {item}
              <span className="size-2 bg-uv-500/80" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
