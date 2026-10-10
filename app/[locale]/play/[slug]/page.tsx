import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/ads/ad-slot";
import { GameReviews } from "@/components/community/game-reviews";
import { Stars } from "@/components/community/stars";
import { GamePlayer } from "@/components/play/game-player";
import { GameTile } from "@/components/play/game-tile";
import { MoodIcon } from "@/components/play/icons";
import { ArrowIcon } from "@/components/ui/icons";
import { getApprovedReviews, getRatings } from "@/lib/content/queries";
import { LOCALES, isLocale, localePath, t } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { PLAYABLE_GAMES, findPlayable, playGamePath, playReviewId } from "@/lib/play";
import { presentPlayables } from "@/lib/play-portal";
import { absoluteUrl, buildMetadata, jsonLd } from "@/lib/seo";
import { formatDate } from "@/lib/utils";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => PLAYABLE_GAMES.map((game) => ({ locale, slug: game.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/play/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const game = findPlayable(slug);
  if (!game) return {};
  return buildMetadata({
    locale,
    path: playGamePath(game),
    title: `${game.title}: ${t(game.genre, locale)}`,
    description: t(game.summary, locale),
    image: game.poster,
  });
}

export default async function PlayGamePage({ params }: PageProps<"/[locale]/play/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const game = findPlayable(slug);
  if (!game) notFound();

  const [dict, reviews, ratings] = await Promise.all([getDictionary(locale), getApprovedReviews(), getRatings()]);
  const copy = dict.play;
  const reviewId = playReviewId(game);
  const rating = ratings.get(reviewId);
  const genre = t(game.genre, locale);
  const playHref = localePath(locale, "/play");

  // Every other game, starting with the one listed after this one.
  const all = presentPlayables(locale, ratings);
  const at = all.findIndex((item) => item.slug === game.slug);
  const next = [...all.slice(at + 1), ...all.slice(0, at)];

  const facts = [
    [dict.showcase.genre, genre],
    [dict.showcase.released, formatDate(game.added, locale, { year: "numeric", month: "long" })],
    [dict.showcase.platforms, copy.platformsValue],
    [copy.price, copy.priceValue],
  ];
  const controls = [
    [copy.computer, t(game.desktopControls, locale)],
    [copy.phone, t(game.phoneControls, locale)],
  ];

  const structured = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: t(game.summary, locale),
    url: absoluteUrl(localePath(locale, playGamePath(game))),
    image: absoluteUrl(game.poster),
    genre: t(game.genre, "en"),
    gamePlatform: "Web browser",
    applicationCategory: "Game",
    operatingSystem: "Any",
    datePublished: game.added,
    offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
    author: { "@type": "Organization", name: "UnseenBox" },
    publisher: { "@type": "Organization", name: "UnseenBox" },
    ...(rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.average.toFixed(1),
            reviewCount: rating.count,
          },
        }
      : {}),
  };

  return (
    <div className="relative isolate overflow-x-clip bg-[#180e38]">
      <div aria-hidden className="uv-glow pointer-events-none absolute inset-x-0 -top-72 -z-10 h-[46rem] opacity-60" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_12%_0%,rgb(245_184_61/0.32),transparent_70%),radial-gradient(55%_45%_at_88%_8%,rgb(255_95_122/0.3),transparent_70%),radial-gradient(65%_55%_at_50%_45%,rgb(90_169_255/0.24),transparent_72%),radial-gradient(55%_50%_at_8%_92%,rgb(63_208_192/0.24),transparent_70%),radial-gradient(60%_55%_at_92%_95%,rgb(176_139_255/0.32),transparent_70%),radial-gradient(40%_35%_at_50%_100%,rgb(125_220_111/0.16),transparent_70%)]"
      />
      <div className="shell pb-24 pt-20 sm:pb-28 sm:pt-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />

      <nav aria-label={copy.breadcrumb} className="mb-4">
        <ol className="flex items-center gap-2 text-sm text-mist">
          <li>
            <Link href={playHref} className="text-uv-300 hover:text-uv-400 hover:underline">
              {copy.label}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="min-w-0 truncate text-bone">
            <span dir="ltr">{game.title}</span>
          </li>
        </ol>
      </nav>

      <div className="grid gap-x-6 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <GamePlayer
            slug={game.slug}
            title={game.title}
            genre={genre}
            src={game.src}
            poster={game.poster}
            rating={rating?.average}
            reviewsHref="#reviews"
            copy={{
              start: copy.start,
              fullscreen: copy.fullscreen,
              newTab: copy.newTab,
              close: copy.close,
              externalLink: dict.a11y.externalLink,
            }}
          />

          <article className="mt-6 rounded-2xl bg-ink-900 p-6 ring-1 ring-line sm:p-8">
            <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
              <div className="min-w-0">
                <h1 className="font-display text-3xl sm:text-5xl">
                  <span dir="ltr">{game.title}</span>
                </h1>
                <p className="mt-2 text-lg text-uv-300">{genre}</p>
              </div>
              <a
                href="#reviews"
                className="flex min-h-11 items-center gap-3 rounded-full bg-ink-800 px-4 py-2 ring-1 ring-line transition-colors hover:bg-ink-700"
              >
                {rating ? (
                  <>
                    <Stars value={rating.average} label={`${rating.average.toFixed(1)} ${dict.community.outOf}`} />
                    <span className="font-semibold text-white" dir="ltr">
                      {rating.average.toFixed(1)}
                    </span>
                    <span className="text-sm text-mist">
                      {rating.count} {rating.count === 1 ? dict.community.reviewCountOne : dict.community.reviewCount}
                    </span>
                  </>
                ) : (
                  <>
                    <span aria-hidden>
                      <Stars value={0} label="" />
                    </span>
                    <span className="text-sm text-mist">{dict.community.noRatings}</span>
                  </>
                )}
              </a>
            </header>

            <p className="mt-6 max-w-3xl leading-relaxed text-bone/85 sm:text-lg">{t(game.summary, locale)}</p>

            <ul className="mt-6 flex flex-wrap gap-2">
              {game.moods.map((mood) => (
                <li
                  key={mood}
                  className="flex items-center gap-2 rounded-full bg-ink-800 py-1.5 pe-3.5 ps-3 text-sm text-bone ring-1 ring-line"
                >
                  <MoodIcon mood={mood} className="size-4 text-uv-300" />
                  {copy.moods[mood]}
                </li>
              ))}
            </ul>

            <dl className="mt-8 grid gap-x-10 border-t border-line lg:grid-cols-2">
              {facts.map(([term, value]) => (
                <div key={term} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 border-b border-line py-3.5 text-sm">
                  <dt className="text-mist">{term}</dt>
                  <dd className="font-medium text-bone">{value}</dd>
                </div>
              ))}
            </dl>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {controls.map(([term, value]) => (
                <div key={term} className="rounded-xl bg-ink-800 p-5">
                  <dt className="text-sm font-semibold text-uv-300">{term}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-bone/85">{value}</dd>
                </div>
              ))}
            </dl>
          </article>
        </div>

        {next.length > 0 && (
          <aside aria-labelledby="play-next" className="lg:sticky lg:top-24 lg:self-start">
            <h2 id="play-next" className="text-xl font-semibold tracking-tight text-white">
              {copy.playNext}
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-1">
              {next.map((item) => (
                <li key={item.slug}>
                  <GameTile
                    game={item}
                    copy={{ start: copy.start, badges: copy.badges }}
                    sizes="(min-width: 1024px) 20rem, 50vw"
                    className="aspect-video"
                  />
                </li>
              ))}
            </ul>
            <Link
              href={playHref}
              className="mt-4 flex h-11 items-center justify-center gap-2 rounded-full bg-ink-800 text-sm font-semibold text-bone ring-1 ring-line transition-colors hover:bg-ink-700"
            >
              {copy.allGames}
              <ArrowIcon className="size-4" />
            </Link>
            <AdSlot format="rectangle" label={copy.ad} className="mt-4" />
          </aside>
        )}
      </div>

      <AdSlot format="horizontal" label={copy.ad} className="mt-10" />

      <section
        id="reviews"
        aria-labelledby="reviews-heading"
        className="mt-10 scroll-mt-24 rounded-2xl p-6 ring-1 ring-line sm:p-8 lg:p-10"
      >
        <GameReviews
          game={{ id: reviewId, title: game.title }}
          rating={rating}
          reviews={reviews.filter((review) => review.gameId === reviewId).slice(0, 6)}
          dict={dict}
          locale={locale}
          headingId="reviews-heading"
        />
      </section>
      </div>
    </div>
  );
}
