import { INK } from '../../core/constants';
import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { BossScript } from './BossScript';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * THE SOFA KRAKEN: "it wants a hug".
 *
 * A BOSS IN PARTS. He sits in the middle of the room, snug in his cushions (COZY: hits on the
 * sofa barely register) while FOUR TENTACLES burst up out of the floor around him. Each tentacle
 * has its own health and its own attacks, and the only thing that hurts them is something thrown.
 * Cut them all down and the sofa is left bare: stunned, wide open, taking extra damage, until they
 * grow back (more of them next time). So the room is the weapon rack and the tentacles are the
 * enemy: you decide which one to put down first.
 *
 * TENTACLE ATTACKS (each telegraphed, never more than two at once):
 *   SLAM   a ring marks where it will land on you; it lands, and is stuck for a moment: hit it then.
 *   SWEEP  a pale fan shows the arc it will sweep round its root.
 *   GRAB   a line shoots out to you; if it lands you are held and squeezed. Hit it to break free.
 * Below a quarter health it is SOFA BED: six tentacles and everything faster.
 *
 * THE ENTRANCE. The sofa crawls in under the spotlight, settles in the middle, and the floor
 * erupts: the tentacles come up one at a time. Then the first slam.
 */

export const COZY_CHIP = 0.1;
export const EXPOSED_BONUS = 1.4;
export const INTERRUPT_DAMAGE = 16;
const REACH = 230;
const SLAM_RADIUS = 56;
const SLAM_WINDUP = 1.15;
const SLAM_STUCK = 1.3;
const SWEEP_WINDUP = 0.9;
const SWEEP_ARC = 1.7;
const SWEEP_SPEED = 2.0;
const SWEEP_WIDTH = 34;
const GRAB_WINDUP = 0.9;
const GRAB_TIME = 1.6;
const STUCK_BONUS = 1.5;
const EXPOSE_SECONDS = 5;
const NEXT_GAP = 2.9;
const NEXT_GAP_OVERTIME = 2.1;
const NEXT_GAP_FINALE = 1.3;

type TState = 'rising' | 'idle' | 'windup' | 'strike' | 'stuck' | 'dead';
type TAttack = 'slam' | 'sweep' | 'grab';

export interface Tentacle {
  rx: number;
  ry: number;
  hp: number;
  maxHp: number;
  state: TState;
  t: number;
  /** 0..1 how far it has come up out of the floor. */
  rise: number;
  attack: TAttack | null;
  tx: number;
  ty: number;
  /** current tip position */
  px: number;
  py: number;
  sweepFrom: number;
  sweepTo: number;
  sweepAngle: number;
  hit: boolean;
  hitCooldown: number;
  swayPhase: number;
}

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

export class KrakenScript implements BossScript {
  readonly deathText = 'DEFLATED!';
  readonly busy = true;

  tentacles: Tentacle[] = [];
  /** Seconds the sofa is bare after the last tentacle falls. */
  exposed = 0;
  finale = false;
  regrowths = 0;
  private bypass = false;
  private tauntAt = -9;
  private tauntedHalf = false;
  private gap = 2.0;
  private cozyAt = -9;
  private heldBy: Tentacle | null = null;
  private heldT = 0;
  private squeezeT = 0;
  time = 0;

  // ── entrance ──
  intro: 'crawl' | 'erupt' | 'done' = 'crawl';
  introT = 0;
  private introTarget: { x: number; y: number } | null = null;
  private erupted = 0;

  get alive(): number {
    return this.tentacles.filter((t) => t.state !== 'dead').length;
  }

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    const b = boss.body;
    if (this.intro !== 'done') {
      this.runIntro(game, boss, dt);
      return;
    }
    // the sofa stays put: the tentacles are the fight
    b.vx = 0;
    b.vy = 0;
    boss.aware = true;
    if (boss.hp <= boss.maxHp * 0.25 && !this.finale) this.startFinale(game, boss);
    const overtime = boss.phaseIndex >= 1 || this.finale;
    if (overtime && !this.tauntedHalf) {
      this.tauntedHalf = true;
      this.taunt(game, boss, 'IT HUGS BACK!', '#ffb3d9', true);
    }

    if (this.exposed > 0) {
      this.exposed -= dt;
      if (this.exposed <= 0) this.regrow(game, boss);
    }
    this.updateHeld(game, dt);
    for (const t of this.tentacles) this.updateTentacle(game, boss, t, dt, overtime);
    this.shatterTentacles(game);

    // the next attack: one at a time per tentacle, two in the air at most
    this.gap -= dt;
    if (this.gap <= 0 && this.exposed <= 0 && boss.stun <= 0) {
      const busy = this.tentacles.filter((t) => t.state === 'windup' || t.state === 'strike').length;
      if (busy < (overtime ? 2 : 1) + (this.finale ? 1 : 0)) {
        const ready = this.tentacles.filter((t) => t.state === 'idle');
        if (ready.length > 0) {
          this.startAttack(game, boss, ready[Math.floor(Math.random() * ready.length)]!, overtime);
          this.gap = this.finale ? NEXT_GAP_FINALE : overtime ? NEXT_GAP_OVERTIME : NEXT_GAP;
        }
      }
    }
  }

  /** While the sofa is cozy the thing to hit is a tentacle: aim assist follows them. */
  aimPoints(): ReadonlyArray<{ x: number; y: number }> | null {
    if (this.intro !== 'done' || this.exposed > 0) return null;
    const pts = this.tentacles.filter((t) => t.state !== 'dead' && t.state !== 'rising').map((t) => ({ x: t.px, y: t.py }));
    return pts.length > 0 ? pts : null;
  }

  filterDamage(game: Game, boss: Enemy, amount: number, _cause: DamageCause): number {
    if (this.bypass) return amount;
    if (this.intro !== 'done') {
      boss.blockFlash = 1;
      return 0;
    }
    if (this.exposed > 0) return amount * EXPOSED_BONUS;
    boss.blockFlash = 1;
    if (game.time - this.cozyAt > 1.3) {
      this.cozyAt = game.time;
      game.fx.burst('COZY...', boss.body.x, boss.body.y - 80, 0.8, '#ffd6ec', true);
    }
    return amount * COZY_CHIP;
  }

  onDefeat(game: Game, boss: Enemy): void {
    for (const t of this.tentacles) t.state = 'dead';
    this.heldBy = null;
    game.popup('...ow. my cushions.', boss.body.x, boss.body.y - 120, '#ffd6ec', 20, 2.4);
  }

  // ───────────── entrance ─────────────

  private runIntro(game: Game, boss: Enemy, dt: number): void {
    this.introT += dt;
    const b = boss.body;
    if (this.intro === 'crawl') {
      if (!this.introTarget) {
        const bounds = game.world.bounds;
        const cx = (bounds.x0 + bounds.x1) / 2;
        const cy = (bounds.y0 + bounds.y1) / 2;
        this.introTarget = { x: b.x + (cx - b.x) * 0.75, y: b.y + (cy - b.y) * 0.75 };
        game.camera.focus(b.x, b.y, 2.4, 1.07);
        game.audio.play('bossWalk', 1);
      }
      const t = this.introTarget;
      const dx = t.x - b.x;
      const dy = t.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(150, d * 1.6 + 20);
      b.vx = (dx / d) * sp;
      b.vy = (dy / d) * sp;
      boss.facing = Math.atan2(dy, dx);
      boss.walkPhase += dt * 6;
      if ((d < 20 && this.introT > 0.8) || this.introT > 4.5) {
        b.vx = 0;
        b.vy = 0;
        this.intro = 'erupt';
        this.introT = 0;
        this.erupted = 0;
        this.layRoots(game, boss);
      }
      return;
    }
    b.vx = 0;
    b.vy = 0;
    boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
    // one tentacle at a time bursts up through the floor
    while (this.erupted < this.tentacles.length && this.introT >= 0.5 + this.erupted * 0.4) {
      const t = this.tentacles[this.erupted]!;
      t.state = 'rising';
      t.t = 0;
      game.fx.ring(t.rx, t.ry, 4, 70, 0.4, 'rgba(255,170,215,0.9)', 4);
      game.audio.play('plop', 0.8);
      game.particles.burst('dust', t.rx, t.ry, 3, 120);
      this.erupted++;
      if (this.erupted === 1) {
        game.fx.burst('IT WANTS A HUG!', b.x, b.y - 100, 1.3, '#ffb3d9', true);
        this.taunt(game, boss, pickLine(['Come sit.', 'Stay a while.', 'Make yourself comfortable.']), '#ffd6ec', true);
      }
    }
    if (this.introT >= 0.5 + this.tentacles.length * 0.4 + 0.9) this.finishIntro(game, boss);
  }

  /** Ends the entrance and starts the fight. Public so a test can skip ahead. */
  finishIntro(game: Game, boss: Enemy, openWithSlam = true): void {
    if (this.tentacles.length === 0) this.layRoots(game, boss);
    for (const t of this.tentacles) {
      if (t.state === 'dead' && t.hp > 0) t.state = 'idle';
      if (t.state === 'rising' || t.state === 'dead') {
        t.state = 'idle';
        t.rise = 1;
      }
    }
    this.intro = 'done';
    this.introT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    boss.aware = true;
    boss.ai = 'chase';
    this.gap = 1.2;
    if (openWithSlam) {
      const t = this.tentacles[0];
      if (t) this.startAttack(game, boss, t, false, 'slam');
    }
  }

  private layRoots(game: Game, boss: Enemy, count = 4): void {
    const bounds = game.world.bounds;
    const b = boss.body;
    this.tentacles.length = 0;
    const maxHp = Math.max(30, boss.maxHp * 0.065);
    for (let i = 0; i < count; i++) {
      const a = Math.PI / 4 + (i * TAU) / count + (count === 6 ? 0.2 : 0);
      const r = 215 + (i % 2) * 40;
      const rx = Math.min(bounds.x1 - 40, Math.max(bounds.x0 + 40, b.x + Math.cos(a) * r));
      const ry = Math.min(bounds.y1 - 40, Math.max(bounds.y0 + 40, b.y + Math.sin(a) * r));
      this.tentacles.push({
        rx, ry, hp: maxHp, maxHp, state: 'dead', t: 0, rise: 0, attack: null, tx: rx, ty: ry, px: rx, py: ry,
        sweepFrom: 0, sweepTo: 0, sweepAngle: 0, hit: false, hitCooldown: 0, swayPhase: Math.random() * TAU,
      });
    }
  }

  // ───────────── tentacles ─────────────

  private startAttack(game: Game, boss: Enemy, t: Tentacle, overtime: boolean, force?: TAttack): void {
    const p = game.player.body;
    const dist = Math.hypot(p.x - t.rx, p.y - t.ry);
    const options: TAttack[] = ['slam', 'sweep'];
    if (dist < REACH + 30) options.push('grab');
    const kind = force ?? options[Math.floor(Math.random() * options.length)]!;
    t.attack = kind;
    t.state = 'windup';
    t.t = 0;
    t.hit = false;
    t.tx = p.x;
    t.ty = p.y;
    if (kind === 'sweep') {
      const a = Math.atan2(p.y - t.ry, p.x - t.rx);
      const dir = Math.random() < 0.5 ? 1 : -1;
      t.sweepFrom = a - dir * SWEEP_ARC / 2;
      t.sweepTo = a + dir * SWEEP_ARC / 2;
      t.sweepAngle = t.sweepFrom;
    }
    const word = kind === 'slam' ? 'SLAM!' : kind === 'sweep' ? 'SWEEP!' : 'GRAB!';
    game.fx.burst(word, t.rx, t.ry - 70, 1.0, '#ffb3d9', false);
    void boss;
    void overtime;
  }

  private updateTentacle(game: Game, boss: Enemy, t: Tentacle, dt: number, overtime: boolean): void {
    t.t += dt;
    t.hitCooldown -= dt;
    const speed = this.finale ? 1.5 : overtime ? 1.25 : 1;
    switch (t.state) {
      case 'rising':
        t.rise = Math.min(1, t.t / 0.6);
        if (t.rise >= 1) t.state = 'idle';
        t.px = t.rx;
        t.py = t.ry;
        break;
      case 'idle': {
        // sway, tip resting near the root
        const sway = Math.sin(this.time * 2 + t.swayPhase);
        t.px = t.rx + Math.cos(t.swayPhase) * 40 + sway * 12;
        t.py = t.ry - 60 + Math.sin(this.time * 1.6 + t.swayPhase) * 8;
        break;
      }
      case 'windup': {
        const total = (t.attack === 'slam' ? SLAM_WINDUP : t.attack === 'sweep' ? SWEEP_WINDUP : GRAB_WINDUP) / speed;
        // slam and grab follow you until the last moment, then lock
        if (t.attack !== 'sweep' && t.t < total * 0.5) {
          t.tx = game.player.body.x;
          t.ty = game.player.body.y;
        }
        if (t.attack === 'grab') {
          const dx = t.tx - t.rx;
          const dy = t.ty - t.ry;
          const d = Math.hypot(dx, dy) || 1;
          const reach = Math.min(d, REACH);
          t.tx = t.rx + (dx / d) * reach;
          t.ty = t.ry + (dy / d) * reach;
        }
        // the tip rears up over the root
        t.px = t.rx + (t.tx - t.rx) * 0.15;
        t.py = t.ry - 90 - Math.sin(Math.min(1, t.t / total) * Math.PI) * 20;
        if (t.t >= total) {
          t.state = 'strike';
          t.t = 0;
          game.audio.play('slide', 0.6);
        }
        break;
      }
      case 'strike':
        this.strike(game, boss, t, dt, speed);
        break;
      case 'stuck':
        // stuck in the floor: open to a good hit
        t.px += (t.tx - t.px) * 0.3;
        t.py += (t.ty - t.py) * 0.3;
        if (t.t >= SLAM_STUCK) {
          t.state = 'idle';
          t.attack = null;
          t.t = 0;
        }
        break;
      case 'dead':
        break;
    }
  }

  private strike(game: Game, boss: Enemy, t: Tentacle, dt: number, speed: number): void {
    const p = game.player;
    if (t.attack === 'slam') {
      t.px = t.tx;
      t.py = t.ty;
      if (!t.hit) {
        t.hit = true;
        game.particles.burst('dust', t.tx, t.ty, 3, 130);
        game.fx.ring(t.tx, t.ty, 6, SLAM_RADIUS + 20, 0.3, 'rgba(255,170,215,0.85)', 4);
        for (const o of game.objects) {
          if (!o.alive || o.held || o.def.fixed) continue;
          if (Math.hypot(o.body.x - t.tx, o.body.y - t.ty) < SLAM_RADIUS + o.body.boundR) {
            o.body.vz = Math.max(o.body.vz, 180);
            o.body.wake();
          }
        }
        if (p.alive && Math.hypot(p.body.x - t.tx, p.body.y - t.ty) < SLAM_RADIUS + p.body.boundR * 0.4 && p.hurt(game, 1, 'Tentacle slam')) {
          const dx = p.body.x - t.tx;
          const dy = p.body.y - t.ty;
          const d = Math.hypot(dx, dy) || 1;
          p.body.applyImpulse((dx / d) * 260 * p.body.mass, (dy / d) * 260 * p.body.mass);
        }
      }
      if (t.t >= 0.15) {
        t.state = 'stuck';
        t.t = 0;
      }
      return;
    }
    if (t.attack === 'sweep') {
      const dir = t.sweepTo > t.sweepFrom ? 1 : -1;
      t.sweepAngle += dir * SWEEP_SPEED * speed * dt;
      const done = dir > 0 ? t.sweepAngle >= t.sweepTo : t.sweepAngle <= t.sweepTo;
      const a = t.sweepAngle;
      t.px = t.rx + Math.cos(a) * REACH;
      t.py = t.ry + Math.sin(a) * REACH;
      if (!t.hit && p.alive) {
        // distance from the player to the sweeping line root -> tip
        const lx = Math.cos(a);
        const ly = Math.sin(a);
        const vx = p.body.x - t.rx;
        const vy = p.body.y - t.ry;
        const along = vx * lx + vy * ly;
        const across = Math.abs(vx * -ly + vy * lx);
        if (along > 30 && along < REACH + 20 && across < SWEEP_WIDTH + p.body.boundR * 0.4 && p.hurt(game, 1, 'Tentacle sweep')) {
          t.hit = true;
          p.body.applyImpulse(-ly * dir * 300 * p.body.mass, lx * dir * 300 * p.body.mass);
        }
      }
      if (done) {
        t.state = 'idle';
        t.attack = null;
        t.t = 0;
      }
      return;
    }
    // grab: the tip shoots out along the locked line
    const dx = t.tx - t.rx;
    const dy = t.ty - t.ry;
    const k = Math.min(1, t.t / 0.18);
    t.px = t.rx + dx * k;
    t.py = t.ry + dy * k;
    if (!t.hit && p.alive && Math.hypot(p.body.x - t.px, p.body.y - t.py) < p.body.boundR + 26) {
      t.hit = true;
      if (p.hurt(game, 1, 'Tentacle grab')) {
        this.heldBy = t;
        this.heldT = 0;
        this.squeezeT = 0;
        game.fx.burst('GOTCHA!', p.body.x, p.body.y - 52, 1.1, '#ffb3d9', true);
      }
    }
    if (t.t >= 0.4 && this.heldBy !== t) {
      t.state = 'stuck';
      t.t = 0;
    }
  }

  /** While held you are squeezed; hurt the tentacle (or wait) to get free. */
  private updateHeld(game: Game, dt: number): void {
    const t = this.heldBy;
    if (!t) return;
    const p = game.player;
    if (t.state === 'dead' || !p.alive) {
      this.heldBy = null;
      return;
    }
    this.heldT += dt;
    this.squeezeT += dt;
    p.body.vx *= 0.2;
    p.body.vy *= 0.2;
    p.slowTimer = 0.2;
    p.slowFactor = 0.12;
    t.px = p.body.x;
    t.py = p.body.y;
    if (this.squeezeT >= 0.7) {
      this.squeezeT = 0;
      p.invulnerable = 0;
      p.hurt(game, 1, 'Squeeze');
    }
    if (this.heldT >= GRAB_TIME) this.release(game, t, 'LET GO');
  }

  private release(game: Game, t: Tentacle, word: string): void {
    this.heldBy = null;
    t.state = 'stuck';
    t.t = 0;
    game.fx.burst(word, game.player.body.x, game.player.body.y - 52, 0.9, '#bfe9ff', true);
    game.player.slowTimer = 0;
  }

  /** Thrown things are the only weapon against a tentacle. */
  private shatterTentacles(game: Game): void {
    const flying = game.objects.filter((o) => o.alive && o.thrownByPlayer && o.body.speed() > 180);
    if (flying.length === 0) return;
    for (const t of this.tentacles) {
      if (t.state === 'dead' || t.state === 'rising' || t.hitCooldown > 0) continue;
      // the tip and a few points down the length of it
      const pts: Array<[number, number]> = [];
      for (let k = 0; k <= 3; k++) pts.push([t.rx + (t.px - t.rx) * (k / 3), t.ry + (t.py - t.ry) * (k / 3)]);
      for (const o of flying) {
        const hit = pts.some(([x, y]) => Math.hypot(o.body.x - x, o.body.y - y) < o.body.boundR + 24);
        if (!hit) continue;
        const sp = o.body.speed();
        let dmg = Math.min(t.maxHp * 0.7, 12 + (sp * o.body.mass) * 0.0016);
        if (t.state === 'stuck') dmg *= STUCK_BONUS;
        t.hp -= dmg;
        t.hitCooldown = 0.3;
        o.body.vx *= 0.35;
        o.body.vy *= 0.35;
        game.fx.burst(t.state === 'stuck' ? 'SQUISH!' : 'SLAP!', t.px, t.py - 20, 0.8, '#ffe0f0', true);
        game.particles.burst('scrap', t.px, t.py, 2, 120, { color: '#ffb3d9' });
        if (this.heldBy === t) this.release(game, t, 'BROKE FREE!');
        if (t.hp <= 0) this.killTentacle(game, t);
        break;
      }
    }
  }

  private killTentacle(game: Game, t: Tentacle): void {
    t.state = 'dead';
    t.attack = null;
    if (this.heldBy === t) this.heldBy = null;
    game.fx.burst('SEVERED!', t.px, t.py - 30, 1.1, '#ff7ab8', true);
    game.fx.ring(t.px, t.py, 6, 80, 0.4, 'rgba(255,122,184,0.9)', 4);
    game.audio.play('plop', 0.8);
    game.hitStop(0.05);
    if (this.alive === 0) this.bareSofa(game);
  }

  private bareSofa(game: Game): void {
    this.exposed = EXPOSE_SECONDS;
    game.hud.banner('BARE SOFA', 'hit him now', 2.2);
    game.fx.burst('BARE SOFA!', game.player.body.x, game.player.body.y - 90, 1.3, '#ffd23f', true);
    game.hitStop(0.06);
  }

  private regrow(game: Game, boss: Enemy): void {
    this.regrowths++;
    const count = this.finale ? 6 : 4;
    this.layRoots(game, boss, count);
    let i = 0;
    for (const t of this.tentacles) {
      t.state = 'rising';
      t.t = -i * 0.25;
      t.rise = 0;
      i++;
    }
    this.gap = 2.2;
    game.fx.burst('IT GROWS BACK!', boss.body.x, boss.body.y - 100, 1.2, '#ffb3d9', true);
    this.taunt(game, boss, pickLine(["Don't leave. I just got comfy.", 'Round two?']), '#ffd6ec', true);
  }

  private startFinale(game: Game, boss: Enemy): void {
    this.finale = true;
    boss.rageMult = Math.max(boss.rageMult, 1.2);
    game.hud.banner('SOFA BED', 'six tentacles, no mercy', 2.6);
    game.fx.burst('SOFA BED!', boss.body.x, boss.body.y - 112, 1.5, '#ff7ab8', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 170, 0.6, 'rgba(255,122,184,0.9)', 6);
    game.fx.flash('#ffb3d9', 0.12);
    game.audio.play('alarm', 1);
    this.taunt(game, boss, 'ROOM FOR EVERYONE!', '#ffd6ec', true);
    // two more tentacles join in, even mid-fight
    if (this.exposed <= 0) {
      const alive = this.tentacles.filter((t) => t.state !== 'dead');
      const old = this.tentacles.slice();
      this.layRoots(game, boss, 6);
      for (let i = 0; i < this.tentacles.length; i++) {
        const t = this.tentacles[i]!;
        const prev = old[i];
        if (prev && prev.state !== 'dead' && alive.includes(prev)) {
          Object.assign(t, prev, { rx: prev.rx, ry: prev.ry });
        } else {
          t.state = 'rising';
          t.t = 0;
          t.rise = 0;
        }
      }
    }
  }

  private taunt(game: Game, boss: Enemy, line: string, color = '#ffd6ec', force = false): void {
    if (!force && game.time - this.tauntAt < 2.6) return;
    this.tauntAt = game.time;
    game.popup(line, boss.body.x, boss.body.y - 128, color, 19, 2.2);
  }

  // ───────────── drawing ─────────────

  drawFloor(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    if (boss.defeated) return;
    void game;
    const pulse = 0.55 + 0.45 * Math.sin(time * 12);
    for (const t of this.tentacles) {
      // the hole it comes out of
      if (t.state === 'dead' && t.rise === 0) continue;
      ctx.fillStyle = 'rgba(30, 10, 25, 0.6)';
      ctx.beginPath();
      ctx.ellipse(t.rx, t.ry, 22, 11, 0, 0, TAU);
      ctx.fill();
      if (t.state === 'windup') {
        if (t.attack === 'slam' || t.attack === 'grab') {
          const total = t.attack === 'slam' ? SLAM_WINDUP : GRAB_WINDUP;
          const f = Math.min(1, t.t / total);
          ctx.strokeStyle = `rgba(255, 110, 170, ${0.55 + 0.3 * pulse})`;
          ctx.fillStyle = `rgba(255, 110, 170, ${0.1 + 0.1 * pulse})`;
          ctx.lineWidth = 3;
          if (t.attack === 'slam') {
            ctx.beginPath();
            ctx.arc(t.tx, t.ty, SLAM_RADIUS, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(t.tx, t.ty, SLAM_RADIUS * (1 - f), 0, TAU);
            ctx.stroke();
          } else {
            ctx.setLineDash([14, 10]);
            ctx.beginPath();
            ctx.moveTo(t.rx, t.ry);
            ctx.lineTo(t.tx, t.ty);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(t.tx, t.ty, 26, 0, TAU);
            ctx.stroke();
          }
        } else if (t.attack === 'sweep') {
          ctx.fillStyle = `rgba(255, 110, 170, ${0.1 + 0.1 * pulse})`;
          ctx.strokeStyle = `rgba(255, 130, 180, ${0.55 + 0.3 * pulse})`;
          ctx.lineWidth = 2.5;
          const lo = Math.min(t.sweepFrom, t.sweepTo);
          const hi = Math.max(t.sweepFrom, t.sweepTo);
          ctx.beginPath();
          ctx.moveTo(t.rx, t.ry);
          ctx.arc(t.rx, t.ry, REACH, lo, hi);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      } else if (t.state === 'strike' && t.attack === 'sweep') {
        ctx.fillStyle = 'rgba(255, 110, 170, 0.22)';
        const lo = Math.min(t.sweepFrom, t.sweepAngle);
        const hi = Math.max(t.sweepFrom, t.sweepAngle);
        ctx.beginPath();
        ctx.moveTo(t.rx, t.ry);
        ctx.arc(t.rx, t.ry, REACH, lo, hi);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawAir(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    void game;
    if (boss.defeated) return;
    for (const t of this.tentacles) {
      if (t.state === 'dead') continue;
      const rise = t.state === 'rising' ? Math.max(0, t.rise) : 1;
      if (rise <= 0) continue;
      const tipX = t.rx + (t.px - t.rx) * rise;
      const tipY = t.ry + (t.py - t.ry) * rise - (1 - rise) * 0;
      const lift = t.state === 'windup' ? 60 : t.state === 'idle' ? 70 : 20;
      const midX = (t.rx + tipX) / 2 + Math.sin(time * 3 + t.swayPhase) * 14;
      const midY = Math.min(t.ry, tipY) - lift * rise;
      // body of the tentacle: thick at the root, thin at the tip
      const hurt = t.state === 'stuck' ? 1 : 0;
      for (const [w, col] of [[20, INK], [15, hurt ? '#e0709c' : '#9c4a73'], [8, hurt ? '#f1a0c2' : '#bb6a92']] as const) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w * (0.5 + 0.5 * rise);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(t.rx, t.ry);
        ctx.quadraticCurveTo(midX, midY, tipX, tipY);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      // suckers
      ctx.fillStyle = 'rgba(255, 225, 240, 0.8)';
      for (let k = 1; k <= 4; k++) {
        const u = k / 5;
        const x = (1 - u) * (1 - u) * t.rx + 2 * (1 - u) * u * midX + u * u * tipX;
        const y = (1 - u) * (1 - u) * t.ry + 2 * (1 - u) * u * midY + u * u * tipY;
        ctx.beginPath();
        ctx.arc(x, y + 2, 2.6 * (1 - u * 0.5), 0, TAU);
        ctx.fill();
      }
      // a health bar over each tentacle
      if (t.state !== 'rising') {
        const bw = 36;
        ctx.fillStyle = 'rgba(16, 10, 24, 0.85)';
        ctx.fillRect(t.rx - bw / 2 - 2, t.ry - 34, bw + 4, 8);
        ctx.fillStyle = hurt ? '#ffe28a' : '#ff7ab8';
        ctx.fillRect(t.rx - bw / 2, t.ry - 32, bw * Math.max(0, t.hp / t.maxHp), 4);
      }
    }
    if (this.exposed > 0) {
      // the bare sofa: stars over his head
      for (let i = 0; i < 3; i++) {
        const a = time * 4 + (i * TAU) / 3;
        const sx = boss.body.x + Math.cos(a) * 26;
        const sy = boss.body.y - 74 + Math.sin(a) * 6;
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
