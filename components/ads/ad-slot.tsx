"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() || "ca-pub-3020230827559587";
const DEFAULT_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT?.trim() || "2539078519";

/**
 * A display-ad placement for the arcade. Renders a live AdSense unit once
 * NEXT_PUBLIC_ADSENSE_CLIENT (and a slot) is configured; until then a
 * labelled placeholder holds the space so layouts can be reviewed.
 */
export function AdSlot({
  slot = DEFAULT_SLOT,
  format = "auto",
  label,
  className,
}: {
  /** Ad-unit ID. Defaults to NEXT_PUBLIC_ADSENSE_SLOT. */
  slot?: string;
  /** AdSense sizing: auto fills, rectangle suits the 20rem sidebar. */
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  /** Small-caps "Advertisement" caption, already localised by the caller. */
  label: string;
  className?: string;
}) {
  const live = Boolean(CLIENT && slot);
  // Diagnostic only: visiting a page with ?adtest=1 asks Google for a test
  // creative instead of a paid one. Proves the integration works while the
  // account/site review is still pending. Never link to it publicly.
  const [ready, setReady] = useState(false);
  const [test, setTest] = useState(false);

  useEffect(() => {
    let testMode = false;
    try {
      testMode = new URLSearchParams(window.location.search).has("adtest");
    } catch {
      testMode = false;
    }
    setTest(testMode);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!live || !ready) return;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // Ad blockers throw here; the slot simply stays empty.
    }
  }, [live, slot, ready]);

  return (
    <div data-sponsor className={cn("overflow-hidden rounded-xl bg-ink-950 ring-1 ring-line", className)}>
      <p className="border-b border-line px-4 py-1.5 text-center font-mono text-[0.6rem] uppercase tracking-[0.2em] text-fog">
        {label}
      </p>
      {live ? (
        <ins
          className="adsbygoogle block text-center"
          data-ad-client={CLIENT}
          data-ad-slot={slot}
          data-ad-format={format}
          data-full-width-responsive="true"
          {...(test ? { "data-adtest": "on" } : {})}
        />
      ) : (
        <div
          aria-hidden
          className="grid min-h-28 place-items-center px-6 py-8 [background-image:radial-gradient(rgb(143_91_255/0.16)_1px,transparent_1px)] [background-size:12px_12px]"
        >
          <span className="rounded-md bg-ink-800 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.18em] text-mist ring-1 ring-line">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
