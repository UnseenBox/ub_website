import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/games/game-player";
import { PageIntro } from "@/components/ui/page-intro";
import { isLocale, t } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { PLAYABLE_GAMES } from "@/lib/play";
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
  const dict = await getDictionary(locale);
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
        {PLAYABLE_GAMES.map((game, i) => (
          <article key={game.slug} id={game.slug} className="border-b border-line py-14 sm:py-20">
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
          </article>
        ))}

        <p className="pt-10 text-center text-mist">{copy.more}</p>
      </section>
    </>
  );
}
