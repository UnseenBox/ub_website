import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowIcon, ExternalIcon } from "./icons";

interface LinkButtonProps {
  href: string;
  children: ReactNode;
  variant?: "solid" | "ghost" | "text";
  external?: boolean;
  className?: string;
  icon?: "arrow" | "external" | "none";
  /** Screen-reader suffix for external links. */
  externalLabel?: string;
  cursor?: string;
}

const variants = {
  solid:
    "bg-bone text-void hover:bg-uv-500 hover:text-white px-6 h-12 sm:h-14 sm:px-7",
  ghost:
    "border border-line-strong text-bone hover:border-uv-400 hover:text-white hover:bg-uv-500/10 px-6 h-12 sm:h-14 sm:px-7",
  text: "text-bone hover:text-uv-300 h-10",
};

export function LinkButton({
  href,
  children,
  variant = "solid",
  external,
  className,
  icon = external ? "external" : "arrow",
  externalLabel,
  cursor,
}: LinkButtonProps) {
  const classes = cn(
    "group/btn relative inline-flex items-center justify-center gap-3 font-mono text-[0.72rem] uppercase tracking-[0.16em] transition-colors duration-300 ease-expo select-none",
    variants[variant],
    className,
  );
  const content = (
    <>
      <span data-magnetic-inner className="inline-flex items-center gap-3">
        {children}
        {icon === "arrow" && (
          <ArrowIcon className="size-4 transition-transform duration-500 ease-expo group-hover/btn:translate-x-1 rtl:group-hover/btn:-translate-x-1" />
        )}
        {icon === "external" && <ExternalIcon className="size-4" />}
      </span>
      {external && externalLabel && <span className="sr-only"> ({externalLabel})</span>}
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes} data-magnetic data-cursor={cursor}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} data-magnetic data-cursor={cursor}>
      {content}
    </Link>
  );
}
