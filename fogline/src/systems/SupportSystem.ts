import Phaser from 'phaser';
import { SUPPORT_EFFECTS } from '../data/upgrades';
import { VIEW } from '../game/config';
import { DEPTH } from '../game/depths';
import { groundAt, project } from '../game/perspective';
import { depthForZ } from '../entities/Zombie';
import { audio, LoopHandle } from '../audio/AudioManager';
import { CombatSystem } from './CombatSystem';
import { EnemyManager } from './EnemyManager';
import { Fx } from './Fx';

interface Strike { x: number; z: number; t: number; reticle: Phaser.GameObjects.Graphics; beam: Phaser.GameObjects.Image }

const tmp = { x: 0, y: 0 };

/**
 * Support strikes (A/S/D): gunship run, orbital lance, tactical nuke.
 * Each is self-contained and reports damage through CombatSystem.
 */
export class SupportSystem {
  private heli: Phaser.GameObjects.Image;
  private rotor: Phaser.GameObjects.Image;
  private heliActive = false;
  private heliT = 0;
  private heliX = 60;
  private heliZ = 42;
  private heliAlt = 6;
  private heliFire = 0;
  private heliTarget: { x: number } = { x: 0 };
  private heliLoop: LoopHandle | null = null;
  private strikes: Strike[] = [];
  private nukeT = -1;
  private nukeBlastT = -1;
  shake: (dur: number, intensity: number) => void = () => {};

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly enemies: EnemyManager,
    private readonly combat: CombatSystem,
    private readonly fx: Fx,
  ) {
    this.heli = scene.add.image(0, 0, 'gunship').setVisible(false);
    this.rotor = scene.add.image(0, 0, 'rotor').setVisible(false);
  }

  get gunshipActive(): boolean {
    return this.heliActive;
  }
  get gunshipRemaining(): number {
    return this.heliActive ? Math.max(0, SUPPORT_EFFECTS.gunshipDuration - this.heliT) : 0;
  }
  get nukePending(): boolean {
    return this.nukeT >= 0;
  }

  callGunship(): void {
    this.heliActive = true;
    this.heliT = 0;
    this.heliX = 70;
    this.heliTarget.x = 10;
    this.heliFire = 0.8;
    this.heli.setVisible(true);
    this.rotor.setVisible(true);
    this.heliLoop?.stop(0.1);
    this.heliLoop = audio.loop('heli_loop', 0.0, 'sfx', 0.1);
    audio.play('radio', { volume: 0.6 });
  }

  callOrbital(aimX: number, aimY: number): void {
    const g = groundAt(aimX, Math.max(aimY, VIEW.horizonY + 6));
    const z = Phaser.Math.Clamp(g.z, 6, 90);
    const x = g.x;
    const reticle = this.scene.add.graphics().setDepth(DEPTH.worldFx + 1);
    const beam = this.scene.add.image(0, 0, 'beam').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(depthForZ(z) + 3).setVisible(false);
    this.strikes.push({ x, z, t: 0, reticle, beam });
    audio.play('orbital_charge', { volume: 0.8 });
  }

  callNuke(): void {
    this.nukeT = 0;
    audio.play('siren', { volume: 0.9 });
    audio.play('radio', { volume: 0.6 });
  }

  update(dt: number): void {
    this.updateHeli(dt);
    this.updateStrikes(dt);
    this.updateNuke(dt);
  }

  private updateHeli(dt: number): void {
    if (!this.heliActive) return;
    this.heliT += dt;
    const dur = SUPPORT_EFFECTS.gunshipDuration;
    const leaving = this.heliT > dur;
    if (leaving) this.heliTarget.x = -90;
    else if (Math.abs(this.heliX - this.heliTarget.x) < 2) this.heliTarget.x = (Math.random() * 2 - 1) * 16;
    const speed = leaving ? 30 : this.heliT < 2 ? 22 : 6;
    const dx = this.heliTarget.x - this.heliX;
    this.heliX += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
    const bob = Math.sin(this.heliT * 1.7) * 0.25;
    const p = project(this.heliX, this.heliZ);
    const y = VIEW.horizonY + (VIEW.camHeight - this.heliAlt - bob) * p.ppm;
    const scale = (15 * p.ppm) / 300;
    const facingLeft = dx < 0 || leaving;
    this.heli.setPosition(p.sx, y).setScale(scale).setFlipX(!facingLeft).setDepth(depthForZ(this.heliZ));
    this.heli.setRotation((facingLeft ? -1 : 1) * Math.min(0.12, Math.abs(dx) * 0.01));
    this.rotor.setPosition(p.sx + (facingLeft ? 8 : -8) * scale, y - 38 * scale).setScale(scale * (0.9 + Math.random() * 0.15), scale).setDepth(depthForZ(this.heliZ) + 1);
    const vol = this.heliT < 1.5 ? this.heliT / 1.5 : leaving ? Math.max(0, 1 - (this.heliT - dur) / 3) : 1;
    this.heliLoop?.setVolume(0.55 * vol, 0.1);

    if (!leaving) {
      this.heliFire -= dt;
      if (this.heliFire <= 0) {
        this.heliFire = SUPPORT_EFFECTS.gunshipFireInterval;
        const target = this.enemies.closest() ?? null;
        const pick = Math.random() < 0.35 ? this.enemies.randomAlive(80) : target;
        if (pick) {
          pick.chestScreen(tmp);
          const nx = p.sx + (facingLeft ? -110 : 110) * scale, ny = y + 30 * scale;
          const jx = tmp.x + (Math.random() - 0.5) * 30 * pick.scale, jy = tmp.y + (Math.random() - 0.5) * 40 * pick.scale;
          this.fx.tracer(nx, ny, jx, jy, 1.3, 0.05);
          this.fx.bloodHit(jx, jy, pick.scale, false);
          this.combat.damage(pick, SUPPORT_EFFECTS.gunshipDamage, 'torso', Math.sign(jx - nx) || 1, 'support', 0xffe0b0);
          audio.play('shot_chain', { volume: 0.32, pan: (p.sx - VIEW.centerX) / VIEW.centerX, rate: 0.95 + Math.random() * 0.1 });
        }
      }
    }
    if (leaving && this.heliX <= -85) {
      this.heliActive = false;
      this.heli.setVisible(false);
      this.rotor.setVisible(false);
      this.heliLoop?.stop(0.5);
      this.heliLoop = null;
    }
  }

  private updateStrikes(dt: number): void {
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t += dt;
      const p = project(s.x, s.z);
      const r = SUPPORT_EFFECTS.orbitalRadius * p.ppm;
      const g = s.reticle;
      g.clear();
      const pulse = 0.5 + 0.5 * Math.sin(s.t * 30);
      g.lineStyle(2, 0x9fe0ff, 0.5 + 0.4 * pulse);
      g.strokeEllipse(p.sx, p.sy, r * 2, r * 2 * (VIEW.camHeight / s.z) * 1.2 + 4);
      g.lineStyle(1, 0x9fe0ff, 0.8);
      g.lineBetween(p.sx - r * 1.2, p.sy, p.sx + r * 1.2, p.sy);
      const delay = SUPPORT_EFFECTS.orbitalDelay;
      if (s.t > delay * 0.55) {
        const w = Math.max(6, r * 0.5 * (s.t < delay ? (s.t - delay * 0.55) / (delay * 0.45) : 1.6));
        s.beam.setVisible(true).setPosition(p.sx, p.sy).setDisplaySize(w, p.sy + 20).setAlpha(s.t < delay ? 0.6 : 1);
      }
      if (s.t >= delay && !s.reticle.getData('fired')) {
        s.reticle.setData('fired', true);
        this.combat.explode(s.x, s.z, SUPPORT_EFFECTS.orbitalRadius, SUPPORT_EFFECTS.orbitalDamage, 'support');
        this.fx.explosion(s.x, s.z, SUPPORT_EFFECTS.orbitalRadius * 0.9);
        this.fx.whiteFlash(0.35, 2.5, 0xd8f0ff);
        audio.play('orbital_blast', { volume: 1 });
        this.shake(0.35, 0.008);
      }
      if (s.t > delay + 0.3) s.beam.setAlpha(Math.max(0, 1 - (s.t - delay - 0.3) / 0.4));
      if (s.t > delay + 0.75) {
        s.reticle.destroy();
        s.beam.destroy();
        this.strikes.splice(i, 1);
      }
    }
  }

  private updateNuke(dt: number): void {
    if (this.nukeT >= 0) {
      this.nukeT += dt;
      if (this.nukeT >= SUPPORT_EFFECTS.nukeDelay) {
        this.nukeT = -1;
        this.nukeBlastT = 0;
        this.fx.whiteFlash(1, 0.45);
        audio.play('nuke', { volume: 1 });
        this.shake(0.9, 0.012);
        this.combat.killAll();
      }
    }
    if (this.nukeBlastT >= 0) {
      this.nukeBlastT += dt;
      const t = this.nukeBlastT;
      const p = project(0, 75);
      // stem and expanding cap built from smoke and fire bursts
      if (t < 3.5 && Math.random() < 0.9) {
        const rise = Math.min(1, t / 2.2);
        const capY = p.sy - 40 - rise * 200;
        this.fx.fireBurst(p.sx + (Math.random() - 0.5) * 40, p.sy - Math.random() * (p.sy - capY), 0.9, 1);
        this.fx.smokeColumn(p.sx + (Math.random() - 0.5) * (50 + rise * 220), capY + (Math.random() - 0.5) * 50, 0.9 + rise * 0.8, 1);
        if (t < 0.6) this.fx.glow(p.sx, p.sy - 60, 700, 0xffd8a0, 0.6);
      }
      if (t > 4) this.nukeBlastT = -1;
    }
  }

  clear(): void {
    this.heliActive = false;
    this.heli.setVisible(false);
    this.rotor.setVisible(false);
    this.heliLoop?.stop(0.2);
    this.heliLoop = null;
    for (const s of this.strikes) {
      s.reticle.destroy();
      s.beam.destroy();
    }
    this.strikes.length = 0;
    this.nukeT = -1;
    this.nukeBlastT = -1;
  }
}
