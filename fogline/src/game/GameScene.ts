import Phaser from 'phaser';
import { audio, LoopHandle } from '../audio/AudioManager';
import { BUNKER_UPGRADE, DEFENSES, MODS, REPAIR_AMOUNT, SUPPORT, WALL_DURATION } from '../data/upgrades';
import { WEAPONS, WeaponDef } from '../data/weapons';
import { ECONOMY, FIELD, VIEW } from './config';
import { groundAt } from './perspective';
import { ProjectileManager } from '../entities/Projectile';
import { WeaponView } from '../entities/WeaponView';
import { Abilities } from '../systems/Abilities';
import { Battlefield } from '../systems/Battlefield';
import { BunkerManager } from '../systems/BunkerManager';
import { CombatSystem } from '../systems/CombatSystem';
import { EconomyManager } from '../systems/EconomyManager';
import { EnemyManager } from '../systems/EnemyManager';
import { Fx } from '../systems/Fx';
import { SaveManager } from '../systems/SaveManager';
import { buildCatalog, ShopItem } from '../systems/Shop';
import { SupportSystem } from '../systems/SupportSystem';
import { WaveManager } from '../systems/WaveManager';
import { WeaponManager } from '../systems/WeaponManager';
import { HUD } from '../ui/HUD';
import { toggleFullscreen } from '../ui/widgets';
import { isTestMode } from './testMode';
import { isAimTouch, resetTouchPointerIds, stepTouchAim, touchButtonAt, TouchButton } from './touchControls';
import { TouchUI } from '../ui/TouchUI';
import { Zombie } from '../entities/Zombie';
import type { ModId } from '../data/upgrades';

export interface RunSummary {
  victory: boolean;
  wave: number;
  kills: number;
  headshots: number;
  accuracy: number;
  earned: number;
}

/** The battle: fixed first-person bunker view, waves, shooting, economy. */
export class GameScene extends Phaser.Scene {
  economy!: EconomyManager;
  bunker!: BunkerManager;
  weapons!: WeaponManager;
  waves!: WaveManager;
  abilities!: Abilities;
  enemies!: EnemyManager;
  combat!: CombatSystem;
  support!: SupportSystem;
  catalog!: ShopItem[];
  upgrades = { reinforceLevel: 0 };
  private fx!: Fx;
  private field!: Battlefield;
  private view!: WeaponView;
  private hud!: HUD;
  private projectiles!: ProjectileManager;
  private activeMods = new Set<ModId>();
  private trigger = false;
  private touchUi!: TouchUI;
  /** Crosshair while playing by touch (relative drag aim). */
  private touchCursor: { x: number; y: number } = { x: VIEW.centerX, y: 300 };
  private touchLast: { x: number; y: number } = { x: 0, y: 0 };
  aimPointerId: number | null = null;
  firePointerId: number | null = null;
  private aimCursorX: number = VIEW.centerX;
  private aimCursorY = 300;
  private ambientLeft = 3;
  private wind: LoopHandle | null = null;
  private music: LoopHandle | null = null;
  private over = false;
  private hoverZone: string | null = null;
  /** Exposed for automated tests (window.__fogline). */
  debugLog: string[] = [];

  constructor() {
    super('Game');
  }

  create(data?: { openShop?: boolean }): void {
    this.over = false;
    this.trigger = false;
    resetTouchPointerIds(this);
    this.upgrades = { reinforceLevel: 0 };
    this.input.setDefaultCursor('none');
    this.input.mouse?.disableContextMenu();
    this.input.addPointer(2);

    this.economy = new EconomyManager(ECONOMY.startingCash);
    this.bunker = new BunkerManager();
    this.weapons = new WeaponManager();
    this.waves = new WaveManager();
    this.abilities = new Abilities();

    this.field = new Battlefield(this);
    this.enemies = new EnemyManager(this, 36);
    this.fx = new Fx(this);
    this.combat = new CombatSystem(this.enemies, this.fx, this.economy, this.waves, (head) => this.view.showHitMarker(head));
    this.projectiles = new ProjectileManager(this);
    this.support = new SupportSystem(this, this.enemies, this.combat, this.fx);
    this.support.shake = (d, i) => this.cameras.main.shake(d * 1000, i);
    this.projectiles.onImpact = (x, z, radius, damage, impactSound) => {
      const kills = this.combat.explode(x, z, radius, damage, 'blast');
      if (kills > 0) this.combat.stats.hits++;
      this.fx.explosion(x, z, radius * 0.8);
      audio.play(impactSound, { volume: Phaser.Math.Clamp(16 / z, 0.45, 1), pan: x / 20 });
      this.cameras.main.shake(160, Phaser.Math.Clamp(0.05 / z, 0.002, 0.007));
    };
    this.view = new WeaponView(this, this.weapons.current.def);
    this.catalog = buildCatalog({ economy: this.economy, weapons: this.weapons, abilities: this.abilities, bunker: this.bunker, upgrades: this.upgrades });
    this.hud = new HUD(this, {
      weapons: this.weapons, abilities: this.abilities, economy: this.economy, bunker: this.bunker, waves: this.waves, support: this.support,
    }, {
      weapon: (slot) => this.selectWeapon(slot),
      mod: (i) => this.activateMod(MODS[i].id),
      support: (i) => this.useSupport(i),
      defense: (i) => this.useDefense(i),
    });

    this.touchUi = new TouchUI(this);
    this.touchUi.setEnabled(this.prefersTouch());
    this.touchCursor = { x: VIEW.centerX, y: 300 };
    this.wireEvents();
    this.wireInput();

    const test = isTestMode();
    if (test) this.applyTestLoadout();

    this.wind = audio.loop('wind_loop', 0.55, 'sfx', 2);
    this.music = audio.loop('drone_loop', 0.55, 'music', 3);
    this.events.once('shutdown', () => this.teardown());

    this.hud.banner(
      'HOLD THE LINE',
      `${test ? 'TEST LOADOUT: all weapons and gear unlocked.  ' : ''}Contacts massing in the fog.  ${this.touchUi.isEnabled ? 'Tap DEPLOY to begin wave 1  ·  SHOP for the armory' : '[ENTER] begin wave 1  ·  [SPACE] armory'}`,
      999,
      true,
    );
    this.time.delayedCall(2600, () => {
      if (this.waves.phase === 'idle') this.startNextWave();
    });
    (window as unknown as { __fogline: GameScene }).__fogline = this;
    if (data?.openShop) this.time.delayedCall(0, () => this.openShop());
  }

  // ------------------------------------------------------------ wiring

  private wireEvents(): void {
    this.weapons.events.on('fire', ({ def, spread }) => this.onFire(def, spread));
    this.weapons.events.on('empty', ({ def }) => audio.play(def.sound.empty, { volume: 0.7 }));
    this.weapons.events.on('reloadStart', ({ def }) => audio.play(def.sound.reload, { volume: 0.85 }));
    this.weapons.events.on('switchStart', () => {
      this.view.beginSwitch();
      audio.play('switch_weapon', { volume: 0.7 });
    });
    this.weapons.events.on('switched', ({ def }) => this.view.setWeapon(def));

    this.enemies.onArrive = (z) => {
      if (z.def.special?.detonateDamage) {
        const dmg = this.combat.detonate(z);
        this.hitBunker(dmg, z);
        this.cameras.main.shake(260, 0.006);
      }
    };
    this.enemies.onStrike = (z) => {
      if (z.def.attackDamage > 0) this.hitBunker(z.def.attackDamage, z);
    };

    this.waves.events.on('countdown', ({ wave }) => {
      const def = this.waves.current!;
      this.hud.banner(`WAVE ${wave} — ${def.name.toUpperCase()}`, 'Hostiles inbound', 3.6);
      audio.play('wave_start', { volume: 0.75 });
    });
    this.waves.events.on('start', () => this.hud.clearBanner());
    this.waves.events.on('cleared', ({ wave, reward }) => {
      if (reward > 0) this.economy.earn(reward, 'wave');
      this.weapons.topUpStarter();
      audio.play('wave_clear', { volume: 0.7 });
      if (wave < this.waves.totalWaves) {
        this.hud.banner(`SECTOR CLEAR — WAVE ${wave}`, `Completion bonus +$${reward}\n${this.touchUi.isEnabled ? `SHOP for the armory  ·  tap DEPLOY for wave ${wave + 1}` : `[SPACE] armory  ·  [ENTER] deploy wave ${wave + 1}`}`, 999, true);
      } else {
        this.hud.banner('THE LINE HELD', `Final bonus +$${reward}`, 999, true);
      }
      if (!isTestMode()) {
        SaveManager.update((d) => {
          d.bestWave = Math.max(d.bestWave, wave);
          d.bestKills = Math.max(d.bestKills, this.combat.stats.kills);
        });
      }
    });
    this.waves.events.on('victory', () => this.time.delayedCall(2800, () => this.endRun(true)));

    this.bunker.events.on('destroyed', () => {
      this.waves.defeat();
      this.over = true;
      this.fx.whiteFlash(0.6, 0.8, 0x600000);
      audio.play('explosion', { volume: 1 });
      this.cameras.main.shake(700, 0.012);
      this.time.delayedCall(1600, () => this.endRun(false));
    });
  }

  /** True on phones/tablets whose primary pointer is a finger. */
  private prefersTouch(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  }

  private pressTouchButton(button: TouchButton, p: Phaser.Input.Pointer): void {
    switch (button) {
      case 'fire':
        this.firePointerId = p.id;
        this.trigger = true;
        this.touchUi.setPressed('fire', true);
        break;
      case 'reload':
        this.weapons.reload();
        this.flashButton('reload');
        break;
      case 'pause':
        this.openPause();
        break;
      case 'shop':
        this.openShop();
        break;
      case 'deploy':
        this.startNextWave();
        break;
    }
  }

  private flashButton(button: TouchButton): void {
    this.touchUi.setPressed(button, true);
    this.time.delayedCall(140, () => this.touchUi.setPressed(button, false));
  }

  private wireInput(): void {
    const kb = this.input.keyboard!;
    kb.addCapture('SPACE,ENTER,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,A,S,D,W,E,R');
    const map: Record<string, () => void> = {
      ONE: () => this.selectWeapon(1), TWO: () => this.selectWeapon(2), THREE: () => this.selectWeapon(3), FOUR: () => this.selectWeapon(4),
      FIVE: () => this.activateMod('double'), SIX: () => this.activateMod('ap'), SEVEN: () => this.activateMod('fire'), EIGHT: () => this.activateMod('cryo'),
      A: () => this.useSupport(0), S: () => this.useSupport(1), D: () => this.useSupport(2),
      W: () => this.useDefense(0), E: () => this.useDefense(1),
      R: () => this.weapons.reload(),
      SPACE: () => this.openShop(),
      ENTER: () => this.startNextWave(),
      ESC: () => this.openPause(),
      P: () => this.openPause(),
      F: () => toggleFullscreen(this),
    };
    for (const [k, fn] of Object.entries(map)) kb.on(`keydown-${k}`, () => { if (!this.over) fn(); });
    // Number keys on the numpad too
    kb.on('keydown', (e: KeyboardEvent) => {
      if (this.over) return;
      const n = Number(e.key);
      if (e.code.startsWith('Numpad') && n >= 1 && n <= 4) this.selectWeapon(n);
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      audio.unlock();
      if (p.wasTouch) {
        document.body.classList.add('touched');
        this.touchUi.setEnabled(true);
        // HUD slots handle their own taps; only the battlefield is routed here.
        if (p.y >= VIEW.hudTop) return;
        const button = touchButtonAt(p.x, p.y, this.touchUi.deployVisible);
        if (button) {
          if (button !== 'fire' || this.firePointerId === null) this.pressTouchButton(button, p);
          return;
        }
        if (this.aimPointerId === null && isAimTouch(p.x, p.y)) {
          this.aimPointerId = p.id;
          this.touchLast.x = p.x;
          this.touchLast.y = p.y;
          this.touchUi.noteAimUsed();
        }
        return;
      }
      if (!this.prefersTouch()) this.touchUi.setEnabled(false);
      if (p.rightButtonDown()) {
        this.weapons.reload();
        return;
      }
      if (p.leftButtonDown() && p.y < VIEW.hudTop) this.trigger = true;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      // A real mouse on a hybrid laptop switches the on-screen controls off.
      if (!p.wasTouch && this.touchUi.isEnabled && !this.prefersTouch()) this.touchUi.setEnabled(false);
      if (p.wasTouch && p.id === this.aimPointerId) {
        const next = stepTouchAim(this.touchCursor, p.x - this.touchLast.x, p.y - this.touchLast.y);
        this.touchCursor.x = next.x;
        this.touchCursor.y = next.y;
        this.touchLast.x = p.x;
        this.touchLast.y = p.y;
      }
    });

    const releasePointer = (p: Phaser.Input.Pointer): void => {
      if (p.wasTouch) {
        if (p.id === this.firePointerId) {
          this.firePointerId = null;
          this.trigger = false;
          this.touchUi.setPressed('fire', false);
        }
        if (p.id === this.aimPointerId) this.aimPointerId = null;
      }
    };

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) {
        releasePointer(p);
        return;
      }
      if (!p.leftButtonDown()) this.trigger = false;
    });
    this.input.on('pointerupoutside', releasePointer);
    this.input.on('gameout', () => { this.trigger = false; });
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
  }

  private onBlur(): void {
    this.trigger = false;
    this.aimPointerId = null;
    this.firePointerId = null;
    this.touchUi?.setPressed('fire', false);
    if (this.scene.isActive() && !this.over && this.waves.phase === 'active') this.openPause();
  }

  private teardown(): void {
    this.wind?.stop(0.3);
    this.music?.stop(0.6);
    this.support.clear();
    this.projectiles.clear();
    this.enemies.clear();
    this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
    audio.setLoopsPaused(false);
  }

  // ------------------------------------------------------------ actions

  startNextWave(): boolean {
    if (this.over) return false;
    const ok = this.waves.startNext();
    if (ok) this.hud.clearBanner();
    return ok;
  }

  selectWeapon(slot: number): void {
    if (!this.weapons.selectSlot(slot)) {
      const def = WEAPONS.find((w) => w.slot === slot);
      if (def && !this.weapons.owns(def.id)) {
        audio.play('deny', { volume: 0.5 });
        this.fx.floatText(VIEW.centerX, VIEW.hudTop - 90, `${def.shortName} NOT OWNED — BUY IN THE ARMORY${this.touchUi.isEnabled ? '' : ' [SPACE]'}`, '#ff9a70', 16);
      }
    }
  }

  /** Test mode: own every weapon, fill all charges, fund the armory and max the bunker. */
  private applyTestLoadout(): void {
    for (const w of WEAPONS) this.weapons.grant(w.id);
    this.economy.earn(500_000, 'refund');
    for (const m of this.abilities.mods.values()) {
      m.charges = m.max;
      m.cooldownLeft = 0;
    }
    for (const s of this.abilities.support.values()) {
      s.charges = s.max;
      s.cooldownLeft = 0;
    }
    for (const d of this.abilities.defense.values()) {
      d.charges = d.max;
      d.cooldownLeft = 0;
    }
    const finalLevel = BUNKER_UPGRADE.levels[BUNKER_UPGRADE.levels.length - 1];
    this.upgrades.reinforceLevel = BUNKER_UPGRADE.levels.length;
    this.bunker.setMax(finalLevel.maxHealth);
  }

  activateMod(id: ModId): void {
    if (this.abilities.activateMod(id)) {
      audio.play('mod_on', { volume: 0.8 });
      const m = MODS.find((x) => x.id === id)!;
      this.fx.floatText(VIEW.centerX, VIEW.hudTop - 90, `${m.name.toUpperCase()} LOADED`, '#ffe090', 18);
    } else {
      audio.play('deny', { volume: 0.5 });
    }
  }

  useSupport(i: number): void {
    const def = SUPPORT[i];
    if (def.id === 'gunship' && this.support.gunshipActive) return;
    if (!this.abilities.useSupport(def.id)) {
      audio.play('deny', { volume: 0.5 });
      return;
    }
    const aimX = this.aimCursorX;
    const aimY = this.aimCursorY;
    if (def.id === 'gunship') this.support.callGunship();
    else if (def.id === 'orbital') this.support.callOrbital(aimX, Math.min(aimY, VIEW.wallTop - 4));
    else this.support.callNuke();
  }

  useDefense(i: number): void {
    const def = DEFENSES[i];
    if (def.id === 'repair' && this.bunker.health >= this.bunker.max) {
      audio.play('deny', { volume: 0.5 });
      return;
    }
    if (!this.abilities.useDefense(def.id)) {
      audio.play('deny', { volume: 0.5 });
      return;
    }
    if (def.id === 'repair') {
      const healed = this.bunker.repair(REPAIR_AMOUNT);
      audio.play('repair', { volume: 0.8 });
      this.fx.floatText(1140, VIEW.hudTop - 20, `+${Math.round(healed)} HP`, '#8ae070', 22);
    } else {
      this.bunker.raiseShield(WALL_DURATION);
      audio.play('shutters_up', { volume: 0.9 });
      this.cameras.main.shake(180, 0.004);
    }
  }

  openShop(): void {
    if (this.over || this.scene.isPaused()) return;
    this.trigger = false;
    audio.play('shop_open', { volume: 0.7 });
    audio.setLoopsPaused(true);
    this.scene.pause();
    this.scene.launch('Shop');
  }

  openPause(): void {
    if (this.over || this.scene.isPaused()) return;
    this.trigger = false;
    audio.setLoopsPaused(true);
    this.scene.pause();
    this.scene.launch('Pause');
  }

  /** Called by overlay scenes when they close. */
  resumeFromOverlay(): void {
    audio.setLoopsPaused(false);
    this.trigger = false;
    this.scene.resume();
  }

  private endRun(victory: boolean): void {
    const s = this.combat.stats;
    const summary: RunSummary = {
      victory, wave: this.waves.wave, kills: s.kills, headshots: s.headshotKills,
      accuracy: s.shots ? s.hits / s.shots : 0, earned: this.economy.totalEarned,
    };
    if (!isTestMode()) {
      SaveManager.update((d) => {
        d.bestWave = Math.max(d.bestWave, victory ? this.waves.wave : this.waves.wave - 1);
        d.bestKills = Math.max(d.bestKills, s.kills);
      });
    }
    this.over = true;
    this.hud.hideBanner();
    this.scene.pause();
    this.scene.launch('GameOver', summary);
  }

  private hitBunker(amount: number, z: Zombie): void {
    if (amount <= 0) return;
    const pan = (z.sx - VIEW.centerX) / VIEW.centerX;
    this.bunker.damage(amount);
    if (this.bunker.shielded) {
      audio.play('shutter_hit', { volume: 0.6, pan, rate: 0.9 + Math.random() * 0.2 });
      return;
    }
    audio.play(`bunker_hit_${Math.floor(Math.random() * 2)}`, { volume: 0.75, pan, rate: 0.9 + Math.random() * 0.2 });
    audio.play('claw', { volume: 0.35, pan });
    this.fx.damageFlash(amount);
    this.fx.sandbagImpact(z.sx + (Math.random() - 0.5) * 80, VIEW.wallTop + 6);
    this.cameras.main.shake(90, 0.0025);
  }

  // ------------------------------------------------------------ firing

  private onFire(def: WeaponDef, spread: number): void {
    const aimX = this.aimCursorX;
    const aimY = this.aimCursorY;
    this.view.fire(def);
    const rate = 1 + (Math.random() * 2 - 1) * def.sound.pitchJitter;
    audio.play(def.sound.shot, { volume: def.id === 'm4' ? 0.85 : 1, rate });
    if (def.shake > 0) this.cameras.main.shake(70, def.shake);
    if (def.kind === 'grenade') {
      const hit = this.enemies.raycast(aimX, aimY);
      let tx: number, tz: number;
      if (hit) {
        tx = hit.zombie.x;
        tz = hit.zombie.z;
      } else {
        const g = groundAt(aimX, Math.max(aimY, VIEW.horizonY + 3));
        tz = Phaser.Math.Clamp(g.z, 5, FIELD.spawnZ);
        tx = (g.x * tz) / Math.max(g.z, 0.001);
      }
      this.combat.stats.shots++;
      this.projectiles.launch(this.view.muzzle.x, this.view.muzzle.y, tx, tz, def.projectileSpeed ?? 40, def.damage, def.blastRadius ?? 5, def.sound.impact);
      return;
    }
    // random point inside the spread circle (uniform disc)
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * spread;
    const x = aimX + Math.cos(a) * r, y = aimY + Math.sin(a) * r;
    this.combat.fireHitscan(def, x, y, this.view.muzzle.x, this.view.muzzle.y);
    this.fx.ejectCasing(this.view.ejectPort.x, this.view.ejectPort.y);
  }

  // ------------------------------------------------------------ loop

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const p = this.input.activePointer;
    // The crosshair is exactly where the mouse is (or where the touch aim pad
    // has dragged it); the gun is then rotated to point its barrel at it.
    const touchMode = this.touchUi.isEnabled;
    const cursorAimX = Phaser.Math.Clamp(touchMode ? this.touchCursor.x : p.x, 0, VIEW.width);
    const cursorAimY = Phaser.Math.Clamp(touchMode ? this.touchCursor.y : p.y, 0, VIEW.hudTop);
    this.aimCursorX = cursorAimX;
    this.aimCursorY = cursorAimY;
    const gunAimX = cursorAimX;
    const gunAimY = cursorAimY;
    const pointerY = touchMode ? 300 : p.y;

    if (!this.over) {
      for (const req of this.waves.update(dt)) {
        this.enemies.spawn(req.enemy, req.healthMul, req.speedMul);
        this.waves.notifySpawned(1);
      }
    }
    this.abilities.update(dt);
    this.combat.setActiveMods(this.abilities.activeMods(this.activeMods));
    this.bunker.update(dt);
    this.field.raiseShutters(this.bunker.shielded);
    this.combat.coverTop = this.field.coverTop;
    this.combat.shuttersUp = this.bunker.shielded;

    const inField = pointerY < VIEW.hudTop && pointerY > 0;
    this.weapons.update(dt, this.trigger && inField && !this.over);

    this.enemies.update(dt);
    this.combat.update(dt);
    this.support.update(dt);
    this.projectiles.update(dt);
    this.fx.update(dt);
    this.field.update(dt);

    const hover = inField ? this.enemies.raycast(cursorAimX, cursorAimY) : null;
    this.hoverZone = hover ? hover.zone : null;
    this.view.update(dt, cursorAimX, cursorAimY, gunAimX, gunAimY, this.weapons.spread, this.weapons.reloadProgress, this.weapons.reloading, this.hoverZone === 'head', !!hover);
    this.view.setVisible(!this.over);
    this.hud.update(dt);
    const w = this.waves;
    this.touchUi.update(dt, {
      reloading: this.weapons.reloading,
      reloadProgress: this.weapons.reloadProgress,
      deploy: w.canStartNext && w.remaining === 0 && !this.over ? `DEPLOY WAVE ${w.wave + 1}` : null,
      inputLocked: this.over,
    });
    this.updateAmbience(dt);
  }

  private updateAmbience(dt: number): void {
    // individual groans from enemies on the field
    for (const z of this.enemies.live) {
      if (!z.alive) continue;
      z.groanLeft -= dt;
      if (z.groanLeft <= 0) {
        const [a, b] = z.def.groanInterval;
        z.groanLeft = a + Math.random() * (b - a);
        const n = z.def.voice === 'groan_shambler' ? 3 : z.def.voice === 'groan_runner' || z.def.voice === 'groan_plated' ? 2 : 1;
        const dist = z.z;
        audio.play(`${z.def.voice}_${Math.floor(Math.random() * n)}`, {
          volume: Phaser.Math.Clamp(6 / dist, 0.05, 0.75),
          pan: (z.sx - VIEW.centerX) / VIEW.centerX * 0.8,
          muffle: dist > 25 ? 900 : dist > 12 ? 2200 : 20000,
          rate: 0.92 + Math.random() * 0.16,
        });
      }
    }
    // the horde out in the fog
    this.ambientLeft -= dt;
    if (this.ambientLeft <= 0) {
      this.ambientLeft = 3 + Math.random() * 6;
      audio.play(`groan_shambler_${Math.floor(Math.random() * 3)}`, { volume: 0.12, pan: Math.random() * 2 - 1, muffle: 500, rate: 0.75 + Math.random() * 0.2 });
    }
    // burning barrel near the wire
    if (Math.random() < dt * 12) {
      const b = this.field.barrelFire;
      this.fx.fireBurst(b.x + (Math.random() - 0.5) * 18 * b.s, b.y, b.s * 0.7, 1);
    }
    if (Math.random() < dt * 2.2) {
      const s = this.field.smokeSource;
      this.fx.smokeColumn(s.x + Math.random() * 6, s.y, 0.14, 1);
    }
  }
}
