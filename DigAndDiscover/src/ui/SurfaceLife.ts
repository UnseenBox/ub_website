import Phaser from 'phaser';
import { TAU, makeCanvasTexture } from '../art/paint';

/** Where the painted backdrop sits in field coordinates, so life can be placed by picture position. */
export interface BackdropFrame {
  x: number;
  /** Field y of the picture's bottom edge. */
  bottom: number;
  width: number;
  height: number;
}

interface Bird {
  img: Phaser.GameObjects.Image;
  vx: number;
  baseY: number;
  phase: number;
  flap: number;
  speed: number;
}

/**
 * A little life above the ground, kept deliberately light: birds crossing the sky, smoke curling
 * from the chimney and petals blowing across the meadow on the wind. Pure decoration - a few
 * sprites and two tiny particle emitters.
 */
export class SurfaceLife {
  private readonly birds: Bird[] = [];
  private nextFlock = 2500;
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly frame: BackdropFrame,
  ) {
    makeCanvasTexture(scene.textures, 'bird0', 36, 20, (ctx) => paintBird(ctx, true));
    makeCanvasTexture(scene.textures, 'bird1', 36, 20, (ctx) => paintBird(ctx, false));
    makeCanvasTexture(scene.textures, 'petal', 14, 10, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(7, 5, 6, 3.6, 0.4, 0, TAU);
      ctx.fill();
    });
    this.buildSmoke();
    this.buildPetals();
  }

  /** Picture position (0..1 across, 0..1 down) to field coordinates. */
  private at(u: number, v: number): { x: number; y: number } {
    const f = this.frame;
    return { x: f.x + u * f.width, y: f.bottom - (1 - v) * f.height };
  }

  private buildSmoke(): void {
    const p = this.at(0.395, 0.335);
    const smoke = this.scene.add.particles(p.x, p.y, 'soft', {
      frequency: 650,
      lifespan: 4200,
      speedY: { min: -22, max: -14 },
      speedX: { min: 4, max: 14 },
      scale: { start: 0.35, end: 1.5 },
      alpha: { start: 0.5, end: 0 },
      tint: 0xf4f6fb,
    });
    this.layer.add(smoke);
  }

  private buildPetals(): void {
    const left = this.at(-0.02, 0.5);
    const top = this.at(0, 0.5).y;
    const bottom = this.at(0, 0.8).y;
    const petals = this.scene.add.particles(left.x, top, 'petal', {
      frequency: 900,
      lifespan: 11000,
      speedX: { min: 36, max: 64 },
      speedY: { min: -4, max: 10 },
      gravityY: 3,
      rotate: { start: 0, end: 540 },
      scale: { min: 0.55, max: 1 },
      alpha: { values: [0, 0.9, 0.9, 0] },
      tint: [0xffd1e0, 0xffffff, 0xfff1b0, 0xe6d4ff],
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, 4, bottom - top) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    });
    this.layer.add(petals);
  }

  private spawnFlock(): void {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const count = 1 + Math.floor(Math.random() * 3);
    const v = 0.1 + Math.random() * 0.28;
    const speed = 38 + Math.random() * 34;
    const startX = dir > 0 ? this.frame.x - 50 : this.frame.x + this.frame.width + 50;
    const lead = this.at(0, v).y;
    for (let i = 0; i < count; i++) {
      const img = this.scene.add.image(startX - dir * i * 34, lead + i * 9 - (i % 2) * 18, 'bird0');
      img.setAlpha(0.88).setScale(dir > 0 ? 0.8 : -0.8, 0.8);
      this.layer.add(img);
      this.birds.push({ img, vx: dir * speed, baseY: img.y, phase: Math.random() * TAU, flap: Math.random() * 300, speed });
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.nextFlock -= dt;
    if (this.nextFlock <= 0) {
      this.spawnFlock();
      this.nextFlock = 7000 + Math.random() * 9000;
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.flap += dt;
      b.img.x += (b.vx * dt) / 1000;
      b.img.y = b.baseY + Math.sin(this.time / 900 + b.phase) * 6;
      b.img.setTexture(Math.floor(b.flap / 140) % 2 === 0 ? 'bird0' : 'bird1');
      const out = b.vx > 0 ? b.img.x > this.frame.x + this.frame.width + 70 : b.img.x < this.frame.x - 70;
      if (out) {
        b.img.destroy();
        this.birds.splice(i, 1);
      }
    }
  }
}

/** A tiny bird seen from afar: two curved strokes, wings up or wings down. */
function paintBird(ctx: CanvasRenderingContext2D, up: boolean): void {
  ctx.strokeStyle = '#26324d';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (up) {
    ctx.moveTo(3, 3);
    ctx.quadraticCurveTo(11, 4, 18, 14);
    ctx.quadraticCurveTo(25, 4, 33, 3);
  } else {
    ctx.moveTo(3, 15);
    ctx.quadraticCurveTo(11, 8, 18, 12);
    ctx.quadraticCurveTo(25, 8, 33, 15);
  }
  ctx.stroke();
}
