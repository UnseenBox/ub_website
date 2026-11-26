import Phaser from 'phaser';
import { BLEED, MAX_SCREEN, SCREEN, designPoint } from './screen';
import { audio, LoopHandle } from '../audio/AudioManager';
import { BUNKER_UPGRADE, DEFENSES, MODS, REPAIR_AMOUNT, SUPPORT, WALL_DURATION } from '../data/upgrades';
import { CLASSIC_WEAPONS, MOUNTED_WEAPONS, WEAPONS, WEAPON_ORDER, WeaponDef, weaponById } from '../data/weapons';
import { ENEMIES } from '../data/enemies';
import { stripChips, threatTags } from '../ui/messages';
import { ITEM_ICON } from '../ui/iconPaths';
import { MissionDef, TRAINING, newEnemiesInMissionWave } from '../data/missions';
import { newEnemiesInWave } from '../data/waves';
import { FIELD, VIEW } from './config';
import { DEPTH } from './depths';
import { groundAt, project } from './perspective';
import { FieldTargetView } from '../entities/FieldTargetView';
import { FieldTarget, ObjectiveEvent, ObjectiveState } from '../systems/ObjectiveState';
import { ProjectileManager } from '../entities/Projectile';
import { WeaponView } from '../entities/WeaponView';
import { Abilities } from '../systems/Abilities';
import { Battlefield } from '../systems/Battlefield';
import { BunkerManager } from '../systems/BunkerManager';
import { CombatSystem, DamageSource } from '../systems/CombatSystem';
import { EconomyManager } from '../systems/EconomyManager';
import { EnemyManager } from '../systems/EnemyManager';
import { Fx } from '../systems/Fx';
import {
  applyResult, focusUnlocked, veteranMission, missionArsenal, MissionResult, nextMission, playerBunkerHealth, playerWeapon,
} from '../systems/Campaign';
import type { RecruitId } from '../data/squad';
import { DropReward, FieldObjects } from '../systems/FieldObjects';
import { NightSystem } from '../systems/NightSystem';
import { activeSkin, applyModeResult, claimContested, noteFinish, noteStart, recordRun, resolveMission } from '../systems/Retention';
import { skinTexture } from '../rendering/SkinArt';
import { portal } from '../portal/Portal';
import { REVIVE_SHARE } from '../portal/adRules';
import { Shootables } from '../systems/Shootables';
import { SquadSystem } from '../systems/SquadSystem';
import { profile } from '../systems/Profile';
import { buildCatalog, ShopItem } from '../systems/Shop';
import type { ResultsData } from './ResultsScene';
import { SupportSystem } from '../systems/SupportSystem';
import { WaveManager } from '../systems/WaveManager';
import { WeaponManager } from '../systems/WeaponManager';
import { HUD, type HintPart } from '../ui/HUD';
import { Tutorial } from '../ui/Tutorial';
import { toggleFullscreen } from '../ui/widgets';
import { fireAllowed, wavesAllowed } from './tutorialSteps';
import { isTestMode } from './testMode';
import { isAimTouch, isFireTouch, pushStick, resetTouchPointerIds, stepStickAim, touchButtonAt, TouchButton } from './touchControls';
import { AIM, AimAssist, type AimPoint } from './aimAssist';
import { TouchUI } from '../ui/TouchUI';
import { Zombie, depthForZ } from '../entities/Zombie';
import type { ModId, SupportId } from '../data/upgrades';

/** Seconds of slowed time per Focus, and how slow the world runs meanwhile. */
const FOCUS_SECONDS = 5;
const FOCUS_SCALE = 0.35;
/** Acid globs fly above the field, under the bunker frame. */
const DEPTH_GLOB = DEPTH.worldFx + 5;

export interface GameStartData {
  /** Mission to play; defaults to the next unwon one. */
  missionId?: string;
  openShop?: boolean;
  /** Run the replayable briefing on the training run (the classic eight waves). */
  tutorial?: boolean;
  /** Extra starting cash as a share of the mission's (a rewarded-ad retry). */
  bonusCash?: number;
  /** Play the Veteran version of a won campaign mission. */
  veteran?: boolean;
}

/** One-time control hints, keyed as stored in the profile. */
type HintId = 'aim' | 'reload' | 'armory' | 'switch' | 'mod' | 'support' | 'focus' | 'flare';

/** The battle: fixed first-person bunker view, waves, shooting, economy. */
export class GameScene extends Phaser.Scene {
  mission!: MissionDef;
  /** Training run: classic arsenal bought in the armory, nothing saved. */
  training = false;
  /** Gear ids this mission offers in the armory and on the HUD (undefined = everything). */
  gear: ReadonlySet<string> | undefined;
  /** Weapon ids on HUD keys 1–4. */
  weaponSlots: string[] = [];
  objective!: ObjectiveState;
  private targetView!: FieldTargetView;
  private awaitingObjective = false;
  private boss: Zombie | null = null;
  private bossPhase = 0;
  /** The Bloom's spore pods: while any lives the boss takes a fifth of the damage. */
  private pods: { x: number; z: number; hp: number; max: number; img: Phaser.GameObjects.Image; bar: Phaser.GameObjects.Graphics; alive: boolean; thing: Parameters<Shootables['add']>[0] }[] = [];
  private podsRegrown = false;
  private bossSummonLeft = 0;
  private supportsUsed = new Set<SupportId>();
  private hintsShown = new Set<string>();
  private shootables!: Shootables;
  private fieldObjects!: FieldObjects;
  private squad!: SquadSystem;
  private night: NightSystem | null = null;
  /** Kills since the bunker last took a hit; raises the cash multiplier. */
  private streak = 0;
  /** Focus: fills with kills (headshots most), SHIFT spends it to slow time. */
  private focusMeter = 0;
  private focusLeft = 0;
  private focusEnabled = false;
  private focusTint: Phaser.GameObjects.Rectangle | null = null;
  /** Acid globs in flight from Spitters. */
  private globs: { img: Phaser.GameObjects.Image; t: number; dur: number; x0: number; y0: number; x1: number; y1: number; dmg: number }[] = [];
  /** Seconds to each Sapper's next warning beep. */
  private beeps = new Map<Zombie, number>();
  /** This run's kills per enemy and per weapon, support calls and best streak (contracts, Field Notes, mastery). */
  private runEnemyKills: Record<string, number> = {};
  private runWeaponKills: Record<string, number> = {};
  private supportCalls = 0;
  private bestStreak = 0;
  /** Door gunner: fought from Kestrel's helicopter. */
  private chopper: { frame: Phaser.GameObjects.Graphics; shade: Phaser.GameObjects.Rectangle; rotor: LoopHandle | null; bump: number; t: number } | null = null;
  /** Seconds since deployment (playtest numbers). */
  private playSeconds = 0;
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
  /** Crosshair while playing by touch: only the aim stick moves it. */
  private touchCursor: { x: number; y: number } = { x: VIEW.centerX, y: 300 };
  /** The held aim stick: where the thumb took hold of it, and where its knob is now. */
  private stickBase: { x: number; y: number } = { x: 0, y: 0 };
  private stickKnob: { x: number; y: number } = { x: 0, y: 0 };
  /** Draws the touch crosshair onto an enemy it is near. */
  private readonly assist = new AimAssist();
  private readonly assistPoints: AimPoint[] = [];
  private readonly assistScratch = { x: 0, y: 0 };
  aimPointerId: number | null = null;
  firePointerId: number | null = null;
  private aimCursorX: number = VIEW.centerX;
  private aimCursorY = 300;
  private ambientLeft = 3;
  private wind: LoopHandle | null = null;
  private music: LoopHandle | null = null;
  private tutorial: Tutorial | null = null;
  private over = false;
  private ended = false;
  private hoverZone: string | null = null;
  /** Magnification now, eased toward the target while the alternate button is held. */
  private zoomNow = 1;
  private aimZoomed = false;
  /** The point the scope's camera is centred on, and the mouse last frame, in design pixels. */
  private scopeCentre: { x: number; y: number } = { x: VIEW.centerX, y: VIEW.height / 2 };
  private lastMouse: { x: number; y: number } = { x: VIEW.centerX, y: VIEW.height / 2 };
  private hudObjects: Phaser.GameObjects.GameObject[] = [];
  /** Exposed for automated tests (window.__fogline). */
  debugLog: string[] = [];

  constructor() {
    super('Game');
  }

  create(data?: GameStartData): void {
    this.over = false;
    this.ended = false;
    this.trigger = false;
    this.supportsUsed.clear();
    resetTouchPointerIds(this);
    this.upgrades = { reinforceLevel: 0 };
    this.input.setDefaultCursor('none');
    this.input.mouse?.disableContextMenu();
    this.input.addPointer(2);

    const test = isTestMode();
    const save = profile.get();
    this.training = !!data?.tutorial || data?.missionId === 'training';
    this.mission = this.training ? TRAINING : resolveMission(data?.missionId, save, Date.now()) ?? nextMission(save);
    if (data?.veteran && !this.training && !this.mission.mode) this.mission = veteranMission(this.mission);
    this.economy = new EconomyManager(Math.round(this.mission.startCash * (1 + (data?.bonusCash ?? 0))));
    this.revived = false;
    this.bunker = new BunkerManager();
    this.waves = new WaveManager(this.mission.waves);
    this.waves.endless = this.mission.mode === 'endless';
    this.abilities = new Abilities();
    this.objective = new ObjectiveState(this.mission.objective);
    this.boss = null;
    this.bossPhase = 0;
    this.pods = [];
    this.podsRegrown = false;
    this.awaitingObjective = false;
    this.failReason = 'BUNKER OVERRUN';
    this.hintCheckLeft = 2;
    this.hintsShown = new Set(save.hints);
    this.streak = 0;
    this.focusMeter = 0;
    this.focusLeft = 0;
    this.focusEnabled = !this.training && (test || focusUnlocked(save));
    this.globs = [];
    this.beeps.clear();
    this.runEnemyKills = {};
    this.runWeaponKills = {};
    this.supportCalls = 0;
    this.bestStreak = 0;
    let lent: Set<string> = new Set();
    let squad: { id: RecruitId; level: number }[] = [];
    if (this.training) {
      // The classic run: four guns bought in the armory as they unlock by wave.
      this.weapons = new WeaponManager();
      this.weaponSlots = CLASSIC_WEAPONS.map((w) => w.id);
      this.gear = undefined;
    } else {
      // Campaign: the loadout plus what this mission lends, with Workshop upgrades.
      // Workshop upgrades, painted in the skin each weapon wears.
      const defs = Object.fromEntries(WEAPONS.map((w) => {
        const d = playerWeapon(save, w.id);
        const skin = activeSkin(save, w.id);
        return [w.id, skin ? { ...d, viewTexture: skinTexture(this, d.viewTexture, skin), iconTexture: skinTexture(this, d.iconTexture, skin) } : d];
      }));
      if (test) {
        const mounted = this.mission.issue.weapons.filter((w) => MOUNTED_WEAPONS.includes(w));
        const ids = [...new Set([...this.mission.issue.weapons, ...WEAPON_ORDER])].filter((id) => !mounted.includes(id)).slice(0, 4 - mounted.length);
        this.weaponSlots = [...mounted, ...WEAPON_ORDER.filter((id) => ids.includes(id))];
        this.gear = undefined;
        squad = this.mission.modifiers?.chopper ? [] : [{ id: 'mara', level: 3 }, { id: 'brick', level: 3 }];
      } else {
        const arsenal = missionArsenal(save, this.mission);
        this.weaponSlots = arsenal.weapons;
        this.gear = arsenal.gear;
        lent = arsenal.lent;
        squad = arsenal.squad;
      }
      this.weapons = new WeaponManager({ owned: this.weaponSlots, unlockAfterWave: {}, defs });
      if (this.weaponSlots[0] !== this.weapons.current.def.id) this.weapons.forceSelect(this.weaponSlots[0]);
      this.bunker.setMax(playerBunkerHealth(save));
      if (this.mission.modifiers?.bunkerMul) this.bunker.startAt(this.mission.modifiers.bunkerMul);
    }
    // Lent gear arrives with one charge, so it can be tried at once.
    for (const g of lent) {
      const [kind, id] = g.split(':');
      if (kind === 'mod' || kind === 'support' || kind === 'defense') this.abilities.addCharge(kind, id);
    }

    this.field = new Battlefield(this, this.mission.location);
    this.targetView = new FieldTargetView(this);
    this.enemies = new EnemyManager(this, 36);
    this.fx = new Fx(this);
    this.combat = new CombatSystem(this.enemies, this.fx, this.economy, this.waves, (head) => this.view.showHitMarker(head));
    this.combat.rewardMul = this.cashMul;
    this.projectiles = new ProjectileManager(this);
    this.support = new SupportSystem(this, this.enemies, this.combat, this.fx);
    this.support.shake = (d, i) => this.cameras.main.shake(d * 1000, i);
    this.projectiles.onImpact = (x, z, radius, damage, impactSound) => {
      const kills = this.combat.explode(x, z, radius, damage, 'blast');
      if (kills > 0) this.combat.stats.hits++;
      // Grenades also tear into nests and set off drums and crates nearby.
      for (const s of this.shootables.inRadius(x, z, radius)) s.onHit(damage * 0.6, 0, 0);
      this.fx.explosion(x, z, radius * 0.8);
      audio.play(impactSound, { volume: Phaser.Math.Clamp(16 / z, 0.45, 1), pan: x / 20 });
      this.cameras.main.shake(160, Phaser.Math.Clamp(0.05 / z, 0.002, 0.007));
    };
    this.view = new WeaponView(this, this.weapons.current.def);

    // Things bullets can hit besides the dead: fog nests, supply crates, fuel drums.
    this.shootables = new Shootables();
    this.combat.shootables = this.shootables;
    this.fieldObjects = new FieldObjects(this, this.shootables, this.training ? [] : this.field.location.drums, this.mission.modifiers?.drops);
    this.fieldObjects.onDrum = (x, z) => this.blowDrum(x, z);
    this.fieldObjects.onClaim = (reward, x, y) => this.claimDrop(reward, x, y);
    this.fieldObjects.onLost = () => this.fx.floatText(VIEW.centerX, 210, 'SUPPLY CRATE LOST', '#ff9a70', 18);
    for (const t of this.objective.targets) {
      if (t.kind !== 'nest') continue;
      this.shootables.add({
        x: t.x, z: t.z, widthM: 3.4, heightM: 3.0,
        get alive() { return t.alive; },
        set alive(_v: boolean) { /* follows the nest */ },
        onHit: (dmg) => this.hitNest(t, dmg),
      });
    }
    this.squad = new SquadSystem(this, squad, this.enemies, this.combat, this.fx, this.bunker);
    const mods = this.mission.modifiers;
    this.night = mods?.night || mods?.storm ? new NightSystem(this, this.field.barrelFire, !!mods?.storm && !mods?.night) : null;
    this.catalog = buildCatalog({ economy: this.economy, weapons: this.weapons, abilities: this.abilities, bunker: this.bunker, upgrades: this.upgrades, gear: this.gear });
    const hudBefore = new Set<Phaser.GameObjects.GameObject>(this.children.list);
    this.hud = new HUD(this, {
      weapons: this.weapons, abilities: this.abilities, economy: this.economy, bunker: this.bunker, waves: this.waves, support: this.support,
      offers: (id) => this.offers(id),
      weaponSlots: this.weaponSlots,
      touch: () => this.touchUi?.isEnabled ?? this.prefersTouch(),
    }, {
      weapon: (slot) => this.selectWeapon(slot),
      mod: (i) => this.activateMod(MODS[i].id),
      support: (i) => this.useSupport(i),
      defense: (i) => this.useDefense(i),
      focus: () => {
        this.cardClickAt = this.input.activePointer.downTime;
        this.activateFocus();
      },
      flare: () => {
        this.cardClickAt = this.input.activePointer.downTime;
        this.fireFlare();
      },
      armory: () => {
        this.cardClickAt = this.input.activePointer.downTime;
        this.openShop();
      },
      nextWave: () => {
        this.cardClickAt = this.input.activePointer.downTime;
        this.startNextWave();
      },
    });
    // The HUD's objects, so they can step aside while aiming.
    this.hudObjects = this.children.list.filter((o) => !hudBefore.has(o));
    this.squad.onLine = (who, text) => this.hud.radio([{ who, text }]);

    this.touchUi = new TouchUI(this);
    this.touchUi.setEnabled(this.prefersTouch());
    this.touchCursor = { x: VIEW.centerX, y: 300 };
    this.assist.reset();
    this.wireEvents();
    this.wireInput();

    if (test) this.applyTestLoadout();

    this.wind = audio.loop('wind_loop', 0.55, 'sfx', 2);
    this.music = audio.loop('drone_loop', 0.55, 'music', 3);
    this.chopper = this.mission.modifiers?.chopper ? this.buildChopper() : null;
    this.playSeconds = 0;
    if (!test && !this.training) profile.update((d) => noteStart(d, this.mission.id));
    this.events.once('shutdown', () => this.teardown());

    const m = this.mission;
    // The objective strip says what to do, so a campaign mission starts without a banner.
    if (this.training) {
      this.hud.banner('TRAINING', null, 2.4);
    } else {
      if (m.mode === 'surge') this.hud.banner('FOG SURGE', { icon: 'bolt', text: (m.modifiers?.tags ?? []).join(' + '), tone: 'gold' }, 2.4);
      else if (m.mode === 'endless') this.hud.banner('LAST STAND', null, 2.4);
      else if (m.veteran) this.hud.banner('VETERAN', { icon: 'medal', text: m.name.toUpperCase(), tone: 'gold' }, 2.4);
      this.refreshStrip();
      this.hud.radio(m.brief);
      this.time.delayedCall(1200, () => this.startHints());
    }
    this.time.delayedCall(2600, () => {
      if (this.waves.phase === 'idle') this.startNextWave();
    });
    (window as unknown as { __fogline: GameScene }).__fogline = this;
    if (data?.tutorial) this.startTutorial();
    if (data?.openShop) this.time.delayedCall(0, () => this.openShop());
    portal.gameplayStart();
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
        const target = z.goal as FieldTarget | null;
        const dmg = this.combat.detonate(z);
        if (target) this.hitTarget(target, dmg);
        else this.hitBunker(dmg, z);
        this.cameras.main.shake(260, 0.006);
      }
    };
    this.enemies.onStrike = (z) => {
      if (z.def.attackDamage <= 0) return;
      if (z.goal) {
        this.hitTarget(z.goal as FieldTarget, z.def.attackDamage);
        return;
      }
      this.hitBunker(z.def.attackDamage, z);
      // A giant's slam rattles the whole bunker.
      if (z.def.attackDamage >= 40 && !this.bunker.shielded) this.cameras.main.shake(260, 0.008);
    };
    this.enemies.onAction = (z, action) => this.onEnemyAction(z, action);
    this.combat.onKill = (z, headshot, source) => this.onKill(z, headshot, source);

    this.waves.events.on('countdown', ({ wave }) => {
      const def = this.waves.current!;
      const mode = this.mission.mode;
      const freshIds = this.training ? newEnemiesInWave(wave - 1)
        : mode === 'endless' ? (wave > 1 ? newEnemiesInWave(wave - 1, this.mission.waves) : [])
        : mode === 'surge' ? []
        : newEnemiesInMissionWave(this.mission.id, wave);
      // The pips in the strip count the waves; the title only marks the moment.
      this.hud.banner(`WAVE ${wave}`, { icon: 'wave', text: def.name.toUpperCase() }, 2.4);
      // A new enemy gets a threat card. Its full description is in Field Notes (HQ).
      if (freshIds.length) this.hud.threatCards(freshIds.map((id) => ({ def: ENEMIES[id], tags: threatTags(ENEMIES[id]) })));
      audio.play('wave_start', { volume: 0.75 });
    });
    this.waves.events.on('start', () => this.hud.clearBanner());
    this.waves.events.on('cleared', ({ wave, reward }) => {
      if (reward > 0) this.economy.earn(reward, 'wave');
      this.weapons.topUpStarter();
      this.night?.restock();
      audio.play('wave_clear', { volume: 0.7 });
      for (const def of this.weapons.unlockForCleared(wave)) {
        this.fx.floatText(VIEW.centerX, VIEW.hudTop - 120, `${def.shortName} UNLOCKED — BUY IN THE ARMORY${this.touchUi.isEnabled ? '' : ' [SPACE]'}`, '#e8c060', 18);
      }
      if (wave < this.waves.totalWaves) {
        const touch = this.touchUi.isEnabled;
        this.hud.waveCard(wave, reward, { label: 'ARMORY', key: touch ? null : 'SPACE' }, { label: `WAVE ${wave + 1}`, key: touch ? null : 'ENTER' });
      } else if (this.objective.pending) {
        this.hud.banner('FIELD CLEAR', { icon: 'truck', text: 'COVER THEM', tone: 'gold' }, 999, true);
      } else {
        this.hud.banner('MISSION COMPLETE', { icon: 'cash', text: `+${reward}`, tone: 'gold' }, 999, true);
      }
    });
    this.waves.events.on('victory', () => {
      // Evacuations wait for every vehicle to finish crossing before the mission ends.
      if (this.objective.pending) {
        this.objective.rush();
        this.awaitingObjective = true;
        return;
      }
      this.time.delayedCall(2800, () => this.endRun(true));
    });

    this.bunker.events.on('destroyed', () => this.onBunkerDown());
  }

  /** The mission is lost (bunker, asset or too many vehicles). */
  private fail(reason: string): void {
    if (this.over) return;
    this.failReason = reason;
    this.waves.defeat();
    this.over = true;
    this.fx.whiteFlash(0.6, 0.8, 0x600000);
    audio.play('explosion', { volume: 1 });
    this.cameras.main.shake(700, 0.012);
    this.time.delayedCall(1600, () => this.endRun(false));
  }

  private failReason = 'BUNKER OVERRUN';
  /** The reinforcements offer has been made this mission (once only). */
  private revived = false;

  /** The bunker fell: in a CrazyGames build with ads, offer reinforcements once; otherwise the mission is lost. */
  private onBunkerDown(): void {
    if (this.over) return;
    if (!this.training && !this.revived && portal.rewardReady) {
      this.revived = true;
      this.trigger = false;
      audio.setLoopsPaused(true);
      portal.gameplayStop();
      this.scene.pause();
      this.scene.launch('Revive');
      return;
    }
    this.fail('BUNKER OVERRUN');
  }

  /** The reinforcements offer closed: half the bunker back, or the mission is lost. */
  reviveResult(restored: boolean): void {
    this.resumeFromOverlay();
    if (!restored) {
      this.fail('BUNKER OVERRUN');
      return;
    }
    this.bunker.revive(REVIVE_SHARE);
    this.hud.banner('REINFORCEMENTS', { icon: 'shield', text: 'SQUAD + SANDBAGS', tone: 'green' }, 2.6);
    audio.play('wave_clear', { volume: 0.7 });
  }
  private hintCheckLeft = 0;
  /** When the last press landed on a card between waves. */
  private cardClickAt = -1;

  // ------------------------------------------------------------ field targets

  /** New arrivals: a share of them go for the mission's field target instead of the bunker. */
  private assignGoal(z: Zombie): void {
    const t = this.objective.current;
    if (!t || z.def.boss || Math.random() >= this.objective.share) return;
    z.setGoal(t);
  }

  private hitTarget(t: FieldTarget, amount: number): void {
    const ev = this.objective.damage(t, amount);
    this.targetView.hit(t);
    const c = this.targetView.centre(t);
    audio.play('claw', { volume: 0.25, pan: (c.x - VIEW.centerX) / VIEW.centerX });
    if (Math.random() < 0.35) audio.play(`bunker_hit_${Math.floor(Math.random() * 2)}`, { volume: 0.3, pan: (c.x - VIEW.centerX) / VIEW.centerX });
    if (ev) this.onObjectiveEvent(ev);
  }

  private onObjectiveEvent(ev: ObjectiveEvent): void {
    const t = ev.target;
    // Anyone chasing a target that is gone goes back to the bunker.
    if (ev.type !== 'vehicleStart') for (const z of this.enemies.live) if (z.goal === t) z.setGoal(null);
    const c = this.targetView.centre(t);
    switch (ev.type) {
      case 'vehicleStart':
        this.hud.radio([{ who: 'HALE', text: `${t.name} is on the road. Cover it.` }]);
        audio.play('radio', { volume: 0.5 });
        // Some of the dead already on the field turn toward it.
        for (const z of this.enemies.live) {
          if (z.alive && !z.goal && !z.def.boss && z.z > t.z + 2 && Math.random() < this.objective.share) z.setGoal(t);
        }
        break;
      case 'vehicleSaved':
        this.fx.floatText(VIEW.centerX + 260, 210, `${t.name} IS THROUGH`, '#a8e090', 22);
        audio.play('wave_clear', { volume: 0.5 });
        break;
      case 'vehicleLost':
      case 'assetDestroyed':
        this.fx.explosion(t.x, t.z, 4);
        audio.play('explosion', { volume: 0.9 });
        this.fx.floatText(c.x, c.y - 40, `${t.name} LOST`, '#ff6a50', 24);
        this.cameras.main.shake(300, 0.006);
        break;
      case 'nestSpawn': {
        // A nest breeds one of the dead at its foot.
        const o = this.mission.objective;
        if (o.kind !== 'nests' || this.waves.phase === 'defeat') break;
        const wave = this.waves.current ?? this.mission.waves[this.mission.waves.length - 1];
        const z = this.enemies.spawn(o.spawn.id, wave.healthMul, wave.speedMul, t.x + (Math.random() - 0.5) * 3, t.z + 0.5);
        this.waves.notifyExtraSpawned(1);
        this.assignGoal(z);
        break;
      }
      case 'nestDestroyed':
        this.fx.explosion(t.x, t.z, 3);
        audio.play('carrier_burst', { volume: Phaser.Math.Clamp(20 / t.z, 0.4, 1), pan: t.x / 20 });
        this.fx.floatText(c.x, c.y - 30, `NEST DESTROYED — ${this.objective.nestsLeft} LEFT`, '#a8e090', 22);
        this.economy.earn(150, 'refund');
        break;
    }
    if (this.objective.failed) {
      const o = this.mission.objective;
      this.fail(o.kind === 'evacuate' ? 'EVACUATION FAILED' : `${t.name} DESTROYED`);
    }
  }

  // ------------------------------------------------------------ boss

  private onBossSpawn(z: Zombie): void {
    this.boss = z;
    this.bossPhase = 0;
    this.bossSummonLeft = z.def.boss!.summon.interval;
    const pods = z.def.boss!.pods ?? 0;
    this.hud.banner(z.def.name.toUpperCase(), { icon: 'head', text: pods ? 'PODS FIRST' : 'HEAD ONLY', tone: 'gold' }, 3.5);
    if (pods) this.spawnPods(z, pods);
    audio.play('groan_plated_0', { volume: 1, rate: 0.55 });
    this.cameras.main.shake(900, 0.004);
  }

  private updateBoss(dt: number): void {
    const b = this.boss;
    if (!b) return;
    const def = b.def.boss!;
    if (!b.alive) {
      this.hud.setBoss(null, 0);
      this.clearPods();
      if (b.resolved) {
        this.fx.explosion(b.x, b.z, 6);
        this.fx.whiteFlash(0.35, 1.2);
        audio.play('explosion', { volume: 1 });
        this.cameras.main.shake(900, 0.01);
        this.hud.radio([{ who: 'HALE', text: `It is down! ${b.def.name} is down!` }]);
      }
      this.boss = null;
      return;
    }
    const frac = b.hp / b.maxHp;
    const shielded = this.pods.some((p) => p.alive);
    this.combat.bossShielded = shielded;
    this.hud.setBoss(`${b.def.name.toUpperCase()}${shielded ? '  ·  SHIELDED' : ''}`, frac);
    this.drawPodBars();
    if (def.pods && !this.podsRegrown && frac <= 0.5) {
      this.podsRegrown = true;
      this.spawnPods(b, def.pods);
      this.hud.banner('PODS REGROWN', { icon: 'head', text: 'BURST THEM', tone: 'gold' }, 2.5);
    }
    while (this.bossPhase < def.phases.length && frac <= def.phases[this.bossPhase]) {
      this.bossPhase++;
      b.rage = def.rageSpeed ** this.bossPhase;
      this.hud.banner('ENRAGED', { icon: 'fast', text: 'FASTER', tone: 'red' }, 2.5);
      this.bossSummon(def.summon.count + 2, 'runner');
    }
    this.bossSummonLeft -= dt;
    if (this.bossSummonLeft <= 0 && (b.state === 'walk' || b.state === 'hold')) {
      this.bossSummonLeft = def.summon.interval;
      this.bossSummon(def.summon.count, def.summon.id);
    }
  }

  /** Spore pods in a ring in front of the Bloom's resting place. Each is a shootable with its own health. */
  private spawnPods(b: Zombie, count: number): void {
    this.clearPods();
    const restZ = b.def.special?.ranged?.stopRange[0] ?? b.def.boss!.stopZ;
    const hpMul = this.waves.current?.healthMul ?? 1;
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = b.x + side * (4.5 + Math.floor(i / 2) * 4.5);
      const z = restZ - 4 + (Math.floor(i / 2) % 2) * 2;
      const p = project(x, z);
      const img = this.add.image(p.sx, p.sy, 'spore_pod').setOrigin(0.5, 1).setDepth(depthForZ(z));
      img.setScale((2.6 * p.ppm) / img.height);
      const pod = { x, z, hp: 900 * hpMul, max: 900 * hpMul, img, bar: this.add.graphics().setDepth(DEPTH.worldFx), alive: true, thing: null as unknown as Parameters<Shootables['add']>[0] };
      pod.thing = {
        x, z, widthM: 2.2, heightM: 2.6,
        get alive() { return pod.alive; },
        set alive(_v: boolean) { /* follows the pod */ },
        onHit: (dmg: number) => this.hitPod(pod, dmg),
      };
      this.shootables.add(pod.thing);
      this.tweens.add({ targets: img, scaleY: img.scaleY * 1.06, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.InOut' });
      this.pods.push(pod);
    }
    audio.play('howl', { volume: 0.5, rate: 0.6 });
  }

  private hitPod(pod: GameScene['pods'][number], dmg: number): void {
    if (!pod.alive) return;
    pod.hp -= dmg;
    pod.img.setTintFill(0xffffff);
    this.time.delayedCall(60, () => pod.img.active && pod.img.clearTint());
    if (pod.hp > 0) return;
    pod.alive = false;
    this.sporeCloud(pod.x, pod.z, 3, 2.6);
    audio.play('acid_splash', { volume: 0.8, rate: 0.8 });
    pod.img.destroy();
    pod.bar.destroy();
    this.shootables.remove(pod.thing);
    if (!this.pods.some((p) => p.alive)) this.hud.banner('EXPOSED', { icon: 'head', text: 'HIT THE HEAD', tone: 'gold' }, 2.2);
  }

  private drawPodBars(): void {
    for (const pod of this.pods) {
      if (!pod.alive) continue;
      const p = project(pod.x, pod.z);
      const top = p.sy - 2.8 * p.ppm;
      pod.bar.clear();
      pod.bar.fillStyle(0x000000, 0.7).fillRect(p.sx - 26, top - 8, 52, 6);
      pod.bar.fillStyle(0xd070a0, 1).fillRect(p.sx - 25, top - 7, 50 * Math.max(0, pod.hp / pod.max), 4);
    }
  }

  private clearPods(): void {
    for (const pod of this.pods) {
      if (!pod.alive) continue;
      pod.alive = false;
      pod.img.destroy();
      pod.bar.destroy();
      this.shootables.remove(pod.thing);
    }
    this.pods = [];
    this.combat.bossShielded = false;
  }

  /** A Sporeling (or a pod) bursts: a cloud that hides what is behind it for a few seconds. */
  private sporeCloud(x: number, z: number, seconds: number, radiusM: number): void {
    const p = project(x, z);
    const img = this.add.image(p.sx, p.sy - radiusM * 0.5 * p.ppm, 'spore_cloud').setDepth(depthForZ(z) + 1).setAlpha(0);
    img.setDisplaySize(radiusM * 2.6 * p.ppm, radiusM * 2.2 * p.ppm);
    this.tweens.add({ targets: img, alpha: 0.95, duration: 250 });
    this.tweens.add({ targets: img, alpha: 0, scale: img.scale * 1.3, duration: 1200, delay: seconds * 1000, onComplete: () => img.destroy() });
  }

  /** The boss roars and calls a pack out of the fog. */
  private bossSummon(count: number, id: string): void {
    const b = this.boss!;
    audio.play('groan_plated_1', { volume: 1, rate: 0.5 });
    this.cameras.main.shake(500, 0.004);
    const wave = this.waves.current;
    for (let i = 0; i < count; i++) {
      const z = this.enemies.spawn(id, wave?.healthMul ?? 1, wave?.speedMul ?? 1, b.x + (Math.random() * 2 - 1) * 12, Math.min(FIELD.spawnZ, b.z + 8 + Math.random() * 10));
      this.assignGoal(z);
    }
    this.waves.notifyExtraSpawned(count);
  }

  // ------------------------------------------------------------ hints

  private startHints(): void {
    const touch = this.touchUi.isEnabled;
    this.hint('aim', touch
      ? [{ icon: 'touch', label: 'LEFT: AIM' }, { icon: 'touch', label: 'RIGHT: FIRE' }]
      : [{ icon: 'mouse', label: 'AIM' }, { icon: 'mouse', label: 'FIRE' }]);
    if (this.night) this.hint('flare', touch ? [{ icon: 'flare', label: 'TAP THE FLARE' }] : [{ key: 'Q', icon: 'flare', label: 'FLARE' }]);
    if (this.weaponSlots.length > 1) {
      this.hint('switch', touch
        ? [{ icon: 'touch', label: 'TAP A GUN' }]
        : [{ key: '1' }, { key: String(this.weaponSlots.length), label: 'SWITCH' }]);
    }
  }

  /** Shows a control hint once ever (remembered in the profile). */
  private hint(id: HintId, parts: HintPart[]): void {
    if (this.training || this.hintsShown.has(id)) return;
    this.hintsShown.add(id);
    this.hud.hint(parts);
    if (!isTestMode()) profile.update((d) => { if (!d.hints.includes(id)) d.hints.push(id); });
  }

  /** Hints that wait for a moment in battle: low ammo, a mod or support in hand. */
  private checkHints(): void {
    if (this.training) return;
    const touch = this.touchUi.isEnabled;
    const key = (k: string): string | undefined => (touch ? undefined : k);
    const cur = this.weapons.current;
    if (cur.mag <= Math.ceil(cur.def.magazine * 0.3)) {
      this.hint('reload', [{ key: key('R'), icon: 'replay', label: 'RELOAD' }]);
    }
    for (const [id, m] of this.abilities.mods) {
      if (m.charges <= 0) continue;
      const def = MODS.find((x) => x.id === id)!;
      this.hint('mod', [{ key: key(def.key), icon: ITEM_ICON[id], label: def.short }]);
    }
    for (const [id, st] of this.abilities.support) {
      if (st.charges <= 0) continue;
      const def = SUPPORT.find((x) => x.id === id)!;
      this.hint('support', [{ key: key(def.key), icon: ITEM_ICON[id], label: 'READY' }]);
    }
  }

  // ------------------------------------------------------------ Act 2 enemies

  /** Spitter and Howler actions: the wind-up tell, the spit, the howl. */
  private onEnemyAction(z: Zombie, action: 'charge' | 'spit' | 'howl'): void {
    const pan = (z.sx - VIEW.centerX) / VIEW.centerX;
    const vol = Phaser.Math.Clamp(18 / z.z, 0.25, 1);
    if (action === 'charge') {
      // The howl itself is the warning: it rises for the whole wind-up.
      if (z.channelKind === 'howl') audio.play('howl', { volume: vol, pan, rate: z.def.boss ? 0.7 : 1 });
      return;
    }
    if (action === 'spit') {
      const spit = z.def.special?.ranged;
      if (!spit) return;
      const from = { x: 0, y: 0 };
      z.headScreen(from);
      const img = this.add.image(from.x, from.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9aff60).setScale(0.12).setDepth(DEPTH_GLOB);
      const toX = Phaser.Math.Clamp(z.sx + (Math.random() - 0.5) * 260, 140, VIEW.width - 140);
      this.globs.push({ img, t: 0, dur: 0.45 + z.z / 60, x0: from.x, y0: from.y, x1: toX, y1: VIEW.wallTop + 8, dmg: spit.damage });
      audio.play('acid_spit', { volume: vol, pan });
      return;
    }
    // The howl lands: the dead around it speed up; a Howler's first howl calls more out of the fog.
    const howl = z.def.special?.howl;
    if (!howl) return;
    const sped = this.enemies.hasteAround(z.x, z.z, howl.radius, howl.speedMul, howl.duration, z);
    const ring = { x: 0, y: 0 };
    z.headScreen(ring);
    const circle = this.add.circle(ring.x, ring.y, 10).setStrokeStyle(4, 0xc8d8ff, 0.9).setFillStyle(0, 0).setDepth(DEPTH_GLOB);
    this.tweens.add({ targets: circle, radius: 220, alpha: 0, duration: 900, onComplete: () => circle.destroy() });
    if (sped > 0) this.fx.floatText(ring.x, ring.y - 30, 'HOWL — THEY SPEED UP', '#c8d8ff', 16);
    if (howl.summon && (!z.summoned || z.def.boss)) {
      z.summoned = true;
      const wave = this.waves.current;
      for (let i = 0; i < howl.summon.count; i++) {
        const s = this.enemies.spawn(howl.summon.id, wave?.healthMul ?? 1, wave?.speedMul ?? 1, z.x + (Math.random() * 2 - 1) * 10, Math.min(FIELD.spawnZ, z.z + 10 + Math.random() * 10));
        this.assignGoal(s);
      }
      this.waves.notifyExtraSpawned(howl.summon.count);
    }
  }

  /** Acid globs arc onto the sandbags. */
  private updateGlobs(dt: number): void {
    for (let i = this.globs.length - 1; i >= 0; i--) {
      const g = this.globs[i];
      g.t += dt;
      const k = Math.min(1, g.t / g.dur);
      const arc = Math.sin(k * Math.PI) * 120;
      g.img.setPosition(g.x0 + (g.x1 - g.x0) * k, g.y0 + (g.y1 - g.y0) * k - arc).setScale(0.12 + k * 0.35);
      if (k < 1) continue;
      g.img.destroy();
      this.globs.splice(i, 1);
      if (this.over) continue;
      audio.play('acid_splash', { volume: 0.8, pan: (g.x1 - VIEW.centerX) / VIEW.centerX });
      this.fx.sandbagImpact(g.x1, g.y1);
      this.damageBunker(g.dmg, g.x1);
    }
  }

  /** Sappers beep faster as they close in: the warning to shoot them. */
  private updateBeeps(dt: number): void {
    for (const z of this.enemies.live) {
      if (!z.alive || !z.def.special?.deathBlast) continue;
      if (z.z > 45) continue;
      const left = (this.beeps.get(z) ?? 0) - dt;
      if (left <= 0) {
        audio.play('sapper_beep', { volume: Phaser.Math.Clamp(10 / z.z, 0.15, 0.7), pan: (z.sx - VIEW.centerX) / VIEW.centerX });
        this.beeps.set(z, Phaser.Math.Clamp(z.z / 40, 0.12, 0.9));
      } else this.beeps.set(z, left);
    }
    for (const z of this.beeps.keys()) if (!z.alive) this.beeps.delete(z);
  }

  // ------------------------------------------------------------ streaks and Focus

  /** Cash multiplier for a kill streak. */
  private static streakMul(streak: number): number {
    return streak >= 50 ? 2 : streak >= 25 ? 1.5 : streak >= 10 ? 1.25 : 1;
  }

  /** Every radio line of this battle in full (the pause menu's radio log). */
  get radioLog(): { who: string; text: string }[] {
    return this.hud.radioLog;
  }

  /** Kill cash multiplier from the mission (Fog Surge "Bounty"). */
  private get cashMul(): number {
    return this.mission.modifiers?.cashMul ?? 1;
  }

  private onKill(z: Zombie, headshot: boolean, source: DamageSource): void {
    const cloud = z.def.special?.sporeCloud;
    if (cloud) {
      this.sporeCloud(z.x, z.z, cloud.seconds, cloud.radiusM);
      audio.play('acid_splash', { volume: Phaser.Math.Clamp(12 / z.z, 0.3, 0.8), rate: 0.7 });
    }
    if (this.training) return;
    this.runEnemyKills[z.def.id] = (this.runEnemyKills[z.def.id] ?? 0) + 1;
    // The player's own kills count toward the weapon in hand (mastery); squad and supports do not.
    if (source === 'bullet' || source === 'burn' || source === 'blast') {
      const w = this.weapons.current.def.id;
      this.runWeaponKills[w] = (this.runWeaponKills[w] ?? 0) + 1;
    }
    const before = GameScene.streakMul(this.streak);
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    const after = GameScene.streakMul(this.streak);
    this.combat.rewardMul = after * this.cashMul;
    if (after > before) {
      this.fx.floatText(VIEW.centerX, 230, `STREAK ${this.streak} — CASH ×${after}`, '#ffd060', 24);
      audio.play('wave_clear', { volume: 0.4, rate: 1.3 });
    }
    if (this.focusEnabled && this.focusLeft <= 0) {
      const was = this.focusMeter;
      this.focusMeter = Math.min(1, this.focusMeter + (headshot ? 0.12 : 0.04));
      if (was < 1 && this.focusMeter >= 1) {
        this.hint('focus', [{ key: this.touchUi.isEnabled ? undefined : 'SHIFT', icon: 'eye', label: 'SLOW TIME' }]);
        audio.play('ui_click', { volume: 0.6, rate: 0.7 });
      }
    }
  }

  /** The bunker took real damage: the streak is broken. */
  private breakStreak(): void {
    if (this.streak >= 10) this.fx.floatText(VIEW.centerX, 230, 'STREAK BROKEN', '#ff8a70', 18);
    this.streak = 0;
    this.combat.rewardMul = this.cashMul;
  }

  /** Focus: five seconds of slowed time for everything but the player's hands. */
  activateFocus(): void {
    if (!this.focusEnabled || this.over || this.focusLeft > 0) return;
    if (this.focusMeter < 1) {
      audio.play('deny', { volume: 0.4 });
      return;
    }
    this.focusMeter = 0;
    this.focusLeft = FOCUS_SECONDS;
    audio.play('focus_in', { volume: 0.8 });
    this.focusTint ??= this.add.rectangle(-BLEED.x, -BLEED.y, MAX_SCREEN.width, VIEW.hudTop + BLEED.y, 0x4060a0, 0.14).setOrigin(0).setDepth(DEPTH.overlay - 2);
    this.focusTint.setVisible(true);
  }

  private updateFocus(dt: number): void {
    if (this.focusLeft <= 0) return;
    this.focusLeft -= dt;
    if (this.focusLeft <= 0) {
      this.focusLeft = 0;
      this.focusTint?.setVisible(false);
      audio.play('focus_out', { volume: 0.7 });
    }
  }

  // ------------------------------------------------------------ field objects

  private fireFlare(): void {
    if (!this.night || this.over) return;
    if (this.night.fireFlare(this.aimCursorX, this.aimCursorY)) return;
    audio.play('deny', { volume: 0.5 });
    this.fx.floatText(VIEW.centerX, VIEW.hudTop - 90, 'NO FLARES LEFT — MORE NEXT WAVE', '#ff9a70', 16);
  }

  /** A crate was shot down: pay out cash, a support or mod charge, or ammo. */
  private claimDrop(reward: DropReward, x: number, y: number): void {
    audio.play('buy', { volume: 0.8 });
    let text = '';
    const pick = <T>(xs: T[]): T | undefined => xs[Math.floor(Math.random() * xs.length)];
    if (reward === 'support' || reward === 'mod') {
      const kind = reward;
      const defs = kind === 'support' ? SUPPORT.map((s) => ({ id: s.id as string, name: s.name })) : MODS.map((m) => ({ id: m.id as string, name: m.name }));
      const slots = (kind === 'support' ? this.abilities.support : this.abilities.mods) as Map<string, { charges: number; max: number }>;
      const options = defs.filter((d) => this.offers(`${kind}:${d.id}`) && (slots.get(d.id)?.charges ?? 0) < (slots.get(d.id)?.max ?? 0));
      const choice = pick(options);
      if (choice && this.abilities.addCharge(kind, choice.id)) text = `CRATE: +1 ${choice.name.toUpperCase()}`;
      else reward = 'cash';
    }
    if (reward === 'ammo') {
      for (const id of this.weaponSlots) {
        const def = this.weapons.states.get(id)?.def;
        if (def && def.ammoPack.rounds > 0) this.weapons.addAmmo(id, def.ammoPack.rounds * 2);
      }
      text = 'CRATE: AMMO FOR EVERY GUN';
    }
    if (reward === 'cash') {
      this.economy.earn(350, 'refund');
      text = 'CRATE: +$350';
    }
    this.fx.floatText(x || VIEW.centerX, (y || 260) - 20, text, '#a8e090', 20);
  }

  /** A fuel drum went up: a big blast for the dead around it (and other drums). */
  private blowDrum(x: number, z: number): void {
    this.fx.explosion(x, z, 5);
    audio.play('explosion', { volume: Phaser.Math.Clamp(20 / z, 0.5, 1), pan: x / 20 });
    this.cameras.main.shake(250, Phaser.Math.Clamp(0.08 / z, 0.002, 0.008));
    this.combat.explode(x, z, 6, 450, 'blast');
    for (const s of this.shootables.inRadius(x, z, 6)) s.onHit(450, 0, 0);
  }

  private hitNest(t: FieldTarget, damage: number): void {
    this.targetView.hit(t);
    if (Math.random() < 0.4) audio.play(`hit_flesh_${Math.floor(Math.random() * 3)}`, { volume: 0.5, pan: t.x / 20 });
    const ev = this.objective.damage(t, damage);
    if (ev) this.onObjectiveEvent(ev);
  }

  /** True on phones/tablets whose primary pointer is a finger. */
  private prefersTouch(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  }

  /** Phone aim assistance (see aimAssist.ts): where the crosshair goes for a finger at (x, y). */
  private assistAim(x: number, y: number, dt: number): { x: number; y: number } {
    const pts = this.assistPoints;
    const at = this.assistScratch;
    pts.length = 0;
    for (const z of this.enemies.live) {
      if (!z.alive) continue;
      // Skip enemies that are clearly out of reach sideways. Their feet can be far below
      // the crosshair while their head and chest are right on it, so don't cull vertically.
      if (Math.abs(z.sx - x) > AIM.reach + 60) continue;
      z.headScreen(at);
      pts.push({ owner: z, part: 'head', x: at.x, y: at.y, baseX: z.sx, baseY: z.sy });
      z.chestScreen(at);
      pts.push({ owner: z, part: 'chest', x: at.x, y: at.y, baseX: z.sx, baseY: z.sy });
    }
    const aim = this.assist.step({ x, y }, pts, dt);
    return {
      x: Phaser.Math.Clamp(aim.x, 0, VIEW.width),
      y: Phaser.Math.Clamp(aim.y, 0, VIEW.hudTop),
    };
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
    kb.addCapture('SPACE,ENTER,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,A,S,D,W,E,R,Q,SHIFT');
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
      Q: () => this.fireFlare(),
      SHIFT: () => this.activateFocus(),
    };
    for (const [k, fn] of Object.entries(map)) kb.on(`keydown-${k}`, () => { if (!this.over) fn(); });
    // Number keys on the numpad too
    kb.on('keydown', (e: KeyboardEvent) => {
      if (this.over) return;
      const n = Number(e.key);
      if (e.code.startsWith('Numpad') && n >= 1 && n <= 4) this.selectWeapon(n);
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      audio.unlock();
      // A click on a card over the field is that card's, not a shot or an aim.
      if (p.downTime === this.cardClickAt) return;
      if (p.wasTouch) {
        document.body.classList.add('touched');
        this.touchUi.setEnabled(true);
        // HUD slots handle their own taps; only the battlefield is routed here.
        const at = designPoint(p);
        if (at.y >= VIEW.hudTop) return;
        // The flare chip and the focus bar sit over the field and take their own taps.
        if (over.length > 0) return;
        const button = touchButtonAt(at.x, at.y, this.touchUi.deployVisible);
        if (button) {
          if (button === 'fire' && !this.fireAllowed()) return;
          if (button !== 'fire' || this.firePointerId === null) this.pressTouchButton(button, p);
          return;
        }
        if (isAimTouch(at.x, at.y)) {
          if (this.aimPointerId === null) {
            this.aimPointerId = p.id;
            this.stickBase = { x: at.x, y: at.y };
            this.stickKnob = { x: at.x, y: at.y };
          }
        } else if (isFireTouch(at.x, at.y) && this.firePointerId === null && this.fireAllowed()) {
          this.pressTouchButton('fire', p);
        }
        return;
      }
      if (!this.prefersTouch()) this.touchUi.setEnabled(false);
      if (p.leftButtonDown() && designPoint(p).y < VIEW.hudTop && this.fireAllowed()) this.trigger = true;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      // A real mouse on a hybrid laptop switches the on-screen controls off.
      if (!p.wasTouch && this.touchUi.isEnabled && !this.prefersTouch()) this.touchUi.setEnabled(false);
      if (p.wasTouch && p.id === this.aimPointerId) this.stickKnob = pushStick(this.stickBase, designPoint(p));
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
    // A finger sliding off the canvas must not stop the other thumb's fire.
    this.input.on('gameout', () => { if (this.firePointerId === null) this.trigger = false; });
    this.events.on(Phaser.Scenes.Events.PAUSE, this.releaseTouch, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
  }

  /** Lets go of both thumbs, for when their lifting would go unseen (pause, armory, window switch). */
  private releaseTouch(): void {
    this.trigger = false;
    this.aimPointerId = null;
    this.firePointerId = null;
    this.touchUi?.setPressed('fire', false);
  }

  private onBlur(): void {
    this.releaseTouch();
    if (this.scene.isActive() && !this.over && this.waves.phase === 'active') this.openPause();
  }

  private teardown(): void {
    this.events.off(Phaser.Scenes.Events.PAUSE, this.releaseTouch, this);
    this.tutorial?.destroy();
    this.tutorial = null;
    portal.gameplayStop();
    this.wind?.stop(0.3);
    this.music?.stop(0.6);
    this.chopper?.rotor?.stop(0.4);
    this.chopper = null;
    this.support.clear();
    this.projectiles.clear();
    this.enemies.clear();
    this.targetView.clear();
    this.squad.clear();
    this.fieldObjects.clear();
    this.night?.clear();
    this.night = null;
    this.clearPods();
    for (const g of this.globs) g.img.destroy();
    this.globs = [];
    this.focusTint?.destroy();
    this.focusTint = null;
    this.shootables.clear();
    this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
    audio.setLoopsPaused(false);
  }

  /** The first-time briefing, or a replay of it from the menu. */
  private startTutorial(): void {
    this.tutorial = new Tutorial(this, {
      weapons: this.weapons,
      enemies: this.enemies,
      waves: this.waves,
      touch: this.touchUi.isEnabled,
      clearBanner: () => this.hud.clearBanner(),
      slots: this.hud.slots,
      onFinish: () => this.finishTutorial(),
    });
  }

  private finishTutorial(): void {
    profile.update((d) => {
      d.tutorialSeen = true;
    });
    this.tutorial = null;
    this.hud.radio(this.mission.brief);
  }

  /** Whether this mission offers a HUD/armory item (`weapon:m4`, `mod:ap`, `support:nuke`…). */
  offers(id: string): boolean {
    if (id.startsWith('weapon:')) return this.weaponSlots.includes(id.slice(7));
    return !this.gear || this.gear.has(id);
  }

  /** Fire is held back while the briefing talks, so a click on Continue never shoots. */
  private fireAllowed(): boolean {
    return !this.tutorial || fireAllowed(this.tutorial.stepId);
  }

  /** The objective, the bonus star's progress and the waves, across the top. */
  private refreshStrip(): void {
    if (this.training) return;
    const o = this.objective;
    const stats = this.combat.stats;
    const asset = o.targets[0];
    this.hud.setStrip(stripChips(this.mission.objective, this.mission.mode ? null : this.mission.bonus, {
      asset: asset && asset.max > 0 ? asset.hp / asset.max : 1,
      nestsLeft: o.nestsLeft,
      saved: o.saved,
      lost: o.lost,
      headshots: stats.headshotKills,
      accuracy: stats.shots ? stats.hits / stats.shots : null,
      supportsUsed: [...this.supportsUsed],
    }));
  }

  // ------------------------------------------------------------ actions

  startNextWave(): boolean {
    if (this.over) return false;
    if (this.tutorial && !wavesAllowed(this.tutorial.stepId)) return false;
    const ok = this.waves.startNext();
    if (ok) this.hud.clearBanner();
    return ok;
  }

  /** Keys 1–4 pick the weapon in that HUD slot (the loadout order). */
  selectWeapon(slot: number): void {
    const id = this.weaponSlots[slot - 1];
    if (!id) return;
    if (!this.weapons.select(id)) {
      const def = weaponById(id);
      if (!this.weapons.isUnlocked(def.id)) {
        audio.play('deny', { volume: 0.5 });
        this.fx.floatText(VIEW.centerX, VIEW.hudTop - 90, `${def.shortName} LOCKED — CLEAR WAVE ${this.weapons.unlockWave(def.id)} TO UNLOCK`, '#ff9a70', 16);
      } else if (!this.weapons.owns(def.id)) {
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
    this.supportsUsed.add(def.id);
    this.supportCalls++;
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
    portal.gameplayStop();
    this.scene.pause();
    this.scene.launch('Shop');
  }

  openPause(): void {
    if (this.over || this.scene.isPaused()) return;
    this.trigger = false;
    audio.setLoopsPaused(true);
    portal.gameplayStop();
    this.scene.pause();
    this.scene.launch('Pause');
  }

  /** Called by overlay scenes when they close. */
  resumeFromOverlay(): void {
    audio.setLoopsPaused(false);
    portal.gameplayStart();
    this.trigger = false;
    this.scene.resume();
  }

  // ------------------------------------------------------------ door gunner

  /** The helicopter door: metal frame over the bunker slit, rotor noise and shadow. */
  private buildChopper(): NonNullable<GameScene['chopper']> {
    const g = this.add.graphics().setDepth(DEPTH.frame + 5);
    const top = VIEW.hudTop;
    const metal = 0x2a2e26, edge = 0x14160f, light = 0x4a5040;
    // Door pillars and the roof bar, with a lighter inner lip.
    g.fillStyle(metal, 1).fillRect(-BLEED.x, -BLEED.y, 86 + BLEED.x, top + BLEED.y).fillRect(VIEW.width - 86, -BLEED.y, 86 + BLEED.x, top + BLEED.y)
      .fillRect(-BLEED.x, -BLEED.y, MAX_SCREEN.width, 52 + BLEED.y);
    g.fillStyle(light, 1).fillRect(80, 46, 6, top - 46).fillRect(VIEW.width - 86, 46, 6, top - 46).fillRect(80, 46, VIEW.width - 160, 6);
    g.fillStyle(edge, 1);
    for (let y = 70; y < top; y += 42) {
      g.fillCircle(22, y, 4).fillCircle(64, y, 4).fillCircle(VIEW.width - 22, y, 4).fillCircle(VIEW.width - 64, y, 4);
    }
    for (let x = 120; x < VIEW.width - 100; x += 60) g.fillCircle(x, 24, 4);
    // The door rail and a grab handle.
    g.fillStyle(0x0c0d0a, 1).fillRect(86, 58, VIEW.width - 172, 5);
    g.lineStyle(8, 0x1a1c16, 1).strokeRoundedRect(VIEW.width - 74, 180, 40, 160, 14);
    // The skid below the door.
    g.fillStyle(0x1a1c16, 1).fillRect(-BLEED.x, top - 26, MAX_SCREEN.width, 12);
    const shade = this.add.rectangle(-BLEED.x, -BLEED.y, MAX_SCREEN.width, top + BLEED.y, 0x000000, 0).setOrigin(0).setDepth(DEPTH.frame + 4);
    const rotor = audio.loop('heli_loop', 0.45, 'sfx', 1.5);
    return { frame: g, shade, rotor, bump: 3, t: 0 };
  }

  /** Blade shadows flicker over the field; now and then the airframe bumps. */
  private updateChopper(dt: number): void {
    const c = this.chopper!;
    c.t += dt;
    c.shade.setAlpha(0.05 + 0.07 * Math.max(0, Math.sin(c.t * 34)));
    c.bump -= dt;
    if (c.bump <= 0 && !this.over) {
      c.bump = 3 + Math.random() * 3;
      this.cameras.main.shake(380, 0.0018);
    }
  }

  private endRun(victory: boolean): void {
    // A win and a lost bunker can both be pending; only the first one to land counts.
    if (this.ended) return;
    this.ended = true;
    portal.gameplayStop();
    const s = this.combat.stats;
    const cleared = victory ? this.waves.wave : Math.max(0, this.waves.wave - 1);
    const result: MissionResult = {
      victory,
      wavesCleared: cleared,
      totalWaves: this.waves.totalWaves,
      kills: s.kills,
      headshots: s.headshotKills,
      accuracy: s.shots ? s.hits / s.shots : 0,
      bunkerFraction: this.bunker.fraction,
      supportsUsed: [...this.supportsUsed],
      earned: this.economy.totalEarned,
      ...this.objective.summary(),
    };
    // Test-mode runs (full arsenal, $500k) and training are scored but never saved.
    const test = isTestMode() || this.training;
    const target = test ? structuredClone(profile.get()) : profile.get();
    const now = Date.now();
    const m = this.mission;
    const outcome = m.mode ? applyModeResult(target, m, result, now) : applyResult(target, m, result);
    // Every saved battle also counts toward daily contracts, Field Notes and weapon mastery.
    const rewards = this.training ? undefined : recordRun(target, {
      mode: m.mode ?? 'campaign', objective: m.objective.kind, victory, kills: s.kills, headshots: s.headshotKills,
      stars: outcome.stars, wavesCleared: cleared, enemyKills: this.runEnemyKills, weaponKills: this.runWeaponKills,
      supportCalls: this.supportCalls, bestStreak: this.bestStreak,
    }, now);
    const contested = this.training || m.mode ? 0 : claimContested(target, m, victory, now);
    if (!this.training) noteFinish(target, m.id, victory, this.playSeconds);
    if (!test) profile.save();
    this.over = true;
    this.hud.hideBanner();
    // A mission can end while the briefing is still up; it is not marked as seen.
    this.tutorial?.destroy();
    this.tutorial = null;
    this.scene.pause();
    const data: ResultsData = { missionId: m.id, mission: m, result, outcome, rewards, contested, saved: !test, failReason: victory ? undefined : this.failReason };
    this.scene.launch('Results', data);
  }

  /** Damage from something that is not standing at the wall (acid globs). */
  private damageBunker(amount: number, screenX: number): void {
    if (amount <= 0) return;
    this.bunker.damage(amount);
    if (this.bunker.shielded) return;
    this.breakStreak();
    this.fx.damageFlash(amount);
    this.cameras.main.shake(90, 0.0025);
    void screenX;
  }

  private hitBunker(amount: number, z: Zombie): void {
    if (amount <= 0) return;
    const pan = (z.sx - VIEW.centerX) / VIEW.centerX;
    this.bunker.damage(amount);
    if (!this.bunker.shielded) this.breakStreak();
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
    this.night?.muzzleFlash();
    const rate = 1 + (Math.random() * 2 - 1) * def.sound.pitchJitter;
    audio.play(def.sound.shot, { volume: def.id === 'm4' ? 0.85 : def.kind === 'flame' ? 0.5 : 1, rate });
    if (def.shake > 0) this.cameras.main.shake(70, def.shake);
    if (def.kind === 'flame') {
      // A gout of burning fuel from the nozzle to the aim point.
      this.combat.flame(def, aimX, aimY);
      const mx = this.view.muzzle.x, my = this.view.muzzle.y;
      for (let k = 1; k <= 4; k++) {
        const t = k / 4;
        this.fx.fireBurst(mx + (aimX - mx) * t + (Math.random() - 0.5) * 30 * t, my + (aimY - my) * t, 0.5 + t * 1.4, 1);
      }
      return;
    }
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
    // Random point(s) inside the spread circle (uniform disc); a shotgun throws a pellet pattern.
    const pellets = def.pellets ?? 1;
    if (pellets > 1) this.combat.beginBlast();
    for (let i = 0; i < pellets; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * spread;
      const x = aimX + Math.cos(a) * r, y = aimY + Math.sin(a) * r;
      this.combat.fireHitscan(def, x, y, this.view.muzzle.x, this.view.muzzle.y, pellets > 1 ? (i === 0 ? 'first' : 'rest') : null);
    }
    // The Tesla throws a shockwave from its coil instead of a shell.
    if (def.id === 'tesla') this.fx.shockwave(this.view.muzzle.x, this.view.muzzle.y);
    else this.fx.ejectCasing(this.view.ejectPort.x, this.view.ejectPort.y);
  }

  // ------------------------------------------------------------ loop

  /**
   * Holding the right button aims down the sights: the camera magnifies about the middle of
   * the screen, the HUD and the gun step aside, and only the crosshair is shown, magnified.
   */
  /**
   * Holding the right button zooms the camera onto the scene, for every gun. The cursor stays as
   * it is. The M82 is a scope: the zoom centres on the crosshair, and the camera moves one-to-one
   * with it, so the two keep a fixed place to each other.
   * Returns where the crosshair is in the world, for the shots and the gun to aim at.
   */
  private updateAimZoom(dt: number, mouse: { x: number; y: number }, plain: { x: number; y: number }): { x: number; y: number } {
    const def = this.weapons.current.def;
    const holding = this.input.activePointer.rightButtonDown() && !this.prefersTouch() && !this.over;
    const busy = this.weapons.reloading || this.weapons.switching;
    const top = def.aimZoom ?? 1.35;
    const want = holding && !busy ? top : 1;
    this.zoomNow += (want - this.zoomNow) * Math.min(1, dt * 12);
    if (Math.abs(this.zoomNow - 1) < 0.002) this.zoomNow = 1;
    const z = this.zoomNow;
    const zoomed = z > 1.02;
    const blend = Phaser.Math.Clamp((z - 1) / Math.max(0.001, top - 1), 0, 1);
    const scope = !!def.scopeZoom;
    const C: { x: number; y: number } = { x: VIEW.centerX, y: VIEW.height / 2 };
    const S = mouse;

    // The scope's camera centre moves by exactly the mouse's movement (divided by the zoom, so it
    // matches on screen), and rests on the mouse otherwise.
    if (holding && !busy && blend > 0) {
      this.scopeCentre.x += (S.x - this.lastMouse.x) / z;
      this.scopeCentre.y += (S.y - this.lastMouse.y) / z;
    } else {
      this.scopeCentre.x = S.x;
      this.scopeCentre.y = S.y;
    }
    this.lastMouse.x = S.x;
    this.lastMouse.y = S.y;

    // Where the crosshair is drawn on the screen, and the world point the camera is centred on.
    // Other guns keep the cursor where the mouse is and zoom about the middle of the screen.
    const Pd = scope
      ? { x: Phaser.Math.Linear(S.x, C.x, blend), y: Phaser.Math.Linear(S.y, C.y, blend) }
      : S;
    const Cd = scope
      ? { x: Phaser.Math.Linear(C.x, this.scopeCentre.x, blend), y: Phaser.Math.Linear(C.y, this.scopeCentre.y, blend) }
      : C;
    const scopeOn = scope && zoomed;
    const cam = this.cameras.main;
    cam.setZoom(z);
    cam.setScroll(-SCREEN.mx + (Cd.x - C.x), -SCREEN.my + (Cd.y - C.y));
    this.view.setCameraZoom(z);

    if (scopeOn !== this.aimZoomed) {
      this.aimZoomed = scopeOn;
      for (const o of this.hudObjects) (o as unknown as { setVisible(v: boolean): unknown }).setVisible(!scopeOn);
    }
    // Unzoomed, the aim is the one passed in. On a phone that is the stick's: the raw pointer
    // there is whichever finger moved last, often the one firing.
    if (z === 1) return plain;
    return {
      x: Cd.x + (Pd.x - C.x) / z,
      y: Cd.y + (Pd.y - C.y) / z,
    };
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.tutorial?.update(dt);
    const p = this.input.activePointer;
    // The crosshair is exactly where the mouse is (or where the touch aim stick
    // has moved it); the gun is then rotated to point its barrel at it.
    const touchMode = this.touchUi.isEnabled;
    const mouse = designPoint(p);
    // The stick moves the crosshair for as long as it is pushed, in real time even during Focus.
    if (touchMode && this.aimPointerId !== null && !this.over) {
      this.touchCursor = stepStickAim(this.touchCursor, this.stickBase, this.stickKnob, dt);
    }
    const rawX = Phaser.Math.Clamp(touchMode ? this.touchCursor.x : mouse.x, 0, VIEW.width);
    const rawY = Phaser.Math.Clamp(touchMode ? this.touchCursor.y : mouse.y, 0, VIEW.hudTop);
    // On touch the crosshair also gets a little aim assistance toward nearby enemies.
    if (!touchMode) this.assist.reset();
    const assisted = touchMode ? this.assistAim(rawX, rawY, dt) : { x: rawX, y: rawY };
    const aimed = this.updateAimZoom(dt, mouse, assisted);
    const cursorAimX = aimed.x;
    const cursorAimY = aimed.y;
    this.aimCursorX = cursorAimX;
    this.aimCursorY = cursorAimY;
    const gunAimX = cursorAimX;
    const gunAimY = cursorAimY;
    const pointerY = touchMode ? 300 : mouse.y;

    // Focus slows the world; the player's hands (aim, fire, reload) keep real time.
    this.updateFocus(dt);
    const wdt = this.focusLeft > 0 ? dt * FOCUS_SCALE : dt;
    if (!this.over) {
      for (const req of this.waves.update(wdt)) {
        const z = this.enemies.spawn(req.enemy, req.healthMul, req.speedMul);
        this.waves.notifySpawned(1);
        if (z.def.boss) this.onBossSpawn(z);
        else this.assignGoal(z);
      }
      for (const ev of this.objective.update(wdt, this.waves.phase === 'active')) this.onObjectiveEvent(ev);
      if (this.awaitingObjective && !this.objective.pending && !this.objective.failed) {
        this.awaitingObjective = false;
        this.hud.banner('MISSION COMPLETE', { icon: 'truck', text: 'ALL OUT', tone: 'green' }, 999, true);
        this.time.delayedCall(2200, () => this.endRun(true));
      }
      this.updateBoss(wdt);
      this.squad.update(wdt, this.waves.phase === 'active');
      this.fieldObjects.update(wdt, this.waves.phase === 'active');
      this.updateBeeps(wdt);
      this.hintCheckLeft -= dt;
      if (this.hintCheckLeft <= 0) {
        this.hintCheckLeft = 0.5;
        this.checkHints();
      }
    }
    this.updateGlobs(wdt);
    if (!this.over) this.playSeconds += dt;
    if (this.chopper) this.updateChopper(dt);
    this.targetView.sync(this.objective.targets, wdt);
    this.refreshStrip();
    this.abilities.update(dt);
    this.combat.setActiveMods(this.abilities.activeMods(this.activeMods));
    this.bunker.update(dt);
    this.field.raiseShutters(this.bunker.shielded);
    this.combat.coverTop = this.field.coverTop;
    this.combat.shuttersUp = this.bunker.shielded;

    const inField = pointerY < VIEW.hudTop && pointerY > 0;
    this.weapons.update(dt, this.trigger && inField && !this.over);

    this.enemies.update(wdt);
    this.combat.update(wdt);
    this.support.update(wdt);
    this.projectiles.update(wdt);
    this.fx.update(wdt);
    this.field.update(dt);

    const hover = inField ? this.enemies.raycast(cursorAimX, cursorAimY) : null;
    this.hoverZone = hover ? hover.zone : null;
    this.view.update(dt, cursorAimX, cursorAimY, gunAimX, gunAimY, this.weapons.spread, this.weapons.reloadProgress, this.weapons.reloading, this.hoverZone === 'head', !!hover);
    // While aiming, only the magnified crosshair is shown: the gun itself steps out of view.
    this.view.setVisible(!this.over && !(this.aimZoomed && this.weapons.current.def.scopeZoom));
    this.night?.update(dt, cursorAimX, cursorAimY);
    this.hud.setFocus(this.focusEnabled, this.focusMeter, this.focusLeft / FOCUS_SECONDS);
    this.hud.setStreak(this.training ? 0 : this.streak, GameScene.streakMul(this.streak), this.night ? this.night.flaresLeft : -1);
    this.hud.update(dt);
    const w = this.waves;
    this.touchUi.update(dt, {
      reloading: this.weapons.reloading,
      reloadProgress: this.weapons.reloadProgress,
      deploy: w.canStartNext && w.remaining === 0 && !this.over ? `DEPLOY WAVE ${w.wave + 1}` : null,
      inputLocked: this.over,
      stick: this.aimPointerId === null ? null : { base: this.stickBase, knob: this.stickKnob },
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
