import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameReviews } from "@/components/community/game-reviews";
import { Stars } from "@/components/community/stars";
import { GamePlayer } from "@/components/games/game-player";
import { PageIntro } from "@/components/ui/page-intro";
import { isLocale, t } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getApprovedReviews, getRatings } from "@/lib/content/queries";
import { PLAYABLE_GAMES, playReviewId } from "@/lib/play";
import { buildMetadata } from "@/lib/seo";
import { pad } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/play">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return buildMetadata({
    locale,
    path: "/play",
    title: dict.meta.play,
    description: dict.meta.playDescription,
    image: PLAYABLE_GAMES[0]?.poster,
  });
}

export default async function PlayPage({ params }: PageProps<"/[locale]/play">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [dict, reviews, ratings] = await Promise.all([getDictionary(locale), getApprovedReviews(), getRatings()]);
  const copy = dict.play;

  return (
    <>
      <PageIntro
        index="02"
        label={copy.label}
        title={copy.title}
        lede={copy.intro}
        aside={
          <p className="label flex items-center gap-3">
            <span className="size-2 rounded-full bg-uv-500 animate-pulse-uv" aria-hidden />
            <span className="font-pixel text-2xl text-bone" dir="ltr">
              {pad(PLAYABLE_GAMES.length)}
            </span>
            {copy.count}
          </p>
        }
      />

      <section className="shell pb-28" aria-label={copy.label}>
        {PLAYABLE_GAMES.map((game, i) => {
          const reviewId = playReviewId(game);
          const rating = ratings.get(reviewId);
          return (
            <article key={game.slug} id={game.slug} className="scroll-mt-20 border-b border-line py-14 sm:py-20">
              <div className="mx-auto w-full max-w-5xl">
                <GamePlayer
                  title={game.title}
                  src={game.src}
                  poster={game.poster}
                  copy={{
                    start: copy.start,
                    fullscreen: copy.fullscreen,
                    newTab: copy.newTab,
                    close: copy.close,
                    externalLink: dict.a11y.externalLink,
                  }}
                />
              </div>

              <div className="mx-auto mt-12 w-full max-w-3xl text-center">
                <p className="label flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                  <span className="font-pixel text-uv-400">{pad(i + 1)}</span>
                  <span>{t(game.genre, locale)}</span>
                </p>
                <h2 className="font-display mt-3 text-title" dir="ltr">
                  <span className="glitch" data-text={game.title}>
                    {game.title}
                  </span>
                </h2>
                <a
                  href={`#${game.slug}-reviews`}
                  className="mt-4 inline-flex items-center gap-3 hover:text-uv-300"
                >
                  {rating ? (
                    <>
                      <Stars
                        value={rating.average}
                        label={`${rating.average.toFixed(1)} ${dict.community.outOf}`}
                        starClassName="size-5"
                      />
                      <span className="font-mono text-sm text-bone">{rating.average.toFixed(1)}</span>
                      <span className="label">
                        {rating.count} {rating.count === 1 ? dict.community.reviewCountOne : dict.community.reviewCount}
                      </span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden>
                        <Stars value={0} label="" starClassName="size-5" />
                      </span>
                      <span className="label">{dict.community.noRatings}</span>
                    </>
                  )}
                </a>
                <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-mist">{t(game.summary, locale)}</p>

                <ul className="mt-7 flex flex-wrap justify-center gap-2">
                  {copy.tags.map((tag) => (
                    <li key={tag} className="label border border-line-strong px-3 py-1.5 text-bone">
                      {tag}
                    </li>
                  ))}
                </ul>

                <dl className="mt-10 grid gap-8 border-t border-line pt-8 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="label">{copy.computer}</dt>
                    <dd className="mt-2 text-bone/85">{t(game.desktopControls, locale)}</dd>
                  </div>
                  <div>
                    <dt className="label">{copy.phone}</dt>
                    <dd className="mt-2 text-bone/85">{t(game.phoneControls, locale)}</dd>
                  </div>
                </dl>
              </div>

              <section
                id={`${game.slug}-reviews`}
                aria-labelledby={`${game.slug}-reviews-heading`}
                className="mx-auto mt-16 w-full max-w-5xl scroll-mt-20 border-t border-line pt-14"
              >
                <GameReviews
                  game={{ id: reviewId, title: game.title }}
                  rating={rating}
                  reviews={reviews.filter((review) => review.gameId === reviewId).slice(0, 6)}
                  dict={dict}
                  locale={locale}
                  headingId={`${game.slug}-reviews-heading`}
                />
              </section>
            </article>
          );
        })}

        <p className="pt-10 text-center text-mist">{copy.more}</p>
      </section>
    </>
  );
}
