import type { Metadata } from "next";
import { ServiceEditor } from "@/components/admin/service-editor";
import { requireAdmin } from "@/lib/auth/guard";
import { newService } from "@/lib/content/factories";
import { getContentFresh } from "@/lib/content/queries";

export const metadata: Metadata = { title: "New service" };

export default async function NewServicePage() {
  await requireAdmin();
  const { services } = await getContentFresh();
  return <ServiceEditor initial={newService(services.length + 1)} isNew />;
}
