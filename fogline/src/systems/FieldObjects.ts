import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { project } from '../game/perspective';
import { depthForZ } from '../entities/Zombie';
import { Shootable, Shootables } from './Shootables';

/** What a claimed supply crate gives. */
export type DropReward = 'cash' | 'support' | 'mod' | 'ammo';

interface Crate {
  shot: Shootable;
  lift: number;
  landedLeft: number;
  img: Phaser.GameObjects.Image;
  chute: Phaser.GameObjects.Image;
}

interface Drum {
  shot: Shootable;
  img: Phaser.GameObjects.Image;
}

/** Seconds from appearing to landing, and how long a landed crate waits before the dead take it. */
const FALL_TIME = 7;
const LANDED_TIME = 5;
const DROP_HEIGHT = 16;

/**
 * Supply drops (crates under parachutes: shoot them before the dead reach them) and
 * explosive fuel drums (shoot one to blow up the dead around it).
 */
export class FieldObjects {
  private crates: Crate[] = [];
  private drums: Drum[] = [];
  private dropTimer: number;
  /** A crate was shot: the battle pays out. */
  onClaim: (reward: DropReward, x: number, y: number) => void = () => {};
  /** A drum went off: the battle deals the blast. */
  onDrum: (x: number, z: number) => void = () => {};
  /** A crate landed and was lost. */
  onLost: () => void = () => {};

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly shootables: Shootables,
    drums: { x: number; z: number }[],
    private readonly dropEvery: number | undefined,
  ) {
    this.dropTimer = dropEvery ? Math.min(14, dropEvery) : Infinity;
    for (const d of drums) this.addDrum(d.x, d.z);
  }

  private addDrum(x: number, z: number): void {
    const img = this.scene.add.image(0, 0, 'fuel_drum').setOrigin(0.5, 1).setDepth(depthForZ(z));
    const p = project(x, z);
    const tex = img.texture.getSourceImage() as HTMLCanvasElement;
    img.setPosition(p.sx, p.sy).setScale((1.1 * p.ppm) / tex.height);
    const drum: Drum = {
      img,
      shot: this.shootables.add({
        x, z, widthM: 0.9, heightM: 1.1, alive: true,
        onHit: () => {
          if (!drum.shot.alive) return;
          drum.shot.alive = false;
          img.destroy();
          this.onDrum(x, z);
        },
      }),
    };
    this.drums.push(drum);
  }

  /** `active`: a wave is running (crates only drop during waves). */
  update(dt: number, active: boolean): void {
    if (this.dropEvery && active) {
      this.dropTimer -= dt;
      if (this.dropTimer <= 0) {
        this.dropTimer = this.dropEvery;
        this.spawnCrate();
      }
    }
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      if (!c.shot.alive) {
        this.removeCrate(i);
        continue;
      }
      if (c.lift > 0) {
        c.lift = Math.max(0, c.lift - (DROP_HEIGHT / FALL_TIME) * dt);
      } else {
        c.landedLeft -= dt;
        if (c.landedLeft <= 0) {
          this.onLost();
          this.removeCrate(i);
          continue;
        }
      }
      c.shot.liftM = c.lift;
      this.place(c);
    }
  }

  private spawnCrate(): void {
    const z = 14 + Math.random() * 26;
    const x = (Math.random() * 2 - 1) * Math.min(8, z * 0.3);
    const img = this.scene.add.image(0, 0, 'supply_crate').setOrigin(0.5, 1).setDepth(depthForZ(z) + 0.02);
    const chute = this.scene.add.image(0, 0, 'parachute').setOrigin(0.5, 1).setDepth(depthForZ(z) + 0.02);
    const crate: Crate = {
      img, chute, lift: DROP_HEIGHT, landedLeft: LANDED_TIME,
      shot: this.shootables.add({
        x, z, widthM: 1.2, heightM: 1.1, liftM: DROP_HEIGHT, alive: true,
        onHit: (_dmg, px, py) => {
          if (!crate.shot.alive) return;
          crate.shot.alive = false;
          const rewards: DropReward[] = ['cash', 'cash', 'support', 'mod', 'ammo'];
          this.onClaim(rewards[Math.floor(Math.random() * rewards.length)], px, py);
        },
      }),
    };
    this.crates.push(crate);
    this.place(crate);
    audio.play('radio', { volume: 0.35 });
  }

  private place(c: Crate): void {
    const p = project(c.shot.x, c.shot.z);
    const base = p.sy - c.lift * p.ppm;
    const tex = c.img.texture.getSourceImage() as HTMLCanvasElement;
    const s = (1.1 * p.ppm) / tex.height;
    c.img.setPosition(p.sx, base).setScale(s);
    c.chute.setPosition(p.sx, base - 1.1 * p.ppm).setScale(s).setVisible(c.lift > 0);
    // A landed crate blinks while the dead close in.
    c.img.setAlpha(c.lift > 0 ? 1 : 0.6 + 0.4 * Math.sin(c.landedLeft * 12));
  }

  private removeCrate(i: number): void {
    const c = this.crates[i];
    c.img.destroy();
    c.chute.destroy();
    c.shot.alive = false;
    this.shootables.remove(c.shot);
    this.crates.splice(i, 1);
  }

  clear(): void {
    for (let i = this.crates.length - 1; i >= 0; i--) this.removeCrate(i);
    for (const d of this.drums) d.img.destroy();
    this.drums.length = 0;
  }
}

