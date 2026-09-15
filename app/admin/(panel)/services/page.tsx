import type { Metadata } from "next";
import Link from "next/link";
import { ReorderButtons } from "@/components/admin/reorder-buttons";
import { PixelGlyph } from "@/components/ui/pixel-glyph";
import { requireAdmin } from "@/lib/auth/guard";
import { getContentFresh } from "@/lib/content/queries";

export const metadata: Metadata = { title: "Services" };

export default async function AdminServicesPage() {
  await requireAdmin();
  const { services } = await getContentFresh();
  const sorted = [...services].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Services</h1>
          <p className="text-sm text-zinc-600">Order here is the order on the website.</p>
        </div>
        <Link href="/admin/services/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600">
          + New service
        </Link>
      </header>

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">No services yet.</p>
      ) : (
        <ol className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {sorted.map((service, i) => (
            <li key={service.id} className="flex items-center gap-4 px-4 py-3">
              <ReorderButtons id={service.id} isFirst={i === 0} isLast={i === sorted.length - 1} label={service.title.en} />
              <span className="w-6 text-sm tabular-nums text-zinc-400">{i + 1}</span>
              <PixelGlyph glyph={service.glyph} className="size-6 text-violet-600 [&_rect]:opacity-100" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{service.title.en || "Untitled"}</p>
                <p className="truncate text-sm text-zinc-500">{service.kicker.en}</p>
              </div>
              <div className="hidden gap-1 text-xs sm:flex">
                {(["fr", "ar"] as const).map((lang) => (
                  <span key={lang} className={service.title[lang] ? "rounded bg-emerald-50 px-1.5 text-emerald-700" : "rounded bg-zinc-100 px-1.5 text-zinc-400"}>
                    {lang.toUpperCase()}
                  </span>
                ))}
              </div>
              <Link href={`/admin/services/${service.id}`} className="text-sm font-medium text-violet-700 hover:underline">
                Edit
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
