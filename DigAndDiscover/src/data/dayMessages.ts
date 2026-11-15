/**
 * Short, warm end-of-day lines. One is picked based on how the day went.
 * Keep them grounded and light - the story lives in the background.
 */
export type DayMood = 'empty' | 'modest' | 'good' | 'great';

export const DAY_MESSAGES: Record<DayMood, readonly string[]> = {
  empty: [
    'Not a single coin today. The kids will have to settle for a very nice story.',
    'A quiet day. The shovel is still rusty, but so is the luck. It turns around.',
    'No sales today. Tomorrow the dirt owes him one.',
  ],
  modest: [
    'A few dollars closer to the electric bill. Every bit helps.',
    'Dinner is covered, and maybe a little dessert. Not bad for an old shovel.',
    'Small day, honest work. The family photo on the dashboard smiles back.',
  ],
  good: [
    'A proper day of work! Dinner tonight is going to be fancy.',
    'He whistles all the way home. The bills do not stand a chance today.',
    'Good finds, good money. Somebody is getting extra gravy tonight.',
  ],
  great: [
    'What a haul! The kids are going to hear about this one for weeks.',
    'A day to remember. Even the old shovel looks proud.',
    'Pockets full, spirits high. Home is going to be a happy place tonight.',
  ],
};

/** Moods by money earned that day (tuned for the prototype economy). */
export function moodFor(earned: number): DayMood {
  if (earned <= 0) return 'empty';
  if (earned < 60) return 'modest';
  if (earned < 250) return 'good';
  return 'great';
}

export function pickDayMessage(earned: number, day: number): string {
  const list = DAY_MESSAGES[moodFor(earned)];
  return list[(day - 1) % list.length];
}
