import { DUEL_TEMPLATES, type DuelTemplate } from '../../data/duel/rounds';
import type { Boost, Trick } from '../abilities/Cards';
import { BALL_TUNING } from '../ball/Ball';
import { speedForPower } from '../ball/ShotController';
import type { Game } from '../core/Game';
import { buildDuelLevel, waysIn } from '../duel/DuelLevels';
import { Level } from '../levels/Level';
import type { MechEventKind } from '../mechanics/Mechanic';
import { circle, Layer, type Surface } from '../physics/Collider';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { createBody } from '../physics/RigidBody';
import { portal } from '../portal/Portal';
import { scoreShot } from '../scoring/ScoreSystem';

interface SweepHit {
  angle: number;
  power: number;
  bounces: number;
  did: string;
  seconds: number;
  /** The Crazy Score the same shot would earn, and the stars it would win. */
  total: number;
  stars: number;
  lines: string;
}

interface TestApi {
  game: Game;
  /** The portal singleton, so tests can watch its lifecycle flags without an SDK. */
  portal: typeof portal;
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
  /** The playable outline and boundary blocks of a level, for geometry checks. */
  shape(levelNumber?: number): {
    level: number;
    points: { x: number; y: number }[];
    blocks: number;
    boundary: boolean;
    ballStart: { x: number; y: number };
    goalX: number;
    width: number;
  };
  /** Simulates one shot on a private copy of a level and returns its path. */
  sim(
    levelNumber: number,
    angleDeg: number,
    power: number,
    seconds?: number,
    delay?: number,
  ): {
    x: number;
    y: number;
    vx: number;
    vy: number;
    goal: boolean;
    bounces: number;
    events: string;
    path: { t: number; x: number; y: number; vx: number; vy: number }[];
  };
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
    portal,
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
    shape: (levelNumber = game.level.index + 1) => {
      const def = game.levels[levelNumber - 1];
      const level = new Level(def, levelNumber - 1);
      return {
        level: levelNumber,
        points: level.playable.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })),
        blocks: level.blocks.length,
        boundary: level.hasCustomBoundary,
        ballStart: def.ballStart,
        goalX: level.goal.cx,
        width: level.goal.width,
      };
    },
    sim: (levelNumber, angleDeg, power, seconds = 6, delay = 0) => {
      const def = game.levels[levelNumber - 1];
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
        spinDrag: BALL_TUNING.spinDrag,
        maxSpeed: BALL_TUNING.maxSpeed,
      });
      for (let t = 0; t < delay; t += FIXED_DT) level.step(ghost, FIXED_DT, false, null, null);
      const a = (angleDeg * Math.PI) / 180;
      ghost.vx = Math.cos(a) * speedForPower(power);
      ghost.vy = Math.sin(a) * speedForPower(power);
      let bounces = 0;
      const events = new Set<string>();
      const path: { t: number; x: number; y: number; vx: number; vy: number }[] = [];
      let goal = false;
      const steps = Math.round(seconds / FIXED_DT);
      for (let i = 0; i < steps; i++) {
        level.step(
          ghost,
          FIXED_DT,
          true,
          (_b, other, _c, impact) => {
            if (other.surface === 'net' || other.surface === 'ball' || impact < 60) return;
            bounces++;
          },
          (e) => events.add(e.kind),
        );
        if (i % 6 === 0) path.push({ t: +(i * FIXED_DT).toFixed(2), x: Math.round(ghost.x), y: Math.round(ghost.y), vx: Math.round(ghost.vx), vy: Math.round(ghost.vy) });
        if (level.goal.contains(ghost.x, ghost.y)) {
          goal = true;
          path.push({ t: +(i * FIXED_DT).toFixed(2), x: Math.round(ghost.x), y: Math.round(ghost.y), vx: Math.round(ghost.vx), vy: Math.round(ghost.vy) });
          break;
        }
      }
      return {
        x: Math.round(ghost.x),
        y: Math.round(ghost.y),
        vx: Math.round(ghost.vx),
        vy: Math.round(ghost.vy),
        goal,
        bounces,
        events: [...events].join('+'),
        path,
      };
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
            spinDrag: BALL_TUNING.spinDrag,
            maxSpeed: BALL_TUNING.maxSpeed,
          });
          for (let t = 0; t < delay; t += FIXED_DT) level.step(ghost, FIXED_DT, false, null, null);
          const a = (angle * Math.PI) / 180;
          ghost.vx = Math.cos(a) * speedForPower(power);
          ghost.vy = Math.sin(a) * speedForPower(power);
          const goal = level.goal;
          const gx = goal.cx - ghost.x;
          const gy = goal.lineY - ghost.y;
          const boomerang = (Math.cos(a) * gx + Math.sin(a) * gy) / (Math.hypot(gx, gy) || 1) < -0.2;
          let bounces = 0;
          let distance = 0;
          let time = 0;
          let minGoalDist = goal.distanceToMouth(ghost.x, ghost.y);
          let lastBody = -1;
          let lastTime = -1;
          const touched: Partial<Record<Surface, number>> = {};
          const did = new Set<MechEventKind>();
          for (let i = 0; i < 240 * 9; i++) {
            level.step(
              ghost,
              FIXED_DT,
              true,
              (_b, other, _c, impact) => {
                if (other.surface === 'net' || other.surface === 'ball' || impact < 60) return;
                // The real analyzer folds repeat contacts with one body into a single bounce.
                if (other.id === lastBody && time - lastTime < 0.08) return;
                lastBody = other.id;
                lastTime = time;
                touched[other.surface] = (touched[other.surface] ?? 0) + 1;
                bounces++;
              },
              (e) => did.add(e.kind),
            );
            distance += Math.hypot(ghost.vx, ghost.vy) * FIXED_DT;
            time += FIXED_DT;
            const d = goal.distanceToMouth(ghost.x, ghost.y);
            if (d < minGoalDist) minGoalDist = d;
            if (goal.contains(ghost.x, ghost.y)) {
              const card = scoreShot(
                {
                  goal: true,
                  bounces,
                  touched,
                  did,
                  keeper: level.hasKeeper,
                  distance,
                  time,
                  power,
                  entrySpeed: Math.hypot(ghost.vx, ghost.vy),
                  entryOffset: (ghost.x - goal.cx) / (goal.width / 2),
                  boomerang,
                  minGoalDist,
                },
                0,
                def.stars,
              );
              hits.push({ angle, power, bounces, did: [...did].join('+'), seconds: +time.toFixed(2), total: card.total, stars: card.stars, lines: card.lines.map((l) => l.label).join(', ') });
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
