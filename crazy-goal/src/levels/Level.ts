import type { Boost } from '../abilities/Cards';
import { BALL_TUNING } from '../ball/Ball';
import { Goal } from '../goal/Goal';
import { Bell } from '../mechanics/Bell';
import { Bumper } from '../mechanics/Bumper';
import { Cat } from '../mechanics/Cat';
import { Fan } from '../mechanics/Fan';
import { Glass } from '../mechanics/Glass';
import type { Mechanic, MechEventKind, MechSink, StepInfo } from '../mechanics/Mechanic';
import { Pipe } from '../mechanics/Pipe';
import { Scooter } from '../mechanics/Scooter';
import { Spinner } from '../mechanics/Spinner';
import { Tyre } from '../mechanics/Tyre';
import { Sand, Slope } from '../mechanics/Zones';
import { box, Layer, type Surface } from '../physics/Collider';
import { PhysicsWorld, type ContactListener } from '../physics/PhysicsWorld';
import { createBody, type RigidBody } from '../physics/RigidBody';
import type { LevelDefinition, MechanicDef, WallKind } from './LevelDefinition';

export const RAIL_THICKNESS = 26;

export type BlockKind = 'rail' | 'kerb' | WallKind;

/** How each kind of block bounces and how tall it is drawn. */
const BLOCKS: Readonly<Record<BlockKind, { restitution: number; friction: number; lift: number; surface: Surface }>> = {
  rail: { restitution: 0.8, friction: 0.12, lift: 30, surface: 'rail' },
  // The near edge of the alley is a low kerb, so it never hides the ball.
  kerb: { restitution: 0.8, friction: 0.12, lift: 8, surface: 'kerb' },
  wall: { restitution: 0.82, friction: 0.1, lift: 22, surface: 'wall' },
  hedge: { restitution: 0.62, friction: 0.22, lift: 26, surface: 'hedge' },
  crate: { restitution: 0.52, friction: 0.25, lift: 24, surface: 'crate' },
  car: { restitution: 1.12, friction: 0.08, lift: 22, surface: 'car' },
  shutter: { restitution: 0.7, friction: 0.1, lift: 40, surface: 'gate' },
};

/** How the three shot boosts bend the rules. */
export const BOOST_TUNING = {
  /** Share of its pace a burning ball keeps as it goes through something. */
  fireKeep: 0.9,
  /** How close to the goal mouth the magnet takes hold, and how hard it pulls. */
  magnetRange: 380,
  magnetPull: 2300,
  /** The pull eases in over this distance from the edge of its range. */
  magnetFade: 90,
  /** A rubber ball barely slows, and keeps all of its pace off anything it hits. */
  rubberDrag: 0.2,
  rubberRoll: 60,
} as const;

/** A solid the renderer draws as an extruded block and that flinches when the ball hits it. */
export interface Block {
  readonly body: RigidBody;
  readonly kind: BlockKind;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly angle: number;
  /** How far the top face is lifted off the ground, in world units. */
  readonly lift: number;
  /** 1 at the moment of impact, easing back to 0. */
  hit: number;
  hitNx: number;
  hitNy: number;
  /** Burnt away by a HARISSA shot: not solid and not drawn until the shot is reset. */
  gone: boolean;
}

/** What a burning ball last went through: where it stood, how big it was, what it was made of. */
export interface Burn {
  x: number;
  y: number;
  w: number;
  h: number;
  surface: Surface;
}

const near = (ax: number, ay: number, bx: number, by: number): number => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

/**
 * A level definition turned into live geometry and behaviour. It knows nothing about
 * drawing, sound or the player, so a script can build one and fire a thousand shots at it.
 */
export class Level {
  readonly world = new PhysicsWorld();
  readonly goal: Goal;
  readonly blocks: Block[] = [];
  readonly mechanics: Mechanic[] = [];
  /** The goalkeeper, if this level has one. */
  readonly keeper: Cat | null;
  readonly hasKeeper: boolean;
  /** The boost on the ball in play (a duel card), set by `arm`. */
  boost: Boost | null = null;
  /** True once the fire has gone through something: one obstacle per shot. */
  fireSpent = false;
  /** True from the moment the magnet first takes hold of the ball. */
  magnetOn = false;
  lastBurn: Burn | null = null;
  private readonly blockOf = new Map<number, Block>();
  private readonly mechanicOf = new Map<number, Mechanic>();
  private readonly info: StepInfo = { preVX: 0, preVY: 0 };
  private listener: ContactListener | null = null;
  private sink: MechSink | null = null;
  private pendingBurn: RigidBody | null = null;
  private bounced = false;

  /** `index` is the level's position in the list, starting at 0. */
  constructor(
    readonly def: LevelDefinition,
    readonly index = 0,
  ) {
    this.goal = new Goal(def.goal);
    this.build();
    for (const m of def.mechanics) this.addMechanic(m);
    this.keeper = this.mechanics.find((m): m is Cat => m instanceof Cat) ?? null;
    this.hasKeeper = this.keeper !== null;
  }

  private build(): void {
    const { arena, walls } = this.def;
    const t = RAIL_THICKNESS;
    const right = arena.x + arena.w;
    const bottom = arena.y + arena.h;
    const midY = arena.y + arena.h / 2;
    const g = this.goal;

    // The houses either side run the full height and own the corners.
    this.addBlock('rail', arena.x - t / 2, midY, t, arena.h + t * 2, 0);
    this.addBlock('rail', right + t / 2, midY, t, arena.h + t * 2, 0);
    this.addBlock('kerb', arena.x + arena.w / 2, bottom + t / 2, arena.w, t, 0);
    // The top wall is split around the goal mouth; each half ends at a post.
    this.addBlock('rail', (arena.x + g.leftPostX) / 2, arena.y - t / 2, g.leftPostX - arena.x, t, 0);
    this.addBlock('rail', (g.rightPostX + right) / 2, arena.y - t / 2, right - g.rightPostX, t, 0);

    for (const w of walls) this.addBlock(w.kind ?? 'wall', w.x, w.y, w.w, w.h, w.angle ?? 0);
    g.addTo(this.world);
  }

  private addBlock(kind: BlockKind, x: number, y: number, w: number, h: number, angle: number): void {
    const spec = BLOCKS[kind];
    const body = this.world.addStatic(createBody({ shape: box(w, h), surface: spec.surface, x, y, angle, restitution: spec.restitution, friction: spec.friction }));
    const block: Block = { body, kind, x, y, w, h, angle, lift: spec.lift, hit: 0, hitNx: 0, hitNy: 0, gone: false };
    this.blocks.push(block);
    this.blockOf.set(body.id, block);
  }

  /** The one place that knows every mechanic type. A new one is a class, a case here, and its art. */
  private addMechanic(def: MechanicDef): void {
    let m: Mechanic;
    switch (def.type) {
      case 'tyre':
        m = new Tyre(def, this.world);
        break;
      case 'pipe':
        m = new Pipe(def);
        break;
      case 'sand':
        m = new Sand(def);
        break;
      case 'slope':
        m = new Slope(def, def.angle, def.strength);
        break;
      case 'grass':
        m = new Sand(def, 1.7, 'grass');
        break;
      case 'water':
        m = new Sand(def, 2.6, 'water');
        break;
      case 'ice':
        m = new Sand(def, -0.6, 'ice');
        break;
      case 'boost':
        m = new Slope(def, def.angle, 2600, true);
        break;
      case 'scooter':
        m = new Scooter(def, this.world);
        break;
      case 'glass':
        m = new Glass(def, this.world);
        break;
      case 'bell':
        m = new Bell(def, this.world);
        break;
      case 'cat':
        m = new Cat(def, this.world, this.goal);
        break;
      case 'bumper':
        m = new Bumper(def, this.world);
        break;
      case 'spinner':
        m = new Spinner(def, this.world);
        break;
      case 'fan':
        m = new Fan(def, def.angle, def.strength ?? 1500);
        break;
    }
    this.mechanics.push(m);
    for (const b of m.bodies) this.mechanicOf.set(b.id, m);
  }

  /** Puts every mechanic back to its start-of-shot state, and anything burnt back in the street. */
  resetShot(): void {
    for (const m of this.mechanics) m.reset();
    for (const b of this.blocks) {
      if (!b.gone) continue;
      b.gone = false;
      b.body.layer = Layer.Solid;
    }
    this.boost = null;
    this.fireSpent = false;
    this.magnetOn = false;
    this.lastBurn = null;
  }

  /** Puts a boost on the ball about to be struck. Call as the shot is launched. */
  arm(boost: Boost | null, ball: RigidBody): void {
    this.boost = boost;
    this.fireSpent = false;
    this.magnetOn = false;
    ball.drag = boost === 'rubber' ? BOOST_TUNING.rubberDrag : BALL_TUNING.drag;
    ball.rollResistance = boost === 'rubber' ? BOOST_TUNING.rubberRoll : BALL_TUNING.rollResistance;
  }

  /**
   * The magnet's pull on a ball, added to its acceleration for the coming step. The aim
   * preview calls this too, so the dotted line bends the way the ball will.
   * Returns true while the ball is inside the magnet's reach.
   */
  magnetField(ball: RigidBody): boolean {
    const g = this.goal;
    if (ball.y < g.lineY - 4) return false;
    const dx = g.cx - ball.x;
    const dy = g.lineY - 26 - ball.y;
    const d = Math.hypot(dx, dy);
    if (d > BOOST_TUNING.magnetRange || d < 1) return false;
    const k = (BOOST_TUNING.magnetPull * Math.min(1, (BOOST_TUNING.magnetRange - d) / BOOST_TUNING.magnetFade)) / d;
    ball.ax += dx * k;
    ball.ay += dy * k;
    return true;
  }

  /**
   * One physics step. Mechanics always move; the ball is only simulated while `live`.
   * `listener` hears every contact, `sink` hears what the mechanics did.
   */
  step(ball: RigidBody, dt: number, live: boolean, listener: ContactListener | null, sink: MechSink | null): void {
    for (let i = 0; i < this.mechanics.length; i++) this.mechanics[i].move(dt, ball, live, sink);
    if (!live) return;
    if (this.boost === 'magnet' && this.magnetField(ball) && !this.magnetOn) {
      this.magnetOn = true;
      sink?.({ kind: 'magnet', x: ball.x, y: ball.y, strength: 1 });
    }
    this.info.preVX = ball.vx;
    this.info.preVY = ball.vy;
    this.listener = listener;
    this.sink = sink;
    this.pendingBurn = null;
    this.bounced = false;
    this.world.stepBody(ball, dt, this.onContact);
    // Set by the contact callback during the step, which the compiler cannot see.
    const burnt = this.pendingBurn as RigidBody | null;
    if (burnt) {
      this.burnThrough(burnt);
      // The physics already bounced the ball off it. Put it back on its way, a little slower.
      ball.vx = this.info.preVX * BOOST_TUNING.fireKeep;
      ball.vy = this.info.preVY * BOOST_TUNING.fireKeep;
      sink?.({ kind: 'burn', x: burnt.x, y: burnt.y, strength: 1 });
    } else if (this.bounced && this.boost === 'rubber') {
      // Rubber gives back everything: whatever the surface took, the ball takes back.
      const before = Math.hypot(this.info.preVX, this.info.preVY);
      const now = Math.hypot(ball.vx, ball.vy);
      if (now > 1 && now < before) {
        const k = Math.min(before, ball.maxSpeed) / now;
        ball.vx *= k;
        ball.vy *= k;
      }
    }
    for (let i = 0; i < this.mechanics.length; i++) this.mechanics[i].after(ball, this.info, sink);
  }

  private readonly onContact: ContactListener = (body, other, c, impact) => {
    if (this.pendingBurn === other) return;
    if (this.boost === 'fire' && !this.fireSpent && !this.pendingBurn && impact > 60 && this.burnable(other)) {
      // Not a bounce: nobody hears about this touch. The ball is about to go straight through.
      this.pendingBurn = other;
      return;
    }
    if (other.surface !== 'net' && other.surface !== 'cat' && impact > 40) this.bounced = true;
    this.mechanicOf.get(other.id)?.contact(other, impact, body, this.sink);
    this.listener?.(body, other, c, impact);
  };

  /** Fire goes through whatever stands in the street. The houses, the goal and the living are spared. */
  private burnable(body: RigidBody): boolean {
    const block = this.blockOf.get(body.id);
    if (block) return !block.gone && block.kind !== 'rail' && block.kind !== 'kerb';
    return this.mechanicOf.get(body.id)?.burnable(body) ?? false;
  }

  private burnThrough(body: RigidBody): void {
    const block = this.blockOf.get(body.id);
    if (block) {
      block.gone = true;
      body.layer = 0;
    } else {
      this.mechanicOf.get(body.id)?.burn(body);
    }
    this.fireSpent = true;
    const s = body.shape;
    this.lastBurn = { x: body.x, y: body.y, w: s.kind === 'circle' ? s.r * 2 : s.hw * 2, h: s.kind === 'circle' ? s.r * 2 : s.hh * 2, surface: body.surface };
  }

  /**
   * Replays something a mechanic did in a recorded shot, so a duel replay shows the pane
   * broken, the shutter up and the burnt crate gone. `x, y` is where it happened; the
   * nearest thing of the right kind is the one it happened to.
   */
  replayEvent(kind: MechEventKind, x: number, y: number): void {
    const nearest = <T extends Mechanic>(match: (m: Mechanic) => m is T, where: (m: T) => readonly [number, number]): T | null => {
      let best: T | null = null;
      let bestD = Infinity;
      for (const m of this.mechanics) {
        if (!match(m)) continue;
        const [mx, my] = where(m);
        const d = near(mx, my, x, y);
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      return best;
    };
    switch (kind) {
      case 'burn': {
        let target: RigidBody | null = null;
        let bestD = Infinity;
        for (const body of this.world.statics) {
          if (!this.burnable(body)) continue;
          const d = near(body.x, body.y, x, y);
          if (d < bestD) {
            bestD = d;
            target = body;
          }
        }
        if (target) this.burnThrough(target);
        break;
      }
      case 'smash': {
        const glass = nearest((m): m is Glass => m instanceof Glass, (m) => [m.body.x, m.body.y]);
        if (glass) glass.burn();
        break;
      }
      case 'bell': {
        const bell = nearest((m): m is Bell => m instanceof Bell, (m) => [m.def.x, m.def.y]);
        if (bell) {
          bell.burn();
          bell.swing = 1;
        }
        break;
      }
      case 'boing': {
        const tyre = nearest((m): m is Tyre => m instanceof Tyre, (m) => [m.x, m.y]);
        if (tyre) tyre.hit = 1;
        break;
      }
      case 'bumper': {
        const bumper = nearest((m): m is Bumper => m instanceof Bumper, (m) => [m.x, m.y]);
        if (bumper) bumper.hit = 1;
        break;
      }
      case 'spin': {
        const spinner = nearest((m): m is Spinner => m instanceof Spinner, (m) => [m.x, m.y]);
        if (spinner) spinner.hit = 1;
        break;
      }
      case 'pipe': {
        const pipe = nearest((m): m is Pipe => m instanceof Pipe, (m) => [m.x, m.y]);
        if (pipe) pipe.flash = 1;
        break;
      }
      case 'scooter': {
        const scooter = nearest((m): m is Scooter => m instanceof Scooter, (m) => [m.body.x, m.body.y]);
        if (scooter) scooter.hit = 1;
        break;
      }
      case 'save':
        if (this.keeper) this.keeper.pounce = 1;
        break;
      case 'wind':
        break;
      case 'magnet':
        this.magnetOn = true;
        break;
      case 'sand':
      case 'clink':
        break;
    }
  }

  /** Where everything that moves on its own is right now (three numbers per scooter, two per spinner). */
  moverState(): number[] {
    const out: number[] = [];
    for (const m of this.mechanics) {
      if (m instanceof Scooter) out.push(...m.state());
      else if (m instanceof Spinner) out.push(9999, ...m.state());
    }
    return out;
  }

  /** Puts the movers back where `moverState` found them. */
  setMoverState(state: readonly number[]): void {
    let at = 0;
    for (const m of this.mechanics) {
      if (m instanceof Scooter) {
        if (at + 2 >= state.length) continue;
        m.restore(state[at], state[at + 1], state[at + 2]);
        at += 3;
      } else if (m instanceof Spinner) {
        if (at + 2 >= state.length) continue;
        // Spinner entries are tagged with 9999 so old replays (scooters only) still line up.
        if (state[at] === 9999 && at + 2 < state.length) {
          m.restore(state[at + 1], state[at + 2]);
          at += 3;
        }
      }
    }
  }

  /** `nx, ny` is the contact normal (pointing at the ball); the block recoils the other way. */
  hitBlock(bodyId: number, nx: number, ny: number, strength: number): void {
    const block = this.blockOf.get(bodyId);
    if (!block) return;
    block.hit = Math.max(block.hit, 0.35 + 0.65 * strength);
    block.hitNx = nx;
    block.hitNy = ny;
  }

  /** Animation timers, once per frame. */
  update(dt: number): void {
    for (const b of this.blocks) {
      if (b.hit > 0) b.hit = Math.max(0, b.hit - dt * 4.5);
    }
    for (const m of this.mechanics) m.tick(dt);
  }
}
