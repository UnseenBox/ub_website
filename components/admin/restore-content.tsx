"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreStarterContentAction } from "@/app/admin/actions";

/**
 * Re-imports the starter games, services, archive entries and studio profile.
 * Upserts only: anything you added stays, nothing is deleted — but items that
 * share an id with starter content are reset to it.
 */
export function RestoreContent() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  const run = () =>
    startTransition(async () => {
      const result = await restoreStarterContentAction();
      if (!result.ok && result.error) window.alert(result.error);
      else setDone(true);
      setConfirming(false);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm" aria-busy={pending}>
      {confirming ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={run}
            className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-violet-600"
          >
            {pending ? "Restoring…" : "Yes, re-import"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="px-2 text-zinc-600">
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 hover:border-violet-400"
        >
          Restore starter content
        </button>
      )}
      <span className="text-xs text-zinc-500">
        {done
          ? "Starter content re-imported."
          : "Puts back any starter game, service or archive entry that was deleted. Your own items are untouched."}
      </span>
    </div>
  );
}
