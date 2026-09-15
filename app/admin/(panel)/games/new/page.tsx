import type { Metadata } from "next";
import { GameEditor } from "@/components/admin/game-editor";
import { requireAdmin } from "@/lib/auth/guard";
import { newGame } from "@/lib/content/factories";
import { getContentFresh } from "@/lib/content/queries";

export const metadata: Metadata = { title: "New game" };

export default async function NewGamePage() {
  await requireAdmin();
  const { games } = await getContentFresh();
  const order = games.reduce((max, g) => Math.max(max, g.order), 0) + 1;
  return <GameEditor initial={newGame(order)} isNew />;
}
