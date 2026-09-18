"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/games", label: "Games" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/experiences", label: "Archive" },
  { href: "/admin/studio", label: "Studio & contact" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/media", label: "Images guide" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ unread, pendingReviews }: { unread: number; pendingReviews: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {ITEMS.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between gap-3 whitespace-nowrap rounded-md px-2 py-1.5 text-sm",
                  active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100",
                )}
              >
                {item.label}
                {item.href === "/admin/messages" && unread > 0 && (
                  <span className="rounded-full bg-violet-600 px-1.5 text-xs font-medium text-white">{unread}</span>
                )}
                {item.href === "/admin/reviews" && pendingReviews > 0 && (
                  <span className="rounded-full bg-amber-500 px-1.5 text-xs font-medium text-white">{pendingReviews}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
