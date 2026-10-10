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
  | 'first_clear';

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
