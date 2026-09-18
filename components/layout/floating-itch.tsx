"use client";

import { useEffect, useState } from "react";
import { ControllerIcon, ExternalIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * A pill anchored to the bottom corner of every public page, pointing at the
 * itch.io store. Icon only on phones, icon plus label from `sm` up.
 *
 * It steps aside once the footer is on screen: the footer carries its own
 * links, and the pill would otherwise sit on top of "back to top". Without
 * JavaScript it simply stays visible, which is the harmless case.
 */
export function FloatingItch({ url, label, external }: { url: string; label: string; external: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;

    const update = () => setHidden(footer.getBoundingClientRect().top < window.innerHeight);

    // Measured after a frame, and again once images have settled the page
    // height: a measurement taken during load can mistake a short page for
    // "the footer is already here" and hide the pill for good.
    const frame = requestAnimationFrame(update);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("load", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("load", update);
    };
  }, []);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (${external})`}
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : undefined}
      data-magnetic
      className={cn(
        "group fixed bottom-4 end-4 z-40 inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-ink-950/90 px-3.5 py-3 text-bone shadow-[0_18px_40px_-18px_#000] backdrop-blur transition-[background-color,border-color,transform,opacity] duration-500 ease-expo hover:-translate-y-0.5 hover:border-uv-400 hover:bg-uv-500 hover:text-white sm:bottom-6 sm:end-6 sm:px-5",
        // No entrance animation: a call to action that depends on one is
        // invisible wherever animations do not run.
        hidden ? "pointer-events-none translate-y-3 opacity-0" : "opacity-100",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-0 -z-10 rounded-full bg-uv-500/25 opacity-0 blur-lg transition-opacity duration-500 group-hover:opacity-100"
      />
      <ControllerIcon className="size-5 transition-transform duration-500 ease-expo group-hover:-rotate-6" />
      <span className="hidden font-mono text-[0.7rem] uppercase tracking-[0.14em] sm:inline">{label}</span>
      <ExternalIcon className="hidden size-3 opacity-60 transition-opacity group-hover:opacity-100 sm:block" />
    </a>
  );
}
