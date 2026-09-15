import type { Metadata } from "next";
import { ExperienceEditor } from "@/components/admin/experience-editor";
import { requireAdmin } from "@/lib/auth/guard";
import { newExperience } from "@/lib/content/factories";
import { getContentFresh } from "@/lib/content/queries";

export const metadata: Metadata = { title: "New archive entry" };

export default async function NewExperiencePage() {
  await requireAdmin();
  const { experiences } = await getContentFresh();
  return <ExperienceEditor initial={newExperience(experiences.length + 1)} isNew />;
}
