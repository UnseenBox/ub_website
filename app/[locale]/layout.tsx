import "../globals.css";

import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MotionRoot } from "@/components/motion/motion-root";
import { getContent } from "@/lib/content/queries";
import { fontVariables } from "@/lib/fonts";
import { LOCALES, dirOf, isLocale, t } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { NavKey } from "@/lib/navigation";
import { buildMetadata } from "@/lib/seo";
import { siteUrl } from "@/lib/utils";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#050407",
  colorScheme: "dark",
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: dict.meta.homeTitle, template: "%s — UnseenBox" },
    applicationName: "UnseenBox",
    creator: "UnseenBox",
    formatDetection: { telephone: false, email: false },
    ...buildMetadata({
      locale,
      path: "/",
      title: dict.meta.homeTitle,
      description: dict.meta.homeDescription,
      absoluteTitle: true,
    }),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, content] = await Promise.all([getDictionary(locale), getContent()]);
  const { studio, games, experiences } = content;
  const released = games.filter((game) => !game.upcoming);
  const upcoming = games.filter((game) => game.upcoming);

  const previews: Partial<Record<NavKey, string>> = {
    home: released[0]?.poster,
    games: (released.find((game) => game.featured) ?? released[0])?.cover,
    upcoming: upcoming[0]?.cover,
    services: released[2]?.screenshots[0] ?? released[0]?.screenshots[0],
    experiences: experiences[0]?.cover,
    about: released[0]?.screenshots[2],
    contact: released[3]?.cover ?? released[0]?.cover,
  };

  return (
    <html lang={locale} dir={dirOf(locale)} className={fontVariables} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Opt into reveal animations before first paint; content stays visible without JS. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body id="top" className="min-h-dvh bg-void text-bone">
        <SiteHeader
          locale={locale}
          copy={{ nav: dict.nav, a11y: dict.a11y }}
          email={studio.email}
          city={t(studio.city, locale)}
          timezone={studio.timezone}
          previews={previews}
          studioName={studio.name}
          logo={studio.logo}
        />
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <SiteFooter locale={locale} dict={dict} studio={studio} />
        <div className="grain" aria-hidden />
        <MotionRoot />
      </body>
    </html>
  );
}
