// Text rules for the battle screen. Pure functions, so they are unit-tested without Phaser.
//
// In combat the screen carries at most a few words at a time. A radio line keeps its
// full text in the radio log (opened from the pause menu); on screen it shows its first
// sentence when that is short enough, otherwise its first words with an ellipsis.

/** The most words a line may show on screen during a battle. */
export const SCREEN_WORDS = 6;

/** Shortens a line for the battle screen (see the rules above). */
export function clipWords(text: string, max = SCREEN_WORDS): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const words = clean.split(' ').filter(Boolean);
  if (words.length <= max) return clean;
  const first = clean.match(/^[^.!?]+[.!?]/);
  if (first && first[0].trim().split(' ').length <= max) return first[0].trim();
  return `${words.slice(0, max).join(' ')}…`;
}

/** Number of words in a line (as the audit counts them). */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Keeps the radio log to the last `max` lines so it stays readable. */
export function appendLog<T>(log: T[], line: T, max = 40): void {
  log.push(line);
  if (log.length > max) log.splice(0, log.length - max);
}

/** The short value shown under a bonus star (the full goal is on the map). */
export function bonusValue(goal: import('../data/missions').BonusGoal): string {
  switch (goal.kind) {
    case 'headshots': return `${goal.count}`;
    case 'accuracy': return `${Math.round(goal.fraction * 100)}%`;
    case 'assetHealth': return `${Math.round(goal.fraction * 100)}%`;
    case 'saveAll': return 'ALL';
    case 'noSupport': return goal.id === 'nuke' ? 'NO NUKE' : goal.id === 'gunship' ? 'NO GUNSHIP' : 'NO LANCE';
  }
}

/** Up to three one-word tags that say what is new about an enemy (shown on its threat card). */
export function threatTags(def: import('../data/enemies').EnemyDef): string[] {
  const s = def.special;
  const tags: string[] = [];
  if (def.boss) tags.push('BOSS');
  if (s?.ranged) tags.push('RANGED');
  if (s?.howl) tags.push('HOWLS');
  if (s?.burstInto) tags.push('SPLITS');
  if (s?.detonateDamage || s?.deathBlast) tags.push('EXPLODES');
  if (s?.burrow) tags.push('BURROWS');
  if (s?.sporeCloud) tags.push('CLOUDS');
  if (def.speed >= 3.5) tags.push('FAST');
  if (def.armoredZones.length > 0 || def.staggerThreshold >= 700) tags.push('ARMOURED');
  if (def.zoneMultiplier.head >= 1.2 && tags.length < 3) tags.push('HEAD');
  if (s?.ranged && tags.length < 3) tags.push('GLOWS = SPIT');
  return tags.slice(0, 3);
}

/** The short name of a mission objective, for its chip on the map. */
export function objectiveLabel(o: import('../data/missions').Objective): string {
  switch (o.kind) {
    case 'hold': return 'HOLD';
    case 'protect': return o.name;
    case 'evacuate': return `SAVE ${o.mustSave}/${o.vehicles} ${o.name}`;
    case 'nests': return `DESTROY ${o.count} NESTS`;
    case 'boss': return 'BOSS';
  }
}

/** The number a workshop track adds per level: "+6% fire rate, -8% spread" gives "+6%". */
export function gainChip(perLevel: string): string {
  const m = perLevel.match(/[+-]?\d+(\.\d+)?%?/);
  return m ? m[0] : perLevel;
}

/** Skin and jacket colours for each speaker's radio portrait. */
const PORTRAITS: Record<string, { skin: string; body: string }> = {
  HALE: { skin: '#c9a27e', body: '#3d4630' },
  VARGA: { skin: '#e0c0a0', body: '#5a6e7a' },
  KESTREL: { skin: '#d8b090', body: '#4a5668' },
  DOT: { skin: '#a87858', body: '#7a5c28' },
  MARA: { skin: '#d0a484', body: '#3e5a46' },
  BRICK: { skin: '#b88a68', body: '#6a4a30' },
  ROOK: { skin: '#c89c78', body: '#6e5a3a' },
  VESNA: { skin: '#e4c4aa', body: '#54466a' },
};

export function portraitColours(who: string): { skin: string; body: string } {
  return PORTRAITS[who.trim().toUpperCase()] ?? { skin: '#c9a27e', body: '#4a4c48' };
}

export type TagTone = 'plain' | 'gold' | 'green' | 'red';

/** The icon and colour a threat tag is shown with. */
export function tagStyle(tag: string): { icon: import('./iconPaths').IconName; tone: TagTone } {
  switch (tag) {
    case 'BOSS': return { icon: 'skull', tone: 'red' };
    case 'RANGED': return { icon: 'acid', tone: 'green' };
    case 'HEAD': return { icon: 'head', tone: 'gold' };
    case 'HOWLS': return { icon: 'howl', tone: 'plain' };
    case 'SPLITS': return { icon: 'split', tone: 'plain' };
    case 'EXPLODES': return { icon: 'blast', tone: 'red' };
    case 'BURROWS': return { icon: 'burrow', tone: 'plain' };
    case 'CLOUDS': return { icon: 'cloud', tone: 'plain' };
    case 'FAST': return { icon: 'fast', tone: 'gold' };
    case 'ARMOURED': return { icon: 'shield', tone: 'plain' };
    default: return { icon: 'bolt', tone: 'plain' };
  }
}

export interface StripChip {
  icon: import('./iconPaths').IconName;
  text: string;
  tone: TagTone;
}

/** What the strip needs to know about the battle so far. */
export interface StripState {
  /** Health left on a protected asset, 0–1. */
  asset: number;
  nestsLeft: number;
  saved: number;
  lost: number;
  headshots: number;
  /** Null before the first shot. */
  accuracy: number | null;
  supportsUsed: string[];
}

/** The chips at the top of the battle screen: the objective, then the bonus star's goal (if any). */
export function stripChips(
  o: import('../data/missions').Objective, bonus: import('../data/missions').BonusGoal | null, s: StripState,
): StripChip[] {
  const chips: StripChip[] = [];
  switch (o.kind) {
    case 'hold':
      chips.push({ icon: 'shield', text: 'HOLD', tone: 'plain' });
      break;
    case 'boss':
      chips.push({ icon: 'skull', text: 'BOSS', tone: 'red' });
      break;
    case 'protect':
      chips.push({ icon: 'mast', text: `${Math.ceil(s.asset * 100)}%`, tone: s.asset < 0.35 ? 'red' : 'plain' });
      break;
    case 'nests':
      chips.push({ icon: 'nest', text: `${s.nestsLeft}`, tone: s.nestsLeft === 0 ? 'green' : 'plain' });
      break;
    case 'evacuate':
      chips.push({ icon: 'truck', text: `${s.saved}/${o.mustSave}`, tone: s.saved >= o.mustSave ? 'green' : 'plain' });
      if (s.lost > 0) chips.push({ icon: 'cross', text: `${s.lost}`, tone: 'red' });
      break;
  }
  if (!bonus) return chips;
  switch (bonus.kind) {
    case 'headshots':
      chips.push({ icon: 'head', text: `${Math.min(s.headshots, bonus.count)}/${bonus.count}`, tone: s.headshots >= bonus.count ? 'green' : 'gold' });
      break;
    case 'accuracy': {
      const goal = Math.round(bonus.fraction * 100);
      chips.push(s.accuracy === null
        ? { icon: 'gauge', text: `${goal}%`, tone: 'gold' }
        : { icon: 'gauge', text: `${Math.round(s.accuracy * 100)}/${goal}%`, tone: s.accuracy >= bonus.fraction ? 'green' : 'gold' });
      break;
    }
    case 'noSupport': {
      const used = s.supportsUsed.includes(bonus.id);
      const icon = bonus.id === 'nuke' ? 'nuke' : bonus.id === 'gunship' ? 'heli' : 'orbital';
      chips.push({ icon, text: used ? 'USED' : 'NO', tone: used ? 'red' : 'gold' });
      break;
    }
    case 'assetHealth':
      chips.push({ icon: 'star', text: `${Math.round(bonus.fraction * 100)}%`, tone: s.asset >= bonus.fraction ? 'gold' : 'red' });
      break;
    case 'saveAll':
      chips.push({ icon: 'star', text: 'ALL', tone: s.lost > 0 ? 'red' : 'gold' });
      break;
  }
  return chips;
}
