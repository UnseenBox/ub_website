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
const SKIP_AFTER = 0.6;

const WIN_LINES = ['NOT TODAY!', 'STILL MY FLAT!', 'RENT IS PAID!', 'AND STAY OUT!'] as const;
const DURATION: Readonly<Record<Scene, number>> = { evicted: 4.3, victory: 4.0, movedOut: 4.6, newManagement: 4.4 };

const ease = (t: number): number => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};
const span = (t: number, from: number, to: number): number => clamp((t - from) / (to - from), 0, 1);
/** Overshooting pop for stamps and landings. */
const easeOutBack = (t: number): number => {
  const c = clamp(t, 0, 1);
  const s = 1.70158;
  const u = c - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};
const easeOutBounce = (t: number): number => {
  const c = clamp(t, 0, 1);
  if (c < 1 / 2.75) return 7.5625 * c * c;
  if (c < 2 / 2.75) {
    const u = c - 1.5 / 2.75;
    return 7.5625 * u * u + 0.75;
  }
  if (c < 2.5 / 2.75) {
    const u = c - 2.25 / 2.75;
    return 7.5625 * u * u + 0.9375;
  }
  const u = c - 2.625 / 2.75;
  return 7.5625 * u * u + 0.984375;
};

/**
 * A few seconds of theatre between the last blow and the results clipboard.
 *
 * Four scenes (two wins, two losses), all drawn with the game's own character
 * art so the hero, pet and movers look like themselves. Each one is staged in
 * three beats — setup, payoff, button — with a slow push-in, handheld sway,
 * letterbox bars, a stamp-slam caption, film grain and a timeline, so it reads
 * like a tiny movie trailer rather than a frozen diorama.
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
  private kicker = '';
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
      this.kicker = room.daily ? '★ DAILY CLEARED ★' : `★ ROOM ${room.index + 1} RECLAIMED ★`;
    } else {
      this.scene = this.losses++ % 2 === 0 ? 'movedOut' : 'newManagement';
      this.line = this.scene === 'movedOut' ? 'MOVED OUT' : 'UNDER NEW MANAGEMENT';
      this.sub = this.scene === 'movedOut' ? 'your things will follow. probably.' : 'they have already changed the locks';
      this.kicker = room.daily ? '• DAILY FAILED •' : `• ROOM ${room.index + 1} LOST •`;
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
    const captionAt = this.captionAt();
    if (at(captionAt)) game.audio.play('stamp', 1);
    if (this.scene === 'evicted') {
      for (const time of [0.5, 0.92, 1.34]) if (at(time)) game.audio.play('throw', 0.85, 0.9);
      for (const time of [1.05, 1.47, 1.89]) if (at(time)) game.audio.play('drop', 0.7);
      if (at(1.98)) game.audio.play('door', 0.9);
      if (at(captionAt + 0.12)) game.audio.play('crackle', 0.5);
      if (at(2.5)) game.audio.play('dash', 0.7);
      if (at(captionAt + 0.35)) game.audio.voice('hup', 250);
    } else if (this.scene === 'victory') {
      if (at(0.55)) game.audio.play('drop', 1);
      if (at(0.62)) game.audio.play('gong', 0.5, 1.2);
      if (at(0.95)) game.audio.voice('hup', 240);
      if (at(captionAt + 0.3)) game.audio.play('discovery', 0.8);
      if (at(1.5)) game.audio.play('whistle', 0.5);
    } else if (this.scene === 'movedOut') {
      if (at(0.4)) game.audio.voice('ow', 280);
      if (at(1.2)) game.audio.play('slide', 0.5);
      if (at(2.95)) game.audio.play('door', 1);
      if (at(3.35)) game.audio.play('dash', 0.4);
    } else {
      if (at(0.5)) game.audio.voice('defeat', 150);
      if (at(1.1)) game.audio.play('plop', 0.6);
      if (at(1.45)) game.audio.play('plop', 0.8);
      if (at(1.8)) game.audio.play('squeak', 0.5);
    }
  }

  private captionAt(): number {
    return this.scene === 'evicted' ? 2.05 : this.scene === 'victory' ? 0.95 : this.scene === 'movedOut' ? 2.62 : 1.35;
  }

  private isWin(): boolean {
    return this.scene === 'evicted' || this.scene === 'victory';
  }

  draw(ctx: Ctx, w: number, h: number): void {
    if (!this.active) return;
    const t = this.t;
    const fadeIn = clamp(t / 0.25, 0, 1);
    const fadeOut = clamp((this.duration - t) / 0.35, 0, 1);
    const fade = Math.min(fadeIn, fadeOut);
    ctx.save();
    ctx.globalAlpha = clamp(fade, 0, 1);
    ctx.fillStyle = '#0d0a1c';
    ctx.fillRect(0, 0, w, h);

    const scale = Math.min(w / W, h / H);
    ctx.translate((w - W * scale) / 2, (h - H * scale) / 2);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.lineJoin = 'round';

    // cinema camera: slow push-in + faint handheld sway + a punch on the stamp
    const capAge = t - this.captionAt();
    const punch = capAge > 0 ? Math.exp(-capAge * 5) : 0;
    const punchX = capAge > 0 && capAge < 0.5 ? Math.sin(capAge * 70) * 5 * punch : 0;
    const punchY = capAge > 0 && capAge < 0.5 ? Math.cos(capAge * 55) * 3 * punch : 0;
    const zoom = 1.03 + ease(t / this.duration) * 0.07 + punch * 0.03;
    const swayX = Math.sin(t * 1.6) * 2.2 + punchX;
    const swayY = Math.cos(t * 1.25) * 1.6 + punchY;
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2 + swayX, -H / 2 + swayY);

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

    // vignette + stamp flash carry the payoff beat
    this.vignette(ctx);
    if (capAge > 0 && capAge < 0.22 && this.isWin()) {
      ctx.fillStyle = `rgba(255,255,255,${(0.28 * (1 - capAge / 0.22)).toFixed(3)})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    this.grain(ctx, t);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate((w - W * scale) / 2, (h - H * scale) / 2);
    ctx.scale(scale, scale);

    // letterbox with a hairline gold trim
    const bar = 26 * ease(t / 0.35);
    ctx.fillStyle = '#0b0917';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
    if (bar > 2) {
      ctx.fillStyle = 'rgba(255, 210, 63, 0.5)';
      ctx.fillRect(0, bar - 1, W, 1);
      ctx.fillRect(0, H - bar, W, 1);
    }
    this.chrome(ctx, t, bar);
    if (t > this.captionAt()) this.caption(ctx, t - this.captionAt());
    if (t > SKIP_AFTER) this.skipPill(ctx, fade);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Top-bar labels + bottom timeline. Drawn inside the letterbox space. */
  private chrome(ctx: Ctx, t: number, bar: number): void {
    if (bar < 6) return;
    ctx.save();
    ctx.globalAlpha *= 0.9;
    ctx.font = `700 8px ${TYPE_FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8f86b8';
    ctx.textAlign = 'left';
    ctx.fillText(this.scene === 'evicted' || this.scene === 'victory' ? 'BONK! • TAKEBACK' : 'BONK! • EVICTION', 10, bar / 2);
    // running timecode, like a camera slate
    const total = Math.max(0, t);
    const mm = Math.floor(total / 60);
    const ss = Math.floor(total % 60);
    const ff = Math.floor((total % 1) * 24);
    const tc = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff5a4e';
    ctx.fillText(`● ${tc}`, W - 64, bar / 2);
    // timeline across the bottom bar
    const p = clamp(t / this.duration, 0, 1);
    const tx = 10;
    const tw = W - 20;
    const ty = H - bar / 2;
    ctx.fillStyle = 'rgba(255, 243, 214, 0.18)';
    ctx.fillRect(tx, ty - 1, tw, 2);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(tx, ty - 1, tw * p, 2);
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(tx + tw * p, ty, 2.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private skipPill(ctx: Ctx, fade: number): void {
    ctx.save();
    ctx.globalAlpha = 0.85 * clamp(fade, 0, 1);
    const label = 'SKIP ▸';
    ctx.font = `700 8px ${TYPE_FONT}`;
    const tw = ctx.measureText(label).width + 16;
    const x = W - 10 - tw;
    const y = H - 26 - 9;
    ctx.fillStyle = 'rgba(11, 9, 23, 0.72)';
    ctx.beginPath();
    ctx.roundRect(x, y, tw, 15, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 243, 214, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const blink = 0.65 + 0.35 * Math.sin(this.t * 6);
    ctx.fillStyle = `rgba(255, 243, 214, ${blink.toFixed(2)})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + tw / 2, y + 8);
    ctx.restore();
  }

  private vignette(ctx: Ctx): void {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(8, 6, 18, 0)');
    g.addColorStop(1, 'rgba(8, 6, 18, 0.52)');
    ctx.fillStyle = g;
    ctx.fillRect(-24, -24, W + 48, H + 48);
  }

  private grain(ctx: Ctx, t: number): void {
    const frame = Math.floor(t * 24);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 56; i++) {
      const x = hash(i * 3.7 + frame * 131.3) * W;
      const y = hash(i * 9.1 + frame * 57.7) * H;
      ctx.fillRect(x, y, 1.4, 1.4);
    }
  }

  // ───────────── shared scenery ─────────────

  private street(ctx: Ctx, t: number, rain: boolean): void {
    const sky = ctx.createLinearGradient(0, 0, 0, 208);
    if (rain) {
      sky.addColorStop(0, '#0e0c20');
      sky.addColorStop(0.7, '#232046');
      sky.addColorStop(1, '#2c2752');
    } else {
      sky.addColorStop(0, '#141126');
      sky.addColorStop(0.7, '#3a2f63');
      sky.addColorStop(1, '#4d3f7d');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(-24, -24, W + 48, H + 48);
    // distant skyline silhouette for depth
    ctx.fillStyle = rain ? '#191630' : '#1e1a38';
    ctx.beginPath();
    ctx.moveTo(-24, 150);
    for (let i = 0; i <= 12; i++) {
      const bx = -24 + (i * (W + 48)) / 12;
      const bh = 24 + hash(i * 7.3) * 46;
      ctx.lineTo(bx, 150 - bh);
      ctx.lineTo(bx + (W + 48) / 24, 150 - bh);
      ctx.lineTo(bx + (W + 48) / 24, 150);
    }
    ctx.lineTo(W + 24, 150);
    ctx.closePath();
    ctx.fill();
    // moon with halo
    const halo = ctx.createRadialGradient(92, 50, 4, 92, 50, 44);
    halo.addColorStop(0, 'rgba(255, 243, 214, 0.5)');
    halo.addColorStop(1, 'rgba(255, 243, 214, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(92, 50, 44, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(92, 50, 14, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#141126';
    ctx.beginPath();
    ctx.arc(98, 46, 12, 0, TAU);
    ctx.fill();
    // stars
    ctx.fillStyle = '#fff3d6';
    for (let i = 0; i < 16; i++) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 2 + i * 2.1));
      ctx.globalAlpha = rain ? tw * 0.4 : tw;
      const sx = 14 + hash(i * 1.7) * 270;
      const sy = 22 + hash(i + 40) * 90;
      ctx.fillRect(sx, sy, 1.2 + tw, 1.2 + tw);
    }
    ctx.globalAlpha = 1;
    // the building
    ctx.fillStyle = 'rgba(10, 8, 22, 0.45)';
    ctx.fillRect(296, 28, 200, 190);
    ctx.fillStyle = '#5b3f52';
    ctx.fillRect(292, 22, 200, 190);
    ctx.fillStyle = '#4a3344';
    for (let row = 0; row < 12; row++) ctx.fillRect(292, 30 + row * 15, 200, 1.5);
    // cornice + drainpipe
    ctx.fillStyle = '#3a2836';
    ctx.fillRect(288, 18, 208, 8);
    ctx.fillStyle = '#2c2130';
    ctx.fillRect(484, 26, 6, 184);
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 2; row++) {
        const flick = hash(col * 3 + row * 7 + Math.floor(t * 2) * 0.13) > 0.42;
        ctx.fillStyle = INK;
        ctx.fillRect(312 + col * 52, 48 + row * 46, 30, 28);
        ctx.fillStyle = flick ? '#ffd98a' : '#2a2540';
        ctx.fillRect(314 + col * 52, 50 + row * 46, 26, 24);
        if (flick) {
          ctx.fillStyle = 'rgba(42, 37, 64, 0.8)';
          ctx.fillRect(314 + col * 52, 50 + row * 46, 26, 5);
        }
      }
    }
    // air-conditioner boxes under two windows
    ctx.fillStyle = '#8b93a3';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (const ax of [327, 431]) {
      ctx.beginPath();
      ctx.rect(ax, 80, 20, 10);
      ctx.fill();
      ctx.stroke();
    }
    // front door, open, light spilling out
    ctx.fillStyle = INK;
    ctx.fillRect(326, 146, 46, 62);
    ctx.fillStyle = '#ffd98a';
    ctx.fillRect(329, 149, 40, 59);
    ctx.fillStyle = INK;
    ctx.fillRect(364, 176, 3, 3);
    const glow = ctx.createLinearGradient(0, 205, 0, 248);
    glow.addColorStop(0, 'rgba(255, 217, 138, 0.4)');
    glow.addColorStop(1, 'rgba(255, 217, 138, 0)');
    // pavement slabs + road with centre dashes
    ctx.fillStyle = '#4a426e';
    ctx.fillRect(-24, 206, W + 48, 16);
    ctx.strokeStyle = 'rgba(20, 16, 36, 0.5)';
    ctx.lineWidth = 1;
    for (let x = -24; x < W + 24; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, 206);
      ctx.lineTo(x - 6, 222);
      ctx.stroke();
    }
    ctx.fillStyle = '#231d3c';
    ctx.fillRect(-24, 222, W + 48, H - 198);
    ctx.fillStyle = 'rgba(255, 217, 138, 0.16)';
    for (let x = 0; x < W; x += 44) ctx.fillRect(x, 240, 22, 3);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(326, 206);
    ctx.lineTo(372, 206);
    ctx.lineTo(398, 248);
    ctx.lineTo(300, 248);
    ctx.closePath();
    ctx.fill();
    // street lamp on the left throwing a cone
    ctx.fillStyle = INK;
    ctx.fillRect(52, 108, 6, 100);
    ctx.beginPath();
    ctx.arc(55, 104, 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.arc(55, 108, 4, 0, TAU);
    ctx.fill();
    const cone = ctx.createLinearGradient(0, 112, 0, 230);
    cone.addColorStop(0, 'rgba(255, 233, 176, 0.22)');
    cone.addColorStop(1, 'rgba(255, 233, 176, 0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(49, 112);
    ctx.lineTo(61, 112);
    ctx.lineTo(96, 232);
    ctx.lineTo(14, 232);
    ctx.closePath();
    ctx.fill();
    // bin bags by the door for texture
    ctx.fillStyle = '#2e2a4a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (const [bx, by, r] of [[300, 200, 9], [312, 203, 7]] as const) {
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    if (rain) this.rain(ctx, t);
  }

  private rain(ctx: Ctx, t: number): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(159, 227, 255, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 70; i++) {
      const x = hash(i * 12.9) * (W + 40) - 20;
      const y = (hash(i * 7.7) * (H + 60) + t * 380) % (H + 60) - 30;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 11);
    }
    ctx.stroke();
    // splashes on the pavement
    ctx.strokeStyle = 'rgba(159, 227, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const x = hash(i * 31.7) * W;
      const p = (t * 3 + i * 0.43) % 1;
      const y = 210 + hash(i * 3.3) * 22;
      ctx.moveTo(x - 3 * p, y);
      ctx.quadraticCurveTo(x, y - 4 * p - 1, x + 3 * p, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** The removal van, rear doors towards the building. `open` 0..1. */
  private van(ctx: Ctx, x: number, y: number, open: number, t: number, moving: boolean, lights: boolean): void {
    const bounce = moving ? Math.abs(Math.sin(t * 18)) * -2 : Math.sin(t * 3) * 0.6;
    const shake = moving ? Math.sin(t * 44) * 0.7 : 0;
    ctx.save();
    ctx.translate(x, y + bounce + shake * 0.4);
    // ground shadow
    ctx.fillStyle = 'rgba(10, 8, 22, 0.4)';
    ctx.beginPath();
    ctx.ellipse(46, 8 - bounce, 88, 9, 0, 0, TAU);
    ctx.fill();
    // headlight beam when driving off at night
    if (moving && lights) {
      const beam = ctx.createLinearGradient(-34, -30, -150, -10);
      beam.addColorStop(0, 'rgba(255, 240, 200, 0.35)');
      beam.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(-34, -34);
      ctx.lineTo(-150, -48);
      ctx.lineTo(-150, 2);
      ctx.lineTo(-34, -6);
      ctx.closePath();
      ctx.fill();
    }
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
    // cab window with a shine slash
    ctx.fillStyle = '#bfe9ff';
    ctx.beginPath();
    ctx.moveTo(-29, -30);
    ctx.lineTo(-17, -43);
    ctx.lineTo(-4, -43);
    ctx.lineTo(-4, -30);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-24, -32);
    ctx.lineTo(-14, -42);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    // headlight + bumper
    ctx.fillStyle = lights ? '#fff2b0' : '#d8d2c2';
    ctx.beginPath();
    ctx.arc(-32, -10, 4, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8b93a3';
    ctx.fillRect(-38, -2, 12, 4);
    // box body with a two-tone skirt
    ctx.fillStyle = '#fbf6e9';
    ctx.fillRect(4, -66, 122, 66);
    ctx.strokeRect(4, -66, 122, 66);
    ctx.fillStyle = '#ded5bd';
    ctx.fillRect(4, -8, 122, 8);
    ctx.fillStyle = '#e5383b';
    ctx.fillRect(4, -30, 122, 7);
    // logo plate
    ctx.fillStyle = '#221b36';
    ctx.fillRect(30, -60, 70, 20);
    ctx.fillStyle = '#ffd23f';
    ctx.font = `italic 400 12px ${SHOUT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MOVERS & CO.', 65, -50);
    // warm interior when the doors are open
    if (open > 0.02) {
      ctx.fillStyle = '#17132a';
      ctx.fillRect(122, -62, 4, 60);
      const warm = ctx.createLinearGradient(126, 0, 150, 0);
      warm.addColorStop(0, 'rgba(255, 217, 138, 0.55)');
      warm.addColorStop(1, 'rgba(255, 217, 138, 0)');
      ctx.fillStyle = warm;
      ctx.fillRect(126, -62, 34, 60);
      ctx.fillStyle = '#d8d2c2';
      ctx.beginPath();
      ctx.moveTo(126, -66);
      ctx.lineTo(126 + 22 * open, -72);
      ctx.lineTo(126 + 22 * open, -4);
      ctx.lineTo(126, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // closed rear doors: seam + handles
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(65, -66);
      ctx.lineTo(65, 0);
      ctx.stroke();
      ctx.fillStyle = INK;
      for (const hx of [59, 71]) ctx.fillRect(hx, -34, 3, 8);
    }
    // tail-light glow
    ctx.fillStyle = moving ? '#ff3b30' : '#b3312a';
    ctx.beginPath();
    ctx.arc(127, -4, 3, 0, TAU);
    ctx.fill();
    // wheels with spinning spokes
    for (const wx of [-14, 100]) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(wx, 2, 11, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#aab4c4';
      ctx.beginPath();
      ctx.arc(wx, 2, 4.5, 0, TAU);
      ctx.fill();
      if (moving) {
        ctx.strokeStyle = '#e8ecf3';
        ctx.lineWidth = 1.4;
        const a = t * 22 + wx;
        ctx.beginPath();
        ctx.moveTo(wx + Math.cos(a) * 7, 2 + Math.sin(a) * 7);
        ctx.lineTo(wx - Math.cos(a) * 7, 2 - Math.sin(a) * 7);
        ctx.stroke();
      }
    }
    // exhaust puffs while moving
    if (moving) {
      for (let i = 0; i < 4; i++) {
        const p = (t * 1.8 + i * 0.25) % 1;
        ctx.fillStyle = `rgba(235, 235, 245, ${(0.3 * (1 - p)).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(-38 - p * 30, -2 - p * 12, 3 + p * 7, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private flatBox(ctx: Ctx, x: number, y: number, spin: number, size = 1, squash = 0): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.scale(size * (1 + squash), size * (1 - squash));
    // soft shadow is drawn by the caller when needed
    ctx.fillStyle = '#c9a070';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.rect(-15, -5, 30, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ecdcab';
    ctx.fillRect(-3, -5, 6, 10);
    ctx.fillStyle = '#a87f4e';
    ctx.fillRect(-15, 2, 30, 3);
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

  /** A flying box with a fading motion trail. */
  private flyingBox(ctx: Ctx, x: number, y: number, spin: number, p: number): void {
    const dx = -78 * 0.06;
    for (let g = 3; g >= 1; g--) {
      ctx.save();
      ctx.globalAlpha *= 0.12 * (4 - g);
      this.flatBox(ctx, x - dx * g * 4 * p, y + g * 1.5, spin - g * 0.12, 1 - g * 0.06);
      ctx.restore();
    }
    this.flatBox(ctx, x, y, spin, 1);
  }

  /** Dust puff that blooms and fades, driven by its age in seconds. */
  private puff(ctx: Ctx, x: number, y: number, age: number, size = 1, color = 'rgba(255, 243, 214, '): void {
    if (age < 0 || age > 0.6) return;
    const p = age / 0.6;
    for (let i = 0; i < 5; i++) {
      const a = hash(i * 3.1) * TAU;
      const r = (4 + hash(i * 7.7) * 14 * size) * (0.4 + p);
      const px = x + Math.cos(a) * (6 + p * 22 * size);
      const py = y + Math.sin(a) * (4 + p * 10 * size) - p * 8;
      ctx.fillStyle = `${color}${(0.5 * (1 - p)).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(px, py, r * 0.5, 0, TAU);
      ctx.fill();
    }
  }

  private ring(ctx: Ctx, x: number, y: number, age: number, maxR = 70, life = 0.5, color = 'rgba(255,255,255,0.85)'): void {
    if (age < 0 || age > life) return;
    const p = age / life;
    const eased = 1 - (1 - p) * (1 - p);
    ctx.save();
    ctx.globalAlpha *= 1 - p;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.8, 4 * (1 - p));
    ctx.beginPath();
    ctx.ellipse(x, y, 8 + maxR * eased, (8 + maxR * eased) * 0.45, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /** Tiny comic interjection ("POOF!", "WHAM!") that pops and drops away. */
  private interject(ctx: Ctx, word: string, x: number, y: number, age: number, color = '#fff3d6'): void {
    if (age < 0 || age > 0.6) return;
    const pop = age < 0.1 ? 0.5 + (age / 0.1) * 0.7 : 1.2 - Math.min(0.2, (age - 0.1) * 1.4);
    ctx.save();
    ctx.globalAlpha *= Math.min(1, (0.6 - age) / 0.18);
    ctx.translate(x, y - age * 26);
    ctx.rotate(-0.08);
    ctx.scale(pop, pop);
    ctx.font = `italic 400 15px ${SHOUT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const wpx = ctx.measureText(word).width / 2 + 12;
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU;
      const r = i % 2 === 0 ? 1.15 : 0.8;
      const px = Math.cos(a) * wpx * r;
      const py = Math.sin(a) * 13 * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.translate(-2, -2);
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU;
      const r = i % 2 === 0 ? 1.15 : 0.8;
      const px = Math.cos(a) * wpx * r;
      const py = Math.sin(a) * 13 * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(word, -2, -1);
    ctx.restore();
  }

  private hero(ctx: Ctx, x: number, y: number, size: number, t: number, pose: Partial<Player> = {}, squash = 0): void {
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
    ctx.scale(size * (1 + squash), size * (1 - squash));
    ctx.fillStyle = 'rgba(10, 8, 22, 0.35)';
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
    ctx.fillStyle = 'rgba(10, 8, 22, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 12, 3.5, 0, 0, TAU);
    ctx.fill();
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
    ctx.fillStyle = 'rgba(10, 8, 22, 0.32)';
    ctx.beginPath();
    ctx.ellipse(1, 6, 18, 6, 0, 0, TAU);
    ctx.fill();
    drawEnemy(ctx, e, 0, 0, t);
    ctx.restore();
  }

  private caption(ctx: Ctx, age: number): void {
    const win = this.isWin();
    // slam in with an overshoot, then a tiny wobble; losers land softer
    const raw = clamp(age / (win ? 0.26 : 0.4), 0, 1);
    const pop = win ? easeOutBack(raw) : 1.6 - 0.6 * ease(raw);
    const glitch = !win && this.scene === 'newManagement' && age < 0.3 ? (hash(Math.floor(age * 40)) - 0.5) * 8 : 0;
    ctx.save();
    // kicker ribbon
    if (age > 0.12) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, (age - 0.12) / 0.18);
      ctx.translate(W / 2, 30);
      ctx.font = `700 9px ${TYPE_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const kw = ctx.measureText(this.kicker).width + 22;
      ctx.fillStyle = 'rgba(11, 9, 23, 0.85)';
      ctx.beginPath();
      ctx.roundRect(-kw / 2, -9, kw, 17, 8);
      ctx.fill();
      ctx.strokeStyle = win ? 'rgba(255, 210, 63, 0.7)' : 'rgba(229, 56, 59, 0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = win ? '#ffd23f' : '#ff8f8a';
      ctx.fillText(this.kicker, 0, 0.5);
      ctx.restore();
    }
    ctx.translate(W / 2 + glitch, 60);
    ctx.rotate(-0.045 + (win ? Math.sin(age * 30) * 0.008 * Math.exp(-age * 4) : 0));
    ctx.scale(Math.max(0.01, pop), Math.max(0.01, pop));
    ctx.font = `italic 400 34px ${SHOUT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = Math.min(W - 56, ctx.measureText(this.line).width + 36);
    // expanding shockwave on the slam
    if (win && age < 0.5) {
      ctx.save();
      ctx.globalAlpha *= 1 - age / 0.5;
      ctx.strokeStyle = 'rgba(255, 210, 63, 0.9)';
      ctx.lineWidth = 3 * (1 - age / 0.5) + 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, width * (0.6 + age * 1.4), 34 + age * 60, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    const strip = (): void => {
      ctx.beginPath();
      ctx.moveTo(-width / 2, -21);
      for (let i = 1; i <= 12; i++) ctx.lineTo(-width / 2 + (width * i) / 12, -21 + (i % 2 === 0 ? 0 : 2.5));
      ctx.lineTo(width / 2 + 3, 20);
      for (let i = 11; i >= 0; i--) ctx.lineTo(-width / 2 + (width * i) / 12, 21 - (i % 2 === 0 ? 0 : 2.5));
      ctx.closePath();
    };
    ctx.translate(4, 5);
    strip();
    ctx.fillStyle = 'rgba(11, 9, 23, 0.6)';
    ctx.fill();
    ctx.translate(-4, -5);
    strip();
    ctx.fillStyle = win ? '#ffd23f' : '#e5383b';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = win ? 'rgba(34,27,54,0.35)' : 'rgba(255,255,255,0.35)';
    ctx.stroke();
    ctx.fillStyle = win ? INK : '#ffffff';
    ctx.fillText(this.line, 0, 2, width - 20);
    ctx.restore();

    // sub-line: typewriter reveal on a pasted label
    if (age > 0.3) {
      const subAge = age - 0.3;
      const chars = Math.floor(subAge * 34);
      const shown = this.sub.slice(0, Math.max(0, Math.min(this.sub.length, chars)));
      const done = chars >= this.sub.length;
      ctx.save();
      ctx.globalAlpha *= Math.min(1, subAge / 0.2);
      ctx.translate(W / 2, 94);
      ctx.rotate(0.02);
      ctx.font = `700 11px ${HAND_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const full = ctx.measureText(this.sub).width + 20;
      ctx.fillStyle = 'rgba(11, 9, 23, 0.45)';
      ctx.fillRect(-full / 2 + 2, -9 + 2, full, 18);
      ctx.fillStyle = '#fbf6e9';
      ctx.fillRect(-full / 2, -9, full, 18);
      ctx.fillStyle = INK;
      ctx.fillText(done ? this.sub : `${shown}▌`, 0, 0.5);
      ctx.restore();
    }
  }

  // ───────────── win ─────────────

  /** Out they go: three flattened boxes through the air and into their own van, which leaves. */
  private evicted(ctx: Ctx, t: number): void {
    this.street(ctx, t, false);
    // parked, then a beat of anticipation before it speeds off
    const leave = ease(span(t, 2.42, 3.7));
    const backup = Math.sin(span(t, 2.15, 2.42) * Math.PI) * 10;
    const vanX = 132 + backup - leave * 380;
    const vanOpen = 1 - ease(span(t, 1.78, 2.0)) * 0.92;
    this.van(ctx, vanX, 204, vanOpen, t, t > 2.42, true);

    // door kicks open at the start
    const kick = easeOutBack(span(t, 0.1, 0.45));
    ctx.save();
    ctx.globalAlpha *= clamp(span(t, 0.1, 0.3), 0, 1) * (1 - span(t, 1.6, 2.0));
    ctx.fillStyle = 'rgba(255, 217, 138, 0.5)';
    ctx.beginPath();
    ctx.ellipse(349, 208, 30 * kick, 12 * kick, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // the throws with trails, landing puffs and interjections
    const starts = [0.5, 0.92, 1.34];
    let throwing = 0;
    for (let i = 0; i < 3; i++) {
      const start = starts[i]!;
      const dur = 0.55;
      const p = span(t, start, start + dur);
      if (p > 0 && p < 0.4) throwing = Math.max(throwing, 1 - p / 0.4);
      if (p <= 0 || p >= 1) {
        if (p >= 1) {
          const age = t - (start + dur);
          this.puff(ctx, vanX + 128, 190, age, 1.1);
          if (i === 2) this.interject(ctx, 'POOF!', vanX + 128, 158, age - 0.05, '#ffd23f');
        }
        continue;
      }
      const doorX = vanX + 128;
      const x = 334 + (doorX - 334) * p;
      const y = 176 - Math.sin(p * Math.PI) * 78 + p * -6;
      this.flyingBox(ctx, x, y, p * 11 + i * 1.7, p);
    }
    // hero follow-through + stomp dust on each release
    for (const s of starts) this.puff(ctx, 336, 206, t - (s + 0.08), 0.6);
    this.hero(ctx, 350, 208, 1.25, t, { aimX: -0.92, aimY: 0.38, throwAnim: throwing });
    // pet celebrates after the stamp
    const capAge = t - this.captionAt();
    const joy = capAge > 0 ? Math.abs(Math.sin(capAge * 7)) * 10 * Math.exp(-capAge * 0.5) : 0;
    this.companion(ctx, 390, 212 - joy, 1.25, t, { sitting: joy < 2 });
    if (capAge > 0.05 && capAge < 0.7) this.interject(ctx, '!', 402, 182 - joy, capAge - 0.05, '#9be564');
    // stamp shockwave + departure dust
    this.ring(ctx, W / 2, 120, capAge, 120, 0.5, 'rgba(255, 210, 63, 0.8)');
    if (t > 2.42) {
      for (let i = 0; i < 6; i++) this.puff(ctx, 120 - leave * 200 + i * 20, 206, t - 2.42 - i * 0.05, 1.3);
      ctx.fillStyle = 'rgba(255, 80, 60, 0.35)';
      for (let i = 0; i < 2; i++) ctx.fillRect(vanX + 126, -2 + 200 + i * 5, 40 * leave, 2);
    }
  }

  /** Standing on what is left of them. */
  private victory(ctx: Ctx, t: number): void {
    // wallpaper, picture frames, skirting board, floorboards, rug
    ctx.fillStyle = '#57487c';
    ctx.fillRect(-24, -24, W + 48, 214);
    ctx.fillStyle = '#4b3d6e';
    for (let i = 0; i < 18; i++) ctx.fillRect(i * 30 - 14, -24, 12, 214);
    // picture frames: one straight, one crooked, one "WANTED: MOVERS"
    ctx.save();
    ctx.fillStyle = '#2c243f';
    ctx.fillRect(56, 52, 54, 42);
    ctx.fillStyle = '#fbf6e9';
    ctx.fillRect(59, 55, 48, 36);
    ctx.fillStyle = '#c9a070';
    ctx.beginPath();
    ctx.arc(83, 70, 10, 0, TAU);
    ctx.fill();
    ctx.translate(392, 66);
    ctx.rotate(0.12);
    ctx.fillStyle = '#2c243f';
    ctx.fillRect(-27, -21, 54, 42);
    ctx.fillStyle = '#ff8f8a';
    ctx.fillRect(-24, -18, 48, 36);
    ctx.fillStyle = INK;
    ctx.font = `italic 400 11px ${SHOUT_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('WANTED', 0, -2);
    ctx.font = `700 8px ${TYPE_FONT}`;
    ctx.fillText('MOVERS', 0, 9);
    ctx.restore();
    ctx.fillStyle = '#fbf6e9';
    ctx.fillRect(-24, 182, W + 48, 8);
    ctx.fillStyle = '#c9a070';
    ctx.fillRect(-24, 190, W + 48, H - 166);
    ctx.strokeStyle = 'rgba(34, 27, 54, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.moveTo(-24, 204 + i * 16);
      ctx.lineTo(W + 24, 204 + i * 16);
    }
    ctx.stroke();
    // rug under the pile
    ctx.fillStyle = '#7c3f58';
    ctx.beginPath();
    ctx.ellipse(W / 2, 248, 120, 20, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#fbf6e9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(W / 2, 248, 108, 16, 0, 0, TAU);
    ctx.stroke();
    // sweeping spotlight + dust motes
    const sweep = Math.sin(t * 0.7) * 0.22;
    ctx.save();
    ctx.translate(W / 2, -20);
    ctx.rotate(sweep);
    const beam = ctx.createLinearGradient(0, 0, 0, 280);
    beam.addColorStop(0, 'rgba(255, 243, 214, 0.22)');
    beam.addColorStop(1, 'rgba(255, 243, 214, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.lineTo(40, 0);
    ctx.lineTo(130, 300);
    ctx.lineTo(-130, 300);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const light = ctx.createRadialGradient(W / 2, 170, 30, W / 2, 170, 250);
    light.addColorStop(0, 'rgba(255, 243, 214, 0.24)');
    light.addColorStop(1, 'rgba(17, 14, 34, 0.55)');
    ctx.fillStyle = light;
    ctx.fillRect(-24, -24, W + 48, H + 48);
    ctx.fillStyle = 'rgba(255, 243, 214, 0.5)';
    for (let i = 0; i < 12; i++) {
      const mx = W / 2 + Math.sin(t * 0.8 + i * 2.4) * 90 + (hash(i * 3.3) - 0.5) * 60;
      const my = 90 + ((hash(i * 7.1) * 160 + t * 12) % 160);
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 2 + i);
      ctx.fillRect(mx, my, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;

    // the pile drops in with bounces and puffs
    for (let i = 0; i < 7; i++) {
      const drop = easeOutBounce(span(t, i * 0.05, 0.3 + i * 0.05));
      const landAge = t - (0.3 + i * 0.05);
      const squash = landAge > 0 && landAge < 0.22 ? Math.sin((landAge / 0.22) * Math.PI) * 0.28 : 0;
      this.flatBox(ctx, W / 2 + (hash(i) - 0.5) * 36, 244 - i * 6.5 - (1 - drop) * 200, (hash(i + 9) - 0.5) * 0.5, 1.9, squash);
      this.puff(ctx, W / 2 + (hash(i) - 0.5) * 36, 246, landAge, 0.9);
    }
    // hero drops from the sky, squashes on landing, then hops
    const land = easeOutBounce(span(t, 0.25, 0.6));
    const landAge = t - 0.6;
    const squash = landAge > 0 && landAge < 0.25 ? Math.sin((landAge / 0.25) * Math.PI) * 0.22 : 0;
    const hop = t > 0.95 ? Math.abs(Math.sin((t - 0.95) * 6.5)) * 12 : 0;
    const stretch = t > 0.95 ? Math.abs(Math.cos((t - 0.95) * 6.5)) * 0.08 : 0;
    // landing shadow grows as the hero comes down
    ctx.fillStyle = 'rgba(10, 8, 22, 0.35)';
    ctx.beginPath();
    ctx.ellipse(W / 2 - 14, 208, 12 + land * 14, 4 + land * 3, 0, 0, TAU);
    ctx.fill();
    this.hero(
      ctx, W / 2 - 14, 203 - (1 - land) * 220 - hop, 1.55, t,
      { aimX: 0.2, aimY: 0.97, throwAnim: hop > 4 ? 0.6 : 0 }, squash - stretch,
    );
    this.ring(ctx, W / 2 - 14, 206, landAge, 60, 0.4);
    if (landAge > 0 && landAge < 0.6) this.interject(ctx, 'WHAM!', W / 2 + 52, 150, landAge, '#ffd23f');
    const petHop = t > 1.1 ? Math.abs(Math.sin((t - 1.1) * 6.5)) * 13 : 0;
    this.companion(ctx, W / 2 + 68, 242 - petHop, 1.55, t, { sitting: petHop < 2 });
    this.puff(ctx, W / 2 + 68, 244, t - 1.1, 0.5);

    // packing peanuts like confetti, near + far layers
    for (let i = 0; i < 52; i++) {
      const far = i % 3 === 0;
      const p = (t * (0.3 + hash(i) * 0.35) + hash(i + 70)) % 1;
      const x = hash(i + 20) * W + Math.sin(t * 2 + i) * (far ? 5 : 12);
      ctx.save();
      ctx.translate(x, p * (H + 24) - 12);
      ctx.rotate(t * (far ? 1.5 : 3.5) + i);
      ctx.globalAlpha *= far ? 0.55 : 1;
      ctx.fillStyle = i % 4 === 0 ? '#ffd23f' : i % 4 === 1 ? '#ff5a4e' : i % 4 === 2 ? '#4ad6e8' : '#fff3d6';
      const s = far ? 0.6 : 1;
      ctx.fillRect(-3.5 * s, -1.6 * s, 7 * s, 3.2 * s);
      ctx.restore();
    }
    // sparkles winking over the pile
    for (let i = 0; i < 10; i++) {
      const tw = Math.max(0, Math.sin(t * 4 + i * 1.9));
      if (tw < 0.4) continue;
      const x = W / 2 + (hash(i * 5.1) - 0.5) * 130;
      const y = 150 + hash(i * 9.4) * 70;
      ctx.save();
      ctx.globalAlpha *= tw * 0.9;
      ctx.strokeStyle = '#fff3d6';
      ctx.lineWidth = 1.4;
      const r = 3 + tw * 4;
      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y + r);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ───────────── lose ─────────────

  /** Boxed up and carried out to the van, pet trailing behind. */
  private movedOut(ctx: Ctx, t: number): void {
    this.street(ctx, t, true);
    const loaded = ease(span(t, 2.75, 3.1));
    this.van(ctx, 96, 204, 1 - ease(span(t, 2.95, 3.2)), t, false, false);
    const walk = span(t, 0.15, 2.6);
    const carryX = 352 - walk * 118;
    const cx = carryX - loaded * 46;
    const bob = Math.sin(t * 11) * 2.2 * (walk < 1 ? 1 : 0);
    const cy = 210;

    if (loaded < 1) {
      ctx.save();
      ctx.globalAlpha *= 1 - span(t, 2.9, 3.1);
      this.mover(ctx, 0, cx + 34, cy + 6, 1.15, t, Math.PI * 0.86, walk < 1);
      // the hero, packed — only the sad head pokes out
      ctx.save();
      ctx.translate(cx, cy - 12 + bob);
      ctx.rotate(Math.sin(t * 5.5) * 0.05);
      this.hero(ctx, 0, -2, 1.0, t, { aimX: -0.2, aimY: 0.98, hurtFlash: 0.25, walkPhase: t * 9 });
      // the box they have been put in, drawn over the body
      ctx.fillStyle = 'rgba(10, 8, 22, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 20, 28, 6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#c9a070';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(-24, -8, 48, 26);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#9c7446';
      ctx.fillRect(-24, 10, 48, 8);
      ctx.fillStyle = '#ecdcab';
      ctx.fillRect(-4, -8, 8, 26);
      // shipping label
      ctx.fillStyle = '#fbf6e9';
      ctx.fillRect(6, -3, 15, 11);
      ctx.fillStyle = '#e5383b';
      ctx.fillRect(6, -3, 15, 4);
      ctx.fillStyle = INK;
      ctx.font = `700 5px ${TYPE_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MISC', 13.5, 4.5);
      ctx.fillStyle = '#8f86b8';
      ctx.font = `700 4.5px ${TYPE_FONT}`;
      ctx.fillText('THIS SIDE UP ↑', 0, -11.5);
      ctx.restore();
      this.mover(ctx, 1, cx - 34, cy + 6, 1.15, t, Math.PI * 0.86, walk < 1);
      // footstep splashes
      if (walk > 0 && walk < 1 && Math.sin(t * 11) > 0.7) this.puff(ctx, cx, cy + 10, 0.15, 0.5, 'rgba(159, 227, 255, ');
      ctx.restore();
    } else {
      // doors thump shut
      this.puff(ctx, 128, 190, t - 3.2, 0.8);
    }
    // the pet, a few steps behind and not keeping up
    const petX = 420 - span(t, 0.5, 3.4) * 150;
    const petDrag = loaded >= 1 ? 0 : Math.sin(t * 14) * 1.5;
    this.companion(ctx, petX, 216 + petDrag, 1.15, t, { sitting: false, vx: -120, walkPhase: t * 14, fear: 1, flying: 1 });
    if (t > 1) {
      ctx.fillStyle = '#9fe3ff';
      const tear = (t * 1.4) % 1;
      ctx.save();
      ctx.globalAlpha *= 1 - tear;
      ctx.beginPath();
      ctx.arc(petX - 8, 196 + tear * 12, 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(petX - 8.7, 195.5 + tear * 12, 0.7, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    if (t > 1.5 && loaded < 1) this.interject(ctx, '…', petX + 16, 186, (t - 1.5) % 1.2, '#8f86b8');
    // puddle under the lamp mirrors the light
    ctx.fillStyle = 'rgba(255, 233, 176, 0.12)';
    ctx.beginPath();
    ctx.ellipse(55, 232, 34, 6, 0, 0, TAU);
    ctx.fill();
    // van tail-lights bleed into the wet road
    if (loaded >= 1) {
      const pulse = 0.5 + 0.3 * Math.sin(t * 4);
      ctx.fillStyle = `rgba(255, 59, 48, ${pulse.toFixed(2)})`;
      ctx.fillRect(96 + 126, 202, 40, 3);
    }
  }

  /** Later that night: they have your sofa, your telly and your remote. */
  private newManagement(ctx: Ctx, t: number): void {
    ctx.fillStyle = '#241f42';
    ctx.fillRect(-24, -24, W + 48, 214);
    // wallpaper: faint diamond pattern
    ctx.strokeStyle = 'rgba(255, 243, 214, 0.05)';
    ctx.lineWidth = 1;
    for (let x = -24; x < W + 24; x += 26) {
      for (let y = 0; y < 190; y += 26) {
        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x + 8, y);
        ctx.lineTo(x + 16, y + 8);
        ctx.lineTo(x + 8, y + 16);
        ctx.closePath();
        ctx.stroke();
      }
    }
    // crooked "HOME SWEET HOME" frame, one corner hanging off its nail
    ctx.save();
    ctx.translate(392, 52);
    ctx.rotate(0.16 + Math.sin(t * 0.8) * 0.01);
    ctx.fillStyle = INK;
    ctx.fillRect(-52, -14, 104, 28);
    ctx.fillStyle = '#fbf6e9';
    ctx.fillRect(-50, -12, 100, 24);
    ctx.fillStyle = INK;
    ctx.font = `700 9px ${HAND_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOME SWEET HOME', 0, 0);
    ctx.strokeStyle = '#e5383b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-44, -8);
    ctx.lineTo(44, 8);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#1c1733';
    ctx.fillRect(-24, 190, W + 48, H - 166);
    // rug with border
    ctx.fillStyle = '#3a305e';
    ctx.beginPath();
    ctx.ellipse(300, 232, 130, 22, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(300, 232, 118, 18, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#3a305e';
    ctx.fillRect(-24, 184, W + 48, 6);

    // the telly with static, scanlines and a channel bug
    const flick = 0.55 + hash(Math.floor(t * 12)) * 0.45;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(30, 154, 70, 48);
    ctx.fillStyle = INK;
    ctx.fillRect(34, 150, 62, 44);
    ctx.fillStyle = `rgba(160, 220, 255, ${flick.toFixed(2)})`;
    ctx.fillRect(38, 154, 54, 36);
    // static dots
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 18; i++) {
      if (hash(i * 7.7 + Math.floor(t * 12) * 3.3) > 0.5) ctx.fillRect(38 + hash(i * 3.1) * 54, 154 + hash(i * 5.9) * 36, 1.5, 1.5);
    }
    // bouncing "BONK!" ident on the screen
    const bx = 65 + Math.sin(t * 2.2) * 12;
    const by = 172 + Math.abs(Math.sin(t * 3.1)) * -10;
    ctx.fillStyle = INK;
    ctx.font = `italic 400 10px ${SHOUT_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('BONK!', bx, by);
    ctx.fillStyle = 'rgba(20, 16, 36, 0.25)';
    for (let y = 156; y < 190; y += 4) ctx.fillRect(38, y, 54, 1);
    ctx.fillStyle = INK;
    ctx.font = `700 6px ${TYPE_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(20,16,36,0.8)';
    ctx.fillText('CH 3', 40, 158);
    ctx.fillStyle = INK;
    ctx.fillRect(58, 194, 14, 12);
    ctx.fillStyle = '#2c243f';
    ctx.fillRect(40, 206, 50, 6);
    const beam = ctx.createLinearGradient(96, 0, 430, 0);
    beam.addColorStop(0, `rgba(160, 220, 255, ${(0.32 * flick).toFixed(2)})`);
    beam.addColorStop(1, 'rgba(160, 220, 255, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(96, 156);
    ctx.lineTo(430, 96);
    ctx.lineTo(430, 250);
    ctx.lineTo(96, 190);
    ctx.closePath();
    ctx.fill();

    // sofa back, the crew sunk in, sofa front
    ctx.fillStyle = 'rgba(10, 8, 22, 0.4)';
    ctx.beginPath();
    ctx.ellipse(304, 232, 130, 14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7c5cd8';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(196, 128, 216, 70, 14);
    ctx.fill();
    ctx.stroke();
    // cushion seams + buttons
    ctx.strokeStyle = 'rgba(34,27,54,0.4)';
    ctx.lineWidth = 2;
    for (const sx of [268, 340]) {
      ctx.beginPath();
      ctx.moveTo(sx, 132);
      ctx.lineTo(sx, 194);
      ctx.stroke();
    }
    // throw blanket over the left arm
    ctx.fillStyle = '#ff9ec4';
    ctx.beginPath();
    ctx.roundRect(188, 168, 40, 34, 6);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    const settle = easeOutBounce(span(t, 0.2, 0.75));
    for (let i = 0; i < 3; i++) {
      const laugh = Math.abs(Math.sin(t * 9 + i * 1.3)) * 3.5 * span(t, 1.2, 1.5);
      const rock = Math.sin(t * 9 + i) * 0.03 * span(t, 1.2, 1.5);
      ctx.save();
      ctx.translate(242 + i * 62, 196 - laugh + (1 - settle) * -80);
      ctx.rotate(rock);
      ctx.translate(-(242 + i * 62), -(196 - laugh + (1 - settle) * -80));
      this.mover(ctx, i, 242 + i * 62, 196 - laugh + (1 - settle) * -80, 1.45, t, Math.PI * 0.93, false);
      ctx.restore();
      if (settle < 1) this.puff(ctx, 242 + i * 62, 200, t - (0.55 + i * 0.06), 0.9);
    }
    ctx.fillStyle = '#5a3fb0';
    ctx.beginPath();
    ctx.roundRect(188, 190, 232, 38, 10);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    for (const ax of [186, 400]) {
      ctx.fillStyle = '#7c5cd8';
      ctx.beginPath();
      ctx.roundRect(ax, 160, 24, 66, 9);
      ctx.fill();
      ctx.stroke();
    }
    // popcorn going up with little trails
    for (let i = 0; i < 8; i++) {
      const p = (t * 1.25 + i * 0.37) % 1;
      const px = 272 + i * 20 + Math.sin(i * 3 + t) * 6;
      const py = 178 - Math.sin(p * Math.PI) * 34;
      ctx.strokeStyle = 'rgba(255, 243, 214, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py + 8 * p);
      ctx.lineTo(px, py + 2);
      ctx.stroke();
      ctx.fillStyle = '#fff3d6';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 2.4, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    // popcorn bowl tipped on the rug
    ctx.save();
    ctx.translate(232, 226);
    ctx.rotate(0.5);
    ctx.fillStyle = '#fbf6e9';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 8, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // all that is left of you: one slipper, dragged
    ctx.save();
    ctx.translate(148, 232);
    ctx.rotate(-0.3);
    ctx.fillStyle = 'rgba(10, 8, 22, 0.3)';
    ctx.beginPath();
    ctx.ellipse(4, 8, 16, 4, 0, 0, TAU);
    ctx.fill();
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
    // drag marks behind it
    ctx.strokeStyle = 'rgba(10, 8, 22, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(96, 238);
    ctx.quadraticCurveTo(118, 234, 136, 233);
    ctx.stroke();
    ctx.setLineDash([]);
    // the remote, LED blinking, just out of reach
    ctx.save();
    ctx.translate(178, 244);
    ctx.rotate(0.4);
    ctx.fillStyle = '#2c243f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-5, -14, 10, 28, 4);
    ctx.fill();
    ctx.stroke();
    const led = 0.4 + 0.6 * Math.abs(Math.sin(t * 5));
    ctx.fillStyle = `rgba(255, 59, 48, ${led.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(0, -10, 1.8, 0, TAU);
    ctx.fill();
    ctx.restore();
    // TV light washes over everything
    ctx.fillStyle = `rgba(160, 220, 255, ${(0.05 + 0.05 * flick).toFixed(3)})`;
    ctx.fillRect(-24, -24, W + 48, H + 48);
    // the pet looks in from the edge of the room
    const peek = easeOutBack(span(t, 1.4, 2.0));
    const blink = Math.sin(t * 1.1) > 0.97 ? -2 : 0;
    this.companion(ctx, 486 - peek * 42, 236 + blink, 1.5, t, { sitting: true, fear: 1, flying: 0 });
    if (t > 2.2) this.interject(ctx, '…?', 448, 204, (t - 2.2) % 1.4, '#8f86b8');
  }
}
