import { ARENA } from '../config';
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
  aim: AimView;
  time: number;
  alpha: number;
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
    this.drawPuddles(s);
    this.drawObjects(s);
    this.drawProjectileTrails(s);
    this.drawCharacter(s.player, s.alpha, s.time);
    for (const e of s.enemies) this.drawCharacter(e, s.alpha, s.time);
    this.drawLaunchers(s);
    this.drawProjectiles(s);
    this.drawParticles(s);
    this.drawAimPreview(s);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawHealthBars(s);
    this.drawFloatingText(s);
    this.drawDragOverlay(s);
  }

  // ---- Screen-space background -------------------------------------------

  private drawSky(camX: number): void {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#7cc8f5');
    sky.addColorStop(0.62, '#c9ecff');
    sky.addColorStop(1, '#eef9ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Two layers of rolling hills, moving slower than the ground for parallax.
    this.hillLayer(w, h, camX * 6, h * 0.66, 0.085, '#a8e3c4', 0.9);
    this.hillLayer(w, h, camX * 14, h * 0.74, 0.12, '#7fd1a5', 1.1);
  }

  private hillLayer(w: number, h: number, offset: number, baseY: number, amp: number, color: string, freq: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 8; x += 8) {
      const y = baseY - Math.sin((x + offset) * 0.012 * freq) * h * amp - Math.sin((x + offset) * 0.031) * h * amp * 0.25;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // ---- World: terrain, puddles, objects ----------------------------------

  private drawTerrain(s: Scene): void {
    const ctx = this.ctx;
    // The pit beyond the floor's edges, so a fall out of the arena is readable.
    ctx.fillStyle = '#2e3c5c';
    ctx.fillRect(-60, -40, 120, 40);

    // Earth under the floor: a deeper layer, then a lighter top band.
    ctx.fillStyle = '#b98a57';
    ctx.fillRect(-ARENA.halfWidth, -40, ARENA.halfWidth * 2, 40);
    ctx.fillStyle = '#dcb582';
    ctx.fillRect(-ARENA.halfWidth, -1.4, ARENA.halfWidth * 2, 1.4);
    // Grass lip on the floor.
    ctx.fillStyle = '#6fca68';
    ctx.fillRect(-ARENA.halfWidth, -0.22, ARENA.halfWidth * 2, 0.22);
    ctx.fillStyle = '#4fae4f';
    ctx.fillRect(-ARENA.halfWidth, -0.04, ARENA.halfWidth * 2, 0.04);

    for (const p of s.arena.platforms) {
      const top = p.topY;
      const h = 0.6;
      ctx.fillStyle = '#e8d6b2';
      ctx.beginPath();
      ctx.roundRect(p.minX, top - h, p.maxX - p.minX, h, 0.12);
      ctx.fill();
      ctx.lineWidth = OUTLINE * 1.4;
      ctx.strokeStyle = '#8a6a45';
      ctx.stroke();
      ctx.fillStyle = '#6fca68';
      ctx.beginPath();
      ctx.roundRect(p.minX - 0.03, top - 0.16, p.maxX - p.minX + 0.06, 0.16, 0.08);
      ctx.fill();
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
      ctx.fillStyle = SLIME_COLOR;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 0.02, rx, ry, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = OUTLINE;
      ctx.strokeStyle = '#4a9a2e';
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
        ctx.fillStyle = '#d19a5b';
        ctx.fillRect(-h, -h, 2 * h, 2 * h);
        ctx.strokeStyle = '#6b4424';
        ctx.lineWidth = OUTLINE * 1.3;
        ctx.strokeRect(-h, -h, 2 * h, 2 * h);
        ctx.beginPath();
        ctx.moveTo(-h, -h);
        ctx.lineTo(h, h);
        ctx.moveTo(h, -h);
        ctx.lineTo(-h, h);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ff8a5c';
        ctx.beginPath();
        ctx.arc(0, 0, o.size, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#8a3d20';
        ctx.lineWidth = OUTLINE * 1.3;
        ctx.stroke();
        ctx.fillStyle = '#fff1e6';
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

  private drawLaunchers(s: Scene): void {
    const ctx = this.ctx;
    const all = [s.player, ...s.enemies];
    for (const r of all) {
      if (r.state === 'dead') continue;
      const frontLower = r.facing > 0 ? 'lowerArmR' : 'lowerArmL';
      const part = r.parts.get(frontLower);
      if (!part) continue;
      const pose = this.poseOf(part, s.alpha);
      const hand = localToWorld(pose, 0, -0.14);
      const dir = r.aimPhi !== null ? { x: Math.sin(r.aimPhi), y: -Math.cos(r.aimPhi) } : { x: r.facing, y: -0.3 };
      const len = Math.hypot(dir.x, dir.y) || 1;
      const dx = dir.x / len;
      const dy = dir.y / len;
      const back = { x: hand.x - dx * 0.16, y: hand.y - dy * 0.16 };
      const front = { x: hand.x + dx * 0.5, y: hand.y + dy * 0.5 };

      ctx.lineCap = 'round';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.15;
      ctx.beginPath();
      ctx.moveTo(back.x, back.y);
      ctx.lineTo(front.x, front.y);
      ctx.stroke();
      ctx.strokeStyle = r.team === 'player' ? '#4f6fa8' : '#7a4a4a';
      ctx.lineWidth = 0.1;
      ctx.stroke();
      // Slime tank on the back of the launcher.
      ctx.fillStyle = SLIME_COLOR;
      ctx.beginPath();
      ctx.arc(hand.x - dx * 0.12 + dy * 0.1, hand.y - dy * 0.12 - dx * 0.1, 0.07, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.02;
      ctx.stroke();
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

  private drawProjectiles(s: Scene): void {
    const ctx = this.ctx;
    for (const p of s.projectiles) {
      if (!p.alive) continue;
      const pos = this.lerpPos(p.prevX, p.prevY, p.body.getPosition().x, p.body.getPosition().y, s.alpha);
      const v = p.body.getLinearVelocity();
      const speed = Math.hypot(v.x, v.y);
      const stretch = Math.min(0.28, speed * 0.012);
      const wobble = 1 + 0.06 * Math.sin(s.time * 20 + p.seed);
      const angle = Math.atan2(v.y, v.x);
      const r = p.radius * wobble;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * (1 + stretch), r * (1 - stretch * 0.5), 0, 0, TAU);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = '#243318';
      ctx.lineWidth = OUTLINE;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(-r * 0.3, r * 0.3, r * 0.3, 0, TAU);
      ctx.fill();
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
      ctx.globalAlpha = a;
      ctx.font = '800 18px "Baloo 2", system-ui, sans-serif';
      ctx.lineWidth = 4;
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
