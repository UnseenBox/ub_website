import { INK } from '../../core/constants';
import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { PhysicsObject } from '../PhysicsObject';
import type { BossScript } from './BossScript';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * THE MOWER MANIAC: "the grass is always greener. you are the grass."
 *
 * A FIGHT ABOUT FUEL. He runs on petrol and the tank is on a gauge over his head. It drains all
 * the time and every pass costs more. When it hits zero he STALLS: stuck, coughing, taking 50%
 * extra. To avoid that he drives to one of the JERRY CANS left around the room and drinks it.
 * Cans are the whole game: grab one first and he cannot refuel from it; throw one at him and the
 * explosion drains the tank on the spot (and hurts); with no cans left he stalls again and again.
 * Fire and explosions stall him instantly.
 *
 * ATTACKS (telegraphed, shuffled):
 *   TRIPLE PASS  striped lanes are marked one at a time; he slides to the edge and charges the length of the room.
 *   BLADE SPIN   he stops and spins the blades in a growing ring while creeping toward you; dizzy afterwards.
 *   BLOWBACK     the leaf blower: a cone of wind shoves you and the furniture away; used to set up a pass.
 * Below a quarter health it is FULL THROTTLE: more lanes, faster, and the tank drains faster too.
 *
 * THE ENTRANCE. Engine roar, and he slides in through the door in a long drift across the room,
 * stopping dead in a spray of clippings, and revs. Three jerry cans are rolled into the corners.
 */

export const STALL_BONUS = 1.5;
export const FUEL_MAX = 100;
const DRAIN = 4.2;
const DRAIN_FINALE = 6.5;
const PASS_COST = 9;
const STALL_SECONDS = 4.2;
const REFUEL_BELOW = 38;
const LANE_WIDTH = 100;
const LANE_WARN = 0.85;
const PASS_SPEED = 720;
const SPIN_RADIUS = 135;
const SPIN_WINDUP = 0.9;
const SPIN_TIME = 2.2;
const BLOW_RANGE = 430;
const BLOW_HALF = 0.62;
const BLOW_WINDUP = 0.9;
const BLOW_TIME = 1.6;
const CAN_COUNT = 3;

export type MowerAttack = 'pass' | 'spin' | 'blow';

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

export class MowerScript implements BossScript {
  readonly deathText = 'RETIRED!';

  time = 0;
  fuel = FUEL_MAX;
  /** Seconds left of being stalled. */
  stall = 0;
  finale = false;
  cans: PhysicsObject[] = [];
  private tauntAt = -9;
  private tauntedHalf = false;
  private gap = 2.5;
  private deck: MowerAttack[] = [];
  private lastKind: MowerAttack | null = null;

  // ── entrance ──
  intro: 'drift' | 'rev' | 'done' = 'drift';
  introT = 0;
  private introTarget: { x: number; y: number } | null = null;
  private revved = false;

  // ── attacks ──
  attack: MowerAttack | null = null;
  stage: 'windup' | 'go' | 'recover' = 'windup';
  stageT = 0;
  // pass
  lanes = 0;
  private lanesDone = 0;
  laneY = 0;
  laneDir = 1;
  private laneHit = false;
  private placed = false;
  private laneFrom = { x: 0, y: 0 };
  // spin
  spinAngle = 0;
  private spinHitCd = 0;
  // blow
  blowAngle = 0;
  // refuel
  refuelTarget: PhysicsObject | null = null;

  get busy(): boolean {
    return this.attack !== null || this.intro !== 'done' || this.refuelTarget !== null || this.stall > 0;
  }

  get pose(): 'idle' | 'drift' | 'spin' | 'stalled' {
    if (this.stall > 0) return 'stalled';
    if (this.intro === 'drift') return 'drift';
    if (this.attack === 'spin' && this.stage === 'go') return 'spin';
    return 'idle';
  }

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    this.spinHitCd -= dt;
    if (this.intro !== 'done') {
      this.runIntro(game, boss, dt);
      return;
    }
    this.cans = this.cans.filter((c) => c.alive && c.structural !== 'broken');
    if (!this.finale && boss.hp <= boss.maxHp * 0.25) this.startFinale(game, boss);
    const overtime = boss.phaseIndex >= 1 || this.finale;
    if (overtime && !this.tauntedHalf) {
      this.tauntedHalf = true;
      this.taunt(game, boss, 'BACKFIRE!', '#ffcf8a', true);
    }

    // a stalled engine
    if (this.stall > 0) {
      this.stall -= dt;
      boss.body.vx = 0;
      boss.body.vy = 0;
      if (this.stall <= 0) {
        this.fuel = this.cans.length > 0 ? 55 : 30;
        game.fx.burst('RESTARTED!', boss.body.x, boss.body.y - 90, 1.0, '#ffcf8a', true);
        game.audio.play('slide', 0.7);
        this.gap = 1.6;
      }
      return;
    }

    // the tank
    this.fuel -= dt * (this.finale ? DRAIN_FINALE : DRAIN);
    if (this.fuel <= 0) {
      this.stallOut(game, boss, 'OUT OF GAS!');
      return;
    }

    if (this.attack && (boss.stun > 0 || boss.shockTimer > 0 || boss.burn > 0 || boss.confuse > 0)) this.endAttack(overtime);

    if (this.refuelTarget) {
      this.runRefuel(game, boss, dt);
      return;
    }
    if (this.attack) {
      this.stageT += dt;
      switch (this.attack) {
        case 'pass': this.runPass(game, boss, dt, overtime); break;
        case 'spin': this.runSpin(game, boss, dt, overtime); break;
        case 'blow': this.runBlow(game, boss, dt, overtime); break;
      }
      return;
    }
    // low on fuel: go and find a can
    if (this.fuel < REFUEL_BELOW && this.cans.length > 0 && boss.stun <= 0) {
      this.refuelTarget = this.nearestCan(boss);
      if (this.refuelTarget) {
        game.fx.burst('REFUEL!', boss.body.x, boss.body.y - 92, 1.1, '#ffcf8a', true);
        this.taunt(game, boss, pickLine(['Running on fumes!', 'Where did I park that can?']), '#ffe0b0', true);
        return;
      }
    }
    if (boss.aware && boss.ai === 'chase' && boss.stun <= 0 && boss.shockTimer <= 0 && boss.burn <= 0) {
      this.gap -= dt;
      if (this.gap <= 0) this.beginAttack(game, boss, this.pick());
    }
  }

  filterDamage(game: Game, boss: Enemy, amount: number, cause: DamageCause): number {
    if (this.intro !== 'done') {
      boss.blockFlash = 1;
      return 0;
    }
    // fire and petrol blasts empty the tank on the spot
    if ((cause.type === 'fire' || cause.type === 'explosion') && this.stall <= 0) {
      this.stallOut(game, boss, 'TANK IGNITED!');
      return amount * 1.2;
    }
    if (this.stall > 0) return amount * STALL_BONUS;
    return amount;
  }

  onDefeat(game: Game, boss: Enemy): void {
    this.attack = null;
    this.refuelTarget = null;
    game.popup('...sputter...', boss.body.x, boss.body.y - 124, '#ffe0b0', 20, 2.4);
  }

  // ───────────── entrance ─────────────

  private runIntro(game: Game, boss: Enemy, dt: number): void {
    this.introT += dt;
    const b = boss.body;
    if (this.intro === 'drift') {
      if (!this.introTarget) {
        const bounds = game.world.bounds;
        const cx = (bounds.x0 + bounds.x1) / 2;
        const cy = (bounds.y0 + bounds.y1) / 2;
        this.introTarget = { x: b.x + (cx - b.x) * 0.7, y: b.y + (cy - b.y) * 0.7 };
        game.camera.focus(b.x, b.y, 2.2, 1.07);
        game.audio.play('slide', 1);
      }
      const t = this.introTarget;
      const dx = t.x - b.x;
      const dy = t.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(560, d * 3.2);
      b.vx = (dx / d) * sp;
      b.vy = (dy / d) * sp;
      boss.facing = Math.atan2(dy, dx);
      if (Math.random() < dt * 6) game.particles.burst('dust', b.x, b.y + 6, 1, 100, { color: '#9ad06b' });
      if ((d < 26 && this.introT > 0.9) || this.introT > 4) {
        b.vx = 0;
        b.vy = 0;
        this.intro = 'rev';
        this.introT = 0;
        this.revved = false;
        this.placeCans(game, boss);
      }
      return;
    }
    b.vx = 0;
    b.vy = 0;
    boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
    if (!this.revved && this.introT >= 0.4) {
      this.revved = true;
      game.fx.burst('VROOOM!', b.x, b.y - 96, 1.5, '#ffcf8a', true);
      game.fx.ring(b.x, b.y, 10, 230, 0.5, 'rgba(255,207,138,0.9)', 5);
      game.audio.play('slide', 1);
      game.camera.punchZoom(0.03);
      game.hitStop(0.05);
      this.taunt(game, boss, pickLine(['Time for a trim!', "Don't mind the noise.", 'Your lawn is a disgrace.']), '#ffe0b0', true);
    }
    if (this.introT >= 1.4) this.finishIntro(game, boss);
  }

  /** Ends the entrance and starts the fight. Public so a test can skip ahead. */
  finishIntro(game: Game, boss: Enemy, openWithPass = true): void {
    this.intro = 'done';
    this.introT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    boss.aware = true;
    boss.ai = 'chase';
    boss.aiTimer = 0;
    this.fuel = FUEL_MAX;
    this.attack = null;
    this.gap = 1.4;
    if (this.cans.length === 0) this.placeCans(game, boss);
    this.deck = ['blow', 'spin'];
    if (openWithPass) this.beginAttack(game, boss, 'pass');
  }

  /** Jerry cans go in the corners, away from him. */
  private placeCans(game: Game, boss: Enemy): void {
    const bounds = game.world.bounds;
    const corners: Array<[number, number]> = [
      [bounds.x0 + 70, bounds.y0 + 70], [bounds.x1 - 70, bounds.y0 + 70],
      [bounds.x0 + 70, bounds.y1 - 70], [bounds.x1 - 70, bounds.y1 - 70],
    ];
    corners.sort((a, c) => Math.hypot(c[0] - boss.body.x, c[1] - boss.body.y) - Math.hypot(a[0] - boss.body.x, a[1] - boss.body.y));
    this.cans = [];
    for (const [x, y] of corners.slice(0, CAN_COUNT)) {
      const can = game.spawnObject('jerrycan', x, y, Math.random() * TAU);
      if (can) {
        this.cans.push(can);
        game.fx.ring(x, y, 4, 40, 0.4, 'rgba(255,207,138,0.9)', 3);
      }
    }
    game.fx.burst('FUEL!', boss.body.x, boss.body.y - 118, 0.9, '#ffcf8a', true);
  }

  // ───────────── fuel ─────────────

  private stallOut(game: Game, boss: Enemy, word: string): void {
    this.stall = STALL_SECONDS;
    this.fuel = 0;
    this.attack = null;
    this.refuelTarget = null;
    boss.body.vx = 0;
    boss.body.vy = 0;
    boss.squash = 1;
    game.fx.burst(word, boss.body.x, boss.body.y - 96, 1.4, '#ff9f1c', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 110, 0.5, 'rgba(255,159,28,0.9)', 5);
    game.particles.burst('smoke', boss.body.x, boss.body.y - 40, 4, 100);
    game.hitStop(0.08);
    game.audio.play('hiss', 1);
    game.hud.banner('STALLED', 'hit him now', 2.2);
    this.taunt(game, boss, pickLine(["Come on, come on...", 'Not now!', 'Choke... choke...']), '#ffe0b0', true);
  }

  private nearestCan(boss: Enemy): PhysicsObject | null {
    let best: PhysicsObject | null = null;
    let bestD = Infinity;
    for (const c of this.cans) {
      if (c.held) continue;
      const d = Math.hypot(c.body.x - boss.body.x, c.body.y - boss.body.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  private runRefuel(game: Game, boss: Enemy, dt: number): void {
    const can = this.refuelTarget;
    const b = boss.body;
    if (!can || !can.alive || can.held || can.structural === 'broken') {
      // somebody took it: pick another, or give up and carry on
      this.refuelTarget = this.nearestCan(boss);
      if (!this.refuelTarget) {
        b.vx = 0;
        b.vy = 0;
        game.fx.burst('HEY! THAT WAS MINE!', b.x, b.y - 92, 1.0, '#ffe0b0', true);
      }
      return;
    }
    const dx = can.body.x - b.x;
    const dy = can.body.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    boss.facing = Math.atan2(dy, dx);
    const speed = this.finale ? 340 : 280;
    b.vx = (dx / d) * speed;
    b.vy = (dy / d) * speed;
    if (Math.random() < dt * 4) game.particles.burst('dust', b.x, b.y + 6, 1, 90);
    if (d < boss.type.radius + 14) {
      b.vx = 0;
      b.vy = 0;
      can.destroy(game);
      this.cans = this.cans.filter((c) => c !== can);
      this.refuelTarget = null;
      this.fuel = FUEL_MAX;
      boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * 0.04);
      game.fx.burst('GLUG GLUG!', b.x, b.y - 92, 1.2, '#ffcf8a', true);
      game.audio.play('plop', 0.9);
      this.gap = 1.2;
    }
  }

  // ───────────── director ─────────────

  private pick(): MowerAttack {
    if (this.deck.length === 0) {
      const all: MowerAttack[] = ['pass', 'spin', 'blow'];
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j]!, all[i]!];
      }
      if (all[all.length - 1] === this.lastKind) all.unshift(all.pop()!);
      this.deck = all;
    }
    const kind = this.deck.pop()!;
    this.lastKind = kind;
    return kind;
  }

  /** Public so tests can start a specific move. */
  beginAttack(game: Game, boss: Enemy, kind: MowerAttack): void {
    this.attack = kind;
    this.stage = 'windup';
    this.stageT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    switch (kind) {
      case 'pass':
        this.lanes = this.finale ? 5 : boss.phaseIndex >= 1 ? 4 : 3;
        this.lanesDone = 0;
        game.fx.burst('TRIPLE PASS!', boss.body.x, boss.body.y - 98, 1.25, '#ff6b5a', true);
        game.audio.play('slide', 0.8);
        this.pickLane(game, boss);
        this.taunt(game, boss, pickLine(['Stripes, stripes, stripes!', 'Stay off the grass!']));
        break;
      case 'spin':
        game.fx.burst('BLADE SPIN!', boss.body.x, boss.body.y - 98, 1.25, '#ffcf8a', true);
        this.spinAngle = 0;
        this.taunt(game, boss, pickLine(['Round and round!', 'Whirr!']));
        break;
      case 'blow':
        game.fx.burst('BLOWBACK!', boss.body.x, boss.body.y - 98, 1.25, '#9fd8ff', true);
        this.blowAngle = Math.atan2(game.player.body.y - boss.body.y, game.player.body.x - boss.body.x);
        boss.facing = this.blowAngle;
        this.taunt(game, boss, pickLine(['Blow it away!', 'Clearing the leaves.']));
        break;
    }
  }

  private endAttack(overtime: boolean): void {
    this.attack = null;
    this.gap = this.finale ? 1.3 : overtime ? 2.2 : 3.0;
  }

  private startFinale(game: Game, boss: Enemy): void {
    this.finale = true;
    this.attack = null;
    this.gap = 1.0;
    boss.rageMult = Math.max(boss.rageMult, 1.2);
    this.fuel = Math.max(this.fuel, 70);
    game.hud.banner('FULL THROTTLE', 'five lanes, faster', 2.6);
    game.fx.burst('FULL THROTTLE!', boss.body.x, boss.body.y - 112, 1.5, '#ff6b5a', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 170, 0.6, 'rgba(255,150,100,0.9)', 6);
    game.fx.flash('#ffcf8a', 0.12);
    game.audio.play('alarm', 1);
    this.taunt(game, boss, 'NO BRAKES!', '#ffd0a0', true);
  }

  private taunt(game: Game, boss: Enemy, line: string, color = '#ffe0b0', force = false): void {
    if (!force && game.time - this.tauntAt < 2.8) return;
    this.tauntAt = game.time;
    game.popup(line, boss.body.x, boss.body.y - 130, color, 19, 2.2);
  }

  // ───────────── TRIPLE PASS ─────────────

  private pickLane(game: Game, boss: Enemy): void {
    const bounds = game.world.bounds;
    const p = game.player.body;
    // the first lane is on you; later ones are spread so you have to keep moving
    const y = this.lanesDone === 0
      ? p.y
      : bounds.y0 + 90 + Math.random() * (bounds.y1 - bounds.y0 - 180);
    this.laneY = Math.min(bounds.y1 - LANE_WIDTH / 2, Math.max(bounds.y0 + LANE_WIDTH / 2, y));
    // charge away from whichever side he is nearer
    const mid = (bounds.x0 + bounds.x1) / 2;
    this.laneDir = boss.body.x < mid ? 1 : -1;
    this.laneHit = false;
    this.laneFrom = { x: boss.body.x, y: boss.body.y };
    this.placed = false;
  }

  private runPass(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    const bounds = game.world.bounds;
    const speedScale = this.finale ? 1.2 : overtime ? 1.1 : 1;
    if (this.stage === 'windup') {
      // appear at the start of the lane while it is being marked
      const startX = this.laneDir > 0 ? bounds.x0 + boss.type.radius + 10 : bounds.x1 - boss.type.radius - 10;
      if (!this.placed) {
        // he is simply there: sliding him across the room would shove you out of the lane
        this.placed = true;
        game.fx.ring(this.laneFrom.x, this.laneFrom.y, 6, 70, 0.3, 'rgba(255,207,138,0.8)', 3);
        b.x = startX;
        b.y = this.laneY;
        game.fx.ring(b.x, b.y, 6, 70, 0.3, 'rgba(255,207,138,0.8)', 3);
      }
      b.vx = 0;
      b.vy = 0;
      boss.facing = this.laneDir > 0 ? 0 : Math.PI;
      if (this.stageT >= LANE_WARN) {
        this.stage = 'go';
        this.stageT = 0;
        this.fuel -= PASS_COST;
        game.audio.play('slide', 1);
      }
      return;
    }
    if (this.stage === 'go') {
      b.vx = this.laneDir * PASS_SPEED * speedScale;
      b.vy = 0;
      b.y = this.laneY;
      if (Math.random() < dt * 10) game.particles.burst('scrap', b.x, b.y + 6, 1, 110, { color: '#9ad06b' });
      const p = game.player;
      if (!this.laneHit && p.alive && Math.abs(p.body.y - this.laneY) < LANE_WIDTH / 2 + p.body.boundR * 0.3 && Math.abs(p.body.x - b.x) < boss.type.radius + p.body.boundR + 8) {
        this.laneHit = true;
        if (p.hurt(game, 1, 'Mower')) p.body.applyImpulse(this.laneDir * 280 * p.body.mass, -120 * p.body.mass);
      }
      const end = this.laneDir > 0 ? b.x >= bounds.x1 - boss.type.radius - 6 : b.x <= bounds.x0 + boss.type.radius + 6;
      if (end) {
        b.vx = 0;
        this.lanesDone++;
        game.camera.addShake(0.1);
        game.particles.burst('dust', b.x, b.y, 3, 140);
        if (this.lanesDone >= this.lanes) {
          this.stage = 'recover';
          this.stageT = 0;
        } else {
          this.stage = 'windup';
          this.stageT = 0;
          this.pickLane(game, boss);
        }
      }
      return;
    }
    b.vx = 0;
    b.vy = 0;
    if (this.stageT > 1.0) this.endAttack(overtime);
  }

  // ───────────── BLADE SPIN ─────────────

  private runSpin(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    if (this.stage === 'windup') {
      b.vx = 0;
      b.vy = 0;
      if (this.stageT >= SPIN_WINDUP) {
        this.stage = 'go';
        this.stageT = 0;
        game.audio.play('slide', 1);
        this.fuel -= PASS_COST;
      }
      return;
    }
    if (this.stage === 'go') {
      this.spinAngle += dt * 14;
      const p = game.player;
      const dx = p.body.x - b.x;
      const dy = p.body.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const creep = this.finale ? 200 : 160;
      b.vx = (dx / d) * creep;
      b.vy = (dy / d) * creep;
      if (Math.random() < dt * 14) game.particles.burst('scrap', b.x + Math.cos(this.spinAngle) * SPIN_RADIUS, b.y + Math.sin(this.spinAngle) * SPIN_RADIUS, 1, 110, { color: '#9ad06b' });
      if (p.alive && this.spinHitCd <= 0 && d < SPIN_RADIUS + p.body.boundR * 0.4 && p.hurt(game, 1, 'Mower blades')) {
        this.spinHitCd = 0.7;
        p.body.applyImpulse((dx / d) * 300 * p.body.mass, (dy / d) * 300 * p.body.mass);
      }
      if (this.stageT >= SPIN_TIME) {
        this.stage = 'recover';
        this.stageT = 0;
        b.vx = 0;
        b.vy = 0;
        boss.squash = 1;
        game.fx.burst('DIZZY...', b.x, b.y - 90, 0.9, '#ffe0b0', true);
      }
      return;
    }
    b.vx = 0;
    b.vy = 0;
    if (this.stageT > 1.1) this.endAttack(overtime);
  }

  // ───────────── BLOWBACK ─────────────

  private runBlow(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    if (this.stage === 'windup') {
      if (this.stageT >= BLOW_WINDUP) {
        this.stage = 'go';
        this.stageT = 0;
        game.audio.play('hiss', 1);
      }
      return;
    }
    if (this.stage === 'go') {
      const push = (body: { x: number; y: number; mass: number; applyImpulse(x: number, y: number): void }, accel: number): void => {
        const dx = body.x - b.x;
        const dy = body.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d > BLOW_RANGE || d < 1) return;
        let da = Math.atan2(dy, dx) - this.blowAngle;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) > BLOW_HALF) return;
        const f = 1 - d / BLOW_RANGE * 0.6;
        body.applyImpulse(Math.cos(this.blowAngle) * accel * f * dt * body.mass, Math.sin(this.blowAngle) * accel * f * dt * body.mass);
      };
      push(game.player.body, 760);
      for (const o of game.objects) {
        if (!o.alive || o.held || o.def.fixed) continue;
        push(o.body, 900);
        o.body.wake();
      }
      if (Math.random() < dt * 12) game.particles.burst('dust', b.x + Math.cos(this.blowAngle) * 80, b.y + Math.sin(this.blowAngle) * 80, 1, 200, { color: '#dff6ff' });
      if (this.stageT >= BLOW_TIME) {
        this.stage = 'recover';
        this.stageT = 0;
      }
      return;
    }
    if (this.stageT > 0.7) this.endAttack(overtime);
  }

  // ───────────── drawing ─────────────

  drawFloor(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    if (boss.defeated) return;
    const b = boss.body;
    const bounds = game.world.bounds;
    const pulse = 0.55 + 0.45 * Math.sin(time * 12);
    // striped lane for the next pass
    if (this.attack === 'pass' && this.stage !== 'recover') {
      const live = this.stage === 'go';
      const y0 = this.laneY - LANE_WIDTH / 2;
      ctx.fillStyle = live ? 'rgba(255, 90, 70, 0.3)' : `rgba(255, 90, 70, ${0.12 + 0.12 * pulse})`;
      ctx.fillRect(bounds.x0, y0, bounds.x1 - bounds.x0, LANE_WIDTH);
      ctx.strokeStyle = `rgba(255, 130, 110, ${live ? 0.9 : 0.55 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(bounds.x0, y0, bounds.x1 - bounds.x0, LANE_WIDTH);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 3;
      for (let x = bounds.x0 + 40; x < bounds.x1 - 20; x += 90) {
        const cx = this.laneDir > 0 ? x : bounds.x1 - (x - bounds.x0);
        ctx.beginPath();
        ctx.moveTo(cx - this.laneDir * 12, this.laneY - 16);
        ctx.lineTo(cx + this.laneDir * 8, this.laneY);
        ctx.lineTo(cx - this.laneDir * 12, this.laneY + 16);
        ctx.stroke();
      }
    }
    // blade spin ring
    if (this.attack === 'spin' && this.stage !== 'recover') {
      const live = this.stage === 'go';
      const r = SPIN_RADIUS * (live ? 1 : 0.3 + 0.7 * Math.min(1, this.stageT / SPIN_WINDUP));
      ctx.fillStyle = live ? 'rgba(255, 90, 70, 0.28)' : `rgba(255, 140, 90, ${0.08 + 0.08 * pulse})`;
      ctx.strokeStyle = live ? 'rgba(255,255,255,0.9)' : 'rgba(255, 170, 120, 0.8)';
      ctx.lineWidth = live ? 4 : 2.5;
      ctx.setLineDash(live ? [] : [14, 10]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      if (live) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        for (let k = 0; k < 3; k++) {
          const a = this.spinAngle + (k * TAU) / 3;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r);
          ctx.stroke();
        }
      }
    }
    // leaf-blower cone
    if (this.attack === 'blow' && this.stage !== 'recover') {
      const live = this.stage === 'go';
      ctx.fillStyle = live ? 'rgba(180, 225, 255, 0.35)' : `rgba(150, 210, 255, ${0.1 + 0.1 * pulse})`;
      ctx.strokeStyle = live ? 'rgba(255,255,255,0.9)' : 'rgba(150, 215, 255, 0.8)';
      ctx.lineWidth = live ? 4 : 2.5;
      ctx.setLineDash(live ? [] : [14, 10]);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.arc(b.x, b.y, BLOW_RANGE, this.blowAngle - BLOW_HALF, this.blowAngle + BLOW_HALF);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // the jerry cans: mark them so the fuel game is readable
    for (const c of this.cans) {
      ctx.strokeStyle = `rgba(255, 207, 138, ${0.55 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(c.body.x, c.body.y, 30, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // the dash to refuel
    if (this.refuelTarget && this.refuelTarget.alive) {
      ctx.strokeStyle = `rgba(255, 207, 138, ${0.5 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(this.refuelTarget.body.x, this.refuelTarget.body.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawAir(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    void game;
    if (boss.defeated || this.intro === 'drift') return;
    const b = boss.body;
    // the fuel gauge
    const w = 70;
    const x = b.x - w / 2;
    const y = b.y - 112;
    ctx.fillStyle = 'rgba(16, 12, 20, 0.85)';
    ctx.fillRect(x - 3, y - 3, w + 6, 12);
    const f = Math.max(0, this.fuel / FUEL_MAX);
    ctx.fillStyle = f < 0.3 ? '#ff5a4e' : f < 0.6 ? '#ffc94d' : '#9be564';
    ctx.fillRect(x, y, w * f, 6);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 3, y - 3, w + 6, 12);
    ctx.fillStyle = '#ffe0b0';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FUEL', b.x, y - 6);
    ctx.textAlign = 'start';
    if (this.stall > 0) {
      for (let i = 0; i < 3; i++) {
        const a = time * 4 + (i * TAU) / 3;
        const sx = b.x + Math.cos(a) * 26;
        const sy = b.y - 82 + Math.sin(a) * 6;
        ctx.fillStyle = '#ffd23f';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const rr = k % 2 === 0 ? 5 : 2.2;
          const aa = (k * Math.PI) / 5 - Math.PI / 2;
          ctx.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }
}
