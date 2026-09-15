"use client";

import { useEffect, useRef } from "react";

/**
 * The void. A field of dormant pixels that wakes up under the cursor, and a
 * layer of hidden words only visible inside that light. On touch devices the
 * light drifts on its own; with reduced motion it holds still.
 */
export function HeroField({ words }: { words: string[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!root || !canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;

    let width = 0;
    let height = 0;
    let cell = 16;
    let cols = 0;
    let rows = 0;
    let energy = new Float32Array(0);
    let seamRow = 0;

    const pointer = { x: -9999, y: -9999, lastMove: 0 };
    const light = { x: 0, y: 0 };
    let visible = true;
    let raf = 0;
    let last = 0;

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      cell = width < 640 ? 18 : 15;
      cols = Math.ceil(width / cell);
      rows = Math.ceil(height / cell);
      energy = new Float32Array(cols * rows);
      seamRow = Math.round(rows * 0.62);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      light.x = width * 0.68;
      light.y = height * 0.42;
    };

    const inject = (px: number, py: number, radius: number, strength: number) => {
      const r = Math.ceil(radius / cell);
      const cx = Math.floor(px / cell);
      const cy = Math.floor(py / cell);
      for (let y = Math.max(0, cy - r); y <= Math.min(rows - 1, cy + r); y++) {
        for (let x = Math.max(0, cx - r); x <= Math.min(cols - 1, cx + r); x++) {
          const d = Math.hypot(x - cx, y - cy) / r;
          if (d > 1) continue;
          // Sparse, dithered falloff so it reads as pixels, not a blur.
          if (Math.random() > 1 - d * 0.55) continue;
          const i = y * cols + x;
          energy[i] = Math.min(1, energy[i] + strength * (1 - d) * (1 - d));
        }
      }
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      const breathe = 0.5 + 0.5 * Math.sin(time / 1400);
      const size = cell - 3;
      for (let y = 0; y < rows; y++) {
        const seamBoost = y === seamRow ? 0.08 + breathe * 0.1 : 0;
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const e = energy[i];
          const v = e + (seamBoost && (x * 7) % 5 === 0 ? seamBoost : 0);
          if (v < 0.02) continue;
          ctx.fillStyle = v > 0.72 ? `rgba(236,226,255,${v})` : `rgba(143,91,255,${Math.min(1, v * 0.95)})`;
          ctx.fillRect(x * cell + 1.5, y * cell + 1.5, size, size);
        }
      }
    };

    const step = (time: number) => {
      raf = requestAnimationFrame(step);
      if (!visible) return;
      const dt = Math.min(64, time - last || 16);
      last = time;

      const idle = time - pointer.lastMove > 2600;
      const targetX = idle ? width * (0.55 + 0.3 * Math.sin(time / 3100)) : pointer.x;
      const targetY = idle ? height * (0.45 + 0.22 * Math.sin(time / 2300 + 1)) : pointer.y;
      light.x += (targetX - light.x) * (idle ? 0.03 : 0.2);
      light.y += (targetY - light.y) * (idle ? 0.03 : 0.2);

      root.style.setProperty("--mx", `${light.x}px`);
      root.style.setProperty("--my", `${light.y}px`);

      inject(light.x, light.y, idle ? 110 : 150, idle ? 0.1 : 0.2);
      // Ambient twinkle
      for (let k = 0; k < 3; k++) {
        const i = Math.floor(Math.random() * energy.length);
        energy[i] = Math.max(energy[i], Math.random() * 0.35);
      }
      const decay = Math.pow(0.93, dt / 16);
      for (let i = 0; i < energy.length; i++) energy[i] *= decay;
      draw(time);
    };

    const onPointer = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.lastMove = performance.now();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);

    if (reduced) {
      // A single, still constellation.
      for (let k = 0; k < 90; k++) inject(Math.random() * width, Math.random() * height, 40, 0.25);
      inject(light.x, light.y, 160, 0.6);
      root.style.setProperty("--mx", `${light.x}px`);
      root.style.setProperty("--my", `${light.y}px`);
      draw(0);
      return () => ro.disconnect();
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && document.visibilityState === "visible";
    });
    io.observe(root);
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", onPointer, { passive: true });
    if (!fine) window.addEventListener("pointerdown", onPointer, { passive: true });
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return (
    <div ref={rootRef} aria-hidden className="absolute inset-0 -z-10 overflow-hidden [--mx:68%] [--my:42%]">
      <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_70%_62%,rgb(109_52_240/0.18),transparent_65%)]" />
      <canvas ref={canvasRef} className="absolute inset-0 animate-fade [animation-delay:400ms]" />
      {/* Hidden layer — revealed only inside the light */}
      <div
        className="absolute inset-0 [mask-image:radial-gradient(circle_190px_at_var(--mx)_var(--my),#000_0%,transparent_100%)]"
        dir="ltr"
      >
        {words.map((word, i) => (
          <span
            key={`${word}-${i}`}
            className="font-pixel absolute text-[clamp(0.7rem,1.1vw,0.95rem)] uppercase text-uv-300"
            style={{
              left: `${(i * 37 + 11) % 88 + 4}%`,
              top: `${(i * 53 + 17) % 76 + 12}%`,
            }}
          >
            {`[${word}]`}
          </span>
        ))}
        <div className="absolute inset-0 [background-image:linear-gradient(rgb(203_182_255/0.12)_1px,transparent_1px),linear-gradient(90deg,rgb(203_182_255/0.12)_1px,transparent_1px)] [background-size:60px_60px]" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-void to-transparent" />
    </div>
  );
}
