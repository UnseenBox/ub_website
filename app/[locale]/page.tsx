import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Hero } from "@/components/home/hero";
import { Manifesto } from "@/components/home/manifesto";
import { WorldsShowcase } from "@/components/home/worlds-showcase";
import { ServicesIndex } from "@/components/home/services-index";
import { StudioTeaser } from "@/components/home/studio-teaser";
import { SignalCard } from "@/components/games/signal-card";
import { ArchiveStrip } from "@/components/experiences/archive-strip";
import { SectionLabel } from "@/components/ui/section-label";
import { getContent } from "@/lib/content/queries";
import { toArchiveItem, toServiceItem, toShowcaseItem, toSignalItem } from "@/lib/content/present";
import { isLocale, localePath, t } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { absoluteUrl, buildMetadata, jsonLd } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return buildMetadata({
    locale,
    path: "/",
    title: dict.meta.homeTitle,
    description: dict.meta.homeDescription,
    absoluteTitle: true,
  });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, content] = await Promise.all([getDictionary(locale), getContent()]);
  const { studio } = content;
  const games = [...content.games].sort((a, b) => a.order - b.order);
  const released = games.filter((game) => !game.upcoming);
  const featured = released.filter((game) => game.featured);
  const showcase = (featured.length >= 2 ? [...featured, ...released.filter((g) => !g.featured)] : released).slice(0, 6);
  const upcoming = games.filter((game) => game.upcoming).slice(0, 3);
  const services = [...content.services].sort((a, b) => a.order - b.order);
  const archive = [...content.experiences].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: studio.name,
    url: absoluteUrl(localePath(locale)),
    logo: absoluteUrl("/icon.svg"),
    email: studio.email,
    foundingDate: studio.foundedYear,
    description: t(studio.tagline, locale),
    address: { "@type": "PostalAddress", addressLocality: t(studio.city, "en"), addressCountry: t(studio.country, "en") },
    sameAs: studio.socials.map((s) => s.url).filter(Boolean),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organization)} />

      <Hero locale={locale} dict={dict} foundedYear={studio.foundedYear} />
      <Manifesto dict={dict} text={t(studio.manifesto, locale)} foundedYear={studio.foundedYear} />

      <WorldsShowcase
        items={showcase.map((game) => toShowcaseItem(game, locale, dict))}
        copy={dict.showcase}
        allHref={localePath(locale, "/games")}
      />

      {upcoming.length > 0 && (
        <section aria-labelledby="in-the-dark" className="relative py-28 sm:py-40">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-uv-500/60 to-transparent" />
          <div className="shell">
            <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-end">
              <div>
                <SectionLabel index="02">{dict.upcoming.label}</SectionLabel>
                <h2 id="in-the-dark" data-reveal className="font-display mt-8 text-giga text-balance">
                  {dict.upcoming.title}
                </h2>
              </div>
              <div className="flex flex-col items-start gap-6 lg:items-end lg:text-end">
                <p data-reveal className="max-w-md text-mist">
                  {dict.upcoming.intro}
                </p>
                <Link href={localePath(locale, "/upcoming")} className="label hover:text-bone">
                  {dict.upcoming.all} →
                </Link>
              </div>
            </div>
            <div className="mt-16">
              {upcoming.map((game, i) => (
                <SignalCard key={game.id} item={toSignalItem(game, locale, dict)} copy={dict.upcoming} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="services-heading" className="border-t border-line bg-ink-950 py-28 sm:py-40">
        <div className="shell">
          <div className="mb-16 grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-end">
            <div>
              <SectionLabel index="03">{dict.services.label}</SectionLabel>
              <h2 id="services-heading" data-reveal className="font-display mt-8 text-giga text-balance">
                {dict.services.title}
              </h2>
            </div>
            <p data-reveal className="max-w-md text-mist lg:justify-self-end">
              {dict.services.intro}
            </p>
          </div>
          <ServicesIndex
            items={services.map((service) => toServiceItem(service, locale))}
            copy={dict.services}
            startHref={localePath(locale, "/contact")}
          />
        </div>
      </section>

      {archive.length > 0 && (
        <section aria-labelledby="archive-heading" className="overflow-hidden py-28 sm:py-40">
          <div className="shell mb-14 flex flex-wrap items-end justify-between gap-6">
            <div>
              <SectionLabel index="04">{dict.experiences.label}</SectionLabel>
              <h2 id="archive-heading" data-reveal className="font-display mt-8 text-giga">
                {dict.experiences.title}
              </h2>
              <p className="mt-5 max-w-md text-mist">{dict.experiences.intro}</p>
            </div>
            <Link href={localePath(locale, "/experiences")} className="label hover:text-bone">
              {dict.experiences.all} →
            </Link>
          </div>
          <ArchiveStrip
            items={archive.map((item) => toArchiveItem(item, locale, dict))}
            copy={{ previous: dict.a11y.previous, next: dict.a11y.next, drag: dict.experiences.drag }}
          />
        </section>
      )}

      <div className="border-t border-line">
        <StudioTeaser locale={locale} dict={dict} studio={studio} image={released[0]?.screenshots[2]} />
      </div>
    </>
  );
}
