import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameEditor } from "@/components/admin/game-editor";
import { requireAdmin } from "@/lib/auth/guard";
import { getContentFresh } from "@/lib/content/queries";

export const metadata: Metadata = { title: "Edit game" };

export default async function EditGamePage({ params }: PageProps<"/admin/games/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { games } = await getContentFresh();
  const game = games.find((g) => g.id === id);
  if (!game) notFound();
  return <GameEditor key={game.updatedAt} initial={game} isNew={false} />;
}
