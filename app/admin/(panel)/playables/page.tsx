import type { Metadata } from "next";
import Link from "next/link";
import { RestorePlayables } from "@/components/admin/restore-playables";
import { SmartImage } from "@/components/ui/smart-image";
import { requireAdmin } from "@/lib/auth/guard";
import { getContentFresh } from "@/lib/content/queries";
import { playables as seedPlayables } from "@/data/seed/playables";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Arcade" };

export default async function AdminPlayablesPage() {
  await requireAdmin();
  const { playables } = await getContentFresh();
  const sorted = [...(playables ?? seedPlayables)].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Arcade</h1>
          <p className="text-sm text-zinc-600">
            Browser games on /play. Switch a game off to hide it from the site without deleting it.
          </p>
        </div>
        <Link href="/admin/playables/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600">
          + New arcade game
        </Link>
      </header>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
          <p className="text-zinc-500">
            No arcade games. The /play page is empty until you restore the starter set or add one manually.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <RestorePlayables />
            <Link href="/admin/playables/new" className="text-sm font-medium text-violet-700 hover:underline">
              Add one manually
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-start text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-start font-medium">Game</th>
                <th className="px-4 py-3 text-start font-medium">Moods</th>
                <th className="px-4 py-3 text-start font-medium">Status</th>
                <th className="px-4 py-3 text-start font-medium">Order</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sorted.map((game) => (
                <tr key={game.id} className={cn("hover:bg-zinc-50", !game.enabled && "opacity-60")}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded bg-zinc-100">
                        <SmartImage src={game.poster} alt="" sizes="96px" />
                      </div>
                      <div>
                        <p className="font-medium">{game.title || "Untitled"}</p>
                        <p className="text-xs text-zinc-500">/play/{game.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-48 flex-wrap gap-1.5">
                      {game.moods.map((mood) => (
                        <span key={mood} className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                          {mood}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {game.enabled ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Playable</span>
                    ) : (
                      <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600">Disabled</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{game.order}</td>
                  <td className="px-4 py-3 text-end">
                    <Link href={`/admin/playables/${game.id}`} className="font-medium text-violet-700 hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
