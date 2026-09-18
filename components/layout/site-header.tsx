"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { localePath, type Locale } from "@/lib/i18n/config";
import { NAV_ITEMS, activeNavKey, type NavKey } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { SmartImage } from "@/components/ui/smart-image";
import { Brand } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { StudioClock } from "./studio-clock";

export interface HeaderCopy {
  nav: Record<NavKey | "menu" | "close" | "localTime" | `${NavKey}Note`, string>;
  a11y: { skip: string; openMenu: string; closeMenu: string; language: string; mainNav: string };
}

interface SiteHeaderProps {
  locale: Locale;
  copy: HeaderCopy;
  email: string;
  city: string;
  timezone: string;
  previews: Partial<Record<NavKey, string>>;
  studioName: string;
  logo?: string;
}

export function SiteHeader({ locale, copy, email, city, timezone, previews, studioName, logo }: SiteHeaderProps) {
  const pathname = usePathname() || `/${locale}`;
  const active = activeNavKey(pathname);
  const current = NAV_ITEMS.find((item) => item.key === active)!;

  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [preview, setPreview] = useState<NavKey>(active);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Hide on scroll down, reveal on scroll up.
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 24);
        setHidden(y > 160 && y > last + 4);
        if (y < last - 4) setHidden(false);
        last = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menu whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
    setPreview(active);
  }

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  // Scroll lock, Escape, focus trap.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a,button")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab" || !panel) return;
      const focusables = [...panel.querySelectorAll<HTMLElement>("a[href],button:not([disabled])")];
      const first = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        lastEl?.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[80] bg-bone px-4 py-3 font-mono text-xs uppercase tracking-widest text-void focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {copy.a11y.skip}
      </a>

      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-transform duration-700 ease-expo",
          hidden && !open ? "-translate-y-full" : "translate-y-0",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-b from-void/90 to-transparent transition-opacity duration-500",
            scrolled || open ? "opacity-100" : "opacity-0",
          )}
        />
        <div className="shell relative grid h-16 grid-cols-[1fr_auto_1fr] items-center sm:h-20">
          <Link
            href={localePath(locale)}
            className="group flex items-center gap-3 justify-self-start"
            aria-label={studioName}
          >
            <Brand
              logo={logo}
              name={studioName}
              markClassName="size-7 text-bone transition-transform duration-500 ease-expo group-hover:rotate-90"
              wordmarkClassName="text-[1.05rem] tracking-[-0.02em]"
              hideWordmarkOnMobile
            />
          </Link>

          <p className="label flex items-center gap-3 max-md:invisible" aria-live="polite">
            <span className="font-pixel text-uv-400">{current.index}</span>
            <span aria-hidden className="h-px w-6 bg-line-strong" />
            <span className="text-bone">{copy.nav[current.key]}</span>
          </p>

          <div className="flex items-center gap-2 justify-self-end sm:gap-4">
            <LanguageSwitcher locale={locale} label={copy.a11y.language} className="hidden sm:flex" />
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? copy.a11y.closeMenu : copy.a11y.openMenu}
              data-magnetic
              className="group relative flex h-10 items-center gap-3 border border-line-strong px-4 font-mono text-[0.7rem] uppercase tracking-[0.16em] transition-colors hover:border-uv-400 sm:h-11"
            >
              <span aria-hidden className="relative block h-2.5 w-4">
                <span
                  className={cn(
                    "absolute inset-x-0 top-0 h-px bg-current transition-transform duration-500 ease-expo",
                    open && "translate-y-[5px] rotate-45",
                  )}
                />
                <span
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-px bg-current transition-transform duration-500 ease-expo",
                    open && "-translate-y-[4px] -rotate-45",
                  )}
                />
              </span>
              <span aria-hidden>{open ? copy.nav.close : copy.nav.menu}</span>
            </button>
          </div>
        </div>
      </header>

      {/* The Index — full-screen navigation */}
      <div
        id="site-menu"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={copy.a11y.mainNav}
        hidden={!open}
        className="fixed inset-0 z-40 overflow-y-auto bg-void"
      >
        <div aria-hidden className="uv-glow pointer-events-none absolute inset-0 opacity-60" />
        <div className="shell relative grid min-h-full grid-rows-[1fr_auto] gap-10 pb-8 pt-24 sm:pt-28 lg:grid-cols-[1.4fr_1fr] lg:grid-rows-1 lg:gap-16">
          <nav aria-label={copy.a11y.mainNav} className="self-center">
            <ol className="flex flex-col">
              {NAV_ITEMS.map((item, i) => {
                const isActive = item.key === active;
                return (
                  <li
                    key={item.key}
                    className="border-b border-line opacity-0 [animation:fade_.8s_var(--ease-expo)_both]"
                    style={{ animationDelay: open ? `${80 + i * 55}ms` : "0ms" }}
                  >
                    <Link
                      href={localePath(locale, item.path)}
                      aria-current={isActive ? "page" : undefined}
                      onMouseEnter={() => setPreview(item.key)}
                      onFocus={() => setPreview(item.key)}
                      className="group flex items-baseline gap-4 py-3 sm:gap-6 sm:py-4"
                    >
                      <span className="font-pixel w-8 text-xs text-fog transition-colors group-hover:text-uv-400">
                        {item.index}
                      </span>
                      <span
                        className={cn(
                          "font-display text-[clamp(2rem,6.2vw,5.2rem)] leading-[0.95] transition-[color,transform] duration-500 ease-expo group-hover:translate-x-2 rtl:group-hover:-translate-x-2",
                          isActive ? "text-uv-300" : "text-bone group-hover:text-white",
                        )}
                      >
                        {copy.nav[item.key]}
                      </span>
                      <span className="label ms-auto hidden text-end sm:block">{copy.nav[`${item.key}Note`]}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          <aside className="flex flex-col justify-between gap-8 lg:py-10">
            <div className="frame relative hidden aspect-[4/5] w-full max-w-md self-end overflow-hidden bg-ink-800 lg:block">
              {NAV_ITEMS.map((item) =>
                previews[item.key] ? (
                  <div
                    key={item.key}
                    className={cn(
                      "absolute inset-0 transition-[opacity,transform] duration-700 ease-expo",
                      preview === item.key ? "scale-100 opacity-100" : "scale-105 opacity-0",
                    )}
                  >
                    {open && <SmartImage src={previews[item.key]} alt="" sizes="28rem" />}
                  </div>
                ) : null,
              )}
              <div aria-hidden className="scanlines absolute inset-0 opacity-40" />
              <p className="label absolute bottom-4 start-4 text-bone">{copy.nav[`${preview}Note`]}</p>
            </div>

            <div className="grid gap-6 border-t border-line pt-6 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <LanguageSwitcher locale={locale} label={copy.a11y.language} variant="full" />
              <a href={`mailto:${email}`} className="font-mono text-sm text-mist hover:text-bone" dir="ltr">
                {email}
              </a>
              <p className="label flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-uv-500 animate-pulse-uv" aria-hidden />
                <span>
                  {city} · {copy.nav.localTime}
                </span>
                <StudioClock timezone={timezone} locale={locale} className="text-bone" />
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
