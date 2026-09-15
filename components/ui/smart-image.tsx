import Image from "next/image";
import { canOptimise, resolveImageSrc } from "@/lib/images/drive";
import { cn } from "@/lib/utils";

interface SmartImageProps {
  src: string | undefined | null;
  alt: string;
  sizes: string;
  className?: string;
  /** Fills the nearest positioned parent (default). */
  fill?: boolean;
  width?: number;
  height?: number;
  preload?: boolean;
  quality?: 60 | 75 | 90;
  loading?: "lazy" | "eager";
}

/**
 * Wraps next/image with the Drive/remote normalisation rules and a
 * graceful empty state when an editor leaves a field blank.
 */
export function SmartImage({
  src,
  alt,
  sizes,
  className,
  fill = true,
  width,
  height,
  preload,
  quality = 75,
  loading,
}: SmartImageProps) {
  const resolved = resolveImageSrc(src);

  if (!resolved) {
    return (
      <div
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        className={cn(
          "bg-ink-800 [background-image:radial-gradient(rgb(143_91_255/0.25)_1px,transparent_1px)] [background-size:12px_12px]",
          fill && "absolute inset-0",
          className,
        )}
      />
    );
  }

  const dimensions = fill ? { fill: true as const } : { width: width ?? 1600, height: height ?? 900 };

  return (
    <Image
      src={resolved}
      alt={alt}
      sizes={sizes}
      quality={quality}
      preload={preload}
      loading={preload ? undefined : loading}
      unoptimized={!canOptimise(resolved)}
      className={cn("object-cover", className)}
      {...dimensions}
    />
  );
}
