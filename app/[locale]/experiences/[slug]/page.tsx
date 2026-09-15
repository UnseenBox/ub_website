import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/media/gallery";
import { ArrowIcon } from "@/components/ui/icons";
import { LinkButton } from "@/components/ui/link-button";
import { SmartImage } from "@/components/ui/smart-image";
import { getContent, getExperienceBySlug } from "@/lib/content/queries";
import { LOCALES, isLocale, localePath, t } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo";
import { formatMonth, paragraphs, stampDate } from "@/lib/utils";

export async function generateStaticParams() {
  const { experiences } = await getContent();
  return LOCALES.flatMap((locale) => experiences.map((item) => ({ locale, slug: item.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/experiences/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const item = await getExperienceBySlug(slug);
  if (!item) return {};
  return buildMetadata({
    locale,
    path: `/experiences/${item.slug}`,
    title: t(item.title, locale),
    description: t(item.summary, locale),
    image: item.cover,
    type: "article",
  });
}

export default async function ExperiencePage({ params }: PageProps<"/[locale]/experiences/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const [dict, item] = await Promise.all([getDictionary(locale), getExperienceBySlug(slug)]);
  if (!item) notFound();

  const title = t(item.title, locale);
  const meta = [
    [dict.experiences.type, dict.experiences.types[item.type]],
    [dict.experiences.date, formatMonth(item.date, locale)],
    [dict.experiences.location, t(item.location, locale)],
    ...(item.client ? [[dict.experiences.client, item.client]] : []),
  ];

  return (
    <article>
      <header className="relative isolate flex min-h-[85svh] flex-col justify-end overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <SmartImage src={item.cover} alt="" sizes="100vw" preload quality={75} />
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/55 to-void/30" />
          <div className="scanlines absolute inset-0 opacity-25" />
        </div>
        <div className="shell pb-14 pt-32">
          <Link
            href={localePath(locale, "/experiences")}
            className="label group inline-flex items-center gap-2 hover:text-bone"
          >
            <ArrowIcon className="size-3.5 -scale-x-100 transition-transform group-hover:-translate-x-1 rtl:scale-x-100 rtl:group-hover:translate-x-1" />
            {dict.experiences.back}
          </Link>
          <p className="font-pixel mt-10 text-sm text-uv-300" dir="ltr">
            {stampDate(item.date)}
          </p>
          <h1 className="font-display mt-3 max-w-5xl text-giga text-balance">
            <span className="line-mask">
              <span className="animate-rise">{title}</span>
            </span>
          </h1>
          <p className="mt-6 max-w-2xl animate-fade text-xl text-bone/85 [animation-delay:200ms]">
            {t(item.summary, locale)}
          </p>
        </div>
      </header>

      <div className="shell grid gap-14 py-20 sm:py-28 lg:grid-cols-[1fr_2fr] lg:gap-24">
        <dl className="grid h-fit grid-cols-2 gap-6 border-t border-line pt-6 lg:sticky lg:top-28 lg:grid-cols-1">
          {meta.map(([term, value]) => (
            <div key={term}>
              <dt className="label">{term}</dt>
              <dd className="mt-1.5 text-bone">{value}</dd>
            </div>
          ))}
          {item.link && (
            <div className="col-span-2 lg:col-span-1">
              <LinkButton href={item.link} external variant="ghost" externalLabel={dict.a11y.externalLink}>
                {dict.experiences.visit}
              </LinkButton>
            </div>
          )}
        </dl>

        <div className="space-y-6 text-lg leading-relaxed text-bone/85 sm:text-xl">
          {paragraphs(t(item.body, locale)).map((p, i) => (
            <p key={i} data-reveal>
              {p}
            </p>
          ))}
        </div>
      </div>

      {item.images.length > 0 && (
        <section className="shell pb-28" aria-label={dict.a11y.gallery}>
          <Gallery images={item.images} altPrefix={title} copy={{ ...dict.a11y, close: dict.a11y.close }} layout="grid" />
        </section>
      )}
    </article>
  );
}
