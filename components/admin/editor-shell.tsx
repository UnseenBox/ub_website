"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { ActionResult } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

/**
 * Wraps every admin editor: header, sticky save bar, result messages and a
 * two-step delete. Editors own their state and hand over save/delete calls.
 */
export function EditorShell({
  title,
  backHref,
  backLabel,
  viewHref,
  onSave,
  onDelete,
  afterSaveHref,
  children,
}: {
  title: string;
  backHref: string;
  backLabel: string;
  viewHref?: string;
  onSave: () => Promise<ActionResult>;
  onDelete?: () => Promise<ActionResult>;
  afterSaveHref?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  const save = () =>
    startTransition(async () => {
      const response = await onSave();
      setResult(response);
      if (response.ok) {
        if (afterSaveHref) router.replace(afterSaveHref);
        router.refresh();
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

  const remove = () =>
    startTransition(async () => {
      if (!onDelete) return;
      const response = await onDelete();
      if (response.ok) {
        router.push(backHref);
        router.refresh();
      } else {
        setResult(response);
        setConfirming(false);
      }
    });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="pb-24"
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={backHref} className="text-sm text-zinc-500 hover:text-zinc-900">
            ← {backLabel}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
        </div>
        {viewHref && (
          <a href={viewHref} target="_blank" className="text-sm text-violet-700 hover:underline">
            View on site ↗
          </a>
        )}
      </header>

      {result && (
        <div
          role={result.ok ? "status" : "alert"}
          className={cn(
            "mb-6 rounded-md border px-4 py-3 text-sm",
            result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900",
          )}
        >
          <p className="font-medium">{result.ok ? result.message ?? "Saved." : result.error}</p>
          {!result.ok && result.issues && (
            <ul className="mt-2 list-disc ps-5">
              {result.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-6">{children}</div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 backdrop-blur lg:ps-60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-2">
            {onDelete &&
              (confirming ? (
                <>
                  <span className="text-sm text-red-700">Delete permanently?</span>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={pending}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Yes, delete
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="px-2 text-sm text-zinc-600">
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="rounded-md px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              ))}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
