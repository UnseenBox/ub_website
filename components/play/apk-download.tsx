import { DownloadIcon, MoodIcon } from "./icons";

/**
 * Big install banner under the player. Rendered only when the game has an
 * installable Android build (Playable.apkUrl).
 */
export function ApkDownload({ url, title, note }: { url: string; title: string; note: string }) {
  return (
    <a
      href={url}
      className="group mt-4 flex items-center gap-4 overflow-hidden rounded-2xl bg-uv-500 p-4 text-white ring-1 ring-uv-400 transition-colors hover:bg-uv-400 sm:p-5"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/15 transition-transform duration-300 group-hover:scale-110 sm:size-14">
        <DownloadIcon className="size-6 sm:size-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-bold sm:text-2xl">{title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-sm text-white/80">
          <MoodIcon mood="phone" className="size-4" />
          {note}
        </span>
      </span>
      <span
        aria-hidden
        className="hidden shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-uv-600 transition-transform duration-300 group-hover:scale-105 sm:block"
      >
        APK
      </span>
    </a>
  );
}
