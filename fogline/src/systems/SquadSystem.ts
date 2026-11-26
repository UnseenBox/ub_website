import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { RecruitDef, RecruitId, recruitById, recruitInterval, recruitPower } from '../data/squad';
import { VIEW } from '../game/config';
import { DEPTH } from '../game/depths';
import type { Zombie } from '../entities/Zombie';
import { BunkerManager } from './BunkerManager';
import { CombatSystem } from './CombatSystem';
import { EnemyManager } from './EnemyManager';
import { Fx } from './Fx';

/** Screen x of each side firing position (left window, right window, an extra post). */
const POSTS = [205, 1075, 360];
/** Shots leave just above the sandbags: the soldiers stay behind them, out of sight. */
const MUZZLE_Y = VIEW.wallTop - 14;

interface Member {
  def: RecruitDef;
  level: number;
  flash: Phaser.GameObjects.Image;
  muzzle: { x: number; y: number };
  timer: number;
  flashLeft: number;
}

const tmp = { x: 0, y: 0 };

/**
 * The squad at the side windows. Snipers pick off the far threats (Spitters, Howlers,
 * Sappers first), gunners spray what reaches the wire, engineers patch the bunker.
 * Their kills pay like the player's.
 */
export class SquadSystem {
  readonly members: Member[] = [];
  /** Radio chatter hook (set by the battle). */
  onLine: (who: string, text: string) => void = () => {};
  private lineCooldown = 12;
  private wasActive = false;

  constructor(
    private readonly scene: Phaser.Scene,
    squad: { id: RecruitId; level: number }[],
    private readonly enemies: EnemyManager,
    private readonly combat: CombatSystem,
    private readonly fx: Fx,
    private readonly bunker: BunkerManager,
  ) {
    squad.forEach((s, i) => {
      const def = recruitById(s.id);
      if (!def || i >= POSTS.length) return;
      const x = POSTS[i];
      const side = x < VIEW.centerX ? 1 : -1;
      // No figure is drawn: the soldier is behind the sandbags. Only the shot shows.
      const muzzle = { x: x + side * 48, y: MUZZLE_Y };
      const flash = scene.add.image(muzzle.x, muzzle.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.parapet + 3)
        .setScale(0.18).setTint(0xffc080).setVisible(false);
      this.members.push({ def, level: s.level, flash, muzzle, timer: 1 + i * 0.7, flashLeft: 0 });
    });
  }

  /** `active`: a wave is running (the squad holds fire between waves). */
  update(dt: number, active: boolean): void {
    this.lineCooldown -= dt;
    if (active && !this.wasActive) this.announceReady();
    this.wasActive = active;
    for (const m of this.members) {
      m.flashLeft = Math.max(0, m.flashLeft - dt);
      m.flash.setVisible(m.flashLeft > 0);
      if (!active) continue;
      if (m.def.role === 'engineer') {
        if (this.bunker.health < this.bunker.max && !this.bunker.destroyed) this.bunker.repair(recruitPower(m.def, m.level) * dt);
        continue;
      }
      m.timer -= dt;
      if (m.timer > 0) continue;
      if (m.def.role === 'pilot' || m.def.role === 'grenadier' || m.def.role === 'mortar') {
        // The mortar only shells the far field (it cannot drop close to its own wall).
        const spot = this.crowd(m.def.range, m.def.role === 'pilot' ? 3.5 : m.def.role === 'mortar' ? 5 : 4.5, m.def.role === 'mortar' ? 36 : 6);
        if (!spot) {
          m.timer = 0.5;
          continue;
        }
        m.timer = recruitInterval(m.def, m.level);
        if (m.def.role === 'pilot') this.strafe(m, spot.x);
        else if (m.def.role === 'mortar') this.lob(m, spot.x, spot.z, 1500, 5.5);
        else this.lob(m, spot.x, spot.z);
        continue;
      }
      const target = m.def.role === 'sniper' ? this.sniperTarget(m.def.range) : this.gunnerTarget(m.def.range);
      if (!target) {
        m.timer = 0.3;
        continue;
      }
      m.timer = recruitInterval(m.def, m.level);
      this.fire(m, target);
    }
  }

  /** As a wave starts, each posted soldier radios that they are in position and ready to fire. */
  private announceReady(): void {
    this.members.forEach((m, i) => {
      this.scene.time.delayedCall(700 + i * 1300, () => this.onLine(m.def.name.split(' ')[0].toUpperCase(), m.def.ready));
    });
  }

  private fire(m: Member, z: Zombie): void {
    const sniper = m.def.role === 'sniper';
    const zone = sniper ? 'head' : 'torso';
    const dmg = recruitPower(m.def, m.level) * z.def.zoneMultiplier[zone];
    if (sniper) z.headScreen(tmp);
    else z.chestScreen(tmp);
    this.fx.tracer(m.muzzle.x, m.muzzle.y, tmp.x + (Math.random() - 0.5) * 6, tmp.y, sniper ? 1.2 : 0.7);
    m.flashLeft = 0.05;
    m.flash.setVisible(true);
    const pan = (m.muzzle.x - VIEW.centerX) / VIEW.centerX;
    audio.play(sniper ? 'shot_m82' : 'shot_m249', { volume: sniper ? 0.35 : 0.18, pan, rate: sniper ? 1.05 : 1.15 });
    const wasAlive = z.alive;
    this.combat.damage(z, dmg, zone, m.muzzle.x < z.sx ? 1 : -1, 'squad', 0xffffff);
    if (wasAlive && !z.alive && this.lineCooldown <= 0 && Math.random() < 0.3) {
      this.lineCooldown = 18;
      this.onLine(m.def.name.split(' ')[0].toUpperCase(), m.def.lines[Math.floor(Math.random() * m.def.lines.length)]);
    }
  }

  /** Where the most of the dead stand within `radius` of each other (x, z), or null for an empty field. */
  private crowd(range: number, radius: number, minZ = 6): { x: number; z: number } | null {
    let best: { x: number; z: number } | null = null;
    let bestN = 0;
    const live = this.enemies.live.filter((z) => z.alive && z.state !== 'emerge' && z.z <= range && z.z >= minZ);
    for (const a of live) {
      let n = 0;
      for (const b of live) if (Math.abs(a.x - b.x) <= radius && Math.abs(a.z - b.z) <= radius * 2) n++;
      if (n > bestN) {
        bestN = n;
        best = { x: a.x, z: a.z };
      }
    }
    return bestN >= 2 ? best : null;
  }

  /** Kestrel's gunship strafes a lane of the field: every body in it takes a burst. */
  private strafe(m: Member, laneX: number): void {
    const targets = this.enemies.live.filter((z) => z.alive && Math.abs(z.x - laneX) < 3.5 && z.z <= m.def.range).slice(0, 10);
    this.say(m, 0.5);
    audio.play('heli_loop', { volume: 0.4 });
    targets.forEach((z, i) => {
      this.scene.time.delayedCall(120 + i * 90, () => {
        if (!z.alive) return;
        z.chestScreen(tmp);
        this.fx.tracer(tmp.x + (Math.random() - 0.5) * 60, 0, tmp.x, tmp.y, 1.4, 0.08);
        audio.play('shot_m249', { volume: 0.3, rate: 1.3 });
        this.combat.damage(z, recruitPower(m.def, m.level), 'torso', 1, 'squad', 0xffe0b0);
      });
    });
  }

  /** Rook lobs a grenade into a crowd: it lands a moment later. */
  private lob(m: Member, x: number, z: number, delayMs = 650, radius = 4.5): void {
    m.flashLeft = 0.08;
    m.flash.setVisible(true);
    this.say(m, 0.25);
    this.scene.time.delayedCall(delayMs, () => {
      this.fx.explosion(x, z, radius * 0.7);
      audio.play('explosion_small', { volume: Phaser.Math.Clamp(14 / z, 0.3, 0.9) });
      this.combat.explode(x, z, radius, recruitPower(m.def, m.level), 'squad');
    });
  }

  private say(m: Member, chance: number): void {
    if (this.lineCooldown > 0 || Math.random() >= chance) return;
    this.lineCooldown = 18;
    this.onLine(m.def.name.split(' ')[0].toUpperCase(), m.def.lines[Math.floor(Math.random() * m.def.lines.length)]);
  }

  /** The most dangerous far target: Spitters, Howlers and Sappers first, then the farthest. */
  private sniperTarget(range: number): Zombie | null {
    let best: Zombie | null = null;
    let bestScore = -Infinity;
    for (const z of this.enemies.live) {
      if (!z.alive || z.state === 'emerge' || z.z > range || z.z < 8) continue;
      const s = z.def.special;
      const priority = s?.ranged || s?.howl ? 1000 : s?.deathBlast ? 800 : 0;
      const score = priority + z.z;
      if (score > bestScore) {
        bestScore = score;
        best = z;
      }
    }
    return best;
  }

  /** The closest body inside the gunner's reach. */
  private gunnerTarget(range: number): Zombie | null {
    let best: Zombie | null = null;
    for (const z of this.enemies.live) {
      if (!z.alive || z.z > range) continue;
      if (!best || z.z < best.z) best = z;
    }
    return best;
  }

  clear(): void {
    for (const m of this.members) m.flash.destroy();
    this.members.length = 0;
  }
}
