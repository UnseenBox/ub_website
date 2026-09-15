import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { localePath, t, type Locale } from "@/lib/i18n/config";
import { NAV_ITEMS, SOCIAL_LABELS } from "@/lib/navigation";
import type { StudioInfo } from "@/types/content";
import { LinkButton } from "@/components/ui/link-button";
import { ExternalIcon, LogoMark } from "@/components/ui/icons";
import { LanguageSwitcher } from "./language-switcher";
import { StudioClock } from "./studio-clock";

export function SiteFooter({ locale, dict, studio }: { locale: Locale; dict: Dictionary; studio: StudioInfo }) {
  const socials = studio.socials.filter((social) => social.url.trim());
  const year = new Date().getFullYear();

  return (
    <footer className="relative isolate overflow-hidden border-t border-line bg-void">
      <div aria-hidden className="uv-glow pointer-events-none absolute -bottom-1/3 left-1/2 -z-10 h-[80vh] w-[120vw] -translate-x-1/2" />

      {/* Closing statement */}
      <section className="shell pb-16 pt-24 sm:pt-32" aria-labelledby="footer-closing">
        <p className="label mb-8 flex items-center gap-3">
          <span className="size-2 bg-uv-500" aria-hidden />
          {dict.footer.studio}
        </p>
        <div className="grid items-end gap-10 lg:grid-cols-[1fr_auto]">
          <h2 id="footer-closing" data-reveal className="font-display max-w-5xl text-giga text-balance">
            {dict.footer.closing}
          </h2>
          <div data-reveal style={{ "--reveal-delay": 150 } as React.CSSProperties}>
            <LinkButton href={localePath(locale, "/contact")} cursor={dict.nav.contact}>
              {dict.footer.cta}
            </LinkButton>
          </div>
        </div>
      </section>

      {/* Index */}
      <div className="shell grid gap-12 border-t border-line py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-5">
          <Link href={localePath(locale)} className="flex items-center gap-3" aria-label="UnseenBox">
            <LogoMark className="size-8" />
            <span className="font-display text-xl">UnseenBox</span>
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-mist">{t(studio.tagline, locale)}</p>
          <a href={`mailto:${studio.email}`} className="font-mono text-sm text-bone underline-offset-4 hover:text-uv-300 hover:underline" dir="ltr">
            {studio.email}
          </a>
          <p className="label flex flex-wrap items-center gap-2">
            <span className="size-1.5 rounded-full bg-uv-500 animate-pulse-uv" aria-hidden />
            {t(studio.city, locale)} · <StudioClock timezone={studio.timezone} locale={locale} className="text-bone" />
          </p>
        </div>

        <nav aria-label={dict.a11y.footerNav}>
          <h3 className="label mb-5">{dict.footer.navigate}</h3>
          <ul className="flex flex-col gap-2.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <Link href={localePath(locale, item.path)} className="group inline-flex items-baseline gap-3 text-sm text-mist transition-colors hover:text-bone">
                  <span className="font-pixel text-[0.6rem] text-fog group-hover:text-uv-400">{item.index}</span>
                  {dict.nav[item.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {socials.length > 0 && (
          <div>
            <h3 className="label mb-5">{dict.footer.follow}</h3>
            <ul className="flex flex-col gap-2.5">
              {socials.map((social) => (
                <li key={social.platform}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 text-sm text-mist transition-colors hover:text-bone"
                  >
                    {SOCIAL_LABELS[social.platform] ?? social.platform}
                    <ExternalIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    <span className="sr-only">({dict.a11y.externalLink})</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="label mb-5">{dict.a11y.language}</h3>
          <LanguageSwitcher locale={locale} label={dict.a11y.language} variant="full" className="[&_ul]:flex-col [&_ul]:items-start [&_ul]:gap-1" />
        </div>
      </div>

      {/* Wordmark */}
      <div aria-hidden className="group relative select-none overflow-hidden border-t border-line" dir="ltr">
        <p className="font-display outline-text whitespace-nowrap px-[2vw] pt-[2vw] text-center text-[17.4vw] leading-[0.78] tracking-[-0.06em] transition-[color] duration-700 group-hover:text-uv-500/15">
          UNSEENBOX
        </p>
        <span className="absolute inset-x-0 top-1/2 h-px origin-left scale-x-0 bg-uv-400 transition-transform duration-1000 ease-expo group-hover:scale-x-100" />
      </div>

      <div className="shell flex flex-col gap-3 border-t border-line py-6 text-xs text-fog sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {studio.foundedYear}–{year} {studio.name}. {dict.footer.rights}
        </p>
        <a href="#top" className="label hover:text-bone">
          {dict.footer.backToTop} ↑
        </a>
      </div>
    </footer>
  );
}
