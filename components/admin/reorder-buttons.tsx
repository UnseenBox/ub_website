"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { moveServiceAction } from "@/app/admin/actions";

export function ReorderButtons({ id, isFirst, isLast, label }: { id: string; isFirst: boolean; isLast: boolean; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const move = (direction: -1 | 1) =>
    startTransition(async () => {
      const result = await moveServiceAction(id, direction);
      if (!result.ok) window.alert(result.error);
      router.refresh();
    });

  return (
    <div className="flex gap-1" aria-busy={pending}>
      <button
        type="button"
        onClick={() => move(-1)}
        disabled={isFirst || pending}
        aria-label={`Move ${label} up`}
        className="grid size-8 place-items-center rounded border border-zinc-200 bg-white hover:border-violet-400 disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        disabled={isLast || pending}
        aria-label={`Move ${label} down`}
        className="grid size-8 place-items-center rounded border border-zinc-200 bg-white hover:border-violet-400 disabled:opacity-30"
      >
        ↓
      </button>
    </div>
  );
}
