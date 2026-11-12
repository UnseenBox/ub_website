import { INK } from '../../core/constants';
import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { BossScript } from './BossScript';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * MIDNIGHT EXPRESS: "all aboard. no refunds."
 *
 * A FIGHT ABOUT THE TRACK. He runs on rails, and rails are straight lines you can see. His engine is
 * armoured (ARMOURED, 45%), but a train cannot swerve: put something heavy ON THE RAILS in front of
 * him and he DERAILS: a crash, then several seconds flat on his side taking +80%. So the skill is
 * reading where the track is going and getting a chair, table or sofa onto it in time.
 *
 * ATTACKS (telegraphed, shuffled):
 *   EXPRESS   a lane is marked on the floor with a signal lamp that goes from red to green. He pulls
 *             up at one end, the lamp goes green, he thunders the whole length of it. Get off the lane,
 *             or block it.
 *   FREIGHT   the room is cut into lanes; the lit ones are the ones freight cars will sweep along.
 *             The dark lane is the safe one.
 *   BUMPER    a short, sharp ram along a drawn strip.
 * Below a quarter health it is NIGHT EXPRESS: he doubles back for a second pass, more lanes are lit
 * and the derail window is shorter.
 *
 * THE ENTRANCE. A long whistle and a headlight sweeping the room; he rolls in from off the edge, brakes
 * with a shower of sparks and stops in the middle. His first move is an EXPRESS with a long warning, so
 * the lane-and-lamp rule is the first thing you learn.
 */

export const ARMOUR_CHIP = 0.45;
export const DERAILED_BONUS = 1.8;
export const BLOCK_MASS = 8;
const LANE_W = 112;
const RUSH_SPEED = 800;
const BUMP_SPEED = 720;
const BUMP_LENGTH = 340;
const DERAIL_SECONDS = 4.2;
const DERAIL_SECONDS_FINALE = 3.4;
const FREIGHT_LANES = 4;
const CAR_LEN = 150;
const CAR_SPEED = 820;
const GAP = 3.0;
const GAP_OVERTIME = 2.3;
const GAP_FINALE = 1.6;

export type TrainAttack = 'express' | 'freight' | 'bumper';

interface Car { lane: number; pos: number; delay: number; dir: number }

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

export class TrainScript implements BossScript {
  readonly deathText = 'DERAILED!';

  time = 0;
  finale = false;
  /** Seconds flat on his side, taking bonus damage. */
  derailed = 0;
  private tauntAt = -9;
  private tauntedHalf = false;
  private chipAt = -9;
  private gap = 2.5;
  private deck: TrainAttack[] = [];
  private lastKind: TrainAttack | null = null;
  private first = false;

  intro: 'arrive' | 'done' = 'arrive';
  introT = 0;
  private introFromX = 0;

  attack: TrainAttack | null = null;
  stage: 'windup' | 'go' | 'recover' = 'windup';
  stageT = 0;
  // the lane of an express / bumper
  horizontal = true;
  /** Centre of the lane across its width (y when horizontal, x when vertical). */
  laneC = 0;
  dirX = 1;
  dirY = 0;
  private startX = 0;
  private startY = 0;
  private endX = 0;
  private endY = 0;
  private fromX = 0;
  private fromY = 0;
  private hit = false;
  private passes = 1;
  /** Lamp colour, for the drawing code. */
  lamp: 'red' | 'green' = 'red';
  // freight
  cars: Car[] = [];
  live: number[] = [];
  freightH = true;

  get busy(): boolean {
    return this.attack !== null || this.intro !== 'done' || this.derailed > 0;
  }

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    this.updateCars(game, dt);
    if (this.intro !== 'done') {
      this.runIntro(game, boss, dt);
      return;
    }
    if (!this.finale && boss.hp <= boss.maxHp * 0.25) this.startFinale(game, boss);
    const overtime = boss.phaseIndex >= 1 || this.finale;
    if (overtime && !this.tauntedHalf) {
      this.tauntedHalf = true;
      this.taunt(game, boss, 'NIGHT EXPRESS!', '#ffe9a8', true);
    }

    if (this.derailed > 0) {
      this.derailed -= dt;
      boss.body.vx = 0;
      boss.body.vy = 0;
      if (this.derailed <= 0) {
        game.fx.burst('BACK ON TRACK!', boss.body.x, boss.body.y - 100, 1.0, '#ffe9a8', true);
        game.audio.play('whistle', 0.7);
        this.gap = 1.2;
      }
      return;
    }
    if (this.attack && (boss.stun > 0 || boss.shockTimer > 0 || boss.burn > 0 || boss.confuse > 0)) this.endAttack(overtime);
    if (this.attack) {
      this.stageT += dt;
      switch (this.attack) {
        case 'express': this.runExpress(game, boss, dt, overtime); break;
        case 'freight': this.runFreight(game, boss, overtime); break;
        case 'bumper': this.runBumper(game, boss, dt, overtime); break;
      }
    } else if (boss.aware && boss.ai === 'chase' && boss.stun <= 0 && boss.shockTimer <= 0 && boss.burn <= 0) {
      this.gap -= dt;
      if (this.gap <= 0) this.beginAttack(game, boss, this.pick());
    }
  }

  filterDamage(game: Game, boss: Enemy, amount: number, _cause: DamageCause): number {
    if (this.intro !== 'done') {
      boss.blockFlash = 1;
      return 0;
    }
    if (this.derailed > 0) return amount * DERAILED_BONUS;
    boss.blockFlash = 1;
    if (game.time - this.chipAt > 1.3) {
      this.chipAt = game.time;
      game.fx.burst('ARMOURED!', boss.body.x, boss.body.y - 92, 0.8, '#ffe9a8', true);
    }
    return amount * ARMOUR_CHIP;
  }

  onDefeat(game: Game, boss: Enemy): void {
    this.attack = null;
    this.cars.length = 0;
    game.popup('...last stop.', boss.body.x, boss.body.y - 124, '#ffe9a8', 20, 2.4);
  }

  // ───────────── entrance ─────────────

  private runIntro(game: Game, boss: Enemy, dt: number): void {
    this.introT += dt;
    const b = boss.body;
    const bounds = game.world.bounds;
    const cx = (bounds.x0 + bounds.x1) / 2;
    const cy = (bounds.y0 + bounds.y1) / 2 - 10;
    if (this.introT === dt) {
      this.introFromX = bounds.x0 - 140;
      b.x = this.introFromX;
      b.y = cy;
      game.camera.focus(cx, cy, 3.0, 1.05);
      game.audio.play('whistle', 1);
    }
    b.vy = 0;
    b.vx = 0;
    boss.facing = 0;
    const u = Math.min(1, this.introT / 2.0);
    const e = 1 - (1 - u) * (1 - u) * (1 - u);
    b.x = this.introFromX + (cx - this.introFromX) * e;
    b.y = cy;
    if (u < 1 && Math.random() < dt * 25) game.particles.burst('spark', b.x + 30, b.y + 40, 1, 160, { color: '#ffe066' });
    if (u >= 1 && this.introT - dt < 2.0) {
      game.fx.burst('SCREEEECH!', b.x, b.y - 90, 1.2, '#ffe9a8', true);
      game.fx.ring(b.x, b.y, 10, 200, 0.4, 'rgba(255,233,168,0.9)', 5);
      game.audio.play('slide', 0.9);
      game.camera.punchZoom(0.03);
    }
    if (this.introT >= 3.0) {
      game.fx.burst('MIDNIGHT EXPRESS!', b.x, b.y - 104, 1.4, '#ffe9a8', true);
      game.audio.play('whistle', 1);
      game.hitStop(0.05);
      game.hint('BLOCK THE TRACK', 'put something heavy on the rails to derail him', 3.8, 'boss:TrainScript');
      this.taunt(game, boss, pickLine(['All aboard!', 'No refunds!', 'Mind the gap!']), '#ffe9a8', true);
      this.finishIntro(game, boss);
    }
  }

  /** Ends the entrance and starts the fight. Public so a test can skip ahead. */
  finishIntro(game: Game, boss: Enemy, openWithExpress = true): void {
    this.intro = 'done';
    this.introT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    boss.aware = true;
    boss.ai = 'chase';
    boss.aiTimer = 0;
    this.attack = null;
    this.gap = 1.2;
    this.deck = ['bumper', 'freight'];
    if (openWithExpress) {
      this.first = true;
      this.beginAttack(game, boss, 'express');
    }
  }

  // ───────────── director ─────────────

  private pick(): TrainAttack {
    if (this.deck.length === 0) {
      const all: TrainAttack[] = ['express', 'freight', 'bumper'];
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
  beginAttack(game: Game, boss: Enemy, kind: TrainAttack): void {
    this.attack = kind;
    this.stage = 'windup';
    this.stageT = 0;
    this.hit = false;
    boss.body.vx = 0;
    boss.body.vy = 0;
    switch (kind) {
      case 'express':
        this.passes = this.finale ? 2 : 1;
        this.setLane(game, boss);
        game.fx.burst('EXPRESS!', boss.body.x, boss.body.y - 100, 1.2, '#ff9f9f', true);
        game.audio.play('whistle', 0.9);
        this.taunt(game, boss, pickLine(['Track four, now boarding!', 'Stand clear!']));
        break;
      case 'freight':
        this.setFreight(game, boss);
        game.fx.burst('FREIGHT!', boss.body.x, boss.body.y - 100, 1.2, '#ff9f9f', true);
        game.audio.play('alarm', 0.6);
        this.taunt(game, boss, pickLine(['Crossing ahead!', 'Delayed freight!']));
        break;
      case 'bumper':
        this.aimBumper(game, boss);
        game.fx.burst('BUMPER!', boss.body.x, boss.body.y - 100, 1.2, '#ff9f9f', true);
        game.audio.play('alarm', 0.5);
        this.taunt(game, boss, pickLine(['Honk!', 'Coming through!']));
        break;
    }
  }

  private endAttack(overtime: boolean): void {
    this.attack = null;
    this.lamp = 'red';
    this.gap = this.finale ? GAP_FINALE : overtime ? GAP_OVERTIME : GAP;
  }

  private startFinale(game: Game, boss: Enemy): void {
    this.finale = true;
    this.attack = null;
    this.gap = 1.0;
    boss.rageMult = Math.max(boss.rageMult, 1.2);
    game.hud.hint('NIGHT EXPRESS', 'he doubles back', 2.6);
    game.fx.burst('NIGHT EXPRESS!', boss.body.x, boss.body.y - 112, 1.5, '#ffe9a8', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 170, 0.6, 'rgba(255,233,168,0.9)', 6);
    game.fx.flash('#ffe9a8', 0.12);
    game.audio.play('whistle', 1);
    this.taunt(game, boss, 'LAST TRAIN OF THE NIGHT!', '#ffe9a8', true);
  }

  private taunt(game: Game, boss: Enemy, line: string, color = '#ffe9a8', force = false): void {
    if (!force && game.time - this.tauntAt < 2.8) return;
    this.tauntAt = game.time;
    game.popup(line, boss.body.x, boss.body.y - 132, color, 19, 2.2);
  }

  // ───────────── EXPRESS ─────────────

  /** Chooses a lane through the player and the ends he will run between. */
  private setLane(game: Game, boss: Enemy): void {
    const bounds = game.world.bounds;
    const p = game.player.body;
    this.horizontal = Math.random() < 0.65;
    if (this.horizontal) {
      this.laneC = Math.min(bounds.y1 - LANE_W / 2, Math.max(bounds.y0 + LANE_W / 2, p.y));
      const fromLeft = Math.random() < 0.5;
      this.dirX = fromLeft ? 1 : -1;
      this.dirY = 0;
      this.startX = fromLeft ? bounds.x0 + 50 : bounds.x1 - 50;
      this.endX = fromLeft ? bounds.x1 - 50 : bounds.x0 + 50;
      this.startY = this.endY = this.laneC;
    } else {
      this.laneC = Math.min(bounds.x1 - LANE_W / 2, Math.max(bounds.x0 + LANE_W / 2, p.x));
      const fromTop = Math.random() < 0.5;
      this.dirX = 0;
      this.dirY = fromTop ? 1 : -1;
      this.startY = fromTop ? bounds.y0 + 50 : bounds.y1 - 50;
      this.endY = fromTop ? bounds.y1 - 50 : bounds.y0 + 50;
      this.startX = this.endX = this.laneC;
    }
    this.fromX = boss.body.x;
    this.fromY = boss.body.y;
    this.lamp = 'red';
  }

  private runExpress(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    const warn = this.first ? 2.3 : this.finale ? 1.4 : 1.7;
    if (this.stage === 'windup') {
      // he pulls up at the end of the track, then the lamp goes green
      const pull = Math.min(1, this.stageT / 0.6);
      const e = 1 - (1 - pull) * (1 - pull);
      b.x = this.fromX + (this.startX - this.fromX) * e;
      b.y = this.fromY + (this.startY - this.fromY) * e;
      b.vx = 0;
      b.vy = 0;
      boss.facing = Math.atan2(this.dirY, this.dirX);
      if (this.stageT >= warn - 0.35 && this.lamp === 'red') {
        this.lamp = 'green';
        game.audio.play('whistle', 1);
      }
      if (this.stageT >= warn) {
        this.stage = 'go';
        this.stageT = 0;
        this.first = false;
        this.hit = false;
        game.audio.play('slide', 0.8);
      }
      return;
    }
    if (this.stage === 'go') {
      b.vx = this.dirX * RUSH_SPEED;
      b.vy = this.dirY * RUSH_SPEED;
      if (Math.random() < dt * 40) game.particles.burst('spark', b.x - this.dirX * 40, b.y - this.dirY * 40 + 30, 1, 180, { color: '#ffe066' });
      this.hitPlayerOnLane(game, boss, 320);
      if (this.checkDerail(game, boss)) return;
      const past = (b.x - this.endX) * this.dirX + (b.y - this.endY) * this.dirY;
      if (past >= 0) {
        b.vx = 0;
        b.vy = 0;
        b.x = Math.min(game.world.bounds.x1 - 20, Math.max(game.world.bounds.x0 + 20, b.x));
        b.y = Math.min(game.world.bounds.y1 - 20, Math.max(game.world.bounds.y0 + 20, b.y));
        game.fx.burst('SCREEECH!', b.x, b.y - 90, 1.0, '#ffe9a8', true);
        game.audio.play('slide', 0.8);
        game.camera.addShake(0.12);
        boss.squash = 1;
        if (this.passes > 1) {
          // doubles back along the same track
          this.passes--;
          this.dirX = -this.dirX;
          this.dirY = -this.dirY;
          this.startX = this.endX;
          this.startY = this.endY;
          this.endX = this.dirX !== 0 ? (this.dirX > 0 ? game.world.bounds.x1 - 50 : game.world.bounds.x0 + 50) : this.startX;
          this.endY = this.dirY !== 0 ? (this.dirY > 0 ? game.world.bounds.y1 - 50 : game.world.bounds.y0 + 50) : this.startY;
          this.fromX = b.x;
          this.fromY = b.y;
          this.stage = 'windup';
          this.stageT = 0;
          this.lamp = 'red';
          this.hit = false;
          return;
        }
        this.stage = 'recover';
        this.stageT = 0;
      }
      return;
    }
    b.vx = 0;
    b.vy = 0;
    if (this.stageT > 1.0) this.endAttack(overtime);
  }

  private hitPlayerOnLane(game: Game, boss: Enemy, push: number): void {
    const p = game.player;
    if (!p.alive || this.hit) return;
    const b = boss.body;
    const along = (p.body.x - b.x) * this.dirX + (p.body.y - b.y) * this.dirY;
    const perp = this.dirX !== 0 ? p.body.y - b.y : p.body.x - b.x;
    if (Math.abs(perp) < boss.type.radius * 0.75 + p.body.boundR * 0.5 && along > -boss.type.radius && along < boss.type.radius + 30) {
      if (p.hurt(game, 1, 'Train')) {
        this.hit = true;
        const side = perp >= 0 ? 1 : -1;
        const nx = this.dirX !== 0 ? 0 : side;
        const ny = this.dirX !== 0 ? side : 0;
        p.body.applyImpulse((nx * push + this.dirX * 120) * p.body.mass, (ny * push + this.dirY * 120) * p.body.mass);
      }
    }
  }

  /** A heavy thing on the rails in front of him derails him. */
  private checkDerail(game: Game, boss: Enemy): boolean {
    const b = boss.body;
    for (const o of game.objects) {
      if (!o.alive || o.held || o.def.fixed || o.body.mass < BLOCK_MASS || o.body.z > 14) continue;
      const along = (o.body.x - b.x) * this.dirX + (o.body.y - b.y) * this.dirY;
      const perp = this.dirX !== 0 ? o.body.y - b.y : o.body.x - b.x;
      if (along > 0 && along < boss.type.radius + o.body.boundR + 10 && Math.abs(perp) < boss.type.radius * 0.9 + o.body.boundR * 0.5) {
        this.derail(game, boss, o.body.x, o.body.y);
        return true;
      }
    }
    return false;
  }

  /** Derails him. Public so a test can trigger it directly. */
  derail(game: Game, boss: Enemy, x: number, y: number): void {
    this.attack = null;
    this.cars.length = 0;
    this.lamp = 'red';
    this.derailed = this.finale ? DERAIL_SECONDS_FINALE : DERAIL_SECONDS;
    boss.body.vx = 0;
    boss.body.vy = 0;
    boss.squash = 1;
    game.fx.burst('DERAILED!', boss.body.x, boss.body.y - 100, 1.5, '#ffd23f', true);
    game.fx.ring(x, y, 10, 160, 0.5, 'rgba(255,210,63,0.95)', 6);
    game.particles.burst('spark', x, y - 10, 8, 340, { color: '#ffe066' });
    game.particles.burst('scrap', x, y - 10, 6, 260, { color: '#9aa8bb' });
    game.audio.play('explosion', 0.9);
    game.hitStop(0.1);
    game.camera.addShake(0.2);
    game.hud.hint('DERAILED', 'hit him while he is down', 2.4);
    this.taunt(game, boss, pickLine(['Ow, my axle!', 'That was NOT on the timetable!']), '#ffe9a8', true);
  }

  // ───────────── FREIGHT ─────────────

  private setFreight(game: Game, boss: Enemy): void {
    void boss;
    this.freightH = Math.random() < 0.5;
    const lit = this.finale ? 3 : 2;
    const all = Array.from({ length: FREIGHT_LANES }, (_, i) => i);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j]!, all[i]!];
    }
    this.live = all.slice(0, lit).sort((a, c) => a - c);
    // keep the lane under the player lit so it matters at least once
    const p = game.player.body;
    const bounds = game.world.bounds;
    const span = this.freightH ? (bounds.y1 - bounds.y0) / FREIGHT_LANES : (bounds.x1 - bounds.x0) / FREIGHT_LANES;
    const pl = Math.max(0, Math.min(FREIGHT_LANES - 1, Math.floor(((this.freightH ? p.y - bounds.y0 : p.x - bounds.x0)) / span)));
    if (!this.live.includes(pl)) this.live[0] = pl;
    this.cars = [];
  }

  laneRect(game: Game, lane: number): { x0: number; y0: number; x1: number; y1: number } {
    const b = game.world.bounds;
    if (this.freightH) {
      const h = (b.y1 - b.y0) / FREIGHT_LANES;
      return { x0: b.x0, x1: b.x1, y0: b.y0 + lane * h, y1: b.y0 + (lane + 1) * h };
    }
    const w = (b.x1 - b.x0) / FREIGHT_LANES;
    return { x0: b.x0 + lane * w, x1: b.x0 + (lane + 1) * w, y0: b.y0, y1: b.y1 };
  }

  private runFreight(game: Game, boss: Enemy, overtime: boolean): void {
    boss.body.vx = 0;
    boss.body.vy = 0;
    const warn = this.finale ? 1.3 : 1.7;
    if (this.stage === 'windup' && this.stageT >= warn) {
      this.stage = 'go';
      this.stageT = 0;
      const fromStart = Math.random() < 0.5;
      this.live.forEach((lane, i) => {
        this.cars.push({ lane, pos: fromStart ? -CAR_LEN : 1e9, delay: i * 0.12, dir: fromStart ? 1 : -1 });
      });
      game.audio.play('whistle', 1);
      return;
    }
    if (this.stage === 'go' && this.cars.length === 0) {
      this.stage = 'recover';
      this.stageT = 0;
    }
    if (this.stage === 'recover' && this.stageT > 0.8) this.endAttack(overtime);
  }

  private updateCars(game: Game, dt: number): void {
    if (this.cars.length === 0) return;
    const bounds = game.world.bounds;
    const len = this.freightH ? bounds.x1 - bounds.x0 : bounds.y1 - bounds.y0;
    const p = game.player;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i]!;
      if (c.delay > 0) {
        c.delay -= dt;
        continue;
      }
      if (c.pos === 1e9) c.pos = len;
      c.pos += c.dir * CAR_SPEED * dt;
      if (c.pos > len + CAR_LEN || c.pos < -CAR_LEN * 2) {
        this.cars.splice(i, 1);
        continue;
      }
      const r = this.laneRect(game, c.lane);
      const a0 = this.freightH ? r.x0 + c.pos : r.y0 + c.pos;
      const a1 = a0 + CAR_LEN;
      const q = this.freightH ? p.body.x : p.body.y;
      const inLane = this.freightH ? p.body.y > r.y0 && p.body.y < r.y1 : p.body.x > r.x0 && p.body.x < r.x1;
      if (p.alive && inLane && q + p.body.boundR * 0.3 > a0 && q - p.body.boundR * 0.3 < a1) {
        if (p.hurt(game, 1, 'Freight car')) {
          if (this.freightH) p.body.applyImpulse(c.dir * 120 * p.body.mass, 0);
          else p.body.applyImpulse(0, c.dir * 120 * p.body.mass);
        }
      }
    }
  }

  // ───────────── BUMPER ─────────────

  private aimBumper(game: Game, boss: Enemy): void {
    const dx = game.player.body.x - boss.body.x;
    const dy = game.player.body.y - boss.body.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.dirX = dx >= 0 ? 1 : -1;
      this.dirY = 0;
    } else {
      this.dirX = 0;
      this.dirY = dy >= 0 ? 1 : -1;
    }
    this.horizontal = this.dirX !== 0;
    this.fromX = boss.body.x;
    this.fromY = boss.body.y;
  }

  private runBumper(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    const windup = this.finale ? 0.7 : 0.9;
    if (this.stage === 'windup') {
      b.vx = 0;
      b.vy = 0;
      if (this.stageT < windup - 0.25) this.aimBumper(game, boss);
      boss.facing = Math.atan2(this.dirY, this.dirX);
      if (this.stageT >= windup) {
        this.stage = 'go';
        this.stageT = 0;
        this.hit = false;
        game.audio.play('whistle', 0.9);
      }
      return;
    }
    if (this.stage === 'go') {
      b.vx = this.dirX * BUMP_SPEED;
      b.vy = this.dirY * BUMP_SPEED;
      this.hitPlayerOnLane(game, boss, 260);
      if (this.checkDerail(game, boss)) return;
      const travelled = Math.hypot(b.x - this.fromX, b.y - this.fromY);
      if (travelled >= BUMP_LENGTH || this.stageT > 0.9) {
        b.vx = 0;
        b.vy = 0;
        boss.squash = 0.8;
        this.stage = 'recover';
        this.stageT = 0;
      }
      return;
    }
    b.vx = 0;
    b.vy = 0;
    void dt;
    if (this.stageT > 0.9) this.endAttack(overtime);
  }

  // ───────────── drawing ─────────────

  drawFloor(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    if (boss.defeated) return;
    const bounds = game.world.bounds;
    const b = boss.body;
    const pulse = 0.55 + 0.45 * Math.sin(time * 12);
    // the express lane: rails, sleepers and the lamp
    if (this.attack === 'express' && this.stage !== 'recover' && this.intro === 'done') {
      const green = this.lamp === 'green' || this.stage === 'go';
      const col = green ? '255, 90, 70' : '255, 190, 80';
      ctx.fillStyle = `rgba(${col}, ${green ? 0.22 : 0.1 + 0.08 * pulse})`;
      if (this.horizontal) ctx.fillRect(bounds.x0, this.laneC - LANE_W / 2, bounds.x1 - bounds.x0, LANE_W);
      else ctx.fillRect(this.laneC - LANE_W / 2, bounds.y0, LANE_W, bounds.y1 - bounds.y0);
      ctx.strokeStyle = `rgba(${col}, 0.8)`;
      ctx.lineWidth = 3;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        if (this.horizontal) {
          ctx.moveTo(bounds.x0, this.laneC + side * (LANE_W / 2 - 8));
          ctx.lineTo(bounds.x1, this.laneC + side * (LANE_W / 2 - 8));
        } else {
          ctx.moveTo(this.laneC + side * (LANE_W / 2 - 8), bounds.y0);
          ctx.lineTo(this.laneC + side * (LANE_W / 2 - 8), bounds.y1);
        }
        ctx.stroke();
      }
      ctx.lineWidth = 5;
      ctx.setLineDash([6, 26]);
      ctx.beginPath();
      if (this.horizontal) {
        ctx.moveTo(bounds.x0, this.laneC);
        ctx.lineTo(bounds.x1, this.laneC);
      } else {
        ctx.moveTo(this.laneC, bounds.y0);
        ctx.lineTo(this.laneC, bounds.y1);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // the lamp at the far end
      const lx = this.horizontal ? this.endX : this.laneC;
      const ly = this.horizontal ? this.laneC : this.endY;
      ctx.beginPath();
      ctx.arc(lx, ly, 15, 0, TAU);
      ctx.fillStyle = green ? '#e5383b' : '#ffb347';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // freight lanes
    if (this.attack === 'freight') {
      for (let lane = 0; lane < FREIGHT_LANES; lane++) {
        const r = this.laneRect(game, lane);
        const isLive = this.live.includes(lane);
        if (isLive) {
          ctx.fillStyle = this.stage === 'go' ? 'rgba(255, 90, 70, 0.22)' : `rgba(255, 90, 70, ${0.1 + 0.12 * pulse})`;
          ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
          ctx.strokeStyle = `rgba(255, 130, 110, ${0.6 + 0.3 * pulse})`;
          ctx.lineWidth = 3;
          ctx.setLineDash([16, 12]);
          ctx.strokeRect(r.x0 + 2, r.y0 + 2, r.x1 - r.x0 - 4, r.y1 - r.y0 - 4);
          ctx.setLineDash([]);
        } else {
          ctx.fillStyle = 'rgba(143, 220, 143, 0.1)';
          ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
        }
      }
    }
    // bumper strip
    if (this.attack === 'bumper' && this.stage === 'windup') {
      ctx.fillStyle = `rgba(255, 90, 70, ${0.12 + 0.12 * pulse})`;
      ctx.strokeStyle = `rgba(255, 130, 110, ${0.6 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      const w = boss.type.radius * 1.5;
      const x0 = this.dirX !== 0 ? b.x : b.x - w / 2;
      const y0 = this.dirY !== 0 ? b.y : b.y - w / 2;
      const ww = this.dirX !== 0 ? BUMP_LENGTH * this.dirX : w;
      const hh = this.dirY !== 0 ? BUMP_LENGTH * this.dirY : w;
      ctx.fillRect(x0, y0, ww, hh);
      ctx.strokeRect(x0, y0, ww, hh);
    }
  }

  drawAir(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    if (boss.defeated) return;
    const b = boss.body;
    // freight cars
    for (const c of this.cars) {
      if (c.delay > 0) continue;
      const r = this.laneRect(game, c.lane);
      const a0 = this.freightH ? r.x0 + c.pos : r.y0 + c.pos;
      const pad = 10;
      const x = this.freightH ? a0 : r.x0 + pad;
      const y = this.freightH ? r.y0 + pad : a0;
      const w = this.freightH ? CAR_LEN : r.x1 - r.x0 - pad * 2;
      const h = this.freightH ? r.y1 - r.y0 - pad * 2 : CAR_LEN;
      ctx.fillStyle = '#5c4a6e';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = '#3a2c48';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (this.freightH) {
        for (let k = 1; k < 4; k++) {
          ctx.moveTo(x + (w * k) / 4, y);
          ctx.lineTo(x + (w * k) / 4, y + h);
        }
      } else {
        for (let k = 1; k < 4; k++) {
          ctx.moveTo(x, y + (h * k) / 4);
          ctx.lineTo(x + w, y + (h * k) / 4);
        }
      }
      ctx.stroke();
    }
    if (this.derailed > 0) {
      for (let i = 0; i < 3; i++) {
        const a = time * 4 + (i * TAU) / 3;
        const sx = b.x + Math.cos(a) * 26;
        const sy = b.y - 88 + Math.sin(a) * 6;
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
