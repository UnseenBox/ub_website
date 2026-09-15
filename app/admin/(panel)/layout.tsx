import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoMark } from "@/components/ui/icons";
import { requireAdmin } from "@/lib/auth/guard";
import { listMessages } from "@/lib/content/mutations";
import { getStore } from "@/lib/content/store";
import { logoutAction } from "../actions";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const store = getStore();
  const unread = (await listMessages().catch(() => [])).filter((m) => !m.read).length;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-zinc-200 bg-white lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-e">
        <div className="flex h-full flex-col gap-4 p-4">
          <Link href="/admin" className="flex items-center gap-2.5 px-2 py-1">
            <LogoMark className="size-6 text-zinc-900" />
            <span className="font-semibold">UnseenBox</span>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-zinc-500">admin</span>
          </Link>
          <AdminNav unread={unread} />
          <div className="mt-auto hidden space-y-3 border-t border-zinc-200 pt-4 text-sm lg:block">
            <a href="/" target="_blank" className="block rounded-md px-2 py-1.5 text-zinc-600 hover:bg-zinc-100">
              View site ↗
            </a>
            <p className="px-2 text-xs text-zinc-500">Signed in as {session.sub}</p>
            <form action={logoutAction}>
              <button className="w-full rounded-md px-2 py-1.5 text-start text-zinc-600 hover:bg-zinc-100">Sign out</button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {!store.writable && (
          <div role="status" className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900">
            <strong>Read-only mode.</strong> No storage is connected, so changes cannot be saved. Connect Upstash Redis
            (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) in your Vercel project and redeploy.
          </div>
        )}
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</div>
        <form action={logoutAction} className="px-4 pb-8 lg:hidden">
          <button className="text-sm text-zinc-600 underline">Sign out</button>
        </form>
      </div>
    </div>
  );
}
