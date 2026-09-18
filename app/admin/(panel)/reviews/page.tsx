import type { Metadata } from "next";
import { ReviewActions } from "@/components/admin/review-actions";
import { requireAdmin } from "@/lib/auth/guard";
import { listReviews } from "@/lib/content/mutations";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reviews" };

/** Five characters, so a rating is readable at a glance in the list. */
function stars(rating: number) {
  return "★★★★★".slice(0, rating) + "☆☆☆☆☆".slice(0, 5 - rating);
}

export default async function ReviewsPage() {
  await requireAdmin();
  const reviews = await listReviews().catch(() => []);
  const pending = reviews.filter((review) => review.status === "pending");
  const approved = reviews.filter((review) => review.status === "approved");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Reviews</h1>
        <p className="text-sm text-zinc-600">
          Player ratings from the community page. Nothing is public until you approve it.
        </p>
      </header>

      <Section
        title={`Waiting for approval (${pending.length})`}
        empty="Nothing waiting. New reviews land here."
        reviews={pending}
      />
      <Section title={`Published (${approved.length})`} empty="No published reviews yet." reviews={approved} />
    </div>
  );
}

function Section({
  title,
  empty,
  reviews,
}: {
  title: string;
  empty: string;
  reviews: Awaited<ReturnType<typeof listReviews>>;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">{title}</h2>
      {reviews.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          {empty}
        </p>
      ) : (
        <ul className="grid gap-3">
          {reviews.map((review) => (
            <li
              key={review.id}
              className={cn(
                "rounded-lg border bg-white p-5",
                review.status === "pending" ? "border-amber-300 shadow-sm" : "border-zinc-200",
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <span className="text-amber-500" aria-label={`${review.rating} out of 5`}>
                    {stars(review.rating)}
                  </span>
                  {review.name}
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-600">
                    {review.gameTitle}
                  </span>
                  {review.email && <span className="text-sm font-normal text-zinc-500">{review.email}</span>}
                </p>
                <p className="text-xs text-zinc-500">
                  {new Date(review.createdAt).toLocaleString("en-GB")} · {review.locale.toUpperCase()}
                </p>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700" dir="auto">
                {review.body}
              </p>

              {review.reply && (
                <p className="mt-3 border-s-2 border-violet-300 ps-3 text-sm text-zinc-600" dir="auto">
                  <span className="font-medium text-zinc-800">Your reply: </span>
                  {review.reply}
                </p>
              )}

              <div className="mt-4">
                <ReviewActions
                  id={review.id}
                  status={review.status}
                  reply={review.reply}
                  email={review.email}
                  gameTitle={review.gameTitle}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
