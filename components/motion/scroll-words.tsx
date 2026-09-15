"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Words brighten one by one as the paragraph scrolls through the viewport. */
export function ScrollWords({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(/\s+/).filter(Boolean);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = [...el.querySelectorAll<HTMLSpanElement>("[data-word]")];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      spans.forEach((span) => (span.style.opacity = "1"));
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.min(1, Math.max(0, (vh * 0.85 - rect.top) / (rect.height + vh * 0.3)));
      const lit = progress * spans.length;
      spans.forEach((span, i) => {
        const v = Math.min(1, Math.max(0, lit - i));
        span.style.opacity = String(0.16 + v * 0.84);
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        window.addEventListener("scroll", onScroll, { passive: true });
        update();
      } else {
        window.removeEventListener("scroll", onScroll);
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [text]);

  return (
    <p ref={ref} className={cn(className)}>
      {words.map((word, i) => (
        <span key={i} data-word className="transition-opacity duration-300" style={{ opacity: 0.16 }}>
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}
