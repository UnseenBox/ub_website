// What the player sees and hears of the monsters' special moves: the Wraith's gloom and
// blackout, the jump of something appearing at the wire, acid across the view, a scream that
// shakes the aim, the glow on a roaring Brute's belly. The moves themselves are in
// entities/tricks.ts.

import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { VIEW } from '../game/config';
import { DEPTH } from '../game/depths';
import type { Zombie, ZombieAction } from '../entities/Zombie';
import { clawSlash, smokeBurst, stompDust } from '../rendering/monsterFx';
import type { EnemyManager } from './EnemyManager';
import type { Fx } from './Fx';

/** Darkness and light of the Wraith's spell. */
const SPELL_DARK = 0.965;
const SPELL_LIGHT = 92;
/** Light round the sights while the field is only dimmed. */
const DIM_LIGHT = 230;

const at = { x: 0, y: 0 };
const pan = (x: number): number => (x - VIEW.centerX) / VIEW.centerX;

export class GimmickFx {
  private readonly dark: Phaser.GameObjects.RenderTexture;
  private readonly brush: Phaser.GameObjects.Image;
  private readonly marks: Phaser.GameObjects.Graphics;
  private dim = 0;
  private spellLeft = 0;
  private spellTime = 0;
  private caster: Zombie | null = null;
  private lampLeft = 0;
  private shakeLeft = 0;
  private shakeFor = 1;
  private time = 0;
  private weakSaid = 0;
  private readonly splats: Phaser.GameObjects.Graphics[] = [];

  /** `mild` (0.6–1) shortens and softens the spells in the early missions. */
  constructor(
    private readonly scene: Phaser.Scene, private readonly fx: Fx, private readonly enemies: EnemyManager, private readonly mild: number,
  ) {
    this.dark = scene.add.renderTexture(0, 0, VIEW.width, VIEW.hudTop).setOrigin(0).setDepth(DEPTH.shutters + 9).setVisible(false);
    this.brush = scene.make.image({ key: 'glow', add: false });
    this.marks = scene.add.graphics().setDepth(DEPTH.worldFx + 6);
  }

  /** How far a scream throws the sights off just now, in pixels. */
  get jitter(): { x: number; y: number } {
    if (this.shakeLeft <= 0) return { x: 0, y: 0 };
    const k = Math.min(1, this.shakeLeft / this.shakeFor) * 26 * this.mild;
    const t = this.time;
    return { x: (Math.sin(t * 23) + 0.6 * Math.sin(t * 41)) * k, y: (Math.cos(t * 19) + 0.6 * Math.sin(t * 33)) * k };
  }

  /** Blinded by a spell right now. */
  get blinded(): boolean {
    return this.spellLeft > 0;
  }

  /** The lamp: every shadow goes and everything hidden shows. */
  lamp(seconds: number): void {
    this.lampLeft = seconds;
    this.spellLeft = 0;
    this.dim = 0;
    for (const z of this.enemies.live) if (z.alive) z.reveal(seconds);
  }

  /** The moves a monster makes, as they happen. */
  onAction(z: Zombie, action: ZombieAction): void {
    const p = pan(z.sx);
    const near = Phaser.Math.Clamp(16 / Math.max(1, z.z), 0.25, 1);
    switch (action) {
      case 'charge':
        if (z.channelKind === 'roar') audio.play('howl', { volume: near, pan: p, rate: 0.5 });
        else if (z.channelKind === 'veil') {
          audio.play('howl', { volume: 0.6 * near, pan: p, rate: 1.7 });
          z.headScreen(at);
          this.fx.glow(at.x, at.y, 190 * z.scale + 60, 0xa060ff, 1.1);
        } else if (z.channelKind === 'rush') {
          audio.play('big_zombie_spawn', { volume: 0.8, pan: p, rate: 1.25 });
          z.headScreen(at);
          this.fx.glow(at.x, at.y, 170 * z.scale + 50, 0xff5030, 0.9);
        }
        break;
      case 'leap':
        this.fx.groundImpact(z.sx, z.sy + z.lift * z.ppm, z.scale);
        audio.play('claw', { volume: 0.3 * near, pan: p, rate: 1.45 });
        break;
      case 'vanish':
        z.chestScreen(at);
        smokeBurst(this.scene, at.x, at.y, z.scale * 1.5, DEPTH.worldFx);
        audio.play('howl', { volume: 0.25, pan: p, rate: 2.3 });
        break;
      case 'ambush':
        this.ambush(z);
        break;
      case 'burrow':
        this.fx.groundImpact(z.sx, z.sy, z.scale * 2);
        audio.play('hit_dirt', { volume: 0.7 * near, pan: p, rate: 0.6 });
        break;
      case 'stomp': {
        const weight = Phaser.Math.Clamp(1 - z.z / 28, 0.15, 1);
        this.scene.cameras.main.shake(110, 0.0016 + 0.0034 * weight);
        stompDust(this.scene, z.sx, z.sy, z.scale * 0.8, DEPTH.worldFx - 1);
        audio.play('shutter_hit', { volume: 0.1 + 0.25 * weight, pan: p, rate: 0.42 });
        break;
      }
      case 'roar':
        this.scene.cameras.main.shake(480, 0.008);
        stompDust(this.scene, z.sx, z.sy, z.scale * 1.8, DEPTH.worldFx - 1);
        break;
      case 'veil':
        this.spellLeft = this.spellTime = z.def.special!.gloom!.seconds * this.mild;
        this.caster = z;
        audio.play('howl', { volume: 0.9, rate: 0.75 });
        this.scene.cameras.main.shake(220, 0.005);
        break;
      case 'rush':
        audio.play('howl', { volume: near, pan: p, rate: 0.85 });
        this.scene.cameras.main.shake(300, 0.005);
        break;
      default:
        break;
    }
  }

  /** What a shot broke. */
  onTrick(z: Zombie, what: 'interrupted' | 'shattered' | 'weak' | 'down'): void {
    z.headScreen(at);
    if (what === 'interrupted') {
      this.fx.floatText(at.x, at.y - 30, 'STOPPED', '#a8e090', 24);
      audio.play('ricochet', { volume: 0.7, rate: 0.7 });
      if (this.caster === z) this.spellLeft = 0;
    } else if (what === 'shattered') {
      z.chestScreen(at);
      for (let i = 0; i < 6; i++) this.fx.ricochet(at.x + (Math.random() - 0.5) * 120 * z.scale, at.y + (Math.random() - 0.5) * 140 * z.scale, z.scale * 1.4);
      this.fx.floatText(at.x, at.y - 40, 'ARMOUR BROKEN', '#ffd070', 24);
      audio.play('shutter_hit', { volume: 0.7, rate: 1.7 });
      this.scene.cameras.main.shake(180, 0.006);
    } else if (what === 'weak') {
      z.weakScreen(at);
      this.fx.glow(at.x, at.y, 120 * z.scale + 40, 0xffa030, 0.12);
      if (this.time - this.weakSaid > 0.9) {
        this.weakSaid = this.time;
        this.fx.floatText(at.x, at.y - 20, 'SOFT SPOT', '#ffc060', 22);
      }
    } else {
      this.fx.floatText(at.x, at.y - 24, 'STILL MOVING', '#ff9a70', 18);
    }
  }

  /** A scream shakes the sights for `seconds`. */
  scream(seconds: number): void {
    this.shakeLeft = this.shakeFor = seconds * this.mild;
    this.scene.cameras.main.shake(350, 0.004);
  }

  /** Acid hits the sandbags and splashes up across the view. */
  splash(x: number): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.overlay - 1);
    for (let i = 0; i < 7; i++) {
      const cx = Phaser.Math.Clamp(x + (Math.random() - 0.5) * 620, 90, VIEW.width - 90);
      const cy = 110 + Math.random() * 330;
      const r = (34 + Math.random() * 62) * this.mild;
      g.fillStyle(0x6f9a20, 0.82).fillCircle(cx, cy, r);
      g.fillStyle(0xb6e04a, 0.65).fillCircle(cx - r * 0.2, cy - r * 0.22, r * 0.55);
      for (let k = 0; k < 7; k++) {
        const a = Math.random() * Math.PI * 2, d = r * (0.9 + Math.random() * 0.7);
        g.fillStyle(0x7cab26, 0.75).fillCircle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.08 + Math.random() * 0.16));
      }
      g.fillStyle(0x6f9a20, 0.6).fillRect(cx - r * 0.1, cy, r * 0.2, r * (1.1 + Math.random()));
    }
    this.splats.push(g);
    this.scene.tweens.add({
      targets: g, alpha: 0, y: 36, delay: 900, duration: 2300 * this.mild,
      onComplete: () => {
        this.splats.splice(this.splats.indexOf(g), 1);
        g.destroy();
      },
    });
  }

  private ambush(z: Zombie): void {
    const close = z.z < 14;
    z.headScreen(at);
    smokeBurst(this.scene, at.x, at.y + 60 * z.scale, z.scale * 1.4, DEPTH.worldFx);
    audio.play('big_zombie_spawn', { volume: 1, pan: pan(z.sx), rate: 1.65 });
    audio.play('howl', { volume: close ? 0.9 : 0.5, pan: pan(z.sx), rate: 1.9 });
    if (!close) return;
    clawSlash(this.scene, at.x, at.y, z.scale * 1.8, DEPTH.worldFx + 8);
    this.scene.cameras.main.shake(380, 0.013);
    this.fx.whiteFlash(0.42, 2.4, 0x2a0000);
  }

  update(dt: number, sightX: number, sightY: number): void {
    this.time += dt;
    this.shakeLeft = Math.max(0, this.shakeLeft - dt);
    if (this.lampLeft > 0) {
      this.lampLeft -= dt;
      for (const z of this.enemies.live) if (z.alive && z.revealLeft < 0.2) z.reveal(Math.max(0, this.lampLeft));
    }
    if (this.caster && !this.caster.alive) {
      this.spellLeft = 0;
      this.caster = null;
    }
    this.spellLeft = Math.max(0, this.spellLeft - dt);

    // The nearer a Wraith is, the darker the field.
    let want = 0;
    if (this.lampLeft <= 0) {
      for (const z of this.enemies.live) {
        const g = z.def.special?.gloom;
        if (!g || !z.alive || z.z > g.from) continue;
        want = Math.max(want, g.dim * this.mild * Phaser.Math.Clamp((g.from - z.z) / (g.from - g.castAt), 0, 1));
      }
    }
    this.dim += Phaser.Math.Clamp(want - this.dim, -dt * 0.9, dt * 0.45);

    // The spell falls in a blink and lifts slowly.
    const spell = this.spellLeft > 0 ? Math.min(1, (this.spellTime - this.spellLeft) / 0.25, this.spellLeft / 0.7) : 0;
    const alpha = Math.max(this.dim, spell * SPELL_DARK);
    this.dark.setVisible(alpha > 0.012);
    if (this.dark.visible) {
      this.dark.clear();
      this.dark.fill(spell > 0 ? 0x07020f : 0x05030a, alpha);
      const radius = spell > 0 ? Phaser.Math.Linear(DIM_LIGHT, SPELL_LIGHT, spell) : DIM_LIGHT;
      this.brush.setScale(radius / 128).setAlpha(spell > 0 ? 0.92 : 0.85);
      this.dark.erase(this.brush, sightX, sightY);
    }

    this.marks.clear();
    for (const z of this.enemies.live) {
      if (!z.alive) continue;
      if (z.weakOpen) {
        // A ring on the soft belly while it can be hurt.
        z.weakScreen(at);
        const r = Math.max(14, z.screenWidth * 0.2) * (1 + 0.12 * Math.sin(this.time * 12));
        this.marks.lineStyle(5, 0x1a0800, 0.7).strokeCircle(at.x, at.y, r);
        this.marks.lineStyle(3, 0xffa030, 0.95).strokeCircle(at.x, at.y, r);
        for (let i = 0; i < 4; i++) {
          const a = this.time * 2.4 + (i * Math.PI) / 2;
          this.marks.lineBetween(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, at.x + Math.cos(a) * (r + 12), at.y + Math.sin(a) * (r + 12));
        }
      }
      if (z.channelKind === 'veil' && z.channelLeft > 0) {
        // Its eyes burn while the spell gathers.
        z.headScreen(at);
        const gap = Math.max(4, 22 * z.scale), size = Math.max(3, 9 * z.scale);
        this.marks.fillStyle(0xd0a0ff, 0.95).fillCircle(at.x - gap, at.y, size).fillCircle(at.x + gap, at.y, size);
      }
    }
  }

  destroy(): void {
    for (const g of this.splats) {
      this.scene.tweens.killTweensOf(g);
      g.destroy();
    }
    this.splats.length = 0;
    this.dark.destroy();
    this.marks.destroy();
  }
}
