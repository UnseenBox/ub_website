import { LogoMark } from "@/components/ui/icons";
import { SmartImage } from "@/components/ui/smart-image";
import { resolveImageSrc } from "@/lib/images/drive";
import { cn } from "@/lib/utils";

/**
 * The studio mark. Uses the logo image set in the admin when there is one,
 * and falls back to the built-in vector mark plus wordmark otherwise, so the
 * header never renders empty while a logo is being changed.
 */
export function Brand({
  logo,
  name,
  className,
  markClassName,
  wordmarkClassName,
  hideWordmarkOnMobile = false,
}: {
  logo?: string;
  name: string;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  hideWordmarkOnMobile?: boolean;
}) {
  const custom = resolveImageSrc(logo);

  if (custom) {
    return (
      <span className={cn("relative block h-8 w-36", className)}>
        <SmartImage src={logo} alt={name} sizes="144px" className="object-contain object-start" />
      </span>
    );
  }

  return (
    <>
      <LogoMark className={markClassName} />
      <span
        className={cn("font-display", hideWordmarkOnMobile && "hidden sm:inline", wordmarkClassName)}
      >
        {name}
      </span>
    </>
  );
}
