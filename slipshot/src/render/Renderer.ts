import { ENEMY_LAUNCHER, type LauncherSpec } from '../game/catalog';
import type { Well } from '../game/Mechanics';
import type { Fortress, Footprint } from '../game/Fortress';
import { pieceSize, type FortressItemId } from '../game/fortressItems';
import { drawLauncher, drawShot } from './shotArt';
import { drawPiece } from './fortressArt';
import type { Arena } from '../game/Arena';
import type { PhysicsObject } from '../physics/PhysicsObject';
import type { Projectile } from '../physics/Projectile';
import type { Ragdoll, RagdollPart } from '../physics/Ragdoll';
import { SLIME_COLOR, type SlimeSystem } from '../physics/SlimeSystem';
import { JOINT_SPECS, PART_SPECS, type PartName, type PartSpec } from '../physics/rig';
import { lerp, TAU, wrapAngle } from '../util/math';
import type { Camera } from './Camera';
import type { Effects } from './Effects';

export interface AimView {
  /** True while the player has a usable drag. */
  active: boolean;
  power: number;
  anchor: { x: number; y: number } | null;
  pointer: { x: number; y: number } | null;
  path: { x: number; y: number }[];
  landing: { x: number; y: number } | null;
}

export interface Scene {
  arena: Arena;
  slime: SlimeSystem;
  effects: Effects;
  camera: Camera;
  player: Ragdoll;
  enemies: Ragdoll[];
  projectiles: Projectile[];
  objects: PhysicsObject[];
  /** The player's fortress: standing pieces and any fallen ones. */
  fortress: Fortress;
  wells: Well[];
  /** The player's launcher design, from the equipped weapon. */
  playerLauncher: LauncherSpec;
  /** The slime blob held in the palm with bare hands, or null when there is none. */
  hand: HandView | null;
  /** Recent hand positions during a throw, newest last, for the swoosh. */
  throwTrail: { x: number; y: number; age: number }[];
  coins: CoinView[];
  /** Build mode: the zone, the held piece and where it would land. Null outside build mode. */
  build: BuildView | null;
  aim: AimView;
  time: number;
  alpha: number;
}

export interface HandView {
  /** Blob size relative to normal (0 = gone, 1 = ready, >1 = charged). */
  size: number;
  power: number;
  swinging: boolean;
  charging: boolean;
}

export interface CoinView {
  x: number;
  y: number;
  spin: number;
}

/** A landing spot for the dragged piece, and whether it may go there. */
export interface GhostView extends Footprint {
  valid: boolean;
}

export interface BuildView {
  zone: { minX: number; maxX: number; topY: number; maxY: number };
  /** The piece under the finger, in world space. */
  held: { item: FortressItemId; rot: 0 | 1; x: number; y: number } | null;
  landing: GhostView | null;
}

interface Pose {
  x: number;
  y: number;
  a: number;
}

const OUTLINE = 0.03;
const INK = '#1d2638';
const PLAYER_FILL = '#ffffff';
const FLASH_FILL = '#fff3a3';
/** Projectiles are drawn a little larger than their physics radius, so their designs read on screen. */
const PROJECTILE_ART_SCALE = 1.6;
/** Shot looks that are hard objects, not slime: these do not jiggle. */
const RIGID_LOOKS = new Set<string>(['boomerang', 'bomb', 'cluster', 'ring']);
const WELL_COLOR = '#b47aff';
const GLUE_COLOR = '#ffc65c';


/** Fixed star field: positions in 0..1 of the view, with a depth that sets drift and brightness. */
const STARS = Array.from({ length: 70 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 43758.5453;
  return {
    x: a - Math.floor(a),
    y: b - Math.floor(b),
    depth: 0.3 + 0.7 * ((i * 0.37) % 1),
    r: 0.6 + 1.2 * ((i * 0.61) % 1),
  };
});

/** Environment palette. Every arena colour (sky, hills, floor, platforms, pit, crates, ball) is a shade of one blue. */
const ENV = {
  skyTop: '#040b19',
  skyMid: '#0a1b35',
  skyBottom: '#14325d',
  star: '#6f9fd8',
  earthDeep: '#0c2448',
  lipTop: '#3a74b5',
  lipBottom: '#2a5c96',
  platformBody: '#163d6c',
  platformEdge: '#081d3a',
  platformLip: '#3b76b7',
  crateFill: '#2a5f9c',
  crateLine: '#071a33',
  ballFill: '#4a86c8',
  ballStripe: '#a9cdf0',
  ballEdge: '#0a2446',
} as const;

/** Canvas drawing for the arena, characters, slime and HUD overlays. */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private viewW = 1;
  private viewH = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: Camera,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    this.ctx = ctx;
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.dpr = dpr;
    this.viewW = w;
    this.viewH = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.camera.setViewport(w, h);
  }

  draw(s: Scene): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawSky(s.camera.x);

    s.camera.apply(ctx, this.dpr);
    this.drawTerrain(s);
    if (s.build) this.drawBuildZone(s.build, s.time);
    this.drawFortress(s);
    this.drawPuddles(s);
    this.drawWells(s);
    this.drawObjects(s);
    this.drawBeams(s);
    this.drawProjectileTrails(s);
    this.drawCharacter(s.player, s.alpha, s.time);
    for (const e of s.enemies) this.drawCharacter(e, s.alpha, s.time);
    this.drawGums(s);
    this.drawThrowTrail(s);
    this.drawLaunchers(s);
    this.drawProjectiles(s);
    this.drawParticles(s);
    this.drawCoins(s);
    this.drawAimPreview(s);
    if (s.build) this.drawBuildGhost(s.build, s.time);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawHealthBars(s);
    this.drawFloatingText(s);
    this.drawDragOverlay(s);
    if (s.effects.screenFlash > 0) {
      ctx.globalAlpha = 0.55 * s.effects.screenFlash;
      ctx.fillStyle = '#eaffd9';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.globalAlpha = 1;
    }
  }

  // ---- Screen-space background -------------------------------------------

  private drawSky(camX: number): void {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, ENV.skyTop);
    sky.addColorStop(0.6, ENV.skyMid);
    sky.addColorStop(1, ENV.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Faint stars that drift slowly against the camera, so the void reads as depth, not floor.
    ctx.fillStyle = ENV.star;
    for (const s of STARS) {
      const x = (((s.x * w - camX * 4 * s.depth) % w) + w) % w;
      const y = s.y * h * 0.75;
      ctx.globalAlpha = 0.35 + 0.5 * s.depth;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- World: terrain, puddles, objects ----------------------------------

  /** Islands only. There is no floor: characters stand on these and fall into the void. */
  private drawTerrain(s: Scene): void {
    const ctx = this.ctx;
    for (const p of s.arena.islands) {
      const top = p.topY;
      const h = 0.6;
      // Rock under the island, a shade darker toward the bottom.
      const grad = ctx.createLinearGradient(0, top, 0, top - h * 4);
      grad.addColorStop(0, ENV.platformBody);
      grad.addColorStop(1, ENV.earthDeep);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(p.minX, top - h * 4, p.maxX - p.minX, h * 4, 0.3);
      ctx.fill();
      ctx.lineWidth = OUTLINE * 1.4;
      ctx.strokeStyle = ENV.platformEdge;
      ctx.stroke();
      // Lit top surface.
      ctx.fillStyle = p.home ? ENV.lipTop : ENV.platformLip;
      ctx.beginPath();
      ctx.roundRect(p.minX - 0.03, top - 0.16, p.maxX - p.minX + 0.06, 0.16, 0.08);
      ctx.fill();
      ctx.fillStyle = ENV.lipBottom;
      ctx.fillRect(p.minX, top - 0.04, p.maxX - p.minX, 0.04);
    }
  }

  // ---- Fortress and build mode ---------------------------------------------

  /** Standing and fallen fortress pieces. New pieces pop in with a springy overshoot. */
  private drawFortress(s: Scene): void {
    const ctx = this.ctx;
    for (const p of [...s.fortress.standing, ...s.fortress.debris]) {
      const pos = p.body.getPosition();
      const x = lerp(p.prevX, pos.x, s.alpha);
      const y = lerp(p.prevY, pos.y, s.alpha);
      const a = lerpAngle(p.prevA, p.body.getAngle(), s.alpha);
      const pop = p.age < 0.35 ? easeOutBack(p.age / 0.35) : 1;
      ctx.save();
      // Pop-in grows from the base, so the piece seems to land rather than inflate.
      ctx.translate(x, y - p.h / 2);
      ctx.rotate(a);
      ctx.scale(pop, pop);
      ctx.translate(0, p.h / 2);
      drawPiece(ctx, p.def.id, p.w, p.h, {
        time: s.time,
        wear: 1 - p.hp / p.def.hp,
        flash: p.flash,
        aim: p.aim - a,
        recoil: p.recoil,
        seed: p.saved.x * 3.1 + p.saved.y * 7.7,
      });
      ctx.restore();
    }
  }

  /** The build zone: a soft glow over the home island up to the height limit, with a grid. */
  private drawBuildZone(b: BuildView, time: number): void {
    const ctx = this.ctx;
    const { minX, maxX, topY, maxY } = b.zone;
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
    const g = ctx.createLinearGradient(0, topY, 0, maxY);
    g.addColorStop(0, `rgba(141, 255, 90, ${0.16 + 0.06 * pulse})`);
    g.addColorStop(1, 'rgba(141, 255, 90, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(minX, topY, maxX - minX, maxY - topY);
    ctx.strokeStyle = 'rgba(141, 255, 90, 0.18)';
    ctx.lineWidth = 0.015;
    ctx.beginPath();
    for (let x = minX; x <= maxX + 1e-6; x += 0.5) {
      ctx.moveTo(x, topY);
      ctx.lineTo(x, topY + 1.2);
    }
    ctx.stroke();
    ctx.setLineDash([0.2, 0.15]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(minX, maxY);
    ctx.lineTo(maxX, maxY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * The dragged piece: a solid copy under the finger, a drop line, and an
   * outline where it will land (green when allowed, red when not).
   */
  private drawBuildGhost(b: BuildView, time: number): void {
    const ctx = this.ctx;
    const land = b.landing;
    const held = b.held;
    if (!land || !held) return;
    const col = land.valid ? '#8dff5a' : '#ff6b6b';
    // Landing outline, gently pulsing.
    ctx.save();
    ctx.translate(land.x, land.y);
    ctx.globalAlpha = 0.35;
    drawPiece(ctx, land.item, land.w, land.h, { time, wear: 0, flash: 0, aim: 0.5, recoil: 0, seed: 1, ghost: true });
    ctx.globalAlpha = 1;
    ctx.setLineDash([0.12, 0.08]);
    ctx.lineDashOffset = -time * 0.6;
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.05 + 0.02 * Math.sin(time * 8);
    ctx.beginPath();
    ctx.roundRect(-land.w / 2 - 0.05, -land.h / 2 - 0.05, land.w + 0.1, land.h + 0.1, 0.08);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // Drop line from the held piece to the landing spot.
    if (held.y > land.y + land.h / 2) {
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 0.03;
      ctx.setLineDash([0.1, 0.1]);
      ctx.beginPath();
      ctx.moveTo(land.x, held.y);
      ctx.lineTo(land.x, land.y + land.h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    // The held piece, tilted a little with a wobble, so it feels picked up.
    const { w, h } = pieceSize(held.item, held.rot);
    ctx.save();
    ctx.translate(held.x, held.y);
    ctx.rotate(0.06 * Math.sin(time * 5));
    ctx.globalAlpha = 0.92;
    drawPiece(ctx, held.item, w, h, { time, wear: 0, flash: 0, aim: 0.5, recoil: 0, seed: 1 });
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Spawn beams: a soft light column that fades from the bottom up. */
  private drawBeams(s: Scene): void {
    const ctx = this.ctx;
    for (const b of s.effects.beams) {
      const k = b.life / b.maxLife;
      const width = 0.9 * (0.4 + 0.6 * k);
      const g = ctx.createLinearGradient(0, b.y, 0, b.y + 9);
      g.addColorStop(0, hexA(b.color, 0.75 * k));
      g.addColorStop(1, hexA(b.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(b.x - width / 2, b.y, width, 9);
      ctx.fillStyle = hexA('#ffffff', 0.6 * k);
      ctx.fillRect(b.x - width * 0.15, b.y, width * 0.3, 9 * k);
    }
  }

  /** The swoosh of a throw: a ribbon along the hand's path, thick and bright at the newest end. */
  private drawThrowTrail(s: Scene): void {
    const pts = s.throwTrail;
    if (pts.length < 2) return;
    const ctx = this.ctx;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const k = i / (pts.length - 1);
      const fade = Math.max(0, 1 - b.age / 0.2);
      ctx.globalAlpha = 0.75 * fade * k;
      ctx.strokeStyle = k > 0.6 ? '#ffffff' : SLIME_COLOR;
      ctx.lineWidth = 0.04 + 0.16 * k;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** KO coins: spinning gold discs (the spin squashes them horizontally) with a shine. */
  private drawCoins(s: Scene): void {
    const ctx = this.ctx;
    for (const c of s.coins) {
      const sx = Math.max(0.15, Math.abs(Math.cos(c.spin)));
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(sx, 1);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(0, 0, 0.13, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#b07a00';
      ctx.lineWidth = 0.025;
      ctx.stroke();
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.arc(-0.035, 0.035, 0.04, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * The slime blob held in the palm with bare hands. It breathes while idle,
   * swells and quivers while aiming, stretches along the swing, and grows back
   * after a throw.
   */
  private drawHandBlob(s: Scene, hand: { x: number; y: number }, dir: { x: number; y: number }): void {
    const view = s.hand;
    if (!view || view.size <= 0.02) return;
    const ctx = this.ctx;
    const base = 0.17 * view.size;
    const t = s.time;
    let sx = 1 + 0.05 * Math.sin(t * 5);
    let sy = 1 / sx;
    if (view.charging) {
      const q = 0.06 + 0.12 * view.power;
      sx = 1 + q * Math.sin(t * (14 + 10 * view.power));
      sy = 1 / sx;
    }
    if (view.swinging) {
      sx = 1.45;
      sy = 0.72;
    }
    const at = { x: hand.x + dir.x * base * 0.6, y: hand.y + dir.y * base * 0.6 };
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(Math.atan2(dir.y, dir.x));
    ctx.scale(sx, sy);
    const g = ctx.createRadialGradient(-base * 0.35, base * 0.35, base * 0.1, 0, 0, base);
    g.addColorStop(0, '#f2ffe4');
    g.addColorStop(0.45, SLIME_COLOR);
    g.addColorStop(1, '#3f9a1c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, base, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = OUTLINE;
    ctx.stroke();
    // A drip hanging off the bottom while charging.
    if (view.charging && view.power > 0.3) {
      ctx.fillStyle = SLIME_COLOR;
      ctx.beginPath();
      ctx.ellipse(-base * 0.2, -base * (1 + 0.3 * view.power), base * 0.18, base * 0.3 * view.power, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Gum blobs stuck to enemies: a wobbling slime drop with a shine, fading out in
   * the last second. The wobble is a sine on the radius, so it reads as squishy.
   */
  private drawGums(s: Scene): void {
    const ctx = this.ctx;
    for (const g of s.slime.gums) {
      const p = g.body.getPosition();
      const pos = this.lerpPos(g.prevX, g.prevY, p.x, p.y, s.alpha);
      const fade = Math.min(1, g.life / 1.0);
      // A fresh blob jiggles hard and fast, then settles into a slow wobble.
      const squish = 1 + (0.08 + 0.5 * g.jiggle) * Math.sin(s.time * (8 + 16 * g.jiggle) + g.seed);
      const rx = g.radius * squish;
      const ry = g.radius / squish;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.globalAlpha = 0.92 * fade;
      ctx.fillStyle = SLIME_COLOR;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = OUTLINE;
      ctx.strokeStyle = '#4a9a2e';
      ctx.stroke();
      ctx.globalAlpha = 0.75 * fade;
      ctx.fillStyle = '#f4ffe8';
      ctx.beginPath();
      ctx.ellipse(-rx * 0.35, -ry * 0.35, rx * 0.28, ry * 0.18, -0.6, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /** Gravity wells: slow rings that spin and a bright core, fading out at the end. */
  private drawWells(s: Scene): void {
    const ctx = this.ctx;
    for (const w of s.wells) {
      const fade = Math.min(1, w.time / 0.6);
      ctx.save();
      ctx.lineWidth = 0.06;
      for (let i = 0; i < 3; i++) {
        const r = w.radius * (0.35 + 0.22 * i);
        const a = s.time * (1.6 + i * 0.7) + i * 2.1;
        ctx.globalAlpha = (0.55 - i * 0.12) * fade;
        ctx.strokeStyle = WELL_COLOR;
        ctx.beginPath();
        ctx.arc(w.x, w.y, r, a, a + 4.4);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.7 * fade;
      ctx.fillStyle = WELL_COLOR;
      ctx.beginPath();
      ctx.arc(w.x, w.y, 0.2 + 0.05 * Math.sin(s.time * 6), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPuddles(s: Scene): void {
    const ctx = this.ctx;
    for (const p of s.slime.puddles) {
      const intro = Math.min(1, (p.maxLife - p.life) / 0.25);
      const fade = Math.min(1, p.life / 0.9);
      const alpha = fade * intro;
      const wob = 1 + 0.03 * Math.sin(s.time * 3 + p.seed);
      const rx = p.halfW * wob * (0.4 + 0.6 * intro);
      const ry = 0.05 * (0.4 + 0.6 * intro);

      ctx.globalAlpha = 0.9 * alpha;
      ctx.fillStyle = p.glue ? GLUE_COLOR : SLIME_COLOR;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 0.02, rx, ry, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = OUTLINE;
      ctx.strokeStyle = p.glue ? '#8a5a18' : '#4a9a2e';
      ctx.stroke();

      ctx.globalAlpha = 0.7 * alpha;
      ctx.fillStyle = '#f4ffe8';
      ctx.beginPath();
      ctx.ellipse(p.x - rx * 0.3, p.y + 0.045, rx * 0.35, ry * 0.25, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private drawObjects(s: Scene): void {
    const ctx = this.ctx;
    for (const o of s.objects) {
      const pos = this.lerpPos(o.prevX, o.prevY, o.body.getPosition().x, o.body.getPosition().y, s.alpha);
      const a = lerpAngle(o.prevA, o.body.getAngle(), s.alpha);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(a);
      if (o.kind === 'crate') {
        const h = o.size;
        ctx.fillStyle = ENV.crateFill;
        ctx.fillRect(-h, -h, 2 * h, 2 * h);
        ctx.strokeStyle = ENV.crateLine;
        ctx.lineWidth = OUTLINE * 1.3;
        ctx.strokeRect(-h, -h, 2 * h, 2 * h);
        ctx.beginPath();
        ctx.moveTo(-h, -h);
        ctx.lineTo(h, h);
        ctx.moveTo(h, -h);
        ctx.lineTo(-h, h);
        ctx.stroke();
      } else {
        ctx.fillStyle = ENV.ballFill;
        ctx.beginPath();
        ctx.arc(0, 0, o.size, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = ENV.ballEdge;
        ctx.lineWidth = OUTLINE * 1.3;
        ctx.stroke();
        ctx.fillStyle = ENV.ballStripe;
        ctx.fillRect(-o.size, -0.06, 2 * o.size, 0.12);
      }
      if (o.slimeTimer > 0) {
        const fade = Math.min(1, o.slimeTimer / 0.6);
        ctx.globalAlpha = 0.55 * fade;
        ctx.fillStyle = SLIME_COLOR;
        if (o.kind === 'crate') ctx.fillRect(-o.size, -o.size, 2 * o.size, 2 * o.size);
        else {
          ctx.beginPath();
          ctx.arc(0, 0, o.size, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  // ---- Characters ---------------------------------------------------------

  private poseOf(part: RagdollPart, alpha: number): Pose {
    const p = part.body.getPosition();
    const a = part.body.getAngle();
    return {
      x: lerp(part.prevX, p.x, alpha),
      y: lerp(part.prevY, p.y, alpha),
      a: part.prevA + wrapAngle(a - part.prevA) * alpha,
    };
  }

  private lerpPos(px: number, py: number, x: number, y: number, t: number): Pose {
    return { x: lerp(px, x, t), y: lerp(py, y, t), a: 0 };
  }

  private drawCharacter(r: Ragdoll, alpha: number, time: number): void {
    if (r.state === 'dead' && r.corpseTimer <= 0) return;
    const ctx = this.ctx;
    const fill = r.team === 'player' ? PLAYER_FILL : enemyFill(r);
    const fade = r.state === 'dead' ? Math.min(1, r.corpseTimer / 1.2) : 1;
    ctx.globalAlpha = fade;

    const poses = new Map<PartName, Pose>();
    for (const spec of PART_SPECS) {
      const part = r.parts.get(spec.name);
      if (part) poses.set(spec.name, this.poseOf(part, alpha));
    }

    // Outline pass.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const spec of PART_SPECS) {
      this.drawPart(spec, poses.get(spec.name)!, INK, OUTLINE);
    }

    // Fill pass.
    for (const spec of PART_SPECS) {
      const part = r.parts.get(spec.name)!;
      const col = part.flash > 0 ? FLASH_FILL : fill;
      this.drawPart(spec, poses.get(spec.name)!, col, 0);
    }

    // Slime coat: a translucent sheen over the body, plus blobs.
    if (r.slimeTimer > 0) {
      const sheen = Math.min(1, (r.slimeTimer / Math.max(0.1, r.slimeMax)) * 2) * 0.35;
      for (const spec of PART_SPECS) {
        this.drawPart(spec, poses.get(spec.name)!, `rgba(141,255,90,${sheen.toFixed(3)})`, 0);
      }
      for (const blob of r.blobs) {
        const pose = poses.get(blob.part);
        if (!pose) continue;
        const w = localToWorld(pose, blob.x, blob.y);
        ctx.globalAlpha = fade * Math.min(1, r.slimeTimer / 0.5) * 0.9;
        ctx.fillStyle = SLIME_COLOR;
        ctx.beginPath();
        ctx.arc(w.x, w.y, blob.r, 0, TAU);
        ctx.fill();
        ctx.lineWidth = OUTLINE * 0.8;
        ctx.strokeStyle = '#4a9a2e';
        ctx.stroke();
        ctx.globalAlpha = fade;
      }
    }

    // Joints: dark pins at every connection.
    ctx.fillStyle = INK;
    for (const js of JOINT_SPECS) {
      const pp = poses.get(js.parent);
      if (!pp) continue;
      const w = localToWorld(pp, js.parentAnchor.x, js.parentAnchor.y);
      ctx.beginPath();
      ctx.arc(w.x, w.y, 0.042, 0, TAU);
      ctx.fill();
    }

    // Head: eyes and mouth, facing the character's direction.
    const head = poses.get('head');
    if (head) this.drawFace(r, head, time);

    ctx.globalAlpha = 1;
  }

  /**
   * Draw one body part in its local frame. `grow` widens the shape: the outline
   * pass uses OUTLINE, the fill pass uses 0, so the outline shows around the fill.
   */
  private drawPart(spec: PartSpec, pose: Pose, color: string, grow: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.a);
    if (spec.box) {
      ctx.beginPath();
      ctx.roundRect(-spec.box.hx - grow, -spec.box.hy - grow, 2 * (spec.box.hx + grow), 2 * (spec.box.hy + grow), 0.03 + grow);
      ctx.fillStyle = color;
      ctx.fill();
    } else if (spec.circle) {
      ctx.beginPath();
      ctx.arc(0, 0, spec.radius + grow, 0, TAU);
      ctx.fillStyle = color;
      ctx.fill();
    } else if (spec.a && spec.b) {
      ctx.beginPath();
      ctx.moveTo(spec.a.x, spec.a.y);
      ctx.lineTo(spec.b.x, spec.b.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * (spec.radius + grow);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFace(r: Ragdoll, head: Pose, time: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(head.a);
    const fx = r.facing * 0.06;
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 0.02;
    if (r.dazed) {
      // Dazed: spinning-looking X eyes.
      const wob = Math.sin(time * 14) * 0.01;
      for (const ex of [fx - 0.04, fx + 0.06]) {
        ctx.beginPath();
        ctx.moveTo(ex - 0.025 + wob, -0.005 - 0.025);
        ctx.lineTo(ex + 0.025 + wob, -0.005 + 0.025);
        ctx.moveTo(ex + 0.025 + wob, -0.005 - 0.025);
        ctx.lineTo(ex - 0.025 + wob, -0.005 + 0.025);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(fx - 0.02, -0.09);
      ctx.lineTo(fx + 0.04, -0.09);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(fx - 0.04, 0.0, 0.026, 0, TAU);
      ctx.arc(fx + 0.06, 0.0, 0.026, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fx + 0.01, -0.07, 0.05, 0.25, Math.PI - 0.25);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Each character's launcher, in the hand. The player's design follows the equipped weapon. */
  private drawLaunchers(s: Scene): void {
    for (const r of [s.player, ...s.enemies]) {
      if (r.state === 'dead') continue;
      const frontLower = r.facing > 0 ? 'lowerArmR' : 'lowerArmL';
      const part = r.parts.get(frontLower);
      if (!part) continue;
      const pose = this.poseOf(part, s.alpha);
      const hand = localToWorld(pose, 0, -0.14);
      const dir = r.aimPhi !== null ? { x: Math.sin(r.aimPhi), y: -Math.cos(r.aimPhi) } : { x: r.facing, y: -0.3 };
      const len = Math.hypot(dir.x, dir.y) || 1;
      const unit = { x: dir.x / len, y: dir.y / len };
      if (r === s.player && s.playerLauncher.kind === 'hand') {
        // Bare hands: no launcher, the blob sits in the palm along the forearm.
        const arm = { x: Math.sin(pose.a), y: -Math.cos(pose.a) };
        this.drawHandBlob(s, hand, arm);
        continue;
      }
      drawLauncher(this.ctx, r === s.player ? s.playerLauncher : ENEMY_LAUNCHER, hand, unit);
    }
  }

  // ---- Projectiles and particles -----------------------------------------

  private drawProjectileTrails(s: Scene): void {
    const ctx = this.ctx;
    for (const p of s.projectiles) {
      const n = p.trail.length;
      for (let i = 0; i < n; i++) {
        const t = (i + 1) / n;
        const q = p.trail[i];
        ctx.globalAlpha = 0.35 * t;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(q.x, q.y, p.radius * (0.25 + 0.6 * t), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Each projectile in its own design: the look comes from its shot. */
  private drawProjectiles(s: Scene): void {
    for (const p of s.projectiles) {
      if (!p.alive) continue;
      const pos = this.lerpPos(p.prevX, p.prevY, p.body.getPosition().x, p.body.getPosition().y, s.alpha);
      const v = p.body.getLinearVelocity();
      const angle = Math.atan2(v.y, v.x);
      const ctx = this.ctx;
      ctx.save();
      if (!RIGID_LOOKS.has(p.shot.look)) {
        // Jelly in flight: stretch along the velocity with speed, plus two out-of-phase
        // wobbles. Width shrinks as length grows, so the blob keeps its volume.
        const speed = Math.hypot(v.x, v.y);
        const wob = 0.16 * Math.sin(s.time * 17 + p.seed) + 0.07 * Math.sin(s.time * 29 + p.seed * 2.3);
        const sx = 1 + Math.min(0.4, speed * 0.018) + wob;
        const sy = 1 / sx;
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);
        ctx.scale(sx, sy);
        ctx.rotate(-angle);
        ctx.translate(-pos.x, -pos.y);
      }
      drawShot(ctx, {
        look: p.shot.look,
        color: p.color,
        r: p.radius * PROJECTILE_ART_SCALE,
        x: pos.x,
        y: pos.y,
        angle,
        time: s.time,
        seed: p.seed,
        fuse: p.fuseLeft,
      });
      ctx.restore();
    }
  }

  private drawParticles(s: Scene): void {
    const ctx = this.ctx;
    for (const p of s.effects.particles) {
      if (!p.alive) continue;
      const t = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * t), 0, TAU);
      ctx.fill();
    }
    // KO shockwaves: a ring that races outward and thins as it fades.
    for (const w of s.effects.shockwaves) {
      const k = 1 - w.life / w.maxLife;
      const ease = 1 - (1 - k) * (1 - k);
      ctx.globalAlpha = 0.85 * (1 - k);
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 0.22 * (1 - k) + 0.03;
      ctx.beginPath();
      ctx.arc(w.x, w.y, 0.2 + w.maxR * ease, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- Aim preview -------------------------------------------------------

  private drawAimPreview(s: Scene): void {
    const ctx = this.ctx;
    const aim = s.aim;
    if (!aim.active || aim.path.length === 0) return;
    const n = aim.path.length;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const q = aim.path[i];
      ctx.globalAlpha = 0.95 - 0.6 * t;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(q.x, q.y, 0.075 - 0.03 * t, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(29,38,56,0.7)';
      ctx.lineWidth = 0.015;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (aim.landing) {
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(aim.landing.x, aim.landing.y, 0.32, 0, TAU);
      ctx.stroke();
    }
  }

  // ---- Screen-space overlays ---------------------------------------------

  private drawHealthBars(s: Scene): void {
    const ctx = this.ctx;
    const all = [s.player, ...s.enemies];
    for (const r of all) {
      if (!r.alive) continue;
      const head = r.headPosition();
      const pt = s.camera.toScreen({ x: head.x, y: head.y + 0.5 });
      const w = 64;
      const h = 8;
      const frac = Math.max(0, r.hp / r.maxHp);
      ctx.fillStyle = 'rgba(20,28,44,0.75)';
      roundRectScreen(ctx, pt.x - w / 2 - 2, pt.y - h / 2 - 2, w + 4, h + 4, 5);
      ctx.fill();
      ctx.fillStyle = r.team === 'player' ? '#6dff8a' : '#ff6b6b';
      roundRectScreen(ctx, pt.x - w / 2, pt.y - h / 2, Math.max(0.5, w * frac), h, 4);
      ctx.fill();
    }
  }

  private drawFloatingText(s: Scene): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of s.effects.texts) {
      if (!t.alive) continue;
      const pt = s.camera.toScreen({ x: t.x, y: t.y });
      const a = Math.max(0, t.life / t.maxLife);
      // Big texts pop in: scale overshoots to ~1.35 in the first 0.15 s, then settles.
      const age = t.maxLife - t.life;
      const pop = t.size > 24 ? 1 + 0.35 * Math.sin(Math.min(1, age / 0.15) * Math.PI) * Math.max(0, 1 - age / 0.3) : 1;
      const size = Math.round(t.size * pop);
      ctx.globalAlpha = Math.min(1, a * 1.6);
      ctx.font = `800 ${size}px "Baloo 2", system-ui, sans-serif`;
      ctx.lineWidth = Math.max(4, size * 0.22);
      ctx.strokeStyle = 'rgba(20,28,44,0.85)';
      ctx.strokeText(t.text, pt.x, pt.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, pt.x, pt.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  private drawDragOverlay(s: Scene): void {
    const ctx = this.ctx;
    const aim = s.aim;
    if (!aim.anchor || !aim.pointer) return;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(aim.anchor.x, aim.anchor.y);
    ctx.lineTo(aim.pointer.x, aim.pointer.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(aim.anchor.x, aim.anchor.y, 22, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();

    // Power meter, drawn next to the launcher hand.
    const hand = this.handScreen(s);
    if (hand && aim.active) {
      const bw = 90;
      const bh = 10;
      const x = hand.x - bw / 2;
      const y = hand.y + 24;
      ctx.fillStyle = 'rgba(20,28,44,0.7)';
      roundRectScreen(ctx, x - 3, y - 3, bw + 6, bh + 6, 7);
      ctx.fill();
      const grad = ctx.createLinearGradient(x, 0, x + bw, 0);
      grad.addColorStop(0, '#8dff5a');
      grad.addColorStop(0.6, '#ffe066');
      grad.addColorStop(1, '#ff6b6b');
      ctx.fillStyle = grad;
      roundRectScreen(ctx, x, y, Math.max(2, bw * aim.power), bh, 5);
      ctx.fill();
    }
  }

  private handScreen(s: Scene): { x: number; y: number } | null {
    const part = s.player.parts.get('lowerArmR');
    if (!part) return null;
    const pose = this.poseOf(part, s.alpha);
    const hand = localToWorld(pose, 0, -0.14);
    return s.camera.toScreen(hand);
  }
}

function enemyFill(r: Ragdoll): string {
  const palette = ['#ff8a7a', '#b99bff', '#ffd166', '#7ad9ff'];
  return palette[r.id % palette.length];
}

/** Overshoots past 1 and settles back: a springy pop for new pieces. */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const k = Math.min(1, Math.max(0, t));
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}

/** A #rrggbb colour with an alpha. */
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

function localToWorld(pose: Pose, lx: number, ly: number): { x: number; y: number } {
  const c = Math.cos(pose.a);
  const s = Math.sin(pose.a);
  return { x: pose.x + c * lx - s * ly, y: pose.y + s * lx + c * ly };
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapAngle(b - a) * t;
}

function roundRectScreen(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
