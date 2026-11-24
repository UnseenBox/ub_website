import Phaser from 'phaser';
import { ENEMIES, HitZone } from '../data/enemies';
import { MOD_EFFECTS, ModId } from '../data/upgrades';
import { WeaponDef } from '../data/weapons';
import { VIEW } from '../game/config';
import { groundAt } from '../game/perspective';
import { Zombie } from '../entities/Zombie';
import { audio } from '../audio/AudioManager';
import { blastDamage, bulletDamage, killReward } from './CombatRules';
import { EconomyManager } from './EconomyManager';
import { EnemyManager } from './EnemyManager';
import { Fx } from './Fx';
import { WaveManager } from './WaveManager';

export interface CombatStats {
  shots: number;
  hits: number;
  headshots: number;
  kills: number;
  headshotKills: number;
}

export type DamageSource = 'bullet' | 'blast' | 'burn' | 'support';

const tmp = { x: 0, y: 0 };

/**
 * Resolves shots and explosions against the zombie pool, applies damage with
 * mods, and handles deaths: exactly-once payouts, Bloater bursts, wave counts.
 */
export class CombatSystem {
  readonly stats: CombatStats = { shots: 0, hits: 0, headshots: 0, kills: 0, headshotKills: 0 };
  private activeMods = new Set<ModId>();
  /** Screen-space top of the cover in front of the bunker (shots below it hit cover). */
  coverTop: number = VIEW.wallTop;
  shuttersUp = false;

  constructor(
    private readonly enemies: EnemyManager,
    private readonly fx: Fx,
    private readonly economy: EconomyManager,
    private readonly waves: WaveManager,
    private readonly onHitConfirmed: (headshot: boolean) => void,
  ) {}

  setActiveMods(mods: Set<ModId>): void {
    this.activeMods = mods;
  }

  /** Hitscan shot fired at screen point (x, y) from the muzzle. */
  fireHitscan(def: WeaponDef, x: number, y: number, muzzleX: number, muzzleY: number): void {
    this.stats.shots++;
    const pan = (x - VIEW.centerX) / VIEW.centerX;
    if (y >= this.coverTop && y < VIEW.hudTop) {
      // Shooting into our own sandbags / shutters.
      this.fx.tracer(muzzleX, muzzleY, x, y, 1);
      this.fx.sandbagImpact(x, y);
      audio.play(this.shuttersUp ? 'ricochet' : 'hit_sandbag', { volume: 0.5, pan });
      return;
    }
    const hit = this.enemies.raycast(x, y);
    this.fx.tracer(muzzleX, muzzleY, x, y, def.id === 'm249' ? 1.4 : 1);
    if (!hit) {
      const g = groundAt(x, y);
      if (y > VIEW.horizonY + 1) {
        this.fx.groundImpact(x, y, VIEW.focal / g.z / 140);
        if (g.z < 40) audio.play('hit_dirt', { volume: 0.25 * Math.min(1, 12 / g.z), pan, rate: 0.9 + Math.random() * 0.2 });
      }
      return;
    }
    this.stats.hits++;
    const z = hit.zombie;
    const res = bulletDamage(def.damage, def.headshotMultiplier, hit.zone, z.def, this.activeMods);
    const dir = x < z.sx ? 1 : -1;
    const vol = Phaser.Math.Clamp(14 / z.z, 0.25, 1);
    if (res.deflected) {
      this.fx.ricochet(x, y, z.scale);
      audio.play('ricochet', { volume: 0.55 * vol + 0.2, pan, rate: 0.9 + Math.random() * 0.25 });
    } else if (hit.zone === 'head') {
      this.fx.bloodHit(x, y, z.scale, true);
      audio.play('hit_head', { volume: vol, pan, rate: 0.95 + Math.random() * 0.1 });
    } else {
      this.fx.bloodHit(x, y, z.scale, false);
      audio.play(`hit_flesh_${Math.floor(Math.random() * 3)}`, { volume: 0.8 * vol, pan, rate: 0.9 + Math.random() * 0.2 });
    }
    if (res.headshot) this.stats.headshots++;
    this.applyMods(z, x, y);
    this.damage(z, res.damage, hit.zone, dir, 'bullet', res.deflected ? 0x9aa8b8 : 0xffffff);
    this.onHitConfirmed(res.headshot && !res.deflected);
  }

  private applyMods(z: Zombie, x: number, y: number): void {
    if (this.activeMods.has('fire')) z.burnLeft = MOD_EFFECTS.burnDuration;
    if (this.activeMods.has('cryo')) {
      z.slowLeft = MOD_EFFECTS.cryoDuration;
      this.fx.frostHit(x, y, z.scale);
    }
  }

  /** Area damage centred on a ground point. */
  explode(x: number, zPos: number, radius: number, base: number, source: DamageSource = 'blast'): number {
    const hits = this.enemies.inRadius(x, zPos, radius);
    let kills = 0;
    for (const h of hits) {
      const zb = h.zombie;
      const dmg = blastDamage(base, h.dist, radius, this.activeMods);
      const dir = zb.x < x ? -1 : 1;
      if (source === 'blast') this.applyModsBlast(zb);
      const wasAlive = zb.alive;
      this.damage(zb, dmg, 'torso', dir, source, 0xffd0a0);
      if (zb.alive) {
        // Giants (Brutes) are too heavy to be shoved or stunned by a blast.
        if (zb.def.staggerThreshold < 5000) {
          zb.stagger(0.6);
          zb.z = Math.min(zb.z + (1 - h.dist / radius) * 2.5, 95);
        }
      } else if (wasAlive) kills++;
    }
    return kills;
  }

  private applyModsBlast(z: Zombie): void {
    if (this.activeMods.has('fire')) z.burnLeft = MOD_EFFECTS.burnDuration;
    if (this.activeMods.has('cryo')) z.slowLeft = MOD_EFFECTS.cryoDuration;
  }

  /** Per-frame damage over time (incendiary). */
  update(dt: number): void {
    for (const z of this.enemies.live) {
      if (!z.alive) continue;
      if (z.burnLeft > 0) {
        if (Math.random() < dt * 14) {
          z.chestScreen(tmp);
          this.fx.burnTick(tmp.x, tmp.y, z.scale);
        }
        this.damage(z, MOD_EFFECTS.burnDps * dt, 'torso', 0, 'burn', 0, false);
      }
    }
    for (const z of this.enemies.live) {
      if (z.headless && z.state === 'dying' && Math.random() < 0.6) {
        z.headScreen(tmp);
        this.fx.neckSpurt(tmp.x, tmp.y + 6 * z.scale, z.scale);
      }
    }
  }

  damage(z: Zombie, amount: number, zone: HitZone, dir: number, source: DamageSource, flash: number, react = true): void {
    if (!z.alive || amount <= 0) return;
    z.hp -= amount;
    if (zone === 'legs' && z.alive) z.hurtLegs();
    if (react) {
      z.hitReact(dir || 1, Math.min(1, amount / (z.maxHp * 0.6) + 0.35), zone === 'head', flash);
      if (amount >= z.def.staggerThreshold) z.stagger(0.45);
    }
    if (z.hp <= 0) this.kill(z, zone === 'head' && source === 'bullet', dir, source);
  }

  private kill(z: Zombie, headshot: boolean, dir: number, source: DamageSource): void {
    if (z.resolved) return;
    z.resolved = true;
    z.killedByHeadshot = headshot;
    z.kill(headshot ? 'headshot' : source === 'blast' || source === 'support' ? 'blast' : 'bullet', dir);
    // The body disappears at once; black ink wells up from the ground and swallows where it stood.
    this.fx.blackSplash(z.sx, z.sy, z.scale, z.screenWidth, z.screenHeight);
    z.vanish();
    this.stats.kills++;
    if (headshot) {
      this.stats.headshotKills++;
      audio.play('headshot_confirm', { volume: 0.5 });
    }
    const reward = killReward(z.def, headshot);
    this.economy.earn(reward, headshot ? 'headshot' : 'kill');
    z.chestScreen(tmp);
    this.fx.floatText(tmp.x, tmp.y - 40 * z.scale - 8, headshot ? `HEADSHOT +$${reward}` : `+$${reward}`, headshot ? '#ff7a50' : '#c8dc90', headshot ? 22 : 18);
    const pan = (z.sx - VIEW.centerX) / VIEW.centerX;
    audio.play(`death_${Math.floor(Math.random() * 3)}`, { volume: Phaser.Math.Clamp(10 / z.z, 0.15, 0.7), pan, rate: z.def.rig === 'run' ? 1.25 : 1 });

    // Bloater bursts into crawlers before it is counted as removed, so the wave can't end in between.
    const burst = z.def.special?.burstInto;
    if (burst) {
      audio.play('carrier_burst', { volume: Phaser.Math.Clamp(14 / z.z, 0.3, 1), pan });
      z.chestScreen(tmp);
      this.fx.headshotGore(tmp.x, tmp.y, z.scale * 1.3);
      const wave = this.waves.current;
      for (let i = 0; i < burst.count; i++) {
        const c = this.enemies.spawn(burst.id, wave?.healthMul ?? 1, wave?.speedMul ?? 1, z.x + (i - 1) * 0.8, z.z + 0.3 + Math.random() * 0.5);
        c.state = 'walk';
      }
      this.waves.notifyExtraSpawned(burst.count);
    }
    this.waves.notifyRemoved(1);
  }

  /** A Bloater reaching the wall detonates: damage the bunker, remove it, spawn its crawlers. */
  detonate(z: Zombie): number {
    if (z.resolved) return 0;
    z.resolved = true;
    const dmg = z.def.special?.detonateDamage ?? 0;
    this.fx.explosion(z.x, z.z, 3);
    audio.play('explosion_small', { volume: 0.9 });
    audio.play('carrier_burst', { volume: 0.9 });
    const burst = z.def.special?.burstInto;
    if (burst) {
      const wave = this.waves.current;
      for (let i = 0; i < burst.count; i++) {
        const c = this.enemies.spawn(burst.id, wave?.healthMul ?? 1, wave?.speedMul ?? 1, z.x + (i - 1) * 0.9, z.z + 0.2);
        c.state = 'walk';
      }
      this.waves.notifyExtraSpawned(burst.count);
    }
    z.vanish();
    this.waves.notifyRemoved(1);
    return dmg;
  }

  /** Kill everything on the field (nuke). Pays normal kill rewards. */
  killAll(): void {
    for (const z of [...this.enemies.live]) {
      if (!z.alive) continue;
      // crawler bursts from Bloaters caught in the blast die too
      this.damage(z, 1e6, 'torso', z.x < 0 ? -1 : 1, 'support', 0xffffff);
    }
    for (const z of [...this.enemies.live]) if (z.alive) this.damage(z, 1e6, 'torso', 1, 'support', 0xffffff);
  }

  static enemyName(id: string): string {
    return ENEMIES[id]?.name ?? id;
  }
}
