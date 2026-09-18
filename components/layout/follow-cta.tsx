import { InstagramIcon, YoutubeIcon, ControllerIcon, ExternalIcon } from "@/components/ui/icons";
import { SectionLabel } from "@/components/ui/section-label";
import type { SocialLink } from "@/types/content";
import { cn } from "@/lib/utils";

interface Copy {
  label: string;
  title: string;
  intro: string;
  instagram: string;
  youtube: string;
  itch: string;
  externalLink: string;
}

const ICONS = {
  instagram: InstagramIcon,
  youtube: YoutubeIcon,
  itch: ControllerIcon,
} as const;

type Platform = keyof typeof ICONS;

/**
 * Follow buttons for the platforms the studio actually uses: a link left
 * blank in the admin simply does not appear, and the band hides itself when
 * none are set.
 */
export function FollowCta({ socials, copy, index = "06" }: { socials: SocialLink[]; copy: Copy; index?: string }) {
  const url = (platform: Platform) => socials.find((social) => social.platform === platform)?.url?.trim();

  const buttons = (["instagram", "youtube", "itch"] as const)
    .map((platform) => ({ platform, url: url(platform), label: copy[platform] }))
    .filter((button): button is { platform: Platform; url: string; label: string } => Boolean(button.url));

  if (buttons.length === 0) return null;

  return (
    <section aria-labelledby="follow-heading" className="border-t border-line bg-ink-950">
      <div className="shell grid gap-10 py-20 sm:py-24 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
        <div>
          <SectionLabel index={index}>{copy.label}</SectionLabel>
          <h2 id="follow-heading" data-reveal className="font-display mt-6 text-title text-balance">
            {copy.title}
          </h2>
          <p className="mt-5 max-w-md text-mist">{copy.intro}</p>
        </div>

        <ul className="flex flex-wrap gap-3 lg:justify-end">
          {buttons.map(({ platform, url: href, label }, i) => {
            const Icon = ICONS[platform];
            return (
              <li key={platform}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-magnetic
                  className={cn(
                    "group inline-flex h-14 items-center gap-3 px-6 font-mono text-[0.72rem] uppercase tracking-[0.14em] transition-colors duration-500",
                    i === 0
                      ? "bg-bone text-void hover:bg-uv-500 hover:text-white"
                      : "border border-line-strong text-bone hover:border-uv-400 hover:bg-uv-500/10",
                  )}
                >
                  <Icon className="size-5 transition-transform duration-500 ease-expo group-hover:scale-110" />
                  {label}
                  <ExternalIcon className="size-3 opacity-50 transition-opacity group-hover:opacity-100" />
                  <span className="sr-only">({copy.externalLink})</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
