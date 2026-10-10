"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restorePlayablesAction } from "@/app/admin/actions";

/** One-click reseed for an empty arcade, used in the playables list empty state. */
export function RestorePlayables() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await restorePlayablesAction();
            if (result.ok) router.refresh();
            else setError(result.error);
          })
        }
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-60"
      >
        {pending ? "Restoring…" : "Restore starter arcade"}
      </button>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
