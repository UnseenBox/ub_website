import { Alexandria, Geist, Geist_Mono, IBM_Plex_Sans_Arabic, Silkscreen, Syne } from "next/font/google";

/* Latin — preloaded (above-the-fold on every page) */
export const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
export const syne = Syne({ subsets: ["latin"], variable: "--font-syne", display: "swap" });

/* Latin accents — loaded on use */
export const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});
export const silkscreen = Silkscreen({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-silkscreen",
  display: "swap",
  preload: false,
});

/* Arabic — unicode-range subsets mean Latin pages never download these */
export const alexandria = Alexandria({
  subsets: ["arabic"],
  variable: "--font-alexandria",
  display: "swap",
  preload: false,
});
export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-arabic",
  display: "swap",
  preload: false,
});

export const fontVariables = [geist, syne, geistMono, silkscreen, alexandria, plexArabic]
  .map((font) => font.variable)
  .join(" ");
