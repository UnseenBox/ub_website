"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/types/content";

export function StudioClock({ timezone, locale, className }: { timezone: string; locale: Locale; className?: string }) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    let formatter: Intl.DateTimeFormat;
    try {
      formatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : locale, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: timezone,
      });
    } catch {
      formatter = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    const update = () => setTime(formatter.format(new Date()));
    update();
    const id = window.setInterval(update, 20_000);
    return () => window.clearInterval(id);
  }, [timezone, locale]);

  return (
    <time className={className} dir="ltr" suppressHydrationWarning>
      {time ?? "--:--"}
    </time>
  );
}
