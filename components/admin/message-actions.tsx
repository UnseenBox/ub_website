"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMessageAction, setMessageReadAction } from "@/app/admin/actions";

export function MessageActions({ id, read, email, topic }: { id: string; read: boolean; email: string; topic: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const run = (task: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok && result.error) window.alert(result.error);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" aria-busy={pending}>
      <a
        href={`mailto:${email}?subject=${encodeURIComponent(`Re: ${topic} — UnseenBox`)}`}
        className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-violet-600"
      >
        Reply
      </a>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setMessageReadAction(id, !read))}
        className="rounded-md border border-zinc-300 px-3 py-1.5 hover:border-violet-400"
      >
        Mark as {read ? "unread" : "read"}
      </button>
      {confirming ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteMessageAction(id))}
            className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700"
          >
            Confirm delete
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="px-2 text-zinc-600">
            Cancel
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="rounded-md px-3 py-1.5 text-red-700 hover:bg-red-50">
          Delete
        </button>
      )}
    </div>
  );
}
