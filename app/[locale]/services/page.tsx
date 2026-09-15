import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServicesIndex } from "@/components/home/services-index";
import { LinkButton } from "@/components/ui/link-button";
import { PageIntro } from "@/components/ui/page-intro";
import { SectionLabel } from "@/components/ui/section-label";
import { getServices, getStudio } from "@/lib/content/queries";
import { toServiceItem } from "@/lib/content/present";
import { isLocale, localePath, t } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo";
import { pad } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/services">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return buildMetadata({ locale, path: "/services", title: dict.meta.services, description: dict.meta.servicesDescription });
}

export default async function ServicesPage({ params }: PageProps<"/[locale]/services">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [dict, services, studio] = await Promise.all([getDictionary(locale), getServices(), getStudio()]);

  return (
    <>
      <PageIntro index="03" label={dict.services.label} title={dict.services.title} lede={dict.services.intro} />

      <section className="shell py-20 sm:py-28" aria-label={dict.services.label}>
        <ServicesIndex
          items={services.map((service) => toServiceItem(service, locale))}
          copy={dict.services}
          startHref={localePath(locale, "/contact")}
        />
      </section>

      <section aria-labelledby="process" className="border-y border-line bg-ink-950 py-24 sm:py-32">
        <div className="shell">
          <SectionLabel index="∎">{dict.services.processLabel}</SectionLabel>
          <h2 id="process" className="sr-only">
            {dict.services.processLabel}
          </h2>
          <ol className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            <span aria-hidden className="absolute inset-x-0 top-[0.45rem] hidden h-px bg-gradient-to-r from-uv-500 via-line-strong to-transparent lg:block rtl:bg-gradient-to-l" />
            {dict.services.process.map((step, i) => (
              <li
                key={step.title}
                data-reveal
                style={{ "--reveal-delay": i * 120 } as React.CSSProperties}
                className="relative lg:pe-10"
              >
                <span aria-hidden className="relative block size-4 border border-uv-400 bg-void">
                  <span className="absolute inset-1 bg-uv-500" style={{ opacity: 1 - i * 0.22 }} />
                </span>
                <p className="font-pixel mt-6 text-xs text-uv-400">{pad(i + 1)}</p>
                <h3 className="font-display mt-2 text-3xl">{step.title}</h3>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-mist">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="shell flex flex-col items-start gap-8 py-24 sm:py-32 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label flex items-center gap-2">
            <span className="size-2 rounded-full bg-uv-500 animate-pulse-uv" aria-hidden />
            {t(studio.availability, locale)}
          </p>
          <p className="font-display mt-6 max-w-3xl text-title text-balance">{dict.contact.intro}</p>
        </div>
        <LinkButton href={localePath(locale, "/contact")}>{dict.services.start}</LinkButton>
      </section>
    </>
  );
}
