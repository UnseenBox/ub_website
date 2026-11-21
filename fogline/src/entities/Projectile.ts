import Phaser from 'phaser';
import { project } from '../game/perspective';
import { DEPTH } from '../game/depths';

interface Shell {
  img: Phaser.GameObjects.Image;
  active: boolean;
  t: number;
  dur: number;
  x0: number; y0: number;
  tx: number; tz: number;
  x1: number; y1: number;
  arc: number;
  endScale: number;
  damage: number;
  radius: number;
  impactSound: string;
}

/**
 * Pooled 40mm grenades. Flight is animated in screen space from the muzzle to
 * the projected target with a lob arc; impact calls back with world coords.
 */
export class ProjectileManager {
  private shells: Shell[] = [];
  onImpact: (x: number, z: number, radius: number, damage: number, impactSound: string) => void = () => {};

  constructor(private readonly scene: Phaser.Scene) {
    for (let i = 0; i < 12; i++) this.shells.push(this.make());
  }

  private make(): Shell {
    const img = this.scene.add.image(0, 0, 'grenade').setDepth(DEPTH.tracer).setVisible(false);
    return { img, active: false, t: 0, dur: 1, x0: 0, y0: 0, tx: 0, tz: 0, x1: 0, y1: 0, arc: 0, endScale: 1, damage: 0, radius: 0, impactSound: 'explosion_small' };
  }

  launch(fromX: number, fromY: number, tx: number, tz: number, speed: number, damage: number, radius: number, impactSound = 'explosion_small'): void {
    const s = this.shells.find((q) => !q.active) ?? this.make();
    if (!this.shells.includes(s)) this.shells.push(s);
    const p = project(tx, tz);
    s.active = true;
    s.t = 0;
    s.dur = Phaser.Math.Clamp(tz / speed, 0.12, 2.2);
    s.x0 = fromX; s.y0 = fromY;
    s.tx = tx; s.tz = tz;
    s.x1 = p.sx; s.y1 = p.sy - 0.2 * p.ppm;
    s.arc = Phaser.Math.Clamp(tz * 2.2, 10, 120);
    s.endScale = Phaser.Math.Clamp(p.ppm / 60, 0.08, 1.2);
    s.damage = damage;
    s.radius = radius;
    s.impactSound = impactSound;
    s.img.setVisible(true).setPosition(fromX, fromY).setScale(1.4);
  }

  update(dt: number): void {
    for (const s of this.shells) {
      if (!s.active) continue;
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      // ease toward the target so it shrinks into the distance believably
      const e = 1 - Math.pow(1 - k, 1.6);
      const x = s.x0 + (s.x1 - s.x0) * e;
      const y = s.y0 + (s.y1 - s.y0) * e - Math.sin(k * Math.PI) * s.arc;
      s.img.setPosition(x, y).setScale(1.4 + (s.endScale - 1.4) * e).setRotation(s.t * 18);
      if (k >= 1) {
        s.active = false;
        s.img.setVisible(false);
        this.onImpact(s.tx, s.tz, s.radius, s.damage, s.impactSound);
      }
    }
  }

  clear(): void {
    for (const s of this.shells) {
      s.active = false;
      s.img.setVisible(false);
    }
  }
}
