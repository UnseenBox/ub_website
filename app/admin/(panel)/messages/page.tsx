import type { Metadata } from "next";
import { MessageActions } from "@/components/admin/message-actions";
import { requireAdmin } from "@/lib/auth/guard";
import { listMessages } from "@/lib/content/mutations";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  await requireAdmin();
  const messages = await listMessages().catch(() => []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Messages</h1>
        <p className="text-sm text-zinc-600">Submissions from the contact form. Stored privately, never shown on the website.</p>
      </header>

      {messages.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">
          No messages yet.
        </p>
      ) : (
        <ul className="grid gap-3">
          {messages.map((m) => (
            <li key={m.id} className={cn("rounded-lg border bg-white p-5", m.read ? "border-zinc-200" : "border-violet-300 shadow-sm")}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="flex items-center gap-2 font-medium">
                  {!m.read && <span className="size-2 rounded-full bg-violet-600" aria-label="Unread" />}
                  {m.name}
                  <a href={`mailto:${m.email}`} className="text-sm font-normal text-violet-700 hover:underline">
                    {m.email}
                  </a>
                </p>
                <p className="text-xs text-zinc-500">
                  {new Date(m.createdAt).toLocaleString("en-GB")} · {m.topic} · {m.locale.toUpperCase()}
                </p>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700" dir="auto">
                {m.message}
              </p>
              <div className="mt-4">
                <MessageActions id={m.id} read={m.read} email={m.email} topic={m.topic} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
