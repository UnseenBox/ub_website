/**
 * Analytics: a subscriber on the game's EventBus that turns what the player does into a handful of
 * named events (the funnel that tunes the chapter gate, the coin values and the "stuck" threshold).
 *
 * It is provider-agnostic. A development build logs every event to the console; a production build
 * has a no-op provider and sends nothing, to anyone, until the owner picks a provider and gives it
 * to `setProvider`. Events carry numbers, ids and flags only: no player id, no name, no free text.
 */
import type { EventBus, GameEvents } from '../core/EventBus';

export type AnalyticsProps = Readonly<Record<string, string | number | boolean>>;

export interface AnalyticsProvider {
  track(name: string, props: AnalyticsProps): void;
}

/** Development: every event on the console, so a fresh-save session can be read as a funnel. */
export const consoleProvider: AnalyticsProvider = {
  track(name, props) {
    console.info(`[analytics] ${name}`, props);
  },
};

/** Production until a provider is chosen: nothing leaves the page. */
export const noopProvider: AnalyticsProvider = {
  track() {
    /* intentionally empty */
  },
};

export class Analytics {
  constructor(private provider: AnalyticsProvider) {}

  setProvider(provider: AnalyticsProvider): void {
    this.provider = provider;
  }

  /** Sends one event. A provider that throws must never reach the game. */
  track(name: string, props: AnalyticsProps = {}): void {
    try {
      this.provider.track(name, props);
    } catch {
      /* reporting must never break the game */
    }
  }
}

export const analytics = new Analytics(import.meta.env.DEV ? consoleProvider : noopProvider);

/** Subscribes a sink to the bus. Returns the function that unsubscribes it again. */
export function wireAnalytics(events: EventBus<GameEvents>, sink: Pick<Analytics, 'track'> = analytics): () => void {
  const offs = [
    events.on('LEVEL_STARTED', (e) => sink.track('level_start', { level: e.level, chapter: e.chapter })),
    events.on('LEVEL_GOAL', (e) => sink.track('level_goal', { level: e.level, stars: e.stars, score: e.score, attempts: e.attempts, first_clear: e.firstClear, bounces: e.bounces })),
    events.on('LEVEL_GATE_BLOCKED', (e) => sink.track('level_gate_blocked', { level: e.level, need: e.need, have: e.have })),
    events.on('FK_STAGE_ENDED', (e) => sink.track('fk_stage_end', { stage: e.stage, stars: e.stars, coins: e.coins })),
    events.on('DAILY_DONE', (e) => sink.track('daily_done', { date: e.date, goals: e.goals, streak: e.streak, coins: e.coins })),
    events.on('BOOST_USED', (e) => sink.track('boost_used', { boost: e.boost, free: e.free })),
    events.on('AD_OFFERED', (e) => sink.track('ad_offer', { kind: e.kind })),
    events.on('AD_DONE', (e) => sink.track('ad_done', { kind: e.kind, granted: e.granted })),
  ];
  return () => {
    for (const off of offs) off();
  };
}
