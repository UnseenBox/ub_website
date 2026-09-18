import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { localePath, type Locale } from "@/lib/i18n/config";
import { LinkButton } from "@/components/ui/link-button";
import { ArrowDownIcon } from "@/components/ui/icons";
import { HeroField } from "./hero-field";

export function Hero({ locale, dict, foundedYear }: { locale: Locale; dict: Dictionary; foundedYear: string }) {
  const { hero } = dict;
  const lines = hero.lines;

  return (
    <section aria-labelledby="hero-title" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      <HeroField words={hero.hidden} />

      {/* A soft pool of light across the middle of the void. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[62%] -z-10">
        <div className="mx-auto h-24 w-3/4 -translate-y-1/2 animate-fade bg-[radial-gradient(50%_50%_at_50%_50%,rgb(143_91_255/0.28),transparent)] [animation-delay:600ms]" />
      </div>

      <div className="shell relative flex flex-1 flex-col pb-8 pt-24 sm:pb-10 sm:pt-32">
        <ol className="flex flex-col gap-2 sm:flex-row sm:gap-8" aria-label={hero.channels.join(", ")}>
          {hero.channels.map((channel, i) => (
            <li
              key={channel}
              className="label flex animate-fade items-center gap-2"
              style={{ animationDelay: `${900 + i * 140}ms` }}
            >
              <span className="font-pixel text-uv-400">CH.0{i + 1}</span>
              <span className="text-bone/80">{channel}</span>
            </li>
          ))}
        </ol>

        <h1
          id="hero-title"
          className="font-display mt-auto pt-16 text-mega uppercase [overflow-wrap:anywhere] sm:pt-24 rtl:normal-case"
        >
          {lines.map((line, i) => {
            const isLast = i === lines.length - 1;
            return (
              <span key={line} className="line-mask">
                <span className="animate-rise" style={{ animationDelay: `${150 + i * 130}ms` }}>
                  {isLast ? (
                    <span className="inline-flex items-end gap-[0.08em]">
                      <span className="bg-gradient-to-r from-bone via-uv-300 to-uv-500 bg-clip-text text-transparent rtl:bg-gradient-to-l">
                        {line}
                      </span>
                      <span aria-hidden className="mb-[0.12em] inline-block h-[0.62em] w-[0.14em] animate-blink bg-uv-500" />
                    </span>
                  ) : (
                    line
                  )}
                </span>
              </span>
            );
          })}
        </h1>

        <div className="mt-10 grid animate-fade gap-8 [animation-delay:900ms] sm:mt-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <p className="max-w-xl text-base leading-relaxed text-mist sm:text-lg">{hero.intro}</p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href={`${localePath(locale)}#worlds`} cursor={hero.ctaPrimary}>
              {hero.ctaPrimary}
            </LinkButton>
            <LinkButton href={localePath(locale, "/contact")} variant="ghost">
              {hero.ctaSecondary}
            </LinkButton>
          </div>
        </div>

        <div className="label mt-10 flex animate-fade items-center justify-between gap-4 border-t border-line pt-5 [animation-delay:1200ms]">
          <span>
            N°001 — {hero.est} {foundedYear}
          </span>
          <a href="#manifesto" className="group hidden items-center gap-2 transition-colors hover:text-bone sm:flex">
            <ArrowDownIcon className="size-3.5 transition-transform duration-500 group-hover:translate-y-1" />
            {hero.scroll}
          </a>
          <span className="font-pixel hidden text-uv-400 [@media(pointer:fine)]:inline">{hero.hint}</span>
        </div>
      </div>
    </section>
  );
}
