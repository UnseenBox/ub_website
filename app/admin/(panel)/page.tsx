import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guard";
import { listMessages } from "@/lib/content/mutations";
import { getContentFresh } from "@/lib/content/queries";
import { getStore } from "@/lib/content/store";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await requireAdmin();
  const [content, messages] = await Promise.all([getContentFresh(), listMessages().catch(() => [])]);
  const store = getStore();

  const stats = [
    { label: "Released games", value: content.games.filter((g) => !g.upcoming).length, href: "/admin/games" },
    { label: "In development", value: content.games.filter((g) => g.upcoming).length, href: "/admin/games" },
    { label: "Services", value: content.services.length, href: "/admin/services" },
    { label: "Archive entries", value: content.experiences.length, href: "/admin/experiences" },
    { label: "Unread messages", value: messages.filter((m) => !m.read).length, href: "/admin/messages" },
  ];

  const storageLabel = {
    file: "Local file (.data/content.json)",
    redis: "Upstash Redis",
    readonly: "Not connected — read-only",
  }[store.kind];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Last content update: {new Date(content.updatedAt).toLocaleString("en-GB")} · Storage: {storageLabel}
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <li key={stat.label}>
            <Link href={stat.href} className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-violet-400">
              <p className="text-3xl font-semibold tabular-nums">{stat.value}</p>
              <p className="mt-1 text-sm text-zinc-600">{stat.label}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold">Quick actions</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            <li><Link className="text-violet-700 hover:underline" href="/admin/games/new">+ Add a game</Link></li>
            <li><Link className="text-violet-700 hover:underline" href="/admin/services/new">+ Add a service</Link></li>
            <li><Link className="text-violet-700 hover:underline" href="/admin/experiences/new">+ Add an archive entry</Link></li>
            <li><Link className="text-violet-700 hover:underline" href="/admin/studio">Edit about text, contact & social links</Link></li>
            <li><Link className="text-violet-700 hover:underline" href="/admin/media">How to use Google Drive images</Link></li>
          </ul>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Latest messages</h2>
            <Link href="/admin/messages" className="text-sm text-violet-700 hover:underline">All messages</Link>
          </div>
          {messages.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No messages yet. Submissions from the contact page appear here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100">
              {messages.slice(0, 5).map((m) => (
                <li key={m.id} className="py-2.5 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    {!m.read && <span className="size-2 rounded-full bg-violet-600" aria-label="Unread" />}
                    {m.name} <span className="font-normal text-zinc-500">· {m.topic}</span>
                  </p>
                  <p className="truncate text-zinc-600">{m.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
