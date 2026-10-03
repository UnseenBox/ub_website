"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SmartImage } from "@/components/ui/smart-image";
import { ArrowIcon, CloseIcon } from "@/components/ui/icons";
import { cn, pad } from "@/lib/utils";

interface GalleryProps {
  images: string[];
  altPrefix: string;
  copy: { gallery: string; close: string; previous: string; next: string; image: string; of: string };
  layout?: "strip" | "grid";
}

/** Until a file has loaded, assume the common case so nothing jumps far. */
const DEFAULT_RATIO = 16 / 9;

/**
 * Lazy thumbnails + an accessible <dialog> lightbox with keyboard and swipe
 * support.
 *
 * Each thumbnail is shown at the file's own aspect ratio, measured when it
 * loads, so a phone game's portrait screenshots are not cropped to landscape.
 * In the strip layout every item shares one height and varies in width, which
 * keeps a mixed set of orientations looking deliberate.
 */
export function Gallery({ images, altPrefix, copy, layout = "strip" }: GalleryProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const touchX = useRef<number | null>(null);

  const measure = (src: string) => (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) return;
    setRatios((current) =>
      current[src] ? current : { ...current, [src]: naturalWidth / naturalHeight },
    );
  };

  const open = (i: number) => {
    setIndex(i);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();
  const go = useCallback(
    (delta: number) => setIndex((i) => (i === null ? i : (i + delta + images.length) % images.length)),
    [images.length],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => setIndex(null);
    const onKey = (event: KeyboardEvent) => {
      const rtl = document.documentElement.dir === "rtl";
      if (event.key === "ArrowRight") go(rtl ? -1 : 1);
      if (event.key === "ArrowLeft") go(rtl ? 1 : -1);
    };
    dialog.addEventListener("close", onClose);
    dialog.addEventListener("keydown", onKey);
    return () => {
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("keydown", onKey);
    };
  }, [go]);

  if (images.length === 0) return null;

  return (
    <>
      <ul
        aria-label={copy.gallery}
        className={cn(
          layout === "strip"
            ? "scrollbar-none -mx-[clamp(1rem,4vw,3.5rem)] flex snap-x items-stretch gap-4 overflow-x-auto px-[clamp(1rem,4vw,3.5rem)] pb-4"
            : "grid items-start gap-4 sm:grid-cols-2",
        )}
      >
        {images.map((src, i) => (
          <li
            key={`${src}-${i}`}
            className={cn(
              layout === "strip"
                ? "h-[58vw] max-h-[24rem] shrink-0 snap-start sm:h-[26rem] sm:max-h-none"
                : i === 0 && "sm:col-span-2",
            )}
          >
            <button
              type="button"
              onClick={() => open(i)}
              style={{ aspectRatio: ratios[src] ?? DEFAULT_RATIO }}
              className={cn(
                "group frame relative block overflow-hidden bg-ink-800",
                layout === "strip" ? "h-full w-auto" : "w-full",
              )}
              aria-label={`${copy.image} ${i + 1} ${copy.of} ${images.length}`}
              data-cursor="+"
            >
              <SmartImage
                src={src}
                alt={`${altPrefix}: ${copy.image} ${i + 1}`}
                sizes={layout === "strip" ? "(min-width: 640px) 42rem, 85vw" : "(min-width: 640px) 50vw, 100vw"}
                onLoad={measure(src)}
                className="transition-transform duration-[1200ms] ease-expo group-hover:scale-[1.03]"
              />
              <span className="font-pixel absolute bottom-3 end-3 bg-void/70 px-2 py-1 text-[0.65rem]" dir="ltr">
                {pad(i + 1)}/{pad(images.length)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label={copy.gallery}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-void/95 p-0 text-bone backdrop:bg-void/80 open:grid open:grid-rows-[auto_1fr_auto]"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="flex items-center justify-between px-4 py-4 sm:px-8">
          <p className="font-pixel text-sm text-mist" dir="ltr" aria-live="polite">
            {index !== null ? `${pad(index + 1)} / ${pad(images.length)}` : ""}
          </p>
          <button
            type="button"
            onClick={close}
            aria-label={copy.close}
            className="grid size-11 place-items-center border border-line-strong hover:border-uv-400"
            autoFocus
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
        <div
          className="relative mx-4 sm:mx-20"
          onTouchStart={(event) => (touchX.current = event.touches[0].clientX)}
          onTouchEnd={(event) => {
            if (touchX.current === null) return;
            const dx = event.changedTouches[0].clientX - touchX.current;
            const rtl = document.documentElement.dir === "rtl";
            if (Math.abs(dx) > 50) go((dx < 0 ? 1 : -1) * (rtl ? -1 : 1));
            touchX.current = null;
          }}
        >
          {index !== null && (
            <SmartImage
              key={images[index]}
              src={images[index]}
              alt={`${altPrefix}: ${copy.image} ${index + 1}`}
              sizes="100vw"
              quality={90}
              className="animate-fade object-contain"
            />
          )}
        </div>
        <div className="flex justify-center gap-2 px-4 py-5">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={copy.previous}
            className="grid size-12 place-items-center border border-line-strong hover:border-uv-400"
          >
            <ArrowIcon className="size-5 -scale-x-100 rtl:scale-x-100" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={copy.next}
            className="grid size-12 place-items-center border border-line-strong hover:border-uv-400"
          >
            <ArrowIcon className="size-5" />
          </button>
        </div>
      </dialog>
    </>
  );
}
