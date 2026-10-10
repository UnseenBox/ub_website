import { AWARENESS, NOISE, PLAYER } from '../core/Tuning';
import {
  TAU,
  clamp,
  clamp01,
  dist,
  rotateToward,
  type Rect,
} from '../core/Mathx';
import type { EventBus } from '../core/EventBus';
import type { NoiseEvent } from '../core/Events';
import type { AttentionSource } from '../stealth/AttentionSystem';
import { hasLineOfSight } from '../stealth/LineOfSight';
import { moveBody, type Body } from '../world/Collision';
import type { PatternMemory } from '../gameplay/PatternMemory';
import {
  ENEMY_DEFS,
  type AwarenessProfile,
  type EnemyDefinition,
  type EnemyKind,
} from './EnemyDefinition';
import {
  makeReading,
  strongestSource,
  type AwarenessInputs,
  type SourceReading,
} from './EnemyAwareness';
import type { EnemyAlertEvent, EnemyCommunication } from './EnemyCommunication';
import { EnemyStateMachine } from './EnemyStateMachine';

export interface PatrolNode {
  x: number;
  y: number;
  /** Seconds to stand here before moving on. */
  pause?: number;
}

export interface EnemySpawn {
  kind: EnemyKind;
  x: number;
  y: number;
  /** Initial facing in radians. 0 points right. */
  facing?: number;
  patrol?: readonly PatrolNode[];
  /** Looks asleep but is not. The cruellest flag in the file. */
  fakeAsleep?: boolean;
  /** Per-instance multiplier on how fast awareness climbs. */
  reactionScale?: number;
  /** Identifier rooms can use to refer to this creature in objectives. */
  tag?: string;
}

export interface EnemyContext {
  bus: EventBus;
  sources: readonly AttentionSource[];
  /** Solids that block line of sight. */
  blockers: readonly Rect[];
  /** Solids that block movement. */
  solids: readonly Rect[];
  playerX: number;
  playerY: number;
  /** True while the character is inside a hiding spot. */
  playerHidden: boolean;
  roomTime: number;
  comms: EnemyCommunication;
  patterns: PatternMemory;
  /** 0..1 flashlight glare on each enemy id — computed per-frame by Game. */
  glareFor?: (enemyId: string) => number;
}

let nextEnemyId = 1;

export class Enemy {
  readonly id: string;
  readonly def: EnemyDefinition;
  readonly tag: string | undefined;

  x: number;
  y: number;
  facing: number;

  readonly homeX: number;
  readonly homeY: number;
  readonly homeFacing: number;

  readonly state = new EnemyStateMachine('CALM');

  /** 0..AWARENESS.ceiling. The only number that matters. */
  awareness = 0;
  /** What the creature shows the player. For a Liar this is a lie. */
  displayAwareness = 0;
  /** Highest awareness reached since it last calmed down, for near-miss scoring. */
  peakAwareness = 0;

  asleep = false;
  fakeAsleep = false;

  /** Last place attention was worth walking to. */
  lastAttentionX = 0;
  lastAttentionY = 0;
  lastAttentionAge = Infinity;
  /** Which attention source it is currently reacting to, for the debug overlay. */
  focusSourceId: string | null = null;
  focusIsDecoy = false;

  /** Noise lure: while this runs the creature is distracted from the body. */
  lureX = 0;
  lureY = 0;
  lureTimer = 0;

  stunTimer = 0;
  /** Beat of silence between noticing and charging. */
  noticeTimer = 0;
  pursuitLostTimer = 0;
  searchTimer = 0;
  /** Set for one step when it physically reaches the player. */
  caughtPlayer = false;

  readonly reading: SourceReading = makeReading();
  private readonly scratch: SourceReading = makeReading();

  private readonly patrol: readonly PatrolNode[];
  private patrolIndex = 0;
  private patrolDir = 1;
  private patrolWait = 0;

  private readonly awakeProfile: AwarenessProfile;
  private readonly sleepProfile: AwarenessProfile;
  private readonly reactionScale: number;
  /** Challenge modifiers scale how quickly a creature loses interest. */
  decayScale = 1;

  private wasInRadius = false;
  private stepDistance = 0;
  private mimicTimer = 6;
  private alertCooldown = 0;
  private lieSeed: number;

  /** Animation state, read by the renderer. Never read by logic. */
  animPhase = 0;
  moveSpeedNow = 0;
  flinch = 0;

  private readonly body: Body;

  constructor(spawn: EnemySpawn) {
    this.def = ENEMY_DEFS[spawn.kind];
    this.id = `enemy-${nextEnemyId++}`;
    this.tag = spawn.tag;
    this.x = spawn.x;
    this.y = spawn.y;
    this.homeX = spawn.x;
    this.homeY = spawn.y;
    this.facing = spawn.facing ?? Math.PI * 0.5;
    this.homeFacing = this.facing;
    this.patrol = spawn.patrol ?? [];
    this.reactionScale = spawn.reactionScale ?? 1;
    this.lieSeed = (nextEnemyId * 2.399963) % TAU;
    this.body = { x: this.x, y: this.y, radius: this.def.awareness.bodyRadius * 0.8 };

    this.awakeProfile = this.def.awareness;
    // A sleeping creature has its eyes shut: proximity, pointing and speed barely
    // reach it, but sound and loitering still do. Expressed as data, not an if.
    this.sleepProfile = {
      ...this.awakeProfile,
      proximityWeight: this.awakeProfile.proximityWeight * 0.3,
      pointWeight: this.awakeProfile.pointWeight * 0.12,
      speedWeight: this.awakeProfile.speedWeight * 0.18,
      gazeAngle: Math.PI,
      gazeBonus: 1,
      blindMultiplier: 1,
      requiresLineOfSight: false,
    };

    this.asleep = this.def.startsAsleep;
    this.fakeAsleep = spawn.fakeAsleep ?? false;
    if (this.asleep) this.state.set('IDLE');
  }

  get profile(): AwarenessProfile {
    return this.asleep && !this.fakeAsleep ? this.sleepProfile : this.awakeProfile;
  }

  /** True when the creature is capable of ending the run right now. */
  get lethal(): boolean {
    return this.def.canPursue && !this.state.is('DEAD', 'DISABLED');
  }

  get looksAsleep(): boolean {
    return this.asleep || this.fakeAsleep;
  }

  update(dt: number, ctx: EnemyContext): void {
    this.state.advance(dt);
    this.caughtPlayer = false;
    this.animPhase += dt;
    this.alertCooldown = Math.max(0, this.alertCooldown - dt);
    this.flinch = Math.max(0, this.flinch - dt * 3);
    if (this.state.current === 'DEAD') return;

    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.state.set('DISABLED');
      this.awareness = Math.max(0, this.awareness - dt * 0.8);
      this.updateDisplayAwareness(dt, ctx.roomTime);
      this.state.endStep();
      if (this.stunTimer <= 0) {
        this.state.set('CALM');
        ctx.bus.emit('ENEMY_CALMED', { enemyId: this.id, kind: this.def.kind });
      }
      return;
    }

    const inputs: AwarenessInputs = {
      x: this.x,
      y: this.y,
      facing: this.facing,
      profile: this.profile,
      blockers: ctx.blockers,
      glare: ctx.glareFor ? ctx.glareFor(this.id) : 0,
    };

    strongestSource(inputs, ctx.sources, this.scratch, this.reading);
    let pressure = this.reading.pressure;
    this.focusSourceId = this.reading.source?.id ?? null;
    this.focusIsDecoy = false;

    // A creature chasing a noise is not watching the body nearly as closely.
    if (this.lureTimer > 0) {
      this.lureTimer -= dt;
      if (pressure > 0) pressure *= NOISE.lureCursorDamping;
    }

    this.trackExposure(ctx, pressure);

    // Integrate. Pressure pushes awareness up; boredom always pulls it down.
    const p = this.profile;
    const rise = pressure * p.reactionSpeed * this.reactionScale;
    const decay = p.interestDecay * this.decayScale;
    this.awareness = clamp(this.awareness + (rise - decay) * dt, 0, AWARENESS.ceiling);
    this.peakAwareness = Math.max(this.peakAwareness, this.awareness);

    this.rememberAttention(dt, pressure);
    this.decideState(dt, ctx);
    this.act(dt, ctx);
    this.updateDisplayAwareness(dt, ctx.roomTime);
    this.maybeRattle(dt, ctx);
    this.state.endStep();
  }

  // --- sensing bookkeeping ---------------------------------------------------

  private trackExposure(ctx: EnemyContext, pressure: number): void {
    const inRadius = this.reading.inRadius && this.reading.visible && pressure > 0.02;
    if (inRadius && !this.wasInRadius) {
      ctx.bus.emit('PLAYER_ENTERED_AWARENESS', { enemyId: this.id });
    } else if (!inRadius && this.wasInRadius) {
      ctx.bus.emit('PLAYER_LEFT_AWARENESS', { enemyId: this.id });
    }
    this.wasInRadius = inRadius;
  }

  private rememberAttention(dt: number, pressure: number): void {
    const src = this.reading.source;
    if (pressure > 0.08 && src) {
      // Body hunters walk to where your body IS (or was last seen).
      this.lastAttentionX = src.x;
      this.lastAttentionY = src.y;
      this.lastAttentionAge = 0;
    } else {
      this.lastAttentionAge += dt;
    }
  }

  private updateDisplayAwareness(dt: number, roomTime: number): void {
    if (!this.def.deceptive || this.state.current === 'PURSUING') {
      // It stops pretending once it is actually coming for you.
      this.displayAwareness += (this.awareness - this.displayAwareness) * Math.min(1, dt * 7);
      return;
    }
    if (this.asleep && !this.fakeAsleep) {
      this.displayAwareness += (0 - this.displayAwareness) * Math.min(1, dt * 4);
      return;
    }
    // A slow, confident lie: a tell that drifts on its own schedule.
    const lie = (Math.sin(roomTime * 0.47 + this.lieSeed) * 0.5 + 0.5) * 0.72;
    const target = this.fakeAsleep ? Math.min(lie, 0.08) : lie;
    this.displayAwareness += (target - this.displayAwareness) * Math.min(1, dt * 2.2);
  }

  // --- state ----------------------------------------------------------------

  private decideState(dt: number, ctx: EnemyContext): void {
    if (this.state.current === 'PURSUING') {
      this.awareness = Math.max(this.awareness, AWARENESS.detect);
      return;
    }

    const aw = this.awareness;

    if (this.asleep) {
      if (aw >= AWARENESS.suspicious) this.wake(ctx);
      else return;
    }

    if (aw >= AWARENESS.detect) {
      if (this.def.canPursue) {
        this.beginPursuit(ctx);
      } else if (this.transition(ctx, 'ALERT')) {
        // It cannot catch you, so it screams instead.
        this.raiseAlarm(ctx, 1);
      }
      return;
    }

    if (aw >= AWARENESS.alert) {
      this.transition(ctx, 'ALERT');
      if (this.def.alertsPeers && this.alertCooldown <= 0) {
        this.raiseAlarm(ctx, 0.7);
        this.alertCooldown = 1.6;
      }
      return;
    }
    // A creature that heard something goes to look at it whether or not it is
    // alarmed. This is what makes a distraction a distraction: it does not need
    // to frighten the thing, it only needs to be somewhere else.
    if (aw >= AWARENESS.investigate || this.lureTimer > 0) {
      this.transition(ctx, 'INVESTIGATING');
      return;
    }
    if (aw >= AWARENESS.suspicious) {
      this.transition(ctx, 'SUSPICIOUS');
      return;
    }

    // Calmed down. Sweep, then go home.
    if (this.state.is('ALERT', 'INVESTIGATING')) {
      this.searchTimer = 3.2;
      this.transition(ctx, 'SEARCHING');
      return;
    }
    if (this.state.current === 'SEARCHING') {
      this.searchTimer -= dt;
      if (this.searchTimer <= 0) this.transition(ctx, 'RETURNING');
      return;
    }
    if (this.state.current === 'RETURNING') {
      if (dist(this.x, this.y, this.homeX, this.homeY) < 6) {
        this.transition(ctx, 'CALM');
        this.peakAwareness = 0;
      }
      return;
    }
    if (this.state.current === 'SUSPICIOUS') {
      if (this.state.timeInState > 1.1) this.transition(ctx, this.patrol.length ? 'CALM' : 'RETURNING');
      return;
    }
    if (this.state.current !== 'CALM') this.transition(ctx, 'CALM');
  }

  private transition(ctx: EnemyContext, next: Parameters<EnemyStateMachine['set']>[0]): boolean {
    const from = this.state.current;
    if (!this.state.set(next)) return false;
    ctx.bus.emit('ENEMY_STATE_CHANGED', {
      enemyId: this.id,
      kind: this.def.kind,
      from,
      to: next,
    });
    if (next === 'SUSPICIOUS') {
      ctx.bus.emit('ENEMY_SUSPICIOUS', { enemyId: this.id, kind: this.def.kind });
      this.flinch = 1;
    } else if (next === 'INVESTIGATING') {
      ctx.bus.emit('ENEMY_INVESTIGATING', {
        enemyId: this.id,
        kind: this.def.kind,
        x: this.targetX(),
        y: this.targetY(),
      });
    } else if (next === 'ALERT') {
      ctx.bus.emit('ENEMY_ALERTED', {
        enemyId: this.id,
        kind: this.def.kind,
        source: this.lureTimer > 0 ? 'noise' : 'body',
      });
    } else if (next === 'CALM' || next === 'IDLE') {
      ctx.bus.emit('ENEMY_CALMED', { enemyId: this.id, kind: this.def.kind });
    }
    return true;
  }

  private wake(ctx: EnemyContext): void {
    this.asleep = false;
    this.flinch = 1;
    this.transition(ctx, 'SUSPICIOUS');
    ctx.bus.emit('ENEMY_ALERTED', {
      enemyId: this.id,
      kind: this.def.kind,
      source: this.lureTimer > 0 ? 'noise' : 'body',
    });
    ctx.bus.emit('TOAST', { text: 'IT WAS NOT ASLEEP', tone: 'hot' });
  }

  private beginPursuit(ctx: EnemyContext): void {
    if (this.state.current === 'PURSUING') return;
    this.transition(ctx, 'PURSUING');
    this.noticeTimer = AWARENESS.noticeFreeze;
    this.pursuitLostTimer = 0;
    this.flinch = 1;
    ctx.bus.emit('PLAYER_DETECTED', { enemyId: this.id, kind: this.def.kind });
    this.raiseAlarm(ctx, 1);
  }

  private raiseAlarm(ctx: EnemyContext, intensity: number): void {
    if (!this.def.alertsPeers) return;
    ctx.comms.broadcast({
      sourceId: this.id,
      x: this.lastAttentionAge < 3 ? this.lastAttentionX : this.x,
      y: this.lastAttentionAge < 3 ? this.lastAttentionY : this.y,
      intensity,
      type: this.lureTimer > 0 ? 'noise' : 'body',
      hops: 1,
    });
  }

  // --- behaviour ------------------------------------------------------------

  private targetX(): number {
    if (this.lureTimer > 0) return this.lureX;
    return this.lastAttentionX;
  }

  private targetY(): number {
    if (this.lureTimer > 0) return this.lureY;
    return this.lastAttentionY;
  }

  private act(dt: number, ctx: EnemyContext): void {
    const p = this.profile;
    this.stepDistance = 0;

    switch (this.state.current) {
      case 'IDLE': {
        // Asleep. Breathing only.
        this.moveSpeedNow = 0;
        break;
      }
      case 'CALM': {
        this.doPatrol(dt, ctx, p.calmSpeed);
        break;
      }
      case 'SUSPICIOUS': {
        this.moveSpeedNow = 0;
        this.turnTo(this.targetX(), this.targetY(), dt, p.turnSpeed * 1.5);
        break;
      }
      case 'INVESTIGATING': {
        this.walkTo(this.targetX(), this.targetY(), p.investigationSpeed, dt, ctx);
        break;
      }
      case 'ALERT': {
        this.walkTo(this.targetX(), this.targetY(), p.investigationSpeed * 1.35, dt, ctx);
        break;
      }
      case 'PURSUING': {
        this.doPursuit(dt, ctx);
        break;
      }
      case 'SEARCHING': {
        // Sweep around the last thing it noticed.
        const t = this.state.timeInState;
        const sx = this.lastAttentionX + Math.cos(t * 1.7) * 44;
        const sy = this.lastAttentionY + Math.sin(t * 1.1) * 32;
        this.walkTo(sx, sy, p.investigationSpeed * 0.8, dt, ctx);
        break;
      }
      case 'RETURNING': {
        this.walkTo(this.homeX, this.homeY, p.calmSpeed * 1.6, dt, ctx);
        if (dist(this.x, this.y, this.homeX, this.homeY) < 10) {
          this.facing = rotateToward(this.facing, this.homeFacing, p.turnSpeed * dt);
        }
        break;
      }
      case 'DISABLED':
      case 'DEAD':
        this.moveSpeedNow = 0;
        break;
    }

    // Its own footsteps are noise other creatures can hear. Cascades start here.
    if (this.stepDistance > 0) {
      this.footstepAccum += this.stepDistance;
      if (this.footstepAccum > 30) {
        this.footstepAccum = 0;
        ctx.comms.broadcast({
          sourceId: this.id,
          x: this.x,
          y: this.y,
          intensity: this.state.is('PURSUING', 'ALERT') ? 0.55 : 0.2,
          type: 'peer',
          hops: 2,
        });
      }
    }
  }

  private footstepAccum = 0;

  private doPatrol(dt: number, ctx: EnemyContext, speed: number): void {
    if (this.patrol.length === 0 || speed <= 0) {
      this.moveSpeedNow = 0;
      // Idle sway, and for the Mirror a slow turn toward whatever moved last.
      if (this.def.kind === 'MIRROR' && this.reading.source) {
        this.turnTo(this.reading.source.x, this.reading.source.y, dt, this.profile.turnSpeed);
      } else {
        const sway = Math.sin(this.animPhase * 0.55) * 0.22;
        this.facing = rotateToward(this.facing, this.homeFacing + sway, this.profile.turnSpeed * dt);
      }
      return;
    }

    if (this.patrolWait > 0) {
      this.patrolWait -= dt;
      this.moveSpeedNow = 0;
      const node = this.patrol[this.patrolIndex];
      const look = node.pause ? Math.sin(this.animPhase * 0.9) * 0.7 : 0;
      this.facing = rotateToward(this.facing, this.homeFacing + look, this.profile.turnSpeed * dt);
      return;
    }

    const node = this.patrol[this.patrolIndex];
    if (dist(this.x, this.y, node.x, node.y) < 7) {
      this.patrolWait = node.pause ?? 0.8;
      this.patrolIndex += this.patrolDir;
      if (this.patrolIndex >= this.patrol.length) {
        this.patrolIndex = Math.max(0, this.patrol.length - 2);
        this.patrolDir = -1;
      } else if (this.patrolIndex < 0) {
        this.patrolIndex = Math.min(1, this.patrol.length - 1);
        this.patrolDir = 1;
      }
      return;
    }
    this.walkTo(node.x, node.y, speed, dt, ctx);
  }

  private doPursuit(dt: number, ctx: EnemyContext): void {
    // The beat of silence. It has noticed; it has not moved yet.
    if (this.noticeTimer > 0) {
      this.noticeTimer -= dt;
      this.moveSpeedNow = 0;
      this.turnTo(ctx.playerX, ctx.playerY, dt, this.profile.turnSpeed * 3);
      return;
    }

    // Pursuit is the one moment the creature locks onto the body outright,
    // because it already knows where you are.
    const sees =
      hasLineOfSight(ctx.blockers, this.x, this.y, ctx.playerX, ctx.playerY) && !ctx.playerHidden;
    if (sees) {
      this.pursuitLostTimer = 0;
    } else {
      this.pursuitLostTimer += dt;
      if (this.pursuitLostTimer >= AWARENESS.pursuitLoseTime) {
        this.loseTrack(ctx);
        return;
      }
    }

    this.walkTo(ctx.playerX, ctx.playerY, this.profile.pursuitSpeed, dt, ctx);

    const reach = this.profile.bodyRadius + PLAYER.radius + 2;
    if (!ctx.playerHidden && dist(this.x, this.y, ctx.playerX, ctx.playerY) <= reach) {
      this.caughtPlayer = true;
    }
  }

  private loseTrack(ctx: EnemyContext): void {
    this.awareness = AWARENESS.alert * 0.82;
    this.searchTimer = 3.6;
    this.lastAttentionX = ctx.playerX;
    this.lastAttentionY = ctx.playerY;
    this.lastAttentionAge = 0;
    this.transition(ctx, 'SEARCHING');
    ctx.bus.emit('PLAYER_ESCAPED_DETECTION', { enemyId: this.id, heat: this.peakAwareness });
  }

  private walkTo(tx: number, ty: number, speed: number, dt: number, ctx: EnemyContext): void {
    if (speed <= 0) {
      this.moveSpeedNow = 0;
      this.turnTo(tx, ty, dt, this.profile.turnSpeed);
      return;
    }
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    this.turnTo(tx, ty, dt, this.profile.turnSpeed * (this.state.is('PURSUING', 'ALERT') ? 3.2 : 1.6));
    if (d < 3) {
      this.moveSpeedNow = 0;
      return;
    }
    const step = Math.min(speed * dt, d);
    this.body.x = this.x;
    this.body.y = this.y;
    moveBody(this.body, (dx / d) * step, (dy / d) * step, ctx.solids);
    this.stepDistance = dist(this.x, this.y, this.body.x, this.body.y);
    this.x = this.body.x;
    this.y = this.body.y;
    this.moveSpeedNow = this.stepDistance / dt;
  }

  private turnTo(tx: number, ty: number, dt: number, rate: number): void {
    const target = Math.atan2(ty - this.y, tx - this.x);
    this.facing = rotateToward(this.facing, target, rate * dt);
  }

  private maybeRattle(dt: number, ctx: EnemyContext): void {
    if (!this.def.spawnsDecoys) return;
    if (this.state.is('PURSUING', 'DISABLED', 'DEAD')) return;
    // The Mimic now fakes FOOTSTEPS elsewhere — phantom noise that pulls
    // investigation the wrong way instead of spawning fake cursors.
    this.mimicTimer -= dt;
    if (this.mimicTimer > 0) return;
    this.mimicTimer = 9 + (this.id.length % 3);
    const a = Math.random() * TAU;
    const nx = this.x + Math.cos(a) * 130;
    const ny = this.y + Math.sin(a) * 90;
    this.lureX = nx;
    this.lureY = ny;
    this.lureTimer = Math.max(this.lureTimer, 2.5);
    this.lastAttentionX = nx;
    this.lastAttentionY = ny;
    this.lastAttentionAge = 0;
    ctx.bus.emit('TOAST', { text: 'FOOTSTEPS — WERE THOSE YOURS?', tone: 'warm' });
  }

  // --- external pokes -------------------------------------------------------

  /**
   * Hear a noise. This is how distraction works: a loud enough sound both jolts
   * awareness and, crucially, moves the creature's focus off your body.
   */
  hear(noise: NoiseEvent, ctx: EnemyContext): void {
    if (this.state.is('DEAD', 'DISABLED', 'PURSUING')) return;
    const p = this.profile;
    const range = noise.level * NOISE.audibleScale * p.hearingScale;
    const d = dist(this.x, this.y, noise.x, noise.y);
    if (d > range) return;

    // Gentle falloff: a sound that is audible at all should command attention,
    // rather than fading to nothing across most of its own range.
    const falloff = Math.sqrt(clamp01(1 - d / range));
    let weight = p.noiseWeight;
    if (this.def.keenOn.includes(noise.kind)) weight *= 1.6;

    // The Analyst stops falling for a trick you keep using.
    if (this.def.learns) {
      const seen = ctx.patterns.count(`noise:${noise.kind}`);
      if (seen >= 2) weight *= 0.42;
      else if (seen === 1) weight *= 0.72;
    }

    // Square root, not linear: a quiet sound close by should still register as a
    // sound, rather than being swallowed because it is not a smashed bottle.
    const impulse = weight * Math.min(1, Math.sqrt(noise.level / 12)) * falloff;
    this.awareness = clamp(this.awareness + impulse, 0, AWARENESS.ceiling);
    this.peakAwareness = Math.max(this.peakAwareness, this.awareness);

    // Only a noise worth walking to steals its focus.
    if (noise.level >= 2 && impulse > 0.03) {
      this.lureX = noise.x;
      this.lureY = noise.y;
      let focus = NOISE.lureFocus * (0.6 + falloff * 0.6);
      if (this.def.learns && ctx.patterns.count(`noise:${noise.kind}`) >= 2) focus *= 0.45;
      this.lureTimer = Math.max(this.lureTimer, focus);
      this.lastAttentionX = noise.x;
      this.lastAttentionY = noise.y;
      this.lastAttentionAge = 0;
      this.flinch = Math.max(this.flinch, 0.6);
    }
  }

  receiveAlert(ev: EnemyAlertEvent, falloff: number): void {
    if (this.state.is('DEAD', 'DISABLED', 'PURSUING')) return;
    if (this.asleep && ev.intensity < 0.5) return;
    const gain = ev.intensity * falloff * (ev.type === 'peer' ? 0.22 : 0.62);
    this.awareness = clamp(this.awareness + gain, 0, AWARENESS.ceiling);
    this.peakAwareness = Math.max(this.peakAwareness, this.awareness);
    if (gain > 0.1) {
      this.lastAttentionX = ev.x;
      this.lastAttentionY = ev.y;
      this.lastAttentionAge = 0;
    }
  }

  /** Environmental stun. Not combat: the room doing the work. */
  disable(seconds: number, ctx: EnemyContext): void {
    this.stunTimer = Math.max(this.stunTimer, seconds);
    this.awareness *= 0.4;
    this.lureTimer = 0;
    this.transition(ctx, 'DISABLED');
    ctx.bus.emit('ENEMY_DISABLED', { enemyId: this.id, kind: this.def.kind });
  }

  /** Force attention somewhere, used by scripted room events. */
  distractTo(x: number, y: number, seconds: number): void {
    this.lureX = x;
    this.lureY = y;
    this.lureTimer = Math.max(this.lureTimer, seconds);
    this.lastAttentionX = x;
    this.lastAttentionY = y;
    this.lastAttentionAge = 0;
  }

  /** 0..1 fraction used by the thin awareness arc drawn above the creature. */
  get tell(): number {
    return clamp01(this.displayAwareness / AWARENESS.detect);
  }
}
