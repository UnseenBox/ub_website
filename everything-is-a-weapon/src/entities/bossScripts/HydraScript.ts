import { INK } from '../../core/constants';
import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { PhysicsObject } from '../PhysicsObject';
import type { BossScript } from './BossScript';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * THE LAUNDRY HYDRA: "three heads. no pairs. all angry."
 *
 * THE OLD PROBLEM. A washing machine with three sock-puppet heads on long necks. The machine
 * itself is soaked through: hits on it barely count while any head is alive. Heads can be
 * knocked down by thrown things, BUT CUT A HEAD OFF AND TWO GROW BACK (smaller, up to six).
 * Unless you burn it: a head struck by something HOT (the irons rolled into the corners, or
 * anything on fire) is SEALED, and a sealed head stays gone when it goes down, whatever finishes it.
 * An iron that breaks is replaced: the fight can always be won. Kill every head for good and the machine is
 * left HEADLESS: wide open, and he can only watch.
 *
 * HEAD ATTACKS (telegraphed, never more than three at once):
 *   BITE    a ring marks where it will land on you; it bites and is stuck for a moment: a good time to hit it.
 *   SWEEP   a fan shows the arc it will swing round the machine.
 * The more heads he has, the faster and the more at a time they go for you: splitting heads is a trap.
 *
 * THE ENTRANCE. The washer shudders to the middle of the room, the cycle finishes with a DING, and
 * the three heads burst out of the drum one after another. Two irons are rolled in. "Cut a head and
 * two grow back. Burn the stump."
 */

export const SOAKED_CHIP = 0.1;
export const HEADLESS_BONUS = 1.5;
export const MAX_HEADS = 6;
const REACH = 240;
const BITE_RADIUS = 54;
const BITE_WINDUP = 1.1;
const STUCK_TIME = 1.3;
const STUCK_BONUS = 1.5;
const SWEEP_WINDUP = 0.9;
const SWEEP_ARC = 1.7;
const SWEEP_SPEED = 2.0;
const SWEEP_WIDTH = 32;
const HEAD_COLOURS = ['#e0534e', '#4a8fd6', '#e8c24a', '#62b86a', '#b36ad6', '#e08a3c'];
const IRONS = 2;
/** Seconds before a broken or lost iron is rolled back in. */
const IRON_RESPAWN = 4;

type HState = 'rising' | 'idle' | 'windup' | 'strike' | 'stuck' | 'dead';
type HAttack = 'bite' | 'sweep';

export interface Head {
  angle: number;
  hp: number;
  maxHp: number;
  state: HState;
  t: number;
  rise: number;
  attack: HAttack | null;
  tx: number;
  ty: number;
  px: number;
  py: number;
  sweepFrom: number;
  sweepTo: number;
  sweepAngle: number;
  hit: boolean;
  hitCd: number;
  sway: number;
  colour: string;
  small: boolean;
  /** Struck by something hot: it will not grow back when it goes down. */
  sealed: boolean;
}

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

export class HydraScript implements BossScript {
  readonly deathText = 'FOLDED!';
  readonly busy = true;

  time = 0;
  heads: Head[] = [];
  irons: PhysicsObject[] = [];
  private ironCd = IRON_RESPAWN;
  private splitHinted = false;
  /** Every head is gone for good. */
  headless = false;
  private tauntAt = -9;
  private gap = 2.2;
  private colourIndex = 0;

  intro: 'shudder' | 'burst' | 'done' = 'shudder';
  introT = 0;
  private introTarget: { x: number; y: number } | null = null;
  private burst = 0;

  get alive(): number {
    return this.heads.filter((h) => h.state !== 'dead').length;
  }

  aimPoints(): ReadonlyArray<{ x: number; y: number }> | null {
    if (this.intro !== 'done' || this.headless) return null;
    const pts = this.heads.filter((h) => h.state !== 'dead' && h.state !== 'rising').map((h) => ({ x: h.px, y: h.py }));
    return pts.length > 0 ? pts : null;
  }

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    const b = boss.body;
    if (this.intro !== 'done') {
      this.runIntro(game, boss, dt);
      return;
    }
    b.vx = 0;
    b.vy = 0;
    boss.aware = true;
    this.irons = this.irons.filter((o) => o.alive && o.structural !== 'broken');
    if (!this.headless && this.irons.length < IRONS) {
      this.ironCd -= dt;
      if (this.ironCd <= 0) {
        this.ironCd = IRON_RESPAWN;
        this.rollInIron(game);
      }
    } else {
      this.ironCd = IRON_RESPAWN;
    }
    for (const h of this.heads) this.updateHead(game, boss, h, dt);
    this.strikeHeads(game, boss);
    if (!this.headless) {
      this.gap -= dt;
      const alive = this.alive;
      const concurrent = alive >= 6 ? 3 : alive >= 4 ? 2 : 1;
      if (this.gap <= 0) {
        const busyHeads = this.heads.filter((h) => h.state === 'windup' || h.state === 'strike').length;
        const ready = this.heads.filter((h) => h.state === 'idle');
        if (busyHeads < concurrent && ready.length > 0) {
          this.startAttack(game, ready[Math.floor(Math.random() * ready.length)]!);
          this.gap = Math.max(1.1, 2.7 - 0.2 * Math.max(0, alive - 3));
        }
      }
    }
  }

  filterDamage(game: Game, boss: Enemy, amount: number, _cause: DamageCause): number {
    if (this.intro !== 'done') {
      boss.blockFlash = 1;
      return 0;
    }
    if (this.headless) return amount * HEADLESS_BONUS;
    boss.blockFlash = 1;
    if (game.time - this.tauntAt > 2.2) {
      this.tauntAt = game.time;
      game.fx.burst('SOAKED...', boss.body.x, boss.body.y - 84, 0.8, '#bfe3ff', true);
    }
    return amount * SOAKED_CHIP;
  }

  onDefeat(game: Game, boss: Enemy): void {
    for (const h of this.heads) h.state = 'dead';
    game.popup('...spin cycle complete.', boss.body.x, boss.body.y - 124, '#bfe3ff', 20, 2.4);
  }

  // ───────────── entrance ─────────────

  private runIntro(game: Game, boss: Enemy, dt: number): void {
    this.introT += dt;
    const b = boss.body;
    if (this.intro === 'shudder') {
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
      const sp = Math.min(170, d * 1.8 + 30);
      b.vx = (dx / d) * sp;
      b.vy = (dy / d) * sp;
      boss.facing = Math.atan2(dy, dx);
      boss.walkPhase += dt * 12;
      if ((d < 22 && this.introT > 0.9) || this.introT > 4.5) {
        b.vx = 0;
        b.vy = 0;
        this.intro = 'burst';
        this.introT = 0;
        this.burst = 0;
        this.layHeads(game, boss);
        this.placeIrons(game, boss);
        game.fx.burst('DING!', b.x, b.y - 100, 1.4, '#bfe3ff', true);
      }
      return;
    }
    b.vx = 0;
    b.vy = 0;
    while (this.burst < this.heads.length && this.introT >= 0.5 + this.burst * 0.45) {
      const h = this.heads[this.burst]!;
      h.state = 'rising';
      h.t = 0;
      game.fx.ring(h.px, h.py, 4, 70, 0.4, 'rgba(190,230,255,0.9)', 4);
      game.audio.play('plop', 0.8);
      this.burst++;
      if (this.burst === 1) {
        game.hint('CUT A HEAD, TWO GROW BACK', 'hit a head with the hot iron and it stays gone', 3.6, 'boss:HydraScript');
        this.taunt(game, boss, pickLine(['Spin cycle: complete.', 'Fresh out of the dryer!']), '#e0f1ff', true);
      }
    }
    if (this.introT >= 0.5 + this.heads.length * 0.45 + 0.9) this.finishIntro(game, boss);
  }

  /** Ends the entrance and starts the fight. Public so a test can skip ahead. */
  finishIntro(game: Game, boss: Enemy, openWithBite = true): void {
    if (this.heads.length === 0) {
      this.layHeads(game, boss);
      this.placeIrons(game, boss);
    }
    for (const h of this.heads) {
      if (h.state === 'dead' || h.state === 'rising') {
        h.state = 'idle';
        h.rise = 1;
      }
    }
    this.intro = 'done';
    this.introT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    boss.aware = true;
    boss.ai = 'chase';
    this.gap = 1.3;
    if (openWithBite) {
      const h = this.heads[0];
      if (h) this.startAttack(game, h, 'bite');
    }
  }

  private newHead(angle: number, maxHp: number, small: boolean): Head {
    const colour = HEAD_COLOURS[this.colourIndex++ % HEAD_COLOURS.length]!;
    return {
      angle, hp: maxHp, maxHp, state: 'dead', t: 0, rise: 0, attack: null, tx: 0, ty: 0, px: 0, py: 0,
      sweepFrom: 0, sweepTo: 0, sweepAngle: 0, hit: false, hitCd: 0, sway: Math.random() * TAU, colour, small,
      sealed: false,
    };
  }

  private layHeads(game: Game, boss: Enemy): void {
    const maxHp = Math.max(24, boss.maxHp * 0.07);
    this.heads = [];
    for (let i = 0; i < 3; i++) {
      const h = this.newHead(-Math.PI / 2 + (i * TAU) / 3 + 0.5, maxHp, false);
      const r = this.root(boss, h);
      h.px = r.x;
      h.py = r.y;
      this.heads.push(h);
    }
    void game;
  }

  private root(boss: Enemy, h: Head): { x: number; y: number } {
    const r = boss.type.radius - 6;
    return { x: boss.body.x + Math.cos(h.angle) * r, y: boss.body.y + Math.sin(h.angle) * r };
  }

  private placeIrons(game: Game, boss: Enemy): void {
    const bounds = game.world.bounds;
    const corners: Array<[number, number]> = [
      [bounds.x0 + 70, bounds.y0 + 70], [bounds.x1 - 70, bounds.y0 + 70],
      [bounds.x0 + 70, bounds.y1 - 70], [bounds.x1 - 70, bounds.y1 - 70],
    ];
    const p = game.player.body;
    // the corners nearest you, so the first iron is a short run away
    corners.sort((a, c) => Math.hypot(a[0] - p.x, a[1] - p.y) - Math.hypot(c[0] - p.x, c[1] - p.y));
    this.irons = [];
    for (const [x, y] of corners.slice(0, IRONS)) {
      const iron = game.spawnObject('iron', x, y, Math.random() * TAU);
      if (iron) {
        this.irons.push(iron);
        game.fx.ring(x, y, 4, 40, 0.4, 'rgba(255,150,90,0.9)', 3);
      }
    }
    void boss;
  }

  /** A fresh iron rolls in from the free corner nearest you, so the answer never runs out. */
  private rollInIron(game: Game): void {
    const bounds = game.world.bounds;
    const corners: Array<[number, number]> = [
      [bounds.x0 + 70, bounds.y0 + 70], [bounds.x1 - 70, bounds.y0 + 70],
      [bounds.x0 + 70, bounds.y1 - 70], [bounds.x1 - 70, bounds.y1 - 70],
    ];
    const p = game.player.body;
    const free = corners.filter(([x, y]) => this.irons.every((o) => Math.hypot(o.body.x - x, o.body.y - y) > 90));
    const pool = free.length > 0 ? free : corners;
    pool.sort((a, c) => Math.hypot(a[0] - p.x, a[1] - p.y) - Math.hypot(c[0] - p.x, c[1] - p.y));
    const [x, y] = pool[0]!;
    const iron = game.spawnObject('iron', x, y, Math.random() * TAU);
    if (!iron) return;
    this.irons.push(iron);
    game.fx.ring(x, y, 4, 40, 0.4, 'rgba(255,150,90,0.9)', 3);
    game.fx.burst('NEW IRON!', x, y - 30, 0.9, '#ffb347', true);
  }

  // ───────────── heads ─────────────

  private startAttack(game: Game, h: Head, force?: HAttack): void {
    const p = game.player.body;
    const kind: HAttack = force ?? (Math.random() < 0.6 ? 'bite' : 'sweep');
    h.attack = kind;
    h.state = 'windup';
    h.t = 0;
    h.hit = false;
    h.tx = p.x;
    h.ty = p.y;
    if (kind === 'sweep') {
      const root = { x: h.px, y: h.py };
      const a = Math.atan2(p.y - root.y, p.x - root.x);
      const dir = Math.random() < 0.5 ? 1 : -1;
      h.sweepFrom = a - (dir * SWEEP_ARC) / 2;
      h.sweepTo = a + (dir * SWEEP_ARC) / 2;
      h.sweepAngle = h.sweepFrom;
    }
    game.fx.burst(kind === 'bite' ? 'CHOMP!' : 'SWEEP!', h.px, h.py - 70, 0.9, '#bfe3ff', false);
  }

  private rootOf(boss: Enemy, h: Head): { x: number; y: number } {
    return this.root(boss, h);
  }

  private updateHead(game: Game, boss: Enemy, h: Head, dt: number): void {
    h.t += dt;
    h.hitCd -= dt;
    const r = this.rootOf(boss, h);
    const speed = this.alive >= 6 ? 1.35 : this.alive >= 4 ? 1.15 : 1;
    switch (h.state) {
      case 'rising':
        h.rise = Math.min(1, Math.max(0, h.t / 0.6));
        h.px = r.x;
        h.py = r.y;
        if (h.rise >= 1) h.state = 'idle';
        break;
      case 'idle': {
        const sway = Math.sin(this.time * 2 + h.sway);
        h.px = r.x + Math.cos(h.angle) * 90 + sway * 14;
        h.py = r.y + Math.sin(h.angle) * 90 - 40 + Math.sin(this.time * 1.6 + h.sway) * 8;
        break;
      }
      case 'windup': {
        const total = (h.attack === 'bite' ? BITE_WINDUP : SWEEP_WINDUP) / speed;
        if (h.attack === 'bite' && h.t < total * 0.5) {
          h.tx = game.player.body.x;
          h.ty = game.player.body.y;
        }
        const dx = h.tx - r.x;
        const dy = h.ty - r.y;
        const d = Math.hypot(dx, dy) || 1;
        const reach = Math.min(d, REACH);
        h.tx = r.x + (dx / d) * reach;
        h.ty = r.y + (dy / d) * reach;
        h.px = r.x + (h.tx - r.x) * 0.2;
        h.py = r.y - 70 - Math.sin(Math.min(1, h.t / total) * Math.PI) * 18;
        if (h.t >= total) {
          h.state = 'strike';
          h.t = 0;
          game.audio.play('swipe', 0.6);
        }
        break;
      }
      case 'strike':
        this.strike(game, boss, h, dt, speed);
        break;
      case 'stuck':
        h.px += (h.tx - h.px) * 0.3;
        h.py += (h.ty - h.py) * 0.3;
        if (h.t >= STUCK_TIME) {
          h.state = 'idle';
          h.attack = null;
          h.t = 0;
        }
        break;
      case 'dead':
        break;
    }
  }

  private strike(game: Game, boss: Enemy, h: Head, dt: number, speed: number): void {
    const p = game.player;
    const r = this.rootOf(boss, h);
    if (h.attack === 'bite') {
      const k = Math.min(1, h.t / 0.14);
      h.px = r.x + (h.tx - r.x) * k;
      h.py = r.y + (h.ty - r.y) * k;
      if (!h.hit && k >= 1) {
        h.hit = true;
        game.particles.burst('dust', h.tx, h.ty, 2, 110);
        game.fx.ring(h.tx, h.ty, 6, BITE_RADIUS + 16, 0.3, 'rgba(190,230,255,0.85)', 4);
        if (p.alive && Math.hypot(p.body.x - h.tx, p.body.y - h.ty) < BITE_RADIUS + p.body.boundR * 0.4 && p.hurt(game, 1, 'Hydra bite')) {
          const dx = p.body.x - h.tx;
          const dy = p.body.y - h.ty;
          const d = Math.hypot(dx, dy) || 1;
          p.body.applyImpulse((dx / d) * 260 * p.body.mass, (dy / d) * 260 * p.body.mass);
        }
      }
      if (h.t >= 0.2) {
        h.state = 'stuck';
        h.t = 0;
      }
      return;
    }
    // sweep
    const dir = h.sweepTo > h.sweepFrom ? 1 : -1;
    h.sweepAngle += dir * SWEEP_SPEED * speed * dt;
    const done = dir > 0 ? h.sweepAngle >= h.sweepTo : h.sweepAngle <= h.sweepTo;
    const a = h.sweepAngle;
    h.px = r.x + Math.cos(a) * REACH;
    h.py = r.y + Math.sin(a) * REACH;
    if (!h.hit && p.alive) {
      const lx = Math.cos(a);
      const ly = Math.sin(a);
      const vx = p.body.x - r.x;
      const vy = p.body.y - r.y;
      const along = vx * lx + vy * ly;
      const across = Math.abs(vx * -ly + vy * lx);
      if (along > 30 && along < REACH + 20 && across < SWEEP_WIDTH + p.body.boundR * 0.4 && p.hurt(game, 1, 'Hydra sweep')) {
        h.hit = true;
        p.body.applyImpulse(-ly * dir * 300 * p.body.mass, lx * dir * 300 * p.body.mass);
      }
    }
    if (done) {
      h.state = 'idle';
      h.attack = null;
      h.t = 0;
    }
  }

  /** Thrown things knock heads down; HOT ones burn the stump so nothing grows back. */
  private strikeHeads(game: Game, boss: Enemy): void {
    if (this.headless) return;
    const flying = game.objects.filter((o) => o.alive && o.thrownByPlayer && o.body.speed() > 180);
    if (flying.length === 0) return;
    for (const h of this.heads) {
      if (h.state === 'dead' || h.state === 'rising' || h.hitCd > 0) continue;
      const r = this.rootOf(boss, h);
      const pts: Array<[number, number]> = [];
      for (let k = 0; k <= 3; k++) pts.push([r.x + (h.px - r.x) * (k / 3), r.y + (h.py - r.y) * (k / 3)]);
      for (const o of flying) {
        const hit = pts.some(([x, y]) => Math.hypot(o.body.x - x, o.body.y - y) < o.body.boundR + 24);
        if (!hit) continue;
        const hot = o.def.id === 'iron' || o.burning;
        const sp = o.body.speed();
        let dmg = Math.min(h.maxHp * 0.7, 12 + sp * o.body.mass * 0.0016);
        if (h.state === 'stuck') dmg *= STUCK_BONUS;
        h.hp -= dmg;
        h.hitCd = 0.3;
        o.body.vx *= 0.35;
        o.body.vy *= 0.35;
        game.fx.burst(h.state === 'stuck' ? 'SQUISH!' : 'WHAP!', h.px, h.py - 20, 0.8, '#e6f4ff', true);
        if (hot) {
          // a hot hit seals the head even if it is not the killing blow: it will not split
          h.hp -= h.maxHp * 0.25;
          if (!h.sealed && h.hp > 0) {
            game.fx.burst('SEALED!', h.px, h.py - 30, 0.9, '#ffb347', true);
            game.particles.burst('smoke', h.px, h.py, 2, 60);
          }
          h.sealed = true;
        }
        if (h.hp <= 0) this.killHead(game, boss, h, h.sealed);
        break;
      }
    }
  }

  private killHead(game: Game, boss: Enemy, h: Head, cauterized: boolean): void {
    h.state = 'dead';
    h.attack = null;
    game.hitStop(0.05);
    if (cauterized) {
      game.fx.burst('CAUTERIZED!', h.px, h.py - 30, 1.2, '#ffb347', true);
      game.particles.burst('smoke', h.px, h.py, 3, 90);
      game.particles.burst('spark', h.px, h.py, 5, 200, { color: '#ffb347' });
      game.audio.play('ignite', 0.8);
    } else if (this.alive + 2 <= MAX_HEADS) {
      game.fx.burst('TWO MORE HEADS!', h.px, h.py - 30, 1.1, '#ff6b6b', true);
      game.audio.play('plop', 0.8);
      for (const off of [-0.45, 0.45]) {
        const n = this.newHead(h.angle + off, Math.max(18, h.maxHp * 0.65), true);
        const r = this.rootOf(boss, n);
        n.px = r.x;
        n.py = r.y;
        n.state = 'rising';
        n.t = 0;
        this.heads.push(n);
      }
      this.taunt(game, boss, pickLine(['Two for the price of one!', 'Heads I win!']), '#ffd6d6', true);
      if (!this.splitHinted) {
        this.splitHinted = true;
        game.hud.hint('GRAB THE IRON', 'a head hit by the hot iron never grows back', 2.8);
      }
    } else {
      game.fx.burst('SEVERED!', h.px, h.py - 30, 1.0, '#ff9f9f', true);
    }
    if (this.alive === 0) this.makeHeadless(game, boss);
  }

  private makeHeadless(game: Game, boss: Enemy): void {
    this.headless = true;
    game.fx.burst('HEADLESS!', boss.body.x, boss.body.y - 100, 1.4, '#ffd23f', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 110, 0.5, 'rgba(255,210,63,0.9)', 5);
    game.hud.hint('HEADLESS', 'now hit the machine', 2.4);
    game.hitStop(0.07);
  }

  private taunt(game: Game, boss: Enemy, line: string, color = '#e0f1ff', force = false): void {
    if (!force && game.time - this.tauntAt < 2.6) return;
    this.tauntAt = game.time;
    game.popup(line, boss.body.x, boss.body.y - 132, color, 19, 2.2);
  }

  // ───────────── drawing ─────────────

  drawFloor(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    if (boss.defeated) return;
    void game;
    const pulse = 0.55 + 0.45 * Math.sin(time * 12);
    for (const h of this.heads) {
      if (h.state === 'dead' || h.state !== 'windup') continue;
      const r = this.rootOf(boss, h);
      if (h.attack === 'bite') {
        const total = BITE_WINDUP;
        const f = Math.min(1, h.t / total);
        ctx.strokeStyle = `rgba(120, 200, 255, ${0.55 + 0.3 * pulse})`;
        ctx.fillStyle = `rgba(120, 200, 255, ${0.1 + 0.1 * pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(h.tx, h.ty, BITE_RADIUS, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(h.tx, h.ty, BITE_RADIUS * (1 - f), 0, TAU);
        ctx.stroke();
      } else if (h.attack === 'sweep') {
        const lo = Math.min(h.sweepFrom, h.sweepTo);
        const hi = Math.max(h.sweepFrom, h.sweepTo);
        ctx.fillStyle = `rgba(120, 200, 255, ${0.1 + 0.1 * pulse})`;
        ctx.strokeStyle = `rgba(150, 215, 255, ${0.55 + 0.3 * pulse})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.arc(r.x, r.y, REACH, lo, hi);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    // the irons: the answer to the hydra
    for (const iron of this.irons) {
      ctx.strokeStyle = `rgba(255, 150, 90, ${0.55 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(iron.body.x, iron.body.y, 28, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawAir(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    void game;
    if (boss.defeated) return;
    for (const h of this.heads) {
      if (h.state === 'dead') continue;
      const rise = h.state === 'rising' ? h.rise : 1;
      if (rise <= 0) continue;
      const r = this.rootOf(boss, h);
      const tipX = r.x + (h.px - r.x) * rise;
      const tipY = r.y + (h.py - r.y) * rise;
      const lift = h.state === 'windup' ? 60 : h.state === 'idle' ? 70 : 20;
      const midX = (r.x + tipX) / 2 + Math.sin(time * 3 + h.sway) * 12;
      const midY = Math.min(r.y, tipY) - lift * rise;
      const stuck = h.state === 'stuck';
      const size = h.small ? 0.75 : 1;
      // the neck: a stripy sock
      for (const [w, col] of [[22, INK], [17, h.colour]] as const) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w * size * (0.5 + 0.5 * rise);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.quadraticCurveTo(midX, midY, tipX, tipY);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 3;
      for (let k = 1; k <= 4; k++) {
        const u = k / 5;
        const x = (1 - u) * (1 - u) * r.x + 2 * (1 - u) * u * midX + u * u * tipX;
        const y = (1 - u) * (1 - u) * r.y + 2 * (1 - u) * u * midY + u * u * tipY;
        ctx.beginPath();
        ctx.arc(x, y, 6 * size, 0.3, 2.8);
        ctx.stroke();
      }
      // the head: a sock puppet with eyes and a mouth
      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.scale(size, size);
      ctx.fillStyle = stuck ? '#ffd2d2' : h.colour;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 19, 15, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(side * 7, -4, 4.4, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(side * 7 + 1, -3.4, 1.8, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
      }
      ctx.fillStyle = '#5a1a22';
      ctx.beginPath();
      ctx.ellipse(0, 7, 8, h.state === 'windup' ? 6 : 3.4, 0, 0, TAU);
      ctx.fill();
      if (h.sealed) {
        // the iron's mark: a scorched triangle on the brow, still glowing
        ctx.fillStyle = '#3a2418';
        ctx.beginPath();
        ctx.moveTo(-9, -13);
        ctx.lineTo(9, -13);
        ctx.lineTo(0, -4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(255, 150, 60, ${0.55 + 0.35 * Math.sin(time * 9 + h.sway)})`;
        ctx.beginPath();
        ctx.moveTo(-5, -12);
        ctx.lineTo(5, -12);
        ctx.lineTo(0, -7);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      if (h.state !== 'rising') {
        const bw = 34;
        ctx.fillStyle = 'rgba(16, 12, 24, 0.85)';
        ctx.fillRect(tipX - bw / 2 - 2, tipY - 34, bw + 4, 8);
        ctx.fillStyle = stuck ? '#ffe28a' : h.sealed ? '#ffb347' : '#7ec8ff';
        ctx.fillRect(tipX - bw / 2, tipY - 32, bw * Math.max(0, h.hp / h.maxHp), 4);
      }
    }
    if (this.headless) {
      for (let i = 0; i < 3; i++) {
        const a = time * 4 + (i * TAU) / 3;
        const sx = boss.body.x + Math.cos(a) * 26;
        const sy = boss.body.y - 80 + Math.sin(a) * 6;
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
