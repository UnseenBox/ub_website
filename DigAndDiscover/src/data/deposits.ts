/**
 * Deposits: when the bottom of the ground is reached the digger can relocate to a
 * fresh deposit. Everything he owns comes along; the ground starts over, a little
 * harder and a lot richer, and his tools get a little stronger from experience.
 * Tune the whole endgame from these few functions.
 */

/** Names cycle (and gain a "Mk II" suffix) as deposits go by. */
const NAMES = [
  'Hometown Quarry',
  'Copper Hills',
  'Misty Ravine',
  'Sunset Canyon',
  'Frostbite Fields',
  'Dragon\'s Back',
  'Moonlit Mesa',
  'Thunder Gorge',
];

/** A colour wash over the soil so each deposit looks different (0xffffff = untouched). */
const TINTS = [0xffffff, 0xffd8a8, 0xb8d8ff, 0xd8ffc8, 0xffc4e0, 0xe6d0ff, 0xc8f4f0, 0xffe49a];

export const depositName = (deposit: number): string => {
  const i = Math.max(0, deposit - 1);
  const lap = Math.floor(i / NAMES.length);
  return NAMES[i % NAMES.length] + (lap > 0 ? ` ${'I'.repeat(lap + 1)}` : '');
};

export const depositTint = (deposit: number): number => TINTS[Math.max(0, deposit - 1) % TINTS.length];

/** Ground gets harder: +40% per completed deposit. */
export const hardnessMult = (deposit: number): number => 1 + 0.4 * (deposit - 1);
/** Finds are worth more: +50% per completed deposit (rocks and artifacts). */
export const valueMult = (deposit: number): number => 1 + 0.5 * (deposit - 1);
/** Experience: every tool hits 4% harder per completed deposit. */
export const powerMult = (deposit: number): number => 1 + 0.04 * (deposit - 1);
/** Cash for finishing a deposit (paid when relocating away from `deposit`). */
export const relocationBonus = (deposit: number): number => 1500 * deposit;
