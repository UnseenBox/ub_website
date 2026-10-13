import { DUEL_TEMPLATES, type DuelTemplate } from '../../data/duel/rounds';
import type { Boost, Trick } from '../abilities/Cards';
import { BALL_TUNING } from '../ball/Ball';
import { speedForPower } from '../ball/ShotController';
import type { Game } from '../core/Game';
import { buildDuelLevel, waysIn } from '../duel/DuelLevels';
import { Level } from '../levels/Level';
import { circle, Layer } from '../physics/Collider';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { createBody } from '../physics/RigidBody';

interface SweepHit {
  angle: number;
  power: number;
  bounces: number;
  did: string;
  seconds: number;
}

interface TestApi {
  game: Game;
  /** Advances the game by `seconds` without waiting for animation frames, then draws. */
  step(seconds?: number): void;
  /** Angle in degrees, 0 = right, -90 = straight up the alley. Power 0 to 1. */
  shoot(angleDeg: number, power: number): void;
  /** Jumps to a level by number (1 based), locked or not. */
  level(n: number): void;
  info(): Record<string, string | number | boolean>;
  /**
   * Fires every angle at every power at a private copy of a level and lists the shots that
   * score. `delay` lets the street run for that many seconds first (scooters, the cat).
   */
  sweep(levelNumber?: number, stepDeg?: number, powers?: number[], delay?: number): SweepHit[];
  /**
   * How many test shots score on a duel street (by template id), optionally with a boost on
   * the ball and a trick in the street. The sweep fires four powers at every `stepDeg` degrees.
   */
  duelWays(id: string, boost?: Boost | null, trick?: Trick | null, stepDeg?: number): number;
  /** The same count for a street that is not in the list yet, for trying layouts out. */
  duelWaysOf(template: DuelTemplate, boost?: Boost | null, trick?: Trick | null, stepDeg?: number): number;
  /** Loads a duel street to look at, outside any duel. */
  duelStreet(id: string, trick?: Trick | null): void;
}

declare global {
  interface Window {
    __cg?: TestApi;
  }
}

/**
 * Development only. The game normally runs on requestAnimationFrame, which browsers throttle
 * in background tabs and embedded previews; these hooks let a script drive it deterministically.
 */
export function installTestHooks(game: Game): void {
  window.__cg = {
    game,
    step: (seconds = 1 / 60) => game.loop.advance(seconds),
    shoot: (angleDeg, power) => {
      const a = (angleDeg * Math.PI) / 180;
      game.fire(Math.cos(a), Math.sin(a), power);
    },
    level: (n) => {
      if (game.state === 'menu') game.play();
      game.loadLevel(n - 1);
    },
    info: () => {
      const b = game.ball.body;
      return {
        level: game.level.index + 1,
        state: game.state,
        paused: game.paused,
        x: Math.round(b.x),
        y: Math.round(b.y),
        speed: Math.round(game.ball.speed),
        bounces: game.analyzer.bounces,
        miss: game.missKind,
        last: game.lastScore,
        best: game.record.best,
        stars: game.record.stars,
        attempts: game.record.attempts,
        goals: game.record.goals,
        lines: game.celebration.card?.lines.map((l) => l.label).join(', ') ?? '',
      };
    },
    duelWays: (id, boost = null, trick = null, stepDeg = 1) => {
      const template = DUEL_TEMPLATES.find((t) => t.id === id);
      return template ? waysIn(buildDuelLevel(template, trick, -1), Infinity, boost, stepDeg) : -1;
    },
    duelWaysOf: (template, boost = null, trick = null, stepDeg = 1) => waysIn(buildDuelLevel(template, trick, -1), Infinity, boost, stepDeg),
    duelStreet: (id, trick = null) => {
      const template = DUEL_TEMPLATES.find((t) => t.id === id);
      if (!template) return;
      if (game.state === 'menu') game.play();
      game.loadCustom(buildDuelLevel(template, trick, -1));
    },
    sweep: (levelNumber = game.level.index + 1, stepDeg = 1, powers = [0.4, 0.55, 0.7, 0.85, 1], delay = 0) => {
      const def = game.levels[levelNumber - 1];
      const hits: SweepHit[] = [];
      for (const power of powers) {
        for (let angle = -180; angle < 180; angle += stepDeg) {
          // A fresh level per shot: nothing a previous shot broke or rang carries over.
          const level = new Level(def, levelNumber - 1);
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
          for (let t = 0; t < delay; t += FIXED_DT) level.step(ghost, FIXED_DT, false, null, null);
          const a = (angle * Math.PI) / 180;
          ghost.vx = Math.cos(a) * speedForPower(power);
          ghost.vy = Math.sin(a) * speedForPower(power);
          let bounces = 0;
          const did = new Set<string>();
          for (let i = 0; i < 240 * 9; i++) {
            level.step(
              ghost,
              FIXED_DT,
              true,
              (_b, other, _c, impact) => {
                if (other.surface !== 'net' && impact > 60) bounces++;
              },
              (e) => did.add(e.kind),
            );
            if (level.goal.contains(ghost.x, ghost.y)) {
              hits.push({ angle, power, bounces, did: [...did].join('+'), seconds: +(i * FIXED_DT).toFixed(2) });
              break;
            }
            if (Math.hypot(ghost.vx, ghost.vy) < 4 && i > 30) break;
          }
        }
      }
      return hits;
    },
  };
}
