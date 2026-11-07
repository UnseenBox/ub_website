/**
 * Per-tab session memory. A reload (the player's own, the language-change boot, the
 * portal's Arabic switch) starts the page again; without this, every reload would
 * dump the player back on the title card. sessionStorage survives same-tab reloads
 * and dies with the tab, so fresh visits still always land on the menu.
 */
export type SessionScreen = 'menu' | 'levels' | 'game' | 'pause';

export interface SessionSnapshot {
  screen: SessionScreen;
  /** Level index last played; 0 when the player was on the menu. */
  level: number;
}

const KEY = 'crazy-goal-session';
const SCREENS: readonly string[] = ['menu', 'levels', 'game', 'pause'];

export function saveSession(snapshot: SessionSnapshot): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    /* private mode: resume just doesn't happen */
  }
}

export function loadSession(): SessionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { screen?: unknown; level?: unknown };
    if (typeof parsed.screen !== 'string' || !SCREENS.includes(parsed.screen)) return null;
    const level = parsed.level;
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 0) return null;
    return { screen: parsed.screen as SessionScreen, level };
  } catch {
    return null;
  }
}
