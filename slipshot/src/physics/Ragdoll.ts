import * as planck from 'planck';
import { PART_SPECS, JOINT_SPECS, SPAWN_LIFT, type PartName, type PartSpec } from './rig';
import { addMassFixtures, boxShape, capsuleShapes, circleShape, type FixtureEntry } from './shapes';
import type { PhysicsManager } from './PhysicsManager';
import type { Slimeable, Tag } from './tags';
import { approach, clamp, randRange, wrapAngle } from '../util/math';

export type Team = 'player' | 'enemy';

export interface RagdollInit {
  id: number;
  team: Team;
  facing: 1 | -1;
  x: number;
  groundY: number;
  maxHp: number;
}

export interface RagdollPart {
  spec: PartSpec;
  body: planck.Body;
  /** Seconds left of the white hit flash. */
  flash: number;
  prevX: number;
  prevY: number;
  prevA: number;
}

export interface SlimeBlob {
  part: PartName;
  x: number;
  y: number;
  r: number;
}

interface RigJoint {
  joint: planck.RevoluteJoint;
  parent: PartName;
  child: PartName;
  torque: number;
}

// Stance controller tuning. Each joint runs a velocity servo that drives its
// child toward an absolute target angle. Torque is capped, so hard hits can
// still break balance. Balance is an ankle strategy: the legs lean so that the
// whole body's centre of mass moves back over the feet, the way a person
// shifts weight at the ankles to stay up.
const SERVO_KP = 12;
const SERVO_MAX_SPEED = 16;
const BALANCE_KP = 2.0; // rad of leg lean per metre of centre-of-mass offset
const BALANCE_KD = 0.35; // rad of leg lean per m/s of centre-of-mass velocity
const LEG_LEAN_LIMIT = 0.3;
const LYING_TILT = 1.1;
const GET_UP_TILT = 0.6;
/** Torso height (m) below which a live character counts as down. */
const STANDING_HEIGHT = 1.0;
const REST_POSE = { upperFront: 0.15, lowerFront: 0.35, upperBack: -0.1, lowerBack: 0.2 };

export class Ragdoll implements Slimeable {
  readonly id: number;
  readonly team: Team;
  readonly facing: 1 | -1;
  readonly maxHp: number;
  hp: number;
  state: 'alive' | 'dead' = 'alive';
  readonly parts = new Map<PartName, RagdollPart>();

  /** Seconds left of slime coating. */
  slimeTimer = 0;
  /** Full duration of the current coating, used for fading visuals. */
  slimeMax = 1;
  blobs: SlimeBlob[] = [];
  /** Seconds left of stagger (a hit that broke balance). */
  staggerTimer = 0;
  /** 0..1 joint strength. Drops on stagger, lying or death; recovers over time. */
  strength = 1;
  /** Desired world angle of the front arm, or null for the resting pose. */
  aimPhi: number | null = null;
  /** Seconds a dead body stays on the field before it is removed. */
  corpseTimer = 0;
  /** Latest torso tilt in [-PI, PI]. */
  tilt = 0;

  private readonly joints: RigJoint[] = [];
  private readonly targets = new Map<PartName, number>();
  private readonly frontUpper: PartName;
  private readonly frontLower: PartName;
  private readonly backUpper: PartName;
  private readonly backLower: PartName;

  constructor(physics: PhysicsManager, init: RagdollInit) {
    this.id = init.id;
    this.team = init.team;
    this.facing = init.facing;
    this.maxHp = init.maxHp;
    this.hp = init.maxHp;

    const world = physics.world;
    const group = -init.id; // parts of one character never collide with each other

    this.frontUpper = init.facing > 0 ? 'upperArmR' : 'upperArmL';
    this.frontLower = init.facing > 0 ? 'lowerArmR' : 'lowerArmL';
    this.backUpper = init.facing > 0 ? 'upperArmL' : 'upperArmR';
    this.backLower = init.facing > 0 ? 'lowerArmL' : 'lowerArmR';

    for (const spec of PART_SPECS) {
      const body = world.createBody({
        type: 'dynamic',
        position: { x: init.x + spec.center.x, y: init.groundY + SPAWN_LIFT + spec.center.y },
        linearDamping: spec.linearDamping,
        angularDamping: spec.angularDamping,
      });

      const tag: Tag = { kind: 'part', ragdoll: this, part: spec.name, foot: !!spec.box };
      const shapes = spec.box
        ? [boxShape(spec.box.hx, spec.box.hy, { x: 0, y: 0 })]
        : spec.circle
          ? [circleShape({ x: 0, y: 0 }, spec.radius)]
          : capsuleShapes(spec.a!, spec.b!, spec.radius);
      const entries: FixtureEntry[] = shapes.map((s) => ({ ...s, userData: tag, friction: spec.friction }));

      addMassFixtures(body, entries, spec.mass, { friction: spec.friction, restitution: 0.05, filterGroupIndex: group });

      const p = body.getPosition();
      this.parts.set(spec.name, { spec, body, flash: 0, prevX: p.x, prevY: p.y, prevA: body.getAngle() });
      this.targets.set(spec.name, 0);
    }

    // Revolute joints. Limits are mirrored for facing -1 so that knees and
    // elbows bend the same way relative to each character's direction.
    for (const js of JOINT_SPECS) {
      const pb = this.parts.get(js.parent)!.body;
      const cb = this.parts.get(js.child)!.body;
      const lower = init.facing > 0 ? js.lower : -js.upper;
      const upper = init.facing > 0 ? js.upper : -js.lower;
      const joint = new planck.RevoluteJoint({
        bodyA: pb,
        bodyB: cb,
        localAnchorA: js.parentAnchor,
        localAnchorB: js.childAnchor,
        referenceAngle: 0,
        collideConnected: false,
        enableLimit: true,
        lowerAngle: lower,
        upperAngle: upper,
        enableMotor: true,
        motorSpeed: 0,
        maxMotorTorque: js.torque,
      });
      world.createJoint(joint);
      this.joints.push({ joint, parent: js.parent, child: js.child, torque: js.torque });
    }
  }

  get alive(): boolean {
    return this.state === 'alive';
  }

  get dazed(): boolean {
    return this.staggerTimer > 0 || this.slimeTimer > 0;
  }

  get torsoBody(): planck.Body {
    return this.parts.get('torso')!.body;
  }

  get pelvisX(): number {
    return this.parts.get('pelvis')!.body.getPosition().x;
  }

  headPosition(): planck.Vec2Value {
    return this.parts.get('head')!.body.getPosition();
  }

  torsoPosition(): planck.Vec2Value {
    return this.torsoBody.getPosition();
  }

  /** True when the character is roughly upright and above the ground. */
  isStanding(): boolean {
    return this.alive && Math.abs(this.tilt) < 0.5 && this.torsoBody.getPosition().y > 1.0;
  }

  /** Where a projectile should leave the launcher, given the aim direction. */
  muzzle(dir: planck.Vec2Value, distance = 0.24): planck.Vec2Value {
    const hand = this.parts.get(this.frontLower)!.body.getWorldPoint({ x: 0, y: -0.14 });
    return { x: hand.x + dir.x * distance, y: hand.y + dir.y * distance };
  }

  coat(duration: number, point?: planck.Vec2Value, hitPart?: PartName): void {
    this.slimeTimer = Math.max(this.slimeTimer, duration);
    this.slimeMax = this.slimeTimer;
    const blobs: SlimeBlob[] = [];
    const names = [...this.parts.keys()];
    for (let i = 0; i < 8; i++) {
      const part = names[Math.floor(Math.random() * names.length)];
      blobs.push({ part, x: randRange(-0.12, 0.12), y: randRange(-0.2, 0.2), r: randRange(0.06, 0.13) });
    }
    if (point && hitPart) {
      const local = this.parts.get(hitPart)!.body.getLocalPoint(point);
      blobs.push({ part: hitPart, x: local.x, y: local.y, r: randRange(0.12, 0.17) });
    }
    this.blobs = blobs;
  }

  stagger(duration: number): void {
    this.staggerTimer = Math.max(this.staggerTimer, duration);
  }

  flash(part: PartName, duration = 0.14): void {
    const p = this.parts.get(part);
    if (p) p.flash = duration;
  }

  kill(corpseTime: number): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.hp = 0;
    this.corpseTimer = corpseTime;
  }

  /** Set the aim of the front arm. null returns it to the resting pose. */
  setAim(phi: number | null): void {
    this.aimPhi = phi;
  }

  /** Copy current poses into the previous slots, for render interpolation. */
  snapshot(): void {
    for (const p of this.parts.values()) {
      const pos = p.body.getPosition();
      p.prevX = pos.x;
      p.prevY = pos.y;
      p.prevA = p.body.getAngle();
    }
  }

  /** Run the stance servo. Called once per fixed physics step, before world.step. */
  update(dt: number): void {
    this.slimeTimer = Math.max(0, this.slimeTimer - dt);
    this.staggerTimer = Math.max(0, this.staggerTimer - dt);
    for (const p of this.parts.values()) p.flash = Math.max(0, p.flash - dt);
    if (this.state === 'dead') this.corpseTimer = Math.max(0, this.corpseTimer - dt);

    this.tilt = wrapAngle(this.torsoBody.getAngle());

    // Strength: stagger and lying weaken the joints so the body folds,
    // then recover as the torso comes back up.
    let target = 1;
    if (this.state === 'dead') {
      target = 0;
    } else {
      if (this.staggerTimer > 0) target = Math.min(target, 0.6);
      if (Math.abs(this.tilt) > LYING_TILT) target = Math.min(target, 0.4);
    }
    this.strength = approach(this.strength, target, (target < this.strength ? 6 : 1.5) * dt);

    // Balance: move the centre of mass over the midpoint of the feet. When the
    // body is low (sitting or fallen), the legs instead rotate about the planted
    // feet toward vertical, which lifts the pelvis and torso.
    const low = this.state === 'alive' && this.torsoBody.getPosition().y < STANDING_HEIGHT;
    let legLean = 0;
    if (!low) {
      const com = this.centerOfMass();
      const fL = this.parts.get('footL')!.body.getPosition();
      const fR = this.parts.get('footR')!.body.getPosition();
      const offset = com.x - (fL.x + fR.x) / 2;
      legLean = clamp(BALANCE_KP * offset + BALANCE_KD * com.vx, -LEG_LEAN_LIMIT, LEG_LEAN_LIMIT);
    }
    this.targets.set('torso', 0);
    this.targets.set('head', 0);

    const aiming = this.aimPhi !== null && this.state === 'alive';
    // Get-up reflex: when the torso is well off vertical, both arms reach straight
    // down and push against the ground to lift the body.
    const reaching = this.state === 'alive' && Math.abs(this.tilt) > GET_UP_TILT && !aiming;
    this.targets.set(this.frontUpper, aiming ? this.aimPhi! : reaching ? 0 : REST_POSE.upperFront);
    this.targets.set(this.frontLower, aiming ? this.aimPhi! : reaching ? 0 : REST_POSE.lowerFront);
    this.targets.set(this.backUpper, reaching ? 0 : REST_POSE.upperBack);
    this.targets.set(this.backLower, reaching ? 0 : REST_POSE.lowerBack);

    // Each servo drives a joint's relative angle toward a target.
    //  - Ankles hold the foot-to-shin angle at -legLean, so the shin leans while
    //    the foot stays flat on the ground (the ankle strategy).
    //  - Knees hold the shin in line with the thigh, and hips keep the thighs in
    //    line with the pelvis, so the legs and pelvis move as one stack.
    //  - Torso, head and arms have absolute targets, converted to relative ones.
    for (const rj of this.joints) {
      const parentAngle = this.parts.get(rj.parent)!.body.getAngle();
      let relTarget: number;
      switch (rj.child) {
        case 'footL':
        case 'footR':
          // Balanced: the shin leans by legLean from the foot. Low: the shin
          // targets vertical, so the leg pivots up about the planted foot.
          relTarget = low ? this.parts.get(rj.child)!.body.getAngle() : -legLean;
          break;
        case 'thighL':
        case 'thighR':
          // Low: the thighs target vertical, swinging the legs under the pelvis.
          relTarget = low ? -parentAngle : 0;
          break;
        case 'shinL':
        case 'shinR':
          relTarget = 0;
          break;
        default:
          relTarget = (this.targets.get(rj.child) ?? 0) - parentAngle;
      }
      const err = wrapAngle(relTarget - rj.joint.getJointAngle());
      rj.joint.setMotorSpeed(clamp(SERVO_KP * err, -SERVO_MAX_SPEED, SERVO_MAX_SPEED));
      rj.joint.setMaxMotorTorque(rj.torque * this.strength);
    }
  }

  /** Mass-weighted centre of mass (x) and its horizontal velocity. */
  private centerOfMass(): { x: number; vx: number } {
    let mass = 0;
    let x = 0;
    let vx = 0;
    for (const p of this.parts.values()) {
      const m = p.spec.mass;
      mass += m;
      x += p.body.getPosition().x * m;
      vx += p.body.getLinearVelocity().x * m;
    }
    return { x: x / mass, vx: vx / mass };
  }

  /** Remove every body of this character (joints go with them). */
  destroy(physics: PhysicsManager): void {
    for (const p of this.parts.values()) physics.removeBody(p.body);
  }
}
