"use client";

import { usePathname } from "next/navigation";
import { LOCALES, LOCALE_META, swapLocale, type Locale } from "@/lib/i18n/config";
import { rememberLocale } from "@/lib/i18n/remember-locale";
import { cn } from "@/lib/utils";

/**
 * Uses full document navigations on purpose: switching language changes
 * <html lang/dir> and fonts, and a clean load guarantees a correct RTL layout.
 */
export function LanguageSwitcher({
  locale,
  label,
  variant = "compact",
  className,
}: {
  locale: Locale;
  label: string;
  variant?: "compact" | "full";
  className?: string;
}) {
  const pathname = usePathname() || `/${locale}`;

  return (
    <nav aria-label={label} className={cn("flex items-center", className)}>
      <ul className={cn("flex items-center", variant === "compact" ? "gap-1" : "gap-6")}>
        {LOCALES.map((code) => {
          const meta = LOCALE_META[code];
          const active = code === locale;
          return (
            <li key={code}>
              <a
                href={swapLocale(pathname, code)}
                hrefLang={meta.hreflang}
                lang={meta.hreflang}
                aria-current={active ? "true" : undefined}
                onClick={() => rememberLocale(code)}
                className={cn(
                  "relative inline-flex items-center justify-center transition-colors duration-300",
                  variant === "compact"
                    ? "h-9 min-w-9 px-2 font-mono text-[0.7rem] tracking-[0.12em]"
                    : "py-1 font-display text-2xl",
                  active ? "text-bone" : "text-fog hover:text-bone",
                )}
              >
                <span className={code === "ar" && variant === "compact" ? "font-[system-ui] text-sm" : undefined}>
                  {variant === "compact" ? meta.short : meta.label}
                </span>
                {active && (
                  <span aria-hidden className="absolute inset-x-2 -bottom-px h-px bg-uv-500" />
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
