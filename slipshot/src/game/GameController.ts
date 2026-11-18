import { ARENA, COMBAT, FORTRESS, PHYSICS, PLAYER_ID, RECOVERY, SLIME, STAMINA } from '../config';
import { EnemyAI } from '../ai/EnemyAI';
import { previewPath, solveLowArc, type Vec2 } from '../ai/ballistics';
import { InputManager, type PointerPoint } from '../input/InputManager';
import { PhysicsManager } from '../physics/PhysicsManager';
import { Projectile } from '../physics/Projectile';
import { PhysicsObject } from '../physics/PhysicsObject';
import { Ragdoll, type Team } from '../physics/Ragdoll';
import { SLIME_COLOR, SlimeSystem } from '../physics/SlimeSystem';
import { Camera, type WorldPoint } from '../render/Camera';
import { Effects } from '../render/Effects';
import { Renderer, type AimView, type BuildView, type CoinView, type HandView, type Scene } from '../render/Renderer';
import { UIManager, type BuildModel, type CatalogModel, type CatalogTab, type FortressModel } from '../ui/UIManager';
import { clamp, lerp, randRange } from '../util/math';
import { Arena } from './Arena';
import { CombatSystem, type CombatContext } from './Combat';
import { Fortress, type FortressPiece } from './Fortress';
import { FORTRESS_ITEMS, fortressItem, type FortressItemId } from './fortressItems';
import {
  CHILD_SHOT,
  REPAIR_KIT,
  UPGRADES,
  UPGRADE_LEVEL_CAP,
  WEAPONS,
  type ShotSpec,
  type WeaponDef,
  type UpgradeId,
  type WeaponId,
} from './catalog';
import { ComboMeter } from './Combo';
import { Mechanics, type Well } from './Mechanics';
import { Progression } from './Progression';

/** Run phases. The menu and paused states sit outside these. */
type Phase = 'playing' | 'clearing' | 'shop' | 'dying' | 'gameover';
type Overlay = 'menu' | 'hud' | 'pause' | 'catalog' | 'gameover' | 'build';
type CatalogFrom = 'menu' | 'pause' | 'shop' | 'build';

const ENEMY_SHOT: ShotSpec = { ...WEAPONS[0].shot, color: '#c77dff' };
const CANNON_SHOT: ShotSpec = { ...WEAPONS[0].shot, color: '#ffd23f', damageMul: 0.8 };

/**
 * The bare-hands throw, in seconds: the arm winds back over the shoulder, whips
 * through the aim (the blob leaves the hand partway through the swing), then
 * follows through low and forward.
 */
const THROW_WIND = 0.1;
const THROW_SWING = 0.08;
const THROW_FOLLOW = 0.2;
/** Share of the swing at which the blob leaves the hand. */
const THROW_RELEASE = 0.45;

interface ThrowAnim {
  t: number;
  dir: Vec2;
  power: number;
  phi: number;
  released: boolean;
}

/** A coin flung out of a KO that flies to the player and is collected. Visual only: the coins are already banked. */
interface CoinDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  value: number;
  spin: number;
}

/** A piece being dragged in build mode. The screen point is canvas-relative CSS pixels. */
interface BuildDrag {
  item: FortressItemId;
  screen: PointerPoint;
}
/** Drag below this many CSS pixels is a tap, not a shot. */
const DEAD_ZONE_PX = 10;
/** Shots that leave the arena are removed past this height and depth. */
const DEEP = -20;
const HIGH = 60;
/** KO slow motion: how long it lasts, and the time scale it starts at before easing back to 1. */
const KO_SLOW_TIME = 0.7;
const KO_SLOW_SCALE = 0.3;

interface Drag {
  anchorX: number;
  anchorY: number;
  curX: number;
  curY: number;
}

/** Aim arc limits for the front arm, in radians (see Ragdoll joint limits). */
const AIM_MIN = -1.5;
const AIM_MAX = 3.3;

/**
 * Owns the screens and the game loop. The menu shows an idle arena. A run
 * steps the fixed physics timestep with an accumulator and renders between
 * steps. Pause freezes the simulation. The catalog (weapons, upgrades, field
 * kit) opens from the menu, the pause menu, or between waves.
 */
export class GameController {
  private readonly canvas: HTMLCanvasElement;
  private readonly camera = new Camera();
  private readonly renderer: Renderer;
  private readonly ui: UIManager;
  private readonly progression = new Progression();
  private readonly combo = new ComboMeter();

  private physics!: PhysicsManager;
  private arena!: Arena;
  private effects!: Effects;
  private slime!: SlimeSystem;
  private combat!: CombatSystem;
  private mechanics!: Mechanics;
  private fortress!: Fortress;
  private throwAnim: ThrowAnim | null = null;
  /** Recent hand positions during a throw, for the swoosh. Age in seconds. */
  private throwTrail: { x: number; y: number; age: number }[] = [];
  /** Cooldown length of the last shot, so the next blob can grow back in the hand. */
  private cooldownTotal = 1;
  private coinDrops: CoinDrop[] = [];
  /** Coins already banked but still flying to the player; the HUD shows them as they land. */
  private pendingCoins = 0;
  private buildDrag: BuildDrag | null = null;
  private buildRot: 0 | 1 = 0;
  private buildReturn: Overlay = 'hud';
  private buildCatalogFrom: CatalogFrom = 'menu';

  private player!: Ragdoll;
  private enemies: Ragdoll[] = [];
  private ais = new Map<Ragdoll, EnemyAI>();
  /** Seconds until each downed enemy's next kip-up attempt. */
  private getUpWait = new Map<Ragdoll, number>();
  private projectiles: Projectile[] = [];
  private nextId = PLAYER_ID;

  private screen: 'menu' | 'run' = 'menu';
  private overlay: Overlay = 'menu';
  private paused = false;
  private phase: Phase = 'playing';
  private phaseTimer = 0;
  private shopBonus = 0;
  /** Enemies defeated this wave, and enemies spawned so far this wave. */
  private waveKills = 0;
  private waveSpawned = 0;
  /** Stamina, the air-jump flag, and a short flash when stamina runs out. */
  private stamina = STAMINA.max;
  private airJumpUsed = false;
  /** Seconds the player has been off the ground, for landing feedback. */
  private playerAirTime = 0;
  private staminaFlash = 0;
  /** Seconds of KO slow motion left. */
  private slowMo = 0;
  private catalogFrom: CatalogFrom = 'menu';
  private catalogTab: CatalogTab = 'weapons';
  private accumulator = 0;
  private lastFrame: number | null = null;
  private time = 0;
  private shotCooldown = 0;
  private aimHold = 0;
  private lastAimPhi: number | null = null;

  private drag: Drag | null = null;
  private aimDir: Vec2 | null = null;
  private aimPower = 0;
  private aimActive = false;
  private readonly aimView: AimView = { active: false, power: 0, anchor: null, pointer: null, path: [], landing: null };
  private hintShown = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas, this.camera);
    this.ui = new UIManager({
      onPlay: () => this.startRun(),
      onMenuCatalog: (tab) => this.openCatalog('menu', tab),
      onPause: () => this.openPause(),
      onResume: () => this.resume(),
      onPauseCatalog: (tab) => this.openCatalog('pause', tab),
      onRestartRun: () => this.startRun(),
      onMainMenu: () => this.toMainMenu(),
      onCatalogTab: (tab) => this.setCatalogTab(tab),
      onCatalogClose: () => this.closeCatalog(),
      onCycleWeapon: () => this.cycleWeapon(),
      onBuyWeapon: (id) => this.buyWeapon(id),
      onEquipWeapon: (id) => this.equipWeapon(id),
      onBuyUpgrade: (id) => this.buyUpgrade(id),
      onBuyRepair: () => this.buyRepair(),
      onUnlockItem: (id) => this.unlockItem(id),
      onBuyItem: (id) => this.buyItem(id),
      onEnterBuild: () => this.enterBuild(),
      onExitBuild: () => this.exitBuild(),
      onRotateBuild: () => this.rotateBuild(),
      onBuildShop: () => this.openCatalog('build', 'fortress'),
      onTrayDrag: (id, clientX, clientY) => this.startTrayDrag(id, clientX, clientY),
      onResetProfile: () => this.resetProfile(),
      onJump: () => this.jump(),
    });
    // Build-mode drags can start on the DOM tray, so they are tracked on the window.
    window.addEventListener('pointermove', (e) => this.buildPointerMove(e));
    window.addEventListener('pointerup', (e) => this.buildPointerUp(e));
    window.addEventListener('pointercancel', () => this.cancelBuildDrag());
    new InputManager(canvas, {
      onDown: (p) => this.pointerDown(p),
      onMove: (p) => this.pointerMove(p),
      onUp: (p) => this.pointerUp(p),
      onCancel: () => {
        this.drag = null;
      },
    });
    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('keydown', (e) => {
      if (this.overlay === 'build') {
        if (e.key === 'Escape') this.exitBuild();
        else if (e.key === 'r' || e.key === 'R') this.rotateBuild();
        return;
      }
      if (e.key === 'Escape') this.togglePause();
      else if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        this.jump();
      }
    });
    this.renderer.resize();
    this.toMainMenu();
  }

  start(): void {
    const loop = (now: number): void => {
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---- Screens ---------------------------------------------------------

  /** Build a fresh world: arena, player, no enemies. Used for the menu and for every run. */
  private buildWorld(): void {
    this.physics = new PhysicsManager();
    this.effects = new Effects();
    this.slime = new SlimeSystem(this.effects);
    this.combat = new CombatSystem(this.physics, this.slime, this.effects);
    this.mechanics = new Mechanics();
    this.arena = new Arena(this.physics);
    this.fortress = new Fortress(this.physics, this.arena, this.progression.layout);
    // Saved pieces that could not stand (old or bad data) go back to the inventory.
    for (const saved of this.fortress.rejected) this.progression.pickUpItem(saved);
    this.throwAnim = null;
    this.throwTrail = [];
    this.coinDrops = [];
    this.pendingCoins = 0;
    this.buildDrag = null;
    this.projectiles = [];
    this.enemies = [];
    this.ais.clear();
    this.getUpWait.clear();
    this.combo.break();
    this.nextId = PLAYER_ID;
    this.player = this.spawnRagdoll('player', 1, ARENA.playerSpawnX, COMBAT.playerMaxHp);
    this.applyPlayerStats();
    this.drag = null;
    this.shotCooldown = 0;
    this.aimHold = 0;
    this.lastAimPhi = null;
    this.accumulator = 0;
    this.slowMo = 0;
  }

  /** Main menu over an idle arena. Nothing steps until a run starts. */
  private toMainMenu(): void {
    this.buildWorld();
    this.screen = 'menu';
    this.paused = false;
    this.phase = 'playing';
    this.setOverlay('menu');
    this.refreshMenu();
  }

  private refreshMenu(): void {
    this.ui.showMenu({
      coins: this.progression.coins,
      weaponId: this.progression.equipped,
      weaponName: this.progression.weapon.name,
      fortressPieces: this.progression.layout.length,
    });
  }

  /** Start a new run: fresh world, wave 1. Coins, weapons and upgrades carry over. */
  private startRun(): void {
    this.buildWorld();
    this.progression.startRun();
    this.screen = 'run';
    this.paused = false;
    this.phase = 'playing';
    this.phaseTimer = 0;
    this.shopBonus = 0;
    this.hintShown = true;
    this.stamina = STAMINA.max;
    this.airJumpUsed = false;
    this.playerAirTime = 0;
    this.startWave();
    this.setOverlay('hud');
    this.ui.showHint();
  }

  private setOverlay(o: Overlay): void {
    this.overlay = o;
    this.ui.showOverlay(o);
  }

  private togglePause(): void {
    if (this.screen !== 'run') return;
    if (this.overlay === 'pause') this.resume();
    else if (this.overlay === 'hud' && (this.phase === 'playing' || this.phase === 'clearing')) this.openPause();
  }

  private openPause(): void {
    if (this.screen !== 'run' || this.overlay !== 'hud') return;
    if (this.phase !== 'playing' && this.phase !== 'clearing') return;
    this.paused = true;
    this.drag = null;
    this.setOverlay('pause');
  }

  private resume(): void {
    if (this.overlay !== 'pause') return;
    this.paused = false;
    this.setOverlay('hud');
  }

  // ---- Catalog (weapons, upgrades, field kit) ---------------------------

  private openCatalog(from: CatalogFrom, tab: CatalogTab): void {
    this.catalogFrom = from;
    this.catalogTab = tab;
    this.setOverlay('catalog');
    this.renderCatalog();
  }

  /** Open the catalog as the between-waves shop. */
  private openShop(): void {
    this.phase = 'shop';
    this.shopBonus = this.progression.waveBonusCoins();
    this.progression.earnCoins(this.shopBonus);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + COMBAT.healOnWaveClear);
    this.openCatalog('shop', 'weapons');
  }

  private setCatalogTab(tab: CatalogTab): void {
    this.catalogTab = tab;
    this.renderCatalog();
  }

  private closeCatalog(): void {
    if (this.overlay !== 'catalog') return;
    if (this.catalogFrom === 'build') {
      this.setOverlay('build');
      this.renderBuild();
    } else if (this.catalogFrom === 'shop') {
      this.nextWave();
    } else if (this.catalogFrom === 'pause') {
      this.setOverlay('pause');
    } else {
      this.setOverlay('menu');
      this.refreshMenu();
    }
  }

  private nextWave(): void {
    if (this.phase !== 'shop') return;
    this.progression.wave++;
    this.startWave();
    this.setOverlay('hud');
  }

  private fortressModel(): FortressModel {
    const p = this.progression;
    return {
      canPlace: this.catalogFrom !== 'build',
      items: FORTRESS_ITEMS.map((d) => ({
        id: d.id,
        name: d.name,
        blurb: d.blurb,
        color: d.color,
        hp: d.hp,
        price: d.price,
        unlock: d.unlock,
        unlocked: p.isUnlocked(d.id),
        canUnlock: p.canUnlockItem(d.id),
        canBuy: p.canBuyItem(d.id),
        owned: p.itemCount(d.id),
        placed: p.placedCount(d.id),
        maxPlaced: d.maxPlaced,
      })),
    };
  }

  private unlockItem(id: FortressItemId): void {
    if (this.overlay !== 'catalog') return;
    this.progression.unlockItem(id);
    this.renderCatalog();
  }

  private buyItem(id: FortressItemId): void {
    if (this.overlay !== 'catalog') return;
    this.progression.buyItem(id);
    this.renderCatalog();
  }

  private catalogModel(): CatalogModel {
    const p = this.progression;
    const inShop = this.catalogFrom === 'shop';
    return {
      from: this.catalogFrom,
      tab: this.catalogTab,
      coins: p.coins,
      wave: p.wave,
      bonus: this.shopBonus,
      equipped: p.equipped,
      fortress: this.fortressModel(),
      weapons: WEAPONS.map((w) => ({
        id: w.id,
        name: w.name,
        blurb: w.blurb,
        badge: w.badge,
        color: w.color,
        price: w.price,
        owned: p.isOwned(w.id),
        equipped: p.equipped === w.id,
        canBuy: !p.isOwned(w.id) && p.coins >= w.price,
        // Meters: damage per trigger pull, rate of fire, projectile speed.
        power: Math.min(1, (w.shot.damageMul * w.shots) / 2.2),
        rate: Math.min(1, 0.45 / (w.cooldown * p.reloadMultiplier)),
        speed: Math.min(1, w.speedMul / 1.6),
      })),
      upgrades: UPGRADES.map((u) => ({
        id: u.id,
        name: u.name,
        blurb: u.blurb,
        level: p.levels[u.id],
        cap: UPGRADE_LEVEL_CAP,
        cost: p.upgradeCost(u.id),
        canBuy: p.canUpgrade(u.id),
      })),
      repair: {
        cost: REPAIR_KIT.price,
        heal: REPAIR_KIT.heal,
        canBuy: inShop && p.coins >= REPAIR_KIT.price && this.player.hp < this.player.maxHp,
      },
      showKit: inShop,
    };
  }

  private renderCatalog(): void {
    this.ui.showCatalog(this.catalogModel());
  }

  private buyWeapon(id: WeaponId): void {
    if (this.overlay !== 'catalog') return;
    // Buying a weapon equips it straight away.
    if (this.progression.buyWeapon(id)) this.progression.equipWeapon(id);
    this.renderCatalog();
  }

  private equipWeapon(id: WeaponId): void {
    if (this.overlay !== 'catalog') return;
    this.progression.equipWeapon(id);
    this.renderCatalog();
  }

  private buyUpgrade(id: UpgradeId): void {
    if (this.overlay !== 'catalog') return;
    if (this.progression.buyUpgrade(id)) this.applyPlayerStats();
    this.renderCatalog();
  }

  private buyRepair(): void {
    if (this.overlay !== 'catalog' || this.catalogFrom !== 'shop') return;
    if (this.progression.buyRepairKit()) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + REPAIR_KIT.heal);
    }
    this.renderCatalog();
  }

  private cycleWeapon(): void {
    if (this.overlay !== 'hud') return;
    this.progression.cycleWeapon();
  }

  private resetProfile(): void {
    if (!window.confirm('Erase all coins, weapons and upgrades?')) return;
    this.progression.resetProfile();
    this.toMainMenu();
  }

  /** Push upgrade levels onto the player's ragdoll. */
  private applyPlayerStats(): void {
    const p = this.progression;
    const newMax = COMBAT.playerMaxHp + p.maxHpBonus;
    const gained = Math.max(0, newMax - this.player.maxHp);
    this.player.maxHp = newMax;
    this.player.hp = Math.min(newMax, this.player.hp + gained);
    this.player.incomingMul = p.incomingMultiplier;
    this.player.slipResist = p.slipResist;
    this.player.staggerMul = p.staggerMultiplier;
  }

  // ---- Frame loop -------------------------------------------------------

  private frame(now: number): void {
    // Clamp to [0, maxFrameDt]: time must never run backwards into the physics or the camera.
    const dtReal = this.lastFrame === null ? 0 : clamp((now - this.lastFrame) / 1000, 0, PHYSICS.maxFrameDt);
    this.lastFrame = now;
    this.time += dtReal;

    // A damage hit stops the simulation for a few dozen milliseconds while the
    // camera and effects keep moving, so the impact reads as a punch rather
    // than a skipped frame.
    const frozen = this.combat.consumeHitstop(dtReal);
    // After a KO, time runs slow and eases back to full speed.
    const slow = this.slowMo > 0 ? lerp(KO_SLOW_SCALE, 1, 1 - this.slowMo / KO_SLOW_TIME) : 1;
    this.slowMo = Math.max(0, this.slowMo - (dtReal - frozen));
    const simDt = (dtReal - frozen) * slow;

    const running = this.screen === 'run' && !this.paused;
    if (running) {
      this.accumulator += simDt;
      while (this.accumulator >= PHYSICS.fixedDt) {
        this.snapshotAll();
        this.fixedUpdate(PHYSICS.fixedDt);
        this.accumulator -= PHYSICS.fixedDt;
      }
    } else {
      this.accumulator = 0;
      // Build mode freezes the fight, but placement dust and pop-ins still play.
      if (this.overlay === 'build') {
        this.effects.update(dtReal);
        this.fortress.animate(dtReal);
      }
    }
    const alpha = this.accumulator / PHYSICS.fixedDt;

    this.updateAim();
    this.camera.addTrauma(this.combat.trauma);
    this.combat.trauma = 0;
    this.camera.frame(dtReal, this.cameraTargets());

    this.renderer.draw(this.scene(alpha));
    if (this.screen === 'run') {
      const quota = this.progression.waveQuota();
      this.ui.setHud({
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        wave: this.progression.wave,
        score: this.progression.score,
        // Coins still flying to the player are not shown yet: the counter ticks up as they land.
        coins: this.progression.coins - this.pendingCoins,
        weaponId: this.progression.equipped,
        weaponName: this.progression.weapon.name,
        progress: quota > 0 ? this.waveKills / quota : 0,
        stamina: this.stamina,
        maxStamina: STAMINA.max,
        staminaFlash: this.staminaFlash > 0,
        combo: this.combo.count,
        comboTime: this.combo.fraction,
        // Briefly ignore the first frames of a landing so the label does not
        // flicker between Jump and Get up while the body settles.
        canGetUp: this.player.isDown() && this.player.downTime > 0.12,
      });
    }
  }

  private snapshotAll(): void {
    for (const r of this.allRagdolls()) r.snapshot();
    for (const o of this.arena.objects) o.snapshot();
    this.fortress.snapshot();
    this.slime.snapshot();
    for (const p of this.projectiles) p.snapshot();
  }

  /** One fixed physics step, plus the game logic that runs with it. */
  private fixedUpdate(dt: number): void {
    // Contacts from the last step tell us who is standing, who is flat and who
    // has a surface to push against.
    this.physics.refreshContacts(this.allRagdolls());
    this.combo.update(dt);
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.aimHold = Math.max(0, this.aimHold - dt);

    // Player arm: a throw in progress drives it; otherwise follow the aim while
    // dragging, and hold briefly after a shot.
    if (this.throwAnim) this.updateThrow(dt);
    else if (this.aimActive && this.aimDir) this.player.setAim(aimBodyAngle(this.aimDir));
    else if (this.aimHold > 0) this.player.setAim(this.lastAimPhi);
    else this.player.setAim(null);
    for (const p of this.throwTrail) p.age += dt;
    this.throwTrail = this.throwTrail.filter((p) => p.age < 0.2);

    // Enemy AI only acts while a wave is live. A rubber duck in the fortress draws fire.
    const duck = this.fortress.standing.find((p) => p.def.id === 'duck');
    const decoy = duck ? { x: duck.x, y: duck.y + duck.h * 0.25 } : null;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (this.phase === 'playing') {
        this.ais.get(e)?.update(dt, this.player, this.progression.wave, (o, m, d, s) => this.spawnProjectile(o, m, d, s, ENEMY_SHOT), decoy);
      } else {
        e.setAim(null);
      }
    }
    if (this.phase === 'playing') this.updateCannons(dt);
    this.updateCoins(dt);

    for (const r of this.allRagdolls()) r.update(dt);
    this.updateEnemyRecovery(dt);
    for (const p of this.projectiles) p.update(dt);
    for (const o of this.arena.objects) o.update(dt);
    this.slime.update(dt);

    // Homing, lift, boomerangs, fuses and wells all apply forces before the step.
    this.mechanics.update(dt, {
      projectiles: this.projectiles,
      ragdolls: this.allRagdolls().filter((r) => r.alive),
      objects: this.arena.objects,
      targetsFor: (p) => (p.ownerId === PLAYER_ID ? this.enemies : [this.player]),
      ownerOf: (id) => (id === PLAYER_ID ? this.player : this.enemies.find((e) => e.id === id) ?? null),
      onFuse: (p) => this.fuse(p),
    });

    // Stamina refills. The air jump comes back as soon as a foot touches an island.
    this.stamina = Math.min(STAMINA.max, this.stamina + STAMINA.regen * dt);
    this.staminaFlash = Math.max(0, this.staminaFlash - dt);
    this.updateLanding(dt);
    if (this.grounded()) this.airJumpUsed = false;

    this.fortress.update(dt);
    this.physics.step(dt);

    const { hits, impacts } = this.physics.drain();
    const ctx = this.combatContext();
    for (const h of hits) this.combat.onProjectileHit(h, ctx);
    for (const imp of impacts) this.combat.onImpact(imp);
    this.combat.tickDrips(dt, this.allRagdolls());

    this.resolveDeaths();
    this.cleanup();
    this.physics.flush();
    this.effects.update(dt);
    this.advancePhase(dt);
  }

  /** A fuse ran out: explode the shot where it is. */
  private fuse(p: Projectile): void {
    if (!p.alive || p.consumed) return;
    p.consumed = true;
    const at = { x: p.position.x, y: p.position.y };
    p.destroy(this.physics);
    this.combat.explode(at, p.shot, p.ownerId, this.combatContext());
  }

  /** True when a character has fallen below the islands or been flung out of the arena. */
  private leftArena(r: Ragdoll): boolean {
    const t = r.torsoPosition();
    return t.y < ARENA.killY || Math.abs(t.x) > ARENA.bounds || t.y > HIGH;
  }

  /**
   * The KO moment: a freeze, then slow motion, a slime explosion with a shockwave
   * and a screen flash, a big "KO!" pop, and the body flung away from the player
   * with gum splattered over it.
   */
  private koBlast(e: Ragdoll): void {
    const t = e.torsoPosition();
    this.combat.hitstop = Math.max(this.combat.hitstop, 0.14);
    this.combat.trauma = Math.min(0.85, this.combat.trauma + 0.5);
    this.slowMo = KO_SLOW_TIME;
    this.effects.flash(0.6);
    this.effects.shockwave(t.x, t.y, '#eaffd9', 3.2);
    this.effects.shockwave(t.x, t.y, SLIME_COLOR, 2.2, 0.6);
    this.effects.splatter(t.x, t.y, SLIME_COLOR, 36, 9);
    this.effects.burst(t.x, t.y + 0.2, '#ffe066', 22, 7, 0, 1);
    this.effects.ring(t.x, t.y, '#ffffff', 16);
    this.effects.text(t.x, t.y + 1.5, 'KO!', '#ffffff', 40);

    // Fling: every part gets the same velocity change, away from the player and up, plus a spin.
    const away = t.x >= this.player.torsoPosition().x ? 1 : -1;
    const kick = { x: away * randRange(4, 6), y: randRange(6, 8) };
    for (const part of e.parts.values()) {
      const m = part.body.getMass();
      part.body.applyLinearImpulse({ x: kick.x * m, y: kick.y * m }, part.body.getWorldCenter(), true);
    }
    e.parts.get('torso')?.body.setAngularVelocity(away * randRange(-9, -6));

    // Gum splattered over the body, jiggling as it flies.
    const names = [...e.parts.keys()];
    for (let i = 0; i < 4; i++) {
      const name = names[Math.floor(Math.random() * names.length)];
      const p = e.parts.get(name)?.body.getPosition();
      if (p) this.slime.addGum(e, name, p, randRange(0.22, 0.34), SLIME.gumLife * 0.7);
    }
    this.slime.splat(t, { x: 0, y: -1 }, 2.2, this.progression.coatDuration, this.allRagdolls(), this.arena.objects, e);
  }

  private resolveDeaths(): void {
    for (const e of this.enemies.slice()) {
      if (!e.alive) continue;
      if (e.hp <= 0 || this.leftArena(e)) {
        e.kill(4);
        const chain = this.combo.count;
        const coins = Math.round(this.progression.killCoins() * this.combo.coinMultiplier);
        const score = Math.round(this.progression.killScore() * this.combo.scoreMultiplier);
        this.progression.score += score;
        this.progression.kills++;
        this.progression.earnCoins(coins);
        const t = e.torsoPosition();
        this.effects.text(t.x, t.y + 0.6, chain > 1 ? `KO +${coins} ×${chain}` : `KO +${coins}`, '#ffe066');
        this.koBlast(e);
        this.dropCoins(t, coins);
        // Every KO brings the next enemy in, somewhere else, until the wave's quota is spent.
        this.waveKills++;
        if (this.waveSpawned < this.progression.waveQuota()) {
          const spot = this.randomSpawnSpot(t.x);
          this.waveSpawned++;
          this.spawnEnemyAt(spot.x, spot.topY);
        }
      }
    }
    if (this.player.alive && (this.player.hp <= 0 || this.leftArena(this.player))) {
      this.player.kill(2.5);
      this.phase = 'dying';
      this.phaseTimer = 1.6;
      this.drag = null;
    }
  }

  /**
   * Downed enemies try to kip up. The first attempt is quick; failed attempts
   * retry on a short timer. The wave ramp shortens the wait a little.
   */
  private updateEnemyRecovery(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive || !e.isDown()) {
        this.getUpWait.delete(e);
        continue;
      }
      if (e.recovering) continue;
      let wait = this.getUpWait.get(e);
      if (wait === undefined) {
        const ramp = Math.max(0.55, 1 - 0.05 * (this.progression.wave - 1));
        wait = randRange(RECOVERY.enemyDelayMin, RECOVERY.enemyDelayMax) * ramp;
      }
      wait -= dt;
      if (wait > 0) {
        this.getUpWait.set(e, wait);
        continue;
      }
      this.getUpWait.set(e, randRange(RECOVERY.enemyRetryMin, RECOVERY.enemyRetryMax));
      if (!e.kipUp()) continue;
      this.ais.get(e)?.onRecovered();
      const t = e.torsoPosition();
      this.effects.ring(t.x, t.y - 0.45, '#ffe066', 10);
      this.effects.burst(t.x, t.y - 0.7, '#d9c7a0', 7, 4, 0, 1);
      this.effects.text(t.x, t.y + 0.6, 'HUP!', '#ffe066');
      this.combat.trauma = Math.min(0.5, this.combat.trauma + 0.05);
    }
  }

  /** Dust and a small camera kick when the player comes back down after real airtime. */
  private updateLanding(dt: number): void {
    if (!this.player.alive) {
      this.playerAirTime = 0;
      return;
    }
    if (!this.player.grounded) {
      this.playerAirTime += dt;
      return;
    }
    if (this.playerAirTime > 0.3) {
      const fL = this.player.parts.get('footL')!.body.getPosition();
      const fR = this.player.parts.get('footR')!.body.getPosition();
      const x = (fL.x + fR.x) / 2;
      const y = Math.min(fL.y, fR.y);
      this.effects.burst(x, y, '#e6dcc6', 9, 3.2, 0, 1);
      this.effects.ring(x, y, '#ffffff', 5);
      this.combat.trauma = Math.min(0.45, this.combat.trauma + 0.03);
    }
    this.playerAirTime = 0;
  }

  private cleanup(): void {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      const pos = p.position;
      if (p.life <= 0 || Math.abs(pos.x) > ARENA.bounds || pos.y < DEEP || pos.y > HIGH) p.destroy(this.physics);
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);

    for (const e of this.enemies.slice()) {
      if (e.state === 'dead' && e.corpseTimer <= 0) {
        e.destroy(this.physics);
        this.combat.forget(e);
        this.ais.delete(e);
        this.getUpWait.delete(e);
        this.enemies.splice(this.enemies.indexOf(e), 1);
      }
    }

    // Loose objects that fall into the void are removed.
    const objects: PhysicsObject[] = this.arena.objects;
    for (let i = objects.length - 1; i >= 0; i--) {
      if (objects[i].body.getPosition().y < -12) {
        objects[i].destroy(this.physics);
        objects.splice(i, 1);
      }
    }
  }

  private advancePhase(dt: number): void {
    switch (this.phase) {
      case 'playing':
        if (this.waveKills >= this.progression.waveQuota() && this.enemies.every((e) => !e.alive)) {
          this.phase = 'clearing';
          this.phaseTimer = 1.4;
        }
        break;
      case 'clearing':
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.openShop();
        break;
      case 'dying':
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.phase = 'gameover';
          this.setOverlay('gameover');
          this.ui.showGameOver(
            `Reached wave ${this.progression.wave} · Score ${this.progression.score} · ${this.progression.kills} KO`,
          );
        }
        break;
      default:
        break;
    }
  }

  // ---- Waves -----------------------------------------------------------

  private startWave(): void {
    const alive = Math.min(this.progression.enemyCount(), this.progression.waveQuota());
    this.waveKills = 0;
    this.waveSpawned = alive;
    // The first enemies take fixed spots on the enemy island. Every later one is random.
    const enemyIsland = this.arena.islands.find((i) => i.home === 'enemy') ?? this.arena.islands[1];
    for (let i = 0; i < alive; i++) {
      this.spawnEnemyAt(ARENA.enemySpawnXs[i] + randRange(-0.25, 0.25), enemyIsland.topY);
    }
    this.phase = 'playing';
    this.effects.text(ARENA.playerSpawnX, 3.2, `WAVE ${this.progression.wave}`, '#ffffff');
  }

  /** An enemy stands at x on a surface, facing the player, and takes a short think before its first shot. */
  private spawnEnemyAt(x: number, topY: number): void {
    const facing: 1 | -1 = x < this.player.torsoPosition().x ? 1 : -1;
    const e = this.spawnRagdoll('enemy', facing, x, this.progression.enemyHp(), topY);
    this.enemies.push(e);
    this.ais.set(e, new EnemyAI(e, this.arena, 1.0 + Math.random() * 0.8));
    // Beam in: a light column, a ground ring, and a little camera kick.
    this.effects.beam(x, topY, '#c77dff');
    this.effects.shockwave(x, topY + 0.1, '#e6d4ff', 1.6, 0.4);
    this.effects.ring(x, topY + 1.1, '#ffffff', 10);
    this.combat.trauma = Math.min(0.5, this.combat.trauma + 0.05);
  }

  /**
   * A random spot on a random island that is not the player's, away from the
   * player, from other living enemies and from where the last enemy fell (`awayFromX`).
   * Falls back to the enemy island's centre.
   */
  private randomSpawnSpot(awayFromX: number | null = null): { x: number; topY: number } {
    const islands = this.arena.islands.filter((i) => i.home !== 'player');
    const player = this.player.torsoPosition();
    for (let attempt = 0; attempt < 60; attempt++) {
      const isl = islands[Math.floor(Math.random() * islands.length)];
      const x = randRange(isl.minX + 1.2, isl.maxX - 1.2);
      const standY = isl.topY + 1.3;
      const farFromPlayer = Math.hypot(x - player.x, standY - player.y) > 4.5;
      const farFromEnemies = this.enemies.every(
        (e) => !e.alive || Math.hypot(e.torsoPosition().x - x, e.torsoPosition().y - standY) > 3,
      );
      const elsewhere = awayFromX === null || Math.abs(x - awayFromX) > 3.5;
      if (farFromPlayer && farFromEnemies && elsewhere) return { x, topY: isl.topY };
    }
    const fallback = this.arena.islands.find((i) => i.home === 'enemy') ?? this.arena.islands[1];
    return { x: (fallback.minX + fallback.maxX) / 2, topY: fallback.topY };
  }

  // ---- Characters and projectiles --------------------------------------

  private spawnRagdoll(team: Team, facing: 1 | -1, x: number, maxHp: number, groundY = 0): Ragdoll {
    const id = this.nextId++;
    return new Ragdoll(this.physics, { id, team, facing, x, groundY, maxHp });
  }

  private spawnProjectile(owner: Ragdoll, muzzle: Vec2, dir: Vec2, speed: number, shot: ShotSpec): void {
    const p = new Projectile(this.physics, owner.id, muzzle, { x: dir.x * speed, y: dir.y * speed }, shot);
    this.projectiles.push(p);
  }

  /** Splitter impact: mini blobs fan out from the hit point, away from the surface. */
  private spawnSplit(origin: Vec2, normal: Vec2, ownerId: number, shot: ShotSpec): void {
    const base = Math.atan2(-normal.y, -normal.x);
    for (let i = 0; i < shot.splitCount; i++) {
      const a = base + (i - (shot.splitCount - 1) / 2) * 0.5 + randRange(-0.15, 0.15);
      const speed = randRange(6, 9);
      const dir = { x: Math.cos(a), y: Math.sin(a) };
      const pos = { x: origin.x + dir.x * 0.18, y: origin.y + dir.y * 0.18 };
      this.projectiles.push(
        new Projectile(this.physics, ownerId, pos, { x: dir.x * speed, y: dir.y * speed }, { ...CHILD_SHOT, color: shot.color }, true),
      );
    }
  }

  /** Cluster bombs: shots scatter in a ring from the blast. */
  private spawnRadial(origin: Vec2, count: number, ownerId: number, shot: ShotSpec): void {
    const start = randRange(0, Math.PI * 2);
    for (let i = 0; i < count; i++) {
      const a = start + (i / count) * Math.PI * 2;
      const speed = randRange(6, 8);
      const dir = { x: Math.cos(a), y: Math.sin(a) };
      const pos = { x: origin.x + dir.x * 0.25, y: origin.y + dir.y * 0.25 };
      this.projectiles.push(new Projectile(this.physics, ownerId, pos, { x: dir.x * speed, y: dir.y * speed }, shot, true));
    }
  }

  private allRagdolls(): Ragdoll[] {
    return [this.player, ...this.enemies];
  }

  private combatContext(): CombatContext {
    return {
      ragdolls: this.allRagdolls(),
      objects: this.arena.objects,
      coatDuration: this.progression.coatDuration,
      splatRadius: this.progression.splatRadius,
      puddleLife: this.progression.puddleLife,
      spawnSplit: (origin, normal, ownerId, shot) => this.spawnSplit(origin, normal, ownerId, shot),
      spawnRadial: (origin, count, ownerId, shot) => this.spawnRadial(origin, count, ownerId, shot),
      addWell: (at, well) => this.addWell(at, well),
      damageBlock: (piece, amount, ownerId) => this.damageBlock(piece, amount, ownerId),
      onCharacterHit: (victim, _damage, at) => this.onCharacterHit(victim, at),
    };
  }

  /** Enemy hits build the combo; a hit on the player wipes it. */
  private onCharacterHit(victim: Ragdoll, at: { x: number; y: number }): void {
    if (victim.team !== 'enemy') {
      this.combo.break();
      return;
    }
    const count = this.combo.hit();
    if (count < 2) return;
    this.effects.text(at.x, at.y + 0.3, `×${count}`, '#8dff5a');
    if (count % 5 === 0) {
      this.effects.ring(at.x, at.y, '#8dff5a', 8);
      this.combat.trauma = Math.min(0.6, this.combat.trauma + 0.04);
    }
  }

  /**
   * An enemy shot hit a fortress piece. Spikes pop the shot, jelly bounces it
   * back, the duck squeaks. A piece that breaks takes down whatever rested on it,
   * and those pieces are lost from the saved fortress.
   */
  private damageBlock(piece: FortressPiece, amount: number, ownerId: number): void {
    if (ownerId === PLAYER_ID) return;
    const at = piece.body.getPosition();
    const id = piece.def.id;
    this.effects.ring(at.x, at.y, piece.def.color, 6);
    const word = id === 'spikes' ? 'POP!' : id === 'jelly' ? 'BOING!' : id === 'duck' ? 'QUACK!' : null;
    if (word) this.effects.text(at.x, at.y + piece.h / 2 + 0.5, word, piece.def.color, 26);
    const lost = this.fortress.hit(piece, amount);
    if (!lost) return;
    this.progression.losePieces(lost.map((p) => p.saved));
    this.combat.trauma = Math.min(0.6, this.combat.trauma + 0.25);
    this.effects.splatter(at.x, at.y, piece.def.color, 18, 6);
    this.effects.shockwave(at.x, at.y, piece.def.color, 1.4, 0.35);
    this.effects.text(at.x, at.y + 0.9, lost.length > 1 ? `COLLAPSE ×${lost.length}` : 'BROKEN!', '#ff6b6b', 28);
  }

  // ---- Coins ------------------------------------------------------------

  /** Burst a KO's coins out of the body; they fly to the player and land in the counter. */
  private dropCoins(at: Vec2, total: number): void {
    if (total <= 0) return;
    const n = clamp(Math.round(total / 6), 4, 10);
    let left = total;
    for (let i = 0; i < n; i++) {
      const value = i === n - 1 ? left : Math.floor(total / n);
      left -= value;
      const a = randRange(0.3, Math.PI - 0.3);
      const s = randRange(4, 7.5);
      this.coinDrops.push({ x: at.x, y: at.y + 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: -i * 0.03, value, spin: randRange(0, 6) });
    }
    this.pendingCoins += total;
  }

  /** Coins pop up, hang for a moment, then home in on the player faster and faster. */
  private updateCoins(dt: number): void {
    const target = this.player.torsoPosition();
    for (let i = this.coinDrops.length - 1; i >= 0; i--) {
      const c = this.coinDrops[i];
      c.t += dt;
      c.spin += dt * 12;
      if (c.t < 0.5) {
        c.vy -= 14 * dt;
        c.vx *= 1 - 2 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        continue;
      }
      const dx = target.x - c.x;
      const dy = target.y - c.y;
      const d = Math.hypot(dx, dy);
      const speed = 8 + (c.t - 0.5) * 45;
      if (d < 0.4 || d < speed * dt) {
        this.pendingCoins = Math.max(0, this.pendingCoins - c.value);
        this.effects.ring(target.x, target.y, '#ffe066', 6);
        this.effects.burst(target.x, target.y, '#ffe066', 4, 3, 0, 1);
        this.coinDrops.splice(i, 1);
        continue;
      }
      c.x += (dx / d) * speed * dt;
      c.y += (dy / d) * speed * dt;
    }
  }

  // ---- Cannons ----------------------------------------------------------

  /**
   * Fortress cannons swing their barrels toward the nearest enemy and lob a
   * slime shot when they reload. The shot belongs to the player, so it sticks
   * gum and builds the combo like a thrown blob.
   */
  private updateCannons(dt: number): void {
    for (const p of this.fortress.standing) {
      if (p.def.id !== 'cannon') continue;
      p.reload -= dt;
      const origin = { x: p.x, y: p.y + p.h / 2 + 0.12 };
      let target: Ragdoll | null = null;
      let best = Infinity;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const t = e.torsoPosition();
        const d = Math.hypot(t.x - origin.x, t.y - origin.y);
        if (d < best) {
          best = d;
          target = e;
        }
      }
      if (!target) continue;
      const aimAt = target.torsoPosition();
      // A rough lob angle for the idle swing; the real solution is found when it fires.
      const rough = Math.atan2(aimAt.y - origin.y, aimAt.x - origin.x) + 0.55 * Math.sign(aimAt.x - origin.x || 1);
      p.aim += (rough - p.aim) * Math.min(1, dt * 3);
      if (p.reload > 0) continue;
      p.reload = FORTRESS.cannonReload;
      for (const speed of [15, 17, 19, 21]) {
        const dir = solveLowArc(this.arena, origin, aimAt, speed);
        if (!dir) continue;
        const muzzle = { x: origin.x + dir.x * 0.55, y: origin.y + dir.y * 0.55 };
        this.projectiles.push(new Projectile(this.physics, PLAYER_ID, muzzle, { x: dir.x * speed, y: dir.y * speed }, CANNON_SHOT));
        p.aim = Math.atan2(dir.y, dir.x);
        p.recoil = 1;
        this.effects.burst(muzzle.x, muzzle.y, '#ffd23f', 12, 5, dir.x, dir.y);
        this.effects.burst(muzzle.x, muzzle.y, '#e6e9f0', 8, 2.5, dir.x, dir.y);
        this.effects.ring(muzzle.x, muzzle.y, '#ffffff', 8);
        this.combat.trauma = Math.min(0.5, this.combat.trauma + 0.04);
        break;
      }
    }
  }

  private addWell(at: Vec2, well: Well): void {
    this.mechanics.wells.push({ ...well, x: at.x, y: at.y });
  }

  // ---- Stamina and jumping ---------------------------------------------

  /** Stamina a shot costs. Heavier shots cost more. */
  private shotCost(w: WeaponDef): number {
    return Math.round(4 + 6 * w.shot.mass);
  }

  /** True when a foot is on an island or on top of a fortress piece, within a few centimetres of its top. */
  private grounded(): boolean {
    if (!this.player.alive) return false;
    if (this.player.grounded) return true;
    const surfaces = [...this.arena.islands, ...this.fortress.surfaces()];
    for (const name of ['footL', 'footR'] as const) {
      const p = this.player.parts.get(name)?.body.getPosition();
      if (!p) continue;
      if (surfaces.some((s) => p.x > s.minX - 0.3 && p.x < s.maxX + 0.3 && p.y < s.topY + 0.22)) return true;
    }
    return false;
  }

  /**
   * Jump: from the ground, or once in the air after a jump or a fall. Each jump
   * costs stamina. A second jump in the air needs the air jump to be restored,
   * which happens when a foot touches an island again.
   */
  private jump(): void {
    if (this.overlay !== 'hud' || (this.phase !== 'playing' && this.phase !== 'clearing') || !this.player.alive) return;

    // A knocked-down player can spend stamina on a kip-up instead of a jump.
    if (this.player.isDown()) {
      if (this.stamina < RECOVERY.playerCost) {
        this.flashStamina();
        return;
      }
      if (!this.player.kipUp()) return;
      this.stamina -= RECOVERY.playerCost;
      const t = this.player.torsoPosition();
      this.effects.ring(t.x, t.y - 0.7, '#ffffff', 10);
      this.effects.text(t.x, t.y + 0.5, 'UP!', '#ffffff');
      this.combat.trauma = Math.min(0.5, this.combat.trauma + 0.07);
      return;
    }

    const ground = this.grounded();
    if (!ground && this.airJumpUsed) return;
    const cost = ground ? STAMINA.jumpGround : STAMINA.jumpAir;
    if (this.stamina < cost) {
      this.flashStamina();
      return;
    }
    this.stamina -= cost;
    if (!ground) this.airJumpUsed = true;
    this.player.launchUp(STAMINA.jumpSpeed);
    const t = this.player.torsoPosition();
    this.effects.ring(t.x, t.y - 0.9, '#ffffff', 8);
  }

  private flashStamina(): void {
    this.staminaFlash = 0.35;
  }

  // ---- Input and aiming ------------------------------------------------

  private dragMaxPx(): number {
    return clamp(Math.min(this.canvas.clientWidth, this.canvas.clientHeight) * 0.45, 110, 280);
  }

  private pointerDown(p: PointerPoint): void {
    if (this.overlay === 'build') {
      this.pickUpAt(p);
      return;
    }
    if (this.overlay !== 'hud' || this.phase !== 'playing' || !this.player.alive) return;
    this.drag = { anchorX: p.x, anchorY: p.y, curX: p.x, curY: p.y };
  }

  private pointerMove(p: PointerPoint): void {
    if (!this.drag) return;
    this.drag.curX = p.x;
    this.drag.curY = p.y;
  }

  private pointerUp(p: PointerPoint): void {
    if (!this.drag) return;
    this.drag.curX = p.x;
    this.drag.curY = p.y;
    const shot = this.computeAim();
    this.drag = null;
    if (shot && shot.power > 0) this.fire(shot.dir, shot.power);
  }

  /** Aim = drag backwards from the anchor. Power = drag length, clamped to 0..1. */
  private computeAim(): { dir: Vec2; power: number } | null {
    if (!this.drag) return null;
    const dx = this.drag.anchorX - this.drag.curX;
    const dy = this.drag.anchorY - this.drag.curY;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) return null;
    const power = len < DEAD_ZONE_PX ? 0 : clamp((len - DEAD_ZONE_PX) / (this.dragMaxPx() - DEAD_ZONE_PX), 0, 1);
    const raw = { x: dx / len, y: -dy / len };
    // Keep the aim inside the arm's reachable arc.
    const phi = clamp(aimBodyAngle(raw), AIM_MIN, AIM_MAX);
    return { dir: { x: Math.sin(phi), y: -Math.cos(phi) }, power };
  }

  /**
   * Fire the equipped weapon: one or more shots, then its cooldown. Bare hands
   * start a throw instead; the blob leaves the hand partway through the swing.
   */
  private fire(dir: Vec2, power: number): void {
    if (this.overlay !== 'hud' || this.phase !== 'playing' || !this.player.alive || this.shotCooldown > 0 || this.throwAnim) return;
    const w = this.progression.weapon;
    const cost = this.shotCost(w);
    if (this.stamina < cost) {
      this.flashStamina();
      return;
    }
    this.stamina -= cost;
    this.cooldownTotal = w.cooldown * this.progression.reloadMultiplier;
    if (w.launcher.kind === 'hand') {
      // The cooldown covers the whole throw, so the next blob forms after the follow-through.
      this.shotCooldown = Math.max(this.cooldownTotal, THROW_WIND + THROW_SWING + THROW_FOLLOW);
      this.cooldownTotal = this.shotCooldown;
      this.throwAnim = { t: 0, dir, power, phi: aimBodyAngle(dir), released: false };
      // Wind-up: the body rocks back a touch.
      const torso = this.player.torsoBody;
      torso.applyLinearImpulse({ x: -dir.x * 0.12 * torso.getMass(), y: 0 }, torso.getPosition(), true);
      this.hideHintOnce();
      return;
    }
    this.releaseShots(w, dir, power);
    this.shotCooldown = this.cooldownTotal;
    this.aimHold = 0.35;
    this.lastAimPhi = aimBodyAngle(dir);
    this.hideHintOnce();
  }

  private hideHintOnce(): void {
    if (this.hintShown) {
      this.hintShown = false;
      this.ui.hideHint();
    }
  }

  /**
   * Drive the arm through the throw: wind back over the shoulder (ease out),
   * whip forward through the aim (ease in, so it accelerates), release the blob
   * partway through the swing, then follow through low. The hand's path is kept
   * for the swoosh.
   */
  private updateThrow(dt: number): void {
    const a = this.throwAnim;
    if (!a) return;
    a.t += dt;
    if (!this.player.alive) {
      this.throwAnim = null;
      return;
    }
    const back = clamp(a.phi + 1.6, AIM_MIN, AIM_MAX);
    const follow = clamp(a.phi - 1.2, AIM_MIN, AIM_MAX);
    let target: number;
    if (a.t < THROW_WIND) {
      const k = a.t / THROW_WIND;
      target = lerp(a.phi, back, 1 - (1 - k) * (1 - k));
    } else if (a.t < THROW_WIND + THROW_SWING) {
      const k = (a.t - THROW_WIND) / THROW_SWING;
      target = lerp(back, follow, k * k);
      if (!a.released && k >= THROW_RELEASE) this.releaseThrow(a);
    } else if (a.t < THROW_WIND + THROW_SWING + THROW_FOLLOW) {
      if (!a.released) this.releaseThrow(a);
      target = follow;
    } else {
      this.throwAnim = null;
      this.aimHold = 0.12;
      this.lastAimPhi = follow;
      return;
    }
    this.player.setAim(target);
    if (a.t > THROW_WIND * 0.4 && a.t < THROW_WIND + THROW_SWING + 0.05) {
      const hand = this.player.muzzle({ x: 0, y: 0 }, 0);
      this.throwTrail.push({ x: hand.x, y: hand.y, age: 0 });
    }
  }

  /** The blob leaves the hand: the shot, a flick of slime, a lunge and a small camera kick. */
  private releaseThrow(a: ThrowAnim): void {
    a.released = true;
    const w = this.progression.weapon;
    this.releaseShots(w, a.dir, a.power);
    const hand = this.player.muzzle(a.dir, 0.1);
    this.effects.ring(hand.x, hand.y, '#ffffff', 10);
    this.effects.burst(hand.x, hand.y, w.color, 10, 5, -a.dir.x, -a.dir.y + 0.4);
    this.effects.shockwave(hand.x, hand.y, '#eaffd9', 0.6, 0.18);
    const torso = this.player.torsoBody;
    const lunge = 0.35 + 0.35 * a.power;
    torso.applyLinearImpulse({ x: a.dir.x * lunge * torso.getMass(), y: 0 }, torso.getPosition(), true);
    this.combat.trauma = Math.min(0.5, this.combat.trauma + 0.03 + 0.03 * a.power);
  }

  /** Spawn the weapon's projectiles along `dir`, from the hand. */
  private releaseShots(w: WeaponDef, dir: Vec2, power: number): void {
    const speed = this.launchSpeed(power);
    for (let i = 0; i < w.shots; i++) {
      const off = (i - (w.shots - 1) / 2) * w.spread;
      const d = rotate(dir, off);
      const muzzle = this.player.muzzle(d);
      this.spawnProjectile(this.player, muzzle, d, speed, w.shot);
      this.effects.burst(muzzle.x, muzzle.y, w.color, 4, 4.5, d.x, d.y);
    }
    if (w.launcher.kind === 'hand') return;
    // Launchers kick: heavy shots shove the shooter back a little; every shot rocks the camera.
    const kick = Math.min(0.45, 0.05 + w.shot.mass * 0.07);
    const torso = this.player.torsoBody;
    torso.applyLinearImpulse(
      { x: -dir.x * kick * torso.getMass(), y: -dir.y * kick * torso.getMass() },
      torso.getPosition(),
      true,
    );
    this.combat.trauma = Math.min(0.5, this.combat.trauma + 0.015 + w.shot.mass * 0.01);
  }

  private launchSpeed(power: number): number {
    const base = SLIME.launchMin + (SLIME.launchMax - SLIME.launchMin) * power;
    return base * this.progression.launchMultiplier * this.progression.weapon.speedMul;
  }

  /** Refresh the drag and trajectory preview for this frame. */
  private updateAim(): void {
    const shot = this.computeAim();
    const live = this.overlay === 'hud' && this.phase === 'playing' && this.player.alive;
    this.aimPower = shot?.power ?? 0;
    this.aimActive = !!shot && shot.power > 0.02 && live;
    this.aimDir = shot ? shot.dir : null;

    this.aimView.active = this.aimActive;
    this.aimView.power = this.aimPower;
    this.aimView.anchor = this.drag ? { x: this.drag.anchorX, y: this.drag.anchorY } : null;
    this.aimView.pointer = this.drag ? { x: this.drag.curX, y: this.drag.curY } : null;
    this.aimView.path = [];
    this.aimView.landing = null;

    if (this.aimActive && shot) {
      const muzzle = this.player.muzzle(shot.dir);
      const speed = this.launchSpeed(shot.power);
      const v = { x: shot.dir.x * speed, y: shot.dir.y * speed };
      // A telescope in the fortress lets the aim line reach further.
      const reach = this.fortress.count('telescope') > 0 ? FORTRESS.telescopeReach : 1;
      const preview = previewPath(this.arena, muzzle, v, 2.6 * reach);
      this.aimView.path = preview.points;
      this.aimView.landing = preview.landing;
    }
  }

  // ---- Build mode -------------------------------------------------------

  /**
   * Enter build mode from the HUD, pause menu, main menu or a catalog. A run
   * pauses; the camera frames the home island; pieces are dragged from the tray.
   */
  private enterBuild(): void {
    const from = this.overlay;
    if (from === 'hud') {
      if (this.screen !== 'run' || (this.phase !== 'playing' && this.phase !== 'clearing')) return;
      this.paused = true;
      this.drag = null;
    } else if (from !== 'menu' && from !== 'pause' && from !== 'catalog') {
      return;
    }
    this.buildReturn = from;
    this.buildCatalogFrom = this.catalogFrom;
    this.buildDrag = null;
    this.setOverlay('build');
    this.renderBuild();
  }

  private exitBuild(): void {
    if (this.overlay !== 'build') return;
    this.buildDrag = null;
    const back = this.buildReturn;
    this.catalogFrom = this.buildCatalogFrom;
    this.setOverlay(back);
    if (back === 'hud') this.paused = false;
    else if (back === 'menu') this.refreshMenu();
    else if (back === 'catalog') this.renderCatalog();
  }

  private rotateBuild(): void {
    if (this.overlay !== 'build') return;
    this.buildRot = this.buildRot === 0 ? 1 : 0;
    this.renderBuild();
  }

  private buildModel(): BuildModel {
    const p = this.progression;
    return {
      coins: p.coins - this.pendingCoins,
      rotated: this.buildRot === 1,
      dragging: this.buildDrag?.item ?? null,
      items: FORTRESS_ITEMS.filter((d) => p.isUnlocked(d.id)).map((d) => ({
        id: d.id,
        name: d.name,
        color: d.color,
        count: p.itemCount(d.id),
        placed: p.placedCount(d.id),
        maxPlaced: d.maxPlaced,
        canPlace: p.canPlace(d.id),
      })),
      lockedCount: FORTRESS_ITEMS.filter((d) => !p.isUnlocked(d.id)).length,
    };
  }

  private renderBuild(): void {
    this.ui.showBuild(this.buildModel());
  }

  private canvasPoint(clientX: number, clientY: number): PointerPoint {
    const r = this.canvas.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  /** A drag started on a tray slot. */
  private startTrayDrag(id: FortressItemId, clientX: number, clientY: number): void {
    if (this.overlay !== 'build') return;
    if (!this.progression.canPlace(id)) {
      this.ui.shakeTraySlot(id);
      return;
    }
    if (!fortressItem(id).rotatable) this.buildRot = 0;
    this.buildDrag = { item: id, screen: this.canvasPoint(clientX, clientY) };
    this.renderBuild();
  }

  /** Pressing a placed piece picks it up (back into the inventory) and starts dragging it. */
  private pickUpAt(p: PointerPoint): void {
    const w = this.camera.toWorld(p);
    const piece = this.fortress.pieceAt(w.x, w.y);
    if (!piece) return;
    if (this.fortress.isLoadBearing(piece)) {
      piece.flash = 0.25;
      this.effects.text(piece.x, piece.y + piece.h / 2 + 0.4, 'Holding others up', '#ffd166', 18);
      return;
    }
    this.fortress.pickUp(piece);
    this.progression.pickUpItem(piece.saved);
    this.buildRot = piece.saved.rot;
    this.buildDrag = { item: piece.def.id, screen: p };
    this.effects.burst(piece.x, piece.y, piece.def.color, 8, 3, 0, 1);
    this.renderBuild();
  }

  private buildPointerMove(e: PointerEvent): void {
    if (!this.buildDrag) return;
    this.buildDrag.screen = this.canvasPoint(e.clientX, e.clientY);
  }

  /** Drop: over the tray it goes back to the inventory; on a valid spot it is placed. */
  private buildPointerUp(e: PointerEvent): void {
    const drag = this.buildDrag;
    if (!drag) return;
    this.buildDrag = null;
    drag.screen = this.canvasPoint(e.clientX, e.clientY);
    if (this.ui.isOverTray(e.clientX, e.clientY)) {
      this.renderBuild();
      return;
    }
    const ghost = this.ghostFor(drag);
    if (!ghost.valid) {
      this.effects.text(ghost.x, ghost.y + ghost.h / 2 + 0.4, ghost.reason, '#ff8a7a', 18);
      this.renderBuild();
      return;
    }
    const saved = this.progression.placeItem({ item: drag.item, x: ghost.x, y: ghost.y, rot: ghost.rot });
    if (saved) {
      this.fortress.add(saved);
      // Thunk: dust from the base, a ring, and a small camera bump.
      const base = ghost.y - ghost.h / 2;
      this.effects.burst(ghost.x - ghost.w / 2, base, '#e6dcc6', 6, 2.6, -1, 0.6);
      this.effects.burst(ghost.x + ghost.w / 2, base, '#e6dcc6', 6, 2.6, 1, 0.6);
      this.effects.ring(ghost.x, ghost.y, fortressItem(drag.item).color, 10);
      this.combat.trauma = Math.min(0.4, this.combat.trauma + 0.08);
    }
    this.renderBuild();
  }

  private cancelBuildDrag(): void {
    if (!this.buildDrag) return;
    this.buildDrag = null;
    if (this.overlay === 'build') this.renderBuild();
  }

  /** Where the dragged piece would land, and whether it may go there (with a reason if not). */
  private ghostFor(drag: BuildDrag): BuildView['landing'] & { reason: string } {
    const world = this.camera.toWorld(drag.screen);
    const rot = fortressItem(drag.item).rotatable ? this.buildRot : 0;
    const fp = this.fortress.footprint(drag.item, rot, world.x);
    let reason = '';
    if (!fp.ok) reason = 'Too high';
    else if (this.blockedByBodies(fp)) reason = 'Something is in the way';
    else if (this.progression.placedCount(drag.item) >= fortressItem(drag.item).maxPlaced) reason = 'No more of these';
    return { ...fp, valid: reason === '', reason };
  }

  /** True when a character's body or a loose object sits where the piece would go. */
  private blockedByBodies(fp: { x: number; y: number; w: number; h: number }): boolean {
    const near = (px: number, py: number, pad: number): boolean => Math.abs(px - fp.x) < fp.w / 2 + pad && Math.abs(py - fp.y) < fp.h / 2 + pad;
    for (const r of this.allRagdolls()) {
      if (r.state === 'dead') continue;
      for (const part of r.parts.values()) {
        const p = part.body.getPosition();
        if (near(p.x, p.y, 0.16)) return true;
      }
    }
    for (const o of this.arena.objects) {
      const p = o.body.getPosition();
      if (near(p.x, p.y, o.size)) return true;
    }
    return false;
  }

  private cameraTargets(): WorldPoint[] {
    // Build mode frames the whole build zone, up to the height limit.
    if (this.overlay === 'build') {
      const z = this.fortress.zone;
      return [
        { x: z.minX, y: z.topY },
        { x: z.maxX + 4, y: z.topY },
        { x: (z.minX + z.maxX) / 2, y: FORTRESS.maxHeight - 1 },
      ];
    }
    const pts: WorldPoint[] = [];
    if (this.player.alive) pts.push(this.player.torsoPosition());
    for (const e of this.enemies) if (e.alive) pts.push(e.torsoPosition());
    for (const p of this.projectiles) if (p.alive) pts.push(p.position);
    // Loose objects that are up in the air count too, so the camera keeps them in view.
    for (const o of this.arena.objects) {
      const p = o.body.getPosition();
      if (p.y > -3) pts.push(p);
    }
    if (pts.length === 0) pts.push({ x: ARENA.playerSpawnX, y: 1 });
    return pts;
  }

  private scene(alpha: number): Scene {
    return {
      arena: this.arena,
      slime: this.slime,
      effects: this.effects,
      camera: this.camera,
      player: this.player,
      enemies: this.enemies,
      projectiles: this.projectiles,
      objects: this.arena.objects,
      fortress: this.fortress,
      wells: this.mechanics.wells,
      playerLauncher: this.progression.weapon.launcher,
      hand: this.handView(),
      throwTrail: this.throwTrail,
      coins: this.coinDrops.map((c): CoinView => ({ x: c.x, y: c.y, spin: c.spin })),
      build: this.buildView(),
      aim: this.aimView,
      time: this.time,
      alpha,
    };
  }

  /**
   * The blob in the player's palm when the bare hands are equipped: it swells
   * with the aim's power, stretches during the swing, vanishes on release, and
   * grows back over the cooldown.
   */
  private handView(): HandView | null {
    if (this.progression.weapon.launcher.kind !== 'hand' || !this.player.alive) return null;
    const a = this.throwAnim;
    if (a) {
      if (a.released) return null;
      return { size: 1 + 0.3 * a.power, power: a.power, swinging: a.t >= THROW_WIND, charging: false };
    }
    if (this.shotCooldown > 0) {
      const grow = 1 - this.shotCooldown / Math.max(0.01, this.cooldownTotal);
      return { size: Math.max(0, grow * grow), power: 0, swinging: false, charging: false };
    }
    if (this.aimActive) return { size: 1 + 0.35 * this.aimPower, power: this.aimPower, swinging: false, charging: true };
    return { size: 1, power: 0, swinging: false, charging: false };
  }

  private buildView(): BuildView | null {
    if (this.overlay !== 'build') return null;
    const drag = this.buildDrag;
    if (!drag) return { zone: { ...this.fortress.zone, maxY: FORTRESS.maxHeight }, held: null, landing: null };
    const landing = this.ghostFor(drag);
    const held = this.camera.toWorld(drag.screen);
    return {
      zone: { ...this.fortress.zone, maxY: FORTRESS.maxHeight },
      held: { item: drag.item, rot: landing.rot, x: held.x, y: held.y },
      landing,
    };
  }
}

/** Rotate a 2D direction by an angle (radians). */
function rotate(d: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: d.x * c - d.y * s, y: d.x * s + d.y * c };
}

/** Body angle that points the front arm along a world direction (zero = straight down). */
function aimBodyAngle(dir: Vec2): number {
  return Math.atan2(dir.x, -dir.y);
}
