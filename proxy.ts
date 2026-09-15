import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, negotiateLocale } from "@/lib/i18n/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * 1. /admin/*  → require a valid signed session (except the login page).
 *    Admin pages and Server Actions re-check the session themselves.
 * 2. Everything else without a locale prefix → redirect to the best locale.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login") return NextResponse.next();
    const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const first = pathname.split("/")[1];
  if (isLocale(first)) return NextResponse.next();

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : negotiateLocale(request.headers.get("accept-language")) || DEFAULT_LOCALE;

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Skip Next internals, metadata files and anything with a file extension.
    "/((?!_next|api|media|favicon.ico|icon.svg|apple-icon.png|robots.txt|sitemap.xml|manifest.webmanifest|.*\\..*).*)",
  ],
};
