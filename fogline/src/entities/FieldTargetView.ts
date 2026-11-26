import Phaser from 'phaser';
import { project } from '../game/perspective';
import type { FieldTarget } from '../systems/ObjectiveState';
import { depthForZ } from './Zombie';

/** Height on screen in metres, and texture, for each kind of field target. */
const LOOK: Record<FieldTarget['kind'], { key: string; heightM: number }> = {
  mast: { key: 'asset_mast', heightM: 7.5 },
  fuel: { key: 'asset_fuel', heightM: 4.2 },
  wreck: { key: 'asset_wreck', heightM: 3.6 },
  generator: { key: 'asset_generator', heightM: 3.4 },
  train: { key: 'asset_train', heightM: 3.8 },
  bus: { key: 'asset_bus', heightM: 3.3 },
  truck: { key: 'asset_truck', heightM: 3.2 },
  nest: { key: 'asset_nest', heightM: 3.4 },
};

interface Sprite {
  target: FieldTarget;
  img: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  flash: number;
  /** Seconds a destroyed target stays on screen (buses burn out and fade). */
  wreck: number;
}

/**
 * Draws the mission's field targets in the world: projected by distance, depth-sorted
 * with the zombies, with a health bar and name above, a red flash when hit, and a
 * charred wreck when destroyed.
 */
export class FieldTargetView {
  private sprites = new Map<number, Sprite>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Keep sprites in step with the objective's targets. */
  sync(targets: FieldTarget[], dt: number): void {
    for (const t of targets) {
      let s = this.sprites.get(t.id);
      if (!s) {
        if (!t.alive) continue;
        s = this.create(t);
        this.sprites.set(t.id, s);
      }
      this.place(s, dt);
    }
    for (const [id, s] of this.sprites) {
      const moving = s.target.kind === 'bus' || s.target.kind === 'truck' || s.target.kind === 'train' || s.target.kind === 'nest';
      if (!targets.includes(s.target) || (moving && !s.target.alive && s.wreck <= 0)) {
        s.img.destroy();
        s.bar.destroy();
        s.label.destroy();
        this.sprites.delete(id);
      }
    }
  }

  hit(t: FieldTarget): void {
    const s = this.sprites.get(t.id);
    if (s) s.flash = 0.12;
  }

  /** Screen point at the middle of a target (for explosions and text). */
  centre(t: FieldTarget): { x: number; y: number } {
    const p = project(t.x, t.z);
    return { x: p.sx, y: p.sy - LOOK[t.kind].heightM * p.ppm * 0.5 };
  }

  private create(t: FieldTarget): Sprite {
    const look = LOOK[t.kind];
    const img = this.scene.add.image(0, 0, look.key).setOrigin(0.5, 1);
    const bar = this.scene.add.graphics();
    const label = this.scene.add.text(0, 0, t.name, {
      fontFamily: '"Saira", sans-serif', fontSize: '12px', color: '#e8e0c0', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 1);
    return { target: t, img, bar, label, flash: 0, wreck: 2.5 };
  }

  private place(s: Sprite, dt: number): void {
    const t = s.target;
    const look = LOOK[t.kind];
    const p = project(t.x, t.z);
    const tex = s.img.texture.getSourceImage() as HTMLCanvasElement;
    const scale = (look.heightM * p.ppm) / tex.height;
    const depth = depthForZ(t.z) + 0.01;
    s.img.setPosition(p.sx, p.sy + 2 * scale).setScale(scale).setDepth(depth);
    s.flash = Math.max(0, s.flash - dt);
    if (!t.alive) {
      if (t.kind === 'bus' || t.kind === 'truck' || t.kind === 'train' || t.kind === 'nest') {
        s.wreck -= dt;
        s.img.setAlpha(Math.max(0, Math.min(1, s.wreck / 1.2)));
      }
      s.img.setTint(0x3a3430);
      s.bar.clear();
      s.label.setVisible(false);
      return;
    }
    s.img.setTint(s.flash > 0 ? 0xff8070 : 0xffffff);
    // Keep the bar and name on screen even for a tall target.
    const top = Math.max(60, p.sy - look.heightM * p.ppm - 8);
    const w = Math.max(60, Math.min(160, 3.2 * p.ppm));
    const f = t.hp / t.max;
    s.bar.clear().setDepth(depth + 0.001);
    s.bar.fillStyle(0x000000, 0.7).fillRect(p.sx - w / 2 - 1, top - 1, w + 2, 8);
    s.bar.fillStyle(f > 0.5 ? 0x5fae3c : f > 0.25 ? 0xc8a830 : 0xc83a28, 1).fillRect(p.sx - w / 2, top, w * f, 6);
    s.label.setPosition(p.sx, top - 3).setDepth(depth + 0.002).setVisible(true);
  }

  clear(): void {
    for (const s of this.sprites.values()) {
      s.img.destroy();
      s.bar.destroy();
      s.label.destroy();
    }
    this.sprites.clear();
  }
}
