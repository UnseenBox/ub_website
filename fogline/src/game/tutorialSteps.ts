// The first-time briefing: what each step says, and what has to happen before the
// player can move on. Pure data and rules; the on-screen overlay lives in ui/Tutorial.ts.

import { ENEMIES } from '../data/enemies';
import { DEFENSES, MODS, SUPPORT } from '../data/upgrades';
import { CLASSIC_WEAPONS as WEAPONS } from '../data/weapons';

export type StepId =
  | 'welcome' | 'aim' | 'fire' | 'weapons' | 'switch' | 'reload' | 'enemies' | 'zones'
  | 'bunker' | 'arsenal' | 'armory' | 'waves' | 'finish';

/** What lets the player move on: a Continue press, or something they must do first. */
export type Gate = 'continue' | 'fire' | 'switch' | 'reload' | 'armory' | 'wave';

export interface TutorialStep {
  id: StepId;
  title: string;
  lines: string[];
  gate: Gate;
  /** Shown while a practice step waits for the player. */
  hint?: string;
}

export interface StepOptions {
  touch: boolean;
  legSlow: { factor: number; seconds: number };
}

/** What has happened since the current step started. */
export interface Facts {
  /** The practice zombie has been killed. */
  fireDone: boolean;
  /** Keys pressed since the step started, lower case ('1', 'r', ' ', 'enter'). */
  keys: ReadonlySet<string>;
  /** The armory was opened during this step. */
  shopOpened: boolean;
  /** At least one wave has been deployed. */
  waveStarted: boolean;
}

/** A gate that has been passed shows "Well done" for this long before the next step. */
export const GATE_PAUSE_SECONDS = 0.9;

const pct = (x: number): number => Math.round(x * 100);

export function buildSteps(o: StepOptions): TutorialStep[] {
  const m4 = WEAPONS.find((w) => w.id === 'm4')!;
  const unlocks = WEAPONS.filter((w) => w.unlockAfterWave > 0)
    .map((w) => `${w.shortName} after wave ${w.unlockAfterWave}`)
    .join(', ');
  const modNames = MODS.map((m) => m.name).join(', ');
  const supportNames = SUPPORT.map((s) => s.name).join(', ');
  const defenseNames = DEFENSES.map((d) => d.name).join(', ');
  const shambler = ENEMIES.shambler;
  const brute = ENEMIES.brute;

  return [
    {
      id: 'welcome',
      title: 'HOLD THE LINE',
      lines: [
        'The fog is full of the dead. They walk out of it toward your bunker and claw at the wall.',
        'This briefing shows you every weapon, system and enemy. Skip it at any time.',
      ],
      gate: 'continue',
    },
    {
      id: 'aim',
      title: 'AIM',
      lines: o.touch
        ? ['Drag with one finger on the left side of the screen to move the crosshair.', 'It is pulled gently toward nearby zombies, so small drags are enough.']
        : ['Your crosshair follows the mouse, and your shots go exactly where it sits.', 'Keep the window clear: anything that gets through the frame is out of sight.'],
      gate: 'continue',
    },
    {
      id: 'fire',
      title: 'FIRE',
      lines: o.touch
        ? ['Hold FIRE on the right, or tap the battlefield. A practice zombie stands in the window.', 'Aim for the head: a headshot does extra damage and pays a bonus.']
        : ['Click to fire. A practice zombie stands in the window.', 'Aim for the head: a headshot does extra damage and pays a bonus.'],
      gate: 'fire',
      hint: 'Shoot the practice zombie',
    },
    {
      id: 'weapons',
      title: 'FOUR WEAPONS',
      lines: [
        `Your M1A is free. The others go on sale in the armory once you clear the wave they unlock at: ${unlocks}.`,
        'Each card shows damage, fire rate, magazine and price. Heavier guns hit harder and cost more.',
      ],
      gate: 'continue',
    },
    {
      id: 'switch',
      title: 'SWITCH WEAPONS',
      lines: o.touch
        ? ['Tap a weapon slot at the bottom left to switch.', `Try the second slot: the ${m4.shortName} stays locked until wave ${m4.unlockAfterWave} is cleared.`]
        : ['Press 1 to 4 to switch. A locked weapon says so and does nothing.', `Try 2 now: the ${m4.shortName} stays locked until wave ${m4.unlockAfterWave} is cleared.`],
      gate: 'switch',
      hint: 'Press 2 (or 1, 3, 4)',
    },
    {
      id: 'reload',
      title: 'RELOAD',
      lines: o.touch
        ? ['Tap RLD on the right to reload. The bottom-right counter shows the magazine and the reserve.', 'Reload while the field is quiet: a reload takes time, and an empty magazine cannot fire.']
        : ['Press R to reload. The bottom-right counter shows the magazine and the reserve.', 'Reload while the field is quiet: a reload takes time, and an empty magazine cannot fire.'],
      gate: 'reload',
      hint: 'Press R',
    },
    {
      id: 'enemies',
      title: 'KNOW YOUR ENEMIES',
      lines: ['Each enemy walks in from the fog. Watch them come, one at a time.'],
      gate: 'continue',
    },
    {
      id: 'zones',
      title: 'WHERE TO HIT',
      lines: [
        `Head: a headshot does extra damage and pays a bonus (+$${shambler.headshotBonus} on a shambler).`,
        `Legs: a leg hit slows the zombie to ${pct(o.legSlow.factor)}% for ${o.legSlow.seconds} seconds.`,
        `Body: armour and fat soak damage. The Brute's body takes only ${pct(brute.zoneMultiplier.torso)}%, so aim higher.`,
      ],
      gate: 'continue',
    },
    {
      id: 'bunker',
      title: 'THE BUNKER',
      lines: [
        'Zombies that reach the wall claw at the bunker. Its integrity bar sits at the bottom right.',
        'At zero the line falls and the run ends. Repair Crew (W) patches it, and the armory raises its maximum.',
      ],
      gate: 'continue',
    },
    {
      id: 'arsenal',
      title: 'MODS, SUPPORT, DEFENCES',
      lines: [
        `Ammo mods on keys 5 to 8: ${modNames}.`,
        `Support on A, S and D: ${supportNames}.`,
        `Bunker defences on W and E: ${defenseNames}. Each has charges and a cooldown.`,
      ],
      gate: 'continue',
    },
    {
      id: 'armory',
      title: 'THE ARMORY',
      lines: o.touch
        ? ['Cash comes from kills and from the bonus for clearing a wave. Tap SHOP at the top left.', 'Buy weapons, ammo, mods, support and bunker upgrades. Locked weapons stay grey.']
        : ['Cash comes from kills and from the bonus for clearing a wave. Press SPACE to open the armory.', 'Buy weapons, ammo, mods, support and bunker upgrades. Locked weapons stay grey until their wave is cleared.'],
      gate: 'armory',
      hint: 'Press SPACE',
    },
    {
      id: 'waves',
      title: 'WAVES',
      lines: o.touch
        ? ['Each wave arrives after a countdown. Clear all of its zombies for a completion bonus and the next unlock.', 'Tap DEPLOY to start wave 1. Pause from the top left at any time.']
        : ['Each wave arrives after a countdown. Clear all of its zombies for a completion bonus and the next unlock.', 'Press ENTER to deploy wave 1. P or Esc pauses at any time.'],
      gate: 'wave',
      hint: o.touch ? 'Tap DEPLOY' : 'Press ENTER',
    },
    {
      id: 'finish',
      title: 'YOU ARE READY',
      lines: ['That is everything you need, Commander. Hold the line.', 'You can replay this briefing from the main menu at any time.'],
      gate: 'continue',
    },
  ];
}

/** True when the player may move on from this step now. */
export function canAdvance(step: TutorialStep, f: Facts): boolean {
  switch (step.gate) {
    case 'continue':
      return true;
    case 'fire':
      return f.fireDone;
    case 'switch':
      return ['1', '2', '3', '4'].some((k) => f.keys.has(k));
    case 'reload':
      return f.keys.has('r');
    case 'armory':
      return f.shopOpened;
    case 'wave':
      return f.waveStarted;
  }
}

/** Waves may only start once the briefing reaches the waves step. */
export function wavesAllowed(id: StepId): boolean {
  return id === 'waves';
}

/** The battlefield only fires while the fire step is on screen. */
export function fireAllowed(id: StepId): boolean {
  return id === 'fire';
}
