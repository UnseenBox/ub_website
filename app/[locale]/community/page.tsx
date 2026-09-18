import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/community/review-form";
import { Stars } from "@/components/community/stars";
import { StoreLinks } from "@/components/games/store-links";
import { PageIntro } from "@/components/ui/page-intro";
import { SectionLabel } from "@/components/ui/section-label";
import { getApprovedReviews, getGames, getRatings } from "@/lib/content/queries";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/community">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return buildMetadata({
    locale,
    path: "/community",
    title: dict.meta.community,
    description: dict.meta.communityDescription,
  });
}

export default async function CommunityPage({ params }: PageProps<"/[locale]/community">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [dict, games, reviews, ratings] = await Promise.all([
    getDictionary(locale),
    getGames(),
    getApprovedReviews(),
    getRatings(),
  ]);

  const copy = dict.community;
  const released = games.filter((game) => !game.upcoming);
  const rated = released
    .map((game) => ({ game, summary: ratings.get(game.id) }))
    .sort((a, b) => (b.summary?.average ?? -1) - (a.summary?.average ?? -1));

  const countLabel = (count: number) => `${count} ${count === 1 ? copy.reviewCountOne : copy.reviewCount}`;

  return (
    <>
      <PageIntro index="05" label={copy.label} title={copy.title} lede={copy.intro} />

      {/* Ratings per game */}
      <section className="shell py-20 sm:py-24" aria-label={copy.averageTitle}>
        <SectionLabel index="01">{copy.averageTitle}</SectionLabel>
        <ul className="mt-10 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {rated.map(({ game, summary }) => (
            <li key={game.id} className="flex flex-col gap-4 bg-ink-950 p-6">
              <Link href={localePath(locale, `/games/${game.slug}`)} className="font-display text-2xl hover:text-uv-300">
                {game.title}
              </Link>
              {summary ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Stars
                    value={summary.average}
                    label={`${summary.average.toFixed(1)} ${copy.outOf}`}
                    starClassName="size-5"
                  />
                  <span className="font-mono text-sm text-bone">{summary.average.toFixed(1)}</span>
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-fog">
                    {countLabel(summary.count)}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-fog">{copy.noRatings}</p>
              )}
              <StoreLinks links={game.links} dict={dict} className="mt-auto pt-2" />
            </li>
          ))}
        </ul>
      </section>

      {/* Reviews + form */}
      <section className="shell grid gap-16 border-t border-line py-20 sm:py-28 lg:grid-cols-[1.2fr_1fr] lg:gap-24">
        <div>
          <SectionLabel index="02">{copy.reviewsTitle}</SectionLabel>
          {reviews.length === 0 ? (
            <p className="mt-10 text-lg text-mist">{copy.empty}</p>
          ) : (
            <ul className="mt-10 grid gap-px bg-line">
              {reviews.map((review) => (
                <li key={review.id} className="bg-ink-950 py-8 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Stars value={review.rating} label={`${review.rating} ${copy.outOf}`} />
                      <span className="font-display text-xl">{review.name}</span>
                    </div>
                    <time dateTime={review.createdAt} className="font-mono text-xs uppercase tracking-[0.14em] text-fog">
                      {formatDate(review.createdAt.slice(0, 10), locale)}
                    </time>
                  </div>
                  <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-uv-300">
                    <Link href={localePath(locale, `/games/${review.gameSlug}`)} className="hover:underline">
                      {review.gameTitle}
                    </Link>
                  </p>
                  <p className="mt-4 whitespace-pre-line leading-relaxed text-mist">{review.body}</p>
                  {review.reply && (
                    <div className="mt-5 border-s-2 border-uv-500/60 ps-5">
                      <p className="label text-uv-300">{copy.studioReply}</p>
                      <p className="mt-2 whitespace-pre-line leading-relaxed text-mist">{review.reply}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          <ReviewForm
            copy={copy}
            locale={locale}
            games={released.map((game) => ({ id: game.id, title: game.title }))}
          />
        </div>
      </section>
    </>
  );
}
