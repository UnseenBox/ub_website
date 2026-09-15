import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchiveGrid } from "@/components/experiences/archive-grid";
import { PageIntro } from "@/components/ui/page-intro";
import { getExperiences } from "@/lib/content/queries";
import { toArchiveItem } from "@/lib/content/present";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo";
import { EXPERIENCE_TYPES } from "@/types/content";

export async function generateMetadata({ params }: PageProps<"/[locale]/experiences">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return buildMetadata({
    locale,
    path: "/experiences",
    title: dict.meta.experiences,
    description: dict.meta.experiencesDescription,
  });
}

export default async function ExperiencesPage({ params }: PageProps<"/[locale]/experiences">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [dict, experiences] = await Promise.all([getDictionary(locale), getExperiences()]);

  return (
    <>
      <PageIntro index="04" label={dict.experiences.label} title={dict.experiences.title} lede={dict.experiences.intro} />
      <section className="shell py-16 sm:py-24" aria-label={dict.experiences.label}>
        <ArchiveGrid
          items={experiences.map((item) => toArchiveItem(item, locale, dict))}
          types={EXPERIENCE_TYPES.map((value) => ({ value, label: dict.experiences.types[value] }))}
          copy={{
            filterAll: dict.experiences.filterAll,
            loadMore: dict.experiences.loadMore,
            empty: dict.experiences.empty,
            filterLabel: dict.experiences.type,
          }}
        />
      </section>
    </>
  );
}
