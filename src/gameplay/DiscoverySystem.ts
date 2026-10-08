import type { EventBus } from '../core/EventBus';

export interface DiscoveryDef {
  readonly id: string;
  readonly group: string;
  readonly title: string;
  /** Shown once found. Before that the entry is a row of dashes. */
  readonly text: string;
  /** Hidden entries are not even listed as unknown until found. */
  readonly secret?: boolean;
}

/**
 * The book the player fills in by experimenting rather than by reading.
 *
 * Nothing in here is explained up front; every line is earned by having done the
 * thing. That is the progression: knowledge, not stats.
 */
export const DISCOVERIES: readonly DiscoveryDef[] = [
  // The cursor
  { id: 'mechanic-proximity', group: 'ATTENTION', title: 'Too Close', text: 'Attention near a creature registers on its own. No pointing required.' },
  { id: 'mechanic-gaze', group: 'ATTENTION', title: 'Pointing', text: 'A cursor aimed at a creature is far worse than a cursor beside it.' },
  { id: 'mechanic-speed', group: 'ATTENTION', title: 'Panic Reads As Panic', text: 'Some creatures only care how fast you moved. Slow hands live longer.' },
  { id: 'mechanic-dwell', group: 'ATTENTION', title: 'Holding Still', text: 'A cursor frozen too long starts to look deliberate. Something will come to check.' },
  { id: 'mechanic-click-noise', group: 'ATTENTION', title: 'A Click Is A Sound', text: 'Clicking empty air still makes a noise, right where you pointed.' },
  { id: 'mechanic-loud-click', group: 'ATTENTION', title: 'Heavy Hands', text: 'Metal, glass and alarms carry much further than a fingertip.' },
  { id: 'mechanic-reach', group: 'ATTENTION', title: 'Reach', text: 'The cursor can touch what the body cannot. The sound happens anyway.' },
  { id: 'mechanic-blind-reach', group: 'ATTENTION', title: 'Without Looking', text: 'E uses the nearest thing. No cursor has to go anywhere near it.' },
  { id: 'mechanic-darkness', group: 'ATTENTION', title: 'Darkness', text: 'Unlit attention is harder to read, but never invisible.' },
  { id: 'mechanic-hiding', group: 'ATTENTION', title: 'Cover', text: 'Hiding stops a chase. It does not stop a cursor being noticed.' },
  { id: 'mechanic-distraction', group: 'ATTENTION', title: 'Somewhere Else', text: 'A loud enough sound takes a creature off your cursor entirely.' },
  { id: 'mechanic-decoy', group: 'ATTENTION', title: 'A Second Cursor', text: 'Some things in these rooms make attention that is not yours.' },
  { id: 'mechanic-trail', group: 'ATTENTION', title: 'Where You Have Been', text: 'Something here follows where your attention lingered, not where it is.' },
  { id: 'mechanic-escape', group: 'ATTENTION', title: 'Still Alive', text: 'Being seen is not being caught. Break the line and keep moving.' },

  // Creatures
  { id: 'watcher-gaze', group: 'THE WATCHER', title: 'Direct Gaze', text: 'Point at it and it will know within a heartbeat.' },
  { id: 'watcher-flank', group: 'THE WATCHER', title: 'Behind It', text: 'It is nearly deaf to attention outside the arc it faces.' },
  { id: 'watcher-noise', group: 'THE WATCHER', title: 'Hard Of Hearing', text: 'Sound barely moves it. Sight is its whole world.' },
  { id: 'hound-speed', group: 'THE HOUND', title: 'It Smells Hurry', text: 'Fast cursor movement is the only thing it needs.' },
  { id: 'hound-calm', group: 'THE HOUND', title: 'Walk, Do Not Run', text: 'Slow deliberate movement passes right under it.' },
  { id: 'sleeper-click', group: 'THE SLEEPER', title: 'One Sound', text: 'A single click near it is enough.' },
  { id: 'sleeper-dwell', group: 'THE SLEEPER', title: 'Watched Sleep', text: 'Holding your cursor over it will wake it without a sound.' },
  { id: 'sleeper-fake', group: 'THE SLEEPER', title: 'It Was Awake', text: 'Sometimes the closed eye is a decision.', secret: true },
  { id: 'mirror-turn', group: 'THE MIRROR', title: 'It Only Turns', text: 'It never walks. It rotates toward whatever moved last.' },
  { id: 'mirror-blind', group: 'THE MIRROR', title: 'Narrow', text: 'Its attention is a sliver. Outside it, you are nothing.' },
  { id: 'scout-alert', group: 'THE SCOUT', title: 'It Tells', text: 'It cannot catch you. It fetches something that can.' },
  { id: 'liar-tell', group: 'THE LIAR', title: 'Bad Actor', text: 'Its posture is a performance. Watch the feet.' },
  { id: 'mimic-decoy', group: 'THE MIMIC', title: 'Not Your Cursor', text: 'It makes cursors. One of the ones you can see is not yours.', secret: true },
  { id: 'analyst-learn', group: 'THE ANALYST', title: 'It Counts', text: 'The same trick works less well the second time.' },
  { id: 'parasite-neglect', group: 'THE PARASITE', title: 'Look At It', text: 'It grows agitated when your attention avoids it.' },

  // Objects
  { id: 'object-phone', group: 'THE ROOMS', title: 'Phone', text: 'Rings for five seconds and pulls everything toward it.' },
  { id: 'object-radio', group: 'THE ROOMS', title: 'Radio', text: 'Constant noise. Covers you until you need to hear yourself think.' },
  { id: 'object-light-switch', group: 'THE ROOMS', title: 'Light Switch', text: 'A loud click that makes the room safer afterwards.' },
  { id: 'object-breaker', group: 'THE ROOMS', title: 'Breaker', text: 'Everything at once, and everything hears it.' },
  { id: 'object-glass', group: 'THE ROOMS', title: 'Glass', text: 'The loudest thing you can carry. One use only.' },
  { id: 'object-projector', group: 'THE ROOMS', title: 'Projector', text: 'Throws a cursor that is not yours across the room.' },
  { id: 'object-computer', group: 'THE ROOMS', title: 'Terminal', text: 'Its blinking is enough to hold a creature for a few seconds.' },
  { id: 'object-mirror', group: 'THE ROOMS', title: 'Mirror', text: 'Shows you what is behind the wall, and lies about where you are.' },
  { id: 'object-vent', group: 'THE ROOMS', title: 'Vent', text: 'A way across the room that no cursor has to travel.' },
  { id: 'object-fan', group: 'THE ROOMS', title: 'Fan', text: 'Muddies quiet noises. Not the loud ones.' },
  { id: 'object-alarm', group: 'THE ROOMS', title: 'Alarm', text: 'Twenty five. The whole room, at once, for six seconds.' },
  { id: 'object-push', group: 'THE ROOMS', title: 'Furniture', text: 'It slides, and it scrapes while it slides.' },

  // Secrets
  { id: 'secret-notebook', group: 'LEFT BEHIND', title: 'Notebook', text: 'Someone came through here before you and wrote down the rules.', secret: true },
  { id: 'secret-toy', group: 'LEFT BEHIND', title: 'Toy', text: 'It was not here a moment ago.', secret: true },
  { id: 'secret-moved', group: 'LEFT BEHIND', title: 'It Moved', text: 'You looked away. Something did not stay where it was.', secret: true },
  { id: 'secret-second-cursor', group: 'LEFT BEHIND', title: 'Two Cursors', text: 'For a moment there were two, and only one of them was yours.', secret: true },
];

const BY_ID = new Map(DISCOVERIES.map((d) => [d.id, d]));

export class DiscoverySystem {
  private readonly found = new Set<string>();
  /** Discoveries earned during the current attempt, for the results screen. */
  private readonly thisRun = new Set<string>();

  constructor(private readonly bus: EventBus) {}

  load(ids: readonly string[]): void {
    this.found.clear();
    for (const id of ids) if (BY_ID.has(id)) this.found.add(id);
  }

  beginRun(): void {
    this.thisRun.clear();
  }

  /** Record a discovery. Silently ignores unknown ids so behaviours can be liberal. */
  find(id: string): boolean {
    const def = BY_ID.get(id);
    if (!def) return false;
    if (this.found.has(id)) return false;
    this.found.add(id);
    this.thisRun.add(id);
    this.bus.emit('DISCOVERY_FOUND', { id });
    this.bus.emit('TOAST', { text: `DISCOVERY  ${def.title.toUpperCase()}`, tone: 'warm' });
    return true;
  }

  has(id: string): boolean {
    return this.found.has(id);
  }

  get all(): readonly string[] {
    return Array.from(this.found);
  }

  get runCount(): number {
    return this.thisRun.size;
  }

  get count(): number {
    return this.found.size;
  }

  get total(): number {
    return DISCOVERIES.length;
  }

  /** Grouped view for the discovery screen. */
  grouped(): { group: string; entries: { def: DiscoveryDef; found: boolean }[] }[] {
    const groups = new Map<string, { def: DiscoveryDef; found: boolean }[]>();
    for (const def of DISCOVERIES) {
      const found = this.found.has(def.id);
      if (def.secret && !found) continue;
      let list = groups.get(def.group);
      if (!list) {
        list = [];
        groups.set(def.group, list);
      }
      list.push({ def, found });
    }
    return Array.from(groups, ([group, entries]) => ({ group, entries }));
  }
}
