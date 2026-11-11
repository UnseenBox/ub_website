import { INK } from '../../core/constants';
import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { BossScript } from './BossScript';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * THE KING OF JUNK: "your deposit is forfeit. so are you."
 *
 * A FIGHT AGAINST A CROWN OF RUBBISH. He is a tower of wardrobes with a RING OF JUNK spinning round him,
 * and the ring is his armour: the more pieces are in orbit, the less your hits count (the full ring
 * lets 15% through). Throw something at the ring and you knock a piece loose, which thins the armour
 * and costs him a little health. Clear the ring and the king is BARE, taking +70% for a few seconds,
 * until he calls the rubbish back, piece by piece.
 *
 * BUT HIS ATTACKS COST HIM ARMOUR. His best weapon is the junk itself, so every piece he hurls at you
 * is a piece that is no longer protecting him. Bait the volleys and the ring thins itself.
 *
 * ATTACKS (telegraphed, shuffled):
 *   HURL    a line is drawn from him, then a piece of the ring flies out along it.
 *   CRASH   the tower slams: a circle grows round him, then it blows.
 *   TIDY    "MINE!": a pull drags you in, and a small blast waits at the end. Fight the pull.
 * Below a quarter health it is THE KING DEMANDS: a bigger, faster ring that regrows quicker and volleys of three.
 *
 * THE ENTRANCE. The room is quiet. Rubbish flies in from every wall, piece by piece, and lands in orbit
 * round a tower that rises out of the floor. The last piece clangs on, and he opens with one hurl.
 */

export const RING_STEP = 0.14;
export const RING_FLOOR = 0.15;
export const BARE_BONUS = 1.7;
/** Fraction of his max health a knocked-loose piece takes. */
export const KNOCK_DAMAGE = 0.025;
const RING_SIZE = 6;
const RING_SIZE_FINALE = 8;
const ORBIT_R = 118;
const PIECE_R = 30;
const BARE_SECONDS = 4.2;
const BARE_SECONDS_FINALE = 3.4;
const REGROW = 4.8;
const REGROW_FINALE = 2.8;
const HURL_SPEED = 740;
const HURL_LENGTH = 640;
const HURL_WIDTH = 50;
const CRASH_RADIUS = 200;
const TIDY_RADIUS = 340;
const TIDY_BLAST = 135;
const GAP = 3.0;
const GAP_OVERTIME = 2.3;
const GAP_FINALE = 1.5;

export type JunkAttack = 'hurl' | 'crash' | 'tidy';

interface Piece {
  /** 0..5: which bit of rubbish it is, for the drawing code */
  kind: number;
  ang: number;
  state: 'orbit' | 'incoming' | 'fired' | 'dead';
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  fromX: number;
  fromY: number;
  hit: boolean;
  travelled: number;
}

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

export class JunkScript implements BossScript {
  readonly deathText = 'JUNK REMOVED!';

  time = 0;
  finale = false;
  pieces: Piece[] = [];
  /** Seconds he is bare, taking bonus damage. */
  bare = 0;
  private spin = 0;
  private tauntAt = -9;
  private tauntedHalf = false;
  private chipAt = -9;
  private gap = 2.5;
  private regrowT = 3;
  private deck: JunkAttack[] = [];
  private lastKind: JunkAttack | null = null;

  intro: 'gather' | 'done' = 'gather';
  introT = 0;
  private spawned = 0;
  /** How far the tower has risen from the floor, 0..1, for the drawing code. */
  rise = 0;

  attack: JunkAttack | null = null;
  stage: 'windup' | 'go' | 'recover' = 'windup';
  stageT = 0;
  // hurl
  hurlAngles: number[] = [];
  private hurlVolleys = 0;
  private hurlFired = 0;
  // tidy
  private tidyHit = false;
  private blasted = false;

  get busy(): boolean {
    return this.attack !== null || this.intro !== 'done' || this.bare > 0;
  }

  get ringCount(): number {
    return this.pieces.filter((p) => p.state === 'orbit').length;
  }

  private maxRing(): number {
    return this.finale ? RING_SIZE_FINALE : RING_SIZE;
  }

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    this.spin += dt * (this.finale ? 2.0 : 1.3);
    this.updatePieces(game, boss, dt);
    if (this.intro !== 'done') {
      this.runIntro(game, boss, dt);
      return;
    }
    this.checkKnocks(game, boss);
    if (!this.finale && boss.hp <= boss.maxHp * 0.25) this.startFinale(game, boss);
    const overtime = boss.phaseIndex >= 1 || this.finale;
    if (overtime && !this.tauntedHalf) {
      this.tauntedHalf = true;
      this.taunt(game, boss, 'THE KING DEMANDS!', '#e0c8ff', true);
    }

    if (this.bare > 0) {
      this.bare -= dt;
      boss.body.vx = 0;
      boss.body.vy = 0;
      if (this.bare <= 0) this.callBack(game, boss);
      return;
    }
    // he calls rubbish back into the ring
    if (this.ringCount + this.pieces.filter((p) => p.state === 'incoming').length < this.maxRing()) {
      this.regrowT -= dt;
      if (this.regrowT <= 0) {
        this.regrowT = this.finale ? REGROW_FINALE : REGROW;
        this.spawnPiece(game, boss);
      }
    }
    if (this.attack && (boss.stun > 0 || boss.shockTimer > 0 || boss.burn > 0 || boss.confuse > 0)) this.endAttack(overtime);
    if (this.attack) {
      this.stageT += dt;
      switch (this.attack) {
        case 'hurl': this.runHurl(game, boss, overtime); break;
        case 'crash': this.runCrash(game, boss, overtime); break;
        case 'tidy': this.runTidy(game, boss, dt, overtime); break;
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
    if (this.bare > 0) return amount * BARE_BONUS;
    boss.blockFlash = 1;
    if (game.time - this.chipAt > 1.3) {
      this.chipAt = game.time;
      game.fx.burst('JUNK ARMOUR!', boss.body.x, boss.body.y - 96, 0.8, '#e0c8ff', true);
    }
    return amount * Math.max(RING_FLOOR, 1 - RING_STEP * this.ringCount);
  }

  onDefeat(game: Game, boss: Enemy): void {
    this.attack = null;
    for (const p of this.pieces) p.state = 'dead';
    game.popup('...my... collection...', boss.body.x, boss.body.y - 124, '#e0c8ff', 20, 2.4);
  }

  aimPoints(boss: Enemy): ReadonlyArray<{ x: number; y: number }> | null {
    const pts = this.pieces.filter((p) => p.state === 'orbit').map((p) => ({ x: p.x, y: p.y }));
    void boss;
    return pts.length > 0 ? pts : null;
  }

  // ───────────── the ring ─────────────

  private spawnPiece(game: Game, boss: Enemy, kind = Math.floor(Math.random() * 6)): void {
    const bounds = game.world.bounds;
    // a free slot in the ring, then fly in from a random edge
    const used = this.pieces.filter((p) => p.state === 'orbit' || p.state === 'incoming');
    const n = this.maxRing();
    let slot = 0;
    for (let s = 0; s < n; s++) {
      const a = (s * TAU) / n;
      if (!used.some((p) => Math.abs(Math.atan2(Math.sin(p.ang - a), Math.cos(p.ang - a))) < 0.3)) {
        slot = s;
        break;
      }
    }
    const edge = Math.floor(Math.random() * 4);
    const fx = edge === 0 ? bounds.x0 : edge === 1 ? bounds.x1 : bounds.x0 + Math.random() * (bounds.x1 - bounds.x0);
    const fy = edge === 2 ? bounds.y0 : edge === 3 ? bounds.y1 : bounds.y0 + Math.random() * (bounds.y1 - bounds.y0);
    this.pieces.push({
      kind, ang: (slot * TAU) / n, state: 'incoming', x: fx, y: fy, vx: 0, vy: 0, t: 0, fromX: fx, fromY: fy, hit: false, travelled: 0,
    });
    void boss;
  }

  private updatePieces(game: Game, boss: Enemy, dt: number): void {
    const b = boss.body;
    const p0 = game.player;
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i]!;
      if (p.state === 'dead') {
        this.pieces.splice(i, 1);
        continue;
      }
      if (p.state === 'orbit') {
        const a = p.ang + this.spin;
        p.x = b.x + Math.cos(a) * ORBIT_R;
        p.y = b.y + Math.sin(a) * ORBIT_R;
      } else if (p.state === 'incoming') {
        p.t += dt / 0.7;
        const a = p.ang + this.spin;
        const tx = b.x + Math.cos(a) * ORBIT_R;
        const ty = b.y + Math.sin(a) * ORBIT_R;
        const u = Math.min(1, p.t);
        const e = u * u;
        p.x = p.fromX + (tx - p.fromX) * e;
        p.y = p.fromY + (ty - p.fromY) * e - Math.sin(u * Math.PI) * 80;
        if (u >= 1) {
          p.state = 'orbit';
          game.fx.ring(tx, ty, 4, 40, 0.25, 'rgba(224,200,255,0.9)', 3);
          game.audio.play('stamp', 0.4);
        }
      } else if (p.state === 'fired') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.travelled += Math.hypot(p.vx, p.vy) * dt;
        if (!p.hit && p0.alive && Math.hypot(p0.body.x - p.x, p0.body.y - p.y) < PIECE_R + p0.body.boundR * 0.4) {
          if (p0.hurt(game, 1, 'Flung junk')) {
            p.hit = true;
            const d = Math.hypot(p.vx, p.vy) || 1;
            p0.body.applyImpulse((p.vx / d) * 260 * p0.body.mass, (p.vy / d) * 260 * p0.body.mass);
            game.particles.burst('scrap', p.x, p.y - 8, 5, 240, { color: '#e0c8ff' });
          }
        }
        const bounds = game.world.bounds;
        if (p.travelled >= HURL_LENGTH || p.x < bounds.x0 - 40 || p.x > bounds.x1 + 40 || p.y < bounds.y0 - 40 || p.y > bounds.y1 + 40) {
          game.particles.burst('scrap', p.x, p.y - 8, 5, 200, { color: '#e0c8ff' });
          p.state = 'dead';
        }
      }
    }
  }

  /** A thrown object through the ring knocks a piece loose. */
  private checkKnocks(game: Game, boss: Enemy): void {
    if (this.bare > 0) return;
    for (const o of game.objects) {
      if (!o.alive || !o.thrownByPlayer || o.body.speed() < 110) continue;
      for (const p of this.pieces) {
        if (p.state !== 'orbit') continue;
        if (Math.hypot(o.body.x - p.x, o.body.y - p.y) < PIECE_R + o.body.boundR) {
          this.knock(game, boss, p, o.body.vx, o.body.vy);
          break;
        }
      }
    }
  }

  /** Knocks one piece off. Public so a test can do it without aiming. */
  knock(game: Game, boss: Enemy, p: Piece, vx: number, vy: number): void {
    if (p.state !== 'orbit') return;
    p.state = 'dead';
    game.fx.burst('KNOCKED!', p.x, p.y - 30, 1.1, '#e0c8ff', true);
    game.fx.ring(p.x, p.y, 6, 70, 0.3, 'rgba(224,200,255,0.95)', 4);
    game.particles.burst('scrap', p.x, p.y - 8, 7, 300, { color: '#e0c8ff' });
    game.audio.play('stamp', 0.8);
    game.hitStop(0.05);
    void vx;
    void vy;
    this.bypassDamage(game, boss, boss.maxHp * KNOCK_DAMAGE, p.x, p.y);
    if (boss.defeated) return;
    if (this.ringCount === 0 && !this.pieces.some((q) => q.state === 'incoming')) this.goBare(game, boss);
  }

  private goBare(game: Game, boss: Enemy): void {
    this.bare = this.finale ? BARE_SECONDS_FINALE : BARE_SECONDS;
    this.attack = null;
    boss.squash = 1;
    boss.body.vx = 0;
    boss.body.vy = 0;
    game.fx.burst('BARE KING!', boss.body.x, boss.body.y - 100, 1.5, '#ffd23f', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 150, 0.5, 'rgba(255,210,63,0.9)', 5);
    game.audio.play('alarm', 0.8);
    game.hitStop(0.08);
    game.hud.banner('BARE KING', 'no armour: hit him now', 2.4);
    this.taunt(game, boss, pickLine(['My collection!', 'Who took my junk?!']), '#ffe9a8', true);
  }

  private callBack(game: Game, boss: Enemy): void {
    this.regrowT = 0.2;
    for (let i = 0; i < this.maxRing(); i++) this.spawnPiece(game, boss, i % 6);
    game.fx.burst('COME BACK!', boss.body.x, boss.body.y - 96, 1.0, '#e0c8ff', true);
    game.audio.play('hiss', 0.6);
    this.gap = 1.6;
  }

  // ───────────── entrance ─────────────

  private runIntro(game: Game, boss: Enemy, dt: number): void {
    this.introT += dt;
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    if (this.introT === dt) {
      const bounds = game.world.bounds;
      b.x = (bounds.x0 + bounds.x1) / 2;
      b.y = (bounds.y0 + bounds.y1) / 2 - 10;
      game.camera.focus(b.x, b.y, 3.0, 1.05);
      game.audio.play('hiss', 0.8);
    }
    this.rise = Math.min(1, this.introT / 1.2);
    boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
    while (this.spawned < RING_SIZE && this.introT >= 0.8 + this.spawned * 0.4) {
      this.spawnPiece(game, boss, this.spawned);
      this.spawned++;
    }
    if (this.introT >= 3.6 && this.ringCount >= RING_SIZE) {
      game.fx.burst('KING OF JUNK!', b.x, b.y - 104, 1.4, '#e0c8ff', true);
      game.fx.ring(b.x, b.y, 10, 240, 0.5, 'rgba(224,200,255,0.9)', 5);
      game.audio.play('alarm', 0.6);
      game.camera.punchZoom(0.03);
      game.hitStop(0.05);
      game.hud.banner('KNOCK HIS JUNK OFF', 'throw things at the ring to thin his armour', 3.8);
      this.taunt(game, boss, pickLine(['Your deposit is forfeit!', 'All of this is MINE!']), '#e0c8ff', true);
      this.finishIntro(game, boss);
    }
  }

  /** Ends the entrance and starts the fight. Public so a test can skip ahead. */
  finishIntro(game: Game, boss: Enemy, openWithHurl = true): void {
    // fill the ring at once if the entrance was skipped
    while (this.pieces.filter((p) => p.state === 'orbit' || p.state === 'incoming').length < RING_SIZE) {
      this.spawnPiece(game, boss, this.pieces.length % 6);
    }
    for (const p of this.pieces) {
      if (p.state === 'incoming') p.t = 1;
    }
    this.updatePieces(game, boss, 0);
    this.rise = 1;
    this.intro = 'done';
    this.introT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    boss.aware = true;
    boss.ai = 'chase';
    boss.aiTimer = 0;
    this.attack = null;
    this.gap = 1.2;
    this.regrowT = 3;
    this.deck = ['tidy', 'crash'];
    if (openWithHurl) this.beginAttack(game, boss, 'hurl');
  }

  // ───────────── director ─────────────

  private pick(): JunkAttack {
    if (this.deck.length === 0) {
      const all: JunkAttack[] = ['hurl', 'crash', 'tidy'];
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
  beginAttack(game: Game, boss: Enemy, kind: JunkAttack): void {
    if (kind === 'hurl' && this.ringCount === 0) kind = 'crash';
    this.attack = kind;
    this.stage = 'windup';
    this.stageT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    switch (kind) {
      case 'hurl':
        this.hurlVolleys = Math.min(this.ringCount, this.finale ? 3 : boss.phaseIndex >= 1 ? 2 : 1);
        this.hurlFired = 0;
        this.aimHurl(game, boss);
        game.fx.burst('HURL!', boss.body.x, boss.body.y - 100, 1.2, '#ff9f9f', true);
        game.audio.play('alarm', 0.5);
        this.taunt(game, boss, pickLine(['Take this junk!', 'Catch!']));
        break;
      case 'crash':
        game.fx.burst('CRASH!', boss.body.x, boss.body.y - 100, 1.3, '#ff9f9f', true);
        game.audio.play('alarm', 0.6);
        this.taunt(game, boss, pickLine(['TIMBER!', 'Evicted!']));
        break;
      case 'tidy':
        this.tidyHit = false;
        this.blasted = false;
        game.fx.burst('MINE!', boss.body.x, boss.body.y - 100, 1.3, '#e0c8ff', true);
        game.audio.play('hiss', 0.8);
        this.taunt(game, boss, pickLine(['MINE! MINE! MINE!', 'Come to papa!']));
        break;
    }
  }

  private endAttack(overtime: boolean): void {
    this.attack = null;
    this.hurlAngles = [];
    this.gap = this.finale ? GAP_FINALE : overtime ? GAP_OVERTIME : GAP;
  }

  private startFinale(game: Game, boss: Enemy): void {
    this.finale = true;
    this.attack = null;
    this.gap = 1.0;
    boss.rageMult = Math.max(boss.rageMult, 1.2);
    // a bigger ring: two more pieces fly in
    this.spawnPiece(game, boss, 1);
    this.spawnPiece(game, boss, 4);
    game.hud.banner('THE KING DEMANDS', 'a bigger, faster ring', 2.6);
    game.fx.burst('THE KING DEMANDS!', boss.body.x, boss.body.y - 112, 1.5, '#e0c8ff', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 170, 0.6, 'rgba(224,200,255,0.9)', 6);
    game.fx.flash('#e0c8ff', 0.12);
    game.audio.play('alarm', 1);
    this.taunt(game, boss, 'MORE TRIBUTE!', '#e0c8ff', true);
  }

  private taunt(game: Game, boss: Enemy, line: string, color = '#e0c8ff', force = false): void {
    if (!force && game.time - this.tauntAt < 2.8) return;
    this.tauntAt = game.time;
    game.popup(line, boss.body.x, boss.body.y - 132, color, 19, 2.2);
  }

  // ───────────── HURL ─────────────

  private aimHurl(game: Game, boss: Enemy): void {
    const p = game.player.body;
    const b = boss.body;
    const base = Math.atan2(p.y - b.y, p.x - b.x);
    const n = Math.max(1, this.hurlVolleys);
    this.hurlAngles = [];
    for (let i = 0; i < n; i++) this.hurlAngles.push(base + (i - (n - 1) / 2) * 0.42);
  }

  private runHurl(game: Game, boss: Enemy, overtime: boolean): void {
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    const windup = this.finale ? 0.85 : 1.05;
    if (this.stage === 'windup') {
      if (this.stageT < windup - 0.3) this.aimHurl(game, boss);
      boss.facing = this.hurlAngles[0] ?? 0;
      if (this.stageT >= windup) {
        this.stage = 'go';
        this.stageT = 0;
        this.hurlFired = 0;
      }
      return;
    }
    if (this.stage === 'go') {
      if (this.hurlFired < this.hurlAngles.length && this.stageT >= this.hurlFired * 0.22) {
        this.fireOne(game, boss, this.hurlAngles[this.hurlFired]!);
        this.hurlFired++;
      }
      if (this.hurlFired >= this.hurlAngles.length && this.stageT > 0.5) {
        this.stage = 'recover';
        this.stageT = 0;
      }
      return;
    }
    if (this.stageT > 0.7) this.endAttack(overtime);
  }

  private fireOne(game: Game, boss: Enemy, ang: number): void {
    // the piece nearest that direction leaves the ring
    let best: Piece | null = null;
    let bd = 99;
    for (const p of this.pieces) {
      if (p.state !== 'orbit') continue;
      const a = Math.atan2(p.y - boss.body.y, p.x - boss.body.x);
      const d = Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang)));
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (!best) return;
    best.state = 'fired';
    // it leaves along the drawn line, not from wherever it happened to be
    best.x = boss.body.x + Math.cos(ang) * ORBIT_R;
    best.y = boss.body.y + Math.sin(ang) * ORBIT_R;
    best.vx = Math.cos(ang) * HURL_SPEED;
    best.vy = Math.sin(ang) * HURL_SPEED;
    best.travelled = 0;
    best.hit = false;
    game.audio.play('swipe', 0.8);
    game.fx.burst('FLING!', best.x, best.y - 30, 0.8, '#ffe0e0', true);
    boss.squash = 0.5;
  }

  // ───────────── CRASH ─────────────

  private runCrash(game: Game, boss: Enemy, overtime: boolean): void {
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    const windup = this.finale ? 1.15 : 1.4;
    if (this.stage === 'windup') {
      if (this.stageT >= windup) {
        this.stage = 'recover';
        this.stageT = 0;
        game.fx.burst('CRASH!', b.x, b.y - 90, 1.4, '#ffe9a8', true);
        game.fx.ring(b.x, b.y, 10, CRASH_RADIUS, 0.4, 'rgba(224,200,255,0.95)', 6);
        game.particles.burst('scrap', b.x, b.y - 10, 8, 320, { color: '#e0c8ff' });
        game.audio.play('explosion', 0.8);
        game.hitStop(0.08);
        boss.squash = 1;
        const p = game.player;
        const dx = p.body.x - b.x;
        const dy = p.body.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        if (p.alive && d < CRASH_RADIUS && p.hurt(game, 1, 'Junk crash')) {
          p.body.applyImpulse((dx / d) * 320 * p.body.mass, (dy / d) * 320 * p.body.mass);
        }
      }
      return;
    }
    if (this.stageT > 0.9) this.endAttack(overtime);
  }

  // ───────────── TIDY ─────────────

  private runTidy(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const b = boss.body;
    b.vx = 0;
    b.vy = 0;
    const p = game.player;
    if (this.stage === 'windup') {
      if (this.stageT >= 0.9) {
        this.stage = 'go';
        this.stageT = 0;
        game.audio.play('hiss', 1);
      }
      return;
    }
    if (this.stage === 'go') {
      // the pull: stronger the closer you are
      const dx = b.x - p.body.x;
      const dy = b.y - p.body.y;
      const d = Math.hypot(dx, dy) || 1;
      if (p.alive && d < TIDY_RADIUS) {
        const f = 1 - d / TIDY_RADIUS * 0.5;
        p.body.applyImpulse((dx / d) * 420 * f * dt * p.body.mass, (dy / d) * 420 * f * dt * p.body.mass);
      }
      for (const o of game.objects) {
        if (!o.alive || o.held || o.def.fixed) continue;
        const ox = b.x - o.body.x;
        const oy = b.y - o.body.y;
        const od = Math.hypot(ox, oy) || 1;
        if (od < TIDY_RADIUS) {
          o.body.applyImpulse((ox / od) * 300 * dt * o.body.mass, (oy / od) * 300 * dt * o.body.mass);
          o.body.wake();
        }
      }
      if (this.stageT >= (this.finale ? 1.2 : 1.5) && !this.blasted) {
        this.blasted = true;
        game.fx.burst('TIDIED!', b.x, b.y - 90, 1.3, '#ffe9a8', true);
        game.fx.ring(b.x, b.y, 10, TIDY_BLAST, 0.35, 'rgba(224,200,255,0.95)', 6);
        game.particles.burst('scrap', b.x, b.y - 10, 6, 300, { color: '#e0c8ff' });
        game.audio.play('explosion', 0.7);
        game.hitStop(0.06);
        if (p.alive && !this.tidyHit && Math.hypot(p.body.x - b.x, p.body.y - b.y) < TIDY_BLAST + boss.type.radius * 0.3 && p.hurt(game, 1, 'Tidy blast')) {
          this.tidyHit = true;
          const ddx = p.body.x - b.x;
          const ddy = p.body.y - b.y;
          const dd = Math.hypot(ddx, ddy) || 1;
          p.body.applyImpulse((ddx / dd) * 300 * p.body.mass, (ddy / dd) * 300 * p.body.mass);
        }
        this.stage = 'recover';
        this.stageT = 0;
      }
      return;
    }
    if (this.stageT > 0.9) this.endAttack(overtime);
  }

  // ───────────── damage helper ─────────────

  private bypass = false;

  private bypassDamage(game: Game, boss: Enemy, amount: number, fromX: number, fromY: number): void {
    const dx = boss.body.x - fromX;
    const dy = boss.body.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    this.bypass = true;
    boss.damage(game, amount, {
      type: 'impact', source: null, chain: null, label: 'his own junk', dirX: dx / d, dirY: dy / d,
    });
    this.bypass = false;
  }

  // ───────────── drawing ─────────────

  drawFloor(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    if (boss.defeated) return;
    void game;
    const b = boss.body;
    const pulse = 0.55 + 0.45 * Math.sin(time * 12);
    // hurl lines
    if (this.attack === 'hurl' && this.stage === 'windup') {
      for (const a of this.hurlAngles) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(a);
        ctx.fillStyle = `rgba(255, 90, 70, ${0.12 + 0.12 * pulse})`;
        ctx.strokeStyle = `rgba(255, 130, 110, ${0.6 + 0.3 * pulse})`;
        ctx.lineWidth = 3;
        ctx.fillRect(ORBIT_R, -HURL_WIDTH / 2, HURL_LENGTH - ORBIT_R, HURL_WIDTH);
        ctx.strokeRect(ORBIT_R, -HURL_WIDTH / 2, HURL_LENGTH - ORBIT_R, HURL_WIDTH);
        ctx.restore();
      }
    }
    // crash circle
    if (this.attack === 'crash' && this.stage === 'windup') {
      const f = Math.min(1, this.stageT / (this.finale ? 1.15 : 1.4));
      ctx.fillStyle = `rgba(255, 90, 70, ${0.08 + 0.16 * f * pulse})`;
      ctx.strokeStyle = `rgba(255, 130, 110, ${0.5 + 0.4 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, CRASH_RADIUS, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(224, 200, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, CRASH_RADIUS * f, 0, TAU);
      ctx.fill();
    }
    // tidy: the pull radius and the blast waiting at the end
    if (this.attack === 'tidy' && this.stage !== 'recover') {
      ctx.strokeStyle = `rgba(224, 200, 255, ${0.35 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 12]);
      ctx.lineDashOffset = this.stage === 'go' ? time * 60 : 0;
      ctx.beginPath();
      ctx.arc(b.x, b.y, TIDY_RADIUS, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255, 90, 70, ${0.08 + 0.12 * pulse})`;
      ctx.strokeStyle = `rgba(255, 130, 110, ${0.5 + 0.4 * pulse})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, TIDY_BLAST + boss.type.radius * 0.3, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  }

  drawAir(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    void game;
    if (boss.defeated) return;
    const b = boss.body;
    // the ring of junk: six kinds of rubbish
    for (const p of this.pieces) {
      if (p.state === 'dead') continue;
      ctx.save();
      ctx.translate(p.x, p.y - 22);
      ctx.rotate(time * 3 + p.kind);
      const hot = p.state === 'fired';
      ctx.fillStyle = hot ? '#ff9f9f' : ['#8f6b4a', '#c9b38c', '#6b8f7a', '#b05a5a', '#7a8fb0', '#d2c06a'][p.kind % 6]!;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      switch (p.kind % 3) {
        case 0:
          ctx.fillRect(-20, -14, 40, 28);
          ctx.strokeRect(-20, -14, 40, 28);
          break;
        case 1:
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, TAU);
          ctx.fill();
          ctx.stroke();
          break;
        default:
          ctx.beginPath();
          ctx.moveTo(-22, 12);
          ctx.lineTo(0, -18);
          ctx.lineTo(22, 12);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
      }
      ctx.restore();
    }
    if (this.bare > 0) {
      for (let i = 0; i < 3; i++) {
        const a = time * 4 + (i * TAU) / 3;
        const sx = b.x + Math.cos(a) * 26;
        const sy = b.y - 92 + Math.sin(a) * 6;
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
