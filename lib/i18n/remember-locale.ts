import { LOCALE_COOKIE, type Locale } from "./config";

/** Persist the visitor's explicit language choice for proxy.ts negotiation. */
export function rememberLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}
