import type { ExternalLink, LinkKind } from "@/types/content";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { ExternalIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** Stores first, community and press after. Only links with a URL render. */
const PRIORITY: LinkKind[] = [
  "steam",
  "itch",
  "appStore",
  "googlePlay",
  "nintendo",
  "playstation",
  "xbox",
  "meta",
  "epic",
  "website",
  "discord",
  "press",
  "other",
];

export function StoreLinks({ links, dict, className }: { links: ExternalLink[]; dict: Dictionary; className?: string }) {
  const valid = links
    .filter((link) => /^https?:\/\//.test(link.url))
    .sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));
  if (valid.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {valid.map((link, i) => (
        <li key={`${link.kind}-${i}`}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            data-magnetic
            className={cn(
              "group inline-flex h-12 items-center gap-3 px-5 font-mono text-[0.72rem] uppercase tracking-[0.14em] transition-colors",
              i === 0
                ? "bg-bone text-void hover:bg-uv-500 hover:text-white"
                : "border border-line-strong text-bone hover:border-uv-400 hover:bg-uv-500/10",
            )}
          >
            {link.label || dict.game.links[link.kind]}
            <ExternalIcon className="size-3.5" />
            <span className="sr-only">({dict.a11y.externalLink})</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
