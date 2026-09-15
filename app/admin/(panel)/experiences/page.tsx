import type { Metadata } from "next";
import Link from "next/link";
import { SmartImage } from "@/components/ui/smart-image";
import { requireAdmin } from "@/lib/auth/guard";
import { getContentFresh } from "@/lib/content/queries";

export const metadata: Metadata = { title: "Archive" };

export default async function AdminExperiencesPage() {
  await requireAdmin();
  const { experiences } = await getContentFresh();
  const sorted = [...experiences].sort((a, b) => b.date.localeCompare(a.date) || a.order - b.order);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Archive</h1>
          <p className="text-sm text-zinc-600">Projects, installations, events, experiments and behind-the-scenes. Sorted by date.</p>
        </div>
        <Link href="/admin/experiences/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600">
          + New entry
        </Link>
      </header>

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">No entries yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((item) => (
            <li key={item.id}>
              <Link href={`/admin/experiences/${item.id}`} className="group block overflow-hidden rounded-lg border border-zinc-200 bg-white hover:border-violet-400">
                <div className="relative aspect-[16/9] bg-zinc-100">
                  <SmartImage src={item.cover} alt="" sizes="(min-width: 1280px) 22rem, 50vw" />
                </div>
                <div className="p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {item.date} · {item.type.replace(/-/g, " ")}
                  </p>
                  <p className="mt-1 font-medium group-hover:text-violet-700">{item.title.en || "Untitled"}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
