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

/** The letter shown in a radio portrait: the speaker's first letter. */
export function portraitInitial(who: string): string {
  return (who.trim()[0] ?? '?').toUpperCase();
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
  return tags.slice(0, 3);
}
