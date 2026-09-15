import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/ui/link-button";
import { PageIntro } from "@/components/ui/page-intro";
import { SectionLabel } from "@/components/ui/section-label";
import { SmartImage } from "@/components/ui/smart-image";
import { getContent } from "@/lib/content/queries";
import { isLocale, localePath, t } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo";
import { pad, paragraphs } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return buildMetadata({ locale, path: "/about", title: dict.meta.about, description: dict.meta.aboutDescription });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [dict, content] = await Promise.all([getDictionary(locale), getContent()]);
  const { studio, games } = content;
  const [lede, ...rest] = paragraphs(t(studio.intro, locale));
  const imagery = games.flatMap((game) => game.screenshots.slice(1, 2)).slice(0, 3);

  return (
    <>
      <PageIntro index="05" label={dict.about.label} title={dict.about.title} lede={lede} />

      {/* Manifesto + story */}
      <section className="shell grid gap-14 py-24 sm:py-32 lg:grid-cols-[1.3fr_1fr] lg:gap-24">
        <blockquote data-reveal className="font-display text-title text-balance">
          <span aria-hidden className="text-uv-500">“</span>
          {t(studio.manifesto, locale)}
          <span aria-hidden className="text-uv-500">”</span>
        </blockquote>
        <div className="space-y-6 self-end text-lg leading-relaxed text-mist">
          {rest.map((p, i) => (
            <p key={i} data-reveal>
              {p}
            </p>
          ))}
        </div>
      </section>

      {imagery.length > 0 && (
        <div aria-hidden className="shell grid grid-cols-3 gap-3 sm:gap-6">
          {imagery.map((src, i) => (
            <div
              key={src}
              data-reveal="aperture"
              style={{ "--reveal-delay": i * 140 } as React.CSSProperties}
              className={i === 1 ? "relative aspect-[3/4] overflow-hidden sm:translate-y-16" : "relative aspect-[3/4] overflow-hidden"}
            >
              <SmartImage src={src} alt="" sizes="33vw" quality={60} />
            </div>
          ))}
        </div>
      )}

      {/* Beliefs */}
      <section aria-labelledby="beliefs" className="shell py-28 sm:py-40">
        <SectionLabel index="∎">{dict.about.beliefsLabel}</SectionLabel>
        <h2 id="beliefs" className="sr-only">
          {dict.about.beliefsLabel}
        </h2>
        <ol className="mt-12 grid border-t border-line md:grid-cols-2">
          {studio.beliefs.map((belief, i) => (
            <li
              key={belief.id}
              data-reveal
              className="group border-b border-line py-10 md:odd:border-e md:odd:pe-10 md:even:ps-10"
            >
              <span className="font-pixel text-sm text-uv-400">{pad(i + 1)}</span>
              <h3 className="font-display mt-4 text-3xl transition-colors group-hover:text-uv-300 sm:text-4xl">
                {t(belief.title, locale)}
              </h3>
              <p className="mt-4 max-w-md leading-relaxed text-mist">{t(belief.text, locale)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Approach */}
      <section aria-labelledby="approach" className="border-y border-line bg-ink-950 py-24 sm:py-32">
        <div className="shell grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-24">
          <div>
            <SectionLabel index="∎">{dict.about.approachLabel}</SectionLabel>
            <h2 id="approach" className="sr-only">
              {dict.about.approachLabel}
            </h2>
            <ul className="mt-10 flex flex-wrap gap-2" aria-label={dict.about.disciplinesLabel}>
              {dict.about.disciplines.map((item) => (
                <li key={item} className="border border-line px-3 py-1.5 font-mono text-xs text-mist">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p data-reveal className="font-display text-3xl leading-snug text-bone/90 sm:text-4xl">
            {t(studio.approach, locale)}
          </p>
        </div>
      </section>

      {/* Timeline */}
      {studio.timeline.length > 0 && (
        <section aria-labelledby="timeline" className="py-24 sm:py-32">
          <div className="shell">
            <SectionLabel index="∎">{dict.about.timelineLabel}</SectionLabel>
            <h2 id="timeline" className="sr-only">
              {dict.about.timelineLabel}
            </h2>
          </div>
          <ol
            tabIndex={0}
            aria-label={dict.about.timelineLabel}
            className="scrollbar-none relative mt-14 flex snap-x gap-0 overflow-x-auto px-[clamp(1rem,4vw,3.5rem)] pb-6 focus-visible:outline-offset-[-4px]"
          >
            {studio.timeline.map((milestone, i) => (
              <li key={milestone.id} className="group relative w-[78vw] shrink-0 snap-start pe-8 sm:w-[24rem]">
                <div aria-hidden className="relative mb-8 h-px bg-line-strong">
                  <span className="absolute -top-[5px] start-0 size-[11px] border border-uv-400 bg-void transition-colors group-hover:bg-uv-500" />
                </div>
                <p className="font-pixel text-5xl text-uv-300/90 sm:text-6xl" dir="ltr">
                  {milestone.year}
                </p>
                <h3 className="font-display mt-5 text-2xl">{t(milestone.title, locale)}</h3>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-mist">{t(milestone.text, locale)}</p>
                {i === studio.timeline.length - 1 && (
                  <span className="label mt-4 inline-flex items-center gap-2 text-uv-300">
                    <span className="size-1.5 rounded-full bg-uv-500 animate-pulse-uv" aria-hidden />
                    now
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Ambition */}
      <section aria-labelledby="ambition" className="relative isolate overflow-hidden border-t border-line py-28 sm:py-40">
        <div aria-hidden className="uv-glow pointer-events-none absolute inset-0 -z-10" />
        <div className="shell">
          <SectionLabel index="∎">{dict.about.ambitionLabel}</SectionLabel>
          <h2 id="ambition" data-reveal className="font-display mt-10 max-w-6xl text-title text-balance">
            {t(studio.ambition, locale)}
          </h2>
          <div className="mt-12">
            <LinkButton href={localePath(locale, "/contact")}>{dict.footer.cta}</LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
