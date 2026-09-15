/**
 * Image source normalisation.
 *
 * Editors can paste any of these into the admin and they all resolve to a
 * direct, optimisable image URL:
 *   - https://drive.google.com/file/d/<ID>/view?usp=sharing
 *   - https://drive.google.com/open?id=<ID>
 *   - https://drive.google.com/uc?export=view&id=<ID>
 *   - https://drive.usercontent.google.com/download?id=<ID>
 *   - https://lh3.googleusercontent.com/d/<ID>
 *   - drive:<ID>   (shorthand)
 *   - /media/...   (files shipped in /public)
 *   - any https URL on an allowed host (see next.config.ts remotePatterns)
 *
 * The Drive file must be shared as "Anyone with the link can view".
 * The resolved URL is then passed through next/image, so Vercel fetches it
 * once per size and serves AVIF/WebP from its CDN — Drive is never hit by
 * visitors directly.
 */

const DRIVE_ID = /^[A-Za-z0-9_-]{20,}$/;

export function extractDriveId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (value.startsWith("drive:")) {
    const id = value.slice(6);
    return DRIVE_ID.test(id) ? id : null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname;
  if (host === "lh3.googleusercontent.com") {
    const match = url.pathname.match(/^\/d\/([A-Za-z0-9_-]{20,})/);
    return match?.[1] ?? null;
  }
  if (host === "drive.google.com" || host === "docs.google.com" || host === "drive.usercontent.google.com") {
    const pathMatch = url.pathname.match(/\/d\/([A-Za-z0-9_-]{20,})/);
    if (pathMatch) return pathMatch[1];
    const id = url.searchParams.get("id");
    return id && DRIVE_ID.test(id) ? id : null;
  }
  return null;
}

export function isDriveSource(input: string): boolean {
  return extractDriveId(input) !== null;
}

/** Resolve an editor-provided image reference to a URL next/image accepts. */
export function resolveImageSrc(input: string | undefined | null): string | null {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;
  const driveId = extractDriveId(value);
  if (driveId) return `https://lh3.googleusercontent.com/d/${driveId}=w2560`;
  if (value.startsWith("/")) return value;
  if (/^https:\/\//.test(value)) return value;
  return null;
}

/** Hosts next/image is configured to optimise. Others render unoptimised. */
const OPTIMISABLE_HOSTS = new Set([
  "lh3.googleusercontent.com",
  "drive.google.com",
  "drive.usercontent.google.com",
  "i.ytimg.com",
]);

export function canOptimise(src: string): boolean {
  if (src.startsWith("/")) return !src.endsWith(".svg");
  try {
    const url = new URL(src);
    return OPTIMISABLE_HOSTS.has(url.hostname) && !url.search;
  } catch {
    return false;
  }
}
