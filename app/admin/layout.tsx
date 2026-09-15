import "../globals.css";

import type { Metadata } from "next";
import { geist, geistMono } from "@/lib/fonts";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · UnseenBox Admin" },
  robots: { index: false, follow: false, nocache: true },
};

/** Separate root layout: the admin never ships the public site's chrome or motion. */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${geist.variable} ${geistMono.variable} bg-zinc-100 text-zinc-900`}>
      <body className="min-h-dvh bg-zinc-100 font-sans text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
