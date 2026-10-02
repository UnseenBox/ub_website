export const NAV_ITEMS = [
  { key: "home", path: "/", index: "00" },
  { key: "games", path: "/games", index: "01" },
  { key: "play", path: "/play", index: "02" },
  { key: "upcoming", path: "/upcoming", index: "03" },
  { key: "services", path: "/services", index: "04" },
  { key: "experiences", path: "/experiences", index: "05" },
  { key: "community", path: "/community", index: "06" },
  { key: "about", path: "/about", index: "07" },
  { key: "contact", path: "/contact", index: "08" },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]["key"];

/** Which nav item a locale-stripped pathname belongs to. */
export function activeNavKey(pathname: string): NavKey {
  const segment = pathname.split("/")[2] ?? "";
  const match = NAV_ITEMS.find((item) => item.path === `/${segment}`);
  return match?.key ?? "home";
}

export const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  linkedin: "LinkedIn",
  discord: "Discord",
  steam: "Steam",
  itch: "itch.io",
  bluesky: "Bluesky",
  twitch: "Twitch",
  github: "GitHub",
};
