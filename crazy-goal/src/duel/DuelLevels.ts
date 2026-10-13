import { DUEL_TEMPLATES, type DuelTemplate } from '../../data/duel/rounds';
import type { Boost, Trick } from '../abilities/Cards';
import { BALL_TUNING } from '../ball/Ball';
import { speedForPower } from '../ball/ShotController';
import { seededRandom } from '../core/math';
import { Level } from '../levels/Level';
import type { ArenaDef, GoalDef, LevelDefinition, MechanicDef, WallDef } from '../levels/LevelDefinition';
import { circle, Layer } from '../physics/Collider';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { createBody } from '../physics/RigidBody';
import type { DuelMode } from './DuelApi';

export const DUEL_ROUNDS = 10;
export const QUICK_ROUNDS = 5;

/** The three ways to duel: long with cards, short with cards, long with nothing but the ball. */
export const DUEL_MODES: readonly DuelMode[] = ['classic', 'quick', 'pure'];

export const modeOf = (mode: DuelMode | undefined): DuelMode => (mode === 'quick' || mode === 'pure' ? mode : 'classic');

/** Rounds in a duel of this mode. */
export const roundsIn = (mode: DuelMode): number => (mode === 'quick' ? QUICK_ROUNDS : DUEL_ROUNDS);

/** Whether cards are dealt in this mode. */
export const cardsIn = (mode: DuelMode): boolean => mode !== 'pure';

/** Quick Clash wants streets that resolve fast: open, bouncy, no bell to ring first. */
const QUICK_POOL: ReadonlySet<string> = new Set(['open', 'tyres', 'delivery', 'pinball', 'rush', 'neon', 'turbo', 'glazier', 'funnel']);

/** Every duel is played on the same strip of street as the solo alleys. */
export const DUEL_ARENA: ArenaDef = { x: 450, y: 170, w: 700, h: 940 };
export const DUEL_GOAL: GoalDef = { x: 800, lineY: 170, width: 220, depth: 64 };
const BALL_Y = 1010;

/** How fast Mimi is when a friend sends her, and how much faster she gets where she already lives. */
const SENT_CAT_SPEED = 150;
const SENT_CAT_EXTRA = 70;

/** The rounds of a duel, the same for both players. */
export function roundsFor(seed: number, mode: DuelMode = 'classic'): DuelTemplate[] {
  const rng = seededRandom(seed);
  const pool = mode === 'quick' ? DUEL_TEMPLATES.filter((t) => QUICK_POOL.has(t.id)) : [...DUEL_TEMPLATES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, roundsIn(mode));
}

/** Which half of the goal a SHUTTER trick closes in a given round: -1 the left, 1 the right. */
export const shutterSide = (seed: number, round: number): -1 | 1 => ((seed + round) % 2 === 0 ? -1 : 1);

/**
 * A round's street, ready to play. `trick` is what the other player sent for this shot:
 * the cat and the shutter change what stands in the street; smoke changes only what you see.
 */
export function buildDuelLevel(template: DuelTemplate, trick: Trick | null, side: -1 | 1): LevelDefinition {
  const goal: GoalDef = { ...DUEL_GOAL, x: template.goalX ?? DUEL_GOAL.x };
  const walls: WallDef[] = [...template.walls];
  let mechanics: MechanicDef[] = [...template.mechanics];
  if (trick === 'cat') {
    const lives = mechanics.some((m) => m.type === 'cat');
    mechanics = lives ? mechanics.map((m) => (m.type === 'cat' ? { ...m, speed: m.speed + SENT_CAT_EXTRA } : m)) : [...mechanics, { type: 'cat', speed: SENT_CAT_SPEED }];
  } else if (trick === 'shutter') {
    // Pulled down just in front of the line, from one post to the middle of the mouth.
    walls.push({ x: goal.x + side * (goal.width / 4 + 3), y: goal.lineY + 15, w: goal.width / 2 + 6, h: 22, kind: 'shutter' });
  }
  return {
    id: `duel-${template.id}`,
    name: template.name,
    hint: template.hint,
    arena: DUEL_ARENA,
    ballStart: { x: template.ballX ?? 800, y: BALL_Y },
    goal,
    walls,
    mechanics,
    theme: template.theme,
    stars: [Infinity, Infinity],
  };
}

/**
 * Fires a fan of test shots at a street and counts how many score, stopping once `enough`
 * have been found. Used to check that every round can be scored on, with and without a card.
 */
export function waysIn(def: LevelDefinition, enough: number, boost: Boost | null = null, stepDeg = 1): number {
  let found = 0;
  for (const power of [1, 0.9, 0.75, 0.6]) {
    const speed = speedForPower(power);
    // Only shots with some forward in them; nobody scores by shooting at the kerb.
    for (let angle = -176; angle <= -4; angle += stepDeg) {
      const level = new Level(def);
      const ghost = createBody({
        shape: circle(BALL_TUNING.radius),
        surface: 'ball',
        x: def.ballStart.x,
        y: def.ballStart.y,
        isStatic: false,
        layer: Layer.Ball,
        mask: Layer.Solid | Layer.Net,
        restitution: 1,
        drag: BALL_TUNING.drag,
        rollResistance: BALL_TUNING.rollResistance,
        maxSpeed: BALL_TUNING.maxSpeed,
      });
      level.arm(boost, ghost);
      const a = (angle * Math.PI) / 180;
      ghost.vx = Math.cos(a) * speed;
      ghost.vy = Math.sin(a) * speed;
      for (let i = 0; i < 240 * 9; i++) {
        level.step(ghost, FIXED_DT, true, null, null);
        if (level.goal.contains(ghost.x, ghost.y)) {
          if (++found >= enough) return found;
          break;
        }
        if (i > 30 && Math.hypot(ghost.vx, ghost.vy) < 4) break;
      }
    }
  }
  return found;
}
