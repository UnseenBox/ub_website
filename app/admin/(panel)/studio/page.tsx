import type { Metadata } from "next";
import { StudioEditor } from "@/components/admin/studio-editor";
import { requireAdmin } from "@/lib/auth/guard";
import { getContentFresh } from "@/lib/content/queries";

export const metadata: Metadata = { title: "Studio & contact" };

export default async function StudioAdminPage() {
  await requireAdmin();
  const { studio, updatedAt } = await getContentFresh();
  return <StudioEditor key={updatedAt} initial={studio} />;
}
