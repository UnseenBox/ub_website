import Link from "next/link";
import { ReviewForm } from "@/components/community/review-form";
import { Stars } from "@/components/community/stars";
import { localePath } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { formatDate } from "@/lib/utils";
import type { Locale, RatingSummary, Review } from "@/types/content";

/**
 * One game's rating, its latest approved reviews and the form to add one —
 * shown under the game itself so players can rate it where they played it.
 */
export function GameReviews({
  game,
  rating,
  reviews,
  dict,
  locale,
  headingId,
}: {
  game: { id: string; title: string };
  rating?: RatingSummary;
  reviews: Review[];
  dict: Dictionary;
  locale: Locale;
  headingId: string;
}) {
  const copy = dict.community;

  return (
    <div className="grid gap-16 text-start lg:grid-cols-[1.2fr_1fr] lg:gap-24">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 id={headingId} className="label">
            {copy.reviewsTitle}
          </h2>
          <Link href={localePath(locale, "/community")} className="label hover:text-uv-300">
            {copy.allReviews} →
          </Link>
        </div>

        {rating && (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <span className="font-display text-5xl" dir="ltr">
              {rating.average.toFixed(1)}
            </span>
            <div className="grid gap-1.5">
              <Stars value={rating.average} label={`${rating.average.toFixed(1)} ${copy.outOf}`} starClassName="size-5" />
              <span className="label">
                {rating.count} {rating.count === 1 ? copy.reviewCountOne : copy.reviewCount}
              </span>
            </div>
          </div>
        )}

        {reviews.length === 0 ? (
          <p className="mt-8 text-lg text-mist">{copy.empty}</p>
        ) : (
          <ul className="mt-10 grid gap-px bg-line">
            {reviews.map((review) => (
              <li key={review.id} className="bg-void py-6 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Stars value={review.rating} label={`${review.rating} ${copy.outOf}`} />
                    <span className="font-display text-lg">{review.name}</span>
                  </div>
                  <time dateTime={review.createdAt} className="font-mono text-xs uppercase tracking-[0.14em] text-fog">
                    {formatDate(review.createdAt.slice(0, 10), locale)}
                  </time>
                </div>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-mist">{review.body}</p>
                {review.reply && (
                  <div className="mt-4 border-s-2 border-uv-500/60 ps-4">
                    <p className="label text-uv-300">{copy.studioReply}</p>
                    <p className="mt-1.5 whitespace-pre-line leading-relaxed text-mist">{review.reply}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="lg:sticky lg:top-28 lg:self-start">
        <ReviewForm copy={copy} locale={locale} games={[game]} />
      </div>
    </div>
  );
}
