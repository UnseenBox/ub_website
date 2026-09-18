import type { Metadata } from "next";
import { SettingsEditor } from "@/components/admin/settings-editor";
import { requireAdmin } from "@/lib/auth/guard";
import { getSettings } from "@/lib/content/mutations";
import { getStore } from "@/lib/content/store";

export const metadata: Metadata = { title: "Settings" };

const STORAGE_LABELS = {
  postgres: "Neon Postgres",
  file: "Local file (.data/)",
  readonly: "Not connected — read-only",
} as const;

export default async function SettingsPage() {
  const session = await requireAdmin();
  const settings = await getSettings().catch(() => null);

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-zinc-600">The site icon, link previews and the account you sign in with.</p>
      </header>

      <SettingsEditor
        initial={{ favicon: settings?.favicon ?? "", shareImage: settings?.shareImage ?? "" }}
        username={session.sub}
        storageLabel={STORAGE_LABELS[getStore().kind]}
        usesStoredPassword={Boolean(settings?.adminPasswordHash)}
      />
    </div>
  );
}
