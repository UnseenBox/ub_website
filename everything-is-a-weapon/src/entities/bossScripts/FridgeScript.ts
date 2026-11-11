import { INK } from '../../core/constants';
import type { Game } from '../../core/Game';
import type { DamageCause } from '../../core/types';
import type { Enemy } from '../Enemy';
import type { BossScript } from './BossScript';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * FRIDGEZILLA: "serve chilled".
 *
 * ARMOUR AND A BACK DOOR. Frost plates cover his front: hits there crack them (two to a plate, or
 * one heavy one), and he shrugs the rest off. But a fridge has a compressor on its back, and a hit
 * from BEHIND goes straight in for full damage. So the fight is about getting round him: his
 * attacks lock his aim while they wind up, and that is your moment to flank. Fire melts every
 * plate at once (MELTED!). With the plates gone he is THAWED: stunned, soaked, and taking extra
 * damage, until the frost grows back.
 *
 * ATTACKS (telegraphed, shuffled deck, opening with the clearest):
 *   DEEP FREEZE   the door swings open and a cone of cold blasts out; it freezes you in place.
 *   ICE CUBES     cubes ricochet round the room off the walls.
 *   FISH LOB      frozen fish land on marked circles, leaving the floor icy.
 *   COLD SNAP     the whole floor goes icy except one safe circle: stand in the ring.
 * Below a quarter health it is FREEZER BURN: everything in pairs, much faster.
 *
 * THE ENTRANCE. The room turns cold; he skids in across the ice with a screech, bangs to a stop in
 * the middle, and the door flies open: a plume of fog and the light comes on.
 */

export const FRONT_CHIP = 0.1;
export const BACK_BONUS = 1.6;
export const THAW_BONUS = 1.35;
export const INTERRUPT_DAMAGE = 16;
const INTERRUPT_STUN = 1.4;
const BACK_DOT = 0.35;
const HEAVY_HIT = 18;
const THAW_SECONDS = 4.5;
const CONE_RANGE = 400;
const CONE_WINDUP = 1.0;
const CONE_BLAST = 0.5;
const FISH_FUSE = 1.3;
const FISH_RADIUS = 58;
const SNAP_SAFE = 190;
const SNAP_WINDUP = 1.5;
const SNAP_ICE = 6;
const CUBE_SPEED = 290;
const GAP = 3.2;
const GAP_OVERTIME = 2.3;
const GAP_FINALE = 1.3;

export type FridgeAttack = 'cone' | 'cubes' | 'fish' | 'snap';
type Stage = 'windup' | 'go' | 'recover';

interface Cube { x: number; y: number; vx: number; vy: number; bounces: number; life: number; spin: number }
interface Fish { x: number; y: number; sx: number; sy: number; t: number; landed: boolean }

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}

export class FridgeScript implements BossScript {
  readonly deathText = 'DEFROSTED!';

  // ── armour ──
  plates = 3;
  private plateHits = 0;
  /** Seconds left of being thawed (vulnerable). */
  thaw = 0;
  finale = false;
  private bypass = false;
  private tauntAt = -9;
  private tauntedHalf = false;
  private clinkAt = -9;

  // ── entrance ──
  intro: 'skid' | 'order' | 'done' = 'skid';
  introT = 0;
  private introTarget: { x: number; y: number } | null = null;
  private opened = false;

  // ── attacks ──
  attack: FridgeAttack | null = null;
  stage: Stage = 'windup';
  stageT = 0;
  private gap = 2.4;
  private deck: FridgeAttack[] = [];
  private lastKind: FridgeAttack | null = null;
  time = 0;
  aim = 0;
  coneAngle = 0;
  private coneHit = false;
  private coneBlasts = 0;
  cubes: Cube[] = [];
  fish: Fish[] = [];
  private volley = 0;
  private volleyT = 0;
  // cold snap
  safeX = 0;
  safeY = 0;
  iceLeft = 0;

  get busy(): boolean {
    return this.attack !== null || this.intro !== 'done';
  }

  get armoured(): boolean {
    return this.plates > 0 && this.thaw <= 0;
  }

  get pose(): 'idle' | 'skid' | 'open' {
    if (this.intro === 'skid') return 'skid';
    if (this.intro === 'order') return 'open';
    if (this.attack === 'cone' && this.stage !== 'recover') return 'open';
    if (this.thaw > 0) return 'open';
    return 'idle';
  }

  update(game: Game, boss: Enemy, dt: number): void {
    this.time += dt;
    if (this.intro !== 'done') {
      this.runIntro(game, boss, dt);
      return;
    }
    this.updateIce(game, dt);
    this.updateCubes(game, dt);
    this.updateFish(game, dt);
    if (this.thaw > 0) {
      this.thaw -= dt;
      if (this.thaw <= 0) this.refreeze(game, boss);
    }
    if (!this.finale && boss.hp <= boss.maxHp * 0.25) this.startFinale(game, boss);
    const overtime = boss.phaseIndex >= 1 || this.finale;
    if (overtime && !this.tauntedHalf) {
      this.tauntedHalf = true;
      this.taunt(game, boss, 'FROZEN GOODS!', '#bfe9ff', true);
    }
    if (this.attack && (boss.stun > 0 || boss.shockTimer > 0 || boss.burn > 0 || boss.confuse > 0)) this.endAttack(overtime);
    if (this.attack) {
      this.stageT += dt;
      boss.body.vx = 0;
      boss.body.vy = 0;
      switch (this.attack) {
        case 'cone': this.runCone(game, boss, overtime); break;
        case 'cubes': this.runCubes(game, boss, dt, overtime); break;
        case 'fish': this.runFish(game, boss, dt, overtime); break;
        case 'snap': this.runSnap(game, boss, overtime); break;
      }
    } else if (this.thaw <= 0 && boss.aware && boss.ai === 'chase' && boss.stun <= 0 && boss.shockTimer <= 0 && boss.burn <= 0) {
      this.gap -= dt;
      if (this.gap <= 0) this.beginAttack(game, boss, this.pick());
    }
  }

  filterDamage(game: Game, boss: Enemy, amount: number, cause: DamageCause): number {
    if (this.bypass) return amount;
    if (this.intro === 'skid') {
      boss.blockFlash = 1;
      return 0;
    }
    if (this.attack && this.stage === 'windup' && amount >= INTERRUPT_DAMAGE) {
      this.interrupt(game, boss);
      return amount * 0.6;
    }
    if (this.thaw > 0) return amount * THAW_BONUS;
    if (this.plates <= 0) return amount;
    // fire melts the lot
    if (cause.type === 'fire' || cause.type === 'explosion') {
      this.melt(game, boss);
      return amount * 0.35;
    }
    // the compressor is on his back: a hit from behind goes straight in
    const len = Math.hypot(cause.dirX, cause.dirY);
    if (len > 0.1) {
      const dot = (cause.dirX / len) * Math.cos(boss.facing) + (cause.dirY / len) * Math.sin(boss.facing);
      if (dot > BACK_DOT) {
        game.fx.burst('COMPRESSOR!', boss.body.x, boss.body.y - 80, 0.9, '#ffb347', true);
        boss.squash = 0.8;
        return amount * BACK_BONUS;
      }
    }
    // the front: frost plates crack
    if (amount >= 5) {
      this.plateHits += amount >= HEAVY_HIT ? 2 : 1;
      if (this.plateHits >= 2) {
        this.plateHits -= 2;
        this.plates--;
        game.fx.burst('CRACK!', boss.body.x, boss.body.y - 78, 1.0, '#dff6ff', true);
        game.particles.burst('scrap', boss.body.x, boss.body.y - 40, 3, 160, { color: '#dff6ff' });
        game.audio.play('glassBreak', 0.45);
        if (this.plates <= 0) this.beThawed(game, boss);
      }
    }
    boss.blockFlash = 1;
    if (game.time - this.clinkAt > 1.2) {
      this.clinkAt = game.time;
      game.audio.play('gong', 0.3, 1.5);
    }
    return amount * FRONT_CHIP;
  }

  onDefeat(game: Game, boss: Enemy): void {
    this.attack = null;
    this.cubes.length = 0;
    this.fish.length = 0;
    this.iceLeft = 0;
    game.popup('...stay... cool...', boss.body.x, boss.body.y - 130, '#dff6ff', 20, 2.4);
  }

  // ───────────── entrance ─────────────

  private runIntro(game: Game, boss: Enemy, dt: number): void {
    this.introT += dt;
    const b = boss.body;
    if (this.intro === 'skid') {
      if (!this.introTarget) {
        const bounds = game.world.bounds;
        const cx = (bounds.x0 + bounds.x1) / 2;
        const cy = (bounds.y0 + bounds.y1) / 2;
        this.introTarget = { x: b.x + (cx - b.x) * 0.6, y: b.y + (cy - b.y) * 0.6 };
        game.camera.focus(b.x, b.y, 2.2, 1.07);
        game.audio.play('slide', 0.8);
      }
      const t = this.introTarget;
      const dx = t.x - b.x;
      const dy = t.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(430, d * 2.8);
      b.vx = (dx / d) * sp;
      b.vy = (dy / d) * sp;
      boss.facing = Math.atan2(dy, dx);
      if (Math.random() < dt * 4) game.particles.burst('dust', b.x, b.y + 6, 1, 90);
      if ((d < 24 && this.introT > 1.0) || this.introT > 4.5) {
        b.vx = 0;
        b.vy = 0;
        this.intro = 'order';
        this.introT = 0;
        this.opened = false;
      }
      return;
    }
    b.vx = 0;
    b.vy = 0;
    boss.facing = Math.atan2(game.player.body.y - b.y, game.player.body.x - b.x);
    if (!this.opened && this.introT >= 0.45) {
      this.opened = true;
      game.fx.burst('MIDNIGHT SNACK!', b.x, b.y - 104, 1.4, '#9fe3ff', true);
      game.fx.ring(b.x, b.y, 10, 240, 0.55, 'rgba(160,225,255,0.9)', 5);
      game.audio.play('hiss', 1);
      game.camera.punchZoom(0.03);
      game.hitStop(0.05);
      this.taunt(game, boss, pickLine(['Stay cool.', 'Chill out.', "It's freezing in here. You're welcome."]), '#e6f8ff', true);
    }
    if (this.introT >= 1.3) this.finishIntro(game, boss);
  }

  /** Ends the entrance and starts the fight. Public so a test can skip ahead. */
  finishIntro(game: Game, boss: Enemy, openWithCone = true): void {
    this.intro = 'done';
    this.introT = 0;
    boss.body.vx = 0;
    boss.body.vy = 0;
    boss.aware = true;
    boss.ai = 'chase';
    boss.aiTimer = 0;
    this.attack = null;
    this.gap = 1.6;
    this.deck = ['snap', 'fish', 'cubes'];
    if (openWithCone) this.beginAttack(game, boss, 'cone');
  }

  // ───────────── director ─────────────

  private pick(): FridgeAttack {
    if (this.deck.length === 0) {
      const all: FridgeAttack[] = ['cone', 'cubes', 'fish', 'snap'];
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
  beginAttack(game: Game, boss: Enemy, kind: FridgeAttack): void {
    this.attack = kind;
    this.stage = 'windup';
    this.stageT = 0;
    this.aim = Math.atan2(game.player.body.y - boss.body.y, game.player.body.x - boss.body.x);
    // his aim locks now: the wind-up is the window to get round behind him
    boss.facing = this.aim;
    boss.body.vx = 0;
    boss.body.vy = 0;
    switch (kind) {
      case 'cone':
        game.fx.burst('DEEP FREEZE!', boss.body.x, boss.body.y - 98, 1.25, '#7ee0ff', true);
        game.audio.play('hiss', 0.9);
        this.coneAngle = this.aim;
        this.coneHit = false;
        this.coneBlasts = 0;
        this.taunt(game, boss, pickLine(['Door is open. Feel that?', 'Cold front incoming.']));
        break;
      case 'cubes':
        game.fx.burst('ICE CUBES!', boss.body.x, boss.body.y - 98, 1.25, '#dff6ff', true);
        this.taunt(game, boss, pickLine(['On the rocks!', 'Ice to meet you.']));
        break;
      case 'fish':
        game.fx.burst('FISH LOB!', boss.body.x, boss.body.y - 98, 1.25, '#ffb38a', true);
        this.markFish(game, boss);
        this.taunt(game, boss, pickLine(['Fresh catch!', 'Something smells fishy.']));
        break;
      case 'snap':
        game.fx.burst('COLD SNAP!', boss.body.x, boss.body.y - 98, 1.3, '#bfe9ff', true);
        game.audio.play('hiss', 1);
        this.pickSafe(game);
        this.taunt(game, boss, pickLine(["Don't slip.", 'Watch your footing.']));
        break;
    }
  }

  private endAttack(overtime: boolean): void {
    this.attack = null;
    this.gap = this.finale ? GAP_FINALE : overtime ? GAP_OVERTIME : GAP;
  }

  private beThawed(game: Game, boss: Enemy): void {
    this.thaw = THAW_SECONDS;
    this.attack = null;
    boss.stun = Math.max(boss.stun, 1.4);
    boss.squash = 1;
    game.fx.burst('THAWED!', boss.body.x, boss.body.y - 96, 1.35, '#ffd23f', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 110, 0.5, 'rgba(255,210,63,0.9)', 5);
    game.hitStop(0.08);
    game.hud.banner('THAWED', 'hit him while the frost is gone', 2.2);
    this.taunt(game, boss, pickLine(["I'm... defrosting!", 'Who left the door open?']), '#ffe9c4', true);
  }

  private melt(game: Game, boss: Enemy): void {
    this.plates = 0;
    this.plateHits = 0;
    game.fx.burst('MELTED!', boss.body.x, boss.body.y - 80, 1.2, '#ff9f1c', true);
    game.particles.burst('smoke', boss.body.x, boss.body.y - 40, 3, 90);
    this.beThawed(game, boss);
  }

  private refreeze(game: Game, boss: Enemy): void {
    this.plates = boss.phaseIndex >= 1 || this.finale ? 4 : 3;
    this.plateHits = 0;
    this.gap = 1.4;
    game.fx.burst('FROSTED OVER', boss.body.x, boss.body.y - 92, 0.9, '#bfe9ff', true);
  }

  private startFinale(game: Game, boss: Enemy): void {
    this.finale = true;
    this.attack = null;
    this.gap = 1.0;
    boss.rageMult = Math.max(boss.rageMult, 1.2);
    game.hud.banner('FREEZER BURN', 'everything in pairs', 2.6);
    game.fx.burst('FREEZER BURN!', boss.body.x, boss.body.y - 112, 1.5, '#7ee0ff', true);
    game.fx.ring(boss.body.x, boss.body.y, 10, 170, 0.6, 'rgba(160,225,255,0.9)', 6);
    game.fx.flash('#bfe9ff', 0.15);
    game.audio.play('hiss', 1);
    this.taunt(game, boss, 'EVERYTHING EXPIRES!', '#bfe9ff', true);
  }

  private interrupt(game: Game, boss: Enemy): void {
    this.endAttack(boss.phaseIndex >= 1 || this.finale);
    this.gap = Math.max(this.gap, 1.8);
    boss.stun = Math.max(boss.stun, INTERRUPT_STUN);
    boss.squash = 1;
    game.fx.burst('INTERRUPTED!', boss.body.x, boss.body.y - 100, 1.3, '#ffffff', true);
    game.fx.ring(boss.body.x, boss.body.y, 8, 100, 0.4, 'rgba(255,255,255,0.9)', 4);
    game.camera.addShake(0.12);
    game.hitStop(0.07);
    this.taunt(game, boss, 'Rude. I was mid-chill.', '#ffe0e0', true);
  }

  private taunt(game: Game, boss: Enemy, line: string, color = '#e8fbff', force = false): void {
    if (!force && game.time - this.tauntAt < 2.6) return;
    this.tauntAt = game.time;
    game.popup(line, boss.body.x, boss.body.y - 134, color, 19, 2.2);
  }

  // ───────────── DEEP FREEZE ─────────────

  private runCone(game: Game, boss: Enemy, overtime: boolean): void {
    const blasts = this.finale ? 3 : overtime ? 2 : 1;
    if (this.stage === 'windup') {
      if (this.stageT >= CONE_WINDUP) {
        this.stage = 'go';
        this.stageT = 0;
        this.coneHit = false;
        game.audio.play('hiss', 1);
        game.particles.burst('smoke', boss.body.x + Math.cos(this.coneAngle) * 70, boss.body.y + Math.sin(this.coneAngle) * 70, 4, 220, { color: '#dff6ff' });
      }
      return;
    }
    if (this.stage === 'go') {
      const p = game.player;
      const half = overtime ? 1.1 : 0.85;
      const dx = p.body.x - boss.body.x;
      const dy = p.body.y - boss.body.y;
      const d = Math.hypot(dx, dy);
      let da = Math.atan2(dy, dx) - this.coneAngle;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (p.alive && !this.coneHit && d < CONE_RANGE && Math.abs(da) < half / 2 + 0.1 && p.hurt(game, 1, 'Deep freeze')) {
        this.coneHit = true;
        p.slowTimer = 1.6;
        p.slowFactor = 0.3;
        game.fx.burst('FROZEN!', p.body.x, p.body.y - 50, 1, '#7ee0ff', true);
      }
      if (this.stageT >= CONE_BLAST) {
        this.coneBlasts++;
        if (this.coneBlasts < blasts) {
          // the next blast sweeps round to a new angle after a short warning
          this.coneAngle += 1.3;
          this.stage = 'windup';
          this.stageT = CONE_WINDUP * 0.45;
        } else {
          this.stage = 'recover';
          this.stageT = 0;
        }
      }
      return;
    }
    if (this.stageT > 0.9) this.endAttack(overtime);
  }

  // ───────────── ICE CUBES ─────────────

  private runCubes(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    const total = this.finale ? 9 : overtime ? 7 : 5;
    if (this.stage === 'windup') {
      if (this.stageT >= 0.8) {
        this.stage = 'go';
        this.stageT = 0;
        this.volley = 0;
        this.volleyT = 0;
      }
      return;
    }
    if (this.stage === 'go') {
      this.volleyT -= dt;
      if (this.volleyT <= 0 && this.volley < total) {
        this.volleyT = 0.22;
        this.volley++;
        const a = this.aim + (Math.random() - 0.5) * 1.5;
        this.cubes.push({
          x: boss.body.x + Math.cos(a) * boss.type.radius,
          y: boss.body.y - 6 + Math.sin(a) * boss.type.radius,
          vx: Math.cos(a) * CUBE_SPEED,
          vy: Math.sin(a) * CUBE_SPEED,
          bounces: 0,
          life: 5.5,
          spin: Math.random() * TAU,
        });
        game.audio.play('glassBreak', 0.2, 1.8);
      }
      if (this.volley >= total) this.stage = 'recover';
      return;
    }
    if (this.stageT > 1.0) this.endAttack(overtime);
  }

  private updateCubes(game: Game, dt: number): void {
    if (this.cubes.length === 0) return;
    const bounds = game.world.bounds;
    const p = game.player;
    for (let i = this.cubes.length - 1; i >= 0; i--) {
      const c = this.cubes[i]!;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.spin += dt * 5;
      c.life -= dt;
      let bounced = false;
      if (c.x < bounds.x0 + 12) { c.x = bounds.x0 + 12; c.vx = Math.abs(c.vx); bounced = true; }
      if (c.x > bounds.x1 - 12) { c.x = bounds.x1 - 12; c.vx = -Math.abs(c.vx); bounced = true; }
      if (c.y < bounds.y0 + 12) { c.y = bounds.y0 + 12; c.vy = Math.abs(c.vy); bounced = true; }
      if (c.y > bounds.y1 - 12) { c.y = bounds.y1 - 12; c.vy = -Math.abs(c.vy); bounced = true; }
      if (bounced) c.bounces++;
      if (c.life <= 0 || c.bounces > 2) {
        this.cubes.splice(i, 1);
        continue;
      }
      // a thrown object smashes a cube
      const smasher = game.objects.find((o) => o.alive && o.thrownByPlayer && o.body.speed() > 160 && Math.hypot(o.body.x - c.x, o.body.y - c.y) < o.body.boundR + 13);
      if (smasher) {
        this.cubes.splice(i, 1);
        game.particles.burst('scrap', c.x, c.y, 2, 120, { color: '#dff6ff' });
        continue;
      }
      if (p.alive && Math.hypot(p.body.x - c.x, p.body.y - c.y) < p.body.boundR + 12) {
        this.cubes.splice(i, 1);
        if (p.hurt(game, 1, 'Ice cube')) {
          p.slowTimer = 1.0;
          p.slowFactor = 0.55;
        }
      }
    }
  }

  // ───────────── FISH LOB ─────────────

  private markFish(game: Game, boss: Enemy): void {
    const bounds = game.world.bounds;
    const p = game.player.body;
    const n = this.finale ? 6 : boss.phaseIndex >= 1 ? 4 : 3;
    this.fish.length = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const r = i === 0 ? 0 : 80 + Math.random() * 140;
      const x = Math.min(bounds.x1 - 50, Math.max(bounds.x0 + 50, p.x + Math.cos(a) * r));
      const y = Math.min(bounds.y1 - 50, Math.max(bounds.y0 + 50, p.y + Math.sin(a) * r));
      this.fish.push({ x, y, sx: boss.body.x, sy: boss.body.y - 30, t: -i * 0.12, landed: false });
    }
  }

  private runFish(game: Game, boss: Enemy, dt: number, overtime: boolean): void {
    void dt;
    if (this.stage === 'windup' && this.stageT > FISH_FUSE + 0.3) this.stage = 'recover';
    if (this.stage === 'recover' && this.stageT > FISH_FUSE + 1.3) this.endAttack(overtime);
    void boss;
  }

  private updateFish(game: Game, dt: number): void {
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i]!;
      f.t += dt;
      if (!f.landed && f.t >= FISH_FUSE) {
        f.landed = true;
        game.audio.play('splash', 0.5);
        game.particles.burst('dust', f.x, f.y, 3, 140, { color: '#dff6ff' });
        const p = game.player;
        if (p.alive && Math.hypot(p.body.x - f.x, p.body.y - f.y) < FISH_RADIUS + p.body.boundR * 0.5) {
          if (p.hurt(game, 1, 'Frozen fish')) p.slip = 1.4;
        }
      }
      if (f.t > FISH_FUSE + 0.6) this.fish.splice(i, 1);
    }
  }

  // ───────────── COLD SNAP ─────────────

  private pickSafe(game: Game): void {
    const bounds = game.world.bounds;
    const p = game.player.body;
    // a safe ring somewhere reachable: near you, but not under you
    const a = Math.random() * TAU;
    const r = 140 + Math.random() * 120;
    this.safeX = Math.min(bounds.x1 - SNAP_SAFE * 0.7, Math.max(bounds.x0 + SNAP_SAFE * 0.7, p.x + Math.cos(a) * r));
    this.safeY = Math.min(bounds.y1 - SNAP_SAFE * 0.7, Math.max(bounds.y0 + SNAP_SAFE * 0.7, p.y + Math.sin(a) * r));
  }

  private runSnap(game: Game, boss: Enemy, overtime: boolean): void {
    if (this.stage === 'windup') {
      if (this.stageT >= SNAP_WINDUP) {
        this.stage = 'go';
        this.stageT = 0;
        this.iceLeft = SNAP_ICE * (this.finale ? 1.3 : 1);
        game.audio.play('hiss', 1);
        game.fx.burst('SLIPPERY!', boss.body.x, boss.body.y - 98, 1.0, '#ffffff', true);
      }
      return;
    }
    if (this.stage === 'go' && this.stageT > 0.6) this.stage = 'recover';
    if (this.stage === 'recover' && this.stageT > 1.2) this.endAttack(overtime);
  }

  private updateIce(game: Game, dt: number): void {
    if (this.iceLeft <= 0) return;
    this.iceLeft -= dt;
    const p = game.player;
    if (!p.alive) return;
    const outside = Math.hypot(p.body.x - this.safeX, p.body.y - this.safeY) > SNAP_SAFE;
    if (outside) p.slip = Math.max(p.slip, 0.25);
  }

  // ───────────── drawing ─────────────

  drawFloor(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    if (boss.defeated) return;
    const b = boss.body;
    const bounds = game.world.bounds;
    const pulse = 0.55 + 0.45 * Math.sin(time * 12);
    // the weak spot: the compressor is behind him
    if (this.intro === 'done' && this.armoured) {
      const back = boss.facing + Math.PI;
      ctx.fillStyle = `rgba(255, 170, 70, ${0.12 + 0.1 * pulse})`;
      ctx.strokeStyle = `rgba(255, 190, 90, ${0.5 + 0.3 * pulse})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.arc(b.x, b.y, boss.type.radius + 46, back - 0.75, back + 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 210, 140, ${0.65 + 0.3 * pulse})`;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HIT HERE', b.x + Math.cos(back) * (boss.type.radius + 62), b.y + Math.sin(back) * (boss.type.radius + 62));
      ctx.textAlign = 'start';
    }
    // cone of cold
    if (this.attack === 'cone' && this.stage !== 'recover') {
      const live = this.stage === 'go';
      const half = (boss.phaseIndex >= 1 || this.finale ? 1.1 : 0.85) / 2;
      const reach = CONE_RANGE * (live ? 1 : 0.35 + 0.65 * Math.min(1, this.stageT / CONE_WINDUP));
      ctx.fillStyle = live ? 'rgba(160, 230, 255, 0.55)' : `rgba(110, 200, 255, ${0.12 + 0.1 * pulse})`;
      ctx.strokeStyle = live ? 'rgba(255,255,255,0.95)' : 'rgba(150, 225, 255, 0.8)';
      ctx.lineWidth = live ? 4 : 2.5;
      ctx.setLineDash(live ? [] : [14, 10]);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.arc(b.x, b.y, reach, this.coneAngle - half, this.coneAngle + half);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // fish landing circles
    for (const f of this.fish) {
      if (f.t < 0) continue;
      const fuse = Math.min(1, f.t / FISH_FUSE);
      const live = f.t >= FISH_FUSE;
      ctx.fillStyle = live ? 'rgba(200, 240, 255, 0.55)' : `rgba(255, 130, 90, ${0.12 + 0.12 * pulse})`;
      ctx.strokeStyle = live ? 'rgba(255,255,255,0.9)' : 'rgba(255, 150, 110, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(f.x, f.y, FISH_RADIUS, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (!live) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, FISH_RADIUS * (1 - fuse), 0, TAU);
        ctx.stroke();
      }
    }
    // cold snap: ice everywhere except the safe ring
    if (this.attack === 'snap' || this.iceLeft > 0) {
      const live = this.iceLeft > 0;
      const warn = this.attack === 'snap' && this.stage === 'windup';
      const alpha = live ? 0.3 * Math.min(1, this.iceLeft / 0.8) : warn ? 0.08 + 0.1 * pulse : 0;
      if (alpha > 0.01) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
        ctx.arc(this.safeX, this.safeY, SNAP_SAFE, 0, TAU, true);
        ctx.clip('evenodd');
        ctx.fillStyle = `rgba(190, 235, 255, ${alpha.toFixed(3)})`;
        ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
        ctx.restore();
      }
      ctx.strokeStyle = `rgba(120, 245, 160, ${0.55 + 0.3 * pulse})`;
      ctx.lineWidth = 4;
      ctx.setLineDash([16, 10]);
      ctx.beginPath();
      ctx.arc(this.safeX, this.safeY, SNAP_SAFE, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawAir(ctx: Ctx, game: Game, boss: Enemy, time: number): void {
    void game;
    void boss;
    // ice cubes
    for (const c of this.cubes) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.spin);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(-9, -7, 18, 18);
      ctx.fillStyle = 'rgba(200, 238, 255, 0.95)';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.fillRect(-10, -10, 20, 20);
      ctx.strokeRect(-10, -10, 20, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-7, -7, 6, 6);
      ctx.restore();
    }
    // frozen fish in flight
    for (const f of this.fish) {
      if (f.t < 0 || f.landed) continue;
      const t = Math.min(1, f.t / FISH_FUSE);
      const x = f.sx + (f.x - f.sx) * t;
      const y = f.sy + (f.y - f.sy) * t - Math.sin(t * Math.PI) * 130;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 7 + time);
      ctx.fillStyle = '#9fd8ee';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 7, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(21, -7);
      ctx.lineTo(21, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
