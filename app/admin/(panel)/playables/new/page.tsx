import type { Metadata } from "next";
import { PlayableEditor } from "@/components/admin/playable-editor";
import { requireAdmin } from "@/lib/auth/guard";
import { newPlayable } from "@/lib/content/factories";
import { getContentFresh } from "@/lib/content/queries";
import { playables as seedPlayables } from "@/data/seed/playables";

export const metadata: Metadata = { title: "New arcade game" };

export default async function NewPlayablePage() {
  await requireAdmin();
  const { playables } = await getContentFresh();
  const order = (playables ?? seedPlayables).reduce((max, g) => Math.max(max, g.order), 0) + 1;
  return <PlayableEditor initial={newPlayable(order)} isNew />;
}
