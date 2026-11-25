import { AudioEngine, SFX_NAMES } from './audio.js';
import { createInterior, interiorSolids, doorZone, inDoorZone, clampToInterior, InteriorSession } from './interior.js';
import { drawInterior, drawInteriorFade } from './interior_look.js';
import { LevelUp, UPGRADE_DEFS, LEVELUP_CFG, xpToNext, xpForKill } from './levelup.js';
import { createBackdrop, drawBackdrop } from './backdrop.js';
import { Boss, bossTier, BOSS_CFG, drawBoss, drawBossBar } from './boss.js';
import { FlyerSystem, FLYER_CFG, FLYER_BOMB_SHOT, drawFlyer } from './flyers.js';
import { StatusSet, applyElementalOnHit, drawElementalEffects, shockChain, ELEMENT_CFG, ELEMENT_COLORS } from './elements.js';
import { MELEE_CFG, brawlerChance, brawlerKind, brawlerSpeedMul, brawlerXpMul, friendAhead, configureBrawler, drawBrawler } from '../src/melee.js';
var AUDIO = null;
var SND_CLOCK = 0;
var SND_MIN_INTERVAL = { step: 0.12, impact: 0.08, splat: 0.05, tentacle: 0.25, squish: 0.2, hurtAlien: 0.15, burnTick: 0.45, extraShot: 0.08, regenTick: 1.0 };
var SND_DEFAULT_INTERVAL = 0.04;
var SND_LAST = Object.create(null);
export function setAudio(a) { AUDIO = a; }
export function advanceSndClock(dt) { SND_CLOCK += Number.isFinite(dt) ? dt : 0; }
export function snd(name, opts) {
  if (!AUDIO) return false;
  let min = SND_MIN_INTERVAL[name] ?? SND_DEFAULT_INTERVAL;
  if (SND_LAST[name] !== undefined && SND_CLOCK - SND_LAST[name] < min) return false;
  SND_LAST[name] = SND_CLOCK;
  return AUDIO.play(name, opts);
}
export const AUDIO_NAMES_FOR_HARNESS = SFX_NAMES;
// SLIPSHOT - readable working source (de-minified from the backup bundle on 2026-11-22).
// Top-level names were restored by hand (see CODEMAP.md). Local variables keep the esbuild names (e2, t2 ...).
// planck.js (a Box2D port) is embedded in this file; its code lives roughly between the PointerInput class and 'class PhysicsWorld'.
(function() {
  let e2 = document.createElement(`link`).relList;
  if (e2 && e2.supports && e2.supports(`modulepreload`)) return;
  for (let e3 of document.querySelectorAll(`link[rel="modulepreload"]`)) n2(e3);
  new MutationObserver((e3) => {
    for (let t3 of e3) if (t3.type === `childList`) for (let e4 of t3.addedNodes) e4.tagName === `LINK` && e4.rel === `modulepreload` && n2(e4);
  }).observe(document, { childList: true, subtree: true });
  function t2(e3) {
    let t3 = {};
    return e3.integrity && (t3.integrity = e3.integrity), e3.referrerPolicy && (t3.referrerPolicy = e3.referrerPolicy), t3.credentials = e3.crossOrigin === `use-credentials` ? `include` : e3.crossOrigin === `anonymous` ? `omit` : `same-origin`, t3;
  }
  function n2(e3) {
    if (e3.ep) return;
    e3.ep = true;
    let n3 = t2(e3);
    fetch(e3.href, n3);
  }
})();
var LAND_CFG = { maxAir: 4, grace: 0.4 };
var PHYS_CFG = { fixedDt: 1 / 120, maxFrameDt: 0.05, gravityY: -9.8, velocityIterations: 10, positionIterations: 4 }, ARENA_CFG = { bounds: 40, killY: -4, playerSpawnX: -11, enemySpawnXs: [10.5, 13.5, 16] }, ENDLESS_CFG = { chunkW: 16, ahead: 4, behind: 3, overlap: 0.25, cullDistance: 70, viewHalfWidth: 14, spawnMin: 16, spawnMax: 20, spawnSpacing: 2.5, maxAlive: 8, maxRagdolls: 14, maxProjectiles: 24, enemyCull: 40, firstSpawn: 3, intervalStart: 6, intervalMin: 2.2, intervalDecay: 0.04, levelEvery: 40, aliveStart: 1, aliveEvery: 30, hordeEvery: 90, hordeDuration: 8, hordeMaxExtra: 2, maxWells: 4, speedMulMin: 0.6, speedMulMax: 0.85, holdMin: 9, holdMax: 13, playerDamageMul: 0.6, healPerKo: 10, regenDelay: 5, regenPerSec: 1, dropMin: 8, dropMax: 12, dropHeight: 10, dropperFromLevel: 2, dropperChance: 0.3, rollerFromTime: 40, rollerIntervalStart: 18, rollerIntervalMin: 9, rollerIntervalDecay: 0.05, rollerMaxAlive: 2, rollerSpeedMin: 8, rollerSpeedMax: 10, rollerSize: 0.7, rollerMass: 30, rollerSpawn: 19, rollerCull: 45, rollerLife: 10, enemyJumpPush: 3.5, ...FLYER_CFG }; var TERRAIN_CFG = { maxSlopeDeg: 16, margin: 0.5, startBarricadeU: 13, weights: { flat: 0.2, barricade: 0.2, barricades: 0.15, hill: 0.2, tower: 0.25 } };
// `tower` is the BACKGROUND BUILDING: a huge (~24 m wide, ~14 m tall) purple-colony house drawn behind everything. It is pure decoration with NO collision (no planck body/fixture, empty `parts`), so players/enemies/boulders/projectiles pass straight through it and it never affects `isSolid`/`surfaceY`/`findSpawnX`. The other terrain types (barricade/barricades/hill) stay physical cover.
var STAMINA_CFG = { max: 100, regen: 12, jumpGround: 24, jumpAir: 34, jumpSpeed: 6.5 }, RECOVER_CFG = { playerCost: 20, hopSpeed: 3.6, rightingTime: 1, rightingTorque: 100, cooldown: 0.6, autoGetUpDelay: 0.15, stuckTime: 3.5, escalateHop: 1.7, escalateRighting: 1.5, escalateTorque: 2, enemyDelayMin: 0.55, enemyDelayMax: 1.15, enemyRetryMin: 0.9, enemyRetryMax: 1.6 }, COMBO_CFG = { window: 2.6, max: 99, scorePerHit: 0.1, coinPerHit: 0.04, maxScoreMultiplier: 2, maxCoinMultiplier: 1.5 }, FORTRESS_CFG = { grid: 0.25, maxHeight: 7.5, shotDamage: 14, debrisLife: 6, cannonReload: 3.2, decoyChance: 0.5, telescopeReach: 2 }, COMBAT_CFG = { playerMaxHp: 100, enemyBaseHp: 70, enemyHpPerWave: 8, healOnWaveClear: 15, impactThreshold: 4.2, impactDamagePerSpeed: 3.4, impactDamageCap: 26, impactCooldown: 0.22, projectileBaseDamage: 3, projectileDamagePerSpeed: 1.2, projectileDamageCap: 46, staggerSpeed: 6.5, headMultiplier: 1.7, torsoMultiplier: 1, limbMultiplier: 0.75 }, SLIME_CFG = { projectileMass: 0.9, projectileRadius: 0.16, launchMin: 7, launchMax: 21, powerPerLevel: 0.16, splatPerLevel: 0.3, splatBase: 0.8, durationPerLevel: 0.4, coatBase: 3.6, puddleBase: 6.5, puddleThickness: 0.035, maxPuddles: 14, puddleFriction: 0.025, coatFootFriction: 0.04, coatBodyFriction: 0.12, coatObjectFriction: 0.06, gumLife: 6, maxGums: 24, maxGumsPerHost: 4, maxGumsPerPart: 2, gumDensity: 0.35 }, TAU = Math.PI * 2;
function terrainRng(e2, t2, n2 = 0) {
  let r2 = (e2 >>> 0) ^ Math.imul(t2 | 0, 0x9e3779b1) ^ Math.imul(n2 | 0, 0x85ebca6b);
  r2 = Math.imul(r2 ^ (r2 >>> 16), 0x7feb352d), r2 = Math.imul(r2 ^ (r2 >>> 15), 0x846ca68b), r2 ^= r2 >>> 16;
  let i2 = r2 >>> 0;
  return () => {
    i2 = (i2 + 0x6d2b79f5) >>> 0;
    let a2 = i2;
    a2 = Math.imul(a2 ^ (a2 >>> 15), a2 | 1), a2 ^= a2 + Math.imul(a2 ^ (a2 >>> 7), a2 | 61);
    return ((a2 ^ (a2 >>> 14)) >>> 0) / 4294967296;
  };
}
function terrainRawType(e2, t2) {
  let n2 = terrainRng(e2, t2, 17)(), r2 = TERRAIN_CFG.weights, i2 = n2 * (r2.flat + r2.barricade + r2.barricades + r2.hill + r2.tower);
  return (i2 -= r2.flat) < 0 ? `flat` : (i2 -= r2.barricade) < 0 ? `barricade` : (i2 -= r2.barricades) < 0 ? `barricades` : (i2 -= r2.hill) < 0 ? `hill` : `tower`;
}
function terrainTemplate(e2, t2) {
  let n2 = e2 >>> 0, r2 = t2 | 0;
  if (r2 === -1) return { type: `barricade`, mirror: false, u: TERRAIN_CFG.startBarricadeU, h: 1.1, thickness: 0.7, raw: `barricade` };
  if (r2 === 0) return { type: `flat`, mirror: false, raw: terrainRawType(n2, 0) };
  let i2 = terrainRawType(n2, r2), a2 = terrainRng(n2, r2, 31), o2 = a2() < 0.5, s2 = i2, l2 = r2 - 1;
  if ((i2 === `hill` || i2 === `tower`) && (terrainRawType(n2, l2) === `hill` || terrainRawType(n2, l2) === `tower`)) s2 = `flat`;
  let c2 = { type: s2, mirror: o2, raw: i2 };
  if (s2 === `barricade`) c2.u = 5 + a2() * 6, c2.h = 1 + a2() * 0.2, c2.thickness = 0.7;
  else if (s2 === `barricades`) c2.u1 = 4.5 + a2() * 2, c2.u2 = 10 + a2() * 2, c2.h1 = 0.9 + a2() * 0.3, c2.h2 = 1 + a2() * 0.2, c2.thickness = 0.7;
  else if (s2 === `hill`) c2.rise = 1.8, c2.run = c2.rise / Math.tan(TERRAIN_CFG.maxSlopeDeg * Math.PI / 180);
  else if (s2 === `tower`) c2.doorX = 3 + a2() * 10, c2.doorMirror = a2() < 0.5, c2.seed = Math.floor(a2() * 4294967296);
  return c2;
}
function terrainGeometry(e2, t2) {
  let n2 = t2 * ENDLESS_CFG.chunkW, r2 = n2 + ENDLESS_CFG.chunkW, i2 = TERRAIN_CFG.margin, a2 = ENDLESS_CFG.chunkW - i2, o2 = [], s2 = (u2) => e2.mirror ? r2 - u2 : n2 + u2;
  let l2 = (c2, f2) => {
    let p2 = c2.map((d2) => ({ x: s2(d2[0]), y: d2[1] }));
    e2.mirror && p2.reverse();
    return { kind: f2, poly: p2 };
  };
  let c2 = (u2, h2, w2) => l2([[u2 - w2 / 2, 0], [u2 + w2 / 2, 0], [u2 + w2 / 2, h2], [u2 - w2 / 2, h2]], `box`);
  if (e2.type === `barricade`) o2.push(c2(e2.u, e2.h, e2.thickness));
  else if (e2.type === `barricades`) o2.push(c2(e2.u1, e2.h1, e2.thickness), c2(e2.u2, e2.h2, e2.thickness));
  else if (e2.type === `hill`) o2.push(l2([[i2, 0], [a2, 0], [a2 - e2.run, e2.rise], [i2 + e2.run, e2.rise]], `ramp`));
  else if (e2.type === `tower`) {
    // BACKGROUND BUILDING: pure decoration, no collision geometry. `doorX` (and `doorMirror`) only record the door centre in local chunk coords so `findTowerDoor` can place the "E - enter" hint in front of it.
  }
  return o2;
}
// Assisted locomotion tuning: rigid-slide walk speed, accel/brake, air control, and stride animation.
var MOVE_CFG = { walkSpeed: 3, groundAccel: 9, brakeAccel: 14, airControl: 6, strideAmp: 0.28, kneeAmp: 0.18, strideRate: 3.2, turnCooldown: 0.15, hitDeviation: 1.8 };
// Standing balance assist: pelvis righting gains (no dead zone, unlike the original weak assist).
var BALANCE_CFG = { kp: 500, kd: 90, maxTorque: 400 };
// Knockback response: projectile momentum factor, upward lift, tumble and stagger scaling.
var KNOCK_CFG = { factor: 8, lift: 0.25, tumble: 0.06, maxTumble: 3, staggerMin: 15, staggerBase: 0.1, staggerPerImpulse: 0.0075, staggerMax: 1.2, walkStagger: 0.3, hitLock: 0.18, maxSpeed: 2.8, playerShove: 0.3, playerShoveMax: 40, playerHitLock: 0, playerShoveSpeedMax: 1.5, playerBlastScale: 0.3, maxPartSpeed: 22, maxPartSpin: 16, gumPartDv: 2.2 };
function clamp(e2, t2, n2) {
  return e2 < t2 ? t2 : e2 > n2 ? n2 : e2;
}
function lerp(e2, t2, n2) {
  return e2 + (t2 - e2) * n2;
}
function randRange(e2, t2) {
  return e2 + Math.random() * (t2 - e2);
}
function gaussian() {
  let e2 = 0, t2 = 0;
  for (; e2 === 0; ) e2 = Math.random();
  for (; t2 === 0; ) t2 = Math.random();
  return Math.sqrt(-2 * Math.log(e2)) * Math.cos(TAU * t2);
}
function wrapAngle(e2) {
  let t2 = (e2 + Math.PI) % TAU;
  return t2 < 0 && (t2 += TAU), t2 - Math.PI;
}
function approach(e2, t2, n2) {
  return e2 < t2 ? Math.min(e2 + n2, t2) : Math.max(e2 - n2, t2);
}
function smoothFactor(e2, t2) {
  return 1 - Math.exp(-e2 * t2);
}
function stepBallistic(t2, n2, r2) {
  t2.y += PHYS_CFG.gravityY * r2;
  let i2 = 1 / (1 + r2 * 0.03);
  t2.x *= i2, t2.y *= i2, n2.x += t2.x * r2, n2.y += t2.y * r2;
}
function simulateThrowPath(e2, t2, n2, r2 = 2.6, i2 = 0.07) {
  let a2 = 1 / 120, o2 = { x: n2.x, y: n2.y }, s2 = { x: t2.x, y: t2.y }, c2 = [{ x: s2.x, y: s2.y }], l2 = i2, u2 = 0;
  for (; u2 < r2; ) {
    if (stepBallistic(o2, s2, a2), u2 += a2, e2.isSolid(s2.x, s2.y)) return { points: c2, landing: { x: s2.x, y: s2.y } };
    if (s2.y < -6 || (e2.mode === `endless` ? s2.x < e2.groundSpan.minX - 20 || s2.x > e2.groundSpan.maxX + 20 : Math.abs(s2.x) > 60)) break;
    u2 >= l2 && (c2.push({ x: s2.x, y: s2.y }), l2 += i2);
  }
  return { points: c2, landing: null };
}
function solveShotDirection(e2, t2, n2, r2) {
  let i2 = Math.sign(n2.x - t2.x) || 1, a2 = (a3) => {
    let o3 = { x: Math.cos(a3) * r2 * i2, y: Math.sin(a3) * r2 }, s3 = { x: t2.x, y: t2.y };
    for (let t3 = 0; t3 < 1200; t3++) {
      if (stepBallistic(o3, s3, 0.008333333333333333), e2.isSolid(s3.x, s3.y)) return -50;
      if ((s3.x - n2.x) * i2 >= 0) return s3.y - n2.y;
      if (s3.y < -6) return -50;
    }
    return -50;
  }, o2 = -0.25, s2 = o2, c2 = a2(o2);
  for (let e3 = 1; e3 <= 48; e3++) {
    let t3 = o2 + 1.55 * e3 / 48, n3 = a2(t3);
    if (c2 < 0 && n3 >= 0) {
      let e4 = s2, n4 = t3;
      for (let t4 = 0; t4 < 18; t4++) {
        let t5 = (e4 + n4) / 2;
        a2(t5) < 0 ? e4 = t5 : n4 = t5;
      }
      let r3 = (e4 + n4) / 2;
      return { x: Math.cos(r3) * i2, y: Math.sin(r3) };
    }
    s2 = t3, c2 = n3;
  }
  return null;
}
var ENEMY_BASE_SHOT_SPEED = 13.5, EnemyAI = class {
  constructor(e2, t2, n2, r2 = null) {
    this.body = e2, this.arena = t2, this.windup = 0, this.retarget = 0, this.plan = null, this.decoy = null, this.aimAtDecoy = false, this.aimNoise = 0, this.speedNoise = 1, this.reload = n2, this.weapon = r2?.weapon ?? null, this.weaponLevel = r2?.level ?? 1;
  }
  onRecovered() {
    this.reload = Math.min(this.reload, 0.7), this.windup = 0, this.retarget = 0, this.plan = null;
  }
  update(e2, t2, n2, r2, i2 = null, o2 = null) {
    if (this.body.carriedBy) {
      this.decoy = i2;
      if (!this.body.alive || !t2 || !t2.alive) {
        this.body.setAim(null), this.windup = 0;
        return;
      }
      if (this.melee) return;
      const tp2 = t2.torsoPosition(), mp2 = this.body.torsoPosition();
      let cdx = tp2.x - mp2.x, cdy = tp2.y - mp2.y;
      const cd = Math.hypot(cdx, cdy) || 1;
      cdx /= cd, cdy /= cd;
      this.body.setAim(dirToAimAngle({ x: cdx, y: cdy }));
      if (this.windup <= 0 && (this.reload -= e2, this.reload <= 0 && (this.windup = Math.max(0.35, 0.7 - 0.02 * n2)))) return;
      if (this.windup > 0 && (this.windup -= e2, this.windup <= 0)) {
        this.windup = 0;
        if (r2) {
          const mz = this.body.muzzle({ x: cdx, y: cdy });
          r2(this.body, mz, { x: cdx, y: cdy }, ENEMY_BASE_SHOT_SPEED + 0.25 * Math.min(n2, 10));
        }
        this.reload = (this.weapon ? Math.min(ENEMY_WEAPON_CFG.reloadMax, Math.max(ENEMY_WEAPON_CFG.reloadMin, this.weapon.cooldown * ENEMY_WEAPON_CFG.reloadMul - 0.06 * ((this.weaponLevel ?? n2) - 1))) : Math.max(1.4, 3.1 - 0.22 * (n2 - 1))) + randRange(0, 0.7);
      }
      return;
    }
    if (this.decoy = i2, !this.body.alive || !t2 || !t2.alive || !this.body.isStanding()) {
      this.body.setAim(null), this.windup = 0;
      return;
    }
    if (this.body.status && (this.body.status.frozen || this.body.status.stunned)) {
      this.body.setAim(null);
      this.windup = 0;
      this.reload = Math.max(this.reload, 0.5);
      return;
    }
    if (this.melee) {
      this.body.meleeAttack?.update(e2, t2);
      return;
    }
    if (this.windup <= 0 && (this.reload -= e2, this.reload <= 0 && (this.windup = Math.max(0.45, 0.78 - 0.03 * n2), this.aimAtDecoy = i2 !== null && Math.random() < FORTRESS_CFG.decoyChance, this.aimNoise = gaussian() * Math.max(0.03, 0.13 - 0.012 * (n2 - 1)), this.speedNoise = 1 + gaussian() * 0.04, this.retarget = 0)), this.retarget -= e2, this.retarget <= 0 && (this.retarget = 0.2, this.plan = this.solve(t2, n2)), !this.plan) {
      this.body.setAim(null);
      return;
    }
    let l2 = Math.atan2(this.plan.dir.y, this.plan.dir.x), s2 = this.windup > 0 ? l2 + this.aimNoise : l2, c2 = { x: Math.cos(s2), y: Math.sin(s2) };
    if (this.body.setAim(dirToAimAngle(c2)), this.windup > 0 && (this.windup -= e2, this.windup <= 0)) {
      this.windup = 0;
      let e3 = this.body.muzzle(c2);
      r2(this.body, e3, c2, this.plan.speed * this.speedNoise), this.reload = (this.weapon || o2?.weapon ? Math.min(ENEMY_WEAPON_CFG.reloadMax, Math.max(ENEMY_WEAPON_CFG.reloadMin, (this.weapon ?? o2.weapon).cooldown * ENEMY_WEAPON_CFG.reloadMul - 0.06 * ((this.weaponLevel ?? o2?.level ?? n2) - 1))) : Math.max(1.4, 3.1 - 0.22 * (n2 - 1))) + randRange(0, 0.7), this.plan = null;
    }
  }
  solve(e2, t2) {
    let n2 = e2.torsoPosition(), r2 = this.aimAtDecoy && this.decoy ? { x: this.decoy.x, y: this.decoy.y } : { x: n2.x, y: n2.y + 0.1 }, i2 = this.body.torsoPosition(), a2 = r2.x - i2.x, o2 = r2.y - i2.y, s2 = Math.hypot(a2, o2) || 1, c2 = this.body.muzzle({ x: a2 / s2, y: o2 / s2 }), l2 = ENEMY_BASE_SHOT_SPEED + 0.25 * Math.min(t2, 10);
    for (let e3 of [1, 1.12, 0.92, 1.25]) {
      let t3 = l2 * e3, n3 = solveShotDirection(this.arena, c2, r2, t3);
      if (n3) return { dir: n3, speed: t3 };
    }
    return null;
  }
};
var EnemyWalker = class {
  constructor(e2, t2 = {}) {
    this.body = e2, this.hold = t2.hold ?? randRange(9, 13), this.approachMargin = t2.approachMargin ?? 1, this.spacing = t2.spacing ?? 1.5, e2.speedMul = t2.speedMul ?? 1, this.blockedFor = 0, this.jumpCooldown = 0, this.hopping = false;
  }
  update(e2, t2, n2 = []) {
    let r2 = this.body;
    this.jumpCooldown = Math.max(0, this.jumpCooldown - e2);
    let i2 = r2.torsoPosition();
    if (!r2.alive || !t2 || !t2.alive || !r2.isStanding()) {
      r2.moveAxis = 0, this.blockedFor = 0, this.hopping = false;
      return;
    }
    this.hopping && r2.grounded && Math.abs(r2.torsoBody.getLinearVelocity().y) < 0.6 && (this.hopping = false);
    let statusSpeedMul = r2.status ? r2.status.speedMul : 1;
    let o2 = t2.torsoPosition().x - i2.x, s2 = Math.sign(o2) || 1, a2 = Math.abs(o2), want = a2 > this.hold + this.approachMargin ? s2 : 0, c2 = want, staticFriend = false, spacingBlock = false;
    if (want !== 0 && !this.melee) for (let l2 of n2) {
      if (l2 === r2 || l2 === t2) continue;
      let d2 = l2.torsoPosition().x - i2.x;
      if (Math.sign(d2) === want && Math.abs(d2) < this.spacing) {
        if (!l2.alive) { staticFriend = true; continue; }
        let fw = l2.walker;
        spacingBlock = true, staticFriend = Math.abs(l2.centerOfMass().vx) < 0.5 && !(fw && Math.abs(t2.torsoPosition().x - l2.torsoPosition().x) <= fw.hold + fw.approachMargin), c2 = 0;
        break;
      }
    }
    if (this.melee && want !== 0 && friendAhead(r2, n2, want, this.hopRange)) staticFriend = true;
    r2.moveAxis = this.hopping && want !== 0 ? s2 : c2, c2 === 0 && r2.facing !== s2 && r2.setFacing(s2);
    let slow = Math.abs(r2.centerOfMass().vx) < MOVE_CFG.walkSpeed * r2.speedMul * statusSpeedMul * 0.25;
    if (want !== 0 && (!this.melee || staticFriend || slow) && (slow || staticFriend) && (!spacingBlock || staticFriend) && r2.grounded) {
      if ((this.blockedFor += e2) > 0.35 && this.jumpCooldown <= 0 && !r2.status?.frozen) {
        r2.launchUp(STAMINA_CFG.jumpSpeed);
        for (let p2 of r2.parts.values()) p2.body.applyLinearImpulse({ x: want * ENDLESS_CFG.enemyJumpPush * p2.spec.mass, y: 0 }, p2.body.getPosition(), true);
        this.hopping = true, this.blockedFor = 0, this.jumpCooldown = 0.8;
      }
    } else this.blockedFor = 0;
  }
};
var EndlessDirector = class {
  constructor(e2 = ENDLESS_CFG, t2 = Math.random) {
    this.cfg = e2, this.rng = t2, this.time = 0, this.timer = e2.firstSpawn, this.rollerTimer = e2.rollerFromTime, this.flyerTimer = e2.firstFlyer, this.flyerWaveIndex = 0, this.nextHorde = e2.hordeEvery, this.hordeQueue = [], this.hordeUntil = 0, this.hordeAlert = false;
  }
  level(e2 = this.time) {
    return 1 + Math.floor(e2 / this.cfg.levelEvery);
  }
  allowedAlive(e2 = this.time) {
    return Math.min(this.cfg.maxAlive, this.cfg.aliveStart + Math.floor(e2 / this.cfg.aliveEvery));
  }
  interval(e2 = this.time) {
    return Math.max(this.cfg.intervalMin, this.cfg.intervalStart - this.cfg.intervalDecay * e2);
  }
  walkSpeedMul(e2 = this.time) {
    return Math.min(1.3, 1 + 0.02 * (this.level(e2) - 1));
  }
  queueHorde(e2, t2) {
    let n2 = this.cfg, r2 = Math.min(6, 2 + Math.floor(this.level(this.nextHorde) / 2));
    this.hordeUntil = this.nextHorde + n2.hordeDuration, this.hordeAlert = true;
    for (let i2 = 0; i2 < r2; i2++) this.hordeQueue.push({ at: this.nextHorde + (i2 + 1) * n2.hordeDuration / (r2 + 1), side: i2 % 2 ? 1 : -1, offset: n2.spawnMin + this.rng() * (n2.spawnMax - n2.spawnMin), hold: n2.holdMin + this.rng() * (n2.holdMax - n2.holdMin) });
    this.nextHorde += n2.hordeEvery;
  }
  updateHorde(e2) {
    let n2 = this.cfg;
    for (; this.time >= this.nextHorde; ) this.queueHorde(e2);
    if (!this.hordeQueue.length || this.time < this.hordeQueue[0].at) return null;
    let r2 = this.hordeQueue[0], i2 = Math.min(n2.maxAlive + n2.hordeMaxExtra, this.allowedAlive() + n2.hordeMaxExtra);
    if (e2.aliveXs.length >= i2 || e2.ragdollCount >= n2.maxRagdolls) return null;
    this.hordeQueue.shift();
    return { kind: `walker`, x: e2.playerX + r2.side * r2.offset, y: 0, side: r2.side, speedMul: (n2.speedMulMin + this.rng() * (n2.speedMulMax - n2.speedMulMin)) * this.walkSpeedMul(), hold: r2.hold, horde: true };
  }
  update(e2, t2) {
    let n2 = this.cfg, r3 = null, o2 = t2.normalAliveXs ?? t2.aliveXs;
    if (this.time += e2, r3 = this.updateHorde(t2), this.timer -= e2, this.timer > 0) return r3;
    if (r3) return this.timer = 0.02, r3;
    if (o2.length >= this.allowedAlive() || t2.ragdollCount >= n2.maxRagdolls) return this.timer = 0.25, null;
    let a3 = this.level() >= n2.dropperFromLevel && this.rng() < n2.dropperChance, r2 = this.rng() < 0.5 ? -1 : 1, i2 = t2.playerX + r2 * (a3 ? n2.dropMin + this.rng() * (n2.dropMax - n2.dropMin) : n2.spawnMin + this.rng() * (n2.spawnMax - n2.spawnMin));
    if (o2.some((e3) => Math.abs(e3 - i2) < n2.spawnSpacing)) {
      r2 = -r2, i2 = t2.playerX + r2 * (a3 ? n2.dropMin + this.rng() * (n2.dropMax - n2.dropMin) : n2.spawnMin + this.rng() * (n2.spawnMax - n2.spawnMin));
      if (o2.some((e3) => Math.abs(e3 - i2) < n2.spawnSpacing)) return this.timer = 0.25, null;
    }
    return this.timer = this.interval() * (0.8 + 0.4 * this.rng()), { kind: a3 ? `dropper` : brawlerKind(this.level(), this.rng), x: i2, y: a3 ? n2.dropHeight : 0, side: r2, speedMul: n2.speedMulMin + this.rng() * (n2.speedMulMax - n2.speedMulMin), hold: n2.holdMin + this.rng() * (n2.holdMax - n2.holdMin) };
  }
  updateRoller(e2, t2) {
    let n2 = this.cfg;
    if (this.rollerTimer -= e2, this.rollerTimer > 0) return null;
    if (t2.rollerCount >= n2.rollerMaxAlive) return this.rollerTimer = 0.5, null;
    let r2 = this.rng() < 0.5 ? -1 : 1;
    return this.rollerTimer = Math.max(n2.rollerIntervalMin, n2.rollerIntervalStart - n2.rollerIntervalDecay * this.time) * (0.8 + 0.4 * this.rng()), { kind: `roller`, x: t2.playerX + r2 * n2.rollerSpawn, side: r2, speed: n2.rollerSpeedMin + this.rng() * (n2.rollerSpeedMax - n2.rollerSpeedMin), size: n2.rollerSize, mass: n2.rollerMass };
  }
  updateFlyers(e2, t2) {
    let n2 = this.cfg;
    if (this.flyerTimer -= e2, this.flyerTimer > 0) return null;
    if (t2.inside) return this.flyerTimer = 0.5, null;
    let r2 = Math.min(n2.maxFlyersCap, n2.maxFlyers + Math.floor(this.time / n2.flyerRamp));
    if (t2.flyerCount >= r2 || (t2.bossAlive && t2.flyerCount >= n2.flyerBossMax)) return this.flyerTimer = 0.5, null;
    let i2 = this.time < n2.firstFlyer + 20 ? 'glider' : n2.waveTypes[this.flyerWaveIndex++ % n2.waveTypes.length];
    let a3 = this.rng() < 0.5 ? -1 : 1, s2 = n2[i2] ? n2[i2].altitude : n2.glider.altitude;
    return this.flyerTimer = Math.max(n2.flyerWaveMin, n2.flyerWaveEvery - n2.flyerWaveDecay * this.time), { type: i2, x: t2.playerX + a3 * (n2.viewHalfWidth + 4 + this.rng() * 3), y: s2 + (this.rng() - 0.5) * 1.5, side: a3, height: s2 };
  }
  reset() {
    this.time = 0, this.timer = this.cfg.firstSpawn, this.rollerTimer = this.cfg.rollerFromTime, this.flyerTimer = this.cfg.firstFlyer, this.flyerWaveIndex = 0, this.nextHorde = this.cfg.hordeEvery, this.hordeQueue.length = 0, this.hordeUntil = 0, this.hordeAlert = false;
  }
};
var EndlessVitals = class {
  constructor(e2 = ENDLESS_CFG) {
    this.cfg = e2, this.since = 0, this.prevHp = 0;
  }
  reset(e2) {
    this.since = 0, this.prevHp = e2;
  }
  update(e2, t2, runStats) {
    if (!t2.alive) return 0;
    if (t2.hp < this.prevHp - 1e-6) this.since = 0;
    else this.since += e2;
    let n2 = t2.hp;
    const regenDelay = this.cfg.regenDelay;
    const regenPerSec = runStats?.regenPerSec ?? this.cfg.regenPerSec;
    if (this.since >= regenDelay && regenPerSec > 0) t2.hp = Math.min(t2.maxHp, t2.hp + regenPerSec * e2);
    return this.prevHp = t2.hp, Math.max(0, t2.hp - n2);
  }
  onKo(e2) {
    if (!e2.alive) return this.prevHp = e2.hp, 0;
    let t2 = e2.hp;
    e2.hp = Math.min(e2.maxHp, e2.hp + this.cfg.healPerKo);
    return this.prevHp = e2.hp, Math.max(0, e2.hp - t2);
  }
};
// Boss physics push (task 8a): a moving boss circle ("pusher") shoves dynamic bodies it overlaps. Pure: returns the impulse for one fixed step, or null.
export function bossPushImpulse(p, x, y, mass, bodyR = 0.3, dt = 1 / 120) {
  if (!p || !(p.r > 0) || !(mass > 0)) return null;
  const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy), reach = p.r + bodyR;
  if (!(d < reach)) return null;
  const fall = 1 - d / reach, sp = Math.hypot(p.vx || 0, p.vy || 0);
  let ux = d > 1e-4 ? dx / d : 0, uy = d > 1e-4 ? dy / d : 1;
  if (sp > 0.5) {
    ux = 0.7 * p.vx / sp + 0.3 * ux, uy = 0.7 * p.vy / sp + 0.3 * uy;
    const l = Math.hypot(ux, uy) || 1;
    ux /= l, uy /= l;
  }
  const k = mass * Math.min(60, (p.power || 0) * fall * 9) * dt;
  return { x: ux * k, y: uy * k };
}
var BOSS_SCHED_CFG = { first: 420, afterDeath: 360 };
var BossScheduler = class {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.reset();
  }
  reset() {
    this.bossesDefeated = 0;
    this.lastBossDeathTime = -BOSS_SCHED_CFG.first;
    this.bossAlive = false;
    this.insideBuilding = false;
  }
  update(dt, { directorTime, bossAlive, inside }) {
    if (dt <= 0 || !Number.isFinite(dt)) return null;
    this.bossAlive = bossAlive;
    this.insideBuilding = inside;
    if (this.bossAlive || this.insideBuilding) return null;
    const nextSpawnTime = this.bossesDefeated === 0 ? BOSS_SCHED_CFG.first : this.lastBossDeathTime + BOSS_SCHED_CFG.afterDeath;
    if (directorTime >= nextSpawnTime) {
      const tier = 1 + this.bossesDefeated;
      this.bossAlive = true;
      return { spawn: true, tier };
    }
    return null;
  }
  onBossDead(directorTime) {
    this.bossesDefeated++;
    this.lastBossDeathTime = directorTime;
    this.bossAlive = false;
  }
};
// SlimeBody (task 3a): pure-logic tentacles + volume-preserving squash. No canvas, no physics world, not wired into Game yet.
var SLIMEBODY_CFG = { gravity: -9.8, drag: 3.0, iterations: 4, maxStep: 1 / 30, maxSegStretch: 1.15, squashK: 70, squashDamp: 9, squashAccel: 0.012, squashMin: 0.65, squashMax: 1.45, kickRadius: 0.9, postDamp: 12 };
var SLIME_TENTACLE_DEFS = [
  { id: `backA`, anchor: `torso`, local: { x: -0.12, y: 0.12 }, dir: { x: -0.9, y: 0.5 }, segs: 6, segLen: 0.11, width0: 0.19, width1: 0.02, bend: 0.09, gravityScale: 0.7 },
  { id: `backB`, anchor: `torso`, local: { x: -0.12, y: -0.10 }, dir: { x: -0.9, y: -0.15 }, segs: 6, segLen: 0.10, width0: 0.17, width1: 0.02, bend: 0.09, gravityScale: 0.7 },
  { id: `crestA`, anchor: `head`, local: { x: -0.09, y: 0.17 }, dir: { x: -0.55, y: 1 }, segs: 3, segLen: 0.085, width0: 0.10, width1: 0.012, bend: 0.6, gravityScale: 0.3 },
  { id: `crestB`, anchor: `head`, local: { x: 0.09, y: 0.17 }, dir: { x: 0.55, y: 1 }, segs: 3, segLen: 0.08, width0: 0.10, width1: 0.012, bend: 0.6, gravityScale: 0.3 },
  { id: `tail`, anchor: `pelvis`, local: { x: -0.06, y: -0.08 }, dir: { x: -0.6, y: -0.8 }, segs: 7, segLen: 0.11, width0: 0.20, width1: 0.012, bend: 0.10, gravityScale: 0.7 },
];
var SlimeBody = class {
  constructor(defs = SLIME_TENTACLE_DEFS, rng = Math.random, cfg = SLIMEBODY_CFG) {
    this.cfg = cfg, this.rng = rng;
    this.tentacles = defs.map((def) => ({ def, pts: [], len: def.segs * def.segLen, placed: false }));
    this.sx = 1, this.sy = 1, this.svx = 0, this.svy = 0;
    this.tipSpeed = 0, this.squashSpeed = 0;
    this.phase = rng() * TAU;
    this.lastVx = 0, this.lastVy = 0, this.hasLastV = false;
  }
  reset() {
    for (let tent of this.tentacles) tent.pts.length = 0, tent.placed = false;
    this.sx = 1, this.sy = 1, this.svx = 0, this.svy = 0;
    this.tipSpeed = 0, this.squashSpeed = 0;
    this.lastVx = 0, this.lastVy = 0, this.hasLastV = false;
  }
  update(dt, parts, facing = 1) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, this.cfg.maxStep);
    let cfg = this.cfg, mirror = facing < 0 ? -1 : 1, tip = 0;
    for (let tent of this.tentacles) {
      let def = tent.def, part = parts[def.anchor];
      if (!part) continue;
      let segLen = def.segLen, ca = Math.cos(part.a || 0), sa = Math.sin(part.a || 0);
      let lx = def.local.x * mirror, ly = def.local.y;
      let rootX = part.x + lx * ca - ly * sa, rootY = part.y + lx * sa + ly * ca;
      let dx = def.dir.x * mirror * ca - def.dir.y * sa, dy = def.dir.x * mirror * sa + def.dir.y * ca;
      let dl = Math.hypot(dx, dy) || 1;
      dx /= dl, dy /= dl;
      let pts = tent.pts;
      if (!tent.placed) {
        pts.length = 0;
        for (let i = 0; i <= def.segs; i++) {
          let x = rootX + dx * segLen * i, y = rootY + dy * segLen * i;
          pts.push({ x, y, px: x, py: y });
        }
        tent.placed = true;
        continue;
      }
      let root = pts[0];
      root.x = root.px = rootX, root.y = root.py = rootY;
      let damp = Math.exp(-cfg.drag * dt), gy = cfg.gravity * def.gravityScale * dt * dt;
      for (let i = 1; i < pts.length; i++) {
        let p = pts[i], vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
        p.px = p.x, p.py = p.y;
        p.x += vx, p.y += vy + gy;
        tip = Math.max(tip, Math.hypot(p.x - p.px, p.y - p.py) / dt);
      }
      for (let it = 0; it < cfg.iterations; it++) {
        for (let i = 0; i < pts.length - 1; i++) {
          let p = pts[i], q = pts[i + 1], ex = q.x - p.x, ey = q.y - p.y, d = Math.hypot(ex, ey);
          if (d < 1e-12) continue;
          let err = (d - segLen) / d;
          if (i === 0) q.x -= ex * err, q.y -= ey * err;
          else {
            let half = err * 0.5;
            p.x += ex * half, p.y += ey * half, q.x -= ex * half, q.y -= ey * half;
          }
        }
        if (def.bend > 0) {
          let bend = def.bend / cfg.iterations;
          for (let i = 1; i < pts.length; i++) {
            let tx, ty;
            if (i === 1) tx = dx, ty = dy;
            else {
              let a = pts[i - 2], b = pts[i - 1], ex = b.x - a.x, ey = b.y - a.y, el = Math.hypot(ex, ey) || 1;
              tx = ex / el, ty = ey / el;
            }
            let p = pts[i - 1], q = pts[i];
            q.x += (p.x + tx * segLen - q.x) * bend;
            q.y += (p.y + ty * segLen - q.y) * bend;
          }
        }
      }
      let keep = Math.exp(-cfg.postDamp * dt), lo = segLen * 0.5, hi = segLen * cfg.maxSegStretch;
      for (let i = 0; i < pts.length - 1; i++) {
        let p = pts[i], q = pts[i + 1], ex = q.x - p.x, ey = q.y - p.y, d = Math.hypot(ex, ey);
        if (d < 1e-12 || (d <= hi && d >= lo)) continue;
        let nd = d > hi ? hi : lo;
        q.x = p.x + ex / d * nd, q.y = p.y + ey / d * nd;
      }
      for (let i = 1; i < pts.length; i++) {
        let p = pts[i];
        p.px = p.x - (p.x - p.px) * keep, p.py = p.y - (p.y - p.py) * keep;
      }
    }
    let torso = parts.torso;
    if (torso) {
      let vx = Number.isFinite(torso.vx) ? torso.vx : 0, vy = Number.isFinite(torso.vy) ? torso.vy : 0;
      let ax = 0, ay = 0;
      if (this.hasLastV) ax = clamp((vx - this.lastVx) / dt, -60, 60), ay = clamp((vy - this.lastVy) / dt, -60, 60);
      this.lastVx = vx, this.lastVy = vy, this.hasLastV = true;
      let tx = 1 + cfg.squashAccel * (Math.abs(ax) - Math.abs(ay)), ty = 1 + cfg.squashAccel * (Math.abs(ay) - Math.abs(ax));
      let jx = clamp(ax * cfg.squashAccel, -1, 1) * 1.5, jy = clamp(ay * cfg.squashAccel, -1, 1) * 1.5;
      this.svx = clamp(this.svx + (cfg.squashK * (tx - this.sx) - cfg.squashDamp * this.svx) * dt + jx, -20, 20);
      this.svy = clamp(this.svy + (cfg.squashK * (ty - this.sy) - cfg.squashDamp * this.svy) * dt + jy, -20, 20);
      this.sx += this.svx * dt, this.sy += this.svy * dt;
      if (!Number.isFinite(this.sx) || !Number.isFinite(this.sy) || this.sx <= 0 || this.sy <= 0) this.sx = 1, this.sy = 1;
      let k = Math.sqrt(this.sx * this.sy);
      this.sx /= k, this.sy /= k;
      let lo = Math.max(cfg.squashMin, 1 / cfg.squashMax), hi = cfg.squashMax;
      let clampedX = this.sx < lo || this.sx > hi, clampedY = this.sy < lo || this.sy > hi;
      this.sx = clamp(this.sx, lo, hi), this.sy = 1 / this.sx;
      if (clampedX) this.svx = 0;
      if (clampedY) this.svy = 0;
    }
    this.tipSpeed = tip, this.squashSpeed = Math.hypot(this.svx, this.svy);
    this.phase = (this.phase + 4 * dt) % TAU;
  }
  kick(x, y, vx, vy, strength = 1) {
    let radius = this.cfg.kickRadius * (0.5 + strength);
    for (let tent of this.tentacles) {
      let pts = tent.pts;
      for (let i = 1; i < pts.length; i++) {
        let p = pts[i], dist = Math.hypot(p.x - x, p.y - y);
        if (dist >= radius) continue;
        let w = 1 - dist / radius;
        p.px -= vx * strength / 120 * w, p.py -= vy * strength / 120 * w;
      }
    }
    this.svx = clamp(this.svx + vx * strength * 0.15, -12, 12);
    this.svy = clamp(this.svy + vy * strength * 0.15, -12, 12);
  }
  tip(i) {
    let pts = this.tentacles[i].pts;
    return pts[pts.length - 1];
  }
  pointsOf(i) {
    return this.tentacles[i].pts;
  }
};
// Slime look (task 3b): a ragdoll is DRAWN as a mischievous gel blob + tube limbs + reactive tentacles. The physics is untouched.
var SLIME_LOOK = { ink: `#1d2638`, outline: 0.04, bodyRadii: [0.30, 0.32, 0.27, 0.23], legRadii: [0.12, 0.09, 0.07, 0.09], armRadii: [0.095, 0.075, 0.075, 0.105], eye: 0.115, eyeSep: 0.105, hurtTime: 0.35 };
function slimeRgb(e2) {
  let t2 = parseInt(e2.slice(1), 16);
  return [t2 >> 16 & 255, t2 >> 8 & 255, t2 & 255];
}
function slimeMix(e2, t2, n2) {
  return [Math.round(lerp(e2[0], t2[0], n2)), Math.round(lerp(e2[1], t2[1], n2)), Math.round(lerp(e2[2], t2[2], n2))];
}
function slimeCss(e2, t2 = 1) {
  return `rgba(${e2[0]},${e2[1]},${e2[2]},${t2})`;
}
function slimeSample(e2, t2, n2) {
  let r2 = [], i2 = e2.length;
  for (let a2 = 0; a2 < i2 - 1; a2++) {
    let o2 = e2[Math.max(0, a2 - 1)], s2 = e2[a2], c2 = e2[a2 + 1], l2 = e2[Math.min(i2 - 1, a2 + 2)];
    for (let u2 = 0; u2 < n2; u2++) {
      let d2 = u2 / n2, f2 = d2 * d2, p2 = f2 * d2;
      r2.push({
        x: 0.5 * (2 * s2.x + (-o2.x + c2.x) * d2 + (2 * o2.x - 5 * s2.x + 4 * c2.x - l2.x) * f2 + (-o2.x + 3 * s2.x - 3 * c2.x + l2.x) * p2),
        y: 0.5 * (2 * s2.y + (-o2.y + c2.y) * d2 + (2 * o2.y - 5 * s2.y + 4 * c2.y - l2.y) * f2 + (-o2.y + 3 * s2.y - 3 * c2.y + l2.y) * p2),
        r: lerp(t2[a2], t2[a2 + 1], d2 * d2 * (3 - 2 * d2))
      });
    }
  }
  return r2.push({ x: e2[i2 - 1].x, y: e2[i2 - 1].y, r: t2[i2 - 1] }), r2;
}
function slimePath(e2, t2, n2, r2) {
  e2.beginPath();
  for (let i2 of t2) {
    let a2 = slimeSample(i2.pts, i2.rs, i2.per || 5);
    for (let o2 = 0; o2 < a2.length; o2++) {
      let s2 = a2[o2].r * (1 + (i2.wob || 0) * Math.sin(r2 * 1.7 + o2 * 0.32 + (i2.seed || 0))) + n2;
      e2.moveTo(a2[o2].x + s2, a2[o2].y), e2.arc(a2[o2].x, a2[o2].y, s2, 0, TAU);
    }
  }
}
// Alien look (task 3c): every NON-player character in endless mode is DRAWN as a one-eyed tentacle alien (dome head with antennae, chin tentacles,
// glowing whips). The 13-part physics ragdoll is untouched; the tentacles reuse SlimeBody (pure logic). The player stays the only slime.
var ALIEN_LOOK = { ink: `#15101f`, outline: 0.035, hurtTime: 0.35 };
var ALIEN_PALETTES = [
    { skin: `#8f5bff`, glow: `#7dfcff` },
    { skin: `#1fc8a0`, glow: `#ff6bd6` },
    { skin: `#e8478f`, glow: `#ffe45e` },
    { skin: `#ff8f3d`, glow: `#5ee7ff` },
];
var ALIEN_TENTACLE_DEFS = [
    { id: `chinA`, anchor: `head`, local: { x: 0.09, y: -0.12 }, dir: { x: 0.45, y: -1 }, segs: 5, segLen: 0.075, width0: 0.1, width1: 0.016, bend: 0.03, gravityScale: 1.0 },
    { id: `chinB`, anchor: `head`, local: { x: 0.0, y: -0.15 }, dir: { x: 0.0, y: -1 }, segs: 6, segLen: 0.075, width0: 0.105, width1: 0.016, bend: 0.03, gravityScale: 1.0 },
    { id: `chinC`, anchor: `head`, local: { x: -0.09, y: -0.12 }, dir: { x: -0.45, y: -1 }, segs: 5, segLen: 0.075, width0: 0.1, width1: 0.016, bend: 0.03, gravityScale: 1.0 },
    { id: `whipA`, anchor: `torso`, local: { x: -0.09, y: 0.12 }, dir: { x: -1, y: 0.4 }, segs: 8, segLen: 0.1, width0: 0.075, width1: 0.012, bend: 0.06, gravityScale: 0.4 },
    { id: `whipB`, anchor: `torso`, local: { x: -0.09, y: 0.0 }, dir: { x: -1, y: -0.25 }, segs: 7, segLen: 0.1, width0: 0.07, width1: 0.012, bend: 0.06, gravityScale: 0.4 },
    { id: `antA`, anchor: `head`, local: { x: -0.08, y: 0.23 }, dir: { x: -0.4, y: 1 }, segs: 4, segLen: 0.075, width0: 0.032, width1: 0.02, bend: 0.3, gravityScale: 0.2 },
    { id: `antB`, anchor: `head`, local: { x: 0.08, y: 0.23 }, dir: { x: 0.4, y: 1 }, segs: 4, segLen: 0.075, width0: 0.032, width1: 0.02, bend: 0.3, gravityScale: 0.2 },
];
// Terrain look (task 2e restyle): endless features are drawn as purple colony buildings (windows, door, roof lip), rocky hills and hazard-striped barricades.
var TERRAIN_LOOK = { ink: `#0d0a1c`, wall: `#4b3f72`, wallLight: `#6d5ca6`, wallDark: `#2a2147`, wallLower: `#4a3f75`, roof: `#b9a8ff`, rock: `#4f4a78`, rockLight: `#8478b8`, glass: `#ffd86b`, glassOff: `#1a2442`, hazardA: `#ffcc33`, hazardB: `#1b2036` };
function terrainNoise(e2) {
  let t2 = Math.sin(e2 * 127.1 + 311.7) * 43758.5453;
  return t2 - Math.floor(t2);
}
function terrainPolyPath(e2, t2) {
  e2.beginPath(), e2.moveTo(t2[0].x, t2[0].y);
  for (let n2 = 1; n2 < t2.length; n2++) e2.lineTo(t2[n2].x, t2[n2].y);
  e2.closePath();
}
function dirToAimAngle(e2) {
  return Math.atan2(e2.x, -e2.y);
}
var PointerInput = class {
  constructor(e2, t2) {
    this.canvas = e2, this.handlers = t2, this.activeId = null, this.onDown = (e3) => {
      if (this.activeId === null) {
        e3.preventDefault(), this.activeId = e3.pointerId;
        try {
          this.canvas.setPointerCapture(e3.pointerId);
        } catch {
        }
        this.handlers.onDown(this.local(e3));
      }
    }, this.onMove = (e3) => {
      e3.pointerId === this.activeId && this.handlers.onMove(this.local(e3));
    }, this.onUp = (e3) => {
      e3.pointerId === this.activeId && (this.activeId = null, this.handlers.onUp(this.local(e3)));
    }, this.onCancel = (e3) => {
      let t3 = e3.pointerId;
      (t3 === void 0 || t3 === this.activeId) && (this.activeId = null, this.handlers.onCancel());
    }, e2.style.touchAction = `none`, e2.addEventListener(`pointerdown`, this.onDown), e2.addEventListener(`pointermove`, this.onMove), e2.addEventListener(`pointerup`, this.onUp), e2.addEventListener(`pointercancel`, this.onCancel), e2.addEventListener(`lostpointercapture`, this.onCancel), e2.addEventListener(`contextmenu`, (e3) => e3.preventDefault());
  }
  local(e2) {
    let t2 = this.canvas.getBoundingClientRect();
    return { x: e2.clientX - t2.left, y: e2.clientY - t2.top };
  }
}, C = function(e2, t2) {
  return C = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(e3, t3) {
    e3.__proto__ = t3;
  } || function(e3, t3) {
    for (var n2 in t3) Object.prototype.hasOwnProperty.call(t3, n2) && (e3[n2] = t3[n2]);
  }, C(e2, t2);
};
function w(e2, t2) {
  if (typeof t2 != `function` && t2 !== null) throw TypeError(`Class extends value ` + String(t2) + ` is not a constructor or null`);
  C(e2, t2);
  function n2() {
    this.constructor = e2;
  }
  e2.prototype = t2 === null ? Object.create(t2) : (n2.prototype = t2.prototype, new n2());
}
var T = function() {
  return T = Object.assign || function(e2) {
    for (var t2, n2 = 1, r2 = arguments.length; n2 < r2; n2++) for (var i2 in t2 = arguments[n2], t2) Object.prototype.hasOwnProperty.call(t2, i2) && (e2[i2] = t2[i2]);
    return e2;
  }, T.apply(this, arguments);
}, E = function(e2, t2) {
  e2 ??= {};
  var n2 = T({}, e2);
  for (var r2 in t2) t2.hasOwnProperty(r2) && e2[r2] === void 0 && (n2[r2] = t2[r2]);
  if (typeof Object.getOwnPropertySymbols == `function`) for (var i2 = Object.getOwnPropertySymbols(t2), a2 = 0; a2 < i2.length; a2++) {
    var o2 = i2[a2];
    t2.propertyIsEnumerable(o2) && e2[o2] === void 0 && (n2[o2] = t2[o2]);
  }
  return n2;
}, D = Math.random, O = 1e-9, ee = Number.isFinite;
function te(e2) {
  return e2 |= e2 >> 1, e2 |= e2 >> 2, e2 |= e2 >> 4, e2 |= e2 >> 8, e2 |= e2 >> 16, e2 + 1;
}
function ne(e2) {
  return e2 > 0 && !(e2 & e2 - 1);
}
function re(e2, t2, n2) {
  return t2 === void 0 ? (n2 = 1, t2 = 0) : n2 === void 0 && (n2 = t2, t2 = 0), n2 > t2 ? (e2 = (e2 - t2) % (n2 - t2), e2 + (e2 < 0 ? n2 : t2)) : (e2 = (e2 - n2) % (t2 - n2), e2 + (e2 <= 0 ? t2 : n2));
}
function k(e2, t2, n2) {
  return e2 < t2 ? t2 : e2 > n2 ? n2 : e2;
}
function ie(e2, t2) {
  return e2 === void 0 ? (t2 = 1, e2 = 0) : t2 === void 0 && (t2 = e2, e2 = 0), e2 === t2 ? e2 : D() * (t2 - e2) + e2;
}
var ae = Object.create(Math);
ae.EPSILON = O, ae.isFinite = ee, ae.nextPowerOfTwo = te, ae.isPowerOfTwo = ne, ae.mod = re, ae.clamp = k, ae.random = ie;
var oe = Math.abs, se = Math.sqrt, ce = Math.max, le = Math.min, Vec2 = function() {
  function e2(t2, n2) {
    if (!(this instanceof e2)) return new e2(t2, n2);
    t2 === void 0 ? (this.x = 0, this.y = 0) : typeof t2 == `object` ? (this.x = t2.x, this.y = t2.y) : (this.x = t2, this.y = n2);
  }
  return e2.prototype._serialize = function() {
    return { x: this.x, y: this.y };
  }, e2._deserialize = function(t2) {
    var n2 = Object.create(e2.prototype);
    return n2.x = t2.x, n2.y = t2.y, n2;
  }, e2.zero = function() {
    var t2 = Object.create(e2.prototype);
    return t2.x = 0, t2.y = 0, t2;
  }, e2.neo = function(t2, n2) {
    var r2 = Object.create(e2.prototype);
    return r2.x = t2, r2.y = n2, r2;
  }, e2.clone = function(t2) {
    return e2.neo(t2.x, t2.y);
  }, e2.prototype.toString = function() {
    return JSON.stringify(this);
  }, e2.isValid = function(e3) {
    return e3 != null && Number.isFinite(e3.x) && Number.isFinite(e3.y);
  }, e2.assert = function(e3) {
  }, e2.prototype.clone = function() {
    return e2.clone(this);
  }, e2.prototype.setZero = function() {
    return this.x = 0, this.y = 0, this;
  }, e2.prototype.set = function(e3, t2) {
    return typeof e3 == `object` ? (this.x = e3.x, this.y = e3.y) : (this.x = e3, this.y = t2), this;
  }, e2.prototype.setNum = function(e3, t2) {
    return this.x = e3, this.y = t2, this;
  }, e2.prototype.setVec2 = function(e3) {
    return this.x = e3.x, this.y = e3.y, this;
  }, e2.prototype.wSet = function(e3, t2, n2, r2) {
    return n2 !== void 0 || r2 !== void 0 ? this.setCombine(e3, t2, n2, r2) : this.setMul(e3, t2);
  }, e2.prototype.setCombine = function(e3, t2, n2, r2) {
    var i2 = e3 * t2.x + n2 * r2.x, a2 = e3 * t2.y + n2 * r2.y;
    return this.x = i2, this.y = a2, this;
  }, e2.prototype.setMul = function(e3, t2) {
    var n2 = e3 * t2.x, r2 = e3 * t2.y;
    return this.x = n2, this.y = r2, this;
  }, e2.prototype.add = function(e3) {
    return this.x += e3.x, this.y += e3.y, this;
  }, e2.prototype.wAdd = function(e3, t2, n2, r2) {
    return n2 !== void 0 || r2 !== void 0 ? this.addCombine(e3, t2, n2, r2) : this.addMul(e3, t2);
  }, e2.prototype.addCombine = function(e3, t2, n2, r2) {
    var i2 = e3 * t2.x + n2 * r2.x, a2 = e3 * t2.y + n2 * r2.y;
    return this.x += i2, this.y += a2, this;
  }, e2.prototype.addMul = function(e3, t2) {
    var n2 = e3 * t2.x, r2 = e3 * t2.y;
    return this.x += n2, this.y += r2, this;
  }, e2.prototype.wSub = function(e3, t2, n2, r2) {
    return n2 !== void 0 || r2 !== void 0 ? this.subCombine(e3, t2, n2, r2) : this.subMul(e3, t2);
  }, e2.prototype.subCombine = function(e3, t2, n2, r2) {
    var i2 = e3 * t2.x + n2 * r2.x, a2 = e3 * t2.y + n2 * r2.y;
    return this.x -= i2, this.y -= a2, this;
  }, e2.prototype.subMul = function(e3, t2) {
    var n2 = e3 * t2.x, r2 = e3 * t2.y;
    return this.x -= n2, this.y -= r2, this;
  }, e2.prototype.sub = function(e3) {
    return this.x -= e3.x, this.y -= e3.y, this;
  }, e2.prototype.mul = function(e3) {
    return this.x *= e3, this.y *= e3, this;
  }, e2.prototype.length = function() {
    return e2.lengthOf(this);
  }, e2.prototype.lengthSquared = function() {
    return e2.lengthSquared(this);
  }, e2.prototype.normalize = function() {
    var e3 = this.length();
    if (e3 < O) return 0;
    var t2 = 1 / e3;
    return this.x *= t2, this.y *= t2, e3;
  }, e2.normalize = function(t2) {
    var n2 = e2.lengthOf(t2);
    if (n2 < O) return e2.zero();
    var r2 = 1 / n2;
    return e2.neo(t2.x * r2, t2.y * r2);
  }, e2.lengthOf = function(e3) {
    return se(e3.x * e3.x + e3.y * e3.y);
  }, e2.lengthSquared = function(e3) {
    return e3.x * e3.x + e3.y * e3.y;
  }, e2.distance = function(e3, t2) {
    var n2 = e3.x - t2.x, r2 = e3.y - t2.y;
    return se(n2 * n2 + r2 * r2);
  }, e2.distanceSquared = function(e3, t2) {
    var n2 = e3.x - t2.x, r2 = e3.y - t2.y;
    return n2 * n2 + r2 * r2;
  }, e2.areEqual = function(e3, t2) {
    return e3 === t2 || typeof t2 == `object` && !!t2 && e3.x === t2.x && e3.y === t2.y;
  }, e2.skew = function(t2) {
    return e2.neo(-t2.y, t2.x);
  }, e2.dot = function(e3, t2) {
    return e3.x * t2.x + e3.y * t2.y;
  }, e2.cross = function(t2, n2) {
    return typeof n2 == `number` ? e2.neo(n2 * t2.y, -n2 * t2.x) : typeof t2 == `number` ? e2.neo(-t2 * n2.y, t2 * n2.x) : t2.x * n2.y - t2.y * n2.x;
  }, e2.crossVec2Vec2 = function(e3, t2) {
    return e3.x * t2.y - e3.y * t2.x;
  }, e2.crossVec2Num = function(t2, n2) {
    return e2.neo(n2 * t2.y, -n2 * t2.x);
  }, e2.crossNumVec2 = function(t2, n2) {
    return e2.neo(-t2 * n2.y, t2 * n2.x);
  }, e2.addCross = function(t2, n2, r2) {
    if (typeof r2 == `number`) return e2.neo(r2 * n2.y + t2.x, -r2 * n2.x + t2.y);
    if (typeof n2 == `number`) return e2.neo(-n2 * r2.y + t2.x, n2 * r2.x + t2.y);
  }, e2.addCrossVec2Num = function(t2, n2, r2) {
    return e2.neo(r2 * n2.y + t2.x, -r2 * n2.x + t2.y);
  }, e2.addCrossNumVec2 = function(t2, n2, r2) {
    return e2.neo(-n2 * r2.y + t2.x, n2 * r2.x + t2.y);
  }, e2.add = function(t2, n2) {
    return e2.neo(t2.x + n2.x, t2.y + n2.y);
  }, e2.wAdd = function(t2, n2, r2, i2) {
    return r2 !== void 0 || i2 !== void 0 ? e2.combine(t2, n2, r2, i2) : e2.mulNumVec2(t2, n2);
  }, e2.combine = function(t2, n2, r2, i2) {
    return e2.zero().setCombine(t2, n2, r2, i2);
  }, e2.sub = function(t2, n2) {
    return e2.neo(t2.x - n2.x, t2.y - n2.y);
  }, e2.mul = function(t2, n2) {
    if (typeof t2 == `object`) return e2.neo(t2.x * n2, t2.y * n2);
    if (typeof n2 == `object`) return e2.neo(t2 * n2.x, t2 * n2.y);
  }, e2.mulVec2Num = function(t2, n2) {
    return e2.neo(t2.x * n2, t2.y * n2);
  }, e2.mulNumVec2 = function(t2, n2) {
    return e2.neo(t2 * n2.x, t2 * n2.y);
  }, e2.prototype.neg = function() {
    return this.x = -this.x, this.y = -this.y, this;
  }, e2.neg = function(t2) {
    return e2.neo(-t2.x, -t2.y);
  }, e2.abs = function(t2) {
    return e2.neo(oe(t2.x), oe(t2.y));
  }, e2.mid = function(t2, n2) {
    return e2.neo((t2.x + n2.x) * 0.5, (t2.y + n2.y) * 0.5);
  }, e2.upper = function(t2, n2) {
    return e2.neo(ce(t2.x, n2.x), ce(t2.y, n2.y));
  }, e2.lower = function(t2, n2) {
    return e2.neo(le(t2.x, n2.x), le(t2.y, n2.y));
  }, e2.prototype.clamp = function(e3) {
    var t2 = this.x * this.x + this.y * this.y;
    if (t2 > e3 * e3) {
      var n2 = e3 / se(t2);
      this.x *= n2, this.y *= n2;
    }
    return this;
  }, e2.clamp = function(t2, n2) {
    var r2 = e2.neo(t2.x, t2.y);
    return r2.clamp(n2), r2;
  }, e2.clampVec2 = function(e3, t2, n2) {
    return { x: k(e3.x, t2?.x, n2?.x), y: k(e3.y, t2?.y, n2?.y) };
  }, e2.scaleFn = function(t2, n2) {
    return function(r2) {
      return e2.neo(r2.x * t2, r2.y * n2);
    };
  }, e2.translateFn = function(t2, n2) {
    return function(r2) {
      return e2.neo(r2.x + t2, r2.y + n2);
    };
  }, e2;
}(), ue = Math.max, de = Math.min, fe = function() {
  function e2(t2, n2) {
    if (!(this instanceof e2)) return new e2(t2, n2);
    this.lowerBound = Vec2.zero(), this.upperBound = Vec2.zero(), typeof t2 == `object` && this.lowerBound.setVec2(t2), typeof n2 == `object` ? this.upperBound.setVec2(n2) : typeof t2 == `object` && this.upperBound.setVec2(t2);
  }
  return e2.prototype.isValid = function() {
    return e2.isValid(this);
  }, e2.isValid = function(e3) {
    return e3 != null && Vec2.isValid(e3.lowerBound) && Vec2.isValid(e3.upperBound) && Vec2.sub(e3.upperBound, e3.lowerBound).lengthSquared() >= 0;
  }, e2.assert = function(e3) {
  }, e2.prototype.getCenter = function() {
    return Vec2.neo((this.lowerBound.x + this.upperBound.x) * 0.5, (this.lowerBound.y + this.upperBound.y) * 0.5);
  }, e2.prototype.getExtents = function() {
    return Vec2.neo((this.upperBound.x - this.lowerBound.x) * 0.5, (this.upperBound.y - this.lowerBound.y) * 0.5);
  }, e2.prototype.getPerimeter = function() {
    return 2 * (this.upperBound.x - this.lowerBound.x + this.upperBound.y - this.lowerBound.y);
  }, e2.prototype.combine = function(e3, t2) {
    t2 ||= this;
    var n2 = e3.lowerBound, r2 = e3.upperBound, i2 = t2.lowerBound, a2 = t2.upperBound, o2 = de(n2.x, i2.x), s2 = de(n2.y, i2.y), c2 = ue(a2.x, r2.x), l2 = ue(a2.y, r2.y);
    this.lowerBound.setNum(o2, s2), this.upperBound.setNum(c2, l2);
  }, e2.prototype.combinePoints = function(e3, t2) {
    this.lowerBound.setNum(de(e3.x, t2.x), de(e3.y, t2.y)), this.upperBound.setNum(ue(e3.x, t2.x), ue(e3.y, t2.y));
  }, e2.prototype.set = function(e3) {
    this.lowerBound.setNum(e3.lowerBound.x, e3.lowerBound.y), this.upperBound.setNum(e3.upperBound.x, e3.upperBound.y);
  }, e2.prototype.contains = function(e3) {
    var t2 = true;
    return t2 &&= this.lowerBound.x <= e3.lowerBound.x, t2 &&= this.lowerBound.y <= e3.lowerBound.y, t2 &&= e3.upperBound.x <= this.upperBound.x, t2 &&= e3.upperBound.y <= this.upperBound.y, t2;
  }, e2.prototype.extend = function(t2) {
    return e2.extend(this, t2), this;
  }, e2.extend = function(e3, t2) {
    return e3.lowerBound.x -= t2, e3.lowerBound.y -= t2, e3.upperBound.x += t2, e3.upperBound.y += t2, e3;
  }, e2.testOverlap = function(e3, t2) {
    var n2 = t2.lowerBound.x - e3.upperBound.x, r2 = e3.lowerBound.x - t2.upperBound.x, i2 = t2.lowerBound.y - e3.upperBound.y, a2 = e3.lowerBound.y - t2.upperBound.y;
    return !(n2 > 0 || i2 > 0 || r2 > 0 || a2 > 0);
  }, e2.areEqual = function(e3, t2) {
    return Vec2.areEqual(e3.lowerBound, t2.lowerBound) && Vec2.areEqual(e3.upperBound, t2.upperBound);
  }, e2.diff = function(e3, t2) {
    var n2 = ue(0, de(e3.upperBound.x, t2.upperBound.x) - ue(t2.lowerBound.x, e3.lowerBound.x)), r2 = ue(0, de(e3.upperBound.y, t2.upperBound.y) - ue(t2.lowerBound.y, e3.lowerBound.y)), i2 = e3.upperBound.x - e3.lowerBound.x, a2 = e3.upperBound.y - e3.lowerBound.y, o2 = t2.upperBound.x - t2.lowerBound.x, s2 = t2.upperBound.y - t2.lowerBound.y;
    return i2 * a2 + o2 * s2 - n2 * r2;
  }, e2.prototype.rayCast = function(e3, t2) {
    var n2 = -1 / 0, r2 = 1 / 0, i2 = t2.p1, a2 = Vec2.sub(t2.p2, t2.p1), o2 = Vec2.abs(a2), s2 = Vec2.zero();
    if (o2.x < O) {
      if (i2.x < this.lowerBound.x || this.upperBound.x < i2.x) return false;
    } else {
      var c2 = 1 / a2.x, l2 = (this.lowerBound.x - i2.x) * c2, u2 = (this.upperBound.x - i2.x) * c2, d2 = -1;
      if (l2 > u2) {
        var f2 = l2;
        l2 = u2, u2 = f2, d2 = 1;
      }
      if (l2 > n2 && (s2.setZero(), s2.x = d2, n2 = l2), r2 = de(r2, u2), n2 > r2) return false;
    }
    if (o2.y < O) {
      if (i2.y < this.lowerBound.y || this.upperBound.y < i2.y) return false;
    } else {
      var c2 = 1 / a2.y, l2 = (this.lowerBound.y - i2.y) * c2, u2 = (this.upperBound.y - i2.y) * c2, d2 = -1;
      if (l2 > u2) {
        var f2 = l2;
        l2 = u2, u2 = f2, d2 = 1;
      }
      if (l2 > n2 && (s2.setZero(), s2.y = d2, n2 = l2), r2 = de(r2, u2), n2 > r2) return false;
    }
    return n2 < 0 || t2.maxFraction < n2 ? false : (e3.fraction = n2, e3.normal = s2, true);
  }, e2.prototype.toString = function() {
    return JSON.stringify(this);
  }, e2.combinePoints = function(e3, t2, n2) {
    return e3.lowerBound.x = de(t2.x, n2.x), e3.lowerBound.y = de(t2.y, n2.y), e3.upperBound.x = ue(t2.x, n2.x), e3.upperBound.y = ue(t2.y, n2.y), e3;
  }, e2.combinedPerimeter = function(e3, t2) {
    var n2 = de(e3.lowerBound.x, t2.lowerBound.x), r2 = de(e3.lowerBound.y, t2.lowerBound.y), i2 = ue(e3.upperBound.x, t2.upperBound.x), a2 = ue(e3.upperBound.y, t2.upperBound.y);
    return 2 * (i2 - n2 + a2 - r2);
  }, e2;
}(), pe = Math.PI, j = function() {
  function e2() {
  }
  return Object.defineProperty(e2, "polygonRadius", { get: function() {
    return 2 * e2.linearSlop;
  }, enumerable: false, configurable: true }), e2.lengthUnitsPerMeter = 1, e2.maxManifoldPoints = 2, e2.maxPolygonVertices = 12, e2.aabbExtension = 0.1, e2.aabbMultiplier = 2, e2.linearSlop = 5e-3, e2.angularSlop = 2 / 180 * pe, e2.maxSubSteps = 8, e2.maxTOIContacts = 32, e2.maxTOIIterations = 20, e2.maxDistanceIterations = 20, e2.velocityThreshold = 1, e2.maxLinearCorrection = 0.2, e2.maxAngularCorrection = 8 / 180 * pe, e2.maxTranslation = 2, e2.maxRotation = 0.5 * pe, e2.baumgarte = 0.2, e2.toiBaugarte = 0.75, e2.timeToSleep = 0.5, e2.linearSleepTolerance = 0.01, e2.angularSleepTolerance = 2 / 180 * pe, e2;
}(), M = function() {
  function e2() {
  }
  return Object.defineProperty(e2, "maxManifoldPoints", { get: function() {
    return j.maxManifoldPoints;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "maxPolygonVertices", { get: function() {
    return j.maxPolygonVertices;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "aabbExtension", { get: function() {
    return j.aabbExtension * j.lengthUnitsPerMeter;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "aabbMultiplier", { get: function() {
    return j.aabbMultiplier;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "linearSlop", { get: function() {
    return j.linearSlop * j.lengthUnitsPerMeter;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "linearSlopSquared", { get: function() {
    return j.linearSlop * j.lengthUnitsPerMeter * j.linearSlop * j.lengthUnitsPerMeter;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "angularSlop", { get: function() {
    return j.angularSlop;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "polygonRadius", { get: function() {
    return 2 * j.linearSlop;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "maxSubSteps", { get: function() {
    return j.maxSubSteps;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "maxTOIContacts", { get: function() {
    return j.maxTOIContacts;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "maxTOIIterations", { get: function() {
    return j.maxTOIIterations;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "maxDistanceIterations", { get: function() {
    return j.maxDistanceIterations;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "velocityThreshold", { get: function() {
    return j.velocityThreshold * j.lengthUnitsPerMeter;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "maxLinearCorrection", { get: function() {
    return j.maxLinearCorrection * j.lengthUnitsPerMeter;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "maxAngularCorrection", { get: function() {
    return j.maxAngularCorrection;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "maxTranslation", { get: function() {
    return j.maxTranslation * j.lengthUnitsPerMeter;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "maxTranslationSquared", { get: function() {
    return j.maxTranslation * j.lengthUnitsPerMeter * j.maxTranslation * j.lengthUnitsPerMeter;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "maxRotation", { get: function() {
    return j.maxRotation;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "maxRotationSquared", { get: function() {
    return j.maxRotation * j.maxRotation;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "baumgarte", { get: function() {
    return j.baumgarte;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "toiBaugarte", { get: function() {
    return j.toiBaugarte;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "timeToSleep", { get: function() {
    return j.timeToSleep;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "linearSleepTolerance", { get: function() {
    return j.linearSleepTolerance * j.lengthUnitsPerMeter;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "linearSleepToleranceSqr", { get: function() {
    return j.linearSleepTolerance * j.lengthUnitsPerMeter * j.linearSleepTolerance * j.lengthUnitsPerMeter;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "angularSleepTolerance", { get: function() {
    return j.angularSleepTolerance;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2, "angularSleepToleranceSqr", { get: function() {
    return j.angularSleepTolerance * j.angularSleepTolerance;
  }, enumerable: false, configurable: true }), e2;
}(), me = function() {
  function e2(e3) {
    this._list = [], this._max = 1 / 0, this._hasCreateFn = false, this._createCount = 0, this._hasAllocateFn = false, this._allocateCount = 0, this._hasReleaseFn = false, this._releaseCount = 0, this._hasDisposeFn = false, this._disposeCount = 0, this._list = [], this._max = e3.max || this._max, this._createFn = e3.create, this._hasCreateFn = typeof this._createFn == `function`, this._allocateFn = e3.allocate, this._hasAllocateFn = typeof this._allocateFn == `function`, this._releaseFn = e3.release, this._hasReleaseFn = typeof this._releaseFn == `function`, this._disposeFn = e3.dispose, this._hasDisposeFn = typeof this._disposeFn == `function`;
  }
  return e2.prototype.max = function(e3) {
    return typeof e3 == `number` ? (this._max = e3, this) : this._max;
  }, e2.prototype.size = function() {
    return this._list.length;
  }, e2.prototype.allocate = function() {
    var e3;
    return this._list.length > 0 ? e3 = this._list.shift() : (this._createCount++, e3 = this._hasCreateFn ? this._createFn() : {}), this._allocateCount++, this._hasAllocateFn && this._allocateFn(e3), e3;
  }, e2.prototype.release = function(e3) {
    this._list.length < this._max ? (this._releaseCount++, this._hasReleaseFn && this._releaseFn(e3), this._list.push(e3)) : (this._disposeCount++, this._hasDisposeFn && (e3 = this._disposeFn(e3)));
  }, e2.prototype.toString = function() {
    return ` +` + this._createCount + ` >` + this._allocateCount + ` <` + this._releaseCount + ` -` + this._disposeCount + ` =` + this._list.length + `/` + this._max;
  }, e2;
}(), he = Math.abs, ge = Math.max, _e = function() {
  function e2(e3) {
    this.aabb = new fe(), this.userData = null, this.parent = null, this.child1 = null, this.child2 = null, this.height = -1, this.id = e3;
  }
  return e2.prototype.toString = function() {
    return this.id + `: ` + this.userData;
  }, e2.prototype.isLeaf = function() {
    return this.child1 == null;
  }, e2;
}(), ve = new me({ create: function() {
  return new _e();
}, release: function(e2) {
  e2.userData = null, e2.parent = null, e2.child1 = null, e2.child2 = null, e2.height = -1, e2.id = void 0;
} }), ye = function() {
  function e2() {
    this.inputPool = new me({ create: function() {
      return {};
    }, release: function(e3) {
    } }), this.stackPool = new me({ create: function() {
      return [];
    }, release: function(e3) {
      e3.length = 0;
    } }), this.iteratorPool = new me({ create: function() {
      return new be();
    }, release: function(e3) {
      e3.close();
    } }), this.m_root = null, this.m_nodes = {}, this.m_lastProxyId = 0;
  }
  return e2.prototype.getUserData = function(e3) {
    return this.m_nodes[e3].userData;
  }, e2.prototype.getFatAABB = function(e3) {
    return this.m_nodes[e3].aabb;
  }, e2.prototype.allocateNode = function() {
    var e3 = ve.allocate();
    return e3.id = ++this.m_lastProxyId, this.m_nodes[e3.id] = e3, e3;
  }, e2.prototype.freeNode = function(e3) {
    delete this.m_nodes[e3.id], ve.release(e3);
  }, e2.prototype.createProxy = function(e3, t2) {
    var n2 = this.allocateNode();
    return n2.aabb.set(e3), fe.extend(n2.aabb, M.aabbExtension), n2.userData = t2, n2.height = 0, this.insertLeaf(n2), n2.id;
  }, e2.prototype.destroyProxy = function(e3) {
    var t2 = this.m_nodes[e3];
    this.removeLeaf(t2), this.freeNode(t2);
  }, e2.prototype.moveProxy = function(e3, t2, n2) {
    var r2 = this.m_nodes[e3];
    return !r2.aabb.contains(t2) && (this.removeLeaf(r2), r2.aabb.set(t2), t2 = r2.aabb, fe.extend(t2, M.aabbExtension), n2.x < 0 ? t2.lowerBound.x += n2.x * M.aabbMultiplier : t2.upperBound.x += n2.x * M.aabbMultiplier, n2.y < 0 ? t2.lowerBound.y += n2.y * M.aabbMultiplier : t2.upperBound.y += n2.y * M.aabbMultiplier, this.insertLeaf(r2), true);
  }, e2.prototype.insertLeaf = function(e3) {
    if (this.m_root == null) this.m_root = e3, this.m_root.parent = null;
    else {
      for (var t2 = e3.aabb, n2 = this.m_root; !n2.isLeaf(); ) {
        var r2 = n2.child1, i2 = n2.child2, a2 = n2.aabb.getPerimeter(), o2 = fe.combinedPerimeter(n2.aabb, t2), s2 = 2 * o2, c2 = 2 * (o2 - a2), l2 = fe.combinedPerimeter(t2, r2.aabb) + c2;
        if (!r2.isLeaf()) {
          var u2 = r2.aabb.getPerimeter();
          l2 -= u2;
        }
        var d2 = fe.combinedPerimeter(t2, i2.aabb) + c2;
        if (!i2.isLeaf()) {
          var u2 = i2.aabb.getPerimeter();
          d2 -= u2;
        }
        if (s2 < l2 && s2 < d2) break;
        n2 = l2 < d2 ? r2 : i2;
      }
      var f2 = n2, p2 = f2.parent, m2 = this.allocateNode();
      for (m2.parent = p2, m2.userData = null, m2.aabb.combine(t2, f2.aabb), m2.height = f2.height + 1, p2 == null ? (m2.child1 = f2, m2.child2 = e3, f2.parent = m2, e3.parent = m2, this.m_root = m2) : (p2.child1 === f2 ? p2.child1 = m2 : p2.child2 = m2, m2.child1 = f2, m2.child2 = e3, f2.parent = m2, e3.parent = m2), n2 = e3.parent; n2 != null; ) {
        n2 = this.balance(n2);
        var r2 = n2.child1, i2 = n2.child2;
        n2.height = 1 + ge(r2.height, i2.height), n2.aabb.combine(r2.aabb, i2.aabb), n2 = n2.parent;
      }
    }
  }, e2.prototype.removeLeaf = function(e3) {
    if (e3 === this.m_root) this.m_root = null;
    else {
      var t2 = e3.parent, n2 = t2.parent, r2 = t2.child1 === e3 ? t2.child2 : t2.child1;
      if (n2 != null) {
        n2.child1 === t2 ? n2.child1 = r2 : n2.child2 = r2, r2.parent = n2, this.freeNode(t2);
        for (var i2 = n2; i2 != null; ) {
          i2 = this.balance(i2);
          var a2 = i2.child1, o2 = i2.child2;
          i2.aabb.combine(a2.aabb, o2.aabb), i2.height = 1 + ge(a2.height, o2.height), i2 = i2.parent;
        }
      } else this.m_root = r2, r2.parent = null, this.freeNode(t2);
    }
  }, e2.prototype.balance = function(e3) {
    var t2 = e3;
    if (t2.isLeaf() || t2.height < 2) return e3;
    var n2 = t2.child1, r2 = t2.child2, i2 = r2.height - n2.height;
    if (i2 > 1) {
      var a2 = r2.child1, o2 = r2.child2;
      return r2.child1 = t2, r2.parent = t2.parent, t2.parent = r2, r2.parent == null ? this.m_root = r2 : r2.parent.child1 === e3 ? r2.parent.child1 = r2 : r2.parent.child2 = r2, a2.height > o2.height ? (r2.child2 = a2, t2.child2 = o2, o2.parent = t2, t2.aabb.combine(n2.aabb, o2.aabb), r2.aabb.combine(t2.aabb, a2.aabb), t2.height = 1 + ge(n2.height, o2.height), r2.height = 1 + ge(t2.height, a2.height)) : (r2.child2 = o2, t2.child2 = a2, a2.parent = t2, t2.aabb.combine(n2.aabb, a2.aabb), r2.aabb.combine(t2.aabb, o2.aabb), t2.height = 1 + ge(n2.height, a2.height), r2.height = 1 + ge(t2.height, o2.height)), r2;
    }
    if (i2 < -1) {
      var s2 = n2.child1, c2 = n2.child2;
      return n2.child1 = t2, n2.parent = t2.parent, t2.parent = n2, n2.parent == null ? this.m_root = n2 : n2.parent.child1 === t2 ? n2.parent.child1 = n2 : n2.parent.child2 = n2, s2.height > c2.height ? (n2.child2 = s2, t2.child1 = c2, c2.parent = t2, t2.aabb.combine(r2.aabb, c2.aabb), n2.aabb.combine(t2.aabb, s2.aabb), t2.height = 1 + ge(r2.height, c2.height), n2.height = 1 + ge(t2.height, s2.height)) : (n2.child2 = c2, t2.child1 = s2, s2.parent = t2, t2.aabb.combine(r2.aabb, s2.aabb), n2.aabb.combine(t2.aabb, c2.aabb), t2.height = 1 + ge(r2.height, s2.height), n2.height = 1 + ge(t2.height, c2.height)), n2;
    }
    return t2;
  }, e2.prototype.getHeight = function() {
    return this.m_root == null ? 0 : this.m_root.height;
  }, e2.prototype.getAreaRatio = function() {
    if (this.m_root == null) return 0;
    for (var e3 = this.m_root.aabb.getPerimeter(), t2 = 0, n2, r2 = this.iteratorPool.allocate().preorder(this.m_root); n2 = r2.next(); ) n2.height < 0 || (t2 += n2.aabb.getPerimeter());
    return this.iteratorPool.release(r2), t2 / e3;
  }, e2.prototype.computeHeight = function(e3) {
    var t2 = e3 === void 0 ? this.m_root : this.m_nodes[e3];
    return t2.isLeaf() ? 0 : 1 + ge(this.computeHeight(t2.child1.id), this.computeHeight(t2.child2.id));
  }, e2.prototype.validateStructure = function(e3) {
    if (e3 != null) {
      this.m_root;
      var t2 = e3.child1, n2 = e3.child2;
      e3.isLeaf() || (this.validateStructure(t2), this.validateStructure(n2));
    }
  }, e2.prototype.validateMetrics = function(e3) {
    if (e3 != null) {
      var t2 = e3.child1, n2 = e3.child2;
      e3.isLeaf() || (this.validateMetrics(t2), this.validateMetrics(n2));
    }
  }, e2.prototype.validate = function() {
  }, e2.prototype.getMaxBalance = function() {
    for (var e3 = 0, t2, n2 = this.iteratorPool.allocate().preorder(this.m_root); t2 = n2.next(); ) if (!(t2.height <= 1)) {
      var r2 = he(t2.child2.height - t2.child1.height);
      e3 = ge(e3, r2);
    }
    return this.iteratorPool.release(n2), e3;
  }, e2.prototype.rebuildBottomUp = function() {
    for (var e3 = [], t2 = 0, n2, r2 = this.iteratorPool.allocate().preorder(this.m_root); n2 = r2.next(); ) n2.height < 0 || (n2.isLeaf() ? (n2.parent = null, e3[t2] = n2, ++t2) : this.freeNode(n2));
    for (this.iteratorPool.release(r2); t2 > 1; ) {
      for (var i2 = 1 / 0, a2 = -1, o2 = -1, s2 = 0; s2 < t2; ++s2) for (var c2 = e3[s2].aabb, l2 = s2 + 1; l2 < t2; ++l2) {
        var u2 = e3[l2].aabb, d2 = fe.combinedPerimeter(c2, u2);
        d2 < i2 && (a2 = s2, o2 = l2, i2 = d2);
      }
      var f2 = e3[a2], p2 = e3[o2], m2 = this.allocateNode();
      m2.child1 = f2, m2.child2 = p2, m2.height = 1 + ge(f2.height, p2.height), m2.aabb.combine(f2.aabb, p2.aabb), m2.parent = null, f2.parent = m2, p2.parent = m2, e3[o2] = e3[t2 - 1], e3[a2] = m2, --t2;
    }
    this.m_root = e3[0];
  }, e2.prototype.shiftOrigin = function(e3) {
    for (var t2, n2 = this.iteratorPool.allocate().preorder(this.m_root); t2 = n2.next(); ) {
      var r2 = t2.aabb;
      r2.lowerBound.x -= e3.x, r2.lowerBound.y -= e3.y, r2.upperBound.x -= e3.x, r2.upperBound.y -= e3.y;
    }
    this.iteratorPool.release(n2);
  }, e2.prototype.query = function(e3, t2) {
    var n2 = this.stackPool.allocate();
    for (n2.push(this.m_root); n2.length > 0; ) {
      var r2 = n2.pop();
      if (r2 != null && fe.testOverlap(r2.aabb, e3)) {
        if (r2.isLeaf()) {
          if (t2(r2.id) === false) return;
        } else n2.push(r2.child1), n2.push(r2.child2);
      }
    }
    this.stackPool.release(n2);
  }, e2.prototype.rayCast = function(e3, t2) {
    var n2 = e3.p1, r2 = e3.p2, i2 = Vec2.sub(r2, n2);
    i2.normalize();
    var a2 = Vec2.crossNumVec2(1, i2), o2 = Vec2.abs(a2), s2 = e3.maxFraction, c2 = new fe(), l2 = Vec2.combine(1 - s2, n2, s2, r2);
    c2.combinePoints(n2, l2);
    var u2 = this.stackPool.allocate(), d2 = this.inputPool.allocate();
    for (u2.push(this.m_root); u2.length > 0; ) {
      var f2 = u2.pop();
      if (f2 != null && fe.testOverlap(f2.aabb, c2) !== false) {
        var p2 = f2.aabb.getCenter(), m2 = f2.aabb.getExtents();
        if (!(he(Vec2.dot(a2, Vec2.sub(n2, p2))) - Vec2.dot(o2, m2) > 0)) {
          if (f2.isLeaf()) {
            d2.p1 = Vec2.clone(e3.p1), d2.p2 = Vec2.clone(e3.p2), d2.maxFraction = s2;
            var h2 = t2(d2, f2.id);
            if (h2 === 0) break;
            h2 > 0 && (s2 = h2, l2 = Vec2.combine(1 - s2, n2, s2, r2), c2.combinePoints(n2, l2));
          } else u2.push(f2.child1), u2.push(f2.child2);
        }
      }
    }
    this.stackPool.release(u2), this.inputPool.release(d2);
  }, e2;
}(), be = function() {
  function e2() {
    this.parents = [], this.states = [];
  }
  return e2.prototype.preorder = function(e3) {
    return this.parents.length = 0, this.parents.push(e3), this.states.length = 0, this.states.push(0), this;
  }, e2.prototype.next = function() {
    for (; this.parents.length > 0; ) {
      var e3 = this.parents.length - 1, t2 = this.parents[e3];
      if (this.states[e3] === 0) return this.states[e3] = 1, t2;
      if (this.states[e3] === 1 && (this.states[e3] = 2, t2.child1)) return this.parents.push(t2.child1), this.states.push(1), t2.child1;
      if (this.states[e3] === 2 && (this.states[e3] = 3, t2.child2)) return this.parents.push(t2.child2), this.states.push(1), t2.child2;
      this.parents.pop(), this.states.pop();
    }
  }, e2.prototype.close = function() {
    this.parents.length = 0;
  }, e2;
}(), xe = Math.max, Se = Math.min, Ce = function() {
  function e2() {
    var e3 = this;
    this.m_tree = new ye(), this.m_moveBuffer = [], this.query = function(t2, n2) {
      e3.m_tree.query(t2, n2);
    }, this.queryCallback = function(t2) {
      if (t2 === e3.m_queryProxyId) return true;
      var n2 = Se(t2, e3.m_queryProxyId), r2 = xe(t2, e3.m_queryProxyId), i2 = e3.m_tree.getUserData(n2), a2 = e3.m_tree.getUserData(r2);
      return e3.m_callback(i2, a2), true;
    };
  }
  return e2.prototype.getUserData = function(e3) {
    return this.m_tree.getUserData(e3);
  }, e2.prototype.testOverlap = function(e3, t2) {
    var n2 = this.m_tree.getFatAABB(e3), r2 = this.m_tree.getFatAABB(t2);
    return fe.testOverlap(n2, r2);
  }, e2.prototype.getFatAABB = function(e3) {
    return this.m_tree.getFatAABB(e3);
  }, e2.prototype.getProxyCount = function() {
    return this.m_moveBuffer.length;
  }, e2.prototype.getTreeHeight = function() {
    return this.m_tree.getHeight();
  }, e2.prototype.getTreeBalance = function() {
    return this.m_tree.getMaxBalance();
  }, e2.prototype.getTreeQuality = function() {
    return this.m_tree.getAreaRatio();
  }, e2.prototype.rayCast = function(e3, t2) {
    this.m_tree.rayCast(e3, t2);
  }, e2.prototype.shiftOrigin = function(e3) {
    this.m_tree.shiftOrigin(e3);
  }, e2.prototype.createProxy = function(e3, t2) {
    var n2 = this.m_tree.createProxy(e3, t2);
    return this.bufferMove(n2), n2;
  }, e2.prototype.destroyProxy = function(e3) {
    this.unbufferMove(e3), this.m_tree.destroyProxy(e3);
  }, e2.prototype.moveProxy = function(e3, t2, n2) {
    this.m_tree.moveProxy(e3, t2, n2) && this.bufferMove(e3);
  }, e2.prototype.touchProxy = function(e3) {
    this.bufferMove(e3);
  }, e2.prototype.bufferMove = function(e3) {
    this.m_moveBuffer.push(e3);
  }, e2.prototype.unbufferMove = function(e3) {
    for (var t2 = 0; t2 < this.m_moveBuffer.length; ++t2) this.m_moveBuffer[t2] === e3 && (this.m_moveBuffer[t2] = null);
  }, e2.prototype.updatePairs = function(e3) {
    for (this.m_callback = e3; this.m_moveBuffer.length > 0; ) if (this.m_queryProxyId = this.m_moveBuffer.pop(), this.m_queryProxyId !== null) {
      var t2 = this.m_tree.getFatAABB(this.m_queryProxyId);
      this.m_tree.query(t2, this.queryCallback);
    }
  }, e2;
}(), we = Math.sin, Te = Math.cos, Ee = Math.sqrt;
function N(e2, t2) {
  return { x: e2, y: t2 };
}
function De(e2) {
  return { s: we(e2), c: Te(e2) };
}
function Oe(e2, t2, n2) {
  return e2.x = t2, e2.y = n2, e2;
}
function P(e2, t2) {
  return e2.x = t2.x, e2.y = t2.y, e2;
}
function F(e2) {
  return e2.x = 0, e2.y = 0, e2;
}
function ke(e2) {
  return e2.x = -e2.x, e2.y = -e2.y, e2;
}
function Ae(e2, t2) {
  return e2.x += t2.x, e2.y += t2.y, e2;
}
function je(e2, t2, n2) {
  return e2.x = t2.x + n2.x, e2.y = t2.y + n2.y, e2;
}
function Me(e2, t2) {
  return e2.x -= t2.x, e2.y -= t2.y, e2;
}
function I(e2, t2, n2) {
  return e2.x = t2.x - n2.x, e2.y = t2.y - n2.y, e2;
}
function Ne(e2, t2) {
  return e2.x *= t2, e2.y *= t2, e2;
}
function L(e2, t2, n2) {
  return e2.x = t2 * n2.x, e2.y = t2 * n2.y, e2;
}
function Pe(e2, t2, n2) {
  return e2.x += t2 * n2.x, e2.y += t2 * n2.y, e2;
}
function Fe(e2, t2, n2) {
  return e2.x -= t2 * n2.x, e2.y -= t2 * n2.y, e2;
}
function R(e2, t2, n2, r2, i2) {
  return e2.x = t2 * n2.x + r2 * i2.x, e2.y = t2 * n2.y + r2 * i2.y, e2;
}
function Ie(e2, t2, n2, r2, i2, a2, o2) {
  return e2.x = t2 * n2.x + r2 * i2.x + a2 * o2.x, e2.y = t2 * n2.y + r2 * i2.y + a2 * o2.y, e2;
}
function Le(e2) {
  var t2 = Ee(e2.x * e2.x + e2.y * e2.y);
  if (t2 !== 0) {
    var n2 = 1 / t2;
    e2.x *= n2, e2.y *= n2;
  }
  return t2;
}
function Re(e2) {
  var t2 = Ee(e2.x * e2.x + e2.y * e2.y);
  if (t2 > 0) {
    var n2 = 1 / t2;
    e2.x *= n2, e2.y *= n2;
  }
  return e2;
}
function ze(e2, t2, n2) {
  var r2 = n2 * t2.y, i2 = -n2 * t2.x;
  return e2.x = r2, e2.y = i2, e2;
}
function Be(e2, t2, n2) {
  var r2 = -t2 * n2.y, i2 = t2 * n2.x;
  return e2.x = r2, e2.y = i2, e2;
}
function z(e2, t2) {
  return e2.x * t2.y - e2.y * t2.x;
}
function B(e2, t2) {
  return e2.x * t2.x + e2.y * t2.y;
}
function Ve(e2) {
  return e2.x * e2.x + e2.y * e2.y;
}
function He(e2, t2) {
  var n2 = e2.x - t2.x, r2 = e2.y - t2.y;
  return Ee(n2 * n2 + r2 * r2);
}
function Ue(e2, t2) {
  var n2 = e2.x - t2.x, r2 = e2.y - t2.y;
  return n2 * n2 + r2 * r2;
}
function We(e2, t2) {
  return e2.c = Te(t2), e2.s = we(t2), e2;
}
function Ge(e2, t2, n2) {
  return e2.x = t2.c * n2.x - t2.s * n2.y, e2.y = t2.s * n2.x + t2.c * n2.y, e2;
}
function Ke(e2, t2, n2) {
  var r2 = t2.c * n2.x + t2.s * n2.y, i2 = -t2.s * n2.x + t2.c * n2.y;
  return e2.x = r2, e2.y = i2, e2;
}
function qe(e2, t2, n2, r2) {
  var i2 = t2.c * r2.x + t2.s * r2.y, a2 = -t2.s * r2.x + t2.c * r2.y, o2 = n2.c * i2 - n2.s * a2, s2 = n2.s * i2 + n2.c * a2;
  return e2.x = o2, e2.y = s2, e2;
}
function Je(e2, t2, n2) {
  return { p: N(e2, t2), q: De(n2) };
}
function Ye(e2, t2) {
  return e2.p.x = t2.p.x, e2.p.y = t2.p.y, e2.q.s = t2.q.s, e2.q.c = t2.q.c, e2;
}
function V(e2, t2, n2) {
  var r2 = t2.q.c * n2.x - t2.q.s * n2.y + t2.p.x, i2 = t2.q.s * n2.x + t2.q.c * n2.y + t2.p.y;
  return e2.x = r2, e2.y = i2, e2;
}
function Xe(e2, t2, n2) {
  var r2 = n2.x - t2.p.x, i2 = n2.y - t2.p.y, a2 = t2.q.c * r2 + t2.q.s * i2, o2 = -t2.q.s * r2 + t2.q.c * i2;
  return e2.x = a2, e2.y = o2, e2;
}
function Ze(e2, t2, n2, r2) {
  var i2 = t2.q.c * r2.x - t2.q.s * r2.y + t2.p.x, a2 = t2.q.s * r2.x + t2.q.c * r2.y + t2.p.y, o2 = i2 - n2.p.x, s2 = a2 - n2.p.y, c2 = n2.q.c * o2 + n2.q.s * s2, l2 = -n2.q.s * o2 + n2.q.c * s2;
  return e2.x = c2, e2.y = l2, e2;
}
function Qe(e2, t2, n2) {
  var r2 = t2.q.c * n2.q.c + t2.q.s * n2.q.s, i2 = t2.q.c * n2.q.s - t2.q.s * n2.q.c, a2 = t2.q.c * (n2.p.x - t2.p.x) + t2.q.s * (n2.p.y - t2.p.y), o2 = -t2.q.s * (n2.p.x - t2.p.x) + t2.q.c * (n2.p.y - t2.p.y);
  return e2.q.c = r2, e2.q.s = i2, e2.p.x = a2, e2.p.y = o2, e2;
}
var $e = Math.sin, et = Math.cos, tt = Math.atan2, H = function() {
  function e2(t2) {
    if (!(this instanceof e2)) return new e2(t2);
    typeof t2 == `number` ? this.setAngle(t2) : typeof t2 == `object` ? this.setRot(t2) : this.setIdentity();
  }
  return e2.neo = function(t2) {
    var n2 = Object.create(e2.prototype);
    return n2.setAngle(t2), n2;
  }, e2.clone = function(t2) {
    var n2 = Object.create(e2.prototype);
    return n2.s = t2.s, n2.c = t2.c, n2;
  }, e2.identity = function() {
    var t2 = Object.create(e2.prototype);
    return t2.s = 0, t2.c = 1, t2;
  }, e2.isValid = function(e3) {
    return e3 != null && Number.isFinite(e3.s) && Number.isFinite(e3.c);
  }, e2.assert = function(e3) {
  }, e2.prototype.setIdentity = function() {
    this.s = 0, this.c = 1;
  }, e2.prototype.set = function(e3) {
    typeof e3 == `object` ? (this.s = e3.s, this.c = e3.c) : (this.s = $e(e3), this.c = et(e3));
  }, e2.prototype.setRot = function(e3) {
    this.s = e3.s, this.c = e3.c;
  }, e2.prototype.setAngle = function(e3) {
    this.s = $e(e3), this.c = et(e3);
  }, e2.prototype.getAngle = function() {
    return tt(this.s, this.c);
  }, e2.prototype.getXAxis = function() {
    return Vec2.neo(this.c, this.s);
  }, e2.prototype.getYAxis = function() {
    return Vec2.neo(-this.s, this.c);
  }, e2.mul = function(t2, n2) {
    if (`c` in n2 && `s` in n2) {
      var r2 = e2.identity();
      return r2.s = t2.s * n2.c + t2.c * n2.s, r2.c = t2.c * n2.c - t2.s * n2.s, r2;
    }
    if (`x` in n2 && `y` in n2) return Vec2.neo(t2.c * n2.x - t2.s * n2.y, t2.s * n2.x + t2.c * n2.y);
  }, e2.mulRot = function(t2, n2) {
    var r2 = e2.identity();
    return r2.s = t2.s * n2.c + t2.c * n2.s, r2.c = t2.c * n2.c - t2.s * n2.s, r2;
  }, e2.mulVec2 = function(e3, t2) {
    return Vec2.neo(e3.c * t2.x - e3.s * t2.y, e3.s * t2.x + e3.c * t2.y);
  }, e2.mulSub = function(e3, t2, n2) {
    var r2 = e3.c * (t2.x - n2.x) - e3.s * (t2.y - n2.y), i2 = e3.s * (t2.x - n2.x) + e3.c * (t2.y - n2.y);
    return Vec2.neo(r2, i2);
  }, e2.mulT = function(t2, n2) {
    if (`c` in n2 && `s` in n2) {
      var r2 = e2.identity();
      return r2.s = t2.c * n2.s - t2.s * n2.c, r2.c = t2.c * n2.c + t2.s * n2.s, r2;
    }
    if (`x` in n2 && `y` in n2) return Vec2.neo(t2.c * n2.x + t2.s * n2.y, -t2.s * n2.x + t2.c * n2.y);
  }, e2.mulTRot = function(t2, n2) {
    var r2 = e2.identity();
    return r2.s = t2.c * n2.s - t2.s * n2.c, r2.c = t2.c * n2.c + t2.s * n2.s, r2;
  }, e2.mulTVec2 = function(e3, t2) {
    return Vec2.neo(e3.c * t2.x + e3.s * t2.y, -e3.s * t2.x + e3.c * t2.y);
  }, e2;
}(), nt = Math.atan2, rt = Math.PI, it = N(0, 0), at = function() {
  function e2() {
    this.localCenter = Vec2.zero(), this.c = Vec2.zero(), this.a = 0, this.alpha0 = 0, this.c0 = Vec2.zero(), this.a0 = 0;
  }
  return e2.prototype.recycle = function() {
    F(this.localCenter), F(this.c), this.a = 0, this.alpha0 = 0, F(this.c0), this.a0 = 0;
  }, e2.prototype.setTransform = function(e3) {
    V(it, e3, this.localCenter), P(this.c, it), P(this.c0, it), this.a = this.a0 = nt(e3.q.s, e3.q.c);
  }, e2.prototype.setLocalCenter = function(e3, t2) {
    P(this.localCenter, e3), V(it, t2, this.localCenter), P(this.c, it), P(this.c0, it);
  }, e2.prototype.getTransform = function(e3, t2) {
    t2 === void 0 && (t2 = 0), We(e3.q, (1 - t2) * this.a0 + t2 * this.a), R(e3.p, 1 - t2, this.c0, t2, this.c), Me(e3.p, Ge(it, e3.q, this.localCenter));
  }, e2.prototype.advance = function(e3) {
    var t2 = (e3 - this.alpha0) / (1 - this.alpha0);
    R(this.c0, t2, this.c, 1 - t2, this.c0), this.a0 = t2 * this.a + (1 - t2) * this.a0, this.alpha0 = e3;
  }, e2.prototype.forward = function() {
    this.a0 = this.a, P(this.c0, this.c);
  }, e2.prototype.normalize = function() {
    var e3 = re(this.a0, -rt, +rt);
    this.a -= this.a0 - e3, this.a0 = e3;
  }, e2.prototype.isValid = function() {
    return Number.isFinite(this.localCenter.x) && Number.isFinite(this.localCenter.y) && Number.isFinite(this.c0.x) && Number.isFinite(this.c0.y) && Number.isFinite(this.c.x) && Number.isFinite(this.c.y) && Number.isFinite(this.a0) && Number.isFinite(this.a) && Number.isFinite(this.alpha0);
  }, e2.prototype.set = function(e3) {
    P(this.localCenter, e3.localCenter), P(this.c, e3.c), this.a = e3.a, this.alpha0 = e3.alpha0, P(this.c0, e3.c0), this.a0 = e3.a0;
  }, e2;
}(), ot = function() {
  function e2(t2, n2) {
    if (!(this instanceof e2)) return new e2(t2, n2);
    this.p = Vec2.zero(), this.q = H.identity(), t2 !== void 0 && this.p.setVec2(t2), n2 !== void 0 && this.q.setAngle(n2);
  }
  return e2.clone = function(t2) {
    var n2 = Object.create(e2.prototype);
    return n2.p = Vec2.clone(t2.p), n2.q = H.clone(t2.q), n2;
  }, e2.neo = function(t2, n2) {
    var r2 = Object.create(e2.prototype);
    return r2.p = Vec2.clone(t2), r2.q = H.clone(n2), r2;
  }, e2.identity = function() {
    var t2 = Object.create(e2.prototype);
    return t2.p = Vec2.zero(), t2.q = H.identity(), t2;
  }, e2.prototype.setIdentity = function() {
    this.p.setZero(), this.q.setIdentity();
  }, e2.prototype.set = function(e3, t2) {
    t2 === void 0 ? (this.p.set(e3.p), this.q.set(e3.q)) : (this.p.set(e3), this.q.set(t2));
  }, e2.prototype.setNum = function(e3, t2) {
    this.p.setVec2(e3), this.q.setAngle(t2);
  }, e2.prototype.setTransform = function(e3) {
    this.p.setVec2(e3.p), this.q.setRot(e3.q);
  }, e2.isValid = function(e3) {
    return e3 != null && Vec2.isValid(e3.p) && H.isValid(e3.q);
  }, e2.assert = function(e3) {
  }, e2.mul = function(t2, n2) {
    if (Array.isArray(n2)) {
      for (var r2 = [], i2 = 0; i2 < n2.length; i2++) r2[i2] = e2.mul(t2, n2[i2]);
      return r2;
    }
    if (`x` in n2 && `y` in n2) return e2.mulVec2(t2, n2);
    if (`p` in n2 && `q` in n2) return e2.mulXf(t2, n2);
  }, e2.mulAll = function(t2, n2) {
    for (var r2 = [], i2 = 0; i2 < n2.length; i2++) r2[i2] = e2.mul(t2, n2[i2]);
    return r2;
  }, e2.mulFn = function(t2) {
    return function(n2) {
      return e2.mul(t2, n2);
    };
  }, e2.mulVec2 = function(e3, t2) {
    var n2 = e3.q.c * t2.x - e3.q.s * t2.y + e3.p.x, r2 = e3.q.s * t2.x + e3.q.c * t2.y + e3.p.y;
    return Vec2.neo(n2, r2);
  }, e2.mulXf = function(t2, n2) {
    var r2 = e2.identity();
    return r2.q = H.mulRot(t2.q, n2.q), r2.p = Vec2.add(H.mulVec2(t2.q, n2.p), t2.p), r2;
  }, e2.mulT = function(t2, n2) {
    if (`x` in n2 && `y` in n2) return e2.mulTVec2(t2, n2);
    if (`p` in n2 && `q` in n2) return e2.mulTXf(t2, n2);
  }, e2.mulTVec2 = function(e3, t2) {
    var n2 = t2.x - e3.p.x, r2 = t2.y - e3.p.y, i2 = e3.q.c * n2 + e3.q.s * r2, a2 = -e3.q.s * n2 + e3.q.c * r2;
    return Vec2.neo(i2, a2);
  }, e2.mulTXf = function(t2, n2) {
    var r2 = e2.identity();
    return r2.q.setRot(H.mulTRot(t2.q, n2.q)), r2.p.setVec2(H.mulTVec2(t2.q, Vec2.sub(n2.p, t2.p))), r2;
  }, e2;
}(), st = /* @__PURE__ */ function() {
  function e2() {
    this.v = Vec2.zero(), this.w = 0;
  }
  return e2;
}(), ct = Math.sin, lt = Math.cos, ut = function() {
  function e2() {
    this.c = Vec2.zero(), this.a = 0;
  }
  return e2.prototype.getTransform = function(e3, t2) {
    return e3.q.c = lt(this.a), e3.q.s = ct(this.a), e3.p.x = this.c.x - (e3.q.c * t2.x - e3.q.s * t2.y), e3.p.y = this.c.y - (e3.q.s * t2.x + e3.q.c * t2.y), e3;
  }, e2;
}();
function dt(e2, t2, n2, r2) {
  return e2.q.c = lt(r2), e2.q.s = ct(r2), e2.p.x = n2.x - (e2.q.c * t2.x - e2.q.s * t2.y), e2.p.y = n2.y - (e2.q.s * t2.x + e2.q.c * t2.y), e2;
}
var ft = function() {
  function e2() {
    this.style = {}, this.appData = {};
  }
  return e2.isValid = function(e3) {
    return e3 != null && typeof e3.m_type == `string` && typeof e3.m_radius == `number`;
  }, e2;
}(), pt = new fe(), mt = new fe(), ht = N(0, 0), gt = { userData: null, friction: 0.2, restitution: 0, density: 0, isSensor: false, filterGroupIndex: 0, filterCategoryBits: 1, filterMaskBits: 65535 }, _t = /* @__PURE__ */ function() {
  function e2(e3, t2) {
    this.aabb = new fe(), this.fixture = e3, this.childIndex = t2;
  }
  return e2;
}(), vt = function() {
  function e2(e3, t2, n2) {
    this.style = {}, this.appData = {}, t2.shape ? (n2 = t2, t2 = t2.shape) : typeof n2 == `number` && (n2 = { density: n2 }), n2 = E(n2, gt), this.m_body = e3, this.m_friction = n2.friction, this.m_restitution = n2.restitution, this.m_density = n2.density, this.m_isSensor = n2.isSensor, this.m_filterGroupIndex = n2.filterGroupIndex, this.m_filterCategoryBits = n2.filterCategoryBits, this.m_filterMaskBits = n2.filterMaskBits, this.m_shape = t2, this.m_next = null, this.m_proxies = [], this.m_proxyCount = 0;
    for (var r2 = this.m_shape.getChildCount(), i2 = 0; i2 < r2; ++i2) this.m_proxies[i2] = new _t(this, i2);
    this.m_userData = n2.userData, typeof n2.style == `object` && n2.style !== null && (this.style = n2.style);
  }
  return e2.prototype._reset = function() {
    var e3 = this.getBody(), t2 = e3.m_world.m_broadPhase;
    this.destroyProxies(t2), this.m_shape._reset && this.m_shape._reset();
    for (var n2 = this.m_shape.getChildCount(), r2 = 0; r2 < n2; ++r2) this.m_proxies[r2] = new _t(this, r2);
    this.createProxies(t2, e3.m_xf), e3.resetMassData();
  }, e2.prototype._serialize = function() {
    return { friction: this.m_friction, restitution: this.m_restitution, density: this.m_density, isSensor: this.m_isSensor, filterGroupIndex: this.m_filterGroupIndex, filterCategoryBits: this.m_filterCategoryBits, filterMaskBits: this.m_filterMaskBits, shape: this.m_shape };
  }, e2._deserialize = function(t2, n2, r2) {
    var i2 = r2(ft, t2.shape);
    return i2 && new e2(n2, i2, t2);
  }, e2.prototype.getType = function() {
    return this.m_shape.m_type;
  }, e2.prototype.getShape = function() {
    return this.m_shape;
  }, e2.prototype.isSensor = function() {
    return this.m_isSensor;
  }, e2.prototype.setSensor = function(e3) {
    e3 != this.m_isSensor && (this.m_body.setAwake(true), this.m_isSensor = e3);
  }, e2.prototype.getUserData = function() {
    return this.m_userData;
  }, e2.prototype.setUserData = function(e3) {
    this.m_userData = e3;
  }, e2.prototype.getBody = function() {
    return this.m_body;
  }, e2.prototype.getNext = function() {
    return this.m_next;
  }, e2.prototype.getDensity = function() {
    return this.m_density;
  }, e2.prototype.setDensity = function(e3) {
    this.m_density = e3;
  }, e2.prototype.getFriction = function() {
    return this.m_friction;
  }, e2.prototype.setFriction = function(e3) {
    this.m_friction = e3;
  }, e2.prototype.getRestitution = function() {
    return this.m_restitution;
  }, e2.prototype.setRestitution = function(e3) {
    this.m_restitution = e3;
  }, e2.prototype.testPoint = function(e3) {
    return this.m_shape.testPoint(this.m_body.getTransform(), e3);
  }, e2.prototype.rayCast = function(e3, t2, n2) {
    return this.m_shape.rayCast(e3, t2, this.m_body.getTransform(), n2);
  }, e2.prototype.getMassData = function(e3) {
    this.m_shape.computeMass(e3, this.m_density);
  }, e2.prototype.getAABB = function(e3) {
    return this.m_proxies[e3].aabb;
  }, e2.prototype.createProxies = function(e3, t2) {
    this.m_proxyCount = this.m_shape.getChildCount();
    for (var n2 = 0; n2 < this.m_proxyCount; ++n2) {
      var r2 = this.m_proxies[n2];
      this.m_shape.computeAABB(r2.aabb, t2, n2), r2.proxyId = e3.createProxy(r2.aabb, r2);
    }
  }, e2.prototype.destroyProxies = function(e3) {
    for (var t2 = 0; t2 < this.m_proxyCount; ++t2) {
      var n2 = this.m_proxies[t2];
      e3.destroyProxy(n2.proxyId), n2.proxyId = null;
    }
    this.m_proxyCount = 0;
  }, e2.prototype.synchronize = function(e3, t2, n2) {
    for (var r2 = 0; r2 < this.m_proxyCount; ++r2) {
      var i2 = this.m_proxies[r2];
      this.m_shape.computeAABB(pt, t2, i2.childIndex), this.m_shape.computeAABB(mt, n2, i2.childIndex), i2.aabb.combine(pt, mt), I(ht, n2.p, t2.p), e3.moveProxy(i2.proxyId, i2.aabb, ht);
    }
  }, e2.prototype.setFilterData = function(e3) {
    this.m_filterGroupIndex = e3.groupIndex, this.m_filterCategoryBits = e3.categoryBits, this.m_filterMaskBits = e3.maskBits, this.refilter();
  }, e2.prototype.getFilterGroupIndex = function() {
    return this.m_filterGroupIndex;
  }, e2.prototype.setFilterGroupIndex = function(e3) {
    this.m_filterGroupIndex = e3, this.refilter();
  }, e2.prototype.getFilterCategoryBits = function() {
    return this.m_filterCategoryBits;
  }, e2.prototype.setFilterCategoryBits = function(e3) {
    this.m_filterCategoryBits = e3, this.refilter();
  }, e2.prototype.getFilterMaskBits = function() {
    return this.m_filterMaskBits;
  }, e2.prototype.setFilterMaskBits = function(e3) {
    this.m_filterMaskBits = e3, this.refilter();
  }, e2.prototype.refilter = function() {
    if (this.m_body != null) {
      for (var e3 = this.m_body.getContactList(); e3; ) {
        var t2 = e3.contact, n2 = t2.getFixtureA(), r2 = t2.getFixtureB();
        (n2 == this || r2 == this) && t2.flagForFiltering(), e3 = e3.next;
      }
      var i2 = this.m_body.getWorld();
      if (i2 != null) for (var a2 = i2.m_broadPhase, o2 = 0; o2 < this.m_proxyCount; ++o2) a2.touchProxy(this.m_proxies[o2].proxyId);
    }
  }, e2.prototype.shouldCollide = function(e3) {
    if (e3.m_filterGroupIndex === this.m_filterGroupIndex && e3.m_filterGroupIndex !== 0) return e3.m_filterGroupIndex > 0;
    var t2 = (e3.m_filterMaskBits & this.m_filterCategoryBits) !== 0, n2 = (e3.m_filterCategoryBits & this.m_filterMaskBits) !== 0;
    return t2 && n2;
  }, e2;
}(), yt = `static`, bt = `kinematic`, xt = `dynamic`, St = N(0, 0), Ct = N(0, 0), wt = N(0, 0), Tt = N(0, 0), Et = Je(0, 0, 0), Dt = { type: yt, position: Vec2.zero(), angle: 0, linearVelocity: Vec2.zero(), angularVelocity: 0, linearDamping: 0, angularDamping: 0, fixedRotation: false, bullet: false, gravityScale: 1, allowSleep: true, awake: true, active: true, userData: null }, U = function() {
  function e2(e3, t2) {
    this.style = {}, this.appData = {}, t2 = E(t2, Dt), this.m_world = e3, this.m_awakeFlag = t2.awake, this.m_autoSleepFlag = t2.allowSleep, this.m_bulletFlag = t2.bullet, this.m_fixedRotationFlag = t2.fixedRotation, this.m_activeFlag = t2.active, this.m_islandFlag = false, this.m_toiFlag = false, this.m_userData = t2.userData, this.m_type = t2.type, this.m_type == xt ? (this.m_mass = 1, this.m_invMass = 1) : (this.m_mass = 0, this.m_invMass = 0), this.m_I = 0, this.m_invI = 0, this.m_xf = ot.identity(), this.m_xf.p.setVec2(t2.position), this.m_xf.q.setAngle(t2.angle), this.m_sweep = new at(), this.m_sweep.setTransform(this.m_xf), this.c_velocity = new st(), this.c_position = new ut(), this.m_force = Vec2.zero(), this.m_torque = 0, this.m_linearVelocity = Vec2.clone(t2.linearVelocity), this.m_angularVelocity = t2.angularVelocity, this.m_linearDamping = t2.linearDamping, this.m_angularDamping = t2.angularDamping, this.m_gravityScale = t2.gravityScale, this.m_sleepTime = 0, this.m_jointList = null, this.m_contactList = null, this.m_fixtureList = null, this.m_prev = null, this.m_next = null, this.m_destroyed = false, typeof t2.style == `object` && t2.style !== null && (this.style = t2.style);
  }
  return e2.prototype._serialize = function() {
    for (var e3 = [], t2 = this.m_fixtureList; t2; t2 = t2.m_next) e3.push(t2);
    return { type: this.m_type, bullet: this.m_bulletFlag, fixedRotation: this.m_fixedRotationFlag, position: this.m_xf.p, angle: this.m_xf.q.getAngle(), linearVelocity: this.m_linearVelocity, angularVelocity: this.m_angularVelocity, fixtures: e3 };
  }, e2._deserialize = function(t2, n2, r2) {
    var i2 = new e2(n2, t2);
    if (t2.fixtures) for (var a2 = t2.fixtures.length - 1; a2 >= 0; a2--) {
      var o2 = r2(vt, t2.fixtures[a2], i2);
      i2._addFixture(o2);
    }
    return i2;
  }, e2.prototype.isWorldLocked = function() {
    return !!(this.m_world && this.m_world.isLocked());
  }, e2.prototype.getWorld = function() {
    return this.m_world;
  }, e2.prototype.getNext = function() {
    return this.m_next;
  }, e2.prototype.setUserData = function(e3) {
    this.m_userData = e3;
  }, e2.prototype.getUserData = function() {
    return this.m_userData;
  }, e2.prototype.getFixtureList = function() {
    return this.m_fixtureList;
  }, e2.prototype.getJointList = function() {
    return this.m_jointList;
  }, e2.prototype.getContactList = function() {
    return this.m_contactList;
  }, e2.prototype.isStatic = function() {
    return this.m_type == yt;
  }, e2.prototype.isDynamic = function() {
    return this.m_type == xt;
  }, e2.prototype.isKinematic = function() {
    return this.m_type == bt;
  }, e2.prototype.setStatic = function() {
    return this.setType(yt), this;
  }, e2.prototype.setDynamic = function() {
    return this.setType(xt), this;
  }, e2.prototype.setKinematic = function() {
    return this.setType(bt), this;
  }, e2.prototype.getType = function() {
    return this.m_type;
  }, e2.prototype.setType = function(e3) {
    if (this.isWorldLocked() != 1 && this.m_type != e3) {
      this.m_type = e3, this.resetMassData(), this.m_type == yt && (this.m_linearVelocity.setZero(), this.m_angularVelocity = 0, this.m_sweep.forward(), this.synchronizeFixtures()), this.setAwake(true), this.m_force.setZero(), this.m_torque = 0;
      for (var t2 = this.m_contactList; t2; ) {
        var n2 = t2;
        t2 = t2.next, this.m_world.destroyContact(n2.contact);
      }
      this.m_contactList = null;
      for (var r2 = this.m_world.m_broadPhase, i2 = this.m_fixtureList; i2; i2 = i2.m_next) for (var a2 = 0; a2 < i2.m_proxyCount; ++a2) r2.touchProxy(i2.m_proxies[a2].proxyId);
    }
  }, e2.prototype.isBullet = function() {
    return this.m_bulletFlag;
  }, e2.prototype.setBullet = function(e3) {
    this.m_bulletFlag = !!e3;
  }, e2.prototype.isSleepingAllowed = function() {
    return this.m_autoSleepFlag;
  }, e2.prototype.setSleepingAllowed = function(e3) {
    this.m_autoSleepFlag = !!e3, this.m_autoSleepFlag == 0 && this.setAwake(true);
  }, e2.prototype.isAwake = function() {
    return this.m_awakeFlag;
  }, e2.prototype.setAwake = function(e3) {
    e3 ? (this.m_awakeFlag = true, this.m_sleepTime = 0) : (this.m_awakeFlag = false, this.m_sleepTime = 0, this.m_linearVelocity.setZero(), this.m_angularVelocity = 0, this.m_force.setZero(), this.m_torque = 0);
  }, e2.prototype.isActive = function() {
    return this.m_activeFlag;
  }, e2.prototype.setActive = function(e3) {
    if (e3 != this.m_activeFlag) {
      if (this.m_activeFlag = !!e3, this.m_activeFlag) {
        for (var t2 = this.m_world.m_broadPhase, n2 = this.m_fixtureList; n2; n2 = n2.m_next) n2.createProxies(t2, this.m_xf);
        this.m_world.m_newFixture = true;
      } else {
        for (var t2 = this.m_world.m_broadPhase, n2 = this.m_fixtureList; n2; n2 = n2.m_next) n2.destroyProxies(t2);
        for (var r2 = this.m_contactList; r2; ) {
          var i2 = r2;
          r2 = r2.next, this.m_world.destroyContact(i2.contact);
        }
        this.m_contactList = null;
      }
    }
  }, e2.prototype.isFixedRotation = function() {
    return this.m_fixedRotationFlag;
  }, e2.prototype.setFixedRotation = function(e3) {
    this.m_fixedRotationFlag != e3 && (this.m_fixedRotationFlag = !!e3, this.m_angularVelocity = 0, this.resetMassData());
  }, e2.prototype.getTransform = function() {
    return this.m_xf;
  }, e2.prototype.setTransform = function(e3, t2) {
    if (this.isWorldLocked() != 1) {
      typeof t2 == `number` ? this.m_xf.setNum(e3, t2) : this.m_xf.setTransform(e3), this.m_sweep.setTransform(this.m_xf);
      for (var n2 = this.m_world.m_broadPhase, r2 = this.m_fixtureList; r2; r2 = r2.m_next) r2.synchronize(n2, this.m_xf, this.m_xf);
      this.setAwake(true);
    }
  }, e2.prototype.synchronizeTransform = function() {
    this.m_sweep.getTransform(this.m_xf, 1);
  }, e2.prototype.synchronizeFixtures = function() {
    this.m_sweep.getTransform(Et, 0);
    for (var e3 = this.m_world.m_broadPhase, t2 = this.m_fixtureList; t2; t2 = t2.m_next) t2.synchronize(e3, Et, this.m_xf);
  }, e2.prototype.advance = function(e3) {
    this.m_sweep.advance(e3), P(this.m_sweep.c, this.m_sweep.c0), this.m_sweep.a = this.m_sweep.a0, this.m_sweep.getTransform(this.m_xf, 1);
  }, e2.prototype.getPosition = function() {
    return this.m_xf.p;
  }, e2.prototype.setPosition = function(e3) {
    this.setTransform(e3, this.m_sweep.a);
  }, e2.prototype.getAngle = function() {
    return this.m_sweep.a;
  }, e2.prototype.setAngle = function(e3) {
    this.setTransform(this.m_xf.p, e3);
  }, e2.prototype.getWorldCenter = function() {
    return this.m_sweep.c;
  }, e2.prototype.getLocalCenter = function() {
    return this.m_sweep.localCenter;
  }, e2.prototype.getLinearVelocity = function() {
    return this.m_linearVelocity;
  }, e2.prototype.getLinearVelocityFromWorldPoint = function(e3) {
    var t2 = Vec2.sub(e3, this.m_sweep.c);
    return Vec2.add(this.m_linearVelocity, Vec2.crossNumVec2(this.m_angularVelocity, t2));
  }, e2.prototype.getLinearVelocityFromLocalPoint = function(e3) {
    return this.getLinearVelocityFromWorldPoint(this.getWorldPoint(e3));
  }, e2.prototype.setLinearVelocity = function(e3) {
    this.m_type != yt && (Vec2.dot(e3, e3) > 0 && this.setAwake(true), this.m_linearVelocity.setVec2(e3));
  }, e2.prototype.getAngularVelocity = function() {
    return this.m_angularVelocity;
  }, e2.prototype.setAngularVelocity = function(e3) {
    this.m_type != yt && (e3 * e3 > 0 && this.setAwake(true), this.m_angularVelocity = e3);
  }, e2.prototype.getLinearDamping = function() {
    return this.m_linearDamping;
  }, e2.prototype.setLinearDamping = function(e3) {
    this.m_linearDamping = e3;
  }, e2.prototype.getAngularDamping = function() {
    return this.m_angularDamping;
  }, e2.prototype.setAngularDamping = function(e3) {
    this.m_angularDamping = e3;
  }, e2.prototype.getGravityScale = function() {
    return this.m_gravityScale;
  }, e2.prototype.setGravityScale = function(e3) {
    this.m_gravityScale = e3;
  }, e2.prototype.getMass = function() {
    return this.m_mass;
  }, e2.prototype.getInertia = function() {
    return this.m_I + this.m_mass * Vec2.dot(this.m_sweep.localCenter, this.m_sweep.localCenter);
  }, e2.prototype.getMassData = function(e3) {
    e3.mass = this.m_mass, e3.I = this.getInertia(), P(e3.center, this.m_sweep.localCenter);
  }, e2.prototype.resetMassData = function() {
    if (this.m_mass = 0, this.m_invMass = 0, this.m_I = 0, this.m_invI = 0, F(this.m_sweep.localCenter), this.isStatic() || this.isKinematic()) P(this.m_sweep.c0, this.m_xf.p), P(this.m_sweep.c, this.m_xf.p), this.m_sweep.a0 = this.m_sweep.a;
    else {
      F(Ct);
      for (var e3 = this.m_fixtureList; e3; e3 = e3.m_next) if (e3.m_density != 0) {
        var t2 = { mass: 0, center: N(0, 0), I: 0 };
        e3.getMassData(t2), this.m_mass += t2.mass, Pe(Ct, t2.mass, t2.center), this.m_I += t2.I;
      }
      this.m_mass > 0 ? (this.m_invMass = 1 / this.m_mass, L(Ct, this.m_invMass, Ct)) : (this.m_mass = 1, this.m_invMass = 1), this.m_I > 0 && this.m_fixedRotationFlag == 0 ? (this.m_I -= this.m_mass * B(Ct, Ct), this.m_invI = 1 / this.m_I) : (this.m_I = 0, this.m_invI = 0), P(St, this.m_sweep.c), this.m_sweep.setLocalCenter(Ct, this.m_xf), I(wt, this.m_sweep.c, St), Be(Tt, this.m_angularVelocity, wt), Ae(this.m_linearVelocity, Tt);
    }
  }, e2.prototype.setMassData = function(e3) {
    this.isWorldLocked() != 1 && this.m_type == xt && (this.m_invMass = 0, this.m_I = 0, this.m_invI = 0, this.m_mass = e3.mass, this.m_mass <= 0 && (this.m_mass = 1), this.m_invMass = 1 / this.m_mass, e3.I > 0 && this.m_fixedRotationFlag == 0 && (this.m_I = e3.I - this.m_mass * B(e3.center, e3.center), this.m_invI = 1 / this.m_I), P(St, this.m_sweep.c), this.m_sweep.setLocalCenter(e3.center, this.m_xf), I(wt, this.m_sweep.c, St), Be(Tt, this.m_angularVelocity, wt), Ae(this.m_linearVelocity, Tt));
  }, e2.prototype.applyForce = function(e3, t2, n2) {
    n2 === void 0 && (n2 = true), this.m_type == xt && (n2 && this.m_awakeFlag == 0 && this.setAwake(true), this.m_awakeFlag && (this.m_force.add(e3), this.m_torque += Vec2.crossVec2Vec2(Vec2.sub(t2, this.m_sweep.c), e3)));
  }, e2.prototype.applyForceToCenter = function(e3, t2) {
    t2 === void 0 && (t2 = true), this.m_type == xt && (t2 && this.m_awakeFlag == 0 && this.setAwake(true), this.m_awakeFlag && this.m_force.add(e3));
  }, e2.prototype.applyTorque = function(e3, t2) {
    t2 === void 0 && (t2 = true), this.m_type == xt && (t2 && this.m_awakeFlag == 0 && this.setAwake(true), this.m_awakeFlag && (this.m_torque += e3));
  }, e2.prototype.applyLinearImpulse = function(e3, t2, n2) {
    n2 === void 0 && (n2 = true), this.m_type == xt && (n2 && this.m_awakeFlag == 0 && this.setAwake(true), this.m_awakeFlag && (this.m_linearVelocity.addMul(this.m_invMass, e3), this.m_angularVelocity += this.m_invI * Vec2.crossVec2Vec2(Vec2.sub(t2, this.m_sweep.c), e3)));
  }, e2.prototype.applyAngularImpulse = function(e3, t2) {
    t2 === void 0 && (t2 = true), this.m_type == xt && (t2 && this.m_awakeFlag == 0 && this.setAwake(true), this.m_awakeFlag && (this.m_angularVelocity += this.m_invI * e3));
  }, e2.prototype.shouldCollide = function(e3) {
    if (this.m_type != xt && e3.m_type != xt) return false;
    for (var t2 = this.m_jointList; t2; t2 = t2.next) if (t2.other == e3 && t2.joint.m_collideConnected == 0) return false;
    return true;
  }, e2.prototype._addFixture = function(e3) {
    if (this.isWorldLocked() == 1) return null;
    if (this.m_activeFlag) {
      var t2 = this.m_world.m_broadPhase;
      e3.createProxies(t2, this.m_xf);
    }
    return e3.m_next = this.m_fixtureList, this.m_fixtureList = e3, e3.m_density > 0 && this.resetMassData(), this.m_world.m_newFixture = true, e3;
  }, e2.prototype.createFixture = function(e3, t2) {
    if (this.isWorldLocked() == 1) return null;
    var n2 = new vt(this, e3, t2);
    return this._addFixture(n2), this.m_world.publish(`add-fixture`, n2), n2;
  }, e2.prototype.destroyFixture = function(e3) {
    if (this.isWorldLocked() != 1) {
      if (this.m_fixtureList === e3) this.m_fixtureList = e3.m_next;
      else for (var t2 = this.m_fixtureList; t2 != null; ) {
        if (t2.m_next === e3) {
          t2.m_next = e3.m_next;
          break;
        }
        t2 = t2.m_next;
      }
      for (var n2 = this.m_contactList; n2; ) {
        var r2 = n2.contact;
        n2 = n2.next;
        var i2 = r2.getFixtureA(), a2 = r2.getFixtureB();
        (e3 == i2 || e3 == a2) && this.m_world.destroyContact(r2);
      }
      if (this.m_activeFlag) {
        var o2 = this.m_world.m_broadPhase;
        e3.destroyProxies(o2);
      }
      e3.m_body = null, e3.m_next = null, this.m_world.publish(`remove-fixture`, e3), this.resetMassData();
    }
  }, e2.prototype.getWorldPoint = function(e3) {
    return ot.mulVec2(this.m_xf, e3);
  }, e2.prototype.getWorldVector = function(e3) {
    return H.mulVec2(this.m_xf.q, e3);
  }, e2.prototype.getLocalPoint = function(e3) {
    return ot.mulTVec2(this.m_xf, e3);
  }, e2.prototype.getLocalVector = function(e3) {
    return H.mulTVec2(this.m_xf.q, e3);
  }, e2.STATIC = `static`, e2.KINEMATIC = `kinematic`, e2.DYNAMIC = `dynamic`, e2;
}(), Ot = /* @__PURE__ */ function() {
  function e2() {
    this.other = null, this.joint = null, this.prev = null, this.next = null;
  }
  return e2;
}(), kt = function() {
  function e2(e3, t2, n2) {
    this.m_type = `unknown-joint`, this.m_prev = null, this.m_next = null, this.m_edgeA = new Ot(), this.m_edgeB = new Ot(), this.m_islandFlag = false, this.style = {}, this.appData = {}, t2 = `bodyA` in e3 ? e3.bodyA : t2, n2 = `bodyB` in e3 ? e3.bodyB : n2, this.m_bodyA = t2, this.m_bodyB = n2, this.m_collideConnected = !!e3.collideConnected, this.m_userData = e3.userData, typeof e3.style == `object` && e3.style !== null && (this.style = e3.style);
  }
  return e2.prototype.isActive = function() {
    return this.m_bodyA.isActive() && this.m_bodyB.isActive();
  }, e2.prototype.getType = function() {
    return this.m_type;
  }, e2.prototype.getBodyA = function() {
    return this.m_bodyA;
  }, e2.prototype.getBodyB = function() {
    return this.m_bodyB;
  }, e2.prototype.getNext = function() {
    return this.m_next;
  }, e2.prototype.getUserData = function() {
    return this.m_userData;
  }, e2.prototype.setUserData = function(e3) {
    this.m_userData = e3;
  }, e2.prototype.getCollideConnected = function() {
    return this.m_collideConnected;
  }, e2.prototype.shiftOrigin = function(e3) {
  }, e2.prototype._resetAnchors = function(e3) {
    return this._reset(e3);
  }, e2;
}(), W = { gjkCalls: 0, gjkIters: 0, gjkMaxIters: 0, toiTime: 0, toiMaxTime: 0, toiCalls: 0, toiIters: 0, toiMaxIters: 0, toiRootIters: 0, toiMaxRootIters: 0, toString: function(e2) {
  e2 = typeof e2 == `string` ? e2 : `
`;
  var t2 = ``;
  for (var n2 in this) typeof this[n2] != `function` && typeof this[n2] != `object` && (t2 += n2 + `: ` + this[n2] + e2);
  return t2;
} }, At = { now: function() {
  return Date.now();
}, diff: function(e2) {
  return Date.now() - e2;
} }, jt = Math.max, Mt = N(0, 0), Nt = N(0, 0), Pt = N(0, 0), Ft = N(0, 0), It = N(0, 0), Lt = N(0, 0), Rt = N(0, 0);
W.gjkCalls = 0, W.gjkIters = 0, W.gjkMaxIters = 0;
var zt = function() {
  function e2() {
    this.proxyA = new Ut(), this.proxyB = new Ut(), this.transformA = ot.identity(), this.transformB = ot.identity(), this.useRadii = false;
  }
  return e2.prototype.recycle = function() {
    this.proxyA.recycle(), this.proxyB.recycle(), this.transformA.setIdentity(), this.transformB.setIdentity(), this.useRadii = false;
  }, e2;
}(), Bt = function() {
  function e2() {
    this.pointA = N(0, 0), this.pointB = N(0, 0), this.distance = 0, this.iterations = 0;
  }
  return e2.prototype.recycle = function() {
    F(this.pointA), F(this.pointB), this.distance = 0, this.iterations = 0;
  }, e2;
}(), Vt = function() {
  function e2() {
    this.metric = 0, this.indexA = [], this.indexB = [], this.count = 0;
  }
  return e2.prototype.recycle = function() {
    this.metric = 0, this.indexA.length = 0, this.indexB.length = 0, this.count = 0;
  }, e2;
}(), Ht = function(e2, t2, n2) {
  ++W.gjkCalls;
  var r2 = n2.proxyA, i2 = n2.proxyB, a2 = n2.transformA, o2 = n2.transformB;
  qt.recycle(), qt.readCache(t2, r2, a2, i2, o2);
  for (var s2 = qt.m_v, c2 = M.maxDistanceIterations, l2 = [], u2 = [], d2 = 0, f2 = 0; f2 < c2; ) {
    d2 = qt.m_count;
    for (var p2 = 0; p2 < d2; ++p2) l2[p2] = s2[p2].indexA, u2[p2] = s2[p2].indexB;
    if (qt.solve(), qt.m_count === 3) break;
    var m2 = qt.getSearchDirection();
    if (Ve(m2) < O * O) break;
    var h2 = s2[qt.m_count];
    h2.indexA = r2.getSupport(Ke(Mt, a2.q, L(Mt, -1, m2))), V(h2.wA, a2, r2.getVertex(h2.indexA)), h2.indexB = i2.getSupport(Ke(Mt, o2.q, m2)), V(h2.wB, o2, i2.getVertex(h2.indexB)), I(h2.w, h2.wB, h2.wA), ++f2, ++W.gjkIters;
    for (var g2 = false, p2 = 0; p2 < d2; ++p2) if (h2.indexA === l2[p2] && h2.indexB === u2[p2]) {
      g2 = true;
      break;
    }
    if (g2) break;
    ++qt.m_count;
  }
  if (W.gjkMaxIters = jt(W.gjkMaxIters, f2), qt.getWitnessPoints(e2.pointA, e2.pointB), e2.distance = He(e2.pointA, e2.pointB), e2.iterations = f2, qt.writeCache(t2), n2.useRadii) {
    var _2 = r2.m_radius, v2 = i2.m_radius;
    if (e2.distance > _2 + v2 && e2.distance > O) e2.distance -= _2 + v2, I(Nt, e2.pointB, e2.pointA), Re(Nt), Pe(e2.pointA, _2, Nt), Fe(e2.pointB, v2, Nt);
    else {
      var y2 = I(Mt, e2.pointA, e2.pointB);
      P(e2.pointA, y2), P(e2.pointB, y2), e2.distance = 0;
    }
  }
}, Ut = function() {
  function e2() {
    this.m_vertices = [], this.m_count = 0, this.m_radius = 0;
  }
  return e2.prototype.recycle = function() {
    this.m_vertices.length = 0, this.m_count = 0, this.m_radius = 0;
  }, e2.prototype.getVertexCount = function() {
    return this.m_count;
  }, e2.prototype.getVertex = function(e3) {
    return this.m_vertices[e3];
  }, e2.prototype.getSupport = function(e3) {
    for (var t2 = 0, n2 = -1 / 0, r2 = 0; r2 < this.m_count; ++r2) {
      var i2 = B(this.m_vertices[r2], e3);
      i2 > n2 && (t2 = r2, n2 = i2);
    }
    return t2;
  }, e2.prototype.getSupportVertex = function(e3) {
    return this.m_vertices[this.getSupport(e3)];
  }, e2.prototype.set = function(e3, t2) {
    e3.computeDistanceProxy(this, t2);
  }, e2.prototype.setVertices = function(e3, t2, n2) {
    this.m_vertices = e3, this.m_count = t2, this.m_radius = n2;
  }, e2;
}(), Wt = function() {
  function e2() {
    this.wA = N(0, 0), this.indexA = 0, this.wB = N(0, 0), this.indexB = 0, this.w = N(0, 0), this.a = 0;
  }
  return e2.prototype.recycle = function() {
    this.indexA = 0, this.indexB = 0, F(this.wA), F(this.wB), F(this.w), this.a = 0;
  }, e2.prototype.set = function(e3) {
    this.indexA = e3.indexA, this.indexB = e3.indexB, P(this.wA, e3.wA), P(this.wB, e3.wB), P(this.w, e3.w), this.a = e3.a;
  }, e2;
}(), Gt = N(0, 0), Kt = N(0, 0), qt = new (function() {
  function e2() {
    this.m_v1 = new Wt(), this.m_v2 = new Wt(), this.m_v3 = new Wt(), this.m_v = [this.m_v1, this.m_v2, this.m_v3];
  }
  return e2.prototype.recycle = function() {
    this.m_v1.recycle(), this.m_v2.recycle(), this.m_v3.recycle(), this.m_count = 0;
  }, e2.prototype.toString = function() {
    return this.m_count === 3 ? [`+` + this.m_count, this.m_v1.a, this.m_v1.wA.x, this.m_v1.wA.y, this.m_v1.wB.x, this.m_v1.wB.y, this.m_v2.a, this.m_v2.wA.x, this.m_v2.wA.y, this.m_v2.wB.x, this.m_v2.wB.y, this.m_v3.a, this.m_v3.wA.x, this.m_v3.wA.y, this.m_v3.wB.x, this.m_v3.wB.y].toString() : this.m_count === 2 ? [`+` + this.m_count, this.m_v1.a, this.m_v1.wA.x, this.m_v1.wA.y, this.m_v1.wB.x, this.m_v1.wB.y, this.m_v2.a, this.m_v2.wA.x, this.m_v2.wA.y, this.m_v2.wB.x, this.m_v2.wB.y].toString() : this.m_count === 1 ? [`+` + this.m_count, this.m_v1.a, this.m_v1.wA.x, this.m_v1.wA.y, this.m_v1.wB.x, this.m_v1.wB.y].toString() : `+` + this.m_count;
  }, e2.prototype.readCache = function(e3, t2, n2, r2, i2) {
    this.m_count = e3.count;
    for (var a2 = 0; a2 < this.m_count; ++a2) {
      var o2 = this.m_v[a2];
      o2.indexA = e3.indexA[a2], o2.indexB = e3.indexB[a2];
      var s2 = t2.getVertex(o2.indexA), c2 = r2.getVertex(o2.indexB);
      V(o2.wA, n2, s2), V(o2.wB, i2, c2), I(o2.w, o2.wB, o2.wA), o2.a = 0;
    }
    if (this.m_count > 1) {
      var l2 = e3.metric, u2 = this.getMetric();
      (u2 < 0.5 * l2 || 2 * l2 < u2 || u2 < O) && (this.m_count = 0);
    }
    if (this.m_count === 0) {
      var o2 = this.m_v[0];
      o2.indexA = 0, o2.indexB = 0;
      var s2 = t2.getVertex(0), c2 = r2.getVertex(0);
      V(o2.wA, n2, s2), V(o2.wB, i2, c2), I(o2.w, o2.wB, o2.wA), o2.a = 1, this.m_count = 1;
    }
  }, e2.prototype.writeCache = function(e3) {
    e3.metric = this.getMetric(), e3.count = this.m_count;
    for (var t2 = 0; t2 < this.m_count; ++t2) e3.indexA[t2] = this.m_v[t2].indexA, e3.indexB[t2] = this.m_v[t2].indexB;
  }, e2.prototype.getSearchDirection = function() {
    var e3 = this.m_v1, t2 = this.m_v2;
    switch (this.m_count) {
      case 1:
        return Oe(Gt, -e3.w.x, -e3.w.y);
      case 2:
        return I(Pt, t2.w, e3.w), -z(Pt, e3.w) > 0 ? Oe(Gt, -Pt.y, Pt.x) : Oe(Gt, Pt.y, -Pt.x);
      default:
        return F(Gt);
    }
  }, e2.prototype.getClosestPoint = function() {
    var e3 = this.m_v1, t2 = this.m_v2;
    switch (this.m_count) {
      case 0:
        return F(Kt);
      case 1:
        return P(Kt, e3.w);
      case 2:
        return R(Kt, e3.a, e3.w, t2.a, t2.w);
      case 3:
        return F(Kt);
      default:
        return F(Kt);
    }
  }, e2.prototype.getWitnessPoints = function(e3, t2) {
    var n2 = this.m_v1, r2 = this.m_v2, i2 = this.m_v3;
    switch (this.m_count) {
      case 0:
        break;
      case 1:
        P(e3, n2.wA), P(t2, n2.wB);
        break;
      case 2:
        R(e3, n2.a, n2.wA, r2.a, r2.wA), R(t2, n2.a, n2.wB, r2.a, r2.wB);
        break;
      case 3:
        Ie(e3, n2.a, n2.wA, r2.a, r2.wA, i2.a, i2.wA), P(t2, e3);
    }
  }, e2.prototype.getMetric = function() {
    switch (this.m_count) {
      case 0:
        return 0;
      case 1:
        return 0;
      case 2:
        return He(this.m_v1.w, this.m_v2.w);
      case 3:
        return z(I(Lt, this.m_v2.w, this.m_v1.w), I(Rt, this.m_v3.w, this.m_v1.w));
      default:
        return 0;
    }
  }, e2.prototype.solve = function() {
    switch (this.m_count) {
      case 1:
        break;
      case 2:
        this.solve2();
        break;
      case 3:
        this.solve3();
    }
  }, e2.prototype.solve2 = function() {
    var e3 = this.m_v1.w, t2 = this.m_v2.w;
    I(Pt, t2, e3);
    var n2 = -B(e3, Pt);
    if (n2 <= 0) this.m_v1.a = 1, this.m_count = 1;
    else {
      var r2 = B(t2, Pt);
      if (r2 <= 0) this.m_v2.a = 1, this.m_count = 1, this.m_v1.set(this.m_v2);
      else {
        var i2 = 1 / (r2 + n2);
        this.m_v1.a = r2 * i2, this.m_v2.a = n2 * i2, this.m_count = 2;
      }
    }
  }, e2.prototype.solve3 = function() {
    var e3 = this.m_v1.w, t2 = this.m_v2.w, n2 = this.m_v3.w;
    I(Pt, t2, e3);
    var r2 = B(e3, Pt), i2 = B(t2, Pt), a2 = -r2;
    I(Ft, n2, e3);
    var o2 = B(e3, Ft), s2 = B(n2, Ft), c2 = -o2;
    I(It, n2, t2);
    var l2 = B(t2, It), u2 = B(n2, It), d2 = -l2, f2 = z(Pt, Ft), p2 = f2 * z(t2, n2), m2 = f2 * z(n2, e3), h2 = f2 * z(e3, t2);
    if (a2 <= 0 && c2 <= 0) this.m_v1.a = 1, this.m_count = 1;
    else if (i2 > 0 && a2 > 0 && h2 <= 0) {
      var g2 = 1 / (i2 + a2);
      this.m_v1.a = i2 * g2, this.m_v2.a = a2 * g2, this.m_count = 2;
    } else if (s2 > 0 && c2 > 0 && m2 <= 0) {
      var _2 = 1 / (s2 + c2);
      this.m_v1.a = s2 * _2, this.m_v3.a = c2 * _2, this.m_count = 2, this.m_v2.set(this.m_v3);
    } else if (i2 <= 0 && d2 <= 0) this.m_v2.a = 1, this.m_count = 1, this.m_v1.set(this.m_v2);
    else if (s2 <= 0 && u2 <= 0) this.m_v3.a = 1, this.m_count = 1, this.m_v1.set(this.m_v3);
    else if (u2 > 0 && d2 > 0 && p2 <= 0) {
      var v2 = 1 / (u2 + d2);
      this.m_v2.a = u2 * v2, this.m_v3.a = d2 * v2, this.m_count = 2, this.m_v1.set(this.m_v3);
    } else {
      var y2 = 1 / (p2 + m2 + h2);
      this.m_v1.a = p2 * y2, this.m_v2.a = m2 * y2, this.m_v3.a = h2 * y2, this.m_count = 3;
    }
  }, e2;
}())(), Jt = new zt(), Yt = new Vt(), Xt = new Bt(), Zt = function(e2, t2, n2, r2, i2, a2) {
  return Jt.recycle(), Jt.proxyA.set(e2, t2), Jt.proxyB.set(n2, r2), Ye(Jt.transformA, i2), Ye(Jt.transformB, a2), Jt.useRadii = true, Xt.recycle(), Yt.recycle(), Ht(Xt, Yt, Jt), Xt.distance < 10 * O;
};
Ht.testOverlap = Zt, Ht.Input = zt, Ht.Output = Bt, Ht.Proxy = Ut, Ht.Cache = Vt, function() {
  function e2() {
    this.proxyA = new Ut(), this.proxyB = new Ut(), this.transformA = ot.identity(), this.transformB = ot.identity(), this.translationB = Vec2.zero();
  }
  return e2.prototype.recycle = function() {
    this.proxyA.recycle(), this.proxyB.recycle(), this.transformA.setIdentity(), this.transformB.setIdentity(), F(this.translationB);
  }, e2;
}();
var Qt = Math.abs, $t = Math.max, en = function() {
  function e2() {
    this.proxyA = new Ut(), this.proxyB = new Ut(), this.sweepA = new at(), this.sweepB = new at();
  }
  return e2.prototype.recycle = function() {
    this.proxyA.recycle(), this.proxyB.recycle(), this.sweepA.recycle(), this.sweepB.recycle(), this.tMax = -1;
  }, e2;
}(), tn;
(function(e2) {
  e2[e2.e_unset = -1] = `e_unset`, e2[e2.e_unknown = 0] = `e_unknown`, e2[e2.e_failed = 1] = `e_failed`, e2[e2.e_overlapped = 2] = `e_overlapped`, e2[e2.e_touching = 3] = `e_touching`, e2[e2.e_separated = 4] = `e_separated`;
})(tn ||= {});
var nn = function() {
  function e2() {
    this.state = tn.e_unset, this.t = -1;
  }
  return e2.prototype.recycle = function() {
    this.state = tn.e_unset, this.t = -1;
  }, e2;
}();
W.toiTime = 0, W.toiMaxTime = 0, W.toiCalls = 0, W.toiIters = 0, W.toiMaxIters = 0, W.toiRootIters = 0, W.toiMaxRootIters = 0;
var rn = new zt(), an = new Bt(), on = new Vt(), sn = Je(0, 0, 0), cn = Je(0, 0, 0), ln = N(0, 0), un = N(0, 0), dn = N(0, 0), fn = N(0, 0), pn = N(0, 0), mn = N(0, 0), hn = N(0, 0), gn = N(0, 0), _n = function(e2, t2) {
  var n2 = At.now();
  ++W.toiCalls, e2.state = tn.e_unknown, e2.t = t2.tMax;
  var r2 = t2.proxyA, i2 = t2.proxyB, a2 = t2.sweepA, o2 = t2.sweepB;
  if (a2.normalize(), o2.normalize(), !a2.isValid() || !o2.isValid()) e2.state = tn.e_failed;
  else {
    var s2 = t2.tMax, c2 = r2.m_radius + i2.m_radius, l2 = $t(M.linearSlop, c2 - 3 * M.linearSlop), u2 = 0.25 * M.linearSlop, d2 = 0, f2 = M.maxTOIIterations, p2 = 0;
    for (on.recycle(), rn.proxyA.setVertices(r2.m_vertices, r2.m_count, r2.m_radius), rn.proxyB.setVertices(i2.m_vertices, i2.m_count, i2.m_radius), rn.useRadii = false; ; ) {
      if (a2.getTransform(sn, d2), o2.getTransform(cn, d2), Ye(rn.transformA, sn), Ye(rn.transformB, cn), Ht(an, on, rn), an.distance <= 0) {
        e2.state = tn.e_overlapped, e2.t = 0;
        break;
      }
      if (an.distance < l2 + u2) {
        e2.state = tn.e_touching, e2.t = d2;
        break;
      }
      yn.initialize(on, r2, a2, i2, o2, d2);
      for (var m2 = false, h2 = s2, g2 = 0; ; ) {
        var _2 = yn.findMinSeparation(h2);
        if (_2 > l2 + u2) {
          e2.state = tn.e_separated, e2.t = s2, m2 = true;
          break;
        }
        if (_2 > l2 - u2) {
          d2 = h2;
          break;
        }
        var v2 = yn.evaluate(d2);
        if (v2 < l2 - u2) {
          e2.state = tn.e_failed, e2.t = d2, m2 = true;
          break;
        }
        if (v2 <= l2 + u2) {
          e2.state = tn.e_touching, e2.t = d2, m2 = true;
          break;
        }
        for (var y2 = 0, b2 = d2, x2 = h2; ; ) {
          var S2 = void 0;
          S2 = y2 & 1 ? b2 + (l2 - v2) * (x2 - b2) / (_2 - v2) : 0.5 * (b2 + x2), ++y2, ++W.toiRootIters;
          var C2 = yn.evaluate(S2);
          if (Qt(C2 - l2) < u2) {
            h2 = S2;
            break;
          }
          if (C2 > l2 ? (b2 = S2, v2 = C2) : (x2 = S2, _2 = C2), y2 === 50) break;
        }
        if (W.toiMaxRootIters = $t(W.toiMaxRootIters, y2), ++g2, g2 === M.maxPolygonVertices) break;
      }
      if (++p2, ++W.toiIters, m2) break;
      if (p2 === f2) {
        e2.state = tn.e_failed, e2.t = d2;
        break;
      }
    }
    W.toiMaxIters = $t(W.toiMaxIters, p2);
    var w2 = At.diff(n2);
    W.toiMaxTime = $t(W.toiMaxTime, w2), W.toiTime += w2, yn.recycle();
  }
}, vn;
(function(e2) {
  e2[e2.e_unset = -1] = `e_unset`, e2[e2.e_points = 1] = `e_points`, e2[e2.e_faceA = 2] = `e_faceA`, e2[e2.e_faceB = 3] = `e_faceB`;
})(vn ||= {});
var yn = new (function() {
  function e2() {
    this.m_proxyA = null, this.m_proxyB = null, this.m_sweepA = null, this.m_sweepB = null, this.m_type = vn.e_unset, this.m_localPoint = N(0, 0), this.m_axis = N(0, 0), this.indexA = -1, this.indexB = -1;
  }
  return e2.prototype.recycle = function() {
    this.m_proxyA = null, this.m_proxyB = null, this.m_sweepA = null, this.m_sweepB = null, this.m_type = vn.e_unset, F(this.m_localPoint), F(this.m_axis), this.indexA = -1, this.indexB = -1;
  }, e2.prototype.initialize = function(e3, t2, n2, r2, i2, a2) {
    var o2 = e3.count;
    if (this.m_proxyA = t2, this.m_proxyB = r2, this.m_sweepA = n2, this.m_sweepB = i2, this.m_sweepA.getTransform(sn, a2), this.m_sweepB.getTransform(cn, a2), o2 === 1) {
      this.m_type = vn.e_points;
      var s2 = this.m_proxyA.getVertex(e3.indexA[0]), c2 = this.m_proxyB.getVertex(e3.indexB[0]);
      V(un, sn, s2), V(dn, cn, c2), I(this.m_axis, dn, un);
      var l2 = Le(this.m_axis);
      return l2;
    }
    if (e3.indexA[0] === e3.indexA[1]) {
      this.m_type = vn.e_faceB;
      var u2 = r2.getVertex(e3.indexB[0]), d2 = r2.getVertex(e3.indexB[1]);
      ze(this.m_axis, I(ln, d2, u2), 1), Re(this.m_axis), Ge(fn, cn.q, this.m_axis), R(this.m_localPoint, 0.5, u2, 0.5, d2), V(dn, cn, this.m_localPoint);
      var f2 = t2.getVertex(e3.indexA[0]), l2 = B(ot.mulVec2(sn, f2), fn) - B(dn, fn);
      return l2 < 0 && (ke(this.m_axis), l2 = -l2), l2;
    }
    this.m_type = vn.e_faceA;
    var p2 = this.m_proxyA.getVertex(e3.indexA[0]), m2 = this.m_proxyA.getVertex(e3.indexA[1]);
    ze(this.m_axis, I(ln, m2, p2), 1), Re(this.m_axis), Ge(fn, sn.q, this.m_axis), R(this.m_localPoint, 0.5, p2, 0.5, m2), V(un, sn, this.m_localPoint), V(dn, cn, this.m_proxyB.getVertex(e3.indexB[0]));
    var l2 = B(dn, fn) - B(un, fn);
    return l2 < 0 && (ke(this.m_axis), l2 = -l2), l2;
  }, e2.prototype.compute = function(e3, t2) {
    switch (this.m_sweepA.getTransform(sn, t2), this.m_sweepB.getTransform(cn, t2), this.m_type) {
      case vn.e_points:
        e3 && (Ke(pn, sn.q, this.m_axis), Ke(mn, cn.q, L(ln, -1, this.m_axis)), this.indexA = this.m_proxyA.getSupport(pn), this.indexB = this.m_proxyB.getSupport(mn)), P(hn, this.m_proxyA.getVertex(this.indexA)), P(gn, this.m_proxyB.getVertex(this.indexB)), V(un, sn, hn), V(dn, cn, gn);
        var n2 = B(dn, this.m_axis) - B(un, this.m_axis);
        return n2;
      case vn.e_faceA:
        Ge(fn, sn.q, this.m_axis), V(un, sn, this.m_localPoint), e3 && (Ke(mn, cn.q, L(ln, -1, fn)), this.indexA = -1, this.indexB = this.m_proxyB.getSupport(mn)), P(gn, this.m_proxyB.getVertex(this.indexB)), V(dn, cn, gn);
        var n2 = B(dn, fn) - B(un, fn);
        return n2;
      case vn.e_faceB:
        Ge(fn, cn.q, this.m_axis), V(dn, cn, this.m_localPoint), e3 && (Ke(pn, sn.q, L(ln, -1, fn)), this.indexB = -1, this.indexA = this.m_proxyA.getSupport(pn)), P(hn, this.m_proxyA.getVertex(this.indexA)), V(un, sn, hn);
        var n2 = B(un, fn) - B(dn, fn);
        return n2;
      default:
        return e3 && (this.indexA = -1, this.indexB = -1), 0;
    }
  }, e2.prototype.findMinSeparation = function(e3) {
    return this.compute(true, e3);
  }, e2.prototype.evaluate = function(e3) {
    return this.compute(false, e3);
  }, e2;
}())();
_n.Input = en, _n.Output = nn;
var bn = Math.abs, xn = Math.sqrt, Sn = Math.min, Cn = function() {
  function e2() {
    this.dt = 0, this.inv_dt = 0, this.velocityIterations = 0, this.positionIterations = 0, this.warmStarting = false, this.blockSolve = true, this.inv_dt0 = 0, this.dtRatio = 1;
  }
  return e2.prototype.reset = function(e3) {
    this.dt > 0 && (this.inv_dt0 = this.inv_dt), this.dt = e3, this.inv_dt = e3 == 0 ? 0 : 1 / e3, this.dtRatio = e3 * this.inv_dt0;
  }, e2;
}(), wn = new Cn(), Tn = N(0, 0), En = N(0, 0), Dn = N(0, 0), On = new en(), kn = new nn(), An = new at(), jn = new at(), Mn = new at(), Nn = function() {
  function e2(e3) {
    this.contact = e3, this.normals = [], this.tangents = [];
  }
  return e2.prototype.recycle = function() {
    this.normals.length = 0, this.tangents.length = 0;
  }, Object.defineProperty(e2.prototype, "normalImpulses", { get: function() {
    var e3 = this.contact, t2 = this.normals;
    t2.length = 0;
    for (var n2 = 0; n2 < e3.v_points.length; ++n2) t2.push(e3.v_points[n2].normalImpulse);
    return t2;
  }, enumerable: false, configurable: true }), Object.defineProperty(e2.prototype, "tangentImpulses", { get: function() {
    var e3 = this.contact, t2 = this.tangents;
    t2.length = 0;
    for (var n2 = 0; n2 < e3.v_points.length; ++n2) t2.push(e3.v_points[n2].tangentImpulse);
    return t2;
  }, enumerable: false, configurable: true }), e2;
}(), Pn = function() {
  function e2(e3) {
    this.m_world = e3, this.m_stack = [], this.m_bodies = [], this.m_contacts = [], this.m_joints = [];
  }
  return e2.prototype.clear = function() {
    this.m_stack.length = 0, this.m_bodies.length = 0, this.m_contacts.length = 0, this.m_joints.length = 0;
  }, e2.prototype.addBody = function(e3) {
    this.m_bodies.push(e3);
  }, e2.prototype.addContact = function(e3) {
    this.m_contacts.push(e3);
  }, e2.prototype.addJoint = function(e3) {
    this.m_joints.push(e3);
  }, e2.prototype.solveWorld = function(e3) {
    for (var t2 = this.m_world, n2 = t2.m_bodyList; n2; n2 = n2.m_next) n2.m_islandFlag = false;
    for (var r2 = t2.m_contactList; r2; r2 = r2.m_next) r2.m_islandFlag = false;
    for (var i2 = t2.m_jointList; i2; i2 = i2.m_next) i2.m_islandFlag = false;
    for (var a2 = this.m_stack, o2 = t2.m_bodyList; o2; o2 = o2.m_next) if (!o2.m_islandFlag && o2.isAwake() != 0 && o2.isActive() != 0 && !o2.isStatic()) {
      for (this.clear(), a2.push(o2), o2.m_islandFlag = true; a2.length > 0; ) {
        var n2 = a2.pop();
        if (this.addBody(n2), n2.m_awakeFlag = true, !n2.isStatic()) {
          for (var s2 = n2.m_contactList; s2; s2 = s2.next) {
            var c2 = s2.contact;
            if (!c2.m_islandFlag && c2.isEnabled() != 0 && c2.isTouching() != 0) {
              var l2 = c2.m_fixtureA.m_isSensor, u2 = c2.m_fixtureB.m_isSensor;
              if (!(l2 || u2)) {
                this.addContact(c2), c2.m_islandFlag = true;
                var d2 = s2.other;
                d2.m_islandFlag ||= (a2.push(d2), true);
              }
            }
          }
          for (var f2 = n2.m_jointList; f2; f2 = f2.next) if (f2.joint.m_islandFlag != 1) {
            var d2 = f2.other;
            d2.isActive() != 0 && (this.addJoint(f2.joint), f2.joint.m_islandFlag = true, d2.m_islandFlag ||= (a2.push(d2), true));
          }
        }
      }
      this.solveIsland(e3);
      for (var p2 = 0; p2 < this.m_bodies.length; ++p2) {
        var n2 = this.m_bodies[p2];
        n2.isStatic() && (n2.m_islandFlag = false);
      }
    }
  }, e2.prototype.solveIsland = function(e3) {
    for (var t2 = this.m_world, n2 = t2.m_gravity, r2 = t2.m_allowSleep, i2 = e3.dt, a2 = 0; a2 < this.m_bodies.length; ++a2) {
      var o2 = this.m_bodies[a2];
      P(Tn, o2.m_sweep.c);
      var s2 = o2.m_sweep.a;
      P(En, o2.m_linearVelocity);
      var c2 = o2.m_angularVelocity;
      P(o2.m_sweep.c0, o2.m_sweep.c), o2.m_sweep.a0 = o2.m_sweep.a, o2.isDynamic() && (Pe(En, i2 * o2.m_gravityScale, n2), Pe(En, i2 * o2.m_invMass, o2.m_force), c2 += i2 * o2.m_invI * o2.m_torque, L(En, 1 / (1 + i2 * o2.m_linearDamping), En), c2 *= 1 / (1 + i2 * o2.m_angularDamping)), P(o2.c_position.c, Tn), o2.c_position.a = s2, P(o2.c_velocity.v, En), o2.c_velocity.w = c2;
    }
    for (var a2 = 0; a2 < this.m_contacts.length; ++a2) {
      var l2 = this.m_contacts[a2];
      l2.initConstraint(e3);
    }
    for (var a2 = 0; a2 < this.m_contacts.length; ++a2) {
      var l2 = this.m_contacts[a2];
      l2.initVelocityConstraint(e3);
    }
    if (e3.warmStarting) for (var a2 = 0; a2 < this.m_contacts.length; ++a2) {
      var l2 = this.m_contacts[a2];
      l2.warmStartConstraint(e3);
    }
    for (var a2 = 0; a2 < this.m_joints.length; ++a2) {
      var u2 = this.m_joints[a2];
      u2.initVelocityConstraints(e3);
    }
    for (var a2 = 0; a2 < e3.velocityIterations; ++a2) {
      for (var d2 = 0; d2 < this.m_joints.length; ++d2) {
        var u2 = this.m_joints[d2];
        u2.solveVelocityConstraints(e3);
      }
      for (var d2 = 0; d2 < this.m_contacts.length; ++d2) {
        var l2 = this.m_contacts[d2];
        l2.solveVelocityConstraint(e3);
      }
    }
    for (var a2 = 0; a2 < this.m_contacts.length; ++a2) {
      var l2 = this.m_contacts[a2];
      l2.storeConstraintImpulses(e3);
    }
    for (var a2 = 0; a2 < this.m_bodies.length; ++a2) {
      var o2 = this.m_bodies[a2];
      P(Tn, o2.c_position.c);
      var s2 = o2.c_position.a;
      P(En, o2.c_velocity.v);
      var c2 = o2.c_velocity.w;
      L(Dn, i2, En);
      var f2 = Ve(Dn);
      if (f2 > M.maxTranslationSquared) {
        var p2 = M.maxTranslation / xn(f2);
        Ne(En, p2);
      }
      var m2 = i2 * c2;
      if (m2 * m2 > M.maxRotationSquared) {
        var p2 = M.maxRotation / bn(m2);
        c2 *= p2;
      }
      Pe(Tn, i2, En), s2 += i2 * c2, P(o2.c_position.c, Tn), o2.c_position.a = s2, P(o2.c_velocity.v, En), o2.c_velocity.w = c2;
    }
    for (var h2 = false, a2 = 0; a2 < e3.positionIterations; ++a2) {
      for (var g2 = 0, d2 = 0; d2 < this.m_contacts.length; ++d2) {
        var l2 = this.m_contacts[d2], _2 = l2.solvePositionConstraint(e3);
        g2 = Sn(g2, _2);
      }
      for (var v2 = g2 >= -3 * M.linearSlop, y2 = true, d2 = 0; d2 < this.m_joints.length; ++d2) {
        var u2 = this.m_joints[d2], b2 = u2.solvePositionConstraints(e3);
        y2 &&= b2;
      }
      if (v2 && y2) {
        h2 = true;
        break;
      }
    }
    for (var a2 = 0; a2 < this.m_bodies.length; ++a2) {
      var o2 = this.m_bodies[a2];
      P(o2.m_sweep.c, o2.c_position.c), o2.m_sweep.a = o2.c_position.a, P(o2.m_linearVelocity, o2.c_velocity.v), o2.m_angularVelocity = o2.c_velocity.w, o2.synchronizeTransform();
    }
    if (this.postSolveIsland(), r2) {
      for (var x2 = 1 / 0, S2 = M.linearSleepToleranceSqr, C2 = M.angularSleepToleranceSqr, a2 = 0; a2 < this.m_bodies.length; ++a2) {
        var o2 = this.m_bodies[a2];
        o2.isStatic() || (o2.m_autoSleepFlag == 0 || o2.m_angularVelocity * o2.m_angularVelocity > C2 || Ve(o2.m_linearVelocity) > S2 ? (o2.m_sleepTime = 0, x2 = 0) : (o2.m_sleepTime += i2, x2 = Sn(x2, o2.m_sleepTime)));
      }
      if (x2 >= M.timeToSleep && h2) for (var a2 = 0; a2 < this.m_bodies.length; ++a2) {
        var o2 = this.m_bodies[a2];
        o2.setAwake(false);
      }
    }
  }, e2.prototype.solveWorldTOI = function(e3) {
    var t2 = this.m_world;
    if (t2.m_stepComplete) {
      for (var n2 = t2.m_bodyList; n2; n2 = n2.m_next) n2.m_islandFlag = false, n2.m_sweep.alpha0 = 0;
      for (var r2 = t2.m_contactList; r2; r2 = r2.m_next) r2.m_toiFlag = false, r2.m_islandFlag = false, r2.m_toiCount = 0, r2.m_toi = 1;
    }
    for (; ; ) {
      for (var i2 = null, a2 = 1, o2 = t2.m_contactList; o2; o2 = o2.m_next) if (o2.isEnabled() != 0 && !(o2.m_toiCount > M.maxSubSteps)) {
        var s2 = 1;
        if (o2.m_toiFlag) s2 = o2.m_toi;
        else {
          var c2 = o2.getFixtureA(), l2 = o2.getFixtureB();
          if (c2.isSensor() || l2.isSensor()) continue;
          var u2 = c2.getBody(), d2 = l2.getBody(), f2 = u2.isAwake() && !u2.isStatic(), p2 = d2.isAwake() && !d2.isStatic();
          if (f2 == 0 && p2 == 0) continue;
          var m2 = u2.isBullet() || !u2.isDynamic(), h2 = d2.isBullet() || !d2.isDynamic();
          if (m2 == 0 && h2 == 0) continue;
          var g2 = u2.m_sweep.alpha0;
          u2.m_sweep.alpha0 < d2.m_sweep.alpha0 ? (g2 = d2.m_sweep.alpha0, u2.m_sweep.advance(g2)) : d2.m_sweep.alpha0 < u2.m_sweep.alpha0 && (g2 = u2.m_sweep.alpha0, d2.m_sweep.advance(g2));
          var _2 = o2.getChildIndexA(), v2 = o2.getChildIndexB();
          On.proxyA.set(c2.getShape(), _2), On.proxyB.set(l2.getShape(), v2), On.sweepA.set(u2.m_sweep), On.sweepB.set(d2.m_sweep), On.tMax = 1, _n(kn, On);
          var y2 = kn.t;
          s2 = kn.state == tn.e_touching ? Sn(g2 + (1 - g2) * y2, 1) : 1, o2.m_toi = s2, o2.m_toiFlag = true;
        }
        s2 < a2 && (i2 = o2, a2 = s2);
      }
      if (i2 == null || 1 - 10 * O < a2) {
        t2.m_stepComplete = true;
        break;
      }
      var b2 = i2.getFixtureA(), x2 = i2.getFixtureB(), S2 = b2.getBody(), C2 = x2.getBody();
      if (jn.set(S2.m_sweep), Mn.set(C2.m_sweep), S2.advance(a2), C2.advance(a2), i2.update(t2), i2.m_toiFlag = false, ++i2.m_toiCount, i2.isEnabled() == 0 || i2.isTouching() == 0) i2.setEnabled(false), S2.m_sweep.set(jn), C2.m_sweep.set(Mn), S2.synchronizeTransform(), C2.synchronizeTransform();
      else {
        S2.setAwake(true), C2.setAwake(true), this.clear(), this.addBody(S2), this.addBody(C2), this.addContact(i2), S2.m_islandFlag = true, C2.m_islandFlag = true, i2.m_islandFlag = true;
        for (var w2 = [S2, C2], T2 = 0; T2 < w2.length; ++T2) {
          var E2 = w2[T2];
          if (E2.isDynamic()) for (var D2 = E2.m_contactList; D2; D2 = D2.next) {
            var ee2 = D2.contact;
            if (!ee2.m_islandFlag) {
              var te2 = D2.other;
              if (!te2.isDynamic() || E2.isBullet() || te2.isBullet()) {
                var ne2 = ee2.m_fixtureA.m_isSensor, re2 = ee2.m_fixtureB.m_isSensor;
                ne2 || re2 || (An.set(te2.m_sweep), te2.m_islandFlag == 0 && te2.advance(a2), ee2.update(t2), ee2.isEnabled() == 0 || ee2.isTouching() == 0 ? (te2.m_sweep.set(An), te2.synchronizeTransform()) : (ee2.m_islandFlag = true, this.addContact(ee2), te2.m_islandFlag || (te2.m_islandFlag = true, te2.isStatic() || te2.setAwake(true), this.addBody(te2))));
              }
            }
          }
        }
        wn.reset((1 - a2) * e3.dt), wn.dtRatio = 1, wn.positionIterations = 20, wn.velocityIterations = e3.velocityIterations, wn.warmStarting = false, this.solveIslandTOI(wn, S2, C2);
        for (var T2 = 0; T2 < this.m_bodies.length; ++T2) {
          var E2 = this.m_bodies[T2];
          if (E2.m_islandFlag = false, E2.isDynamic()) {
            E2.synchronizeFixtures();
            for (var D2 = E2.m_contactList; D2; D2 = D2.next) D2.contact.m_toiFlag = false, D2.contact.m_islandFlag = false;
          }
        }
        if (t2.findNewContacts(), t2.m_subStepping) {
          t2.m_stepComplete = false;
          break;
        }
      }
    }
  }, e2.prototype.solveIslandTOI = function(e3, t2, n2) {
    for (var r2 = 0; r2 < this.m_bodies.length; ++r2) {
      var i2 = this.m_bodies[r2];
      P(i2.c_position.c, i2.m_sweep.c), i2.c_position.a = i2.m_sweep.a, P(i2.c_velocity.v, i2.m_linearVelocity), i2.c_velocity.w = i2.m_angularVelocity;
    }
    for (var r2 = 0; r2 < this.m_contacts.length; ++r2) {
      var a2 = this.m_contacts[r2];
      a2.initConstraint(e3);
    }
    for (var r2 = 0; r2 < e3.positionIterations; ++r2) {
      for (var o2 = 0, s2 = 0; s2 < this.m_contacts.length; ++s2) {
        var a2 = this.m_contacts[s2], c2 = a2.solvePositionConstraintTOI(e3, t2, n2);
        o2 = Sn(o2, c2);
      }
      if (o2 >= -1.5 * M.linearSlop) break;
    }
    var r2;
    P(t2.m_sweep.c0, t2.c_position.c), t2.m_sweep.a0 = t2.c_position.a, P(n2.m_sweep.c0, n2.c_position.c), n2.m_sweep.a0 = n2.c_position.a;
    for (var r2 = 0; r2 < this.m_contacts.length; ++r2) {
      var a2 = this.m_contacts[r2];
      a2.initVelocityConstraint(e3);
    }
    for (var r2 = 0; r2 < e3.velocityIterations; ++r2) for (var s2 = 0; s2 < this.m_contacts.length; ++s2) {
      var a2 = this.m_contacts[s2];
      a2.solveVelocityConstraint(e3);
    }
    for (var l2 = e3.dt, r2 = 0; r2 < this.m_bodies.length; ++r2) {
      var i2 = this.m_bodies[r2];
      P(Tn, i2.c_position.c);
      var u2 = i2.c_position.a;
      P(En, i2.c_velocity.v);
      var d2 = i2.c_velocity.w;
      L(Dn, l2, En);
      var f2 = Ve(Dn);
      if (f2 > M.maxTranslationSquared) {
        var p2 = M.maxTranslation / xn(f2);
        Ne(En, p2);
      }
      var m2 = l2 * d2;
      if (m2 * m2 > M.maxRotationSquared) {
        var p2 = M.maxRotation / bn(m2);
        d2 *= p2;
      }
      Pe(Tn, l2, En), u2 += l2 * d2, P(i2.c_position.c, Tn), i2.c_position.a = u2, P(i2.c_velocity.v, En), i2.c_velocity.w = d2, P(i2.m_sweep.c, Tn), i2.m_sweep.a = u2, P(i2.m_linearVelocity, En), i2.m_angularVelocity = d2, i2.synchronizeTransform();
    }
    this.postSolveIsland();
  }, e2.prototype.postSolveIsland = function() {
    for (var e3 = 0; e3 < this.m_contacts.length; ++e3) {
      var t2 = this.m_contacts[e3];
      this.m_world.postSolve(t2, t2.m_impulse);
    }
  }, e2;
}();
Pn.TimeStep = Cn;
var Fn = function() {
  function e2(e3, t2, n2, r2) {
    typeof e3 == `object` && e3 ? (this.ex = Vec2.clone(e3), this.ey = Vec2.clone(t2)) : typeof e3 == `number` ? (this.ex = Vec2.neo(e3, n2), this.ey = Vec2.neo(t2, r2)) : (this.ex = Vec2.zero(), this.ey = Vec2.zero());
  }
  return e2.prototype.toString = function() {
    return JSON.stringify(this);
  }, e2.isValid = function(e3) {
    return e3 != null && Vec2.isValid(e3.ex) && Vec2.isValid(e3.ey);
  }, e2.assert = function(e3) {
  }, e2.prototype.set = function(e3, t2, n2, r2) {
    typeof e3 == `number` && typeof t2 == `number` && typeof n2 == `number` && typeof r2 == `number` ? (this.ex.setNum(e3, n2), this.ey.setNum(t2, r2)) : typeof e3 == `object` && typeof t2 == `object` ? (this.ex.setVec2(e3), this.ey.setVec2(t2)) : typeof e3 == `object` && (this.ex.setVec2(e3.ex), this.ey.setVec2(e3.ey));
  }, e2.prototype.setIdentity = function() {
    this.ex.x = 1, this.ey.x = 0, this.ex.y = 0, this.ey.y = 1;
  }, e2.prototype.setZero = function() {
    this.ex.x = 0, this.ey.x = 0, this.ex.y = 0, this.ey.y = 0;
  }, e2.prototype.getInverse = function() {
    var t2 = this.ex.x, n2 = this.ey.x, r2 = this.ex.y, i2 = this.ey.y, a2 = t2 * i2 - n2 * r2;
    a2 !== 0 && (a2 = 1 / a2);
    var o2 = new e2();
    return o2.ex.x = a2 * i2, o2.ey.x = -a2 * n2, o2.ex.y = -a2 * r2, o2.ey.y = a2 * t2, o2;
  }, e2.prototype.solve = function(e3) {
    var t2 = this.ex.x, n2 = this.ey.x, r2 = this.ex.y, i2 = this.ey.y, a2 = t2 * i2 - n2 * r2;
    a2 !== 0 && (a2 = 1 / a2);
    var o2 = Vec2.zero();
    return o2.x = a2 * (i2 * e3.x - n2 * e3.y), o2.y = a2 * (t2 * e3.y - r2 * e3.x), o2;
  }, e2.mul = function(t2, n2) {
    if (n2 && `x` in n2 && `y` in n2) {
      var r2 = t2.ex.x * n2.x + t2.ey.x * n2.y, i2 = t2.ex.y * n2.x + t2.ey.y * n2.y;
      return Vec2.neo(r2, i2);
    }
    if (n2 && `ex` in n2 && `ey` in n2) return new e2(t2.ex.x * n2.ex.x + t2.ey.x * n2.ex.y, t2.ex.x * n2.ey.x + t2.ey.x * n2.ey.y, t2.ex.y * n2.ex.x + t2.ey.y * n2.ex.y, t2.ex.y * n2.ey.x + t2.ey.y * n2.ey.y);
  }, e2.mulVec2 = function(e3, t2) {
    var n2 = e3.ex.x * t2.x + e3.ey.x * t2.y, r2 = e3.ex.y * t2.x + e3.ey.y * t2.y;
    return Vec2.neo(n2, r2);
  }, e2.mulMat22 = function(t2, n2) {
    return new e2(t2.ex.x * n2.ex.x + t2.ey.x * n2.ex.y, t2.ex.x * n2.ey.x + t2.ey.x * n2.ey.y, t2.ex.y * n2.ex.x + t2.ey.y * n2.ex.y, t2.ex.y * n2.ey.x + t2.ey.y * n2.ey.y);
  }, e2.mulT = function(t2, n2) {
    if (n2 && `x` in n2 && `y` in n2) return Vec2.neo(Vec2.dot(n2, t2.ex), Vec2.dot(n2, t2.ey));
    if (n2 && `ex` in n2 && `ey` in n2) return new e2(Vec2.neo(Vec2.dot(t2.ex, n2.ex), Vec2.dot(t2.ey, n2.ex)), Vec2.neo(Vec2.dot(t2.ex, n2.ey), Vec2.dot(t2.ey, n2.ey)));
  }, e2.mulTVec2 = function(e3, t2) {
    return Vec2.neo(Vec2.dot(t2, e3.ex), Vec2.dot(t2, e3.ey));
  }, e2.mulTMat22 = function(t2, n2) {
    return new e2(Vec2.neo(Vec2.dot(t2.ex, n2.ex), Vec2.dot(t2.ey, n2.ex)), Vec2.neo(Vec2.dot(t2.ex, n2.ey), Vec2.dot(t2.ey, n2.ey)));
  }, e2.abs = function(t2) {
    return new e2(Vec2.abs(t2.ex), Vec2.abs(t2.ey));
  }, e2.add = function(t2, n2) {
    return new e2(Vec2.add(t2.ex, n2.ex), Vec2.add(t2.ey, n2.ey));
  }, e2;
}(), In = Math.sqrt, Ln = N(0, 0), Rn = N(0, 0), zn = N(0, 0), Bn = N(0, 0), Vn = N(0, 0), Hn = N(0, 0), Un = N(0, 0), Wn = N(0, 0), G;
(function(e2) {
  e2[e2.e_unset = -1] = `e_unset`, e2[e2.e_circles = 0] = `e_circles`, e2[e2.e_faceA = 1] = `e_faceA`, e2[e2.e_faceB = 2] = `e_faceB`;
})(G ||= {});
var K;
(function(e2) {
  e2[e2.e_unset = -1] = `e_unset`, e2[e2.e_vertex = 0] = `e_vertex`, e2[e2.e_face = 1] = `e_face`;
})(K ||= {});
var Gn;
(function(e2) {
  e2[e2.nullState = 0] = `nullState`, e2[e2.addState = 1] = `addState`, e2[e2.persistState = 2] = `persistState`, e2[e2.removeState = 3] = `removeState`;
})(Gn ||= {});
var Kn = function() {
  function e2() {
    this.v = N(0, 0), this.id = new Yn();
  }
  return e2.prototype.set = function(e3) {
    P(this.v, e3.v), this.id.set(e3.id);
  }, e2.prototype.recycle = function() {
    F(this.v), this.id.recycle();
  }, e2;
}(), qn = function() {
  function e2() {
    this.localNormal = N(0, 0), this.localPoint = N(0, 0), this.points = [new Jn(), new Jn()], this.pointCount = 0;
  }
  return e2.prototype.set = function(e3) {
    this.type = e3.type, P(this.localNormal, e3.localNormal), P(this.localPoint, e3.localPoint), this.pointCount = e3.pointCount, this.points[0].set(e3.points[0]), this.points[1].set(e3.points[1]);
  }, e2.prototype.recycle = function() {
    this.type = G.e_unset, F(this.localNormal), F(this.localPoint), this.pointCount = 0, this.points[0].recycle(), this.points[1].recycle();
  }, e2.prototype.getWorldManifold = function(e3, t2, n2, r2, i2) {
    if (this.pointCount == 0) return e3;
    e3 ||= new Xn(), e3.pointCount = this.pointCount;
    var a2 = e3.normal, o2 = e3.points, s2 = e3.separations;
    switch (this.type) {
      case G.e_circles:
        Oe(a2, 1, 0);
        var c2 = this.points[0];
        V(Ln, t2, this.localPoint), V(Rn, r2, c2.localPoint), I(Hn, Rn, Ln);
        var l2 = Ve(Hn);
        l2 > O * O && L(a2, 1 / In(l2), Hn), R(Bn, 1, Ln, n2, a2), R(Vn, 1, Rn, -i2, a2), R(o2[0], 0.5, Bn, 0.5, Vn), s2[0] = B(I(zn, Vn, Bn), a2);
        break;
      case G.e_faceA:
        Ge(a2, t2.q, this.localNormal), V(Un, t2, this.localPoint);
        for (var u2 = 0; u2 < this.pointCount; ++u2) {
          var c2 = this.points[u2];
          V(Wn, r2, c2.localPoint), R(Bn, 1, Wn, n2 - B(I(zn, Wn, Un), a2), a2), R(Vn, 1, Wn, -i2, a2), R(o2[u2], 0.5, Bn, 0.5, Vn), s2[u2] = B(I(zn, Vn, Bn), a2);
        }
        break;
      case G.e_faceB:
        Ge(a2, r2.q, this.localNormal), V(Un, r2, this.localPoint);
        for (var u2 = 0; u2 < this.pointCount; ++u2) {
          var c2 = this.points[u2];
          V(Wn, t2, c2.localPoint), R(Vn, 1, Wn, i2 - B(I(zn, Wn, Un), a2), a2), R(Bn, 1, Wn, -n2, a2), R(o2[u2], 0.5, Bn, 0.5, Vn), s2[u2] = B(I(zn, Bn, Vn), a2);
        }
        ke(a2);
    }
    return e3;
  }, e2.clipSegmentToLine = Qn, e2.ClipVertex = Kn, e2.getPointStates = Zn, e2.PointState = Gn, e2;
}(), Jn = function() {
  function e2() {
    this.localPoint = N(0, 0), this.normalImpulse = 0, this.tangentImpulse = 0, this.id = new Yn();
  }
  return e2.prototype.set = function(e3) {
    P(this.localPoint, e3.localPoint), this.normalImpulse = e3.normalImpulse, this.tangentImpulse = e3.tangentImpulse, this.id.set(e3.id);
  }, e2.prototype.recycle = function() {
    F(this.localPoint), this.normalImpulse = 0, this.tangentImpulse = 0, this.id.recycle();
  }, e2;
}(), Yn = function() {
  function e2() {
    this.key = -1, this.indexA = -1, this.indexB = -1, this.typeA = K.e_unset, this.typeB = K.e_unset;
  }
  return e2.prototype.setFeatures = function(e3, t2, n2, r2) {
    this.indexA = e3, this.indexB = n2, this.typeA = t2, this.typeB = r2, this.key = this.indexA + this.indexB * 256 + this.typeA * 65536 + this.typeB * 16777216;
  }, e2.prototype.set = function(e3) {
    this.indexA = e3.indexA, this.indexB = e3.indexB, this.typeA = e3.typeA, this.typeB = e3.typeB, this.key = this.indexA + this.indexB * 256 + this.typeA * 65536 + this.typeB * 16777216;
  }, e2.prototype.swapFeatures = function() {
    var e3 = this.indexA, t2 = this.indexB, n2 = this.typeA, r2 = this.typeB;
    this.indexA = t2, this.indexB = e3, this.typeA = r2, this.typeB = n2, this.key = this.indexA + this.indexB * 256 + this.typeA * 65536 + this.typeB * 16777216;
  }, e2.prototype.recycle = function() {
    this.indexA = 0, this.indexB = 0, this.typeA = K.e_unset, this.typeB = K.e_unset, this.key = -1;
  }, e2;
}(), Xn = function() {
  function e2() {
    this.normal = N(0, 0), this.points = [N(0, 0), N(0, 0)], this.separations = [0, 0], this.pointCount = 0;
  }
  return e2.prototype.recycle = function() {
    F(this.normal), F(this.points[0]), F(this.points[1]), this.separations[0] = 0, this.separations[1] = 0, this.pointCount = 0;
  }, e2;
}();
function Zn(e2, t2, n2, r2) {
  for (var i2 = 0; i2 < n2.pointCount; ++i2) {
    var a2 = n2.points[i2].id;
    e2[i2] = Gn.removeState;
    for (var o2 = 0; o2 < r2.pointCount; ++o2) if (r2.points[o2].id.key === a2.key) {
      e2[i2] = Gn.persistState;
      break;
    }
  }
  for (var i2 = 0; i2 < r2.pointCount; ++i2) {
    var a2 = r2.points[i2].id;
    t2[i2] = Gn.addState;
    for (var o2 = 0; o2 < n2.pointCount; ++o2) if (n2.points[o2].id.key === a2.key) {
      t2[i2] = Gn.persistState;
      break;
    }
  }
}
function Qn(e2, t2, n2, r2, i2) {
  var a2 = 0, o2 = B(n2, t2[0].v) - r2, s2 = B(n2, t2[1].v) - r2;
  if (o2 <= 0 && e2[a2++].set(t2[0]), s2 <= 0 && e2[a2++].set(t2[1]), o2 * s2 < 0) {
    var c2 = o2 / (o2 - s2);
    R(e2[a2].v, 1 - c2, t2[0].v, c2, t2[1].v), e2[a2].id.setFeatures(i2, K.e_vertex, t2[0].id.indexB, K.e_face), ++a2;
  }
  return a2;
}
var $n = Math.sqrt, er = Math.max, tr = Math.min, nr = new me({ create: function() {
  return new Fr();
}, release: function(e2) {
  e2.recycle();
} }), rr = new qn(), ir = new Xn(), ar = function() {
  function e2(e3) {
    this.prev = null, this.next = null, this.other = null, this.contact = e3;
  }
  return e2.prototype.recycle = function() {
    this.prev = null, this.next = null, this.other = null;
  }, e2;
}();
function or(e2, t2) {
  return $n(e2 * t2);
}
function sr(e2, t2) {
  return e2 > t2 ? e2 : t2;
}
var cr = [], lr = function() {
  function e2() {
    this.rA = N(0, 0), this.rB = N(0, 0), this.normalImpulse = 0, this.tangentImpulse = 0, this.normalMass = 0, this.tangentMass = 0, this.velocityBias = 0;
  }
  return e2.prototype.recycle = function() {
    F(this.rA), F(this.rB), this.normalImpulse = 0, this.tangentImpulse = 0, this.normalMass = 0, this.tangentMass = 0, this.velocityBias = 0;
  }, e2;
}(), ur = N(0, 0), dr = N(0, 0), fr = N(0, 0), pr = N(0, 0), mr = N(0, 0), hr = Je(0, 0, 0), gr = Je(0, 0, 0), _r = N(0, 0), vr = N(0, 0), yr = N(0, 0), br = N(0, 0), xr = N(0, 0), Sr = N(0, 0), Cr = N(0, 0), q = N(0, 0), wr = N(0, 0), Tr = N(0, 0), Er = N(0, 0), Dr = N(0, 0), Or = N(0, 0), kr = N(0, 0), Ar = N(0, 0), jr = N(0, 0), Mr = N(0, 0), Nr = N(0, 0), Pr = N(0, 0), Fr = function() {
  function e2() {
    this.m_nodeA = new ar(this), this.m_nodeB = new ar(this), this.m_fixtureA = null, this.m_fixtureB = null, this.m_indexA = -1, this.m_indexB = -1, this.m_evaluateFcn = null, this.m_manifold = new qn(), this.m_prev = null, this.m_next = null, this.m_toi = 1, this.m_toiCount = 0, this.m_toiFlag = false, this.m_friction = 0, this.m_restitution = 0, this.m_tangentSpeed = 0, this.m_enabledFlag = true, this.m_islandFlag = false, this.m_touchingFlag = false, this.m_filterFlag = false, this.m_bulletHitFlag = false, this.m_impulse = new Nn(this), this.v_points = [new lr(), new lr()], this.v_normal = N(0, 0), this.v_normalMass = new Fn(), this.v_K = new Fn(), this.v_pointCount = 0, this.v_tangentSpeed = 0, this.v_friction = 0, this.v_restitution = 0, this.v_invMassA = 0, this.v_invMassB = 0, this.v_invIA = 0, this.v_invIB = 0, this.p_localPoints = [N(0, 0), N(0, 0)], this.p_localNormal = N(0, 0), this.p_localPoint = N(0, 0), this.p_localCenterA = N(0, 0), this.p_localCenterB = N(0, 0), this.p_type = G.e_unset, this.p_radiusA = 0, this.p_radiusB = 0, this.p_pointCount = 0, this.p_invMassA = 0, this.p_invMassB = 0, this.p_invIA = 0, this.p_invIB = 0;
  }
  return e2.prototype.initialize = function(e3, t2, n2, r2, i2) {
    this.m_fixtureA = e3, this.m_fixtureB = n2, this.m_indexA = t2, this.m_indexB = r2, this.m_evaluateFcn = i2, this.m_friction = or(this.m_fixtureA.m_friction, this.m_fixtureB.m_friction), this.m_restitution = sr(this.m_fixtureA.m_restitution, this.m_fixtureB.m_restitution);
  }, e2.prototype.recycle = function() {
    this.m_nodeA.recycle(), this.m_nodeB.recycle(), this.m_fixtureA = null, this.m_fixtureB = null, this.m_indexA = -1, this.m_indexB = -1, this.m_evaluateFcn = null, this.m_manifold.recycle(), this.m_prev = null, this.m_next = null, this.m_toi = 1, this.m_toiCount = 0, this.m_toiFlag = false, this.m_friction = 0, this.m_restitution = 0, this.m_tangentSpeed = 0, this.m_enabledFlag = true, this.m_islandFlag = false, this.m_touchingFlag = false, this.m_filterFlag = false, this.m_bulletHitFlag = false, this.m_impulse.recycle();
    for (var e3 = 0, t2 = this.v_points; e3 < t2.length; e3++) t2[e3].recycle();
    F(this.v_normal), this.v_normalMass.setZero(), this.v_K.setZero(), this.v_pointCount = 0, this.v_tangentSpeed = 0, this.v_friction = 0, this.v_restitution = 0, this.v_invMassA = 0, this.v_invMassB = 0, this.v_invIA = 0, this.v_invIB = 0;
    for (var n2 = 0, r2 = this.p_localPoints; n2 < r2.length; n2++) {
      var i2 = r2[n2];
      F(i2);
    }
    F(this.p_localNormal), F(this.p_localPoint), F(this.p_localCenterA), F(this.p_localCenterB), this.p_type = G.e_unset, this.p_radiusA = 0, this.p_radiusB = 0, this.p_pointCount = 0, this.p_invMassA = 0, this.p_invMassB = 0, this.p_invIA = 0, this.p_invIB = 0;
  }, e2.prototype.initConstraint = function(e3) {
    var t2 = this.m_fixtureA, n2 = this.m_fixtureB;
    if (t2 !== null && n2 !== null) {
      var r2 = t2.m_body, i2 = n2.m_body;
      if (r2 !== null && i2 !== null) {
        var a2 = t2.m_shape, o2 = n2.m_shape;
        if (a2 !== null && o2 !== null) {
          var s2 = this.m_manifold, c2 = s2.pointCount;
          this.v_invMassA = r2.m_invMass, this.v_invMassB = i2.m_invMass, this.v_invIA = r2.m_invI, this.v_invIB = i2.m_invI, this.v_friction = this.m_friction, this.v_restitution = this.m_restitution, this.v_tangentSpeed = this.m_tangentSpeed, this.v_pointCount = c2, this.v_K.setZero(), this.v_normalMass.setZero(), this.p_invMassA = r2.m_invMass, this.p_invMassB = i2.m_invMass, this.p_invIA = r2.m_invI, this.p_invIB = i2.m_invI, P(this.p_localCenterA, r2.m_sweep.localCenter), P(this.p_localCenterB, i2.m_sweep.localCenter), this.p_radiusA = a2.m_radius, this.p_radiusB = o2.m_radius, this.p_type = s2.type, P(this.p_localNormal, s2.localNormal), P(this.p_localPoint, s2.localPoint), this.p_pointCount = c2;
          for (var l2 = 0; l2 < M.maxManifoldPoints; ++l2) this.v_points[l2].recycle(), F(this.p_localPoints[l2]);
          for (var l2 = 0; l2 < c2; ++l2) {
            var u2 = s2.points[l2], d2 = this.v_points[l2];
            e3.warmStarting && (d2.normalImpulse = e3.dtRatio * u2.normalImpulse, d2.tangentImpulse = e3.dtRatio * u2.tangentImpulse), P(this.p_localPoints[l2], u2.localPoint);
          }
        }
      }
    }
  }, e2.prototype.getManifold = function() {
    return this.m_manifold;
  }, e2.prototype.getWorldManifold = function(e3) {
    var t2 = this.m_fixtureA, n2 = this.m_fixtureB;
    if (t2 !== null && n2 !== null) {
      var r2 = t2.m_body, i2 = n2.m_body;
      if (r2 !== null && i2 !== null) {
        var a2 = t2.m_shape, o2 = n2.m_shape;
        if (a2 !== null && o2 !== null) return this.m_manifold.getWorldManifold(e3, r2.getTransform(), a2.m_radius, i2.getTransform(), o2.m_radius);
      }
    }
  }, e2.prototype.setEnabled = function(e3) {
    this.m_enabledFlag = !!e3;
  }, e2.prototype.isEnabled = function() {
    return this.m_enabledFlag;
  }, e2.prototype.isTouching = function() {
    return this.m_touchingFlag;
  }, e2.prototype.getNext = function() {
    return this.m_next;
  }, e2.prototype.getFixtureA = function() {
    return this.m_fixtureA;
  }, e2.prototype.getFixtureB = function() {
    return this.m_fixtureB;
  }, e2.prototype.getChildIndexA = function() {
    return this.m_indexA;
  }, e2.prototype.getChildIndexB = function() {
    return this.m_indexB;
  }, e2.prototype.flagForFiltering = function() {
    this.m_filterFlag = true;
  }, e2.prototype.setFriction = function(e3) {
    this.m_friction = e3;
  }, e2.prototype.getFriction = function() {
    return this.m_friction;
  }, e2.prototype.resetFriction = function() {
    var e3 = this.m_fixtureA, t2 = this.m_fixtureB;
    e3 !== null && t2 !== null && (this.m_friction = or(e3.m_friction, t2.m_friction));
  }, e2.prototype.setRestitution = function(e3) {
    this.m_restitution = e3;
  }, e2.prototype.getRestitution = function() {
    return this.m_restitution;
  }, e2.prototype.resetRestitution = function() {
    var e3 = this.m_fixtureA, t2 = this.m_fixtureB;
    e3 !== null && t2 !== null && (this.m_restitution = sr(e3.m_restitution, t2.m_restitution));
  }, e2.prototype.setTangentSpeed = function(e3) {
    this.m_tangentSpeed = e3;
  }, e2.prototype.getTangentSpeed = function() {
    return this.m_tangentSpeed;
  }, e2.prototype.evaluate = function(e3, t2, n2) {
    var r2 = this.m_fixtureA, i2 = this.m_fixtureB;
    r2 !== null && i2 !== null && this.m_evaluateFcn(e3, t2, r2, this.m_indexA, n2, i2, this.m_indexB);
  }, e2.prototype.update = function(e3) {
    var t2 = this.m_fixtureA, n2 = this.m_fixtureB;
    if (t2 !== null && n2 !== null) {
      var r2 = t2.m_body, i2 = n2.m_body;
      if (r2 !== null && i2 !== null) {
        var a2 = t2.m_shape, o2 = n2.m_shape;
        if (a2 !== null && o2 !== null) {
          this.m_enabledFlag = true;
          var s2 = false, c2 = this.m_touchingFlag, l2 = t2.m_isSensor, u2 = n2.m_isSensor, d2 = l2 || u2, f2 = r2.m_xf, p2 = i2.m_xf;
          if (d2) s2 = Zt(a2, this.m_indexA, o2, this.m_indexB, f2, p2), this.m_manifold.pointCount = 0;
          else {
            rr.recycle(), rr.set(this.m_manifold), this.m_manifold.recycle(), this.evaluate(this.m_manifold, f2, p2), s2 = this.m_manifold.pointCount > 0;
            for (var m2 = 0; m2 < this.m_manifold.pointCount; ++m2) {
              var h2 = this.m_manifold.points[m2];
              h2.normalImpulse = 0, h2.tangentImpulse = 0;
              for (var g2 = 0; g2 < rr.pointCount; ++g2) {
                var _2 = rr.points[g2];
                if (_2.id.key === h2.id.key) {
                  h2.normalImpulse = _2.normalImpulse, h2.tangentImpulse = _2.tangentImpulse;
                  break;
                }
              }
            }
            s2 !== c2 && (r2.setAwake(true), i2.setAwake(true));
          }
          this.m_touchingFlag = s2;
          var v2 = typeof e3 == `object` && !!e3;
          !c2 && s2 && v2 && e3.beginContact(this), c2 && !s2 && v2 && e3.endContact(this), !d2 && s2 && v2 && rr && e3.preSolve(this, rr);
        }
      }
    }
  }, e2.prototype.solvePositionConstraint = function(e3) {
    return this._solvePositionConstraint(e3, null, null);
  }, e2.prototype.solvePositionConstraintTOI = function(e3, t2, n2) {
    return this._solvePositionConstraint(e3, t2, n2);
  }, e2.prototype._solvePositionConstraint = function(e3, t2, n2) {
    var r2 = t2 !== null && n2 !== null, i2 = 0, a2 = this.m_fixtureA, o2 = this.m_fixtureB;
    if (a2 === null || o2 === null) return i2;
    var s2 = a2.m_body, c2 = o2.m_body;
    if (s2 === null || c2 === null) return i2;
    var l2 = s2.c_position, u2 = c2.c_position, d2 = this.p_localCenterA, f2 = this.p_localCenterB, p2 = 0, m2 = 0;
    r2 && s2 !== t2 && s2 !== n2 || (p2 = this.p_invMassA, m2 = this.p_invIA);
    var h2 = 0, g2 = 0;
    r2 && c2 !== t2 && c2 !== n2 || (h2 = this.p_invMassB, g2 = this.p_invIB), P(ur, l2.c);
    var _2 = l2.a;
    P(fr, u2.c);
    for (var v2 = u2.a, y2 = 0; y2 < this.p_pointCount; ++y2) {
      dt(hr, d2, ur, _2), dt(gr, f2, fr, v2);
      var b2 = void 0;
      switch (this.p_type) {
        case G.e_circles:
          V(_r, hr, this.p_localPoint), V(vr, gr, this.p_localPoints[0]), I(q, vr, _r), Re(q), R(wr, 0.5, _r, 0.5, vr), b2 = B(vr, q) - B(_r, q) - this.p_radiusA - this.p_radiusB;
          break;
        case G.e_faceA:
          Ge(q, hr.q, this.p_localNormal), V(br, hr, this.p_localPoint), V(yr, gr, this.p_localPoints[y2]), b2 = B(yr, q) - B(br, q) - this.p_radiusA - this.p_radiusB, P(wr, yr);
          break;
        case G.e_faceB:
          Ge(q, gr.q, this.p_localNormal), V(br, gr, this.p_localPoint), V(yr, hr, this.p_localPoints[y2]), b2 = B(yr, q) - B(br, q) - this.p_radiusA - this.p_radiusB, P(wr, yr), ke(q);
          break;
        default:
          return i2;
      }
      I(xr, wr, ur), I(Sr, wr, fr), i2 = tr(i2, b2);
      var x2 = r2 ? M.toiBaugarte : M.baumgarte, S2 = M.linearSlop, C2 = M.maxLinearCorrection, w2 = k(x2 * (b2 + S2), -C2, 0), T2 = z(xr, q), E2 = z(Sr, q), D2 = p2 + h2 + m2 * T2 * T2 + g2 * E2 * E2;
      L(Cr, D2 > 0 ? -w2 / D2 : 0, q), Fe(ur, p2, Cr), _2 -= m2 * z(xr, Cr), Pe(fr, h2, Cr), v2 += g2 * z(Sr, Cr);
    }
    return P(l2.c, ur), l2.a = _2, P(u2.c, fr), u2.a = v2, i2;
  }, e2.prototype.initVelocityConstraint = function(e3) {
    var t2 = this.m_fixtureA, n2 = this.m_fixtureB;
    if (t2 !== null && n2 !== null) {
      var r2 = t2.m_body, i2 = n2.m_body;
      if (r2 !== null && i2 !== null) {
        var a2 = r2.c_velocity, o2 = i2.c_velocity, s2 = r2.c_position, c2 = i2.c_position, l2 = this.p_radiusA, u2 = this.p_radiusB, d2 = this.m_manifold, f2 = this.v_invMassA, p2 = this.v_invMassB, m2 = this.v_invIA, h2 = this.v_invIB, g2 = this.p_localCenterA, _2 = this.p_localCenterB;
        P(ur, s2.c);
        var v2 = s2.a;
        P(dr, a2.v);
        var y2 = a2.w;
        P(fr, c2.c);
        var b2 = c2.a;
        P(pr, o2.v);
        var x2 = o2.w;
        dt(hr, g2, ur, v2), dt(gr, _2, fr, b2), ir.recycle(), d2.getWorldManifold(ir, hr, l2, gr, u2), P(this.v_normal, ir.normal);
        for (var S2 = 0; S2 < this.v_pointCount; ++S2) {
          var C2 = this.v_points[S2], w2 = ir.points[S2];
          I(C2.rA, w2, ur), I(C2.rB, w2, fr);
          var T2 = z(C2.rA, this.v_normal), E2 = z(C2.rB, this.v_normal), D2 = f2 + p2 + m2 * T2 * T2 + h2 * E2 * E2;
          C2.normalMass = D2 > 0 ? 1 / D2 : 0, ze(mr, this.v_normal, 1);
          var O2 = z(C2.rA, mr), ee2 = z(C2.rB, mr), te2 = f2 + p2 + m2 * O2 * O2 + h2 * ee2 * ee2;
          C2.tangentMass = te2 > 0 ? 1 / te2 : 0, C2.velocityBias = 0;
          var ne2 = 0;
          ne2 += B(this.v_normal, pr), ne2 += B(this.v_normal, Be(Pr, x2, C2.rB)), ne2 -= B(this.v_normal, dr), ne2 -= B(this.v_normal, Be(Pr, y2, C2.rA)), ne2 < -M.velocityThreshold && (C2.velocityBias = -this.v_restitution * ne2);
        }
        if (this.v_pointCount == 2 && e3.blockSolve) {
          var re2 = this.v_points[0], k2 = this.v_points[1], ie2 = z(re2.rA, this.v_normal), ae2 = z(re2.rB, this.v_normal), oe2 = z(k2.rA, this.v_normal), se2 = z(k2.rB, this.v_normal), ce2 = f2 + p2 + m2 * ie2 * ie2 + h2 * ae2 * ae2, le2 = f2 + p2 + m2 * oe2 * oe2 + h2 * se2 * se2, A2 = f2 + p2 + m2 * ie2 * oe2 + h2 * ae2 * se2;
          if (ce2 * ce2 < 1e3 * (ce2 * le2 - A2 * A2)) {
            this.v_K.ex.setNum(ce2, A2), this.v_K.ey.setNum(A2, le2);
            var ue2 = this.v_K.ex.x, de2 = this.v_K.ey.x, fe2 = this.v_K.ex.y, pe2 = this.v_K.ey.y, j2 = ue2 * pe2 - de2 * fe2;
            j2 !== 0 && (j2 = 1 / j2), this.v_normalMass.ex.x = j2 * pe2, this.v_normalMass.ey.x = -j2 * de2, this.v_normalMass.ex.y = -j2 * fe2, this.v_normalMass.ey.y = j2 * ue2;
          } else this.v_pointCount = 1;
        }
        P(s2.c, ur), s2.a = v2, P(a2.v, dr), a2.w = y2, P(c2.c, fr), c2.a = b2, P(o2.v, pr), o2.w = x2;
      }
    }
  }, e2.prototype.warmStartConstraint = function(e3) {
    var t2 = this.m_fixtureA, n2 = this.m_fixtureB;
    if (t2 !== null && n2 !== null) {
      var r2 = t2.m_body, i2 = n2.m_body;
      if (r2 !== null && i2 !== null) {
        var a2 = r2.c_velocity, o2 = i2.c_velocity, s2 = this.v_invMassA, c2 = this.v_invIA, l2 = this.v_invMassB, u2 = this.v_invIB;
        P(dr, a2.v);
        var d2 = a2.w;
        P(pr, o2.v);
        var f2 = o2.w;
        P(q, this.v_normal), ze(mr, q, 1);
        for (var p2 = 0; p2 < this.v_pointCount; ++p2) {
          var m2 = this.v_points[p2];
          R(Cr, m2.normalImpulse, q, m2.tangentImpulse, mr), d2 -= c2 * z(m2.rA, Cr), Fe(dr, s2, Cr), f2 += u2 * z(m2.rB, Cr), Pe(pr, l2, Cr);
        }
        P(a2.v, dr), a2.w = d2, P(o2.v, pr), o2.w = f2;
      }
    }
  }, e2.prototype.storeConstraintImpulses = function(e3) {
    for (var t2 = this.m_manifold, n2 = 0; n2 < this.v_pointCount; ++n2) t2.points[n2].normalImpulse = this.v_points[n2].normalImpulse, t2.points[n2].tangentImpulse = this.v_points[n2].tangentImpulse;
  }, e2.prototype.solveVelocityConstraint = function(e3) {
    var t2 = this.m_fixtureA, n2 = this.m_fixtureB;
    if (t2 !== null && n2 !== null) {
      var r2 = t2.m_body, i2 = n2.m_body;
      if (r2 !== null && i2 !== null) {
        var a2 = r2.c_velocity, o2 = i2.c_velocity, s2 = this.v_invMassA, c2 = this.v_invIA, l2 = this.v_invMassB, u2 = this.v_invIB;
        P(dr, a2.v);
        var d2 = a2.w;
        P(pr, o2.v);
        var f2 = o2.w;
        P(q, this.v_normal), ze(mr, q, 1);
        for (var p2 = this.v_friction, m2 = 0; m2 < this.v_pointCount; ++m2) {
          var h2 = this.v_points[m2];
          F(Tr), Ae(Tr, pr), Ae(Tr, Be(Pr, f2, h2.rB)), Me(Tr, dr), Me(Tr, Be(Pr, d2, h2.rA));
          var g2 = B(Tr, mr) - this.v_tangentSpeed, _2 = h2.tangentMass * -g2, v2 = p2 * h2.normalImpulse, y2 = k(h2.tangentImpulse + _2, -v2, v2);
          _2 = y2 - h2.tangentImpulse, h2.tangentImpulse = y2, L(Cr, _2, mr), Fe(dr, s2, Cr), d2 -= c2 * z(h2.rA, Cr), Pe(pr, l2, Cr), f2 += u2 * z(h2.rB, Cr);
        }
        if (this.v_pointCount == 1 || e3.blockSolve == 0) for (var b2 = 0; b2 < this.v_pointCount; ++b2) {
          var h2 = this.v_points[b2];
          F(Tr), Ae(Tr, pr), Ae(Tr, Be(Pr, f2, h2.rB)), Me(Tr, dr), Me(Tr, Be(Pr, d2, h2.rA));
          var x2 = B(Tr, q), _2 = -h2.normalMass * (x2 - h2.velocityBias), y2 = er(h2.normalImpulse + _2, 0);
          _2 = y2 - h2.normalImpulse, h2.normalImpulse = y2, L(Cr, _2, q), Fe(dr, s2, Cr), d2 -= c2 * z(h2.rA, Cr), Pe(pr, l2, Cr), f2 += u2 * z(h2.rB, Cr);
        }
        else {
          var S2 = this.v_points[0], C2 = this.v_points[1];
          Oe(kr, S2.normalImpulse, C2.normalImpulse), F(Er), Ae(Er, pr), Ae(Er, Be(Pr, f2, S2.rB)), Me(Er, dr), Me(Er, Be(Pr, d2, S2.rA)), F(Dr), Ae(Dr, pr), Ae(Dr, Be(Pr, f2, C2.rB)), Me(Dr, dr), Me(Dr, Be(Pr, d2, C2.rA));
          var w2 = B(Er, q), T2 = B(Dr, q);
          for (Oe(Or, w2 - S2.velocityBias, T2 - C2.velocityBias), Or.x -= this.v_K.ex.x * kr.x + this.v_K.ey.x * kr.y, Or.y -= this.v_K.ex.y * kr.x + this.v_K.ey.y * kr.y; ; ) {
            if (F(Ar), Ar.x = -(this.v_normalMass.ex.x * Or.x + this.v_normalMass.ey.x * Or.y), Ar.y = -(this.v_normalMass.ex.y * Or.x + this.v_normalMass.ey.y * Or.y), Ar.x >= 0 && Ar.y >= 0 || (Ar.x = -S2.normalMass * Or.x, Ar.y = 0, w2 = 0, T2 = this.v_K.ex.y * Ar.x + Or.y, Ar.x >= 0 && T2 >= 0) || (Ar.x = 0, Ar.y = -C2.normalMass * Or.y, w2 = this.v_K.ey.x * Ar.y + Or.x, T2 = 0, Ar.y >= 0 && w2 >= 0) || (Ar.x = 0, Ar.y = 0, w2 = Or.x, T2 = Or.y, w2 >= 0 && T2 >= 0)) {
              I(jr, Ar, kr), L(Mr, jr.x, q), L(Nr, jr.y, q), Ie(dr, -s2, Mr, -s2, Nr, 1, dr), d2 -= c2 * (z(S2.rA, Mr) + z(C2.rA, Nr)), Ie(pr, l2, Mr, l2, Nr, 1, pr), f2 += u2 * (z(S2.rB, Mr) + z(C2.rB, Nr)), S2.normalImpulse = Ar.x, C2.normalImpulse = Ar.y;
              break;
            }
            break;
          }
        }
        P(a2.v, dr), a2.w = d2, P(o2.v, pr), o2.w = f2;
      }
    }
  }, e2.addType = function(e3, t2, n2) {
    cr[e3] = cr[e3] || {}, cr[e3][t2] = n2;
  }, e2.create = function(e3, t2, n2, r2) {
    var i2 = e3.m_shape.m_type, a2 = n2.m_shape.m_type, o2 = nr.allocate(), s2;
    if (s2 = cr[i2] && cr[i2][a2]) o2.initialize(e3, t2, n2, r2, s2);
    else if (s2 = cr[a2] && cr[a2][i2]) o2.initialize(n2, r2, e3, t2, s2);
    else return null;
    e3 = o2.m_fixtureA, n2 = o2.m_fixtureB, t2 = o2.getChildIndexA(), r2 = o2.getChildIndexB();
    var c2 = e3.m_body, l2 = n2.m_body;
    return o2.m_nodeA.contact = o2, o2.m_nodeA.other = l2, o2.m_nodeA.prev = null, o2.m_nodeA.next = c2.m_contactList, c2.m_contactList != null && (c2.m_contactList.prev = o2.m_nodeA), c2.m_contactList = o2.m_nodeA, o2.m_nodeB.contact = o2, o2.m_nodeB.other = c2, o2.m_nodeB.prev = null, o2.m_nodeB.next = l2.m_contactList, l2.m_contactList != null && (l2.m_contactList.prev = o2.m_nodeB), l2.m_contactList = o2.m_nodeB, e3.isSensor() == 0 && n2.isSensor() == 0 && (c2.setAwake(true), l2.setAwake(true)), o2;
  }, e2.destroy = function(e3, t2) {
    var n2 = e3.m_fixtureA, r2 = e3.m_fixtureB;
    if (n2 !== null && r2 !== null) {
      var i2 = n2.m_body, a2 = r2.m_body;
      i2 !== null && a2 !== null && (e3.isTouching() && t2.endContact(e3), e3.m_nodeA.prev && (e3.m_nodeA.prev.next = e3.m_nodeA.next), e3.m_nodeA.next && (e3.m_nodeA.next.prev = e3.m_nodeA.prev), e3.m_nodeA == i2.m_contactList && (i2.m_contactList = e3.m_nodeA.next), e3.m_nodeB.prev && (e3.m_nodeB.prev.next = e3.m_nodeB.next), e3.m_nodeB.next && (e3.m_nodeB.next.prev = e3.m_nodeB.prev), e3.m_nodeB == a2.m_contactList && (a2.m_contactList = e3.m_nodeB.next), e3.m_manifold.pointCount > 0 && !n2.m_isSensor && !r2.m_isSensor && (i2.setAwake(true), a2.setAwake(true)), nr.release(e3));
    }
  }, e2;
}(), Ir = { gravity: Vec2.zero(), allowSleep: true, warmStarting: true, continuousPhysics: true, subStepping: false, blockSolve: true, velocityIterations: 8, positionIterations: 3 }, World = function() {
  function e2(t2) {
    if (!(this instanceof e2)) return new e2(t2);
    this.s_step = new Cn(), t2 ? Vec2.isValid(t2) && (t2 = { gravity: t2 }) : t2 = {}, t2 = E(t2, Ir), this.m_solver = new Pn(this), this.m_broadPhase = new Ce(), this.m_contactList = null, this.m_contactCount = 0, this.m_bodyList = null, this.m_bodyCount = 0, this.m_jointList = null, this.m_jointCount = 0, this.m_stepComplete = true, this.m_allowSleep = t2.allowSleep, this.m_gravity = Vec2.clone(t2.gravity), this.m_clearForces = true, this.m_newFixture = false, this.m_locked = false, this.m_warmStarting = t2.warmStarting, this.m_continuousPhysics = t2.continuousPhysics, this.m_subStepping = t2.subStepping, this.m_blockSolve = t2.blockSolve, this.m_velocityIterations = t2.velocityIterations, this.m_positionIterations = t2.positionIterations, this.m_t = 0, this.m_step_callback = [];
  }
  return e2.prototype._serialize = function() {
    for (var e3 = [], t2 = [], n2 = this.getBodyList(); n2; n2 = n2.getNext()) e3.push(n2);
    for (var r2 = this.getJointList(); r2; r2 = r2.getNext()) typeof r2._serialize == `function` && t2.push(r2);
    return { gravity: this.m_gravity, bodies: e3, joints: t2 };
  }, e2._deserialize = function(t2, n2, r2) {
    if (!t2) return new e2();
    var i2 = new e2(t2.gravity);
    if (t2.bodies) for (var a2 = t2.bodies.length - 1; a2 >= 0; --a2) i2._addBody(r2(U, t2.bodies[a2], i2));
    if (t2.joints) for (var a2 = t2.joints.length - 1; a2 >= 0; a2--) i2.createJoint(r2(kt, t2.joints[a2], i2));
    return i2;
  }, e2.prototype.getBodyList = function() {
    return this.m_bodyList;
  }, e2.prototype.getJointList = function() {
    return this.m_jointList;
  }, e2.prototype.getContactList = function() {
    return this.m_contactList;
  }, e2.prototype.getBodyCount = function() {
    return this.m_bodyCount;
  }, e2.prototype.getJointCount = function() {
    return this.m_jointCount;
  }, e2.prototype.getContactCount = function() {
    return this.m_contactCount;
  }, e2.prototype.setGravity = function(e3) {
    this.m_gravity.set(e3);
  }, e2.prototype.getGravity = function() {
    return this.m_gravity;
  }, e2.prototype.isLocked = function() {
    return this.m_locked;
  }, e2.prototype.setAllowSleeping = function(e3) {
    if (e3 != this.m_allowSleep && (this.m_allowSleep = e3, this.m_allowSleep == 0)) for (var t2 = this.m_bodyList; t2; t2 = t2.m_next) t2.setAwake(true);
  }, e2.prototype.getAllowSleeping = function() {
    return this.m_allowSleep;
  }, e2.prototype.setWarmStarting = function(e3) {
    this.m_warmStarting = e3;
  }, e2.prototype.getWarmStarting = function() {
    return this.m_warmStarting;
  }, e2.prototype.setContinuousPhysics = function(e3) {
    this.m_continuousPhysics = e3;
  }, e2.prototype.getContinuousPhysics = function() {
    return this.m_continuousPhysics;
  }, e2.prototype.setSubStepping = function(e3) {
    this.m_subStepping = e3;
  }, e2.prototype.getSubStepping = function() {
    return this.m_subStepping;
  }, e2.prototype.setAutoClearForces = function(e3) {
    this.m_clearForces = e3;
  }, e2.prototype.getAutoClearForces = function() {
    return this.m_clearForces;
  }, e2.prototype.clearForces = function() {
    for (var e3 = this.m_bodyList; e3; e3 = e3.getNext()) e3.m_force.setZero(), e3.m_torque = 0;
  }, e2.prototype.queryAABB = function(e3, t2) {
    var n2 = this.m_broadPhase;
    this.m_broadPhase.query(e3, function(e4) {
      return t2(n2.getUserData(e4).fixture);
    });
  }, e2.prototype.rayCast = function(e3, t2, n2) {
    var r2 = this.m_broadPhase;
    this.m_broadPhase.rayCast({ maxFraction: 1, p1: e3, p2: t2 }, function(e4, t3) {
      var i2 = r2.getUserData(t3), a2 = i2.fixture, o2 = i2.childIndex, s2 = {};
      if (a2.rayCast(s2, e4, o2)) {
        var c2 = s2.fraction;
        return n2(a2, Vec2.add(Vec2.mulNumVec2(1 - c2, e4.p1), Vec2.mulNumVec2(c2, e4.p2)), s2.normal, c2);
      }
      return e4.maxFraction;
    });
  }, e2.prototype.getProxyCount = function() {
    return this.m_broadPhase.getProxyCount();
  }, e2.prototype.getTreeHeight = function() {
    return this.m_broadPhase.getTreeHeight();
  }, e2.prototype.getTreeBalance = function() {
    return this.m_broadPhase.getTreeBalance();
  }, e2.prototype.getTreeQuality = function() {
    return this.m_broadPhase.getTreeQuality();
  }, e2.prototype.shiftOrigin = function(e3) {
    if (!this.isLocked()) {
      for (var t2 = this.m_bodyList; t2; t2 = t2.m_next) t2.m_xf.p.sub(e3), t2.m_sweep.c0.sub(e3), t2.m_sweep.c.sub(e3);
      for (var n2 = this.m_jointList; n2; n2 = n2.m_next) n2.shiftOrigin(e3);
      this.m_broadPhase.shiftOrigin(e3);
    }
  }, e2.prototype._addBody = function(e3) {
    this.isLocked() || (e3.m_prev = null, e3.m_next = this.m_bodyList, this.m_bodyList && (this.m_bodyList.m_prev = e3), this.m_bodyList = e3, ++this.m_bodyCount, this.publish(`add-body`, e3));
  }, e2.prototype.createBody = function(e3, t2) {
    if (this.isLocked()) return null;
    var n2 = {};
    e3 && (Vec2.isValid(e3) ? n2 = { position: e3, angle: t2 } : typeof e3 == `object` && (n2 = e3));
    var r2 = new U(this, n2);
    return this._addBody(r2), r2;
  }, e2.prototype.createDynamicBody = function(e3, t2) {
    var n2 = {};
    return e3 && (Vec2.isValid(e3) ? n2 = { position: e3, angle: t2 } : typeof e3 == `object` && (n2 = e3)), n2.type = `dynamic`, this.createBody(n2);
  }, e2.prototype.createKinematicBody = function(e3, t2) {
    var n2 = {};
    return e3 && (Vec2.isValid(e3) ? n2 = { position: e3, angle: t2 } : typeof e3 == `object` && (n2 = e3)), n2.type = `kinematic`, this.createBody(n2);
  }, e2.prototype.destroyBody = function(e3) {
    if (!this.isLocked()) {
      if (e3.m_destroyed) return false;
      for (var t2 = e3.m_jointList; t2; ) {
        var n2 = t2;
        t2 = t2.next, this.publish(`remove-joint`, n2.joint), this.destroyJoint(n2.joint), e3.m_jointList = t2;
      }
      e3.m_jointList = null;
      for (var r2 = e3.m_contactList; r2; ) {
        var i2 = r2;
        r2 = r2.next, this.destroyContact(i2.contact), e3.m_contactList = r2;
      }
      e3.m_contactList = null;
      for (var a2 = e3.m_fixtureList; a2; ) {
        var o2 = a2;
        a2 = a2.m_next, this.publish(`remove-fixture`, o2), o2.destroyProxies(this.m_broadPhase), e3.m_fixtureList = a2;
      }
      return e3.m_fixtureList = null, e3.m_prev && (e3.m_prev.m_next = e3.m_next), e3.m_next && (e3.m_next.m_prev = e3.m_prev), e3 == this.m_bodyList && (this.m_bodyList = e3.m_next), e3.m_destroyed = true, --this.m_bodyCount, this.publish(`remove-body`, e3), true;
    }
  }, e2.prototype.createJoint = function(e3) {
    if (this.isLocked()) return null;
    if (e3.m_prev = null, e3.m_next = this.m_jointList, this.m_jointList && (this.m_jointList.m_prev = e3), this.m_jointList = e3, ++this.m_jointCount, e3.m_edgeA.joint = e3, e3.m_edgeA.other = e3.m_bodyB, e3.m_edgeA.prev = null, e3.m_edgeA.next = e3.m_bodyA.m_jointList, e3.m_bodyA.m_jointList && (e3.m_bodyA.m_jointList.prev = e3.m_edgeA), e3.m_bodyA.m_jointList = e3.m_edgeA, e3.m_edgeB.joint = e3, e3.m_edgeB.other = e3.m_bodyA, e3.m_edgeB.prev = null, e3.m_edgeB.next = e3.m_bodyB.m_jointList, e3.m_bodyB.m_jointList && (e3.m_bodyB.m_jointList.prev = e3.m_edgeB), e3.m_bodyB.m_jointList = e3.m_edgeB, e3.m_collideConnected == 0) for (var t2 = e3.m_bodyB.getContactList(); t2; t2 = t2.next) t2.other == e3.m_bodyA && t2.contact.flagForFiltering();
    return this.publish(`add-joint`, e3), e3;
  }, e2.prototype.destroyJoint = function(e3) {
    if (!this.isLocked()) {
      e3.m_prev && (e3.m_prev.m_next = e3.m_next), e3.m_next && (e3.m_next.m_prev = e3.m_prev), e3 == this.m_jointList && (this.m_jointList = e3.m_next);
      var t2 = e3.m_bodyA, n2 = e3.m_bodyB;
      if (t2.setAwake(true), n2.setAwake(true), e3.m_edgeA.prev && (e3.m_edgeA.prev.next = e3.m_edgeA.next), e3.m_edgeA.next && (e3.m_edgeA.next.prev = e3.m_edgeA.prev), e3.m_edgeA == t2.m_jointList && (t2.m_jointList = e3.m_edgeA.next), e3.m_edgeA.prev = null, e3.m_edgeA.next = null, e3.m_edgeB.prev && (e3.m_edgeB.prev.next = e3.m_edgeB.next), e3.m_edgeB.next && (e3.m_edgeB.next.prev = e3.m_edgeB.prev), e3.m_edgeB == n2.m_jointList && (n2.m_jointList = e3.m_edgeB.next), e3.m_edgeB.prev = null, e3.m_edgeB.next = null, --this.m_jointCount, e3.m_collideConnected == 0) for (var r2 = n2.getContactList(); r2; ) r2.other == t2 && r2.contact.flagForFiltering(), r2 = r2.next;
      this.publish(`remove-joint`, e3);
    }
  }, e2.prototype.step = function(e3, t2, n2) {
    if (this.publish(`pre-step`, e3), (t2 | 0) !== t2 && (t2 = 0), t2 ||= this.m_velocityIterations, n2 ||= this.m_positionIterations, this.m_newFixture &&= (this.findNewContacts(), false), this.m_locked = true, this.s_step.reset(e3), this.s_step.velocityIterations = t2, this.s_step.positionIterations = n2, this.s_step.warmStarting = this.m_warmStarting, this.s_step.blockSolve = this.m_blockSolve, this.updateContacts(), this.m_stepComplete && e3 > 0) {
      this.m_solver.solveWorld(this.s_step);
      for (var r2 = this.m_bodyList; r2; r2 = r2.getNext()) r2.m_islandFlag != 0 && (r2.isStatic() || r2.synchronizeFixtures());
      this.findNewContacts();
    }
    this.m_continuousPhysics && e3 > 0 && this.m_solver.solveWorldTOI(this.s_step), this.m_clearForces && this.clearForces(), this.m_locked = false;
    for (var i2; i2 = this.m_step_callback.shift(); ) i2(this);
    this.publish(`post-step`, e3);
  }, e2.prototype.queueUpdate = function(e3) {
    this.isLocked() ? this.m_step_callback.push(e3) : e3(this);
  }, e2.prototype.findNewContacts = function() {
    var e3 = this;
    this.m_broadPhase.updatePairs(function(t2, n2) {
      return e3.createContact(t2, n2);
    });
  }, e2.prototype.createContact = function(e3, t2) {
    var n2 = e3.fixture, r2 = t2.fixture, i2 = e3.childIndex, a2 = t2.childIndex, o2 = n2.getBody(), s2 = r2.getBody();
    if (o2 != s2) {
      for (var c2 = s2.getContactList(); c2; ) {
        if (c2.other == o2) {
          var l2 = c2.contact.getFixtureA(), u2 = c2.contact.getFixtureB(), d2 = c2.contact.getChildIndexA(), f2 = c2.contact.getChildIndexB();
          if (l2 == n2 && u2 == r2 && d2 == i2 && f2 == a2 || l2 == r2 && u2 == n2 && d2 == a2 && f2 == i2) return;
        }
        c2 = c2.next;
      }
      if (s2.shouldCollide(o2) != 0 && r2.shouldCollide(n2) != 0) {
        var p2 = Fr.create(n2, i2, r2, a2);
        p2 != null && (p2.m_prev = null, this.m_contactList != null && (p2.m_next = this.m_contactList, this.m_contactList.m_prev = p2), this.m_contactList = p2, ++this.m_contactCount);
      }
    }
  }, e2.prototype.updateContacts = function() {
    for (var e3, t2 = this.m_contactList; e3 = t2; ) {
      t2 = e3.getNext();
      var n2 = e3.getFixtureA(), r2 = e3.getFixtureB(), i2 = e3.getChildIndexA(), a2 = e3.getChildIndexB(), o2 = n2.getBody(), s2 = r2.getBody();
      if (e3.m_filterFlag) {
        if (s2.shouldCollide(o2) == 0 || r2.shouldCollide(n2) == 0) {
          this.destroyContact(e3);
          continue;
        }
        e3.m_filterFlag = false;
      }
      var c2 = o2.isAwake() && !o2.isStatic(), l2 = s2.isAwake() && !s2.isStatic();
      if (c2 != 0 || l2 != 0) {
        var u2 = n2.m_proxies[i2].proxyId, d2 = r2.m_proxies[a2].proxyId;
        this.m_broadPhase.testOverlap(u2, d2) == 0 ? this.destroyContact(e3) : e3.update(this);
      }
    }
  }, e2.prototype.destroyContact = function(e3) {
    e3.m_prev && (e3.m_prev.m_next = e3.m_next), e3.m_next && (e3.m_next.m_prev = e3.m_prev), e3 == this.m_contactList && (this.m_contactList = e3.m_next), Fr.destroy(e3, this), --this.m_contactCount;
  }, e2.prototype.on = function(e3, t2) {
    return typeof e3 != `string` || typeof t2 != `function` || (this._listeners ||= {}, this._listeners[e3] || (this._listeners[e3] = []), this._listeners[e3].push(t2)), this;
  }, e2.prototype.off = function(e3, t2) {
    if (typeof e3 != `string` || typeof t2 != `function`) return this;
    var n2 = this._listeners && this._listeners[e3];
    if (!n2 || !n2.length) return this;
    var r2 = n2.indexOf(t2);
    return r2 >= 0 && n2.splice(r2, 1), this;
  }, e2.prototype.publish = function(e3, t2, n2, r2) {
    var i2 = this._listeners && this._listeners[e3];
    if (!i2 || !i2.length) return 0;
    for (var a2 = 0; a2 < i2.length; a2++) i2[a2].call(this, t2, n2, r2);
    return i2.length;
  }, e2.prototype.beginContact = function(e3) {
    this.publish(`begin-contact`, e3);
  }, e2.prototype.endContact = function(e3) {
    this.publish(`end-contact`, e3);
  }, e2.prototype.preSolve = function(e3, t2) {
    this.publish(`pre-solve`, e3, t2);
  }, e2.prototype.postSolve = function(e3, t2) {
    this.publish(`post-solve`, e3, t2);
  }, e2;
}(), J = function() {
  function e2(t2, n2, r2) {
    if (!(this instanceof e2)) return new e2(t2, n2, r2);
    t2 === void 0 ? (this.x = 0, this.y = 0, this.z = 0) : typeof t2 == `object` ? (this.x = t2.x, this.y = t2.y, this.z = t2.z) : (this.x = t2, this.y = n2, this.z = r2);
  }
  return e2.prototype._serialize = function() {
    return { x: this.x, y: this.y, z: this.z };
  }, e2._deserialize = function(t2) {
    var n2 = Object.create(e2.prototype);
    return n2.x = t2.x, n2.y = t2.y, n2.z = t2.z, n2;
  }, e2.neo = function(t2, n2, r2) {
    var i2 = Object.create(e2.prototype);
    return i2.x = t2, i2.y = n2, i2.z = r2, i2;
  }, e2.zero = function() {
    var t2 = Object.create(e2.prototype);
    return t2.x = 0, t2.y = 0, t2.z = 0, t2;
  }, e2.clone = function(t2) {
    return e2.neo(t2.x, t2.y, t2.z);
  }, e2.prototype.toString = function() {
    return JSON.stringify(this);
  }, e2.isValid = function(e3) {
    return e3 != null && Number.isFinite(e3.x) && Number.isFinite(e3.y) && Number.isFinite(e3.z);
  }, e2.assert = function(e3) {
  }, e2.prototype.setZero = function() {
    return this.x = 0, this.y = 0, this.z = 0, this;
  }, e2.prototype.set = function(e3, t2, n2) {
    return this.x = e3, this.y = t2, this.z = n2, this;
  }, e2.prototype.add = function(e3) {
    return this.x += e3.x, this.y += e3.y, this.z += e3.z, this;
  }, e2.prototype.sub = function(e3) {
    return this.x -= e3.x, this.y -= e3.y, this.z -= e3.z, this;
  }, e2.prototype.mul = function(e3) {
    return this.x *= e3, this.y *= e3, this.z *= e3, this;
  }, e2.areEqual = function(e3, t2) {
    return e3 === t2 || typeof e3 == `object` && !!e3 && typeof t2 == `object` && !!t2 && e3.x === t2.x && e3.y === t2.y && e3.z === t2.z;
  }, e2.dot = function(e3, t2) {
    return e3.x * t2.x + e3.y * t2.y + e3.z * t2.z;
  }, e2.cross = function(t2, n2) {
    return new e2(t2.y * n2.z - t2.z * n2.y, t2.z * n2.x - t2.x * n2.z, t2.x * n2.y - t2.y * n2.x);
  }, e2.add = function(t2, n2) {
    return new e2(t2.x + n2.x, t2.y + n2.y, t2.z + n2.z);
  }, e2.sub = function(t2, n2) {
    return new e2(t2.x - n2.x, t2.y - n2.y, t2.z - n2.z);
  }, e2.mul = function(t2, n2) {
    return new e2(n2 * t2.x, n2 * t2.y, n2 * t2.z);
  }, e2.prototype.neg = function() {
    return this.x = -this.x, this.y = -this.y, this.z = -this.z, this;
  }, e2.neg = function(t2) {
    return new e2(-t2.x, -t2.y, -t2.z);
  }, e2;
}(), Rr = N(0, 0), zr = N(0, 0), Br = function(e2) {
  w(t2, e2);
  function t2(n2, r2) {
    var i2 = this;
    return i2 instanceof t2 ? (i2 = e2.call(this) || this, i2.m_type = t2.TYPE, i2.m_radius = M.polygonRadius, i2.m_vertex1 = n2 ? Vec2.clone(n2) : Vec2.zero(), i2.m_vertex2 = r2 ? Vec2.clone(r2) : Vec2.zero(), i2.m_vertex0 = Vec2.zero(), i2.m_vertex3 = Vec2.zero(), i2.m_hasVertex0 = false, i2.m_hasVertex3 = false, i2) : new t2(n2, r2);
  }
  return t2.prototype._serialize = function() {
    return { type: this.m_type, vertex1: this.m_vertex1, vertex2: this.m_vertex2, vertex0: this.m_vertex0, vertex3: this.m_vertex3 };
  }, t2._deserialize = function(e3) {
    var n2 = new t2(e3.vertex1, e3.vertex2);
    return n2.m_hasVertex0 && n2.setPrevVertex(e3.vertex0), n2.m_hasVertex3 && n2.setNextVertex(e3.vertex3), n2;
  }, t2.prototype._reset = function() {
  }, t2.prototype.getRadius = function() {
    return this.m_radius;
  }, t2.prototype.getType = function() {
    return this.m_type;
  }, t2.prototype.setNext = function(e3) {
    return this.setNextVertex(e3);
  }, t2.prototype.setNextVertex = function(e3) {
    return e3 ? (this.m_vertex3.setVec2(e3), this.m_hasVertex3 = true) : (this.m_vertex3.setZero(), this.m_hasVertex3 = false), this;
  }, t2.prototype.getNextVertex = function() {
    return this.m_vertex3;
  }, t2.prototype.setPrev = function(e3) {
    return this.setPrevVertex(e3);
  }, t2.prototype.setPrevVertex = function(e3) {
    return e3 ? (this.m_vertex0.setVec2(e3), this.m_hasVertex0 = true) : (this.m_vertex0.setZero(), this.m_hasVertex0 = false), this;
  }, t2.prototype.getPrevVertex = function() {
    return this.m_vertex0;
  }, t2.prototype._set = function(e3, t3) {
    return this.m_vertex1.setVec2(e3), this.m_vertex2.setVec2(t3), this.m_hasVertex0 = false, this.m_hasVertex3 = false, this;
  }, t2.prototype._clone = function() {
    var e3 = new t2();
    return e3.m_type = this.m_type, e3.m_radius = this.m_radius, e3.m_vertex1.setVec2(this.m_vertex1), e3.m_vertex2.setVec2(this.m_vertex2), e3.m_vertex0.setVec2(this.m_vertex0), e3.m_vertex3.setVec2(this.m_vertex3), e3.m_hasVertex0 = this.m_hasVertex0, e3.m_hasVertex3 = this.m_hasVertex3, e3;
  }, t2.prototype.getChildCount = function() {
    return 1;
  }, t2.prototype.testPoint = function(e3, t3) {
    return false;
  }, t2.prototype.rayCast = function(e3, t3, n2, r2) {
    var i2 = H.mulTVec2(n2.q, Vec2.sub(t3.p1, n2.p)), a2 = H.mulTVec2(n2.q, Vec2.sub(t3.p2, n2.p)), o2 = Vec2.sub(a2, i2), s2 = this.m_vertex1, c2 = this.m_vertex2, l2 = Vec2.sub(c2, s2), u2 = Vec2.neo(l2.y, -l2.x);
    u2.normalize();
    var d2 = Vec2.dot(u2, Vec2.sub(s2, i2)), f2 = Vec2.dot(u2, o2);
    if (f2 == 0) return false;
    var p2 = d2 / f2;
    if (p2 < 0 || t3.maxFraction < p2) return false;
    var m2 = Vec2.add(i2, Vec2.mulNumVec2(p2, o2)), h2 = Vec2.sub(c2, s2), g2 = Vec2.dot(h2, h2);
    if (g2 == 0) return false;
    var _2 = Vec2.dot(Vec2.sub(m2, s2), h2) / g2;
    return _2 < 0 || 1 < _2 ? false : (e3.fraction = p2, e3.normal = d2 > 0 ? H.mulVec2(n2.q, u2).neg() : H.mulVec2(n2.q, u2), true);
  }, t2.prototype.computeAABB = function(e3, t3, n2) {
    V(Rr, t3, this.m_vertex1), V(zr, t3, this.m_vertex2), fe.combinePoints(e3, Rr, zr), fe.extend(e3, this.m_radius);
  }, t2.prototype.computeMass = function(e3, t3) {
    e3.mass = 0, R(e3.center, 0.5, this.m_vertex1, 0.5, this.m_vertex2), e3.I = 0;
  }, t2.prototype.computeDistanceProxy = function(e3) {
    e3.m_vertices[0] = this.m_vertex1, e3.m_vertices[1] = this.m_vertex2, e3.m_vertices.length = 2, e3.m_count = 2, e3.m_radius = this.m_radius;
  }, t2.TYPE = `edge`, t2;
}(ft), Vr = N(0, 0), Hr = N(0, 0), Ur = function(e2) {
  w(t2, e2);
  function t2(n2, r2) {
    var i2 = this;
    return i2 instanceof t2 ? (i2 = e2.call(this) || this, i2.m_type = t2.TYPE, i2.m_radius = M.polygonRadius, i2.m_vertices = [], i2.m_count = 0, i2.m_prevVertex = null, i2.m_nextVertex = null, i2.m_hasPrevVertex = false, i2.m_hasNextVertex = false, i2.m_isLoop = !!r2, n2 && n2.length && (r2 ? i2._createLoop(n2) : i2._createChain(n2)), i2) : new t2(n2, r2);
  }
  return t2.prototype._serialize = function() {
    var e3 = { type: this.m_type, vertices: this.m_isLoop ? this.m_vertices.slice(0, this.m_vertices.length - 1) : this.m_vertices, isLoop: this.m_isLoop, hasPrevVertex: this.m_hasPrevVertex, hasNextVertex: this.m_hasNextVertex, prevVertex: null, nextVertex: null };
    return this.m_prevVertex && (e3.prevVertex = this.m_prevVertex), this.m_nextVertex && (e3.nextVertex = this.m_nextVertex), e3;
  }, t2._deserialize = function(e3, n2, r2) {
    var i2 = [];
    if (e3.vertices) for (var a2 = 0; a2 < e3.vertices.length; a2++) i2.push(e3.vertices[a2]);
    var o2 = new t2(i2, e3.isLoop);
    return e3.prevVertex && o2.setPrevVertex(e3.prevVertex), e3.nextVertex && o2.setNextVertex(e3.nextVertex), o2;
  }, t2.prototype.getType = function() {
    return this.m_type;
  }, t2.prototype.getRadius = function() {
    return this.m_radius;
  }, t2.prototype._createLoop = function(e3) {
    if (!(e3.length < 3)) {
      var t3;
      this.m_vertices = [], this.m_count = e3.length + 1;
      for (var t3 = 0; t3 < e3.length; ++t3) this.m_vertices[t3] = Vec2.clone(e3[t3]);
      return this.m_vertices[e3.length] = Vec2.clone(e3[0]), this.m_prevVertex = this.m_vertices[this.m_count - 2], this.m_nextVertex = this.m_vertices[1], this.m_hasPrevVertex = true, this.m_hasNextVertex = true, this;
    }
  }, t2.prototype._createChain = function(e3) {
    var t3;
    this.m_vertices = [], this.m_count = e3.length;
    for (var t3 = 0; t3 < e3.length; ++t3) this.m_vertices[t3] = Vec2.clone(e3[t3]);
    return this.m_prevVertex = null, this.m_nextVertex = null, this.m_hasPrevVertex = false, this.m_hasNextVertex = false, this;
  }, t2.prototype._reset = function() {
    this.m_isLoop ? this._createLoop(this.m_vertices.slice(0, this.m_vertices.length - 1)) : this._createChain(this.m_vertices);
  }, t2.prototype.setPrevVertex = function(e3) {
    this.m_prevVertex = e3, this.m_hasPrevVertex = true;
  }, t2.prototype.getPrevVertex = function() {
    return this.m_prevVertex;
  }, t2.prototype.setNextVertex = function(e3) {
    this.m_nextVertex = e3, this.m_hasNextVertex = true;
  }, t2.prototype.getNextVertex = function() {
    return this.m_nextVertex;
  }, t2.prototype._clone = function() {
    var e3 = new t2();
    return e3._createChain(this.m_vertices), e3.m_type = this.m_type, e3.m_radius = this.m_radius, e3.m_prevVertex = this.m_prevVertex, e3.m_nextVertex = this.m_nextVertex, e3.m_hasPrevVertex = this.m_hasPrevVertex, e3.m_hasNextVertex = this.m_hasNextVertex, e3;
  }, t2.prototype.getChildCount = function() {
    return this.m_count - 1;
  }, t2.prototype.getChildEdge = function(e3, t3) {
    e3.m_type = Br.TYPE, e3.m_radius = this.m_radius, e3.m_vertex1 = this.m_vertices[t3], e3.m_vertex2 = this.m_vertices[t3 + 1], t3 > 0 ? (e3.m_vertex0 = this.m_vertices[t3 - 1], e3.m_hasVertex0 = true) : (e3.m_vertex0 = this.m_prevVertex, e3.m_hasVertex0 = this.m_hasPrevVertex), t3 < this.m_count - 2 ? (e3.m_vertex3 = this.m_vertices[t3 + 2], e3.m_hasVertex3 = true) : (e3.m_vertex3 = this.m_nextVertex, e3.m_hasVertex3 = this.m_hasNextVertex);
  }, t2.prototype.getVertex = function(e3) {
    return e3 < this.m_count ? this.m_vertices[e3] : this.m_vertices[0];
  }, t2.prototype.isLoop = function() {
    return this.m_isLoop;
  }, t2.prototype.testPoint = function(e3, t3) {
    return false;
  }, t2.prototype.rayCast = function(e3, t3, n2, r2) {
    return new Br(this.getVertex(r2), this.getVertex(r2 + 1)).rayCast(e3, t3, n2, 0);
  }, t2.prototype.computeAABB = function(e3, t3, n2) {
    V(Vr, t3, this.getVertex(n2)), V(Hr, t3, this.getVertex(n2 + 1)), fe.combinePoints(e3, Vr, Hr);
  }, t2.prototype.computeMass = function(e3, t3) {
    e3.mass = 0, F(e3.center), e3.I = 0;
  }, t2.prototype.computeDistanceProxy = function(e3, t3) {
    e3.m_vertices[0] = this.getVertex(t3), e3.m_vertices[1] = this.getVertex(t3 + 1), e3.m_count = 2, e3.m_radius = this.m_radius;
  }, t2.TYPE = `chain`, t2;
}(ft), Wr = Math.max, Gr = Math.min, Kr = N(0, 0), qr = N(0, 0), Jr = N(0, 0), Yr = N(0, 0), Xr = N(0, 0), Zr = N(0, 0), Qr = function(e2) {
  w(t2, e2);
  function t2(n2) {
    var r2 = this;
    return r2 instanceof t2 ? (r2 = e2.call(this) || this, r2.m_type = t2.TYPE, r2.m_radius = M.polygonRadius, r2.m_centroid = Vec2.zero(), r2.m_vertices = [], r2.m_normals = [], r2.m_count = 0, n2 && n2.length && r2._set(n2), r2) : new t2(n2);
  }
  return t2.prototype._serialize = function() {
    return { type: this.m_type, vertices: this.m_vertices };
  }, t2._deserialize = function(e3, n2, r2) {
    var i2 = [];
    if (e3.vertices) for (var a2 = 0; a2 < e3.vertices.length; a2++) i2.push(e3.vertices[a2]);
    return new t2(i2);
  }, t2.prototype.getType = function() {
    return this.m_type;
  }, t2.prototype.getRadius = function() {
    return this.m_radius;
  }, t2.prototype._clone = function() {
    var e3 = new t2();
    e3.m_type = this.m_type, e3.m_radius = this.m_radius, e3.m_count = this.m_count, e3.m_centroid.setVec2(this.m_centroid);
    for (var n2 = 0; n2 < this.m_count; n2++) e3.m_vertices.push(this.m_vertices[n2].clone());
    for (var n2 = 0; n2 < this.m_normals.length; n2++) e3.m_normals.push(this.m_normals[n2].clone());
    return e3;
  }, t2.prototype.getChildCount = function() {
    return 1;
  }, t2.prototype._reset = function() {
    this._set(this.m_vertices);
  }, t2.prototype._set = function(e3) {
    if (e3.length < 3) this._setAsBox(1, 1);
    else {
      for (var t3 = Gr(e3.length, M.maxPolygonVertices), n2 = [], r2 = 0; r2 < t3; ++r2) {
        for (var i2 = e3[r2], a2 = true, o2 = 0; o2 < n2.length; ++o2) if (Vec2.distanceSquared(i2, n2[o2]) < 0.25 * M.linearSlopSquared) {
          a2 = false;
          break;
        }
        a2 && n2.push(Vec2.clone(i2));
      }
      if (t3 = n2.length, t3 < 3) this._setAsBox(1, 1);
      else {
        for (var s2 = 0, c2 = n2[0].x, r2 = 1; r2 < t3; ++r2) {
          var l2 = n2[r2].x;
          (l2 > c2 || l2 === c2 && n2[r2].y < n2[s2].y) && (s2 = r2, c2 = l2);
        }
        for (var u2 = [], d2 = 0, f2 = s2; ; ) {
          u2[d2] = f2;
          for (var p2 = 0, o2 = 1; o2 < t3; ++o2) if (p2 === f2) p2 = o2;
          else {
            var m2 = Vec2.sub(n2[p2], n2[u2[d2]]), i2 = Vec2.sub(n2[o2], n2[u2[d2]]), h2 = Vec2.crossVec2Vec2(m2, i2);
            h2 < 0 && (p2 = o2), h2 === 0 && i2.lengthSquared() > m2.lengthSquared() && (p2 = o2);
          }
          if (++d2, f2 = p2, p2 === s2) break;
        }
        if (d2 < 3) this._setAsBox(1, 1);
        else {
          this.m_count = d2, this.m_vertices = [];
          for (var r2 = 0; r2 < d2; ++r2) this.m_vertices[r2] = n2[u2[r2]];
          for (var r2 = 0; r2 < d2; ++r2) {
            var g2 = r2, _2 = r2 + 1 < d2 ? r2 + 1 : 0, v2 = Vec2.sub(this.m_vertices[_2], this.m_vertices[g2]);
            this.m_normals[r2] = Vec2.crossVec2Num(v2, 1), this.m_normals[r2].normalize();
          }
          this.m_centroid = $r(this.m_vertices, d2);
        }
      }
    }
  }, t2.prototype._setAsBox = function(e3, t3, n2, r2) {
    if (this.m_vertices[0] = Vec2.neo(e3, -t3), this.m_vertices[1] = Vec2.neo(e3, t3), this.m_vertices[2] = Vec2.neo(-e3, t3), this.m_vertices[3] = Vec2.neo(-e3, -t3), this.m_normals[0] = Vec2.neo(1, 0), this.m_normals[1] = Vec2.neo(0, 1), this.m_normals[2] = Vec2.neo(-1, 0), this.m_normals[3] = Vec2.neo(0, -1), this.m_count = 4, n2 && Vec2.isValid(n2)) {
      r2 ||= 0, P(this.m_centroid, n2);
      var i2 = ot.identity();
      i2.p.setVec2(n2), i2.q.setAngle(r2);
      for (var a2 = 0; a2 < this.m_count; ++a2) this.m_vertices[a2] = ot.mulVec2(i2, this.m_vertices[a2]), this.m_normals[a2] = H.mulVec2(i2.q, this.m_normals[a2]);
    }
  }, t2.prototype.testPoint = function(e3, t3) {
    for (var n2 = Xe(Kr, e3, t3), r2 = 0; r2 < this.m_count; ++r2) if (B(this.m_normals[r2], n2) - B(this.m_normals[r2], this.m_vertices[r2]) > 0) return false;
    return true;
  }, t2.prototype.rayCast = function(e3, t3, n2, r2) {
    for (var i2 = H.mulTVec2(n2.q, Vec2.sub(t3.p1, n2.p)), a2 = H.mulTVec2(n2.q, Vec2.sub(t3.p2, n2.p)), o2 = Vec2.sub(a2, i2), s2 = 0, c2 = t3.maxFraction, l2 = -1, u2 = 0; u2 < this.m_count; ++u2) {
      var d2 = Vec2.dot(this.m_normals[u2], Vec2.sub(this.m_vertices[u2], i2)), f2 = Vec2.dot(this.m_normals[u2], o2);
      if (f2 == 0) {
        if (d2 < 0) return false;
      } else f2 < 0 && d2 < s2 * f2 ? (s2 = d2 / f2, l2 = u2) : f2 > 0 && d2 < c2 * f2 && (c2 = d2 / f2);
      if (c2 < s2) return false;
    }
    return l2 >= 0 && (e3.fraction = s2, e3.normal = H.mulVec2(n2.q, this.m_normals[l2]), true);
  }, t2.prototype.computeAABB = function(e3, t3, n2) {
    for (var r2 = 1 / 0, i2 = 1 / 0, a2 = -1 / 0, o2 = -1 / 0, s2 = 0; s2 < this.m_count; ++s2) {
      var c2 = V(Kr, t3, this.m_vertices[s2]);
      r2 = Gr(r2, c2.x), a2 = Wr(a2, c2.x), i2 = Gr(i2, c2.y), o2 = Wr(o2, c2.y);
    }
    Oe(e3.lowerBound, r2 - this.m_radius, i2 - this.m_radius), Oe(e3.upperBound, a2 + this.m_radius, o2 + this.m_radius);
  }, t2.prototype.computeMass = function(e3, t3) {
    F(Xr);
    var n2 = 0, r2 = 0;
    F(Zr);
    for (var i2 = 0; i2 < this.m_count; ++i2) Ae(Zr, this.m_vertices[i2]);
    L(Zr, 1 / this.m_count, Zr);
    for (var a2 = 1 / 3, i2 = 0; i2 < this.m_count; ++i2) {
      I(Jr, this.m_vertices[i2], Zr), i2 + 1 < this.m_count ? I(Yr, this.m_vertices[i2 + 1], Zr) : I(Yr, this.m_vertices[0], Zr);
      var o2 = z(Jr, Yr), s2 = 0.5 * o2;
      n2 += s2, R(Kr, s2 * a2, Jr, s2 * a2, Yr), Ae(Xr, Kr);
      var c2 = Jr.x, l2 = Jr.y, u2 = Yr.x, d2 = Yr.y, f2 = c2 * c2 + u2 * c2 + u2 * u2, p2 = l2 * l2 + d2 * l2 + d2 * d2;
      r2 += 0.25 * a2 * o2 * (f2 + p2);
    }
    e3.mass = t3 * n2, L(Xr, 1 / n2, Xr), je(e3.center, Xr, Zr), e3.I = t3 * r2, e3.I += e3.mass * (B(e3.center, e3.center) - B(Xr, Xr));
  }, t2.prototype.validate = function() {
    for (var e3 = 0; e3 < this.m_count; ++e3) {
      var t3 = e3, n2 = e3 < this.m_count - 1 ? t3 + 1 : 0, r2 = this.m_vertices[t3];
      I(qr, this.m_vertices[n2], r2);
      for (var i2 = 0; i2 < this.m_count; ++i2) if (i2 != t3 && i2 != n2 && z(qr, I(Kr, this.m_vertices[i2], r2)) < 0) return false;
    }
    return true;
  }, t2.prototype.computeDistanceProxy = function(e3) {
    for (var t3 = 0; t3 < this.m_count; ++t3) e3.m_vertices[t3] = this.m_vertices[t3];
    e3.m_vertices.length = this.m_count, e3.m_count = this.m_count, e3.m_radius = this.m_radius;
  }, t2.TYPE = `polygon`, t2;
}(ft);
function $r(e2, t2) {
  for (var n2 = Vec2.zero(), r2 = 0, i2 = Vec2.zero(), a2, o2 = 1 / 3, a2 = 0; a2 < t2; ++a2) {
    var s2 = i2, c2 = e2[a2], l2 = a2 + 1 < t2 ? e2[a2 + 1] : e2[0], u2 = Vec2.sub(c2, s2), d2 = Vec2.sub(l2, s2), f2 = 0.5 * Vec2.crossVec2Vec2(u2, d2);
    r2 += f2, Ie(Kr, 1, s2, 1, c2, 1, l2), Pe(n2, f2 * o2, Kr);
  }
  return n2.mul(1 / r2), n2;
}
var ei = Math.sqrt, ti = Math.PI, ni = N(0, 0), CircleShape = function(e2) {
  w(t2, e2);
  function t2(n2, r2) {
    var i2 = this;
    return i2 instanceof t2 ? (i2 = e2.call(this) || this, i2.m_type = t2.TYPE, i2.m_p = Vec2.zero(), i2.m_radius = 1, typeof n2 == `object` && Vec2.isValid(n2) ? (i2.m_p.setVec2(n2), typeof r2 == `number` && (i2.m_radius = r2)) : typeof n2 == `number` && (i2.m_radius = n2), i2) : new t2(n2, r2);
  }
  return t2.prototype._serialize = function() {
    return { type: this.m_type, p: this.m_p, radius: this.m_radius };
  }, t2._deserialize = function(e3) {
    return new t2(e3.p, e3.radius);
  }, t2.prototype._reset = function() {
  }, t2.prototype.getType = function() {
    return this.m_type;
  }, t2.prototype.getRadius = function() {
    return this.m_radius;
  }, t2.prototype.getCenter = function() {
    return this.m_p;
  }, t2.prototype._clone = function() {
    var e3 = new t2();
    return e3.m_type = this.m_type, e3.m_radius = this.m_radius, e3.m_p = this.m_p.clone(), e3;
  }, t2.prototype.getChildCount = function() {
    return 1;
  }, t2.prototype.testPoint = function(e3, t3) {
    return Ue(t3, V(ni, e3, this.m_p)) <= this.m_radius * this.m_radius;
  }, t2.prototype.rayCast = function(e3, t3, n2, r2) {
    var i2 = Vec2.add(n2.p, H.mulVec2(n2.q, this.m_p)), a2 = Vec2.sub(t3.p1, i2), o2 = Vec2.dot(a2, a2) - this.m_radius * this.m_radius, s2 = Vec2.sub(t3.p2, t3.p1), c2 = Vec2.dot(a2, s2), l2 = Vec2.dot(s2, s2), u2 = c2 * c2 - l2 * o2;
    if (u2 < 0 || l2 < O) return false;
    var d2 = -(c2 + ei(u2));
    return 0 <= d2 && d2 <= t3.maxFraction * l2 && (d2 /= l2, e3.fraction = d2, e3.normal = Vec2.add(a2, Vec2.mulNumVec2(d2, s2)), e3.normal.normalize(), true);
  }, t2.prototype.computeAABB = function(e3, t3, n2) {
    var r2 = V(ni, t3, this.m_p);
    Oe(e3.lowerBound, r2.x - this.m_radius, r2.y - this.m_radius), Oe(e3.upperBound, r2.x + this.m_radius, r2.y + this.m_radius);
  }, t2.prototype.computeMass = function(e3, t3) {
    e3.mass = t3 * ti * this.m_radius * this.m_radius, P(e3.center, this.m_p), e3.I = e3.mass * (0.5 * this.m_radius * this.m_radius + Ve(this.m_p));
  }, t2.prototype.computeDistanceProxy = function(e3) {
    e3.m_vertices[0] = this.m_p, e3.m_vertices.length = 1, e3.m_count = 1, e3.m_radius = this.m_radius;
  }, t2.TYPE = `circle`, t2;
}(ft), ii = Math.abs, ai = Math.PI, oi = { frequencyHz: 0, dampingRatio: 0 }, si = function(e2) {
  w(t2, e2);
  function t2(n2, r2, i2, a2, o2) {
    var s2 = this;
    if (!(s2 instanceof t2)) return new t2(n2, r2, i2, a2, o2);
    if (i2 && a2 && `m_type` in a2 && `x` in i2 && `y` in i2) {
      var c2 = i2;
      i2 = a2, a2 = c2;
    }
    return n2 = E(n2, oi), s2 = e2.call(this, n2, r2, i2) || this, r2 = s2.m_bodyA, i2 = s2.m_bodyB, s2.m_type = t2.TYPE, s2.m_localAnchorA = Vec2.clone(a2 ? r2.getLocalPoint(a2) : n2.localAnchorA || Vec2.zero()), s2.m_localAnchorB = Vec2.clone(o2 ? i2.getLocalPoint(o2) : n2.localAnchorB || Vec2.zero()), s2.m_length = Number.isFinite(n2.length) ? n2.length : Vec2.distance(r2.getWorldPoint(s2.m_localAnchorA), i2.getWorldPoint(s2.m_localAnchorB)), s2.m_frequencyHz = n2.frequencyHz, s2.m_dampingRatio = n2.dampingRatio, s2.m_impulse = 0, s2.m_gamma = 0, s2.m_bias = 0, s2;
  }
  return t2.prototype._serialize = function() {
    return { type: this.m_type, bodyA: this.m_bodyA, bodyB: this.m_bodyB, collideConnected: this.m_collideConnected, frequencyHz: this.m_frequencyHz, dampingRatio: this.m_dampingRatio, localAnchorA: this.m_localAnchorA, localAnchorB: this.m_localAnchorB, length: this.m_length };
  }, t2._deserialize = function(e3, n2, r2) {
    return e3 = T({}, e3), e3.bodyA = r2(U, e3.bodyA, n2), e3.bodyB = r2(U, e3.bodyB, n2), new t2(e3);
  }, t2.prototype._reset = function(e3) {
    e3.anchorA ? this.m_localAnchorA.setVec2(this.m_bodyA.getLocalPoint(e3.anchorA)) : e3.localAnchorA && this.m_localAnchorA.setVec2(e3.localAnchorA), e3.anchorB ? this.m_localAnchorB.setVec2(this.m_bodyB.getLocalPoint(e3.anchorB)) : e3.localAnchorB && this.m_localAnchorB.setVec2(e3.localAnchorB), e3.length > 0 ? this.m_length = +e3.length : e3.length < 0 || (e3.anchorA || e3.anchorA || e3.anchorA || e3.anchorA) && (this.m_length = Vec2.distance(this.m_bodyA.getWorldPoint(this.m_localAnchorA), this.m_bodyB.getWorldPoint(this.m_localAnchorB))), Number.isFinite(e3.frequencyHz) && (this.m_frequencyHz = e3.frequencyHz), Number.isFinite(e3.dampingRatio) && (this.m_dampingRatio = e3.dampingRatio);
  }, t2.prototype.getLocalAnchorA = function() {
    return this.m_localAnchorA;
  }, t2.prototype.getLocalAnchorB = function() {
    return this.m_localAnchorB;
  }, t2.prototype.setLength = function(e3) {
    this.m_length = e3;
  }, t2.prototype.getLength = function() {
    return this.m_length;
  }, t2.prototype.setFrequency = function(e3) {
    this.m_frequencyHz = e3;
  }, t2.prototype.getFrequency = function() {
    return this.m_frequencyHz;
  }, t2.prototype.setDampingRatio = function(e3) {
    this.m_dampingRatio = e3;
  }, t2.prototype.getDampingRatio = function() {
    return this.m_dampingRatio;
  }, t2.prototype.getAnchorA = function() {
    return this.m_bodyA.getWorldPoint(this.m_localAnchorA);
  }, t2.prototype.getAnchorB = function() {
    return this.m_bodyB.getWorldPoint(this.m_localAnchorB);
  }, t2.prototype.getReactionForce = function(e3) {
    return Vec2.mulNumVec2(this.m_impulse, this.m_u).mul(e3);
  }, t2.prototype.getReactionTorque = function(e3) {
    return 0;
  }, t2.prototype.initVelocityConstraints = function(e3) {
    this.m_localCenterA = this.m_bodyA.m_sweep.localCenter, this.m_localCenterB = this.m_bodyB.m_sweep.localCenter, this.m_invMassA = this.m_bodyA.m_invMass, this.m_invMassB = this.m_bodyB.m_invMass, this.m_invIA = this.m_bodyA.m_invI, this.m_invIB = this.m_bodyB.m_invI;
    var t3 = this.m_bodyA.c_position.c, n2 = this.m_bodyA.c_position.a, r2 = this.m_bodyA.c_velocity.v, i2 = this.m_bodyA.c_velocity.w, a2 = this.m_bodyB.c_position.c, o2 = this.m_bodyB.c_position.a, s2 = this.m_bodyB.c_velocity.v, c2 = this.m_bodyB.c_velocity.w, l2 = H.neo(n2), u2 = H.neo(o2);
    this.m_rA = H.mulVec2(l2, Vec2.sub(this.m_localAnchorA, this.m_localCenterA)), this.m_rB = H.mulVec2(u2, Vec2.sub(this.m_localAnchorB, this.m_localCenterB)), this.m_u = Vec2.sub(Vec2.add(a2, this.m_rB), Vec2.add(t3, this.m_rA));
    var d2 = this.m_u.length();
    d2 > M.linearSlop ? this.m_u.mul(1 / d2) : this.m_u.setNum(0, 0);
    var f2 = Vec2.crossVec2Vec2(this.m_rA, this.m_u), p2 = Vec2.crossVec2Vec2(this.m_rB, this.m_u), m2 = this.m_invMassA + this.m_invIA * f2 * f2 + this.m_invMassB + this.m_invIB * p2 * p2;
    if (this.m_mass = m2 == 0 ? 0 : 1 / m2, this.m_frequencyHz > 0) {
      var h2 = d2 - this.m_length, g2 = 2 * ai * this.m_frequencyHz, _2 = 2 * this.m_mass * this.m_dampingRatio * g2, v2 = this.m_mass * g2 * g2, y2 = e3.dt;
      this.m_gamma = y2 * (_2 + y2 * v2), this.m_gamma = this.m_gamma == 0 ? 0 : 1 / this.m_gamma, this.m_bias = h2 * y2 * v2 * this.m_gamma, m2 += this.m_gamma, this.m_mass = m2 == 0 ? 0 : 1 / m2;
    } else this.m_gamma = 0, this.m_bias = 0;
    if (e3.warmStarting) {
      this.m_impulse *= e3.dtRatio;
      var b2 = Vec2.mulNumVec2(this.m_impulse, this.m_u);
      r2.subMul(this.m_invMassA, b2), i2 -= this.m_invIA * Vec2.crossVec2Vec2(this.m_rA, b2), s2.addMul(this.m_invMassB, b2), c2 += this.m_invIB * Vec2.crossVec2Vec2(this.m_rB, b2);
    } else this.m_impulse = 0;
    this.m_bodyA.c_velocity.v.setVec2(r2), this.m_bodyA.c_velocity.w = i2, this.m_bodyB.c_velocity.v.setVec2(s2), this.m_bodyB.c_velocity.w = c2;
  }, t2.prototype.solveVelocityConstraints = function(e3) {
    var t3 = this.m_bodyA.c_velocity.v, n2 = this.m_bodyA.c_velocity.w, r2 = this.m_bodyB.c_velocity.v, i2 = this.m_bodyB.c_velocity.w, a2 = Vec2.add(t3, Vec2.crossNumVec2(n2, this.m_rA)), o2 = Vec2.add(r2, Vec2.crossNumVec2(i2, this.m_rB)), s2 = Vec2.dot(this.m_u, o2) - Vec2.dot(this.m_u, a2), c2 = -this.m_mass * (s2 + this.m_bias + this.m_gamma * this.m_impulse);
    this.m_impulse += c2;
    var l2 = Vec2.mulNumVec2(c2, this.m_u);
    t3.subMul(this.m_invMassA, l2), n2 -= this.m_invIA * Vec2.crossVec2Vec2(this.m_rA, l2), r2.addMul(this.m_invMassB, l2), i2 += this.m_invIB * Vec2.crossVec2Vec2(this.m_rB, l2), this.m_bodyA.c_velocity.v.setVec2(t3), this.m_bodyA.c_velocity.w = n2, this.m_bodyB.c_velocity.v.setVec2(r2), this.m_bodyB.c_velocity.w = i2;
  }, t2.prototype.solvePositionConstraints = function(e3) {
    if (this.m_frequencyHz > 0) return true;
    var t3 = this.m_bodyA.c_position.c, n2 = this.m_bodyA.c_position.a, r2 = this.m_bodyB.c_position.c, i2 = this.m_bodyB.c_position.a, a2 = H.neo(n2), o2 = H.neo(i2), s2 = H.mulSub(a2, this.m_localAnchorA, this.m_localCenterA), c2 = H.mulSub(o2, this.m_localAnchorB, this.m_localCenterB), l2 = Vec2.sub(Vec2.add(r2, c2), Vec2.add(t3, s2)), u2 = k(l2.normalize() - this.m_length, -M.maxLinearCorrection, M.maxLinearCorrection), d2 = -this.m_mass * u2, f2 = Vec2.mulNumVec2(d2, l2);
    return t3.subMul(this.m_invMassA, f2), n2 -= this.m_invIA * Vec2.crossVec2Vec2(s2, f2), r2.addMul(this.m_invMassB, f2), i2 += this.m_invIB * Vec2.crossVec2Vec2(c2, f2), this.m_bodyA.c_position.c.setVec2(t3), this.m_bodyA.c_position.a = n2, this.m_bodyB.c_position.c.setVec2(r2), this.m_bodyB.c_position.a = i2, ii(u2) < M.linearSlop;
  }, t2.TYPE = `distance-joint`, t2;
}(kt), ci = { maxForce: 0, maxTorque: 0 }, li = function(e2) {
  w(t2, e2);
  function t2(n2, r2, i2, a2) {
    var o2 = this;
    return o2 instanceof t2 ? (n2 = E(n2, ci), o2 = e2.call(this, n2, r2, i2) || this, r2 = o2.m_bodyA, i2 = o2.m_bodyB, o2.m_type = t2.TYPE, o2.m_localAnchorA = Vec2.clone(a2 ? r2.getLocalPoint(a2) : n2.localAnchorA || Vec2.zero()), o2.m_localAnchorB = Vec2.clone(a2 ? i2.getLocalPoint(a2) : n2.localAnchorB || Vec2.zero()), o2.m_linearImpulse = Vec2.zero(), o2.m_angularImpulse = 0, o2.m_maxForce = n2.maxForce, o2.m_maxTorque = n2.maxTorque, o2) : new t2(n2, r2, i2, a2);
  }
  return t2.prototype._serialize = function() {
    return { type: this.m_type, bodyA: this.m_bodyA, bodyB: this.m_bodyB, collideConnected: this.m_collideConnected, maxForce: this.m_maxForce, maxTorque: this.m_maxTorque, localAnchorA: this.m_localAnchorA, localAnchorB: this.m_localAnchorB };
  }, t2._deserialize = function(e3, n2, r2) {
    return e3 = T({}, e3), e3.bodyA = r2(U, e3.bodyA, n2), e3.bodyB = r2(U, e3.bodyB, n2), new t2(e3);
  }, t2.prototype._reset = function(e3) {
    e3.anchorA ? this.m_localAnchorA.setVec2(this.m_bodyA.getLocalPoint(e3.anchorA)) : e3.localAnchorA && this.m_localAnchorA.setVec2(e3.localAnchorA), e3.anchorB ? this.m_localAnchorB.setVec2(this.m_bodyB.getLocalPoint(e3.anchorB)) : e3.localAnchorB && this.m_localAnchorB.setVec2(e3.localAnchorB), Number.isFinite(e3.maxForce) && (this.m_maxForce = e3.maxForce), Number.isFinite(e3.maxTorque) && (this.m_maxTorque = e3.maxTorque);
  }, t2.prototype.getLocalAnchorA = function() {
    return this.m_localAnchorA;
  }, t2.prototype.getLocalAnchorB = function() {
    return this.m_localAnchorB;
  }, t2.prototype.setMaxForce = function(e3) {
    this.m_maxForce = e3;
  }, t2.prototype.getMaxForce = function() {
    return this.m_maxForce;
  }, t2.prototype.setMaxTorque = function(e3) {
    this.m_maxTorque = e3;
  }, t2.prototype.getMaxTorque = function() {
    return this.m_maxTorque;
  }, t2.prototype.getAnchorA = function() {
    return this.m_bodyA.getWorldPoint(this.m_localAnchorA);
  }, t2.prototype.getAnchorB = function() {
    return this.m_bodyB.getWorldPoint(this.m_localAnchorB);
  }, t2.prototype.getReactionForce = function(e3) {
    return Vec2.mulNumVec2(e3, this.m_linearImpulse);
  }, t2.prototype.getReactionTorque = function(e3) {
    return e3 * this.m_angularImpulse;
  }, t2.prototype.initVelocityConstraints = function(e3) {
    this.m_localCenterA = this.m_bodyA.m_sweep.localCenter, this.m_localCenterB = this.m_bodyB.m_sweep.localCenter, this.m_invMassA = this.m_bodyA.m_invMass, this.m_invMassB = this.m_bodyB.m_invMass, this.m_invIA = this.m_bodyA.m_invI, this.m_invIB = this.m_bodyB.m_invI;
    var t3 = this.m_bodyA.c_position.a, n2 = this.m_bodyA.c_velocity.v, r2 = this.m_bodyA.c_velocity.w, i2 = this.m_bodyB.c_position.a, a2 = this.m_bodyB.c_velocity.v, o2 = this.m_bodyB.c_velocity.w, s2 = H.neo(t3), c2 = H.neo(i2);
    this.m_rA = H.mulVec2(s2, Vec2.sub(this.m_localAnchorA, this.m_localCenterA)), this.m_rB = H.mulVec2(c2, Vec2.sub(this.m_localAnchorB, this.m_localCenterB));
    var l2 = this.m_invMassA, u2 = this.m_invMassB, d2 = this.m_invIA, f2 = this.m_invIB, p2 = new Fn();
    if (p2.ex.x = l2 + u2 + d2 * this.m_rA.y * this.m_rA.y + f2 * this.m_rB.y * this.m_rB.y, p2.ex.y = -d2 * this.m_rA.x * this.m_rA.y - f2 * this.m_rB.x * this.m_rB.y, p2.ey.x = p2.ex.y, p2.ey.y = l2 + u2 + d2 * this.m_rA.x * this.m_rA.x + f2 * this.m_rB.x * this.m_rB.x, this.m_linearMass = p2.getInverse(), this.m_angularMass = d2 + f2, this.m_angularMass > 0 && (this.m_angularMass = 1 / this.m_angularMass), e3.warmStarting) {
      this.m_linearImpulse.mul(e3.dtRatio), this.m_angularImpulse *= e3.dtRatio;
      var m2 = Vec2.neo(this.m_linearImpulse.x, this.m_linearImpulse.y);
      n2.subMul(l2, m2), r2 -= d2 * (Vec2.crossVec2Vec2(this.m_rA, m2) + this.m_angularImpulse), a2.addMul(u2, m2), o2 += f2 * (Vec2.crossVec2Vec2(this.m_rB, m2) + this.m_angularImpulse);
    } else this.m_linearImpulse.setZero(), this.m_angularImpulse = 0;
    this.m_bodyA.c_velocity.v = n2, this.m_bodyA.c_velocity.w = r2, this.m_bodyB.c_velocity.v = a2, this.m_bodyB.c_velocity.w = o2;
  }, t2.prototype.solveVelocityConstraints = function(e3) {
    var t3 = this.m_bodyA.c_velocity.v, n2 = this.m_bodyA.c_velocity.w, r2 = this.m_bodyB.c_velocity.v, i2 = this.m_bodyB.c_velocity.w, a2 = this.m_invMassA, o2 = this.m_invMassB, s2 = this.m_invIA, c2 = this.m_invIB, l2 = e3.dt, u2 = i2 - n2, d2 = -this.m_angularMass * u2, f2 = this.m_angularImpulse, p2 = l2 * this.m_maxTorque;
    this.m_angularImpulse = k(this.m_angularImpulse + d2, -p2, p2), d2 = this.m_angularImpulse - f2, n2 -= s2 * d2, i2 += c2 * d2;
    var u2 = Vec2.sub(Vec2.add(r2, Vec2.crossNumVec2(i2, this.m_rB)), Vec2.add(t3, Vec2.crossNumVec2(n2, this.m_rA))), d2 = Vec2.neg(Fn.mulVec2(this.m_linearMass, u2)), f2 = this.m_linearImpulse;
    this.m_linearImpulse.add(d2);
    var p2 = l2 * this.m_maxForce;
    this.m_linearImpulse.lengthSquared() > p2 * p2 && (this.m_linearImpulse.normalize(), this.m_linearImpulse.mul(p2)), d2 = Vec2.sub(this.m_linearImpulse, f2), t3.subMul(a2, d2), n2 -= s2 * Vec2.crossVec2Vec2(this.m_rA, d2), r2.addMul(o2, d2), i2 += c2 * Vec2.crossVec2Vec2(this.m_rB, d2), this.m_bodyA.c_velocity.v = t3, this.m_bodyA.c_velocity.w = n2, this.m_bodyB.c_velocity.v = r2, this.m_bodyB.c_velocity.w = i2;
  }, t2.prototype.solvePositionConstraints = function(e3) {
    return true;
  }, t2.TYPE = `friction-joint`, t2;
}(kt), ui = function() {
  function e2(e3, t2, n2) {
    typeof e3 == `object` && e3 ? (this.ex = J.clone(e3), this.ey = J.clone(t2), this.ez = J.clone(n2)) : (this.ex = J.zero(), this.ey = J.zero(), this.ez = J.zero());
  }
  return e2.prototype.toString = function() {
    return JSON.stringify(this);
  }, e2.isValid = function(e3) {
    return e3 != null && J.isValid(e3.ex) && J.isValid(e3.ey) && J.isValid(e3.ez);
  }, e2.assert = function(e3) {
  }, e2.prototype.setZero = function() {
    return this.ex.setZero(), this.ey.setZero(), this.ez.setZero(), this;
  }, e2.prototype.solve33 = function(e3) {
    var t2 = this.ey.y * this.ez.z - this.ey.z * this.ez.y, n2 = this.ey.z * this.ez.x - this.ey.x * this.ez.z, r2 = this.ey.x * this.ez.y - this.ey.y * this.ez.x, i2 = this.ex.x * t2 + this.ex.y * n2 + this.ex.z * r2;
    i2 !== 0 && (i2 = 1 / i2);
    var a2 = new J();
    return t2 = this.ey.y * this.ez.z - this.ey.z * this.ez.y, n2 = this.ey.z * this.ez.x - this.ey.x * this.ez.z, r2 = this.ey.x * this.ez.y - this.ey.y * this.ez.x, a2.x = i2 * (e3.x * t2 + e3.y * n2 + e3.z * r2), t2 = e3.y * this.ez.z - e3.z * this.ez.y, n2 = e3.z * this.ez.x - e3.x * this.ez.z, r2 = e3.x * this.ez.y - e3.y * this.ez.x, a2.y = i2 * (this.ex.x * t2 + this.ex.y * n2 + this.ex.z * r2), t2 = this.ey.y * e3.z - this.ey.z * e3.y, n2 = this.ey.z * e3.x - this.ey.x * e3.z, r2 = this.ey.x * e3.y - this.ey.y * e3.x, a2.z = i2 * (this.ex.x * t2 + this.ex.y * n2 + this.ex.z * r2), a2;
  }, e2.prototype.solve22 = function(e3) {
    var t2 = this.ex.x, n2 = this.ey.x, r2 = this.ex.y, i2 = this.ey.y, a2 = t2 * i2 - n2 * r2;
    a2 !== 0 && (a2 = 1 / a2);
    var o2 = Vec2.zero();
    return o2.x = a2 * (i2 * e3.x - n2 * e3.y), o2.y = a2 * (t2 * e3.y - r2 * e3.x), o2;
  }, e2.prototype.getInverse22 = function(e3) {
    var t2 = this.ex.x, n2 = this.ey.x, r2 = this.ex.y, i2 = this.ey.y, a2 = t2 * i2 - n2 * r2;
    a2 !== 0 && (a2 = 1 / a2), e3.ex.x = a2 * i2, e3.ey.x = -a2 * n2, e3.ex.z = 0, e3.ex.y = -a2 * r2, e3.ey.y = a2 * t2, e3.ey.z = 0, e3.ez.x = 0, e3.ez.y = 0, e3.ez.z = 0;
  }, e2.prototype.getSymInverse33 = function(e3) {
    var t2 = J.dot(this.ex, J.cross(this.ey, this.ez));
    t2 !== 0 && (t2 = 1 / t2);
    var n2 = this.ex.x, r2 = this.ey.x, i2 = this.ez.x, a2 = this.ey.y, o2 = this.ez.y, s2 = this.ez.z;
    e3.ex.x = t2 * (a2 * s2 - o2 * o2), e3.ex.y = t2 * (i2 * o2 - r2 * s2), e3.ex.z = t2 * (r2 * o2 - i2 * a2), e3.ey.x = e3.ex.y, e3.ey.y = t2 * (n2 * s2 - i2 * i2), e3.ey.z = t2 * (i2 * r2 - n2 * o2), e3.ez.x = e3.ex.z, e3.ez.y = e3.ey.z, e3.ez.z = t2 * (n2 * a2 - r2 * r2);
  }, e2.mul = function(e3, t2) {
    if (t2 && `z` in t2 && `y` in t2 && `x` in t2) {
      var n2 = e3.ex.x * t2.x + e3.ey.x * t2.y + e3.ez.x * t2.z, r2 = e3.ex.y * t2.x + e3.ey.y * t2.y + e3.ez.y * t2.z;
      return new J(n2, r2, e3.ex.z * t2.x + e3.ey.z * t2.y + e3.ez.z * t2.z);
    }
    if (t2 && `y` in t2 && `x` in t2) {
      var n2 = e3.ex.x * t2.x + e3.ey.x * t2.y, r2 = e3.ex.y * t2.x + e3.ey.y * t2.y;
      return Vec2.neo(n2, r2);
    }
  }, e2.mulVec3 = function(e3, t2) {
    return new J(e3.ex.x * t2.x + e3.ey.x * t2.y + e3.ez.x * t2.z, e3.ex.y * t2.x + e3.ey.y * t2.y + e3.ez.y * t2.z, e3.ex.z * t2.x + e3.ey.z * t2.y + e3.ez.z * t2.z);
  }, e2.mulVec2 = function(e3, t2) {
    var n2 = e3.ex.x * t2.x + e3.ey.x * t2.y, r2 = e3.ex.y * t2.x + e3.ey.y * t2.y;
    return Vec2.neo(n2, r2);
  }, e2.add = function(t2, n2) {
    return new e2(J.add(t2.ex, n2.ex), J.add(t2.ey, n2.ey), J.add(t2.ez, n2.ez));
  }, e2;
}(), di = Math.abs, fi;
(function(e2) {
  e2[e2.inactiveLimit = 0] = `inactiveLimit`, e2[e2.atLowerLimit = 1] = `atLowerLimit`, e2[e2.atUpperLimit = 2] = `atUpperLimit`, e2[e2.equalLimits = 3] = `equalLimits`;
})(fi ||= {});
var pi = { lowerAngle: 0, upperAngle: 0, maxMotorTorque: 0, motorSpeed: 0, enableLimit: false, enableMotor: false }, RevoluteJoint = function(e2) {
  w(t2, e2);
  function t2(n2, r2, i2, a2) {
    var o2 = this;
    return o2 instanceof t2 ? (n2 ??= {}, o2 = e2.call(this, n2, r2, i2) || this, r2 = o2.m_bodyA, i2 = o2.m_bodyB, o2.m_mass = new ui(), o2.m_limitState = fi.inactiveLimit, o2.m_type = t2.TYPE, Vec2.isValid(a2) ? o2.m_localAnchorA = r2.getLocalPoint(a2) : Vec2.isValid(n2.localAnchorA) ? o2.m_localAnchorA = Vec2.clone(n2.localAnchorA) : o2.m_localAnchorA = Vec2.zero(), Vec2.isValid(a2) ? o2.m_localAnchorB = i2.getLocalPoint(a2) : Vec2.isValid(n2.localAnchorB) ? o2.m_localAnchorB = Vec2.clone(n2.localAnchorB) : o2.m_localAnchorB = Vec2.zero(), Number.isFinite(n2.referenceAngle) ? o2.m_referenceAngle = n2.referenceAngle : o2.m_referenceAngle = i2.getAngle() - r2.getAngle(), o2.m_impulse = new J(), o2.m_motorImpulse = 0, o2.m_lowerAngle = n2.lowerAngle ?? pi.lowerAngle, o2.m_upperAngle = n2.upperAngle ?? pi.upperAngle, o2.m_maxMotorTorque = n2.maxMotorTorque ?? pi.maxMotorTorque, o2.m_motorSpeed = n2.motorSpeed ?? pi.motorSpeed, o2.m_enableLimit = n2.enableLimit ?? pi.enableLimit, o2.m_enableMotor = n2.enableMotor ?? pi.enableMotor, o2) : new t2(n2, r2, i2, a2);
  }
  return t2.prototype._serialize = function() {
    return { type: this.m_type, bodyA: this.m_bodyA, bodyB: this.m_bodyB, collideConnected: this.m_collideConnected, lowerAngle: this.m_lowerAngle, upperAngle: this.m_upperAngle, maxMotorTorque: this.m_maxMotorTorque, motorSpeed: this.m_motorSpeed, enableLimit: this.m_enableLimit, enableMotor: this.m_enableMotor, localAnchorA: this.m_localAnchorA, localAnchorB: this.m_localAnchorB, referenceAngle: this.m_referenceAngle };
  }, t2._deserialize = function(e3, n2, r2) {
    return e3 = T({}, e3), e3.bodyA = r2(U, e3.bodyA, n2), e3.bodyB = r2(U, e3.bodyB, n2), new t2(e3);
  }, t2.prototype._reset = function(e3) {
    e3.anchorA ? this.m_localAnchorA.setVec2(this.m_bodyA.getLocalPoint(e3.anchorA)) : e3.localAnchorA && this.m_localAnchorA.setVec2(e3.localAnchorA), e3.anchorB ? this.m_localAnchorB.setVec2(this.m_bodyB.getLocalPoint(e3.anchorB)) : e3.localAnchorB && this.m_localAnchorB.setVec2(e3.localAnchorB), Number.isFinite(e3.referenceAngle) && (this.m_referenceAngle = e3.referenceAngle), e3.enableLimit !== void 0 && (this.m_enableLimit = e3.enableLimit), Number.isFinite(e3.lowerAngle) && (this.m_lowerAngle = e3.lowerAngle), Number.isFinite(e3.upperAngle) && (this.m_upperAngle = e3.upperAngle), Number.isFinite(e3.maxMotorTorque) && (this.m_maxMotorTorque = e3.maxMotorTorque), Number.isFinite(e3.motorSpeed) && (this.m_motorSpeed = e3.motorSpeed), e3.enableMotor !== void 0 && (this.m_enableMotor = e3.enableMotor);
  }, t2.prototype.getLocalAnchorA = function() {
    return this.m_localAnchorA;
  }, t2.prototype.getLocalAnchorB = function() {
    return this.m_localAnchorB;
  }, t2.prototype.getReferenceAngle = function() {
    return this.m_referenceAngle;
  }, t2.prototype.getJointAngle = function() {
    var e3 = this.m_bodyA;
    return this.m_bodyB.m_sweep.a - e3.m_sweep.a - this.m_referenceAngle;
  }, t2.prototype.getJointSpeed = function() {
    var e3 = this.m_bodyA;
    return this.m_bodyB.m_angularVelocity - e3.m_angularVelocity;
  }, t2.prototype.isMotorEnabled = function() {
    return this.m_enableMotor;
  }, t2.prototype.enableMotor = function(e3) {
    e3 != this.m_enableMotor && (this.m_bodyA.setAwake(true), this.m_bodyB.setAwake(true), this.m_enableMotor = e3);
  }, t2.prototype.getMotorTorque = function(e3) {
    return e3 * this.m_motorImpulse;
  }, t2.prototype.setMotorSpeed = function(e3) {
    e3 != this.m_motorSpeed && (this.m_bodyA.setAwake(true), this.m_bodyB.setAwake(true), this.m_motorSpeed = e3);
  }, t2.prototype.getMotorSpeed = function() {
    return this.m_motorSpeed;
  }, t2.prototype.setMaxMotorTorque = function(e3) {
    e3 != this.m_maxMotorTorque && (this.m_bodyA.setAwake(true), this.m_bodyB.setAwake(true), this.m_maxMotorTorque = e3);
  }, t2.prototype.getMaxMotorTorque = function() {
    return this.m_maxMotorTorque;
  }, t2.prototype.isLimitEnabled = function() {
    return this.m_enableLimit;
  }, t2.prototype.enableLimit = function(e3) {
    e3 != this.m_enableLimit && (this.m_bodyA.setAwake(true), this.m_bodyB.setAwake(true), this.m_enableLimit = e3, this.m_impulse.z = 0);
  }, t2.prototype.getLowerLimit = function() {
    return this.m_lowerAngle;
  }, t2.prototype.getUpperLimit = function() {
    return this.m_upperAngle;
  }, t2.prototype.setLimits = function(e3, t3) {
    (e3 != this.m_lowerAngle || t3 != this.m_upperAngle) && (this.m_bodyA.setAwake(true), this.m_bodyB.setAwake(true), this.m_impulse.z = 0, this.m_lowerAngle = e3, this.m_upperAngle = t3);
  }, t2.prototype.getAnchorA = function() {
    return this.m_bodyA.getWorldPoint(this.m_localAnchorA);
  }, t2.prototype.getAnchorB = function() {
    return this.m_bodyB.getWorldPoint(this.m_localAnchorB);
  }, t2.prototype.getReactionForce = function(e3) {
    return Vec2.neo(this.m_impulse.x, this.m_impulse.y).mul(e3);
  }, t2.prototype.getReactionTorque = function(e3) {
    return e3 * this.m_impulse.z;
  }, t2.prototype.initVelocityConstraints = function(e3) {
    this.m_localCenterA = this.m_bodyA.m_sweep.localCenter, this.m_localCenterB = this.m_bodyB.m_sweep.localCenter, this.m_invMassA = this.m_bodyA.m_invMass, this.m_invMassB = this.m_bodyB.m_invMass, this.m_invIA = this.m_bodyA.m_invI, this.m_invIB = this.m_bodyB.m_invI;
    var t3 = this.m_bodyA.c_position.a, n2 = this.m_bodyA.c_velocity.v, r2 = this.m_bodyA.c_velocity.w, i2 = this.m_bodyB.c_position.a, a2 = this.m_bodyB.c_velocity.v, o2 = this.m_bodyB.c_velocity.w, s2 = H.neo(t3), c2 = H.neo(i2);
    this.m_rA = H.mulVec2(s2, Vec2.sub(this.m_localAnchorA, this.m_localCenterA)), this.m_rB = H.mulVec2(c2, Vec2.sub(this.m_localAnchorB, this.m_localCenterB));
    var l2 = this.m_invMassA, u2 = this.m_invMassB, d2 = this.m_invIA, f2 = this.m_invIB, p2 = d2 + f2 === 0;
    if (this.m_mass.ex.x = l2 + u2 + this.m_rA.y * this.m_rA.y * d2 + this.m_rB.y * this.m_rB.y * f2, this.m_mass.ey.x = -this.m_rA.y * this.m_rA.x * d2 - this.m_rB.y * this.m_rB.x * f2, this.m_mass.ez.x = -this.m_rA.y * d2 - this.m_rB.y * f2, this.m_mass.ex.y = this.m_mass.ey.x, this.m_mass.ey.y = l2 + u2 + this.m_rA.x * this.m_rA.x * d2 + this.m_rB.x * this.m_rB.x * f2, this.m_mass.ez.y = this.m_rA.x * d2 + this.m_rB.x * f2, this.m_mass.ex.z = this.m_mass.ez.x, this.m_mass.ey.z = this.m_mass.ez.y, this.m_mass.ez.z = d2 + f2, this.m_motorMass = d2 + f2, this.m_motorMass > 0 && (this.m_motorMass = 1 / this.m_motorMass), (this.m_enableMotor == 0 || p2) && (this.m_motorImpulse = 0), this.m_enableLimit && p2 == 0) {
      var m2 = i2 - t3 - this.m_referenceAngle;
      di(this.m_upperAngle - this.m_lowerAngle) < 2 * M.angularSlop ? this.m_limitState = fi.equalLimits : m2 <= this.m_lowerAngle ? (this.m_limitState != fi.atLowerLimit && (this.m_impulse.z = 0), this.m_limitState = fi.atLowerLimit) : m2 >= this.m_upperAngle ? (this.m_limitState != fi.atUpperLimit && (this.m_impulse.z = 0), this.m_limitState = fi.atUpperLimit) : (this.m_limitState = fi.inactiveLimit, this.m_impulse.z = 0);
    } else this.m_limitState = fi.inactiveLimit;
    if (e3.warmStarting) {
      this.m_impulse.mul(e3.dtRatio), this.m_motorImpulse *= e3.dtRatio;
      var h2 = Vec2.neo(this.m_impulse.x, this.m_impulse.y);
      n2.subMul(l2, h2), r2 -= d2 * (Vec2.crossVec2Vec2(this.m_rA, h2) + this.m_motorImpulse + this.m_impulse.z), a2.addMul(u2, h2), o2 += f2 * (Vec2.crossVec2Vec2(this.m_rB, h2) + this.m_motorImpulse + this.m_impulse.z);
    } else this.m_impulse.setZero(), this.m_motorImpulse = 0;
    this.m_bodyA.c_velocity.v = n2, this.m_bodyA.c_velocity.w = r2, this.m_bodyB.c_velocity.v = a2, this.m_bodyB.c_velocity.w = o2;
  }, t2.prototype.solveVelocityConstraints = function(e3) {
    var t3 = this.m_bodyA.c_velocity.v, n2 = this.m_bodyA.c_velocity.w, r2 = this.m_bodyB.c_velocity.v, i2 = this.m_bodyB.c_velocity.w, a2 = this.m_invMassA, o2 = this.m_invMassB, s2 = this.m_invIA, c2 = this.m_invIB, l2 = s2 + c2 === 0;
    if (this.m_enableMotor && this.m_limitState != fi.equalLimits && l2 == 0) {
      var u2 = i2 - n2 - this.m_motorSpeed, d2 = -this.m_motorMass * u2, f2 = this.m_motorImpulse, p2 = e3.dt * this.m_maxMotorTorque;
      this.m_motorImpulse = k(this.m_motorImpulse + d2, -p2, p2), d2 = this.m_motorImpulse - f2, n2 -= s2 * d2, i2 += c2 * d2;
    }
    if (this.m_enableLimit && this.m_limitState != fi.inactiveLimit && l2 == 0) {
      var m2 = Vec2.zero();
      m2.addCombine(1, r2, 1, Vec2.crossNumVec2(i2, this.m_rB)), m2.subCombine(1, t3, 1, Vec2.crossNumVec2(n2, this.m_rA));
      var h2 = i2 - n2, u2 = new J(m2.x, m2.y, h2), d2 = J.neg(this.m_mass.solve33(u2));
      if (this.m_limitState == fi.equalLimits) this.m_impulse.add(d2);
      else if (this.m_limitState == fi.atLowerLimit) {
        var g2 = this.m_impulse.z + d2.z;
        if (g2 < 0) {
          var _2 = Vec2.combine(-1, m2, this.m_impulse.z, Vec2.neo(this.m_mass.ez.x, this.m_mass.ez.y)), v2 = this.m_mass.solve22(_2);
          d2.x = v2.x, d2.y = v2.y, d2.z = -this.m_impulse.z, this.m_impulse.x += v2.x, this.m_impulse.y += v2.y, this.m_impulse.z = 0;
        } else this.m_impulse.add(d2);
      } else if (this.m_limitState == fi.atUpperLimit) {
        var g2 = this.m_impulse.z + d2.z;
        if (g2 > 0) {
          var _2 = Vec2.combine(-1, m2, this.m_impulse.z, Vec2.neo(this.m_mass.ez.x, this.m_mass.ez.y)), v2 = this.m_mass.solve22(_2);
          d2.x = v2.x, d2.y = v2.y, d2.z = -this.m_impulse.z, this.m_impulse.x += v2.x, this.m_impulse.y += v2.y, this.m_impulse.z = 0;
        } else this.m_impulse.add(d2);
      }
      var y2 = Vec2.neo(d2.x, d2.y);
      t3.subMul(a2, y2), n2 -= s2 * (Vec2.crossVec2Vec2(this.m_rA, y2) + d2.z), r2.addMul(o2, y2), i2 += c2 * (Vec2.crossVec2Vec2(this.m_rB, y2) + d2.z);
    } else {
      var u2 = Vec2.zero();
      u2.addCombine(1, r2, 1, Vec2.crossNumVec2(i2, this.m_rB)), u2.subCombine(1, t3, 1, Vec2.crossNumVec2(n2, this.m_rA));
      var d2 = this.m_mass.solve22(Vec2.neg(u2));
      this.m_impulse.x += d2.x, this.m_impulse.y += d2.y, t3.subMul(a2, d2), n2 -= s2 * Vec2.crossVec2Vec2(this.m_rA, d2), r2.addMul(o2, d2), i2 += c2 * Vec2.crossVec2Vec2(this.m_rB, d2);
    }
    this.m_bodyA.c_velocity.v = t3, this.m_bodyA.c_velocity.w = n2, this.m_bodyB.c_velocity.v = r2, this.m_bodyB.c_velocity.w = i2;
  }, t2.prototype.solvePositionConstraints = function(e3) {
    var t3 = this.m_bodyA.c_position.c, n2 = this.m_bodyA.c_position.a, r2 = this.m_bodyB.c_position.c, i2 = this.m_bodyB.c_position.a, a2 = H.neo(n2), o2 = H.neo(i2), s2 = 0, c2 = 0, l2 = this.m_invIA + this.m_invIB == 0;
    if (this.m_enableLimit && this.m_limitState != fi.inactiveLimit && l2 == 0) {
      var u2 = i2 - n2 - this.m_referenceAngle, d2 = 0;
      if (this.m_limitState == fi.equalLimits) {
        var f2 = k(u2 - this.m_lowerAngle, -M.maxAngularCorrection, M.maxAngularCorrection);
        d2 = -this.m_motorMass * f2, s2 = di(f2);
      } else if (this.m_limitState == fi.atLowerLimit) {
        var f2 = u2 - this.m_lowerAngle;
        s2 = -f2, f2 = k(f2 + M.angularSlop, -M.maxAngularCorrection, 0), d2 = -this.m_motorMass * f2;
      } else if (this.m_limitState == fi.atUpperLimit) {
        var f2 = u2 - this.m_upperAngle;
        s2 = f2, f2 = k(f2 - M.angularSlop, 0, M.maxAngularCorrection), d2 = -this.m_motorMass * f2;
      }
      n2 -= this.m_invIA * d2, i2 += this.m_invIB * d2;
    }
    a2.setAngle(n2), o2.setAngle(i2);
    var p2 = H.mulVec2(a2, Vec2.sub(this.m_localAnchorA, this.m_localCenterA)), m2 = H.mulVec2(o2, Vec2.sub(this.m_localAnchorB, this.m_localCenterB)), f2 = Vec2.zero();
    f2.addCombine(1, r2, 1, m2), f2.subCombine(1, t3, 1, p2), c2 = f2.length();
    var h2 = this.m_invMassA, g2 = this.m_invMassB, _2 = this.m_invIA, v2 = this.m_invIB, y2 = new Fn();
    y2.ex.x = h2 + g2 + _2 * p2.y * p2.y + v2 * m2.y * m2.y, y2.ex.y = -_2 * p2.x * p2.y - v2 * m2.x * m2.y, y2.ey.x = y2.ex.y, y2.ey.y = h2 + g2 + _2 * p2.x * p2.x + v2 * m2.x * m2.x;
    var b2 = Vec2.neg(y2.solve(f2));
    return t3.subMul(h2, b2), n2 -= _2 * Vec2.crossVec2Vec2(p2, b2), r2.addMul(g2, b2), i2 += v2 * Vec2.crossVec2Vec2(m2, b2), this.m_bodyA.c_position.c.setVec2(t3), this.m_bodyA.c_position.a = n2, this.m_bodyB.c_position.c.setVec2(r2), this.m_bodyB.c_position.a = i2, c2 <= M.linearSlop && s2 <= M.angularSlop;
  }, t2.TYPE = `revolute-joint`, t2;
}(kt), hi = Math.abs, gi = Math.max, _i = Math.min, vi;
(function(e2) {
  e2[e2.inactiveLimit = 0] = `inactiveLimit`, e2[e2.atLowerLimit = 1] = `atLowerLimit`, e2[e2.atUpperLimit = 2] = `atUpperLimit`, e2[e2.equalLimits = 3] = `equalLimits`;
})(vi ||= {});
var yi = { enableLimit: false, lowerTranslation: 0, upperTranslation: 0, enableMotor: false, maxMotorForce: 0, motorSpeed: 0 }, bi = function(e2) {
  w(t2, e2);
  function t2(n2, r2, i2, a2, o2) {
    var s2 = this;
    return s2 instanceof t2 ? (n2 = E(n2, yi), s2 = e2.call(this, n2, r2, i2) || this, r2 = s2.m_bodyA, i2 = s2.m_bodyB, s2.m_type = t2.TYPE, s2.m_localAnchorA = Vec2.clone(a2 ? r2.getLocalPoint(a2) : n2.localAnchorA || Vec2.zero()), s2.m_localAnchorB = Vec2.clone(a2 ? i2.getLocalPoint(a2) : n2.localAnchorB || Vec2.zero()), s2.m_localXAxisA = Vec2.clone(o2 ? r2.getLocalVector(o2) : n2.localAxisA || Vec2.neo(1, 0)), s2.m_localXAxisA.normalize(), s2.m_localYAxisA = Vec2.crossNumVec2(1, s2.m_localXAxisA), s2.m_referenceAngle = Number.isFinite(n2.referenceAngle) ? n2.referenceAngle : i2.getAngle() - r2.getAngle(), s2.m_impulse = new J(), s2.m_motorMass = 0, s2.m_motorImpulse = 0, s2.m_lowerTranslation = n2.lowerTranslation, s2.m_upperTranslation = n2.upperTranslation, s2.m_maxMotorForce = n2.maxMotorForce, s2.m_motorSpeed = n2.motorSpeed, s2.m_enableLimit = n2.enableLimit, s2.m_enableMotor = n2.enableMotor, s2.m_limitState = vi.inactiveLimit, s2.m_axis = Vec2.zero(), s2.m_perp = Vec2.zero(), s2.m_K = new ui(), s2) : new t2(n2, r2, i2, a2, o2);
  }
  return t2.prototype._serialize = function() {
    return { type: this.m_type, bodyA: this.m_bodyA, bodyB: this.m_bodyB, collideConnected: this.m_collideConnected, lowerTranslation: this.m_lowerTranslation, upperTranslation: this.m_upperTranslation, maxMotorForce: this.m_maxMotorForce, motorSpeed: this.m_motorSpeed, enableLimit: this.m_enableLimit, enableMotor: this.m_enableMotor, localAnchorA: this.m_localAnchorA, localAnchorB: this.m_localAnchorB, localAxisA: this.m_localXAxisA, referenceAngle: this.m_referenceAngle };
  }, t2._deserialize = function(e3, n2, r2) {
    return e3 = T({}, e3), e3.bodyA = r2(U, e3.bodyA, n2), e3.bodyB = r2(U, e3.bodyB, n2), e3.localAxisA = Vec2.clone(e3.localAxisA), new t2(e3);
  }, t2.prototype._reset = function(e3) {
    e3.anchorA ? this.m_localAnchorA.setVec2(this.m_bodyA.getLocalPoint(e3.anchorA)) : e3.localAnchorA && this.m_localAnchorA.setVec2(e3.localAnchorA), e3.anchorB ? this.m_localAnchorB.setVec2(this.m_bodyB.getLocalPoint(e3.anchorB)) : e3.localAnchorB && this.m_localAnchorB.setVec2(e3.localAnchorB), e3.localAxisA && (this.m_localXAxisA.setVec2(e3.localAxisA), this.m_localYAxisA.setVec2(Vec2.crossNumVec2(1, e3.localAxisA))), Number.isFinite(e3.referenceAngle) && (this.m_referenceAngle = e3.referenceAngle), e3.enableLimit !== void 0 && (this.m_enableLimit = !!e3.enableLimit), Number.isFinite(e3.lowerTranslation) && (this.m_lowerTranslation = e3.lowerTranslation), Number.isFinite(e3.upperTranslation) && (this.m_upperTranslation = e3.upperTranslation), e3.enableMotor !== void 0 && (this.m_enableMotor = !!e3.enableMotor), Number.isFinite(e3.maxMotorForce) && (this.m_maxMotorForce = e3.maxMotorForce), Number.isFinite(e3.motorSpeed) && (this.m_motorSpeed = e3.motorSpeed);
  }, t2.prototype.getLocalAnchorA = function() {
    return this.m_localAnchorA;
  }, t2.prototype.getLocalAnchorB = function() {
    return this.m_localAnchorB;
  }, t2.prototype.getLocalAxisA = function() {
    return this.m_localXAxisA;
  }, t2.prototype.getReferenceAngle = function() {
    return this.m_referenceAngle;
  }, t2.prototype.getJointTranslation = function() {
    var e3 = this.m_bodyA.getWorldPoint(this.m_localAnchorA), t3 = this.m_bodyB.getWorldPoint(this.m_localAnchorB), n2 = Vec2.sub(t3, e3), r2 = this.m_bodyA.getWorldVector(this.m_localXAxisA);
    return Vec2.dot(n2, r2);
  }, t2.prototype.getJointSpeed = function() {
    var e3 = this.m_bodyA, t3 = this.m_bodyB, n2 = H.mulVec2(e3.m_xf.q, Vec2.sub(this.m_localAnchorA, e3.m_sweep.localCenter)), r2 = H.mulVec2(t3.m_xf.q, Vec2.sub(this.m_localAnchorB, t3.m_sweep.localCenter)), i2 = Vec2.add(e3.m_sweep.c, n2), a2 = Vec2.add(t3.m_sweep.c, r2), o2 = Vec2.sub(a2, i2), s2 = H.mulVec2(e3.m_xf.q, this.m_localXAxisA), c2 = e3.m_linearVelocity, l2 = t3.m_linearVelocity, u2 = e3.m_angularVelocity, d2 = t3.m_angularVelocity;
    return Vec2.dot(o2, Vec2.crossNumVec2(u2, s2)) + Vec2.dot(s2, Vec2.sub(Vec2.addCrossNumVec2(l2, d2, r2), Vec2.addCrossNumVec2(c2, u2, n2)));
  }, t2.prototype.isLimitEnabled = function() {
    return this.m_enableLimit;
  }, t2.prototype.enableLimit = function(e3) {
    e3 != this.m_enableLimit && (this.m_bodyA.setAwake(true), this.m_bodyB.setAwake(true), this.m_enableLimit = e3, this.m_impulse.z = 0);
  }, t2.prototype.getLowerLimit = function() {
    return this.m_lowerTranslation;
  }, t2.prototype.getUpperLimit = function() {
    return this.m_upperTranslation;
  }, t2.prototype.setLimits = function(e3, t3) {
    (e3 != this.m_lowerTranslation || t3 != this.m_upperTranslation) && (this.m_bodyA.setAwake(true), this.m_bodyB.setAwake(true), this.m_lowerTranslation = e3, this.m_upperTranslation = t3, this.m_impulse.z = 0);
  }, t2.prototype.isMotorEnabled = function() {
    return this.m_enableMotor;
  }, t2.prototype.enableMotor = function(e3) {
    e3 != this.m_enableMotor && (this.m_bodyA.setAwake(true), this.m_bodyB.setAwake(true), this.m_enableMotor = e3);
  }, t2.prototype.setMotorSpeed = function(e3) {
    e3 != this.m_motorSpeed && (this.m_bodyA.setAwake(true), this.m_bodyB.setAwake(true), this.m_motorSpeed = e3);
  }, t2.prototype.setMaxMotorForce = function(e3) {
    e3 != this.m_maxMotorForce && (this.m_bodyA.setAwake(true), this.m_bodyB.setAwake(true), this.m_maxMotorForce = e3);
  }, t2.prototype.getMaxMotorForce = function() {
    return this.m_maxMotorForce;
  }, t2.prototype.getMotorSpeed = function() {
    return this.m_motorSpeed;
  }, t2.prototype.getMotorForce = function(e3) {
    return e3 * this.m_motorImpulse;
  }, t2.prototype.getAnchorA = function() {
    return this.m_bodyA.getWorldPoint(this.m_localAnchorA);
  }, t2.prototype.getAnchorB = function() {
    return this.m_bodyB.getWorldPoint(this.m_localAnchorB);
  }, t2.prototype.getReactionForce = function(e3) {
    return Vec2.combine(this.m_impulse.x, this.m_perp, this.m_motorImpulse + this.m_impulse.z, this.m_axis).mul(e3);
  }, t2.prototype.getReactionTorque = function(e3) {
    return e3 * this.m_impulse.y;
  }, t2.prototype.initVelocityConstraints = function(e3) {
    this.m_localCenterA = this.m_bodyA.m_sweep.localCenter, this.m_localCenterB = this.m_bodyB.m_sweep.localCenter, this.m_invMassA = this.m_bodyA.m_invMass, this.m_invMassB = this.m_bodyB.m_invMass, this.m_invIA = this.m_bodyA.m_invI, this.m_invIB = this.m_bodyB.m_invI;
    var t3 = this.m_bodyA.c_position.c, n2 = this.m_bodyA.c_position.a, r2 = this.m_bodyA.c_velocity.v, i2 = this.m_bodyA.c_velocity.w, a2 = this.m_bodyB.c_position.c, o2 = this.m_bodyB.c_position.a, s2 = this.m_bodyB.c_velocity.v, c2 = this.m_bodyB.c_velocity.w, l2 = H.neo(n2), u2 = H.neo(o2), d2 = H.mulVec2(l2, Vec2.sub(this.m_localAnchorA, this.m_localCenterA)), f2 = H.mulVec2(u2, Vec2.sub(this.m_localAnchorB, this.m_localCenterB)), p2 = Vec2.zero();
    p2.addCombine(1, a2, 1, f2), p2.subCombine(1, t3, 1, d2);
    var m2 = this.m_invMassA, h2 = this.m_invMassB, g2 = this.m_invIA, _2 = this.m_invIB;
    this.m_axis = H.mulVec2(l2, this.m_localXAxisA), this.m_a1 = Vec2.crossVec2Vec2(Vec2.add(p2, d2), this.m_axis), this.m_a2 = Vec2.crossVec2Vec2(f2, this.m_axis), this.m_motorMass = m2 + h2 + g2 * this.m_a1 * this.m_a1 + _2 * this.m_a2 * this.m_a2, this.m_motorMass > 0 && (this.m_motorMass = 1 / this.m_motorMass), this.m_perp = H.mulVec2(l2, this.m_localYAxisA), this.m_s1 = Vec2.crossVec2Vec2(Vec2.add(p2, d2), this.m_perp), this.m_s2 = Vec2.crossVec2Vec2(f2, this.m_perp), Vec2.crossVec2Vec2(d2, this.m_perp);
    var v2 = m2 + h2 + g2 * this.m_s1 * this.m_s1 + _2 * this.m_s2 * this.m_s2, y2 = g2 * this.m_s1 + _2 * this.m_s2, b2 = g2 * this.m_s1 * this.m_a1 + _2 * this.m_s2 * this.m_a2, x2 = g2 + _2;
    x2 == 0 && (x2 = 1);
    var S2 = g2 * this.m_a1 + _2 * this.m_a2, C2 = m2 + h2 + g2 * this.m_a1 * this.m_a1 + _2 * this.m_a2 * this.m_a2;
    if (this.m_K.ex.set(v2, y2, b2), this.m_K.ey.set(y2, x2, S2), this.m_K.ez.set(b2, S2, C2), this.m_enableLimit) {
      var w2 = Vec2.dot(this.m_axis, p2);
      hi(this.m_upperTranslation - this.m_lowerTranslation) < 2 * M.linearSlop ? this.m_limitState = vi.equalLimits : w2 <= this.m_lowerTranslation ? this.m_limitState != vi.atLowerLimit && (this.m_limitState = vi.atLowerLimit, this.m_impulse.z = 0) : w2 >= this.m_upperTranslation ? this.m_limitState != vi.atUpperLimit && (this.m_limitState = vi.atUpperLimit, this.m_impulse.z = 0) : (this.m_limitState = vi.inactiveLimit, this.m_impulse.z = 0);
    } else this.m_limitState = vi.inactiveLimit, this.m_impulse.z = 0;
    if (this.m_enableMotor == 0 && (this.m_motorImpulse = 0), e3.warmStarting) {
      this.m_impulse.mul(e3.dtRatio), this.m_motorImpulse *= e3.dtRatio;
      var T2 = Vec2.combine(this.m_impulse.x, this.m_perp, this.m_motorImpulse + this.m_impulse.z, this.m_axis), E2 = this.m_impulse.x * this.m_s1 + this.m_impulse.y + (this.m_motorImpulse + this.m_impulse.z) * this.m_a1, D2 = this.m_impulse.x * this.m_s2 + this.m_impulse.y + (this.m_motorImpulse + this.m_impulse.z) * this.m_a2;
      r2.subMul(m2, T2), i2 -= g2 * E2, s2.addMul(h2, T2), c2 += _2 * D2;
    } else this.m_impulse.setZero(), this.m_motorImpulse = 0;
    this.m_bodyA.c_velocity.v.setVec2(r2), this.m_bodyA.c_velocity.w = i2, this.m_bodyB.c_velocity.v.setVec2(s2), this.m_bodyB.c_velocity.w = c2;
  }, t2.prototype.solveVelocityConstraints = function(e3) {
    var t3 = this.m_bodyA.c_velocity.v, n2 = this.m_bodyA.c_velocity.w, r2 = this.m_bodyB.c_velocity.v, i2 = this.m_bodyB.c_velocity.w, a2 = this.m_invMassA, o2 = this.m_invMassB, s2 = this.m_invIA, c2 = this.m_invIB;
    if (this.m_enableMotor && this.m_limitState != vi.equalLimits) {
      var l2 = Vec2.dot(this.m_axis, Vec2.sub(r2, t3)) + this.m_a2 * i2 - this.m_a1 * n2, u2 = this.m_motorMass * (this.m_motorSpeed - l2), d2 = this.m_motorImpulse, f2 = e3.dt * this.m_maxMotorForce;
      this.m_motorImpulse = k(this.m_motorImpulse + u2, -f2, f2), u2 = this.m_motorImpulse - d2;
      var p2 = Vec2.mulNumVec2(u2, this.m_axis), m2 = u2 * this.m_a1, h2 = u2 * this.m_a2;
      t3.subMul(a2, p2), n2 -= s2 * m2, r2.addMul(o2, p2), i2 += c2 * h2;
    }
    var g2 = Vec2.zero();
    if (g2.x += Vec2.dot(this.m_perp, r2) + this.m_s2 * i2, g2.x -= Vec2.dot(this.m_perp, t3) + this.m_s1 * n2, g2.y = i2 - n2, this.m_enableLimit && this.m_limitState != vi.inactiveLimit) {
      var _2 = 0;
      _2 += Vec2.dot(this.m_axis, r2) + this.m_a2 * i2, _2 -= Vec2.dot(this.m_axis, t3) + this.m_a1 * n2;
      var l2 = new J(g2.x, g2.y, _2), v2 = J.clone(this.m_impulse), y2 = this.m_K.solve33(J.neg(l2));
      this.m_impulse.add(y2), this.m_limitState == vi.atLowerLimit ? this.m_impulse.z = gi(this.m_impulse.z, 0) : this.m_limitState == vi.atUpperLimit && (this.m_impulse.z = _i(this.m_impulse.z, 0));
      var b2 = Vec2.combine(-1, g2, -(this.m_impulse.z - v2.z), Vec2.neo(this.m_K.ez.x, this.m_K.ez.y)), x2 = Vec2.add(this.m_K.solve22(b2), Vec2.neo(v2.x, v2.y));
      this.m_impulse.x = x2.x, this.m_impulse.y = x2.y, y2 = J.sub(this.m_impulse, v2);
      var p2 = Vec2.combine(y2.x, this.m_perp, y2.z, this.m_axis), m2 = y2.x * this.m_s1 + y2.y + y2.z * this.m_a1, h2 = y2.x * this.m_s2 + y2.y + y2.z * this.m_a2;
      t3.subMul(a2, p2), n2 -= s2 * m2, r2.addMul(o2, p2), i2 += c2 * h2;
    } else {
      var y2 = this.m_K.solve22(Vec2.neg(g2));
      this.m_impulse.x += y2.x, this.m_impulse.y += y2.y;
      var p2 = Vec2.mulNumVec2(y2.x, this.m_perp), m2 = y2.x * this.m_s1 + y2.y, h2 = y2.x * this.m_s2 + y2.y;
      t3.subMul(a2, p2), n2 -= s2 * m2, r2.addMul(o2, p2), i2 += c2 * h2;
    }
    this.m_bodyA.c_velocity.v = t3, this.m_bodyA.c_velocity.w = n2, this.m_bodyB.c_velocity.v = r2, this.m_bodyB.c_velocity.w = i2;
  }, t2.prototype.solvePositionConstraints = function(e3) {
    var t3 = this.m_bodyA.c_position.c, n2 = this.m_bodyA.c_position.a, r2 = this.m_bodyB.c_position.c, i2 = this.m_bodyB.c_position.a, a2 = H.neo(n2), o2 = H.neo(i2), s2 = this.m_invMassA, c2 = this.m_invMassB, l2 = this.m_invIA, u2 = this.m_invIB, d2 = H.mulVec2(a2, Vec2.sub(this.m_localAnchorA, this.m_localCenterA)), f2 = H.mulVec2(o2, Vec2.sub(this.m_localAnchorB, this.m_localCenterB)), p2 = Vec2.sub(Vec2.add(r2, f2), Vec2.add(t3, d2)), m2 = H.mulVec2(a2, this.m_localXAxisA), h2 = Vec2.crossVec2Vec2(Vec2.add(p2, d2), m2), g2 = Vec2.crossVec2Vec2(f2, m2), _2 = H.mulVec2(a2, this.m_localYAxisA), v2 = Vec2.crossVec2Vec2(Vec2.add(p2, d2), _2), y2 = Vec2.crossVec2Vec2(f2, _2), b2 = new J(), x2 = Vec2.zero();
    x2.x = Vec2.dot(_2, p2), x2.y = i2 - n2 - this.m_referenceAngle;
    var S2 = hi(x2.x), C2 = hi(x2.y), w2 = M.linearSlop, T2 = M.maxLinearCorrection, E2 = false, D2 = 0;
    if (this.m_enableLimit) {
      var O2 = Vec2.dot(m2, p2);
      hi(this.m_upperTranslation - this.m_lowerTranslation) < 2 * w2 ? (D2 = k(O2, -T2, T2), S2 = gi(S2, hi(O2)), E2 = true) : O2 <= this.m_lowerTranslation ? (D2 = k(O2 - this.m_lowerTranslation + w2, -T2, 0), S2 = Math.max(S2, this.m_lowerTranslation - O2), E2 = true) : O2 >= this.m_upperTranslation && (D2 = k(O2 - this.m_upperTranslation - w2, 0, T2), S2 = Math.max(S2, O2 - this.m_upperTranslation), E2 = true);
    }
    if (E2) {
      var ee2 = s2 + c2 + l2 * v2 * v2 + u2 * y2 * y2, te2 = l2 * v2 + u2 * y2, ne2 = l2 * v2 * h2 + u2 * y2 * g2, re2 = l2 + u2;
      re2 == 0 && (re2 = 1);
      var ie2 = l2 * h2 + u2 * g2, ae2 = s2 + c2 + l2 * h2 * h2 + u2 * g2 * g2, oe2 = new ui();
      oe2.ex.set(ee2, te2, ne2), oe2.ey.set(te2, re2, ie2), oe2.ez.set(ne2, ie2, ae2);
      var se2 = new J();
      se2.x = x2.x, se2.y = x2.y, se2.z = D2, b2 = oe2.solve33(J.neg(se2));
    } else {
      var ee2 = s2 + c2 + l2 * v2 * v2 + u2 * y2 * y2, te2 = l2 * v2 + u2 * y2, re2 = l2 + u2;
      re2 == 0 && (re2 = 1);
      var oe2 = new Fn();
      oe2.ex.setNum(ee2, te2), oe2.ey.setNum(te2, re2);
      var ce2 = oe2.solve(Vec2.neg(x2));
      b2.x = ce2.x, b2.y = ce2.y, b2.z = 0;
    }
    var le2 = Vec2.combine(b2.x, _2, b2.z, m2), ue2 = b2.x * v2 + b2.y + b2.z * h2, de2 = b2.x * y2 + b2.y + b2.z * g2;
    return t3.subMul(s2, le2), n2 -= l2 * ue2, r2.addMul(c2, le2), i2 += u2 * de2, this.m_bodyA.c_position.c = t3, this.m_bodyA.c_position.a = n2, this.m_bodyB.c_position.c = r2, this.m_bodyB.c_position.a = i2, S2 <= M.linearSlop && C2 <= M.angularSlop;
  }, t2.TYPE = `prismatic-joint`, t2;
}(kt), xi = { ratio: 1 }, Si = function(e2) {
  w(t2, e2);
  function t2(n2, r2, i2, a2, o2, s2) {
    var c2 = this;
    if (!(c2 instanceof t2)) return new t2(n2, r2, i2, a2, o2, s2);
    n2 = E(n2, xi), c2 = e2.call(this, n2, r2, i2) || this, r2 = c2.m_bodyA, i2 = c2.m_bodyB, c2.m_type = t2.TYPE, c2.m_joint1 = a2 || n2.joint1, c2.m_joint2 = o2 || n2.joint2, c2.m_ratio = Number.isFinite(s2) ? s2 : n2.ratio, c2.m_type1 = c2.m_joint1.getType(), c2.m_type2 = c2.m_joint2.getType();
    var l2, u2;
    c2.m_bodyC = c2.m_joint1.getBodyA(), c2.m_bodyA = c2.m_joint1.getBodyB();
    var d2 = c2.m_bodyA.m_xf, f2 = c2.m_bodyA.m_sweep.a, p2 = c2.m_bodyC.m_xf, m2 = c2.m_bodyC.m_sweep.a;
    if (c2.m_type1 === RevoluteJoint.TYPE) {
      var h2 = c2.m_joint1;
      c2.m_localAnchorC = h2.m_localAnchorA, c2.m_localAnchorA = h2.m_localAnchorB, c2.m_referenceAngleA = h2.m_referenceAngle, c2.m_localAxisC = Vec2.zero(), l2 = f2 - m2 - c2.m_referenceAngleA;
    } else {
      var g2 = c2.m_joint1;
      c2.m_localAnchorC = g2.m_localAnchorA, c2.m_localAnchorA = g2.m_localAnchorB, c2.m_referenceAngleA = g2.m_referenceAngle, c2.m_localAxisC = g2.m_localXAxisA;
      var _2 = c2.m_localAnchorC, v2 = H.mulTVec2(p2.q, Vec2.add(H.mulVec2(d2.q, c2.m_localAnchorA), Vec2.sub(d2.p, p2.p)));
      l2 = Vec2.dot(v2, c2.m_localAxisC) - Vec2.dot(_2, c2.m_localAxisC);
    }
    c2.m_bodyD = c2.m_joint2.getBodyA(), c2.m_bodyB = c2.m_joint2.getBodyB();
    var y2 = c2.m_bodyB.m_xf, b2 = c2.m_bodyB.m_sweep.a, x2 = c2.m_bodyD.m_xf, S2 = c2.m_bodyD.m_sweep.a;
    if (c2.m_type2 === RevoluteJoint.TYPE) {
      var h2 = c2.m_joint2;
      c2.m_localAnchorD = h2.m_localAnchorA, c2.m_localAnchorB = h2.m_localAnchorB, c2.m_referenceAngleB = h2.m_referenceAngle, c2.m_localAxisD = Vec2.zero(), u2 = b2 - S2 - c2.m_referenceAngleB;
    } else {
      var g2 = c2.m_joint2;
      c2.m_localAnchorD = g2.m_localAnchorA, c2.m_localAnchorB = g2.m_localAnchorB, c2.m_referenceAngleB = g2.m_referenceAngle, c2.m_localAxisD = g2.m_localXAxisA;
      var C2 = c2.m_localAnchorD, w2 = H.mulTVec2(x2.q, Vec2.add(H.mulVec2(y2.q, c2.m_localAnchorB), Vec2.sub(y2.p, x2.p)));
      u2 = Vec2.dot(w2, c2.m_localAxisD) - Vec2.dot(C2, c2.m_localAxisD);
    }
    return c2.m_constant = l2 + c2.m_ratio * u2, c2.m_impulse = 0, c2;
  }
  return t2.prototype._serialize = function() {
    return { type: this.m_type, bodyA: this.m_bodyA, bodyB: this.m_bodyB, collideConnected: this.m_collideConnected, joint1: this.m_joint1, joint2: this.m_joint2, ratio: this.m_ratio };
  }, t2._deserialize = function(e3, n2, r2) {
    return e3 = T({}, e3), e3.bodyA = r2(U, e3.bodyA, n2), e3.bodyB = r2(U, e3.bodyB, n2), e3.joint1 = r2(kt, e3.joint1, n2), e3.joint2 = r2(kt, e3.joint2, n2), new t2(e3);
  }, t2.prototype._reset = function(e3) {
    Number.isFinite(e3.ratio) && (this.m_ratio = e3.ratio);
  }, t2.prototype.getJoint1 = function() {
    return this.m_joint1;
  }, t2.prototype.getJoint2 = function() {
    return this.m_joint2;
  }, t2.prototype.setRatio = function(e3) {
    this.m_ratio = e3;
  }, t2.prototype.getRatio = function() {
    return this.m_ratio;
  }, t2.prototype.getAnchorA = function() {
    return this.m_bodyA.getWorldPoint(this.m_localAnchorA);
  }, t2.prototype.getAnchorB = function() {
    return this.m_bodyB.getWorldPoint(this.m_localAnchorB);
  }, t2.prototype.getReactionForce = function(e3) {
    return Vec2.mulNumVec2(this.m_impulse, this.m_JvAC).mul(e3);
  }, t2.prototype.getReactionTorque = function(e3) {
    return e3 * (this.m_impulse * this.m_JwA);
  }, t2.prototype.initVelocityConstraints = function(e3) {
    this.m_lcA = this.m_bodyA.m_sweep.localCenter, this.m_lcB = this.m_bodyB.m_sweep.localCenter, this.m_lcC = this.m_bodyC.m_sweep.localCenter, this.m_lcD = this.m_bodyD.m_sweep.localCenter, this.m_mA = this.m_bodyA.m_invMass, this.m_mB = this.m_bodyB.m_invMass, this.m_mC = this.m_bodyC.m_invMass, this.m_mD = this.m_bodyD.m_invMass, this.m_iA = this.m_bodyA.m_invI, this.m_iB = this.m_bodyB.m_invI, this.m_iC = this.m_bodyC.m_invI, this.m_iD = this.m_bodyD.m_invI;
    var t3 = this.m_bodyA.c_position.a, n2 = this.m_bodyA.c_velocity.v, r2 = this.m_bodyA.c_velocity.w, i2 = this.m_bodyB.c_position.a, a2 = this.m_bodyB.c_velocity.v, o2 = this.m_bodyB.c_velocity.w, s2 = this.m_bodyC.c_position.a, c2 = this.m_bodyC.c_velocity.v, l2 = this.m_bodyC.c_velocity.w, u2 = this.m_bodyD.c_position.a, d2 = this.m_bodyD.c_velocity.v, f2 = this.m_bodyD.c_velocity.w, p2 = H.neo(t3), m2 = H.neo(i2), h2 = H.neo(s2), g2 = H.neo(u2);
    if (this.m_mass = 0, this.m_type1 == RevoluteJoint.TYPE) this.m_JvAC = Vec2.zero(), this.m_JwA = 1, this.m_JwC = 1, this.m_mass += this.m_iA + this.m_iC;
    else {
      var _2 = H.mulVec2(h2, this.m_localAxisC), v2 = H.mulSub(h2, this.m_localAnchorC, this.m_lcC), y2 = H.mulSub(p2, this.m_localAnchorA, this.m_lcA);
      this.m_JvAC = _2, this.m_JwC = Vec2.crossVec2Vec2(v2, _2), this.m_JwA = Vec2.crossVec2Vec2(y2, _2), this.m_mass += this.m_mC + this.m_mA + this.m_iC * this.m_JwC * this.m_JwC + this.m_iA * this.m_JwA * this.m_JwA;
    }
    if (this.m_type2 == RevoluteJoint.TYPE) this.m_JvBD = Vec2.zero(), this.m_JwB = this.m_ratio, this.m_JwD = this.m_ratio, this.m_mass += this.m_ratio * this.m_ratio * (this.m_iB + this.m_iD);
    else {
      var _2 = H.mulVec2(g2, this.m_localAxisD), b2 = H.mulSub(g2, this.m_localAnchorD, this.m_lcD), x2 = H.mulSub(m2, this.m_localAnchorB, this.m_lcB);
      this.m_JvBD = Vec2.mulNumVec2(this.m_ratio, _2), this.m_JwD = this.m_ratio * Vec2.crossVec2Vec2(b2, _2), this.m_JwB = this.m_ratio * Vec2.crossVec2Vec2(x2, _2), this.m_mass += this.m_ratio * this.m_ratio * (this.m_mD + this.m_mB) + this.m_iD * this.m_JwD * this.m_JwD + this.m_iB * this.m_JwB * this.m_JwB;
    }
    this.m_mass = this.m_mass > 0 ? 1 / this.m_mass : 0, e3.warmStarting ? (n2.addMul(this.m_mA * this.m_impulse, this.m_JvAC), r2 += this.m_iA * this.m_impulse * this.m_JwA, a2.addMul(this.m_mB * this.m_impulse, this.m_JvBD), o2 += this.m_iB * this.m_impulse * this.m_JwB, c2.subMul(this.m_mC * this.m_impulse, this.m_JvAC), l2 -= this.m_iC * this.m_impulse * this.m_JwC, d2.subMul(this.m_mD * this.m_impulse, this.m_JvBD), f2 -= this.m_iD * this.m_impulse * this.m_JwD) : this.m_impulse = 0, this.m_bodyA.c_velocity.v.setVec2(n2), this.m_bodyA.c_velocity.w = r2, this.m_bodyB.c_velocity.v.setVec2(a2), this.m_bodyB.c_velocity.w = o2, this.m_bodyC.c_velocity.v.setVec2(c2), this.m_bodyC.c_velocity.w = l2, this.m_bodyD.c_velocity.v.setVec2(d2), this.m_bodyD.c_velocity.w = f2;
  }, t2.prototype.solveVelocityConstraints = function(e3) {
    var t3 = this.m_bodyA.c_velocity.v, n2 = this.m_bodyA.c_velocity.w, r2 = this.m_bodyB.c_velocity.v, i2 = this.m_bodyB.c_velocity.w, a2 = this.m_bodyC.c_velocity.v, o2 = this.m_bodyC.c_velocity.w, s2 = this.m_bodyD.c_velocity.v, c2 = this.m_bodyD.c_velocity.w, l2 = Vec2.dot(this.m_JvAC, t3) - Vec2.dot(this.m_JvAC, a2) + Vec2.dot(this.m_JvBD, r2) - Vec2.dot(this.m_JvBD, s2);
    l2 += this.m_JwA * n2 - this.m_JwC * o2 + (this.m_JwB * i2 - this.m_JwD * c2);
    var u2 = -this.m_mass * l2;
    this.m_impulse += u2, t3.addMul(this.m_mA * u2, this.m_JvAC), n2 += this.m_iA * u2 * this.m_JwA, r2.addMul(this.m_mB * u2, this.m_JvBD), i2 += this.m_iB * u2 * this.m_JwB, a2.subMul(this.m_mC * u2, this.m_JvAC), o2 -= this.m_iC * u2 * this.m_JwC, s2.subMul(this.m_mD * u2, this.m_JvBD), c2 -= this.m_iD * u2 * this.m_JwD, this.m_bodyA.c_velocity.v.setVec2(t3), this.m_bodyA.c_velocity.w = n2, this.m_bodyB.c_velocity.v.setVec2(r2), this.m_bodyB.c_velocity.w = i2, this.m_bodyC.c_velocity.v.setVec2(a2), this.m_bodyC.c_velocity.w = o2, this.m_bodyD.c_velocity.v.setVec2(s2), this.m_bodyD.c_velocity.w = c2;
  }, t2.prototype.solvePositionConstraints = function(e3) {
    var t3 = this.m_bodyA.c_position.c, n2 = this.m_bodyA.c_position.a, r2 = this.m_bodyB.c_position.c, i2 = this.m_bodyB.c_position.a, a2 = this.m_bodyC.c_position.c, o2 = this.m_bodyC.c_position.a, s2 = this.m_bodyD.c_position.c, c2 = this.m_bodyD.c_position.a, l2 = H.neo(n2), u2 = H.neo(i2), d2 = H.neo(o2), f2 = H.neo(c2), p2 = 0, m2, h2, g2, _2, v2, y2, b2, x2, S2 = 0;
    if (this.m_type1 == RevoluteJoint.TYPE) g2 = Vec2.zero(), v2 = 1, b2 = 1, S2 += this.m_iA + this.m_iC, m2 = n2 - o2 - this.m_referenceAngleA;
    else {
      var C2 = H.mulVec2(d2, this.m_localAxisC), w2 = H.mulSub(d2, this.m_localAnchorC, this.m_lcC), T2 = H.mulSub(l2, this.m_localAnchorA, this.m_lcA);
      g2 = C2, b2 = Vec2.crossVec2Vec2(w2, C2), v2 = Vec2.crossVec2Vec2(T2, C2), S2 += this.m_mC + this.m_mA + this.m_iC * b2 * b2 + this.m_iA * v2 * v2;
      var E2 = Vec2.sub(this.m_localAnchorC, this.m_lcC), D2 = H.mulTVec2(d2, Vec2.add(T2, Vec2.sub(t3, a2)));
      m2 = Vec2.dot(Vec2.sub(D2, E2), this.m_localAxisC);
    }
    if (this.m_type2 == RevoluteJoint.TYPE) _2 = Vec2.zero(), y2 = this.m_ratio, x2 = this.m_ratio, S2 += this.m_ratio * this.m_ratio * (this.m_iB + this.m_iD), h2 = i2 - c2 - this.m_referenceAngleB;
    else {
      var C2 = H.mulVec2(f2, this.m_localAxisD), O2 = H.mulSub(f2, this.m_localAnchorD, this.m_lcD), ee2 = H.mulSub(u2, this.m_localAnchorB, this.m_lcB);
      _2 = Vec2.mulNumVec2(this.m_ratio, C2), x2 = this.m_ratio * Vec2.crossVec2Vec2(O2, C2), y2 = this.m_ratio * Vec2.crossVec2Vec2(ee2, C2), S2 += this.m_ratio * this.m_ratio * (this.m_mD + this.m_mB) + this.m_iD * x2 * x2 + this.m_iB * y2 * y2;
      var te2 = Vec2.sub(this.m_localAnchorD, this.m_lcD), ne2 = H.mulTVec2(f2, Vec2.add(ee2, Vec2.sub(r2, s2)));
      h2 = Vec2.dot(ne2, this.m_localAxisD) - Vec2.dot(te2, this.m_localAxisD);
    }
    var re2 = m2 + this.m_ratio * h2 - this.m_constant, k2 = 0;
    return S2 > 0 && (k2 = -re2 / S2), t3.addMul(this.m_mA * k2, g2), n2 += this.m_iA * k2 * v2, r2.addMul(this.m_mB * k2, _2), i2 += this.m_iB * k2 * y2, a2.subMul(this.m_mC * k2, g2), o2 -= this.m_iC * k2 * b2, s2.subMul(this.m_mD * k2, _2), c2 -= this.m_iD * k2 * x2, this.m_bodyA.c_position.c.setVec2(t3), this.m_bodyA.c_position.a = n2, this.m_bodyB.c_position.c.setVec2(r2), this.m_bodyB.c_position.a = i2, this.m_bodyC.c_position.c.setVec2(a2), this.m_bodyC.c_position.a = o2, this.m_bodyD.c_position.c.setVec2(s2), this.m_bodyD.c_position.a = c2, p2 < M.linearSlop;
  }, t2.TYPE = `gear-joint`, t2;
}(kt), Ci = { maxForce: 1, maxTorque: 1, correctionFactor: 0.3 }, wi = function(e2) {
  w(t2, e2);
  function t2(n2, r2, i2) {
    var a2 = this;
    return a2 instanceof t2 ? (n2 = E(n2, Ci), a2 = e2.call(this, n2, r2, i2) || this, r2 = a2.m_bodyA, i2 = a2.m_bodyB, a2.m_type = t2.TYPE, a2.m_linearOffset = Vec2.isValid(n2.linearOffset) ? Vec2.clone(n2.linearOffset) : r2.getLocalPoint(i2.getPosition()), a2.m_angularOffset = Number.isFinite(n2.angularOffset) ? n2.angularOffset : i2.getAngle() - r2.getAngle(), a2.m_linearImpulse = Vec2.zero(), a2.m_angularImpulse = 0, a2.m_maxForce = n2.maxForce, a2.m_maxTorque = n2.maxTorque, a2.m_correctionFactor = n2.correctionFactor, a2) : new t2(n2, r2, i2);
  }
  return t2.prototype._serialize = function() {
    return { type: this.m_type, bodyA: this.m_bodyA, bodyB: this.m_bodyB, collideConnected: this.m_collideConnected, maxForce: this.m_maxForce, maxTorque: this.m_maxTorque, correctionFactor: this.m_correctionFactor, linearOffset: this.m_linearOffset, angularOffset: this.m_angularOffset };
  }, t2._deserialize = function(e3, n2, r2) {
    return e3 = T({}, e3), e3.bodyA = r2(U, e3.bodyA, n2), e3.bodyB = r2(U, e3.bodyB, n2), new t2(e3);
  }, t2.prototype._reset = function(e3) {
    Number.isFinite(e3.angularOffset) && (this.m_angularOffset = e3.angularOffset), Number.isFinite(e3.maxForce) && (this.m_maxForce = e3.maxForce), Number.isFinite(e3.maxTorque) && (this.m_maxTorque = e3.maxTorque), Number.isFinite(e3.correctionFactor) && (this.m_correctionFactor = e3.correctionFactor), Vec2.isValid(e3.linearOffset) && this.m_linearOffset.set(e3.linearOffset);
  }, t2.prototype.setMaxForce = function(e3) {
    this.m_maxForce = e3;
  }, t2.prototype.getMaxForce = function() {
    return this.m_maxForce;
  }, t2.prototype.setMaxTorque = function(e3) {
    this.m_maxTorque = e3;
  }, t2.prototype.getMaxTorque = function() {
    return this.m_maxTorque;
  }, t2.prototype.setCorrectionFactor = function(e3) {
    this.m_correctionFactor = e3;
  }, t2.prototype.getCorrectionFactor = function() {
    return this.m_correctionFactor;
  }, t2.prototype.setLinearOffset = function(e3) {
    (e3.x != this.m_linearOffset.x || e3.y != this.m_linearOffset.y) && (this.m_bodyA.setAwake(true), this.m_bodyB.setAwake(true), this.m_linearOffset.set(e3));
  }, t2.prototype.getLinearOffset = function() {
    return this.m_linearOffset;
  }, t2.prototype.setAngularOffset = function(e3) {
    e3 != this.m_angularOffset && (this.m_bodyA.setAwake(true), this.m_bodyB.setAwake(true), this.m_angularOffset = e3);
  }, t2.prototype.getAngularOffset = function() {
    return this.m_angularOffset;
  }, t2.prototype.getAnchorA = function() {
    return this.m_bodyA.getPosition();
  }, t2.prototype.getAnchorB = function() {
    return this.m_bodyB.getPosition();
  }, t2.prototype.getReactionForce = function(e3) {
    return Vec2.mulNumVec2(e3, this.m_linearImpulse);
  }, t2.prototype.getReactionTorque = function(e3) {
    return e3 * this.m_angularImpulse;
  }, t2.prototype.initVelocityConstraints = function(e3) {
    this.m_localCenterA = this.m_bodyA.m_sweep.localCenter, this.m_localCenterB = this.m_bodyB.m_sweep.localCenter, this.m_invMassA = this.m_bodyA.m_invMass, this.m_invMassB = this.m_bodyB.m_invMass, this.m_invIA = this.m_bodyA.m_invI, this.m_invIB = this.m_bodyB.m_invI;
    var t3 = this.m_bodyA.c_position.c, n2 = this.m_bodyA.c_position.a, r2 = this.m_bodyA.c_velocity.v, i2 = this.m_bodyA.c_velocity.w, a2 = this.m_bodyB.c_position.c, o2 = this.m_bodyB.c_position.a, s2 = this.m_bodyB.c_velocity.v, c2 = this.m_bodyB.c_velocity.w, l2 = H.neo(n2), u2 = H.neo(o2);
    this.m_rA = H.mulVec2(l2, Vec2.sub(this.m_linearOffset, this.m_localCenterA)), this.m_rB = H.mulVec2(u2, Vec2.neg(this.m_localCenterB));
    var d2 = this.m_invMassA, f2 = this.m_invMassB, p2 = this.m_invIA, m2 = this.m_invIB, h2 = new Fn();
    if (h2.ex.x = d2 + f2 + p2 * this.m_rA.y * this.m_rA.y + m2 * this.m_rB.y * this.m_rB.y, h2.ex.y = -p2 * this.m_rA.x * this.m_rA.y - m2 * this.m_rB.x * this.m_rB.y, h2.ey.x = h2.ex.y, h2.ey.y = d2 + f2 + p2 * this.m_rA.x * this.m_rA.x + m2 * this.m_rB.x * this.m_rB.x, this.m_linearMass = h2.getInverse(), this.m_angularMass = p2 + m2, this.m_angularMass > 0 && (this.m_angularMass = 1 / this.m_angularMass), this.m_linearError = Vec2.zero(), this.m_linearError.addCombine(1, a2, 1, this.m_rB), this.m_linearError.subCombine(1, t3, 1, this.m_rA), this.m_angularError = o2 - n2 - this.m_angularOffset, e3.warmStarting) {
      this.m_linearImpulse.mul(e3.dtRatio), this.m_angularImpulse *= e3.dtRatio;
      var g2 = Vec2.neo(this.m_linearImpulse.x, this.m_linearImpulse.y);
      r2.subMul(d2, g2), i2 -= p2 * (Vec2.crossVec2Vec2(this.m_rA, g2) + this.m_angularImpulse), s2.addMul(f2, g2), c2 += m2 * (Vec2.crossVec2Vec2(this.m_rB, g2) + this.m_angularImpulse);
    } else this.m_linearImpulse.setZero(), this.m_angularImpulse = 0;
    this.m_bodyA.c_velocity.v = r2, this.m_bodyA.c_velocity.w = i2, this.m_bodyB.c_velocity.v = s2, this.m_bodyB.c_velocity.w = c2;
  }, t2.prototype.solveVelocityConstraints = function(e3) {
    var t3 = this.m_bodyA.c_velocity.v, n2 = this.m_bodyA.c_velocity.w, r2 = this.m_bodyB.c_velocity.v, i2 = this.m_bodyB.c_velocity.w, a2 = this.m_invMassA, o2 = this.m_invMassB, s2 = this.m_invIA, c2 = this.m_invIB, l2 = e3.dt, u2 = e3.inv_dt, d2 = i2 - n2 + u2 * this.m_correctionFactor * this.m_angularError, f2 = -this.m_angularMass * d2, p2 = this.m_angularImpulse, m2 = l2 * this.m_maxTorque;
    this.m_angularImpulse = k(this.m_angularImpulse + f2, -m2, m2), f2 = this.m_angularImpulse - p2, n2 -= s2 * f2, i2 += c2 * f2;
    var d2 = Vec2.zero();
    d2.addCombine(1, r2, 1, Vec2.crossNumVec2(i2, this.m_rB)), d2.subCombine(1, t3, 1, Vec2.crossNumVec2(n2, this.m_rA)), d2.addMul(u2 * this.m_correctionFactor, this.m_linearError);
    var f2 = Vec2.neg(Fn.mulVec2(this.m_linearMass, d2)), p2 = Vec2.clone(this.m_linearImpulse);
    this.m_linearImpulse.add(f2);
    var m2 = l2 * this.m_maxForce;
    this.m_linearImpulse.clamp(m2), f2 = Vec2.sub(this.m_linearImpulse, p2), t3.subMul(a2, f2), n2 -= s2 * Vec2.crossVec2Vec2(this.m_rA, f2), r2.addMul(o2, f2), i2 += c2 * Vec2.crossVec2Vec2(this.m_rB, f2), this.m_bodyA.c_velocity.v = t3, this.m_bodyA.c_velocity.w = n2, this.m_bodyB.c_velocity.v = r2, this.m_bodyB.c_velocity.w = i2;
  }, t2.prototype.solvePositionConstraints = function(e3) {
    return true;
  }, t2.TYPE = `motor-joint`, t2;
}(kt), Ti = Math.PI, Ei = { maxForce: 0, frequencyHz: 5, dampingRatio: 0.7 }, Di = function(e2) {
  w(t2, e2);
  function t2(n2, r2, i2, a2) {
    var o2 = this;
    return o2 instanceof t2 ? (n2 = E(n2, Ei), o2 = e2.call(this, n2, r2, i2) || this, r2 = o2.m_bodyA, i2 = o2.m_bodyB, o2.m_type = t2.TYPE, Vec2.isValid(a2) ? o2.m_targetA = Vec2.clone(a2) : Vec2.isValid(n2.target) ? o2.m_targetA = Vec2.clone(n2.target) : o2.m_targetA = Vec2.zero(), o2.m_localAnchorB = ot.mulTVec2(i2.getTransform(), o2.m_targetA), o2.m_maxForce = n2.maxForce, o2.m_impulse = Vec2.zero(), o2.m_frequencyHz = n2.frequencyHz, o2.m_dampingRatio = n2.dampingRatio, o2.m_beta = 0, o2.m_gamma = 0, o2.m_rB = Vec2.zero(), o2.m_localCenterB = Vec2.zero(), o2.m_invMassB = 0, o2.m_invIB = 0, o2.m_mass = new Fn(), o2.m_C = Vec2.zero(), o2) : new t2(n2, r2, i2, a2);
  }
  return t2.prototype._serialize = function() {
    return { type: this.m_type, bodyA: this.m_bodyA, bodyB: this.m_bodyB, collideConnected: this.m_collideConnected, target: this.m_targetA, maxForce: this.m_maxForce, frequencyHz: this.m_frequencyHz, dampingRatio: this.m_dampingRatio, _localAnchorB: this.m_localAnchorB };
  }, t2._deserialize = function(e3, n2, r2) {
    e3 = T({}, e3), e3.bodyA = r2(U, e3.bodyA, n2), e3.bodyB = r2(U, e3.bodyB, n2), e3.target = Vec2.clone(e3.target);
    var i2 = new t2(e3);
    return e3._localAnchorB && (i2.m_localAnchorB = e3._localAnchorB), i2;
  }, t2.prototype._reset = function(e3) {
    Number.isFinite(e3.maxForce) && (this.m_maxForce = e3.maxForce), Number.isFinite(e3.frequencyHz) && (this.m_frequencyHz = e3.frequencyHz), Number.isFinite(e3.dampingRatio) && (this.m_dampingRatio = e3.dampingRatio);
  }, t2.prototype.setTarget = function(e3) {
    Vec2.areEqual(e3, this.m_targetA) || (this.m_bodyB.setAwake(true), this.m_targetA.set(e3));
  }, t2.prototype.getTarget = function() {
    return this.m_targetA;
  }, t2.prototype.setMaxForce = function(e3) {
    this.m_maxForce = e3;
  }, t2.prototype.getMaxForce = function() {
    return this.m_maxForce;
  }, t2.prototype.setFrequency = function(e3) {
    this.m_frequencyHz = e3;
  }, t2.prototype.getFrequency = function() {
    return this.m_frequencyHz;
  }, t2.prototype.setDampingRatio = function(e3) {
    this.m_dampingRatio = e3;
  }, t2.prototype.getDampingRatio = function() {
    return this.m_dampingRatio;
  }, t2.prototype.getAnchorA = function() {
    return Vec2.clone(this.m_targetA);
  }, t2.prototype.getAnchorB = function() {
    return this.m_bodyB.getWorldPoint(this.m_localAnchorB);
  }, t2.prototype.getReactionForce = function(e3) {
    return Vec2.mulNumVec2(e3, this.m_impulse);
  }, t2.prototype.getReactionTorque = function(e3) {
    return e3 * 0;
  }, t2.prototype.shiftOrigin = function(e3) {
    this.m_targetA.sub(e3);
  }, t2.prototype.initVelocityConstraints = function(e3) {
    this.m_localCenterB = this.m_bodyB.m_sweep.localCenter, this.m_invMassB = this.m_bodyB.m_invMass, this.m_invIB = this.m_bodyB.m_invI;
    var t3 = this.m_bodyB.c_position, n2 = this.m_bodyB.c_velocity, r2 = t3.c, i2 = t3.a, a2 = n2.v, o2 = n2.w, s2 = H.neo(i2), c2 = this.m_bodyB.getMass(), l2 = 2 * Ti * this.m_frequencyHz, u2 = 2 * c2 * this.m_dampingRatio * l2, d2 = l2 * l2 * c2, f2 = e3.dt;
    this.m_gamma = f2 * (u2 + f2 * d2), this.m_gamma != 0 && (this.m_gamma = 1 / this.m_gamma), this.m_beta = f2 * d2 * this.m_gamma, this.m_rB = H.mulVec2(s2, Vec2.sub(this.m_localAnchorB, this.m_localCenterB));
    var p2 = new Fn();
    p2.ex.x = this.m_invMassB + this.m_invIB * this.m_rB.y * this.m_rB.y + this.m_gamma, p2.ex.y = -this.m_invIB * this.m_rB.x * this.m_rB.y, p2.ey.x = p2.ex.y, p2.ey.y = this.m_invMassB + this.m_invIB * this.m_rB.x * this.m_rB.x + this.m_gamma, this.m_mass = p2.getInverse(), this.m_C.setVec2(r2), this.m_C.addCombine(1, this.m_rB, -1, this.m_targetA), this.m_C.mul(this.m_beta), o2 *= 0.98, e3.warmStarting ? (this.m_impulse.mul(e3.dtRatio), a2.addMul(this.m_invMassB, this.m_impulse), o2 += this.m_invIB * Vec2.crossVec2Vec2(this.m_rB, this.m_impulse)) : this.m_impulse.setZero(), n2.v.setVec2(a2), n2.w = o2;
  }, t2.prototype.solveVelocityConstraints = function(e3) {
    var t3 = this.m_bodyB.c_velocity, n2 = Vec2.clone(t3.v), r2 = t3.w, i2 = Vec2.crossNumVec2(r2, this.m_rB);
    i2.add(n2), i2.addCombine(1, this.m_C, this.m_gamma, this.m_impulse), i2.neg();
    var a2 = Fn.mulVec2(this.m_mass, i2), o2 = Vec2.clone(this.m_impulse);
    this.m_impulse.add(a2);
    var s2 = e3.dt * this.m_maxForce;
    this.m_impulse.clamp(s2), a2 = Vec2.sub(this.m_impulse, o2), n2.addMul(this.m_invMassB, a2), r2 += this.m_invIB * Vec2.crossVec2Vec2(this.m_rB, a2), t3.v.setVec2(n2), t3.w = r2;
  }, t2.prototype.solvePositionConstraints = function(e3) {
    return true;
  }, t2.TYPE = `mouse-joint`, t2;
}(kt), Oi = Math.abs, ki = { collideConnected: true }, Ai = function(e2) {
  w(t2, e2);
  function t2(n2, r2, i2, a2, o2, s2, c2, l2) {
    var u2 = this;
    return u2 instanceof t2 ? (n2 = E(n2, ki), u2 = e2.call(this, n2, r2, i2) || this, r2 = u2.m_bodyA, i2 = u2.m_bodyB, u2.m_type = t2.TYPE, u2.m_groundAnchorA = Vec2.clone(a2 || n2.groundAnchorA || Vec2.neo(-1, 1)), u2.m_groundAnchorB = Vec2.clone(o2 || n2.groundAnchorB || Vec2.neo(1, 1)), u2.m_localAnchorA = Vec2.clone(s2 ? r2.getLocalPoint(s2) : n2.localAnchorA || Vec2.neo(-1, 0)), u2.m_localAnchorB = Vec2.clone(c2 ? i2.getLocalPoint(c2) : n2.localAnchorB || Vec2.neo(1, 0)), u2.m_lengthA = Number.isFinite(n2.lengthA) ? n2.lengthA : Vec2.distance(s2, a2), u2.m_lengthB = Number.isFinite(n2.lengthB) ? n2.lengthB : Vec2.distance(c2, o2), u2.m_ratio = Number.isFinite(l2) ? l2 : n2.ratio, u2.m_constant = u2.m_lengthA + u2.m_ratio * u2.m_lengthB, u2.m_impulse = 0, u2) : new t2(n2, r2, i2, a2, o2, s2, c2, l2);
  }
  return t2.prototype._serialize = function() {
    return { type: this.m_type, bodyA: this.m_bodyA, bodyB: this.m_bodyB, collideConnected: this.m_collideConnected, groundAnchorA: this.m_groundAnchorA, groundAnchorB: this.m_groundAnchorB, localAnchorA: this.m_localAnchorA, localAnchorB: this.m_localAnchorB, lengthA: this.m_lengthA, lengthB: this.m_lengthB, ratio: this.m_ratio };
  }, t2._deserialize = function(e3, n2, r2) {
    return e3 = T({}, e3), e3.bodyA = r2(U, e3.bodyA, n2), e3.bodyB = r2(U, e3.bodyB, n2), new t2(e3);
  }, t2.prototype._reset = function(e3) {
    Vec2.isValid(e3.groundAnchorA) && this.m_groundAnchorA.set(e3.groundAnchorA), Vec2.isValid(e3.groundAnchorB) && this.m_groundAnchorB.set(e3.groundAnchorB), Vec2.isValid(e3.localAnchorA) ? this.m_localAnchorA.set(e3.localAnchorA) : Vec2.isValid(e3.anchorA) && this.m_localAnchorA.set(this.m_bodyA.getLocalPoint(e3.anchorA)), Vec2.isValid(e3.localAnchorB) ? this.m_localAnchorB.set(e3.localAnchorB) : Vec2.isValid(e3.anchorB) && this.m_localAnchorB.set(this.m_bodyB.getLocalPoint(e3.anchorB)), Number.isFinite(e3.lengthA) && (this.m_lengthA = e3.lengthA), Number.isFinite(e3.lengthB) && (this.m_lengthB = e3.lengthB), Number.isFinite(e3.ratio) && (this.m_ratio = e3.ratio);
  }, t2.prototype.getGroundAnchorA = function() {
    return this.m_groundAnchorA;
  }, t2.prototype.getGroundAnchorB = function() {
    return this.m_groundAnchorB;
  }, t2.prototype.getLengthA = function() {
    return this.m_lengthA;
  }, t2.prototype.getLengthB = function() {
    return this.m_lengthB;
  }, t2.prototype.getRatio = function() {
    return this.m_ratio;
  }, t2.prototype.getCurrentLengthA = function() {
    var e3 = this.m_bodyA.getWorldPoint(this.m_localAnchorA), t3 = this.m_groundAnchorA;
    return Vec2.distance(e3, t3);
  }, t2.prototype.getCurrentLengthB = function() {
    var e3 = this.m_bodyB.getWorldPoint(this.m_localAnchorB), t3 = this.m_groundAnchorB;
    return Vec2.distance(e3, t3);
  }, t2.prototype.shiftOrigin = function(e3) {
    this.m_groundAnchorA.sub(e3), this.m_groundAnchorB.sub(e3);
  }, t2.prototype.getAnchorA = function() {
    return this.m_bodyA.getWorldPoint(this.m_localAnchorA);
  }, t2.prototype.getAnchorB = function() {
    return this.m_bodyB.getWorldPoint(this.m_localAnchorB);
  }, t2.prototype.getReactionForce = function(e3) {
    return Vec2.mulNumVec2(this.m_impulse, this.m_uB).mul(e3);
  }, t2.prototype.getReactionTorque = function(e3) {
    return 0;
  }, t2.prototype.initVelocityConstraints = function(e3) {
    this.m_localCenterA = this.m_bodyA.m_sweep.localCenter, this.m_localCenterB = this.m_bodyB.m_sweep.localCenter, this.m_invMassA = this.m_bodyA.m_invMass, this.m_invMassB = this.m_bodyB.m_invMass, this.m_invIA = this.m_bodyA.m_invI, this.m_invIB = this.m_bodyB.m_invI;
    var t3 = this.m_bodyA.c_position.c, n2 = this.m_bodyA.c_position.a, r2 = this.m_bodyA.c_velocity.v, i2 = this.m_bodyA.c_velocity.w, a2 = this.m_bodyB.c_position.c, o2 = this.m_bodyB.c_position.a, s2 = this.m_bodyB.c_velocity.v, c2 = this.m_bodyB.c_velocity.w, l2 = H.neo(n2), u2 = H.neo(o2);
    this.m_rA = H.mulVec2(l2, Vec2.sub(this.m_localAnchorA, this.m_localCenterA)), this.m_rB = H.mulVec2(u2, Vec2.sub(this.m_localAnchorB, this.m_localCenterB)), this.m_uA = Vec2.sub(Vec2.add(t3, this.m_rA), this.m_groundAnchorA), this.m_uB = Vec2.sub(Vec2.add(a2, this.m_rB), this.m_groundAnchorB);
    var d2 = this.m_uA.length(), f2 = this.m_uB.length();
    d2 > 10 * M.linearSlop ? this.m_uA.mul(1 / d2) : this.m_uA.setZero(), f2 > 10 * M.linearSlop ? this.m_uB.mul(1 / f2) : this.m_uB.setZero();
    var p2 = Vec2.crossVec2Vec2(this.m_rA, this.m_uA), m2 = Vec2.crossVec2Vec2(this.m_rB, this.m_uB), h2 = this.m_invMassA + this.m_invIA * p2 * p2, g2 = this.m_invMassB + this.m_invIB * m2 * m2;
    if (this.m_mass = h2 + this.m_ratio * this.m_ratio * g2, this.m_mass > 0 && (this.m_mass = 1 / this.m_mass), e3.warmStarting) {
      this.m_impulse *= e3.dtRatio;
      var _2 = Vec2.mulNumVec2(-this.m_impulse, this.m_uA), v2 = Vec2.mulNumVec2(-this.m_ratio * this.m_impulse, this.m_uB);
      r2.addMul(this.m_invMassA, _2), i2 += this.m_invIA * Vec2.crossVec2Vec2(this.m_rA, _2), s2.addMul(this.m_invMassB, v2), c2 += this.m_invIB * Vec2.crossVec2Vec2(this.m_rB, v2);
    } else this.m_impulse = 0;
    this.m_bodyA.c_velocity.v = r2, this.m_bodyA.c_velocity.w = i2, this.m_bodyB.c_velocity.v = s2, this.m_bodyB.c_velocity.w = c2;
  }, t2.prototype.solveVelocityConstraints = function(e3) {
    var t3 = this.m_bodyA.c_velocity.v, n2 = this.m_bodyA.c_velocity.w, r2 = this.m_bodyB.c_velocity.v, i2 = this.m_bodyB.c_velocity.w, a2 = Vec2.add(t3, Vec2.crossNumVec2(n2, this.m_rA)), o2 = Vec2.add(r2, Vec2.crossNumVec2(i2, this.m_rB)), s2 = -Vec2.dot(this.m_uA, a2) - this.m_ratio * Vec2.dot(this.m_uB, o2), c2 = -this.m_mass * s2;
    this.m_impulse += c2;
    var l2 = Vec2.mulNumVec2(-c2, this.m_uA), u2 = Vec2.mulNumVec2(-this.m_ratio * c2, this.m_uB);
    t3.addMul(this.m_invMassA, l2), n2 += this.m_invIA * Vec2.crossVec2Vec2(this.m_rA, l2), r2.addMul(this.m_invMassB, u2), i2 += this.m_invIB * Vec2.crossVec2Vec2(this.m_rB, u2), this.m_bodyA.c_velocity.v = t3, this.m_bodyA.c_velocity.w = n2, this.m_bodyB.c_velocity.v = r2, this.m_bodyB.c_velocity.w = i2;
  }, t2.prototype.solvePositionConstraints = function(e3) {
    var t3 = this.m_bodyA.c_position.c, n2 = this.m_bodyA.c_position.a, r2 = this.m_bodyB.c_position.c, i2 = this.m_bodyB.c_position.a, a2 = H.neo(n2), o2 = H.neo(i2), s2 = H.mulVec2(a2, Vec2.sub(this.m_localAnchorA, this.m_localCenterA)), c2 = H.mulVec2(o2, Vec2.sub(this.m_localAnchorB, this.m_localCenterB)), l2 = Vec2.sub(Vec2.add(t3, this.m_rA), this.m_groundAnchorA), u2 = Vec2.sub(Vec2.add(r2, this.m_rB), this.m_groundAnchorB), d2 = l2.length(), f2 = u2.length();
    d2 > 10 * M.linearSlop ? l2.mul(1 / d2) : l2.setZero(), f2 > 10 * M.linearSlop ? u2.mul(1 / f2) : u2.setZero();
    var p2 = Vec2.crossVec2Vec2(s2, l2), m2 = Vec2.crossVec2Vec2(c2, u2), h2 = this.m_invMassA + this.m_invIA * p2 * p2, g2 = this.m_invMassB + this.m_invIB * m2 * m2, _2 = h2 + this.m_ratio * this.m_ratio * g2;
    _2 > 0 && (_2 = 1 / _2);
    var v2 = this.m_constant - d2 - this.m_ratio * f2, y2 = Oi(v2), b2 = -_2 * v2, x2 = Vec2.mulNumVec2(-b2, l2), S2 = Vec2.mulNumVec2(-this.m_ratio * b2, u2);
    return t3.addMul(this.m_invMassA, x2), n2 += this.m_invIA * Vec2.crossVec2Vec2(s2, x2), r2.addMul(this.m_invMassB, S2), i2 += this.m_invIB * Vec2.crossVec2Vec2(c2, S2), this.m_bodyA.c_position.c = t3, this.m_bodyA.c_position.a = n2, this.m_bodyB.c_position.c = r2, this.m_bodyB.c_position.a = i2, y2 < M.linearSlop;
  }, t2.TYPE = `pulley-joint`, t2;
}(kt), ji = Math.min, Mi;
(function(e2) {
  e2[e2.inactiveLimit = 0] = `inactiveLimit`, e2[e2.atLowerLimit = 1] = `atLowerLimit`, e2[e2.atUpperLimit = 2] = `atUpperLimit`, e2[e2.equalLimits = 3] = `equalLimits`;
})(Mi ||= {});
var Ni = { maxLength: 0 }, Pi = function(e2) {
  w(t2, e2);
  function t2(n2, r2, i2, a2) {
    var o2 = this;
    return o2 instanceof t2 ? (n2 = E(n2, Ni), o2 = e2.call(this, n2, r2, i2) || this, r2 = o2.m_bodyA, i2 = o2.m_bodyB, o2.m_type = t2.TYPE, o2.m_localAnchorA = Vec2.clone(a2 ? r2.getLocalPoint(a2) : n2.localAnchorA || Vec2.neo(-1, 0)), o2.m_localAnchorB = Vec2.clone(a2 ? i2.getLocalPoint(a2) : n2.localAnchorB || Vec2.neo(1, 0)), o2.m_maxLength = n2.maxLength, o2.m_mass = 0, o2.m_impulse = 0, o2.m_length = 0, o2.m_state = Mi.inactiveLimit, o2) : new t2(n2, r2, i2, a2);
  }
  return t2.prototype._serialize = function() {
    return { type: this.m_type, bodyA: this.m_bodyA, bodyB: this.m_bodyB, collideConnected: this.m_collideConnected, localAnchorA: this.m_localAnchorA, localAnchorB: this.m_localAnchorB, maxLength: this.m_maxLength };
  }, t2._deserialize = function(e3, n2, r2) {
    return e3 = T({}, e3), e3.bodyA = r2(U, e3.bodyA, n2), e3.bodyB = r2(U, e3.bodyB, n2), new t2(e3);
  }, t2.prototype._reset = function(e3) {
    Number.isFinite(e3.maxLength) && (this.m_maxLength = e3.maxLength);
  }, t2.prototype.getLocalAnchorA = function() {
    return this.m_localAnchorA;
  }, t2.prototype.getLocalAnchorB = function() {
    return this.m_localAnchorB;
  }, t2.prototype.setMaxLength = function(e3) {
    this.m_maxLength = e3;
  }, t2.prototype.getMaxLength = function() {
    return this.m_maxLength;
  }, t2.prototype.getLimitState = function() {
    return this.m_state;
  }, t2.prototype.getAnchorA = function() {
    return this.m_bodyA.getWorldPoint(this.m_localAnchorA);
  }, t2.prototype.getAnchorB = function() {
    return this.m_bodyB.getWorldPoint(this.m_localAnchorB);
  }, t2.prototype.getReactionForce = function(e3) {
    return Vec2.mulNumVec2(this.m_impulse, this.m_u).mul(e3);
  }, t2.prototype.getReactionTorque = function(e3) {
    return 0;
  }, t2.prototype.initVelocityConstraints = function(e3) {
    this.m_localCenterA = this.m_bodyA.m_sweep.localCenter, this.m_localCenterB = this.m_bodyB.m_sweep.localCenter, this.m_invMassA = this.m_bodyA.m_invMass, this.m_invMassB = this.m_bodyB.m_invMass, this.m_invIA = this.m_bodyA.m_invI, this.m_invIB = this.m_bodyB.m_invI;
    var t3 = this.m_bodyA.c_position.c, n2 = this.m_bodyA.c_position.a, r2 = this.m_bodyA.c_velocity.v, i2 = this.m_bodyA.c_velocity.w, a2 = this.m_bodyB.c_position.c, o2 = this.m_bodyB.c_position.a, s2 = this.m_bodyB.c_velocity.v, c2 = this.m_bodyB.c_velocity.w, l2 = H.neo(n2), u2 = H.neo(o2);
    if (this.m_rA = H.mulSub(l2, this.m_localAnchorA, this.m_localCenterA), this.m_rB = H.mulSub(u2, this.m_localAnchorB, this.m_localCenterB), this.m_u = Vec2.zero(), this.m_u.addCombine(1, a2, 1, this.m_rB), this.m_u.subCombine(1, t3, 1, this.m_rA), this.m_length = this.m_u.length(), this.m_state = this.m_length - this.m_maxLength > 0 ? Mi.atUpperLimit : Mi.inactiveLimit, this.m_length > M.linearSlop) this.m_u.mul(1 / this.m_length);
    else {
      this.m_u.setZero(), this.m_mass = 0, this.m_impulse = 0;
      return;
    }
    var d2 = Vec2.crossVec2Vec2(this.m_rA, this.m_u), f2 = Vec2.crossVec2Vec2(this.m_rB, this.m_u), p2 = this.m_invMassA + this.m_invIA * d2 * d2 + this.m_invMassB + this.m_invIB * f2 * f2;
    if (this.m_mass = p2 == 0 ? 0 : 1 / p2, e3.warmStarting) {
      this.m_impulse *= e3.dtRatio;
      var m2 = Vec2.mulNumVec2(this.m_impulse, this.m_u);
      r2.subMul(this.m_invMassA, m2), i2 -= this.m_invIA * Vec2.crossVec2Vec2(this.m_rA, m2), s2.addMul(this.m_invMassB, m2), c2 += this.m_invIB * Vec2.crossVec2Vec2(this.m_rB, m2);
    } else this.m_impulse = 0;
    this.m_bodyA.c_velocity.v.setVec2(r2), this.m_bodyA.c_velocity.w = i2, this.m_bodyB.c_velocity.v.setVec2(s2), this.m_bodyB.c_velocity.w = c2;
  }, t2.prototype.solveVelocityConstraints = function(e3) {
    var t3 = this.m_bodyA.c_velocity.v, n2 = this.m_bodyA.c_velocity.w, r2 = this.m_bodyB.c_velocity.v, i2 = this.m_bodyB.c_velocity.w, a2 = Vec2.addCrossNumVec2(t3, n2, this.m_rA), o2 = Vec2.addCrossNumVec2(r2, i2, this.m_rB), s2 = this.m_length - this.m_maxLength, c2 = Vec2.dot(this.m_u, Vec2.sub(o2, a2));
    s2 < 0 && (c2 += e3.inv_dt * s2);
    var l2 = -this.m_mass * c2, u2 = this.m_impulse;
    this.m_impulse = ji(0, this.m_impulse + l2), l2 = this.m_impulse - u2;
    var d2 = Vec2.mulNumVec2(l2, this.m_u);
    t3.subMul(this.m_invMassA, d2), n2 -= this.m_invIA * Vec2.crossVec2Vec2(this.m_rA, d2), r2.addMul(this.m_invMassB, d2), i2 += this.m_invIB * Vec2.crossVec2Vec2(this.m_rB, d2), this.m_bodyA.c_velocity.v = t3, this.m_bodyA.c_velocity.w = n2, this.m_bodyB.c_velocity.v = r2, this.m_bodyB.c_velocity.w = i2;
  }, t2.prototype.solvePositionConstraints = function(e3) {
    var t3 = this.m_bodyA.c_position.c, n2 = this.m_bodyA.c_position.a, r2 = this.m_bodyB.c_position.c, i2 = this.m_bodyB.c_position.a, a2 = H.neo(n2), o2 = H.neo(i2), s2 = H.mulSub(a2, this.m_localAnchorA, this.m_localCenterA), c2 = H.mulSub(o2, this.m_localAnchorB, this.m_localCenterB), l2 = Vec2.zero();
    l2.addCombine(1, r2, 1, c2), l2.subCombine(1, t3, 1, s2);
    var u2 = l2.normalize(), d2 = u2 - this.m_maxLength;
    d2 = k(d2, 0, M.maxLinearCorrection);
    var f2 = -this.m_mass * d2, p2 = Vec2.mulNumVec2(f2, l2);
    return t3.subMul(this.m_invMassA, p2), n2 -= this.m_invIA * Vec2.crossVec2Vec2(s2, p2), r2.addMul(this.m_invMassB, p2), i2 += this.m_invIB * Vec2.crossVec2Vec2(c2, p2), this.m_bodyA.c_position.c.setVec2(t3), this.m_bodyA.c_position.a = n2, this.m_bodyB.c_position.c.setVec2(r2), this.m_bodyB.c_position.a = i2, u2 - this.m_maxLength < M.linearSlop;
  }, t2.TYPE = `rope-joint`, t2;
}(kt), Fi = Math.abs, Ii = Math.PI, Li = { frequencyHz: 0, dampingRatio: 0 }, Ri = function(e2) {
  w(t2, e2);
  function t2(n2, r2, i2, a2) {
    var o2 = this;
    return o2 instanceof t2 ? (n2 = E(n2, Li), o2 = e2.call(this, n2, r2, i2) || this, r2 = o2.m_bodyA, i2 = o2.m_bodyB, o2.m_type = t2.TYPE, o2.m_localAnchorA = Vec2.clone(a2 ? r2.getLocalPoint(a2) : n2.localAnchorA || Vec2.zero()), o2.m_localAnchorB = Vec2.clone(a2 ? i2.getLocalPoint(a2) : n2.localAnchorB || Vec2.zero()), o2.m_referenceAngle = Number.isFinite(n2.referenceAngle) ? n2.referenceAngle : i2.getAngle() - r2.getAngle(), o2.m_frequencyHz = n2.frequencyHz, o2.m_dampingRatio = n2.dampingRatio, o2.m_impulse = new J(), o2.m_bias = 0, o2.m_gamma = 0, o2.m_mass = new ui(), o2) : new t2(n2, r2, i2, a2);
  }
  return t2.prototype._serialize = function() {
    return { type: this.m_type, bodyA: this.m_bodyA, bodyB: this.m_bodyB, collideConnected: this.m_collideConnected, frequencyHz: this.m_frequencyHz, dampingRatio: this.m_dampingRatio, localAnchorA: this.m_localAnchorA, localAnchorB: this.m_localAnchorB, referenceAngle: this.m_referenceAngle };
  }, t2._deserialize = function(e3, n2, r2) {
    return e3 = T({}, e3), e3.bodyA = r2(U, e3.bodyA, n2), e3.bodyB = r2(U, e3.bodyB, n2), new t2(e3);
  }, t2.prototype._reset = function(e3) {
    e3.anchorA ? this.m_localAnchorA.setVec2(this.m_bodyA.getLocalPoint(e3.anchorA)) : e3.localAnchorA && this.m_localAnchorA.setVec2(e3.localAnchorA), e3.anchorB ? this.m_localAnchorB.setVec2(this.m_bodyB.getLocalPoint(e3.anchorB)) : e3.localAnchorB && this.m_localAnchorB.setVec2(e3.localAnchorB), Number.isFinite(e3.frequencyHz) && (this.m_frequencyHz = e3.frequencyHz), Number.isFinite(e3.dampingRatio) && (this.m_dampingRatio = e3.dampingRatio);
  }, t2.prototype.getLocalAnchorA = function() {
    return this.m_localAnchorA;
  }, t2.prototype.getLocalAnchorB = function() {
    return this.m_localAnchorB;
  }, t2.prototype.getReferenceAngle = function() {
    return this.m_referenceAngle;
  }, t2.prototype.setFrequency = function(e3) {
    this.m_frequencyHz = e3;
  }, t2.prototype.getFrequency = function() {
    return this.m_frequencyHz;
  }, t2.prototype.setDampingRatio = function(e3) {
    this.m_dampingRatio = e3;
  }, t2.prototype.getDampingRatio = function() {
    return this.m_dampingRatio;
  }, t2.prototype.getAnchorA = function() {
    return this.m_bodyA.getWorldPoint(this.m_localAnchorA);
  }, t2.prototype.getAnchorB = function() {
    return this.m_bodyB.getWorldPoint(this.m_localAnchorB);
  }, t2.prototype.getReactionForce = function(e3) {
    return Vec2.neo(this.m_impulse.x, this.m_impulse.y).mul(e3);
  }, t2.prototype.getReactionTorque = function(e3) {
    return e3 * this.m_impulse.z;
  }, t2.prototype.initVelocityConstraints = function(e3) {
    this.m_localCenterA = this.m_bodyA.m_sweep.localCenter, this.m_localCenterB = this.m_bodyB.m_sweep.localCenter, this.m_invMassA = this.m_bodyA.m_invMass, this.m_invMassB = this.m_bodyB.m_invMass, this.m_invIA = this.m_bodyA.m_invI, this.m_invIB = this.m_bodyB.m_invI;
    var t3 = this.m_bodyA.c_position.a, n2 = this.m_bodyA.c_velocity.v, r2 = this.m_bodyA.c_velocity.w, i2 = this.m_bodyB.c_position.a, a2 = this.m_bodyB.c_velocity.v, o2 = this.m_bodyB.c_velocity.w, s2 = H.neo(t3), c2 = H.neo(i2);
    this.m_rA = H.mulVec2(s2, Vec2.sub(this.m_localAnchorA, this.m_localCenterA)), this.m_rB = H.mulVec2(c2, Vec2.sub(this.m_localAnchorB, this.m_localCenterB));
    var l2 = this.m_invMassA, u2 = this.m_invMassB, d2 = this.m_invIA, f2 = this.m_invIB, p2 = new ui();
    if (p2.ex.x = l2 + u2 + this.m_rA.y * this.m_rA.y * d2 + this.m_rB.y * this.m_rB.y * f2, p2.ey.x = -this.m_rA.y * this.m_rA.x * d2 - this.m_rB.y * this.m_rB.x * f2, p2.ez.x = -this.m_rA.y * d2 - this.m_rB.y * f2, p2.ex.y = p2.ey.x, p2.ey.y = l2 + u2 + this.m_rA.x * this.m_rA.x * d2 + this.m_rB.x * this.m_rB.x * f2, p2.ez.y = this.m_rA.x * d2 + this.m_rB.x * f2, p2.ex.z = p2.ez.x, p2.ey.z = p2.ez.y, p2.ez.z = d2 + f2, this.m_frequencyHz > 0) {
      p2.getInverse22(this.m_mass);
      var m2 = d2 + f2, h2 = m2 > 0 ? 1 / m2 : 0, g2 = i2 - t3 - this.m_referenceAngle, _2 = 2 * Ii * this.m_frequencyHz, v2 = 2 * h2 * this.m_dampingRatio * _2, y2 = h2 * _2 * _2, b2 = e3.dt;
      this.m_gamma = b2 * (v2 + b2 * y2), this.m_gamma = this.m_gamma == 0 ? 0 : 1 / this.m_gamma, this.m_bias = g2 * b2 * y2 * this.m_gamma, m2 += this.m_gamma, this.m_mass.ez.z = m2 == 0 ? 0 : 1 / m2;
    } else p2.ez.z == 0 ? (p2.getInverse22(this.m_mass), this.m_gamma = 0, this.m_bias = 0) : (p2.getSymInverse33(this.m_mass), this.m_gamma = 0, this.m_bias = 0);
    if (e3.warmStarting) {
      this.m_impulse.mul(e3.dtRatio);
      var x2 = Vec2.neo(this.m_impulse.x, this.m_impulse.y);
      n2.subMul(l2, x2), r2 -= d2 * (Vec2.crossVec2Vec2(this.m_rA, x2) + this.m_impulse.z), a2.addMul(u2, x2), o2 += f2 * (Vec2.crossVec2Vec2(this.m_rB, x2) + this.m_impulse.z);
    } else this.m_impulse.setZero();
    this.m_bodyA.c_velocity.v = n2, this.m_bodyA.c_velocity.w = r2, this.m_bodyB.c_velocity.v = a2, this.m_bodyB.c_velocity.w = o2;
  }, t2.prototype.solveVelocityConstraints = function(e3) {
    var t3 = this.m_bodyA.c_velocity.v, n2 = this.m_bodyA.c_velocity.w, r2 = this.m_bodyB.c_velocity.v, i2 = this.m_bodyB.c_velocity.w, a2 = this.m_invMassA, o2 = this.m_invMassB, s2 = this.m_invIA, c2 = this.m_invIB;
    if (this.m_frequencyHz > 0) {
      var l2 = i2 - n2, u2 = -this.m_mass.ez.z * (l2 + this.m_bias + this.m_gamma * this.m_impulse.z);
      this.m_impulse.z += u2, n2 -= s2 * u2, i2 += c2 * u2;
      var d2 = Vec2.zero();
      d2.addCombine(1, r2, 1, Vec2.crossNumVec2(i2, this.m_rB)), d2.subCombine(1, t3, 1, Vec2.crossNumVec2(n2, this.m_rA));
      var f2 = Vec2.neg(ui.mulVec2(this.m_mass, d2));
      this.m_impulse.x += f2.x, this.m_impulse.y += f2.y;
      var p2 = Vec2.clone(f2);
      t3.subMul(a2, p2), n2 -= s2 * Vec2.crossVec2Vec2(this.m_rA, p2), r2.addMul(o2, p2), i2 += c2 * Vec2.crossVec2Vec2(this.m_rB, p2);
    } else {
      var d2 = Vec2.zero();
      d2.addCombine(1, r2, 1, Vec2.crossNumVec2(i2, this.m_rB)), d2.subCombine(1, t3, 1, Vec2.crossNumVec2(n2, this.m_rA));
      var l2 = i2 - n2, m2 = new J(d2.x, d2.y, l2), h2 = J.neg(ui.mulVec3(this.m_mass, m2));
      this.m_impulse.add(h2);
      var p2 = Vec2.neo(h2.x, h2.y);
      t3.subMul(a2, p2), n2 -= s2 * (Vec2.crossVec2Vec2(this.m_rA, p2) + h2.z), r2.addMul(o2, p2), i2 += c2 * (Vec2.crossVec2Vec2(this.m_rB, p2) + h2.z);
    }
    this.m_bodyA.c_velocity.v = t3, this.m_bodyA.c_velocity.w = n2, this.m_bodyB.c_velocity.v = r2, this.m_bodyB.c_velocity.w = i2;
  }, t2.prototype.solvePositionConstraints = function(e3) {
    var t3 = this.m_bodyA.c_position.c, n2 = this.m_bodyA.c_position.a, r2 = this.m_bodyB.c_position.c, i2 = this.m_bodyB.c_position.a, a2 = H.neo(n2), o2 = H.neo(i2), s2 = this.m_invMassA, c2 = this.m_invMassB, l2 = this.m_invIA, u2 = this.m_invIB, d2 = H.mulVec2(a2, Vec2.sub(this.m_localAnchorA, this.m_localCenterA)), f2 = H.mulVec2(o2, Vec2.sub(this.m_localAnchorB, this.m_localCenterB)), p2, m2, h2 = new ui();
    if (h2.ex.x = s2 + c2 + d2.y * d2.y * l2 + f2.y * f2.y * u2, h2.ey.x = -d2.y * d2.x * l2 - f2.y * f2.x * u2, h2.ez.x = -d2.y * l2 - f2.y * u2, h2.ex.y = h2.ey.x, h2.ey.y = s2 + c2 + d2.x * d2.x * l2 + f2.x * f2.x * u2, h2.ez.y = d2.x * l2 + f2.x * u2, h2.ex.z = h2.ez.x, h2.ey.z = h2.ez.y, h2.ez.z = l2 + u2, this.m_frequencyHz > 0) {
      var g2 = Vec2.zero();
      g2.addCombine(1, r2, 1, f2), g2.subCombine(1, t3, 1, d2), p2 = g2.length(), m2 = 0;
      var _2 = Vec2.neg(h2.solve22(g2));
      t3.subMul(s2, _2), n2 -= l2 * Vec2.crossVec2Vec2(d2, _2), r2.addMul(c2, _2), i2 += u2 * Vec2.crossVec2Vec2(f2, _2);
    } else {
      var g2 = Vec2.zero();
      g2.addCombine(1, r2, 1, f2), g2.subCombine(1, t3, 1, d2);
      var v2 = i2 - n2 - this.m_referenceAngle;
      p2 = g2.length(), m2 = Fi(v2);
      var y2 = new J(g2.x, g2.y, v2), b2 = new J();
      if (h2.ez.z > 0) b2 = J.neg(h2.solve33(y2));
      else {
        var x2 = Vec2.neg(h2.solve22(g2));
        b2.set(x2.x, x2.y, 0);
      }
      var _2 = Vec2.neo(b2.x, b2.y);
      t3.subMul(s2, _2), n2 -= l2 * (Vec2.crossVec2Vec2(d2, _2) + b2.z), r2.addMul(c2, _2), i2 += u2 * (Vec2.crossVec2Vec2(f2, _2) + b2.z);
    }
    return this.m_bodyA.c_position.c = t3, this.m_bodyA.c_position.a = n2, this.m_bodyB.c_position.c = r2, this.m_bodyB.c_position.a = i2, p2 <= M.linearSlop && m2 <= M.angularSlop;
  }, t2.TYPE = `weld-joint`, t2;
}(kt), zi = Math.abs, Bi = Math.PI, Vi = { enableMotor: false, maxMotorTorque: 0, motorSpeed: 0, frequencyHz: 2, dampingRatio: 0.7 }, Hi = function(e2) {
  w(t2, e2);
  function t2(n2, r2, i2, a2, o2) {
    var s2 = this;
    return s2 instanceof t2 ? (n2 = E(n2, Vi), s2 = e2.call(this, n2, r2, i2) || this, r2 = s2.m_bodyA, i2 = s2.m_bodyB, s2.m_ax = Vec2.zero(), s2.m_ay = Vec2.zero(), s2.m_type = t2.TYPE, s2.m_localAnchorA = Vec2.clone(a2 ? r2.getLocalPoint(a2) : n2.localAnchorA || Vec2.zero()), s2.m_localAnchorB = Vec2.clone(a2 ? i2.getLocalPoint(a2) : n2.localAnchorB || Vec2.zero()), Vec2.isValid(o2) ? s2.m_localXAxisA = r2.getLocalVector(o2) : Vec2.isValid(n2.localAxisA) ? s2.m_localXAxisA = Vec2.clone(n2.localAxisA) : Vec2.isValid(n2.localAxis) ? s2.m_localXAxisA = Vec2.clone(n2.localAxis) : s2.m_localXAxisA = Vec2.neo(1, 0), s2.m_localYAxisA = Vec2.crossNumVec2(1, s2.m_localXAxisA), s2.m_mass = 0, s2.m_impulse = 0, s2.m_motorMass = 0, s2.m_motorImpulse = 0, s2.m_springMass = 0, s2.m_springImpulse = 0, s2.m_maxMotorTorque = n2.maxMotorTorque, s2.m_motorSpeed = n2.motorSpeed, s2.m_enableMotor = n2.enableMotor, s2.m_frequencyHz = n2.frequencyHz, s2.m_dampingRatio = n2.dampingRatio, s2.m_bias = 0, s2.m_gamma = 0, s2) : new t2(n2, r2, i2, a2, o2);
  }
  return t2.prototype._serialize = function() {
    return { type: this.m_type, bodyA: this.m_bodyA, bodyB: this.m_bodyB, collideConnected: this.m_collideConnected, enableMotor: this.m_enableMotor, maxMotorTorque: this.m_maxMotorTorque, motorSpeed: this.m_motorSpeed, frequencyHz: this.m_frequencyHz, dampingRatio: this.m_dampingRatio, localAnchorA: this.m_localAnchorA, localAnchorB: this.m_localAnchorB, localAxisA: this.m_localXAxisA };
  }, t2._deserialize = function(e3, n2, r2) {
    return e3 = T({}, e3), e3.bodyA = r2(U, e3.bodyA, n2), e3.bodyB = r2(U, e3.bodyB, n2), new t2(e3);
  }, t2.prototype._reset = function(e3) {
    e3.anchorA ? this.m_localAnchorA.setVec2(this.m_bodyA.getLocalPoint(e3.anchorA)) : e3.localAnchorA && this.m_localAnchorA.setVec2(e3.localAnchorA), e3.anchorB ? this.m_localAnchorB.setVec2(this.m_bodyB.getLocalPoint(e3.anchorB)) : e3.localAnchorB && this.m_localAnchorB.setVec2(e3.localAnchorB), e3.localAxisA && (this.m_localXAxisA.setVec2(e3.localAxisA), this.m_localYAxisA.setVec2(Vec2.crossNumVec2(1, e3.localAxisA))), e3.enableMotor !== void 0 && (this.m_enableMotor = e3.enableMotor), Number.isFinite(e3.maxMotorTorque) && (this.m_maxMotorTorque = e3.maxMotorTorque), Number.isFinite(e3.motorSpeed) && (this.m_motorSpeed = e3.motorSpeed), Number.isFinite(e3.frequencyHz) && (this.m_frequencyHz = e3.frequencyHz), Number.isFinite(e3.dampingRatio) && (this.m_dampingRatio = e3.dampingRatio);
  }, t2.prototype.getLocalAnchorA = function() {
    return this.m_localAnchorA;
  }, t2.prototype.getLocalAnchorB = function() {
    return this.m_localAnchorB;
  }, t2.prototype.getLocalAxisA = function() {
    return this.m_localXAxisA;
  }, t2.prototype.getJointTranslation = function() {
    var e3 = this.m_bodyA, t3 = this.m_bodyB, n2 = e3.getWorldPoint(this.m_localAnchorA), r2 = t3.getWorldPoint(this.m_localAnchorB), i2 = Vec2.sub(r2, n2), a2 = e3.getWorldVector(this.m_localXAxisA);
    return Vec2.dot(i2, a2);
  }, t2.prototype.getJointSpeed = function() {
    var e3 = this.m_bodyA.m_angularVelocity;
    return this.m_bodyB.m_angularVelocity - e3;
  }, t2.prototype.isMotorEnabled = function() {
    return this.m_enableMotor;
  }, t2.prototype.enableMotor = function(e3) {
    e3 != this.m_enableMotor && (this.m_bodyA.setAwake(true), this.m_bodyB.setAwake(true), this.m_enableMotor = e3);
  }, t2.prototype.setMotorSpeed = function(e3) {
    e3 != this.m_motorSpeed && (this.m_bodyA.setAwake(true), this.m_bodyB.setAwake(true), this.m_motorSpeed = e3);
  }, t2.prototype.getMotorSpeed = function() {
    return this.m_motorSpeed;
  }, t2.prototype.setMaxMotorTorque = function(e3) {
    e3 != this.m_maxMotorTorque && (this.m_bodyA.setAwake(true), this.m_bodyB.setAwake(true), this.m_maxMotorTorque = e3);
  }, t2.prototype.getMaxMotorTorque = function() {
    return this.m_maxMotorTorque;
  }, t2.prototype.getMotorTorque = function(e3) {
    return e3 * this.m_motorImpulse;
  }, t2.prototype.setSpringFrequencyHz = function(e3) {
    this.m_frequencyHz = e3;
  }, t2.prototype.getSpringFrequencyHz = function() {
    return this.m_frequencyHz;
  }, t2.prototype.setSpringDampingRatio = function(e3) {
    this.m_dampingRatio = e3;
  }, t2.prototype.getSpringDampingRatio = function() {
    return this.m_dampingRatio;
  }, t2.prototype.getAnchorA = function() {
    return this.m_bodyA.getWorldPoint(this.m_localAnchorA);
  }, t2.prototype.getAnchorB = function() {
    return this.m_bodyB.getWorldPoint(this.m_localAnchorB);
  }, t2.prototype.getReactionForce = function(e3) {
    return Vec2.combine(this.m_impulse, this.m_ay, this.m_springImpulse, this.m_ax).mul(e3);
  }, t2.prototype.getReactionTorque = function(e3) {
    return e3 * this.m_motorImpulse;
  }, t2.prototype.initVelocityConstraints = function(e3) {
    this.m_localCenterA = this.m_bodyA.m_sweep.localCenter, this.m_localCenterB = this.m_bodyB.m_sweep.localCenter, this.m_invMassA = this.m_bodyA.m_invMass, this.m_invMassB = this.m_bodyB.m_invMass, this.m_invIA = this.m_bodyA.m_invI, this.m_invIB = this.m_bodyB.m_invI;
    var t3 = this.m_invMassA, n2 = this.m_invMassB, r2 = this.m_invIA, i2 = this.m_invIB, a2 = this.m_bodyA.c_position.c, o2 = this.m_bodyA.c_position.a, s2 = this.m_bodyA.c_velocity.v, c2 = this.m_bodyA.c_velocity.w, l2 = this.m_bodyB.c_position.c, u2 = this.m_bodyB.c_position.a, d2 = this.m_bodyB.c_velocity.v, f2 = this.m_bodyB.c_velocity.w, p2 = H.neo(o2), m2 = H.neo(u2), h2 = H.mulVec2(p2, Vec2.sub(this.m_localAnchorA, this.m_localCenterA)), g2 = H.mulVec2(m2, Vec2.sub(this.m_localAnchorB, this.m_localCenterB)), _2 = Vec2.zero();
    if (_2.addCombine(1, l2, 1, g2), _2.subCombine(1, a2, 1, h2), this.m_ay = H.mulVec2(p2, this.m_localYAxisA), this.m_sAy = Vec2.crossVec2Vec2(Vec2.add(_2, h2), this.m_ay), this.m_sBy = Vec2.crossVec2Vec2(g2, this.m_ay), this.m_mass = t3 + n2 + r2 * this.m_sAy * this.m_sAy + i2 * this.m_sBy * this.m_sBy, this.m_mass > 0 && (this.m_mass = 1 / this.m_mass), this.m_springMass = 0, this.m_bias = 0, this.m_gamma = 0, this.m_frequencyHz > 0) {
      this.m_ax = H.mulVec2(p2, this.m_localXAxisA), this.m_sAx = Vec2.crossVec2Vec2(Vec2.add(_2, h2), this.m_ax), this.m_sBx = Vec2.crossVec2Vec2(g2, this.m_ax);
      var v2 = t3 + n2 + r2 * this.m_sAx * this.m_sAx + i2 * this.m_sBx * this.m_sBx;
      if (v2 > 0) {
        this.m_springMass = 1 / v2;
        var y2 = Vec2.dot(_2, this.m_ax), b2 = 2 * Bi * this.m_frequencyHz, x2 = 2 * this.m_springMass * this.m_dampingRatio * b2, S2 = this.m_springMass * b2 * b2, C2 = e3.dt;
        this.m_gamma = C2 * (x2 + C2 * S2), this.m_gamma > 0 && (this.m_gamma = 1 / this.m_gamma), this.m_bias = y2 * C2 * S2 * this.m_gamma, this.m_springMass = v2 + this.m_gamma, this.m_springMass > 0 && (this.m_springMass = 1 / this.m_springMass);
      }
    } else this.m_springImpulse = 0;
    if (this.m_enableMotor ? (this.m_motorMass = r2 + i2, this.m_motorMass > 0 && (this.m_motorMass = 1 / this.m_motorMass)) : (this.m_motorMass = 0, this.m_motorImpulse = 0), e3.warmStarting) {
      this.m_impulse *= e3.dtRatio, this.m_springImpulse *= e3.dtRatio, this.m_motorImpulse *= e3.dtRatio;
      var w2 = Vec2.combine(this.m_impulse, this.m_ay, this.m_springImpulse, this.m_ax), T2 = this.m_impulse * this.m_sAy + this.m_springImpulse * this.m_sAx + this.m_motorImpulse, E2 = this.m_impulse * this.m_sBy + this.m_springImpulse * this.m_sBx + this.m_motorImpulse;
      s2.subMul(this.m_invMassA, w2), c2 -= this.m_invIA * T2, d2.addMul(this.m_invMassB, w2), f2 += this.m_invIB * E2;
    } else this.m_impulse = 0, this.m_springImpulse = 0, this.m_motorImpulse = 0;
    this.m_bodyA.c_velocity.v.setVec2(s2), this.m_bodyA.c_velocity.w = c2, this.m_bodyB.c_velocity.v.setVec2(d2), this.m_bodyB.c_velocity.w = f2;
  }, t2.prototype.solveVelocityConstraints = function(e3) {
    var t3 = this.m_invMassA, n2 = this.m_invMassB, r2 = this.m_invIA, i2 = this.m_invIB, a2 = this.m_bodyA.c_velocity.v, o2 = this.m_bodyA.c_velocity.w, s2 = this.m_bodyB.c_velocity.v, c2 = this.m_bodyB.c_velocity.w, l2 = Vec2.dot(this.m_ax, s2) - Vec2.dot(this.m_ax, a2) + this.m_sBx * c2 - this.m_sAx * o2, u2 = -this.m_springMass * (l2 + this.m_bias + this.m_gamma * this.m_springImpulse);
    this.m_springImpulse += u2;
    var d2 = Vec2.mulNumVec2(u2, this.m_ax), f2 = u2 * this.m_sAx, p2 = u2 * this.m_sBx;
    a2.subMul(t3, d2), o2 -= r2 * f2, s2.addMul(n2, d2), c2 += i2 * p2;
    var l2 = c2 - o2 - this.m_motorSpeed, u2 = -this.m_motorMass * l2, m2 = this.m_motorImpulse, h2 = e3.dt * this.m_maxMotorTorque;
    this.m_motorImpulse = k(this.m_motorImpulse + u2, -h2, h2), u2 = this.m_motorImpulse - m2, o2 -= r2 * u2, c2 += i2 * u2;
    var l2 = Vec2.dot(this.m_ay, s2) - Vec2.dot(this.m_ay, a2) + this.m_sBy * c2 - this.m_sAy * o2, u2 = -this.m_mass * l2;
    this.m_impulse += u2;
    var d2 = Vec2.mulNumVec2(u2, this.m_ay), f2 = u2 * this.m_sAy, p2 = u2 * this.m_sBy;
    a2.subMul(t3, d2), o2 -= r2 * f2, s2.addMul(n2, d2), c2 += i2 * p2, this.m_bodyA.c_velocity.v.setVec2(a2), this.m_bodyA.c_velocity.w = o2, this.m_bodyB.c_velocity.v.setVec2(s2), this.m_bodyB.c_velocity.w = c2;
  }, t2.prototype.solvePositionConstraints = function(e3) {
    var t3 = this.m_bodyA.c_position.c, n2 = this.m_bodyA.c_position.a, r2 = this.m_bodyB.c_position.c, i2 = this.m_bodyB.c_position.a, a2 = H.neo(n2), o2 = H.neo(i2), s2 = H.mulVec2(a2, Vec2.sub(this.m_localAnchorA, this.m_localCenterA)), c2 = H.mulVec2(o2, Vec2.sub(this.m_localAnchorB, this.m_localCenterB)), l2 = Vec2.zero();
    l2.addCombine(1, r2, 1, c2), l2.subCombine(1, t3, 1, s2);
    var u2 = H.mulVec2(a2, this.m_localYAxisA), d2 = Vec2.crossVec2Vec2(Vec2.add(l2, s2), u2), f2 = Vec2.crossVec2Vec2(c2, u2), p2 = Vec2.dot(l2, u2), m2 = this.m_invMassA + this.m_invMassB + this.m_invIA * this.m_sAy * this.m_sAy + this.m_invIB * this.m_sBy * this.m_sBy, h2 = m2 == 0 ? 0 : -p2 / m2, g2 = Vec2.mulNumVec2(h2, u2), _2 = h2 * d2, v2 = h2 * f2;
    return t3.subMul(this.m_invMassA, g2), n2 -= this.m_invIA * _2, r2.addMul(this.m_invMassB, g2), i2 += this.m_invIB * v2, this.m_bodyA.c_position.c.setVec2(t3), this.m_bodyA.c_position.a = n2, this.m_bodyB.c_position.c.setVec2(r2), this.m_bodyB.c_position.a = i2, zi(p2) <= M.linearSlop;
  }, t2.TYPE = `wheel-joint`, t2;
}(kt), Ui, Wi = 0, Gi = { World: World, Body: U, Joint: kt, Fixture: vt, Shape: ft }, Ki = { Vec2: Vec2, Vec3: J, World: World, Body: U, Joint: kt, Fixture: vt, Shape: ft }, qi = (Ui = {}, Ui[U.STATIC] = U, Ui[U.DYNAMIC] = U, Ui[U.KINEMATIC] = U, Ui[Ur.TYPE] = Ur, Ui[Qr.TYPE] = Qr, Ui[Br.TYPE] = Br, Ui[CircleShape.TYPE] = CircleShape, Ui[si.TYPE] = si, Ui[li.TYPE] = li, Ui[Si.TYPE] = Si, Ui[wi.TYPE] = wi, Ui[Di.TYPE] = Di, Ui[bi.TYPE] = bi, Ui[Ai.TYPE] = Ai, Ui[RevoluteJoint.TYPE] = RevoluteJoint, Ui[Pi.TYPE] = Pi, Ui[Ri.TYPE] = Ri, Ui[Hi.TYPE] = Hi, Ui), Ji = { rootClass: World, preSerialize: function(e2) {
  return e2;
}, postSerialize: function(e2, t2) {
  return e2;
}, preDeserialize: function(e2) {
  return e2;
}, postDeserialize: function(e2, t2) {
  return e2;
} }, Yi = /* @__PURE__ */ function() {
  function e2(e3) {
    var t2 = this;
    this.toJson = function(e4) {
      var n2 = t2.options.preSerialize, r2 = t2.options.postSerialize, i2 = [], a2 = [e4], o2 = {};
      function s2(e5, t3) {
        if (e5.__sid = e5.__sid || ++Wi, !o2[e5.__sid]) {
          a2.push(e5);
          var n3 = { refIndex: i2.length + a2.length, refType: t3 };
          o2[e5.__sid] = n3;
        }
        return o2[e5.__sid];
      }
      function c2(e5) {
        e5 = n2(e5);
        var t3 = e5._serialize();
        return t3 = r2(t3, e5), t3;
      }
      function l2(e5, t3) {
        if (t3 === void 0 && (t3 = false), typeof e5 != `object` || !e5) return e5;
        if (typeof e5._serialize == `function`) {
          if (!t3) {
            for (var n3 in Gi) if (e5 instanceof Gi[n3]) return s2(e5, n3);
          }
          e5 = c2(e5);
        }
        if (Array.isArray(e5)) {
          for (var r3 = [], i3 = 0; i3 < e5.length; i3++) r3[i3] = l2(e5[i3]);
          e5 = r3;
        } else {
          var r3 = {};
          for (var i3 in e5) e5.hasOwnProperty(i3) && (r3[i3] = l2(e5[i3]));
          e5 = r3;
        }
        return e5;
      }
      for (; a2.length; ) {
        var u2 = l2(a2.shift(), true);
        i2.push(u2);
      }
      return i2;
    }, this.fromJson = function(e4) {
      var n2 = t2.options.preDeserialize, r2 = t2.options.postDeserialize, i2 = t2.options.rootClass, a2 = {};
      function o2(e5, t3, i3) {
        if (e5 && e5._deserialize || (e5 = qi[t3.type]), e5 && e5._deserialize) {
          t3 = n2(t3);
          var a3 = e5._deserialize, o3 = a3(t3, i3, s2);
          return o3 = r2(o3, t3), o3;
        }
      }
      function s2(t3, n3, r3) {
        if (!(n3.refIndex && n3.refType)) return o2(t3, n3, r3);
        var i3 = n3;
        Ki[i3.refType] && (t3 = Ki[i3.refType]);
        var s3 = i3.refIndex;
        if (!a2[s3]) {
          var c2 = e4[s3];
          a2[s3] = o2(t3, c2, r3);
        }
        return a2[s3];
      }
      return o2(i2, e4[0], null);
    }, this.options = T(T({}, Ji), e3);
  }
  return e2;
}(), Xi = new Yi({ rootClass: World });
Yi.fromJson = Xi.fromJson, Yi.toJson = Xi.toJson, function() {
  function e2() {
  }
  return e2.mount = function(e3) {
    throw Error(`Not implemented`);
  }, e2.start = function(t2) {
    var n2 = e2.mount();
    return n2.start(t2), n2;
  }, e2;
}();
var BoxShape = function(e2) {
  w(t2, e2);
  function t2(n2, r2, i2, a2) {
    var o2 = this;
    return o2 instanceof t2 ? (o2 = e2.call(this) || this, o2._setAsBox(n2, r2, i2, a2), o2) : new t2(n2, r2, i2, a2);
  }
  return t2.TYPE = `polygon`, t2;
}(Qr);
Fr.addType(CircleShape.TYPE, CircleShape.TYPE, Qi);
function Qi(e2, t2, n2, r2, i2, a2, o2) {
  ta(e2, n2.getShape(), t2, a2.getShape(), i2);
}
var $i = N(0, 0), ea = N(0, 0), ta = function(e2, t2, n2, r2, i2) {
  e2.pointCount = 0, V($i, n2, t2.m_p), V(ea, i2, r2.m_p);
  var a2 = Ue(ea, $i), o2 = t2.m_radius + r2.m_radius;
  a2 > o2 * o2 || (e2.type = G.e_circles, P(e2.localPoint, t2.m_p), F(e2.localNormal), e2.pointCount = 1, P(e2.points[0].localPoint, r2.m_p), e2.points[0].id.setFeatures(0, K.e_vertex, 0, K.e_vertex));
};
Fr.addType(Br.TYPE, CircleShape.TYPE, na), Fr.addType(Ur.TYPE, CircleShape.TYPE, ra);
function na(e2, t2, n2, r2, i2, a2, o2) {
  ua(e2, n2.getShape(), t2, a2.getShape(), i2);
}
function ra(e2, t2, n2, r2, i2, a2, o2) {
  var s2 = n2.getShape(), c2 = new Br();
  s2.getChildEdge(c2, r2), ua(e2, c2, t2, a2.getShape(), i2);
}
var ia = N(0, 0), aa = N(0, 0), oa = N(0, 0), sa = N(0, 0), ca = N(0, 0), la = N(0, 0), ua = function(e2, t2, n2, r2, i2) {
  e2.pointCount = 0, Ze(sa, i2, n2, r2.m_p);
  var a2 = t2.m_vertex1, o2 = t2.m_vertex2;
  I(ia, o2, a2);
  var s2 = B(ia, o2) - B(ia, sa), c2 = B(ia, sa) - B(ia, a2), l2 = t2.m_radius + r2.m_radius;
  if (c2 <= 0) {
    if (P(ca, a2), Ue(sa, a2) > l2 * l2) return;
    if (t2.m_hasVertex0) {
      var u2 = t2.m_vertex0, d2 = a2;
      if (I(aa, d2, u2), B(aa, d2) - B(aa, sa) > 0) return;
    }
    e2.type = G.e_circles, F(e2.localNormal), P(e2.localPoint, ca), e2.pointCount = 1, P(e2.points[0].localPoint, r2.m_p), e2.points[0].id.setFeatures(0, K.e_vertex, 0, K.e_vertex);
  } else if (s2 <= 0) {
    if (P(ca, o2), Ue(sa, ca) > l2 * l2) return;
    if (t2.m_hasVertex3) {
      var f2 = t2.m_vertex3, p2 = o2;
      if (I(oa, f2, p2), B(oa, sa) - B(oa, p2) > 0) return;
    }
    e2.type = G.e_circles, F(e2.localNormal), P(e2.localPoint, ca), e2.pointCount = 1, P(e2.points[0].localPoint, r2.m_p), e2.points[0].id.setFeatures(1, K.e_vertex, 0, K.e_vertex);
  } else {
    var m2 = Ve(ia);
    R(ca, s2 / m2, a2, c2 / m2, o2), Ue(sa, ca) > l2 * l2 || (Be(la, 1, ia), B(la, sa) - B(la, a2) < 0 && ke(la), Re(la), e2.type = G.e_faceA, P(e2.localNormal, la), P(e2.localPoint, a2), e2.pointCount = 1, P(e2.points[0].localPoint, r2.m_p), e2.points[0].id.setFeatures(0, K.e_face, 0, K.e_vertex));
  }
}, da = [new Kn(), new Kn()], fa = [new Kn(), new Kn()], pa = [new Kn(), new Kn()], ma = N(0, 0), ha = N(0, 0), ga = N(0, 0), _a = Je(0, 0, 0), va = N(0, 0), ya = N(0, 0), ba = N(0, 0), xa = N(0, 0), Sa = N(0, 0), Ca = N(0, 0), wa = N(0, 0), Ta = N(0, 0);
Fr.addType(Qr.TYPE, Qr.TYPE, Ea);
function Ea(e2, t2, n2, r2, i2, a2, o2) {
  Aa(e2, n2.getShape(), t2, a2.getShape(), i2);
}
function Da(e2, t2, n2, r2, i2) {
  var a2 = e2.m_count, o2 = n2.m_count, s2 = e2.m_normals, c2 = e2.m_vertices, l2 = n2.m_vertices;
  Qe(_a, r2, t2);
  for (var u2 = 0, d2 = -1 / 0, f2 = 0; f2 < a2; ++f2) {
    Ge(ga, _a.q, s2[f2]), V(ha, _a, c2[f2]);
    for (var p2 = 1 / 0, m2 = 0; m2 < o2; ++m2) {
      var h2 = B(ga, l2[m2]) - B(ga, ha);
      h2 < p2 && (p2 = h2);
    }
    p2 > d2 && (d2 = p2, u2 = f2);
  }
  i2.maxSeparation = d2, i2.bestIndex = u2;
}
function Oa(e2, t2, n2, r2, i2, a2) {
  var o2 = t2.m_normals, s2 = i2.m_count, c2 = i2.m_vertices, l2 = i2.m_normals;
  qe(Ta, a2.q, n2.q, o2[r2]);
  for (var u2 = 0, d2 = 1 / 0, f2 = 0; f2 < s2; ++f2) {
    var p2 = B(Ta, l2[f2]);
    p2 < d2 && (d2 = p2, u2 = f2);
  }
  var m2 = u2, h2 = m2 + 1 < s2 ? m2 + 1 : 0;
  V(e2[0].v, a2, c2[m2]), e2[0].id.setFeatures(r2, K.e_face, m2, K.e_vertex), V(e2[1].v, a2, c2[h2]), e2[1].id.setFeatures(r2, K.e_face, h2, K.e_vertex);
}
var ka = { maxSeparation: 0, bestIndex: 0 }, Aa = function(e2, t2, n2, r2, i2) {
  e2.pointCount = 0;
  var a2 = t2.m_radius + r2.m_radius;
  Da(t2, n2, r2, i2, ka);
  var o2 = ka.bestIndex, s2 = ka.maxSeparation;
  if (!(s2 > a2)) {
    Da(r2, i2, t2, n2, ka);
    var c2 = ka.bestIndex, l2 = ka.maxSeparation;
    if (!(l2 > a2)) {
      var u2, d2, f2, p2, m2, h2;
      l2 > s2 + 0.1 * M.linearSlop ? (u2 = r2, d2 = t2, f2 = i2, p2 = n2, m2 = c2, e2.type = G.e_faceB, h2 = true) : (u2 = t2, d2 = r2, f2 = n2, p2 = i2, m2 = o2, e2.type = G.e_faceA, h2 = false), da[0].recycle(), da[1].recycle(), Oa(da, u2, f2, m2, d2, p2);
      var g2 = u2.m_count, _2 = u2.m_vertices, v2 = m2, y2 = m2 + 1 < g2 ? m2 + 1 : 0;
      P(va, _2[v2]), P(ya, _2[y2]), I(ba, ya, va), Re(ba), ze(xa, ba, 1), R(Sa, 0.5, va, 0.5, ya), Ge(Ca, f2.q, ba), ze(wa, Ca, 1), V(va, f2, va), V(ya, f2, ya);
      var b2 = B(wa, va), x2 = -B(Ca, va) + a2, S2 = B(Ca, ya) + a2;
      if (fa[0].recycle(), fa[1].recycle(), pa[0].recycle(), pa[1].recycle(), Oe(ma, -Ca.x, -Ca.y), !(Qn(fa, da, ma, x2, v2) < 2) && (Oe(ma, Ca.x, Ca.y), !(Qn(pa, fa, ma, S2, y2) < 2))) {
        P(e2.localNormal, xa), P(e2.localPoint, Sa);
        for (var C2 = 0, w2 = 0; w2 < pa.length; ++w2) if (B(wa, pa[w2].v) - b2 <= a2) {
          var T2 = e2.points[C2];
          Xe(T2.localPoint, p2, pa[w2].v), T2.id.set(pa[w2].id), h2 && T2.id.swapFeatures(), ++C2;
        }
        e2.pointCount = C2;
      }
    }
  }
};
Fr.addType(Qr.TYPE, CircleShape.TYPE, ja);
function ja(e2, t2, n2, r2, i2, a2, o2) {
  Pa(e2, n2.getShape(), t2, a2.getShape(), i2);
}
var Ma = N(0, 0), Na = N(0, 0), Pa = function(e2, t2, n2, r2, i2) {
  e2.pointCount = 0, Ze(Ma, i2, n2, r2.m_p);
  for (var a2 = 0, o2 = -1 / 0, s2 = t2.m_radius + r2.m_radius, c2 = t2.m_count, l2 = t2.m_vertices, u2 = t2.m_normals, d2 = 0; d2 < c2; ++d2) {
    var f2 = B(u2[d2], Ma) - B(u2[d2], l2[d2]);
    if (f2 > s2) return;
    f2 > o2 && (o2 = f2, a2 = d2);
  }
  var p2 = a2, m2 = p2 + 1 < c2 ? p2 + 1 : 0, h2 = l2[p2], g2 = l2[m2];
  if (o2 < O) e2.pointCount = 1, e2.type = G.e_faceA, P(e2.localNormal, u2[a2]), R(e2.localPoint, 0.5, h2, 0.5, g2), P(e2.points[0].localPoint, r2.m_p), e2.points[0].id.setFeatures(0, K.e_vertex, 0, K.e_vertex);
  else {
    var _2 = B(Ma, g2) - B(Ma, h2) - B(h2, g2) + B(h2, h2), v2 = B(Ma, h2) - B(Ma, g2) - B(g2, h2) + B(g2, g2);
    if (_2 <= 0) {
      if (Ue(Ma, h2) > s2 * s2) return;
      e2.pointCount = 1, e2.type = G.e_faceA, I(e2.localNormal, Ma, h2), Re(e2.localNormal), P(e2.localPoint, h2), P(e2.points[0].localPoint, r2.m_p), e2.points[0].id.setFeatures(0, K.e_vertex, 0, K.e_vertex);
    } else if (v2 <= 0) {
      if (Ue(Ma, g2) > s2 * s2) return;
      e2.pointCount = 1, e2.type = G.e_faceA, I(e2.localNormal, Ma, g2), Re(e2.localNormal), P(e2.localPoint, g2), P(e2.points[0].localPoint, r2.m_p), e2.points[0].id.setFeatures(0, K.e_vertex, 0, K.e_vertex);
    } else {
      if (R(Na, 0.5, h2, 0.5, g2), B(Ma, u2[p2]) - B(Na, u2[p2]) > s2) return;
      e2.pointCount = 1, e2.type = G.e_faceA, P(e2.localNormal, u2[p2]), P(e2.localPoint, Na), P(e2.points[0].localPoint, r2.m_p), e2.points[0].id.setFeatures(0, K.e_vertex, 0, K.e_vertex);
    }
  }
}, Fa = Math.min;
Fr.addType(Br.TYPE, Qr.TYPE, Ia), Fr.addType(Ur.TYPE, Qr.TYPE, Ra);
function Ia(e2, t2, n2, r2, i2, a2, o2) {
  so(e2, n2.getShape(), t2, a2.getShape(), i2);
}
var La = new Br();
function Ra(e2, t2, n2, r2, i2, a2, o2) {
  n2.getShape().getChildEdge(La, r2), so(e2, La, t2, a2.getShape(), i2);
}
var za;
(function(e2) {
  e2[e2.e_unknown = -1] = `e_unknown`, e2[e2.e_edgeA = 1] = `e_edgeA`, e2[e2.e_edgeB = 2] = `e_edgeB`;
})(za ||= {});
var Ba;
(function(e2) {
  e2[e2.e_isolated = 0] = `e_isolated`, e2[e2.e_concave = 1] = `e_concave`, e2[e2.e_convex = 2] = `e_convex`;
})(Ba ||= {});
var Va = /* @__PURE__ */ function() {
  function e2() {
  }
  return e2;
}(), Ha = /* @__PURE__ */ function() {
  function e2() {
    this.vertices = [], this.normals = [], this.count = 0;
    for (var e3 = 0; e3 < M.maxPolygonVertices; e3++) this.vertices.push(N(0, 0)), this.normals.push(N(0, 0));
  }
  return e2;
}(), Ua = function() {
  function e2() {
    this.v1 = N(0, 0), this.v2 = N(0, 0), this.normal = N(0, 0), this.sideNormal1 = N(0, 0), this.sideNormal2 = N(0, 0);
  }
  return e2.prototype.recycle = function() {
    F(this.v1), F(this.v2), F(this.normal), F(this.sideNormal1), F(this.sideNormal2);
  }, e2;
}(), Wa = [new Kn(), new Kn()], Ga = [new Kn(), new Kn()], Ka = [new Kn(), new Kn()], qa = new Va(), Ja = new Va(), Ya = new Ha(), Y = new Ua(), Xa = N(0, 0), Za = N(0, 0), Qa = N(0, 0), $a = N(0, 0), eo = Je(0, 0, 0), X = N(0, 0), to = N(0, 0), Z = N(0, 0), no = N(0, 0), ro = N(0, 0), io = N(0, 0), ao = N(0, 0), oo = N(0, 0), so = function(e2, t2, n2, r2, i2) {
  Qe(eo, n2, i2), V(Xa, eo, r2.m_centroid);
  var a2 = t2.m_vertex0, o2 = t2.m_vertex1, s2 = t2.m_vertex2, c2 = t2.m_vertex3, l2 = t2.m_hasVertex0, u2 = t2.m_hasVertex3;
  I(Qa, s2, o2), Re(Qa), Oe(Z, Qa.y, -Qa.x);
  var d2 = B(Z, Xa) - B(Z, o2), f2 = 0, p2 = 0, m2 = false, h2 = false;
  F(to), F(no), l2 && (I(Za, o2, a2), Re(Za), Oe(to, Za.y, -Za.x), m2 = z(Za, Qa) >= 0, f2 = Vec2.dot(to, Xa) - Vec2.dot(to, a2)), u2 && (I($a, c2, s2), Re($a), Oe(no, $a.y, -$a.x), h2 = Vec2.crossVec2Vec2(Qa, $a) > 0, p2 = Vec2.dot(no, Xa) - Vec2.dot(no, s2));
  var g2;
  F(X), F(ro), F(io), l2 && u2 ? m2 && h2 ? (g2 = f2 >= 0 || d2 >= 0 || p2 >= 0, g2 ? (P(X, Z), P(ro, to), P(io, no)) : (L(X, -1, Z), L(ro, -1, Z), L(io, -1, Z))) : m2 ? (g2 = f2 >= 0 || d2 >= 0 && p2 >= 0, g2 ? (P(X, Z), P(ro, to), P(io, Z)) : (L(X, -1, Z), L(ro, -1, no), L(io, -1, Z))) : h2 ? (g2 = p2 >= 0 || f2 >= 0 && d2 >= 0, g2 ? (P(X, Z), P(ro, Z), P(io, no)) : (L(X, -1, Z), L(ro, -1, Z), L(io, -1, to))) : (g2 = f2 >= 0 && d2 >= 0 && p2 >= 0, g2 ? (P(X, Z), P(ro, Z), P(io, Z)) : (L(X, -1, Z), L(ro, -1, no), L(io, -1, to))) : l2 ? m2 ? (g2 = f2 >= 0 || d2 >= 0, g2 ? (P(X, Z), P(ro, to), L(io, -1, Z)) : (L(X, -1, Z), P(ro, Z), L(io, -1, Z))) : (g2 = f2 >= 0 && d2 >= 0, g2 ? (P(X, Z), P(ro, Z), L(io, -1, Z)) : (L(X, -1, Z), P(ro, Z), L(io, -1, to))) : u2 ? h2 ? (g2 = d2 >= 0 || p2 >= 0, g2 ? (P(X, Z), L(ro, -1, Z), P(io, no)) : (L(X, -1, Z), L(ro, -1, Z), P(io, Z))) : (g2 = d2 >= 0 && p2 >= 0, g2 ? (P(X, Z), L(ro, -1, Z), P(io, Z)) : (L(X, -1, Z), L(ro, -1, no), P(io, Z))) : (g2 = d2 >= 0, g2 ? (P(X, Z), L(ro, -1, Z), L(io, -1, Z)) : (L(X, -1, Z), P(ro, Z), P(io, Z))), Ya.count = r2.m_count;
  for (var _2 = 0; _2 < r2.m_count; ++_2) V(Ya.vertices[_2], eo, r2.m_vertices[_2]), Ge(Ya.normals[_2], eo.q, r2.m_normals[_2]);
  var v2 = r2.m_radius + t2.m_radius;
  e2.pointCount = 0, qa.type = za.e_edgeA, qa.index = +!g2, qa.separation = 1 / 0;
  for (var _2 = 0; _2 < Ya.count; ++_2) {
    var y2 = Ya.vertices[_2], b2 = B(X, y2) - B(X, o2);
    b2 < qa.separation && (qa.separation = b2);
  }
  if (qa.type != za.e_unknown && !(qa.separation > v2)) {
    Ja.type = za.e_unknown, Ja.index = -1, Ja.separation = -1 / 0, Oe(ao, -X.y, X.x);
    for (var _2 = 0; _2 < Ya.count; ++_2) {
      L(oo, -1, Ya.normals[_2]);
      var b2 = Fa(B(oo, Ya.vertices[_2]) - B(oo, o2), B(oo, Ya.vertices[_2]) - B(oo, s2));
      if (b2 > v2) {
        Ja.type = za.e_edgeB, Ja.index = _2, Ja.separation = b2;
        break;
      }
      if (B(oo, ao) >= 0) {
        if (B(oo, X) - B(io, X) < -M.angularSlop) continue;
      } else if (B(oo, X) - B(ro, X) < -M.angularSlop) continue;
      b2 > Ja.separation && (Ja.type = za.e_edgeB, Ja.index = _2, Ja.separation = b2);
    }
    if (!(Ja.type != za.e_unknown && Ja.separation > v2)) {
      var x2 = Ja.type == za.e_unknown ? qa : Ja.separation > 0.98 * qa.separation + 1e-3 ? Ja : qa;
      if (Ka[0].recycle(), Ka[1].recycle(), x2.type == za.e_edgeA) {
        e2.type = G.e_faceA;
        for (var S2 = 0, C2 = B(X, Ya.normals[0]), _2 = 1; _2 < Ya.count; ++_2) {
          var w2 = B(X, Ya.normals[_2]);
          w2 < C2 && (C2 = w2, S2 = _2);
        }
        var T2 = S2, E2 = T2 + 1 < Ya.count ? T2 + 1 : 0;
        P(Ka[0].v, Ya.vertices[T2]), Ka[0].id.setFeatures(0, K.e_face, T2, K.e_vertex), P(Ka[1].v, Ya.vertices[E2]), Ka[1].id.setFeatures(0, K.e_face, E2, K.e_vertex), g2 ? (Y.i1 = 0, Y.i2 = 1, P(Y.v1, o2), P(Y.v2, s2), P(Y.normal, Z)) : (Y.i1 = 1, Y.i2 = 0, P(Y.v1, s2), P(Y.v2, o2), L(Y.normal, -1, Z));
      } else e2.type = G.e_faceB, P(Ka[0].v, o2), Ka[0].id.setFeatures(x2.index, K.e_face, 0, K.e_vertex), P(Ka[1].v, s2), Ka[1].id.setFeatures(x2.index, K.e_face, 1, K.e_vertex), Y.i1 = x2.index, Y.i2 = Y.i1 + 1 < Ya.count ? Y.i1 + 1 : 0, P(Y.v1, Ya.vertices[Y.i1]), P(Y.v2, Ya.vertices[Y.i2]), P(Y.normal, Ya.normals[Y.i1]);
      if (Oe(Y.sideNormal1, Y.normal.y, -Y.normal.x), Oe(Y.sideNormal2, -Y.sideNormal1.x, -Y.sideNormal1.y), Y.sideOffset1 = B(Y.sideNormal1, Y.v1), Y.sideOffset2 = B(Y.sideNormal2, Y.v2), Wa[0].recycle(), Wa[1].recycle(), Ga[0].recycle(), Ga[1].recycle(), !(Qn(Wa, Ka, Y.sideNormal1, Y.sideOffset1, Y.i1) < M.maxManifoldPoints) && !(Qn(Ga, Wa, Y.sideNormal2, Y.sideOffset2, Y.i2) < M.maxManifoldPoints)) {
        x2.type == za.e_edgeA ? (P(e2.localNormal, Y.normal), P(e2.localPoint, Y.v1)) : (P(e2.localNormal, r2.m_normals[Y.i1]), P(e2.localPoint, r2.m_vertices[Y.i1]));
        for (var D2 = 0, _2 = 0; _2 < M.maxManifoldPoints; ++_2) if (B(Y.normal, Ga[_2].v) - B(Y.normal, Y.v1) <= v2) {
          var O2 = e2.points[D2];
          x2.type == za.e_edgeA ? (Xe(O2.localPoint, eo, Ga[_2].v), O2.id.set(Ga[_2].id)) : (P(O2.localPoint, Ga[_2].v), O2.id.set(Ga[_2].id), O2.id.swapFeatures()), ++D2;
        }
        e2.pointCount = D2;
      }
    }
  }
};
(function() {
  function e2(e3, t2) {
    this._refMap = {}, this._map = {}, this._xmap = {}, this._data = [], this._entered = [], this._exited = [], this._key = e3, this._listener = t2;
  }
  return e2.prototype.update = function(e3) {
    if (!Array.isArray(e3)) throw `Invalid data: ` + e3;
    this._entered.length = 0, this._exited.length = 0, this._data.length = e3.length;
    for (var t2 = 0; t2 < e3.length; t2++) if (typeof e3[t2] == `object` && e3[t2] !== null) {
      var n2 = e3[t2], r2 = this._key(n2);
      this._map[r2] ? delete this._map[r2] : this._entered.push(n2), this._data[t2] = n2, this._xmap[r2] = n2;
    }
    for (var r2 in this._map) this._exited.push(this._map[r2]), delete this._map[r2];
    var i2 = this._map;
    this._map = this._xmap, this._xmap = i2;
    for (var t2 = 0; t2 < this._exited.length; t2++) {
      var n2 = this._exited[t2], a2 = this._key(n2), o2 = this._refMap[a2];
      this._listener.exit(n2, o2), delete this._refMap[a2];
    }
    for (var t2 = 0; t2 < this._entered.length; t2++) {
      var n2 = this._entered[t2], a2 = this._key(n2), o2 = this._listener.enter(n2);
      o2 && (this._refMap[a2] = o2);
    }
    for (var t2 = 0; t2 < this._data.length; t2++) if (typeof e3[t2] == `object` && e3[t2] !== null) {
      var n2 = this._data[t2], a2 = this._key(n2), o2 = this._refMap[a2];
      this._listener.update(n2, o2);
    }
    this._entered.length = 0, this._exited.length = 0, this._data.length = 0;
  }, e2.prototype.ref = function(e3) {
    return this._refMap[this._key(e3)];
  }, e2;
})();
var co = 0.5, lo = 0.95;
function frictionOverride(e2) {
  switch (e2.kind) {
    case `puddle`:
      return e2.puddle.friction;
    case `part`: {
      if (e2.foot && e2.ragdoll.slide) return 0.02;
      if (e2.ragdoll.slimeTimer <= 0) return null;
      let t2 = e2.foot ? SLIME_CFG.coatFootFriction : SLIME_CFG.coatBodyFriction;
      return t2 + ((e2.foot ? lo : co) - t2) * e2.ragdoll.slipResist;
    }
    case `object`:
      return e2.obj.slimeTimer > 0 ? SLIME_CFG.coatObjectFriction : null;
    default:
      return null;
  }
}
var PhysicsWorld = class {
  constructor() {
    this.time = 0, this.hits = [], this.impacts = [], this.pendingBodies = [], this.world = new World({ gravity: new Vec2(0, PHYS_CFG.gravityY), allowSleep: false }), this.world.on(`begin-contact`, (e2) => this.onBeginContact(e2)), this.world.on(`pre-solve`, (e2) => this.onPreSolve(e2));
  }
  step(t2) {
    this.world.step(t2, PHYS_CFG.velocityIterations, PHYS_CFG.positionIterations), this.time += t2;
  }
  drain() {
    let e2 = this.hits, t2 = this.impacts;
    return this.hits = [], this.impacts = [], { hits: e2, impacts: t2 };
  }
  refreshContacts(e2) {
    for (let t3 of e2) t3.footContacts = 0, t3.bodyContacts = 0;
    let t2 = this.world.getContactList();
    for (; t2; ) {
      if (t2.isTouching()) {
        let e3 = t2.getFixtureA().getUserData(), n2 = t2.getFixtureB().getUserData();
        this.countRagdollContact(e3, n2), this.countRagdollContact(n2, e3);
      }
      t2 = t2.getNext();
    }
  }
  countRagdollContact(e2, t2) {
    e2 && e2.kind === `part` && t2 && t2.kind !== `part` && t2.kind !== `projectile` && (e2.ragdoll.bodyContacts++, e2.foot && e2.ragdoll.footContacts++);
  }
  removeBody(e2) {
    this.pendingBodies.push(e2);
  }
  flush() {
    for (let e2 of this.pendingBodies) this.world.destroyBody(e2);
    this.pendingBodies = [];
  }
  onBeginContact(e2) {
    let t2 = e2.getFixtureA(), n2 = e2.getFixtureB(), r2 = t2.getUserData(), i2 = n2.getUserData(), a2 = t2.getBody(), s2 = n2.getBody(), c2 = e2.getWorldManifold(null);
    if (!c2 || c2.points.length === 0) return;
    let l2 = { x: c2.points[0].x, y: c2.points[0].y }, u2 = c2.normal, d2 = a2.getLinearVelocity(), f2 = s2.getLinearVelocity(), p2 = (d2.x - f2.x) * u2.x + (d2.y - f2.y) * u2.y, m2 = r2.kind === `projectile`, h2 = i2.kind === `projectile`;
    if (m2 !== h2) {
      let e3 = m2 ? r2 : i2;
      if (e3.proj.consumed) return;
      let t3 = m2 ? i2 : r2;
      if (t3.kind === `block` && e3.proj.ownerId === 1) return;
      let n3 = m2 ? s2 : a2, o2 = m2 ? u2 : { x: -u2.x, y: -u2.y };
      this.hits.push({ projectile: e3.proj, other: t3, otherBody: n3, point: l2, normal: { x: o2.x, y: o2.y }, speed: Math.max(0, p2) });
    } else m2 && h2 || (r2.kind === `part` && p2 > COMBAT_CFG.impactThreshold && this.impacts.push({ ragdoll: r2.ragdoll, part: r2.part, speed: p2, point: l2, source: i2.kind }), i2.kind === `part` && p2 > COMBAT_CFG.impactThreshold && this.impacts.push({ ragdoll: i2.ragdoll, part: i2.part, speed: p2, point: l2, source: r2.kind }));
  }
  onPreSolve(e2) {
    let t2 = e2.getFixtureA().getUserData(), n2 = e2.getFixtureB().getUserData(), r2 = t2.kind === `projectile` && t2.proj.shot.pierce && n2.kind === `part` || n2.kind === `projectile` && n2.proj.shot.pierce && t2.kind === `part`, i2 = t2.kind === `projectile` && t2.proj.ownerId === 1 && n2.kind === `block` || n2.kind === `projectile` && n2.proj.ownerId === 1 && t2.kind === `block`;
    if (r2 || i2) {
      e2.setEnabled(false);
      return;
    }
    let a2 = frictionOverride(t2), o2 = frictionOverride(n2);
    (a2 !== null || o2 !== null) && e2.setFriction(Math.min(a2 ?? 1 / 0, o2 ?? 1 / 0));
  }
};
function po(e2, t2, n2) {
  let r2 = t2.x - e2.x, i2 = t2.y - e2.y, a2 = Math.hypot(r2, i2) / 2, o2 = new BoxShape(a2, n2, new Vec2((e2.x + t2.x) / 2, (e2.y + t2.y) / 2), Math.atan2(i2, r2)), s2 = Math.PI * n2 * n2;
  return [{ shape: o2, area: 4 * a2 * n2 }, { shape: new CircleShape(new Vec2(e2.x, e2.y), n2), area: s2 }, { shape: new CircleShape(new Vec2(t2.x, t2.y), n2), area: s2 }];
}
function mo(e2, t2) {
  return { shape: new CircleShape(new Vec2(e2.x, e2.y), t2), area: Math.PI * t2 * t2 };
}
function ho(e2, t2, n2, r2 = 0) {
  return { shape: new BoxShape(e2, t2, new Vec2(n2.x, n2.y), r2), area: 4 * e2 * t2 };
}
function go(e2, t2, n2, r2) {
  let i2 = n2 / t2.reduce((e3, t3) => e3 + t3.area, 0);
  for (let n3 of t2) e2.createFixture(n3.shape, { density: i2, friction: n3.friction ?? r2.friction, restitution: r2.restitution, filterGroupIndex: r2.filterGroupIndex ?? 0, userData: n3.userData });
}
var _o = 9, Projectile = class {
  constructor(e2, t2, n2, r2, i2, a2 = false) {
    this.consumed = false, this.alive = true, this.lastBounce = -10, this.returning = false, this.hitTargets = /* @__PURE__ */ new Set(), this.trail = [], this.seed = Math.random() * 10, this.ownerId = t2, this.shot = i2, this.radius = i2.radius, this.color = i2.color, this.isChild = a2, this.life = a2 ? 3.5 : i2.boomerang > 0 ? 6 : 7, this.bouncesLeft = i2.bounces, this.bounceCount = 0, this.liftLeft = i2.liftTime, this.fuseLeft = i2.fuse, this.boomerangLeft = i2.boomerang, this.body = e2.world.createBody({ type: `dynamic`, position: { x: n2.x, y: n2.y }, linearDamping: i2.drag, angularDamping: 0.2 }), this.body.setBullet(true);
    let o2 = { kind: `projectile`, proj: this };
    go(this.body, [{ ...mo({ x: 0, y: 0 }, this.radius), userData: o2, friction: 0.6 }], i2.mass, { friction: 0.6, restitution: i2.restitution, filterGroupIndex: -t2 }), this.body.setLinearVelocity(r2), this.prevX = n2.x, this.prevY = n2.y;
  }
  get position() {
    return this.body.getPosition();
  }
  snapshot() {
    let e2 = this.body.getPosition();
    this.prevX = e2.x, this.prevY = e2.y;
  }
  update(e2) {
    this.life -= e2;
    let t2 = this.body.getPosition();
    this.trail.push({ x: t2.x, y: t2.y }), this.trail.length > _o && this.trail.shift();
  }
  destroy(e2) {
    this.alive && (this.alive = false, e2.removeBody(this.body));
  }
}, yo = { friction: 0.5, linearDamping: 0.12, angularDamping: 0.4 }, RAGDOLL_PARTS = [{ name: `pelvis`, center: { x: 0, y: 1 }, a: { x: -0.06, y: 0 }, b: { x: 0.06, y: 0 }, radius: 0.12, mass: 7, ...yo }, { name: `torso`, center: { x: 0, y: 1.29 }, a: { x: 0, y: -0.17 }, b: { x: 0, y: 0.17 }, radius: 0.15, mass: 13, ...yo }, { name: `head`, center: { x: 0, y: 1.63 }, radius: 0.17, mass: 3.5, circle: true, friction: 0.5, linearDamping: 0.12, angularDamping: 0.6 }, { name: `thighL`, center: { x: -0.07, y: 0.735 }, a: { x: 0, y: 0.215 }, b: { x: 0, y: -0.215 }, radius: 0.085, mass: 6, ...yo, angularDamping: 0.45 }, { name: `thighR`, center: { x: 0.07, y: 0.735 }, a: { x: 0, y: 0.215 }, b: { x: 0, y: -0.215 }, radius: 0.085, mass: 6, ...yo, angularDamping: 0.45 }, { name: `shinL`, center: { x: -0.07, y: 0.31 }, a: { x: 0, y: 0.21 }, b: { x: 0, y: -0.21 }, radius: 0.07, mass: 3, ...yo, angularDamping: 0.5 }, { name: `shinR`, center: { x: 0.07, y: 0.31 }, a: { x: 0, y: 0.21 }, b: { x: 0, y: -0.21 }, radius: 0.07, mass: 3, ...yo, angularDamping: 0.5 }, { name: `footL`, center: { x: -0.04, y: 0.04 }, box: { hx: 0.11, hy: 0.04 }, radius: 0, mass: 0.9, friction: 0.95, linearDamping: 0.12, angularDamping: 0.5 }, { name: `footR`, center: { x: 0.1, y: 0.04 }, box: { hx: 0.11, hy: 0.04 }, radius: 0, mass: 0.9, friction: 0.95, linearDamping: 0.12, angularDamping: 0.5 }, { name: `upperArmL`, center: { x: -0.17, y: 1.27 }, a: { x: 0, y: 0.15 }, b: { x: 0, y: -0.15 }, radius: 0.055, mass: 2, friction: 0.5, linearDamping: 0.1, angularDamping: 0.6 }, { name: `upperArmR`, center: { x: 0.17, y: 1.27 }, a: { x: 0, y: 0.15 }, b: { x: 0, y: -0.15 }, radius: 0.055, mass: 2, friction: 0.5, linearDamping: 0.1, angularDamping: 0.6 }, { name: `lowerArmL`, center: { x: -0.17, y: 0.98 }, a: { x: 0, y: 0.14 }, b: { x: 0, y: -0.14 }, radius: 0.05, mass: 1.2, friction: 0.5, linearDamping: 0.1, angularDamping: 0.6 }, { name: `lowerArmR`, center: { x: 0.17, y: 0.98 }, a: { x: 0, y: 0.14 }, b: { x: 0, y: -0.14 }, radius: 0.05, mass: 1.2, friction: 0.5, linearDamping: 0.1, angularDamping: 0.6 }], RAGDOLL_JOINTS = [{ parent: `torso`, child: `head`, parentAnchor: { x: 0, y: 0.17 }, childAnchor: { x: 0, y: -0.17 }, lower: -1, upper: 1, torque: 30 }, { parent: `pelvis`, child: `torso`, parentAnchor: { x: 0, y: 0.12 }, childAnchor: { x: 0, y: -0.17 }, lower: -1.4, upper: 1.4, torque: 220 }, { parent: `pelvis`, child: `thighL`, parentAnchor: { x: -0.07, y: -0.05 }, childAnchor: { x: 0, y: 0.215 }, lower: -0.8, upper: 1.7, torque: 340 }, { parent: `pelvis`, child: `thighR`, parentAnchor: { x: 0.07, y: -0.05 }, childAnchor: { x: 0, y: 0.215 }, lower: -0.8, upper: 1.7, torque: 340 }, { parent: `thighL`, child: `shinL`, parentAnchor: { x: 0, y: -0.215 }, childAnchor: { x: 0, y: 0.21 }, lower: -2.2, upper: 0.1, torque: 240 }, { parent: `thighR`, child: `shinR`, parentAnchor: { x: 0, y: -0.215 }, childAnchor: { x: 0, y: 0.21 }, lower: -2.2, upper: 0.1, torque: 240 }, { parent: `shinL`, child: `footL`, parentAnchor: { x: 0, y: -0.21 }, childAnchor: { x: -0.03, y: 0.06 }, lower: -0.9, upper: 0.9, torque: 260 }, { parent: `shinR`, child: `footR`, parentAnchor: { x: 0, y: -0.21 }, childAnchor: { x: -0.03, y: 0.06 }, lower: -0.9, upper: 0.9, torque: 260 }, { parent: `torso`, child: `upperArmL`, parentAnchor: { x: -0.17, y: 0.13 }, childAnchor: { x: 0, y: 0.15 }, lower: -1.5, upper: 3.3, torque: 70 }, { parent: `torso`, child: `upperArmR`, parentAnchor: { x: 0.17, y: 0.13 }, childAnchor: { x: 0, y: 0.15 }, lower: -1.5, upper: 3.3, torque: 70 }, { parent: `upperArmL`, child: `lowerArmL`, parentAnchor: { x: 0, y: -0.15 }, childAnchor: { x: 0, y: 0.14 }, lower: -0.1, upper: 2.5, torque: 30 }, { parent: `upperArmR`, child: `lowerArmR`, parentAnchor: { x: 0, y: -0.15 }, childAnchor: { x: 0, y: 0.14 }, lower: -0.1, upper: 2.5, torque: 30 }], So = 0.04, Co = 12, wo = 16, To = 2, Eo = 0.35, Do = 0.3, Oo = 1.05, ko = 0.55, Ao = 0.95, jo = { upperFront: 0.15, lowerFront: 0.35, upperBack: -0.1, lowerBack: 0.2 }, Ragdoll = class {
  constructor(e2, t2) {
    this.incomingMul = 1, this.noKnockdown = t2.team === `player`, this.slipResist = 0, this.staggerMul = 1, this.dripTime = 0, this.dripDps = 0, this.state = `alive`, this.parts = /* @__PURE__ */ new Map(), this.slimeTimer = 0, this.slimeMax = 1, this.blobs = [], this.staggerTimer = 0, this.strength = 1, this.aimPhi = null, this.corpseTimer = 0, this.tilt = 0, this.footContacts = 0, this.bodyContacts = 0, this.recoverTimer = 0, this.recoverCooldown = 0, this.downTime = 0, this.joints = [], this.targets = /* @__PURE__ */ new Map(), this.id = t2.id, this.team = t2.team, this.facing = t2.facing, this.maxHp = t2.maxHp, this.hp = t2.maxHp;
    this.moveAxis = 0, this.faceCooldown = 0, this.wantFacing = t2.facing, this.gaitPhase = 0, this.walkBlend = 0, this.slide = false, this.slideV = 0, this.onStep = null, this.stepHalf = 0;
    this.autoRecover = false, this.onGetUp = null, this.stuckTime = 0, this.rightingBoost = 1, this.hitLock = 0;
    this.speedMul = 1, this.knockable = false;
    this.safeAir = 0, this.landedFor = 0;
    let n2 = e2.world, r2 = -t2.id;
    this.frontUpper = t2.facing > 0 ? `upperArmR` : `upperArmL`, this.frontLower = t2.facing > 0 ? `lowerArmR` : `lowerArmL`, this.backUpper = t2.facing > 0 ? `upperArmL` : `upperArmR`, this.backLower = t2.facing > 0 ? `lowerArmL` : `lowerArmR`;
    for (let e3 of RAGDOLL_PARTS) {
      let i2 = n2.createBody({ type: `dynamic`, position: { x: t2.x + e3.center.x, y: t2.groundY + So + e3.center.y }, linearDamping: e3.linearDamping, angularDamping: e3.angularDamping }), a2 = { kind: `part`, ragdoll: this, part: e3.name, foot: !!e3.box };
      go(i2, (e3.box ? [ho(e3.box.hx, e3.box.hy, { x: 0, y: 0 })] : e3.circle ? [mo({ x: 0, y: 0 }, e3.radius)] : po(e3.a, e3.b, e3.radius)).map((t3) => ({ ...t3, userData: a2, friction: e3.friction })), e3.mass, { friction: e3.friction, restitution: 0.05, filterGroupIndex: r2 });
      let o2 = i2.getPosition();
      this.parts.set(e3.name, { spec: e3, body: i2, flash: 0, prevX: o2.x, prevY: o2.y, prevA: i2.getAngle() }), this.targets.set(e3.name, 0);
    }
    for (let e3 of RAGDOLL_JOINTS) {
      let r3 = this.parts.get(e3.parent).body, i2 = this.parts.get(e3.child).body, a2 = t2.facing > 0 ? e3.lower : -e3.upper, o2 = t2.facing > 0 ? e3.upper : -e3.lower, s2 = new RevoluteJoint({ bodyA: r3, bodyB: i2, localAnchorA: e3.parentAnchor, localAnchorB: e3.childAnchor, referenceAngle: 0, collideConnected: false, enableLimit: true, lowerAngle: a2, upperAngle: o2, enableMotor: true, motorSpeed: 0, maxMotorTorque: e3.torque });
      n2.createJoint(s2), this.joints.push({ joint: s2, parent: e3.parent, child: e3.child, torque: e3.torque, lower: e3.lower, upper: e3.upper });
    }
  }
  get alive() {
    return this.state === `alive`;
  }
  get dazed() {
    // Owner: "when the player gets shot he gets stunned and can't move". A slime coat used to count as dazed and froze the walk code; the lone player is never dazed.
    return this.noKnockdown ? false : this.staggerTimer > 0 || this.slimeTimer > 0;
  }
  get grounded() {
    return this.footContacts > 0;
  }
  get touchingGround() {
    return this.bodyContacts > 0;
  }
  get recovering() {
    return this.recoverTimer > 0;
  }
  get torsoBody() {
    return this.parts.get(`torso`).body;
  }
  get pelvisX() {
    return this.parts.get(`pelvis`).body.getPosition().x;
  }
  headPosition() {
    return this.parts.get(`head`).body.getPosition();
  }
  torsoPosition() {
    return this.torsoBody.getPosition();
  }
  isStanding() {
    return this.alive && Math.abs(this.tilt) < 0.55 && this.heightAboveFeet() > 0.78;
  }
  isDown() {
    return !this.alive || this.bodyContacts === 0 ? false : this.heightAboveFeet() < 0.78 || Math.abs(this.tilt) > 0.9;
  }
  kipUp() {
    return !this.alive || this.recoverCooldown > 0 || !this.isDown() ? false : (this.recoverTimer = RECOVER_CFG.rightingTime, this.recoverCooldown = RECOVER_CFG.cooldown, this.downTime = 0, this.staggerTimer = 0, this.strength = 1, this.launchUp(RECOVER_CFG.hopSpeed), true);
  }
  muzzle(e2, t2 = 0.24) {
    let n2 = this.parts.get(this.frontLower).body.getWorldPoint({ x: 0, y: -0.14 });
    return { x: n2.x + e2.x * t2, y: n2.y + e2.y * t2 };
  }
  coat(e2, t2, n2) {
    if (this.noKnockdown) return;
    this.slimeTimer = Math.max(this.slimeTimer, e2), this.slimeMax = this.slimeTimer;
    let r2 = [], i2 = [...this.parts.keys()];
    for (let e3 = 0; e3 < 8; e3++) {
      let e4 = i2[Math.floor(Math.random() * i2.length)];
      r2.push({ part: e4, x: randRange(-0.12, 0.12), y: randRange(-0.2, 0.2), r: randRange(0.06, 0.13) });
    }
    if (t2 && n2) {
      let e3 = this.parts.get(n2).body.getLocalPoint(t2);
      r2.push({ part: n2, x: e3.x, y: e3.y, r: randRange(0.12, 0.17) });
    }
    this.blobs = r2;
  }
  stagger(e2) {
    if (this.noKnockdown) return;
    this.staggerTimer = Math.max(this.staggerTimer, e2 * this.staggerMul);
    e2 > 0 && (this.safeAir = 0);
  }
  knock(e2, t2, n2, r2 = 1.3) {
    if (!this.alive || !(n2 > 0)) return;
    let i2 = Math.hypot(e2, t2);
    if (i2 < 1e-6) return;
    this.safeAir = 0;
    let o2 = e2 / i2, s2 = t2 / i2, l2 = 0;
    for (let c2 of this.parts.values()) l2 += c2.spec.mass;
    if (this.noKnockdown) {
      // Balance rule: the lone player is never thrown into a ragdoll by hits; he only gets a small horizontal flinch and keeps control (enemies keep the full ragdoll knock-down).
      // Owner: "I can't move": rapid hits used to lock the controls (hitLock) and the shoves piled up and carried him away. Now: no control lock, and the shove never pushes him faster than playerShoveSpeedMax along the hit direction.
      let a3 = Math.min(n2 * KNOCK_CFG.playerShove, KNOCK_CFG.playerShoveMax) / l2;
      a3 = Math.max(0, Math.min(a3, KNOCK_CFG.playerShoveSpeedMax - this.centerOfMass().vx * o2));
      for (let p3 of this.parts.values()) p3.body.applyLinearImpulse({ x: o2 * a3 * p3.spec.mass, y: 0 }, p3.body.getWorldCenter(), true);
      KNOCK_CFG.playerHitLock > 0 && (this.hitLock = Math.max(this.hitLock, KNOCK_CFG.playerHitLock));
      return;
    }
    let a2 = n2 / l2;
    for (let p2 of this.parts.values()) p2.body.applyLinearImpulse({ x: o2 * a2 * p2.spec.mass, y: (s2 + KNOCK_CFG.lift) * a2 * p2.spec.mass }, p2.body.getWorldCenter(), true);
    let cv2 = this.centerOfMass().vx;
    if (Math.abs(cv2) > KNOCK_CFG.maxSpeed) {
      let m2 = KNOCK_CFG.maxSpeed / Math.abs(cv2);
      for (let p2 of this.parts.values()) {
        let v2 = p2.body.getLinearVelocity();
        p2.body.setLinearVelocity({ x: v2.x * m2, y: v2.y });
      }
    }
    let h2 = clamp((r2 - this.lowestFootY()) / 1.6, 0, 1.6), w2 = -o2 * clamp(n2 * KNOCK_CFG.tumble * h2, 0, KNOCK_CFG.maxTumble), g2 = this.torsoBody;
    g2.setAngularVelocity(clamp(g2.getAngularVelocity() + w2, -KNOCK_CFG.maxTumble * 1.5, KNOCK_CFG.maxTumble * 1.5));
    if (n2 >= KNOCK_CFG.staggerMin) {
      this.stagger(clamp(KNOCK_CFG.staggerBase + n2 * KNOCK_CFG.staggerPerImpulse, 0, KNOCK_CFG.staggerMax));
      this.strength = 0;
    }
    this.hitLock = Math.max(this.hitLock, KNOCK_CFG.hitLock);
    this.slide = false, this.slideV = this.centerOfMass().vx;
  }
  tryRecover(e2) {
    if (this.isStanding()) this.stuckTime = 0, this.rightingBoost = 1;
    if (this.carriedBy || !this.autoRecover || !this.alive || this.recovering) return;
    if (!this.isDown() && (this.isStanding() || !this.touchingGround)) return;
    this.stuckTime += e2;
    if (this.downTime > RECOVER_CFG.autoGetUpDelay && this.kipUp()) {
      this.onGetUp && this.onGetUp();
      return;
    }
    if (this.stuckTime > RECOVER_CFG.stuckTime) {
      this.stuckTime = 0, this.recoverTimer = RECOVER_CFG.rightingTime * RECOVER_CFG.escalateRighting, this.recoverCooldown = RECOVER_CFG.cooldown, this.downTime = 0, this.staggerTimer = 0, this.strength = 1, this.rightingBoost = RECOVER_CFG.escalateTorque;
      this.launchUp(RECOVER_CFG.hopSpeed * RECOVER_CFG.escalateHop);
      this.onGetUp && this.onGetUp();
    }
  }
  drip(e2, t2) {
    this.dripTime = Math.max(this.dripTime, e2), this.dripDps = Math.max(this.dripDps, t2);
  }
  flash(e2, t2 = 0.14) {
    let n2 = this.parts.get(e2);
    n2 && (n2.flash = t2);
  }
  kill(e2) {
    this.state !== `dead` && (this.state = `dead`, this.hp = 0, this.corpseTimer = e2, this.recoverTimer = 0, this.recoverCooldown = 0);
  }
  setAim(e2) {
    this.aimPhi = e2;
  }
  setFacing(e2) {
    if ((e2 !== 1 && e2 !== -1) || e2 === this.facing) return;
    this.facing = e2, this.frontUpper = e2 > 0 ? `upperArmR` : `upperArmL`, this.frontLower = e2 > 0 ? `lowerArmR` : `lowerArmL`, this.backUpper = e2 > 0 ? `upperArmL` : `upperArmR`, this.backLower = e2 > 0 ? `lowerArmL` : `lowerArmR`, this.wantFacing = e2, this.faceCooldown = MOVE_CFG.turnCooldown;
    for (let t2 of this.joints) t2.joint.setLimits(e2 > 0 ? t2.lower : -t2.upper, e2 > 0 ? t2.upper : -t2.lower);
  }
  updateLocomotion(e2) {
    this.faceCooldown = Math.max(0, this.faceCooldown - e2);
    let t2 = this.moveAxis, n2 = t2 !== 0;
    n2 && (this.wantFacing = t2);
    let r2 = this.alive && !this.dazed && !this.recovering && !this.isDown() && this.strength >= 0.9 && !this.carriedBy;
    if (!r2 || this.hitLock > 0) {
      this.slide = false, this.slideV = this.centerOfMass().vx, this.walkBlend = approach(this.walkBlend, 0, 8 * e2);
      return;
    }
    this.grounded && this.isStanding() && this.wantFacing !== this.facing && this.faceCooldown <= 0 && this.setFacing(this.wantFacing);
    if (!this.grounded) {
      if (n2) {
        let s2 = MOVE_CFG.airControl * e2, o2 = t2 * MOVE_CFG.walkSpeed * this.speedMul;
        for (let l2 of this.parts.values()) {
          let c2 = l2.body, u2 = c2.getLinearVelocity();
          c2.setLinearVelocity({ x: u2.x + clamp(o2 - u2.x, -s2, s2), y: u2.y });
        }
      }
      this.slide = false, this.slideV = this.centerOfMass().vx, this.walkBlend = approach(this.walkBlend, 0, 8 * e2);
      return;
    }
    let s2 = t2 * MOVE_CFG.walkSpeed * this.speedMul, o2 = (n2 ? MOVE_CFG.groundAccel : MOVE_CFG.brakeAccel) * e2;
    this.slideV += clamp(s2 - this.slideV, -o2, o2), this.slide = Math.abs(this.slideV) > 0.05 || n2;
    if (this.slide) {
      for (let p2 of [`torso`, `head`, `pelvis`]) if (Math.abs(this.parts.get(p2).body.getLinearVelocity().x - this.slideV) > MOVE_CFG.hitDeviation) {
        this.stagger(KNOCK_CFG.walkStagger), this.slide = false, this.slideV = this.centerOfMass().vx;
        return;
      }
    }
    if (this.slide) for (let l2 of this.parts.values()) {
      let c2 = l2.body, u2 = c2.getLinearVelocity();
      c2.setLinearVelocity({ x: this.slideV, y: u2.y });
    }
    this.walkBlend = approach(this.walkBlend, this.slide && Math.abs(this.slideV) > 0.3 ? 1 : 0, 8 * e2);
    Math.abs(this.slideV) > 0.3 && (this.gaitPhase += e2 * Math.abs(this.slideV) * MOVE_CFG.strideRate);
    let sh = Math.floor(this.gaitPhase / Math.PI);
    if (this.grounded && this.walkBlend > 0.4 && sh !== this.stepHalf) {
      this.stepHalf = sh;
      this.onStep && this.onStep(this);
    }
  }
  snapshot() {
    for (let e2 of this.parts.values()) {
      let t2 = e2.body.getPosition();
      e2.prevX = t2.x, e2.prevY = t2.y, e2.prevA = e2.body.getAngle();
    }
  }
  update(e2) {
    this.safeAir > 0 && (this.safeAir -= e2, this.landedFor = this.grounded ? this.landedFor + e2 : 0, this.landedFor > LAND_CFG.grace && (this.safeAir = 0));
    this.slimeTimer = Math.max(0, this.slimeTimer - e2), this.staggerTimer = Math.max(0, this.staggerTimer - e2), this.hitLock = Math.max(0, this.hitLock - e2), this.dripTime = Math.max(0, this.dripTime - e2), this.dripTime === 0 && (this.dripDps = 0);
    for (let t3 of this.parts.values()) {
      t3.flash = Math.max(0, t3.flash - e2);
      // Safety net against the 'tornado of chaos' (many hits / attached balls whipping light limbs): no part ever spins or flies faster than these limits.
      let b3 = t3.body, w3 = b3.getAngularVelocity();
      (w3 > KNOCK_CFG.maxPartSpin || w3 < -KNOCK_CFG.maxPartSpin) && b3.setAngularVelocity(clamp(w3, -KNOCK_CFG.maxPartSpin, KNOCK_CFG.maxPartSpin));
      let v3 = b3.getLinearVelocity(), s3 = Math.hypot(v3.x, v3.y);
      s3 > KNOCK_CFG.maxPartSpeed && b3.setLinearVelocity({ x: v3.x * KNOCK_CFG.maxPartSpeed / s3, y: v3.y * KNOCK_CFG.maxPartSpeed / s3 });
    }
    this.state === `dead` && (this.corpseTimer = Math.max(0, this.corpseTimer - e2)), this.recoverCooldown = Math.max(0, this.recoverCooldown - e2), this.tilt = wrapAngle(this.torsoBody.getAngle()), this.downTime = this.isDown() ? this.downTime + e2 : 0, this.recoverTimer = this.recoverTimer > 0 && this.grounded && Math.abs(this.tilt) < 0.35 ? 0 : Math.max(0, this.recoverTimer - e2);
    this.tryRecover(e2);
    let t2 = 1;
    this.state === `dead` ? t2 = 0 : this.recoverTimer > 0 ? t2 = 1 : (this.staggerTimer > 0 && (t2 = Math.min(t2, 0.6)), Math.abs(this.tilt) > Oo && (t2 = Math.min(t2, 0.4))),     this.strength = approach(this.strength, t2, (t2 < this.strength ? 6 : 2.2) * e2),     this.recoverTimer > 0 && this.state === `alive` && !this.carriedBy ? this.applyRightingTorque() : this.state === `alive` && this.staggerTimer <= 0 && !this.carriedBy && (this.grounded ? this.applyBalanceAssist() : this.applyAirStability());
    this.updateLocomotion(e2);
    let n2 = this.state === `alive` && this.heightAboveFeet() < Ao, r2 = 0;
    if (!n2) {
      let e3 = this.centerOfMass(), t3 = this.parts.get(`footL`).body.getPosition(), n3 = this.parts.get(`footR`).body.getPosition();
      r2 = clamp(To * (e3.x - (t3.x + n3.x) / 2) + Eo * e3.vx, -0.3, Do);
    }
    this.targets.set(`torso`, 0), this.targets.set(`head`, 0);
    let i2 = this.aimPhi !== null && this.state === `alive`, a2 = this.state === `alive` && Math.abs(this.tilt) > ko && !i2;
    this.targets.set(this.frontUpper, i2 ? this.aimPhi : a2 ? 0 : jo.upperFront), this.targets.set(this.frontLower, i2 ? this.aimPhi : a2 ? 0 : jo.lowerFront), this.targets.set(this.backUpper, a2 ? 0 : jo.upperBack), this.targets.set(this.backLower, a2 ? 0 : jo.lowerBack);
    for (let e3 of this.joints) {
      let t3 = this.parts.get(e3.parent).body.getAngle(), i3;
      switch (e3.child) {
        case `footL`:
        case `footR`:
          i3 = n2 ? this.parts.get(e3.child).body.getAngle() : -r2;
          break;
        case `thighL`:
        case `thighR`: {
          let w3 = Math.sin(this.gaitPhase + (e3.child === `thighL` ? 0 : Math.PI)), w4 = this.facing * MOVE_CFG.strideAmp * w3;
          i3 = (n2 ? -t3 : 0) * (1 - this.walkBlend) + w4 * this.walkBlend;
          break;
        }
        case `shinL`:
        case `shinR`: {
          let w3 = Math.sin(this.gaitPhase + (e3.child === `shinL` ? 0 : Math.PI)), w4 = (this.facing > 0 ? -MOVE_CFG.kneeAmp : MOVE_CFG.kneeAmp) * Math.max(0, w3);
          i3 = w4 * this.walkBlend;
          break;
        }
        default:
          i3 = (this.targets.get(e3.child) ?? 0) - t3;
      }
      let a3 = wrapAngle(i3 - e3.joint.getJointAngle());
      e3.joint.setMotorSpeed(clamp(Co * a3, -16, wo)), e3.joint.setMaxMotorTorque(e3.torque * this.strength);
    }
  }
  heightAboveFeet() {
    return this.torsoBody.getPosition().y - this.lowestFootY();
  }
  lowestFootY() {
    return Math.min(this.parts.get(`footL`).body.getPosition().y, this.parts.get(`footR`).body.getPosition().y);
  }
  applyRightingTorque() {
    for (let e2 of [`torso`, `pelvis`]) {
      let t2 = this.parts.get(e2).body, n2 = clamp(-wrapAngle(t2.getAngle()) * 55 - t2.getAngularVelocity() * 12, -RECOVER_CFG.rightingTorque * this.rightingBoost, RECOVER_CFG.rightingTorque * this.rightingBoost);
      t2.applyTorque(n2, true);
    }
  }
  applyBalanceAssist() {
    let e2 = this.parts.get(`pelvis`).body, t2 = wrapAngle(e2.getAngle());
    let n2 = clamp(-t2 * BALANCE_CFG.kp - e2.getAngularVelocity() * BALANCE_CFG.kd, -BALANCE_CFG.maxTorque, BALANCE_CFG.maxTorque);
    e2.applyTorque(n2, true);
  }
  applyAirStability() {
    let e2 = this.parts.get(`pelvis`).body, t2 = clamp(-wrapAngle(e2.getAngle()) * 45 - e2.getAngularVelocity() * 9, -70, 70);
    e2.applyTorque(t2, true);
  }
  centerOfMass() {
    let e2 = 0, t2 = 0, n2 = 0;
    for (let r2 of this.parts.values()) {
      if (r2.spec.name.startsWith(`upperArm`) || r2.spec.name.startsWith(`lowerArm`)) continue;
      let i2 = r2.spec.mass;
      e2 += i2, t2 += r2.body.getPosition().x * i2, n2 += r2.body.getLinearVelocity().x * i2;
    }
    return { x: t2 / e2, vx: n2 / e2 };
  }
  launchUp(e2) {
    this.safeAir = LAND_CFG.maxAir, this.landedFor = 0;
    for (let t2 of this.parts.values()) t2.body.applyLinearImpulse({ x: 0, y: e2 * t2.spec.mass }, t2.body.getPosition(), true);
  }
  destroy(e2) {
    this.footContacts = 0, this.bodyContacts = 0;
    for (let t2 of this.parts.values()) e2.removeBody(t2.body);
  }
}, No = `#8dff5a`, Po = `#e9ffd6`, SlimeSystem = class {
  constructor(e2) {
    this.puddles = [], this.gums = [], this.effects = e2;
  }
  addPuddle(e2, t2, n2, r2, i2 = SLIME_CFG.puddleFriction, a2 = false) {
    for (; this.puddles.length >= SLIME_CFG.maxPuddles; ) this.removePuddle(this.puddles[0]);
    let o2 = Math.max(0.3, n2 * randRange(0.75, 1)), c2 = SLIME_CFG.puddleThickness / 2, l2 = { body: e2, fixture: null, x: t2.x, y: t2.y, halfW: o2, life: r2, maxLife: r2, friction: i2, glue: a2, seed: Math.random() * 10, alive: true }, u2 = { kind: `puddle`, puddle: l2 }, f2 = e2.getLocalPoint({ x: t2.x, y: t2.y + c2 });
    l2.fixture = e2.createFixture(new BoxShape(o2, c2, f2, 0), { friction: i2, restitution: 0, userData: u2 }), this.puddles.push(l2), this.effects.ring(t2.x, t2.y, a2 ? `#ffe0a0` : Po, 6);
  }
  removePuddle(e2) {
    if (!e2.alive) return;
    e2.alive = false, e2.fixture && e2.body.destroyFixture(e2.fixture), e2.fixture = null;
    let t2 = this.puddles.indexOf(e2);
    t2 >= 0 && this.puddles.splice(t2, 1);
  }
  update(e2) {
    for (let t2 of this.puddles.slice()) t2.life -= e2, t2.life <= 0 && this.removePuddle(t2);
    for (let t2 of this.gums.slice()) t2.life -= e2, t2.jiggle *= Math.exp(-2.2 * e2), t2.life <= 0 && this.removeGum(t2);
  }
  addGum(e2, t2, n2, r2, i2) {
    let a2 = e2.parts.get(t2)?.body;
    if (!a2) return;
    for (; this.gums.length >= SLIME_CFG.maxGums; ) this.removeGum(this.gums[0]);
    // Owner bug 'tornado of chaos': dozens of heavy colliding balls on one enemy flung it around. Cap per host and per part (oldest goes first); gums are light sensors, they never act as wrecking balls.
    for (; this.gums.filter((g3) => g3.host === e2 && g3.part === t2).length >= SLIME_CFG.maxGumsPerPart; ) this.removeGum(this.gums.find((g3) => g3.host === e2 && g3.part === t2));
    for (; this.gums.filter((g3) => g3.host === e2).length >= SLIME_CFG.maxGumsPerHost; ) this.removeGum(this.gums.find((g3) => g3.host === e2));
    let o2 = a2.getWorld(), c2 = o2.createBody({ type: `dynamic`, position: { x: n2.x, y: n2.y }, linearDamping: 1.5, angularDamping: 2 }), l2 = { body: c2, host: e2, part: t2, radius: r2, life: i2, seed: Math.random() * 10, jiggle: 1, prevX: n2.x, prevY: n2.y, alive: true }, u2 = { kind: `gum`, gum: l2 };
    c2.createFixture(new CircleShape(r2), { density: SLIME_CFG.gumDensity, friction: 0.9, restitution: 0.05, isSensor: true, filterGroupIndex: -e2.id, userData: u2 }), o2.createJoint(new Ri({ frequencyHz: 5, dampingRatio: 0.35 }, a2, c2, n2)), this.gums.push(l2);
  }
  removeGum(e2) {
    if (!e2.alive) return;
    e2.alive = false, e2.body.getWorld().destroyBody(e2.body);
    let t2 = this.gums.indexOf(e2);
    t2 >= 0 && this.gums.splice(t2, 1);
  }
  snapshot() {
    for (let e2 of this.gums) {
      let t2 = e2.body.getPosition();
      e2.prevX = t2.x, e2.prevY = t2.y;
    }
  }
  splat(e2, t2, n2, r2, i2, a2, o2) {
    this.effects.burst(e2.x, e2.y, No, 22, 7.5, -t2.x, -t2.y), this.effects.burst(e2.x, e2.y, Po, 6, 4, -t2.x, -t2.y);
    for (let t3 of i2) {
      if (t3 === o2 || !t3.alive) continue;
      let i3 = false;
      for (let r3 of t3.parts.values()) {
        let t4 = r3.body.getPosition();
        if (Math.hypot(t4.x - e2.x, t4.y - e2.y) <= n2 + 0.3) {
          i3 = true;
          break;
        }
      }
      i3 && t3.coat(r2);
    }
    for (let t3 of a2) {
      let i3 = t3.body.getPosition();
      Math.hypot(i3.x - e2.x, i3.y - e2.y) <= n2 + t3.size && t3.coat(r2);
    }
  }
}, Io = -5.5, Lo = 10.5, Camera = class {
  constructor() {
    this.x = 0, this.y = 3, this.scale = 55, this.viewW = 800, this.viewH = 600, this.trauma = 0, this.shakeX = 0, this.shakeY = 0, this.initialized = false, this.shakeMode = `normal`, this.zoom = 0.85, this.zoomDisplayTimer = 0;
  }
  setViewport(e2, t2) {
    this.viewW = e2, this.viewH = t2;
  }
  addTrauma(e2) {
    if (this.shakeMode === `off`) return;
    this.trauma = Math.min(0.7, this.trauma + e2 * (1 - this.trauma / 0.7));
  }
  frame(e2, t2, r3) {
    let n2 = -4, r2 = 4, i2 = 3.4, a2, o2, s2, c2, u2;
    if (r3) {
      let dw = r3.w || 24, dh = r3.h || 7;
      s2 = clamp(Math.min(this.viewW / 18, this.viewH / dh), 12, 110);
      let halfView = this.viewW / (2 * s2), px = t2 && t2[0] ? t2[0].x : dw / 2;
      c2 = halfView * 2 >= dw ? dw / 2 : clamp(px, halfView, dw - halfView);
      u2 = dh / 2;
    } else {
      if (t2.length > 0) {
        n2 = 1 / 0, r2 = -1 / 0;
        for (let e3 of t2) n2 = Math.min(n2, e3.x - 2.2), r2 = Math.max(r2, e3.x + 2.2), i2 = Math.max(i2, e3.y + 1.2);
      }
      a2 = Math.max(r2 - n2, 20), o2 = Math.max(i2 - Io, Lo), s2 = clamp(Math.min(this.viewW / a2, this.viewH / o2), 12, 110), c2 = (n2 + r2) / 2, u2 = Io + o2 / 2;
    }
    s2 = clamp(s2 * this.zoom, 12, 110);
    let f2 = this.initialized ? smoothFactor(3.2, e2) : 1;
    this.initialized = true, this.x += (c2 - this.x) * f2, this.y += (u2 - this.y) * f2, this.scale += (s2 - this.scale) * f2, this.trauma = Math.max(0, this.trauma - e2 * 2.4);
    if (this.shakeMode === `off`) {
      this.shakeX = 0;
      this.shakeY = 0;
    } else {
      const factor = this.shakeMode === `low` ? 0.5 : 1;
      let p2 = this.trauma * this.trauma * 0.32 * factor;
      this.shakeX = p2 * randRange(-1, 1);
      this.shakeY = p2 * randRange(-1, 1);
    }
    if (this.zoomDisplayTimer > 0) this.zoomDisplayTimer -= e2;
  }
  apply(e2, t2) {
    let n2 = this.scale * t2;
    e2.setTransform(n2, 0, 0, -n2, t2 * (this.viewW / 2 - this.x * this.scale + this.shakeX * this.scale), t2 * (this.viewH / 2 + this.y * this.scale + this.shakeY * this.scale));
  }
  toScreen(e2) {
    return { x: this.viewW / 2 + (e2.x - this.x) * this.scale + this.shakeX * this.scale, y: this.viewH / 2 - (e2.y - this.y) * this.scale + this.shakeY * this.scale };
  }
  toWorld(e2) {
    return { x: this.x + (e2.x - this.viewW / 2) / this.scale, y: this.y - (e2.y - this.viewH / 2) / this.scale };
  }
  get pxPerMeter() {
    return this.scale;
  }
}, zo = 520, Bo = 24, Vo = 9.8, Effects = class {
  constructor() {
    this.particles = [], this.texts = [], this.shockwaves = [], this.beams = [], this.screenFlash = 0, this.nextParticle = 0, this.nextText = 0;
    for (let e2 = 0; e2 < zo; e2++) this.particles.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 0.05, color: `#fff` });
    for (let e2 = 0; e2 < Bo; e2++) this.texts.push({ alive: false, x: 0, y: 0, life: 0, maxLife: 1, text: ``, color: `#fff`, size: 18 });
  }
  acquire() {
    let e2 = this.particles[this.nextParticle];
    return this.nextParticle = (this.nextParticle + 1) % zo, e2;
  }
  burst(e2, t2, n2, r2, i2, a2 = 0, o2 = 1) {
    let s2 = Math.atan2(o2, a2);
    for (let a3 = 0; a3 < r2; a3++) {
      let r3 = this.acquire(), a4 = s2 + randRange(-1.1, 1.1), o3 = i2 * randRange(0.45, 1.1);
      r3.alive = true, r3.x = e2, r3.y = t2, r3.vx = Math.cos(a4) * o3, r3.vy = Math.sin(a4) * o3, r3.maxLife = randRange(0.45, 0.9), r3.life = r3.maxLife, r3.size = randRange(0.03, 0.09), r3.color = n2;
    }
  }
  ring(e2, t2, n2, r2 = 8) {
    for (let i2 = 0; i2 < r2; i2++) {
      let a2 = this.acquire(), o2 = i2 / r2 * TAU;
      a2.alive = true, a2.x = e2, a2.y = t2, a2.vx = Math.cos(o2) * 1.8, a2.vy = Math.sin(o2) * 1.8, a2.maxLife = 0.3, a2.life = 0.3, a2.size = 0.05, a2.color = n2;
    }
  }
  text(e2, t2, n2, r2, i2 = 18) {
    let a2 = this.texts[this.nextText];
    this.nextText = (this.nextText + 1) % Bo, a2.alive = true, a2.x = e2, a2.y = t2, a2.text = n2, a2.color = r2, a2.size = i2, a2.maxLife = i2 > 24 ? 1.3 : 0.9, a2.life = a2.maxLife;
  }
  splatter(e2, t2, n2, r2, i2) {
    for (let a2 = 0; a2 < r2; a2++) {
      let r3 = this.acquire(), a3 = randRange(0, TAU), o2 = i2 * randRange(0.35, 1);
      r3.alive = true, r3.x = e2, r3.y = t2, r3.vx = Math.cos(a3) * o2, r3.vy = Math.sin(a3) * o2 + i2 * 0.35, r3.maxLife = randRange(0.8, 1.4), r3.life = r3.maxLife, r3.size = randRange(0.09, 0.2), r3.color = n2;
    }
  }
  shockwave(e2, t2, n2, r2, i2 = 0.45) {
    this.shockwaves.push({ x: e2, y: t2, maxR: r2, life: i2, maxLife: i2, color: n2 });
  }
  beam(e2, t2, n2, r2 = 0.7) {
    this.beams.push({ x: e2, y: t2, life: r2, maxLife: r2, color: n2 });
    for (let r3 = 0; r3 < 18; r3++) {
      let r4 = this.acquire();
      r4.alive = true, r4.x = e2 + randRange(-0.35, 0.35), r4.y = t2 + randRange(0, 2.2), r4.vx = randRange(-0.3, 0.3), r4.vy = randRange(4, 9), r4.maxLife = randRange(0.4, 0.8), r4.life = r4.maxLife, r4.size = randRange(0.03, 0.07), r4.color = n2;
    }
  }
  flash(e2) {
    this.screenFlash = Math.max(this.screenFlash, e2);
  }
  update(e2) {
    for (let t2 of this.particles) t2.alive && (t2.life -= e2, t2.life <= 0 ? t2.alive = false : (t2.vy -= Vo * e2, t2.vx *= 1 - 1.2 * e2, t2.x += t2.vx * e2, t2.y += t2.vy * e2));
    for (let t2 of this.texts) t2.alive && (t2.life -= e2, t2.y += 0.9 * e2, t2.life <= 0 && (t2.alive = false));
    for (let t2 = this.shockwaves.length - 1; t2 >= 0; t2--) {
      let n2 = this.shockwaves[t2];
      n2.life -= e2, n2.life <= 0 && this.shockwaves.splice(t2, 1);
    }
    for (let t2 = this.beams.length - 1; t2 >= 0; t2--) {
      let n2 = this.beams[t2];
      n2.life -= e2, n2.life <= 0 && this.beams.splice(t2, 1);
    }
    this.screenFlash = Math.max(0, this.screenFlash - e2 * 3.5);
  }
  clear() {
    for (let e2 of this.particles) e2.alive = false;
    for (let e2 of this.texts) e2.alive = false;
    this.shockwaves.length = 0, this.beams.length = 0, this.screenFlash = 0;
  }
}, Uo = { look: `orb`, radius: 0.16, mass: 0.9, restitution: 0.15, drag: 0.03, damageMul: 1, splatMul: 1, puddleMul: 1, puddleLifeMul: 1, bounces: 0, dripTime: 0, dripDps: 0, splitCount: 0, lift: 0, liftTime: 0, homing: 0, boomerang: 0, pierce: false, fuse: 0, explode: null, well: null, glue: 0, color: `#8dff5a` }, Wo = { ...Uo, look: `bomb`, radius: 0.12, mass: 0.5, restitution: 0.2, damageMul: 0.2, fuse: 0.45, explode: { radius: 1.3, impulse: 60, damage: 11, clusterCount: 0, clusterShot: null }, color: `#ff9a7a` }, Go = { ...Uo, radius: 0.08, mass: 0.2, restitution: 0.3, damageMul: 0.45, splatMul: 0.5, puddleMul: 0.5 };
function Ko(e2) {
  return { ...Uo, ...e2 };
}
var WEAPONS = [{ id: `hands`, name: `Bare Hands`, blurb: `Squeeze a blob, wind up, throw.`, badge: `Starter`, color: `#8dff5a`, price: 0, cooldown: 0.42, shots: 1, spread: 0, speedMul: 1, shot: Ko({ look: `orb`, color: `#8dff5a` }), launcher: { kind: `hand`, length: 0, width: 0, color: `#8dff5a`, accent: `#4fbf2a` } }, { id: `spray`, name: `Triple Spray`, blurb: `Three blobs in a fan.`, badge: `3 shots`, color: `#5ef2c2`, price: 80, cooldown: 0.8, shots: 3, spread: 0.12, speedMul: 0.95, shot: Ko({ look: `orb`, radius: 0.11, mass: 0.45, damageMul: 0.6, splatMul: 0.7, color: `#5ef2c2` }), launcher: { kind: `nozzle`, length: 0.6, width: 0.28, color: `#3fb89a`, accent: `#1f6d5c` } }, { id: `squirt`, name: `Rapid Squirt`, blurb: `Fast, light, relentless.`, badge: `Rapid`, color: `#b6ff8a`, price: 90, cooldown: 0.22, shots: 1, spread: 0, speedMul: 1.15, shot: Ko({ look: `drop`, radius: 0.1, mass: 0.3, restitution: 0.1, damageMul: 0.45, splatMul: 0.6, color: `#b6ff8a` }), launcher: { kind: `bulb`, length: 0.5, width: 0.22, color: `#d8ff9e`, accent: `#6fb53a` } }, { id: `heavy`, name: `Heavy Glob`, blurb: `Slow, huge, knocks flat.`, badge: `Knockback`, color: `#3fd16b`, price: 120, cooldown: 1.3, shots: 1, spread: 0, speedMul: 0.8, shot: Ko({ look: `mass`, radius: 0.3, mass: 3.2, restitution: 0.05, damageMul: 1.9, splatMul: 1.3, puddleMul: 1.2, color: `#3fd16b` }), launcher: { kind: `barrel`, length: 0.8, width: 0.36, color: `#2f8f57`, accent: `#1b5a36` } }, { id: `balloon`, name: `Balloon Glob`, blurb: `Floats, then drops.`, badge: `Floats`, color: `#ffd1f0`, price: 130, cooldown: 1, shots: 1, spread: 0, speedMul: 0.9, shot: Ko({ look: `balloon`, radius: 0.2, mass: 0.6, restitution: 0.2, drag: 0.15, damageMul: 0.7, lift: 0.92, liftTime: 2.4, color: `#ffd1f0` }), launcher: { kind: `bundle`, length: 0.5, width: 0.3, color: `#ffd1f0`, accent: `#ff7fcc` } }, { id: `clinger`, name: `Clinger`, blurb: `Sticks and drips.`, badge: `Drips`, color: `#ff7ad9`, price: 140, cooldown: 0.9, shots: 1, spread: 0, speedMul: 1, shot: Ko({ look: `spiky`, restitution: 0.05, damageMul: 0.8, dripTime: 4, dripDps: 3.2, color: `#ff7ad9` }), launcher: { kind: `tube`, length: 0.6, width: 0.16, color: `#b64b9c`, accent: `#6b2a5e` } }, { id: `sniper`, name: `Sniper Glob`, blurb: `Thin, fast, precise.`, badge: `Precise`, color: `#c8ff3d`, price: 150, cooldown: 1.5, shots: 1, spread: 0, speedMul: 1.6, shot: Ko({ look: `streak`, radius: 0.12, mass: 0.6, restitution: 0.02, drag: 0, damageMul: 2.2, splatMul: 0.5, color: `#c8ff3d` }), launcher: { kind: `scope`, length: 1, width: 0.13, color: `#2a3450`, accent: `#c8ff3d` } }, { id: `glue`, name: `Glue Trap`, blurb: `Puddles that grip.`, badge: `Sticky`, color: `#ffc65c`, price: 150, cooldown: 1.1, shots: 1, spread: 0, speedMul: 1, shot: Ko({ look: `drop`, puddleMul: 1.3, damageMul: 0.3, glue: 2.6, color: `#ffc65c` }), launcher: { kind: `tank`, length: 0.55, width: 0.2, color: `#e09a2a`, accent: `#8a5a18` } }, { id: `bouncer`, name: `Bouncer`, blurb: `Bounces off floors and crates.`, badge: `Bounce \xD74`, color: `#f5ff6b`, price: 110, cooldown: 0.7, shots: 1, spread: 0, speedMul: 1, shot: Ko({ look: `ring`, radius: 0.17, mass: 0.8, restitution: 0.82, damageMul: 0.9, splatMul: 0.9, bounces: 4, color: `#f5ff6b` }), launcher: { kind: `emitter`, length: 0.5, width: 0.2, color: `#e5ef4a`, accent: `#8f9a1a` } }, { id: `splitter`, name: `Splitter`, blurb: `Bursts into four blobs.`, badge: `Split \xD74`, color: `#6ee7ff`, price: 160, cooldown: 0.9, shots: 1, spread: 0, speedMul: 1, shot: Ko({ look: `cracked`, restitution: 0.1, damageMul: 0.8, splitCount: 4, color: `#6ee7ff` }), launcher: { kind: `twin`, length: 0.7, width: 0.16, color: `#6ee7ff`, accent: `#2aa9d0` } }, { id: `seeker`, name: `Seeker`, blurb: `Curves toward enemies.`, badge: `Homing`, color: `#ff9f5a`, price: 190, cooldown: 1, shots: 1, spread: 0, speedMul: 0.9, shot: Ko({ look: `seeker`, radius: 0.15, mass: 0.7, damageMul: 0.9, homing: 9, color: `#ff9f5a` }), launcher: { kind: `scope`, length: 0.7, width: 0.14, color: `#7a3a2a`, accent: `#ff9f5a` } }, { id: `boomerang`, name: `Boomerang`, blurb: `Returns, hitting all it passes.`, badge: `Returns`, color: `#9bffea`, price: 170, cooldown: 1.2, shots: 1, spread: 0, speedMul: 1.1, shot: Ko({ look: `boomerang`, radius: 0.16, mass: 0.7, restitution: 0.3, damageMul: 0.7, bounces: 99, pierce: true, boomerang: 0.9, lift: 0.8, liftTime: 3, color: `#9bffea` }), launcher: { kind: `bow`, length: 0.8, width: 0.12, color: `#5ec9b1`, accent: `#2a7d6e` } }, { id: `grenade`, name: `Fuse Grenade`, blurb: `Explodes on impact or fuse.`, badge: `Blast`, color: `#ffb04a`, price: 175, cooldown: 1.1, shots: 1, spread: 0, speedMul: 0.85, shot: Ko({ look: `bomb`, radius: 0.19, mass: 1, restitution: 0.2, damageMul: 0.3, fuse: 1.4, explode: { radius: 2.4, impulse: 110, damage: 26, clusterCount: 0, clusterShot: null }, color: `#ffb04a` }), launcher: { kind: `mortar`, length: 0.55, width: 0.3, color: `#5a4636`, accent: `#ffb04a` } }, { id: `cluster`, name: `Cluster Bomb`, blurb: `Scatters five bomblets.`, badge: `Cluster`, color: `#ff7a7a`, price: 230, cooldown: 1.6, shots: 1, spread: 0, speedMul: 0.9, shot: Ko({ look: `cluster`, radius: 0.2, mass: 1.2, restitution: 0.2, damageMul: 0.2, fuse: 1.2, explode: { radius: 1.8, impulse: 90, damage: 12, clusterCount: 5, clusterShot: Wo }, color: `#ff7a7a` }), launcher: { kind: `mortar`, length: 0.7, width: 0.36, color: `#6a3f3f`, accent: `#ff7a7a` } }, { id: `well`, name: `Gravity Well`, blurb: `Pulls bodies in.`, badge: `Gravity`, color: `#b47aff`, price: 240, cooldown: 1.8, shots: 1, spread: 0, speedMul: 0.9, shot: Ko({ look: `orb`, radius: 0.2, mass: 1, restitution: 0.05, damageMul: 0.2, well: { time: 3.2, radius: 3.4, strength: 60 }, color: `#b47aff` }), launcher: { kind: `emitter`, length: 0.5, width: 0.26, color: `#7a4fd6`, accent: `#d7c2ff` } }, { id: `bomb`, name: `Puddle Bomb`, blurb: `Huge, lasting puddles.`, badge: `Big puddle`, color: `#ffb36b`, price: 180, cooldown: 1.4, shots: 1, spread: 0, speedMul: 1, shot: Ko({ look: `drop`, radius: 0.2, mass: 1.2, restitution: 0.05, damageMul: 0.6, puddleMul: 2.2, puddleLifeMul: 1.6, color: `#ffb36b` }), launcher: { kind: `barrel`, length: 0.45, width: 0.34, color: `#d9824a`, accent: `#7a3f1c` } }, { id: `cannon`, name: `Slime Cannon`, blurb: `Heavy blob, wide splat.`, badge: `Heavy`, color: `#c49bff`, price: 200, cooldown: 1.7, shots: 1, spread: 0, speedMul: 1.35, shot: Ko({ look: `orb`, radius: 0.22, mass: 2.2, restitution: 0.1, damageMul: 1.4, splatMul: 1.5, puddleMul: 1.3, color: `#c49bff` }), launcher: { kind: `barrel`, length: 0.9, width: 0.34, color: `#7b5ab8`, accent: `#c49bff` } }], Jo = { kind: `tube`, length: 0.6, width: 0.16, color: `#7a4a4a`, accent: `#c77dff` };
function weaponById(e2) {
  let t2 = WEAPONS.find((t3) => t3.id === e2);
  if (!t2) throw Error(`Unknown weapon ${e2}`);
  return t2;
}
var WEAPON_COLORS = Object.fromEntries(WEAPONS.map((e2) => [e2.id, e2.color]));
var ENEMY_WEAPON_POOLS = { 1: [`squirt`, `spray`, `hands`], 2: [`heavy`, `bouncer`, `sniper`], 3: [`balloon`, `clinger`, `glue`, `splitter`], 4: [`seeker`, `boomerang`, `grenade`], 5: [`cluster`, `bomb`, `cannon`, `well`] }, ENEMY_WEAPON_CFG = { damageMulBase: 0.55, damageMulPerLevel: 0.04, damageMulMax: 1, damageMulMaxLevel: 12, reloadMul: 2.4, reloadMin: 1.2, reloadMax: 4 };
function enemyWeaponDamageMul(level) {
  if (level >= ENEMY_WEAPON_CFG.damageMulMaxLevel) return ENEMY_WEAPON_CFG.damageMulMax;
  return Math.min(ENEMY_WEAPON_CFG.damageMulMax, ENEMY_WEAPON_CFG.damageMulBase + ENEMY_WEAPON_CFG.damageMulPerLevel * Math.max(0, level - 1));
}
function enemyWeaponPool(level) {
  let n2 = Math.max(1, Math.min(5, level)), r2 = [...ENEMY_WEAPON_POOLS[1]];
  for (let t2 = 2; t2 <= n2; t2++) r2.push(...ENEMY_WEAPON_POOLS[t2]);
  return n2 >= 2 ? r2.filter((t2) => t2 !== `hands`) : r2;
}
function pickEnemyWeapon(level, takenIds = [], rng = Math.random) {
  let e2 = enemyWeaponPool(level), t2 = e2.filter((n2) => !takenIds.includes(n2)), n3 = t2.length ? t2 : e2;
  return n3[Math.min(n3.length - 1, Math.floor(rng() * n3.length))];
}
function enemyWeaponShot(weapon, level) {
  let e2 = enemyWeaponDamageMul(level), t2 = { ...weapon.shot, color: weapon.color, damageMul: weapon.shot.damageMul * e2 };
  return t2.explode && (t2.explode = { ...t2.explode }, t2.explode.clusterShot && (t2.explode.clusterShot = { ...t2.explode.clusterShot, color: weapon.color, damageMul: (t2.explode.clusterShot.damageMul ?? 1) * e2 })), t2;
}
var UPGRADES = [{ id: `power`, name: `Launch Power`, blurb: `+16% speed`, basePrice: 40, priceStep: 30 }, { id: `splat`, name: `Splat Radius`, blurb: `+30% radius`, basePrice: 40, priceStep: 30 }, { id: `duration`, name: `Slime Duration`, blurb: `+40% time`, basePrice: 45, priceStep: 30 }, { id: `maxHp`, name: `Max Health`, blurb: `+20 health`, basePrice: 50, priceStep: 30 }, { id: `armor`, name: `Armor`, blurb: `-8% damage taken`, basePrice: 55, priceStep: 35 }, { id: `reload`, name: `Quick Reload`, blurb: `-8% cooldowns`, basePrice: 50, priceStep: 35 }, { id: `grip`, name: `Grip Boots`, blurb: `16% less slip`, basePrice: 60, priceStep: 35 }, { id: `iron`, name: `Iron Stance`, blurb: `-12% stagger`, basePrice: 50, priceStep: 30 }, { id: `bounty`, name: `Bounty`, blurb: `+25% coins`, basePrice: 70, priceStep: 40 }], Zo = { price: 45, heal: 35 };
function Qo(e2) {
  let t2 = UPGRADES.find((t3) => t3.id === e2);
  if (!t2) throw Error(`Unknown upgrade ${e2}`);
  return t2;
}
function $o(e2, t2) {
  return e2.basePrice + e2.priceStep * t2;
}
var FORTRESS_ITEMS = [{ id: `brick`, name: `Brick`, blurb: `Cheap, stackable cover.`, w: 1, h: 0.5, hp: 60, price: 15, unlock: 0, maxPlaced: 40, rotatable: true, damageTaken: 1, color: `#e07a52` }, { id: `metal`, name: `Metal Sheet`, blurb: `A tall, tough wall.`, w: 0.22, h: 1.6, hp: 160, price: 40, unlock: 120, maxPlaced: 16, rotatable: true, damageTaken: 0.6, color: `#a9b8c8` }, { id: `spikes`, name: `Spike Strip`, blurb: `Pops slime. Barely scratched.`, w: 1, h: 0.35, hp: 80, price: 35, unlock: 150, maxPlaced: 10, rotatable: false, damageTaken: 0.35, color: `#c9d3df` }, { id: `jelly`, name: `Jelly Pad`, blurb: `Bounces enemy slime back.`, w: 1, h: 0.45, hp: 70, price: 45, unlock: 180, maxPlaced: 8, rotatable: true, damageTaken: 0.3, color: `#ff7ad9` }, { id: `telescope`, name: `Telescope`, blurb: `Your aim line reaches twice as far.`, w: 0.55, h: 1, hp: 40, price: 80, unlock: 200, maxPlaced: 1, rotatable: false, damageTaken: 1, color: `#7a6cff` }, { id: `duck`, name: `Rubber Duck`, blurb: `Enemies keep shooting at it instead.`, w: 0.7, h: 0.7, hp: 50, price: 60, unlock: 250, maxPlaced: 2, rotatable: false, damageTaken: 1, color: `#ffd23f` }, { id: `cannon`, name: `Slime Cannon`, blurb: `Lobs slime at enemies on its own.`, w: 0.9, h: 0.7, hp: 90, price: 140, unlock: 350, maxPlaced: 3, rotatable: false, damageTaken: 1, color: `#5a6b8a` }], ts = FORTRESS_ITEMS.map((e2) => e2.id);
function fortressItem(e2) {
  let t2 = FORTRESS_ITEMS.find((t3) => t3.id === e2);
  if (!t2) throw Error(`Unknown fortress item ${e2}`);
  return t2;
}
function rs(e2) {
  return typeof e2 == `string` && FORTRESS_ITEMS.some((t2) => t2.id === e2);
}
function is(e2, t2) {
  let n2 = fortressItem(e2);
  return t2 === 1 ? { w: n2.h, h: n2.w } : { w: n2.w, h: n2.h };
}
var as = `#1d2638`, os = Math.PI * 2;
function ss(e2) {
  let t2 = parseInt(e2.slice(1), 16);
  return [t2 >> 16 & 255, t2 >> 8 & 255, t2 & 255];
}
function cs(e2, t2) {
  let [n2, r2, i2] = ss(e2);
  return `rgba(${n2},${r2},${i2},${t2})`;
}
function ls(e2, t2) {
  let [n2, r2, i2] = ss(e2);
  return `rgb(${Math.round(n2 * t2)},${Math.round(r2 * t2)},${Math.round(i2 * t2)})`;
}
function us(e2, t2, n2, r2, i2, a2 = 2.3, o2 = 0.42) {
  let s2 = e2.createRadialGradient(t2, n2, r2 * 0.3, t2, n2, r2 * a2);
  s2.addColorStop(0, cs(i2, o2)), s2.addColorStop(1, cs(i2, 0)), e2.fillStyle = s2, e2.beginPath(), e2.arc(t2, n2, r2 * a2, 0, os), e2.fill();
}
function ds(e2, t2, n2, r2, i2) {
  let a2 = e2.createRadialGradient(t2 - r2 * 0.35, n2 + r2 * 0.35, r2 * 0.05, t2, n2, r2);
  a2.addColorStop(0, `#ffffff`), a2.addColorStop(0.32, i2), a2.addColorStop(1, ls(i2, 0.5)), e2.beginPath(), e2.arc(t2, n2, r2, 0, os), e2.fillStyle = a2, e2.fill(), e2.lineWidth = r2 * 0.14, e2.strokeStyle = as, e2.stroke(), e2.beginPath(), e2.ellipse(t2 - r2 * 0.38, n2 + r2 * 0.4, r2 * 0.28, r2 * 0.16, 0.5, 0, os), e2.fillStyle = `rgba(255,255,255,0.75)`, e2.fill();
}
function fs(e2, t2) {
  let { x: n2, y: r2, r: i2, color: a2, time: o2 } = t2;
  switch (t2.look) {
    case `orb`:
      us(e2, n2, r2, i2, a2), ds(e2, n2, r2, i2, a2);
      return;
    case `mass`:
      us(e2, n2, r2, i2, a2, 2), ds(e2, n2, r2, i2, a2), e2.beginPath(), e2.ellipse(n2, r2 - i2 * 0.15, i2 * 0.95, i2 * 0.32, 0, Math.PI * 1.08, Math.PI * 1.92), e2.lineWidth = i2 * 0.2, e2.strokeStyle = `rgba(20,28,40,0.4)`, e2.stroke();
      return;
    case `drop`: {
      us(e2, n2, r2, i2, a2, 2.2, 0.35), e2.save(), e2.translate(n2, r2), e2.rotate(t2.angle);
      let o3 = e2.createLinearGradient(-i2, 0, i2 * 2, 0);
      o3.addColorStop(0, ls(a2, 0.6)), o3.addColorStop(0.5, a2), o3.addColorStop(1, `#ffffff`), e2.beginPath(), e2.moveTo(i2 * 2, 0), e2.bezierCurveTo(i2 * 1.2, i2 * 0.9, -i2 * 0.9, i2 * 1, -i2 * 0.9, 0), e2.bezierCurveTo(-i2 * 0.9, -i2 * 1, i2 * 1.2, -i2 * 0.9, i2 * 2, 0), e2.fillStyle = o3, e2.fill(), e2.lineWidth = i2 * 0.14, e2.strokeStyle = as, e2.stroke(), e2.beginPath(), e2.ellipse(-i2 * 0.1, i2 * 0.3, i2 * 0.3, i2 * 0.14, 0.2, 0, os), e2.fillStyle = `rgba(255,255,255,0.7)`, e2.fill(), e2.restore();
      return;
    }
    case `balloon`: {
      let t3 = r2 + i2 * 0.55;
      e2.beginPath(), e2.moveTo(n2, r2 - i2 * 0.5);
      for (let t4 = 1; t4 <= 4; t4++) {
        let a3 = r2 - i2 * 0.5 - t4 * i2 * 0.55;
        e2.lineTo(n2 + Math.sin(o2 * 4 + t4) * i2 * 0.22, a3);
      }
      e2.lineWidth = i2 * 0.08, e2.strokeStyle = `rgba(29,38,56,0.6)`, e2.stroke(), us(e2, n2, t3, i2, a2, 2.2, 0.3);
      let s2 = e2.createRadialGradient(n2 - i2 * 0.3, t3 + i2 * 0.35, i2 * 0.05, n2, t3, i2 * 1.05);
      s2.addColorStop(0, `#ffffff`), s2.addColorStop(0.35, a2), s2.addColorStop(1, ls(a2, 0.6)), e2.beginPath(), e2.ellipse(n2, t3, i2 * 0.85, i2 * 1.05, 0, 0, os), e2.fillStyle = s2, e2.fill(), e2.lineWidth = i2 * 0.12, e2.strokeStyle = as, e2.stroke(), e2.beginPath(), e2.moveTo(n2 - i2 * 0.18, r2 - i2 * 0.5), e2.lineTo(n2 + i2 * 0.18, r2 - i2 * 0.5), e2.lineTo(n2, r2 - i2 * 0.2), e2.closePath(), e2.fillStyle = a2, e2.fill(), e2.lineWidth = i2 * 0.08, e2.stroke();
      return;
    }
    case `spiky`:
      us(e2, n2, r2, i2, a2, 2.4);
      for (let t3 = 0; t3 < 6; t3++) {
        let s2 = t3 / 6 * os + o2 * 0.8;
        e2.beginPath(), e2.moveTo(n2 + Math.cos(s2) * i2 * 0.9, r2 + Math.sin(s2) * i2 * 0.9), e2.lineTo(n2 + Math.cos(s2) * i2 * 1.8, r2 + Math.sin(s2) * i2 * 1.8), e2.lineWidth = i2 * 0.24, e2.lineCap = `round`, e2.strokeStyle = as, e2.stroke(), e2.lineWidth = i2 * 0.12, e2.strokeStyle = a2, e2.stroke();
      }
      ds(e2, n2, r2, i2, a2);
      return;
    case `streak`: {
      e2.save(), e2.translate(n2, r2), e2.rotate(t2.angle);
      let o3 = e2.createLinearGradient(-i2 * 9, 0, i2 * 2.4, 0);
      o3.addColorStop(0, cs(a2, 0)), o3.addColorStop(1, cs(a2, 0.7)), e2.beginPath(), e2.moveTo(-i2 * 9, 0), e2.lineTo(i2 * 2.4, 0), e2.lineWidth = i2 * 0.9, e2.lineCap = `round`, e2.strokeStyle = o3, e2.stroke(), e2.beginPath(), e2.ellipse(0, 0, i2 * 2.6, i2 * 0.7, 0, 0, os), e2.fillStyle = `#ffffff`, e2.fill(), e2.lineWidth = i2 * 0.16, e2.strokeStyle = as, e2.stroke(), e2.restore();
      return;
    }
    case `ring`:
      us(e2, n2, r2, i2, a2, 2.1, 0.35), e2.beginPath(), e2.arc(n2, r2, i2 * 0.8, 0, os), e2.lineWidth = i2 * 0.5, e2.strokeStyle = as, e2.stroke(), e2.lineWidth = i2 * 0.3, e2.strokeStyle = a2, e2.stroke();
      for (let t3 = 0; t3 < 3; t3++) {
        let a3 = o2 * 6 + t3 * os / 3;
        e2.beginPath(), e2.arc(n2, r2, i2 * 0.8, a3, a3 + 0.6), e2.lineWidth = i2 * 0.12, e2.strokeStyle = `#ffffff`, e2.stroke();
      }
      return;
    case `cracked`: {
      us(e2, n2, r2, i2, a2), ds(e2, n2, r2, i2, a2), e2.beginPath();
      let o3 = t2.seed;
      for (let t3 = 0; t3 < 3; t3++) {
        let a3 = o3 + t3 * os / 3;
        e2.moveTo(n2, r2), e2.lineTo(n2 + Math.cos(a3) * i2 * 0.85, r2 + Math.sin(a3) * i2 * 0.85);
      }
      e2.lineWidth = i2 * 0.1, e2.strokeStyle = as, e2.stroke();
      return;
    }
    case `seeker`:
      e2.save(), e2.translate(n2, r2), e2.rotate(t2.angle), e2.beginPath(), e2.moveTo(-i2 * 0.6, i2 * 0.2), e2.lineTo(-i2 * 2.1, i2 * 1.2), e2.lineTo(-i2 * 1.6, 0), e2.lineTo(-i2 * 2.1, -i2 * 1.2), e2.lineTo(-i2 * 0.6, -i2 * 0.2), e2.closePath(), e2.fillStyle = ls(a2, 0.85), e2.fill(), e2.lineWidth = i2 * 0.12, e2.strokeStyle = as, e2.stroke(), e2.restore(), us(e2, n2, r2, i2, a2), ds(e2, n2, r2, i2, a2);
      return;
    case `boomerang`:
      us(e2, n2, r2, i2, a2, 2.4, 0.35), e2.save(), e2.translate(n2, r2), e2.rotate(o2 * 10), e2.lineCap = `round`, e2.beginPath(), e2.arc(0, 0, i2 * 1.5, -2.2, 1.2), e2.lineWidth = i2 * 1.05, e2.strokeStyle = as, e2.stroke(), e2.lineWidth = i2 * 0.78, e2.strokeStyle = a2, e2.stroke(), e2.beginPath(), e2.arc(0, 0, i2 * 1.5, -1.9, -0.5), e2.lineWidth = i2 * 0.18, e2.strokeStyle = `rgba(255,255,255,0.8)`, e2.stroke(), e2.restore();
      return;
    case `bomb`:
      ps(e2, n2, r2, i2, a2, o2, t2.fuse);
      return;
    case `cluster`:
      ps(e2, n2, r2, i2, a2, o2, t2.fuse);
      for (let t3 = 0; t3 < 3; t3++) {
        let s2 = o2 * 3 + t3 * os / 3;
        ds(e2, n2 + Math.cos(s2) * i2 * 1.7, r2 + Math.sin(s2) * i2 * 1.7, i2 * 0.34, a2);
      }
      return;
  }
}
function ps(e2, t2, n2, r2, i2, a2, o2) {
  us(e2, t2, n2, r2, i2, 2, 0.25);
  let s2 = e2.createRadialGradient(t2 - r2 * 0.35, n2 + r2 * 0.35, r2 * 0.05, t2, n2, r2);
  s2.addColorStop(0, `#8a98b8`), s2.addColorStop(1, `#1d2638`), e2.beginPath(), e2.arc(t2, n2, r2, 0, os), e2.fillStyle = s2, e2.fill(), e2.lineWidth = r2 * 0.14, e2.strokeStyle = as, e2.stroke(), e2.beginPath(), e2.arc(t2, n2, r2 * 0.98, 0.2, 1.6), e2.lineWidth = r2 * 0.1, e2.strokeStyle = i2, e2.stroke();
  let c2 = t2 + r2 * 0.2, l2 = n2 + r2 * 0.95;
  e2.beginPath(), e2.moveTo(c2, l2), e2.quadraticCurveTo(c2 + r2 * 0.3, l2 + r2 * 0.6, c2 + r2 * 0.7, l2 + r2 * 0.5), e2.lineWidth = r2 * 0.16, e2.strokeStyle = `#c8a16a`, e2.stroke();
  let u2 = o2 > 0 ? 18 + 14 * (1 - Math.min(1, o2 / 1.4)) : 10, d2 = 0.6 + 0.4 * Math.sin(a2 * u2);
  us(e2, c2 + r2 * 0.7, l2 + r2 * 0.5, r2 * 0.5, `#ffe27a`, 2.2, 0.8 * d2), e2.beginPath(), e2.arc(c2 + r2 * 0.7, l2 + r2 * 0.5, r2 * 0.22 * d2, 0, os), e2.fillStyle = `#fff6c2`, e2.fill();
}
function ms(e2, t2, n2, r2) {
  let { length: i2, width: a2, color: o2, accent: s2 } = t2;
  e2.save(), e2.translate(n2.x, n2.y), e2.rotate(Math.atan2(r2.y, r2.x)), e2.lineCap = `round`, e2.lineJoin = `round`, e2.strokeStyle = as;
  let c2 = (t3, n3, r3, i3, a3 = 0) => {
    e2.beginPath(), e2.roundRect(t3, a3 - r3 / 2, n3 - t3, r3, r3 / 2), e2.fillStyle = i3, e2.fill(), e2.lineWidth = 0.022, e2.stroke();
  };
  switch (t2.kind) {
    case `hand`:
      break;
    case `tube`:
      c2(-0.12, i2, a2, o2), c2(i2 * 0.78, i2 * 0.9, a2 * 1.2, s2);
      break;
    case `fork`:
      e2.beginPath(), e2.moveTo(-0.1, 0), e2.lineTo(i2 * 0.55, 0), e2.lineWidth = a2 * 0.7, e2.strokeStyle = o2, e2.stroke(), e2.beginPath(), e2.moveTo(i2 * 0.55, 0), e2.lineTo(i2, a2 * 1.6), e2.moveTo(i2 * 0.55, 0), e2.lineTo(i2, -a2 * 1.6), e2.lineWidth = a2 * 0.55, e2.stroke(), e2.beginPath(), e2.moveTo(i2, a2 * 1.6), e2.quadraticCurveTo(i2 * 0.7, a2 * 0.2, i2 * 0.5, 0), e2.quadraticCurveTo(i2 * 0.7, -a2 * 0.2, i2, -a2 * 1.6), e2.lineWidth = 0.02, e2.strokeStyle = s2, e2.stroke();
      break;
    case `twin`:
      c2(-0.1, i2, a2 * 0.55, o2, a2 * 0.5), c2(-0.1, i2, a2 * 0.55, o2, -a2 * 0.5), c2(i2 * 0.82, i2 * 0.92, a2 * 1.3, s2, a2 * 0.5), c2(i2 * 0.82, i2 * 0.92, a2 * 1.3, s2, -a2 * 0.5);
      break;
    case `bulb`:
      c2(0, i2, a2 * 0.55, o2), e2.beginPath(), e2.ellipse(-0.14, 0, a2 * 0.8, a2 * 0.72, 0, 0, os), e2.fillStyle = s2, e2.fill(), e2.lineWidth = 0.022, e2.stroke();
      break;
    case `nozzle`:
      c2(-0.12, i2 * 0.5, a2 * 0.8, o2), c2(i2 * 0.48, i2, a2 * 0.5, s2);
      for (let t3 of [-a2 * 0.18, 0, a2 * 0.18]) e2.beginPath(), e2.arc(i2 * 0.98, t3, a2 * 0.07, 0, os), e2.fillStyle = as, e2.fill();
      break;
    case `scope`:
      c2(-0.1, i2, a2 * 0.6, o2), c2(i2 * 0.18, i2 * 0.7, a2 * 0.9, s2, a2 * 0.95), e2.beginPath(), e2.arc(i2 * 0.7, 0, a2 * 0.5, 0, os), e2.fillStyle = `rgba(200,255,61,0.85)`, e2.fill(), e2.lineWidth = 0.02, e2.stroke();
      break;
    case `mortar`:
      c2(-0.1, i2 * 0.6, a2 * 0.9, o2), e2.beginPath(), e2.moveTo(i2 * 0.55, -a2 * 0.45), e2.lineTo(i2, -a2 * 0.75), e2.lineTo(i2, a2 * 0.75), e2.lineTo(i2 * 0.55, a2 * 0.45), e2.closePath(), e2.fillStyle = s2, e2.fill(), e2.lineWidth = 0.022, e2.stroke();
      break;
    case `bow`: {
      e2.beginPath(), e2.arc(-0.2, 0, i2 * 0.85, -0.7, 0.7), e2.lineWidth = a2 * 0.7, e2.strokeStyle = as, e2.stroke(), e2.beginPath(), e2.arc(-0.2, 0, i2 * 0.85, -0.7, 0.7), e2.lineWidth = a2 * 0.4, e2.strokeStyle = o2, e2.stroke(), e2.beginPath();
      let t3 = -0.2 + i2 * 0.85 * Math.cos(0.7), n3 = i2 * 0.85 * Math.sin(0.7);
      e2.moveTo(t3, n3), e2.lineTo(-0.1, 0), e2.lineTo(t3, -n3), e2.lineWidth = 0.012, e2.strokeStyle = s2, e2.stroke();
      break;
    }
    case `emitter`:
      c2(-0.1, i2 * 0.55, a2 * 0.5, o2), e2.beginPath(), e2.arc(i2 * 0.6, 0, a2 * 0.6, 0, os), e2.fillStyle = o2, e2.fill(), e2.lineWidth = a2 * 0.2, e2.strokeStyle = s2, e2.stroke(), e2.beginPath(), e2.arc(i2 * 0.6, 0, a2 * 0.25, 0, os), e2.fillStyle = `#ffffff`, e2.fill();
      break;
    case `tank`:
      c2(-0.1, i2, a2 * 0.45, o2), e2.beginPath(), e2.roundRect(-0.2, -a2 * 1.25, i2 * 0.45, a2 * 1, a2 * 0.3), e2.fillStyle = s2, e2.fill(), e2.lineWidth = 0.022, e2.stroke();
      break;
    case `barrel`:
      c2(-0.1, i2, a2, o2);
      for (let t3 of [i2 * 0.3, i2 * 0.62]) e2.beginPath(), e2.roundRect(t3, -a2 * 0.6, i2 * 0.05, a2 * 1.2, 0.03), e2.fillStyle = s2, e2.fill();
      e2.beginPath(), e2.arc(i2, 0, a2 * 0.5, -Math.PI / 2, Math.PI / 2), e2.fillStyle = as, e2.fill();
      break;
    case `bundle`:
      for (let t3 of [-a2 * 0.35, 0, a2 * 0.35]) e2.beginPath(), e2.moveTo(-0.05, t3 * 0.5), e2.lineTo(i2, t3), e2.lineWidth = a2 * 0.32, e2.strokeStyle = as, e2.stroke(), e2.lineWidth = a2 * 0.2, e2.strokeStyle = o2, e2.stroke();
      e2.beginPath(), e2.roundRect(i2 * 0.1, -a2 * 0.6, 0.05, a2 * 1.2, 0.02), e2.fillStyle = s2, e2.fill();
  }
  e2.restore();
}
var hs = `#1d2638`, gs = 0.03, _s = Math.PI * 2;
function vs(e2, t2, n2, r2, i2) {
  switch (e2.lineJoin = `round`, e2.lineCap = `round`, t2) {
    case `brick`:
      bs(e2, n2, r2);
      break;
    case `metal`:
      xs(e2, n2, r2);
      break;
    case `spikes`:
      Ss(e2, n2, r2);
      break;
    case `jelly`:
      Cs(e2, n2, r2, i2);
      break;
    case `telescope`:
      ws(e2, n2, r2, i2);
      break;
    case `cannon`:
      Ts(e2, n2, r2, i2);
      break;
    case `duck`:
      Es(e2, n2, r2, i2);
  }
  i2.wear > 0.05 && Ds(e2, n2, r2, i2.wear, i2.seed), i2.flash > 0 && (e2.globalAlpha = Math.min(1, i2.flash * 4) * 0.7, e2.fillStyle = `#ffffff`, e2.beginPath(), e2.roundRect(-n2 / 2, -r2 / 2, n2, r2, Math.min(n2, r2) * 0.2), e2.fill(), e2.globalAlpha = 1);
}
function ys(e2, t2 = 1) {
  e2.strokeStyle = hs, e2.lineWidth = gs * t2, e2.stroke();
}
function bs(e2, t2, n2) {
  let r2 = e2.createLinearGradient(0, n2 / 2, 0, -n2 / 2);
  r2.addColorStop(0, `#f39a72`), r2.addColorStop(1, `#c4583a`), e2.fillStyle = r2, e2.beginPath(), e2.roundRect(-t2 / 2, -n2 / 2, t2, n2, 0.06), e2.fill(), ys(e2, 1.2), e2.strokeStyle = `#963f22`, e2.lineWidth = 0.03, e2.beginPath(), t2 >= n2 ? (e2.moveTo(-t2 / 2 + 0.06, 0), e2.lineTo(t2 / 2 - 0.06, 0), e2.moveTo(-t2 * 0.1, 0), e2.lineTo(-t2 * 0.1, n2 / 2 - 0.05), e2.moveTo(t2 * 0.22, 0), e2.lineTo(t2 * 0.22, -n2 / 2 + 0.05)) : (e2.moveTo(0, -n2 / 2 + 0.06), e2.lineTo(0, n2 / 2 - 0.06), e2.moveTo(0, n2 * 0.1), e2.lineTo(t2 / 2 - 0.05, n2 * 0.1), e2.moveTo(0, -n2 * 0.22), e2.lineTo(-t2 / 2 + 0.05, -n2 * 0.22)), e2.stroke(), e2.fillStyle = `rgba(255, 214, 190, 0.85)`, e2.fillRect(-t2 / 2 + 0.08, n2 / 2 - 0.1, Math.max(0.05, t2 * 0.35), 0.045);
}
function xs(e2, t2, n2) {
  let r2 = n2 > t2, i2 = r2 ? e2.createLinearGradient(-t2 / 2, 0, t2 / 2, 0) : e2.createLinearGradient(0, -n2 / 2, 0, n2 / 2);
  i2.addColorStop(0, `#7d8ea3`), i2.addColorStop(0.45, `#e2ebf5`), i2.addColorStop(1, `#8798ad`), e2.fillStyle = i2, e2.beginPath(), e2.roundRect(-t2 / 2, -n2 / 2, t2, n2, 0.03), e2.fill(), ys(e2, 1.2), e2.strokeStyle = `rgba(255, 255, 255, 0.55)`, e2.lineWidth = 0.025, e2.beginPath();
  let a2 = Math.max(t2, n2);
  for (let i3 of [-0.2, 0.1]) r2 ? (e2.moveTo(-t2 / 2 + 0.03, i3 * a2), e2.lineTo(t2 / 2 - 0.03, i3 * a2 + 0.12)) : (e2.moveTo(i3 * a2, -n2 / 2 + 0.03), e2.lineTo(i3 * a2 + 0.12, n2 / 2 - 0.03));
  e2.stroke(), e2.fillStyle = hs;
  for (let i3 of [-1, 1]) e2.beginPath(), r2 ? e2.arc(0, i3 * (n2 / 2 - 0.12), 0.035, 0, _s) : e2.arc(i3 * (t2 / 2 - 0.12), 0, 0.035, 0, _s), e2.fill();
}
function Ss(e2, t2, n2) {
  let r2 = n2 * 0.38;
  e2.fillStyle = `#4b5a75`, e2.beginPath(), e2.roundRect(-t2 / 2, -n2 / 2, t2, r2, 0.04), e2.fill(), ys(e2, 1.1);
  let i2 = Math.max(3, Math.round(t2 / 0.2)), a2 = t2 / i2;
  for (let o2 = 0; o2 < i2; o2++) {
    let i3 = -t2 / 2 + o2 * a2, s2 = e2.createLinearGradient(i3, 0, i3 + a2, 0);
    s2.addColorStop(0, `#f4f7fb`), s2.addColorStop(1, `#9aa7b8`), e2.fillStyle = s2, e2.beginPath(), e2.moveTo(i3 + 0.01, -n2 / 2 + r2), e2.lineTo(i3 + a2 / 2, n2 / 2), e2.lineTo(i3 + a2 - 0.01, -n2 / 2 + r2), e2.closePath(), e2.fill(), ys(e2, 0.9);
  }
}
function Cs(e2, t2, n2, r2) {
  let i2 = Math.sin(r2.time * 6 + r2.seed) * (0.04 + 0.25 * r2.flash);
  e2.save(), e2.translate(0, -n2 / 2), e2.scale(1 - i2 * 0.5, 1 + i2), e2.translate(0, n2 / 2);
  let a2 = e2.createLinearGradient(0, n2 / 2, 0, -n2 / 2);
  a2.addColorStop(0, `rgba(255, 170, 230, 0.95)`), a2.addColorStop(1, `rgba(230, 70, 180, 0.95)`), e2.fillStyle = a2, e2.beginPath(), e2.moveTo(-t2 / 2, -n2 / 2), e2.lineTo(-t2 / 2, n2 * 0.1), e2.quadraticCurveTo(-t2 / 2, n2 / 2, 0, n2 / 2), e2.quadraticCurveTo(t2 / 2, n2 / 2, t2 / 2, n2 * 0.1), e2.lineTo(t2 / 2, -n2 / 2), e2.closePath(), e2.fill(), ys(e2, 1.1), e2.fillStyle = `rgba(255, 235, 250, 0.85)`, e2.beginPath(), e2.ellipse(-t2 * 0.22, n2 * 0.2, t2 * 0.16, n2 * 0.12, -0.3, 0, _s), e2.fill(), e2.fillStyle = `rgba(255, 235, 250, 0.55)`;
  for (let [i3, a3, o2] of [[t2 * 0.18, -n2 * 0.05, 0.05], [t2 * 0.3, n2 * 0.15, 0.035], [-t2 * 0.05, -n2 * 0.2, 0.03]]) e2.beginPath(), e2.arc(i3, a3 + 0.02 * Math.sin(r2.time * 2 + i3 * 10), o2, 0, _s), e2.fill();
  e2.restore();
}
function ws(e2, t2, n2, r2) {
  let i2 = { x: 0, y: n2 * 0.1 };
  e2.strokeStyle = hs, e2.lineWidth = 0.05, e2.beginPath(), e2.moveTo(i2.x, i2.y), e2.lineTo(-t2 / 2 + 0.04, -n2 / 2), e2.moveTo(i2.x, i2.y), e2.lineTo(t2 / 2 - 0.04, -n2 / 2), e2.moveTo(i2.x, i2.y), e2.lineTo(0, -n2 / 2), e2.stroke(), e2.save(), e2.translate(i2.x, i2.y + 0.06), e2.rotate(r2.aim), e2.fillStyle = `#7a6cff`, e2.beginPath(), e2.roundRect(-0.32, -0.09, 0.62, 0.18, 0.06), e2.fill(), ys(e2), e2.fillStyle = `#b7aeff`, e2.beginPath(), e2.roundRect(0.26, -0.12, 0.14, 0.24, 0.05), e2.fill(), ys(e2), e2.globalAlpha = 0.5 + 0.5 * Math.sin(r2.time * 4 + r2.seed), e2.fillStyle = `#ffffff`, e2.beginPath(), e2.arc(0.36, 0.04, 0.035, 0, _s), e2.fill(), e2.globalAlpha = 1, e2.restore();
}
function Ts(e2, t2, n2, r2) {
  let i2 = { x: 0, y: n2 * 0.12 };
  e2.save(), e2.translate(i2.x, i2.y), e2.rotate(r2.aim), e2.translate(-0.14 * r2.recoil, 0);
  let a2 = e2.createLinearGradient(0, -0.13, 0, 0.13);
  a2.addColorStop(0, `#8a9bb8`), a2.addColorStop(1, `#3d4a63`), e2.fillStyle = a2, e2.beginPath(), e2.roundRect(-0.15, -0.13, 0.62, 0.26, 0.1), e2.fill(), ys(e2, 1.1), e2.fillStyle = `#2a3346`, e2.beginPath(), e2.roundRect(0.4, -0.16, 0.12, 0.32, 0.05), e2.fill(), ys(e2), e2.restore(), e2.fillStyle = `#8a5a2b`, e2.beginPath(), e2.moveTo(-t2 / 2 + 0.06, -n2 / 2 + 0.1), e2.lineTo(t2 / 2 - 0.1, -n2 / 2 + 0.1), e2.lineTo(t2 * 0.1, i2.y + 0.06), e2.lineTo(-t2 * 0.25, i2.y + 0.06), e2.closePath(), e2.fill(), ys(e2);
  let o2 = n2 * 0.3;
  e2.fillStyle = `#6b4424`, e2.beginPath(), e2.arc(-t2 * 0.12, -n2 / 2 + o2, o2, 0, _s), e2.fill(), ys(e2), e2.strokeStyle = `#3b2a1a`, e2.lineWidth = 0.025, e2.beginPath();
  for (let r3 = 0; r3 < 3; r3++) {
    let i3 = r3 / 3 * Math.PI;
    e2.moveTo(-t2 * 0.12 + Math.cos(i3) * o2 * 0.85, -n2 / 2 + o2 + Math.sin(i3) * o2 * 0.85), e2.lineTo(-t2 * 0.12 - Math.cos(i3) * o2 * 0.85, -n2 / 2 + o2 - Math.sin(i3) * o2 * 0.85);
  }
  e2.stroke();
}
function Es(e2, t2, n2, r2) {
  let i2 = Math.sin(r2.time * 3 + r2.seed) * 0.03, a2 = 1 - 0.25 * r2.flash;
  e2.save(), e2.translate(0, -n2 / 2), e2.scale(1 + (1 - a2) * 0.6, a2), e2.translate(0, n2 / 2 + i2), e2.fillStyle = `#ffd23f`, e2.beginPath(), e2.ellipse(-t2 * 0.05, -n2 * 0.18, t2 * 0.46, n2 * 0.3, 0, 0, _s), e2.fill(), ys(e2), e2.beginPath(), e2.arc(t2 * 0.16, n2 * 0.22, n2 * 0.22, 0, _s), e2.fill(), ys(e2), e2.fillStyle = `#ff8a3d`, e2.beginPath(), e2.moveTo(t2 * 0.33, n2 * 0.24), e2.quadraticCurveTo(t2 * 0.55, n2 * 0.22, t2 * 0.5, n2 * 0.12), e2.quadraticCurveTo(t2 * 0.4, n2 * 0.1, t2 * 0.32, n2 * 0.15), e2.closePath(), e2.fill(), ys(e2, 0.9), e2.fillStyle = hs, e2.beginPath(), e2.arc(t2 * 0.2, n2 * 0.28, 0.035, 0, _s), e2.fill(), e2.fillStyle = `#ffffff`, e2.beginPath(), e2.arc(t2 * 0.21, n2 * 0.295, 0.012, 0, _s), e2.fill(), e2.strokeStyle = `#e0a800`, e2.lineWidth = 0.035, e2.beginPath(), e2.moveTo(-t2 * 0.32, -n2 * 0.12), e2.quadraticCurveTo(-t2 * 0.12, -n2 * 0.02, 0, -n2 * 0.2), e2.stroke(), e2.restore();
}
function Ds(e2, t2, n2, r2, i2) {
  e2.save(), e2.globalAlpha = Math.min(1, r2 * 1.4), e2.strokeStyle = hs, e2.lineWidth = 0.025;
  let a2 = r2 > 0.6 ? 3 : r2 > 0.3 ? 2 : 1;
  for (let o2 = 0; o2 < a2; o2++) {
    let a3 = Os(Math.sin(i2 * 12.9 + o2 * 7.1) * 4375.5), s2 = Os(Math.sin(i2 * 78.2 + o2 * 3.7) * 4375.5), c2 = (a3 - 0.5) * t2 * 0.7, l2 = n2 / 2 - 0.02;
    e2.beginPath(), e2.moveTo(c2, l2);
    for (let i3 = 0; i3 < 3; i3++) c2 += (Os(s2 * (i3 + 3) * 9.7) - 0.5) * t2 * 0.3, l2 -= n2 * 0.25 * r2 + 0.05, e2.lineTo(c2, l2);
    e2.stroke();
  }
  e2.restore();
}
function Os(e2) {
  return e2 - Math.floor(e2);
}
var ks = 0.03, As = `#1d2638`, js = `#ffffff`, Ms = `#fff3a3`, Ns = 1.6, Ps = /* @__PURE__ */ new Set([`boomerang`, `bomb`, `cluster`, `ring`]), Fs = `#b47aff`, Is = `#ffc65c`, Ls = Array.from({ length: 70 }, (e2, t2) => {
  let n2 = Math.sin(t2 * 12.9898) * 43758.5453, r2 = Math.sin(t2 * 78.233) * 43758.5453;
  return { x: n2 - Math.floor(n2), y: r2 - Math.floor(r2), depth: 0.3 + 0.7 * (t2 * 0.37 % 1), r: 0.6 + 1.2 * (t2 * 0.61 % 1) };
}), Rs = { skyTop: `#040b19`, skyMid: `#0a1b35`, skyBottom: `#14325d`, star: `#6f9fd8`, earthDeep: `#0c2448`, lipTop: `#3a74b5`, lipBottom: `#2a5c96`, platformBody: `#163d6c`, platformEdge: `#081d3a`, platformLip: `#3b76b7`, crateFill: `#2a5f9c`, crateLine: `#071a33`, ballFill: `#4a86c8`, ballStripe: `#a9cdf0`, ballEdge: `#0a2446` }, Renderer = class {
  constructor(e2, t2) {
    this.canvas = e2, this.camera = t2, this.dpr = 1, this.viewW = 1, this.viewH = 1;
    let n2 = e2.getContext(`2d`);
    if (!n2) throw Error(`2D canvas is not available`);
    this.ctx = n2;
  }
  resize() {
    let e2 = Math.min(window.devicePixelRatio || 1, 2), t2 = Math.max(1, this.canvas.clientWidth), n2 = Math.max(1, this.canvas.clientHeight);
    this.dpr = e2, this.viewW = t2, this.viewH = n2, this.canvas.width = Math.round(t2 * e2), this.canvas.height = Math.round(n2 * e2), this.camera.setViewport(t2, n2);
  }
  draw(e2) {
    let t2 = this.ctx;
    this.slimeLook = !!e2.slimeLook, this.scenePlayer = e2.player;
    if (e2.interior) {
      t2.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      t2.globalAlpha = 1, t2.fillStyle = `#0d0a1c`, t2.fillRect(0, 0, this.viewW, this.viewH);
      drawInterior(t2, e2.interior.def, e2.interior.view, e2.time, { collected: e2.interior.collected, pickups: e2.interior.pickups, weaponColors: e2.interior.weaponColors, alpha: 1 });
      e2.camera.apply(t2, this.dpr), this.drawCharacter(e2.player, e2.alpha, e2.time), t2.setTransform(this.dpr, 0, 0, this.dpr, 0, 0), this.drawFloatingText(e2), this.drawPickupBanner(e2), this.drawZoomText(e2);
      e2.doorFade > 0 && drawInteriorFade(t2, this.viewW, this.viewH, e2.doorFade);
      return;
    }
    t2.setTransform(this.dpr, 0, 0, this.dpr, 0, 0), this.drawSky(e2.camera.x, e2), e2.camera.apply(t2, this.dpr), this.drawTerrain(e2), e2.build && this.drawBuildZone(e2.build, e2.time), this.drawFortress(e2), this.drawPuddles(e2), this.drawWells(e2), this.drawObjects(e2), this.drawBeams(e2), this.drawProjectileTrails(e2);
    if (e2.boss && e2.boss.alive) drawBoss(t2, e2.boss, e2.time);
this.drawCharacter(e2.player, e2.alpha, e2.time);
    for (let t3 of e2.enemies) this.drawCharacter(t3, e2.alpha, e2.time);
    if (e2.mode === 'endless') for (let t3 of e2.enemies) if (t3.alive && t3.status) drawElementalEffects(t2, t3, e2.time);
    if (e2.mode === 'endless' && e2.flyers) for (let f3 of e2.flyers) drawFlyer(t2, f3, e2.time);
    this.drawGums(e2), this.drawThrowTrail(e2), this.drawLaunchers(e2), this.drawProjectiles(e2), this.drawParticles(e2), this.drawCoins(e2), this.drawAimPreview(e2), e2.build && this.drawBuildGhost(e2.build, e2.time), t2.setTransform(this.dpr, 0, 0, this.dpr, 0, 0), this.drawHealthBars(e2), this.drawFloatingText(e2);
    if (e2.boss && e2.boss.alive) drawBossBar(t2, e2.boss, this.viewW, this.viewH, e2.time);
    // Screen-space feedback (endless mode only)
    if (e2.mode === 'endless') {
      this.drawVignette(e2);
      this.drawHitMarkers(e2);
      this.drawBossCallout(e2);
      this.drawPlayerExclamation(e2);
      this.drawBossIndicator(e2);
    }
    this.drawPickupBanner(e2);
    this.drawZoomText(e2);
    this.drawDragOverlay(e2), e2.effects.screenFlash > 0 && (t2.globalAlpha = 0.55 * e2.effects.screenFlash, t2.fillStyle = `#eaffd9`, t2.fillRect(0, 0, this.viewW, this.viewH), t2.globalAlpha = 1);
    e2.doorFade > 0 && drawInteriorFade(t2, this.viewW, this.viewH, e2.doorFade);
  }
  drawSky(e2, sc) {
    let t2 = this.ctx, n2 = this.viewW, r2 = this.viewH, i2 = t2.createLinearGradient(0, 0, 0, r2);
    i2.addColorStop(0, Rs.skyTop), i2.addColorStop(0.6, Rs.skyMid), i2.addColorStop(1, Rs.skyBottom), t2.fillStyle = i2, t2.fillRect(0, 0, n2, r2);
    if (sc && sc.camera) {
      // Alien space backdrop (src/backdrop.js): galaxies, ringed planet, spaceships and, in the endless world, a far-away alien city standing on the ground line.
      const endless = !!(sc.arena && sc.arena.features), seed = endless ? (sc.arena.seed >>> 0) : 7;
      if (!this.backdrop || this.backdropSeed !== seed) this.backdrop = createBackdrop(seed), this.backdropSeed = seed;
      const horizonY = sc.camera.toScreen({ x: 0, y: 0 }).y;
      drawBackdrop(t2, { width: n2, height: r2, camX: e2, horizonY }, sc.time || 0, this.backdrop, { quality: n2 < 700 ? "low" : "high", pxPerMetre: 40, layers: endless ? void 0 : ["galaxies", "stars", "planet", "ships"] });
      return;
    }
    t2.fillStyle = Rs.star;
    for (let i3 of Ls) {
      let a2 = ((i3.x * n2 - e2 * 4 * i3.depth) % n2 + n2) % n2, o2 = i3.y * r2 * 0.75;
      t2.globalAlpha = 0.35 + 0.5 * i3.depth, t2.beginPath(), t2.arc(a2, o2, i3.r, 0, TAU), t2.fill();
    }
    t2.globalAlpha = 1;
  }
  drawTerrain(e2) {
    let t2 = this.ctx;
    for (let n2 of e2.arena.islands) {
      let e3 = n2.topY, r2 = 0.6, i2 = t2.createLinearGradient(0, e3, 0, e3 - r2 * 4);
      i2.addColorStop(0, Rs.platformBody), i2.addColorStop(1, Rs.earthDeep), t2.fillStyle = i2, t2.beginPath(), t2.roundRect(n2.minX, e3 - r2 * 4, n2.maxX - n2.minX, r2 * 4, 0.3), t2.fill(), t2.lineWidth = ks * 1.4, t2.strokeStyle = Rs.platformEdge, t2.stroke(), t2.fillStyle = n2.home ? Rs.lipTop : Rs.platformLip, t2.beginPath(), t2.roundRect(n2.minX - 0.03, e3 - 0.16, n2.maxX - n2.minX + 0.06, 0.16, 0.08), t2.fill(), t2.fillStyle = Rs.lipBottom, t2.fillRect(n2.minX, e3 - 0.04, n2.maxX - n2.minX, 0.04);
    }
    e2.arena.features && this.drawFeatures(e2.arena, e2.time);
  }
  drawFeatures(arena, time) {
    const ctx = this.ctx, L = TERRAIN_LOOK;
    ctx.save(), ctx.lineJoin = `round`, ctx.lineCap = `round`;
    // Pass 1: BACKGROUND BUILDINGS. They are huge, purely decorative and have no collision. Drawing ALL of them before any physical feature guarantees a building (which can span up to 2.5 m past its chunk) never paints over an adjacent chunk's barricade or hill, regardless of Map insertion order.
    for (const [ci, ft] of arena.features) if (ft.type === `tower`) this.drawBuilding(ci, ft, time);
    // Pass 2: physical features (barricades, hills) on top of the buildings.
    for (const [ci, ft] of arena.features) {
      if (ft.type === `tower`) continue;
      for (const part of ft.parts) {
      let poly = part.poly, area = 0;
      for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a.x * b.y - b.x * a.y; }
      if (area < 0) poly = poly.slice().reverse();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of poly) x0 = Math.min(x0, p.x), x1 = Math.max(x1, p.x), y0 = Math.min(y0, p.y), y1 = Math.max(y1, p.y);
      const w = x1 - x0, h = y1 - y0, tower = ft.type === `tower`, rocky = ft.type === `hill`, barricade = !tower && !rocky;
      let towerDoor = null;
      const grad = ctx.createLinearGradient(0, y1, 0, y0);
      if (rocky) grad.addColorStop(0, L.rockLight), grad.addColorStop(1, L.rock); else grad.addColorStop(0, L.wallLight), grad.addColorStop(1, L.wallDark);
      terrainPolyPath(ctx, poly), ctx.fillStyle = grad, ctx.fill();
      ctx.save(), terrainPolyPath(ctx, poly), ctx.clip();
      const strata = (ax, ay, bx, by) => { // diagonal rock strata inside a region
        ctx.strokeStyle = `rgba(13,10,28,0.28)`, ctx.lineWidth = 0.03;
        for (let x = Math.min(ax, bx) - h * 1.2; x < Math.max(ax, bx) + h; x += 0.7) ctx.beginPath(), ctx.moveTo(x, ay), ctx.lineTo(x + h * 1.2, by), ctx.stroke();
      };
      if (rocky) strata(x0, y0, x1, y1 + 0.3);
      else if (tower) {
        const tops = poly.filter((p) => p.y > h * 0.5), bases = poly.filter((p) => p.y < 0.01);
        const faceBase = bases.find((p) => tops.some((t) => Math.abs(t.x - p.x) < 1e-6)), slopeBase = bases.find((p) => p !== faceBase);
        const faceTop = faceBase && tops.find((t) => Math.abs(t.x - faceBase.x) < 1e-6), slopeTop = tops.find((t) => t !== faceTop);
        if (faceBase && slopeBase && faceTop && slopeTop) {
          const bx0 = Math.min(slopeTop.x, faceTop.x), bx1 = Math.max(slopeTop.x, faceTop.x), bw = bx1 - bx0;
          // rock wedge under the ramp
          const rg = ctx.createLinearGradient(0, y1, 0, y0);
          rg.addColorStop(0, L.rockLight), rg.addColorStop(1, L.rock);
          ctx.beginPath(), ctx.moveTo(slopeBase.x, 0), ctx.lineTo(slopeTop.x, 0), ctx.lineTo(slopeTop.x, slopeTop.y), ctx.closePath(), ctx.fillStyle = rg, ctx.fill();
          ctx.save(), ctx.beginPath(), ctx.moveTo(slopeBase.x, 0), ctx.lineTo(slopeTop.x, 0), ctx.lineTo(slopeTop.x, slopeTop.y), ctx.closePath(), ctx.clip(), strata(Math.min(slopeBase.x, slopeTop.x), 0, Math.max(slopeBase.x, slopeTop.x), h + 0.3), ctx.restore();
          // windows
          const cols = Math.max(1, Math.floor((bw - 0.5) / 1)), rows = Math.max(1, Math.floor((h - 0.6) / 0.85)), cw = 0.46, ch = 0.38, gx = (bw - cols * cw) / (cols + 1), gy = (h - 0.55 - rows * ch) / (rows + 1);
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const x = bx0 + gx + c * (cw + gx), y = y1 - 0.55 - gy - (r + 1) * ch - r * gy, lit = terrainNoise(ci * 31 + r * 7 + c * 3) > 0.35;
            ctx.fillStyle = L.ink, ctx.fillRect(x - 0.03, y - 0.03, cw + 0.06, ch + 0.06);
            ctx.fillStyle = lit ? L.glass : L.glassOff, ctx.globalAlpha = lit ? 0.55 + 0.2 * Math.sin(time * 1.5 + c + r * 2 + ci) : 1, ctx.fillRect(x, y, cw, ch), ctx.globalAlpha = 1;
          }
          towerDoor = { x: faceBase.x, faceRight: faceBase.x === bx1 };
          ctx.strokeStyle = `rgba(13,10,28,0.35)`, ctx.lineWidth = 0.02;
          for (let y = 0.9; y < y1; y += 0.9) ctx.beginPath(), ctx.moveTo(bx0, y), ctx.lineTo(bx1, y), ctx.stroke();
        }
      } else if (barricade) { // hazard stripes
        ctx.fillStyle = L.hazardB, ctx.fillRect(x0, y0 + h * 0.18, w, h * 0.5), ctx.fillStyle = L.hazardA;
        for (let x = x0 - h; x < x1 + h; x += 0.32) ctx.beginPath(), ctx.moveTo(x, y0 + h * 0.18), ctx.lineTo(x + 0.16, y0 + h * 0.18), ctx.lineTo(x + 0.16 + h * 0.5, y0 + h * 0.68), ctx.lineTo(x + h * 0.5, y0 + h * 0.68), ctx.closePath(), ctx.fill();
      }
      ctx.restore();
      if (towerDoor) {
        const dx = towerDoor.x, dw = 0.62, dh = 1.12, half = dw / 2;
        ctx.fillStyle = L.roof, ctx.fillRect(dx - half - 0.1, 0, dw + 0.2, dh + 0.16);
        ctx.fillStyle = L.ink, ctx.fillRect(dx - half, 0, dw, dh);
        ctx.fillStyle = `rgba(255,216,107,0.22)`, ctx.fillRect(dx - half + 0.07, 0.07, dw - 0.14, dh - 0.14);
        const pulse = 0.5 + 0.5 * Math.sin(time * 3);
        ctx.globalAlpha = 0.45 + 0.55 * pulse, ctx.fillStyle = L.glass, ctx.fillRect(dx - half - 0.1, dh + 0.2, dw + 0.2, 0.15), ctx.globalAlpha = 1;
        ctx.fillStyle = L.hazardA, ctx.fillRect(dx - half - 0.12, 0, dw + 0.24, 0.09);
      }
      terrainPolyPath(ctx, poly), ctx.strokeStyle = L.ink, ctx.lineWidth = 0.07, ctx.stroke();
      for (let i = 0; i < poly.length; i++) { // lit top edges
        const a = poly[i], c = poly[(i + 1) % poly.length], len = Math.hypot(c.x - a.x, c.y - a.y) || 1, ny = -(c.x - a.x) / len;
        if (ny > 0.25 && !(a.y < 0.01 && c.y < 0.01)) ctx.strokeStyle = (tower && Math.abs(c.y - a.y) < 0.01) || barricade ? L.roof : L.rockLight, ctx.lineWidth = 0.09, ctx.beginPath(), ctx.moveTo(a.x, a.y + 0.01), ctx.lineTo(c.x, c.y + 0.01), ctx.stroke();
      }
      }
    }
    ctx.restore();
  }
  drawBuilding(ci, feature, time) {
    // BACKGROUND BUILDING (former `tower` terrain feature): a huge (~24 m x 14 m) purple-colony house drawn on the terrain back layer, behind everything, with NO collision. Purely decoration + the door centre x used by the E-to-enter hint.
    const ctx = this.ctx, L = TERRAIN_LOOK;
    const chunkW = ENDLESS_CFG.chunkW;
    const spanLo = ci * chunkW + TERRAIN_CFG.margin, spanHi = (ci + 1) * chunkW - TERRAIN_CFG.margin;
    const w = 24, h = 14;
    let doorX = feature.doorX;
    if (!Number.isFinite(doorX)) doorX = (spanLo + spanHi) / 2;
    const doorWorld = doorX; // world-space centre: findTowerDoor compares the torso x against feature.doorX
    const left = clamp(doorWorld - w / 2, spanLo - 2.5, spanHi + 2.5 - w);
    const top = h;
    ctx.save();
    // body (kept as a vertical gradient, but the lower storeys are lightened so the lit door stands out against them)
    const body = ctx.createLinearGradient(0, top, 0, 0);
    body.addColorStop(0, L.wallLight), body.addColorStop(0.62, L.wall), body.addColorStop(1, L.wallLower);
    ctx.fillStyle = body, ctx.fillRect(left, 0, w, h);
    // roof slab + crenellations + antenna
    ctx.fillStyle = L.roof, ctx.fillRect(left - 0.5, h, w + 1, 0.5);
    const merlonW = 1.4, gap = 0.9;
    for (let x = left; x < left + w - 0.2; x += merlonW + gap) ctx.fillRect(x, h + 0.5, merlonW, 0.7);
    ctx.strokeStyle = L.roof, ctx.lineWidth = 0.16, ctx.beginPath(), ctx.moveTo(left + w * 0.72, h + 1.2), ctx.lineTo(left + w * 0.72, h + 2.7), ctx.stroke();
    ctx.fillStyle = L.glass, ctx.beginPath(), ctx.arc(left + w * 0.72, h + 2.8, 0.18, 0, TAU), ctx.fill();
    // floor bands
    ctx.strokeStyle = `rgba(13,10,28,0.45)`, ctx.lineWidth = 0.07;
    for (let y = 3.0; y < h; y += 3.0) ctx.beginPath(), ctx.moveTo(left, y), ctx.lineTo(left + w, y), ctx.stroke();
    // window rows (several storeys of lit windows)
    const rows = 3, cols = 9, cw = 0.9, ch = 1.1;
    const gx = (w - cols * cw) / (cols + 1);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const wx = left + gx + c * (cw + gx);
      const wy = 3.4 + r * 3.0;
      ctx.fillStyle = L.ink, ctx.fillRect(wx - 0.06, wy - 0.06, cw + 0.12, ch + 0.12);
      const lit = terrainNoise(ci * 31 + r * 7 + c * 3) > 0.35;
      ctx.globalAlpha = lit ? 0.55 + 0.2 * Math.sin(time * 1.5 + c + r * 2 + ci) : 1;
      ctx.fillStyle = lit ? L.glass : L.glassOff, ctx.fillRect(wx, wy, cw, ch), ctx.globalAlpha = 1;
    }
    // big door at ground level (~3.2 m tall x 2.2 m wide), centred on doorWorld (matches findTowerDoor)
    const dh = 3.2, dw = 2.2, dhx = doorWorld - dw / 2;
    // soft glow on the ground in front of the door
    const gGlow = ctx.createRadialGradient(doorWorld, 0.12, 0.1, doorWorld, 0.12, 2.2);
    gGlow.addColorStop(0, `rgba(255,216,107,0.55)`), gGlow.addColorStop(1, `rgba(255,216,107,0)`);
    ctx.fillStyle = gGlow, ctx.fillRect(doorWorld - 2.4, -0.05, 4.8, 0.9);
    // thick high-contrast light frame
    ctx.fillStyle = L.roof, ctx.fillRect(dhx - 0.25, 0, dw + 0.5, dh + 0.4);
    // darker inner opening + bright warm lit doorway fill (high luminance vs wallLower)
    ctx.fillStyle = L.ink, ctx.fillRect(dhx, 0, dw, dh);
    ctx.fillStyle = `#ffd86b`, ctx.globalAlpha = 0.9, ctx.fillRect(dhx + 0.1, 0.08, dw - 0.2, dh - 0.16), ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(40,24,10,0.35)`, ctx.fillRect(dhx + 0.22, 0.2, dw - 0.44, dh - 0.55);
    // hazard-striped threshold
    ctx.fillStyle = L.hazardB, ctx.fillRect(dhx - 0.28, 0, dw + 0.56, 0.16);
    ctx.fillStyle = L.hazardA;
    for (let sx = dhx - 0.28; sx < dhx + dw + 0.28; sx += 0.28) ctx.fillRect(sx, 0, 0.14, 0.16);
    // lit ENTER sign above door
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    ctx.globalAlpha = 0.55 + 0.45 * pulse, ctx.fillStyle = `#ffd86b`, ctx.fillRect(dhx - 0.35, dh + 0.44, dw + 0.7, 0.62), ctx.globalAlpha = 1;
    ctx.strokeStyle = L.ink, ctx.lineWidth = 0.06, ctx.strokeRect(dhx - 0.35, dh + 0.44, dw + 0.7, 0.62);
    // block letters ENTER (world units, readable under y-up transform by drawing simple rects)
    ctx.fillStyle = L.ink;
    const ly = dh + 0.52, lh = 0.46, lw = 0.07, ls = 0.34;
    let lx = dhx - 0.12;
    // E
    ctx.fillRect(lx, ly, lw, lh), ctx.fillRect(lx, ly + lh - lw, ls, lw), ctx.fillRect(lx, ly + lh / 2 - lw / 2, ls * 0.75, lw), ctx.fillRect(lx, ly, ls, lw);
    lx += ls + 0.1;
    // N
    ctx.fillRect(lx, ly, lw, lh), ctx.fillRect(lx + ls - lw, ly, lw, lh), ctx.save(), ctx.beginPath(), ctx.moveTo(lx + lw, ly + lh), ctx.lineTo(lx + lw * 1.8, ly + lh), ctx.lineTo(lx + ls - lw, ly + lw), ctx.lineTo(lx + ls - lw * 1.8, ly), ctx.closePath(), ctx.fill(), ctx.restore();
    lx += ls + 0.1;
    // T
    ctx.fillRect(lx, ly + lh - lw, ls, lw), ctx.fillRect(lx + ls / 2 - lw / 2, ly, lw, lh);
    lx += ls + 0.1;
    // E
    ctx.fillRect(lx, ly, lw, lh), ctx.fillRect(lx, ly + lh - lw, ls, lw), ctx.fillRect(lx, ly + lh / 2 - lw / 2, ls * 0.75, lw), ctx.fillRect(lx, ly, ls, lw);
    lx += ls + 0.1;
    // R
    ctx.fillRect(lx, ly, lw, lh), ctx.fillRect(lx, ly + lh - lw, ls * 0.8, lw), ctx.fillRect(lx, ly + lh / 2 - lw / 2, ls * 0.8, lw), ctx.fillRect(lx + ls * 0.8 - lw, ly + lh / 2, lw, lh / 2), ctx.fillRect(lx + ls * 0.8 - lw, ly, lw * 0.2, lw * 0.2), ctx.beginPath(), ctx.moveTo(lx + lw, ly + lh / 2), ctx.lineTo(lx + ls * 0.55, ly), ctx.lineTo(lx + ls * 0.8, ly), ctx.lineTo(lx + ls * 0.35, ly + lh / 2), ctx.closePath(), ctx.fill();
    ctx.restore();
  }
  drawFortress(e2) {
    let t2 = this.ctx;
    for (let n2 of [...e2.fortress.standing, ...e2.fortress.debris]) {
      let r2 = n2.body.getPosition(), i2 = lerp(n2.prevX, r2.x, e2.alpha), a2 = lerp(n2.prevY, r2.y, e2.alpha), o2 = Ws(n2.prevA, n2.body.getAngle(), e2.alpha), s2 = n2.age < 0.35 ? Vs(n2.age / 0.35) : 1;
      t2.save(), t2.translate(i2, a2 - n2.h / 2), t2.rotate(o2), t2.scale(s2, s2), t2.translate(0, n2.h / 2), vs(t2, n2.def.id, n2.w, n2.h, { time: e2.time, wear: 1 - n2.hp / n2.def.hp, flash: n2.flash, aim: n2.aim - o2, recoil: n2.recoil, seed: n2.saved.x * 3.1 + n2.saved.y * 7.7 }), t2.restore();
    }
  }
  drawBuildZone(e2, t2) {
    let n2 = this.ctx, { minX: r2, maxX: i2, topY: a2, maxY: o2 } = e2.zone, s2 = 0.5 + 0.5 * Math.sin(t2 * 2.4), c2 = n2.createLinearGradient(0, a2, 0, o2);
    c2.addColorStop(0, `rgba(141, 255, 90, ${0.16 + 0.06 * s2})`), c2.addColorStop(1, `rgba(141, 255, 90, 0)`), n2.fillStyle = c2, n2.fillRect(r2, a2, i2 - r2, o2 - a2), n2.strokeStyle = `rgba(141, 255, 90, 0.18)`, n2.lineWidth = 0.015, n2.beginPath();
    for (let e3 = r2; e3 <= i2 + 1e-6; e3 += 0.5) n2.moveTo(e3, a2), n2.lineTo(e3, a2 + 1.2);
    n2.stroke(), n2.setLineDash([0.2, 0.15]), n2.strokeStyle = `rgba(255, 255, 255, 0.35)`, n2.lineWidth = 0.03, n2.beginPath(), n2.moveTo(r2, o2), n2.lineTo(i2, o2), n2.stroke(), n2.setLineDash([]);
  }
  drawBuildGhost(e2, t2) {
    let n2 = this.ctx, r2 = e2.landing, i2 = e2.held;
    if (!r2 || !i2) return;
    let a2 = r2.valid ? `#8dff5a` : `#ff6b6b`;
    n2.save(), n2.translate(r2.x, r2.y), n2.globalAlpha = 0.35, vs(n2, r2.item, r2.w, r2.h, { time: t2, wear: 0, flash: 0, aim: 0.5, recoil: 0, seed: 1, ghost: true }), n2.globalAlpha = 1, n2.setLineDash([0.12, 0.08]), n2.lineDashOffset = -t2 * 0.6, n2.strokeStyle = a2, n2.lineWidth = 0.05 + 0.02 * Math.sin(t2 * 8), n2.beginPath(), n2.roundRect(-r2.w / 2 - 0.05, -r2.h / 2 - 0.05, r2.w + 0.1, r2.h + 0.1, 0.08), n2.stroke(), n2.setLineDash([]), n2.restore(), i2.y > r2.y + r2.h / 2 && (n2.strokeStyle = a2, n2.globalAlpha = 0.6, n2.lineWidth = 0.03, n2.setLineDash([0.1, 0.1]), n2.beginPath(), n2.moveTo(r2.x, i2.y), n2.lineTo(r2.x, r2.y + r2.h / 2), n2.stroke(), n2.setLineDash([]), n2.globalAlpha = 1);
    let { w: o2, h: s2 } = is(i2.item, i2.rot);
    n2.save(), n2.translate(i2.x, i2.y), n2.rotate(0.06 * Math.sin(t2 * 5)), n2.globalAlpha = 0.92, vs(n2, i2.item, o2, s2, { time: t2, wear: 0, flash: 0, aim: 0.5, recoil: 0, seed: 1 }), n2.restore(), n2.globalAlpha = 1;
  }
  drawBeams(e2) {
    let t2 = this.ctx;
    for (let n2 of e2.effects.beams) {
      let e3 = n2.life / n2.maxLife, r2 = 0.9 * (0.4 + 0.6 * e3), i2 = t2.createLinearGradient(0, n2.y, 0, n2.y + 9);
      i2.addColorStop(0, Hs(n2.color, 0.75 * e3)), i2.addColorStop(1, Hs(n2.color, 0)), t2.fillStyle = i2, t2.fillRect(n2.x - r2 / 2, n2.y, r2, 9), t2.fillStyle = Hs(`#ffffff`, 0.6 * e3), t2.fillRect(n2.x - r2 * 0.15, n2.y, r2 * 0.3, 9 * e3);
    }
  }
  drawThrowTrail(e2) {
    let t2 = e2.throwTrail;
    if (t2.length < 2) return;
    let n2 = this.ctx;
    for (let e3 = 1; e3 < t2.length; e3++) {
      let r2 = t2[e3 - 1], i2 = t2[e3], a2 = e3 / (t2.length - 1);
      n2.globalAlpha = 0.75 * Math.max(0, 1 - i2.age / 0.2) * a2, n2.strokeStyle = a2 > 0.6 ? `#ffffff` : No, n2.lineWidth = 0.04 + 0.16 * a2, n2.lineCap = `round`, n2.beginPath(), n2.moveTo(r2.x, r2.y), n2.lineTo(i2.x, i2.y), n2.stroke();
    }
    n2.globalAlpha = 1;
  }
  drawCoins(e2) {
    let t2 = this.ctx;
    for (let n2 of e2.coins) {
      let e3 = Math.max(0.15, Math.abs(Math.cos(n2.spin)));
      t2.save(), t2.translate(n2.x, n2.y), t2.scale(e3, 1), t2.fillStyle = `#ffd23f`, t2.beginPath(), t2.arc(0, 0, 0.13, 0, TAU), t2.fill(), t2.strokeStyle = `#b07a00`, t2.lineWidth = 0.025, t2.stroke(), t2.fillStyle = `#fff3b0`, t2.beginPath(), t2.arc(-0.035, 0.035, 0.04, 0, TAU), t2.fill(), t2.restore();
    }
  }
  drawHandBlob(e2, t2, n2) {
    let r2 = e2.hand;
    if (!r2 || r2.size <= 0.02) return;
    let i2 = this.ctx, a2 = 0.17 * r2.size, o2 = e2.time, s2 = 1 + 0.05 * Math.sin(o2 * 5), l2 = 1 / s2;
    r2.charging && (s2 = 1 + (0.06 + 0.12 * r2.power) * Math.sin(o2 * (14 + 10 * r2.power)), l2 = 1 / s2), r2.swinging && (s2 = 1.45, l2 = 0.72);
    let u2 = { x: t2.x + n2.x * a2 * 0.6, y: t2.y + n2.y * a2 * 0.6 };
    i2.save(), i2.translate(u2.x, u2.y), i2.rotate(Math.atan2(n2.y, n2.x)), i2.scale(s2, l2);
    let d2 = i2.createRadialGradient(-a2 * 0.35, a2 * 0.35, a2 * 0.1, 0, 0, a2);
    d2.addColorStop(0, `#f2ffe4`), d2.addColorStop(0.45, No), d2.addColorStop(1, `#3f9a1c`), i2.fillStyle = d2, i2.beginPath(), i2.arc(0, 0, a2, 0, TAU), i2.fill(), i2.strokeStyle = As, i2.lineWidth = ks, i2.stroke(), r2.charging && r2.power > 0.3 && (i2.fillStyle = No, i2.beginPath(), i2.ellipse(-a2 * 0.2, -a2 * (1 + 0.3 * r2.power), a2 * 0.18, a2 * 0.3 * r2.power, 0, 0, TAU), i2.fill()), i2.restore();
  }
  drawGums(e2) {
    let t2 = this.ctx;
    for (let n2 of e2.slime.gums) {
      let r2 = n2.body.getPosition(), i2 = this.lerpPos(n2.prevX, n2.prevY, r2.x, r2.y, e2.alpha), a2 = Math.min(1, n2.life / 1), o2 = 1 + (0.08 + 0.5 * n2.jiggle) * Math.sin(e2.time * (8 + 16 * n2.jiggle) + n2.seed), s2 = n2.radius * o2, l2 = n2.radius / o2;
      t2.save(), t2.translate(i2.x, i2.y), t2.globalAlpha = 0.92 * a2, t2.fillStyle = No, t2.beginPath(), t2.ellipse(0, 0, s2, l2, 0, 0, TAU), t2.fill(), t2.lineWidth = ks, t2.strokeStyle = `#4a9a2e`, t2.stroke(), t2.globalAlpha = 0.75 * a2, t2.fillStyle = `#f4ffe8`, t2.beginPath(), t2.ellipse(-s2 * 0.35, -l2 * 0.35, s2 * 0.28, l2 * 0.18, -0.6, 0, TAU), t2.fill(), t2.restore();
    }
  }
  drawWells(e2) {
    let t2 = this.ctx;
    for (let n2 of e2.wells) {
      let r2 = Math.min(1, n2.time / 0.6);
      t2.save(), t2.lineWidth = 0.06;
      for (let i2 = 0; i2 < 3; i2++) {
        let a2 = n2.radius * (0.35 + 0.22 * i2), o2 = e2.time * (1.6 + i2 * 0.7) + i2 * 2.1;
        t2.globalAlpha = (0.55 - i2 * 0.12) * r2, t2.strokeStyle = Fs, t2.beginPath(), t2.arc(n2.x, n2.y, a2, o2, o2 + 4.4), t2.stroke();
      }
      t2.globalAlpha = 0.7 * r2, t2.fillStyle = Fs, t2.beginPath(), t2.arc(n2.x, n2.y, 0.2 + 0.05 * Math.sin(e2.time * 6), 0, TAU), t2.fill(), t2.restore();
    }
  }
  drawPuddles(e2) {
    let t2 = this.ctx;
    for (let n2 of e2.slime.puddles) {
      let r2 = Math.min(1, (n2.maxLife - n2.life) / 0.25), i2 = Math.min(1, n2.life / 0.9) * r2, a2 = 1 + 0.03 * Math.sin(e2.time * 3 + n2.seed), o2 = n2.halfW * a2 * (0.4 + 0.6 * r2), s2 = 0.05 * (0.4 + 0.6 * r2);
      t2.globalAlpha = 0.9 * i2, t2.fillStyle = n2.glue ? Is : No, t2.beginPath(), t2.ellipse(n2.x, n2.y + 0.02, o2, s2, 0, 0, TAU), t2.fill(), t2.lineWidth = ks, t2.strokeStyle = n2.glue ? `#8a5a18` : `#4a9a2e`, t2.stroke(), t2.globalAlpha = 0.7 * i2, t2.fillStyle = `#f4ffe8`, t2.beginPath(), t2.ellipse(n2.x - o2 * 0.3, n2.y + 0.045, o2 * 0.35, s2 * 0.25, 0, 0, TAU), t2.fill(), t2.globalAlpha = 1;
    }
  }
  drawObjects(e2) {
    let t2 = this.ctx;
    for (let n2 of e2.objects) {
      let r2 = this.lerpPos(n2.prevX, n2.prevY, n2.body.getPosition().x, n2.body.getPosition().y, e2.alpha), i2 = Ws(n2.prevA, n2.body.getAngle(), e2.alpha);
      if (t2.save(), t2.translate(r2.x, r2.y), t2.rotate(i2), n2.kind === `crate`) {
        let e3 = n2.size;
        t2.fillStyle = Rs.crateFill, t2.fillRect(-e3, -e3, 2 * e3, 2 * e3), t2.strokeStyle = Rs.crateLine, t2.lineWidth = ks * 1.3, t2.strokeRect(-e3, -e3, 2 * e3, 2 * e3), t2.beginPath(), t2.moveTo(-e3, -e3), t2.lineTo(e3, e3), t2.moveTo(e3, -e3), t2.lineTo(-e3, e3), t2.stroke();
      } else t2.fillStyle = Rs.ballFill, t2.beginPath(), t2.arc(0, 0, n2.size, 0, TAU), t2.fill(), t2.strokeStyle = Rs.ballEdge, t2.lineWidth = ks * 1.3, t2.stroke(), t2.fillStyle = Rs.ballStripe, t2.fillRect(-n2.size, -0.06, 2 * n2.size, 0.12);
      n2.slimeTimer > 0 && (t2.globalAlpha = 0.55 * Math.min(1, n2.slimeTimer / 0.6), t2.fillStyle = No, n2.kind === `crate` ? t2.fillRect(-n2.size, -n2.size, 2 * n2.size, 2 * n2.size) : (t2.beginPath(), t2.arc(0, 0, n2.size, 0, TAU), t2.fill()), t2.globalAlpha = 1), t2.restore();
    }
  }
  poseOf(e2, t2) {
    let n2 = e2.body.getPosition(), r2 = e2.body.getAngle();
    return { x: lerp(e2.prevX, n2.x, t2), y: lerp(e2.prevY, n2.y, t2), a: e2.prevA + wrapAngle(r2 - e2.prevA) * t2 };
  }
  lerpPos(e2, t2, n2, r2, i2) {
    return { x: lerp(e2, n2, i2), y: lerp(t2, r2, i2), a: 0 };
  }
  drawCharacter(e2, t2, n2) {
    if (this.slimeLook) {
      if (e2.team === `player`) return this.drawSlime(e2, t2, n2);
      if (e2.isBrawler) return drawBrawler(this.ctx, e2, t2, n2);
      return this.drawAlien(e2, t2, n2);
    }
    if (e2.state === `dead` && e2.corpseTimer <= 0) return;
    let r2 = this.ctx, i2 = e2.team === `player` ? js : Bs(e2), a2 = e2.state === `dead` ? Math.min(1, e2.corpseTimer / 1.2) : 1;
    r2.globalAlpha = a2;
    let o2 = /* @__PURE__ */ new Map();
    for (let n3 of RAGDOLL_PARTS) {
      let r3 = e2.parts.get(n3.name);
      r3 && o2.set(n3.name, this.poseOf(r3, t2));
    }
    r2.lineCap = `round`, r2.lineJoin = `round`;
    for (let e3 of RAGDOLL_PARTS) this.drawPart(e3, o2.get(e3.name), As, ks);
    for (let t3 of RAGDOLL_PARTS) {
      let n3 = e2.parts.get(t3.name).flash > 0 ? Ms : i2;
      this.drawPart(t3, o2.get(t3.name), n3, 0);
    }
    if (e2.slimeTimer > 0) {
      let t3 = Math.min(1, e2.slimeTimer / Math.max(0.1, e2.slimeMax) * 2) * 0.35;
      for (let e3 of RAGDOLL_PARTS) this.drawPart(e3, o2.get(e3.name), `rgba(141,255,90,${t3.toFixed(3)})`, 0);
      for (let t4 of e2.blobs) {
        let n3 = o2.get(t4.part);
        if (!n3) continue;
        let i3 = Us(n3, t4.x, t4.y);
        r2.globalAlpha = a2 * Math.min(1, e2.slimeTimer / 0.5) * 0.9, r2.fillStyle = No, r2.beginPath(), r2.arc(i3.x, i3.y, t4.r, 0, TAU), r2.fill(), r2.lineWidth = ks * 0.8, r2.strokeStyle = `#4a9a2e`, r2.stroke(), r2.globalAlpha = a2;
      }
    }
    r2.fillStyle = As;
    for (let e3 of RAGDOLL_JOINTS) {
      let t3 = o2.get(e3.parent);
      if (!t3) continue;
      let n3 = Us(t3, e3.parentAnchor.x, e3.parentAnchor.y);
      r2.beginPath(), r2.arc(n3.x, n3.y, 0.042, 0, TAU), r2.fill();
    }
    let s2 = o2.get(`head`);
    s2 && this.drawFace(e2, s2, n2), r2.globalAlpha = 1;
  }
  drawPart(e2, t2, n2, r2) {
    let i2 = this.ctx;
    i2.save(), i2.translate(t2.x, t2.y), i2.rotate(t2.a), e2.box ? (i2.beginPath(), i2.roundRect(-e2.box.hx - r2, -e2.box.hy - r2, 2 * (e2.box.hx + r2), 2 * (e2.box.hy + r2), 0.03 + r2), i2.fillStyle = n2, i2.fill()) : e2.circle ? (i2.beginPath(), i2.arc(0, 0, e2.radius + r2, 0, TAU), i2.fillStyle = n2, i2.fill()) : e2.a && e2.b && (i2.beginPath(), i2.moveTo(e2.a.x, e2.a.y), i2.lineTo(e2.b.x, e2.b.y), i2.strokeStyle = n2, i2.lineWidth = 2 * (e2.radius + r2), i2.stroke()), i2.restore();
  }
  drawSlime(e2, t2, n2) {
    if (e2.state === `dead` && e2.corpseTimer <= 0) return;
    let r2 = this.ctx, i2 = SLIME_LOOK, a2 = e2.slimeBody || (e2.slimeBody = new SlimeBody()), o2 = a2.fx || (a2.fx = { t: null, hurt: 0, lastHp: e2.hp, blink: Math.random() * 3 });
    let s2 = o2.t === null ? 1 / 60 : clamp(n2 - o2.t, 0, 1 / 30);
    o2.t = n2, e2.hp < o2.lastHp - 0.5 && (o2.hurt = i2.hurtTime), o2.lastHp = e2.hp, o2.hurt = Math.max(0, o2.hurt - s2);
    let c2 = e2.state === `dead` ? Math.min(1, e2.corpseTimer / 1.2) : 1, l2 = e2.facing >= 0 ? 1 : -1, u2 = {};
    for (let [e3, n3] of e2.parts) {
      let r3 = this.poseOf(n3, t2), i3 = n3.body.getLinearVelocity();
      u2[e3] = { x: r3.x, y: r3.y, a: r3.a, vx: i3.x, vy: i3.y };
    }
    a2.update(s2, u2, l2);
    let tr = u2.torso;
    if (tr && e2.alive) {
      if (a2.tipSpeed > 5 && !(o2.lastTentacle !== undefined && n2 - o2.lastTentacle < 0.25)) { o2.lastTentacle = n2; snd(`tentacle`, { x: tr.x, vol: clamp(a2.tipSpeed / 12, 0.3, 1.2) }); }
      if (a2.squashSpeed > 3.5 && !(o2.lastSquish !== undefined && n2 - o2.lastSquish < 0.2)) { o2.lastSquish = n2; snd(`squish`, { x: tr.x }); }
    }
    let d2 = u2.torso, f2 = u2.head, p2 = u2.pelvis, m2 = e2.team === `player` ? slimeRgb(No) : slimeRgb(Bs(e2));
    if (e2.slimeTimer > 0) m2 = slimeMix(m2, slimeRgb(No), Math.min(1, e2.slimeTimer / Math.max(0.1, e2.slimeMax) * 2) * 0.6);
    let h2 = slimeMix(m2, [255, 255, 255], 0.6), g2 = slimeMix(m2, [20, 40, 70], 0.5), _2 = slimeMix(m2, [20, 40, 70], 0.32), v2 = slimeMix(m2, [10, 30, 60], 0.65), y2 = i2.outline;
    let b2 = (e3) => {
      let t3 = Math.cos(d2.a), n3 = Math.sin(d2.a), r3 = e3.x - d2.x, i3 = e3.y - d2.y, o3 = (t3 * r3 + n3 * i3) * a2.sx, s3 = (-n3 * r3 + t3 * i3) * a2.sy;
      return { x: d2.x + t3 * o3 - n3 * s3, y: d2.y + n3 * o3 + t3 * s3 };
    }, x2 = (e3) => e3 * 0.5 * (a2.sx + a2.sy), S2 = (e3, t3, n3) => Us(u2[e3], t3, n3), C2 = i2.bodyRadii;
    let w2 = { pts: [b2(S2(`pelvis`, 0, 0.04)), b2(S2(`torso`, 0, -0.06)), b2(S2(`torso`, 0, 0.14)), b2(S2(`head`, 0, -0.04))], rs: [x2(C2[0]), x2(C2[1]), x2(C2[2]), x2(C2[3])], per: 9, wob: 0.012, seed: 1 };
    let T2 = (e3, t3) => {
      let n3 = u2[`thigh` + t3], r3 = u2[`shin` + t3], a3 = u2[`foot` + t3];
      return { pts: [Us(p2, t3 === `L` ? -0.07 : 0.07, -0.02), Us(n3, 0, -0.2), Us(r3, 0, -0.2), Us(a3, 0.02, 0)], rs: i2.legRadii, per: 6, wob: 0.015, seed: 3 };
    }, E2 = (e3) => {
      let t3 = u2[`upperArm` + e3], n3 = u2[`lowerArm` + e3];
      return { pts: [Us(d2, e3 === `L` ? -0.13 : 0.13, 0.12), Us(t3, 0, -0.13), Us(n3, 0, -0.1), Us(n3, 0, -0.2)], rs: i2.armRadii, per: 6, wob: 0.015, seed: 3 };
    };
    let D2 = l2 > 0 ? `R` : `L`, O2 = l2 > 0 ? `L` : `R`, k2 = a2.tentacles.filter((e3) => e3.pts.length > 1).map((e3) => ({ pts: e3.pts, rs: e3.pts.map((t3, n3) => lerp(e3.def.width0, e3.def.width1, n3 / (e3.pts.length - 1)) / 2), per: 6, wob: 0, seed: 0 }));
    let A2 = [...k2, T2(0, O2), E2(O2)], j2 = [T2(0, D2), w2, E2(D2)];
    r2.save(), r2.globalAlpha = c2, r2.lineCap = `round`, r2.lineJoin = `round`;
    slimePath(r2, A2, y2, a2.phase), r2.fillStyle = i2.ink, r2.fill(), slimePath(r2, A2, 0, a2.phase), r2.fillStyle = slimeCss(_2), r2.fill();
    slimePath(r2, j2, y2, a2.phase), r2.fillStyle = i2.ink, r2.fill(), slimePath(r2, j2, 0, a2.phase);
    let M2 = e2.parts.get(`torso`).flash > 0 || e2.parts.get(`head`).flash > 0;
    r2.fillStyle = M2 ? Ms : slimeCss(m2), r2.fill(), r2.save(), r2.clip();
    let N2 = f2.y + 0.3, P2 = Math.min(u2.footL.y, u2.footR.y) - 0.1, F2 = r2.createLinearGradient(0, N2, 0, P2);
    F2.addColorStop(0, slimeCss(h2, 0.75)), F2.addColorStop(0.35, slimeCss(m2, 0)), F2.addColorStop(1, slimeCss(g2, 0.7)), r2.fillStyle = F2, r2.fillRect(d2.x - 2, P2 - 0.2, 4, N2 - P2 + 0.5);
    let I2 = b2(d2);
    r2.fillStyle = slimeCss(v2, 0.28), r2.beginPath(), r2.ellipse(I2.x, I2.y, 0.11 * a2.sx, 0.2 * a2.sy, d2.a, 0, TAU), r2.fill(), r2.fillStyle = slimeCss(h2, 0.55), r2.strokeStyle = slimeCss(v2, 0.35), r2.lineWidth = 0.012;
    for (let e3 = 0; e3 < 3; e3++) {
      let t3 = Us(d2, Math.sin(a2.phase * 0.35 + e3 * 2.1) * 0.1, -0.1 + (a2.phase * 0.07 + e3 * 0.37) % 0.4);
      r2.beginPath(), r2.arc(t3.x, t3.y, 0.03 + 0.012 * e3, 0, TAU), r2.fill(), r2.stroke();
    }
    r2.fillStyle = `rgba(255,255,255,0.8)`;
    let L2 = Us(f2, -l2 * 0.1, 0.1);
    r2.beginPath(), r2.ellipse(L2.x, L2.y, 0.075, 0.04, f2.a + 0.7 * l2, 0, TAU), r2.fill(), r2.fillStyle = `rgba(255,255,255,0.5)`;
    let R2 = Us(d2, -l2 * 0.12, 0.08);
    if (r2.beginPath(), r2.ellipse(R2.x, R2.y, 0.03, 0.065, d2.a + 0.2 * l2, 0, TAU), r2.fill(), r2.restore(), e2.slimeTimer > 0) for (let t3 of e2.blobs) {
      let n3 = u2[t3.part];
      if (!n3) continue;
      let i3 = Us(n3, t3.x, t3.y);
      r2.globalAlpha = c2 * Math.min(1, e2.slimeTimer / 0.5) * 0.9, r2.fillStyle = No, r2.beginPath(), r2.arc(i3.x, i3.y, t3.r, 0, TAU), r2.fill(), r2.lineWidth = ks * 0.8, r2.strokeStyle = `#4a9a2e`, r2.stroke(), r2.globalAlpha = c2;
    }
    this.drawSlimeFace(e2, f2, l2, m2, a2, n2), r2.restore();
  }
  drawSlimeFace(e2, t2, n2, r2, i2, a2) {
    let o2 = this.ctx, s2 = SLIME_LOOK, c2 = i2.fx, l2 = s2.ink;
    o2.save(), o2.translate(t2.x, t2.y), o2.rotate(t2.a);
    let u2 = e2.state === `dead` || e2.dazed, d2 = (a2 * 0.9 + c2.blink) % 3.4 > 3.28, f2 = n2 * 0.06, p2 = 0.015, m2 = s2.eyeSep, h2 = s2.eye, g2 = e2.team === `player` ? 0.85 : 1, _2 = n2, v2 = 0;
    if (e2.team !== `player` && this.scenePlayer) {
      let n3 = this.scenePlayer.torsoPosition(), r3 = n3.x - t2.x, i3 = n3.y - t2.y, a3 = Math.hypot(r3, i3) || 1;
      _2 = r3 / a3, v2 = i3 / a3;
    } else if (e2.aimPhi !== null && e2.aimPhi !== void 0) _2 = Math.sin(e2.aimPhi), v2 = -Math.cos(e2.aimPhi);
    let y2 = Math.cos(-t2.a), b2 = Math.sin(-t2.a), x2 = y2 * _2 - b2 * v2, S2 = b2 * _2 + y2 * v2;
    o2.lineCap = `round`, o2.lineJoin = `round`, o2.strokeStyle = l2, o2.fillStyle = l2, o2.lineWidth = 0.022;
    for (let e3 of [-1, 1]) {
      let t3 = f2 + e3 * m2, n3 = p2;
      if (u2) {
        let e4 = 0.05;
        o2.beginPath(), o2.moveTo(t3 - e4, n3 - e4), o2.lineTo(t3 + e4, n3 + e4), o2.moveTo(t3 + e4, n3 - e4), o2.lineTo(t3 - e4, n3 + e4), o2.lineWidth = 0.03, o2.stroke();
      } else if (d2) o2.beginPath(), o2.lineWidth = 0.03, o2.moveTo(t3 - 0.07, n3 - 0.02), o2.lineTo(t3 + 0.07, n3 - 0.02), o2.stroke();
      else {
        o2.beginPath(), o2.ellipse(t3, n3, h2 * 0.92, h2, 0, 0, TAU), o2.fillStyle = `#fff7c2`, o2.fill(), o2.lineWidth = 0.02, o2.strokeStyle = l2, o2.stroke();
        let i3 = t3 + x2 * h2 * 0.42, a3 = n3 + S2 * h2 * 0.34;
        o2.fillStyle = c2.hurt > 0 ? `#ff3b3b` : l2, o2.beginPath(), o2.arc(i3, a3, h2 * 0.42, 0, TAU), o2.fill(), o2.fillStyle = `#ffffff`, o2.beginPath(), o2.arc(i3 + h2 * 0.12, a3 + h2 * 0.14, h2 * 0.12, 0, TAU), o2.fill();
        let s3 = t3 + e3 * h2 * 1.02, d3 = t3 - e3 * h2 * 1.02, m3 = h2 * (0.55 + 0.35 * g2);
        o2.save(), o2.beginPath(), o2.ellipse(t3, n3, h2 * 0.92, h2, 0, 0, TAU), o2.clip(), o2.beginPath(), o2.moveTo(s3, n3 + h2 * 0.1), o2.lineTo(d3, n3 + h2 * 0.1 - m3), o2.lineTo(d3, n3 + h2 * 1.4), o2.lineTo(s3, n3 + h2 * 1.4), o2.closePath(), o2.fillStyle = slimeCss(r2), o2.fill(), o2.restore(), o2.strokeStyle = l2, o2.lineWidth = 0.034, o2.beginPath(), o2.moveTo(s3, n3 + h2 * 0.1 + 0.01), o2.lineTo(d3, n3 + h2 * 0.1 - m3), o2.stroke();
      }
    }
    let b3 = f2 + (e2.team === `player` ? n2 * 0.015 : 0), x3 = -0.13;
    if (u2) o2.strokeStyle = l2, o2.lineWidth = 0.026, o2.beginPath(), o2.moveTo(b3 - 0.08, x3), o2.quadraticCurveTo(b3 - 0.03, x3 + 0.04, b3, x3), o2.quadraticCurveTo(b3 + 0.03, x3 - 0.04, b3 + 0.08, x3), o2.stroke();
    else {
      let e3 = c2.hurt > 0 ? 0.1 : 0.15, t3 = c2.hurt > 0 ? 0.11 : 0.075;
      o2.beginPath(), o2.moveTo(b3 - e3, x3 + 0.02), o2.quadraticCurveTo(b3, x3 - t3 * 2.1, b3 + e3, x3 + 0.02), o2.quadraticCurveTo(b3, x3 + 0.03, b3 - e3, x3 + 0.02), o2.closePath(), o2.fillStyle = l2, o2.fill(), o2.lineWidth = 0.02, o2.strokeStyle = l2, o2.stroke(), o2.fillStyle = `#ffffff`;
      for (let t4 of [-0.55, 0.55]) {
        let n3 = b3 + t4 * e3;
        o2.beginPath(), o2.moveTo(n3 - 0.022, x3 + 0.018 - Math.abs(t4) * 0.02), o2.lineTo(n3 + 0.022, x3 + 0.018 - Math.abs(t4) * 0.02), o2.lineTo(n3, x3 - 0.035), o2.closePath(), o2.fill();
      }
    }
    o2.restore();
  }
  drawAlien(e, alpha, time) {
    if (e.state === `dead` && e.corpseTimer <= 0) return;
    const ctx = this.ctx;
    const body = e.slimeBody || (e.slimeBody = new SlimeBody(ALIEN_TENTACLE_DEFS));
    const fx = body.fx || (body.fx = { t: null, hurt: 0, lastHp: e.hp, blink: Math.random() * 3 });
    const dt = fx.t === null ? 1 / 60 : clamp(time - fx.t, 0, 1 / 30);
    fx.t = time;
    if (e.hp < fx.lastHp - 0.5) fx.hurt = ALIEN_LOOK.hurtTime;
    fx.lastHp = e.hp; fx.hurt = Math.max(0, fx.hurt - dt);
    const fade = e.state === `dead` ? Math.min(1, e.corpseTimer / 1.2) : 1;
    const f = e.facing >= 0 ? 1 : -1;
    const u = {};
    for (const [name, part] of e.parts) {
      const p = this.poseOf(part, alpha), v = part.body.getLinearVelocity();
      u[name] = { x: p.x, y: p.y, a: p.a, vx: v.x, vy: v.y };
    }
    body.update(dt, u, f);
    const torso = u.torso, head = u.head, pelvis = u.pelvis;
    if (torso && e.alive) {
      if (body.tipSpeed > 5 && !(fx.lastTentacle !== undefined && time - fx.lastTentacle < 0.25)) { fx.lastTentacle = time; snd(`tentacle`, { x: torso.x, vol: clamp(body.tipSpeed / 12, 0.3, 1.2) }); }
      if (body.squashSpeed > 3.5 && !(fx.lastSquish !== undefined && time - fx.lastSquish < 0.2)) { fx.lastSquish = time; snd(`squish`, { x: torso.x }); }
    }
    const pal = e.isBrawler ? { skin: `#d94f22`, glow: `#ff8a1f` } : ALIEN_PALETTES[Math.abs(e.id | 0) % ALIEN_PALETTES.length];
    let skin = slimeRgb(pal.skin);
    const glow = slimeRgb(pal.glow);
    if (e.slimeTimer > 0) skin = slimeMix(skin, slimeRgb(`#8dff5a`), Math.min(1, e.slimeTimer / Math.max(0.1, e.slimeMax) * 2) * 0.6);
    const light = slimeMix(skin, [255, 255, 255], 0.5), dark = slimeMix(skin, [18, 10, 40], 0.5), mid = slimeMix(slimeMix(skin, glow, 0.35), [18, 10, 40], 0.1);
    const sq = (p) => { // squash the body around the torso
      const c = Math.cos(torso.a), s = Math.sin(torso.a), rx = p.x - torso.x, ry = p.y - torso.y;
      const ox = (c * rx + s * ry) * body.sx, oy = (-s * rx + c * ry) * body.sy;
      return { x: torso.x + c * ox - s * oy, y: torso.y + s * ox + c * oy };
    };
    const xr = (r) => r * 0.5 * (body.sx + body.sy);
    const bodyShape = { pts: [sq(Us(pelvis, 0, 0.02)), sq(Us(torso, 0, -0.08)), sq(Us(torso, 0, 0.13)), sq(Us(head, 0, -0.1))], rs: [xr(0.1), xr(0.135), xr(0.145), xr(0.075)], per: 8, wob: 0.01, seed: 2 };
    const headShape = { pts: [Us(head, 0, -0.07), Us(head, 0, 0.03), Us(head, 0, 0.12), Us(head, 0, 0.2)], rs: [0.11, 0.228, 0.215, 0.125], per: 8, wob: 0.008, seed: 5 };
    const leg = (s) => {
      const th = u[`thigh` + s], sh = u[`shin` + s], ft = u[`foot` + s];
      return { pts: [Us(pelvis, s === `L` ? -0.06 : 0.06, -0.02), Us(th, 0, -0.02), Us(th, 0, -0.21), Us(sh, 0, 0.0), Us(sh, 0, -0.2), Us(ft, -0.02, 0), Us(ft, 0.11, 0)], rs: [0.075, 0.068, 0.062, 0.052, 0.05, 0.058, 0.04], per: 5, wob: 0.01, seed: 3 };
    };
    const arm = (s) => {
      const up = u[`upperArm` + s], lo = u[`lowerArm` + s];
      const fist = e.isBrawler ? 1 + 0.35 * (e.meleeWind || 0) : 1;
      return { pts: [Us(torso, s === `L` ? -0.12 : 0.12, 0.12), Us(up, 0, -0.03), Us(up, 0, -0.15), Us(lo, 0, 0.02), Us(lo, 0, -0.2)], rs: [0.065, 0.054, 0.048, 0.042, 0.058 * fist], per: 5, wob: 0.01, seed: 4 };
    };
    const near = f > 0 ? `R` : `L`, far = f > 0 ? `L` : `R`;
    const tshape = (t) => ({ pts: t.pts, rs: t.pts.map((_, i) => lerp(t.def.width0, t.def.width1, i / (t.pts.length - 1)) / 2), per: 6, wob: 0, seed: 0 });
    const tents = body.tentacles.filter((t) => t.pts.length > 1);
    const byId = (pre) => tents.filter((t) => t.def.id.startsWith(pre));
    const backShapes = [...byId(`whip`).map(tshape), ...byId(`ant`).map(tshape), leg(far), arm(far)];
    const mainShapes = [leg(near), bodyShape, headShape, arm(near)];
    const chinShapes = byId(`chin`).map(tshape);
    const OUT = ALIEN_LOOK.outline;
    ctx.save(); ctx.globalAlpha = fade; ctx.lineCap = `round`; ctx.lineJoin = `round`;
    { // soft aura so the aliens pop against the dark sky
      const ac = sq(Us(torso, 0, 0.1)), ag = ctx.createRadialGradient(ac.x, ac.y, 0.1, ac.x, ac.y, 1.05);
      ag.addColorStop(0, slimeCss(glow, 0.2)); ag.addColorStop(1, slimeCss(glow, 0));
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(ac.x, ac.y, 1.05, 0, TAU); ctx.fill();
    }
    // far limbs + whips + antennae
    slimePath(ctx, backShapes, OUT, body.phase); ctx.fillStyle = ALIEN_LOOK.ink; ctx.fill();
    slimePath(ctx, backShapes, 0, body.phase); ctx.fillStyle = slimeCss(dark); ctx.fill();
    // main silhouette
    slimePath(ctx, mainShapes, OUT, body.phase); ctx.fillStyle = ALIEN_LOOK.ink; ctx.fill();
    slimePath(ctx, mainShapes, 0, body.phase);
    const flash = e.parts.get(`torso`).flash > 0 || e.parts.get(`head`).flash > 0;
    ctx.fillStyle = flash ? `#fff3a3` : slimeCss(skin); ctx.fill();
    ctx.save(); ctx.clip();
    const top = head.y + 0.3, bot = Math.min(u.footL.y, u.footR.y) - 0.1;
    const gr = ctx.createLinearGradient(0, top, 0, bot);
    gr.addColorStop(0, slimeCss(light, 0.55)); gr.addColorStop(0.3, slimeCss(skin, 0)); gr.addColorStop(1, slimeCss(dark, 0.65));
    ctx.fillStyle = gr; ctx.fillRect(torso.x - 2, bot - 0.2, 4, top - bot + 0.5);
    // belly plate + ribs
    const bc = sq(Us(torso, f * 0.03, 0.0));
    ctx.fillStyle = slimeCss(light, 0.32); ctx.beginPath(); ctx.ellipse(bc.x, bc.y, 0.075 * body.sx, 0.2 * body.sy, torso.a, 0, TAU); ctx.fill();
    ctx.strokeStyle = slimeCss(dark, 0.55); ctx.lineWidth = 0.014;
    for (let i = 0; i < 4; i++) {
      const y = -0.1 + i * 0.075;
      const a = Us(torso, -0.12, y), b = Us(torso, f * 0.04, y - 0.035), c = Us(torso, 0.12, y);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(b.x, b.y, c.x, c.y); ctx.stroke();
    }
    // cranium highlight
    ctx.fillStyle = `rgba(255,255,255,0.4)`;
    const hl = Us(head, -f * 0.09, 0.14); ctx.beginPath(); ctx.ellipse(hl.x, hl.y, 0.06, 0.03, head.a + 0.8 * f, 0, TAU); ctx.fill();
    ctx.restore();
    // chin tentacles (their own layer so they read as dangling things)
    slimePath(ctx, chinShapes, OUT * 0.8, body.phase); ctx.fillStyle = ALIEN_LOOK.ink; ctx.fill();
    slimePath(ctx, chinShapes, 0, body.phase); ctx.fillStyle = flash ? `#fff3a3` : slimeCss(mid); ctx.fill();
    for (const t of byId(`chin`)) { // glowing suckers
      const n = t.pts.length;
      for (let i = 1; i < n - 1; i++) {
        const p = t.pts[i], r = lerp(t.def.width0, t.def.width1, i / (n - 1)) * 0.3;
        ctx.fillStyle = slimeCss(glow, 0.55 + 0.35 * Math.sin(body.phase * 1.3 + i)); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      }
    }
    // glowing whip tips and antenna bulbs
    for (const t of byId(`whip`)) { const p = t.pts[t.pts.length - 1]; ctx.fillStyle = slimeCss(glow, 0.9); ctx.beginPath(); ctx.arc(p.x, p.y, 0.026, 0, TAU); ctx.fill(); }
    for (const t of byId(`ant`)) {
      const p = t.pts[t.pts.length - 1], pulse = 0.8 + 0.2 * Math.sin(body.phase * 1.6 + t.def.local.x * 20);
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 0.14);
      grd.addColorStop(0, slimeCss(glow, 0.55 * pulse)); grd.addColorStop(1, slimeCss(glow, 0));
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p.x, p.y, 0.14, 0, TAU); ctx.fill();
      ctx.fillStyle = ALIEN_LOOK.ink; ctx.beginPath(); ctx.arc(p.x, p.y, 0.05, 0, TAU); ctx.fill();
      ctx.fillStyle = slimeCss(glow); ctx.beginPath(); ctx.arc(p.x, p.y, 0.038, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,0.8)`; ctx.beginPath(); ctx.arc(p.x - 0.012, p.y + 0.012, 0.01, 0, TAU); ctx.fill();
    }
    // chest core + head spots
    const core = sq(Us(torso, f * 0.02, 0.03)), pulse = 0.65 + 0.35 * Math.sin(body.phase * 1.2) + (fx.hurt > 0 ? 0.4 : 0);
    const cg = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, 0.11);
    cg.addColorStop(0, slimeCss(glow, 0.9 * Math.min(1, pulse))); cg.addColorStop(1, slimeCss(glow, 0));
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(core.x, core.y, 0.11, 0, TAU); ctx.fill();
    ctx.fillStyle = slimeCss([255, 255, 255], 0.85); ctx.beginPath(); ctx.arc(core.x, core.y, 0.02, 0, TAU); ctx.fill();
    for (const [lx, ly, r, ph] of [[-0.12, 0.13, 0.022, 0], [-0.04, 0.2, 0.018, 1.7], [-0.15, 0.04, 0.016, 3.1], [0.12, 0.17, 0.016, 4.4]]) {
      const p = Us(head, lx * f, ly);
      ctx.fillStyle = slimeCss(glow, 0.45 + 0.4 * Math.sin(body.phase * 1.1 + ph)); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    }
    if (e.slimeTimer > 0) for (const b of e.blobs) {
      const n = u[b.part]; if (!n) continue;
      const p = Us(n, b.x, b.y);
      ctx.globalAlpha = fade * Math.min(1, e.slimeTimer / 0.5) * 0.9; ctx.fillStyle = `#8dff5a`; ctx.beginPath(); ctx.arc(p.x, p.y, b.r, 0, TAU); ctx.fill();
      ctx.lineWidth = 0.024; ctx.strokeStyle = `#4a9a2e`; ctx.stroke(); ctx.globalAlpha = fade;
    }
    this.drawAlienFace(e, head, f, skin, glow, body, time);
    ctx.restore();
  }
  drawAlienFace(e, head, f, skin, glow, body, time) {
    const ctx = this.ctx, fx = body.fx, ink = ALIEN_LOOK.ink;
    ctx.save(); ctx.translate(head.x, head.y); ctx.rotate(head.a);
    const down = e.state === `dead` || e.dazed, blinkT = (time * 0.9 + fx.blink) % 3.6, blink = blinkT > 3.46 ? 1 : 0;
    const hurt = fx.hurt > 0;
    // where to look (head frame)
    let dx = f, dy = 0;
    if (this.scenePlayer) { const p = this.scenePlayer.torsoPosition(), rx = p.x - head.x, ry = p.y - head.y, d = Math.hypot(rx, ry) || 1; dx = rx / d; dy = ry / d; }
    const c = Math.cos(-head.a), s = Math.sin(-head.a), lx = c * dx - s * dy, ly = s * dx + c * dy;
    const ex = f * 0.06, ey = 0.04, rx = 0.125, ry = 0.135;
    // halo
    const halo = ctx.createRadialGradient(ex, ey, 0.05, ex, ey, 0.26);
    halo.addColorStop(0, slimeCss(glow, hurt ? 0.7 : 0.45)); halo.addColorStop(1, slimeCss(glow, 0));
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(ex, ey, 0.26, 0, TAU); ctx.fill();
    // eye socket + sclera
    ctx.beginPath(); ctx.ellipse(ex, ey, rx + 0.012, ry + 0.012, 0, 0, TAU); ctx.fillStyle = ink; ctx.fill();
    ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, TAU); ctx.fillStyle = slimeCss(slimeMix(glow, [255, 255, 255], 0.82)); ctx.fill();
    if (down) {
      ctx.strokeStyle = ink; ctx.lineWidth = 0.03; ctx.beginPath(); const q = 0.055;
      ctx.moveTo(ex - q, ey - q); ctx.lineTo(ex + q, ey + q); ctx.moveTo(ex + q, ey - q); ctx.lineTo(ex - q, ey + q); ctx.stroke();
    } else {
      ctx.save(); ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, TAU); ctx.clip();
      const ix = ex + lx * 0.035, iy = ey + ly * 0.04;
      ctx.fillStyle = hurt ? `#ff3b3b` : slimeCss(glow); ctx.beginPath(); ctx.arc(ix, iy, 0.075, 0, TAU); ctx.fill();
      ctx.strokeStyle = slimeCss(slimeMix(glow, [0, 0, 0], 0.45)); ctx.lineWidth = 0.012; ctx.stroke();
      ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(ix, iy, hurt ? 0.036 : 0.017, hurt ? 0.036 : 0.058, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `#fff`; ctx.beginPath(); ctx.arc(ix + 0.022, iy + 0.03, 0.013, 0, TAU); ctx.fill();
      // heavy lid: slants down toward the front (angry); blink closes it
      const lidBack = blink ? ey - ry : ey + 0.075 + (hurt ? 0.05 : 0), lidFront = blink ? ey - ry : ey - 0.012 + (hurt ? 0.05 : 0);
      // upper lid = everything ABOVE the line: draw as a polygon over the top
      ctx.beginPath(); ctx.moveTo(ex - f * (rx + 0.02), lidBack); ctx.lineTo(ex + f * (rx + 0.02), lidFront); ctx.lineTo(ex + f * (rx + 0.02), ey + ry + 0.05); ctx.lineTo(ex - f * (rx + 0.02), ey + ry + 0.05); ctx.closePath();
      ctx.fillStyle = slimeCss(skin); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = ink; ctx.lineWidth = 0.032; ctx.beginPath(); ctx.moveTo(ex - f * (rx + 0.005), lidBack); ctx.lineTo(ex + f * (rx + 0.005), lidFront); ctx.stroke();
    }
    ctx.restore();
  }
  drawFace(e2, t2, n2) {
    let r2 = this.ctx;
    r2.save(), r2.translate(t2.x, t2.y), r2.rotate(t2.a);
    let i2 = e2.facing * 0.06;
    if (r2.strokeStyle = As, r2.fillStyle = As, r2.lineWidth = 0.02, e2.dazed) {
      let e3 = Math.sin(n2 * 14) * 0.01;
      for (let t3 of [i2 - 0.04, i2 + 0.06]) r2.beginPath(), r2.moveTo(t3 - 0.025 + e3, -5e-3 - 0.025), r2.lineTo(t3 + 0.025 + e3, 0.02), r2.moveTo(t3 + 0.025 + e3, -5e-3 - 0.025), r2.lineTo(t3 - 0.025 + e3, 0.02), r2.stroke();
      r2.beginPath(), r2.moveTo(i2 - 0.02, -0.09), r2.lineTo(i2 + 0.04, -0.09), r2.stroke();
    } else r2.beginPath(), r2.arc(i2 - 0.04, 0, 0.026, 0, TAU), r2.arc(i2 + 0.06, 0, 0.026, 0, TAU), r2.fill(), r2.beginPath(), r2.arc(i2 + 0.01, -0.07, 0.05, 0.25, Math.PI - 0.25), r2.stroke();
    r2.restore();
  }
  drawLaunchers(e2) {
    for (let t2 of [e2.player, ...e2.enemies]) {
      if (t2.state === `dead`) continue;
      let n2 = t2.facing > 0 ? `lowerArmR` : `lowerArmL`, r2 = t2.parts.get(n2);
      if (!r2) continue;
      let i2 = this.poseOf(r2, e2.alpha), a2 = Us(i2, 0, -0.14), o2 = t2.aimPhi === null ? { x: t2.facing, y: -0.3 } : { x: Math.sin(t2.aimPhi), y: -Math.cos(t2.aimPhi) }, s2 = Math.hypot(o2.x, o2.y) || 1, c2 = { x: o2.x / s2, y: o2.y / s2 };
      if (t2 === e2.player && e2.playerLauncher.kind === `hand`) {
        let t3 = { x: Math.sin(i2.a), y: -Math.cos(i2.a) };
        this.drawHandBlob(e2, a2, t3);
      } else ms(this.ctx, t2 === e2.player ? e2.playerLauncher : Jo, a2, c2);
    }
  }
  drawProjectileTrails(e2) {
    let t2 = this.ctx;
    for (let n2 of e2.projectiles) {
      let e3 = n2.trail.length;
      for (let r2 = 0; r2 < e3; r2++) {
        let i2 = (r2 + 1) / e3, a2 = n2.trail[r2];
        if (n2.bossGlob) {
          // Boss glob comet trail: pulsing glow halo
          t2.globalAlpha = 0.25 * i2 * (0.7 + 0.3 * Math.sin(e2.time * 8 + r2 * 0.5));
          const grad = t2.createRadialGradient(a2.x, a2.y, 0, a2.x, a2.y, n2.radius * (0.5 + 1.2 * i2));
          grad.addColorStop(0, `#9dff3a`), grad.addColorStop(0.5, `#7acc2e`), grad.addColorStop(1, `rgba(157,255,58,0)`);
          t2.fillStyle = grad;
          t2.beginPath(), t2.arc(a2.x, a2.y, n2.radius * (0.5 + 1.2 * i2), 0, TAU), t2.fill();
        } else {
          t2.globalAlpha = 0.35 * i2, t2.fillStyle = n2.color, t2.beginPath(), t2.arc(a2.x, a2.y, n2.radius * (0.25 + 0.6 * i2), 0, TAU), t2.fill();
        }
      }
    }
    t2.globalAlpha = 1;
  }
  drawProjectiles(e2) {
    for (let t2 of e2.projectiles) {
      if (!t2.alive) continue;
      let n2 = this.lerpPos(t2.prevX, t2.prevY, t2.body.getPosition().x, t2.body.getPosition().y, e2.alpha), r2 = t2.body.getLinearVelocity(), i2 = Math.atan2(r2.y, r2.x), a2 = this.ctx;
      if (a2.save(), !Ps.has(t2.shot.look)) {
        let o2 = Math.hypot(r2.x, r2.y), s2 = 0.16 * Math.sin(e2.time * 17 + t2.seed) + 0.07 * Math.sin(e2.time * 29 + t2.seed * 2.3), c2 = 1 + Math.min(0.4, o2 * 0.018) + s2, l2 = 1 / c2;
        a2.translate(n2.x, n2.y), a2.rotate(i2), a2.scale(c2, l2), a2.rotate(-i2), a2.translate(-n2.x, -n2.y);
      }
      fs(a2, { look: t2.shot.look, color: t2.color, r: t2.radius * Ns, x: n2.x, y: n2.y, angle: i2, time: e2.time, seed: t2.seed, fuse: t2.fuseLeft }), a2.restore();
      // Boss glob: additional pulsing glow halo in world space
      if (t2.bossGlob) {
        a2.save();
        const pulse = 0.7 + 0.3 * Math.sin(e2.time * 10 + t2.seed);
        const grad = a2.createRadialGradient(n2.x, n2.y, 0, n2.x, n2.y, t2.radius * 2.5 * pulse);
        grad.addColorStop(0, `rgba(157,255,58,${0.4 * pulse})`), grad.addColorStop(0.5, `rgba(122,204,46,${0.2 * pulse})`), grad.addColorStop(1, `rgba(157,255,58,0)`);
        a2.globalAlpha = pulse;
        a2.fillStyle = grad;
        a2.beginPath(), a2.arc(n2.x, n2.y, t2.radius * 2.5 * pulse, 0, TAU), a2.fill();
        a2.restore();
      }
    }
  }
  drawParticles(e2) {
    let t2 = this.ctx;
    for (let n2 of e2.effects.particles) {
      if (!n2.alive) continue;
      let e3 = Math.max(0, n2.life / n2.maxLife);
      t2.globalAlpha = e3, t2.fillStyle = n2.color, t2.beginPath(), t2.arc(n2.x, n2.y, n2.size * (0.5 + 0.5 * e3), 0, TAU), t2.fill();
    }
    for (let n2 of e2.effects.shockwaves) {
      let e3 = 1 - n2.life / n2.maxLife, r2 = 1 - (1 - e3) * (1 - e3);
      t2.globalAlpha = 0.85 * (1 - e3), t2.strokeStyle = n2.color, t2.lineWidth = 0.22 * (1 - e3) + 0.03, t2.beginPath(), t2.arc(n2.x, n2.y, 0.2 + n2.maxR * r2, 0, TAU), t2.stroke();
    }
    t2.globalAlpha = 1;
  }
  drawAimPreview(e2) {
    let t2 = this.ctx, n2 = e2.aim;
    if (!n2.active || n2.path.length === 0) return;
    let r2 = n2.path.length;
    for (let e3 = 0; e3 < r2; e3++) {
      let i2 = e3 / r2, a2 = n2.path[e3];
      t2.globalAlpha = 0.95 - 0.6 * i2, t2.fillStyle = `#ffffff`, t2.beginPath(), t2.arc(a2.x, a2.y, 0.075 - 0.03 * i2, 0, TAU), t2.fill(), t2.strokeStyle = `rgba(29,38,56,0.7)`, t2.lineWidth = 0.015, t2.stroke();
    }
    t2.globalAlpha = 1, n2.landing && (t2.strokeStyle = `#ffe066`, t2.lineWidth = 0.05, t2.beginPath(), t2.arc(n2.landing.x, n2.landing.y, 0.32, 0, TAU), t2.stroke());
  }
  drawHealthBars(e2) {
    let t2 = this.ctx, n2 = [e2.player, ...e2.enemies, ...(e2.flyers || [])];
    for (let r2 of n2) {
      if (!r2.alive) continue;
      let n3 = r2.headPosition(), i2 = e2.camera.toScreen({ x: n3.x, y: n3.y + 0.5 }), a2 = Math.max(0, r2.hp / r2.maxHp);
      t2.fillStyle = `rgba(20,28,44,0.75)`, Gs(t2, i2.x - 32 - 2, i2.y - 4 - 2, 68, 12, 5), t2.fill(), t2.fillStyle = r2.team === `player` ? `#6dff8a` : `#ff6b6b`, Gs(t2, i2.x - 32, i2.y - 4, Math.max(0.5, 64 * a2), 8, 4), t2.fill();
    }
  }
  drawFloatingText(e2) {
    let t2 = this.ctx;
    t2.textAlign = `center`, t2.textBaseline = `middle`;
    for (let n2 of e2.effects.texts) {
      if (!n2.alive) continue;
      let r2 = e2.camera.toScreen({ x: n2.x, y: n2.y }), i2 = Math.max(0, n2.life / n2.maxLife), a2 = n2.maxLife - n2.life, o2 = n2.size > 24 ? 1 + 0.35 * Math.sin(Math.min(1, a2 / 0.15) * Math.PI) * Math.max(0, 1 - a2 / 0.3) : 1, s2 = Math.round(n2.size * o2);
      t2.globalAlpha = Math.min(1, i2 * 1.6), t2.font = `800 ${s2}px "Baloo 2", system-ui, sans-serif`, t2.lineWidth = Math.max(4, s2 * 0.22), t2.strokeStyle = `rgba(20,28,44,0.85)`, t2.strokeText(n2.text, r2.x, r2.y), t2.fillStyle = n2.color, t2.fillText(n2.text, r2.x, r2.y);
    }
    t2.globalAlpha = 1, t2.textAlign = `start`, t2.textBaseline = `alphabetic`;
  }
  drawVignette(e2) {
    const va = Math.min(0.7, e2.vignetteAlpha ?? this.vignetteAlpha ?? 0);
    if (!(va > 0)) return;
    let t2 = this.ctx;
    const w = this.viewW, h = this.viewH;
    const grad = t2.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
    grad.addColorStop(0, `rgba(255,0,0,0)`), grad.addColorStop(0.5, `rgba(255,0,0,0)`), grad.addColorStop(1, `rgba(255,50,50,${va.toFixed(3)})`);
    t2.globalAlpha = 1, t2.fillStyle = grad, t2.fillRect(0, 0, w, h);
  }
  drawHitMarkers(e2) {
    if (!e2.hitMarkers.length || !e2.player) return;
    let t2 = this.ctx;
    const sp = e2.camera.toScreen(e2.player.torsoPosition());
    for (const m of e2.hitMarkers) {
      const lifeFrac = m.life / m.maxLife;
      if (!(lifeFrac > 0)) continue;
      const ang = -m.angle, r = 64 + (1 - lifeFrac) * 16;
      t2.save();
      t2.translate(sp.x, sp.y);
      t2.globalAlpha = Math.min(1, lifeFrac * 1.5);
      t2.lineCap = `round`;
      t2.strokeStyle = `rgba(30,0,6,0.6)`, t2.lineWidth = 15, t2.beginPath(), t2.arc(0, 0, r, ang - 0.55, ang + 0.55), t2.stroke();
      t2.strokeStyle = `#ff3344`, t2.lineWidth = 9, t2.stroke();
      t2.restore();
    }
    t2.globalAlpha = 1;
  }
  // Owner: "I picked up a weapon in the building and there was no visual indicator". Big screen banner for building pickups (weapon / coins / health).
  drawPickupBanner(e2) {
    const b2 = e2.pickupBanner;
    if (!b2) return;
    const t2 = this.ctx, age = b2.age, life = b2.life, col = b2.color || `#ffd23f`;
    const ease = 1 - Math.pow(1 - Math.min(1, age / 0.28), 3), fade = Math.min(1, (life - age) / 0.5);
    if (!(fade > 0)) return;
    // narrow screens (phone / small window): keep clear of the left HUD column and the top-right level bar
    const narrow = this.viewW < 720, w = narrow ? Math.max(260, this.viewW - 188) : Math.min(this.viewW - 32, 460), h = 96, x = narrow ? this.viewW - w - 12 : (this.viewW - w) / 2, y = (narrow ? this.viewH * 0.34 : Math.max(76, this.viewH * 0.13)) - (1 - ease) * 80, cx = x + w / 2, cy = y + h / 2;
    t2.save(), t2.globalAlpha = fade;
    // soft rays behind the banner
    t2.globalAlpha = fade * 0.22, t2.strokeStyle = col, t2.lineWidth = 6;
    for (let i = 0; i < 10; i++) {
      const a = age * 0.6 + i * Math.PI / 5, r0 = h * 0.7, r1 = w * 0.62;
      t2.beginPath(), t2.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.6), t2.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.6), t2.stroke();
    }
    t2.globalAlpha = fade;
    // panel
    const r = 16;
    t2.beginPath(), t2.moveTo(x + r, y), t2.lineTo(x + w - r, y), t2.quadraticCurveTo(x + w, y, x + w, y + r), t2.lineTo(x + w, y + h - r), t2.quadraticCurveTo(x + w, y + h, x + w - r, y + h), t2.lineTo(x + r, y + h), t2.quadraticCurveTo(x, y + h, x, y + h - r), t2.lineTo(x, y + r), t2.quadraticCurveTo(x, y, x + r, y), t2.closePath();
    t2.fillStyle = `rgba(20,28,44,0.9)`, t2.fill(), t2.lineWidth = 4, t2.strokeStyle = col, t2.stroke();
    // star badge
    const sx = x + 46, sy = cy, sr = 26 * (1 + 0.08 * Math.sin(age * 9));
    t2.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? sr : sr * 0.45, a = -Math.PI / 2 + i * Math.PI / 5 + age * 0.8;
      i === 0 ? t2.moveTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr) : t2.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
    }
    t2.closePath(), t2.fillStyle = col, t2.fill(), t2.lineWidth = 3, t2.strokeStyle = `rgba(20,28,44,0.9)`, t2.stroke();
    // text
    t2.textAlign = `left`, t2.textBaseline = `middle`;
    const tx = x + 92, pulse = 1 + 0.05 * Math.sin(age * 10);
    t2.font = `800 17px "Baloo 2", system-ui, sans-serif`, t2.fillStyle = col, t2.fillText(b2.caption || ``, tx, y + 24);
    const avail = w - 92 - 14;
    let ns = Math.round(34 * pulse);
    t2.font = `800 ${ns}px "Baloo 2", system-ui, sans-serif`;
    for (let i = 0; i < 12 && ns > 16 && t2.measureText(b2.title || ``).width > avail; i++) ns -= 2, t2.font = `800 ${ns}px "Baloo 2", system-ui, sans-serif`;
    t2.lineWidth = 6, t2.lineJoin = `round`, t2.strokeStyle = `rgba(20,28,44,0.95)`, t2.strokeText(b2.title || ``, tx, y + 54), t2.fillStyle = `#ffffff`, t2.fillText(b2.title || ``, tx, y + 54);
    let ss = 13;
    t2.font = `600 ${ss}px "Baloo 2", system-ui, sans-serif`;
    for (let i = 0; i < 6 && ss > 9 && t2.measureText(b2.sub || ``).width > avail; i++) ss -= 1, t2.font = `600 ${ss}px "Baloo 2", system-ui, sans-serif`;
    t2.fillStyle = `rgba(220,228,240,0.9)`, t2.fillText(b2.sub || ``, tx, y + 80);
    t2.restore();
    t2.globalAlpha = 1, t2.textAlign = `start`, t2.textBaseline = `alphabetic`;
  }
  drawBossCallout(e2) {
    if (!e2.bossCalloutTimer || !e2.bossCalloutText) return;
    if (e2.boss && e2.boss.alive) {
      // the boss already shows its own call-out next to it: the screen-top one is only for a boss that is off screen
      const bs = e2.camera.toScreen({ x: e2.boss.x, y: e2.boss.y });
      if (bs.x > 40 && bs.x < this.viewW - 40 && bs.y > 40 && bs.y < this.viewH - 40) return;
    }
    let t2 = this.ctx;
    const lifeFrac = e2.bossCalloutTimer > 0 ? 1 : 0;
    const pulse = 1 + 0.15 * Math.sin(e2.time * 8);
    const size = Math.round(36 * pulse);
    t2.save();
    t2.textAlign = `center`, t2.textBaseline = `middle`;
    t2.globalAlpha = 0.95;
    t2.font = `800 ${size}px "Baloo 2", system-ui, sans-serif`;
    t2.lineWidth = Math.max(5, size * 0.25);
    t2.strokeStyle = `rgba(20,28,44,0.9)`;
    t2.strokeText(e2.bossCalloutText, this.viewW / 2, Math.max(104, this.viewH * 0.17));
    t2.fillStyle = e2.bossCalloutColor;
    t2.fillText(e2.bossCalloutText, this.viewW / 2, Math.max(104, this.viewH * 0.17));
    t2.restore();
    t2.globalAlpha = 1, t2.textAlign = `start`, t2.textBaseline = `alphabetic`;
  }
  drawPlayerExclamation(e2) {
    if (e2.playerExclamationTimer <= 0 || !e2.player.alive) return;
    let t2 = this.ctx;
    const screenPos = e2.camera.toScreen({ x: e2.player.torsoPosition().x, y: e2.player.torsoPosition().y - 1.2 });
    const blink = Math.sin(e2.time * 12) > 0;
    if (!blink) return;
    t2.save();
    t2.textAlign = `center`, t2.textBaseline = `middle`;
    t2.font = `800 28px "Baloo 2", system-ui, sans-serif`;
    t2.lineWidth = 6;
    t2.strokeStyle = `rgba(20,28,44,0.9)`;
    t2.strokeText(`!`, screenPos.x, screenPos.y);
    t2.fillStyle = `#ff3344`;
    t2.fillText(`!`, screenPos.x, screenPos.y);
    t2.restore();
    t2.globalAlpha = 1, t2.textAlign = `start`, t2.textBaseline = `alphabetic`;
  }
  drawZoomText(e2) {
    if (e2.camera.zoomDisplayTimer <= 0) return;
    let t2 = this.ctx;
    const pct = Math.round(e2.camera.zoom * 100);
    t2.save();
    t2.textAlign = `center`, t2.textBaseline = `middle`;
    const size = 22;
    t2.font = `800 ${size}px "Baloo 2", system-ui, sans-serif`;
    t2.lineWidth = 5;
    t2.strokeStyle = `rgba(20,28,44,0.9)`;
    t2.strokeText(`Zoom ${pct}%`, this.viewW / 2, 48);
    t2.fillStyle = `#ffd23f`;
    t2.fillText(`Zoom ${pct}%`, this.viewW / 2, 48);
    t2.restore();
    t2.globalAlpha = 1, t2.textAlign = `start`, t2.textBaseline = `alphabetic`;
  }
  drawBossIndicator(e2) {
    if (!e2.boss || !e2.boss.alive) return;
    const bossScreen = e2.camera.toScreen({ x: e2.boss.x, y: e2.boss.y });
    const w = this.viewW, h = this.viewH;
    const margin = 40;
    // Check if boss is on screen
    if (bossScreen.x >= margin && bossScreen.x <= w - margin && bossScreen.y >= margin && bossScreen.y <= h - margin) return;
    // Boss is off-screen, draw indicator at screen edge
    let x, y, side;
    if (bossScreen.x < margin) { x = margin; side = 'left'; }
    else if (bossScreen.x > w - margin) { x = w - margin; side = 'right'; }
    else { x = bossScreen.x; }
    if (bossScreen.y < margin) { y = margin; }
    else if (bossScreen.y > h - margin) { y = h - margin; }
    else { y = bossScreen.y; }
    const dx = e2.boss.x - e2.player.torsoPosition().x;
    const dy = e2.boss.y - e2.player.torsoPosition().y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const pulse = 0.7 + 0.3 * Math.sin(e2.time * 5);
    let t2 = this.ctx;
    t2.save();
    t2.translate(x, y);
    t2.rotate(angle);
    t2.globalAlpha = pulse;
    // Arrow shape
    t2.fillStyle = e2.boss.palette.glow;
    t2.beginPath();
    t2.moveTo(20, 0);
    t2.lineTo(0, -12);
    t2.lineTo(0, 12);
    t2.closePath();
    t2.fill();
    // Distance text
    t2.globalAlpha = pulse;
    t2.textAlign = `center`, t2.textBaseline = `middle`;
    t2.font = `600 14px "Baloo 2", system-ui, sans-serif`;
    t2.fillStyle = e2.boss.palette.glow;
    t2.fillText(`${Math.round(dist)} m`, 0, 28);
    t2.restore();
    t2.globalAlpha = 1, t2.textAlign = `start`, t2.textBaseline = `alphabetic`;
  }
  drawDragOverlay(e2) {
    let t2 = this.ctx, n2 = e2.aim;
    if (!n2.anchor || !n2.pointer) return;
    t2.lineWidth = 3, t2.setLineDash([8, 8]), t2.strokeStyle = `rgba(255,255,255,0.9)`, t2.beginPath(), t2.moveTo(n2.anchor.x, n2.anchor.y), t2.lineTo(n2.pointer.x, n2.pointer.y), t2.stroke(), t2.setLineDash([]), t2.fillStyle = `rgba(255,255,255,0.35)`, t2.beginPath(), t2.arc(n2.anchor.x, n2.anchor.y, 22, 0, TAU), t2.fill(), t2.strokeStyle = `rgba(255,255,255,0.9)`, t2.stroke();
    let r2 = this.handScreen(e2);
    if (r2 && n2.active) {
      let e3 = r2.x - 45, i2 = r2.y + 24;
      t2.fillStyle = `rgba(20,28,44,0.7)`, Gs(t2, e3 - 3, i2 - 3, 96, 16, 7), t2.fill();
      let a2 = t2.createLinearGradient(e3, 0, e3 + 90, 0);
      a2.addColorStop(0, `#8dff5a`), a2.addColorStop(0.6, `#ffe066`), a2.addColorStop(1, `#ff6b6b`), t2.fillStyle = a2, Gs(t2, e3, i2, Math.max(2, 90 * n2.power), 10, 5), t2.fill();
    }
  }
  handScreen(e2) {
    let t2 = e2.player.parts.get(`lowerArmR`);
    if (!t2) return null;
    let n2 = Us(this.poseOf(t2, e2.alpha), 0, -0.14);
    return e2.camera.toScreen(n2);
  }
};
function Bs(e2) {
  let t2 = [`#ff8a7a`, `#b99bff`, `#ffd166`, `#7ad9ff`];
  return t2[e2.id % t2.length];
}
function Vs(e2) {
  let t2 = Math.min(1, Math.max(0, e2));
  return 1 + 2.70158 * (t2 - 1) ** 3 + 1.70158 * (t2 - 1) ** 2;
}
function Hs(e2, t2) {
  let n2 = parseInt(e2.slice(1), 16);
  return `rgba(${n2 >> 16 & 255}, ${n2 >> 8 & 255}, ${n2 & 255}, ${Math.max(0, Math.min(1, t2)).toFixed(3)})`;
}
function Us(e2, t2, n2) {
  let r2 = Math.cos(e2.a), i2 = Math.sin(e2.a);
  return { x: e2.x + r2 * t2 - i2 * n2, y: e2.y + i2 * t2 + r2 * n2 };
}
function Ws(e2, t2, n2) {
  return e2 + wrapAngle(t2 - e2) * n2;
}
function Gs(e2, t2, n2, r2, i2, a2) {
  e2.beginPath(), e2.roundRect(t2, n2, r2, i2, a2);
}
var Ks = `#1d2638`, qs = { brick: `
    <rect x="6" y="20" width="52" height="26" rx="4" fill="#e07a52" stroke="${Ks}" stroke-width="2.5"/>
    <path d="M6 33 H58 M24 20 V33 M42 33 V46" stroke="#a34a2a" stroke-width="2.4"/>
    <rect x="10" y="23" width="12" height="3" rx="1.5" fill="#ffb08f"/>
    <rect x="28" y="23" width="12" height="3" rx="1.5" fill="#ffb08f"/>`, metal: `
    <rect x="25" y="6" width="14" height="52" rx="2" fill="#a9b8c8" stroke="${Ks}" stroke-width="2.5"/>
    <path d="M27 12 L37 8" stroke="#eef4fb" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="32" cy="14" r="2" fill="${Ks}"/><circle cx="32" cy="50" r="2" fill="${Ks}"/>
    <path d="M28 30 L36 26 M28 40 L36 36" stroke="#d6e1ec" stroke-width="2" stroke-linecap="round"/>`, spikes: `
    <rect x="6" y="40" width="52" height="12" rx="3" fill="#5a6b8a" stroke="${Ks}" stroke-width="2.5"/>
    <path d="M8 40 L14 18 L20 40 M20 40 L26 14 L32 40 M32 40 L38 18 L44 40 M44 40 L50 14 L56 40" fill="#dfe6ef" stroke="${Ks}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M14 22 L15 30 M26 18 L27 28 M50 18 L51 28" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>`, jelly: `
    <path d="M8 46 Q8 24 32 22 Q56 24 56 46 Z" fill="#ff7ad9" stroke="${Ks}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="22" cy="32" rx="7" ry="4" fill="#ffd1f0" opacity=".9"/>
    <circle cx="40" cy="36" r="3" fill="#ffd1f0" opacity=".7"/><circle cx="46" cy="30" r="2" fill="#ffd1f0" opacity=".7"/>
    <path d="M14 14 Q32 4 50 14" fill="none" stroke="#ff7ad9" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="3 4"/>`, telescope: `
    <path d="M30 34 L18 58 M34 34 L46 58 M32 34 L32 58" stroke="${Ks}" stroke-width="3" stroke-linecap="round"/>
    <g transform="rotate(-28 32 28)">
      <rect x="12" y="22" width="40" height="12" rx="4" fill="#7a6cff" stroke="${Ks}" stroke-width="2.5"/>
      <rect x="46" y="20" width="10" height="16" rx="3" fill="#b7aeff" stroke="${Ks}" stroke-width="2.5"/>
      <rect x="18" y="24" width="14" height="3" rx="1.5" fill="#c9c2ff"/>
    </g>
    <circle cx="53" cy="10" r="3" fill="#ffffff"/>`, duck: `
    <ellipse cx="30" cy="42" rx="22" ry="14" fill="#ffd23f" stroke="${Ks}" stroke-width="2.5"/>
    <circle cx="40" cy="22" r="11" fill="#ffd23f" stroke="${Ks}" stroke-width="2.5"/>
    <path d="M49 22 Q58 22 56 27 Q52 29 48 26" fill="#ff8a3d" stroke="${Ks}" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="42" cy="19" r="2.4" fill="${Ks}"/><circle cx="43" cy="18" r=".8" fill="#ffffff"/>
    <path d="M14 38 Q24 32 34 40" fill="none" stroke="#e0a800" stroke-width="2.4" stroke-linecap="round"/>`, cannon: `
    <g transform="rotate(-30 30 34)">
      <rect x="22" y="26" width="34" height="14" rx="6" fill="#5a6b8a" stroke="${Ks}" stroke-width="2.5"/>
      <rect x="50" y="24" width="7" height="18" rx="3" fill="#3d4a63" stroke="${Ks}" stroke-width="2.5"/>
    </g>
    <circle cx="26" cy="44" r="12" fill="#8a5a2b" stroke="${Ks}" stroke-width="2.5"/>
    <circle cx="26" cy="44" r="4" fill="#5a3a1a"/>
    <circle cx="54" cy="12" r="5" fill="#ffd23f" stroke="${Ks}" stroke-width="2"/>` };
function Js(e2) {
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${qs[e2]}</svg>`;
}
var Q = `#1d2638`;
function Ys(e2, t2, n2) {
  return `<radialGradient id="${e2}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${t2}"/><stop offset="1" stop-color="${n2}"/></radialGradient>`;
}
function Xs(e2, t2, n2) {
  return `<linearGradient id="${e2}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${t2}"/><stop offset="1" stop-color="${n2}"/></linearGradient>`;
}
function Zs(e2, t2, n2, r2, i2, a2) {
  let o2 = t2 - r2 * 0.38, s2 = n2 - r2 * 0.42;
  return `${Ys(e2, i2, a2)}<circle cx="${t2}" cy="${n2}" r="${r2}" fill="url(#${e2})" stroke="${Q}" stroke-width="2.5"/><ellipse cx="${o2}" cy="${s2}" rx="${r2 * 0.3}" ry="${r2 * 0.17}" fill="#fff" opacity=".75" transform="rotate(-30 ${o2} ${s2})"/>`;
}
function Qs(e2, t2, n2) {
  return `<ellipse cx="${e2}" cy="${t2}" rx="${n2}" ry="3.5" fill="#000" opacity=".22"/>`;
}
var $s = { hands: (e2) => `
    <path d="M14 58 C12 48 13 40 18 35 L24 30 C26 28 29 29 29 32 L28 37" fill="#ffffff" stroke="${Q}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M18 35 C17 30 19 24 23 22 C27 20 30 22 30 26" fill="none" stroke="${Q}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M14 58 L30 58 C33 52 34 46 33 40" fill="#ffffff" stroke="${Q}" stroke-width="2.5" stroke-linejoin="round"/>
    ${Zs(`${e2}-o`, 38, 22, 12, `#eaffd6`, `#4fbf2a`)}
    <path d="M30 31 Q33 36 31 41" stroke="#4fbf2a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M50 10 L54 6 M53 16 L58 15 M46 7 L46 2" stroke="#8dff5a" stroke-width="2.4" stroke-linecap="round"/>`, spray: (e2) => `
    ${Ys(`${e2}-n`, `#d6fff3`, `#2fa98a`)}
    <rect x="7" y="23" width="23" height="18" rx="7" fill="url(#${e2}-n)" stroke="${Q}" stroke-width="2.5"/>
    <rect x="28" y="28" width="10" height="8" rx="2" fill="#1f7a66" stroke="${Q}" stroke-width="2"/>
    <path d="M41 22 L39 28 M42 41 L40 36" stroke="#5ef2c2" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
    ${Zs(`${e2}-a`, 47, 17, 5.5, `#e6fff8`, `#3ed6a8`)}
    ${Zs(`${e2}-b`, 52, 32, 6, `#e6fff8`, `#3ed6a8`)}
    ${Zs(`${e2}-c`, 47, 47, 5.5, `#e6fff8`, `#3ed6a8`)}`, squirt: (e2) => `
    ${Ys(`${e2}-b`, `#f2ffe0`, `#6bbf3a`)}
    <rect x="28" y="12" width="8" height="10" rx="2" fill="#4a7d2a" stroke="${Q}" stroke-width="2"/>
    <path d="M23 27 Q22 22 28 22 L36 22 Q42 22 41 27 L42 50 Q42 57 35 57 L29 57 Q22 57 22 50 Z" fill="url(#${e2}-b)" stroke="${Q}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M26 38 Q32 42 38 38" fill="none" stroke="${Q}" stroke-width="1.5" opacity=".45"/>
    <circle cx="50" cy="21" r="3.2" fill="#b6ff8a" stroke="${Q}" stroke-width="1.5"/>
    <circle cx="54" cy="33" r="3.6" fill="#b6ff8a" stroke="${Q}" stroke-width="1.5"/>
    <circle cx="49" cy="46" r="2.8" fill="#b6ff8a" stroke="${Q}" stroke-width="1.5"/>`, heavy: (e2) => `
    ${Qs(32, 56, 18)}
    ${Zs(`${e2}-o`, 32, 31, 20, `#c9ffd9`, `#17803f`)}
    <path d="M13 37 Q32 47 51 37" fill="none" stroke="#0f4f2a" stroke-width="3" opacity=".5"/>`, balloon: (e2) => `
    <path d="M32 47 Q27 52 33 57 Q38 61 32 63" fill="none" stroke="${Q}" stroke-width="1.5"/>
    ${Ys(`${e2}-b`, `#fff3fb`, `#ff7fcc`)}
    <ellipse cx="32" cy="27" rx="14" ry="17" fill="url(#${e2}-b)" stroke="${Q}" stroke-width="2.5"/>
    <ellipse cx="25" cy="18" rx="3.5" ry="6" fill="#fff" opacity=".7" transform="rotate(20 25 18)"/>
    <path d="M29 44 L35 44 L32 48 Z" fill="#ff7fcc" stroke="${Q}" stroke-width="1.5" stroke-linejoin="round"/>`, clinger: (e2) => `
    <path d="M22 28 Q12 24 9 14 M42 28 Q52 24 55 14 M26 40 Q14 44 10 54 M38 40 Q50 44 54 54 M32 45 Q32 54 26 60" fill="none" stroke="#ff7ad9" stroke-width="2" stroke-linecap="round"/>
    ${[[9, 14], [55, 14], [10, 54], [54, 54], [26, 60]].map(([e3, t2]) => `<circle cx="${e3}" cy="${t2}" r="2.8" fill="#ffb3ec" stroke="${Q}" stroke-width="1.4"/>`).join(``)}
    ${Zs(`${e2}-o`, 32, 32, 13, `#ffe0f7`, `#b8309a`)}`, sniper: (e2) => `
    <circle cx="32" cy="32" r="22" fill="#2a3450" stroke="${Q}" stroke-width="2.5"/>
    <circle cx="32" cy="32" r="16" fill="#0f1626" stroke="#c8ff3d" stroke-width="1.5" opacity=".9"/>
    <path d="M32 12 V52 M12 32 H52" stroke="#c8ff3d" stroke-width="1.5" opacity=".85"/>
    ${Zs(`${e2}-o`, 32, 32, 5, `#f4ffd0`, `#8fc41a`)}`, glue: (e2) => `
    ${Xs(`${e2}-g`, `#ffe3a0`, `#d18b1e`)}
    <ellipse cx="32" cy="58" rx="20" ry="3.5" fill="#ffc65c" opacity=".7"/>
    <path d="M12 42 L38 22 L46 30 L20 50 Z" fill="url(#${e2}-g)" stroke="${Q}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M38 22 L44 15 L50 21 L46 30 Z" fill="#8a5a18" stroke="${Q}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M24 52 Q21 58 24 60 Q27 58 24 52 Z" fill="#ffc65c" stroke="${Q}" stroke-width="1.2"/>
    <path d="M42 52 Q39 58 42 60 Q45 58 42 52 Z" fill="#ffc65c" stroke="${Q}" stroke-width="1.2"/>`, bouncer: (e2) => `
    <path d="M7 54 Q15 22 24 46" fill="none" stroke="#f5ff6b" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round"/>
    <path d="M40 46 Q49 22 57 54" fill="none" stroke="#f5ff6b" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round"/>
    ${Qs(32, 56, 12)}
    ${Zs(`${e2}-o`, 32, 40, 11.5, `#fffde0`, `#c9cf2e`)}`, splitter: (e2) => `
    ${Zs(`${e2}-o`, 32, 32, 15, `#e6fdff`, `#2aa9d0`)}
    <path d="M32 19 L28 30 L36 36 L30 46" fill="none" stroke="${Q}" stroke-width="1.6" stroke-linejoin="round"/>
    ${Zs(`${e2}-a`, 11, 12, 4.5, `#e6fdff`, `#2aa9d0`)}
    ${Zs(`${e2}-b`, 53, 12, 4.5, `#e6fdff`, `#2aa9d0`)}
    ${Zs(`${e2}-c`, 11, 52, 4.5, `#e6fdff`, `#2aa9d0`)}
    ${Zs(`${e2}-d`, 53, 52, 4.5, `#e6fdff`, `#2aa9d0`)}`, seeker: (e2) => `
    <circle cx="32" cy="34" r="22" fill="none" stroke="#ff9f5a" stroke-width="2" stroke-dasharray="4 4"/>
    ${Zs(`${e2}-o`, 32, 34, 11, `#ffe6cf`, `#e8743a`)}
    <path d="M32 4 L38 13 L26 13 Z" fill="#ff9f5a" stroke="${Q}" stroke-width="1.5" stroke-linejoin="round"/>`, boomerang: (e2) => `
    ${Xs(`${e2}-b`, `#c9fff3`, `#2aa98a`)}
    <path d="M10 46 Q12 12 46 14 Q54 15 56 24 Q40 18 36 32 Q32 46 10 46 Z" fill="url(#${e2}-b)" stroke="${Q}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M18 38 Q20 24 34 20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>`, grenade: (e2) => `
    ${Ys(`${e2}-b`, `#7a88a8`, `#1d2638`)}
    <path d="M32 17 Q38 9 46 11" fill="none" stroke="#c8a16a" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="30" cy="37" r="17" fill="url(#${e2}-b)" stroke="${Q}" stroke-width="2.5"/>
    <rect x="25" y="17" width="10" height="7" rx="2" fill="#2a3450" stroke="${Q}" stroke-width="2"/>
    <ellipse cx="23" cy="30" rx="4" ry="6" fill="#fff" opacity=".22" transform="rotate(25 23 30)"/>
    <path d="M50 3 L52 8 L57 9 L52 10 L50 15 L48 10 L43 9 L48 8 Z" fill="#ffe27a" stroke="${Q}" stroke-width="1"/>`, cluster: (e2) => `
    ${Ys(`${e2}-b`, `#7a88a8`, `#1d2638`)}
    <path d="M32 36 L12 20 M32 36 L52 18 M32 36 L54 44 M32 36 L22 50" stroke="#ffb0a0" stroke-width="1.5" opacity=".6"/>
    <circle cx="32" cy="36" r="12" fill="url(#${e2}-b)" stroke="${Q}" stroke-width="2.5"/>
    <rect x="28" y="22" width="8" height="6" rx="2" fill="#2a3450" stroke="${Q}" stroke-width="1.5"/>
    ${Zs(`${e2}-a`, 12, 20, 5.5, `#ffd0c0`, `#ff7a7a`)}
    ${Zs(`${e2}-b2`, 52, 18, 5.5, `#ffd0c0`, `#ff7a7a`)}
    ${Zs(`${e2}-c`, 54, 45, 5.5, `#ffd0c0`, `#ff7a7a`)}
    ${Zs(`${e2}-d`, 22, 51, 5.5, `#ffd0c0`, `#ff7a7a`)}`, well: (e2) => `
    <circle cx="32" cy="32" r="12" fill="#b47aff" opacity=".22"/>
    <path d="M32 10 A22 22 0 1 1 10 32" fill="none" stroke="#b47aff" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M32 18 A14 14 0 1 0 46 32" fill="none" stroke="#d7c2ff" stroke-width="3" stroke-linecap="round"/>
    <path d="M32 26 A6 6 0 1 1 38 32" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".9"/>
    ${Zs(`${e2}-o`, 32, 32, 4.5, `#ffffff`, `#b47aff`)}`, bomb: (e2) => `
    ${Ys(`${e2}-b`, `#ffe4bf`, `#e0743a`)}
    <ellipse cx="32" cy="56" rx="22" ry="5" fill="#ffb36b" stroke="${Q}" stroke-width="1.5"/>
    <path d="M32 8 C40 20 46 28 46 38 A14 14 0 0 1 18 38 C18 28 24 20 32 8 Z" fill="url(#${e2}-b)" stroke="${Q}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="26" cy="36" rx="3.5" ry="6" fill="#fff" opacity=".6" transform="rotate(20 26 36)"/>`, cannon: (e2) => `
    ${Ys(`${e2}-b`, `#e9ddff`, `#7b5ab8`)}
    <g transform="rotate(-22 30 36)">
      <rect x="10" y="30" width="40" height="13" rx="5" fill="url(#${e2}-b)" stroke="${Q}" stroke-width="2.5"/>
      <rect x="44" y="27" width="8" height="19" rx="2" fill="#2e2440" stroke="${Q}" stroke-width="2"/>
    </g>
    <circle cx="24" cy="52" r="7" fill="#2e2440" stroke="${Q}" stroke-width="2.5"/>
    <circle cx="24" cy="52" r="2.5" fill="#c49bff"/>
    ${Zs(`${e2}-o`, 54, 13, 5, `#f3eaff`, `#c49bff`)}` };
function ec(e2, t2 = e2) {
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${$s[e2](t2)}</svg>`;
}
function $(e2) {
  let t2 = document.getElementById(e2);
  if (!t2) throw Error(`Missing element #${e2}`);
  return t2;
}
var tc = { weapons: `Weapons`, upgrades: `Upgrades`, fortress: `Fortress`, kit: `Field kit` }, UI = class {
  constructor(e2) {
    this.handlers = e2, this.hud = $(`hud`), this.hpFill = $(`player-hp-fill`), this.hpText = $(`player-hp-text`), this.waveText = $(`wave-text`), this.scoreText = $(`score-text`), this.waveFill = $(`wave-fill`), this.staminaFill = $(`stamina-fill`), this.staminaTrack = $(`stamina-track`), this.xpTrack = $(`xp-track`), this.xpFill = $(`xp-fill`), this.xpText = $(`xp-text`), this.levelupPanel = $(`levelup-panel`), this.levelupLevel = $(`levelup-level`), this.levelupCards = $(`levelup-cards`), this.coinsText = $(`coins-text`), this.weaponBtn = $(`weapon-btn`), this.jumpBtn = $(`jump-btn`), this.jumpLabel = $(`jump-label`), this.combo = $(`combo-chip`), this.comboText = $(`combo-text`), this.comboFill = $(`combo-fill`), this.menuPanel = $(`menu-panel`), this.menuCoins = $(`menu-coins`), this.menuWeapon = $(`menu-weapon`), this.menuHome = $(`menu-home`), this.menuBestEndless = $(`best-endless`), this.menuBestPlatform = $(`best-platform`), this.pauseMode = $(`pause-mode`), this.gameoverRecord = $(`gameover-record`), this.pausePanel = $(`pause-panel`), this.pauseBuildBtn = $(`pause-build`), this.catalogPanel = $(`catalog-panel`), this.catalogTitle = $(`catalog-title`), this.catalogCoins = $(`catalog-coins`), this.catalogSub = $(`catalog-sub`), this.catalogTabs = $(`catalog-tabs`), this.catalogBody = $(`catalog-body`), this.catalogClose = $(`catalog-close`), this.buildPanel = $(`build-panel`), this.buildCoins = $(`build-coins`), this.buildTray = $(`build-tray`), this.buildRotate = $(`build-rotate`), this.buildHint = $(`build-hint`), this.gameoverPanel = $(`gameover-panel`), this.gameoverSub = $(`gameover-sub`), this.hint = $(`hint`), this.buildBtn = $(`build-btn`), this.soundPanel = $(`sound-panel`), this.sndMusic = $(`snd-music`), this.sndSfx = $(`snd-sfx`), this.sndMute = $(`snd-mute`), this.sndCameraShake = $(`snd-camera-shake`), this.sndTest = $(`snd-test`), this.sndMusic.addEventListener(`input`, (e3) => this.handlers.onSoundVolume(`music`, e3.target.value)), this.sndSfx.addEventListener(`input`, (e3) => this.handlers.onSoundVolume(`sfx`, e3.target.value)), this.sndSfx.addEventListener(`change`, () => this.handlers.onSoundSfxCommit()), this.sndMute.addEventListener(`click`, () => this.handlers.onSoundMute()), this.sndCameraShake.addEventListener(`click`, () => this.handlers.onCameraShake()), this.lastHud = ``, this.lastCoins = null, $(`app`).addEventListener(`click`, (e3) => this.onClick(e3)), this.buildTray.addEventListener(`pointerdown`, (e3) => {
      let t2 = e3.target.closest(`[data-tray]`);
      t2 && (e3.preventDefault(), this.handlers.onTrayDrag(t2.dataset.tray, e3.clientX, e3.clientY));
    });
  }
  onClick(e2) {
    let t2 = e2.target.closest(`[data-act]`);
    if (!t2 || t2.disabled) return;
    let n2 = t2.dataset.id ?? ``, r2 = this.handlers, a2 = t2.dataset.act;
    a2 !== `jump` && snd(`uiClick`);
    (a2 === `close` || a2 === `back` || a2 === `resume` || a2 === `main-menu` || a2 === `sound-back`) && snd(`uiBack`);
    switch (a2) {
      case `play`:
        r2.onPlay();
        break;
      case `play-endless`:
        r2.onPlayEndless();
        break;
      case `menu-weapons`:
        r2.onMenuCatalog(`weapons`);
        break;
      case `menu-upgrades`:
        r2.onMenuCatalog(`upgrades`);
        break;
      case `reset-profile`:
        r2.onResetProfile();
        break;
      case `pause`:
        r2.onPause();
        break;
      case `resume`:
        r2.onResume();
        break;
      case `pause-weapons`:
        r2.onPauseCatalog(`weapons`);
        break;
      case `pause-upgrades`:
        r2.onPauseCatalog(`upgrades`);
        break;
      case `build`:
        r2.onEnterBuild();
        break;
      case `build-done`:
        r2.onExitBuild();
        break;
      case `build-rotate`:
        r2.onRotateBuild();
        break;
      case `build-shop`:
        r2.onBuildShop();
        break;
      case `f-unlock`:
        r2.onUnlockItem(n2);
        break;
      case `f-buy`:
        r2.onBuyItem(n2);
        break;
      case `restart`:
        r2.onRestartRun();
        break;
      case `main-menu`:
        r2.onMainMenu();
        break;
      case `sound`:
        r2.onSound();
        break;
      case `sound-mute`:
        r2.onSoundMute();
        break;
      case `camera-shake`:
        r2.onCameraShake();
        break;
      case `sound-test`:
        r2.onSoundTest(n2);
        break;
      case `sound-back`:
        r2.onSoundBack();
        break;
      case `tab`:
        r2.onCatalogTab(n2);
        break;
      case `close`:
        r2.onCatalogClose();
        break;
      case `cycle`:
        r2.onCycleWeapon();
        break;
      case `buy`:
        r2.onBuyWeapon(n2);
        break;
      case `equip`:
        r2.onEquipWeapon(n2);
        break;
      case `upgrade`:
        r2.onBuyUpgrade(n2);
        break;
      case `repair`:
        r2.onBuyRepair();
        break;
      case `jump`:
        r2.onJump();
        break;
      case `levelup-pick`:
        r2.onLevelUpPick(n2);
    }
  }
  showOverlay(e2) {
    this.menuPanel.classList.toggle(`hidden`, e2 !== `menu`), this.pausePanel.classList.toggle(`hidden`, e2 !== `pause`), this.levelupPanel.classList.toggle(`hidden`, e2 !== `levelup`), this.catalogPanel.classList.toggle(`hidden`, e2 !== `catalog`), this.gameoverPanel.classList.toggle(`hidden`, e2 !== `gameover`), this.buildPanel.classList.toggle(`hidden`, e2 !== `build`), this.soundPanel.classList.toggle(`hidden`, e2 !== `sound`), this.hud.classList.toggle(`hidden`, e2 === `menu` || e2 === `build`), e2 !== `hud` && this.hideHint();
  }
  showMenu(e2) {
    this.menuCoins.textContent = `${e2.coins} coins`, this.menuWeapon.innerHTML = `<span class="menu-ic">${ec(e2.weaponId, `m-${e2.weaponId}`)}</span><span>${e2.weaponName}</span>`;
    let t2 = e2.fortressPieces;
    this.menuHome.textContent = t2 > 0 ? `Fortress: ${t2} ${t2 === 1 ? `piece` : `pieces`}` : `Fortress: empty`, this.menuBestEndless.textContent = e2.bestEndless ?? ``, this.menuBestPlatform.textContent = e2.bestPlatform ?? ``;
  }
  setHud(e2) {
    let t2 = [e2.hp, e2.maxHp, e2.wave, e2.score, e2.coins, e2.weaponId, Math.round(e2.progress * 100), Math.round(e2.stamina), e2.staminaFlash, e2.combo, Math.round(e2.comboTime * 100), e2.canGetUp, e2.label, e2.hideBuild, e2.xp ? e2.xp.level : 0, e2.xp ? Math.round(e2.xp.fraction * 100) : -1].join(`|`);
    if (t2 === this.lastHud) return;
    let n2 = this.lastCoins !== null && e2.coins > this.lastCoins;
    this.lastWeaponId !== undefined && this.lastWeaponId !== e2.weaponId && this.bump(this.weaponBtn), this.lastWeaponId = e2.weaponId;
    this.lastCoins = e2.coins, this.lastHud = t2, this.staminaFill.style.transform = `scaleX(${Math.max(0, Math.min(1, e2.stamina / e2.maxStamina)).toFixed(4)})`, this.staminaTrack.classList.toggle(`is-empty`, e2.staminaFlash), this.combo.classList.toggle(`hidden`, e2.combo < 2), e2.combo >= 2 && (this.comboText.textContent = `COMBO \xD7${e2.combo}`, this.comboFill.style.transform = `scaleX(${Math.max(0, Math.min(1, e2.comboTime)).toFixed(3)})`), this.jumpBtn.classList.toggle(`is-getup`, e2.canGetUp), this.jumpLabel.textContent = e2.canGetUp ? `Get up` : `Jump`;
    let r2 = Math.max(0, Math.min(1, e2.hp / e2.maxHp));
    this.hpFill.style.transform = `scaleX(${r2.toFixed(4)})`, this.hpText.textContent = `${Math.ceil(e2.hp)} / ${e2.maxHp}`, this.waveText.textContent = e2.label !== undefined ? e2.label : `WAVE ${e2.wave}`, this.scoreText.textContent = `${e2.score}`, this.waveFill.style.transform = `scaleX(${Math.max(0, Math.min(1, e2.progress)).toFixed(4)})`, this.coinsText.textContent = `${e2.coins} coins`, n2 && this.bump(this.coinsText), this.weaponBtn.innerHTML = `<span class="wb-ic">${ec(e2.weaponId, `h-${e2.weaponId}`)}</span><span>${e2.weaponName}</span>`, this.buildBtn.classList.toggle(`hidden`, !!e2.hideBuild), this.xpTrack.classList.toggle(`hidden`, !e2.xp), this.xpText.classList.toggle(`hidden`, !e2.xp), e2.xp && (this.xpFill.style.transform = `scaleX(${Math.max(0, Math.min(1, e2.xp.fraction)).toFixed(4)})`, this.xpText.textContent = `LEVEL ${e2.xp.level}`);
  }
  showLevelUp(e2) {
    this.levelupLevel.textContent = `Level ${e2.level} reached \u2014 pick an upgrade`, this.levelupCards.innerHTML = e2.cards.map((t2, n2) => {
      let r2 = t2.id === `heal` || t2.id === `coins`, i2 = r2 ? `` : `<div class="pips">${Array.from({ length: 5 }, (a2, o2) => `<i class="${o2 < t2.level ? `on` : o2 === t2.level ? `next` : ``}"></i>`).join(``)}</div>`;
      return `<button class="levelup-card" type="button" data-act="levelup-pick" data-id="${t2.id}" style="--c:${t2.color}">
          <span class="levelup-glyph">${t2.glyph}</span>
          <span class="levelup-name">${t2.name}${t2.isNew ? `<span class="levelup-new">NEW</span>` : ``}</span>
          <span class="levelup-blurb">${t2.blurb}</span>
          ${i2}
          <span class="levelup-key">${n2 + 1}</span>
        </button>`;
    }).join(``);
  }
  bump(e2) {
    e2.classList.remove(`bump`), e2.offsetWidth, e2.classList.add(`bump`);
  }
  showCatalog(e2) {
    let t2 = e2.from === `shop`;
    this.catalogTitle.textContent = t2 ? `Wave ${e2.wave} cleared` : tc[e2.tab], this.catalogCoins.textContent = `${e2.coins} coins`, this.catalogSub.textContent = t2 && e2.bonus > 0 ? `+${e2.bonus}` : ``, this.catalogClose.textContent = t2 ? `Next wave` : e2.from === `build` ? `Back to building` : `Back`;
    let n2 = e2.showKit ? [`weapons`, `upgrades`, `fortress`, `kit`] : [`weapons`, `upgrades`, `fortress`];
    this.catalogTabs.innerHTML = n2.map((t3) => `<button class="tab${t3 === e2.tab ? ` is-active` : ``}" data-act="tab" data-id="${t3}">${tc[t3]}</button>`).join(``);
    let r2 = { weapons: () => this.weaponsHtml(e2), upgrades: () => this.upgradesHtml(e2), fortress: () => this.fortressHtml(e2.fortress), kit: () => this.kitHtml(e2) };
    this.catalogBody.innerHTML = r2[e2.tab](), this.catalogBody.scrollTop = 0, this.catalogPanel.classList.remove(`hidden`);
  }
  weaponsHtml(e2) {
    return `<div class="wgrid">${e2.weapons.map((e3) => {
      let t2;
      return t2 = e3.owned ? e3.equipped ? `<span class="wtick">Equipped</span>` : `<button class="wbuy wequip" data-act="equip" data-id="${e3.id}">Equip</button>` : `<button class="wbuy" data-act="buy" data-id="${e3.id}" ${e3.canBuy ? `` : `disabled`}>${e3.price}</button>`, `<div class="${`wcard${e3.equipped ? ` is-equipped` : ``}${e3.owned ? `` : ` is-locked`}`}" style="--c:${e3.color}" title="${e3.blurb}">
          <div class="wart">${ec(e3.id, `c-${e3.id}`)}</div>
          <div class="wname">${e3.name}</div>
          <div class="wbadge">${e3.badge}</div>
          <div class="wmeters" aria-hidden="true">
            <i style="--v:${e3.power.toFixed(2)}"></i><i style="--v:${e3.rate.toFixed(2)}"></i><i style="--v:${e3.speed.toFixed(2)}"></i>
          </div>
          <div class="wfoot">${t2}</div>
        </div>`;
    }).join(``)}</div>`;
  }
  upgradesHtml(e2) {
    return `<div class="card-grid">${e2.upgrades.map((e3) => {
      let t2 = e3.level >= e3.cap, n2 = Array.from({ length: e3.cap }, (t3, n3) => `<i class="${n3 < e3.level ? `on` : ``}"></i>`).join(``), r2 = t2 ? `<button class="btn small" disabled>MAX</button>` : `<button class="btn small" data-act="upgrade" data-id="${e3.id}" ${e3.canBuy ? `` : `disabled`}>Buy ${e3.cost}</button>`;
      return `<div class="card">
          <div class="card-title">${e3.name}</div>
          <div class="card-blurb">${e3.blurb}</div>
          <div class="pips">${n2}</div>
          ${r2}
        </div>`;
    }).join(``)}</div>`;
  }
  fortressHtml(e2) {
    return `<div class="fhead"><span>Buy pieces, then drag them onto your island.</span>${e2.canPlace ? `<button class="btn small build-go" data-act="build">Place pieces</button>` : ``}</div><div class="wgrid">${e2.items.map((e3) => {
      let t2 = e3.unlocked ? `<button class="wbuy" data-act="f-buy" data-id="${e3.id}" ${e3.canBuy ? `` : `disabled`}>${e3.price}</button>` : `<button class="wbuy funlock" data-act="f-unlock" data-id="${e3.id}" ${e3.canUnlock ? `` : `disabled`}>Unlock ${e3.unlock}</button>`, n2 = e3.unlocked ? `<span title="In your bag">Bag ${e3.owned}</span><span title="Standing in the fortress">Built ${e3.placed}/${e3.maxPlaced}</span>` : `<span>Locked</span>`;
      return `<div class="wcard fcard${e3.unlocked ? `` : ` is-locked`}" style="--c:${e3.color}" title="${e3.blurb}">
          <div class="wart">${Js(e3.id)}</div>
          <div class="wname">${e3.name}</div>
          <div class="fblurb">${e3.blurb}</div>
          <div class="fstats"><span>\u2665 ${e3.hp}</span>${n2}</div>
          <div class="wfoot">${t2}</div>
        </div>`;
    }).join(``)}</div>`;
  }
  kitHtml(e2) {
    let t2 = e2.repair;
    return `<div class="card-grid"><div class="card card-wide">
        <div class="card-title">Repair Kit</div>
        <div class="card-blurb">Restores ${t2.heal} health.</div>
        <button class="btn small" data-act="repair" ${t2.canBuy ? `` : `disabled`}>Buy ${t2.cost}</button>
      </div></div>`;
  }
  showBuild(e2) {
    this.buildCoins.textContent = `${e2.coins} coins`, this.buildRotate.classList.toggle(`is-on`, e2.rotated);
    let t2 = e2.items.map((t3) => {
      let n3 = t3.placed >= t3.maxPlaced, r3 = `tray-slot${t3.canPlace ? `` : ` is-empty`}${e2.dragging === t3.id ? ` is-held` : ``}`, i2 = n3 ? `Max` : `\xD7${t3.count}`;
      return `<button class="${r3}" data-tray="${t3.id}" style="--c:${t3.color}" type="button" title="${t3.name}">
          <span class="tray-art">${Js(t3.id)}</span>
          <span class="tray-name">${t3.name}</span>
          <span class="tray-count">${i2}</span>
        </button>`;
    }).join(``), n2 = `<button class="tray-slot tray-more" data-act="build-shop" type="button">
        <span class="tray-plus">+</span><span class="tray-name">${e2.lockedCount > 0 ? `${e2.lockedCount} to unlock` : `Buy more`}</span>
      </button>`;
    this.buildTray.innerHTML = t2 + n2;
    let r2 = e2.items.some((e3) => e3.count > 0);
    this.buildHint.textContent = e2.dragging ? `Drop it on your island. Drop it back here to keep it.` : r2 ? `Drag a piece onto your island. Drag a built piece to move it.` : `Your bag is empty. Buy pieces in the shop.`;
  }
  isOverTray(e2, t2) {
    let n2 = this.buildTray.getBoundingClientRect();
    return e2 >= n2.left && e2 <= n2.right && t2 >= n2.top && t2 <= n2.bottom;
  }
  shakeTraySlot(e2) {
    let t2 = this.buildTray.querySelector(`[data-tray="${e2}"]`);
    t2 && (t2.classList.remove(`shake`), t2.offsetWidth, t2.classList.add(`shake`));
  }
  showGameOver(e2, t2 = ``) {
    this.gameoverSub.textContent = e2, this.gameoverRecord.textContent = t2, this.gameoverRecord.classList.toggle(`hidden`, !t2);
  }
  showHint() {
    this.hint.classList.remove(`hidden`);
  }
  hideHint() {
    this.hint.classList.add(`hidden`);
  }
}, ArenaObject = class {
  constructor(e2, t2, n2, r2, i2, a2) {
    this.slimeTimer = 0, this.slimeMax = 1, this.kind = t2, this.size = i2, this.body = e2.world.createBody({ type: `dynamic`, position: { x: n2, y: r2 }, linearDamping: 0.05, angularDamping: t2 === `ball` ? 0.05 : 0.2 });
    let o2 = { kind: `object`, obj: this }, s2 = t2 === `crate` ? ho(i2, i2, { x: 0, y: 0 }) : mo({ x: 0, y: 0 }, i2);
    go(this.body, [{ ...s2, userData: o2 }], a2, { friction: t2 === `crate` ? 0.55 : 0.45, restitution: t2 === `crate` ? 0.15 : 0.35 }), this.prevX = n2, this.prevY = r2, this.prevA = 0;
  }
  coat(e2) {
    this.slimeTimer = Math.max(this.slimeTimer, e2), this.slimeMax = this.slimeTimer;
  }
  snapshot() {
    let e2 = this.body.getPosition();
    this.prevX = e2.x, this.prevY = e2.y, this.prevA = this.body.getAngle();
  }
  update(e2) {
    this.slimeTimer = Math.max(0, this.slimeTimer - e2);
  }
  destroy(e2) {
    e2.removeBody(this.body);
  }
}, ISLANDS = [{ minX: -16, maxX: -6, topY: 0, home: `player` }, { minX: 7.5, maxX: 18.5, topY: 0, home: `enemy` }], Arena = class {
  constructor(e2, t2 = `platform`, a3 = {}) {
    this.mode = t2, this.solids = [], this.objects = [], this.terrain = e2.world.createBody({ type: `static`, position: { x: 0, y: 0 } });
    if (t2 === `endless`) {
      this.seed = (a3.seed ?? ((Math.random() * 4294967296) >>> 0)) >>> 0, this.features = a3.features === false ? null : new Map();
      this.chunks = new Map(), this.groundSpan = { minX: 0, maxX: 0, topY: 0, home: `player` }, this.islands = [this.groundSpan], this.updateEndless(ARENA_CFG.playerSpawnX);
      return;
    }
    this.islands = ISLANDS;
    let n2 = { kind: `platform` };
    for (let r2 of ISLANDS) {
      let i2 = (r2.maxX - r2.minX) / 2, a2 = (r2.maxX + r2.minX) / 2;
      this.addBox(a2, r2.topY - 0.3, i2, 0.3, n2, 0.8);
    }
    this.objects.push(new ArenaObject(e2, `crate`, -12, 0.47, 0.45, 8)), this.objects.push(new ArenaObject(e2, `ball`, 9, 0.46, 0.45, 6));
  }
  addBox(e2, t2, n2, r2, i2, a2) {
    let o2 = new BoxShape(n2, r2, new Vec2(e2, t2), 0), s2 = { minX: e2 - n2, maxX: e2 + n2, minY: t2 - r2, maxY: t2 + r2 }, f2 = this.terrain.createFixture(o2, { friction: a2, restitution: 0.05, userData: i2 });
    return this.solids.push(s2), { fixture: f2, solid: s2 };
  }
  updateEndless(e2) {
    if (this.mode !== `endless`) return;
    let t2 = Math.floor(e2 / ENDLESS_CFG.chunkW);
    if (t2 === this.chunkIndex && this.chunks.size === ENDLESS_CFG.ahead + ENDLESS_CFG.behind + 1) return;
    this.chunkIndex = t2;
    let n2 = { kind: `platform` }, r2 = t2 - ENDLESS_CFG.behind, i2 = t2 + ENDLESS_CFG.ahead;
    for (let a2 = r2; a2 <= i2; a2++) if (!this.chunks.has(a2)) {
      let o2 = a2 * ENDLESS_CFG.chunkW - ENDLESS_CFG.overlap, s2 = (a2 + 1) * ENDLESS_CFG.chunkW + ENDLESS_CFG.overlap;
      let l2 = this.addBox((o2 + s2) / 2, -0.3, (s2 - o2) / 2, 0.3, n2, 0.8);
      if (this.features) {
        let f2 = terrainTemplate(this.seed, a2), v2 = { type: f2.type, mirror: f2.mirror, x0: Infinity, x1: -Infinity, top: 0, parts: [] };
        if (f2.type === `tower`) {
          // Background building: decoration only, no collision bodies/fixtures. `parts` stays empty; only the door x is recorded for the E-to-enter hint.
          let c0 = a2 * ENDLESS_CFG.chunkW, r2 = (a2 + 1) * ENDLESS_CFG.chunkW, i2 = TERRAIN_CFG.margin;
          let u2 = c0 + (f2.mirror ? r2 - c0 - f2.doorX : f2.doorX);
          v2.doorX = i2 <= f2.doorX && f2.doorX <= ENDLESS_CFG.chunkW - i2 ? u2 : (c0 + r2) / 2;
          v2.seed = f2.seed;
          l2.feature = v2, this.features.set(a2, v2);
        } else {
          l2.parts = [];
          for (let g2 of terrainGeometry(f2, a2)) {
            let c2 = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, poly: g2.poly };
            for (let p2 of g2.poly) c2.minX = Math.min(c2.minX, p2.x), c2.maxX = Math.max(c2.maxX, p2.x), c2.minY = Math.min(c2.minY, p2.y), c2.maxY = Math.max(c2.maxY, p2.y);
            let d2 = new Qr(g2.poly.map((p2) => new Vec2(p2.x, p2.y))), y2 = this.terrain.createFixture(d2, { friction: 0.8, restitution: 0.05, userData: { kind: `platform` } });
            this.solids.push(c2), v2.parts.push({ kind: g2.kind, poly: g2.poly, fixture: y2, solid: c2 }), l2.parts.push({ fixture: y2, solid: c2 }), v2.x0 = Math.min(v2.x0, c2.minX), v2.x1 = Math.max(v2.x1, c2.maxX), v2.top = Math.max(v2.top, c2.maxY);
          }
          v2.parts.length && (l2.feature = v2, this.features.set(a2, v2));
        }
      }
      this.chunks.set(a2, l2);
    }
    for (let [a2, o2] of [...this.chunks]) if (a2 < r2 || a2 > i2) {
      this.terrain.destroyFixture(o2.fixture);
      let s2 = this.solids.indexOf(o2.solid);
      s2 >= 0 && this.solids.splice(s2, 1);
      for (let l2 of o2.parts ?? []) {
        this.terrain.destroyFixture(l2.fixture);
        let f2 = this.solids.indexOf(l2.solid);
        f2 >= 0 && this.solids.splice(f2, 1);
      }
      this.features && this.features.delete(a2), this.chunks.delete(a2);
    }
    this.groundSpan.minX = r2 * ENDLESS_CFG.chunkW, this.groundSpan.maxX = (i2 + 1) * ENDLESS_CFG.chunkW;
  }
  isSolid(e2, t2) {
    for (let n2 of this.solids) if (e2 >= n2.minX && e2 <= n2.maxX && t2 >= n2.minY && t2 <= n2.maxY) {
      if (!n2.poly) return true;
      let r2 = true;
      for (let i2 = 0; i2 < n2.poly.length; i2++) {
        let a2 = n2.poly[i2], o2 = n2.poly[(i2 + 1) % n2.poly.length];
        if ((o2.x - a2.x) * (t2 - a2.y) - (o2.y - a2.y) * (e2 - a2.x) < -1e-9) { r2 = false; break; }
      }
      if (r2) return true;
    }
    return false;
  }
  surfaceY(e2) {
    let t2 = 0;
    if (!this.features) return t2;
    for (let n2 of this.features.values()) for (let r2 of n2.parts) for (let i2 = 0; i2 < r2.poly.length; i2++) {
      let a2 = r2.poly[i2], o2 = r2.poly[(i2 + 1) % r2.poly.length];
      if (Math.abs(a2.x - o2.x) < 1e-9 || e2 < Math.min(a2.x, o2.x) || e2 > Math.max(a2.x, o2.x)) continue;
      let s2 = a2.y + (o2.y - a2.y) * (e2 - a2.x) / (o2.x - a2.x);
      s2 > t2 && (t2 = s2);
    }
    return t2;
  }
  isFlat(e2, t2 = 1) {
    let n2 = this.surfaceY(e2);
    if (Math.abs(this.surfaceY(e2 - t2) - n2) > 0.02 || Math.abs(this.surfaceY(e2 + t2) - n2) > 0.02) return false;
    if (!this.features) return true;
    for (let r2 of this.features.values()) for (let i2 of r2.parts) for (let a2 = 0; a2 < i2.poly.length; a2++) {
      let o2 = i2.poly[a2], s2 = i2.poly[(a2 + 1) % i2.poly.length];
      if (Math.abs(o2.x - s2.x) < 1e-9 && Math.abs(o2.y - s2.y) > 0.05 && o2.x >= e2 - t2 - 0.5 && o2.x <= e2 + t2 + 0.5) return false;
    }
    return true;
  }
  findSpawnX(e2, t2 = 6) {
    for (let n2 = 0; n2 * 0.5 <= t2 + 1e-9; n2++) for (let r2 of n2 === 0 ? [0] : [n2 * 0.5, -n2 * 0.5]) {
      let i2 = e2 + r2;
      if (this.isFlat(i2, 1) && this.surfaceY(i2) <= 3) return i2;
    }
    return null;
  }
}, oc = 0.6, sc = [`SPLAT!`, `SPLOOSH!`, `GLORP!`, `SPLORT!`, `BLORP!`, `SPLUT!`];
function cc(e2) {
  return e2 === `head` ? COMBAT_CFG.headMultiplier : e2 === `torso` || e2 === `pelvis` ? COMBAT_CFG.torsoMultiplier : COMBAT_CFG.limbMultiplier;
}
var Combat = class {
  constructor(e2, t2, n2, r2 = null) {
    this.physics = e2, this.slime = t2, this.effects = n2, this.trauma = 0, this.hitstop = 0, this.lastImpact = /* @__PURE__ */ new Map(), this.dripAcc = /* @__PURE__ */ new Map(), this.onPlayerDamage = r2;
  }
  consumeHitstop(e2) {
    let t2 = Math.min(this.hitstop, e2);
    return this.hitstop -= t2, t2;
  }
  onProjectileHit(e2, t2) {
    let n2 = e2.projectile;
    if (n2.consumed || !n2.alive) return;
    let r2 = n2.shot;
    e2.other.kind === `gum` && (e2.other.gum.jiggle = 1);
    let i2 = e2.other.kind === `gum` ? { kind: `part`, ragdoll: e2.other.gum.host, part: e2.other.gum.part, foot: false } : e2.other;
    if (i2.kind === `block`) {
      if (n2.ownerId === 1) return;
      t2.damageBlock(i2.piece, FORTRESS_CFG.shotDamage * r2.damageMul, n2.ownerId), i2.piece.def.id === `jelly` && (n2.bouncesLeft = Math.max(n2.bouncesLeft, 1));
    }
    let o2 = i2.kind === `ground` || i2.kind === `platform` || i2.kind === `puddle` || i2.kind === `wall` || i2.kind === `block` || i2.kind === `object`, s2 = this.physics.time;
    if (o2 && n2.bouncesLeft > 0 && s2 - n2.lastBounce > 0.1) {
      n2.bouncesLeft--, n2.bounceCount++, n2.lastBounce = s2, this.effects.ring(e2.point.x, e2.point.y, n2.color, 6), this.trauma = Math.min(0.5, this.trauma + 0.02);
      return;
    }
    if (i2.kind === `block`) snd(`block`, { x: e2.point.x });
    else if (i2.kind === `ground` || i2.kind === `platform` || i2.kind === `wall` || i2.kind === `puddle`) snd(`splat`, { x: e2.point.x, vol: clamp(e2.speed / 12, 0.4, 1.3) });
    if (r2.pierce && i2.kind === `part`) {
      if (n2.hitTargets.has(i2.ragdoll)) return;
      n2.hitTargets.add(i2.ragdoll), this.hitCharacter(i2.ragdoll, i2.part, e2, t2, 1);
      return;
    }
    if (i2.kind === `flyer` && i2.flyer) {
      if (n2.ownerId === 1 && i2.flyer.alive && t2.flyers) {
        let a2 = n2.shot, s2 = COMBAT_CFG.projectileBaseDamage + COMBAT_CFG.projectileDamagePerSpeed * Math.max(0, e2.speed - 3), c2 = Math.min(COMBAT_CFG.projectileDamageCap, s2 * a2.damageMul);
        if (n2.bounceCount > 0 && r2.runStats && r2.runStats.ricochetDamagePerBounce > 0) {
          c2 *= 1 + r2.runStats.ricochetDamagePerBounce * n2.bounceCount;
        }
        t2.playerHit && (c2 = t2.playerHit(n2, { incomingMul: 1 }, c2, e2.point));
        let f2 = i2.flyer.body.getPosition(), m2 = Math.max(3, n2.speed);
        t2.flyers.damage(i2.flyer, c2, { x: -e2.normal.x * m2 * 0.35, y: -e2.normal.y * m2 * 0.35 });
        this.slime.splat(e2.point, e2.normal, t2.splatRadius * a2.splatMul, t2.coatDuration, t2.ragdolls, t2.objects, null);
        this.effects.text(f2.x, f2.y + 0.5, String(Math.round(c2)), `#ffe066`, 15), snd(`splatHit`, { x: e2.point.x }), this.hitstop = Math.max(this.hitstop, Math.min(0.09, 0.03 + c2 * 12e-4));
      }
      n2.consumed = true, n2.destroy(this.physics);
      return;
    }
    if (n2.consumed = true, n2.destroy(this.physics), this.trauma = Math.min(0.5, this.trauma + 0.05 + 0.012 * e2.speed), r2.explode) {
      this.explode(e2.point, r2, n2.ownerId, t2);
      return;
    }
    if (r2.well) {
      t2.addWell(e2.point, { ...r2.well, x: e2.point.x, y: e2.point.y }), this.slime.splat(e2.point, e2.normal, t2.splatRadius * 0.6, t2.coatDuration, t2.ragdolls, t2.objects, null), this.effects.ring(e2.point.x, e2.point.y, r2.color, 10);
      return;
    }
    let c2 = t2.splatRadius * r2.splatMul;
    if (i2.kind === `part`) this.hitCharacter(i2.ragdoll, i2.part, e2, t2, 1), this.slime.splat(e2.point, e2.normal, c2, t2.coatDuration, t2.ragdolls, t2.objects, i2.ragdoll), i2.ragdoll.team === `enemy` && this.gumUp(i2.ragdoll, i2.part, e2, r2);
    else if (i2.kind === `object`) i2.obj.coat(t2.coatDuration), this.slime.splat(e2.point, e2.normal, c2, t2.coatDuration, t2.ragdolls, t2.objects, null);
    else {
      if (-e2.normal.y > 0.5 && (i2.kind === `ground` || i2.kind === `platform` || i2.kind === `puddle`)) {
        let n3 = c2 * r2.puddleMul, i3 = t2.puddleLife * r2.puddleLifeMul;
        r2.glue > 0 ? this.slime.addPuddle(e2.otherBody, e2.point, n3, i3, r2.glue, true) : this.slime.addPuddle(e2.otherBody, e2.point, n3, i3);
      }
      this.slime.splat(e2.point, e2.normal, c2, t2.coatDuration, t2.ragdolls, t2.objects, null);
    }
    r2.splitCount > 0 && t2.spawnSplit(e2.point, e2.normal, n2.ownerId, r2);
  }
  gumUp(e2, t2, n2, r2) {
    let i2 = n2.normal;
    this.effects.burst(n2.point.x, n2.point.y, r2.color, 24, 9, -i2.x, -i2.y), this.effects.burst(n2.point.x, n2.point.y, `#e9ffd6`, 8, 5, -i2.x, -i2.y), this.effects.ring(n2.point.x, n2.point.y, r2.color, 12), this.trauma = Math.min(0.5, this.trauma + 0.06);
    let a2 = e2.parts.get(t2)?.body;
    if (a2) {
      let e3 = Math.min(4, 0.3 * r2.mass * Math.max(4, n2.speed), a2.getMass() * KNOCK_CFG.gumPartDv);
      a2.applyLinearImpulse({ x: i2.x * e3, y: i2.y * e3 }, n2.point, true);
    }
    for (let t3 of this.slime.gums) t3.host === e2 && (t3.jiggle = Math.max(t3.jiggle, 0.7));
    this.slime.addGum(e2, t2, n2.point, Math.max(0.22, r2.radius * 2.2), SLIME_CFG.gumLife);
  }
  hitWord(e2, t2, n2) {
    let r2 = { x: n2.point.x + 0.35, y: n2.point.y + 0.9 };
    if (e2 === `head`) {
      this.effects.text(r2.x, r2.y + 0.3, `HEADSHOT!`, `#ffd23f`, 30), this.effects.shockwave(n2.point.x, n2.point.y, `#ffd23f`, 1.4, 0.35), this.effects.flash(0.18), this.hitstop = Math.max(this.hitstop, 0.1), this.trauma = Math.min(0.6, this.trauma + 0.12);
      return;
    }
    let i2 = sc[Math.floor(Math.random() * sc.length)];
    this.effects.text(r2.x, r2.y, i2, `#d6ff8a`, t2 >= 18 ? 30 : 26), this.effects.shockwave(n2.point.x, n2.point.y, `#eaffd9`, 0.9, 0.3);
  }
  hitCharacter(e2, t2, n2, r2, i2) {
    if (!e2.alive || n2.projectile.ownerId !== 1 && e2.id === n2.projectile.ownerId) return;
    snd(`splatHit`, { x: n2.point.x });
    t2 === `head` && snd(`headshot`, { x: n2.point.x });
    let a2 = n2.projectile.shot, s2 = COMBAT_CFG.projectileBaseDamage + COMBAT_CFG.projectileDamagePerSpeed * Math.max(0, n2.speed - 3), c2 = Math.min(COMBAT_CFG.projectileDamageCap, s2 * cc(t2) * a2.damageMul * i2);
    if (n2.projectile.bounceCount > 0 && r2.runStats && r2.runStats.ricochetDamagePerBounce > 0) {
      c2 *= 1 + r2.runStats.ricochetDamagePerBounce * n2.projectile.bounceCount;
    }
    n2.projectile.ownerId === 1 && e2.team === `enemy` && r2.playerHit && (c2 = r2.playerHit(n2.projectile, e2, c2, n2.point));
    const isAreaHit = n2.projectile.shot.explode !== undefined;
    if (n2.projectile.ownerId === 1 && e2.team === `enemy` && r2.runStats) {
      const procs = applyElementalOnHit(e2, r2.runStats, c2, isAreaHit, r2.rng);
      for (const proc of procs) {
        proc.kind === 'fire' && snd(`igniteProc`, { x: n2.point.x }), proc.kind === 'frost' && (e2.status && e2.status.frozen ? snd(`freezeBreak`, { x: n2.point.x }) : snd(`frostProc`, { x: n2.point.x })), proc.kind === 'shock' && snd(`shockZap`, { x: n2.point.x });
        if (proc.kind === 'shock' && e2.status && e2.status.shock.active) {
          const chainTargets = shockChain(e2, (r2.enemies || []).filter(en => en.alive), r2.runStats, c2, r2.rng);
          for (const chain of chainTargets) {
            this.damage(chain.target, chain.damage, `torso`, chain.target.torsoPosition(), { text: true, flash: true });
            this.effects.burst(chain.target.torsoPosition().x, chain.target.torsoPosition().y, ELEMENT_COLORS.shock, 4, 5, 0, 1);
          }
        }
      }
    }
    this.damage(e2, c2, t2, n2.point), r2.onCharacterHit(e2, c2, n2.point), this.hitstop = Math.max(this.hitstop, Math.min(0.09, 0.03 + c2 * 12e-4)), e2.team === `enemy` && this.hitWord(t2, c2, n2), (e2.team === `player` || e2.knockable) && e2.knock(n2.normal.x, n2.normal.y, (a2.mass ?? SLIME_CFG.projectileMass) * n2.speed * KNOCK_CFG.factor, n2.point.y), e2.coat(r2.coatDuration, n2.point, t2), n2.speed > COMBAT_CFG.staggerSpeed && e2.stagger(0.55), a2.dripTime > 0 && e2.drip(a2.dripTime, a2.dripDps);
  }
  explode(e2, t2, n2, r2) {
    let i2 = t2.explode;
    if (i2) {
      this.effects.ring(e2.x, e2.y, t2.color, 16), this.effects.burst(e2.x, e2.y, t2.color, 28, 10, 0, 1), this.trauma = Math.min(0.6, this.trauma + 0.3), this.hitstop = Math.max(this.hitstop, 0.09);
      for (let t3 of r2.ragdolls) {
        if (!t3.alive || n2 !== 1 && t3.id === n2) continue;
        let n3 = 1 / 0, a2 = 0;
        for (let e3 of t3.parts.values()) a2 += e3.spec.mass;
        for (let r3 of t3.parts.values()) {
          let t4 = r3.body.getPosition(), o2 = Math.hypot(t4.x - e2.x, t4.y - e2.y);
          if (n3 = Math.min(n3, o2), o2 >= i2.radius) continue;
          let s2 = 1 - o2 / i2.radius, c2 = o2 < 0.05 ? 0 : (t4.x - e2.x) / o2, l2 = o2 < 0.05 ? 1 : (t4.y - e2.y) / o2, u2 = i2.impulse * s2 * (r3.spec.mass / a2) * (t3.noKnockdown ? KNOCK_CFG.playerBlastScale : 1);
          r3.body.applyLinearImpulse({ x: c2 * u2, y: l2 * u2 }, t4, true);
        }
        if (n3 < i2.radius) {
          let e3 = 1 - n3 / i2.radius, d2 = n2 === 1 ? 1 : (t2.damageMul ?? 1), a3 = n2 === 1 ? i2.damage * e3 : Math.min(COMBAT_CFG.projectileDamageCap, i2.damage * e3 * d2);
          this.damage(t3, a3, `torso`, t3.torsoPosition()), r2.onCharacterHit(t3, a3, t3.torsoPosition()), e3 > 0.35 && t3.stagger(0.8), n2 === 1 && t3.team === `enemy` && r2.runStats && applyElementalOnHit(t3, r2.runStats, a3, true, r2.rng);
        }
      }
      for (let t3 of r2.objects) {
        let n3 = t3.body.getPosition(), r3 = Math.hypot(n3.x - e2.x, n3.y - e2.y);
        if (r3 >= i2.radius) continue;
        let a2 = 1 - r3 / i2.radius, o2 = r3 < 0.05 ? 0 : (n3.x - e2.x) / r3, s2 = r3 < 0.05 ? 1 : (n3.y - e2.y) / r3, c2 = i2.impulse * 0.5 * a2;
        t3.body.applyLinearImpulse({ x: o2 * c2, y: s2 * c2 }, n3, true);
      }
      if (r2.flyers && r2.flyers.items) {
        for (let f of r2.flyers.items) {
          if (!f.alive || !f.body) continue;
          let fp = f.body.getPosition(), dx = fp.x - e2.x, dy = fp.y - e2.y, d = Math.hypot(dx, dy);
          if (d >= i2.radius) continue;
          let falloff = 1 - d / i2.radius, ux = d < 0.05 ? 0 : dx / d, uy = d < 0.05 ? 1 : dy / d;
          let force = i2.impulse * falloff * 0.6;
          r2.flyers.knock(f, ux * force, uy * force, 1);
          r2.flyers.damage(f, n2 === 1 ? i2.damage * falloff : Math.min(COMBAT_CFG.projectileDamageCap, i2.damage * falloff * (t2.damageMul ?? 1)), null);
        }
      }
      this.slime.splat(e2, { x: 0, y: 1 }, i2.radius * 0.6, r2.coatDuration, r2.ragdolls, r2.objects, null), i2.clusterCount > 0 && i2.clusterShot && r2.spawnRadial(e2, i2.clusterCount, n2, i2.clusterShot);
    }
  }
  onImpact(e2) {
    let t2 = e2.ragdoll;
    if (!t2.alive) return;
    let n2 = this.physics.time;
    if (n2 - (this.lastImpact.get(t2) ?? -10) < COMBAT_CFG.impactCooldown) return;
    if (t2.safeAir > 0 && e2.source !== `part` && e2.source !== `projectile`) return;
    let r2 = e2.speed - COMBAT_CFG.impactThreshold, i2 = clamp(r2 * COMBAT_CFG.impactDamagePerSpeed, 0, COMBAT_CFG.impactDamageCap) * cc(e2.part) * (e2.source === `object` ? oc : 1);
    i2 < 0.4 || (this.lastImpact.set(t2, n2), this.trauma = Math.min(0.5, this.trauma + 0.02 + 0.01 * r2), this.damage(t2, i2, e2.part, e2.point), e2.speed > COMBAT_CFG.staggerSpeed && t2.stagger(0.4), this.effects.ring(e2.point.x, e2.point.y, `#ffffff`, 6),
      snd(`impact`, { x: e2.point.x, vol: clamp(e2.speed / 10, 0.3, 1.4) }),
      e2.speed > COMBAT_CFG.impactThreshold * 2.2 && snd(`impactHard`, { x: e2.point.x, vol: clamp(e2.speed / 10, 0.3, 1.4) }),
      e2.source === `object` && e2.speed > 5 && snd(`boulderHit`, { x: e2.point.x }));
  }
  damage(e2, t2, n2, r2, i2 = {}) {
    let alive0 = e2.alive;
    let dmg = t2;
    if (e2.status && e2.status.frozen) dmg *= ELEMENT_CFG.frost.freezeDamageMul;
    if (alive0 && (e2.hp = Math.max(0, e2.hp - dmg * e2.incomingMul), i2.flash !== false && e2.flash(n2), i2.text !== false)) {
      let n3 = Math.max(1, Math.round(dmg * e2.incomingMul));
      this.effects.text(r2.x, r2.y + 0.15, `-${n3}`, e2.team === `player` ? `#ff6b6b` : ELEMENT_COLORS.shock);
      if (e2.status && e2.status.frozen) this.effects.text(r2.x, r2.y + 0.4, `FROZEN!`, ELEMENT_COLORS.frost);
      if (e2.status && e2.status.fire.active) this.effects.text(r2.x, r2.y + 0.4, `BURN!`, ELEMENT_COLORS.fire);
      if (e2.status && e2.status.shock.active) this.effects.text(r2.x, r2.y + 0.4, `SHOCK!`, ELEMENT_COLORS.shock);
      if (e2.team === `player` && this.onPlayerDamage) {
        this.onPlayerDamage(e2, dmg * e2.incomingMul, n2, r2);
      }
    }
    if (alive0 && dmg > 0 && i2.flash !== false) {
      if (e2.hp <= 0) e2.team === `player` ? snd(`playerDie`) : snd(`ko`, { x: r2.x });
      else e2.team === `player` ? snd(`hurtPlayer`) : snd(`hurtAlien`, { x: r2.x });
    }
    e2.slimeBody && r2 && i2.flash !== false && e2.slimeBody.kick(r2.x, r2.y, (Math.random() - 0.5) * 8, 4, clamp(dmg / 14, 0.4, 2));
  }
  tickDrips(e2, t2) {
    for (let n2 of t2) {
      if (!n2.alive || n2.dripTime <= 0 || n2.dripDps <= 0) continue;
      let t3 = n2.dripDps * e2;
      this.damage(n2, t3, `torso`, n2.torsoPosition(), { text: false, flash: false });
      let r2 = (this.dripAcc.get(n2) ?? 0) + t3 * n2.incomingMul;
      if (r2 >= 3) {
        let e3 = n2.torsoPosition();
        this.effects.text(e3.x, e3.y + 0.5, `-${Math.round(r2)}`, `#c77dff`), r2 = 0;
      }
      this.dripAcc.set(n2, r2);
    }
  }
  forget(e2) {
    this.lastImpact.delete(e2), this.dripAcc.delete(e2);
  }
}, uc = { kind: `platform` }, dc = -12, fc = 0.03, Fortress = class {
  constructor(e2, t2, n2) {
    this.physics = e2, this.standing = [], this.debris = [], this.rejected = [];
    let r2 = t2.islands.find((e3) => e3.home === `player`) ?? t2.islands[0];
    this.zone = { minX: r2.minX, maxX: r2.maxX, topY: r2.topY };
    let i2 = [...n2].sort((e3, t3) => hc(e3) - hc(t3));
    for (let e3 of i2) {
      let t3 = this.add(e3);
      t3.age = 10;
    }
    for (let e3 = this.unsupported(); e3.length > 0; e3 = this.unsupported()) for (let t3 of e3) this.destroyNow(t3), this.rejected.push(t3.saved);
  }
  add(e2) {
    let t2 = fortressItem(e2.item), { w: n2, h: r2 } = is(e2.item, e2.rot), i2 = this.physics.world.createBody({ type: `static`, position: { x: e2.x, y: e2.y } }), o2 = { def: t2, saved: e2, x: e2.x, y: e2.y, w: n2, h: r2, hp: t2.hp, body: i2, falling: false, life: 0, age: 0, flash: 0, reload: FORTRESS_CFG.cannonReload * randRange(0.4, 1), aim: Math.PI / 4, recoil: 0, prevX: e2.x, prevY: e2.y, prevA: 0 }, s2 = { kind: `block`, piece: o2 };
    return i2.createFixture(new BoxShape(n2 / 2, r2 / 2), { friction: 0.8, restitution: t2.id === `jelly` ? 0.95 : 0.05, userData: s2 }), this.standing.push(o2), o2;
  }
  isLoadBearing(e2) {
    let t2 = e2.y + e2.h / 2;
    return this.standing.some((n2) => n2 !== e2 && Math.abs(n2.y - n2.h / 2 - t2) < fc && mc(e2, n2) > 0.05);
  }
  pickUp(e2) {
    this.destroyNow(e2);
  }
  hit(e2, t2) {
    if (e2.falling || !this.standing.includes(e2) || (e2.hp -= t2 * e2.def.damageTaken, e2.flash = 0.12, e2.hp > 0)) return null;
    this.physics.removeBody(e2.body), this.standing.splice(this.standing.indexOf(e2), 1);
    let n2 = [e2];
    for (let e3 = this.unsupported(); e3.length > 0; e3 = this.unsupported()) for (let t3 of e3) this.drop(t3), n2.push(t3);
    return n2;
  }
  footprint(e2, t2, n2, r2 = null) {
    let { w: i2, h: o2 } = is(e2, t2), s2 = FORTRESS_CFG.grid, c2 = Math.round((n2 - i2 / 2 - this.zone.minX) / s2) * s2 + this.zone.minX;
    c2 = Math.max(this.zone.minX, Math.min(this.zone.maxX - i2, c2));
    let l2 = c2 + i2 / 2, u2 = this.zone.topY;
    for (let e3 of this.standing) e3 !== r2 && Math.min(c2 + i2, e3.x + e3.w / 2) - Math.max(c2, e3.x - e3.w / 2) > 0.02 && (u2 = Math.max(u2, e3.y + e3.h / 2));
    let d2 = u2 + o2 / 2;
    return { item: e2, rot: t2, x: l2, y: d2, w: i2, h: o2, ok: d2 + o2 / 2 <= FORTRESS_CFG.maxHeight + 1e-6 };
  }
  pieceAt(e2, t2) {
    for (let n2 = this.standing.length - 1; n2 >= 0; n2--) {
      let r2 = this.standing[n2];
      if (Math.abs(e2 - r2.x) <= r2.w / 2 + 0.08 && Math.abs(t2 - r2.y) <= r2.h / 2 + 0.08) return r2;
    }
    return null;
  }
  surfaces() {
    return this.standing.map((e2) => ({ minX: e2.x - e2.w / 2, maxX: e2.x + e2.w / 2, topY: e2.y + e2.h / 2 }));
  }
  count(e2) {
    return this.standing.filter((t2) => t2.def.id === e2).length;
  }
  animate(e2) {
    for (let t2 of this.standing) t2.age += e2, t2.flash = Math.max(0, t2.flash - e2), t2.recoil = Math.max(0, t2.recoil - e2 * 4);
  }
  update(e2) {
    this.animate(e2);
    for (let t2 = this.debris.length - 1; t2 >= 0; t2--) {
      let n2 = this.debris[t2];
      n2.life -= e2, n2.flash = Math.max(0, n2.flash - e2), (n2.life <= 0 || n2.body.getPosition().y < dc) && (this.physics.removeBody(n2.body), this.debris.splice(t2, 1));
    }
  }
  snapshot() {
    for (let e2 of [...this.standing, ...this.debris]) {
      let t2 = e2.body.getPosition();
      e2.prevX = t2.x, e2.prevY = t2.y, e2.prevA = e2.body.getAngle();
    }
  }
  supported(e2) {
    let t2 = e2.y - e2.h / 2;
    return Math.abs(t2 - this.zone.topY) < fc && e2.x + e2.w / 2 > this.zone.minX && e2.x - e2.w / 2 < this.zone.maxX || this.standing.some((n2) => n2 !== e2 && Math.abs(n2.y + n2.h / 2 - t2) < fc && mc(e2, n2) > 0.05);
  }
  unsupported() {
    return this.standing.filter((e2) => !this.supported(e2));
  }
  drop(e2) {
    this.standing.splice(this.standing.indexOf(e2), 1), this.physics.removeBody(e2.body);
    let t2 = this.physics.world.createBody({ type: `dynamic`, position: { x: e2.x, y: e2.y }, linearDamping: 0.02, angularDamping: 0.1 });
    t2.createFixture(new BoxShape(e2.w / 2, e2.h / 2), { density: 1.5, friction: 0.8, restitution: 0.1, userData: uc }), t2.setLinearVelocity({ x: randRange(-1.6, 1.6), y: randRange(0, 1.5) }), t2.setAngularVelocity(randRange(-2.5, 2.5)), e2.body = t2, e2.falling = true, e2.life = FORTRESS_CFG.debrisLife, this.debris.push(e2);
  }
  destroyNow(e2) {
    let t2 = this.standing.indexOf(e2);
    t2 >= 0 && this.standing.splice(t2, 1), this.physics.world.destroyBody(e2.body);
  }
};
function mc(e2, t2) {
  return Math.min(e2.x + e2.w / 2, t2.x + t2.w / 2) - Math.max(e2.x - e2.w / 2, t2.x - t2.w / 2);
}
function hc(e2) {
  return e2.y - is(e2.item, e2.rot).h / 2;
}
var Combo = class {
  constructor() {
    this.count = 0, this.timer = 0;
  }
  hit() {
    return this.count = Math.min(COMBO_CFG.max, this.count + 1), this.timer = COMBO_CFG.window, this.count;
  }
  break() {
    this.count = 0, this.timer = 0;
  }
  update(e2) {
    this.timer <= 0 || (this.timer = Math.max(0, this.timer - e2), this.timer === 0 && (this.count = 0));
  }
  get fraction() {
    return this.timer / COMBO_CFG.window;
  }
  get scoreMultiplier() {
    return Math.min(COMBO_CFG.maxScoreMultiplier, 1 + COMBO_CFG.scorePerHit * Math.max(0, this.count - 1));
  }
  get coinMultiplier() {
    return Math.min(COMBO_CFG.maxCoinMultiplier, 1 + COMBO_CFG.coinPerHit * Math.max(0, this.count - 1));
  }
}, _c = 16, vc = -PHYS_CFG.gravityY, Mechanics = class {
  constructor() {
    this.wells = [];
  }
  update(e2, t2) {
    for (let n2 of t2.projectiles) n2.alive && !n2.consumed && this.updateProjectile(e2, n2, t2);
    this.updateWells(e2, t2);
  }
  updateProjectile(e2, t2, n2) {
    let r2 = t2.body, i2 = t2.shot;
    if (t2.liftLeft > 0 && (t2.liftLeft -= e2, r2.applyForceToCenter({ x: 0, y: r2.getMass() * vc * i2.lift }, true)), i2.homing > 0 && !t2.returning) {
      let a2 = r2.getPosition(), o2 = null, s2 = 1 / 0;
      for (let e3 of n2.targetsFor(t2)) {
        if (!e3.alive) continue;
        let t3 = e3.torsoPosition(), n3 = Math.hypot(t3.x - a2.x, t3.y - a2.y);
        n3 < s2 && (s2 = n3, o2 = t3);
      }
      if (o2) {
        let t3 = r2.getLinearVelocity(), n3 = Math.hypot(t3.x, t3.y), c2 = (o2.x - a2.x) / (s2 || 1), l2 = (o2.y - a2.y) / (s2 || 1), u2 = t3.x + c2 * n3 * i2.homing * e2, d2 = t3.y + l2 * n3 * i2.homing * e2, f2 = Math.hypot(u2, d2) || 1;
        u2 = u2 / f2 * n3, d2 = d2 / f2 * n3, r2.setLinearVelocity({ x: u2, y: d2 });
      }
    }
    if (i2.boomerang > 0) {
      t2.returning || (t2.boomerangLeft -= e2, t2.boomerangLeft <= 0 && (t2.returning = true, t2.hitTargets.clear()));
      let i3 = t2.returning ? n2.ownerOf(t2.ownerId) : null;
      if (i3 && i3.alive) {
        let n3 = i3.muzzle({ x: 0, y: 1 }, 0), a2 = r2.getPosition(), o2 = n3.x - a2.x, s2 = n3.y - a2.y, c2 = Math.hypot(o2, s2);
        if (c2 < 0.8) {
          t2.life = 0;
          return;
        }
        let l2 = r2.getLinearVelocity(), u2 = Math.min(1, 6 * e2);
        r2.setLinearVelocity({ x: l2.x + (o2 / c2 * _c - l2.x) * u2, y: l2.y + (s2 / c2 * _c - l2.y) * u2 });
      }
    }
    i2.fuse > 0 && (t2.fuseLeft -= e2, t2.fuseLeft <= 0 && n2.onFuse(t2));
  }
  updateWells(e2, t2) {
    for (let n2 = this.wells.length - 1; n2 >= 0; n2--) {
      let r2 = this.wells[n2];
      if (r2.time -= e2, r2.time <= 0) this.wells.splice(n2, 1);
      else {
        for (let e3 of t2.ragdolls) if (e3.alive) for (let t3 of e3.parts.values()) this.pull(t3.body, r2);
        for (let e3 of t2.objects) this.pull(e3.body, r2);
        for (let e3 of t2.projectiles) e3.alive && e3.life > 0 && this.pull(e3.body, r2);
      }
    }
  }
  pull(e2, t2) {
    let n2 = e2.getPosition(), r2 = t2.x - n2.x, i2 = t2.y - n2.y, a2 = Math.hypot(r2, i2);
    if (a2 > t2.radius || a2 < 1e-6) return;
    let o2 = t2.strength * 0.5 / (a2 + 0.6), s2 = e2.getMass() * o2;
    e2.applyForceToCenter({ x: r2 / a2 * s2, y: i2 / a2 * s2 }, true);
  }
}, bc = `slipshot.profile.v1`, xc = 200, Sc = `hands`, Cc = [`power`, `splat`, `duration`, `maxHp`, `armor`, `reload`, `grip`, `iron`, `bounty`];
function wc() {
  return { power: 0, splat: 0, duration: 0, maxHp: 0, armor: 0, reload: 0, grip: 0, iron: 0, bounty: 0 };
}
function Tc() {
  let e2 = {};
  for (let t2 of ts) e2[t2] = 0;
  return e2;
}
function Ec() {
  return { unlocked: FORTRESS_ITEMS.filter((e2) => e2.unlock === 0).map((e2) => e2.id), inventory: { ...Tc(), brick: 4 }, layout: [] };
}
function Dc() {
  return { coins: xc, owned: [Sc], equipped: Sc, levels: wc(), fortress: Ec() };
}
function Oc(e2) {
  if (!e2 || typeof e2 != `object`) return false;
  let t2 = e2;
  return rs(t2.item) && typeof t2.x == `number` && Number.isFinite(t2.x) && typeof t2.y == `number` && Number.isFinite(t2.y) && (t2.rot === 0 || t2.rot === 1);
}
function kc() {
  let e2 = Dc();
  try {
    let t2 = localStorage.getItem(bc);
    if (!t2) return e2;
    let n2 = JSON.parse(t2);
    if (typeof n2.coins == `number` && n2.coins >= 0 && (e2.coins = Math.floor(n2.coins)), Array.isArray(n2.owned)) {
      let t3 = n2.owned.filter((e3) => WEAPONS.some((t4) => t4.id === e3));
      e2.owned = t3.includes(Sc) ? t3 : [Sc, ...t3];
    }
    if (n2.equipped && e2.owned.includes(n2.equipped) && (e2.equipped = n2.equipped), n2.levels) for (let t3 of Cc) {
      let r3 = n2.levels[t3];
      typeof r3 == `number` && (e2.levels[t3] = Math.max(0, Math.min(5, Math.floor(r3))));
    }
    let r2 = n2.fortress;
    if (r2 && typeof r2 == `object`) {
      if (Array.isArray(r2.unlocked)) for (let t3 of r2.unlocked) rs(t3) && !e2.fortress.unlocked.includes(t3) && e2.fortress.unlocked.push(t3);
      if (r2.inventory && typeof r2.inventory == `object`) for (let t3 of ts) {
        let n3 = r2.inventory[t3];
        typeof n3 == `number` && n3 >= 0 && (e2.fortress.inventory[t3] = Math.floor(n3));
      }
      Array.isArray(r2.layout) && (e2.fortress.layout = r2.layout.filter(Oc));
    } else Array.isArray(n2.tower) && (e2.fortress.inventory.brick += n2.tower.length);
  } catch {
  }
  return e2;
}
function Ac(e2) {
  try {
    localStorage.setItem(bc, JSON.stringify(e2));
  } catch {
  }
}
// Per-mode best results (task 4). Own storage key, so "Reset progress" (coins, weapons, upgrades) never wipes records; each mode only touches its own fields.
var RECORDS_KEY = `slipshot.records.v1`, RECORD_FIELDS = { endless: [`dist`, `time`, `score`, `kills`], platform: [`wave`, `score`, `kills`] }, RECORD_LABELS = { dist: `distance`, time: `survival time`, score: `score`, kills: `KOs`, wave: `wave` };
function formatClock(e2) {
  return `${Math.floor(e2 / 60)}:${String(e2 % 60).padStart(2, `0`)}`;
}
var Records = class {
  constructor(e2 = typeof localStorage !== `undefined` ? localStorage : null) {
    this.storage = e2, this.data = {};
    for (let t2 of Object.keys(RECORD_FIELDS)) {
      this.data[t2] = {};
      for (let n2 of RECORD_FIELDS[t2]) this.data[t2][n2] = 0;
    }
    this.load();
  }
  load() {
    try {
      let e2 = this.storage ? this.storage.getItem(RECORDS_KEY) : null, t2 = e2 ? JSON.parse(e2) : null;
      if (!t2 || typeof t2 != `object`) return;
      for (let e3 of Object.keys(RECORD_FIELDS)) for (let n2 of RECORD_FIELDS[e3]) {
        let r2 = t2[e3] && t2[e3][n2];
        this.data[e3][n2] = typeof r2 == `number` && Number.isFinite(r2) && r2 > 0 ? Math.floor(r2) : 0;
      }
    } catch {
    }
  }
  save() {
    try {
      this.storage && this.storage.setItem(RECORDS_KEY, JSON.stringify(this.data));
    } catch {
    }
  }
  get(e2) {
    return RECORD_FIELDS[e2] ? { ...this.data[e2] } : null;
  }
  /** Compare a finished run with the stored bests of ITS mode only; returns the list of fields that improved (empty = no record). */
  submit(e2, t2) {
    if (!RECORD_FIELDS[e2] || !t2) return [];
    let n2 = [];
    for (let r2 of RECORD_FIELDS[e2]) {
      let i2 = Math.floor(Number(t2[r2]));
      Number.isFinite(i2) && i2 > this.data[e2][r2] && (this.data[e2][r2] = i2, n2.push(r2));
    }
    return n2.length && this.save(), n2;
  }
  describe(e2) {
    let t2 = this.get(e2);
    if (!t2) return ``;
    if (e2 === `endless`) return t2.dist + t2.time + t2.score === 0 ? `No runs yet` : `Best: ${t2.dist} m \xB7 ${formatClock(t2.time)} \xB7 score ${t2.score}`;
    return t2.wave + t2.score === 0 ? `No runs yet` : `Best: wave ${t2.wave} \xB7 score ${t2.score}`;
  }
  recordText(e2) {
    return e2.length ? `New best: ${e2.map((e3) => RECORD_LABELS[e3]).join(`, `)}!` : ``;
  }
};
var Progression = class {
  constructor() {
    this.wave = 1, this.score = 0, this.kills = 0;
    let e2 = kc();
    this.coins = e2.coins, this.levels = e2.levels, this.owned = new Set(e2.owned), this.equipped = e2.equipped, this.fortress = e2.fortress;
    this.runWeapons = new Set();
  }
  save() {
    Ac({ coins: this.coins, owned: [...this.owned], equipped: this.owned.has(this.equipped) ? this.equipped : Sc, levels: { ...this.levels }, fortress: { unlocked: [...this.fortress.unlocked], inventory: { ...this.fortress.inventory }, layout: this.fortress.layout.map((e2) => ({ ...e2 })) } });
  }
  get weapon() {
    return weaponById(this.equipped);
  }
  get launchMultiplier() {
    return 1 + 0.16 * this.levels.power;
  }
  get splatRadius() {
    return SLIME_CFG.splatBase * (1 + SLIME_CFG.splatPerLevel * this.levels.splat);
  }
  get coatDuration() {
    return SLIME_CFG.coatBase * (1 + SLIME_CFG.durationPerLevel * this.levels.duration);
  }
  get puddleLife() {
    return SLIME_CFG.puddleBase * (1 + SLIME_CFG.durationPerLevel * this.levels.duration);
  }
  get maxHpBonus() {
    return 20 * this.levels.maxHp;
  }
  get incomingMultiplier() {
    return 1 - 0.08 * this.levels.armor;
  }
  get reloadMultiplier() {
    return 1 - 0.08 * this.levels.reload;
  }
  get slipResist() {
    return Math.min(0.8, 0.16 * this.levels.grip);
  }
  get staggerMultiplier() {
    return 1 - 0.12 * this.levels.iron;
  }
  get bountyMultiplier() {
    return 1 + 0.25 * this.levels.bounty;
  }
  enemyCount() {
    return Math.min(1 + Math.floor((this.wave - 1) / 2), 3);
  }
  waveQuota() {
    return 4 + 2 * this.wave;
  }
  enemyHp() {
    return COMBAT_CFG.enemyBaseHp + COMBAT_CFG.enemyHpPerWave * (this.wave - 1);
  }
  killScore() {
    return 100 + 20 * this.wave;
  }
  killCoins() {
    return Math.round((25 + 5 * this.wave) * this.bountyMultiplier);
  }
  waveBonusCoins() {
    return Math.round((30 + 8 * this.wave) * this.bountyMultiplier);
  }
  earnCoins(e2) {
    this.coins += e2, this.save();
  }
  isOwned(e2) {
    return this.owned.has(e2) || this.runWeapons.has(e2);
  }
  buyWeapon(e2) {
    let t2 = weaponById(e2);
    return this.owned.has(e2) || this.coins < t2.price ? false : (this.coins -= t2.price, this.owned.add(e2), this.save(), true);
  }
  equipWeapon(e2) {
    return this.isOwned(e2) ? (this.equipped = e2, this.save(), true) : false;
  }
  cycleWeapon() {
    let e2 = WEAPONS.filter((e3) => this.isOwned(e3.id)), t2 = e2.findIndex((e3) => e3.id === this.equipped);
    return this.equipped = e2[(t2 + 1) % e2.length].id, this.save(), this.equipped;
  }
  grantRunWeapon(e2) {
    return weaponById(e2), this.runWeapons.add(e2), this.equipped = e2, true;
  }
  upgradeCost(e2) {
    return $o(Qo(e2), this.levels[e2]);
  }
  canUpgrade(e2) {
    return this.levels[e2] < 5 && this.coins >= this.upgradeCost(e2);
  }
  buyUpgrade(e2) {
    return this.canUpgrade(e2) ? (this.coins -= this.upgradeCost(e2), this.levels[e2]++, this.save(), true) : false;
  }
  buyRepairKit() {
    return this.coins < Zo.price ? false : (this.coins -= Zo.price, this.save(), true);
  }
  get layout() {
    return this.fortress.layout;
  }
  isUnlocked(e2) {
    return this.fortress.unlocked.includes(e2);
  }
  canUnlockItem(e2) {
    return !this.isUnlocked(e2) && this.coins >= fortressItem(e2).unlock;
  }
  unlockItem(e2) {
    return this.canUnlockItem(e2) ? (this.coins -= fortressItem(e2).unlock, this.fortress.unlocked.push(e2), this.save(), true) : false;
  }
  canBuyItem(e2) {
    return this.isUnlocked(e2) && this.coins >= fortressItem(e2).price;
  }
  buyItem(e2) {
    return this.canBuyItem(e2) ? (this.coins -= fortressItem(e2).price, this.fortress.inventory[e2]++, this.save(), true) : false;
  }
  itemCount(e2) {
    return this.fortress.inventory[e2];
  }
  placedCount(e2) {
    return this.fortress.layout.filter((t2) => t2.item === e2).length;
  }
  canPlace(e2) {
    return this.itemCount(e2) > 0 && this.placedCount(e2) < fortressItem(e2).maxPlaced;
  }
  placeItem(e2) {
    if (!this.canPlace(e2.item)) return null;
    let t2 = { ...e2 };
    return this.fortress.inventory[e2.item]--, this.fortress.layout.push(t2), this.save(), t2;
  }
  pickUpItem(e2) {
    let t2 = this.fortress.layout.indexOf(e2);
    t2 < 0 || (this.fortress.layout.splice(t2, 1), this.fortress.inventory[e2.item]++, this.save());
  }
  losePieces(e2) {
    e2.length !== 0 && (this.fortress.layout = this.fortress.layout.filter((t2) => !e2.includes(t2)), this.save());
  }
  startRun() {
    this.wave = 1, this.score = 0, this.kills = 0;
    this.runWeapons.clear(), this.owned.has(this.equipped) || (this.equipped = Sc);
  }
  resetProfile() {
    let e2 = Dc();
    this.coins = e2.coins, this.owned.clear(), this.owned.add(Sc), this.equipped = Sc;
    for (let e3 of Cc) this.levels[e3] = 0;
    this.fortress = e2.fortress, this.startRun(), this.save();
  }
}, Mc = { ...WEAPONS[0].shot, color: `#c77dff` }, Nc = { ...WEAPONS[0].shot, color: `#ffd23f`, damageMul: 0.8 }, BOSS_GLOB_SHOT = { ...WEAPONS[0].shot, look: `orb`, radius: 0.26, mass: 1.2, color: `#9dff3a`, damageMul: 1, splatMul: 1.2, puddleMul: 1 }, Pc = 0.1, Fc = 0.08, Ic = 0.45, Lc = 10, Rc = -20, zc = 60, Bc = 0.7, Vc = 0.3, Hc = -1.5, Uc = 3.3, Game = class {
  constructor(e2) {
    AUDIO = this.audio = new AudioEngine();
    this.interior = null, this.interiorSessions = new Map(), this.doorFade = 0, this.interiorHintTimer = 0;
    this.soundFrom = `menu`, this.lastDirectorLevel = 1;
    this.rng = Math.random, this.levelup = new LevelUp(() => this.rng()), this.runStats = this.levelup.stats(), this.levelupOffer = [], this.leechAcc = 0, this.leechTextAt = -1;
    this.urlMode = typeof location !== `undefined` && new URLSearchParams(location.search).get(`mode`) === `endless` ? `endless` : null, this.mode = this.urlMode ?? `platform`, this.keys = /* @__PURE__ */ new Set(), this.camera = new Camera(), (() => { try { const s = JSON.parse(localStorage.getItem(`slipshot.camera.v1`)); if (s && s.shake && [`normal`, `low`, `off`].includes(s.shake)) this.camera.shakeMode = s.shake; if (s && typeof s.zoom === `number` && s.zoom >= 0.7 && s.zoom <= 1.4) this.camera.zoom = s.zoom; } catch {} })(), this.progression = new Progression(), this.records = new Records(), this.runCommitted = true, this.combo = new Combo(), this.throwAnim = null, this.throwTrail = [], this.cooldownTotal = 1, this.coinDrops = [], this.pendingCoins = 0, this.buildDrag = null, this.buildRot = 0, this.buildReturn = `hud`, this.buildCatalogFrom = `menu`, this.enemies = [], this.flyers = [], this.ais = /* @__PURE__ */ new Map(), this.director = new EndlessDirector(), this.vitals = new EndlessVitals(), this.bossScheduler = new BossScheduler(() => this.rng()), this.boss = null, this.bossWarningTimer = 0, this.bossWarningText = '', this.bossZoneIds = new Set(), this.bossCalloutTimer = 0, this.bossCalloutText = '', this.bossCalloutColor = '#fff', this.pickupBanner = null, this.hitMarkers = [], this.vignetteTimer = 0, this.vignetteAlpha = 0, this.playerExclamationTimer = 0, this.walkers = /* @__PURE__ */ new Map(), this.getUpWait = /* @__PURE__ */ new Map(), this.projectiles = [], this.nextId = 1, this.screen = `menu`, this.overlay = `menu`, this.paused = false, this.phase = `playing`, this.phaseTimer = 0, this.shopBonus = 0, this.waveKills = 0, this.waveSpawned = 0, this.stamina = STAMINA_CFG.max, this.airJumpUsed = false, this.playerAirTime = 0, this.staminaFlash = 0, this.slowMo = 0, this.catalogFrom = `menu`, this.catalogTab = `weapons`, this.accumulator = 0, this.lastFrame = null, this.time = 0, this.shotCooldown = 0, this.aimHold = 0, this.lastAimPhi = null, this.drag = null, this.aimDir = null, this.aimPower = 0, this.aimActive = false, this.aimView = { active: false, power: 0, anchor: null, pointer: null, path: [], landing: null }, this.hintShown = true, this.canvas = e2, this.renderer = new Renderer(e2, this.camera), this.ui = new UI({ onPlay: () => this.playMode(`platform`), onPlayEndless: () => this.playMode(`endless`), onMenuCatalog: (e3) => this.openCatalog(`menu`, e3), onPause: () => this.openPause(), onResume: () => this.resume(), onPauseCatalog: (e3) => this.openCatalog(`pause`, e3), onRestartRun: () => this.startRun(), onMainMenu: () => this.toMainMenu(), onSound: () => this.openSound(), onSoundMute: () => this.toggleSoundMute(), onCameraShake: () => this.onCameraShake(), onSoundTest: (e3) => this.testSound(e3), onSoundBack: () => this.closeSound(), onSoundVolume: (e3, e4) => this.setSoundVolume(e3, e4), onSoundSfxCommit: () => snd(`uiClick`), onCatalogTab: (e3) => this.setCatalogTab(e3), onCatalogClose: () => this.closeCatalog(), onCycleWeapon: () => this.cycleWeapon(), onBuyWeapon: (e3) => this.buyWeapon(e3), onEquipWeapon: (e3) => this.equipWeapon(e3), onBuyUpgrade: (e3) => this.buyUpgrade(e3), onBuyRepair: () => this.buyRepair(), onUnlockItem: (e3) => this.unlockItem(e3), onBuyItem: (e3) => this.buyItem(e3), onEnterBuild: () => this.enterBuild(), onExitBuild: () => this.exitBuild(), onRotateBuild: () => this.rotateBuild(), onBuildShop: () => this.openCatalog(`build`, `fortress`), onTrayDrag: (e3, t2, n2) => this.startTrayDrag(e3, t2, n2), onResetProfile: () => this.resetProfile(), onJump: () => this.jump(), onLevelUpPick: (e3) => this.chooseUpgrade(e3) }), window.addEventListener(`pointermove`, (e3) => this.buildPointerMove(e3)), window.addEventListener(`pointerup`, (e3) => this.buildPointerUp(e3)), window.addEventListener(`pointercancel`, () => this.cancelBuildDrag()), new PointerInput(e2, { onDown: (e3) => this.pointerDown(e3), onMove: (e3) => this.pointerMove(e3), onUp: (e3) => this.pointerUp(e3), onCancel: () => {
      this.drag = null;
    } }), window.addEventListener(`resize`, () => this.renderer.resize());
    for (let type of [`pointerdown`, `keydown`, `touchstart`]) window.addEventListener(type, () => this.audio.unlock(), { passive: true });
    document.addEventListener(`visibilitychange`, () => this.audio.setHidden(document.hidden));
    this.renderer.canvas.addEventListener(`wheel`, (e3) => this.onWheel(e3), { passive: false });
    window.addEventListener(`keydown`, (e3) => this.onKeyDown(e3)), window.addEventListener(`keyup`, (e3) => {
      this.keys.delete(e3.key);
    }), window.addEventListener(`blur`, () => this.clearHeldKeys()), this.movePad = $(`move-pad`), this.moveLeftBtn = $(`move-left`), this.moveRightBtn = $(`move-right`), this.setupTouchPad(), this.renderer.resize(), this.toMainMenu();
  }
  onKeyDown(e3) {
    let t3 = e3.key;
    if (this.overlay === `levelup`) {
      (t3 === `1` || t3 === `2` || t3 === `3`) && !e3.repeat && this.chooseUpgrade(this.levelupOffer[Number(t3) - 1]?.id);
      return;
    }
    if ((t3 === `m` || t3 === `M`) && !e3.repeat && !this.isTypingTarget(e3.target)) this.toggleSoundMute();
    if (this.overlay === `build`) {
      t3 === `Escape` ? this.exitBuild() : (t3 === `r` || t3 === `R`) && this.rotateBuild();
      return;
    }
(t3 === `e` || t3 === `E`) && !e3.repeat && !this.isTypingTarget(e3.target) && this.interact(),
    (t3 === `ArrowLeft` || t3 === `ArrowRight` || t3 === `ArrowUp`) && e3.preventDefault(), t3 === `Escape` ? this.togglePause() : t3 === ` ` || t3 === `w` || t3 === `W` || t3 === `ArrowUp` ? !e3.repeat && (t3 === ` ` && e3.preventDefault(), this.jump()) : (t3 === `a` || t3 === `A` || t3 === `ArrowLeft` || t3 === `ArrowRight` || t3 === `D` || t3 === `ArrowRight`) && this.overlay === `hud` && this.keys.add(t3);
  }
  onWheel(e3) {
    if (this.screen !== `run` || this.overlay !== `hud` || this.paused || this.phase !== `playing` || this.interior) return;
    let deltaY = e3.deltaY;
    if (e3.deltaMode === 1) deltaY *= 33;
    const newZoom = clamp(this.camera.zoom * Math.exp(-deltaY * 0.0012), 0.7, 1.4);
    if (newZoom !== this.camera.zoom) {
      this.camera.zoom = newZoom;
      this.camera.zoomDisplayTimer = 1;
      try { localStorage.setItem(`slipshot.camera.v1`, JSON.stringify({ shake: this.camera.shakeMode, zoom: this.camera.zoom })); } catch {}
    }
    e3.preventDefault();
  }
  start() {
    let e2 = (t2) => {
      this.frame(t2), requestAnimationFrame(e2);
    };
    requestAnimationFrame(e2);
  }
  buildWorld() {
    if (this.interior) { this.interior.player.destroy(this.interior.physics), this.interior.physics.removeBody(this.interior.arena.terrain), this.interior.physics.flush(); }
    this.interior = null, this.interiorSessions.clear(), this.doorFade = 0, this.interiorHintTimer = 0;
    this.physics = new PhysicsWorld(), this.effects = new Effects(), this.slime = new SlimeSystem(this.effects), this.combat = new Combat(this.physics, this.slime, this.effects, (ragdoll, dmg, part, point) => {
      const dmgRatio = Math.min(1, dmg / ragdoll.maxHp);
      this.vignetteTimer = 0.35;
      this.vignetteAlpha = dmgRatio < 0.04 ? 0.12 : Math.min(0.7, 0.2 + dmgRatio * 1.4);
      const dmgSize = 18 + Math.round(dmg * 0.15);
      this.effects.text(point.x, point.y + 0.5, `-${Math.round(dmg)}`, `#ff3344`, dmgSize);
      const dx = point.x - ragdoll.torsoPosition().x;
      const dy = point.y - ragdoll.torsoPosition().y;
      const angle = Math.atan2(dy, dx);
      if (this.hitMarkers) this.hitMarkers.push({ angle, life: 0.5, maxLife: 0.5 });
      this.camera.addTrauma(0.1 * dmgRatio);
    }), this.mechanics = new Mechanics(), this.arena = new Arena(this.physics, this.mode, this.mode === `endless` ? { seed: (Math.random() * 4294967296) >>> 0 } : undefined), this.fortress = new Fortress(this.physics, this.arena, this.mode === `endless` ? [] : this.progression.layout);
    for (let e2 of this.fortress.rejected) this.progression.pickUpItem(e2);
    this.flyerSystem = new FlyerSystem(this.physics, { items: this.flyers, cfg: FLYER_CFG, rng: () => this.rng(), Vec2, CircleShape, effects: this.effects, onSfx: (name) => { switch (name) { case `flyerBomb`: snd(`flyerBomb`); break; case `flyerDive`: snd(`flyerDive`); break; case `flyerHurt`: snd(`flyerHurt`); break; case `flyerDie`: snd(`flyerDie`); break; case `flyerPop`: snd(`flyerPop`); break; default: snd(name); } }, onBomb: (pos, vel, f) => this.spawnFlyerBomb(pos, vel, f), onPlayerHit: (pos, dmg, f) => this.damagePlayerFromFlyer(pos, dmg, f), onXp: (f, mul) => this.awardFlyerXp(f, mul), onDamageRagdoll: (r, dmg, pos) => this.damageFlyerRagdoll(r, dmg, pos) }), this.flyers.length = 0;
    this.throwAnim = null, this.throwTrail = [], this.coinDrops = [], this.pendingCoins = 0, this.buildDrag = null, this.projectiles = [], this.enemies = [], this.ais.clear(), this.flyers.length = 0, this.director.reset(), this.bossScheduler.reset(), this.boss = null, this.bossWarningTimer = 0, this.bossWarningText = '', this.bossZoneIds.clear(), this.bossCalloutTimer = 0, this.bossCalloutText = '', this.pickupBanner = null, this.hitMarkers.length = 0, this.vignetteTimer = 0, this.vignetteAlpha = 0, this.playerExclamationTimer = 0, this.walkers.clear(), this.getUpWait.clear(), this.combo.break(), this.levelup.reset(), this.levelupOffer = [], this.leechAcc = 0, this.leechTextAt = -1, this.nextId = 1, this.player = this.spawnRagdoll(`player`, 1, ARENA_CFG.playerSpawnX, COMBAT_CFG.playerMaxHp), this.applyPlayerStats(), this.mode === `endless` && (this.endlessStartX = this.player.torsoPosition().x, this.endlessDist = 0, this.vitals.reset(this.player.hp)), this.player.autoRecover = true, this.player.onGetUp = () => { let e2 = this.player.torsoPosition(); this.effects.ring(e2.x, e2.y - 0.7, `#ffffff`, 10), this.effects.text(e2.x, e2.y + 0.5, `UP!`, `#ffffff`), this.combat.trauma = Math.min(0.5, this.combat.trauma + 0.07), snd(`getUp`, { x: e2.x }); }, this.drag = null, this.shotCooldown = 0, this.aimHold = 0, this.lastAimPhi = null, this.accumulator = 0, this.slowMo = 0;
  }
  findTowerDoor() {
    if (this.mode !== `endless` || !this.arena || !this.arena.features || !this.player) return null;
    const p = this.player.torsoPosition();
    let best = null, bestDx = 1.2;
    for (const [chunkIndex, ft] of this.arena.features) {
      if (ft.type !== `tower` || !Number.isFinite(ft.doorX)) continue;
      const dx = Math.abs(p.x - ft.doorX);
      if (dx <= bestDx) { bestDx = dx; best = { chunkIndex, door: { x: ft.doorX, y: 0 } }; }
    }
    return best;
  }
  interact() {
    if (this.screen !== `run` || this.overlay !== `hud` || this.paused || this.mode !== `endless`) return false;
    if (this.interior) {
      const p = this.player.torsoPosition();
      if (!inDoorZone(this.interior.def, p.x, p.y)) return false;
      return this.exitInterior();
    }
    const found = this.findTowerDoor();
    return found ? this.enterInterior(found.chunkIndex, found.door) : false;
  }
  clearTransient() {
    this.throwTrail = [];
    this.projectiles = [];
    this.hitMarkers.length = 0;
    this.vignetteTimer = 0;
    this.vignetteAlpha = 0;
    this.playerExclamationTimer = 0;
    this.bossCalloutTimer = 0;
    this.bossCalloutText = '';
    if (this.effects) {
      for (const p of this.effects.particles) p.alive = false;
      for (const t of this.effects.texts) t.alive = false;
      this.effects.shockwaves = [];
      this.effects.beams = [];
      this.effects.screenFlash = 0;
    }
  }
  enterInterior(chunkIndex, door) {
    if (this.interior || this.mode !== `endless`) return false;
    this.clearTransient();
    const seed = ((chunkIndex * 73856093) ^ (this.arena.seed >>> 0)) >>> 0;
    const def = createInterior(`warehouse`, seed, { weaponIds: WEAPONS.filter((w2) => w2.id !== `hands`).map((w2) => w2.id) });
    const physics = new PhysicsWorld();
    const iArena = Object.create(Arena.prototype);
    iArena.mode = `interior`, iArena.solids = [], iArena.objects = [], iArena.terrain = physics.world.createBody({ type: `static`, position: { x: 0, y: 0 } });
    for (const s of interiorSolids(def)) iArena.addBox(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, { kind: `platform` }, 0.8);
    const outside = { physics: this.physics, player: this.player };
    const player = new Ragdoll(physics, { id: 1, team: `player`, facing: 1, x: def.spawn.x, groundY: 0, maxHp: outside.player.maxHp });
    player.hp = outside.player.hp, player.autoRecover = true, player.onGetUp = outside.player.onGetUp, player.incomingMul = outside.player.incomingMul, player.speedMul = outside.player.speedMul;
    const session = this.interiorSessions.has(chunkIndex) ? InteriorSession.restore(this.interiorSessions.get(chunkIndex)) : new InteriorSession(def, { chunkIndex, seed, door });
    this.interior = { chunkIndex, def, physics, arena: iArena, player, session, door: { x: door.x, y: door.y }, outside, fade: 1 };
    this.physics = physics, this.player = player, this.doorFade = 1, this.interiorHintTimer = 0;
    snd(`door`);
    return true;
  }
  exitInterior() {
    if (!this.interior) return false;
    const it = this.interior;
    this.interiorSessions.set(it.chunkIndex, it.session.snapshot());
    this.physics = it.outside.physics, this.player = it.outside.player;
    this.placeRagdoll(this.player, it.door.x, 0);
    it.player.destroy(it.physics), it.physics.removeBody(it.arena.terrain), it.physics.flush();
    this.interior = null, this.doorFade = 1, this.interiorHintTimer = 0, this.clearTransient();
    snd(`doorClose`);
    return true;
  }
  placeRagdoll(r2, x2, groundY) {
    for (let p2 of r2.parts.values()) {
      let c2 = p2.spec.center, px = x2 + c2.x, py = groundY + 0.04 + c2.y;
      p2.body.setTransform({ x: px, y: py }, 0), p2.body.setLinearVelocity({ x: 0, y: 0 }), p2.body.setAngularVelocity(0);
      p2.prevX = px, p2.prevY = py, p2.prevA = 0;
    }
    r2.slide = false, r2.slideV = 0, r2.moveAxis = 0;
  }
  showPickupBanner(caption, title, sub, color) {
    this.pickupBanner = { caption, title, sub, color, age: 0, life: 4 };
  }
  fixedInterior(e2) {
    const it = this.interior;
    this.syncPlayerMoveAxis(), this.physics.refreshContacts([this.player]), this.player.update(e2);
    // Jump bookkeeping must run inside the building too (it normally lives in the outside fixedUpdate): stamina regenerates and the air jump is restored on landing, otherwise the player can no longer jump after a few hops.
    this.stamina = Math.min(STAMINA_CFG.max, this.stamina + STAMINA_CFG.regen * e2), this.staminaFlash = Math.max(0, this.staminaFlash - e2), this.player.grounded && (this.airJumpUsed = false);
    this.physics.step(e2), this.physics.drain(), this.physics.flush(), this.effects.update(e2);
    const p2 = this.player.torsoPosition(), idx = it.session.collect(p2.x, p2.y, 0.9);
    if (idx >= 0) {
      const loot = it.def.loot[idx];
      this.progression.earnCoins(1), snd(`coin`), this.effects.text(loot.x, loot.y + 0.6, `+1`, `#ffd23f`);
    }
    const pidx = it.session.collectPickup(p2.x, p2.y, 1.25);
    if (pidx >= 0) {
      const pk = it.def.pickups[pidx];
      if (pk.kind === `weapon`) {
        const w2 = weaponById(pk.weaponId);
        if (this.progression.isOwned(pk.weaponId)) {
          this.progression.earnCoins(40), this.effects.text(pk.x, pk.y + 0.6, `+40 COINS (already owned)`, `#ffd23f`, 18), this.showPickupBanner(`BONUS`, `+40 COINS`, `${w2.name} - you already own it`, `#ffd23f`);
        } else {
          this.progression.grantRunWeapon(pk.weaponId), this.effects.text(pk.x, pk.y + 0.6, `FOUND: ${w2.name}!`, w2.color, 20), this.showPickupBanner(`NEW WEAPON!`, w2.name, `Equipped for this run - tap the weapon button to switch`, w2.color);
        }
        snd(`pickup`), this.effects.ring(pk.x, pk.y, w2.color, 10);
      } else {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + pk.amount);
        snd(`heal`), this.effects.text(pk.x, pk.y + 0.6, `+${pk.amount} HP`, `#3fd16b`, 20), this.effects.ring(pk.x, pk.y, `#3fd16b`, 10), this.showPickupBanner(`HEALED`, `+${pk.amount} HP`, `Health pack from the building`, `#3fd16b`);
      }
    }
    it.fade = Math.max(0, it.fade - e2 / 0.35);
    this.interiorHintTimer -= e2;
    if (inDoorZone(it.def, p2.x, p2.y)) {
      const hasExitHint = this.effects.texts.some((t) => t.alive && t.text === `E - exit`);
      if (!hasExitHint) this.effects.text(p2.x, p2.y + 1.9, `E - exit`, `#ffd23f`, 18);
      this.interiorHintTimer = 0.3;
    } else this.interiorHintTimer = 0;
  }
  playMode(e2) {
    this.mode = e2, this.startRun();
  }
  /** Submit the run in progress (once) to the records of ITS mode. Called on game over, restart and when leaving to the main menu. */
  commitRun() {
    if (this.runCommitted || this.screen !== `run`) return [];
    this.runCommitted = true;
    let e2 = this.mode === `endless` ? { dist: Math.floor(this.endlessDist), time: Math.floor(this.director.time), score: this.progression.score, kills: this.progression.kills } : { wave: this.progression.wave, score: this.progression.score, kills: this.progression.kills };
    return this.records.submit(this.mode, e2);
  }
  toMainMenu() {
    this.commitRun(), this.urlMode === null && (this.mode = `platform`), this.buildWorld(), this.screen = `menu`, this.paused = false, this.phase = `playing`, this.audio.setMusic(`menu`), this.audio.setPaused(false), this.setOverlay(`menu`), this.refreshMenu();
  }
  refreshMenu() {
    this.ui.showMenu({ coins: this.progression.coins, weaponId: this.progression.equipped, weaponName: this.progression.weapon.name, fortressPieces: this.progression.layout.length, bestEndless: this.records.describe(`endless`), bestPlatform: this.records.describe(`platform`) });
  }
  startRun() {
    this.commitRun(), this.runCommitted = false, this.buildWorld(), this.progression.startRun(), this.screen = `run`, this.paused = false, this.phase = `playing`, this.phaseTimer = 0, this.shopBonus = 0, this.hintShown = true, this.stamina = STAMINA_CFG.max, this.airJumpUsed = false, this.playerAirTime = 0, this.lastDirectorLevel = this.director.level(), this.audio.setMusic(this.mode), this.audio.setPaused(false), this.mode === `endless` ? (this.waveKills = 0, this.waveSpawned = 0) : this.startWave(), this.setOverlay(`hud`), this.ui.showHint();
  }
  setOverlay(e2) {
    this.overlay = e2, e2 !== `hud` && this.clearHeldKeys(), this.ui.showOverlay(e2);
  }
  setupTouchPad() {
    let e2 = window.matchMedia ? window.matchMedia(`(pointer: coarse)`) : null;
    let t2 = () => {
      let n2 = !!(e2 && e2.matches) || location.search.includes(`touch`);
      this.movePad.hidden = !n2, n2 || this.clearHeldKeys();
    };
    t2(), e2 && e2.addEventListener && e2.addEventListener(`change`, t2);
    for (let [n2, r2] of [[this.moveLeftBtn, `touchLeft`], [this.moveRightBtn, `touchRight`]]) {
      let i2 = (e3) => {
        e3.preventDefault(), n2.classList.add(`is-down`), this.keys.add(r2);
        try {
          n2.setPointerCapture(e3.pointerId);
        } catch {
        }
      }, s2 = () => {
        n2.classList.remove(`is-down`), this.keys.delete(r2);
      };
      n2.addEventListener(`pointerdown`, i2);
      for (let a2 of [`pointerup`, `pointercancel`, `lostpointercapture`, `pointerleave`]) n2.addEventListener(a2, s2);
    }
  }
  clearHeldKeys() {
    this.keys.clear(), this.moveLeftBtn && this.moveLeftBtn.classList.remove(`is-down`), this.moveRightBtn && this.moveRightBtn.classList.remove(`is-down`);
  }
  isTypingTarget(e2) {
    return e2 && (e2.tagName === `INPUT` || e2.tagName === `TEXTAREA` || e2.isContentEditable);
  }
  openSound() {
    if (this.overlay !== `sound`) this.soundFrom = this.overlay;
    this.setOverlay(`sound`), this.syncSoundPanel();
  }
  closeSound() {
    let e2 = this.screen === `run` && this.soundFrom === `pause` ? `pause` : this.soundFrom === `menu` ? `menu` : `hud`;
    this.setOverlay(e2), e2 === `menu` && this.refreshMenu();
    this.audio.setIntensity(0), this.audio.setMusic(this.screen === `run` ? this.mode : `menu`);
  }
  toggleSoundMute() {
    this.audio.toggleMute(), this.syncSoundPanel();
    let e2 = this.player ? this.player.torsoPosition() : { x: 0, y: 0 };
    this.effects.text(e2.x, e2.y + 1, this.audio.settings.muted ? `Sound off` : `Sound on`, `#d6ff8a`);
  }
  onCameraShake() {
    const modes = [`normal`, `low`, `off`];
    const current = this.camera.shakeMode;
    const idx = modes.indexOf(current);
    const next = modes[(idx + 1) % modes.length];
    this.setCameraShake(next);
  }
  setCameraShake(e2) {
    const modes = [`normal`, `low`, `off`];
    if (!modes.includes(e2)) return;
    this.camera.shakeMode = e2;
    try {
      localStorage.setItem(`slipshot.camera.v1`, JSON.stringify({ shake: e2, zoom: this.camera.zoom }));
    } catch {}
    this.syncSoundPanel();
  }
  testSound(e2) {
    if (e2 && e2.startsWith(`music:`)) { this.audio.setIntensity(0.5), this.audio.setMusic(e2.slice(6)); return; } // audition a track
    e2 && snd(e2, { x: this.camera.x });
  }
  setSoundVolume(e2, t2) {
    this.audio.setVolume(e2, t2 / 100);
  }
  syncSoundPanel() {
    let e2 = this.ui;
    if (e2.sndMusic) e2.sndMusic.value = Math.round(this.audio.settings.music * 100);
    if (e2.sndSfx) e2.sndSfx.value = Math.round(this.audio.settings.sfx * 100);
    if (e2.sndMute) e2.sndMute.textContent = this.audio.settings.muted ? `Unmute sound` : `Mute sound`;
    if (e2.sndCameraShake) e2.sndCameraShake.textContent = `Camera shake: ${this.camera.shakeMode.charAt(0).toUpperCase() + this.camera.shakeMode.slice(1)}`;
    if (e2.sndTest && !e2.sndTest.childElementCount) for (let t2 of [`music:menu`, `music:endless`, `music:platform`, `music:off`, ...this.audio.names]) {
      let n2 = document.createElement(`button`);
      n2.type = `button`, n2.className = `btn small`, n2.dataset.act = `sound-test`, n2.dataset.id = t2, n2.textContent = t2, e2.sndTest.appendChild(n2);
    }
  }
  moveAxisFromKeys() {
    let e2 = (this.keys.has(`a`) || this.keys.has(`A`) || this.keys.has(`ArrowLeft`) || this.keys.has(`touchLeft`) ? -1 : 0) + (this.keys.has(`d`) || this.keys.has(`D`) || this.keys.has(`ArrowRight`) || this.keys.has(`touchRight`) ? 1 : 0);
    return clamp(e2, -1, 1);
  }
  syncPlayerMoveAxis() {
    this.overlay === `hud` && this.phase === `playing` && !this.paused && this.player.alive ? this.player.moveAxis = this.moveAxisFromKeys() : (this.player.moveAxis = 0, this.clearHeldKeys());
  }
  togglePause() {
    this.screen === `run` && (this.overlay === `pause` ? this.resume() : this.overlay === `hud` && (this.phase === `playing` || this.phase === `clearing`) && this.openPause());
  }
  openPause() {
    this.screen === `run` && this.overlay === `hud` && (this.phase === `playing` || this.phase === `clearing`) && (this.ui.pauseBuildBtn.classList.toggle(`hidden`, this.mode === `endless`), this.ui.pauseMode.textContent = this.mode === `endless` ? `Endless Survival` : `Platform Mode`, this.paused = true, this.drag = null, this.audio.setPaused(true), snd(`pause`), this.setOverlay(`pause`));
  }
  resume() {
    this.overlay === `pause` && (this.paused = false, this.audio.setPaused(false), snd(`resume`), this.setOverlay(`hud`));
  }
  openCatalog(e2, t2) {
    this.catalogFrom = e2, this.catalogTab = t2, this.setOverlay(`catalog`), this.renderCatalog();
  }
  openShop() {
    this.phase = `shop`, this.shopBonus = this.progression.waveBonusCoins(), this.progression.earnCoins(this.shopBonus), this.player.hp = Math.min(this.player.maxHp, this.player.hp + COMBAT_CFG.healOnWaveClear), snd(`door`), this.openCatalog(`shop`, `weapons`);
  }
  setCatalogTab(e2) {
    this.catalogTab = e2, this.renderCatalog();
  }
  closeCatalog() {
    this.overlay === `catalog` && (this.catalogFrom === `build` ? (this.setOverlay(`build`), this.renderBuild()) : this.catalogFrom === `shop` ? this.nextWave() : this.catalogFrom === `pause` ? this.setOverlay(`pause`) : (this.setOverlay(`menu`), this.refreshMenu()));
  }
  nextWave() {
    this.phase === `shop` && (snd(`doorClose`), this.progression.wave++, this.startWave(), this.setOverlay(`hud`));
  }
  fortressModel() {
    let e2 = this.progression;
    return { canPlace: this.catalogFrom !== `build`, items: FORTRESS_ITEMS.map((t2) => ({ id: t2.id, name: t2.name, blurb: t2.blurb, color: t2.color, hp: t2.hp, price: t2.price, unlock: t2.unlock, unlocked: e2.isUnlocked(t2.id), canUnlock: e2.canUnlockItem(t2.id), canBuy: e2.canBuyItem(t2.id), owned: e2.itemCount(t2.id), placed: e2.placedCount(t2.id), maxPlaced: t2.maxPlaced })) };
  }
  unlockItem(e2) {
    this.overlay === `catalog` && (this.progression.unlockItem(e2), this.renderCatalog());
  }
  buyItem(e2) {
    this.overlay === `catalog` && (this.progression.buyItem(e2), this.renderCatalog());
  }
  catalogModel() {
    let e2 = this.progression, t2 = this.catalogFrom === `shop`;
    return { from: this.catalogFrom, tab: this.catalogTab, coins: e2.coins, wave: e2.wave, bonus: this.shopBonus, equipped: e2.equipped, fortress: this.fortressModel(), weapons: WEAPONS.map((t3) => ({ id: t3.id, name: t3.name, blurb: t3.blurb, badge: t3.badge, color: t3.color, price: t3.price, owned: e2.isOwned(t3.id), equipped: e2.equipped === t3.id, canBuy: !e2.isOwned(t3.id) && e2.coins >= t3.price, power: Math.min(1, t3.shot.damageMul * t3.shots / 2.2), rate: Math.min(1, 0.45 / (t3.cooldown * e2.reloadMultiplier)), speed: Math.min(1, t3.speedMul / 1.6) })), upgrades: UPGRADES.map((t3) => ({ id: t3.id, name: t3.name, blurb: t3.blurb, level: e2.levels[t3.id], cap: 5, cost: e2.upgradeCost(t3.id), canBuy: e2.canUpgrade(t3.id) })), repair: { cost: Zo.price, heal: Zo.heal, canBuy: t2 && e2.coins >= Zo.price && this.player.hp < this.player.maxHp }, showKit: t2 };
  }
  renderCatalog() {
    this.ui.showCatalog(this.catalogModel());
  }
  buyWeapon(e2) {
    this.overlay === `catalog` && (this.progression.buyWeapon(e2) && this.progression.equipWeapon(e2), this.renderCatalog());
  }
  equipWeapon(e2) {
    this.overlay === `catalog` && (this.progression.equipWeapon(e2), this.renderCatalog());
  }
  buyUpgrade(e2) {
    this.overlay === `catalog` && (this.progression.buyUpgrade(e2) && this.applyPlayerStats(), this.renderCatalog());
  }
  buyRepair() {
    this.overlay === `catalog` && this.catalogFrom === `shop` && (this.progression.buyRepairKit() && (this.player.hp = Math.min(this.player.maxHp, this.player.hp + Zo.heal)), this.renderCatalog());
  }
  cycleWeapon() {
    this.overlay === `hud` && this.progression.cycleWeapon();
  }
  resetProfile() {
    window.confirm(`Erase all coins, weapons and upgrades?`) && (this.progression.resetProfile(), this.toMainMenu());
  }
  applyPlayerStats() {
    this.applyRunStats();
    let e2 = this.progression, t2 = COMBAT_CFG.playerMaxHp + e2.maxHpBonus + this.runStats.maxHpBonus, n2 = Math.max(0, t2 - this.player.maxHp);
    this.player.maxHp = t2, this.player.hp = Math.min(t2, this.player.hp + n2), this.player.incomingMul = e2.incomingMultiplier * this.runStats.damageTakenMul, this.player.slipResist = e2.slipResist, this.player.staggerMul = e2.staggerMultiplier;
    this.mode === `endless` && (this.player.incomingMul *= ENDLESS_CFG.playerDamageMul);
  }
  applyRunStats() {
    this.runStats = this.levelup.stats(), this.player && (this.player.speedMul = this.runStats.moveSpeedMul);
  }
  awardXp(e2) {
    if (this.mode !== `endless` || this.screen !== `run` || !(e2 > 0)) return null;
    let t2 = this.levelup.addXp(e2);
    return t2.gained > 0 && this.openLevelUp(), t2;
  }
  openLevelUp() {
    if (this.mode !== `endless` || this.screen !== `run` || this.levelup.pending <= 0 || !this.player.alive || this.phase === `dying` || this.phase === `gameover`) return false;
    if (this.overlay === `levelup`) return true;
    if (this.overlay !== `hud`) return false;
    return this.paused = true, this.drag = null, this.audio.setPaused(true), snd(`levelUp`), this.setOverlay(`levelup`), this.renderLevelUp(), true;
  }
  renderLevelUp() {
    this.levelupOffer = this.levelup.offer(3).map((e2) => {
      let t2 = UPGRADE_DEFS.find((n2) => n2.id === e2.id);
      return { ...e2, blurb: t2 ? t2.levelText(e2.nextLevel) : e2.blurb, level: Math.max(0, e2.nextLevel - 1), isNew: e2.nextLevel === 1 };
    }), this.ui.showLevelUp({ level: this.levelup.level, cards: this.levelupOffer });
  }
  chooseUpgrade(e2) {
    if (this.overlay !== `levelup` || !e2 || this.levelup.pick(e2) === null) return false;
    let t2 = this.player.torsoPosition();
    if (e2 === `heal`) {
      let n2 = Math.min(this.player.maxHp * LEVELUP_CFG.healFraction, this.player.maxHp - this.player.hp);
      this.player.hp += n2, this.effects.text(t2.x, t2.y + 0.8, `+${Math.round(n2)}`, `#7bed9f`), snd(`heal`, { x: t2.x });
    } else if (e2 === `coins`)
      this.progression.earnCoins(LEVELUP_CFG.coinBonus), this.effects.text(t2.x, t2.y + 0.8, `+${LEVELUP_CFG.coinBonus}`, `#ffe066`), snd(`coin`);
    else
      this.applyPlayerStats(), snd(`upgrade`);
    if (this.levelup.pending > 0) this.renderLevelUp();
    else this.paused = false, this.audio.setPaused(false), this.levelupOffer = [], this.setOverlay(`hud`);
    return true;
  }
  onPlayerProjectileHit(e2, t2, n2, r2) {
    let i2 = this.runStats, a2 = n2;
    if (i2.critChance > 0 && this.rng() < i2.critChance)
      a2 = n2 * i2.critMul, this.effects.text(r2.x, r2.y + 1.1, `CRIT!`, `#ffd23f`, 26), snd(`critHit`, { x: r2.x });
    if (i2.lifesteal > 0 && this.player.alive) {
      let o2 = Math.min(a2 * t2.incomingMul * i2.lifesteal, this.player.maxHp - this.player.hp);
      if (o2 > 0 && (this.player.hp += o2, this.leechAcc += o2, this.time - this.leechTextAt >= 0.5 && this.leechAcc >= 0.5)) {
        let s2 = this.player.torsoPosition();
        this.leechTextAt = this.time, this.effects.text(s2.x, s2.y + 0.8, `+${Math.round(this.leechAcc)}`, `#7bed9f`), this.leechAcc = 0;
      }
    }
    return a2;
  }
  frame(t2) {
    let r2 = this.lastFrame === null ? 0 : clamp((t2 - this.lastFrame) / 1e3, 0, PHYS_CFG.maxFrameDt);
    this.lastFrame = t2, this.time += r2, this.pickupBanner && !this.paused && (this.pickupBanner.age += r2) >= this.pickupBanner.life && (this.pickupBanner = null), advanceSndClock(r2), this.doorFade = Math.max(0, this.doorFade - r2 / 0.4), this.audio.setListener(this.camera.x);
    let i2 = this.combat.consumeHitstop(r2), a2 = this.slowMo > 0 ? lerp(Vc, 1, 1 - this.slowMo / Bc) : 1;
    this.slowMo = Math.max(0, this.slowMo - (r2 - i2));
    let o2 = (r2 - i2) * a2;
    if (this.screen === `run` && !this.paused) for (this.accumulator += o2; this.accumulator >= PHYS_CFG.fixedDt; ) this.snapshotAll(), this.fixedUpdate(PHYS_CFG.fixedDt), this.accumulator -= PHYS_CFG.fixedDt;
    else this.accumulator = 0, this.overlay === `build` && (this.effects.update(r2), this.fortress.animate(r2));
    let s2 = this.accumulator / PHYS_CFG.fixedDt;
    this.screen === `run` && this.overlay === `hud` && !this.paused && this.levelup.pending > 0 && this.openLevelUp();
    if (this.updateAim(), this.camera.addTrauma(this.combat.trauma), this.combat.trauma = 0, this.camera.frame(r2, this.cameraTargets(), this.interior ? this.interior.def : null), this.renderer.draw(this.scene(s2)), this.screen === `run`) {
      let e2 = this.progression.waveQuota();
      let n5 = { hp: this.player.hp, maxHp: this.player.maxHp, wave: this.progression.wave, score: this.progression.score, coins: this.progression.coins - this.pendingCoins, weaponId: this.progression.equipped, weaponName: this.progression.weapon.name, progress: e2 > 0 ? this.waveKills / e2 : 0, stamina: this.stamina, maxStamina: STAMINA_CFG.max, staminaFlash: this.staminaFlash > 0, combo: this.combo.count, comboTime: this.combo.fraction, canGetUp: this.player.isDown() && this.player.downTime > 0.12 };
      this.mode === `endless` && (n5.label = `LV ${this.director.level()} \xB7 ${Math.floor(this.endlessDist)} m`, n5.progress = (this.director.time % ENDLESS_CFG.levelEvery) / ENDLESS_CFG.levelEvery, n5.hideBuild = true, n5.xp = { level: this.levelup.level, fraction: this.levelup.fraction });
      this.ui.setHud(n5);
    }
  }
  snapshotAll() {
    if (this.interior) { this.player.snapshot(); return; }
    for (let e2 of this.allRagdolls()) e2.snapshot();
    for (let e2 of this.arena.objects) e2.snapshot();
    this.fortress.snapshot(), this.slime.snapshot();
    for (let e2 of this.projectiles) e2.snapshot();
  }
  difficulty() {
    return this.mode === `endless` ? this.director.level() : this.progression.wave;
  }
  gameOverText() {
    if (this.mode !== `endless`) return `Reached wave ${this.progression.wave} \xB7 Score ${this.progression.score} \xB7 ${this.progression.kills} KO`;
    let e2 = Math.floor(this.director.time);
    return `Survived ${Math.floor(e2 / 60)}:${String(e2 % 60).padStart(2, `0`)} \xB7 ${Math.floor(this.endlessDist)} m \xB7 ${this.progression.kills} KO \xB7 Score ${this.progression.score}`;
  }
  fixedUpdate(e2) {
    if (this.interior) { this.fixedInterior(e2); return; }
    this.interiorHintTimer -= e2;
    if (this.phase === `playing` && this.overlay === `hud` && !this.paused) {
      const near = this.findTowerDoor();
      if (near) {
        const hasEnterHint = this.effects.texts.some((t) => t.alive && t.text === `E - enter`);
        if (!hasEnterHint) {
          const pp = this.player.torsoPosition();
          this.effects.text(pp.x, pp.y + 1.9, `E - enter`, `#ffd23f`, 18);
        }
        this.interiorHintTimer = 0.3;
      } else this.interiorHintTimer = 0;
    }
    let px0 = this.player.torsoPosition().x;
    if (this.screen === `run` && this.phase === `playing`) {
      this.audio.setIntensity(this.mode === `endless` ? clamp(0.12 * (this.director.level() - 1) + 0.12 * this.enemies.filter((e3) => e3.alive).length, 0, 1) : clamp(0.1 * (this.progression.wave - 1), 0, 1));
      if (this.mode === `endless`) {
        let e5 = this.director.level();
        e5 > this.lastDirectorLevel && snd(`levelUp`), this.lastDirectorLevel = e5;
        let nearest = null, dist = 1 / 0;
        for (let obj of this.arena.objects) {
          let t5 = Math.abs(obj.body.getPosition().x - px0);
          t5 < dist && (dist = t5, nearest = obj);
        }
        this.audio.setRoll(nearest ? clamp(1 - dist / 25, 0, 1) : 0, nearest ? nearest.body.getPosition().x : px0);
      } else this.audio.setRoll(0, px0);
    }
    this.mode === `endless` && this.arena.updateEndless(this.player.torsoPosition().x);
    if (this.mode === `endless` && this.phase === `playing`) {
      this.vitals.update(e2, this.player, this.runStats), this.runStats.regenPerSec > 0 && this.player.alive && this.player.hp > (this.lastRegenHp ?? this.player.hp) && this.player.hp < this.player.maxHp && snd(`regenTick`), this.lastRegenHp = this.player.hp, this.endlessDist = Math.max(this.endlessDist, Math.abs(this.player.torsoPosition().x - this.endlessStartX));
      const aliveEnemies = this.enemies.filter((e4) => e4.alive);
      const aliveXs = aliveEnemies.map((e4) => e4.torsoPosition().x);
      let n4 = this.director.update(e2, { playerX: this.player.torsoPosition().x, aliveXs, ragdollCount: this.allRagdolls().length });
      if (this.director.hordeAlert) {
        this.director.hordeAlert = false;
        this.effects.text(this.player.torsoPosition().x, 4.4, `HORDE INCOMING!`, `#ff3344`, 34);
        snd(`hordeAlarm`);
      }
      // Cap normal enemies at 2 while boss is alive
      if (n4 && this.boss && aliveEnemies.length >= 2) {
        n4 = null;
      }
      n4 && this.spawnEndlessEnemy(n4);
      let r4 = this.director.updateRoller(e2, { playerX: this.player.torsoPosition().x, rollerCount: this.arena.objects.length });
      r4 && this.spawnRoller(r4);
      if (!this.interior) {
        let f4 = this.director.updateFlyers(e2, { playerX: this.player.torsoPosition().x, flyerCount: this.flyerSystem.countAlive(), bossAlive: !!this.boss, inside: false });
        f4 && this.spawnFlyer(f4);
      }
      // Boss scheduler
      const inside = !!this.interior;
      const bossSpawn = this.bossScheduler.update(e2, { directorTime: this.director.time, bossAlive: !!this.boss, inside });
      if (bossSpawn?.spawn) this.spawnBoss(bossSpawn.tier);
    }
    this.syncPlayerMoveAxis(), this.physics.refreshContacts(this.allRagdolls()), this.combo.update(e2), this.shotCooldown = Math.max(0, this.shotCooldown - e2), this.aimHold = Math.max(0, this.aimHold - e2), this.throwAnim ? this.updateThrow(e2) : this.aimActive && this.aimDir ? this.player.setAim(dirToAimAngle2(this.aimDir)) : this.aimHold > 0 ? this.player.setAim(this.lastAimPhi) : this.player.setAim(null);
    for (let t3 of this.throwTrail) t3.age += e2;
    this.throwTrail = this.throwTrail.filter((e3) => e3.age < 0.2);
    let t2 = this.fortress.standing.find((e3) => e3.def.id === `duck`), r2 = t2 ? { x: t2.x, y: t2.y + t2.h * 0.25 } : null;
    for (let t3 of this.enemies) t3.alive && (this.phase === `playing` ? this.ais.get(t3)?.update(e2, this.player, this.difficulty(), (e3, t4, n2, r3) => {
      if (this.projectiles.length >= ENDLESS_CFG.maxProjectiles) return;
      if (this.mode !== `endless`) {
        this.spawnProjectile(e3, t4, n2, r3, Mc);
        return;
      }
      let weapon = weaponById(e3.weaponId ?? `squirt`), level = this.director.level();
      this.launchWeapon(e3, weapon, n2, r3, { shotDef: enemyWeaponShot(weapon, level), color: weapon.color, recoil: false });
    }, r2) : t3.setAim(null));
    this.phase === `playing` && this.updateCannons(e2), this.updateCoins(e2);
    if (this.mode === `endless` && this.phase === `playing`) for (let e4 of this.enemies) !e4.carriedBy && this.walkers.get(e4)?.update(e2, this.player, this.allRagdolls());
    // Update elemental statuses on enemies
    if (this.mode === `endless`) for (let e4 of this.enemies) if (e4.alive && e4.status) e4.status.update(e2, e4, {
      onFireTick: (target, dps, source) => {
        this.combat.damage(target, dps * e2, `torso`, target.torsoPosition(), { text: false, flash: false }), snd(`burnTick`, { x: target.torsoPosition().x });
        if (source && source.parts) {
          const torso = source.parts.get('torso');
          if (torso) this.effects.burst(torso.body.getPosition().x, torso.body.getPosition().y, ELEMENT_COLORS.fire, 2, 3, 0, 1);
        }
      },
      onFireEnd: (target) => {
        if (target.alive) {
          this.effects.burst(target.torsoPosition().x, target.torsoPosition().y, ELEMENT_COLORS.fire, 8, 5, 0, 1);
          this.effects.ring(target.torsoPosition().x, target.torsoPosition().y, ELEMENT_COLORS.fire, 6);
        }
      }
    });
    for (let t3 of this.allRagdolls()) t3.update(e2);
    this.updateEnemyRecovery(e2);
    for (let t3 of this.projectiles) t3.update(e2);
    for (let t3 of this.arena.objects) t3.update(e2);
    // Boss update
    if (this.boss && this.boss.alive) {
      const bossEvents = this.boss.update(e2, { x: this.player.torsoPosition().x, y: this.player.torsoPosition().y, alive: this.player.alive }, { groundY: (x) => this.arena.surfaceY(x) });
      for (const ev of bossEvents) this.handleBossEvent(ev);
      // Boss harm zones
      this.handleBossHarmZones(e2), this.applyBossPush(e2);
      // Player projectiles vs boss
      this.handlePlayerProjectilesVsBoss();
    }
    // Boss warning timer
    if (this.bossWarningTimer > 0) {
      this.bossWarningTimer -= e2;
      if (this.bossWarningTimer > 0) {
        const px = this.player.torsoPosition().x;
        const py = this.player.torsoPosition().y;
        this.effects.text(px, py + 2.5, this.bossWarningText, `#ff3344`, 28);
      }
    }
    // Boss call-out timer
    if (this.bossCalloutTimer > 0) this.bossCalloutTimer -= e2;
    // Player exclamation timer
    if (this.playerExclamationTimer > 0) this.playerExclamationTimer -= e2;
    // Hit markers timer
    for (let i = this.hitMarkers.length - 1; i >= 0; i--) {
      this.hitMarkers[i].life -= e2;
      if (this.hitMarkers[i].life <= 0) this.hitMarkers.splice(i, 1);
    }
    // Vignette timer
    if (this.vignetteTimer > 0) {
      this.vignetteTimer -= e2;
      if (this.vignetteTimer <= 0) this.vignetteAlpha = 0;
    }
    this.slime.update(e2), this.mechanics.update(e2, { projectiles: this.projectiles, ragdolls: this.allRagdolls().filter((e3) => e3.alive), objects: this.arena.objects, targetsFor: (e3) => e3.ownerId === 1 ? this.enemies : [this.player], ownerOf: (e3) => e3 === 1 ? this.player : this.enemies.find((t3) => t3.id === e3) ?? null, onFuse: (e3) => this.fuse(e3) }), this.stamina = Math.min(STAMINA_CFG.max, this.stamina + STAMINA_CFG.regen * e2), this.staminaFlash = Math.max(0, this.staminaFlash - e2), this.updateLanding(e2), this.grounded() && (this.airJumpUsed = false), this.fortress.update(e2), this.mode === `endless` && this.flyerSystem.update(e2, { player: this.player, arena: this.arena, enemies: this.enemies, ragdolls: this.allRagdolls(), objects: this.arena.objects, bossAlive: !!this.boss }), this.physics.step(e2);
    let { hits: i2, impacts: a2 } = this.physics.drain(), o2 = this.combatContext();
    for (let e3 of i2) this.combat.onProjectileHit(e3, o2);
    for (let e3 of a2) this.combat.onImpact(e3);
    this.combat.tickDrips(e2, this.allRagdolls()), this.resolveDeaths(), this.cleanup(), this.physics.flush(), this.effects.update(e2), this.advancePhase(e2);
  }
  fuse(e2) {
    if (!e2.alive || e2.consumed) return;
    e2.consumed = true;
    let t2 = { x: e2.position.x, y: e2.position.y };
    e2.destroy(this.physics), this.combat.explode(t2, e2.shot, e2.ownerId, this.combatContext());
  }
  leftArena(e2) {
    let n2 = e2.torsoPosition();
    return n2.y < ARENA_CFG.killY || (this.mode !== `endless` && Math.abs(n2.x) > ARENA_CFG.bounds) || n2.y > zc;
  }
  koBlast(e2) {
    let t2 = e2.torsoPosition();
    this.combat.hitstop = Math.max(this.combat.hitstop, 0.14), this.combat.trauma = Math.min(0.85, this.combat.trauma + 0.5), this.slowMo = Bc, this.effects.flash(0.6), this.effects.shockwave(t2.x, t2.y, `#eaffd9`, 3.2), this.effects.shockwave(t2.x, t2.y, No, 2.2, 0.6), this.effects.splatter(t2.x, t2.y, No, 36, 9), this.effects.burst(t2.x, t2.y + 0.2, `#ffe066`, 22, 7, 0, 1), this.effects.ring(t2.x, t2.y, `#ffffff`, 16), this.effects.text(t2.x, t2.y + 1.5, `KO!`, `#ffffff`, 40);
    let n2 = t2.x >= this.player.torsoPosition().x ? 1 : -1, r2 = { x: n2 * randRange(4, 6), y: randRange(6, 8) };
    for (let t3 of e2.parts.values()) {
      let e3 = t3.body.getMass();
      t3.body.applyLinearImpulse({ x: r2.x * e3, y: r2.y * e3 }, t3.body.getWorldCenter(), true);
    }
    e2.parts.get(`torso`)?.body.setAngularVelocity(n2 * randRange(-9, -6));
    let i2 = [...e2.parts.keys()];
    for (let t3 = 0; t3 < 4; t3++) {
      let t4 = i2[Math.floor(Math.random() * i2.length)], n3 = e2.parts.get(t4)?.body.getPosition();
      n3 && this.slime.addGum(e2, t4, n3, randRange(0.22, 0.34), SLIME_CFG.gumLife * 0.7);
    }
    this.slime.splat(t2, { x: 0, y: -1 }, 2.2, this.progression.coatDuration, this.allRagdolls(), this.arena.objects, e2);
  }
  resolveDeaths() {
    for (let e2 of this.enemies.slice()) if (e2.alive && (e2.hp <= 0 || this.leftArena(e2))) {
      const wasBurning = e2.status && e2.status.fire.active;
      const burnSource = wasBurning ? e2 : null;
      e2.kill(4);
      let t2 = this.combo.count, n2 = Math.round(this.progression.killCoins() * this.combo.coinMultiplier), r2 = Math.round(this.progression.killScore() * this.combo.scoreMultiplier);
      this.progression.score += r2, this.progression.kills++, this.progression.earnCoins(n2);
      if (this.mode === `endless`) {
        let a2 = this.vitals.onKo(this.player);
        if (this.runStats.healOnKill > 0 && this.player.alive) {
          let h2 = Math.min(this.runStats.healOnKill, this.player.maxHp - this.player.hp);
          h2 > 0 && (this.player.hp += h2, a2 += h2);
        }
        if (a2 > 0.5) {
          let o2 = this.player.torsoPosition();
          this.effects.text(o2.x, o2.y + 0.6, `+${Math.round(a2)}`, `#8dff5a`);
        }
        let s2 = Math.round(xpForKill({ kind: e2.isDropper ? `dropper` : `walker`, level: this.director.level() }) * (e2.isBrawler ? brawlerXpMul() : 1)), c2 = this.player.torsoPosition();
        this.effects.text(c2.x, c2.y + 1, `+${s2} XP`, `#c77dff`), this.awardXp(s2);
      }
      let i2 = e2.torsoPosition();
      if (this.effects.text(i2.x, i2.y + 0.6, t2 > 1 ? `KO +${n2} \xD7${t2}` : `KO +${n2}`, `#ffe066`), this.koBlast(e2), this.dropCoins(i2, n2), this.waveKills++, this.mode !== `endless` && this.waveSpawned < this.progression.waveQuota()) {
        let e3 = this.randomSpawnSpot(i2.x);
        this.waveSpawned++, this.spawnEnemyAt(e3.x, e3.topY);
      }
      if (wasBurning && burnSource) {
        this.effects.burst(i2.x, i2.y, ELEMENT_COLORS.fire, 12, 6, 0, 1);
        this.effects.ring(i2.x, i2.y, ELEMENT_COLORS.fire, 8);
        for (let other of this.enemies) if (other.alive && other !== e2 && other.status && !other.status.fire.active) {
          const dx = other.torsoPosition().x - i2.x;
          const dy = other.torsoPosition().y - i2.y;
          if (Math.hypot(dx, dy) <= ELEMENT_CFG.fire.spreadRadius && Math.random() < 0.5) {
            other.status.apply('fire', 1, other, this.rng);
          }
        }
      }
    }
    this.player.alive && (this.player.hp <= 0 || this.leftArena(this.player)) && (this.player.kill(2.5), this.phase = `dying`, this.phaseTimer = 1.6, this.drag = null);
  }
  updateEnemyRecovery(e2) {
    for (let t2 of this.enemies) {
      if (t2.carriedBy) {
        this.getUpWait.delete(t2);
        continue;
      }
      if (!t2.alive || !t2.isDown()) {
        this.getUpWait.delete(t2);
        continue;
      }
      if (t2.recovering) continue;
      let n2 = this.getUpWait.get(t2);
      if (n2 === void 0) {
        let e3 = Math.max(0.55, 1 - 0.05 * (this.difficulty() - 1));
        n2 = randRange(RECOVER_CFG.enemyDelayMin, RECOVER_CFG.enemyDelayMax) * e3;
      }
      if (n2 -= e2, n2 > 0) {
        this.getUpWait.set(t2, n2);
        continue;
      }
      if (this.getUpWait.set(t2, randRange(RECOVER_CFG.enemyRetryMin, RECOVER_CFG.enemyRetryMax)), !t2.kipUp()) continue;
      this.ais.get(t2)?.onRecovered();
      let i2 = t2.torsoPosition();
      this.effects.ring(i2.x, i2.y - 0.45, `#ffe066`, 10), this.effects.burst(i2.x, i2.y - 0.7, `#d9c7a0`, 7, 4, 0, 1), this.effects.text(i2.x, i2.y + 0.6, `HUP!`, `#ffe066`), this.combat.trauma = Math.min(0.5, this.combat.trauma + 0.05);
    }
  }
  updateLanding(e2) {
    if (!this.player.alive) {
      this.playerAirTime = 0;
      this.player.dropFall = false;
    } else if (!this.player.grounded) {
      this.playerAirTime += e2;
    } else {
      if (this.playerAirTime > 0.3) {
        let e3 = this.player.parts.get(`footL`).body.getPosition(), t2 = this.player.parts.get(`footR`).body.getPosition(), n2 = (e3.x + t2.x) / 2, r2 = Math.min(e3.y, t2.y);
        this.effects.burst(n2, r2, `#e6dcc6`, 9, 3.2, 0, 1), this.effects.ring(n2, r2, `#ffffff`, 5), this.combat.trauma = Math.min(0.45, this.combat.trauma + 0.03);
      }
      this.playerAirTime > 0.25 && snd(`land`, { x: this.player.torsoPosition().x, vol: clamp(this.playerAirTime / 0.9, 0.4, 1.4) });
      this.playerAirTime = 0;

      if (this.player.dropFall) {
        const dropHeight = 8;
        const startY = this.player.dropStartY ?? this.player.torsoPosition().y;
        const groundY = this.arena.surfaceY(this.player.torsoPosition().x);
        const fallDist = Math.max(0, startY - groundY);
        const dmgScale = clamp(fallDist / dropHeight, 0, 1);
        const dmg = Math.round(22 * dmgScale);
        if (dmg > 0) {
          this.combat.damage(this.player, dmg, `torso`, this.player.torsoPosition(), {});
        }
        this.player.dropFall = false;
        this.player.dropStartY = 0;
      }
    }
  }
  cleanup() {
    let r2 = this.mode === `endless` ? this.player.torsoPosition().x : 0;
    // Boss cleanup
    if (this.boss && !this.boss.alive) {
      this.boss = null;
      this.bossZoneIds.clear();
    }
    for (let e3 of this.projectiles) {
      if (!e3.alive) continue;
      let n2 = e3.position;
      (e3.life <= 0 || (this.mode === `endless` ? Math.abs(n2.x - r2) > ENDLESS_CFG.cullDistance : Math.abs(n2.x) > ARENA_CFG.bounds) || n2.y < Rc || n2.y > zc) && e3.destroy(this.physics);
    }
    this.projectiles = this.projectiles.filter((e3) => e3.alive);
    if (this.mode === `endless`) {
      for (let t3 of this.enemies.slice()) if (t3.alive && Math.abs(t3.torsoPosition().x - r2) > ENDLESS_CFG.enemyCull) t3.destroy(this.physics), this.combat.forget(t3), this.ais.delete(t3), this.walkers.delete(t3), this.getUpWait.delete(t3), this.enemies.splice(this.enemies.indexOf(t3), 1);
      for (let i4 = this.flyers.length - 1; i4 >= 0; i4--) {
        let f4 = this.flyers[i4];
        if (f4.alive && f4.body && Math.abs(f4.body.getPosition().x - r2) > FLYER_CFG.flyerCull) this.flyerSystem.despawn(f4);
      }
      if (this.allRagdolls().length > ENDLESS_CFG.maxRagdolls) {
        let e4 = null;
        for (let n4 of this.enemies) n4.state === `dead` && (!e4 || n4.corpseTimer < e4.corpseTimer) && (e4 = n4);
        e4 && (e4.corpseTimer = 0);
      }
    }
    for (let e3 of this.enemies.slice()) e3.state === `dead` && e3.corpseTimer <= 0 && (e3.destroy(this.physics), this.combat.forget(e3), this.ais.delete(e3), this.walkers.delete(e3), this.getUpWait.delete(e3), this.enemies.splice(this.enemies.indexOf(e3), 1));
    let e2 = this.arena.objects;
    for (let t2 = e2.length - 1; t2 >= 0; t2--) {
      let n2 = e2[t2].body.getPosition();
      (n2.y < -12 || (this.mode === `endless` && (Math.abs(n2.x - r2) > ENDLESS_CFG.rollerCull || this.director.time - e2[t2].bornAt > ENDLESS_CFG.rollerLife))) && (e2[t2].destroy(this.physics), e2.splice(t2, 1));
    }
  }
  advancePhase(e2) {
    switch (this.phase) {
      case `playing`:
        this.mode !== `endless` && this.waveKills >= this.progression.waveQuota() && this.enemies.every((e3) => !e3.alive) && (this.phase = `clearing`, this.phaseTimer = 1.4, snd(`waveClear`));
        break;
      case `clearing`:
        this.phaseTimer -= e2, this.phaseTimer <= 0 && this.openShop();
        break;
      case `dying`:
        if (this.phaseTimer -= e2, this.phaseTimer <= 0) {
          let t3 = this.commitRun();
          this.phase = `gameover`, t3.length && snd(`newBest`), snd(`gameOver`), this.audio.setMusic(`off`), this.setOverlay(`gameover`), this.ui.showGameOver(this.gameOverText(), this.records.recordText(t3));
        }
    }
  }
  startWave() {
    let e2 = Math.min(this.progression.enemyCount(), this.progression.waveQuota());
    this.waveKills = 0, this.waveSpawned = e2;
    let n2 = this.arena.islands.find((e3) => e3.home === `enemy`) ?? this.arena.islands[1];
    for (let r2 = 0; r2 < e2; r2++) this.spawnEnemyAt(ARENA_CFG.enemySpawnXs[r2] + randRange(-0.25, 0.25), n2.topY);
    this.phase = `playing`, this.effects.text(ARENA_CFG.playerSpawnX, 3.2, `WAVE ${this.progression.wave}`, `#ffffff`);
  }
  spawnEnemyAt(e2, t2) {
    let n2 = e2 < this.player.torsoPosition().x ? 1 : -1, r2 = this.spawnRagdoll(`enemy`, n2, e2, this.progression.enemyHp(), t2);
    this.enemies.push(r2), this.ais.set(r2, new EnemyAI(r2, this.arena, 1 + Math.random() * 0.8)), this.effects.beam(e2, t2, `#c77dff`), this.effects.shockwave(e2, t2 + 0.1, `#e6d4ff`, 1.6, 0.4), this.effects.ring(e2, t2 + 1.1, `#ffffff`, 10), this.combat.trauma = Math.min(0.5, this.combat.trauma + 0.05);
  }
  spawnEndlessEnemy(e2) {
    let o2 = this.arena.findSpawnX(e2.x);
    if (o2 === null) return this.director.timer = 0.5;
    let level = this.director.level(), t2 = o2 < this.player.torsoPosition().x ? 1 : -1, n2 = COMBAT_CFG.enemyBaseHp + COMBAT_CFG.enemyHpPerWave * (level - 1), r2 = this.spawnRagdoll(`enemy`, t2, o2, n2, e2.kind === `dropper` ? this.arena.surfaceY(e2.x) + ENDLESS_CFG.dropHeight : this.arena.surfaceY(o2));
    e2.kind !== `brawler` && (r2.weaponId = pickEnemyWeapon(level, this.enemies.filter((e3) => e3.alive && e3.weaponId).map((e3) => e3.weaponId), this.rng));
    e2.kind === `dropper` && (snd(`dropperSpawn`, { x: o2 }), r2.safeAir = LAND_CFG.maxAir, r2.landedFor = 0), r2.knockable = true, r2.isDropper = e2.kind === `dropper`, this.enemies.push(r2), this.ais.set(r2, new EnemyAI(r2, this.arena, 1 + Math.random() * 0.8, { weapon: e2.kind === `brawler` ? null : weaponById(r2.weaponId), level })), this.walkers.set(r2, r2.walker = new EnemyWalker(r2, { hold: e2.hold, speedMul: e2.speedMul })), e2.kind === `brawler` && configureBrawler(this, r2, (name, opts) => snd(name, opts));
  }
  spawnRoller(e2) {
    let n2 = this.arena.findSpawnX(e2.x);
    if (n2 === null) return;
    let t2 = new ArenaObject(this.physics, `ball`, n2, this.arena.surfaceY(n2) + e2.size + 0.01, e2.size, e2.mass);
    t2.bornAt = this.director.time, t2.body.setLinearVelocity({ x: -e2.side * e2.speed, y: 0 }), t2.body.setAngularVelocity(e2.side * e2.speed / e2.size), this.arena.objects.push(t2), snd(`boulderSpawn`, { x: n2 });
  }
  spawnFlyer(e2) {
    if (!e2 || !this.flyerSystem || this.mode !== `endless` || this.interior) return;
    let ground = this.arena.surfaceY(e2.x);
    this.flyerSystem.spawn(e2.type || `glider`, e2.x, ground + (e2.type === `hound` ? FLYER_CFG.hound.spawnHeight : (e2.height ?? 5)), { vx: -e2.side * 1.5 });
  }
  spawnFlyerBomb(pos, vel, f) {
    if (!pos || !vel || this.projectiles.length >= ENDLESS_CFG.maxProjectiles) return null;
    let p = new Projectile(this.physics, -1, { x: pos.x, y: pos.y }, { x: vel.x, y: vel.y }, FLYER_BOMB_SHOT, true);
    this.projectiles.push(p);
    return p;
  }
  damagePlayerFromFlyer(pos, dmg, f) {
    if (!this.player || !this.player.alive) return;
    this.combat.damage(this.player, dmg, `torso`, pos, {});
  }
  awardFlyerXp(f, mul) {
    if (!f) return;
    let xp = Math.max(1, Math.round(xpForKill({ kind: `walker`, level: this.director.level() }) * (mul || 1)));
    let p = this.player.torsoPosition();
    this.effects.text(p.x, p.y + 1, `+${xp} XP`, `#b56bff`);
    this.awardXp(xp);
  }
  damageFlyerRagdoll(r, dmg, pos) {
    if (!r || !r.alive) return;
    this.combat.damage(r, dmg, `torso`, pos, {});
  }
  spawnBoss(tier) {
    const playerX = this.player.torsoPosition().x;
    const side = this.rng() < 0.5 ? -1 : 1;
    const seed = (this.arena.seed ^ (this.bossScheduler.bossesDefeated * 7919)) >>> 0;
    const groundY = this.arena.surfaceY(playerX + side * 12);
    this.boss = new Boss({ x: playerX + side * 12, tier, seed, groundY });
    this.bossWarningTimer = 3;
    this.bossWarningText = `WARNING: ${this.boss.tierData.name}!`;
    this.combat.trauma = Math.min(1, this.combat.trauma + 0.3);
    snd(`bossWarning`, { x: playerX });
  }
  applyBossPush(dt) {
    if (!this.boss || !this.boss.alive || !this.boss.pushers) return;
    const ps = this.boss.pushers();
    let live = false;
    for (let i = 0; i < ps.length; i++) if (ps[i].r > 0) { live = true; break; }
    if (!live) return;
    const MAXV = 14, push = (body, mass, bodyR, scale, noKnock) => {
      const pos = body.getPosition();
      for (let i = 0; i < ps.length; i++) {
        if (!(ps[i].r > 0)) continue;
        const imp = bossPushImpulse(ps[i], pos.x, pos.y, mass, bodyR, dt);
        if (!imp) continue;
        if (noKnock) { const cv = noKnock.centerOfMass().vx; if (imp.x * cv > 0 && Math.abs(cv) > KNOCK_CFG.playerShoveSpeedMax) continue; }
        body.applyLinearImpulse({ x: imp.x * scale, y: imp.y * scale }, pos, true);
        const v = body.getLinearVelocity(), s = Math.hypot(v.x, v.y);
        s > MAXV && body.setLinearVelocity({ x: v.x * MAXV / s, y: v.y * MAXV / s });
      }
    };
    for (const rg of this.allRagdolls()) {
      if (!rg.alive) continue;
      const pl = rg.noKnockdown;
      for (const part of rg.parts.values()) push(part.body, part.spec.mass, 0.3, pl ? KNOCK_CFG.playerBlastScale : 1, pl ? rg : null);
    }
    for (const o of this.arena.objects) o.body && o.body.getType && o.body.getType() === `dynamic` && push(o.body, o.body.getMass() || 1, o.size ?? 0.5, 1, null);
    if (this.flyers) for (const f of this.flyers) f.alive && f.body && push(f.body, f.body.getMass() || 0.5, f.radius ?? 0.5, 1, null);
  }
  bossLandBlast(ev) {
    const R = ev.radius * 3.2, power = ev.power || 1, kick = (body, mass, scale) => {
      const pos = body.getPosition(), dx = pos.x - ev.x, dy = pos.y - ev.y, d = Math.hypot(dx, dy);
      if (!(d < R)) return;
      const fall = 1 - d / R, ux = d > 0.05 ? dx / d : 0, uy = Math.max(0.35, d > 0.05 ? dy / d : 1), l = Math.hypot(ux, uy) || 1, dv = Math.min(11, 9 * power * fall) * scale;
      body.applyLinearImpulse({ x: ux / l * dv * mass, y: uy / l * dv * mass }, pos, true);
    };
    for (const rg of this.allRagdolls()) {
      if (!rg.alive) continue;
      const pl = rg.noKnockdown;
      for (const part of rg.parts.values()) kick(part.body, part.spec.mass, pl ? KNOCK_CFG.playerBlastScale * 0.5 : 1);
      !pl && Math.hypot(rg.torsoPosition().x - ev.x, rg.torsoPosition().y - ev.y) < R * 0.6 && rg.stagger(0.9);
    }
    for (const o of this.arena.objects) o.body && o.body.getType && o.body.getType() === `dynamic` && kick(o.body, o.body.getMass() || 1, 0.8);
    if (this.flyers) for (const f of this.flyers) f.alive && f.body && kick(f.body, f.body.getMass() || 0.5, 1);
  }
  handleBossEvent(ev) {
    if (ev.type === 'telegraph') {
      this.effects.ring(ev.x ?? this.boss.x, ev.y ?? this.boss.groundY, this.boss.palette.glow, 12);
      snd(`telegraph`, { x: ev.x ?? this.boss.x });
      // Attack call-out
      const attack = ev.attack ?? this.boss.currentAttack;
      const colors = { slam: '#ff3b3b', sweep: '#ff9f1c', spit: '#9dff3a', leap: '#ff5cf0' };
      this.bossCalloutText = attack?.toUpperCase() ?? '';
      this.bossCalloutColor = colors[attack] ?? '#fff';
      this.bossCalloutTimer = (this.boss.attackTelegraph ?? 0.9) + 0.2;
      // Player exclamation if telegraph zone would hit player
      if (this.boss.previewZones && this.player.alive) {
        const zones = this.boss.previewZones();
        const playerPos = this.player.torsoPosition();
        for (const zone of zones) {
          let wouldHit = false;
          if (zone.kind === 'circle') {
            const dx = playerPos.x - zone.x;
            const dy = playerPos.y - zone.y;
            if (dx * dx + dy * dy <= (zone.r + 0.5) * (zone.r + 0.5)) wouldHit = true;
          } else if (zone.kind === 'bar') {
            if (playerPos.x >= zone.x - zone.w / 2 - 0.5 && playerPos.x <= zone.x + zone.w / 2 + 0.5 && playerPos.y >= zone.y - 0.5 && playerPos.y <= zone.y + zone.h + 0.5) wouldHit = true;
          }
          if (wouldHit) {
            this.playerExclamationTimer = this.boss.attackTelegraph ?? 0.9;
            break;
          }
        }
      }
    } else if (ev.type === 'leap') {
      this.effects.ring(ev.fromX, this.boss.groundY ?? 0, this.boss.palette.glow, 14), this.combat.trauma = Math.min(1, this.combat.trauma + 0.25), snd(`bossLeap`, { x: ev.fromX });
    } else if (ev.type === 'land') {
      this.effects.shockwave(ev.x, ev.y, this.boss.palette.glow, ev.radius * 1.8), this.effects.burst(ev.x, ev.y, this.boss.palette.mantleRim, 28, 7), this.combat.trauma = Math.min(1, this.combat.trauma + 0.9), snd(`bossLand`, { x: ev.x }), this.bossLandBlast(ev);
    } else if (ev.type === 'slam') {
      this.effects.shockwave(ev.x, ev.y, this.boss.palette.glow, 2.5);
      this.effects.burst(ev.x, ev.y, this.boss.palette.mantleRim, 16, 5);
      this.combat.trauma = Math.min(1, this.combat.trauma + 0.5);
      snd(`bossSlam`, { x: ev.x });
    } else if (ev.type === 'sweep') {
      this.effects.shockwave(ev.x, ev.y, this.boss.palette.glow, 2);
      this.effects.burst(ev.x, ev.y, this.boss.palette.mantleRim, 12, 4);
      this.combat.trauma = Math.min(1, this.combat.trauma + 0.4);
      snd(`bossSweep`, { x: ev.x });
    } else if (ev.type === 'spit') {
      for (const glob of ev.globs) {
        if (this.projectiles.length >= ENDLESS_CFG.maxProjectiles) break;
        const proj = new Projectile(this.physics, -1, { x: glob.x, y: glob.y }, { x: glob.dir.x * glob.speed, y: glob.dir.y * glob.speed }, BOSS_GLOB_SHOT, true);
        proj.damage = glob.damage;
        proj.bossGlob = true;
        this.projectiles.push(proj);
      }
      snd(`bossSpit`, { x: this.boss.x });
    } else if (ev.type === 'stagger') {
      this.effects.text(this.boss.x, this.boss.y - 2, `STAGGERED!`, `#ffffff`, 40);
      this.slowMo = Math.max(this.slowMo, 0.25);
      this.combat.trauma = Math.min(1, this.combat.trauma + 0.6);
      snd(`bossRoar`, { x: this.boss.x });
    } else if (ev.type === 'enrage') {
      this.effects.text(this.boss.x, this.boss.y - 2, `ENRAGED!`, `#ff3344`, 40);
      this.effects.flash(0.5);
      snd(`bossRoar`, { x: this.boss.x });
    } else if (ev.type === 'dead') {
      this.effects.text(ev.x, ev.y, `${this.boss.tierData.name} DEFEATED!`, `#ffffff`, 50);
      this.slowMo = Math.max(this.slowMo, 0.6);
      this.combat.trauma = Math.min(1, this.combat.trauma + 0.8);
      this.dropCoins({ x: ev.x, y: ev.y }, ev.coins);
      this.awardXp(ev.xp);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.25);
      this.bossScheduler.onBossDead(this.director.time);
      snd(`bossDie`, { x: ev.x });
    }
  }
  handleBossHarmZones(dt) {
    const zones = this.boss.harmZones();
    for (const zone of zones) {
      if (this.bossZoneIds.has(zone.id)) continue;
      for (const part of this.player.parts.values()) {
        if (!part.body) continue;
        const pos = part.body.getPosition();
        let hit = false;
        if (zone.kind === 'circle') {
          const dx = pos.x - zone.x;
          const dy = pos.y - zone.y;
          if (dx * dx + dy * dy <= (zone.r + 0.25) * (zone.r + 0.25)) hit = true;
        } else if (zone.kind === 'bar') {
          if (pos.x >= zone.x - zone.w / 2 - 0.25 && pos.x <= zone.x + zone.w / 2 + 0.25 && pos.y >= zone.y - 0.25 && pos.y <= zone.y + zone.h + 0.25) hit = true;
        }
        if (hit) {
          this.applyBossDamageToPlayer(zone, part);
          this.bossZoneIds.add(zone.id);
          break;
        }
      }
      for (const f of this.flyers) {
        if (!f.alive || !f.body) continue;
        const fp = f.body.getPosition();
        let fhit = false;
        if (zone.kind === 'circle') {
          const dx = fp.x - zone.x, dy = fp.y - zone.y;
          fhit = dx * dx + dy * dy <= (zone.r + f.radius) * (zone.r + f.radius);
        } else if (zone.kind === 'bar') {
          fhit = fp.x >= zone.x - zone.w / 2 - f.radius && fp.x <= zone.x + zone.w / 2 + f.radius && fp.y >= zone.y - f.radius && fp.y <= zone.y + zone.h + f.radius;
        }
        if (fhit) this.flyerSystem.knock(f, (zone.knock?.x || 0) * (fp.x < zone.x ? -1 : 1), zone.knock?.y || 0, 1);
      }
    }
    // Clear zone IDs for zones that are no longer active
    const activeIds = new Set(zones.map(z => z.id));
    for (const id of this.bossZoneIds) if (!activeIds.has(id)) this.bossZoneIds.delete(id);
  }
  applyBossDamageToPlayer(zone, part) {
    const dmg = zone.damage * this.player.incomingMul * ENDLESS_CFG.playerDamageMul;
    this.player.hp = Math.max(0, this.player.hp - dmg);
    const knockX = zone.knock.x * (part.body.getPosition().x < zone.x ? -1 : 1);
    const knockY = zone.knock.y;
    const mass = part.body.getMass();
    const ks = this.player.noKnockdown ? KNOCK_CFG.playerBlastScale : 1;
    part.body.applyLinearImpulse({ x: knockX * mass * ks, y: knockY * mass * ks }, part.body.getWorldCenter(), true);
    this.combat.trauma = Math.min(1, this.combat.trauma + 0.3);
    // Player damage feedback
    const playerPos = part.body.getPosition();
    const dmgRatio = Math.min(1, dmg / this.player.maxHp);
    this.vignetteTimer = 0.35;
    this.vignetteAlpha = dmgRatio * 0.6;
    // Larger damage number (boss hits 1.4x size)
    const dmgSize = 18 + Math.round(dmg * 1.4 * 0.15);
    this.effects.text(playerPos.x, playerPos.y + 0.5, `-${Math.round(dmg)}`, `#ff3344`, dmgSize);
    // Directional hit marker (screen edge chevron pointing to damage source)
    const zoneCenterX = zone.kind === 'circle' ? zone.x : zone.x;
    const zoneCenterY = zone.kind === 'circle' ? zone.y : zone.y + zone.h / 2;
    const dx = zoneCenterX - playerPos.x;
    const dy = zoneCenterY - playerPos.y;
    const angle = Math.atan2(dy, dx);
    if (this.hitMarkers) this.hitMarkers.push({ angle, life: 0.5, maxLife: 0.5 });
    // Camera kick opposite to source
    this.camera.addTrauma(0.15 * dmgRatio);
    snd(`hurtAlien`, { x: playerPos.x });
    if (this.player.hp <= 0 && this.player.alive) {
      this.player.kill(2.5);
      this.phase = `dying`;
      this.phaseTimer = 1.6;
      this.drag = null;
    }
  }
  handlePlayerProjectilesVsBoss() {
    let bossHitThrottle = 0;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj.alive || proj.ownerId !== 1) continue;
      const hit = this.boss.hitTest(proj.position.x, proj.position.y, proj.shot?.radius ?? 0.16);
      if (hit) {
        proj.alive = false;
        proj.destroy(this.physics);
        const dmg = this.computeProjectileDamage(proj, hit.part);
        const dealt = this.boss.damage(dmg, hit.part);
        if (dealt > 0) {
          const color = hit.part === 'eye' ? `#ffd23f` : hit.part === 'body' ? `#ffd23f` : `#888888`;
          const text = hit.part === 'eye' ? `x2 ${Math.round(dealt)}` : `${Math.round(dealt)}`;
          this.effects.text(this.boss.x, this.boss.y - 1, text, color);
          // Boss hit feedback: spark ring at hit point
          const sparkColor = hit.part === 'eye' ? `#ffd23f` : hit.part === 'body' ? `#ffffff` : `#888888`;
          this.effects.ring(hit.x, hit.y, sparkColor, 8);
          this.boss.flashTimer = 0.1;
          if (bossHitThrottle <= 0) {
            snd(`bossHit`, { x: this.boss.x });
            bossHitThrottle = 0.08;
          }
        }
      }
    }
    if (bossHitThrottle > 0) this.bossHitThrottle = bossHitThrottle;
  }
  computeProjectileDamage(proj, part) {
    const vel = proj.body.getLinearVelocity();
    const speed = Math.hypot(vel.x, vel.y);
    let base = COMBAT_CFG.projectileBaseDamage + COMBAT_CFG.projectileDamagePerSpeed * speed;
    base = Math.min(base, COMBAT_CFG.projectileDamageCap);
    const runStats = this.runStats;
    let mul = proj.shot?.damageMul ?? 1;
    mul *= runStats.damageMul ?? 1;
    if (runStats.critChance > 0 && this.rng() < runStats.critChance) {
      mul *= runStats.critMul ?? 2;
    }
    return base * mul;
  }
  randomSpawnSpot(e2 = null) {
    let t2 = this.arena.islands.filter((e3) => e3.home !== `player`), n2 = this.player.torsoPosition();
    for (let r3 = 0; r3 < 60; r3++) {
      let r4 = t2[Math.floor(Math.random() * t2.length)], i2 = randRange(r4.minX + 1.2, r4.maxX - 1.2), a2 = r4.topY + 1.3, o2 = Math.hypot(i2 - n2.x, a2 - n2.y) > 4.5, s2 = this.enemies.every((e3) => !e3.alive || Math.hypot(e3.torsoPosition().x - i2, e3.torsoPosition().y - a2) > 3), c2 = e2 === null || Math.abs(i2 - e2) > 3.5;
      if (o2 && s2 && c2) return { x: i2, topY: r4.topY };
    }
    let r2 = this.arena.islands.find((e3) => e3.home === `enemy`) ?? this.arena.islands[1];
    return { x: (r2.minX + r2.maxX) / 2, topY: r2.topY };
  }
  spawnRagdoll(e2, t2, n2, r2, i2 = 0) {
    let a2 = this.nextId++, o2 = new Ragdoll(this.physics, { id: a2, team: e2, facing: t2, x: n2, groundY: i2, maxHp: r2 });
    o2.onStep = (s2) => e2 === `player` ? snd(`step`, { x: s2.torsoPosition().x }) : snd(`stepAlien`, { x: s2.torsoPosition().x, vol: 0.8 });
    return o2;
  }
  spawnProjectile(e2, t2, n2, r2, i2) {
    let a2 = new Projectile(this.physics, e2.id, t2, { x: n2.x * r2, y: n2.y * r2 }, i2);
    this.projectiles.push(a2), e2.id === 1 ? snd(`launch`) : snd(`launchAlien`, { x: e2.torsoPosition().x });
  }
  spawnSplit(e2, t2, n2, r2) {
    let i2 = Math.atan2(-t2.y, -t2.x);
    for (let t3 = 0; t3 < r2.splitCount && this.projectiles.length < ENDLESS_CFG.maxProjectiles; t3++) {
      let a2 = i2 + (t3 - (r2.splitCount - 1) / 2) * 0.5 + randRange(-0.15, 0.15), o2 = randRange(6, 9), s2 = { x: Math.cos(a2), y: Math.sin(a2) }, c2 = { x: e2.x + s2.x * 0.18, y: e2.y + s2.y * 0.18 };
      this.projectiles.push(new Projectile(this.physics, n2, c2, { x: s2.x * o2, y: s2.y * o2 }, { ...Go, color: r2.color }, true));
    }
  }
  spawnRadial(e2, t2, n2, r2) {
    let i2 = randRange(0, Math.PI * 2);
    for (let a2 = 0; a2 < t2 && this.projectiles.length < ENDLESS_CFG.maxProjectiles; a2++) {
      let o2 = i2 + a2 / t2 * Math.PI * 2, s2 = randRange(6, 8), c2 = { x: Math.cos(o2), y: Math.sin(o2) }, l2 = { x: e2.x + c2.x * 0.25, y: e2.y + c2.y * 0.25 };
      this.projectiles.push(new Projectile(this.physics, n2, l2, { x: c2.x * s2, y: c2.y * s2 }, r2, true));
    }
  }
  allRagdolls() {
    return [this.player, ...this.enemies];
  }
  combatContext() {
    return { runStats: this.runStats, enemies: this.enemies, rng: () => this.rng(), flyers: this.flyerSystem, ragdolls: this.allRagdolls(), objects: this.arena.objects, coatDuration: this.progression.coatDuration, splatRadius: this.progression.splatRadius, puddleLife: this.progression.puddleLife, spawnSplit: (e2, t2, n2, r2) => this.spawnSplit(e2, t2, n2, r2), spawnRadial: (e2, t2, n2, r2) => this.spawnRadial(e2, t2, n2, r2), addWell: (e2, t2) => this.addWell(e2, t2), damageBlock: (e2, t2, n2) => this.damageBlock(e2, t2, n2), onCharacterHit: (e2, t2, n2) => this.onCharacterHit(e2, n2), playerHit: (e2, t2, n2, r2) => this.onPlayerProjectileHit(e2, t2, n2, r2) };
  }
  onCharacterHit(e2, t2) {
    if (e2.team !== `enemy`) {
      this.combo.break();
      return;
    }
    let n2 = this.combo.hit();
    n2 < 2 || (snd(`combo`, { pitch: 1 + 0.04 * Math.min(n2, 12) }), this.effects.text(t2.x, t2.y + 0.3, `\xD7${n2}`, `#8dff5a`), n2 % 5 == 0 && (this.effects.ring(t2.x, t2.y, `#8dff5a`, 8), this.combat.trauma = Math.min(0.6, this.combat.trauma + 0.04)));
  }
  damageBlock(e2, t2, n2) {
    if (n2 === 1) return;
    let r2 = e2.body.getPosition(), i2 = e2.def.id;
    this.effects.ring(r2.x, r2.y, e2.def.color, 6);
    let a2 = i2 === `spikes` ? `POP!` : i2 === `jelly` ? `BOING!` : i2 === `duck` ? `QUACK!` : null;
    a2 && this.effects.text(r2.x, r2.y + e2.h / 2 + 0.5, a2, e2.def.color, 26);
    let o2 = this.fortress.hit(e2, t2);
    o2 && (this.progression.losePieces(o2.map((e3) => e3.saved)), this.combat.trauma = Math.min(0.6, this.combat.trauma + 0.25), this.effects.splatter(r2.x, r2.y, e2.def.color, 18, 6), this.effects.shockwave(r2.x, r2.y, e2.def.color, 1.4, 0.35), this.effects.text(r2.x, r2.y + 0.9, o2.length > 1 ? `COLLAPSE \xD7${o2.length}` : `BROKEN!`, `#ff6b6b`, 28));
  }
  dropCoins(e2, t2) {
    if (t2 <= 0) return;
    let n2 = clamp(Math.round(t2 / 6), 4, 10), r2 = t2;
    for (let i2 = 0; i2 < n2; i2++) {
      let a2 = i2 === n2 - 1 ? r2 : Math.floor(t2 / n2);
      r2 -= a2;
      let o2 = randRange(0.3, Math.PI - 0.3), s2 = randRange(4, 7.5);
      this.coinDrops.push({ x: e2.x, y: e2.y + 0.3, vx: Math.cos(o2) * s2, vy: Math.sin(o2) * s2, t: -i2 * 0.03, value: a2, spin: randRange(0, 6) });
    }
    this.pendingCoins += t2;
  }
  updateCoins(e2) {
    let t2 = this.player.torsoPosition();
    for (let n2 = this.coinDrops.length - 1; n2 >= 0; n2--) {
      let r2 = this.coinDrops[n2];
      if (r2.t += e2, r2.spin += e2 * 12, r2.t < 0.5) {
        r2.vy -= 14 * e2, r2.vx *= 1 - 2 * e2, r2.x += r2.vx * e2, r2.y += r2.vy * e2;
        continue;
      }
      let i2 = t2.x - r2.x, a2 = t2.y - r2.y, o2 = Math.hypot(i2, a2), s2 = 8 + (r2.t - 0.5) * 45;
      o2 < 0.4 || o2 < s2 * e2 ? (snd(`coin`), this.pendingCoins = Math.max(0, this.pendingCoins - r2.value), this.effects.ring(t2.x, t2.y, `#ffe066`, 6), this.effects.burst(t2.x, t2.y, `#ffe066`, 4, 3, 0, 1), this.coinDrops.splice(n2, 1)) : (r2.x += i2 / o2 * s2 * e2, r2.y += a2 / o2 * s2 * e2);
    }
  }
  updateCannons(e2) {
    for (let t2 of this.fortress.standing) {
      if (t2.def.id !== `cannon`) continue;
      t2.reload -= e2;
      let n2 = { x: t2.x, y: t2.y + t2.h / 2 + 0.12 }, r2 = null, i2 = 1 / 0;
      for (let e3 of this.enemies) {
        if (!e3.alive) continue;
        let t3 = e3.torsoPosition(), a2 = Math.hypot(t3.x - n2.x, t3.y - n2.y);
        a2 < i2 && (i2 = a2, r2 = e3);
      }
      if (!r2) continue;
      let o2 = r2.torsoPosition(), s2 = Math.atan2(o2.y - n2.y, o2.x - n2.x) + 0.55 * Math.sign(o2.x - n2.x || 1);
      if (t2.aim += (s2 - t2.aim) * Math.min(1, e2 * 3), !(t2.reload > 0)) {
        t2.reload = FORTRESS_CFG.cannonReload;
        if (this.projectiles.length >= ENDLESS_CFG.maxProjectiles) continue;
        for (let e3 of [15, 17, 19, 21]) {
          let r3 = solveShotDirection(this.arena, n2, o2, e3);
          if (!r3) continue;
          let i3 = { x: n2.x + r3.x * 0.55, y: n2.y + r3.y * 0.55 };
          this.projectiles.push(new Projectile(this.physics, 1, i3, { x: r3.x * e3, y: r3.y * e3 }, Nc)), t2.aim = Math.atan2(r3.y, r3.x), t2.recoil = 1, this.effects.burst(i3.x, i3.y, `#ffd23f`, 12, 5, r3.x, r3.y), this.effects.burst(i3.x, i3.y, `#e6e9f0`, 8, 2.5, r3.x, r3.y), this.effects.ring(i3.x, i3.y, `#ffffff`, 8), this.combat.trauma = Math.min(0.5, this.combat.trauma + 0.04);
          break;
        }
      }
    }
  }
  addWell(e2, t2) {
    if (this.mechanics.wells.length < ENDLESS_CFG.maxWells) this.mechanics.wells.push({ ...t2, x: e2.x, y: e2.y });
  }
  shotCost(e2) {
    return Math.round(4 + 6 * e2.shot.mass);
  }
  grounded() {
    if (!this.player.alive) return false;
    if (this.player.grounded) return true;
    if (this.interior) return false;
    let e2 = [...this.arena.islands, ...this.fortress.surfaces()];
    for (let t2 of [`footL`, `footR`]) {
      let n2 = this.player.parts.get(t2)?.body.getPosition();
      if (n2 && e2.some((e3) => n2.x > e3.minX - 0.3 && n2.x < e3.maxX + 0.3 && n2.y < e3.topY + 0.22)) return true;
    }
    return false;
  }
  jump() {
    if (this.overlay !== `hud` || this.phase !== `playing` && this.phase !== `clearing` || !this.player.alive) return;
    if (this.player.isDown()) {
      if (this.stamina < RECOVER_CFG.playerCost) {
        this.flashStamina();
        return;
      }
      if (!this.player.kipUp()) return;
      this.stamina -= RECOVER_CFG.playerCost;
      let e3 = this.player.torsoPosition();
      this.effects.ring(e3.x, e3.y - 0.7, `#ffffff`, 10), this.effects.text(e3.x, e3.y + 0.5, `UP!`, `#ffffff`), this.combat.trauma = Math.min(0.5, this.combat.trauma + 0.07), snd(`getUp`, { x: e3.x });
      return;
    }
    let e2 = this.grounded();
    if (!e2 && this.airJumpUsed) return;
    let t2 = (e2 ? STAMINA_CFG.jumpGround : STAMINA_CFG.jumpAir) * this.runStats.jumpStaminaMul;
    if (this.stamina < t2) {
      this.flashStamina();
      return;
    }
    this.stamina -= t2, e2 || (this.airJumpUsed = true), this.player.launchUp(STAMINA_CFG.jumpSpeed);
    let i2 = this.player.torsoPosition();
    this.effects.ring(i2.x, i2.y - 0.9, `#ffffff`, 8), snd(e2 ? `jump` : `airJump`, { x: i2.x });
  }
  flashStamina() {
    this.staminaFlash = 0.35;
  }
  dragMaxPx() {
    return clamp(Math.min(this.canvas.clientWidth, this.canvas.clientHeight) * 0.45, 110, 280);
  }
  pointerDown(e2) {
    this.overlay === `build` ? this.pickUpAt(e2) : this.overlay === `hud` && this.phase === `playing` && this.player.alive && (this.drag = { anchorX: e2.x, anchorY: e2.y, curX: e2.x, curY: e2.y });
  }
  pointerMove(e2) {
    this.drag && (this.drag.curX = e2.x, this.drag.curY = e2.y);
  }
  pointerUp(e2) {
    if (!this.drag) return;
    this.drag.curX = e2.x, this.drag.curY = e2.y;
    let t2 = this.computeAim();
    this.drag = null, t2 && t2.power > 0 && this.fire(t2.dir, t2.power);
  }
  computeAim() {
    if (!this.drag) return null;
    let e2 = this.drag.anchorX - this.drag.curX, t2 = this.drag.anchorY - this.drag.curY, n2 = Math.hypot(e2, t2);
    if (n2 < 1e-3) return null;
    let r2 = n2 < Lc ? 0 : clamp((n2 - Lc) / (this.dragMaxPx() - Lc), 0, 1), i2 = dirToAimAngle2({ x: e2 / n2, y: -t2 / n2 }), a2 = e2 >= 0 ? 1 : -1;
    return i2 = a2 > 0 ? clamp(i2, Hc, Uc) : clamp(i2, -Uc, -Hc), { dir: { x: Math.sin(i2), y: -Math.cos(i2) }, power: r2 };
  }
  fire(e2, t2) {
    if (this.overlay !== `hud` || this.phase !== `playing` || !this.player.alive || this.shotCooldown > 0 || this.throwAnim) return;
    this.player.setFacing(e2.x >= 0 ? 1 : -1);
    let n2 = this.progression.weapon, r2 = this.shotCost(n2);
    if (this.stamina < r2) this.flashStamina();
    else if (this.stamina -= r2, this.cooldownTotal = n2.cooldown * this.progression.reloadMultiplier * this.runStats.cooldownMul, n2.launcher.kind === `hand`) {
      this.shotCooldown = Math.max(this.cooldownTotal, 0.38), this.cooldownTotal = this.shotCooldown, this.throwAnim = { t: 0, dir: e2, power: t2, phi: dirToAimAngle2(e2), released: false };
      let n3 = this.player.torsoBody;
      n3.applyLinearImpulse({ x: -e2.x * 0.12 * n3.getMass(), y: 0 }, n3.getPosition(), true), this.hideHintOnce();
    } else this.releaseShots(n2, e2, t2), this.shotCooldown = this.cooldownTotal, this.aimHold = 0.35, this.lastAimPhi = dirToAimAngle2(e2), this.hideHintOnce();
  }
  hideHintOnce() {
    this.hintShown && (this.hintShown = false, this.ui.hideHint());
  }
  updateThrow(e2) {
    let t2 = this.throwAnim;
    if (!t2) return;
    if (t2.t += e2, !this.player.alive) {
      this.throwAnim = null;
      return;
    }
    let n2 = clamp(t2.phi + 1.6, Hc, Uc), r2 = clamp(t2.phi - 1.2, Hc, Uc), i2;
    if (t2.t < Pc) {
      let e3 = t2.t / Pc;
      i2 = lerp(t2.phi, n2, 1 - (1 - e3) * (1 - e3));
    } else if (t2.t < 0.18) {
      let e3 = (t2.t - Pc) / Fc;
      i2 = lerp(n2, r2, e3 * e3), !t2.released && e3 >= Ic && this.releaseThrow(t2);
    } else if (t2.t < 0.38) t2.released || this.releaseThrow(t2), i2 = r2;
    else {
      this.throwAnim = null, this.aimHold = 0.12, this.lastAimPhi = r2;
      return;
    }
    if (this.player.setAim(i2), t2.t > Pc * 0.4 && t2.t < 0.18 + 0.05) {
      let e3 = this.player.muzzle({ x: 0, y: 0 }, 0);
      this.throwTrail.push({ x: e3.x, y: e3.y, age: 0 });
    }
  }
  releaseThrow(e2) {
    e2.released = true;
    let t2 = this.progression.weapon;
    this.releaseShots(t2, e2.dir, e2.power);
    let n2 = this.player.muzzle(e2.dir, 0.1);
    this.effects.ring(n2.x, n2.y, `#ffffff`, 10), this.effects.burst(n2.x, n2.y, t2.color, 10, 5, -e2.dir.x, -e2.dir.y + 0.4), this.effects.shockwave(n2.x, n2.y, `#eaffd9`, 0.6, 0.18);
    let r2 = this.player.torsoBody, i2 = 0.35 + 0.35 * e2.power;
    r2.applyLinearImpulse({ x: e2.dir.x * i2 * r2.getMass(), y: 0 }, r2.getPosition(), true), this.combat.trauma = Math.min(0.5, this.combat.trauma + 0.03 + 0.03 * e2.power);
  }
  launchWeapon(e2, t2, n2, r2, i2 = {}) {
    let a2 = i2.stats, o2 = a2 ? { ...t2.shot, radius: t2.shot.radius * a2.projectileSizeMul, damageMul: t2.shot.damageMul * a2.damageMul, splatMul: t2.shot.splatMul * a2.splatMul } : { ...(i2.shotDef ?? t2.shot) }, s2 = i2.color ?? t2.color;
    let m2 = i2.muzzleAt ?? ((u2) => e2.muzzle(u2));
    for (let u2 = 0; u2 < t2.shots && this.projectiles.length < ENDLESS_CFG.maxProjectiles; u2++) {
      let c2 = rotateVec(n2, (u2 - (t2.shots - 1) / 2) * t2.spread), f2 = m2(c2);
      this.spawnProjectile(e2, f2, c2, r2, o2), this.effects.burst(f2.x, f2.y, s2, 4, 4.5, c2.x, c2.y);
    }
    if (a2) for (let u2 = 1; u2 <= a2.extraShots && this.projectiles.length < ENDLESS_CFG.maxProjectiles; u2++) {
      let c2 = rotateVec(n2, Math.ceil(u2 / 2) * (7 * Math.PI / 180) * (u2 % 2 === 1 ? 1 : -1)), f2 = m2(c2);
      this.spawnProjectile(e2, f2, c2, r2, { ...o2, damageMul: o2.damageMul * a2.extraShotDamageMul }), this.effects.burst(f2.x, f2.y, s2, 3, 4, c2.x, c2.y);
    }
    if (a2 && a2.tentacleShots > 0) {
      const tentacleCount = a2.tentacleShots;
      const tentacleDamageMul = a2.tentacleShotDamageMul ?? 0.55;
      const spreadAngle = 0.15;
      for (let u2 = 1; u2 <= tentacleCount && this.projectiles.length < ENDLESS_CFG.maxProjectiles; u2++) {
        const side = u2 % 2 === 1 ? 1 : -1;
        const idx = Math.ceil(u2 / 2);
        let c2 = rotateVec(n2, side * idx * spreadAngle);
        let tipPos = e2.slimeBody && e2.slimeBody.tentacles && e2.slimeBody.tentacles.length ? e2.slimeBody.tip((u2 - 1) % e2.slimeBody.tentacles.length) : null;
        let f2 = tipPos ? { x: tipPos.x, y: tipPos.y } : m2(c2);
        if (!tipPos) f2 = m2(c2);
        this.spawnProjectile(e2, f2, c2, r2, { ...o2, damageMul: o2.damageMul * tentacleDamageMul }), this.effects.burst(f2.x, f2.y, s2, 3, 4, c2.x, c2.y), u2 === 1 && snd(`extraShot`, { x: f2.x });
      }
    }
    if (a2 && a2.extraHandLevel > 0) {
      const handLevel = a2.extraHandLevel;
      const handDamageMul = a2.extraHandDamageMul ?? (handLevel === 1 ? 0.7 : 1.0);
      const offHandDir = rotateVec(n2, -0.09), mz = m2(offHandDir);
      let f2 = { x: mz.x + n2.y * 0.32, y: mz.y - n2.x * 0.32 };
      this.spawnProjectile(e2, f2, offHandDir, r2, { ...o2, damageMul: o2.damageMul * handDamageMul }), this.effects.burst(f2.x, f2.y, s2, 3, 4, offHandDir.x, offHandDir.y), snd(`extraShot`, { x: f2.x });
    }
    if (i2.recoil === false || t2.launcher.kind === `hand`) return;
    let d2 = Math.min(0.45, 0.05 + t2.shot.mass * 0.07), b2 = e2.torsoBody;
    b2.applyLinearImpulse({ x: -n2.x * d2 * b2.getMass(), y: -n2.y * d2 * b2.getMass() }, b2.getPosition(), true), this.combat.trauma = Math.min(0.5, this.combat.trauma + 0.015 + t2.shot.mass * 0.01);
  }
  releaseShots(e2, t2, n2) {
    this.launchWeapon(this.player, e2, t2, this.launchSpeed(n2), { stats: this.runStats, color: e2.color });
  }
  launchSpeed(e2) {
    return (SLIME_CFG.launchMin + (SLIME_CFG.launchMax - SLIME_CFG.launchMin) * e2) * this.progression.launchMultiplier * this.progression.weapon.speedMul * this.runStats.shotSpeedMul;
  }
  updateAim() {
    let e2 = this.computeAim(), t2 = this.overlay === `hud` && this.phase === `playing` && this.player.alive;
    if (this.aimPower = e2?.power ?? 0, this.aimActive = !!e2 && e2.power > 0.02 && t2, this.aimDir = e2 ? e2.dir : null, this.aimView.active = this.aimActive, this.aimView.power = this.aimPower, this.aimView.anchor = this.drag ? { x: this.drag.anchorX, y: this.drag.anchorY } : null, this.aimView.pointer = this.drag ? { x: this.drag.curX, y: this.drag.curY } : null, this.aimView.path = [], this.aimView.landing = null, this.aimActive && e2) {
      let t3 = this.player.muzzle(e2.dir), n2 = this.launchSpeed(e2.power), r2 = { x: e2.dir.x * n2, y: e2.dir.y * n2 }, i2 = this.fortress.count(`telescope`) > 0 ? FORTRESS_CFG.telescopeReach : 1, o2 = simulateThrowPath(this.arena, t3, r2, 2.6 * i2);
      this.aimView.path = o2.points, this.aimView.landing = o2.landing;
    }
  }
  enterBuild() {
    let e2 = this.overlay;
    if (this.mode === `endless` && this.screen === `run`) return;
    if (e2 === `hud`) {
      if (this.screen !== `run` || this.phase !== `playing` && this.phase !== `clearing`) return;
      this.paused = true, this.drag = null;
    } else if (e2 !== `menu` && e2 !== `pause` && e2 !== `catalog`) return;
    this.buildReturn = e2, this.buildCatalogFrom = this.catalogFrom, this.buildDrag = null, this.setOverlay(`build`), this.renderBuild();
  }
  exitBuild() {
    if (this.overlay !== `build`) return;
    this.buildDrag = null;
    let e2 = this.buildReturn;
    this.catalogFrom = this.buildCatalogFrom, this.setOverlay(e2), e2 === `hud` ? this.paused = false : e2 === `menu` ? this.refreshMenu() : e2 === `catalog` && this.renderCatalog();
  }
  rotateBuild() {
    this.overlay === `build` && (this.buildRot = +(this.buildRot === 0), this.renderBuild());
  }
  buildModel() {
    let e2 = this.progression;
    return { coins: e2.coins - this.pendingCoins, rotated: this.buildRot === 1, dragging: this.buildDrag?.item ?? null, items: FORTRESS_ITEMS.filter((t2) => e2.isUnlocked(t2.id)).map((t2) => ({ id: t2.id, name: t2.name, color: t2.color, count: e2.itemCount(t2.id), placed: e2.placedCount(t2.id), maxPlaced: t2.maxPlaced, canPlace: e2.canPlace(t2.id) })), lockedCount: FORTRESS_ITEMS.filter((t2) => !e2.isUnlocked(t2.id)).length };
  }
  renderBuild() {
    this.ui.showBuild(this.buildModel());
  }
  canvasPoint(e2, t2) {
    let n2 = this.canvas.getBoundingClientRect();
    return { x: e2 - n2.left, y: t2 - n2.top };
  }
  startTrayDrag(e2, t2, n2) {
    this.overlay === `build` && (this.progression.canPlace(e2) ? (fortressItem(e2).rotatable || (this.buildRot = 0), this.buildDrag = { item: e2, screen: this.canvasPoint(t2, n2) }, this.renderBuild()) : this.ui.shakeTraySlot(e2));
  }
  pickUpAt(e2) {
    let t2 = this.camera.toWorld(e2), n2 = this.fortress.pieceAt(t2.x, t2.y);
    n2 && (this.fortress.isLoadBearing(n2) ? (n2.flash = 0.25, this.effects.text(n2.x, n2.y + n2.h / 2 + 0.4, `Holding others up`, `#ffd166`, 18)) : (this.fortress.pickUp(n2), this.progression.pickUpItem(n2.saved), this.buildRot = n2.saved.rot, this.buildDrag = { item: n2.def.id, screen: e2 }, this.effects.burst(n2.x, n2.y, n2.def.color, 8, 3, 0, 1), this.renderBuild()));
  }
  buildPointerMove(e2) {
    this.buildDrag && (this.buildDrag.screen = this.canvasPoint(e2.clientX, e2.clientY));
  }
  buildPointerUp(e2) {
    let t2 = this.buildDrag;
    if (!t2) return;
    if (this.buildDrag = null, t2.screen = this.canvasPoint(e2.clientX, e2.clientY), this.ui.isOverTray(e2.clientX, e2.clientY)) {
      this.renderBuild();
      return;
    }
    let n2 = this.ghostFor(t2);
    if (!n2.valid) {
      this.effects.text(n2.x, n2.y + n2.h / 2 + 0.4, n2.reason, `#ff8a7a`, 18), this.renderBuild();
      return;
    }
    let r2 = this.progression.placeItem({ item: t2.item, x: n2.x, y: n2.y, rot: n2.rot });
    if (r2) {
      this.fortress.add(r2);
      let e3 = n2.y - n2.h / 2;
      this.effects.burst(n2.x - n2.w / 2, e3, `#e6dcc6`, 6, 2.6, -1, 0.6), this.effects.burst(n2.x + n2.w / 2, e3, `#e6dcc6`, 6, 2.6, 1, 0.6), this.effects.ring(n2.x, n2.y, fortressItem(t2.item).color, 10), this.combat.trauma = Math.min(0.4, this.combat.trauma + 0.08);
    }
    this.renderBuild();
  }
  cancelBuildDrag() {
    this.buildDrag && (this.buildDrag = null, this.overlay === `build` && this.renderBuild());
  }
  ghostFor(e2) {
    let t2 = this.camera.toWorld(e2.screen), n2 = fortressItem(e2.item).rotatable ? this.buildRot : 0, r2 = this.fortress.footprint(e2.item, n2, t2.x), i2 = ``;
    return r2.ok ? this.blockedByBodies(r2) ? i2 = `Something is in the way` : this.progression.placedCount(e2.item) >= fortressItem(e2.item).maxPlaced && (i2 = `No more of these`) : i2 = `Too high`, { ...r2, valid: i2 === ``, reason: i2 };
  }
  blockedByBodies(e2) {
    let t2 = (t3, n2, r2) => Math.abs(t3 - e2.x) < e2.w / 2 + r2 && Math.abs(n2 - e2.y) < e2.h / 2 + r2;
    for (let e3 of this.allRagdolls()) if (e3.state !== `dead`) for (let n2 of e3.parts.values()) {
      let e4 = n2.body.getPosition();
      if (t2(e4.x, e4.y, 0.16)) return true;
    }
    for (let e3 of this.arena.objects) {
      let n2 = e3.body.getPosition();
      if (t2(n2.x, n2.y, e3.size)) return true;
    }
    return false;
  }
  cameraTargets() {
    if (this.interior) {
      let n2 = this.player.torsoPosition(), d2 = this.interior.def;
      return [{ x: clampToInterior(d2, n2.x), y: n2.y }];
    }
    if (this.overlay === `build`) {
      let e3 = this.fortress.zone;
      return [{ x: e3.minX, y: e3.topY }, { x: e3.maxX + 4, y: e3.topY }, { x: (e3.minX + e3.maxX) / 2, y: FORTRESS_CFG.maxHeight - 1 }];
    }
    if (this.mode === `endless`) {
      let n2 = this.player.torsoPosition(), r2 = ENDLESS_CFG.viewHalfWidth - 2.2;
      const targets = [{ x: n2.x - r2, y: n2.y }, { x: n2.x + r2, y: n2.y }];
      if (this.boss && this.boss.alive) {
        const dx = this.boss.x - n2.x;
        const dy = this.boss.y - n2.y;
        if (dx * dx + dy * dy <= 20 * 20) {
          targets.push({ x: this.boss.x, y: this.boss.y + 2 });
        }
      }
      return targets;
    }
    let e2 = [];
    this.player.alive && e2.push(this.player.torsoPosition());
    for (let t2 of this.enemies) t2.alive && e2.push(t2.torsoPosition());
    for (let t2 of this.projectiles) t2.alive && e2.push(t2.position);
    for (let t2 of this.arena.objects) {
      let n2 = t2.body.getPosition();
      n2.y > -3 && e2.push(n2);
    }
    return e2.length === 0 && e2.push({ x: ARENA_CFG.playerSpawnX, y: 1 }), e2;
  }
  scene(e2) {
    return { arena: this.arena, slime: this.slime, effects: this.effects, camera: this.camera, player: this.player, enemies: this.enemies, flyers: this.flyers, projectiles: this.projectiles, objects: this.arena.objects, fortress: this.fortress, wells: this.mechanics.wells, playerLauncher: this.progression.weapon.launcher, hand: this.handView(), throwTrail: this.throwTrail, coins: this.coinDrops.map((e3) => ({ x: e3.x, y: e3.y, spin: e3.spin })), build: this.buildView(), aim: this.aimView, time: this.time, alpha: e2, mode: this.mode, hitMarkers: this.hitMarkers ?? [], vignetteAlpha: this.vignetteAlpha ?? 0, bossCalloutText: this.bossCalloutText ?? ``, bossCalloutTimer: this.bossCalloutTimer ?? 0, bossCalloutColor: this.bossCalloutColor ?? `#ffffff`, pickupBanner: this.pickupBanner ?? null, playerExclamationTimer: this.playerExclamationTimer ?? 0, slimeLook: this.mode === `endless`, interior: this.interior ? { def: this.interior.def, view: { camX: this.camera.x, camY: this.camera.y, scale: this.camera.scale, width: this.renderer.viewW, height: this.renderer.viewH }, collected: [...this.interior.session.coinsTaken], pickups: [...this.interior.session.pickupsTaken], weaponColors: WEAPON_COLORS, fade: this.interior.fade } : null, doorFade: this.doorFade, boss: this.boss };
  }
  handView() {
    if (this.progression.weapon.launcher.kind !== `hand` || !this.player.alive) return null;
    let e2 = this.throwAnim;
    if (e2) return e2.released ? null : { size: 1 + 0.3 * e2.power, power: e2.power, swinging: e2.t >= Pc, charging: false };
    if (this.shotCooldown > 0) {
      let e3 = 1 - this.shotCooldown / Math.max(0.01, this.cooldownTotal);
      return { size: Math.max(0, e3 * e3), power: 0, swinging: false, charging: false };
    }
    return this.aimActive ? { size: 1 + 0.35 * this.aimPower, power: this.aimPower, swinging: false, charging: true } : { size: 1, power: 0, swinging: false, charging: false };
  }
  buildView() {
    if (this.overlay !== `build`) return null;
    let e2 = this.buildDrag;
    if (!e2) return { zone: { ...this.fortress.zone, maxY: FORTRESS_CFG.maxHeight }, held: null, landing: null };
    let t2 = this.ghostFor(e2), n2 = this.camera.toWorld(e2.screen);
    return { zone: { ...this.fortress.zone, maxY: FORTRESS_CFG.maxHeight }, held: { item: e2.item, rot: t2.rot, x: n2.x, y: n2.y }, landing: t2 };
  }
};
function rotateVec(e2, t2) {
  let n2 = Math.cos(t2), r2 = Math.sin(t2);
  return { x: e2.x * n2 - e2.y * r2, y: e2.x * r2 + e2.y * n2 };
}
function dirToAimAngle2(e2) {
  return Math.atan2(e2.x, -e2.y);
}
var qc = document.getElementById(`game`);
if (!(qc instanceof HTMLCanvasElement)) throw Error(`SLIPSHOT: missing #game canvas`);
var gameInstance = new Game(qc);
gameInstance.start();
// Debug/test hook: open the page with ?debug to get window.__slip (used by the manager for scripted tests).
if (location.search.includes(`debug`)) window.__slip = gameInstance;
// Build stamp in the main menu: /build.txt is generated by run_slipshot.bat (git hash, edited flag, game.js save time); other servers just 404 and the line stays empty.
fetch(`./build.txt`, { cache: `no-store` }).then((e2) => e2.ok ? e2.text() : ``).then((e2) => { let t2 = document.getElementById(`menu-build`); t2 && e2 && (t2.textContent = e2.trim()); }).catch(() => {});
