import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { localePath, t, type Locale } from "@/lib/i18n/config";
import type { StudioInfo } from "@/types/content";
import { LinkButton } from "@/components/ui/link-button";
import { SectionLabel } from "@/components/ui/section-label";
import { SmartImage } from "@/components/ui/smart-image";

export function StudioTeaser({
  locale,
  dict,
  studio,
  image,
}: {
  locale: Locale;
  dict: Dictionary;
  studio: StudioInfo;
  image?: string;
}) {
  const beliefs = studio.beliefs.slice(0, 3);

  return (
    <section aria-labelledby="studio-teaser" className="shell py-28 sm:py-40">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <div className="relative">
          <SectionLabel index="05">{dict.about.label}</SectionLabel>
          <h2 id="studio-teaser" data-reveal className="font-display mt-8 text-title text-balance">
            {dict.about.title}
          </h2>
          {image && (
            <div data-reveal="aperture" className="frame relative mt-12 aspect-[4/3] overflow-hidden bg-ink-800">
              <SmartImage src={image} alt="" sizes="(min-width: 1024px) 45vw, 100vw" />
              <div aria-hidden className="scanlines absolute inset-0 opacity-30" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-end">
          <p data-reveal className="text-lg leading-relaxed text-mist sm:text-xl">
            {t(studio.intro, locale).split(/\n\s*\n/)[0]}
          </p>
          <ol className="mt-12 border-t border-line">
            {beliefs.map((belief, i) => (
              <li
                key={belief.id}
                data-reveal
                style={{ "--reveal-delay": i * 90 } as React.CSSProperties}
                className="grid grid-cols-[2.5rem_1fr] gap-4 border-b border-line py-6"
              >
                <span className="font-pixel pt-1 text-xs text-uv-400">0{i + 1}</span>
                <div>
                  <h3 className="font-display text-xl sm:text-2xl">{t(belief.title, locale)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mist">{t(belief.text, locale)}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <LinkButton href={localePath(locale, "/about")} variant="ghost">
              {dict.about.teaserCta}
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
