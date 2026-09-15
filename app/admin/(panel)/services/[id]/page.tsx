import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceEditor } from "@/components/admin/service-editor";
import { requireAdmin } from "@/lib/auth/guard";
import { getContentFresh } from "@/lib/content/queries";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditServicePage({ params }: PageProps<"/admin/services/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { services, updatedAt } = await getContentFresh();
  const service = services.find((s) => s.id === id);
  if (!service) notFound();
  return <ServiceEditor key={updatedAt} initial={service} isNew={false} />;
}
