import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayPortal } from "@/components/play/play-portal";
import { getPlayables, getRatings } from "@/lib/content/queries";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { PLAY_MOODS } from "@/lib/play";
import { presentPlayables } from "@/lib/play-portal";
import { buildMetadata } from "@/lib/seo";
import { pad } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/play">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  const playables = await getPlayables();
  return buildMetadata({
    locale,
    path: "/play",
    title: dict.meta.play,
    description: dict.meta.playDescription,
    image: playables[0]?.poster,
  });
}

/** The arcade's front page. Each game is played on its own page, /play/<slug>. */
export default async function PlayPage({ params }: PageProps<"/[locale]/play">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [dict, ratings, playables] = await Promise.all([getDictionary(locale), getRatings(), getPlayables()]);
  const copy = dict.play;
  const games = presentPlayables(playables, locale, ratings);

  return (
    <PlayPortal
      games={games}
      moods={PLAY_MOODS.filter((mood) => games.some((game) => game.moods.includes(mood)))}
      countLabel={pad(games.length)}
      copy={{
        title: copy.title,
        intro: copy.intro,
        count: copy.count,
        start: copy.start,
        search: copy.search,
        clear: copy.clear,
        topPicks: copy.topPicks,
        allGames: copy.allGames,
        results: copy.results,
        noResults: copy.noResults,
        comingSoon: copy.comingSoon,
        more: copy.more,
        moodsLabel: copy.moodsLabel,
        moods: copy.moods,
        badges: copy.badges,
        tags: copy.tags,
        tagNotes: copy.tagNotes,
        ad: copy.ad,
      }}
    />
  );
}
