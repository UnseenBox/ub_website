import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/ui/page-intro";
import { SmartImage } from "@/components/ui/smart-image";
import { ArrowIcon } from "@/components/ui/icons";
import { getGames } from "@/lib/content/queries";
import { platformList } from "@/lib/content/present";
import { isLocale, localePath, t } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo";
import { cn, pad } from "@/lib/utils";
import { releaseYear } from "@/lib/games";

export async function generateMetadata({ params }: PageProps<"/[locale]/games">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return buildMetadata({ locale, path: "/games", title: dict.meta.games, description: dict.meta.gamesDescription });
}

export default async function GamesPage({ params }: PageProps<"/[locale]/games">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [dict, games] = await Promise.all([getDictionary(locale), getGames()]);
  const released = games.filter((game) => !game.upcoming);
  const upcoming = games.filter((game) => game.upcoming);

  return (
    <>
      <PageIntro
        index="01"
        label={dict.showcase.label}
        title={dict.showcase.title}
        lede={dict.meta.gamesDescription}
        aside={
          <p className="font-pixel text-[clamp(3rem,8vw,7rem)] leading-none text-uv-500/80" dir="ltr">
            {pad(released.length)}
          </p>
        }
      />

      {released.length === 0 ? (
        <p className="shell py-32 text-mist">—</p>
      ) : (
        <ol className="shell pb-24">
          {released.map((game, i) => {
            const flip = i % 2 === 1;
            return (
              <li key={game.id} className="border-b border-line">
                <Link
                  href={localePath(locale, `/games/${game.slug}`)}
                  data-cursor={dict.showcase.enter}
                  className="group grid grid-cols-[4.5rem_1fr] gap-x-5 gap-y-6 py-10 sm:grid-cols-[7rem_1fr] sm:py-14 lg:grid-cols-12 lg:items-center lg:gap-10"
                >
                  <div className={cn("frame relative aspect-[2/3] overflow-hidden bg-ink-800 lg:col-span-2", flip && "lg:order-3")}>
                    <SmartImage
                      src={game.poster}
                      alt={game.title}
                      sizes="(min-width: 1024px) 14vw, 7rem"
                      className="transition-transform duration-[1200ms] ease-expo group-hover:scale-105"
                    />
                  </div>

                  <div className={cn("self-center lg:col-span-6", flip && "lg:order-2")}>
                    <p className="label flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-pixel text-uv-400">{pad(i + 1)}</span>
                      <span>{t(game.genre, locale)}</span>
                      <span className="text-fog">{releaseYear(game)}</span>
                    </p>
                    <h2 className="font-display mt-3 text-title transition-colors duration-500 group-hover:text-uv-300">
                      <span className="glitch" data-text={game.title}>
                        {game.title}
                      </span>
                    </h2>
                    <p className="mt-4 hidden max-w-xl text-mist sm:block">{t(game.summary, locale)}</p>
                    <p className="mt-5 flex items-center gap-3 text-sm text-bone/80">
                      {platformList(game, dict)}
                      <ArrowIcon className="size-4 text-fog transition-[transform,color] duration-500 ease-expo group-hover:translate-x-2 group-hover:text-uv-300 rtl:group-hover:-translate-x-2" />
                    </p>
                  </div>

                  <div
                    className={cn(
                      "relative col-span-2 hidden aspect-[16/10] overflow-hidden bg-ink-900 md:block lg:col-span-4",
                      flip && "lg:order-1",
                    )}
                  >
                    <div className="absolute inset-0 transition-[clip-path] duration-[1100ms] ease-expo [clip-path:inset(0_0_0_100%)] group-hover:[clip-path:inset(0_0_0_0)] group-focus-visible:[clip-path:inset(0_0_0_0)] rtl:[clip-path:inset(0_100%_0_0)]">
                      <SmartImage src={game.screenshots[0] ?? game.cover} alt="" sizes="(min-width: 1024px) 30vw, 50vw" />
                    </div>
                    <div className="scanlines pointer-events-none absolute inset-0 opacity-40" />
                    <span className="label absolute bottom-3 start-3">{dict.game.statuses[game.status]}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {upcoming.length > 0 && (
        <aside className="border-t border-line bg-ink-950">
          <div className="shell flex flex-col gap-8 py-16 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="label flex items-center gap-2">
                <span className="size-2 rounded-full bg-uv-500 animate-pulse-uv" aria-hidden />
                {dict.upcoming.label}
              </p>
              <p className="font-display mt-4 text-3xl sm:text-4xl">{upcoming.map((game) => game.title).join(" · ")}</p>
            </div>
            <Link href={localePath(locale, "/upcoming")} className="label shrink-0 hover:text-bone">
              {dict.upcoming.all} →
            </Link>
          </div>
        </aside>
      )}
    </>
  );
}
