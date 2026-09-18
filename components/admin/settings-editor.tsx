"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSiteOptionsAction, updateAccountAction } from "@/app/admin/actions";
import { Card, ImageField, TextInput, inputClass } from "./fields";

export function SettingsEditor({
  initial,
  username,
  storageLabel,
  usesStoredPassword,
}: {
  initial: { favicon: string; shareImage: string };
  username: string;
  storageLabel: string;
  usesStoredPassword: boolean;
}) {
  const router = useRouter();

  const [options, setOptions] = useState(initial);
  const [savingOptions, startSaveOptions] = useTransition();
  const [optionsMessage, setOptionsMessage] = useState<string | null>(null);

  const [account, setAccount] = useState({
    username,
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingAccount, startSaveAccount] = useTransition();
  const [accountMessage, setAccountMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const saveOptions = () =>
    startSaveOptions(async () => {
      const result = await saveSiteOptionsAction(options);
      setOptionsMessage(result.ok ? "Saved. The icon updates on the next page load." : (result.error ?? "Failed."));
      if (result.ok) router.refresh();
    });

  const saveAccount = () =>
    startSaveAccount(async () => {
      const result = await updateAccountAction(account);
      setAccountMessage({
        ok: result.ok,
        text: result.ok ? "Account updated. Use the new details next time you sign in." : (result.error ?? "Failed."),
      });
      if (result.ok) {
        setAccount((current) => ({ ...current, currentPassword: "", newPassword: "", confirmPassword: "" }));
        router.refresh();
      }
    });

  return (
    <div className="grid gap-6">
      <Card title="Site icon & sharing" description="Used by browser tabs, bookmarks and link previews.">
        <ImageField
          label="Favicon"
          value={options.favicon}
          onChange={(favicon) => setOptions({ ...options, favicon })}
          aspect="aspect-square"
          hint="A square PNG or SVG, at least 256×256. Empty uses the built-in UnseenBox mark."
        />
        <ImageField
          label="Default share image"
          value={options.shareImage}
          onChange={(shareImage) => setOptions({ ...options, shareImage })}
          aspect="aspect-[1200/630]"
          hint="Shown when the site is shared on social media or chat. 1200×630 works everywhere. Pages with their own artwork keep it."
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveOptions}
            disabled={savingOptions}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-60"
          >
            {savingOptions ? "Saving…" : "Save"}
          </button>
          {optionsMessage && <span className="text-sm text-zinc-600">{optionsMessage}</span>}
        </div>
      </Card>

      <Card
        title="Admin account"
        description={
          usesStoredPassword
            ? "Your username and password are stored in the database and can be changed here."
            : "You are signing in with the ADMIN_USERNAME and ADMIN_PASSWORD environment variables. Saving here stores a new pair in the database, which takes over from them."
        }
      >
        <TextInput
          label="Username"
          value={account.username}
          onChange={(value) => setAccount({ ...account, username: value })}
        />

        <div className="grid gap-1.5">
          <label htmlFor="current-password" className="text-sm font-medium text-zinc-800">
            Current password <span className="text-violet-600">*</span>
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={account.currentPassword}
            onChange={(event) => setAccount({ ...account, currentPassword: event.target.value })}
            className={inputClass}
          />
          <p className="text-xs text-zinc-500">Required for any change, even to the username.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="new-password" className="text-sm font-medium text-zinc-800">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={account.newPassword}
              onChange={(event) => setAccount({ ...account, newPassword: event.target.value })}
              className={inputClass}
            />
            <p className="text-xs text-zinc-500">At least 12 characters. Leave empty to keep the current one.</p>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="confirm-password" className="text-sm font-medium text-zinc-800">
              Repeat new password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={account.confirmPassword}
              onChange={(event) => setAccount({ ...account, confirmPassword: event.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveAccount}
            disabled={savingAccount || !account.currentPassword}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-60"
          >
            {savingAccount ? "Saving…" : "Update account"}
          </button>
          {accountMessage && (
            <span className={accountMessage.ok ? "text-sm text-emerald-700" : "text-sm text-red-600"}>
              {accountMessage.text}
            </span>
          )}
        </div>
      </Card>

      <Card title="Server" description="Set in the hosting environment, not here.">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Content storage</dt>
            <dd className="font-medium">{storageLabel}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Session secret</dt>
            <dd className="font-medium">ADMIN_SESSION_SECRET (environment)</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Site URL</dt>
            <dd className="font-medium">NEXT_PUBLIC_SITE_URL (environment)</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Image uploads</dt>
            <dd className="font-medium">BLOB_READ_WRITE_TOKEN (environment)</dd>
          </div>
        </dl>
        <p className="text-xs text-zinc-500">
          Forgotten password? Clear the stored credentials in the database (the <code>settings</code> row) and the
          environment variables take over again.
        </p>
      </Card>
    </div>
  );
}
