export type AnalyticsEventName =
  | 'game_start'
  | 'room_start'
  | 'room_complete'
  | 'room_fail'
  | 'object_grab'
  | 'object_throw'
  | 'object_break'
  | 'enemy_defeat'
  | 'chain_reaction'
  | 'new_discovery'
  | 'challenge_complete'
  | 'session_end'
  | 'first_input'
  | 'first_grab'
  | 'first_throw'
  | 'first_hit'
  | 'first_clear'
  | 'run_start'
  | 'run_continue'
  | 'run_end'
  | 'edge_offer'
  | 'edge_pick'
  | 'heat_tier'
  | 'boss_arrive'
  | 'boss_defeat'
  | 'daily_start'
  | 'daily_clear'
  | 'daily_already_paid'
  | 'ledger_claim'
  | 'tutorial_skip';

export type AnalyticsParams = Readonly<Record<string, string | number | boolean>>;

/** Anything that can receive events: a console logger now, a vendor SDK adapter later. */
export interface AnalyticsSink {
  track(name: AnalyticsEventName, params: AnalyticsParams): void;
}

class ConsoleSink implements AnalyticsSink {
  track(name: AnalyticsEventName, params: AnalyticsParams): void {
    console.debug(`[analytics] ${name}`, params);
  }
}

/** Vendor-neutral analytics facade. Gameplay code only knows event names, never a provider. */
export class AnalyticsManager {
  private readonly sinks: AnalyticsSink[] = [];
  private readonly sessionStart = performance.now();

  constructor() {
    if (import.meta.env.DEV) this.sinks.push(new ConsoleSink());
    window.addEventListener('pagehide', () => {
      this.track('session_end', { seconds: Math.round((performance.now() - this.sessionStart) / 1000) });
    });
  }

  addSink(sink: AnalyticsSink): void {
    this.sinks.push(sink);
  }

  track(name: AnalyticsEventName, params: AnalyticsParams = {}): void {
    for (const sink of this.sinks) {
      try {
        sink.track(name, params);
      } catch (error) {
        console.warn('[analytics] sink failed', error);
      }
    }
  }
}
