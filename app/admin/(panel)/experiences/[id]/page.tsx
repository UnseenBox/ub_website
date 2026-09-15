import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExperienceEditor } from "@/components/admin/experience-editor";
import { requireAdmin } from "@/lib/auth/guard";
import { getContentFresh } from "@/lib/content/queries";

export const metadata: Metadata = { title: "Edit archive entry" };

export default async function EditExperiencePage({ params }: PageProps<"/admin/experiences/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { experiences, updatedAt } = await getContentFresh();
  const item = experiences.find((e) => e.id === id);
  if (!item) notFound();
  return <ExperienceEditor key={updatedAt} initial={item} isNew={false} />;
}
