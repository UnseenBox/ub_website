"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { requestAutostart } from "./autostart";

/** A link to a game's page that also asks its player to start (see ./autostart). */
export function GameLink({
  slug,
  href,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  slug: string;
  href: string;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <Link href={href} className={className} aria-label={ariaLabel} onNavigate={() => requestAutostart(slug)}>
      {children}
    </Link>
  );
}
