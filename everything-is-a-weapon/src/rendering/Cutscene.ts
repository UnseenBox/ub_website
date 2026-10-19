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
export type CutsceneScene = 'evicted' | 'victory' | 'movedOut' | 'newManagement';

/** Intruders that read as removal men on screen; bosses and tiny pests stay out of the cast. */
const MOVER_TYPES: readonly EnemyTypeId[] = [
  'basic', 'fast', 'heavy', 'helmet', 'shield', 'fragile', 'nested', 'kaboom', 'trolley', 'hurler', 'bulwark',
];

const W = 480;
const H = 270;
const SKIP_AFTER = 0.6;
const BAR = 24;

const DURATION: Readonly<Record<CutsceneScene, number>> = {
  evicted: 6.4,
  victory: 6.0,
  movedOut: 6.4,
  newManagement: 6.0,
};

const TITLE_AT: Readonly<Record<CutsceneScene, number>> = {
  evicted: 5.05,
  victory: 4.75,
  movedOut: 5.05,
  newManagement: 4.65,
};

const TITLE: Readonly<Record<CutsceneScene, { kicker: string; line: string }>> = {
  evicted: { kicker: 'TAKEBACK', line: 'STILL YOURS.' },
  victory: { kicker: 'TAKEBACK', line: 'HOME.' },
  movedOut: { kicker: 'SETBACK', line: 'MOVING DAY.' },
  newManagement: { kicker: 'SETBACK', line: 'NEW MANAGEMENT.' },
};

const SLATE: Readonly<Record<CutsceneScene, string>> = {
  evicted: '03:07  ·  THE FLAT',
  victory: '06:12  ·  THE FLAT',
  movedOut: '22:48  ·  THE DOORSTEP',
  newManagement: '23:19  ·  THE FLAT',
};

const PAPER = '#f6e7c8';
const CREAM = '#fff3d6';
const CORAL = '#ff5a4e';
const YELLOW = '#ffd23f';
const CYAN = '#4ad6e8';
const TEAL = '#2f7f86';
const PLUM = '#6b3f7a';
const NIGHT = '#232f5e';
const NIGHT_DEEP = '#161c3a';

const ease = (t: number): number => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};
const span = (t: number, from: number, to: number): number => clamp((t - from) / (to - from), 0, 1);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const shakeAt = (age: number, amp: number): number => {
  if (age < 0 || age > 0.45) return 0;
  return Math.sin(age * 90) * amp * Math.exp(-age * 10);
};

let dotCanvas: HTMLCanvasElement | null = null;
function dotTile(): HTMLCanvasElement {
  if (dotCanvas) return dotCanvas;
  const c = document.createElement('canvas');
  c.width = 6;
  c.height = 6;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = INK;
    g.beginPath();
    g.arc(1.5, 1.5, 1.15, 0, TAU);
    g.fill();
  }
  dotCanvas = c;
  return c;
}

let fiberCanvas: HTMLCanvasElement | null = null;
function fiberTile(): HTMLCanvasElement {
  if (fiberCanvas) return fiberCanvas;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const g = c.getContext('2d');
  if (g) {
    const img = g.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 150 + Math.floor(hash(i * 0.731) * 105);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 26;
    }
    g.putImageData(img, 0, 0);
  }
  fiberCanvas = c;
  return c;
}

/**
 * BONK! cutscenes, screen-print edition.
 *
 * Four short films cut into three graphic panels each. Everything is drawn in
 * the game's own character art, then stylised like the box art: flat poster
 * colour, heavy ink outlines, halftone shadows, paper stock and ransom-note
 * titles. Characters stay at gameplay scale inside wide, legible compositions;
 * the close-ups are props (keys, a mug, a hand on glass), never stretched
 * sprites. The simulation is frozen while one plays; a click or key skips it.
 */
export class Cutscene {
  active = false;
  private scene: CutsceneScene = 'evicted';
  private t = 0;
  private duration = 3;
  private heroId: HeroId = 'tenant';
  private readonly actor = new Player(0, 0);
  private pet: Pet = createPet('tenant', 0, 0);
  private crew: Enemy[] = [];
  private wins = 0;
  private losses = 0;

  start(game: Game, kind: CutsceneKind, forced?: CutsceneScene): void {
    this.active = true;
    this.t = 0;
    this.heroId = game.hero;
    this.pet = createPet(game.hero, 0, 0);
    if (forced) {
      this.scene = forced;
    } else if (kind === 'win') {
      this.scene = this.wins++ % 2 === 0 ? 'evicted' : 'victory';
    } else {
      this.scene = this.losses++ % 2 === 0 ? 'movedOut' : 'newManagement';
    }
    this.duration = DURATION[this.scene];
    const def = game.room.def;
    const seen = def.enemies.map((e) => e.type).filter((t) => MOVER_TYPES.includes(t));
    const cast: EnemyTypeId[] = seen.length > 0 ? seen : ['basic', 'heavy', 'trolley'];
    this.crew = [0, 1, 2].map((i) => new Enemy(ENEMY_TYPES[cast[i % cast.length]!], 0, 0, -1, 0));
    this.actor.alive = true;
    this.actor.aimX = 0.3;
    this.actor.aimY = 0.95;
  }

  /** Dev hook used by the cutscene preview page to freeze a frame. */
  seek(time: number): void {
    this.t = clamp(time, 0, this.duration);
  }

  skip(): void {
    if (this.active && this.t > SKIP_AFTER) this.t = this.duration;
  }

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
    if (this.scene === 'evicted') {
      if (at(0.35)) game.audio.play('knock', 0.8);
      if (at(1.15)) game.audio.voice('alert', 150);
      if (at(1.5)) game.audio.voice('hup', 230);
      if (at(1.78)) game.audio.play('throw', 1, 0.8);
      if (at(1.84)) game.audio.impact('wood', 0.9, 6);
      if (at(2.1)) game.audio.play('door', 1, 1.1);
      if (at(2.22)) game.audio.play('explosion', 0.3, 1.5);
      if (at(2.6)) game.audio.play('poof', 0.8);
      if (at(2.95)) game.audio.play('drop', 0.8);
      if (at(4.35)) game.audio.play('door', 0.7);
      if (at(4.7)) game.audio.play('dash', 0.5);
      if (at(5.7)) game.audio.play('door', 0.7, 1.1);
    } else if (this.scene === 'victory') {
      if (at(0.3)) game.audio.play('paper', 0.5);
      if (at(0.7)) game.audio.play('discovery', 0.6);
      if (at(2.4)) game.audio.play('squeak', 0.4, 1.1);
      if (at(3.0)) game.audio.voice('hup', 180);
      if (at(4.5)) game.audio.play('discovery', 0.45, 1.2);
    } else if (this.scene === 'movedOut') {
      if (at(0.4)) game.audio.play('slide', 0.5);
      if (at(1.2)) game.audio.play('splash', 0.3);
      if (at(2.3)) game.audio.play('door', 0.6, 0.9);
      if (at(3.1)) game.audio.play('plop', 0.5, 1.2);
      if (at(3.3)) game.audio.play('paper', 0.4);
      if (at(4.5)) game.audio.play('door', 0.8, 0.8);
      if (at(5.0)) game.audio.play('dash', 0.5, 0.8);
      if (at(5.4)) game.audio.play('splash', 0.4);
    } else {
      if (at(0.55)) game.audio.play('click', 0.5);
      if (at(1.3)) game.audio.play('chomp', 0.3);
      if (at(2.0)) game.audio.play('squeak', 0.3);
      if (at(2.6)) game.audio.play('crackle', 0.3);
      if (at(3.3)) game.audio.play('door', 0.5, 1.2);
      if (at(4.8)) game.audio.play('splash', 0.3);
    }
  }

  draw(ctx: Ctx, w: number, h: number): void {
    if (!this.active) return;
    const t = this.t;
    const fadeIn = clamp(t / 0.28, 0, 1);
    const fadeOut = clamp((this.duration - t) / 0.45, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(fadeIn, fadeOut);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, w, h);

    const scale = Math.min(w / W, h / H);
    ctx.translate((w - W * scale) / 2, (h - H * scale) / 2);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

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

    // screen furniture must not ride the scene camera
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate((w - W * scale) / 2, (h - H * scale) / 2);
    ctx.scale(scale, scale);
    this.paperFinish(ctx, t);
    this.grain(ctx, t);
    this.bars(ctx, t);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private cam(ctx: Ctx, zoom: number, panX: number, panY: number, roll = 0, sx = 0, sy = 0): void {
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.rotate(roll);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2 + panX, -H / 2 + panY);
  }

  /** Light print finish: lifted shadows, paper bloom at the edges, no mud. */
  private paperFinish(ctx: Ctx, t: number): void {
    ctx.save();
    // keep the blacks from crushing: a breath of warm ink at the very bottom
    const lift = ctx.createLinearGradient(0, 0, 0, H);
    lift.addColorStop(0, 'rgba(255, 210, 120, 0.05)');
    lift.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
    lift.addColorStop(1, 'rgba(74, 214, 232, 0.04)');
    ctx.fillStyle = lift;
    ctx.fillRect(0, 0, W, H);

    // paper edge, not a noir vignette
    const edge = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.05);
    edge.addColorStop(0, 'rgba(26, 20, 48, 0)');
    edge.addColorStop(1, 'rgba(26, 20, 48, 0.22)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);

    // faint misregistration: a cyan ghost at the top edge
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = CYAN;
    ctx.fillRect(0, 0, W, 2);
    ctx.restore();
  }

  private grain(ctx: Ctx, t: number): void {
    const pat = ctx.createPattern(fiberTile(), 'repeat');
    if (!pat) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.18;
    const frame = Math.floor(t * 18);
    ctx.translate(-Math.floor(hash(frame * 1.7) * 96), -Math.floor(hash(frame * 2.3 + 4) * 96));
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W + 96, H + 96);
    ctx.restore();
  }

  private bars(ctx: Ctx, t: number): void {
    const bar = BAR * ease(span(t, 0.04, 0.4));
    if (bar < 0.5) return;
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
    ctx.fillStyle = 'rgba(255, 210, 63, 0.7)';
    ctx.fillRect(0, bar - 1, W, 1);
    ctx.fillRect(0, H - bar, W, 1);

    const progress = clamp(t / this.duration, 0, 1);
    ctx.fillStyle = YELLOW;
    ctx.fillRect(0, H - 2, W * progress, 2);

    if (bar < 11) return;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.font = `700 6px ${TYPE_FONT}`;
    ctx.fillStyle = 'rgba(246, 231, 200, 0.72)';
    this.tracked(ctx, SLATE[this.scene], 14, bar / 2, 1.3);
    ctx.fillStyle = 'rgba(255, 210, 63, 0.9)';
    ctx.beginPath();
    ctx.arc(W - 20, bar / 2, 1.7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(246, 231, 200, 0.72)';
    ctx.textAlign = 'right';
    this.tracked(ctx, 'BONK!', W - 26, bar / 2, 1.4, 'right');

    if (t > 1.0 && t < this.duration - 1.0) {
      const a = 0.4 + 0.18 * Math.sin(t * 3.2);
      ctx.font = `700 5.6px ${TYPE_FONT}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = `rgba(246, 231, 200, ${a.toFixed(2)})`;
      this.tracked(ctx, 'TAP TO SKIP', W - 12, H - bar / 2, 1.1, 'right');
    }
    ctx.restore();
    this.titleCard(ctx, t);
  }

  /** Ransom-note title on a torn paper strip. */
  private titleCard(ctx: Ctx, t: number): void {
    const at = TITLE_AT[this.scene];
    const p = ease(span(t, at, at + 0.55));
    if (p <= 0.01) return;
    const info = TITLE[this.scene];
    ctx.save();
    ctx.globalAlpha *= p;
    ctx.font = `400 29px ${SHOUT_FONT}`;
    const textW = ctx.measureText(info.line).width + 0.6 * Math.max(0, info.line.length - 1);
    const stripW = clamp(52 + textW, 132, 344);
    const stampW = clamp(stripW * 0.24, 42, 66);
    const y = 203;
    const x = 22 + (1 - p) * -26;
    ctx.translate(x, y);
    ctx.rotate(-0.018);

    // torn strip shadow
    ctx.fillStyle = 'rgba(26, 20, 48, 0.38)';
    this.tornPath(ctx, 5, 6, stripW, 52, 0.9);
    ctx.fill();

    // paper
    ctx.fillStyle = PAPER;
    this.tornPath(ctx, 0, 0, stripW, 52, 1);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    this.dots(ctx, 0, 0, stripW, 52, 0.06);
    // a coral corner stamp
    ctx.fillStyle = CORAL;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(stampW, 0);
    ctx.lineTo(stampW - 14, 18);
    ctx.lineTo(0, 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.font = `700 6.5px ${TYPE_FONT}`;
    ctx.fillStyle = CREAM;
    this.tracked(ctx, info.kicker, 12, 9, 1.5);
    ctx.font = `400 29px ${SHOUT_FONT}`;
    ctx.fillStyle = INK;
    this.tracked(ctx, info.line, 20, 34, 0.6);
    ctx.restore();
  }

  private tornPath(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number): void {
    ctx.beginPath();
    ctx.moveTo(x, y);
    let n = 7;
    for (let i = 0; i <= n; i++) {
      const px = x + (i / n) * w;
      const py = y + (hash(seed * 3.1 + i * 2.7) - 0.5) * 3.2;
      ctx.lineTo(px, py);
    }
    n = 5;
    for (let i = 1; i <= n; i++) {
      const py = y + (i / n) * h;
      const px = x + w + (hash(seed * 5.3 + i * 1.9) - 0.5) * 4;
      ctx.lineTo(px, py);
    }
    n = 7;
    for (let i = n; i >= 0; i--) {
      const px = x + (i / n) * w;
      const py = y + h + (hash(seed * 7.7 + i * 3.3) - 0.5) * 3.6;
      ctx.lineTo(px, py);
    }
    n = 5;
    for (let i = n - 1; i >= 0; i--) {
      const py = y + (i / n) * h;
      const px = x + (hash(seed * 9.1 + i * 2.3) - 0.5) * 4;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  private tracked(ctx: Ctx, text: string, x: number, y: number, spacing: number, align: 'left' | 'center' | 'right' = 'left'): void {
    const chars = Array.from(text);
    const widths: number[] = [];
    let total = 0;
    for (const ch of chars) {
      const w = ctx.measureText(ch).width;
      widths.push(w);
      total += w;
    }
    total += spacing * Math.max(0, chars.length - 1);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const prev = ctx.textAlign;
    ctx.textAlign = 'center';
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i]!, cx + widths[i]! / 2, y);
      cx += widths[i]! + spacing;
    }
    ctx.textAlign = prev;
  }

  /** Halftone dots, the house texture. */
  private dots(ctx: Ctx, x: number, y: number, w: number, h: number, alpha: number): void {
    const pat = ctx.createPattern(dotTile(), 'repeat');
    if (!pat) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = pat;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  private hero(
    ctx: Ctx,
    x: number,
    y: number,
    size: number,
    t: number,
    pose: Partial<Player> = {},
    vx = 0,
    vy = 0,
    silhouette = 0,
  ): void {
    const p = this.actor;
    p.throwAnim = 0;
    p.walkPhase = 0;
    p.hurtFlash = 0;
    p.held = null;
    p.body.vx = vx;
    p.body.vy = vy;
    Object.assign(p, pose);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    // hard print shadow
    ctx.fillStyle = 'rgba(26, 20, 48, 0.28)';
    ctx.beginPath();
    ctx.ellipse(4, 5, 17, 5, 0, 0, TAU);
    ctx.fill();
    if (silhouette > 0) ctx.filter = `brightness(${(1 - silhouette).toFixed(2)})`;
    ctx.shadowColor = INK;
    ctx.shadowBlur = 2.5;
    ctx.shadowOffsetY = 1.5;
    drawPlayer(ctx, p, 0, 0, t + 0.6, this.heroId);
    ctx.filter = 'none';
    ctx.restore();
  }

  private companion(
    ctx: Ctx,
    x: number,
    y: number,
    size: number,
    t: number,
    pose: Record<string, unknown> = {},
    facing = -1,
  ): void {
    const pet = this.pet;
    pet.sitting = false;
    pet.vx = 0;
    pet.vy = 0;
    pet.idle = 0;
    pet.facing = facing;
    Object.assign(pet, pose);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.fillStyle = 'rgba(26, 20, 48, 0.25)';
    ctx.beginPath();
    ctx.ellipse(1, 4, 12, 3.5, 0, 0, TAU);
    ctx.fill();
    ctx.shadowColor = INK;
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1.5;
    const z = pet.species === 'parrot' ? 30 + Math.sin(t * 5) * 3 : 0;
    drawPet(ctx, pet, 0, 0, z, t + 0.3);
    ctx.restore();
  }

  private mover(
    ctx: Ctx,
    index: number,
    x: number,
    y: number,
    size: number,
    t: number,
    facing: number,
    walking: boolean,
    silhouette = 0,
  ): void {
    const e = this.crew[index % this.crew.length]!;
    e.facing = facing;
    e.walkPhase = walking ? t * 11 + index : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.fillStyle = 'rgba(26, 20, 48, 0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 6, 18, 6, 0, 0, TAU);
    ctx.fill();
    if (silhouette > 0) ctx.filter = `brightness(${(1 - silhouette).toFixed(2)})`;
    ctx.shadowColor = INK;
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1.5;
    drawEnemy(ctx, e, 0, 0, t);
    ctx.filter = 'none';
    ctx.restore();
  }

  // ═════════════════════════ shared props ═════════════════════════

  private flatBox(ctx: Ctx, x: number, y: number, spin: number, size = 1, squash = 0, label = 0): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.scale(size * (1 + squash), size * (1 - squash));
    ctx.fillStyle = 'rgba(26, 20, 48, 0.3)';
    ctx.beginPath();
    ctx.ellipse(3, 6, 18, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d9a45a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.rect(-15, -6, 30, 11);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b87c3e';
    ctx.fillRect(-15, 2, 30, 3);
    ctx.fillStyle = '#f6e7c8';
    ctx.fillRect(-4, -6, 8, 11);
    ctx.strokeStyle = 'rgba(26, 20, 48, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.lineTo(4, 5);
    ctx.moveTo(4, -6);
    ctx.lineTo(-4, 5);
    ctx.stroke();
    if (label > 0.3) {
      ctx.fillStyle = CREAM;
      ctx.fillRect(5, -4, 8, 6);
      ctx.fillStyle = CORAL;
      ctx.fillRect(5, -4, 8, 2);
    }
    ctx.restore();
  }

  private toaster(ctx: Ctx, x: number, y: number, rot: number, scale: number, toast: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(26, 20, 48, 0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 13, 17, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = CYAN;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-15, -10, 30, 22, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7fd7df';
    ctx.fillRect(-15, 3, 30, 9);
    ctx.fillStyle = INK;
    ctx.fillRect(-10, -9, 8, 2.6);
    ctx.fillRect(2, -9, 8, 2.6);
    if (toast > 0) {
      ctx.fillStyle = '#f2b96a';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      for (const tx of [-9, 3]) {
        ctx.beginPath();
        ctx.roundRect(tx, -14 - toast * 3, 7, 8, 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(-11, 8, 2.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  private van(ctx: Ctx, x: number, y: number, open: number, t: number, moving: boolean, lights: boolean): void {
    const bounce = moving ? Math.abs(Math.sin(t * 17)) * -2 : 0;
    ctx.save();
    ctx.translate(x, y + bounce);
    ctx.fillStyle = 'rgba(26, 20, 48, 0.28)';
    ctx.beginPath();
    ctx.ellipse(46, 9 - bounce, 94, 9, 0, 0, TAU);
    ctx.fill();
    if (moving && lights) {
      ctx.fillStyle = 'rgba(255, 210, 63, 0.35)';
      ctx.beginPath();
      ctx.moveTo(-34, -32);
      ctx.lineTo(-170, -54);
      ctx.lineTo(-170, 6);
      ctx.lineTo(-34, -4);
      ctx.closePath();
      ctx.fill();
    }
    // cab
    ctx.fillStyle = CORAL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-36, 0);
    ctx.lineTo(-36, -32);
    ctx.lineTo(-19, -50);
    ctx.lineTo(4, -50);
    ctx.lineTo(4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = CYAN;
    ctx.beginPath();
    ctx.moveTo(-31, -32);
    ctx.lineTo(-18, -45);
    ctx.lineTo(-4, -45);
    ctx.lineTo(-4, -32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // body
    ctx.fillStyle = CREAM;
    ctx.fillRect(4, -68, 124, 68);
    ctx.strokeRect(4, -68, 124, 68);
    ctx.fillStyle = CORAL;
    ctx.fillRect(4, -31, 124, 8);
    ctx.fillStyle = '#e0d3b4';
    ctx.fillRect(4, -9, 124, 9);
    ctx.fillStyle = INK;
    ctx.fillRect(28, -62, 74, 20);
    ctx.fillStyle = YELLOW;
    ctx.font = `italic 400 11px ${SHOUT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MOVERS & CO.', 65, -52);
    if (open > 0.02) {
      ctx.fillStyle = NIGHT_DEEP;
      ctx.fillRect(122, -64, 6, 62);
      ctx.fillStyle = 'rgba(255, 210, 63, 0.4)';
      ctx.fillRect(128, -64, 28, 62);
      ctx.fillStyle = '#d9a45a';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6;
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(132, -10 - i * 9, 24, 7);
        ctx.strokeRect(132, -10 - i * 9, 24, 7);
      }
      ctx.beginPath();
      ctx.moveTo(126, -68);
      ctx.lineTo(126 + 26 * open, -78);
      ctx.lineTo(126 + 26 * open, -6);
      ctx.lineTo(126, 0);
      ctx.closePath();
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(65, -68);
      ctx.lineTo(65, 0);
      ctx.stroke();
      ctx.fillStyle = INK;
      for (const hx of [58, 72]) ctx.fillRect(hx, -36, 3, 9);
    }
    ctx.fillStyle = moving ? YELLOW : CORAL;
    ctx.beginPath();
    ctx.arc(127, -6, 4, 0, TAU);
    ctx.fill();
    for (const wx of [-15, 102]) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(wx, 2, 12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = CREAM;
      ctx.beginPath();
      ctx.arc(wx, 2, 4.8, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private keys(ctx: Ctx, x: number, y: number, size: number, rot: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(size, size);
    ctx.fillStyle = 'rgba(26, 20, 48, 0.3)';
    ctx.beginPath();
    ctx.ellipse(4, 7, 18, 4, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = YELLOW;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-12, 0, 5.5, 0, TAU);
    ctx.stroke();
    for (const [kx, ky, kr] of [[3, -2, -0.2], [5, 4, 0.24]] as const) {
      ctx.save();
      ctx.translate(kx, ky);
      ctx.rotate(kr);
      ctx.fillStyle = YELLOW;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(0, -2.4, 16, 4.8, 1.6);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(12, 2, 3, 4.5);
      ctx.fillRect(8, 2, 2.6, 3.4);
      ctx.restore();
    }
    ctx.restore();
  }

  private mug(ctx: Ctx, x: number, y: number, t: number, steam: number, scale = 1): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(26, 20, 48, 0.28)';
    ctx.beginPath();
    ctx.ellipse(2, 8, 12, 3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = CORAL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-9, -10, 18, 17, 3);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(10, -2, 4.6, -1.2, 1.2);
    ctx.stroke();
    ctx.fillStyle = '#7a3a36';
    ctx.fillRect(-7, -8, 14, 2.4);
    if (steam > 0) {
      ctx.strokeStyle = `rgba(246, 231, 200, ${(0.5 * steam).toFixed(2)})`;
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.45 + i * 0.3) % 1;
        ctx.beginPath();
        ctx.moveTo(-4 + i * 4, -12 - p * 3);
        ctx.quadraticCurveTo(-8 + i * 4 + Math.sin(p * 6) * 3, -18 - p * 6, -3 + i * 4, -23 - p * 8);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private plant(ctx: Ctx, x: number, y: number, scale: number, sway: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(26, 20, 48, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 20, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = CORAL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-15, -10);
    ctx.lineTo(15, -10);
    ctx.lineTo(11, 3);
    ctx.lineTo(-11, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = TEAL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = -1.9 + i * 0.5 + sway * (0.2 + i * 0.03);
      ctx.save();
      ctx.translate(0, -10);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, -17, 6, 15, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  private rain(ctx: Ctx, t: number, alpha: number): void {
    ctx.save();
    ctx.strokeStyle = `rgba(74, 214, 232, ${(0.55 * alpha).toFixed(2)})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 58; i++) {
      const x = hash(i * 12.9) * (W + 60) - 24;
      const y = (hash(i * 7.7) * (H + 80) + t * 420) % (H + 80) - 30;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 13);
    }
    ctx.stroke();
    ctx.strokeStyle = `rgba(246, 231, 200, ${(0.3 * alpha).toFixed(2)})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const x = hash(i * 31.7) * W;
      const p = (t * 1.8 + i * 0.41) % 1;
      const y = 232 + hash(i * 3.3) * 30;
      ctx.beginPath();
      ctx.ellipse(x, y, 2 + p * 7, (2 + p * 7) * 0.3, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  private dust(ctx: Ctx, t: number, x0: number, y0: number, x1: number, y1: number, count: number, color: string): void {
    ctx.save();
    for (let i = 0; i < count; i++) {
      const p = (hash(i * 4.4) + t * (0.02 + hash(i) * 0.02)) % 1;
      const x = x0 + hash(i * 7.1) * (x1 - x0) + Math.sin(t * 0.5 + i) * 4;
      const y = y0 + p * (y1 - y0);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.25 + 0.35 * Math.sin(t * 1.7 + i * 2.2);
      ctx.fillRect(x, y, 1.4, 1.4);
    }
    ctx.restore();
  }

  // ═════════════════════════ FILM ONE: EVICTED ═════════════════════════

  private evicted(ctx: Ctx, t: number): void {
    if (t < 2.0) {
      const p = clamp(t / 2.0, 0, 1);
      const sh = shakeAt(t - 1.9, 4);
      ctx.save();
      this.cam(ctx, lerp(1.0, 1.07, ease(p)), 0, lerp(0, 7, ease(p)), 0, sh, sh * 0.6);
      this.hall(ctx, t, p);
      ctx.restore();
    } else if (t < 4.0) {
      const l = clamp((t - 2.0) / 2.0, 0, 1);
      const sh = shakeAt(t - 2.04, 5) + shakeAt(t - 2.52, 3.5);
      ctx.save();
      this.cam(ctx, lerp(1.0, 1.14, ease(l)), 0, lerp(0, -4, ease(l)), -0.006, sh, sh * 0.5);
      this.burst(ctx, t, l);
      ctx.restore();
    } else {
      const l = clamp((t - 4.0) / 2.4, 0, 1);
      ctx.save();
      this.cam(ctx, lerp(1.05, 1.0, ease(l)), 0, lerp(-3, 0, ease(l)), 0);
      this.evictedStreet(ctx, t, l);
      ctx.restore();
    }
  }

  private hall(ctx: Ctx, t: number, p: number): void {
    // back wall and ceiling
    ctx.fillStyle = '#2f7f86';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#286f77';
    ctx.fillRect(0, 120, W, H - 120);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, 44);
    ctx.fillStyle = '#1d2a52';
    ctx.fillRect(0, 44, W, 12);

    // side walls in one-point perspective
    ctx.fillStyle = '#3a8f96';
    ctx.beginPath();
    ctx.moveTo(0, 28);
    ctx.lineTo(196, 64);
    ctx.lineTo(196, 196);
    ctx.lineTo(0, 252);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#266c74';
    ctx.beginPath();
    ctx.moveTo(W, 28);
    ctx.lineTo(284, 64);
    ctx.lineTo(284, 196);
    ctx.lineTo(W, 252);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // floor
    ctx.fillStyle = '#e0b878';
    ctx.beginPath();
    ctx.moveTo(0, 252);
    ctx.lineTo(196, 196);
    ctx.lineTo(284, 196);
    ctx.lineTo(W, 252);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 252);
    ctx.lineTo(196, 196);
    ctx.lineTo(284, 196);
    ctx.lineTo(W, 252);
    ctx.stroke();

    // floorboards to the vanishing point
    ctx.strokeStyle = 'rgba(26, 20, 48, 0.18)';
    ctx.lineWidth = 1.4;
    for (const bx of [40, 110, 170, 310, 370, 440]) {
      ctx.beginPath();
      ctx.moveTo(240, 196);
      ctx.lineTo(bx, 270);
      ctx.stroke();
    }
    for (const by of [216, 240, 263]) {
      ctx.beginPath();
      ctx.moveTo(0, by + 6);
      ctx.lineTo(W, by + 6);
      ctx.stroke();
    }

    // runner, from the door to the street
    ctx.fillStyle = CORAL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(204, 196);
    ctx.lineTo(276, 196);
    ctx.lineTo(392, 270);
    ctx.lineTo(88, 270);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(214, 200);
    ctx.lineTo(266, 200);
    ctx.lineTo(360, 266);
    ctx.moveTo(204, 196);
    ctx.lineTo(88, 270);
    ctx.moveTo(276, 196);
    ctx.lineTo(392, 270);
    ctx.stroke();
    this.dots(ctx, 88, 196, 304, 74, 0.07);

    // wainscot along both walls
    ctx.fillStyle = 'rgba(26, 20, 48, 0.14)';
    ctx.beginPath();
    ctx.moveTo(0, 198);
    ctx.lineTo(196, 172);
    ctx.lineTo(196, 196);
    ctx.lineTo(0, 252);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(284, 172);
    ctx.lineTo(W, 198);
    ctx.lineTo(W, 252);
    ctx.lineTo(284, 196);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 198);
    ctx.lineTo(196, 172);
    ctx.moveTo(284, 172);
    ctx.lineTo(W, 198);
    ctx.stroke();

    // picture rail and skirting
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 120);
    ctx.lineTo(196, 120);
    ctx.moveTo(284, 120);
    ctx.lineTo(W, 120);
    ctx.stroke();

    // door, with the removal crew framed in the light
    ctx.fillStyle = INK;
    ctx.fillRect(204, 80, 72, 118);
    ctx.fillStyle = YELLOW;
    ctx.fillRect(209, 85, 62, 108);
    ctx.fillStyle = CREAM;
    ctx.fillRect(214, 90, 52, 98);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(214, 90, 52, 98);
    ctx.fillStyle = '#ffe9a3';
    ctx.beginPath();
    ctx.moveTo(214, 188);
    ctx.lineTo(214, 112);
    ctx.lineTo(240, 124);
    ctx.lineTo(240, 188);
    ctx.closePath();
    ctx.fill();

    // open door panel
    ctx.fillStyle = CORAL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(276, 84);
    ctx.lineTo(306, 100);
    ctx.lineTo(306, 196);
    ctx.lineTo(276, 196);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(26, 20, 48, 0.2)';
    ctx.fillRect(288, 112, 7, 62);

    // light spill
    ctx.fillStyle = 'rgba(255, 210, 63, 0.3)';
    ctx.beginPath();
    ctx.moveTo(204, 196);
    ctx.lineTo(276, 196);
    ctx.lineTo(346, 254);
    ctx.lineTo(136, 254);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 243, 214, 0.2)';
    ctx.beginPath();
    ctx.moveTo(216, 196);
    ctx.lineTo(264, 196);
    ctx.lineTo(306, 254);
    ctx.lineTo(176, 254);
    ctx.closePath();
    ctx.fill();
    this.dots(ctx, 136, 196, 210, 58, 0.08);

    // framed pictures on the left wall
    for (const [fx, fy, fw, fh, art] of [
      [38, 98, 46, 44, TEAL],
      [104, 124, 34, 32, CORAL],
    ] as const) {
      ctx.fillStyle = PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + fw, fy + 8);
      ctx.lineTo(fx + fw, fy + fh);
      ctx.lineTo(fx, fy + fh - 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = art;
      ctx.beginPath();
      ctx.moveTo(fx + 6, fy + 7);
      ctx.lineTo(fx + fw - 7, fy + 13);
      ctx.lineTo(fx + fw - 7, fy + fh - 7);
      ctx.lineTo(fx + 6, fy + fh - 11);
      ctx.closePath();
      ctx.fill();
    }

    // coats on the right wall
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    for (const [hx, hy] of [[362, 104], [392, 116], [420, 128]] as const) {
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + 5, hy + 6);
      ctx.stroke();
    }
    ctx.fillStyle = CORAL;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(354, 110);
    ctx.lineTo(346, 170);
    ctx.lineTo(372, 166);
    ctx.lineTo(366, 110);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PLUM;
    ctx.beginPath();
    ctx.moveTo(392, 122);
    ctx.lineTo(386, 184);
    ctx.lineTo(410, 178);
    ctx.lineTo(404, 122);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // pendant bulb
    const flicker = 0.86 + Math.sin(t * 31) * 0.04 + Math.sin(t * 7) * 0.04;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(240, 44);
    ctx.lineTo(240, 58);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(228, 58);
    ctx.lineTo(252, 58);
    ctx.lineTo(246, 68);
    ctx.lineTo(234, 68);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(240, 70, 4.6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 210, 63, ${(0.3 * flicker).toFixed(2)})`;
    ctx.lineWidth = 1.4;
    for (const r of [9, 14, 19]) {
      ctx.beginPath();
      ctx.arc(240, 70, r, 0, TAU);
      ctx.stroke();
    }

    // the crew, backlit in the doorway
    this.mover(ctx, 0, 216, 194, 0.82, t, Math.PI, false, 1);
    this.mover(ctx, 1, 241, 196, 0.9, t, Math.PI, false, 1);
    this.mover(ctx, 2, 265, 194, 0.78, t, Math.PI, false, 1);

    // boxes stacked by the door
    this.flatBox(ctx, 291, 190, -0.06, 0.75, 0, 1);
    this.flatBox(ctx, 289, 181, 0.05, 0.62, 0, 1);

    // our tenant, toaster in hand
    const release = 0.74;
    const q = clamp((p - release) / 0.2, 0, 1);
    const toasterHeld = p < release;
    this.hero(ctx, 128, 242, 1.52, t, { aimX: 1, aimY: -0.04, throwAnim: p > 0.6 && p < 0.78 ? 1 : 0 }, 0, 0);
    if (toasterHeld) {
      this.toaster(ctx, 150, 228, -0.2 + Math.sin(t * 4) * 0.03, 0.86, 0.4);
    } else if (q < 1) {
      const tx = lerp(150, 236, q);
      const ty = lerp(228, 174, q) - Math.sin(q * Math.PI) * 26;
      this.toaster(ctx, tx, ty, -0.2 + q * 7, 0.86, 0.4);
    }
    if (p > 0.94) {
      this.impact(ctx, 236, 174, clamp((p - 0.94) / 0.06, 0, 1));
    }

    // dust in the door light
    this.dust(ctx, t, 190, 150, 300, 242, 22, 'rgba(255, 243, 214, 0.8)');
    this.dots(ctx, 284, 64, 196, 132, 0.05);
  }

  private burst(ctx: Ctx, t: number, l: number): void {
    // exterior wall
    ctx.fillStyle = PLUM;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#51386e';
    ctx.fillRect(0, 0, W, 36);
    ctx.strokeStyle = 'rgba(26, 20, 48, 0.18)';
    ctx.lineWidth = 1.2;
    for (let y = 48; y < H; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let row = 0; row < 10; row++) {
      const y = 48 + row * 22;
      const off = row % 2 === 0 ? 0 : 26;
      for (let x = off; x < W; x += 52) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 22);
        ctx.stroke();
      }
    }

    // the doorway, blown wide
    ctx.fillStyle = INK;
    ctx.fillRect(120, 38, 242, 198);
    ctx.fillStyle = '#ffb43c';
    ctx.fillRect(127, 45, 228, 184);
    ctx.fillStyle = YELLOW;
    ctx.fillRect(136, 54, 210, 168);
    ctx.fillStyle = '#fff3cd';
    ctx.beginPath();
    ctx.arc(241, 138, 84, 0, TAU);
    ctx.fill();
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(241, 138, 64, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(241, 138, 84, 0, TAU);
    ctx.stroke();
    // hallway floor inside the light
    ctx.fillStyle = '#d98a2e';
    ctx.fillRect(136, 198, 210, 31);
    ctx.strokeStyle = 'rgba(26, 20, 48, 0.3)';
    ctx.lineWidth = 1.4;
    for (const bx of [170, 210, 241, 272, 312]) {
      ctx.beginPath();
      ctx.moveTo(241, 198);
      ctx.lineTo(bx, 229);
      ctx.stroke();
    }

    // light rays
    ctx.save();
    ctx.translate(241, 138);
    ctx.fillStyle = 'rgba(255, 243, 214, 0.2)';
    for (let i = 0; i < 10; i++) {
      ctx.rotate(TAU / 10);
      ctx.beginPath();
      ctx.moveTo(16, -6);
      ctx.lineTo(310, -30);
      ctx.lineTo(310, 30);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // the crew, silhouetted in the blast
    this.mover(ctx, 0, 194, 214, 0.8, t, 0, false, 1);
    this.mover(ctx, 1, 290, 216, 0.86, t, Math.PI, false, 1);

    // jambs, to keep the doorway a doorway
    ctx.fillStyle = INK;
    ctx.fillRect(120, 38, 13, 198);
    ctx.fillRect(349, 38, 13, 198);
    ctx.fillRect(120, 38, 242, 13);

    // open door, hanging off its hinges
    ctx.fillStyle = CORAL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(127, 45);
    ctx.lineTo(58, 68);
    ctx.lineTo(58, 246);
    ctx.lineTo(127, 229);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(26, 20, 48, 0.16)';
    ctx.fillRect(72, 92, 10, 118);

    // steps
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 === 0 ? CREAM : '#e0d3b4';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.rect(76 - i * 14, 214 + i * 11, 354 + i * 28, 11);
      ctx.fill();
      ctx.stroke();
    }

    // boxes coming out hot
    const boxes = [
      { from: [252, 196], to: [104, 228], s: [0.9, 2.0], delay: 0.02 },
      { from: [248, 192], to: [346, 220], s: [0.8, 1.6], delay: 0.16 },
      { from: [242, 194], to: [176, 212], s: [0.7, 1.25], delay: 0.34 },
      { from: [244, 198], to: [246, 238], s: [0.9, 2.7], delay: 0.52 },
    ] as const;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]!;
      const q = clamp((l - b.delay) / 0.36, 0, 1);
      if (q <= 0) continue;
      const x = lerp(b.from[0], b.to[0], q * q);
      const y = lerp(b.from[1], b.to[1], q) - Math.sin(q * Math.PI) * 18;
      const size = lerp(b.s[0], b.s[1], q);
      this.flatBox(ctx, x, y, (i % 2 === 0 ? -1 : 1) * q * 0.55, size, 0, 1);
    }

    // speed lines
    ctx.strokeStyle = 'rgba(255, 243, 214, 0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const a = 0.35 + i * 0.19;
      const r0 = 58 + i * 6;
      const r1 = 130 + i * 10;
      ctx.beginPath();
      ctx.moveTo(240 + Math.cos(a) * r0, 150 + Math.sin(a) * r0);
      ctx.lineTo(240 + Math.cos(a) * r1, 150 + Math.sin(a) * r1);
      ctx.stroke();
    }

    // our tenant, braced against the wall
    this.hero(ctx, 72, 242, 1.34, t, { aimX: 1, aimY: 0.06 }, 0, 0);
    if (l < 0.24) this.toaster(ctx, 96, 226, -0.15, 0.86, 0.4);

    // a box swallows the lens
    if (l > 0.82) {
      const q = ease((l - 0.82) / 0.18);
      ctx.save();
      ctx.translate(240, 220);
      ctx.rotate(-0.08);
      ctx.fillStyle = '#d9a45a';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.rect(-60 - q * 140, -50 - q * 90, 120 + q * 280, 100 + q * 180);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f6e7c8';
      ctx.fillRect(-16 - q * 40, -50 - q * 90, 32 + q * 80, 18 + q * 26);
      ctx.restore();
    }

    this.dots(ctx, 0, 0, W, H, 0.05);

    // flash on the cut
    if (l > 0.94) {
      ctx.fillStyle = `rgba(255, 243, 214, ${clamp((l - 0.94) / 0.06, 0, 1).toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private evictedStreet(ctx: Ctx, t: number, l: number): void {
    // sky
    ctx.fillStyle = NIGHT;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2b3a67';
    ctx.fillRect(0, 120, W, 112);
    this.dots(ctx, 0, 0, W, 150, 0.05);

    // clouds, moon and stars
    ctx.fillStyle = 'rgba(107, 63, 122, 0.5)';
    for (const [cx, cy, rx, ry] of [[70, 46, 66, 12], [430, 40, 72, 13], [206, 28, 52, 10]] as const) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(354, 64, 25, 0, TAU);
    ctx.fill();
    ctx.fillStyle = NIGHT;
    ctx.beginPath();
    ctx.arc(364, 55, 21, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 210, 63, 0.85)';
    ctx.beginPath();
    ctx.arc(343, 74, 4.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(350, 60, 2.6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 243, 214, 0.6)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 9; i++) {
      const sx = 30 + hash(i * 5.3) * 420;
      const sy = 34 + hash(i * 8.1) * 82;
      const r = 2 + (i % 2);
      ctx.beginPath();
      ctx.moveTo(sx - r, sy);
      ctx.lineTo(sx + r, sy);
      ctx.moveTo(sx, sy - r);
      ctx.lineTo(sx, sy + r);
      ctx.stroke();
    }

    // distant skyline
    ctx.fillStyle = '#161c3a';
    ctx.beginPath();
    ctx.moveTo(0, 172);
    for (let i = 0; i < 8; i++) {
      const bx = i * 66;
      const bh = 24 + ((i * 37) % 46);
      ctx.lineTo(bx, 172 - bh);
      ctx.lineTo(bx + 44, 172 - bh);
      ctx.lineTo(bx + 44, 172);
    }
    ctx.lineTo(W, 172);
    ctx.lineTo(W, 230);
    ctx.lineTo(0, 230);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 210, 63, 0.6)';
    for (let i = 0; i < 9; i++) {
      ctx.fillRect(18 + hash(i * 2.1) * 430, 138 + hash(i * 4.7) * 26, 4, 6);
    }

    // the house, still standing
    ctx.fillStyle = TEAL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.4;
    ctx.fillRect(10, 54, 198, 178);
    ctx.strokeRect(10, 54, 198, 178);
    ctx.fillStyle = '#3a8f96';
    ctx.fillRect(10, 54, 198, 22);
    ctx.strokeStyle = 'rgba(26, 20, 48, 0.14)';
    ctx.lineWidth = 1.2;
    for (let y = 84; y < 228; y += 18) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(208, y);
      ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const wx = 30 + i * 58;
        const wy = 84 + j * 48;
        this.windowPane(ctx, wx, wy, 36, 30, !(i === 1 && j === 0));
      }
    }
    // door
    ctx.fillStyle = INK;
    ctx.fillRect(92, 158, 56, 74);
    ctx.fillStyle = CORAL;
    ctx.fillRect(98, 164, 44, 68);
    ctx.fillStyle = 'rgba(255, 210, 63, 0.75)';
    ctx.fillRect(105, 170, 30, 40);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(105, 170, 30, 40);
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(136, 202, 2.4, 0, TAU);
    ctx.fill();
    // stoop
    ctx.fillStyle = CREAM;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.rect(84 - i * 10, 232 + i * 8, 72 + i * 20, 8);
      ctx.fill();
      ctx.stroke();
    }

    // road
    ctx.fillStyle = '#1b2450';
    ctx.fillRect(0, 230, W, 40);
    ctx.fillStyle = '#2b3a67';
    ctx.fillRect(0, 222, W, 9);
    ctx.strokeStyle = 'rgba(246, 231, 200, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.moveTo(0, 252);
    ctx.lineTo(W, 252);
    ctx.stroke();
    ctx.setLineDash([]);

    // street lamp
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(300, 226);
    ctx.lineTo(300, 100);
    ctx.quadraticCurveTo(300, 88, 312, 88);
    ctx.stroke();
    ctx.fillStyle = YELLOW;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(314, 90, 11, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 210, 63, 0.26)';
    ctx.lineWidth = 2;
    for (const r of [20, 28, 38]) {
      ctx.beginPath();
      ctx.arc(314, 90, r, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 210, 63, 0.2)';
    ctx.beginPath();
    ctx.moveTo(302, 100);
    ctx.lineTo(326, 100);
    ctx.lineTo(366, 246);
    ctx.lineTo(250, 246);
    ctx.closePath();
    ctx.fill();

    // warm reflections on wet tarmac
    ctx.fillStyle = 'rgba(255, 210, 63, 0.2)';
    ctx.fillRect(306, 236, 16, 26);
    ctx.fillStyle = 'rgba(255, 90, 78, 0.2)';
    ctx.fillRect(424, 238, 12, 18);

    // our tenant, victorious, pet at heel
    const raise = clamp((l - 0.45) / 0.3, 0, 1);
    this.hero(ctx, 334, 240, 1.42, t, { aimX: 0.55, aimY: -0.35, throwAnim: 0.2 }, 0, 0);
    this.toaster(ctx, lerp(354, 348, raise), lerp(228, 208, raise), -0.25 - raise * 0.25, 0.9, 0.9);
    this.companion(ctx, 371, 244, 0.86, t, { sitting: false }, -1);

    // the van, leaving with the last of it
    this.van(ctx, 392, 224, 0, t, true, true);

    // paper blowing through the lamplight
    for (let i = 0; i < 5; i++) {
      const px = 240 + hash(i * 3.1) * 170 + Math.sin(t * 1.3 + i) * 12;
      const py = 180 + hash(i * 7.9) * 54;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(t * 2 + i);
      ctx.fillStyle = 'rgba(246, 231, 200, 0.7)';
      ctx.fillRect(-3, -2, 6, 4);
      ctx.restore();
    }

    this.rain(ctx, t, 0.12);
    this.dots(ctx, 10, 54, 198, 178, 0.05);
  }

  // ═════════════════════════ FILM TWO: HOME ═════════════════════════

  private victory(ctx: Ctx, t: number): void {
    if (t < 2.2) {
      const p = clamp(t / 2.2, 0, 1);
      ctx.save();
      this.cam(ctx, lerp(1.16, 1.24, ease(p)), lerp(4, 16, ease(p)), -5, 0);
      this.homeRoom(ctx, t, p);
      ctx.restore();
    } else if (t < 4.0) {
      const p = clamp((t - 2.2) / 1.8, 0, 1);
      ctx.save();
      this.cam(ctx, lerp(1.05, 1.12, ease(p)), 0, -6, 0);
      this.homeStill(ctx, t, p);
      ctx.restore();
    } else {
      const p = clamp((t - 4.0) / 2.0, 0, 1);
      ctx.save();
      this.cam(ctx, lerp(1.0, 1.06, ease(p)), 0, 0, 0);
      this.homeStep(ctx, t, p);
      ctx.restore();
    }
  }

  private homeRoom(ctx: Ctx, t: number, p: number): void {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    // wall and floor
    ctx.fillStyle = '#f6e2ba';
    ctx.fillRect(0, 24, W, 176);
    ctx.fillStyle = '#cf8f4f';
    ctx.fillRect(0, 200, W, 70);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 200);
    ctx.lineTo(W, 200);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(26, 20, 48, 0.22)';
    ctx.lineWidth = 1.4;
    for (const fy of [214, 228, 244]) {
      ctx.beginPath();
      ctx.moveTo(0, fy);
      ctx.lineTo(W, fy);
      ctx.stroke();
    }
    for (const fx of [40, 130, 220, 310, 400]) {
      ctx.beginPath();
      ctx.moveTo(fx, 202);
      ctx.lineTo(fx - 26, 270);
      ctx.stroke();
    }
    // wainscot
    ctx.fillStyle = TEAL;
    ctx.fillRect(0, 164, W, 36);
    ctx.strokeStyle = 'rgba(26, 20, 48, 0.25)';
    ctx.lineWidth = 1.2;
    for (let x = 24; x < W; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 166);
      ctx.lineTo(x, 199);
      ctx.stroke();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 164);
    ctx.lineTo(W, 164);
    ctx.stroke();

    // window
    ctx.fillStyle = INK;
    ctx.fillRect(266, 42, 168, 118);
    ctx.fillStyle = '#ffe9a3';
    ctx.fillRect(272, 48, 156, 106);
    ctx.fillStyle = '#fff6cf';
    ctx.fillRect(272, 48, 156, 44);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.strokeRect(272, 48, 156, 106);
    ctx.beginPath();
    ctx.moveTo(350, 48);
    ctx.lineTo(350, 154);
    ctx.moveTo(272, 100);
    ctx.lineTo(428, 100);
    ctx.stroke();
    // blinds
    ctx.fillStyle = '#e0d3b4';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(274, 50 + i * 8, 152, 4);
      ctx.strokeStyle = 'rgba(26, 20, 48, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(274, 50 + i * 8, 152, 4);
    }
    // curtains
    ctx.fillStyle = CORAL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(260, 38);
    ctx.lineTo(286, 38);
    ctx.quadraticCurveTo(276, 100, 288, 160);
    ctx.lineTo(256, 160);
    ctx.quadraticCurveTo(266, 100, 260, 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(412, 38);
    ctx.lineTo(438, 38);
    ctx.quadraticCurveTo(428, 100, 440, 160);
    ctx.lineTo(408, 160);
    ctx.quadraticCurveTo(418, 100, 412, 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // sun stripes across the room
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#fff3cd';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(278 + i * 34, 154);
      ctx.lineTo(300 + i * 34, 154);
      ctx.lineTo(206 + i * 34, 246);
      ctx.lineTo(176 + i * 34, 246);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // framed picture
    ctx.fillStyle = INK;
    ctx.fillRect(48, 66, 62, 50);
    ctx.fillStyle = CREAM;
    ctx.fillRect(53, 71, 52, 40);
    ctx.fillStyle = TEAL;
    ctx.beginPath();
    ctx.moveTo(60, 104);
    ctx.lineTo(78, 82);
    ctx.lineTo(96, 104);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = CORAL;
    ctx.beginPath();
    ctx.arc(86, 84, 5, 0, TAU);
    ctx.fill();

    // note taped to the wall
    this.note(ctx, 150, 96, -0.04, 74, 42, 'STILL HERE.', 9);

    // rug
    ctx.fillStyle = CORAL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(58, 204, 240, 32, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = CREAM;
    ctx.fillRect(66, 210, 224, 4);
    ctx.fillRect(66, 226, 224, 4);

    // the box pile, flattened and stacked
    this.flatBox(ctx, 142, 210, -0.04, 1.15, 0, 1);
    this.flatBox(ctx, 178, 204, 0.05, 1.2, 0, 1);
    this.flatBox(ctx, 214, 210, -0.02, 1.05, 0, 0);
    this.flatBox(ctx, 180, 196, 0.03, 1.0, 0, 1);
    // a framed "HOME" box
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.save();
    ctx.translate(178, 196);
    ctx.rotate(0.03);
    ctx.fillRect(-14, -9, 28, 9);
    ctx.strokeRect(-14, -9, 28, 9);
    ctx.fillStyle = INK;
    ctx.font = `700 5px ${TYPE_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOME', 0, -4.5);
    ctx.restore();

    // tenant and pet, at home on the pile
    const cheer = clamp((p - 0.45) / 0.3, 0, 1);
    this.hero(ctx, 206, 192, 1.22, t, { aimX: -1, aimY: -0.1, throwAnim: 0.2 }, 0, 0);
    this.mug(ctx, lerp(190, 190, cheer), lerp(174, 166, cheer), t, 1);
    this.companion(ctx, 158, 202, 0.82, t, { sitting: true }, 1);

    // trophy toaster on a box
    this.toaster(ctx, 250, 186, -0.08, 0.72, 0.8);
    // plant
    this.plant(ctx, 444, 230, 1.15, Math.sin(t * 1.2) * 0.08);

    // dust in the sun
    this.dust(ctx, t, 180, 60, 430, 240, 30, 'rgba(255, 255, 255, 0.8)');
    this.dots(ctx, 0, 24, W, 176, 0.04);
  }

  private homeStill(ctx: Ctx, t: number, p: number): void {
    // deep teal room
    ctx.fillStyle = TEAL;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2a737a';
    ctx.fillRect(0, 0, W, 96);
    this.dots(ctx, 0, 0, W, H, 0.07);

    // the morning sun, flat behind the mug
    ctx.fillStyle = '#fff3cd';
    ctx.beginPath();
    ctx.arc(152, 112, 96, 0, TAU);
    ctx.fill();
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(152, 112, 78, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(152, 112, 96, 0, TAU);
    ctx.stroke();

    // warm light wedge
    ctx.fillStyle = 'rgba(255, 243, 205, 0.16)';
    ctx.beginPath();
    ctx.moveTo(210, 0);
    ctx.lineTo(390, 0);
    ctx.lineTo(480, 246);
    ctx.lineTo(250, 246);
    ctx.closePath();
    ctx.fill();

    // the flattened box, now a table
    ctx.fillStyle = '#d9a45a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-20, 182);
    ctx.lineTo(500, 168);
    ctx.lineTo(500, 246);
    ctx.lineTo(-20, 246);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b87c3e';
    ctx.beginPath();
    ctx.moveTo(-20, 182);
    ctx.lineTo(500, 168);
    ctx.lineTo(500, 178);
    ctx.lineTo(-20, 192);
    ctx.closePath();
    ctx.fill();
    // tape + FRAGILE
    ctx.fillStyle = CREAM;
    ctx.save();
    ctx.translate(300, 200);
    ctx.rotate(-0.03);
    ctx.fillRect(-26, -7, 52, 14);
    ctx.fillStyle = INK;
    ctx.font = `700 7px ${TYPE_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FRAGILE', 0, 0);
    ctx.restore();

    // leaning photo of the two of them
    ctx.save();
    ctx.translate(66, 170);
    ctx.rotate(-0.1);
    ctx.fillStyle = 'rgba(26, 20, 48, 0.3)';
    ctx.fillRect(4, 5, 58, 66);
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.fillRect(0, 0, 58, 66);
    ctx.strokeRect(0, 0, 58, 66);
    ctx.fillStyle = TEAL;
    ctx.fillRect(6, 6, 46, 40);
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.arc(29, 26, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = CORAL;
    ctx.beginPath();
    ctx.arc(23, 22, 2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(35, 22, 2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = CORAL;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(22, 32);
    ctx.quadraticCurveTo(29, 38, 36, 32);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = `700 5px ${TYPE_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('STILL US', 29, 54);
    ctx.restore();

    // the mug
    this.mug(ctx, 150, 166, t, 1, 2.3);
    // the note
    this.note(ctx, 240, 150, -0.07, 104, 56, 'STILL HERE.', 13);
    // the toaster, trophy-sized
    this.toaster(ctx, 366, 158, -0.08, 2.3, 0.95);
    // a sprig
    this.plant(ctx, 442, 176, 1.15, Math.sin(t * 1.4) * 0.1);

    // coffee ring and crumbs
    ctx.strokeStyle = 'rgba(26, 20, 48, 0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(96, 216, 20, 6, -0.05, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(122, 74, 44, 0.7)';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(184 + hash(i * 3.9) * 170, 202 + hash(i * 6.1) * 26, 1.4 + hash(i) * 1.2, 0, TAU);
      ctx.fill();
    }

    // steam off the mug
    ctx.strokeStyle = 'rgba(255, 243, 214, 0.55)';
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 4; i++) {
      const q = (t * 0.35 + i * 0.25) % 1;
      ctx.beginPath();
      ctx.moveTo(138 + i * 7, 122 - q * 22);
      ctx.quadraticCurveTo(130 + i * 7 + Math.sin(q * 5) * 5, 108 - q * 24, 140 + i * 7, 92 - q * 30);
      ctx.stroke();
    }

    // push-in glow
    ctx.fillStyle = `rgba(255, 210, 63, ${(0.05 + 0.05 * p).toFixed(2)})`;
    ctx.fillRect(0, 0, W, H);
  }

  private homeStep(ctx: Ctx, t: number, p: number): void {
    // morning sky
    ctx.fillStyle = '#ffe9a3';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(0, 118, W, 80);
    ctx.fillStyle = '#f6c14e';
    ctx.fillRect(0, 176, W, 50);
    // clouds
    ctx.fillStyle = 'rgba(255, 243, 205, 0.6)';
    for (const [cx, cy, rx, ry] of [[132, 58, 62, 13], [286, 40, 48, 10]] as const) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
      ctx.fill();
    }
    // sun
    ctx.fillStyle = '#fff3cd';
    ctx.beginPath();
    ctx.arc(386, 72, 30, 0, TAU);
    ctx.fill();
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(386, 72, 21, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 210, 63, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + t * 0.04;
      ctx.beginPath();
      ctx.moveTo(386 + Math.cos(a) * 32, 72 + Math.sin(a) * 32);
      ctx.lineTo(386 + Math.cos(a) * 43, 72 + Math.sin(a) * 43);
      ctx.stroke();
    }

    // distant rooftops
    ctx.fillStyle = 'rgba(47, 127, 134, 0.35)';
    ctx.beginPath();
    ctx.moveTo(0, 168);
    for (let i = 0; i < 7; i++) {
      const bx = i * 76;
      const bh = 18 + ((i * 29) % 34);
      ctx.lineTo(bx, 168 - bh);
      ctx.lineTo(bx + 54, 168 - bh);
      ctx.lineTo(bx + 54, 168);
    }
    ctx.lineTo(W, 168);
    ctx.lineTo(W, 210);
    ctx.lineTo(0, 210);
    ctx.closePath();
    ctx.fill();

    // the house
    ctx.fillStyle = TEAL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.4;
    ctx.fillRect(20, 58, 258, 164);
    ctx.strokeRect(20, 58, 258, 164);
    ctx.fillStyle = '#3a8f96';
    ctx.fillRect(20, 58, 258, 16);
    // windows
    this.windowPane(ctx, 50, 96, 42, 34, true);
    this.windowPane(ctx, 116, 96, 42, 34, true);
    this.windowPane(ctx, 196, 96, 42, 34, false);
    // door
    ctx.fillStyle = INK;
    ctx.fillRect(72, 150, 56, 72);
    ctx.fillStyle = CORAL;
    ctx.fillRect(78, 156, 44, 66);
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(114, 190, 2.4, 0, TAU);
    ctx.fill();
    // awning
    ctx.fillStyle = CREAM;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(62, 146);
    ctx.lineTo(138, 146);
    ctx.lineTo(132, 158);
    ctx.lineTo(68, 158);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = CORAL;
      ctx.fillRect(68 + i * 17, 148, 9, 8);
    }

    // street
    ctx.fillStyle = '#e0b878';
    ctx.fillRect(0, 222, W, 48);
    ctx.fillStyle = '#e8d3a4';
    ctx.fillRect(0, 214, W, 10);
    ctx.strokeStyle = 'rgba(26, 20, 48, 0.16)';
    ctx.lineWidth = 1.4;
    for (let x = -20; x < W; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 224);
      ctx.lineTo(x - 26, 270);
      ctx.stroke();
    }
    // the tree on the pavement
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.fillStyle = '#7a4a2c';
    ctx.beginPath();
    ctx.moveTo(392, 224);
    ctx.lineTo(388, 152);
    ctx.lineTo(402, 150);
    ctx.lineTo(406, 224);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = TEAL;
    for (const [cx, cy, r] of [[398, 138, 42], [358, 156, 28], [440, 154, 26]] as const) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    this.dots(ctx, 340, 100, 130, 90, 0.08);

    // long shadows
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = PLUM;
    ctx.beginPath();
    ctx.moveTo(158, 228);
    ctx.lineTo(256, 228);
    ctx.lineTo(330, 270);
    ctx.lineTo(176, 270);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // steps
    ctx.fillStyle = CREAM;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.rect(64 - i * 10, 214 + i * 7, 72 + i * 20, 7);
      ctx.fill();
      ctx.stroke();
    }

    // plant by the step
    this.plant(ctx, 296, 228, 1.0, Math.sin(t * 1.3) * 0.08);

    // our tenant and pet, at the door
    const settle = clamp((p - 0.35) / 0.4, 0, 1);
    this.hero(ctx, 176, 230, 1.3, t, { aimX: 1, aimY: 0.04 }, 0, 0);
    this.companion(ctx, 208, 234, 0.86, t, { sitting: true }, -1);
    this.mug(ctx, 196, 214, t, 0.6);
    this.toaster(ctx, 150, 216, -0.12, 0.6, 0.7);

    // birds
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const bx = 250 + i * 26 + Math.sin(t * 0.5 + i) * 4;
      const by = 34 + i * 9;
      ctx.beginPath();
      ctx.moveTo(bx - 5, by);
      ctx.quadraticCurveTo(bx - 2, by - 4, bx, by);
      ctx.quadraticCurveTo(bx + 2, by - 4, bx + 5, by);
      ctx.stroke();
    }

    this.dust(ctx, t, 40, 70, 300, 230, 24, 'rgba(255, 255, 255, 0.9)');
    this.dots(ctx, 0, 0, W, H, 0.04);
    // settle: a final warm bloom
    if (settle > 0) {
      ctx.fillStyle = `rgba(255, 210, 63, ${(0.05 * settle).toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ═════════════════════════ FILM THREE: MOVING DAY ═════════════════════════

  private movedOut(ctx: Ctx, t: number): void {
    if (t < 2.2) {
      const p = clamp(t / 2.2, 0, 1);
      ctx.save();
      this.cam(ctx, lerp(1.0, 1.07, ease(p)), lerp(0, -5, ease(p)), 0, 0);
      this.movingStreet(ctx, t, p, false);
      ctx.restore();
    } else if (t < 4.2) {
      const p = clamp((t - 2.2) / 2.0, 0, 1);
      ctx.save();
      this.cam(ctx, lerp(1.0, 1.09, ease(p)), 0, 0, 0);
      this.keysCloseup(ctx, t, p);
      ctx.restore();
    } else {
      const p = clamp((t - 4.2) / 2.2, 0, 1);
      ctx.save();
      this.cam(ctx, lerp(1.07, 1.0, ease(p)), 0, 0, 0);
      this.movingStreet(ctx, t, p, true);
      ctx.restore();
    }
  }

  private movingStreet(ctx: Ctx, t: number, p: number, leaving: boolean): void {
    // sky
    ctx.fillStyle = '#2b3a67';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#232f5e';
    ctx.fillRect(0, 0, W, 70);
    ctx.fillStyle = 'rgba(107, 63, 122, 0.55)';
    for (let i = 0; i < 4; i++) {
      const cx = 30 + i * 120 + Math.sin(t * 0.2 + i) * 10;
      const cy = 34 + (i % 2) * 14;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 58, 12, 0, 0, TAU);
      ctx.fill();
    }
    this.dots(ctx, 0, 0, W, 120, 0.05);

    // skyline
    ctx.fillStyle = '#161c3a';
    ctx.beginPath();
    ctx.moveTo(0, 168);
    for (let i = 0; i < 8; i++) {
      const bx = i * 66;
      const bh = 22 + ((i * 41) % 52);
      ctx.lineTo(bx, 168 - bh);
      ctx.lineTo(bx + 48, 168 - bh);
      ctx.lineTo(bx + 48, 168);
    }
    ctx.lineTo(W, 168);
    ctx.lineTo(W, 230);
    ctx.lineTo(0, 230);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 210, 63, 0.55)';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(20 + hash(i * 3.7) * 430, 140 + hash(i * 5.9) * 24, 4, 5);
    }

    // our building
    ctx.fillStyle = '#2a737a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.4;
    ctx.fillRect(292, 56, 190, 172);
    ctx.strokeRect(292, 56, 190, 172);
    ctx.fillStyle = '#3a8f96';
    ctx.fillRect(292, 56, 190, 18);
    ctx.strokeStyle = 'rgba(26, 20, 48, 0.14)';
    ctx.lineWidth = 1.2;
    for (let y = 86; y < 228; y += 18) {
      ctx.beginPath();
      ctx.moveTo(292, y);
      ctx.lineTo(482, y);
      ctx.stroke();
    }
    this.windowPane(ctx, 314, 88, 40, 32, true);
    this.windowPane(ctx, 370, 88, 40, 32, false);
    this.windowPane(ctx, 426, 88, 40, 32, true);
    // door
    ctx.fillStyle = INK;
    ctx.fillRect(386, 158, 58, 72);
    ctx.fillStyle = leaving ? '#232f5e' : CORAL;
    ctx.fillRect(392, 164, 46, 66);
    if (!leaving) {
      ctx.fillStyle = 'rgba(255, 210, 63, 0.75)';
      ctx.fillRect(399, 170, 32, 38);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.strokeRect(399, 170, 32, 38);
    }
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(430, 202, 2.2, 0, TAU);
    ctx.fill();

    // road
    ctx.fillStyle = '#1b2450';
    ctx.fillRect(0, 228, W, 42);
    ctx.fillStyle = '#2b3a67';
    ctx.fillRect(0, 218, W, 10);
    ctx.strokeStyle = 'rgba(246, 231, 200, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.moveTo(0, 252);
    ctx.lineTo(W, 252);
    ctx.stroke();
    ctx.setLineDash([]);

    // street lamp
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(250, 226);
    ctx.lineTo(250, 92);
    ctx.quadraticCurveTo(250, 82, 262, 82);
    ctx.stroke();
    ctx.fillStyle = YELLOW;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(264, 84, 10, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 210, 63, 0.2)';
    ctx.lineWidth = 2;
    for (const r of [18, 26, 34]) {
      ctx.beginPath();
      ctx.arc(264, 84, r, 0, TAU);
      ctx.stroke();
    }

    // puddles
    for (const [px, py, prx, pry] of [[40, 244, 38, 6], [176, 252, 54, 7], [332, 246, 30, 5]] as const) {
      ctx.fillStyle = 'rgba(74, 214, 232, 0.16)';
      ctx.strokeStyle = 'rgba(74, 214, 232, 0.4)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(px, py, prx, pry, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 210, 63, 0.18)';
      ctx.fillRect(px - 3, py - 8, 6, 10);
    }

    // the van and the crew
    if (!leaving) {
      const walk = ease(clamp(p / 0.8, 0, 1));
      const vanX = lerp(86, 64, walk);
      this.van(ctx, vanX, 214, 1, t, false, false);
      const sx = lerp(226, 204, walk);
      // sofa
      ctx.fillStyle = CORAL;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(sx - 58, 190, 116, 30, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff8a7e';
      ctx.beginPath();
      ctx.roundRect(sx - 54, 182, 108, 16, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = CREAM;
      ctx.beginPath();
      ctx.roundRect(sx - 40, 186, 36, 10, 3);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(sx + 4, 186, 36, 10, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(26, 20, 48, 0.2)';
      ctx.fillRect(sx - 58, 208, 116, 8);
      // movers
      this.mover(ctx, 0, sx - 62, 218, 0.92, t, Math.PI, true, 0.12);
      this.mover(ctx, 1, sx + 64, 220, 0.98, t, Math.PI, true, 0.12);
      // tenant on the step, box in arms
      this.hero(ctx, 362, 230, 1.22, t, { aimX: -1, aimY: 0.04 }, 0, 0);
      this.flatBox(ctx, 340, 224, 0.03, 0.85, 0, 1);
      this.companion(ctx, 392, 234, 0.78, t, { sitting: true }, -1);
    } else {
      // van leaving
      this.van(ctx, 148, 210, 0, t, true, true);
      ctx.fillStyle = 'rgba(74, 214, 232, 0.2)';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(194 + i * 12, 232 - i * 3, 15, 4, -0.2, 0, TAU);
        ctx.fill();
      }
      // tenant walking away, box still in arms
      this.hero(ctx, 306, 238, 1.24, t, { aimX: -1, aimY: 0.02 }, 0, 0);
      this.flatBox(ctx, 284, 230, -0.05, 0.8, 0, 0);
      this.companion(ctx, 336, 242, 0.78, t, { sitting: false }, -1);
    }

    // rain, more in the first half
    this.rain(ctx, t, leaving ? 0.6 : 1);
    this.dots(ctx, 292, 56, 190, 172, 0.05);
  }

  private keysCloseup(ctx: Ctx, t: number, p: number): void {
    // cold night wall
    ctx.fillStyle = '#232f5e';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2b3a67';
    ctx.fillRect(0, 0, W, 92);
    this.dots(ctx, 0, 0, W, H, 0.06);

    // the door they are leaving
    ctx.fillStyle = INK;
    ctx.fillRect(96, 8, 308, 150);
    ctx.fillStyle = '#2f7f86';
    ctx.fillRect(104, 16, 292, 142);
    ctx.strokeStyle = 'rgba(26, 20, 48, 0.3)';
    ctx.lineWidth = 3;
    ctx.strokeRect(126, 44, 116, 84);
    ctx.strokeRect(254, 44, 116, 84);
    ctx.fillStyle = CREAM;
    ctx.fillRect(146, 36, 48, 20);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(146, 36, 48, 20);
    ctx.fillStyle = INK;
    ctx.font = `700 11px ${TYPE_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('23', 170, 46);
    ctx.fillStyle = '#1b2450';
    ctx.fillRect(272, 98, 56, 10);
    ctx.strokeRect(272, 98, 56, 10);
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(372, 106, 6, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // doorstep
    ctx.fillStyle = '#e0d3b4';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.rect(76, 158, 348, 10);
    ctx.fill();
    ctx.stroke();

    // warm light leaking round the door
    ctx.save();
    ctx.fillStyle = 'rgba(255, 210, 63, 0.16)';
    ctx.beginPath();
    ctx.moveTo(250, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, H);
    ctx.lineTo(150, H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 210, 63, 0.22)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(W - 20, 12 + i * 8);
      ctx.lineTo(90 + i * 40, H);
      ctx.stroke();
    }
    ctx.restore();

    // doormat
    ctx.save();
    ctx.translate(250, 196);
    ctx.rotate(-0.02);
    ctx.fillStyle = 'rgba(26, 20, 48, 0.35)';
    ctx.beginPath();
    ctx.roundRect(-165, -48, 330, 98, 8);
    ctx.fill();
    ctx.fillStyle = CORAL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-169, -54, 330, 98, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = CREAM;
    ctx.fillRect(-157, -42, 306, 5);
    ctx.fillRect(-157, 28, 306, 5);
    // HOME, ransom style
    const letters = ['H', 'O', 'M', 'E'];
    for (let i = 0; i < letters.length; i++) {
      const lx = -120 + i * 56;
      ctx.save();
      ctx.translate(lx, -10);
      ctx.rotate((i % 2 === 0 ? -1 : 1) * 0.035);
      ctx.fillStyle = i % 2 === 0 ? YELLOW : PAPER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(-22, -22, 44, 46);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = `400 36px ${SHOUT_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letters[i]!, 0, 2);
      ctx.restore();
    }
    ctx.restore();

    // keys
    const lift = clamp((p - 0.62) / 0.2, 0, 1);
    const gone = clamp((p - 0.86) / 0.14, 0, 1);
    if (gone < 1) {
      const kx = lerp(336, 384, lift) + gone * 80;
      const ky = lerp(190, 148, lift) - gone * 40;
      this.keys(ctx, kx, ky, 2.3, -0.2 + lift * 0.5);
    }

    // a hand, entering from the right
    if (gone < 1) {
      const hx = lerp(444, 368, ease(clamp(p / 0.5, 0, 1))) + gone * 80;
      const hy = 188 + Math.sin(p * Math.PI) * -6;
      ctx.save();
      ctx.translate(hx, hy);
      // sleeve
      ctx.fillStyle = TEAL;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(56, -38);
      ctx.lineTo(160, -46);
      ctx.lineTo(160, 42);
      ctx.lineTo(56, 34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // cuff
      ctx.fillStyle = CORAL;
      ctx.beginPath();
      ctx.roundRect(38, -34, 26, 66, 5);
      ctx.fill();
      ctx.stroke();
      // palm
      ctx.fillStyle = '#f2c9a0';
      ctx.beginPath();
      ctx.roundRect(-18, -28, 62, 56, 18);
      ctx.fill();
      ctx.stroke();
      // fingers
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.roundRect(-54, -24 + i * 13, 42, 11, 5.5);
        ctx.fill();
        ctx.stroke();
      }
      // thumb
      ctx.beginPath();
      ctx.roundRect(-26, 22, 36, 12, 6);
      ctx.rotate(0.5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // raindrops on the mat
    ctx.fillStyle = 'rgba(74, 214, 232, 0.5)';
    for (let i = 0; i < 9; i++) {
      const dx = 90 + hash(i * 4.1) * 290;
      const dy = 150 + hash(i * 7.3) * 70;
      ctx.beginPath();
      ctx.ellipse(dx, dy, 2 + hash(i) * 2, 1.2, 0.4, 0, TAU);
      ctx.fill();
    }

    // a final little glint
    if (p > 0.5) {
      ctx.strokeStyle = 'rgba(255, 243, 214, 0.6)';
      ctx.lineWidth = 2;
      const gx = 340;
      const gy = 172;
      ctx.beginPath();
      ctx.moveTo(gx - 7, gy);
      ctx.lineTo(gx + 7, gy);
      ctx.moveTo(gx, gy - 7);
      ctx.lineTo(gx, gy + 7);
      ctx.stroke();
    }

    this.rain(ctx, t, 0.4);
  }

  // ═════════════════════════ FILM FOUR: NEW MANAGEMENT ═════════════════════════

  private newManagement(ctx: Ctx, t: number): void {
    if (t < 2.2) {
      const p = clamp(t / 2.2, 0, 1);
      ctx.save();
      this.cam(ctx, lerp(1.0, 1.07, ease(p)), 0, lerp(0, 4, ease(p)), 0);
      this.facade(ctx, t, p, false);
      ctx.restore();
    } else if (t < 4.0) {
      const p = clamp((t - 2.2) / 1.8, 0, 1);
      ctx.save();
      this.cam(ctx, lerp(1.0, 1.1, ease(p)), 0, 0, 0);
      this.glassCloseup(ctx, t, p);
      ctx.restore();
    } else {
      const p = clamp((t - 4.0) / 2.0, 0, 1);
      ctx.save();
      this.cam(ctx, lerp(1.08, 1.0, ease(p)), 0, 0, 0);
      this.facade(ctx, t, p, true);
      ctx.restore();
    }
  }

  private facade(ctx: Ctx, t: number, p: number, leaving: boolean): void {
    // wet brick
    ctx.fillStyle = '#232f5e';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2b3a67';
    ctx.fillRect(0, 0, W, 54);
    ctx.strokeStyle = 'rgba(26, 20, 48, 0.2)';
    ctx.lineWidth = 1.2;
    for (let y = 36; y < 226; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let row = 0; row < 10; row++) {
      const y = 36 + row * 20;
      const off = row % 2 === 0 ? 0 : 24;
      for (let x = off; x < W; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 20);
        ctx.stroke();
      }
    }
    this.dots(ctx, 0, 0, W, H, 0.05);

    // the one lit window
    ctx.fillStyle = INK;
    ctx.fillRect(104, 42, 286, 154);
    ctx.fillStyle = '#ff9a3c';
    ctx.fillRect(112, 50, 270, 138);
    ctx.fillStyle = '#ffb45a';
    ctx.fillRect(112, 50, 270, 34);
    // interior
    ctx.fillStyle = 'rgba(26, 20, 48, 0.24)';
    ctx.fillRect(112, 124, 270, 64);
    // curtains
    ctx.fillStyle = PLUM;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(104, 42);
    ctx.lineTo(136, 42);
    ctx.quadraticCurveTo(124, 120, 140, 196);
    ctx.lineTo(100, 196);
    ctx.lineTo(100, 42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(390, 42);
    ctx.lineTo(356, 42);
    ctx.quadraticCurveTo(368, 120, 352, 196);
    ctx.lineTo(394, 196);
    ctx.lineTo(394, 42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // lamp
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(160, 92, 12, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    // sofa
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(156, 158, 150, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#3a2a3e';
    ctx.beginPath();
    ctx.roundRect(162, 150, 138, 16, 6);
    ctx.fill();
    // three movers, at home
    this.mover(ctx, 0, 190, 172, 0.94, t, 0, false, 1);
    this.mover(ctx, 1, 236, 174, 0.98, t, 0, false, 1);
    this.mover(ctx, 2, 280, 172, 0.9, t, 0, false, 1);
    // TV
    const flick = 0.7 + Math.sin(t * 23) * 0.12 + Math.sin(t * 7.7) * 0.08;
    ctx.fillStyle = INK;
    ctx.fillRect(322, 132, 48, 34);
    ctx.fillStyle = `rgba(74, 214, 232, ${flick.toFixed(2)})`;
    ctx.fillRect(326, 136, 40, 26);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(326, 136, 40, 3);
    // window cross
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.strokeRect(112, 50, 270, 138);
    ctx.beginPath();
    ctx.moveTo(247, 50);
    ctx.lineTo(247, 188);
    ctx.stroke();

    // a wall lamp over the sign
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(54, 76);
    ctx.lineTo(54, 64);
    ctx.quadraticCurveTo(54, 58, 62, 58);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 210, 63, 0.2)';
    ctx.beginPath();
    ctx.moveTo(50, 60);
    ctx.lineTo(74, 60);
    ctx.lineTo(98, 152);
    ctx.lineTo(28, 152);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 210, 63, 0.3)';
    ctx.lineWidth = 1.6;
    for (const r of [14, 22, 30]) {
      ctx.beginPath();
      ctx.arc(62, 60, r, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = YELLOW;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(52, 58);
    ctx.lineTo(72, 58);
    ctx.lineTo(68, 48);
    ctx.lineTo(56, 48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // SOLD sign
    ctx.save();
    ctx.translate(46, 110);
    ctx.rotate(-0.07);
    ctx.fillStyle = 'rgba(26, 20, 48, 0.4)';
    ctx.fillRect(4, 5, 64, 44);
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.fillRect(0, 0, 64, 44);
    ctx.strokeRect(0, 0, 64, 44);
    ctx.fillStyle = CORAL;
    ctx.fillRect(0, 0, 64, 12);
    ctx.fillStyle = INK;
    ctx.font = `400 17px ${SHOUT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SOLD', 32, 28);
    ctx.fillStyle = 'rgba(26, 20, 48, 0.7)';
    ctx.font = `700 5px ${TYPE_FONT}`;
    ctx.fillText('AS SEEN', 32, 38);
    ctx.restore();
    // tape
    ctx.fillStyle = 'rgba(255, 243, 214, 0.6)';
    ctx.fillRect(58, 100, 20, 6);

    // rain on the glass
    ctx.fillStyle = 'rgba(74, 214, 232, 0.5)';
    for (let i = 0; i < 18; i++) {
      const dx = 118 + hash(i * 3.3) * 258;
      const dy = 54 + hash(i * 6.7) * 130;
      ctx.beginPath();
      ctx.ellipse(dx, dy, 2.4, 1.3, 0.5, 0, TAU);
      ctx.fill();
      if (i % 4 === 0) {
        ctx.strokeStyle = 'rgba(74, 214, 232, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx - 1, dy + 12);
        ctx.stroke();
      }
    }

    // pavement
    ctx.fillStyle = '#1b2450';
    ctx.fillRect(0, 214, W, 56);
    ctx.fillStyle = '#2b3a67';
    ctx.fillRect(0, 206, W, 10);
    ctx.strokeStyle = 'rgba(74, 214, 232, 0.3)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 214);
    ctx.lineTo(W, 214);
    ctx.stroke();
    // window spill
    ctx.fillStyle = 'rgba(255, 154, 60, 0.16)';
    ctx.beginPath();
    ctx.moveTo(112, 196);
    ctx.lineTo(390, 196);
    ctx.lineTo(450, 252);
    ctx.lineTo(46, 252);
    ctx.closePath();
    ctx.fill();
    // puddles
    for (const [px, py, rx] of [[72, 238, 34], [278, 246, 46], [410, 236, 24]] as const) {
      ctx.fillStyle = 'rgba(74, 214, 232, 0.14)';
      ctx.strokeStyle = 'rgba(74, 214, 232, 0.4)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(px, py, rx, 5, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // the former tenant, outside in the cold
    if (!leaving) {
      this.hero(ctx, 62, 240, 1.16, t, { aimX: 0.7, aimY: -0.3 }, 0, 0, 0.82);
      this.companion(ctx, 94, 244, 0.74, t, { sitting: true }, -1);
    } else {
      this.hero(ctx, 402, 240, 1.1, t, { aimX: 1, aimY: 0 }, 0, 0, 0.82);
      this.companion(ctx, 430, 244, 0.7, t, { sitting: false }, 1);
    }

    this.rain(ctx, t, 0.75);
    // a small heart of steam on the glass
    if (!leaving && p > 0.5) {
      ctx.strokeStyle = `rgba(255, 243, 214, ${(0.2 * Math.sin(p * Math.PI)).toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(326, 72, 7, Math.PI, TAU);
      ctx.arc(340, 72, 7, Math.PI, TAU);
      ctx.lineTo(333, 84);
      ctx.closePath();
      ctx.stroke();
    }
  }

  private glassCloseup(ctx: Ctx, t: number, p: number): void {
    // warm room, seen through the pane
    ctx.fillStyle = '#e07a2e';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffb45a';
    ctx.fillRect(0, 0, W, 96);
    // interior wall and floor
    ctx.fillStyle = PLUM;
    ctx.fillRect(0, 150, W, 120);
    ctx.fillStyle = '#8a4f80';
    ctx.fillRect(0, 150, W, 26);
    // framed picture and clock on the far wall
    ctx.fillStyle = INK;
    ctx.fillRect(146, 22, 72, 54);
    ctx.fillStyle = CREAM;
    ctx.fillRect(151, 27, 62, 44);
    ctx.fillStyle = TEAL;
    ctx.beginPath();
    ctx.moveTo(158, 62);
    ctx.lineTo(182, 38);
    ctx.lineTo(206, 62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = CORAL;
    ctx.beginPath();
    ctx.arc(196, 38, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(258, 50, 18, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(258, 50);
    ctx.lineTo(258, 39);
    ctx.moveTo(258, 50);
    ctx.lineTo(266, 54);
    ctx.stroke();
    // lamp
    ctx.fillStyle = 'rgba(255, 210, 63, 0.25)';
    ctx.beginPath();
    ctx.arc(76, 78, 52, 0, TAU);
    ctx.fill();
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(76, 78, 18, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    // sofa
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(250, 178, 190, 44, 10);
    ctx.fill();
    ctx.fillStyle = '#3a2a3e';
    ctx.beginPath();
    ctx.roundRect(258, 166, 174, 22, 8);
    ctx.fill();
    // movers, blurred shapes
    ctx.save();
    ctx.globalAlpha = 0.85;
    this.mover(ctx, 0, 300, 200, 1.3, t, 0, false, 1);
    this.mover(ctx, 1, 362, 202, 1.36, t, 0, false, 1);
    this.mover(ctx, 2, 420, 200, 1.24, t, 0, false, 1);
    ctx.restore();
    // TV glow
    ctx.fillStyle = 'rgba(74, 214, 232, 0.8)';
    ctx.fillRect(22, 190, 52, 38);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(22, 190, 52, 4);

    // glass tint
    ctx.fillStyle = 'rgba(74, 214, 232, 0.14)';
    ctx.fillRect(0, 0, W, H);
    // diagonal sheen
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, 100);
    ctx.lineTo(140, 0);
    ctx.lineTo(230, 0);
    ctx.lineTo(40, 270);
    ctx.lineTo(0, 270);
    ctx.closePath();
    ctx.fill();

    // raindrops
    for (let i = 0; i < 40; i++) {
      const dx = hash(i * 2.7) * W;
      const dy = hash(i * 5.1) * H;
      const r = 1.6 + hash(i * 9.3) * 3.4;
      ctx.fillStyle = 'rgba(74, 214, 232, 0.45)';
      ctx.beginPath();
      ctx.ellipse(dx, dy, r, r * 0.7, 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(dx - r * 0.3, dy - r * 0.3, r * 0.3, 0, TAU);
      ctx.fill();
      if (i % 5 === 0) {
        ctx.strokeStyle = 'rgba(74, 214, 232, 0.3)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx - 2, dy + 22);
        ctx.stroke();
      }
    }

    // the hand on the glass
    const slide = ease(clamp((p - 0.4) / 0.5, 0, 1)) * 10;
    ctx.save();
    ctx.translate(238, 170 + slide);
    ctx.rotate(-0.12);
    // sleeve
    ctx.fillStyle = TEAL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(50, -32);
    ctx.lineTo(150, -40);
    ctx.lineTo(150, 38);
    ctx.lineTo(50, 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = CORAL;
    ctx.beginPath();
    ctx.roundRect(32, -28, 24, 56, 5);
    ctx.fill();
    ctx.stroke();
    // palm
    ctx.fillStyle = '#f2c9a0';
    ctx.shadowColor = 'rgba(26, 20, 48, 0.4)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.roundRect(-22, -26, 60, 54, 17);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();
    // fingers
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.roundRect(-58, -22 + i * 12.5, 44, 10.5, 5.2);
      ctx.fill();
      ctx.stroke();
    }
    // thumb
    ctx.save();
    ctx.rotate(0.45);
    ctx.beginPath();
    ctx.roundRect(-34, 20, 38, 11, 5.5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // a tiny glint on the glass
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-64, 12);
    ctx.lineTo(-40, 6);
    ctx.stroke();
    ctx.restore();

    // window frame, in front
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, 18);
    ctx.fillRect(0, H - 18, W, 18);
    ctx.fillRect(0, 0, 18, H);
    ctx.fillRect(W - 18, 0, 18, H);
    ctx.fillRect(0, 126, W, 10);
    ctx.fillStyle = 'rgba(255, 210, 63, 0.65)';
    ctx.fillRect(0, 136, W, 1);
    // a bloom of warm light
    ctx.fillStyle = 'rgba(255, 210, 63, 0.08)';
    ctx.fillRect(0, 0, W, H);

    // world outside, a cold edge
    ctx.fillStyle = 'rgba(43, 58, 103, 0.25)';
    ctx.fillRect(0, 0, 18, H);
    ctx.fillRect(W - 18, 0, 18, H);
  }

  // ═════════════════════════ house helpers ═════════════════════════

  private windowPane(ctx: Ctx, x: number, y: number, w: number, h: number, lit: boolean): void {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = lit ? YELLOW : '#1b2450';
    ctx.fillRect(x, y, w, h);
    if (lit) {
      ctx.fillStyle = 'rgba(255, 243, 214, 0.5)';
      ctx.fillRect(x + 3, y + 3, w - 6, h * 0.4);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
    ctx.stroke();
    ctx.strokeRect(x, y, w, h);
  }

  private note(ctx: Ctx, x: number, y: number, rot: number, w: number, h: number, text: string, fs: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = 'rgba(26, 20, 48, 0.3)';
    ctx.fillRect(4, 5, w, h);
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255, 210, 63, 0.8)';
    ctx.fillRect(w * 0.4, -4, w * 0.24, 8);
    ctx.fillStyle = INK;
    ctx.font = `400 ${fs}px ${HAND_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 1);
    ctx.restore();
  }

  private impact(ctx: Ctx, x: number, y: number, q: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(q * 0.4);
    ctx.fillStyle = `rgba(255, 210, 63, ${(1 - q * 0.5).toFixed(2)})`;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    const r = lerp(6, 27, q);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
