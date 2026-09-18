import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { t, type Locale } from "@/lib/i18n/config";
import type { HomeCopy, LocalizedString, StudioInfo } from "@/types/content";

/**
 * Merges the home-page copy an editor has written over the built-in wording.
 *
 * The page and its components keep taking a `Dictionary`, so only the fields
 * an editor has actually filled in change; everything else — labels, button
 * text, aria strings — stays as shipped.
 */

const empty = (): LocalizedString => ({ en: "", fr: "", ar: "" });

export function emptyHomeCopy(): HomeCopy {
  return {
    heroChannels: [],
    heroLines: [],
    heroIntro: empty(),
    heroCtaPrimary: empty(),
    heroCtaSecondary: empty(),
    heroScroll: empty(),
    manifestoLabel: empty(),
    showcaseLabel: empty(),
    showcaseTitle: empty(),
    upcomingLabel: empty(),
    upcomingTitle: empty(),
    upcomingIntro: empty(),
    servicesLabel: empty(),
    servicesTitle: empty(),
    servicesIntro: empty(),
    archiveLabel: empty(),
    archiveTitle: empty(),
    archiveIntro: empty(),
    studioLabel: empty(),
    studioTitle: empty(),
  };
}

export function mergeHomeCopy(dict: Dictionary, studio: StudioInfo, locale: Locale): Dictionary {
  const home = studio.home;
  if (!home) return dict;

  /** The edited value if it has any text, otherwise the built-in one. */
  const pick = (value: LocalizedString | undefined, fallback: string) => t(value, locale) || fallback;

  const pickList = (values: LocalizedString[] | undefined, fallback: string[]) => {
    const written = (values ?? []).map((value) => t(value, locale)).filter(Boolean);
    return written.length > 0 ? written : fallback;
  };

  return {
    ...dict,
    hero: {
      ...dict.hero,
      channels: pickList(home.heroChannels, dict.hero.channels),
      lines: pickList(home.heroLines, dict.hero.lines),
      intro: pick(home.heroIntro, dict.hero.intro),
      ctaPrimary: pick(home.heroCtaPrimary, dict.hero.ctaPrimary),
      ctaSecondary: pick(home.heroCtaSecondary, dict.hero.ctaSecondary),
      scroll: pick(home.heroScroll, dict.hero.scroll),
    },
    manifesto: {
      ...dict.manifesto,
      label: pick(home.manifestoLabel, dict.manifesto.label),
    },
    showcase: {
      ...dict.showcase,
      label: pick(home.showcaseLabel, dict.showcase.label),
      title: pick(home.showcaseTitle, dict.showcase.title),
    },
    upcoming: {
      ...dict.upcoming,
      label: pick(home.upcomingLabel, dict.upcoming.label),
      title: pick(home.upcomingTitle, dict.upcoming.title),
      intro: pick(home.upcomingIntro, dict.upcoming.intro),
    },
    services: {
      ...dict.services,
      label: pick(home.servicesLabel, dict.services.label),
      title: pick(home.servicesTitle, dict.services.title),
      intro: pick(home.servicesIntro, dict.services.intro),
    },
    experiences: {
      ...dict.experiences,
      label: pick(home.archiveLabel, dict.experiences.label),
      title: pick(home.archiveTitle, dict.experiences.title),
      intro: pick(home.archiveIntro, dict.experiences.intro),
    },
    about: {
      ...dict.about,
      label: pick(home.studioLabel, dict.about.label),
      title: pick(home.studioTitle, dict.about.title),
    },
  };
}
