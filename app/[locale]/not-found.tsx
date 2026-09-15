import { locale as rootLocale } from "next/root-params";
import { LinkButton } from "@/components/ui/link-button";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function NotFound() {
  const value = await rootLocale();
  const locale = isLocale(value) ? value : DEFAULT_LOCALE;
  const dict = await getDictionary(locale);

  return (
    <section className="shell relative flex min-h-[88svh] flex-col justify-center gap-8 pt-28">
      <div aria-hidden className="uv-glow pointer-events-none absolute inset-0 opacity-50" />
      <p className="font-pixel text-uv-400">404 — {dict.meta.notFound}</p>
      <h1 className="font-display relative max-w-4xl text-giga text-balance">{dict.notFound.title}</h1>
      <p className="relative max-w-xl text-lg text-mist">{dict.notFound.text}</p>
      <div className="relative">
        <LinkButton href={localePath(locale)}>{dict.notFound.cta}</LinkButton>
      </div>
    </section>
  );
}
