import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { WAVES, scheduledCount } from '../data/waves';
import { WEAPONS } from '../data/weapons';
import { SUPPORT_SFX_FILES, WEAPON_IMPACT_FILES, WEAPON_SHOT_FILES } from '../audio/overrides';
import { buildSoundBank } from '../audio/SoundBank';
import { computeViewModelPose, resolveViewModel } from '../entities/viewModelPose';
import { ECONOMY, VIEW } from '../game/config';
import { MENU_BG_TEXTURE } from '../game/textureKeys';
import { TOUCH_AIM_SENSITIVITY, TOUCH_LAYOUT, isAimTouch, resetTouchPointerIds, stepTouchAim, touchButtonAt } from '../game/touchControls';
import { groundAt, project } from '../game/perspective';
import { Abilities } from './Abilities';
import { BunkerManager } from './BunkerManager';
import { blastDamage, bulletDamage, killReward } from './CombatRules';
import { EconomyManager } from './EconomyManager';
import { buildCatalog } from './Shop';
import { WaveManager } from './WaveManager';
import { WeaponManager } from './WeaponManager';

const none = new Set<never>();

describe('main menu background', () => {
  it('registers one shared menu-background texture key', () => {
    expect(MENU_BG_TEXTURE).toBe('menu_bg');
  });

  it('ships the supplied main-menu image', () => {
    const images = import.meta.glob('../../src/assets/*.png');
    expect(Object.keys(images).some((key) => key.endsWith('main-menu.png'))).toBe(true);
  });

  it('does not render the menu control list', () => {
    const sources = import.meta.glob('../../src/game/*.ts', { eager: true, query: '?raw', import: 'default' });
    const menu = Object.values(sources).join('\n');
    expect(menu).not.toContain('MOUSE          aim');
    expect(menu).not.toContain('ESC / P        pause & settings');
  });
});

describe('weapon shot recordings', () => {
  it('gives every gun its own supplied shot file', () => {
    expect(new Set(WEAPONS.map((w) => w.sound.shot)).size).toBe(4);
    const mapping = Object.fromEntries(
      WEAPONS.map((w) => [w.id, WEAPON_SHOT_FILES[w.sound.shot as keyof typeof WEAPON_SHOT_FILES]]),
    );
    expect(mapping).toEqual({
      service: 'audio/fogline/gun-1.mp3',
      m4: 'audio/fogline/gun-2.mp3',
      m249: 'audio/fogline/gun-3.mp3',
      m32: 'audio/fogline/rocket-launch.mp3',
    });
  });

  it('keeps every supplied recording public', () => {
    const files = import.meta.glob('../../public/audio/fogline/*.mp3');
    for (const url of Object.values(WEAPON_SHOT_FILES)) {
      expect(files[`../../public/${url}`], url).toBeDefined();
    }
  });

  it('gives only the M32 a rocket impact cue', () => {
    const m32 = WEAPONS.find((w) => w.id === 'm32')!;
    expect(m32.sound.impact).toBe('rocket_impact');
    for (const w of WEAPONS.filter((x) => x.id !== 'm32')) expect(w.sound.impact).toBeUndefined();
  });

  it('registers the rocket impact recording and a synthesized fallback', () => {
    expect(WEAPON_IMPACT_FILES.rocket_impact).toBe('audio/fogline/rocket-explosion.mp3');
    const files = import.meta.glob('../../public/audio/fogline/*.mp3');
    expect(files[`../../public/${WEAPON_IMPACT_FILES.rocket_impact}`]).toBeDefined();
    expect(buildSoundBank(11025).has('rocket_impact')).toBe(true);
  });
});

describe('support strike recordings', () => {
  it('routes the supplied support recordings to the right cues', () => {
    expect(Object.keys(SUPPORT_SFX_FILES)).toEqual(['shutters_up', 'nuke', 'orbital_charge']);
    expect(Object.values(SUPPORT_SFX_FILES)).toEqual([
      'audio/fogline/metal-shield.mp3',
      'audio/fogline/nuc-explosion.mp3',
      'audio/fogline/satellite-beam.mp3',
    ]);
  });

  it('ships each support recording and keeps its synthesized fallback', () => {
    const files = import.meta.glob('../../public/audio/fogline/*.mp3');
    const bank = buildSoundBank(11025);
    for (const [key, url] of Object.entries(SUPPORT_SFX_FILES)) {
      expect(files[`../../public/${url}`], url).toBeDefined();
      expect(bank.has(key), key).toBe(true);
    }
  });

  it('leaves the rocket impact recording unchanged', () => {
    expect(WEAPON_IMPACT_FILES.rocket_impact).toBe('audio/fogline/rocket-explosion.mp3');
  });
});

describe('perspective', () => {
  it('distant points are higher and smaller', () => {
    const far = project(0, 90), near = project(0, 5);
    expect(far.sy).toBeLessThan(near.sy);
    expect(far.ppm).toBeLessThan(near.ppm);
  });
  it('groundAt inverts project', () => {
    const p = project(3, 20);
    const g = groundAt(p.sx, p.sy);
    expect(g.z).toBeCloseTo(20, 5);
    expect(g.x).toBeCloseTo(3, 5);
  });
});

describe('EconomyManager', () => {
  it('never goes negative and refuses unaffordable purchases', () => {
    const e = new EconomyManager(100);
    expect(e.spend(150, 'x')).toBe(false);
    expect(e.cash).toBe(100);
    expect(e.spend(100, 'x')).toBe(true);
    expect(e.cash).toBe(0);
    expect(e.spend(1, 'x')).toBe(false);
  });
});

describe('CombatRules', () => {
  const shambler = ENEMIES.shambler, plated = ENEMIES.plated;
  it('headshots multiply damage', () => {
    const body = bulletDamage(30, 3, 'torso', shambler, none).damage;
    const head = bulletDamage(30, 3, 'head', shambler, none).damage;
    expect(head).toBeCloseTo(body * 3);
  });
  it('armour reduces body damage and AP removes it', () => {
    const plain = bulletDamage(40, 2, 'torso', plated, none);
    expect(plain.damage).toBeCloseTo(10);
    expect(plain.deflected).toBe(true);
    const ap = bulletDamage(40, 2, 'torso', plated, new Set(['ap'] as const));
    expect(ap.damage).toBeCloseTo(40);
    expect(ap.deflected).toBe(false);
  });
  it('double damage doubles', () => {
    expect(bulletDamage(30, 1, 'torso', shambler, new Set(['double'] as const)).damage).toBeCloseTo(60);
  });
  it('blast falls off with distance and is zero outside the radius', () => {
    expect(blastDamage(100, 0, 5, none)).toBeCloseTo(100);
    expect(blastDamage(100, 5, 5, none)).toBeCloseTo(25);
    expect(blastDamage(100, 5.1, 5, none)).toBe(0);
  });
  it('headshot bonus is part of a single payout', () => {
    expect(killReward(shambler, true)).toBe(shambler.reward + shambler.headshotBonus);
    expect(killReward(shambler, false)).toBe(shambler.reward);
  });
});

describe('BunkerManager', () => {
  it('takes damage, blocks while shielded, fires destroyed once', () => {
    const b = new BunkerManager(100);
    let destroyed = 0;
    b.events.on('destroyed', () => destroyed++);
    b.damage(30);
    expect(b.health).toBe(70);
    b.raiseShield(2);
    b.damage(50);
    expect(b.health).toBe(70);
    b.update(3);
    b.damage(200);
    b.damage(10);
    expect(b.health).toBe(0);
    expect(destroyed).toBe(1);
  });
  it('repair caps at max; raising max adds the difference', () => {
    const b = new BunkerManager(1000);
    b.damage(500);
    b.repair(800);
    expect(b.health).toBe(1000);
    b.setMax(1250);
    expect(b.health).toBe(1250);
  });
});

describe('WeaponManager', () => {
  it('semi-auto fires once per click and reloads from infinite reserve', () => {
    const w = new WeaponManager();
    const mag = w.current.def.magazine;
    expect(w.update(0.016, true)).toBe(1);
    expect(w.update(0.5, true)).toBe(0); // holding does not refire
    w.update(0.016, false);
    expect(w.update(0.016, true)).toBe(1);
    expect(w.current.mag).toBe(mag - 2);
    expect(w.reload()).toBe(true);
    w.update(5, false);
    expect(w.current.mag).toBe(mag);
  });
  it('auto fires at its fire rate and consumes reserve on reload', () => {
    const w = new WeaponManager();
    w.grant('m4');
    w.select('m4');
    w.update(0.5, false); // finish the switch
    expect(w.current.def.id).toBe('m4');
    let shots = 0;
    for (let i = 0; i < 60; i++) shots += w.update(1 / 60, true);
    expect(shots).toBeGreaterThanOrEqual(10);
    expect(shots).toBeLessThanOrEqual(12);
    const before = w.current.reserve;
    w.reload();
    w.update(3, false);
    expect(w.current.mag).toBe(30);
    expect(w.current.reserve).toBe(before - shots);
  });
  it('cannot select unowned weapons', () => {
    const w = new WeaponManager();
    expect(w.selectSlot(3)).toBe(false);
    expect(w.current.def.id).toBe('service');
  });
});

describe('WaveManager', () => {
  it('spawns the full schedule, pays the bonus once, and needs an empty field to continue', () => {
    const wm = new WaveManager();
    const rewards: number[] = [];
    wm.events.on('cleared', ({ reward }) => rewards.push(reward));
    expect(wm.startNext()).toBe(true);
    let spawned = 0;
    for (let t = 0; t < 120; t += 0.1) {
      const reqs = wm.update(0.1);
      spawned += reqs.length;
      wm.notifySpawned(reqs.length);
    }
    expect(spawned).toBe(scheduledCount(WAVES[0]));
    expect(wm.startNext()).toBe(false); // enemies remain
    for (let i = 0; i < spawned; i++) wm.notifyRemoved();
    expect(wm.phase).toBe('cleared');
    expect(rewards).toEqual([ECONOMY.waveBonusBase + ECONOMY.waveBonusPerWave]);
    wm.notifyRemoved(); // stray extra removal must not pay again
    expect(rewards.length).toBe(1);
    expect(wm.startNext()).toBe(true);
    expect(wm.wave).toBe(2);
  });
  it('extra spawns (crawler bursts) keep the wave open', () => {
    const wm = new WaveManager([{ name: 't', speedMul: 1, healthMul: 1, groups: [{ enemy: 'carrier', count: 1, delay: 0, interval: 1 }] }]);
    let victory = false;
    wm.events.on('victory', () => { victory = true; });
    wm.startNext();
    wm.update(10);
    const r = wm.update(0.1);
    wm.notifySpawned(r.length);
    wm.notifyExtraSpawned(3);
    wm.notifyRemoved(1);
    expect(wm.phase).toBe('active');
    wm.notifyRemoved(3);
    expect(victory).toBe(true);
  });
  it('difficulty rises across the campaign', () => {
    expect(WAVES).toHaveLength(8);
    const counts = WAVES.map(scheduledCount);
    expect(counts[7]).toBeGreaterThan(counts[0] * 4);
    expect(WAVES[7].speedMul).toBeGreaterThan(WAVES[0].speedMul);
    const types = (i: number) => new Set(WAVES[i].groups.map((g) => g.enemy));
    expect(types(0).has('runner')).toBe(false);
    expect(types(2).has('runner')).toBe(true);
    expect(types(4).has('plated')).toBe(true);
    expect(types(6).has('carrier')).toBe(true);
  });
});

describe('Shop', () => {
  const setup = (cash: number) => {
    const economy = new EconomyManager(cash);
    const weapons = new WeaponManager();
    const abilities = new Abilities();
    const bunker = new BunkerManager();
    const upgrades = { reinforceLevel: 0 };
    const catalog = buildCatalog({ economy, weapons, abilities, bunker, upgrades });
    return { economy, weapons, abilities, bunker, upgrades, catalog, item: (id: string) => catalog.find((c) => c.id === id)! };
  };
  it('buying the M4 deducts exactly its price once', () => {
    const s = setup(1500);
    const m4 = WEAPONS.find((w) => w.id === 'm4')!;
    expect(s.item('weapon:m4').buy()).toBe(true);
    expect(s.economy.cash).toBe(1500 - m4.price);
    expect(s.weapons.owns('m4')).toBe(true);
    expect(s.item('weapon:m4').status()).toBe('owned');
    expect(s.item('weapon:m4').buy()).toBe(false);
    expect(s.economy.cash).toBe(1500 - m4.price);
  });
  it('refuses unaffordable items without changing state', () => {
    const s = setup(100);
    expect(s.item('weapon:m249').status()).toBe('cash');
    expect(s.item('weapon:m249').buy()).toBe(false);
    expect(s.economy.cash).toBe(100);
  });
  it('ammo requires the weapon; charges cap at max', () => {
    const s = setup(100000);
    expect(s.item('ammo:m4').status()).toBe('needs');
    const mod = s.item('mod:ap');
    for (let i = 0; i < 5; i++) expect(mod.buy()).toBe(true);
    expect(mod.status()).toBe('full');
    expect(mod.buy()).toBe(false);
  });
  it('reinforcement raises bunker max health', () => {
    const s = setup(100000);
    s.item('upgrade:reinforce').buy();
    expect(s.bunker.max).toBe(1250);
    expect(s.upgrades.reinforceLevel).toBe(1);
  });
  it('the first upgrade is reachable after about one wave', () => {
    const w1 = WAVES[0].groups.reduce((n, g) => n + g.count * ENEMIES[g.enemy].reward, 0);
    const afterWave1 = ECONOMY.startingCash + w1 + ECONOMY.waveBonusBase + ECONOMY.waveBonusPerWave;
    expect(afterWave1).toBeGreaterThanOrEqual(WEAPONS[1].price - 150);
    expect(ECONOMY.startingCash).toBeLessThan(WEAPONS[1].price);
  });
});

describe('Abilities', () => {
  it('support respects charges and cooldowns', () => {
    const a = new Abilities();
    expect(a.useSupport('orbital')).toBe(false);
    a.addCharge('support', 'orbital');
    a.addCharge('support', 'orbital');
    expect(a.useSupport('orbital')).toBe(true);
    expect(a.useSupport('orbital')).toBe(false); // cooling down
    a.update(30);
    expect(a.useSupport('orbital')).toBe(true);
  });
  it('mods activate for their duration', () => {
    const a = new Abilities();
    a.addCharge('mod', 'fire');
    expect(a.activateMod('fire')).toBe(true);
    const s = new Set<string>();
    expect(a.activeMods(s as never).has('fire' as never)).toBe(true);
    a.update(25);
    expect(a.activeMods(s as never).size).toBe(0);
  });
});

describe('phone touch controls', () => {
  it('drags the crosshair relatively, scaled by the sensitivity', () => {
    const next = stepTouchAim({ x: 640, y: 300 }, 10, -20);
    expect(next).toEqual({ x: 640 + 10 * TOUCH_AIM_SENSITIVITY, y: 300 - 20 * TOUCH_AIM_SENSITIVITY });
  });

  it('clamps the touch crosshair to the battlefield', () => {
    expect(stepTouchAim({ x: 1270, y: 580 }, 500, 500)).toEqual({ x: VIEW.width, y: VIEW.hudTop });
    expect(stepTouchAim({ x: 5, y: 5 }, -500, -500)).toEqual({ x: 0, y: 0 });
  });

  it('the left half above the HUD is the aim zone, the right half is not', () => {
    expect(isAimTouch(200, 300)).toBe(true);
    expect(isAimTouch(900, 300)).toBe(false);
    expect(isAimTouch(200, VIEW.hudTop + 5)).toBe(false);
  });

  it('only the on-screen buttons fire, reload, pause, shop and deploy', () => {
    const L = TOUCH_LAYOUT;
    expect(touchButtonAt(L.fire.x, L.fire.y, false)).toBe('fire');
    expect(touchButtonAt(L.reload.x, L.reload.y, false)).toBe('reload');
    expect(touchButtonAt(L.pause.x, L.pause.y, false)).toBe('pause');
    expect(touchButtonAt(L.shop.x, L.shop.y, false)).toBe('shop');
    expect(touchButtonAt(L.deploy.x, L.deploy.y, false)).toBeNull();
    expect(touchButtonAt(L.deploy.x, L.deploy.y, true)).toBe('deploy');
    // empty right-side battlefield does nothing
    expect(touchButtonAt(900, 200, true)).toBeNull();
  });

  it('keeps every button on the battlefield, clear of the HUD', () => {
    for (const c of [TOUCH_LAYOUT.fire, TOUCH_LAYOUT.reload, TOUCH_LAYOUT.pause, TOUCH_LAYOUT.shop]) {
      expect(c.y + c.r).toBeLessThan(VIEW.hudTop);
      expect(c.x - c.r).toBeGreaterThanOrEqual(0);
      expect(c.x + c.r).toBeLessThanOrEqual(VIEW.width);
    }
    expect(TOUCH_LAYOUT.deploy.y + TOUCH_LAYOUT.deploy.h / 2).toBeLessThan(VIEW.hudTop);
  });

  it('clears stale touch pointer ids on restart', () => {
    const state = { aimPointerId: 1 as number | null, firePointerId: 2 as number | null };
    resetTouchPointerIds(state);
    expect(state).toEqual({ aimPointerId: null, firePointerId: null });
  });
});

describe('view-model aiming', () => {
  const pose = (id: string, aimX: number, aimY: number, cursorX: number, cursorY: number) => {
    const model = resolveViewModel(WEAPONS.find((w) => w.id === id)!);
    return computeViewModelPose({
      model, textureWidth: 1280, textureHeight: 720, aimX, aimY, cursorX, cursorY,
      kick: 0, kickRot: 0, tilt: 0, dropY: 0, swayX: 0, swayY: 0,
    });
  };

  it('M1A barrel axis points exactly at the crosshair at every aim', () => {
    const model = resolveViewModel(WEAPONS.find((w) => w.id === 'service')!);
    for (const [cx, cy] of [[640, 300], [20, 20], [1260, 580], [640, 20], [640, 580], [20, 300], [1260, 300], [300, 450]]) {
      const p = pose('service', cx, cy, cx, cy);
      // Rotate the texture's tail->muzzle axis by the pose rotation and compare with muzzle->crosshair.
      const ax = model.muzzleX - model.tailX, ay = model.muzzleY - model.tailY;
      const cos = Math.cos(p.rotation), sin = Math.sin(p.rotation);
      const dirX = ax * cos - ay * sin, dirY = ax * sin + ay * cos;
      const toX = cx - p.muzzleX, toY = cy - p.muzzleY;
      const cross = (dirX * toY - dirY * toX) / (Math.hypot(dirX, dirY) * Math.hypot(toX, toY));
      const dot = dirX * toX + dirY * toY;
      expect(Math.abs(cross)).toBeLessThan(1e-6);
      expect(dot).toBeGreaterThan(0);
      // The muzzle is never closer than the minimum gap to the crosshair.
      expect(Math.hypot(toX, toY)).toBeGreaterThanOrEqual(model.muzzleGap - 1e-6);
    }
  });

  it('M1A only turns a few degrees as the crosshair sweeps the screen', () => {
    const center = pose('service', 640, 300, 640, 300).rotation;
    for (const [cx, cy] of [[20, 20], [1260, 580], [20, 580], [1260, 20]]) {
      expect(Math.abs(pose('service', cx, cy, cx, cy).rotation - center)).toBeLessThan(0.12);
    }
  });

  it('M1A slides with the crosshair and keeps the stock near the bottom when aiming high', () => {
    const center = pose('service', 640, 300, 640, 300);
    const left = pose('service', 170, 300, 170, 300);
    const high = pose('service', 640, 40, 640, 40);
    expect(left.pivotX).toBeLessThan(center.pivotX - 100);
    expect(left.rotation).toBeLessThan(center.rotation);
    // Aiming high pushes the muzzle further from the stock, not the whole gun up the screen.
    expect(high.pivotY).toBeGreaterThan(center.pivotY - 120);
    expect(high.muzzleY).toBeLessThan(center.muzzleY);
  });

  it('leaves the other view models on the legacy pivot behaviour', () => {
    const model = resolveViewModel(WEAPONS.find((w) => w.id === 'm4')!);
    expect(model.muzzleLock).toBe(false);
    const p = computeViewModelPose({
      model, textureWidth: 300, textureHeight: 400, aimX: 20, aimY: 80, cursorX: 0, cursorY: 0,
      kick: 0, kickRot: 0, tilt: 0, dropY: 0, swayX: 0, swayY: 0,
    });
    expect(p.pivotX).toBeCloseTo(model.pivotX + (20 - VIEW.centerX) * model.aimX);
    expect(p.pivotY).toBeCloseTo(model.pivotY + (80 - 300) * model.aimY);
  });
});
