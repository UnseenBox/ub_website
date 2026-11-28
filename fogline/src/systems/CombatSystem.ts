import Phaser from 'phaser';
import { ENEMIES, HitZone } from '../data/enemies';
import { MOD_EFFECTS, ModId } from '../data/upgrades';
import { WeaponDef } from '../data/weapons';
import { VIEW } from '../game/config';
import { groundAt } from '../game/perspective';
import { Zombie } from '../entities/Zombie';
import { audio } from '../audio/AudioManager';
import { blastDamage, bulletDamage, killReward, rangeFalloff } from './CombatRules';
import { EconomyManager } from './EconomyManager';
import { EnemyManager } from './EnemyManager';
import { Fx } from './Fx';
import { Shootables } from './Shootables';
import { WaveManager } from './WaveManager';

export interface CombatStats {
  shots: number;
  hits: number;
  headshots: number;
  kills: number;
  headshotKills: number;
}

/** `enemyBlast`: a Sapper's vest. Friendly fire among the dead: no ammo mods, no stagger shove. */
/** 'squad' is a recruit's rifle: it scores like a bullet but is not the player's kill (mastery). */
export type DamageSource = 'bullet' | 'squad' | 'blast' | 'burn' | 'support' | 'enemyBlast';

const tmp = { x: 0, y: 0 };

/** The active mods plus armour-piercing (for rounds that pierce armour on their own). */
function withAp(mods: Set<ModId>): Set<ModId> {
  const out = new Set(mods);
  out.add('ap');
  return out;
}


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

  /**
   * Hitscan shot fired at screen point (x, y) from the muzzle. A shotgun calls this once
   * per pellet with `pellet` set: the shot is counted once (by the first pellet), and
   * sounds that would stack nine times play only for the first pellet. Returns true on a hit.
   */
  fireHitscan(def: WeaponDef, x: number, y: number, muzzleX: number, muzzleY: number, pellet: 'first' | 'rest' | null = null): boolean {
    if (pellet !== 'rest') this.stats.shots++;
    const quiet = pellet === 'rest';
    const pan = (x - VIEW.centerX) / VIEW.centerX;
    if (y >= this.coverTop && y < VIEW.hudTop) {
      // Shooting into our own sandbags / shutters.
      this.fx.tracer(muzzleX, muzzleY, x, y, 1);
      this.fx.sandbagImpact(x, y);
      if (!quiet) audio.play(this.shuttersUp ? 'ricochet' : 'hit_sandbag', { volume: 0.5, pan });
      return false;
    }
    // A .50 round goes on through several bodies in a line; everything else stops at the first.
    const hits = def.pierce ? this.enemies.raycastAll(x, y).slice(0, def.pierce) : [this.enemies.raycast(x, y)].filter((h) => h !== null);
    this.fx.tracer(muzzleX, muzzleY, x, y, def.id === 'm249' || def.pierce ? 1.4 : pellet ? 0.6 : 1);
    // A nest, crate or fuel drum in front of the first body takes the round instead.
    const thing = this.shootables?.at(x, y) ?? null;
    if (thing && (!hits.length || thing.z < hits[0].zombie.z)) {
      if (!pellet || !this.pelletHit) this.stats.hits++;
      if (pellet) this.pelletHit = true;
      thing.onHit(def.damage * rangeFalloff(def, thing.z), x, y);
      this.onHitConfirmed(false);
      return true;
    }
    if (!hits.length) {
      const g = groundAt(x, y);
      if (y > VIEW.horizonY + 1) {
        this.fx.groundImpact(x, y, VIEW.focal / g.z / 140);
        if (g.z < 40 && !quiet) audio.play('hit_dirt', { volume: 0.25 * Math.min(1, 12 / g.z), pan, rate: 0.9 + Math.random() * 0.2 });
      }
      return false;
    }
    // A shotgun blast counts as one hit however many pellets land.
    if (!pellet || !this.pelletHit) this.stats.hits++;
    if (pellet) this.pelletHit = true;
    const mods = def.armorPiercing ? withAp(this.activeMods) : this.activeMods;
    let confirmed = false;
    hits.forEach((hit, i) => {
      const z = hit.zombie;
      const reach = def.damage * rangeFalloff(def, z.z);
      const res = bulletDamage(reach, def.headshotMultiplier * this.headshotBoost, hit.zone, z.def, z.armourBroken ? withAp(mods) : mods);
      // The roaring Brute's belly: soft, whatever the hide is elsewhere.
      if (hit.zone === 'torso' && z.weakOpen) {
        res.damage = reach * z.def.special!.roar!.belly * (this.activeMods.has('double') ? MOD_EFFECTS.doubleMultiplier : 1);
        res.deflected = false;
        this.onTrick(z, 'weak');
      }
      const dir = x < z.sx ? 1 : -1;
      const vol = Phaser.Math.Clamp(14 / z.z, 0.25, 1) * (i === 0 ? 1 : 0.6);
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
      if (i === 0) confirmed = res.headshot && !res.deflected;
    });
    if (def.chain) this.chain(def, hits[0].zombie, new Set(hits.map((h) => h.zombie)));
    this.onHitConfirmed(confirmed);
    return true;
  }

  /** Tesla: the bolt jumps from body to body, weaker each time, never to the same one twice. */
  private chain(def: WeaponDef, first: Zombie, seen: Set<Zombie>): void {
    const c = def.chain!;
    const a = { x: 0, y: 0 }, b = { x: 0, y: 0 };
    let from = first;
    let dmg = def.damage;
    for (let k = 0; k < c.jumps; k++) {
      dmg *= c.falloff;
      let next: Zombie | null = null;
      let best = Infinity;
      for (const h of this.enemies.inRadius(from.x, from.z, c.radiusM)) {
        if (!h.zombie.targetable || seen.has(h.zombie) || h.dist >= best) continue;
        best = h.dist;
        next = h.zombie;
      }
      if (!next) return;
      seen.add(next);
      from.chestScreen(a);
      next.chestScreen(b);
      this.fx.tracer(a.x, a.y, b.x, b.y, 1.8, 0.12);
      this.damage(next, dmg * next.def.zoneMultiplier.torso, 'torso', a.x < b.x ? 1 : -1, 'bullet', 0x90d0ff);
      from = next;
    }
  }

  /** Nests, crates and drums that bullets can hit (set by the battle). */
  shootables: Shootables | null = null;

  /**
   * Flamethrower tick: burns everything whose body is inside the stream (a circle of
   * `def.spread` pixels around the aim point) and within reach. Returns bodies hit.
   */
  flame(def: WeaponDef, x: number, y: number): number {
    this.stats.shots++;
    const reach = def.flameRange ?? 20;
    let hitCount = 0;
    for (const z of [...this.enemies.live]) {
      if (!z.targetable || z.z > reach) continue;
      z.chestScreen(tmp);
      const r = def.spread + z.screenWidth * 0.35;
      if (Math.hypot(tmp.x - x, tmp.y - y) > r) continue;
      hitCount++;
      z.burnLeft = Math.max(z.burnLeft, MOD_EFFECTS.burnDuration + 1);
      this.damage(z, def.damage * (this.activeMods.has('double') ? MOD_EFFECTS.doubleMultiplier : 1), 'torso', x < z.sx ? 1 : -1, 'bullet', 0xffa060, false);
    }
    const thing = this.shootables?.at(x, y);
    if (thing && thing.z <= reach) thing.onHit(def.damage, x, y);
    if (hitCount > 0) this.stats.hits++;
    return hitCount;
  }

  /** The Marksman's Sight: headshots hit this much harder. */
  headshotBoost = 1;
  /** Kill-streak cash multiplier (set by the battle). */
  rewardMul = 1;
  /** The Bloom's pods are up: bosses take a fifth of the damage. */
  bossShielded = false;
  /** Every kill, after it is paid (streaks, Focus, squad lines). */
  onKill: (z: Zombie, headshot: boolean, source: DamageSource) => void = () => {};
  /** A shot did more than hurt: it cut a move off, broke armour, hit the soft belly, or knocked down. */
  onTrick: (z: Zombie, what: 'interrupted' | 'shattered' | 'weak' | 'down') => void = () => {};

  /** Set by the first pellet that lands, so a blast counts one hit. Reset per shot. */
  private pelletHit = false;

  /** Starts a new shotgun blast (resets the one-hit-per-blast counter). */
  beginBlast(): void {
    this.pelletHit = false;
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
      if (z.headless && z.state === 'dying' && Math.random() < dt * 36) {
        z.headScreen(tmp);
        this.fx.neckSpurt(tmp.x, tmp.y + 6 * z.scale, z.scale);
      }
    }
  }

  damage(z: Zombie, amount: number, zone: HitZone, dir: number, source: DamageSource, flash: number, react = true): void {
    if (!z.alive || amount <= 0) return;
    if (this.bossShielded && z.def.boss) amount *= 0.2;
    z.hp -= amount;
    if (zone === 'legs' && z.alive) z.hurtLegs();
    const broke = z.hp > 0 ? z.takeHurt(amount, zone) : null;
    if (broke) this.onTrick(z, broke);
    if (react) {
      z.hitReact(dir || 1, Math.min(1, amount / (z.maxHp * 0.6) + 0.35), zone === 'head', flash);
      if (amount >= z.def.staggerThreshold) z.stagger(0.45);
    }
    if (z.hp > 0) return;
    const headshot = zone === 'head' && (source === 'bullet' || source === 'squad');
    // Some get up again, once, unless the head went: only a finished one counts.
    const rises = z.def.special?.rises;
    if (rises && !z.risen && !headshot && (source === 'bullet' || source === 'squad') && Math.random() < rises.chance) {
      z.collapse(rises.health);
      this.onTrick(z, 'down');
      return;
    }
    this.kill(z, headshot, dir, source);
  }

  private kill(z: Zombie, headshot: boolean, dir: number, source: DamageSource): void {
    if (z.resolved) return;
    z.resolved = true;
    z.killedByHeadshot = headshot;
    z.kill(headshot ? 'headshot' : source === 'bullet' || source === 'squad' || source === 'burn' ? 'bullet' : 'blast', dir);
    // Black ink wells up from the ground and swallows where it stood. Most bodies disappear at
    // once; a puppet creature shot dead plays its fall first, and the ink takes it after.
    const swallow = (): void => this.fx.blackSplash(z.sx, z.sy, z.scale, z.screenWidth, z.screenHeight);
    if (z.performsDeath && (source === 'bullet' || source === 'squad' || source === 'burn')) {
      z.onFallen = swallow;
    } else {
      swallow();
      z.vanish();
    }
    this.stats.kills++;
    if (headshot) {
      this.stats.headshotKills++;
      audio.play('headshot_confirm', { volume: 0.5 });
    }
    const reward = Math.round(killReward(z.def, headshot) * this.rewardMul);
    this.economy.earn(reward, headshot ? 'headshot' : 'kill');
    this.onKill(z, headshot, source);
    z.chestScreen(tmp);
    this.fx.floatText(tmp.x, tmp.y - 40 * z.scale - 8, headshot ? `HEADSHOT +$${reward}` : `+$${reward}`, headshot ? '#ff7a50' : '#c8dc90', headshot ? 22 : 18);
    const pan = (z.sx - VIEW.centerX) / VIEW.centerX;
    audio.play(`death_${Math.floor(Math.random() * 3)}`, { volume: Phaser.Math.Clamp(10 / z.z, 0.15, 0.7), pan, rate: z.def.rig === 'run' ? 1.25 : 1 });

    // A Sapper's vest goes off: it hurts the dead around it, and can set off other Sappers.
    const blast = z.def.special?.deathBlast;
    if (blast) {
      this.fx.explosion(z.x, z.z, blast.radius * 0.7);
      audio.play('explosion_small', { volume: Phaser.Math.Clamp(14 / z.z, 0.3, 1), pan });
      this.explode(z.x, z.z, blast.radius, blast.damage, 'enemyBlast');
    }

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
    if (z.def.special?.burstInto) audio.play('carrier_burst', { volume: 0.9 });
    // A Sapper going off at the wall also catches the dead clawing beside it.
    const blast = z.def.special?.deathBlast;
    if (blast) this.explode(z.x, z.z, blast.radius, blast.damage, 'enemyBlast');
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
    // A boss survives the blast: it only loses a share of its health.
    const hit = (z: Zombie, dir: number): void => {
      const boss = z.def.boss;
      this.damage(z, boss ? z.maxHp * boss.nukeShare : 1e6, 'torso', dir, 'support', 0xffffff);
    };
    const first = new Set<Zombie>();
    for (const z of [...this.enemies.live]) {
      if (!z.alive) continue;
      first.add(z);
      hit(z, z.x < 0 ? -1 : 1);
    }
    // crawler bursts from Bloaters caught in the blast die too
    for (const z of [...this.enemies.live]) if (z.alive && !first.has(z)) hit(z, 1);
  }

  static enemyName(id: string): string {
    return ENEMIES[id]?.name ?? id;
  }
}
