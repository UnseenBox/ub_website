import Phaser from 'phaser';
import { EnemyDef, HitZone, RigStyle } from '../data/enemies';
import { FIELD } from '../game/config';
import { project, Projected, windowHalfWidth } from '../game/perspective';
import { LEN, PART, ZOMBIE_ATLAS } from '../rendering/ZombieArt';
import { SHAMBLER_HEIGHT } from '../rendering/zombieSheetFrames';
import { FIGURES, Figure } from '../rendering/figures';

export type ZombieState = 'emerge' | 'walk' | 'hold' | 'attack' | 'dying' | 'dead';
type DeathStyle = 'side' | 'back' | 'crumple';

/** Shamblers are drawn from the cut figure art, SHAMBLER_HEIGHT units from feet to top of head. */
const RIG_HEIGHT: Record<RigStyle, number> = { shamble: SHAMBLER_HEIGHT, run: 424, heavy: 424, bloat: 446, crawl: 168 };
/** A lifted shin shortens by this share, as the knee bends toward the camera. */
const KNEE_LIFT = 0.2;
/** A lifted foot swings this far (rad) toward the centre line. */
const FOOT_IN = 0.12;
/** Before a strike the arms open this far (rad); at impact they reach this far in across the chest. */
const ARM_OUT = 0.35;
const ARM_IN = -0.12;

/** Smoothstep: eases a 0–1 value in and out, so limbs accelerate and land softly. */
function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** Arm flare through an attack cycle (0–1): open, reach in before the strike at 0.66, then recover. */
function strikeFlare(a: number): number {
  if (a < 0.4) return ARM_OUT * smooth(a / 0.4);
  if (a < 0.66) return ARM_OUT + (ARM_IN - ARM_OUT) * smooth((a - 0.4) / 0.26);
  return ARM_IN * (1 - smooth((a - 0.66) / 0.34));
}

const STRIDE: Record<RigStyle, number> = { shamble: 0.95, run: 1.7, heavy: 0.9, bloat: 0.8, crawl: 0.55 };

interface Seg { ax: number; ay: number; bx: number; by: number; r: number; zone: HitZone }

export function depthForZ(z: number): number {
  return 2000 - z * 10;
}

const tmpP: Projected = { sx: 0, sy: 0, ppm: 0 };
const TAU = Math.PI * 2;
/** A shot to the legs slows a zombie to this share of its speed for this many seconds. */
export const LEG_SLOW = { factor: 0.55, seconds: 2.5 } as const;
/** Half the width of a zombie's body (m), kept clear of the window frame. */
const BODY_HALF_M = 0.25;

/** A field target zombies can go for instead of the bunker (see systems/FieldTargets). */
export interface FieldGoal {
  x: number;
  z: number;
  /** Half its width in metres: a zombie this close sideways can reach it. */
  halfWidth: number;
}

/**
 * One enemy: logic state plus an articulated, camera-facing rig built from
 * atlas parts. Pooled by EnemyManager — reset() reinitialises everything.
 */
export class Zombie {
  readonly root: Phaser.GameObjects.Container;
  private shadow: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private ua: Phaser.GameObjects.Image[];
  private fa: Phaser.GameObjects.Image[];
  private hand: Phaser.GameObjects.Image[];
  private thigh: Phaser.GameObjects.Image[];
  private shin: Phaser.GameObjects.Image[];

  def!: EnemyDef;
  look = '';
  state: ZombieState = 'dead';
  active = false;
  hp = 0;
  maxHp = 0;
  x = 0;
  z = 0;
  spawnX = 0;
  targetX = 0;
  stopZ = 0;
  speed = 0;
  /** A field target (mast, depot, bus) this one goes for instead of the bunker. Moves with it. */
  goal: FieldGoal | null = null;
  /** Boss rage: multiplies walking speed. */
  rage = 1;
  /** A Howler's scream: speed multiplier and seconds left. */
  hasteLeft = 0;
  hasteMul = 1;
  /** Where a Spitter/Howler stops to act (null = it walks straight in), and actions left there. */
  holdZ: number | null = null;
  holdsLeft = 0;
  holdCooldown = 0;
  /** Winding up a spit or a howl. */
  channelLeft = 0;
  channelKind: 'spit' | 'howl' | null = null;
  /** Set for one frame when something happens: read and cleared by EnemyManager. */
  action: 'charge' | 'spit' | 'howl' | null = null;
  /** A Howler's first howl calls extra bodies; only once. */
  summoned = false;
  /** Screen-space info refreshed every frame. */
  sx = 0;
  sy = 0;
  scale = 0;
  ppm = 0;

  private phase = 0;
  private time = 0;
  private emergeLeft = 0;
  private wanderSeed = 0;
  private lean = 0;
  private headTilt = 0;
  private reachSide = 1;
  private limp = 1;
  flinch = 0;
  private flinchDir = 1;
  staggerLeft = 0;
  burnLeft = 0;
  slowLeft = 0;
  /** Seconds left of the leg-wound slow. */
  legsHurtLeft = 0;
  private attackT = 0;
  private struck = false;
  private deathT = 0;
  private deathStyle: DeathStyle = 'side';
  private deathDir = 1;
  lieLeft = 0;
  headless = false;
  killedByHeadshot = false;
  /** Set once the kill has been paid and counted. */
  resolved = false;
  groanLeft = 0;
  private hitFlash = 0;
  private flashColor = 0xffffff;
  private baseTint = 0xffffff;
  private segs: Seg[] = [];
  private headC = { x: 0, y: 0, r: 0 };
  /** Set for enemies drawn from a cut figure (shambler, brute); null for the procedural looks. */
  private figure: Figure | null = null;
  /** Feet to top of head in figure units: the scale the rig is drawn at. */
  private rigHeight = 0;

  constructor(scene: Phaser.Scene) {
    const img = (ox: number, oy: number) => scene.add.image(0, 0, ZOMBIE_ATLAS, 'shadow').setOrigin(ox, oy);
    this.shadow = scene.add.image(0, 0, ZOMBIE_ATLAS, 'shadow').setOrigin(0.5, 0.5);
    this.thigh = [img(PART.thigh.ox, PART.thigh.oy), img(PART.thigh.ox, PART.thigh.oy)];
    this.shin = [img(PART.shin.ox, PART.shin.oy), img(PART.shin.ox, PART.shin.oy)];
    this.torso = img(PART.torso.ox, PART.torso.oy);
    this.head = img(PART.head.ox, PART.head.oy);
    this.ua = [img(PART.upperArm.ox, PART.upperArm.oy), img(PART.upperArm.ox, PART.upperArm.oy)];
    this.fa = [img(PART.foreArm.ox, PART.foreArm.oy), img(PART.foreArm.ox, PART.foreArm.oy)];
    this.hand = [img(PART.hand.ox, PART.hand.oy), img(PART.hand.ox, PART.hand.oy)];
    this.thigh[0].setFlipX(true);
    this.shin[0].setFlipX(true);
    this.ua[0].setFlipX(true);
    this.fa[0].setFlipX(true);
    this.hand[0].setFlipX(true);
    this.root = scene.add.container(0, 0, [
      this.shadow, this.shin[0], this.shin[1], this.thigh[0], this.thigh[1], this.torso, this.head,
      this.ua[0], this.fa[0], this.hand[0], this.ua[1], this.fa[1], this.hand[1],
    ]);
    this.root.setVisible(false);
    for (let i = 0; i < 7; i++) this.segs.push({ ax: 0, ay: 0, bx: 0, by: 0, r: 0, zone: 'torso' });
  }

  reset(def: EnemyDef, healthMul: number, speedMul: number, x: number, z: number, rng: () => number): void {
    this.def = def;
    this.figure = FIGURES[def.look] ?? null;
    this.rigHeight = this.figure ? this.figure.height : RIG_HEIGHT[def.rig];
    // Pooled zombies are built before the atlas exists, so the shadow needs its texture set here.
    this.shadow.setTexture(ZOMBIE_ATLAS, 'shadow');
    if (this.figure) this.dressSheet(this.figure);
    else this.dressProcedural(def, rng);
    this.head.setVisible(true);
    this.maxHp = this.hp = def.health * healthMul;
    this.speed = def.speed * speedMul * (1 + (rng() * 2 - 1) * (def.speedJitter / def.speed));
    this.x = this.spawnX = x;
    this.z = z;
    this.goal = null;
    this.rage = 1;
    this.hasteLeft = 0;
    this.hasteMul = 1;
    this.action = null;
    this.channelLeft = 0;
    this.channelKind = null;
    this.summoned = false;
    // Spitters and Howlers stop at a distance to do their thing; a boss howls on the move.
    const ranged = def.special?.ranged;
    const howl = def.special?.howl;
    const hold = ranged?.stopRange ?? (!def.boss ? howl?.stopRange : undefined);
    this.holdZ = hold ? hold[0] + rng() * (hold[1] - hold[0]) : null;
    this.holdsLeft = ranged ? ranged.shots : howl ? howl.maxHowls : 0;
    this.holdCooldown = ranged ? ranged.windup + rng() : howl ? howl.firstDelay + rng() : 0;
    if (def.boss) {
      this.targetX = 0;
      this.stopZ = def.boss.stopZ;
    } else {
      this.targetX = (rng() * 2 - 1) * FIELD.attackHalfWidth;
      this.stopZ = FIELD.attackZ + rng() * 1.3;
    }
    this.state = 'emerge';
    this.emergeLeft = 0.5 + rng() * 1.2;
    this.phase = rng() * TAU;
    this.time = rng() * 10;
    this.wanderSeed = rng() * 100;
    this.lean = (rng() * 2 - 1) * 0.06;
    this.headTilt = (rng() * 2 - 1) * 0.28;
    this.reachSide = rng() < 0.5 ? -1 : 1;
    this.limp = 0.45 + rng() * 0.55;
    this.flinch = 0;
    this.staggerLeft = 0;
    this.burnLeft = 0;
    this.slowLeft = 0;
    this.legsHurtLeft = 0;
    this.attackT = rng() * 0.5;
    this.struck = false;
    this.deathT = 0;
    this.lieLeft = 0;
    this.headless = false;
    this.killedByHeadshot = false;
    this.resolved = false;
    this.hitFlash = 0;
    this.groanLeft = def.groanInterval[0] * rng() + 1;
    this.active = true;
    this.root.setVisible(true);
    this.root.setAlpha(0);
    this.root.setRotation(0);
    this.root.setScale(1);
    this.shadow.setAlpha(1);
    this.updateScreen();
  }

  /** Procedural looks: every part is painted into the shared zombie atlas. */
  private dressProcedural(def: EnemyDef, rng: () => number): void {
    this.look = `${def.look}_${Math.floor(rng() * def.looks)}`;
    const L = this.look;
    const T = ZOMBIE_ATLAS;
    this.torso.setTexture(T, `${L}_torso`).setOrigin(PART.torso.ox, PART.torso.oy).setFlipX(false).setAlpha(1).setScale(1);
    this.head.setTexture(T, `${L}_head`).setOrigin(PART.head.ox, PART.head.oy).setFlipX(false).setAlpha(1).setScale(1);
    for (let i = 0; i < 2; i++) {
      const flip = i === 0;
      this.ua[i].setTexture(T, `${L}_upperArm`).setOrigin(PART.upperArm.ox, PART.upperArm.oy).setFlipX(flip).setAlpha(1).setScale(1).setVisible(true);
      this.fa[i].setTexture(T, `${L}_foreArm`).setOrigin(PART.foreArm.ox, PART.foreArm.oy).setFlipX(flip).setAlpha(1).setScale(1).setVisible(true);
      this.hand[i].setTexture(T, `${L}_hand`).setOrigin(PART.hand.ox, PART.hand.oy).setFlipX(flip).setAlpha(1).setScale(1).setVisible(true);
      this.thigh[i].setTexture(T, `${L}_thigh`).setOrigin(PART.thigh.ox, PART.thigh.oy).setFlipX(flip).setAlpha(1).setScale(1);
      this.shin[i].setTexture(T, `${L}_shin`).setOrigin(PART.shin.ox, PART.shin.oy).setFlipX(flip).setAlpha(1).setScale(1);
    }
    const crawl = def.rig === 'crawl';
    for (const p of [...this.thigh, ...this.shin]) p.setVisible(!crawl);
    this.layout([
      this.shadow, this.shin[0], this.shin[1], this.thigh[0], this.thigh[1], this.torso, this.head,
      this.ua[0], this.fa[0], this.hand[0], this.ua[1], this.fa[1], this.hand[1],
    ]);
  }

  /**
   * Cut-out figures (shambler, brute): every joint is its own part. Each part rotates about
   * its pivot in poseSheet, so the figure is articulated rather than frame-swapped.
   */
  private dressSheet(fig: Figure): void {
    const P = fig.parts;
    const parts: [Phaser.GameObjects.Image, keyof Figure['parts']][] = [
      [this.torso, 'torso'], [this.head, 'head'],
      [this.ua[0], 'armL'], [this.ua[1], 'armR'],
      [this.thigh[0], 'thighL'], [this.thigh[1], 'thighR'],
      [this.shin[0], 'shinL'], [this.shin[1], 'shinR'],
    ];
    for (const [img, key] of parts) {
      const p = P[key];
      img.setTexture(fig.texture, p.name).setOrigin(p.ox, p.oy).setFlipX(false).setAlpha(1).setScale(1).setVisible(true);
    }
    for (let i = 0; i < 2; i++) {
      this.fa[i].setVisible(false);
      this.hand[i].setVisible(false);
    }
    // Arms and legs sit behind the torso, so the cut edges at the shoulders and hips are hidden.
    this.layout([
      this.shadow, this.thigh[0], this.thigh[1], this.shin[0], this.shin[1],
      this.ua[0], this.ua[1], this.torso, this.head,
    ]);
  }

  private layout(children: Phaser.GameObjects.GameObject[]): void {
    this.root.removeAll(false);
    this.root.add(children);
  }

  /** Height of the body on screen, in pixels, from the feet to the top of the head. */
  get screenHeight(): number {
    return this.scale * this.rigHeight;
  }

  /** Full width of the body on screen, in pixels (widest span of the cut figure). */
  get screenWidth(): number {
    return 2 * (this.figure ? this.figure.halfWidth : 95) * this.scale;
  }

  get alive(): boolean {
    return this.active && (this.state === 'emerge' || this.state === 'walk' || this.state === 'hold' || this.state === 'attack');
  }

  get slowFactor(): number {
    const cryo = this.slowLeft > 0 ? 0.45 : 1;
    const legs = this.legsHurtLeft > 0 ? LEG_SLOW.factor : 1;
    return Math.min(cryo, legs);
  }

  /** A shot to the legs: the zombie drags itself along more slowly for a few seconds. */
  hurtLegs(): void {
    this.legsHurtLeft = LEG_SLOW.seconds;
  }

  /** Returns true when an attack strike lands this frame. */
  update(dt: number): boolean {
    this.time += dt;
    let strike = false;
    this.flinch = Math.max(0, this.flinch - dt * 5);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.burnLeft > 0) this.burnLeft = Math.max(0, this.burnLeft - dt);
    if (this.slowLeft > 0) this.slowLeft = Math.max(0, this.slowLeft - dt);
    if (this.legsHurtLeft > 0) this.legsHurtLeft = Math.max(0, this.legsHurtLeft - dt);
    const slow = this.slowFactor;
    if (this.hasteLeft > 0) {
      this.hasteLeft -= dt;
      if (this.hasteLeft <= 0) this.hasteMul = 1;
    }
    // A spit or howl winding up: it stands still, then the action fires.
    if (this.channelLeft > 0 && this.alive) {
      this.channelLeft -= dt;
      this.phase += dt * 4;
      if (this.channelLeft <= 0) this.finishChannel();
    }

    switch (this.state) {
      case 'emerge':
        this.emergeLeft -= dt;
        this.phase += dt * 1.5;
        if (this.emergeLeft <= 0) this.state = 'walk';
        break;
      case 'hold':
        if (this.channelLeft > 0) break;
        this.holdCooldown -= dt * slow;
        if (this.holdCooldown <= 0) this.startChannel();
        break;
      case 'walk': {
        const v = this.speed * slow * this.rage * this.hasteMul;
        if (this.channelLeft > 0) break;
        // A boss howls on the move; Spitters and Howlers stop at their distance first.
        if (this.def.boss && this.def.special?.howl && this.holdsLeft > 0) {
          this.holdCooldown -= dt;
          if (this.holdCooldown <= 0) {
            this.startChannel();
            break;
          }
        }
        if (this.holdZ !== null && this.holdsLeft > 0 && this.z <= this.holdZ && this.staggerLeft <= 0) {
          this.state = 'hold';
          break;
        }
        if (this.staggerLeft > 0) {
          this.staggerLeft -= dt;
          this.z = Math.min(FIELD.spawnZ, this.z + dt * 0.9);
          this.phase += dt * 3;
        } else if (this.z > this.stopZ) {
          this.z -= v * dt;
          this.phase += (v / STRIDE[this.def.rig]) * Math.PI * dt;
        } else if (this.goal) {
          // At the target's distance but beside it (a bus drove on): chase it sideways.
          const dx = this.goal.x - this.x;
          this.x += Math.sign(dx) * Math.min(Math.abs(dx), v * dt);
          this.phase += (v / STRIDE[this.def.rig]) * Math.PI * dt;
        }
        if (this.z <= this.stopZ && (!this.goal || Math.abs(this.goal.x - this.x) < this.goal.halfWidth)) {
          this.z = this.stopZ;
          this.state = 'attack';
          this.attackT = 0;
          this.struck = false;
        } else if (this.z < this.stopZ) {
          this.z = this.stopZ;
        }
        break;
      }
      case 'attack': {
        if (this.staggerLeft > 0) {
          this.staggerLeft -= dt;
          break;
        }
        // The target moved away (a bus): go after it again.
        if (this.goal && Math.abs(this.goal.x - this.x) > this.goal.halfWidth + 0.8) {
          this.state = 'walk';
          break;
        }
        this.attackT += (dt * slow) / this.def.attackInterval;
        if (!this.struck && this.attackT >= 0.68) {
          this.struck = true;
          strike = true;
        }
        if (this.attackT >= 1) {
          this.attackT -= 1;
          this.struck = false;
        }
        this.phase += dt * 2;
        break;
      }
      case 'dying':
        this.deathT += dt / (this.deathStyle === 'crumple' ? 0.95 : 0.62);
        if (this.deathT >= 1) {
          this.deathT = 1;
          this.state = 'dead';
          this.lieLeft = 2.6;
        }
        break;
      case 'dead':
        this.lieLeft -= dt;
        if (this.lieLeft <= 0) this.active = false;
        break;
    }

    // Lateral path: converge from spawn lane to a slot on the bunker line, with a drifting wander.
    if (this.state !== 'dying' && this.state !== 'dead') {
      // Stay inside the bunker window: it narrows toward the wall, and the body keeps clear of the frame.
      const lim = windowHalfWidth(this.z) - BODY_HALF_M;
      if (this.goal) {
        // Converge on the field target. Once level with it, the chase above moves x directly
        // (a bus may be out at the edge of the window, so the clamp is looser).
        if (this.z > this.stopZ + 0.01) {
          const t = Phaser.Math.Clamp((this.z - this.stopZ) / (FIELD.spawnZ - this.stopZ), 0, 1);
          const desired = this.goal.x + (this.spawnX - this.goal.x) * t;
          this.x += (desired - this.x) * Math.min(1, dt * 2);
        }
        this.x = Phaser.Math.Clamp(this.x, -lim - 3, lim + 3);
      } else {
        const t = Phaser.Math.Clamp((this.z - FIELD.attackZ) / (FIELD.spawnZ - FIELD.attackZ), 0, 1);
        const wander = Math.sin(this.time * 0.35 + this.wanderSeed) * 1.6 * t;
        const desired = Phaser.Math.Clamp(this.targetX + (this.spawnX - this.targetX) * t + wander, -lim, lim);
        this.x = Phaser.Math.Clamp(this.x + (desired - this.x) * Math.min(1, dt * 2), -lim, lim);
      }
    }

    this.updateScreen();
    this.pose();
    if (!this.active) this.root.setVisible(false);
    return strike;
  }

  private startChannel(): void {
    const ranged = this.def.special?.ranged;
    this.channelKind = ranged ? 'spit' : 'howl';
    this.channelLeft = ranged ? ranged.windup : 1.35;
    this.action = 'charge';
  }

  private finishChannel(): void {
    this.action = this.channelKind;
    this.channelKind = null;
    this.channelLeft = 0;
    this.holdsLeft -= 1;
    const ranged = this.def.special?.ranged;
    const howl = this.def.special?.howl;
    this.holdCooldown = ranged ? ranged.interval : howl ? howl.interval : 0;
    // Out of spits or howls: walk in and claw like the rest.
    if (this.holdsLeft <= 0 && this.state === 'hold') {
      this.holdZ = null;
      this.state = 'walk';
    }
  }

  /** A Howler's scream reached this one: it moves faster for a while. */
  haste(mul: number, seconds: number): void {
    this.hasteMul = Math.max(this.hasteMul, mul);
    this.hasteLeft = Math.max(this.hasteLeft, seconds);
  }

  /**
   * Send this one after a field target, or back to the bunker with `null`. A zombie
   * already past the target's distance keeps going for the bunker.
   */
  setGoal(goal: FieldGoal | null): void {
    if (goal && this.z < goal.z) return;
    this.goal = goal;
    if (goal) {
      this.stopZ = goal.z + 0.9;
    } else {
      this.stopZ = this.def.boss ? this.def.boss.stopZ : FIELD.attackZ + Math.random() * 1.3;
      if (this.state === 'attack') this.state = 'walk';
    }
  }

  /** Nudge sideways (used by crowd separation). */
  push(dx: number): void {
    this.x += dx;
    this.spawnX += dx;
    this.targetX = Phaser.Math.Clamp(this.targetX + dx, -FIELD.attackHalfWidth, FIELD.attackHalfWidth);
  }

  hitReact(dir: number, strength: number, headshot: boolean, color = 0xffffff): void {
    this.flinchDir = dir;
    this.flinch = Math.min(1.4, this.flinch + strength * (headshot ? 1.4 : 1));
    this.hitFlash = 0.07;
    this.flashColor = color;
  }

  stagger(seconds: number): void {
    this.staggerLeft = Math.max(this.staggerLeft, seconds);
  }

  kill(style: 'bullet' | 'headshot' | 'blast', dir: number): void {
    this.state = 'dying';
    this.deathT = 0;
    this.deathDir = dir || (Math.random() < 0.5 ? -1 : 1);
    if (style === 'headshot') {
      this.deathStyle = 'crumple';
      this.headless = true;
      this.head.setVisible(false);
    } else if (style === 'blast') {
      this.deathStyle = 'back';
    } else {
      this.deathStyle = Math.random() < 0.6 ? 'side' : Math.random() < 0.5 ? 'back' : 'crumple';
    }
    if (this.def.rig === 'crawl') this.deathStyle = 'back';
  }

  /** Instantly hide (e.g. a Bloater that detonated on the wall). */
  vanish(): void {
    this.state = 'dead';
    this.active = false;
    this.root.setVisible(false);
  }

  release(): void {
    this.active = false;
    this.state = 'dead';
    this.root.setVisible(false);
  }

  private updateScreen(): void {
    project(this.x, this.z, tmpP);
    this.sx = tmpP.sx;
    this.sy = tmpP.sy;
    this.ppm = tmpP.ppm;
    this.scale = (tmpP.ppm * this.def.height) / this.rigHeight;
    this.root.setPosition(this.sx, this.sy);
    this.root.setDepth(depthForZ(this.z));
  }

  // ------------------------------------------------------------ posing

  /**
   * Shambler pose. Each joint turns about its pivot: torso and head about the hips and neck,
   * arms about the shoulders, legs about the hips and knees.
   * Walking: each leg lifts for half a stride, the shin shortening and the foot swinging in,
   * while the other leg takes the weight; the body dips on each step and sways over the stance
   * leg, and the arms counter-swing. Attacking: the arms flare out, reach in front of the chest
   * for the strike and recover, never crossing the body.
   */
  private poseSheet(): void {
    const fig = this.figure as Figure;
    const P = fig.parts;
    const attacking = this.state === 'attack';
    const moving = this.state === 'walk';
    const phi = this.phase;
    const s = moving ? Math.sin(phi) : 0;

    // Legs: each lifts for half a stride, eased so the foot accelerates off and lands softly.
    const lift = [0, 0];
    for (let i = 0; i < 2; i++) lift[i] = moving ? smooth(Math.max(0, Math.sin(phi + (i ? Math.PI : 0)))) : 0;

    // Arms: counter-swing while walking; flare, strike and recover while attacking.
    const a = this.attackT;
    const flare = attacking ? strikeFlare(a) : 0;
    const lunge = attacking ? (a < 0.66 ? smooth((a - 0.3) / 0.36) : 1 - smooth((a - 0.66) / 0.34)) : 0;
    const armRot = [0, 0];
    const armSY = [1, 1];
    for (let i = 0; i < 2; i++) {
      const outward = i === 0 ? 1 : -1;
      const swing = moving ? Math.sin(phi + (i ? 0 : Math.PI)) : 0;
      armRot[i] = attacking ? outward * flare : outward * 0.07 * swing;
      armSY[i] = 1 - (moving ? 0.05 * Math.max(0, swing) : 0);
    }

    // Upper body: dips on each step, sways over the stance leg, leans into the strike.
    const bob = moving ? Math.abs(s) * 4 : Math.sin(this.time * 1.6 + this.wanderSeed) * 1.2;
    const up = bob - 5 * lunge;
    const sway = moving ? s * 2.5 : 0;
    const lateral = sway + this.flinchDir * 9 * this.flinch;
    let torsoRot = this.lean + this.flinchDir * 0.22 * this.flinch + (moving ? s * 0.025 : 0) + 0.08 * lunge;
    if (this.staggerLeft > 0) torsoRot += Math.sin(this.time * 16) * 0.12;
    let headRot = this.headTilt + Math.sin(this.time * 0.9 + this.wanderSeed) * 0.07 + this.flinchDir * 0.45 * this.flinch;

    // Death, as on the procedural rig. A crumple also folds the legs.
    let rootRot = 0, rootSY = 1, buckle = 0;
    if (this.state === 'dying' || this.state === 'dead') {
      const d = this.deathT;
      if (this.deathStyle === 'crumple') {
        buckle = Math.min(1, d / 0.45);
        rootSY = 1 - 0.45 * buckle;
        const fall = Math.max(0, (d - 0.4) / 0.6);
        rootRot = this.deathDir * 1.5 * fall * fall;
        torsoRot += this.deathDir * 0.3 * buckle;
      } else if (this.deathStyle === 'side') {
        const e = d * d;
        rootRot = this.deathDir * (1.52 * e - (d > 0.85 ? Math.sin(((d - 0.85) / 0.15) * Math.PI) * 0.06 : 0));
        torsoRot += this.deathDir * 0.2 * d;
      } else {
        rootSY = 1 - 0.74 * d * d;
        rootRot = this.deathDir * 0.18 * d;
        torsoRot += this.deathDir * 0.1;
      }
      headRot += this.deathDir * 0.5 * d;
    }

    // Torso and head: the torso turns about the hips; the head and arms are carried by it.
    const cT = Math.cos(torsoRot), sT = Math.sin(torsoRot);
    const hip = { x: P.torso.px + lateral, y: P.torso.py - up };
    const inTorso = (lx: number, ly: number): { x: number; y: number } => ({
      x: hip.x + lx * cT - ly * sT,
      y: hip.y + lx * sT + ly * cT,
    });
    this.torso.setPosition(hip.x, hip.y).setRotation(torsoRot);

    const neck = inTorso(P.head.px - P.torso.px, P.head.py - P.torso.py);
    const headR = torsoRot * 0.5 + headRot;
    this.head.setPosition(neck.x, neck.y).setRotation(headR);
    this.headC.x = neck.x + (P.head.h / 2) * Math.sin(headR);
    this.headC.y = neck.y - (P.head.h / 2) * Math.cos(headR);
    this.headC.r = P.head.w * 0.42;

    for (let i = 0; i < 2; i++) {
      const part = i === 0 ? P.armL : P.armR;
      const shoulder = inTorso(part.px - P.torso.px, part.py - P.torso.py);
      const rot = torsoRot * 0.5 + armRot[i];
      this.ua[i].setPosition(shoulder.x, shoulder.y).setRotation(rot).setScale(1, armSY[i]);
      const reach = fig.armReach * armSY[i];
      const seg = this.segs[i];
      seg.ax = shoulder.x; seg.ay = shoulder.y;
      seg.bx = shoulder.x - Math.sin(rot) * reach; seg.by = shoulder.y + Math.cos(rot) * reach;
      seg.r = 12; seg.zone = 'torso';
    }

    // Legs: thigh from the hip, shin from the knee. A lifted shin shortens and its foot swings in.
    for (let i = 0; i < 2; i++) {
      const thighP = i === 0 ? P.thighL : P.thighR;
      const shinP = i === 0 ? P.shinL : P.shinR;
      const hipX = thighP.px + lateral, hipY = thighP.py;
      const thighRot = (i === 0 ? 0.03 : -0.03) * (moving ? Math.sin(phi + (i ? Math.PI : 0)) : 0);
      const thighSY = 1 - 0.3 * buckle;
      const kx = shinP.px - thighP.px, ky = (shinP.py - thighP.py) * thighSY;
      const ct = Math.cos(thighRot), st = Math.sin(thighRot);
      const kneeX = hipX + kx * ct - ky * st, kneeY = hipY + kx * st + ky * ct;
      const inward = i === 0 ? -1 : 1;
      const shinRot = thighRot + inward * FOOT_IN * lift[i];
      const shinSY = (1 - KNEE_LIFT * lift[i]) * (1 - 0.5 * buckle);
      this.thigh[i].setPosition(hipX, hipY).setRotation(thighRot).setScale(1, thighSY);
      this.shin[i].setPosition(kneeX, kneeY).setRotation(shinRot).setScale(1, shinSY);

      const hipSeg = this.segs[2 + i];
      hipSeg.ax = hipX; hipSeg.ay = hipY; hipSeg.bx = kneeX; hipSeg.by = kneeY;
      hipSeg.r = 20; hipSeg.zone = 'legs';
      const shinLen = shinP.h * shinSY;
      const footX = kneeX - Math.sin(shinRot) * shinLen, footY = kneeY + Math.cos(shinRot) * shinLen;
      const shinSeg = this.segs[5 + i];
      shinSeg.ax = kneeX; shinSeg.ay = kneeY; shinSeg.bx = footX; shinSeg.by = footY;
      shinSeg.r = 17; shinSeg.zone = 'legs';
    }

    const st = this.segs[4];
    const waist = inTorso(0, -12), chest = inTorso(0, -200);
    st.ax = waist.x; st.ay = waist.y; st.bx = chest.x; st.by = chest.y; st.r = P.torso.w * 0.42; st.zone = 'torso';

    this.applyRoot(rootRot, rootSY);
  }

  private pose(): void {
    if (this.figure) {
      this.poseSheet();
      return;
    }
    const style = this.def.rig;
    const t = this.phase;
    const s0 = -1, s1 = 1;
    let rootX = 0, rootY = -(LEN.thigh + LEN.shin - 6), torsoRot = this.lean, torsoSY = 1, torsoSX = 1;
    let headRot = this.headTilt + Math.sin(this.time * 0.9 + this.wanderSeed) * 0.07;
    const legs = [{ th: 0, thSY: 1, sh: 0, shSY: 1 }, { th: 0, thSY: 1, sh: 0, shSY: 1 }];
    const arms = [{ ua: 0, uaSY: 1, fa: 0, faSY: 1, hs: 1 }, { ua: 0, uaSY: 1, fa: 0, faSY: 1, hs: 1 }];
    const attacking = this.state === 'attack';
    const emerging = this.state === 'emerge';

    if (style === 'crawl') {
      rootY = -16;
      torsoSY = 0.5;
      const pull = Math.sin(t);
      rootX = pull * 5;
      torsoRot = pull * 0.08;
      headRot = this.headTilt * 0.5 + pull * 0.12;
      for (let i = 0; i < 2; i++) {
        const s = i === 0 ? s0 : s1;
        const ph = Math.sin(t + (i ? Math.PI : 0));
        const reach = attacking ? Math.max(0, Math.sin(this.attackT * TAU + i * Math.PI)) : Math.max(0, ph);
        arms[i].ua = -s * (1.15 + 0.35 * reach);
        arms[i].uaSY = 0.85;
        arms[i].fa = -s * (0.25 - 0.4 * reach);
        arms[i].faSY = 0.8 - 0.25 * reach;
        arms[i].hs = 1;
      }
    } else {
      // legs
      for (let i = 0; i < 2; i++) {
        const s = i === 0 ? s0 : s1;
        const ph = t + (i ? Math.PI : 0);
        let lift = emerging || attacking ? 0 : Math.max(0, Math.sin(ph));
        if (style === 'shamble' && i === 1) lift *= this.limp;
        if (attacking) lift = Math.max(0, Math.sin(this.time * 3 + i * Math.PI)) * 0.15;
        const L = legs[i];
        const spread = style === 'bloat' ? 0.16 : style === 'heavy' ? 0.08 : 0.05;
        if (style === 'run') {
          L.th = -s * spread + s * 0.08 * lift;
          L.thSY = 1 - 0.5 * lift;
          L.sh = L.th - s * 0.35 * lift;
          L.shSY = 1 - 0.42 * lift;
        } else {
          L.th = -s * spread + s * 0.05 * lift;
          L.thSY = 1 - 0.3 * lift;
          L.sh = L.th + s * 0.1 * lift;
          L.shSY = 1 - 0.14 * lift;
        }
      }
      const liftMax = Math.max(Math.abs(Math.sin(t)), 0);
      if (!emerging && !attacking) {
        const bob = style === 'run' ? 10 : style === 'bloat' ? 3 : 5;
        rootY -= bob * liftMax;
        const sway = style === 'bloat' ? 12 : style === 'run' ? 4 : 7;
        rootX = Math.sin(t) * sway;
        torsoRot += Math.sin(t) * (style === 'bloat' ? 0.09 : style === 'run' ? 0.04 : 0.06);
      } else if (emerging) {
        rootX = Math.sin(this.time * 1.3 + this.wanderSeed) * 4;
        torsoRot += Math.sin(this.time * 1.1) * 0.05;
      }
      if (style === 'run') {
        torsoSY = 0.9;
        headRot *= 0.5;
      }
      if (style === 'bloat') torsoSX = 1 + Math.sin(this.time * 2.6) * 0.035;

      // arms
      for (let i = 0; i < 2; i++) {
        const s = i === 0 ? s0 : s1;
        const A = arms[i];
        const ph = t + (i ? 0 : Math.PI);
        if (attacking) {
          const a = (this.attackT + (style === 'run' ? i * 0.5 : 0)) % 1;
          const raise = a < 0.6 ? Math.sin((a / 0.6) * Math.PI * 0.5) : a < 0.72 ? 1 - (a - 0.6) / 0.12 : 0;
          A.ua = -s * (0.35 + 2.0 * raise);
          A.uaSY = 0.85;
          A.fa = A.ua - s * (0.3 + 0.5 * raise);
          A.faSY = 0.85;
          A.hs = 1.1;
        } else if (style === 'run') {
          const pump = Math.sin(ph);
          A.ua = -s * 0.38;
          A.uaSY = 0.8 - 0.3 * pump;
          A.fa = s * (Math.PI - 0.75);
          A.faSY = 0.6 + 0.3 * pump;
        } else if (style === 'shamble' && s === this.reachSide) {
          A.ua = -s * 0.28 + Math.sin(ph) * 0.05;
          A.uaSY = 0.42;
          A.fa = -s * 0.12 + Math.sin(ph + 1) * 0.08;
          A.faSY = 0.42;
          A.hs = 1.18;
        } else if (style === 'bloat') {
          A.ua = -s * 0.62 + Math.sin(ph) * 0.06;
          A.uaSY = 0.95;
          A.fa = -s * 0.28;
          A.faSY = 0.92;
        } else {
          const swing = Math.sin(ph) * (style === 'heavy' ? 0.1 : 0.14);
          A.ua = -s * (style === 'heavy' ? 0.2 : 0.12) + swing * 0.4;
          A.uaSY = 0.96 - 0.12 * Math.max(0, Math.sin(ph));
          A.fa = A.ua - s * 0.1;
          A.faSY = 0.95 - 0.25 * Math.max(0, Math.sin(ph));
        }
      }
    }

    // hit reaction and stagger wobble
    torsoRot += this.flinchDir * 0.22 * this.flinch;
    headRot += this.flinchDir * 0.45 * this.flinch;
    rootX += this.flinchDir * 9 * this.flinch;
    if (this.staggerLeft > 0) torsoRot += Math.sin(this.time * 16) * 0.12;
    if (attacking && !this.struck && this.attackT > 0.6) rootY += 6;

    // death
    let rootRot = 0, rootSY = 1;
    if (this.state === 'dying' || this.state === 'dead') {
      const d = this.deathT;
      if (this.deathStyle === 'crumple') {
        const buckle = Math.min(1, d / 0.45);
        for (const L of legs) {
          L.thSY = 1 - 0.55 * buckle;
          L.shSY = 1 - 0.35 * buckle;
        }
        rootY *= 1 - 0.45 * buckle;
        const fall = Math.max(0, (d - 0.4) / 0.6);
        rootRot = this.deathDir * 1.5 * fall * fall;
        torsoRot += this.deathDir * 0.3 * buckle;
      } else if (this.deathStyle === 'side') {
        const e = d * d;
        rootRot = this.deathDir * (1.52 * e - (d > 0.85 ? Math.sin((d - 0.85) / 0.15 * Math.PI) * 0.06 : 0));
        torsoRot += this.deathDir * 0.2 * d;
      } else {
        rootSY = 1 - 0.74 * (d * d);
        rootRot = this.deathDir * 0.18 * d;
        torsoRot += this.deathDir * 0.1;
      }
      for (const A of arms) {
        A.ua *= 1 + d * 0.8;
        A.uaSY = Math.max(A.uaSY, 0.8);
        A.faSY = Math.max(A.faSY, 0.8);
      }
      headRot += this.deathDir * 0.5 * d;
    }

    // ---- forward kinematics
    const tl = style === 'bloat' ? LEN.bloatTorso : LEN.torso;
    const cos = Math.cos, sin = Math.sin;
    const px = rootX, py = rootY;
    this.torso.setPosition(px, py).setRotation(torsoRot).setScale(torsoSX, torsoSY);
    // hunched: the head sinks into the shoulders and hangs forward
    const sink = style === 'run' ? 4 : style === 'crawl' ? 0 : 10;
    const nx = px + sin(torsoRot) * (tl * torsoSY - sink), ny = py - cos(torsoRot) * (tl * torsoSY - sink);
    this.head.setPosition(nx, ny).setRotation(torsoRot * 0.5 + headRot);
    const shoulderX = (style === 'bloat' ? 56 : 33) * torsoSX;
    const shoulderDown = 14;
    const hipX = style === 'bloat' ? 26 : 17;
    const segs = this.segs;
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      // shoulder in torso space (x, -(tl*tsy - down))
      const lx = s * shoulderX, ly = -(tl * torsoSY - shoulderDown);
      const sxp = px + lx * cos(torsoRot) - ly * sin(torsoRot);
      const syp = py + lx * sin(torsoRot) + ly * cos(torsoRot);
      const A = arms[i];
      this.ua[i].setPosition(sxp, syp).setRotation(A.ua).setScale(1, A.uaSY);
      const ex = sxp - sin(A.ua) * LEN.upperArm * A.uaSY, ey = syp + cos(A.ua) * LEN.upperArm * A.uaSY;
      this.fa[i].setPosition(ex, ey).setRotation(A.fa).setScale(1, A.faSY);
      const wx = ex - sin(A.fa) * LEN.foreArm * A.faSY, wy = ey + cos(A.fa) * LEN.foreArm * A.faSY;
      this.hand[i].setPosition(wx, wy).setRotation(A.fa).setScale(A.hs);
      const sa = segs[i];
      sa.ax = sxp; sa.ay = syp; sa.bx = wx; sa.by = wy; sa.r = 13; sa.zone = 'torso';

      const L = legs[i];
      const hx = px + s * hipX * cos(torsoRot * 0.4), hy = py + s * hipX * sin(torsoRot * 0.4) - 4;
      this.thigh[i].setPosition(hx, hy).setRotation(L.th).setScale(1, L.thSY);
      const kx = hx - sin(L.th) * LEN.thigh * L.thSY, ky = hy + cos(L.th) * LEN.thigh * L.thSY;
      this.shin[i].setPosition(kx, ky).setRotation(L.sh).setScale(1, L.shSY);
      const fx = kx - sin(L.sh) * LEN.shin * L.shSY, fy = ky + cos(L.sh) * LEN.shin * L.shSY;
      const sl = segs[2 + i];
      sl.ax = hx; sl.ay = hy; sl.bx = fx; sl.by = fy; sl.r = style === 'crawl' ? 0 : 19; sl.zone = 'legs';
    }
    const st = segs[4];
    const halfW = style === 'bloat' ? 70 : style === 'heavy' ? 46 : 41;
    st.ax = px; st.ay = py - 10 * torsoSY; st.bx = nx; st.by = ny + 18 * torsoSY; st.r = halfW * torsoSX; st.zone = 'torso';
    segs[5].r = 0;
    segs[6].r = 0;
    const hr = torsoRot * 0.5 + headRot;
    const headLen = style === 'bloat' ? 30 : 34;
    this.headC.x = nx + sin(hr) * headLen;
    this.headC.y = ny - cos(hr) * headLen;
    this.headC.r = style === 'bloat' ? 22 : 25;

    this.applyRoot(rootRot, rootSY);
  }

  /** Shared tail of every pose: place the rig, fade it in and out, and tint it by distance. */
  private applyRoot(rootRot: number, rootSY: number): void {
    const style = this.def.rig;
    this.root.setScale(this.scale, this.scale * rootSY);
    this.root.setRotation(rootRot);
    let alpha = 1;
    if (this.state === 'emerge' || this.z > FIELD.spawnZ - 6) alpha = Math.min(alpha, Phaser.Math.Clamp((FIELD.spawnZ + 0.5 - this.z) / 5, 0.15, 1));
    if (this.state === 'emerge') alpha = Math.min(alpha, 1 - this.emergeLeft / 1.7);
    if (this.state === 'dead' && this.lieLeft < 0.8) alpha = Math.max(0, this.lieLeft / 0.8);
    this.root.setAlpha(alpha);
    this.shadow.setPosition(0, -2).setScale(style === 'bloat' ? 1.6 : style === 'crawl' ? 1.4 : 1.1, 1);
    this.shadow.setAlpha(this.state === 'dying' || this.state === 'dead' ? 0.4 : 0.9);

    // Distant enemies read as darker, desaturated silhouettes in the haze.
    const dist = Phaser.Math.Clamp((this.z - 8) / 70, 0, 1);
    const g = Math.round(212 - dist * 100);
    let tint = (g << 16) | (Math.round(g * 1.0) << 8) | Math.min(255, Math.round(g * 1.04));
    const bodyTint = this.def.tint ?? this.def.boss?.tint;
    if (bodyTint !== undefined) {
      const k = (shift: number): number => Math.round((((tint >> shift) & 0xff) * ((bodyTint >> shift) & 0xff)) / 255);
      tint = (k(16) << 16) | (k(8) << 8) | k(0);
    }
    // The tell before a spit (pulsing acid green) or a howl (pulsing pale blue).
    if (this.channelKind) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 24);
      tint = this.channelKind === 'spit'
        ? Phaser.Display.Color.GetColor(Math.round(120 + 60 * pulse), 255, Math.round(60 + 40 * pulse))
        : Phaser.Display.Color.GetColor(Math.round(190 + 60 * pulse), Math.round(210 + 40 * pulse), 255);
    }
    if (this.slowLeft > 0) tint = 0x9fd4ff;
    else if (this.burnLeft > 0) tint = Phaser.Display.Color.GetColor(255, Math.round(g * 0.75), Math.round(g * 0.55));
    if (this.hitFlash > 0) tint = this.flashColor;
    if (tint !== this.baseTint) {
      this.baseTint = tint;
      for (const c of this.root.list as Phaser.GameObjects.Image[]) if (c !== this.shadow) c.setTint(tint);
    }
  }

  // ------------------------------------------------------------ hit testing

  /** Returns the zone hit by a screen point, or null. Head is tested first. */
  hitTest(px: number, py: number): HitZone | null {
    if (!this.alive) return null;
    const s = this.scale;
    if (s <= 0) return null;
    // quick reject by bounding radius
    const top = this.sy - this.rigHeight * s * 1.05;
    const halfW = (this.figure ? this.figure.halfWidth : this.def.rig === 'bloat' ? 120 : 95) * s + 4;
    if (py < top - 4 || py > this.sy + 6 || px < this.sx - halfW || px > this.sx + halfW) return null;
    const rot = this.root.rotation;
    const dx = px - this.sx, dy = py - this.sy;
    const c = Math.cos(-rot), sn = Math.sin(-rot);
    const lx = (dx * c - dy * sn) / s;
    const ly = (dx * sn + dy * c) / (s * this.root.scaleY / this.root.scaleX);
    // Tiny distant targets get a small minimum radius so they remain hittable.
    const slack = Math.max(0, 3 / s - 4);
    if (!this.headless) {
      const hx = lx - this.headC.x, hy = ly - this.headC.y;
      const r = this.headC.r + slack * 0.6;
      if (hx * hx + hy * hy <= r * r) return 'head';
    }
    let best: HitZone | null = null;
    for (const seg of this.segs) {
      if (seg.r <= 0) continue;
      if (distToSeg(lx, ly, seg) <= seg.r + slack) {
        if (seg.zone === 'torso') return 'torso';
        best = seg.zone;
      }
    }
    return best;
  }

  /** Screen position of the head centre (for gore effects). */
  headScreen(out: { x: number; y: number }): { x: number; y: number } {
    return this.localToScreen(this.headC.x, this.headC.y, out);
  }

  /** Screen position of the chest (for fire/impact effects). */
  chestScreen(out: { x: number; y: number }): { x: number; y: number } {
    const st = this.segs[4];
    return this.localToScreen((st.ax + st.bx) / 2, st.ay * 0.35 + st.by * 0.65, out);
  }

  private localToScreen(lx: number, ly: number, out: { x: number; y: number }): { x: number; y: number } {
    const r = this.root.rotation;
    const sx = this.root.scaleX, sy = this.root.scaleY;
    const x = lx * sx, y = ly * sy;
    out.x = this.sx + x * Math.cos(r) - y * Math.sin(r);
    out.y = this.sy + x * Math.sin(r) + y * Math.cos(r);
    return out;
  }
}

function distToSeg(px: number, py: number, s: Seg): number {
  const vx = s.bx - s.ax, vy = s.by - s.ay;
  const len2 = vx * vx + vy * vy || 1;
  let t = ((px - s.ax) * vx + (py - s.ay) * vy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (s.ax + vx * t), dy = py - (s.ay + vy * t);
  return Math.sqrt(dx * dx + dy * dy);
}
