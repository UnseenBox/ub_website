import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreLinks } from "@/components/games/store-links";
import { Gallery } from "@/components/media/gallery";
import { Trailer } from "@/components/media/trailer";
import { ArrowIcon } from "@/components/ui/icons";
import { SectionLabel } from "@/components/ui/section-label";
import { SmartImage } from "@/components/ui/smart-image";
import { getContent, getGameBySlug, getGames } from "@/lib/content/queries";
import { platformList } from "@/lib/content/present";
import { parseTrailer, statusStage } from "@/lib/games";
import { LOCALES, isLocale, localePath, t } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveImageSrc } from "@/lib/images/drive";
import { absoluteUrl, buildMetadata, jsonLd } from "@/lib/seo";
import { cn, formatDate, pad, paragraphs } from "@/lib/utils";

export async function generateStaticParams() {
  const { games } = await getContent();
  return LOCALES.flatMap((locale) => games.map((game) => ({ locale, slug: game.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/games/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const game = await getGameBySlug(slug);
  if (!game) return {};
  return buildMetadata({
    locale,
    path: `/games/${game.slug}`,
    title: `${game.title} — ${t(game.genre, locale)}`,
    description: t(game.summary, locale),
    image: game.cover,
  });
}

export default async function GamePage({ params }: PageProps<"/[locale]/games/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const [dict, game, games] = await Promise.all([getDictionary(locale), getGameBySlug(slug), getGames()]);
  if (!game) notFound();

  const trailer = parseTrailer(game.trailerUrl);
  const siblings = games.filter((g) => g.upcoming === game.upcoming);
  const next = siblings[(siblings.findIndex((g) => g.id === game.id) + 1) % siblings.length];
  const notes = [...game.devNotes].sort((a, b) => b.date.localeCompare(a.date));
  const progress = Math.max(0, Math.min(100, game.progress ?? 0));
  const accent = game.accent || "#8f5bff";

  const details = [
    [dict.showcase.genre, t(game.genre, locale)],
    [dict.showcase.platforms, platformList(game, dict)],
    [dict.showcase.status, dict.game.statuses[game.status]],
    game.upcoming
      ? [dict.game.estimated, t(game.estimatedRelease, locale)]
      : [dict.game.releaseDate, formatDate(game.releaseDate, locale)],
    ...(game.engine ? [[dict.game.engine, game.engine]] : []),
  ].filter(([, value]) => value);

  const structured = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: t(game.summary, locale),
    url: absoluteUrl(localePath(locale, `/games/${game.slug}`)),
    image: [game.cover, game.poster].map((src) => {
      const resolved = resolveImageSrc(src) ?? "";
      return resolved.startsWith("/") ? absoluteUrl(resolved) : resolved;
    }),
    genre: t(game.genre, "en"),
    gamePlatform: game.platforms.map((p) => dict.game.platforms[p]),
    ...(game.releaseDate ? { datePublished: game.releaseDate } : {}),
    author: { "@type": "Organization", name: "UnseenBox" },
    publisher: { "@type": "Organization", name: "UnseenBox" },
    inLanguage: locale,
    ...(trailer?.kind === "youtube"
      ? {
          trailer: {
            "@type": "VideoObject",
            name: `${game.title} — ${dict.game.trailer}`,
            embedUrl: `https://www.youtube.com/embed/${trailer.id}`,
            thumbnailUrl: `https://i.ytimg.com/vi/${trailer.id}/hqdefault.jpg`,
            uploadDate: game.updatedAt,
          },
        }
      : {}),
  };

  return (
    <article style={{ "--accent": accent } as React.CSSProperties}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />

      {/* Cinematic opening */}
      <header className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <SmartImage
            src={game.cover}
            alt=""
            sizes="100vw"
            preload
            className={cn("animate-fade", game.upcoming && "[image-rendering:auto] saturate-[0.8]")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-void/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-void/80 to-transparent rtl:bg-gradient-to-l" />
          <div className="scanlines absolute inset-0 opacity-25" />
        </div>

        <div className="shell flex flex-1 flex-col pb-12 pt-28 sm:pb-16 sm:pt-32">
          <Link
            href={localePath(locale, game.upcoming ? "/upcoming" : "/games")}
            className="label group inline-flex items-center gap-2 self-start hover:text-bone"
          >
            <ArrowIcon className="size-3.5 -scale-x-100 transition-transform group-hover:-translate-x-1 rtl:scale-x-100 rtl:group-hover:translate-x-1" />
            {game.upcoming ? dict.upcoming.all : dict.game.back}
          </Link>

          <div className="mt-auto grid gap-10 pt-24 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-end">
            <div>
              <p className="label flex items-center gap-3 animate-fade">
                <span className="size-2" style={{ background: accent }} aria-hidden />
                {dict.game.statuses[game.status]} · {t(game.genre, locale)}
              </p>
              <h1 className="font-display mt-5 text-mega">
                <span className="line-mask">
                  <span className="animate-rise [animation-delay:100ms]">{game.title}</span>
                </span>
              </h1>
              <p className="mt-6 max-w-2xl animate-fade text-xl text-bone/90 [animation-delay:300ms] sm:text-2xl">
                {t(game.tagline, locale)}
              </p>
              <div className="mt-10 animate-fade [animation-delay:450ms]">
                <StoreLinks links={game.links} dict={dict} />
              </div>
            </div>
            <div className="frame relative hidden aspect-[2/3] w-full animate-fade overflow-hidden bg-ink-800 shadow-[0_40px_80px_-30px_#000] [animation-delay:500ms] lg:block">
              <SmartImage src={game.poster} alt={game.title} sizes="16rem" />
            </div>
          </div>
        </div>
      </header>

      {/* Details rail */}
      <section aria-label={dict.game.details} className="border-y border-line bg-ink-950/80">
        <dl className="shell grid grid-cols-2 gap-6 py-8 sm:grid-cols-3 lg:grid-cols-5">
          {details.map(([term, value]) => (
            <div key={term}>
              <dt className="label">{term}</dt>
              <dd className="mt-1.5 text-sm text-bone sm:text-base">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* About */}
      <section className="shell grid gap-12 py-24 sm:py-32 lg:grid-cols-[1fr_1.6fr] lg:gap-24">
        <div>
          <SectionLabel index="∎">{dict.game.about}</SectionLabel>
          <p data-reveal className="font-display mt-8 text-3xl leading-tight text-balance sm:text-4xl">
            {t(game.summary, locale)}
          </p>
        </div>
        <div className="space-y-6 text-lg leading-relaxed text-bone/80">
          {paragraphs(t(game.description, locale)).map((p, i) => (
            <p key={i} data-reveal>
              {p}
            </p>
          ))}
          {game.features.length > 0 && (
            <div className="pt-8">
              <p className="label mb-4">{dict.game.features}</p>
              <ul className="border-t border-line">
                {game.features.map((feature, i) => (
                  <li key={i} data-reveal className="flex gap-5 border-b border-line py-4 text-base">
                    <span className="font-pixel pt-1 text-xs" style={{ color: accent }}>
                      {pad(i + 1)}
                    </span>
                    {t(feature, locale)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Development (upcoming only) */}
      {game.upcoming && (
        <section aria-labelledby="devlog" className="border-t border-line bg-ink-950 py-24 sm:py-32">
          <div className="shell grid gap-14 lg:grid-cols-[1fr_1.6fr] lg:gap-24">
            <div>
              <SectionLabel index="∎">{dict.game.progress}</SectionLabel>
              <p className="font-pixel mt-8 text-7xl text-uv-300" dir="ltr">
                {progress}%
              </p>
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={dict.game.progress}
                className="mt-6 flex gap-1"
              >
                {Array.from({ length: 20 }, (_, i) => (
                  <span key={i} className={cn("h-4 flex-1", i < Math.round(progress / 5) ? "bg-uv-500" : "bg-ink-700")} />
                ))}
              </div>
              <ol className="mt-8 flex flex-wrap gap-x-4 gap-y-2">
                {dict.upcoming.stages.map((stage, i) => (
                  <li
                    key={stage}
                    aria-current={i === statusStage(game.status) ? "step" : undefined}
                    className={cn(
                      "font-pixel text-[0.65rem] uppercase",
                      i === statusStage(game.status) ? "text-uv-300" : i < statusStage(game.status) ? "text-mist" : "text-fog/50",
                    )}
                  >
                    {i <= statusStage(game.status) ? "■" : "□"} {stage}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h2 id="devlog" className="label mb-6">
                {dict.upcoming.devlog}
              </h2>
              {notes.length === 0 ? (
                <p className="text-mist">{dict.upcoming.noNotes}</p>
              ) : (
                <ol className="border-s border-line-strong">
                  {notes.map((note) => (
                    <li key={note.id} data-reveal className="relative pb-10 ps-8 last:pb-0">
                      <span aria-hidden className="absolute -start-[5px] top-1.5 size-2.5 bg-uv-500" />
                      <time dateTime={note.date} className="font-pixel text-xs text-uv-300" dir="ltr">
                        {note.date}
                      </time>
                      <p className="mt-2 max-w-2xl font-mono text-sm leading-relaxed text-bone/85">{t(note.text, locale)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Trailer */}
      {trailer && (
        <section id="trailer" aria-labelledby="trailer-heading" className="scroll-mt-20 border-t border-line py-24 sm:py-32">
          <div className="shell">
            <h2 id="trailer-heading" className="label mb-8">
              {dict.game.trailer}
            </h2>
            <Trailer source={trailer} poster={game.screenshots[0] ?? game.cover} title={game.title} playLabel={dict.a11y.playTrailer} />
          </div>
        </section>
      )}

      {/* Screenshots */}
      {game.screenshots.length > 0 && (
        <section aria-labelledby="shots" className="overflow-hidden border-t border-line py-24 sm:py-32">
          <div className="shell">
            <h2 id="shots" className="label mb-8">
              {dict.game.screenshots}
            </h2>
            <Gallery images={game.screenshots} altPrefix={game.title} copy={dict.a11y} />
          </div>
        </section>
      )}

      {/* Next world */}
      {next && next.id !== game.id && (
        <Link
          href={localePath(locale, `/games/${next.slug}`)}
          className="group relative isolate block overflow-hidden border-t border-line"
          data-cursor={dict.game.next}
        >
          <div aria-hidden className="absolute inset-0 -z-10 opacity-40 transition-opacity duration-700 group-hover:opacity-70">
            <SmartImage src={next.cover} alt="" sizes="100vw" quality={60} />
            <div className="absolute inset-0 bg-gradient-to-t from-void via-void/50 to-void/80" />
          </div>
          <div className="shell flex flex-col gap-4 py-24 sm:py-36">
            <p className="label">{dict.game.next}</p>
            <p className="font-display flex items-center gap-6 text-giga transition-transform duration-700 ease-expo group-hover:translate-x-3 rtl:group-hover:-translate-x-3">
              {next.title}
              <ArrowIcon className="size-[0.6em] text-uv-400" />
            </p>
            <p className="max-w-xl text-mist">{t(next.tagline, locale)}</p>
          </div>
        </Link>
      )}
    </article>
  );
}
