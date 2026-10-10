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
  // Survival
  { id: 'mechanic-proximity', group: 'SURVIVAL', title: 'Too Close', text: 'A body near a creature registers on its own. No light required.' },
  { id: 'mechanic-gaze', group: 'SURVIVAL', title: 'The Beam', text: 'Shining the flashlight at a creature is far worse than standing beside it.' },
  { id: 'mechanic-flashlight', group: 'SURVIVAL', title: 'Torch', text: 'F toggles the torch. It lets you see — and be seen. Aim it away from teeth.' },
  { id: 'mechanic-speed', group: 'SURVIVAL', title: 'Panic Reads As Panic', text: 'Sprinting is loud and bright. Sneak with C when teeth are near.' },
  { id: 'mechanic-sprint', group: 'SURVIVAL', title: 'Run', text: 'SHIFT sprints while stamina lasts. Exhausted runners stumble and glow.' },
  { id: 'mechanic-dwell', group: 'SURVIVAL', title: 'Holding Still', text: 'Standing exposed in a gaze too long looks deliberate. Something will check.' },
  { id: 'mechanic-click-noise', group: 'SURVIVAL', title: 'Everything Is Loud', text: 'Using anything makes a sound where it stands. Plan the noise.' },
  { id: 'mechanic-loud-click', group: 'SURVIVAL', title: 'Heavy Hands', text: 'Metal, glass and alarms carry much further than a fingertip.' },
  { id: 'mechanic-reach', group: 'SURVIVAL', title: 'Reach', text: 'Your hands only reach so far. Get close — there is no free interaction.' },
  { id: 'mechanic-blind-reach', group: 'SURVIVAL', title: 'Quick Hands', text: 'E uses the nearest thing without aiming. Fast and quiet-ish.' },
  { id: 'mechanic-bottle', group: 'SURVIVAL', title: 'Bottles', text: 'Click empty floor or press Q to throw a bottle lure. Keys restock one.' },
  { id: 'mechanic-darkness', group: 'SURVIVAL', title: 'Darkness', text: 'Unlit bodies are harder to read, but never invisible. Sneak to vanish.' },
  { id: 'mechanic-hiding', group: 'SURVIVAL', title: 'Cover', text: 'Lockers and tables break the hunt. SPACE to hide, SPACE to come out.' },
  { id: 'mechanic-distraction', group: 'SURVIVAL', title: 'Somewhere Else', text: 'A loud enough sound takes a creature off your body entirely.' },
  { id: 'mechanic-decoy', group: 'SURVIVAL', title: 'False Trails', text: 'Some machines scream on their own. Move while they cover you.' },
  { id: 'mechanic-trail', group: 'SURVIVAL', title: 'Where You Have Been', text: 'Something here remembers the paths bodies take. Vary your route.' },
  { id: 'mechanic-escape', group: 'SURVIVAL', title: 'Still Alive', text: 'Being seen is not being caught. A touch costs health — three touches kill.' },

  // Creatures
  { id: 'watcher-gaze', group: 'THE WATCHER', title: 'Direct Gaze', text: 'Cross its cone lit and it will know within a heartbeat.' },
  { id: 'watcher-flank', group: 'THE WATCHER', title: 'Behind It', text: 'It is nearly blind outside the arc it faces. Flank it.' },
  { id: 'watcher-noise', group: 'THE WATCHER', title: 'Hard Of Hearing', text: 'Sound barely moves it. Sight is its whole world.' },
  { id: 'hound-speed', group: 'THE HOUND', title: 'It Smells Hurry', text: 'Sprinting feet are all it needs. Sneak past, never run.' },
  { id: 'hound-calm', group: 'THE HOUND', title: 'Walk, Do Not Run', text: 'Slow deliberate movement passes right under it.' },
  { id: 'sleeper-click', group: 'THE SLEEPER', title: 'One Sound', text: 'A single footstep near it can be enough.' },
  { id: 'sleeper-dwell', group: 'THE SLEEPER', title: 'Watched Sleep', text: 'Loitering lit in its view wakes it without a sound.' },
  { id: 'sleeper-fake', group: 'THE SLEEPER', title: 'It Was Awake', text: 'Sometimes the closed eye is a decision.', secret: true },
  { id: 'mirror-turn', group: 'THE MIRROR', title: 'It Only Turns', text: 'It never walks. Its razor gaze sweeps toward motion.' },
  { id: 'mirror-blind', group: 'THE MIRROR', title: 'Narrow', text: 'Its gaze is a sliver. Outside it, you are nothing.' },
  { id: 'scout-alert', group: 'THE SCOUT', title: 'It Tells', text: 'It cannot catch you. It fetches something that can.' },
  { id: 'liar-tell', group: 'THE LIAR', title: 'Bad Actor', text: 'Its posture is a performance. Watch the feet.' },
  { id: 'mimic-decoy', group: 'THE MIMIC', title: 'False Footsteps', text: 'It fakes footstep sounds elsewhere. Do not follow echoes.', secret: true },
  { id: 'analyst-learn', group: 'THE ANALYST', title: 'It Counts', text: 'The same trick works less well the second time.' },
  { id: 'parasite-neglect', group: 'THE PARASITE', title: 'It Rules Shadow', text: 'Darkness provokes it; torchlight soothes it. Keep the beam lit.' },

  // Objects
  { id: 'object-phone', group: 'THE ROOMS', title: 'Phone', text: 'Rings for five seconds and pulls everything toward it.' },
  { id: 'object-radio', group: 'THE ROOMS', title: 'Radio', text: 'Constant noise. Covers you until you need to hear yourself think.' },
  { id: 'object-light-switch', group: 'THE ROOMS', title: 'Light Switch', text: 'A loud click that makes the room safer afterwards.' },
  { id: 'object-breaker', group: 'THE ROOMS', title: 'Breaker', text: 'Everything at once, and everything hears it.' },
  { id: 'object-glass', group: 'THE ROOMS', title: 'Glass', text: 'The loudest thing you can carry. One use only.' },
  { id: 'object-projector', group: 'THE ROOMS', title: 'Projector', text: 'Screams light and noise across the room. Move while it does.' },
  { id: 'object-computer', group: 'THE ROOMS', title: 'Terminal', text: 'Its screaming holds a creature for a few seconds.' },
  { id: 'object-mirror', group: 'THE ROOMS', title: 'Mirror', text: 'Shows every hunter in the room as a dot of hunger.' },
  { id: 'object-vent', group: 'THE ROOMS', title: 'Vent', text: 'A way across the room through the walls.' },
  { id: 'object-fan', group: 'THE ROOMS', title: 'Fan', text: 'Muddies quiet noises. Not the loud ones.' },
  { id: 'object-alarm', group: 'THE ROOMS', title: 'Alarm', text: 'Twenty five. The whole room, at once, for six seconds.' },
  { id: 'object-push', group: 'THE ROOMS', title: 'Furniture', text: 'It slides, and it scrapes while it slides.' },

  // Secrets
  { id: 'secret-notebook', group: 'LEFT BEHIND', title: 'Notebook', text: 'Someone came through here before you and wrote down the rules.', secret: true },
  { id: 'secret-toy', group: 'LEFT BEHIND', title: 'Toy', text: 'It was not here a moment ago.', secret: true },
  { id: 'secret-moved', group: 'LEFT BEHIND', title: 'It Moved', text: 'You looked away. Something did not stay where it was.', secret: true },
  { id: 'secret-second-cursor', group: 'LEFT BEHIND', title: 'Something Else', text: 'For a moment something else hunted in here beside you.', secret: true },
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
