// A puppet on screen: one image per part, posed from the creature's animation. Changes of
// action are cross-faded so a walk never snaps into an attack, and the hit shapes and effect
// points ride on the same parts the player sees.

import Phaser from 'phaser';
import { atlasKey } from './index';
import { clamp01, lerp, pointOn, skeletonOrder, solve, wrap, type Solved } from './solve';
import type { ActionState, Creature, Placed, RigPart } from './types';

/** Seconds over which one action fades into the next. */
const BLEND = 0.16;
const GLOW_TEXTURE = 'fx_puppet_glow';

export interface HitOut {
  ax: number; ay: number; bx: number; by: number; r: number; zone: 'head' | 'torso' | 'legs';
}

/** Paints the soft round glow once. */
function glowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(GLOW_TEXTURE)) return;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  scene.textures.addCanvas(GLOW_TEXTURE, canvas);
}

/** The action a state is in: a change of it starts a cross-fade. */
function actionOf(s: ActionState): string {
  if (s.death >= 0) return 'death';
  if (s.attack >= 0) return 'attack';
  if (s.channel >= 0) return 'channel';
  if (s.release >= 0) return 'release';
  return s.moving > 0 ? 'walk' : 'idle';
}

export class PuppetBody {
  /** Part images, back to front. */
  readonly images: Phaser.GameObjects.Image[] = [];
  /** Glows, drawn over the parts. */
  readonly glows: Phaser.GameObjects.Image[] = [];
  readonly height: number;
  readonly halfWidth: number;
  private readonly order: RigPart[];
  private readonly byName: Map<string, RigPart>;
  private readonly parts = new Map<string, Phaser.GameObjects.Image>();
  private shown: Solved | null = null;
  private from: Solved | null = null;
  private action = '';
  private blend = 1;
  private last = 0;

  constructor(scene: Phaser.Scene, private readonly creature: Creature, look: string) {
    const rig = creature.rig;
    this.height = rig.height;
    this.halfWidth = creature.halfWidth;
    this.order = skeletonOrder(rig);
    this.byName = new Map(this.order.map((p) => [p.name, p]));
    const key = atlasKey(look);
    const texture = scene.textures.get(key);
    for (const part of [...rig.parts].sort((a, b) => a.z - b.z)) {
      const [x, y, w, h] = part.frame;
      if (!texture.has(part.name)) texture.add(part.name, 0, x, y, w, h);
      const image = scene.add.image(0, 0, key, part.name)
        .setOrigin((part.pivot[0] - part.offset[0]) / w, (part.pivot[1] - part.offset[1]) / h);
      this.images.push(image);
      this.parts.set(part.name, image);
    }
    if (creature.glows?.length) {
      glowTexture(scene);
      for (const glow of creature.glows) {
        this.glows.push(scene.add.image(0, 0, GLOW_TEXTURE).setBlendMode(Phaser.BlendModes.ADD).setTint(glow.colour));
      }
    }
  }

  reset(): void {
    this.shown = this.from = null;
    this.action = '';
    this.blend = 1;
    this.last = 0;
  }

  pose(s: ActionState): void {
    const dt = Math.max(0, Math.min(0.1, s.time - this.last));
    this.last = s.time;
    const target = solve(this.creature.rig, this.creature.animate(s), this.order);
    const action = actionOf(s);
    if (action !== this.action) {
      this.from = this.shown;
      this.blend = this.from ? 0 : 1;
      this.action = action;
    }
    this.blend = Math.min(1, this.blend + dt / BLEND);
    let out = target;
    if (this.from && this.blend < 1) {
      const t = this.blend * this.blend * (3 - 2 * this.blend);
      out = new Map();
      for (const [name, b] of target) {
        const a: Placed = this.from.get(name) ?? b;
        out.set(name, {
          x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), r: a.r + wrap(b.r - a.r) * t,
          k: lerp(a.k, b.k, t), sx: lerp(a.sx, b.sx, t), sy: lerp(a.sy, b.sy, t), a: lerp(a.a, b.a, t),
        });
      }
    }
    this.shown = out;
    for (const [name, image] of this.parts) {
      const p = out.get(name)!;
      image.setPosition(p.x, p.y).setRotation(p.r).setScale(p.k * p.sx, p.k * p.sy).setAlpha(clamp01(p.a));
    }
    this.creature.glows?.forEach((glow, i) => {
      const p = out.get(glow.part)!;
      const [x, y] = pointOn(this.byName.get(glow.part)!, p, glow.at);
      const dead = s.death >= 0 ? clamp01(1 - s.death * 1.6) : 1;
      const flare = s.channel >= 0 || s.attack >= 0 ? 0.3 : 0;
      this.glows[i].setPosition(x, y).setScale((glow.r * p.k * (1 + flare)) / 64)
        .setAlpha(clamp01((0.62 + 0.2 * Math.sin(s.time * 5 + i) + flare) * dead * p.a));
    });
  }

  /** Where a part's rest point is now, in figure units. */
  private point(part: string, at: number[]): [number, number] {
    const rest = this.byName.get(part)!;
    const placed = this.shown?.get(part) ?? { x: rest.pivot[0], y: rest.pivot[1], r: 0, k: 1, sx: 1, sy: 1, a: 1 };
    return pointOn(rest, placed, at);
  }

  /** A named spot (mouth, claw, ...), or the head if the creature has none by that name. */
  anchor(name: string): [number, number] {
    const a = this.creature.anchors[name] ?? this.creature.head;
    return this.point(a.part, a.at);
  }

  /** Writes the seven hit shapes and the head circle where the parts are now. */
  hitShapes(shapes: HitOut[], head: { x: number; y: number; r: number }): void {
    this.creature.hits.forEach((hit, i) => {
      const k = this.shown?.get(hit.part)?.k ?? 1;
      const [ax, ay] = this.point(hit.part, hit.a);
      const [bx, by] = this.point(hit.part, hit.b);
      const out = shapes[i];
      out.ax = ax;
      out.ay = ay;
      out.bx = bx;
      out.by = by;
      out.r = hit.r * k;
      out.zone = hit.zone;
    });
    const h = this.creature.head;
    [head.x, head.y] = this.point(h.part, h.at);
    head.r = h.r * (this.shown?.get(h.part)?.k ?? 1);
  }

  tint(color: number): void {
    for (const image of this.images) image.setTint(color);
  }
}
