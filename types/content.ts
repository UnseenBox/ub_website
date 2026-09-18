/**
 * Content model for the whole site.
 * Every user-facing string that editors control is a LocalizedString so the
 * three languages live side by side and can never drift out of structure.
 */

export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export type LocalizedString = Record<Locale, string>;

/* ------------------------------------------------------------------ */
/* Games                                                               */
/* ------------------------------------------------------------------ */

export const GAME_STATUSES = [
  "released",
  "early-access",
  "beta",
  "alpha",
  "production",
  "prototype",
  "concept",
] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const PLATFORMS = [
  "pc",
  "mac",
  "linux",
  "web",
  "ios",
  "android",
  "switch",
  "playstation",
  "xbox",
  "quest",
  "steamvr",
  "visionpro",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const LINK_KINDS = [
  "steam",
  "itch",
  "googlePlay",
  "appStore",
  "website",
  "discord",
  "epic",
  "nintendo",
  "playstation",
  "xbox",
  "meta",
  "press",
  "other",
] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export interface ExternalLink {
  kind: LinkKind;
  url: string;
  /** Optional custom label, used mostly for `other`. */
  label?: string;
}

export interface DevNote {
  id: string;
  /** ISO date (YYYY-MM-DD) */
  date: string;
  text: LocalizedString;
}

export interface Game {
  id: string;
  slug: string;
  title: string;
  tagline: LocalizedString;
  summary: LocalizedString;
  description: LocalizedString;
  genre: LocalizedString;
  platforms: Platform[];
  status: GameStatus;
  /** ISO date for released titles. */
  releaseDate?: string;
  /** Free text for upcoming titles, e.g. "Q3 2027". */
  estimatedRelease?: LocalizedString;
  /** 0–100, only meaningful for upcoming titles. */
  progress?: number;
  poster: string;
  cover: string;
  screenshots: string[];
  trailerUrl?: string;
  links: ExternalLink[];
  features: LocalizedString[];
  devNotes: DevNote[];
  engine?: string;
  /** Accent used to tint artwork overlays. Hex. */
  accent?: string;
  featured: boolean;
  upcoming: boolean;
  order: number;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

export const GLYPHS = [
  "controller",
  "book",
  "visor",
  "lens",
  "installation",
  "cube",
  "target",
  "spark",
  "flask",
] as const;
export type Glyph = (typeof GLYPHS)[number];

export interface Service {
  id: string;
  title: LocalizedString;
  kicker: LocalizedString;
  description: LocalizedString;
  deliverables: LocalizedString[];
  glyph: Glyph;
  order: number;
}

/* ------------------------------------------------------------------ */
/* Experiences / archive                                               */
/* ------------------------------------------------------------------ */

export const EXPERIENCE_TYPES = [
  "client",
  "installation",
  "event",
  "experiment",
  "education",
  "behind-the-scenes",
] as const;
export type ExperienceType = (typeof EXPERIENCE_TYPES)[number];

export interface Experience {
  id: string;
  slug: string;
  title: LocalizedString;
  type: ExperienceType;
  /** ISO date (YYYY-MM or YYYY-MM-DD) */
  date: string;
  location: LocalizedString;
  client?: string;
  summary: LocalizedString;
  body: LocalizedString;
  cover: string;
  images: string[];
  link?: string;
  order: number;
}

/* ------------------------------------------------------------------ */
/* Studio                                                              */
/* ------------------------------------------------------------------ */

export const SOCIAL_PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "x",
  "linkedin",
  "discord",
  "steam",
  "itch",
  "bluesky",
  "twitch",
  "github",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

export interface Belief {
  id: string;
  title: LocalizedString;
  text: LocalizedString;
}

export interface Milestone {
  id: string;
  year: string;
  title: LocalizedString;
  text: LocalizedString;
}

/**
 * Editable copy for the home page's editorial text.
 *
 * Every field is optional: an empty value falls back to the built-in wording
 * in the locale dictionaries, so the page never renders a blank heading while
 * a translation is still being written.
 */
export interface HomeCopy {
  /** The three channel labels above the hero title. */
  heroChannels: LocalizedString[];
  /** The hero headline, one entry per line. */
  heroLines: LocalizedString[];
  heroIntro: LocalizedString;
  heroCtaPrimary: LocalizedString;
  heroCtaSecondary: LocalizedString;
  heroScroll: LocalizedString;
  manifestoLabel: LocalizedString;
  showcaseLabel: LocalizedString;
  showcaseTitle: LocalizedString;
  upcomingLabel: LocalizedString;
  upcomingTitle: LocalizedString;
  upcomingIntro: LocalizedString;
  servicesLabel: LocalizedString;
  servicesTitle: LocalizedString;
  servicesIntro: LocalizedString;
  archiveLabel: LocalizedString;
  archiveTitle: LocalizedString;
  archiveIntro: LocalizedString;
  studioLabel: LocalizedString;
  studioTitle: LocalizedString;
}

export interface StudioInfo {
  name: string;
  /** Custom wordmark/logo image. Empty falls back to the built-in mark. */
  logo?: string;
  /** Full-width band at the foot of every page. Empty draws the name instead. */
  footerImage?: string;
  foundedYear: string;
  email: string;
  pressEmail?: string;
  phone?: string;
  city: LocalizedString;
  country: LocalizedString;
  /** IANA time zone used by the live studio clock. */
  timezone: string;
  /** Short one-liner used in metadata and the footer. */
  tagline: LocalizedString;
  /** Paragraphs are separated by blank lines. */
  intro: LocalizedString;
  manifesto: LocalizedString;
  approach: LocalizedString;
  ambition: LocalizedString;
  beliefs: Belief[];
  timeline: Milestone[];
  socials: SocialLink[];
  availability: LocalizedString;
  /** Overrides for the home page. Absent means the built-in copy is used. */
  home?: HomeCopy;
}

/* ------------------------------------------------------------------ */
/* Aggregate + messages                                                */
/* ------------------------------------------------------------------ */

export interface SiteContent {
  version: number;
  updatedAt: string;
  studio: StudioInfo;
  games: Game[];
  services: Service[];
  experiences: Experience[];
}

/* ------------------------------------------------------------------ */
/* Community reviews                                                    */
/* ------------------------------------------------------------------ */

export const REVIEW_STATUSES = ["pending", "approved"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** A player's rating of one game. Public only once an admin approves it. */
export interface Review {
  id: string;
  gameId: string;
  /** Denormalised so a review survives a game being renamed or removed. */
  gameSlug: string;
  gameTitle: string;
  name: string;
  /** Never shown publicly; lets the studio reply. */
  email?: string;
  /** 1–5 stars. */
  rating: number;
  body: string;
  locale: Locale;
  status: ReviewStatus;
  createdAt: string;
  /** Optional public reply from the studio. */
  reply?: string;
}

/** Aggregate rating for one game, computed from approved reviews. */
export interface RatingSummary {
  gameId: string;
  average: number;
  count: number;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  locale: Locale;
  createdAt: string;
  read: boolean;
}
