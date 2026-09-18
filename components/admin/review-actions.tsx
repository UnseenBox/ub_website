"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteReviewAction, replyToReviewAction, setReviewStatusAction } from "@/app/admin/actions";
import type { ReviewStatus } from "@/types/content";

export function ReviewActions({
  id,
  status,
  reply,
  email,
  gameTitle,
}: {
  id: string;
  status: ReviewStatus;
  reply?: string;
  email?: string;
  gameTitle: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState(reply ?? "");

  const run = (task: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok && result.error) window.alert(result.error);
      else setReplying(false);
      router.refresh();
    });

  return (
    <div className="grid gap-3" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {status === "pending" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setReviewStatusAction(id, "approved"))}
            className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
          >
            Approve &amp; publish
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setReviewStatusAction(id, "pending"))}
            className="rounded-md border border-zinc-300 px-3 py-1.5 hover:border-amber-400"
          >
            Unpublish
          </button>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={() => setReplying((open) => !open)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 hover:border-violet-400"
        >
          {reply ? "Edit reply" : "Reply publicly"}
        </button>

        {email && (
          <a
            href={`mailto:${email}?subject=${encodeURIComponent(`Re: your review of ${gameTitle}`)}`}
            className="rounded-md px-3 py-1.5 text-violet-700 hover:bg-violet-50"
          >
            Email reviewer
          </a>
        )}

        {confirming ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteReviewAction(id))}
              className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700"
            >
              Confirm delete
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="px-2 text-zinc-600">
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-md px-3 py-1.5 text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>

      {replying && (
        <div className="grid gap-2">
          <textarea
            value={draft}
            rows={3}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="A public reply shown under the review…"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/25"
          />
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => replyToReviewAction(id, draft))}
              className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-violet-600"
            >
              Save reply
            </button>
            {reply && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setDraft("");
                  run(() => replyToReviewAction(id, ""));
                }}
                className="rounded-md px-3 py-1.5 text-red-700 hover:bg-red-50"
              >
                Remove reply
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
