export type AnalyticsEvent =
  | 'game_start'
  | 'room_start'
  | 'room_complete'
  | 'room_fail'
  | 'player_killed'
  | 'cursor_detected'
  | 'cursor_escape'
  | 'click_noise'
  | 'discovery_found'
  | 'challenge_complete'
  | 'decoy_used'
  | 'session_end';

export type AnalyticsProps = Record<string, string | number | boolean>;

export interface AnalyticsSink {
  readonly name: string;
  send(event: AnalyticsEvent, props: AnalyticsProps): void;
}

/** Development sink. Prints to the console and keeps a short local history. */
export class ConsoleSink implements AnalyticsSink {
  readonly name = 'console';
  readonly history: { event: AnalyticsEvent; props: AnalyticsProps; at: number }[] = [];

  send(event: AnalyticsEvent, props: AnalyticsProps): void {
    this.history.push({ event, props, at: performance.now() });
    if (this.history.length > 200) this.history.shift();
    if (import.meta.env.DEV) console.debug(`[analytics] ${event}`, props);
  }
}

/**
 * A thin seam so no provider SDK ever appears in gameplay code. There is no
 * external analytics in this build, by design: the development sink logs, and a
 * real sink can be attached with `use` without touching anything else.
 */
export class AnalyticsManager {
  private sink: AnalyticsSink = new ConsoleSink();
  private sessionStart = performance.now();
  private enabled = true;

  use(sink: AnalyticsSink): void {
    this.sink = sink;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
    if (!this.enabled) return;
    try {
      this.sink.send(event, { ...props, t: Math.round(performance.now() - this.sessionStart) });
    } catch (err) {
      console.warn('[analytics] sink threw', err);
    }
  }

  get sinkName(): string {
    return this.sink.name;
  }
}
