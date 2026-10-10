import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayableEditor } from "@/components/admin/playable-editor";
import { requireAdmin } from "@/lib/auth/guard";
import { getContentFresh } from "@/lib/content/queries";
import { playables as seedPlayables } from "@/data/seed/playables";

export const metadata: Metadata = { title: "Edit arcade game" };

export default async function EditPlayablePage({ params }: PageProps<"/admin/playables/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { playables } = await getContentFresh();
  const game = (playables ?? seedPlayables).find((g) => g.id === id);
  if (!game) notFound();
  return <PlayableEditor key={game.updatedAt} initial={game} isNew={false} />;
}
