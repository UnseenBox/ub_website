import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact/contact-form";
import { CopyButton } from "@/components/contact/copy-button";
import { StudioClock } from "@/components/layout/studio-clock";
import { ExternalIcon } from "@/components/ui/icons";
import { SectionLabel } from "@/components/ui/section-label";
import { getStudio } from "@/lib/content/queries";
import { isLocale, t } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { SOCIAL_LABELS } from "@/lib/navigation";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return buildMetadata({ locale, path: "/contact", title: dict.meta.contact, description: dict.meta.contactDescription });
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [dict, studio] = await Promise.all([getDictionary(locale), getStudio()]);
  const socials = studio.socials.filter((s) => s.url.trim());

  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden className="uv-glow pointer-events-none absolute -start-1/4 top-0 -z-10 size-[100vw] opacity-60" />

      <div className="shell grid gap-16 pb-28 pt-32 sm:pt-44 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
        <div className="flex flex-col">
          <div className="animate-fade">
            <SectionLabel index="06">{dict.contact.label}</SectionLabel>
          </div>
          <h1 className="font-display mt-8 text-mega">
            <span className="line-mask">
              <span className="animate-rise [animation-delay:80ms]">{dict.contact.title}</span>
            </span>
          </h1>
          <p className="mt-8 max-w-lg animate-fade text-lg leading-relaxed text-mist [animation-delay:250ms]">
            {dict.contact.intro}
          </p>

          <dl className="mt-14 grid gap-10 border-t border-line pt-10">
            <div>
              <dt className="label">{dict.contact.email}</dt>
              <dd className="mt-3 flex flex-wrap items-center gap-4">
                <a
                  href={`mailto:${studio.email}`}
                  className="font-display text-2xl break-all transition-colors hover:text-uv-300 sm:text-3xl"
                  dir="ltr"
                >
                  {studio.email}
                </a>
                <CopyButton value={studio.email} label={dict.contact.copy} done={dict.contact.copied} />
              </dd>
            </div>
            <div>
              <dt className="label">{dict.contact.based}</dt>
              <dd className="mt-3 flex items-center gap-3 text-xl">
                {t(studio.city, locale)}, {t(studio.country, locale)}
                <span className="font-pixel text-sm text-uv-300">
                  <StudioClock timezone={studio.timezone} locale={locale} />
                </span>
              </dd>
            </div>
            {socials.length > 0 && (
              <div>
                <dt className="label">{dict.contact.elsewhere}</dt>
                <dd className="mt-3">
                  <ul className="flex flex-wrap gap-x-6 gap-y-2">
                    {socials.map((social) => (
                      <li key={social.platform}>
                        <a
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-1.5 text-lg text-bone/85 transition-colors hover:text-uv-300"
                        >
                          {SOCIAL_LABELS[social.platform] ?? social.platform}
                          <ExternalIcon className="size-3.5 text-fog group-hover:text-uv-300" />
                          <span className="sr-only">({dict.a11y.externalLink})</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            <div>
              <dt className="sr-only">Status</dt>
              <dd className="label flex items-center gap-2 text-bone">
                <span className="size-2 rounded-full bg-uv-500 animate-pulse-uv" aria-hidden />
                {t(studio.availability, locale)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="relative lg:pt-24">
          <ContactForm copy={dict.contact} locale={locale} email={studio.email} />
        </div>
      </div>
    </div>
  );
}
