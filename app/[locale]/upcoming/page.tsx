import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SignalCard } from "@/components/games/signal-card";
import { PageIntro } from "@/components/ui/page-intro";
import { getUpcomingGames } from "@/lib/content/queries";
import { toSignalItem } from "@/lib/content/present";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo";
import { pad } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/upcoming">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return buildMetadata({ locale, path: "/upcoming", title: dict.meta.upcoming, description: dict.meta.upcomingDescription });
}

export default async function UpcomingPage({ params }: PageProps<"/[locale]/upcoming">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [dict, games] = await Promise.all([getDictionary(locale), getUpcomingGames()]);

  return (
    <>
      <PageIntro
        index="02"
        label={dict.upcoming.label}
        title={dict.upcoming.title}
        lede={dict.upcoming.intro}
        aside={
          <p className="label flex items-center gap-3">
            <span className="size-2 rounded-full bg-uv-500 animate-pulse-uv" aria-hidden />
            <span className="font-pixel text-2xl text-bone" dir="ltr">
              {pad(games.length)}
            </span>
            {dict.upcoming.signal}
          </p>
        }
      />

      <section className="shell pb-28" aria-label={dict.upcoming.label}>
        {games.length === 0 ? (
          <p className="py-24 text-mist">{dict.upcoming.noNotes}</p>
        ) : (
          games.map((game, i) => (
            <SignalCard key={game.id} item={toSignalItem(game, locale, dict)} copy={dict.upcoming} index={i} />
          ))
        )}
      </section>
    </>
  );
}
