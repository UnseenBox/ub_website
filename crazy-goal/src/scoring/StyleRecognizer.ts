import type { ShotResult } from './ShotAnalyzer';

export interface StyleLine {
  label: string;
  points: number;
}

/** World units per metre, for the distance shown to the player. */
export const UNITS_PER_METRE = 40;

/** Banks, by how many touches the ball took on its way in. Index is the bounce count. */
const BANK_LINES: ReadonlyArray<StyleLine> = [
  { label: 'STRAIGHT IN', points: 100 },
  { label: 'BANK SHOT', points: 300 },
  { label: 'DOUBLE BANK', points: 800 },
  { label: 'TRIPLE BANK', points: 1500 },
];

/**
 * Names what was special about a goal. Each rule looks only at the facts in ShotResult, so a
 * new label is one more `if` here and nothing anywhere else.
 */
export function recognizeStyles(r: ShotResult): StyleLine[] {
  if (!r.goal) return [];
  const lines: StyleLine[] = [{ label: 'GOAL', points: 1000 }];
  const add = (label: string, points: number): void => {
    lines.push({ label, points });
  };

  const bank = BANK_LINES[r.bounces];
  if (bank) lines.push(bank);
  else add('PINBALL GOAL', 2400 + (r.bounces - 4) * 400);

  // The things in the street.
  let props = 0;
  if (r.touched.car) (add('OFF THE TAXI', 500), props++);
  if (r.touched.crate) (add('FRUIT SALAD', 300), props++);
  if (r.touched.hedge) (add('HEDGEHOPPER', 350), props++);
  if (r.did.has('boing')) (add('BOING', 400), props++);
  if (r.did.has('bumper')) (add('PINBALL WIZARD', 650), props++);
  if (r.did.has('spin')) (add('SPIN DOCTOR', 700), props++);
  if (r.did.has('wind')) (add('WIND RIDER', 450), props++);
  if (r.did.has('pipe')) (add('PIPE DREAM', 700), props++);
  if (r.did.has('smash')) (add('SMASH AND GRAB', 600), props++);
  if (r.did.has('bell')) (add('DING DONG', 300), props++);
  if (r.did.has('scooter')) (add('SCOOTER ASSIST', 900), props++);
  if (r.did.has('sand')) add('BEACH FOOTBALL', 250);
  if (r.did.has('save')) add('OFF THE CAT', 900);
  else if (r.keeper) add('PAST MIMI', 400);
  if (props >= 3) add('CHAIN REACTION', 2000);
  if (r.did.has('bumper') && r.did.has('boing')) add('BOING BOING', 800);

  // How it was struck.
  if (r.touched.post) add('IN OFF THE POST', 800);
  if (r.boomerang) add('BOOMERANG', 900);
  if (r.distance > 1800) add('LONG RANGE', 500);
  if (r.entrySpeed > 1000) add('ROCKET', 300);
  else if (r.entrySpeed < 190) add('JUST ENOUGH', 400);
  // Dead centre only counts when the ball had to work to get there.
  if (r.bounces >= 1 && Math.abs(r.entryOffset) < 0.14) add('PERFECT', 1500);
  if (r.bounces >= 5) add('YA SALAM!', 3000);
  return lines;
}

/** The single label that best sums the goal up: the one worth the most, bar the base goal. */
export function headline(lines: readonly StyleLine[]): string {
  let best: StyleLine | null = null;
  for (let i = 1; i < lines.length; i++) {
    if (!best || lines[i].points > best.points) best = lines[i];
  }
  return best ? best.label : 'GOAL';
}
