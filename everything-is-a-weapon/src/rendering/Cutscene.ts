import { INK } from '../core/constants';
import type { Game } from '../core/Game';
import type { HeroId } from '../core/Hero';
import { TAU, clamp } from '../core/math';
import { Enemy } from '../entities/Enemy';
import { ENEMY_TYPES, type EnemyTypeId } from '../entities/EnemyTypes';
import { createPet, type Pet } from '../entities/Pets';
import { Player } from '../entities/Player';
import { drawEnemy } from './EnemyArt';
import { drawPet } from './PetArt';
import { drawPlayer } from './PlayerArt';
import { HAND_FONT, SHOUT_FONT, TYPE_FONT, hash, type Ctx } from './draw';

export type CutsceneKind = 'win' | 'lose';
type Scene = 'evicted' | 'victory' | 'movedOut' | 'newManagement';

/** The stage every scene is drawn on; it is scaled to fit whatever the screen is. */
const W = 480;
const H = 270;
const SKIP_AFTER = 0.5;

const WIN_LINES = ['NOT TODAY!', 'STILL MY FLAT!', 'RENT IS PAID!', 'AND STAY OUT!'] as const;
const DURATION: Readonly<Record<Scene, number>> = { evicted: 3.5, victory: 3, movedOut: 3.8, newManagement: 3.6 };

const ease = (t: number): number => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};
const span = (t: number, from: number, to: number): number => clamp((t - from) / (to - from), 0, 1);

/**
 * A few seconds of theatre between the last blow and the results clipboard. Four scenes:
 * two for a win, two for a loss, all drawn with the same character art as the game itself
 * so the hero, their pet and the movers look like themselves.
 *
 * The simulation is frozen while one plays; a click, tap or key skips it.
 */
export class Cutscene {
  active = false;
  private scene: Scene = 'evicted';
  private t = 0;
  private duration = 3;
  private heroId: HeroId = 'tenant';
  private line = '';
  private sub = '';
  private readonly actor = new Player(0, 0);
  private pet: Pet = createPet('tenant', 0, 0);
  private crew: Enemy[] = [];
  private wins = 0;
  private losses = 0;

  start(game: Game, kind: CutsceneKind): void {
    this.active = true;
    this.t = 0;
    this.heroId = game.hero;
    this.pet = createPet(game.hero, 0, 0);
    const room = game.room;
    if (kind === 'win') {
      this.scene = this.wins++ % 2 === 0 ? 'evicted' : 'victory';
      this.line = this.scene === 'evicted' ? 'EVICTED!' : WIN_LINES[room.index % WIN_LINES.length]!;
      this.sub = room.daily ? 'daily challenge cleared' : `room ${room.index + 1} is yours again`;
    } else {
      this.scene = this.losses++ % 2 === 0 ? 'movedOut' : 'newManagement';
      this.line = this.scene === 'movedOut' ? 'MOVED OUT' : 'UNDER NEW MANAGEMENT';
      this.sub = this.scene === 'movedOut' ? 'your things will follow. probably.' : 'they have already changed the locks';
    }
    this.duration = DURATION[this.scene];
    // the crew that was in the room, so the right boxes turn up in the scene
    const seen: EnemyTypeId[] = room.def.enemies.map((e) => e.type);
    this.crew = [0, 1, 2].map((i) => {
      const type = seen[i % Math.max(1, seen.length)] ?? 'basic';
      return new Enemy(ENEMY_TYPES[type === 'mini' ? 'basic' : type], 0, 0, -1, 0);
    });
    this.actor.alive = true;
    this.actor.aimX = 0.3;
    this.actor.aimY = 0.95;
  }

  /** A click or key press ends it, once it has been on screen long enough to register. */
  skip(): void {
    if (this.active && this.t > SKIP_AFTER) this.t = this.duration;
  }

  /** Advances the scene. Returns true on the frame it finishes. */
  update(game: Game, dt: number): boolean {
    if (!this.active) return false;
    const before = this.t;
    this.t += dt;
    this.sounds(game, before);
    if (this.t < this.duration) return false;
    this.active = false;
    return true;
  }

  private sounds(game: Game, before: number): void {
    const at = (time: number): boolean => before < time && this.t >= time;
    const stampAt = this.scene === 'evicted' ? 2 : this.scene === 'victory' ? 0.9 : this.scene === 'movedOut' ? 2.5 : 1.3;
    if (at(stampAt)) game.audio.play('stamp', 1);
    if (this.scene === 'evicted') {
      for (const time of [0.45, 0.85, 1.25]) if (at(time)) game.audio.play('throw', 0.8, 0.8);
      if (at(1.85)) game.audio.play('door', 1);
    } else if (this.scene === 'victory') {
      if (at(0.3)) game.audio.voice('hup', 240);
    } else if (this.scene === 'movedOut') {
      if (at(0.4)) game.audio.voice('ow', 280);
      if (at(2.9)) game.audio.play('door', 1);
    } else if (at(0.5)) {
      game.audio.voice('defeat', 150);
    }
  }

  draw(ctx: Ctx, w: number, h: number): void {
    if (!this.active) return;
    const t = this.t;
    const fade = Math.min(1, t / 0.22, (this.duration - t) / 0.2 + 0.35);
    ctx.save();
    ctx.globalAlpha = clamp(fade, 0, 1);
    ctx.fillStyle = '#110e22';
    ctx.fillRect(0, 0, w, h);

    const scale = Math.min(w / W, h / H);
    ctx.translate((w - W * scale) / 2, (h - H * scale) / 2);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.lineJoin = 'round';

    // a slow push-in on every scene
    const zoom = 1 + ease(t / this.duration) * 0.06;
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);

    switch (this.scene) {
      case 'evicted':
        this.evicted(ctx, t);
        break;
      case 'victory':
        this.victory(ctx, t);
        break;
      case 'movedOut':
        this.movedOut(ctx, t);
        break;
      case 'newManagement':
        this.newManagement(ctx, t);
        break;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate((w - W * scale) / 2, (h - H * scale) / 2);
    ctx.scale(scale, scale);

    // letterbox
    const bar = 26 * ease(t / 0.35);
    ctx.fillStyle = '#0b0917';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);

    const captionAt = this.scene === 'evicted' ? 2 : this.scene === 'victory' ? 0.9 : this.scene === 'movedOut' ? 2.5 : 1.3;
    if (t > captionAt) this.caption(ctx, t - captionAt);

    if (t > SKIP_AFTER) {
      ctx.globalAlpha = 0.6 * clamp(fade, 0, 1);
      ctx.font = `700 8px ${TYPE_FONT}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff3d6';
      ctx.fillText('tap to skip', W - 10, H - 12);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ───────────── shared scenery ─────────────

  private street(ctx: Ctx, t: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, 200);
    sky.addColorStop(0, '#16122b');
    sky.addColorStop(1, '#453772');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // moon and a few stars
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(92, 52, 15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#16122b';
    ctx.beginPath();
    ctx.arc(98, 48, 13, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff3d6';
    for (let i = 0; i < 14; i++) {
      const twinkle = 0.5 + 0.5 * Math.sin(t * 3 + i * 2.1);
      ctx.globalAlpha *= 1;
      ctx.fillRect(20 + hash(i) * 260, 34 + hash(i + 40) * 70, 1.2 + twinkle, 1.2 + twinkle);
    }
    // the building
    ctx.fillStyle = '#5b3f52';
    ctx.fillRect(292, 22, 200, 190);
    ctx.fillStyle = '#4a3344';
    for (let row = 0; row < 12; row++) ctx.fillRect(292, 30 + row * 15, 200, 1.5);
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 2; row++) {
        const lit = hash(col * 3 + row * 7 + 1) > 0.45;
        ctx.fillStyle = INK;
        ctx.fillRect(312 + col * 52, 48 + row * 46, 30, 28);
        ctx.fillStyle = lit ? '#ffd98a' : '#2a2540';
        ctx.fillRect(314 + col * 52, 50 + row * 46, 26, 24);
      }
    }
    // front door, open, light spilling out
    ctx.fillStyle = INK;
    ctx.fillRect(326, 146, 46, 62);
    ctx.fillStyle = '#ffd98a';
    ctx.fillRect(329, 149, 40, 59);
    const glow = ctx.createLinearGradient(0, 205, 0, 245);
    glow.addColorStop(0, 'rgba(255, 217, 138, 0.35)');
    glow.addColorStop(1, 'rgba(255, 217, 138, 0)');
    // pavement and road
    ctx.fillStyle = '#4a426e';
    ctx.fillRect(0, 206, W, 16);
    ctx.fillStyle = '#231d3c';
    ctx.fillRect(0, 222, W, H - 222);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(326, 206);
    ctx.lineTo(372, 206);
    ctx.lineTo(396, 246);
    ctx.lineTo(300, 246);
    ctx.closePath();
    ctx.fill();
  }

  /** The removal van, rear doors towards the building. `open` 0..1. */
  private van(ctx: Ctx, x: number, y: number, open: number, t: number, moving: boolean): void {
    const shake = moving ? Math.sin(t * 40) * 0.8 : 0;
    ctx.save();
    ctx.translate(x, y + shake);
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    // cab
    ctx.fillStyle = '#e5383b';
    ctx.beginPath();
    ctx.moveTo(-34, 0);
    ctx.lineTo(-34, -30);
    ctx.lineTo(-18, -48);
    ctx.lineTo(4, -48);
    ctx.lineTo(4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#bfe9ff';
    ctx.beginPath();
    ctx.moveTo(-29, -30);
    ctx.lineTo(-17, -43);
    ctx.lineTo(-4, -43);
    ctx.lineTo(-4, -30);
    ctx.closePath();
    ctx.fill();
    // box body
    ctx.fillStyle = '#fbf6e9';
    ctx.fillRect(4, -66, 122, 66);
    ctx.strokeRect(4, -66, 122, 66);
    ctx.fillStyle = '#e5383b';
    ctx.fillRect(4, -30, 122, 7);
    ctx.fillStyle = INK;
    ctx.font = `italic 400 13px ${SHOUT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MOVERS & CO.', 65, -47);
    // dark inside, and the rear doors
    if (open > 0.02) {
      ctx.fillStyle = '#17132a';
      ctx.fillRect(122, -62, 4, 60);
      ctx.fillStyle = '#d8d2c2';
      ctx.beginPath();
      ctx.moveTo(126, -66);
      ctx.lineTo(126 + 22 * open, -72);
      ctx.lineTo(126 + 22 * open, -4);
      ctx.lineTo(126, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // wheels
    for (const wx of [-14, 100]) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(wx, 2, 11, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#aab4c4';
      ctx.beginPath();
      ctx.arc(wx, 2, 4, 0, TAU);
      ctx.fill();
    }
    if (moving) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      for (let i = 0; i < 4; i++) {
        const p = (t * 2.5 + i * 0.25) % 1;
        ctx.beginPath();
        ctx.arc(132 + p * 46, -4 - p * 14, 4 + p * 7, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private flatBox(ctx: Ctx, x: number, y: number, spin: number, size = 1): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.scale(size, size);
    ctx.fillStyle = '#c9a070';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.rect(-15, -5, 30, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ecdcab';
    ctx.fillRect(-3, -5, 6, 10);
    // it is not happy about this
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const ex of [-9, 8]) {
      ctx.moveTo(ex - 2, -2);
      ctx.lineTo(ex + 2, 2);
      ctx.moveTo(ex + 2, -2);
      ctx.lineTo(ex - 2, 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  private hero(ctx: Ctx, x: number, y: number, size: number, t: number, pose: Partial<Player> = {}): void {
    const p = this.actor;
    p.throwAnim = 0;
    p.walkPhase = 0;
    p.hurtFlash = 0;
    p.held = null;
    p.body.vx = 0;
    p.body.vy = 0;
    Object.assign(p, pose);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.fillStyle = 'rgba(17, 14, 34, 0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 16, 5, 0, 0, TAU);
    ctx.fill();
    drawPlayer(ctx, p, 0, 0, t + 0.6, this.heroId);
    ctx.restore();
  }

  private companion(ctx: Ctx, x: number, y: number, size: number, t: number, pose: Record<string, unknown> = {}): void {
    const pet = this.pet;
    pet.sitting = true;
    pet.vx = 0;
    pet.vy = 0;
    pet.facing = -1;
    Object.assign(pet, pose);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    const z = pet.species === 'parrot' ? 30 + Math.sin(t * 5) * 3 : 0;
    drawPet(ctx, pet, 0, 0, z, t + 0.3);
    ctx.restore();
  }

  private mover(ctx: Ctx, index: number, x: number, y: number, size: number, t: number, facing: number, walking: boolean): void {
    const e = this.crew[index % this.crew.length]!;
    e.facing = facing;
    e.walkPhase = walking ? t * 11 + index : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.fillStyle = 'rgba(17, 14, 34, 0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 6, 18, 6, 0, 0, TAU);
    ctx.fill();
    drawEnemy(ctx, e, 0, 0, t);
    ctx.restore();
  }

  private caption(ctx: Ctx, age: number): void {
    const pop = age < 0.09 ? 2.2 - (age / 0.09) * 1.2 : 1 + Math.max(0, 0.12 - (age - 0.09)) * 0.6;
    ctx.save();
    ctx.translate(W / 2, 58);
    ctx.rotate(-0.045);
    ctx.scale(pop, pop);
    ctx.font = `italic 400 34px ${SHOUT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = Math.min(W - 60, ctx.measureText(this.line).width + 34);
    // a strip of torn paper
    const strip = (): void => {
      ctx.beginPath();
      ctx.moveTo(-width / 2, -21);
      for (let i = 1; i <= 10; i++) ctx.lineTo(-width / 2 + (width * i) / 10, -21 + (i % 2 === 0 ? 0 : 2.5));
      ctx.lineTo(width / 2 + 3, 20);
      for (let i = 9; i >= 0; i--) ctx.lineTo(-width / 2 + (width * i) / 10, 21 - (i % 2 === 0 ? 0 : 2.5));
      ctx.closePath();
    };
    ctx.translate(4, 5);
    strip();
    ctx.fillStyle = 'rgba(11, 9, 23, 0.6)';
    ctx.fill();
    ctx.translate(-4, -5);
    strip();
    ctx.fillStyle = this.scene === 'evicted' || this.scene === 'victory' ? '#ffd23f' : '#e5383b';
    ctx.fill();
    ctx.fillStyle = this.scene === 'evicted' || this.scene === 'victory' ? INK : '#ffffff';
    ctx.fillText(this.line, 0, 2, width - 20);
    ctx.restore();

    if (age > 0.25) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, (age - 0.25) / 0.2);
      ctx.translate(W / 2, 92);
      ctx.rotate(0.02);
      ctx.font = `700 11px ${HAND_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const sw = ctx.measureText(this.sub).width + 18;
      ctx.fillStyle = '#fbf6e9';
      ctx.fillRect(-sw / 2, -9, sw, 18);
      ctx.fillStyle = INK;
      ctx.fillText(this.sub, 0, 0.5);
      ctx.restore();
    }
  }

  // ───────────── win ─────────────

  /** Out they go: three flattened boxes through the air and into their own van, which leaves. */
  private evicted(ctx: Ctx, t: number): void {
    this.street(ctx, t);
    const leave = ease(span(t, 2.15, 3.3));
    const vanX = 132 - leave * 340;
    this.van(ctx, vanX, 204, 1 - ease(span(t, 1.75, 1.95)), t, t > 2.15);

    // the throws
    let throwing = 0;
    for (let i = 0; i < 3; i++) {
      const p = span(t, 0.45 + i * 0.4, 0.95 + i * 0.4);
      if (p > 0 && p < 0.35) throwing = 1 - p / 0.35;
      if (p <= 0 || p >= 1) continue;
      const x = 334 + (258 - 334) * p;
      const y = 176 - Math.sin(p * Math.PI) * 74 + p * -4;
      this.flatBox(ctx, x, y, p * 9 + i, 1);
    }
    this.hero(ctx, 350, 208, 1.25, t, { aimX: -0.92, aimY: 0.38, throwAnim: throwing });
    this.companion(ctx, 388, 212, 1.25, t, { sitting: t > 1.9 ? false : true });
    if (t > 2.15) {
      // dust where the van was
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      for (let i = 0; i < 5; i++) {
        const p = span(t, 2.15 + i * 0.05, 3.1);
        ctx.beginPath();
        ctx.arc(120 + i * 22, 206 - p * 16, 5 + p * 10, 0, TAU);
        ctx.fill();
      }
    }
  }

  /** Standing on what is left of them. */
  private victory(ctx: Ctx, t: number): void {
    // wallpaper, skirting board, floorboards
    ctx.fillStyle = '#57487c';
    ctx.fillRect(0, 0, W, 190);
    ctx.fillStyle = '#4b3d6e';
    for (let i = 0; i < 16; i++) ctx.fillRect(i * 32 + 10, 0, 12, 190);
    ctx.fillStyle = '#fbf6e9';
    ctx.fillRect(0, 182, W, 8);
    ctx.fillStyle = '#c9a070';
    ctx.fillRect(0, 190, W, H - 190);
    ctx.strokeStyle = 'rgba(34, 27, 54, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.moveTo(0, 204 + i * 16);
      ctx.lineTo(W, 204 + i * 16);
    }
    ctx.stroke();
    // spotlight
    const light = ctx.createRadialGradient(W / 2, 170, 30, W / 2, 170, 250);
    light.addColorStop(0, 'rgba(255, 243, 214, 0.28)');
    light.addColorStop(1, 'rgba(17, 14, 34, 0.55)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, W, H);

    // the pile
    for (let i = 0; i < 7; i++) {
      const drop = ease(span(t, i * 0.05, 0.3 + i * 0.05));
      this.flatBox(ctx, W / 2 + (hash(i) - 0.5) * 34, 244 - i * 6.5 - (1 - drop) * 180, (hash(i + 9) - 0.5) * 0.5, 1.9);
    }
    const land = ease(span(t, 0.25, 0.55));
    const hop = t > 0.9 ? Math.abs(Math.sin((t - 0.9) * 6.5)) * 11 : 0;
    this.hero(ctx, W / 2 - 14, 203 - (1 - land) * 200 - hop, 1.55, t, { aimX: 0.2, aimY: 0.97, throwAnim: hop > 4 ? 0.6 : 0 });
    const petHop = t > 1.05 ? Math.abs(Math.sin((t - 1.05) * 6.5)) * 12 : 0;
    this.companion(ctx, W / 2 + 66, 242 - petHop, 1.55, t, { sitting: petHop < 2 });

    // packing peanuts coming down like confetti
    for (let i = 0; i < 46; i++) {
      const p = (t * (0.35 + hash(i) * 0.35) + hash(i + 70)) % 1;
      const x = hash(i + 20) * W + Math.sin(t * 2 + i) * 10;
      ctx.save();
      ctx.translate(x, p * (H + 20) - 10);
      ctx.rotate(t * 3 + i);
      ctx.fillStyle = i % 3 === 0 ? '#ffd23f' : '#fff3d6';
      ctx.fillRect(-3.5, -1.6, 7, 3.2);
      ctx.restore();
    }
  }

  // ───────────── lose ─────────────

  /** Boxed up and carried out to the van, pet trailing behind. */
  private movedOut(ctx: Ctx, t: number): void {
    this.street(ctx, t);
    const loaded = ease(span(t, 2.7, 3.05));
    this.van(ctx, 96, 204, 1 - ease(span(t, 2.95, 3.15)), t, false);
    const walk = span(t, 0.15, 2.6);
    const cx = 352 - walk * 118 - loaded * 22;
    const bob = Math.sin(t * 11) * 2.2 * (walk < 1 ? 1 : 0);
    const cy = 210;

    if (loaded < 1) {
      this.mover(ctx, 0, cx + 34, cy + 6, 1.15, t, Math.PI * 0.86, walk < 1);
      // the hero, packed
      ctx.save();
      ctx.translate(cx, cy - 12 + bob);
      ctx.rotate(Math.sin(t * 5.5) * 0.05);
      ctx.globalAlpha *= 1 - loaded;
      this.hero(ctx, 0, 6, 1.15, t, { aimX: -0.2, aimY: 0.98, hurtFlash: 0.2, walkPhase: t * 9 });
      // the box they have been put in
      ctx.fillStyle = '#c9a070';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(-24, -14, 48, 32);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#9c7446';
      ctx.fillRect(-24, 10, 48, 8);
      ctx.fillStyle = '#ecdcab';
      ctx.fillRect(-4, -14, 8, 32);
      ctx.fillStyle = '#e5383b';
      ctx.fillRect(8, -2, 13, 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 5px ${TYPE_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MISC', 14.5, 2.3);
      ctx.restore();
      this.mover(ctx, 1, cx - 34, cy + 6, 1.15, t, Math.PI * 0.86, walk < 1);
    }
    // the pet, a few steps behind and not keeping up
    const petX = 420 - span(t, 0.5, 3.4) * 150;
    this.companion(ctx, petX, 216, 1.15, t, { sitting: false, vx: -120, walkPhase: t * 14, fear: 1, flying: 1 });
    if (t > 1) {
      ctx.fillStyle = '#9fe3ff';
      const tear = (t * 1.4) % 1;
      ctx.globalAlpha *= 1 - tear;
      ctx.beginPath();
      ctx.arc(petX - 8, 196 + tear * 12, 2, 0, TAU);
      ctx.fill();
    }
  }

  /** Later that night: they have your sofa, your telly and your remote. */
  private newManagement(ctx: Ctx, t: number): void {
    ctx.fillStyle = '#2a2247';
    ctx.fillRect(0, 0, W, 190);
    ctx.fillStyle = '#1c1733';
    ctx.fillRect(0, 190, W, H - 190);
    ctx.fillStyle = '#3a305e';
    ctx.fillRect(0, 184, W, 6);
    // the telly, and the light it throws
    const flick = 0.55 + hash(Math.floor(t * 12)) * 0.45;
    ctx.fillStyle = INK;
    ctx.fillRect(34, 150, 62, 44);
    ctx.fillStyle = `rgba(160, 220, 255, ${flick.toFixed(2)})`;
    ctx.fillRect(38, 154, 54, 36);
    ctx.fillStyle = INK;
    ctx.fillRect(58, 194, 14, 12);
    const beam = ctx.createLinearGradient(96, 0, 420, 0);
    beam.addColorStop(0, `rgba(160, 220, 255, ${(0.34 * flick).toFixed(2)})`);
    beam.addColorStop(1, 'rgba(160, 220, 255, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(96, 156);
    ctx.lineTo(430, 96);
    ctx.lineTo(430, 250);
    ctx.lineTo(96, 190);
    ctx.closePath();
    ctx.fill();

    // sofa back, the crew, sofa front
    ctx.fillStyle = '#7c5cd8';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(196, 128, 216, 70, 14);
    ctx.fill();
    ctx.stroke();
    const settle = ease(span(t, 0.2, 0.7));
    for (let i = 0; i < 3; i++) {
      const laugh = Math.abs(Math.sin(t * 9 + i * 1.3)) * 3 * span(t, 1.2, 1.5);
      this.mover(ctx, i, 242 + i * 62, 196 - laugh + (1 - settle) * -70, 1.45, t, Math.PI * 0.93, false);
    }
    ctx.fillStyle = '#5a3fb0';
    ctx.beginPath();
    ctx.roundRect(188, 190, 232, 38, 10);
    ctx.fill();
    ctx.stroke();
    for (const ax of [186, 400]) {
      ctx.fillStyle = '#7c5cd8';
      ctx.beginPath();
      ctx.roundRect(ax, 160, 24, 66, 9);
      ctx.fill();
      ctx.stroke();
    }
    // popcorn going up now and then
    for (let i = 0; i < 6; i++) {
      const p = (t * 1.3 + i * 0.37) % 1;
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath();
      ctx.arc(276 + i * 22 + Math.sin(i * 3) * 6, 176 - Math.sin(p * Math.PI) * 30, 2.2, 0, TAU);
      ctx.fill();
    }
    // all that is left of you
    ctx.save();
    ctx.translate(150, 230);
    ctx.rotate(-0.3);
    ctx.fillStyle = '#ff9ec4';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 8, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(6, -2, 1.3, 0, TAU);
    ctx.arc(6, 2.5, 1.3, 0, TAU);
    ctx.fill();
    ctx.restore();
    // the pet looks in from the edge of the room
    const peek = ease(span(t, 1.4, 2));
    this.companion(ctx, 480 - peek * 36, 236, 1.5, t, { sitting: true, fear: 1, flying: 0 });
  }
}
