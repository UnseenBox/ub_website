import type { Metadata } from "next";
import Link from "next/link";
import { SmartImage } from "@/components/ui/smart-image";
import { requireAdmin } from "@/lib/auth/guard";
import { getContentFresh } from "@/lib/content/queries";

export const metadata: Metadata = { title: "Games" };

export default async function AdminGamesPage() {
  await requireAdmin();
  const { games } = await getContentFresh();
  const sorted = [...games].sort((a, b) => Number(a.upcoming) - Number(b.upcoming) || a.order - b.order);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Games</h1>
          <p className="text-sm text-zinc-600">Released and upcoming titles. Upcoming games appear in “In the dark”.</p>
        </div>
        <Link href="/admin/games/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600">
          + New game
        </Link>
      </header>

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">
          No games yet. <Link href="/admin/games/new" className="text-violet-700 underline">Add the first one</Link>.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-start text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-start font-medium">Game</th>
                <th className="px-4 py-3 text-start font-medium">Status</th>
                <th className="px-4 py-3 text-start font-medium">Flags</th>
                <th className="px-4 py-3 text-start font-medium">Order</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sorted.map((game) => (
                <tr key={game.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-zinc-100">
                        <SmartImage src={game.poster} alt="" sizes="40px" />
                      </div>
                      <div>
                        <p className="font-medium">{game.title || "Untitled"}</p>
                        <p className="text-xs text-zinc-500">/{game.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize">{game.status.replace("-", " ")}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {game.featured && <span className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-800">Featured</span>}
                      {game.upcoming && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Upcoming</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{game.order}</td>
                  <td className="px-4 py-3 text-end">
                    <Link href={`/admin/games/${game.id}`} className="font-medium text-violet-700 hover:underline">
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
