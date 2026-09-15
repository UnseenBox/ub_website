"use client";

import { useEffect, useRef } from "react";

/**
 * One small client island that powers the whole site's motion language:
 *  - scroll reveals for any [data-reveal] element (IntersectionObserver)
 *  - magnetic pull on [data-magnetic] elements (fine pointers only)
 *  - a contextual cursor label for [data-cursor] elements
 * Everything else stays a Server Component.
 */
export function MotionRoot() {
  const auraRef = useRef<HTMLDivElement>(null);

  // Reveals
  useEffect(() => {
    const reveal = (el: Element) => el.classList.add("is-in");
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll("[data-reveal]").forEach(reveal);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal(entry.target);
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const observeAll = (root: ParentNode) =>
      root.querySelectorAll("[data-reveal]:not(.is-in)").forEach((el) => io.observe(el));
    observeAll(document);
    const mo = new MutationObserver((mutations) => {
      for (const mutation of mutations)
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            if (node.matches("[data-reveal]:not(.is-in)")) io.observe(node);
            observeAll(node);
          }
        });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  // Magnetic + cursor aura
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const aura = auraRef.current;
    if (!fine || !aura) return;

    let raf = 0;
    let x = -100;
    let y = -100;
    let ax = x;
    let ay = y;
    let magnet: HTMLElement | null = null;
    let label = "";

    const tick = () => {
      ax += (x - ax) * 0.22;
      ay += (y - ay) * 0.22;
      aura.style.transform = `translate3d(${ax}px, ${ay}px, 0)`;
      if (Math.abs(x - ax) > 0.1 || Math.abs(y - ay) > 0.1) raf = requestAnimationFrame(tick);
      else raf = 0;
    };

    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      if (!raf) raf = requestAnimationFrame(tick);

      const target = event.target instanceof Element ? event.target : null;
      const cursorEl = target?.closest<HTMLElement>("[data-cursor]");
      const nextLabel = cursorEl?.dataset.cursor ?? "";
      if (nextLabel !== label) {
        label = nextLabel;
        aura.dataset.active = label ? "true" : "false";
        const text = aura.querySelector("span");
        if (text) text.textContent = label;
      }

      if (reduced) return;
      const nextMagnet = target?.closest<HTMLElement>("[data-magnetic]") ?? null;
      if (magnet && magnet !== nextMagnet) {
        magnet.style.transform = "";
        magnet = null;
      }
      if (nextMagnet) {
        magnet = nextMagnet;
        const rect = nextMagnet.getBoundingClientRect();
        const dx = (x - (rect.left + rect.width / 2)) / rect.width;
        const dy = (y - (rect.top + rect.height / 2)) / rect.height;
        nextMagnet.style.transform = `translate3d(${dx * 10}px, ${dy * 8}px, 0)`;
      }
    };

    const onLeave = () => {
      if (magnet) magnet.style.transform = "";
      magnet = null;
      aura.dataset.active = "false";
      label = "";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={auraRef}
      aria-hidden
      data-active="false"
      dir="ltr"
      style={{ left: 0, top: 0 }}
      className="pointer-events-none fixed z-[70] hidden [@media(pointer:fine)]:block"
    >
      <div className="cursor-aura -translate-x-1/2 -translate-y-1/2">
        <span />
      </div>
    </div>
  );
}
