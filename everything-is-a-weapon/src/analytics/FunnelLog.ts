import type { AnalyticsEventName, AnalyticsParams, AnalyticsSink } from './AnalyticsManager';

/**
 * Local funnel log. Production has no analytics provider, so every event the game
 * tracks used to be discarded. This sink keeps counters and the last few events in
 * the browser's own storage (its own key, never the save file) so a tester can copy
 * the summary out of Settings. It makes no network requests.
 */

export const FUNNEL_KEY = 'bonk/funnel/v1';
export const FUNNEL_RING_SIZE = 200;
const WRITE_INTERVAL_MS = 2000;

export interface FunnelEntry {
  t: number;
  name: string;
  params: AnalyticsParams;
}

export interface FunnelData {
  v: 1;
  firstSeenDay: string;
  lastSeenDay: string;
  sessionIndex: number;
  sessions: { start: number; day: string }[];
  counters: Record<string, number>;
  /** First time (ms since page start) each event happened in the current session. */
  firstMs: Record<string, number>;
  ring: FunnelEntry[];
}

/** Whole days between two YYYY-MM-DD strings (0 when unparseable). */
export function daysBetween(a: string, b: string): number {
  const x = Date.parse(a);
  const y = Date.parse(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  return Math.max(0, Math.round((y - x) / 86_400_000));
}

function today(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function fresh(day: string): FunnelData {
  return { v: 1, firstSeenDay: day, lastSeenDay: day, sessionIndex: 0, sessions: [], counters: {}, firstMs: {}, ring: [] };
}

function load(storage: Storage | null, day: string): FunnelData {
  try {
    const raw = storage?.getItem(FUNNEL_KEY);
    if (!raw) return fresh(day);
    const parsed = JSON.parse(raw) as Partial<FunnelData>;
    if (parsed.v !== 1 || typeof parsed.counters !== 'object' || !Array.isArray(parsed.ring)) return fresh(day);
    return {
      ...fresh(day),
      ...parsed,
      firstMs: {},
      ring: parsed.ring.slice(-FUNNEL_RING_SIZE),
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions.slice(-20) : [],
    } as FunnelData;
  } catch {
    return fresh(day);
  }
}

export class FunnelLog implements AnalyticsSink {
  readonly data: FunnelData;
  /** Days since the previous visit when this session began (0 on the first ever visit). */
  readonly daysSinceLast: number;
  private dirty = false;
  private lastWrite = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly storage: Storage | null = safeStorage(),
    private readonly clock: () => number = () => performance.now(),
    now: Date = new Date(),
  ) {
    const day = today(now);
    this.data = load(storage, day);
    this.daysSinceLast = this.data.sessionIndex > 0 ? daysBetween(this.data.lastSeenDay, day) : 0;
    this.data.sessionIndex++;
    this.data.lastSeenDay = day;
    this.data.sessions.push({ start: now.getTime(), day });
    this.dirty = true;
    this.lastWrite = this.clock() - WRITE_INTERVAL_MS;
    this.flush();
    if (typeof window !== 'undefined') window.addEventListener('pagehide', () => this.flush());
  }

  track(name: AnalyticsEventName, params: AnalyticsParams): void {
    const t = Math.round(this.clock());
    this.data.counters[name] = (this.data.counters[name] ?? 0) + 1;
    this.data.firstMs[name] ??= t;
    this.data.ring.push({ t, name, params });
    if (this.data.ring.length > FUNNEL_RING_SIZE) this.data.ring.splice(0, this.data.ring.length - FUNNEL_RING_SIZE);
    this.dirty = true;
    this.schedule();
  }

  /** Compact text a tester can paste into a message. */
  summary(): string {
    return JSON.stringify({
      v: this.data.v,
      sessionIndex: this.data.sessionIndex,
      firstSeenDay: this.data.firstSeenDay,
      lastSeenDay: this.data.lastSeenDay,
      daysSinceLast: this.daysSinceLast,
      counters: this.data.counters,
      firstMs: this.data.firstMs,
      recent: this.data.ring.slice(-40),
    });
  }

  /** Writes now, whatever the throttle says. Never throws. */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty || !this.storage) return;
    try {
      this.storage.setItem(FUNNEL_KEY, JSON.stringify(this.data));
      this.dirty = false;
    } catch {
      // Private mode or a full quota: the log is a convenience, never a failure.
    }
    this.lastWrite = this.clock();
  }

  private schedule(): void {
    if (this.timer) return;
    const wait = Math.max(0, WRITE_INTERVAL_MS - (this.clock() - this.lastWrite));
    this.timer = setTimeout(() => this.flush(), wait);
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
