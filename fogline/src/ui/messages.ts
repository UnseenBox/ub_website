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
