import { INK } from '../../core/constants';
import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { BossScript } from './BossScript';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * THE VACUUMASAURUS: "65 million years of dust. zero survivors."
 *
 * A FIGHT ON A LEAD. He runs off the mains. A power cord runs from a wall socket to his back and
 * you can see the plug. While he is PLUGGED IN he is at full power: only 60% of hits count. Hit
 * the plug (a thrown object through the socket) and he is UNPLUGGED: no suction, no attacks, and
 * he drags himself back toward the wall at a crawl, taking +40% all the way. He plugs back in on
 * arrival, then needs a breather before you can pull it again.
 *
 * ATTACKS (telegraphed, shuffled):
 *   INHALE      a cone pulls you and the room toward his mouth. Everything small that reaches it is
 *               swallowed into the DUST BAG (shown on his back).
 *   SPIT        the bag empties: everything he swallowed, fired at you in a fan. Feed him a lot and it hurts.
 *   CORD WHIP   he cracks the lead round him in a sweeping arc.
 * Below a quarter health it is FULL SUCTION: a 360 degree pull, bigger spit, two whips.
 *
 * THE ENTRANCE. The lights flicker, a whine winds up, and he rolls in unspooling the cord from the
 * wall behind him. His first move is an INHALE, so you see what the cone does.
 */

export const PLUGGED_ARMOUR = 0.6;
export const UNPLUGGED_BONUS = 1.4;
const SOCKET_HIT = 38;
const REPLUG_COOLDOWN = 7;
const CRAWL_BACK = 100;
const CONE_RANGE = 420;
const CONE_HALF = 0.55;
const FULL_RANGE = 380;
const MOUTH = 74;
const INHALE_WINDUP = 1.0;
const INHALE_TIME = 2.6;
const WHIP_REACH = 250;
const WHIP_WINDUP = 0.95;
const WHIP_SPEED = 2.2;
const WHIP_ARC = 2.1;
const BAG_CAP = 6;
const GAP = 3.2;
const GAP_OVERTIME = 2.3;
const GAP_FINALE = 1.3;

export type VacuumAttack = 'inhale' | 'spit' | 'whip';

interface Swallowed { id: string }

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

export class VacuumScript implements BossScript {
  readonly deathText = 'EXTINCT!';

  time = 0;
  finale = false;
  private tauntAt = -9;
  private tauntedHalf = false;
  private gap = 2.5;
  private deck: VacuumAttack[] = [];
  private lastKind: VacuumAttack | null = null;
  private bypass = false;

  // ── the lead ──
  socketX = 0;
  socketY = 0;
  plugged = true;
  /** Seconds before it can be pulled again after he plugs back in. */
  private replugCd = 0;
  /** Seconds spent unplugged, for the crawl. */
  unplugged = 0;

  // ── the bag ──
  bag: Swallowed[] = [];

  // ── entrance ──
  intro: 'roll' | 'whine' | 'done' = 'roll';
  introT = 0;
  private introTarget: { x: number; y: number } | null = null;
  private whined = false;

  // ── attacks ──
  attack: VacuumAttack | null = null;
  stage: 'windup' | 'go' | 'recover' = 'windup';
  stageT = 0;
  aim = 0;
  private whips = 0;
  whipAngle = 0;
  private whipFrom = 0;
  private whipTo = 0;
  private whipHit = false;
  private spitDone = false;
  private spat: Array<{ o: import('../PhysicsObject').PhysicsObject; hit: boolean }> = [];
  private mouthHitCd = 0;

  get busy(): boolean {
    return this.attack !== null || this.intro !== 'done' || !this.plugged;
  }

  get pose(): 'idle' | 'inhale' | 'dead' {
    if (this.attack === 'inhale' && this.stage !== 'recover') return 'inhale';
    if (!this.plugged) return 'dead';
    return 'idle';
  }

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    this.mouthHitCd -= dt;
    if (this.intro !== 'done') {
      this.runIntro(game, boss, dt);
      return;
    }
    this.replugCd -= dt;
    this.updateSpat(game);
    if (!this.finale && boss.hp <= boss.maxHp * 0.25) this.startFinale(game, boss);
    const overtime = boss.phaseIndex >= 1 || this.finale;
    if (overtime && !this.tauntedHalf) {
      this.tauntedHalf = true;
      this.taunt(game, boss, 'SECONDS?!', '#d6f0c8', true);
    }

    this.checkPlug(game, boss);

    // unplugged: crawl back to the wall, helpless
    if (!this.plugged) {
      this.unplugged += dt;
      this.attack = null;
      const b = boss.body;
      const dx = this.socketX - b.x;
      const dy = this.socketY - b.y;
      const d = Math.hypot(dx, dy) || 1;
      boss.facing = Math.atan2(dy, dx);
      b.vx = (dx / d) * CRAWL_BACK;
      b.vy = (dy / d) * CRAWL_BACK;
      boss.walkPhase += dt * 4;
      if (d < boss.type.radius + 30) {
        b.vx = 0;
        b.vy = 0;
        this.plugged = true;
        this.replugCd = REPLUG_COOLDOWN;
        this.gap = 1.6;
        game.fx.burst('PLUGGED IN!', b.x, b.y - 96, 1.2, '#d6f0c8', true);
        game.audio.play('zap', 0.5);
        this.taunt(game, boss, pickLine(['Back in business.', 'Power! Unlimited power!']), '#d6f0c8', true);
      }
      return;
    }

    if (this.attack && (boss.stun > 0 || boss.shockTimer > 0 || boss.burn > 0 || boss.confuse > 0)) this.endAttack(overtime);
    if (this.attack) {
      this.stageT += dt;
      boss.body.vx = 0;
      boss.body.vy = 0;
      switch (this.attack) {
        case 'inhale': this.runInhale(game, boss, dt, overtime); break;
        case 'spit': this.runSpit(game, boss, dt, overtime); break;
        case 'whip': this.runWhip(game, boss, dt, overtime); break;
      }
    } else if (boss.aware && boss.ai === 'chase' && boss.stun <= 0 && boss.shockTimer <= 0 && boss.burn <= 0) {
      this.gap -= dt;
      if (this.gap <= 0) this.beginAttack(game, boss, this.pick());
    }
  }

  filterDamage(game: Game, boss: Enemy, amount: number, _cause: DamageCause): number {
    if (this.bypass) return amount;
    if (this.intro !== 'done') {
      boss.blockFlash = 1;
      return 0;
    }
    return amount * (this.plugged ? PLUGGED_ARMOUR : UNPLUGGED_BONUS);
  }

  onDefeat(game: Game, boss: Enemy): void {
    this.attack = null;
    this.plugged = false;
    game.popup('...wheeeeeeze...', boss.body.x, boss.body.y - 124, '#d6f0c8', 20, 2.4);
  }

  // ───────────── entrance ─────────────

  private runIntro(game: Game, boss: Enemy, dt: number): void {
    this.introT += dt;
    const b = boss.body;
    if (!this.introTarget) {
      const bounds = game.world.bounds;
      const cx = (bounds.x0 + bounds.x1) / 2;
      const cy = (bounds.y0 + bounds.y1) / 2;
      this.introTarget = { x: b.x + (cx - b.x) * 0.7, y: b.y + (cy - b.y) * 0.7 };
      // the socket is in the wall behind where he came from
      this.placeSocket(game, b.x, b.y);
      game.camera.focus(b.x, b.y, 2.4, 1.07);
      game.audio.play('hiss', 1);
    }
    if (this.intro === 'roll') {
      const t = this.introTarget;
      const dx = t.x - b.x;
      const dy = t.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(240, d * 1.8 + 30);
      b.vx = (dx / d) * sp;
      b.vy = (dy / d) * sp;
      boss.facing = Math.atan2(dy, dx);
      boss.walkPhase += dt * 6;
      if ((d < 24 && this.introT > 0.9) || this.introT > 4.5) {
        b.vx = 0;
        b.vy = 0;
        this.intro = 'whine';
        this.introT = 0;
        this.whined = false;
      }
      return;
    }
    b.vx = 0;
    b.vy = 0;
    boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
    if (!this.whined && this.introT >= 0.4) {
      this.whined = true;
      game.fx.burst('VRRRRRRR!', b.x, b.y - 98, 1.5, '#d6f0c8', true);
      game.fx.ring(b.x, b.y, 10, 240, 0.5, 'rgba(214,240,200,0.9)', 5);
      game.audio.play('hiss', 1);
      game.camera.punchZoom(0.03);
      game.hitStop(0.05);
      game.hud.banner('PULL THE PLUG', 'throw something at the plug on the wall', 3.2);
      this.taunt(game, boss, pickLine(["I'll suck the life out of this room.", 'What a lovely mess.', 'Dust. Delicious dust.']), '#e6f7da', true);
    }
    if (this.introT >= 1.4) this.finishIntro(game, boss);
  }

  /** Ends the entrance and starts the fight. Public so a test can skip ahead. */
  finishIntro(game: Game, boss: Enemy, openWithInhale = true): void {
    if (this.socketX === 0 && this.socketY === 0) this.placeSocket(game, boss.body.x, boss.body.y);
    this.intro = 'done';
    this.introT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    boss.aware = true;
    boss.ai = 'chase';
    boss.aiTimer = 0;
    this.plugged = true;
    this.attack = null;
    this.gap = 1.2;
    this.deck = ['whip', 'spit'];
    if (openWithInhale) this.beginAttack(game, boss, 'inhale');
  }

  private placeSocket(game: Game, fromX: number, fromY: number): void {
    const bounds = game.world.bounds;
    const cy = (bounds.y0 + bounds.y1) / 2;
    // on the wall he came in by, so the cord trails behind him
    const left = fromX < (bounds.x0 + bounds.x1) / 2;
    this.socketX = left ? bounds.x0 + 22 : bounds.x1 - 22;
    this.socketY = Math.min(bounds.y1 - 90, Math.max(bounds.y0 + 90, fromY * 0.5 + cy * 0.5));
  }

  // ───────────── the plug ─────────────

  private checkPlug(game: Game, boss: Enemy): void {
    if (!this.plugged || this.replugCd > 0) return;
    const hit = game.objects.find((o) => o.alive && o.thrownByPlayer && o.body.speed() > 160 && Math.hypot(o.body.x - this.socketX, o.body.y - this.socketY) < SOCKET_HIT + o.body.boundR);
    if (!hit) return;
    this.plugged = false;
    this.unplugged = 0;
    this.attack = null;
    boss.squash = 1;
    boss.body.vx = 0;
    boss.body.vy = 0;
    game.fx.burst('UNPLUGGED!', boss.body.x, boss.body.y - 98, 1.4, '#ffd23f', true);
    game.fx.ring(this.socketX, this.socketY, 8, 80, 0.4, 'rgba(255,210,63,0.9)', 4);
    game.particles.burst('spark', this.socketX, this.socketY, 4, 220, { color: '#ffe066' });
    game.audio.play('zap', 0.8);
    game.hitStop(0.07);
    game.hud.banner('UNPLUGGED', 'no suction: hit him while he crawls back', 2.4);
    this.taunt(game, boss, pickLine(['NO! My power!', 'Who pulled the plug?!']), '#ffe9a8', true);
  }

  // ───────────── director ─────────────

  private pick(): VacuumAttack {
    if (this.deck.length === 0) {
      const all: VacuumAttack[] = ['inhale', 'whip', 'spit'];
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j]!, all[i]!];
      }
      if (all[all.length - 1] === this.lastKind) all.unshift(all.pop()!);
      this.deck = all;
    }
    let kind = this.deck.pop()!;
    // nothing to spit: inhale instead so the bag fills
    if (kind === 'spit' && this.bag.length === 0) kind = 'inhale';
    this.lastKind = kind;
    return kind;
  }

  /** Public so tests can start a specific move. */
  beginAttack(game: Game, boss: Enemy, kind: VacuumAttack): void {
    this.attack = kind;
    this.stage = 'windup';
    this.stageT = 0;
    this.aim = Math.atan2(game.player.body.y - boss.body.y, game.player.body.x - boss.body.x);
    boss.facing = this.aim;
    boss.body.vx = 0;
    boss.body.vy = 0;
    switch (kind) {
      case 'inhale':
        game.fx.burst(this.finale ? 'FULL SUCTION!' : 'INHALE!', boss.body.x, boss.body.y - 98, 1.25, '#d6f0c8', true);
        game.audio.play('hiss', 0.8);
        this.taunt(game, boss, pickLine(['Come closer...', 'It sucks to be you.']));
        break;
      case 'spit':
        game.fx.burst('SPIT!', boss.body.x, boss.body.y - 98, 1.25, '#ffb38a', true);
        this.spitDone = false;
        this.taunt(game, boss, pickLine(['Bag is full!', 'Take it back!']));
        break;
      case 'whip':
        game.fx.burst('CORD WHIP!', boss.body.x, boss.body.y - 98, 1.25, '#ffe066', true);
        this.whips = 0;
        this.setupWhip(game, boss);
        this.taunt(game, boss, pickLine(['Crack!', 'Mind the lead!']));
        break;
    }
  }

  private endAttack(overtime: boolean): void {
    this.attack = null;
    this.gap = this.finale ? GAP_FINALE : overtime ? GAP_OVERTIME : GAP;
  }

  private startFinale(game: Game, boss: Enemy): void {
    this.finale = true;
    this.attack = null;
    this.gap = 1.0;
    boss.rageMult = Math.max(boss.rageMult, 1.2);
    game.hud.banner('FULL SUCTION', 'a 360 degree pull', 2.6);
    game.fx.burst('FULL SUCTION!', boss.body.x, boss.body.y - 112, 1.5, '#d6f0c8', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 170, 0.6, 'rgba(214,240,200,0.9)', 6);
    game.fx.flash('#d6f0c8', 0.12);
    game.audio.play('alarm', 1);
    this.taunt(game, boss, 'EVERYTHING GOES!', '#e6f7da', true);
  }

  private taunt(game: Game, boss: Enemy, line: string, color = '#e6f7da', force = false): void {
    if (!force && game.time - this.tauntAt < 2.8) return;
    this.tauntAt = game.time;
    game.popup(line, boss.body.x, boss.body.y - 132, color, 19, 2.2);
  }

  // ───────────── INHALE ─────────────

  private runInhale(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    if (this.stage === 'windup') {
      this.aim = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
      boss.facing = this.aim;
      if (this.stageT >= INHALE_WINDUP) {
        this.stage = 'go';
        this.stageT = 0;
        game.audio.play('hiss', 1);
      }
      return;
    }
    if (this.stage === 'go') {
      const full = this.finale;
      const range = full ? FULL_RANGE : CONE_RANGE;
      const inCone = (x: number, y: number): boolean => {
        const dx = x - b.x;
        const dy = y - b.y;
        const d = Math.hypot(dx, dy);
        if (d > range || d < 1) return false;
        if (full) return true;
        let da = Math.atan2(dy, dx) - this.aim;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        return Math.abs(da) < CONE_HALF;
      };
      const pull = (body: { x: number; y: number; mass: number; applyImpulse(x: number, y: number): void }, accel: number): void => {
        const dx = b.x - body.x;
        const dy = b.y - body.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = 1 - d / range * 0.7;
        body.applyImpulse((dx / d) * accel * f * dt * body.mass, (dy / d) * accel * f * dt * body.mass);
      };
      const p = game.player;
      if (p.alive && inCone(p.body.x, p.body.y)) {
        pull(p.body, 620);
        const d = Math.hypot(p.body.x - b.x, p.body.y - b.y);
        if (d < MOUTH && this.mouthHitCd <= 0 && p.hurt(game, 1, 'Vacuum')) {
          this.mouthHitCd = 0.9;
          p.body.applyImpulse(-Math.cos(this.aim) * 340 * p.body.mass, -Math.sin(this.aim) * 340 * p.body.mass);
          game.fx.burst('GULP!', p.body.x, p.body.y - 50, 0.9, '#d6f0c8', true);
        }
      }
      for (const o of [...game.objects]) {
        if (!o.alive || o.held || o.def.fixed) continue;
        if (!inCone(o.body.x, o.body.y)) continue;
        pull(o.body, 1700);
        o.body.wake();
        if (Math.hypot(o.body.x - b.x, o.body.y - b.y) < boss.type.radius + o.body.boundR + 24 && this.bag.length < BAG_CAP && o.def.throwable) {
          this.bag.push({ id: o.def.id });
          o.destroy(game);
          game.audio.play('plop', 0.5);
          game.fx.burst('SLURP!', b.x, b.y - 80, 0.8, '#d6f0c8', true);
        }
      }
      if (this.stageT >= INHALE_TIME) {
        this.stage = 'recover';
        this.stageT = 0;
      }
      return;
    }
    if (this.stageT > 0.8) this.endAttack(overtime);
  }

  // ───────────── SPIT ─────────────

  private runSpit(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    void dt;
    const b = boss.body;
    if (this.stage === 'windup') {
      this.aim = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
      boss.facing = this.aim;
      if (this.stageT >= 0.95) {
        this.stage = 'go';
        this.stageT = 0;
      }
      return;
    }
    if (this.stage === 'go') {
      if (!this.spitDone) {
        this.spitDone = true;
        const items = this.bag.splice(0, this.bag.length);
        const n = Math.max(items.length, this.finale ? 5 : 3);
        game.audio.play('explosion', 0.5);
        game.fx.ring(b.x, b.y, 8, 120, 0.35, 'rgba(255,180,120,0.9)', 4);
        for (let i = 0; i < n; i++) {
          const a = this.aim + (i - (n - 1) / 2) * 0.28;
          const id = items[i]?.id ?? 'book';
          const o = game.spawnObject(id, b.x + Math.cos(a) * (boss.type.radius + 18), b.y - 6 + Math.sin(a) * (boss.type.radius + 18), Math.random() * TAU);
          if (!o) continue;
          o.body.vx = Math.cos(a) * 640;
          o.body.vy = Math.sin(a) * 640;
          o.body.wake();
          this.spat.push({ o, hit: false });
        }
      }
      if (this.stageT >= 0.5) {
        this.stage = 'recover';
        this.stageT = 0;
      }
      return;
    }
    if (this.stageT > 0.9) this.endAttack(overtime);
  }

  /** Whatever he spat out hurts you if it reaches you at speed, whatever it is. */
  private updateSpat(game: Game): void {
    const p = game.player;
    for (let i = this.spat.length - 1; i >= 0; i--) {
      const s = this.spat[i]!;
      if (!s.o.alive || s.o.body.speed() < 140) {
        this.spat.splice(i, 1);
        continue;
      }
      if (!s.hit && p.alive && Math.hypot(p.body.x - s.o.body.x, p.body.y - s.o.body.y) < p.body.boundR + s.o.body.boundR + 4) {
        s.hit = true;
        if (p.hurt(game, 1, 'Spat out')) p.body.applyImpulse(s.o.body.vx * 0.4 * p.body.mass, s.o.body.vy * 0.4 * p.body.mass);
      }
    }
  }

  // ───────────── CORD WHIP ─────────────

  private setupWhip(game: Game, boss: Enemy): void {
    const a = Math.atan2(game.player.body.y - boss.body.y, game.player.body.x - boss.body.x);
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.whipFrom = a - (dir * WHIP_ARC) / 2;
    this.whipTo = a + (dir * WHIP_ARC) / 2;
    this.whipAngle = this.whipFrom;
    this.whipHit = false;
  }

  private runWhip(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    const total = this.finale ? 2 : 1;
    if (this.stage === 'windup') {
      if (this.stageT >= WHIP_WINDUP) {
        this.stage = 'go';
        this.stageT = 0;
        game.audio.play('swipe', 0.9);
      }
      return;
    }
    if (this.stage === 'go') {
      const dir = this.whipTo > this.whipFrom ? 1 : -1;
      this.whipAngle += dir * WHIP_SPEED * (this.finale ? 1.25 : 1) * dt;
      const done = dir > 0 ? this.whipAngle >= this.whipTo : this.whipAngle <= this.whipTo;
      const p = game.player;
      if (!this.whipHit && p.alive) {
        const lx = Math.cos(this.whipAngle);
        const ly = Math.sin(this.whipAngle);
        const vx = p.body.x - b.x;
        const vy = p.body.y - b.y;
        const along = vx * lx + vy * ly;
        const across = Math.abs(vx * -ly + vy * lx);
        if (along > 40 && along < WHIP_REACH + 20 && across < 30 + p.body.boundR * 0.4 && p.hurt(game, 1, 'Cord whip')) {
          this.whipHit = true;
          p.body.applyImpulse(-ly * dir * 300 * p.body.mass, lx * dir * 300 * p.body.mass);
        }
      }
      if (done) {
        this.whips++;
        if (this.whips < total) {
          this.stage = 'windup';
          this.stageT = WHIP_WINDUP * 0.4;
          this.setupWhip(game, boss);
        } else {
          this.stage = 'recover';
          this.stageT = 0;
        }
      }
      return;
    }
    if (this.stageT > 0.8) this.endAttack(overtime);
  }

  // ───────────── drawing ─────────────

  drawFloor(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    if (boss.defeated) return;
    void game;
    const b = boss.body;
    const pulse = 0.55 + 0.45 * Math.sin(time * 12);
    // the lead: wall socket to his back, drooping
    const sx = this.socketX;
    const sy = this.socketY;
    if (sx !== 0 || sy !== 0) {
      const mx = (sx + b.x) / 2;
      const my = (sy + b.y) / 2 + 40 + Math.sin(time * 2) * 6;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = this.plugged ? '#e8e2d0' : '#8a8478';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.stroke();
      ctx.lineCap = 'butt';
      // the socket and plug: the target
      ctx.fillStyle = '#f4f1ea';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.fillRect(sx - 16, sy - 16, 32, 32);
      ctx.strokeRect(sx - 16, sy - 16, 32, 32);
      ctx.fillStyle = this.plugged ? '#2a2630' : '#9a948a';
      ctx.fillRect(sx - 6, sy - 8, 4, 16);
      ctx.fillRect(sx + 3, sy - 8, 4, 16);
      if (this.plugged && this.replugCd <= 0) {
        ctx.strokeStyle = `rgba(255, 224, 102, ${0.5 + 0.4 * pulse})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(sx, sy, SOCKET_HIT + 10, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(255, 224, 102, ${0.7 + 0.3 * pulse})`;
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PULL THE PLUG', sx + (sx < b.x ? 70 : -70), sy + 4);
        ctx.textAlign = 'start';
      }
    }
    // suction cone / ring
    if (this.attack === 'inhale' && this.stage !== 'recover') {
      const live = this.stage === 'go';
      const full = this.finale;
      const range = full ? FULL_RANGE : CONE_RANGE;
      const r = range * (live ? 1 : 0.3 + 0.7 * Math.min(1, this.stageT / INHALE_WINDUP));
      ctx.fillStyle = live ? 'rgba(180, 230, 170, 0.3)' : `rgba(160, 220, 150, ${0.08 + 0.08 * pulse})`;
      ctx.strokeStyle = live ? 'rgba(235,255,225,0.9)' : 'rgba(180, 230, 170, 0.8)';
      ctx.lineWidth = live ? 4 : 2.5;
      ctx.setLineDash(live ? [] : [14, 10]);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      if (full) ctx.arc(b.x, b.y, r, 0, TAU);
      else ctx.arc(b.x, b.y, r, this.aim - CONE_HALF, this.aim + CONE_HALF);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      if (live) {
        // chevrons pointing inward
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 3;
        const phase = (time * 1.6) % 1;
        for (let k = 0; k < 3; k++) {
          const rr = range * (1 - ((k / 3 + phase) % 1)) * 0.95;
          const a0 = full ? time : this.aim;
          ctx.beginPath();
          ctx.arc(b.x, b.y, rr, a0 - 0.3, a0 + 0.3);
          ctx.stroke();
        }
      }
    }
    // whip arc
    if (this.attack === 'whip' && this.stage !== 'recover') {
      const live = this.stage === 'go';
      const lo = Math.min(this.whipFrom, this.whipTo);
      const hi = Math.max(this.whipFrom, this.whipTo);
      ctx.fillStyle = `rgba(255, 224, 102, ${live ? 0.12 : 0.1 + 0.1 * pulse})`;
      ctx.strokeStyle = `rgba(255, 224, 102, ${live ? 0.6 : 0.5 + 0.3 * pulse})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.arc(b.x, b.y, WHIP_REACH, lo, hi);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (live) {
        ctx.strokeStyle = '#fff6c4';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + Math.cos(this.whipAngle) * WHIP_REACH, b.y + Math.sin(this.whipAngle) * WHIP_REACH);
        ctx.stroke();
      }
    }
    // spit aim lines
    if (this.attack === 'spit' && this.stage === 'windup') {
      const n = Math.max(this.bag.length, this.finale ? 5 : 3);
      ctx.strokeStyle = `rgba(255, 150, 110, ${0.35 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 9]);
      for (let i = 0; i < n; i++) {
        const a = this.aim + (i - (n - 1) / 2) * 0.28;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + Math.cos(a) * 520, b.y + Math.sin(a) * 520);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  drawAir(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    void game;
    if (boss.defeated || this.intro === 'roll') return;
    const b = boss.body;
    // the dust bag on his back: dots for what he has swallowed
    const bw = 12 * BAG_CAP + 6;
    const x = b.x - bw / 2;
    const y = b.y - 112;
    ctx.fillStyle = 'rgba(16, 20, 14, 0.85)';
    ctx.fillRect(x - 2, y - 2, bw + 4, 16);
    for (let i = 0; i < BAG_CAP; i++) {
      ctx.fillStyle = i < this.bag.length ? '#d6f0c8' : 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(x + 9 + i * 12, y + 6, 4.5, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 2, y - 2, bw + 4, 16);
    ctx.fillStyle = '#d6f0c8';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DUST BAG', b.x, y - 5);
    ctx.textAlign = 'start';
    if (!this.plugged) {
      for (let i = 0; i < 3; i++) {
        const a = time * 4 + (i * TAU) / 3;
        const sx = b.x + Math.cos(a) * 26;
        const sy = b.y - 84 + Math.sin(a) * 6;
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
