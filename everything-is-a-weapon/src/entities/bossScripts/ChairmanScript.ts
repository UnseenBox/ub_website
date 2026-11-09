import { INK } from '../../core/constants';
import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { PhysicsObject } from '../PhysicsObject';
import type { BossScript } from './BossScript';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * THE CHAIRMAN: "the quarterly review". A boss with a show to put on.
 *
 * ARMOUR. He arrives wrapped in MEMOS that soak light hits ("REJECTED!"); a real hit tears
 * one away and fire burns the lot. Last memo gone = OUT OF OFFICE: stunned, dizzy, taking
 * extra damage while the PHOTOCOPIER prints him a fresh batch. Jam the machine mid-print, or
 * wreck it for good and he is left bare and furious (OVERTIME).
 *
 * ATTACKS. Between those beats he runs his own meeting, one telegraphed number at a time:
 *   QUICK REVIEW      the chair spins up and he drifts across the room, bouncing off the walls.
 *   REPLY ALL         a ring of paper planes, then (in overtime) a spinning spiral of them.
 *   Q3 PROJECTIONS    a three-slice pie chart sweeps the floor around him: stand in the gaps.
 *   FORECLOSURE       he stamps SOLD on the things nearest you; unless you are holding one
 *                     when the timer runs out, it is gone. Throw it at him now.
 * Every attack shows you what it will do before it does it, and none of them is the same shape.
 */

// ── armour tuning ──
/** Smallest hit that tears a memo off. Anything lighter is simply filed. */
export const MEMO_BREAK = 5;
/** Damage taken while out of office, relative to normal. */
export const EXPOSED_BONUS = 1.35;
/** Share of a blocked hit that still reaches him. */
export const BLOCKED_CHIP = 0.08;
export const STUN_ON_EXPOSE = 1.6;
const PRINT_SECONDS = 6;
const PRINT_SECONDS_OVERTIME = 4.2;
const JAM_SECONDS = 7;
const MEMO_COOLDOWN = 0.22;

// ── attack tuning ──
const DRIFT_WINDUP = 1.0;
const DRIFT_SPEED = 560;
const DRIFT_TIME = 1.25;
const DRIFT_RECOVER = 1.0;
const PLANE_SPEED = 215;
const PLANE_RADIUS = 9;
const PIE_RADIUS = 330;
const PIE_WINDUP = 1.5;
const PIE_TIME = 3.4;
const PIE_SPIN = 0.95;
const STAMP_SECONDS = 2.6;
const ATTACK_GAP = 3.6;
const ATTACK_GAP_OVERTIME = 2.5;

export type AttackKind = 'drift' | 'replyAll' | 'pie' | 'foreclose';
type Stage = 'windup' | 'go' | 'recover';

interface Plane { x: number; y: number; vx: number; vy: number; life: number }
interface Claim { object: PhysicsObject; left: number }

/** What the copier is doing, for the drawing code to read (keyed by the object). */
export interface CopierState {
  /** 0..1 while printing. */
  progress: number;
  jammed: boolean;
}
export const COPIERS = new WeakMap<PhysicsObject, CopierState>();

export class ChairmanScript implements BossScript {
  readonly deathText = 'TERMINATED!';

  // ── armour ──
  memos = 0;
  maxMemos = 2;
  exposed = false;
  copier: PhysicsObject | null = null;
  copierDown = false;
  private started = false;
  private printing = 0;
  private jam = 0;
  private lastHealth = 0;
  private lastTear = -1;
  private sparkT = 0;
  tornAgo = 99;
  reloadedAgo = 99;
  time = 0;

  // ── attacks ──
  attack: AttackKind | null = null;
  stage: Stage = 'windup';
  stageT = 0;
  private gap = 2.2;
  private deck: AttackKind[] = [];
  private lastKind: AttackKind | null = null;
  planes: Plane[] = [];
  claims: Claim[] = [];
  private driftDirX = 1;
  private driftDirY = 0;
  private driftHit = false;
  private driftBounces = 0;
  private trailT = 0;
  private waveT = 0;
  private waveIndex = 0;
  private spiral = 0;
  pieRot = 0;
  private pieHitCooldown = 0;
  /** What the body should look like: read by the drawing code. */
  get pose(): 'idle' | 'spin' | 'drift' | 'reply' | 'pie' | 'stamp' | 'dizzy' {
    if (this.exposed) return 'dizzy';
    if (!this.attack) return 'idle';
    if (this.attack === 'drift') return this.stage === 'windup' ? 'spin' : this.stage === 'go' ? 'drift' : 'dizzy';
    if (this.attack === 'replyAll') return 'reply';
    if (this.attack === 'pie') return 'pie';
    return 'stamp';
  }

  get busy(): boolean {
    return this.attack !== null;
  }

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    this.tornAgo += dt;
    this.reloadedAgo += dt;
    if (!this.started) {
      if (!boss.aware) return;
      this.start(game, boss);
    }
    const overtime = boss.phaseIndex >= 1;
    this.maxMemos = overtime ? 3 : 2;

    this.updateArmour(game, boss, dt, overtime);
    this.updatePlanes(game, dt);
    this.updateClaims(game, dt);

    // A stun, a shock or a fire ends the performance on the spot.
    if (this.attack && (boss.stun > 0 || boss.shockTimer > 0 || boss.burn > 0 || boss.confuse > 0)) this.endAttack(overtime);

    if (this.attack) {
      this.runAttack(game, boss, dt, overtime);
    } else if (!this.exposed && boss.aware && boss.ai === 'chase' && boss.stun <= 0 && boss.shockTimer <= 0 && boss.burn <= 0) {
      this.gap -= dt;
      if (this.gap <= 0) this.beginAttack(game, boss, this.pick(overtime), overtime);
    }
  }

  filterDamage(game: Game, boss: Enemy, amount: number, cause: DamageCause): number {
    if (this.exposed) return amount * EXPOSED_BONUS;
    // Dizzy after a drift: a clean opening.
    if (this.attack === 'drift' && this.stage === 'recover') return amount * 1.3;
    if (this.memos <= 0) return amount;
    const burns = cause.type === 'fire' || cause.type === 'explosion';
    if (burns) {
      this.tearAll(game, boss, 'PAPER BURNS!', '#ff9f1c');
      return amount * 0.35;
    }
    if (amount >= MEMO_BREAK && game.time - this.lastTear > MEMO_COOLDOWN) {
      this.lastTear = game.time;
      this.memos--;
      this.tornAgo = 0;
      game.fx.burst('REJECTED!', boss.body.x, boss.body.y - 78, 1.0, '#ffffff', true);
      game.particles.burst('scrap', boss.body.x, boss.body.y - 40, 8, 220, { color: '#f4f1ea' });
      game.camera.addShake(0.18);
      game.audio.play('paper', 0.8);
      if (this.memos <= 0) this.expose(game, boss);
      return amount * BLOCKED_CHIP;
    }
    boss.blockFlash = 1;
    return 0;
  }

  onDefeat(game: Game, boss: Enemy): void {
    this.memos = 0;
    this.exposed = false;
    this.attack = null;
    this.planes.length = 0;
    this.claims.length = 0;
    if (this.copier && !this.copierDown) {
      const state = COPIERS.get(this.copier);
      if (state) state.progress = 0;
    }
    game.particles.burst('scrap', boss.body.x, boss.body.y - 40, 30, 380, { color: '#f4f1ea' });
    game.particles.burst('confetti', boss.body.x, boss.body.y - 40, 24, 320);
  }

  // ───────────── the attack director ─────────────

  private pick(overtime: boolean): AttackKind {
    if (this.deck.length === 0) {
      const all: AttackKind[] = overtime ? ['drift', 'replyAll', 'pie', 'foreclose'] : ['drift', 'replyAll', 'foreclose'];
      // shuffle, and never open a new deck with the move that closed the last one
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j]!, all[i]!];
      }
      if (all[all.length - 1] === this.lastKind && all.length > 1) all.unshift(all.pop()!);
      this.deck = all;
    }
    const kind = this.deck.pop()!;
    this.lastKind = kind;
    return kind;
  }

  /** Public so tests (and nothing else) can start a specific move. */
  beginAttack(game: Game, boss: Enemy, kind: AttackKind, overtime: boolean): void {
    this.attack = kind;
    this.stage = 'windup';
    this.stageT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    switch (kind) {
      case 'drift':
        game.fx.burst('QUICK REVIEW!', boss.body.x, boss.body.y - 96, 1.2, '#ff5a4e', true);
        game.audio.play('alarm', 0.5);
        this.aimDrift(game, boss);
        break;
      case 'replyAll':
        game.fx.burst('REPLY ALL!', boss.body.x, boss.body.y - 96, 1.25, '#7ee0ff', true);
        game.audio.play('alarm', 0.5);
        break;
      case 'pie':
        game.fx.burst('Q3 PROJECTIONS!', boss.body.x, boss.body.y - 96, 1.3, '#ffd23f', true);
        game.audio.play('bossWalk', 1);
        this.pieRot = Math.random() * TAU;
        game.camera.addShake(0.25);
        break;
      case 'foreclose':
        game.fx.burst('FORECLOSURE!', boss.body.x, boss.body.y - 96, 1.25, '#ff4d6d', true);
        game.audio.play('stamp', 0.9);
        break;
    }
    void overtime;
  }

  private endAttack(overtime: boolean): void {
    this.attack = null;
    this.gap = overtime ? ATTACK_GAP_OVERTIME : ATTACK_GAP;
  }

  private nextStage(stage: Stage): void {
    this.stage = stage;
    this.stageT = 0;
  }

  private runAttack(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    this.stageT += dt;
    switch (this.attack) {
      case 'drift': this.runDrift(game, boss, dt, overtime); break;
      case 'replyAll': this.runReply(game, boss, dt, overtime); break;
      case 'pie': this.runPie(game, boss, dt, overtime); break;
      case 'foreclose': this.runForeclose(game, boss, dt, overtime); break;
      default: break;
    }
  }

  // ── QUICK REVIEW: spin up, then drift across the room bouncing off the walls ──

  private aimDrift(game: Game, boss: Enemy): void {
    const p = game.player.body;
    const dx = p.x - boss.body.x;
    const dy = p.y - boss.body.y;
    const d = Math.hypot(dx, dy) || 1;
    this.driftDirX = dx / d;
    this.driftDirY = dy / d;
  }

  private runDrift(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    if (this.stage === 'windup') {
      b.vx = 0;
      b.vy = 0;
      // keep tracking you until the last quarter second, then the lane is locked
      if (this.stageT < DRIFT_WINDUP - 0.25) this.aimDrift(game, boss);
      boss.facing = Math.atan2(this.driftDirY, this.driftDirX);
      if (Math.random() < dt * 40) game.particles.burst('scrap', b.x, b.y - 10, 1, 140, { color: '#f4f1ea' });
      if (this.stageT >= DRIFT_WINDUP) {
        this.nextStage('go');
        this.driftHit = false;
        this.driftBounces = 0;
        game.audio.play('swipe', 0.7);
        game.camera.addShake(0.2);
      }
      return;
    }
    if (this.stage === 'go') {
      const total = overtime ? DRIFT_TIME * 1.35 : DRIFT_TIME;
      b.vx = this.driftDirX * DRIFT_SPEED;
      b.vy = this.driftDirY * DRIFT_SPEED;
      // bounce off the walls
      const bounds = game.world.bounds;
      const r = boss.type.radius + 6;
      let bounced = false;
      if (b.x < bounds.x0 + r && this.driftDirX < 0) { this.driftDirX = Math.abs(this.driftDirX); bounced = true; }
      if (b.x > bounds.x1 - r && this.driftDirX > 0) { this.driftDirX = -Math.abs(this.driftDirX); bounced = true; }
      if (b.y < bounds.y0 + r && this.driftDirY < 0) { this.driftDirY = Math.abs(this.driftDirY); bounced = true; }
      if (b.y > bounds.y1 - r && this.driftDirY > 0) { this.driftDirY = -Math.abs(this.driftDirY); bounced = true; }
      if (bounced) {
        this.driftBounces++;
        game.camera.addShake(0.3);
        game.particles.burst('dust', b.x, b.y, 8, 180);
        game.audio.play('gong', 0.45, 1.3);
      }
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.035;
        game.particles.burst('scrap', b.x, b.y - 8, 2, 120, { color: '#f4f1ea' });
      }
      // run you over
      const p = game.player;
      if (!this.driftHit && Math.hypot(p.body.x - b.x, p.body.y - b.y) < boss.type.radius + p.body.boundR + 4) {
        this.driftHit = true;
        if (p.hurt(game, 1, boss.type.name)) {
          p.body.applyImpulse(this.driftDirX * 300 * p.body.mass, this.driftDirY * 300 * p.body.mass);
          game.fx.burst('REJECTED!', p.body.x, p.body.y - 50, 1, '#ff5a4e', true);
        }
      }
      if (this.stageT >= total) {
        b.vx *= 0.2;
        b.vy *= 0.2;
        this.nextStage('recover');
        boss.squash = 1;
        game.fx.burst('WHEW...', b.x, b.y - 90, 0.9, '#ffd23f', true);
      }
      return;
    }
    // recover: dizzy, wide open
    b.vx *= 0.9;
    b.vy *= 0.9;
    if (this.stageT >= DRIFT_RECOVER) this.endAttack(overtime);
  }

  // ── REPLY ALL: rings of paper planes, then a spiral in overtime ──

  private runReply(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    const p = game.player.body;
    boss.facing = Math.atan2(p.y - b.y, p.x - b.x);
    if (this.stage === 'windup') {
      if (this.stageT >= 0.8) {
        this.nextStage('go');
        this.waveT = 0;
        this.waveIndex = 0;
        this.spiral = Math.random() * TAU;
      }
      return;
    }
    if (this.stage === 'go') {
      if (!overtime) {
        // two rings, the second turned half a step so its gaps land where the first one's planes were
        const rings = 2;
        this.waveT -= dt;
        if (this.waveT <= 0 && this.waveIndex < rings) {
          const count = 10;
          const base = Math.atan2(p.y - b.y, p.x - b.x) + Math.PI / count + (this.waveIndex % 2) * (Math.PI / count);
          for (let i = 0; i < count; i++) this.fire(game, boss, base + (i * TAU) / count, 0);
          this.waveIndex++;
          this.waveT = 1.0;
          game.audio.play('paper', 0.8);
          game.camera.addShake(0.15);
        }
        if (this.waveIndex >= rings && this.stageT > 1.6) this.nextStage('recover');
      } else {
        // overtime: a three-armed spiral for 2.6 seconds
        this.waveT -= dt;
        this.spiral += dt * 3.2;
        if (this.waveT <= 0) {
          this.waveT = 0.13;
          for (let arm = 0; arm < 3; arm++) this.fire(game, boss, this.spiral + (arm * TAU) / 3, 0);
          game.audio.play('paper', 0.35);
        }
        if (this.stageT > 2.6) this.nextStage('recover');
      }
      return;
    }
    if (this.stageT >= 0.7) this.endAttack(overtime);
  }

  private fire(game: Game, boss: Enemy, angle: number, offset: number): void {
    const b = boss.body;
    this.planes.push({
      x: b.x + Math.cos(angle) * (boss.type.radius + offset),
      y: b.y - 6 + Math.sin(angle) * (boss.type.radius + offset),
      vx: Math.cos(angle) * PLANE_SPEED,
      vy: Math.sin(angle) * PLANE_SPEED,
      life: 4.5,
    });
    void game;
  }

  private updatePlanes(game: Game, dt: number): void {
    if (this.planes.length === 0) return;
    const bounds = game.world.bounds;
    const p = game.player;
    for (let i = this.planes.length - 1; i >= 0; i--) {
      const plane = this.planes[i]!;
      plane.x += plane.vx * dt;
      plane.y += plane.vy * dt;
      plane.life -= dt;
      const out = plane.x < bounds.x0 || plane.x > bounds.x1 || plane.y < bounds.y0 || plane.y > bounds.y1;
      if (plane.life <= 0 || out) {
        this.planes.splice(i, 1);
        continue;
      }
      if (p.alive && Math.hypot(p.body.x - plane.x, p.body.y - plane.y) < p.body.boundR + PLANE_RADIUS) {
        this.planes.splice(i, 1);
        if (p.hurt(game, 1, 'Paper plane')) {
          p.body.applyImpulse(plane.vx * 0.9 * p.body.mass, plane.vy * 0.9 * p.body.mass);
          game.particles.burst('scrap', p.body.x, p.body.y - 20, 6, 160, { color: '#f4f1ea' });
        }
      }
    }
  }

  // ── Q3 PROJECTIONS: a three-slice pie chart sweeps the floor ──

  /** True when a floor point is inside one of the three solid slices (the gaps are safe). */
  inPie(boss: Enemy, x: number, y: number, margin = 0): boolean {
    const dx = x - boss.body.x;
    const dy = y - boss.body.y;
    if (Math.hypot(dx, dy) > PIE_RADIUS + margin) return false;
    const rel = (((Math.atan2(dy, dx) - this.pieRot) % TAU) + TAU) % TAU;
    return Math.floor(rel / (Math.PI / 3)) % 2 === 0;
  }

  private runPie(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    this.pieHitCooldown -= dt;
    if (this.stage === 'windup') {
      if (this.stageT >= PIE_WINDUP) {
        this.nextStage('go');
        game.audio.play('alarm', 0.8);
        game.camera.addShake(0.3);
        game.fx.ring(b.x, b.y, 10, PIE_RADIUS, 0.45, 'rgba(255,210,63,0.9)', 5);
      }
      return;
    }
    if (this.stage === 'go') {
      this.pieRot += PIE_SPIN * dt;
      const p = game.player;
      if (p.alive && this.pieHitCooldown <= 0 && this.inPie(boss, p.body.x, p.body.y, 4)) {
        if (p.hurt(game, 1, 'Pie chart')) {
          this.pieHitCooldown = 0.6;
          game.fx.burst('OFF TARGET!', p.body.x, p.body.y - 50, 1, '#ff5a4e', true);
        }
      }
      if (this.stageT >= PIE_TIME) {
        this.nextStage('recover');
        game.fx.burst('ADJOURNED!', b.x, b.y - 96, 1.0, '#ffd23f', true);
      }
      return;
    }
    if (this.stageT >= 0.8) this.endAttack(overtime);
  }

  // ── FORECLOSURE: SOLD stamps on the things nearest you ──

  private runForeclose(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
    void dt;
    if (this.stage === 'windup') {
      if (this.stageT >= 0.7) {
        this.nextStage('go');
        this.stampObjects(game, boss, overtime ? 4 : 3);
        game.camera.addShake(0.35);
        game.hitStop(0.06);
        game.audio.play('stamp', 1);
      }
      return;
    }
    if (this.stage === 'go') {
      if (this.stageT >= 0.5) this.nextStage('recover');
      return;
    }
    if (this.stageT >= 0.6) this.endAttack(overtime);
  }

  private stampObjects(game: Game, boss: Enemy, count: number): void {
    const p = game.player.body;
    const taken = new Set(this.claims.map((c) => c.object));
    const candidates = game.objects
      .filter((o) => o.alive && !o.held && !o.def.fixed && o.def.throwable && !o.def.consume && o.tipProgress < 0 && !taken.has(o))
      .map((o) => ({ o, d: Math.hypot(o.body.x - p.x, o.body.y - p.y) }))
      .filter((c) => c.d < 520)
      .sort((a, c) => a.d - c.d)
      .slice(0, count);
    for (const { o } of candidates) {
      this.claims.push({ object: o, left: STAMP_SECONDS });
      game.fx.ring(o.body.x, o.body.y, 6, 34, 0.35, 'rgba(255,77,109,0.9)', 3);
    }
    if (candidates.length === 0) game.fx.burst('NOTHING TO SEIZE', boss.body.x, boss.body.y - 96, 0.9, '#ffffff', true);
  }

  private updateClaims(game: Game, dt: number): void {
    for (let i = this.claims.length - 1; i >= 0; i--) {
      const claim = this.claims[i]!;
      const o = claim.object;
      if (!o.alive) {
        this.claims.splice(i, 1);
        continue;
      }
      claim.left -= dt;
      if (claim.left > 0) continue;
      this.claims.splice(i, 1);
      if (o.held) {
        game.fx.burst('DENIED!', o.body.x, o.body.y - 40, 0.9, '#7ee0ff', true);
        continue;
      }
      game.fx.burst('SOLD!', o.body.x, o.body.y - 40, 1.0, '#ff4d6d', true);
      game.particles.burst('smoke', o.body.x, o.body.y - 10, 6, 100);
      game.particles.burst('scrap', o.body.x, o.body.y - 10, 8, 180, { color: '#f4f1ea' });
      game.audio.play('poof', 0.6);
      o.destroy(game);
    }
  }

  // ───────────── the armour loop ─────────────

  private updateArmour(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const copier = this.copier;
    if (copier && !this.copierDown) {
      if (!copier.alive || copier.structural === 'broken') {
        this.copierWrecked(game, boss);
      } else if (copier.health < this.lastHealth) {
        this.lastHealth = copier.health;
        if (this.printing > 0) this.jamIt(game, copier);
      }
    }
    if (this.jam > 0) {
      this.jam -= dt;
      if (this.jam <= 0 && this.copier && !this.copierDown) {
        const state = COPIERS.get(this.copier);
        if (state) state.jammed = false;
        game.fx.burst('BACK ONLINE', this.copier.body.x, this.copier.body.y - 44, 0.8, '#7ee0ff', true);
      }
    }
    if (this.exposed && !this.copierDown && this.jam <= 0 && copier) {
      const seconds = overtime ? PRINT_SECONDS_OVERTIME : PRINT_SECONDS;
      this.printing += dt / seconds;
      const state = COPIERS.get(copier);
      if (state) state.progress = Math.min(1, this.printing);
      this.sparkT -= dt;
      if (this.sparkT <= 0) {
        this.sparkT = 0.12;
        game.particles.burst('spark', copier.body.x, copier.body.y - 22, 1, 90, { color: '#7ee0ff' });
      }
      if (this.printing >= 1) this.reload(game, boss, copier);
    }
    if (this.exposed && this.attack) this.endAttack(overtime);
  }

  private start(game: Game, boss: Enemy): void {
    this.started = true;
    this.memos = this.maxMemos;
    this.gap = 2.4;
    this.copier = this.placeCopier(game, boss);
    if (this.copier) {
      this.lastHealth = this.copier.health;
      COPIERS.set(this.copier, { progress: 0, jammed: false });
    } else {
      this.copierDown = true;
    }
  }

  private expose(game: Game, boss: Enemy): void {
    this.exposed = true;
    this.printing = 0;
    this.attack = null;
    boss.stun = Math.max(boss.stun, STUN_ON_EXPOSE);
    boss.squash = 1;
    game.fx.burst('OUT OF OFFICE!', boss.body.x, boss.body.y - 92, 1.35, '#ffd23f', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 110, 0.5, 'rgba(255,210,63,0.9)', 5);
    game.camera.addShake(0.35);
    game.hitStop(0.08);
    if (this.copierDown) game.hud.banner('NO MORE MEMOS', 'hit him now', 2);
    else game.hud.banner('OUT OF OFFICE', 'hit him before the copier reloads him', 2.4);
  }

  private tearAll(game: Game, boss: Enemy, word: string, color: string): void {
    this.memos = 0;
    this.tornAgo = 0;
    game.fx.burst(word, boss.body.x, boss.body.y - 78, 1.2, color, true);
    game.particles.burst('smoke', boss.body.x, boss.body.y - 40, 8, 120);
    game.particles.burst('spark', boss.body.x, boss.body.y - 40, 12, 260, { color: '#ffb347' });
    this.expose(game, boss);
  }

  private reload(game: Game, boss: Enemy, copier: PhysicsObject): void {
    this.memos = this.maxMemos;
    this.exposed = false;
    this.printing = 0;
    this.reloadedAgo = 0;
    this.gap = 1.8;
    const state = COPIERS.get(copier);
    if (state) state.progress = 0;
    game.fx.burst('RELOADED!', boss.body.x, boss.body.y - 92, 1.0, '#7ee0ff', true);
    game.audio.play('stamp', 0.7);
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      game.particles.burst(
        'scrap',
        copier.body.x + (boss.body.x - copier.body.x) * t,
        copier.body.y - 20 + (boss.body.y - 50 - copier.body.y) * t,
        1, 60, { color: '#f4f1ea' },
      );
    }
  }

  private jamIt(game: Game, copier: PhysicsObject): void {
    this.printing = 0;
    this.jam = JAM_SECONDS;
    const state = COPIERS.get(copier);
    if (state) {
      state.progress = 0;
      state.jammed = true;
    }
    game.fx.burst('PAPER JAM!', copier.body.x, copier.body.y - 46, 1.1, '#ffb347', true);
    game.particles.burst('smoke', copier.body.x, copier.body.y - 22, 8, 90);
    game.camera.addShake(0.2);
  }

  private copierWrecked(game: Game, boss: Enemy): void {
    this.copierDown = true;
    this.printing = 0;
    const copier = this.copier;
    if (copier) {
      const state = COPIERS.get(copier);
      if (state) {
        state.progress = 0;
        state.jammed = true;
      }
      game.fx.burst('OUT OF TONER!', copier.body.x, copier.body.y - 46, 1.3, '#7ee0ff', true);
    }
    boss.rageMult = Math.max(boss.rageMult, 1.25);
    game.hud.banner('OVERTIME', 'the copier is dead', 2.2);
    game.camera.addShake(0.4);
  }

  private placeCopier(game: Game, boss: Enemy): PhysicsObject | null {
    const bounds = game.world.bounds;
    const margin = 76;
    const candidates: Array<[number, number]> = [];
    const w = bounds.x1 - bounds.x0;
    const h = bounds.y1 - bounds.y0;
    for (const fx of [0.12, 0.88]) for (const fy of [0.25, 0.5, 0.75]) candidates.push([bounds.x0 + w * fx, bounds.y0 + h * fy]);
    for (const fx of [0.3, 0.7]) for (const fy of [0.1, 0.9]) candidates.push([bounds.x0 + w * fx, bounds.y0 + h * fy]);
    let best: [number, number] | null = null;
    let bestScore = -Infinity;
    for (const [cx, cy] of candidates) {
      const x = Math.min(bounds.x1 - margin, Math.max(bounds.x0 + margin, cx));
      const y = Math.min(bounds.y1 - margin, Math.max(bounds.y0 + margin, cy));
      let clearance = Infinity;
      for (const o of game.objects) {
        if (!o.alive) continue;
        clearance = Math.min(clearance, Math.hypot(o.body.x - x, o.body.y - y) - o.body.boundR);
      }
      const fromPlayer = Math.hypot(game.player.body.x - x, game.player.body.y - y);
      const fromBoss = Math.hypot(boss.body.x - x, boss.body.y - y);
      const score = Math.min(clearance, 90) * 2 + Math.min(fromPlayer, 420) * 0.4 + Math.min(fromBoss, 300) * 0.2;
      if (clearance >= 34 && score > bestScore) {
        bestScore = score;
        best = [x, y];
      }
    }
    if (!best) return null;
    return game.spawnObject('photocopier', best[0], best[1], 0);
  }

  // ───────────── drawing ─────────────

  drawFloor(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    if (boss.defeated) return;
    const b = boss.body;
    const pulse = 0.55 + 0.45 * Math.sin(time * 14);
    if (this.attack === 'drift' && this.stage === 'windup') this.drawLane(ctx, game, boss, pulse);
    if (this.attack === 'pie' && this.stage !== 'recover') this.drawPie(ctx, b.x, b.y, this.stage === 'go', time, pulse);
    if (this.attack === 'drift' && this.stage === 'go') {
      // scorch lines behind the chair
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - this.driftDirX * 90, b.y - this.driftDirY * 90);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  private drawLane(ctx: Ctx, game: Game, boss: Enemy, pulse: number): void {
    const b = boss.body;
    const bounds = game.world.bounds;
    const r = boss.type.radius + 6;
    // march the lane to the first wall so the bounce is shown too
    let x = b.x;
    let y = b.y;
    let dx = this.driftDirX;
    let dy = this.driftDirY;
    let left = DRIFT_SPEED * DRIFT_TIME * (boss.phaseIndex >= 1 ? 1.35 : 1);
    ctx.lineJoin = 'round';
    for (let leg = 0; leg < 3 && left > 0; leg++) {
      let t = left;
      if (dx > 0) t = Math.min(t, (bounds.x1 - r - x) / dx);
      if (dx < 0) t = Math.min(t, (bounds.x0 + r - x) / dx);
      if (dy > 0) t = Math.min(t, (bounds.y1 - r - y) / dy);
      if (dy < 0) t = Math.min(t, (bounds.y0 + r - y) / dy);
      t = Math.max(0, t);
      const ex = x + dx * t;
      const ey = y + dy * t;
      ctx.fillStyle = `rgba(255, 70, 70, ${(0.16 + 0.12 * pulse) * (leg === 0 ? 1 : 0.6)})`;
      ctx.strokeStyle = `rgba(255, 90, 90, ${0.55 * (leg === 0 ? 1 : 0.6)})`;
      ctx.lineWidth = 2.4;
      const nx = -dy * r * 0.85;
      const ny = dx * r * 0.85;
      ctx.beginPath();
      ctx.moveTo(x + nx, y + ny);
      ctx.lineTo(ex + nx, ey + ny);
      ctx.lineTo(ex - nx, ey - ny);
      ctx.lineTo(x - nx, y - ny);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // chevrons
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * pulse})`;
      ctx.lineWidth = 3;
      for (let k = 1; k * 70 < t; k++) {
        const cx = x + dx * k * 70;
        const cy = y + dy * k * 70;
        ctx.beginPath();
        ctx.moveTo(cx - dx * 10 + dy * 14, cy - dy * 10 - dx * 14);
        ctx.lineTo(cx + dx * 4, cy + dy * 4);
        ctx.lineTo(cx - dx * 10 - dy * 14, cy - dy * 10 + dx * 14);
        ctx.stroke();
      }
      left -= t;
      x = ex;
      y = ey;
      if (dx > 0 && x >= bounds.x1 - r - 0.5) dx = -Math.abs(dx);
      else if (dx < 0 && x <= bounds.x0 + r + 0.5) dx = Math.abs(dx);
      if (dy > 0 && y >= bounds.y1 - r - 0.5) dy = -Math.abs(dy);
      else if (dy < 0 && y <= bounds.y0 + r + 0.5) dy = Math.abs(dy);
    }
  }

  private drawPie(ctx: Ctx, cx: number, cy: number, live: boolean, time: number, pulse: number): void {
    const colors = ['#ff5a8a', '#4ad6e8', '#ffd23f'];
    const labels = ['Q1', 'Q2', 'Q3'];
    const ramp = live ? 1 : Math.min(1, this.stageT / PIE_WINDUP);
    for (let k = 0; k < 3; k++) {
      const a0 = this.pieRot + (k * TAU) / 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, PIE_RADIUS * (live ? 1 : 0.35 + 0.65 * ramp), a0, a0 + Math.PI / 3);
      ctx.closePath();
      ctx.globalAlpha = live ? 0.42 : 0.1 + 0.12 * pulse;
      ctx.fillStyle = colors[k]!;
      ctx.fill();
      ctx.globalAlpha = live ? 0.95 : 0.55 + 0.3 * pulse;
      ctx.strokeStyle = live ? '#ffffff' : colors[k]!;
      ctx.lineWidth = live ? 4 : 2.5;
      ctx.setLineDash(live ? [] : [14, 10]);
      ctx.stroke();
      ctx.setLineDash([]);
      // the label rides the slice
      const mid = a0 + Math.PI / 6;
      ctx.save();
      ctx.translate(cx + Math.cos(mid) * PIE_RADIUS * 0.62, cy + Math.sin(mid) * PIE_RADIUS * 0.62);
      ctx.globalAlpha = live ? 0.95 : 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText(labels[k]!, 0, 0);
      ctx.fillText(labels[k]!, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
    void time;
  }

  drawAir(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    // paper planes
    for (const plane of this.planes) {
      const a = Math.atan2(plane.vy, plane.vx);
      ctx.save();
      ctx.translate(plane.x, plane.y);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(-1, 7, 9, 3, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-9, -7);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-9, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120,130,160,0.8)';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-4, 0);
      ctx.stroke();
      ctx.restore();
    }
    // SOLD stamps with a ticking ring, and the claim lines from the boss
    for (const claim of this.claims) {
      const o = claim.object;
      if (!o.alive) continue;
      const x = o.body.x;
      const y = o.body.y - o.body.z - 6;
      const urgency = 1 - Math.max(0, claim.left) / STAMP_SECONDS;
      ctx.strokeStyle = `rgba(255, 77, 109, ${0.35 + 0.3 * urgency})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -time * 40;
      ctx.beginPath();
      ctx.moveTo(boss.body.x, boss.body.y - 30);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
      const r = o.body.boundR + 12;
      ctx.strokeStyle = o.held ? '#7ee0ff' : '#ff4d6d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - urgency));
      ctx.stroke();
      ctx.save();
      ctx.translate(x, y - r - 12);
      ctx.rotate(-0.22);
      ctx.fillStyle = o.held ? '#1d6d85' : '#c0143c';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fillRect(-23, -10, 46, 20);
      ctx.strokeRect(-23, -10, 46, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(o.held ? 'DENIED' : 'SOLD', 0, 5);
      ctx.restore();
      ctx.textAlign = 'start';
    }
  }
}
