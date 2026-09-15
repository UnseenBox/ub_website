"use client";

import { useState } from "react";
import { CopyIcon } from "@/components/ui/icons";

export function CopyButton({ value, label, done }: { value: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          window.location.href = `mailto:${value}`;
        }
      }}
      className="label inline-flex h-9 items-center gap-2 border border-line px-3 transition-colors hover:border-uv-400 hover:text-bone"
    >
      <CopyIcon className="size-3.5" />
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  );
}
