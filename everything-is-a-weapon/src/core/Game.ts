import { AdManager } from '../ads/AdManager';
import { AnalyticsManager } from '../analytics/AnalyticsManager';
import { AudioManager } from '../audio/AudioManager';
import { createPet, type Pet } from '../entities/Pets';
import { Enemy } from '../entities/Enemy';
import { ENEMY_TYPES, type EnemyType, type EnemyTypeId } from '../entities/EnemyTypes';
import type { PhysicsObject } from '../entities/PhysicsObject';
import { Player } from '../entities/Player';
import { ChallengeSystem } from '../gameplay/ChallengeSystem';
import { actFor, briefingFor, CAMPAIGN_ROOMS, CONTRACTS, FINAL_ROOM_INDEX, starsFor, todayKey, yesterdayKey, totalStars } from '../gameplay/Campaign';
import { extendChain, freshChain } from '../gameplay/Chain';
import { ABILITIES, AbilitySystem, type AbilityId } from '../gameplay/Abilities';
import { DiscoverySystem } from '../gameplay/DiscoverySystem';
import { isEdgeId, startingEdge, type EdgeDefinition, type EdgeId } from '../gameplay/Edges';
import { EdgeSystem } from '../gameplay/EdgeSystem';
import { HeatSystem, type HeatEvent } from '../gameplay/Heat';
import { enforcerSpec, headlinerSpec, releaseIncident, rushRegulars, type IncidentSpec } from '../gameplay/Incidents';
import { ImpactSystem } from '../gameplay/ImpactSystem';
import { NavField } from '../gameplay/Navigation';
import { placePickups, updateRage } from '../gameplay/Pickups';
import type { RoomDefinition } from '../gameplay/Room';
import { dailyChallenge } from '../gameplay/RoomGenerator';
import { campaignBossType, RoomManager, type RoomRuntime } from '../gameplay/RoomManager';
import { endRun, recordClear, recordFail, sanitizeRun, startRun } from '../gameplay/Run';
import {
  claimLedger, descendStart, ledgerBonus, startingEdgeRarity, type LedgerMilestone,
} from '../gameplay/StarLedger';
import { ScoreSystem } from '../gameplay/ScoreSystem';
import { LESSONS, Tutorial, type Lesson } from '../gameplay/Tutorial';
import { maxHealthBonus, upgradePetMultiplier } from '../gameplay/Upgrades';
import { type UnlockGoal } from '../gameplay/Progression';

import { SOURCE_LEVEL } from '../hazards/Electricity';
import { ZoneManager } from '../hazards/Zone';
import { InputManager } from '../input/InputManager';
import { KeyboardMouseInput } from '../input/KeyboardMouseInput';
import { TouchInput } from '../input/TouchInput';
import { GADGET_RULES } from '../interactions/GadgetRules';
import { HOUSE_RULES } from '../interactions/HouseRules';
import { MORE_RULES } from '../interactions/MoreRules';
import { INTERACTION_RULES } from '../interactions/InteractionRegistry';
import { InteractionSystem } from '../interactions/InteractionSystem';
import { createObject } from '../objects/ObjectFactory';
import { ParticleSystem } from '../particles/ParticleSystem';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { WebPortal, type Portal } from '../platform/Portal';
import { Camera } from '../rendering/Camera';
import { Fx, impactWord } from '../rendering/Fx';
import { Renderer } from '../rendering/Renderer';
import { ReplayRecorder } from '../replay/ReplayRecorder';
import { SaveManager } from '../save/SaveManager';
import { FIXED_DT, TEXT_VISIBLE } from './constants';
import { EventBus } from './Events';
import { GameLoop } from './GameLoop';
import type { HeroId } from './Hero';
import { Rng } from './Random';
import type { Chain, Thing } from './types';

/** What a blast is made of: flames, scalding steam, or a firework going off. */
export type BlastStyle = 'fire' | 'steam' | 'sparkle';

export type GameState = 'menu' | 'playing' | 'paused' | 'cleared' | 'failed';

export interface RoomSummary {
  cleared: boolean;
  roomNumber: number;
  roomName: string;
  daily: boolean;
  score: number;
  highScore: number;
  isHighScore: boolean;
  bestChain: number;
  objectsUsed: number;
  newDiscoveries: number;
  challengeText: string | null;
  challengePassed: boolean;
  challengeBonus: number;
  /** Scrap bonus for clearing a room for the first time (0 when replaying). */
  firstClearBonus: number;
  /** Best score on this room before this run (0 the first time). */
  roomBest: number;
  canContinue: boolean;
  /** Campaign layer: stars, contracts, story. */
  stars: number;
  isNewBestStars: boolean;
  contractsNew: Array<{ id: string; name: string; reward: number }>;
  dailyBonus: number;
  actName: string;
  objective: string;
  story: string;
  /** True when the final room of the campaign was just cleared. */
  finale: boolean;
  /** The player asked for the rewarded ad and none could be shown. */
  adMissed?: boolean;
  /** This failure ended a run (state stays intact until the result action). */
  runEnded: boolean;
  /** Star Ledger rewards crossed by this clear. */
  ledgerClaims: LedgerMilestone[];
  /** Room-local score delta (not the cumulative run total). */
  roomScore: number;
  isNewRoomBest: boolean;
  /** Pending Edge draft cards (empty on non-draft / failure / final). */
  offer: EdgeDefinition[];
  nextRoom: { number: number; name: string; boss: boolean } | null;
  nextEdge: { number: number; boss: boolean } | null;
  nextGoal: UnlockGoal;
  ledgerNext: LedgerMilestone | null;
  ledgerStars: number;
  totalStars: number;
  dailyStreak: number;
  dailyReplay: boolean;
  dailyRareEdgeGranted: boolean;
  noSalvage: boolean;
  buildMaxed: boolean;
  run: {
    floor: number;
    nextFloor: number | null;
    streak: number;
    score: number;
    types: number;
    stacks: number;
    boosts: string[];
    ended: boolean;
  };
}

/** What the simulation needs from the UI layer. Keeps Game free of DOM details. */
export interface GameUi {
  banner(title: string, sub?: string, seconds?: number): void;
  discovery(title: string): void;
  /** The level-up card: something new is yours for good. */
  unlock(kicker: string, title: string, sub: string): void;
  stateChanged(state: GameState): void;
  showSummary(summary: RoomSummary): void;
  /** Slams a rubber stamp across the screen ("CLEARED"). */
  stamp(text: string): void;
  /** The incident arrival card. */
  incoming(kicker: string, title: string, sub: string, type: EnemyTypeId): void;
  frame(dt: number): void;
}

export interface Popup {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  tilt: number;
}

export interface Decal {
  kind: 'scorch' | 'scuff';
  x: number;
  y: number;
  r: number;
}

const OVERLAP_EVERY_TICKS = 10;
const CLEAR_DELAY = 1.6;
const FAIL_DELAY = 1.4;
const MAX_OBJECTS = 90;

const NULL_UI: GameUi = {
  banner() {}, discovery() {}, unlock() {}, stateChanged() {}, showSummary() {}, stamp() {}, incoming() {}, frame() {},
};

export class Game {
  readonly bus = new EventBus();
  readonly rng = new Rng(1);
  readonly world = new PhysicsWorld();
  readonly zones = new ZoneManager();
  readonly particles = new ParticleSystem();
  readonly fx = new Fx();
  readonly audio = new AudioManager();
  readonly camera = new Camera();
  readonly save: SaveManager;
  /** Rebound after `save.load()` installs the persisted object. */
  edges: EdgeSystem;
  readonly heat = new HeatSystem();
  readonly analytics = new AnalyticsManager();
  readonly ads: AdManager;
  readonly replay = new ReplayRecorder();
  readonly nav = new NavField();
  readonly rooms = new RoomManager();
  readonly input: InputManager;
  readonly renderer: Renderer;
  readonly loop: GameLoop;
  readonly interactions: InteractionSystem;
  readonly impacts: ImpactSystem;
  readonly discoveries: DiscoverySystem;
  readonly score: ScoreSystem;
  readonly challenges: ChallengeSystem;
  readonly abilities: AbilitySystem;
  readonly tutorial: Tutorial;

  hud: GameUi = NULL_UI;

  readonly objects: PhysicsObject[] = [];
  readonly enemies: Enemy[] = [];
  readonly popups: Popup[] = [];
  readonly decals: Decal[] = [];
  player: Player = new Player(0, 0);
  /** Whoever the hero brought with them. */
  pet: Pet | null = null;
  room!: RoomRuntime;

  state: GameState = 'menu';
  /** Simulation time of the current room, in seconds. */
  time = 0;
  tickCount = 0;
  /** Real seconds left of the letterboxed final-blow slow motion. */
  cinema = 0;

  private scoreAtRoomStart = 0;
  private hitStopLeft = 0;
  private slowLeft = 0;
  private slowScale = 1;
  private revived = false;
  private consecutiveFailures = 0;
  pendingDraft: { room: number; offer: EdgeDefinition[] } | null = null;
  /** Lesson the next entry into room 1 starts from (a replay, or a restart mid-lesson). */
  private lessonFrom: Lesson | null = null;
  private inGameplay = false;
  /** True from the moment an ad is asked for until that request is settled. */
  private waitingForAd = false;
  /**
   * First-time funnel clock (dev visibility for the CrazyGames conversion work).
   * Reset on every room entry; the events only reach the console sink in dev builds,
   * so production has no extra traffic and collects no personal data.
   */
  private funnelT0 = 0;
  private funnelInput = false;
  private funnelGrab = false;
  private funnelThrow = false;
  private funnelHit = false;
  private funnelClear = false;
  private devEdges: EdgeId[] = [];
  private objectHeatWindow = 0;
  private objectHeatTimer = 0;
  /** Set by SKIP in this attempt only; the save flag is historical. */
  tutorialSkippedThisRoom = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly portal: Portal = new WebPortal(),
  ) {
    this.save = new SaveManager(portal.storage);
    this.edges = new EdgeSystem(this.save.data);
    this.ads = new AdManager(portal.ads);
    this.input = new InputManager(canvas);
    this.input.addSource(new KeyboardMouseInput());
    this.input.addSource(new TouchInput());
    this.renderer = new Renderer(this, canvas);
    this.interactions = new InteractionSystem(this, [...INTERACTION_RULES, ...HOUSE_RULES, ...GADGET_RULES, ...MORE_RULES]);
    this.impacts = new ImpactSystem(this);
    this.discoveries = new DiscoverySystem(this);
    this.score = new ScoreSystem(this);
    this.challenges = new ChallengeSystem(this);
    this.abilities = new AbilitySystem(this);
    this.tutorial = new Tutorial(this);
    this.loop = new GameLoop({
      tick: (dt) => this.tick(dt),
      render: (alpha, frameDt) => this.frame(alpha, frameDt),
      timeScale: () => this.timeScale(),
    });

    this.world.pairFilter = (a, b) => {
      const oa = a.owner;
      const ob = b.owner;
      if (!oa || !ob || oa.kind !== 'object' || ob.kind !== 'object') return true;
      if (oa.restingOn === ob || ob.restingOn === oa) return false;
      if ((oa.fellFrom === ob && a.z > 2) || (ob.fellFrom === oa && b.z > 2)) return false;
      // Carried or airborne things pass over tables instead of bumping into their sides.
      const surface = oa.def.surface ? oa : ob.def.surface ? ob : null;
      if (surface) {
        const other = surface === oa ? ob : oa;
        if (!other.def.surface && (other.held || other.body.z > surface.def.height - 4)) return false;
      }
      return true;
    };

    this.wireFeedback();
    this.wireFunnel();
    this.wireHeat();
    this.audio.prefetchSamples();
    this.input.onAction((action) => {
      if (action === 'pause') this.togglePause();
      else if (action === 'restart') {
        if (this.state === 'playing' || this.state === 'paused') this.restartRoom();
        // Fast restart straight from the results screen: no need to find the button.
        else if (this.state === 'cleared') void this.nextRoom();
        else if (this.state === 'failed') void this.retryAfterFail();
      }
    });
    this.ads.setHooks({
      // An ad request takes a moment to come back: nothing may be pressed meanwhile.
      onRequest: () => {
        this.waitingForAd = true;
        document.body.classList.add('ad-wait');
      },
      // Audio goes off only when an ad really starts, not when one is merely asked for.
      onAdStart: () => this.audio.setDucked(true),
      onAdEnd: () => this.audio.setDucked(false),
      onSettled: () => {
        this.waitingForAd = false;
        document.body.classList.remove('ad-wait');
      },
    });
    portal.onMuteChange((muted) => this.audio.setPortalMuted(muted));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.togglePause();
    });
  }

  start(): void {
    this.save.load();
    // load() installs a fresh object; point the Edge stack at the persisted one.
    this.edges = new EdgeSystem(this.save.data);
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(location.search);
      const edges = params.get('edges');
      if (edges) this.devEdges = edges.split(',').filter(isEdgeId);
      // Dev-only star shortcut, e.g. ?stars=27, so the Ledger is testable without a full run.
      const target = Number(params.get('stars'));
      if (Number.isFinite(target) && target > 0) {
        const totalRooms = this.rooms.roomCount;
        let left = Math.min(totalRooms * 3, Math.floor(target));
        for (let index = 0; index < totalRooms; index++) {
          const def = this.rooms.definition(index);
          const take = Math.min(3, left);
          if (take <= 0) break;
          this.save.data.roomStars[def.id] = Math.max(this.save.data.roomStars[def.id] ?? 0, take);
          left -= take;
        }
        const cleared = Math.ceil(Math.min(target, totalRooms * 3) / 3);
        const unlocked = Math.min(FINAL_ROOM_INDEX, cleared);
        this.save.data.unlockedRoom = Math.max(this.save.data.unlockedRoom, unlocked);
        this.save.data.deepest = Math.max(this.save.data.deepest, Math.min(CAMPAIGN_ROOMS, cleared));
        claimLedger(this.save.data);
      }
    }
    const masterKey = ledgerBonus(this.save.data, 'master_key') ? 18 : 0;
    sanitizeRun(
      this.save.data,
      this.save.data.unlockedRoom,
      this.save.data.deepest,
      Math.max(this.save.data.unlockedRoom, this.save.data.deepest + 1, masterKey),
    );
    this.applySettings();
    void this.ads.initialize();
    this.reportProgress();
    this.analytics.track('game_start', { discoveries: this.discoveries.count });
    const save = this.save.data;
    if (save.roomsCleared === 0 && save.unlockedRoom === 0 && save.discoveries.length === 0) {
      // First visit: straight into the first room, which teaches by doing. The menu
      // (heroes, daily challenge, settings) is there as soon as they come out of it.
      this.playFrom(0);
    } else {
      // The first room doubles as the backdrop behind the main menu.
      this.loadRoom(this.rooms.definition(0), 0, false);
      this.setState('menu');
    }
    this.loop.start();
  }

  applySettings(): void {
    const settings = this.save.data.settings;
    this.audio.setVolume(settings.volume);
    this.audio.setMuted(settings.muted);
    this.audio.setMusicEnabled(settings.music);
    this.camera.shakeScale = settings.reducedShake ? 0.2 : 1;
    document.body.classList.toggle('high-contrast', settings.highContrast);
    document.body.classList.toggle('has-powers', this.abilities.hasAny());
  }

  // ───────────── state & room flow ─────────────

  private setState(state: GameState): void {
    this.state = state;
    if (state !== 'playing') document.body.classList.remove('tutorial');
    // The portal is told every time the player gains or gives up control of the hero.
    const playing = state === 'playing';
    if (playing !== this.inGameplay) {
      this.inGameplay = playing;
      if (playing) this.portal.gameplayStart();
      else this.portal.gameplayStop();
    }
    this.input.enabled = state === 'playing';
    this.input.flush();
    this.hud.stateChanged(state);
  }

  private loadRoom(def: RoomDefinition, index: number, daily: boolean, incident: IncidentSpec | null = null): void {
    this.objects.length = 0;
    this.enemies.length = 0;
    this.popups.length = 0;
    this.decals.length = 0;
    this.zones.clear();
    this.particles.clear();
    this.fx.clear();
    this.cinema = 0;
    this.interactions.reset();
    this.time = 0;
    this.tickCount = 0;
    this.audio.setBossMusic(false);
    this.hitStopLeft = 0;
    this.slowLeft = 0;
    this.revived = false;
    this.rng.reseed(def.seed);
    this.edges.setActive(!daily);
    if (import.meta.env.DEV && this.devEdges.length > 0 && !daily) {
      this.save.data.runBoosts = [...this.devEdges];
    }
    this.edges.beginFloor();
    this.player = new Player(def.playerStart.x, def.playerStart.y, 5 + maxHealthBonus(this.save.data));
    this.player.armor = this.edges.armorAtFloorStart();
    this.room = this.rooms.build(this, def, index, daily, incident);
    this.pet = createPet(this.hero, def.playerStart.x - 34, def.playerStart.y + 12);
    placePickups(this);
    this.discoveries.newThisRoom = 0;
    this.score.resetRoom(this.scoreAtRoomStart);
    this.challenges.setForRoom(def.challenge);
    this.abilities.resetRoom();
    this.tutorial.begin(null);
    this.replay.begin(def.id, def.seed);
  }

  get hero(): HeroId {
    return this.save.data.hero;
  }

  /** Picked on the menu; the room behind it is rebuilt so the right pet turns up. */
  setHero(hero: HeroId): void {
    if (hero === this.hero) return;
    this.save.data.hero = hero;
    this.save.write();
    if (this.state === 'menu') this.toMenu();
  }

  /** Starts a fresh run from the given room (0-based). */
  playFrom(index: number): void {
    const start = Math.max(0, Math.min(FINAL_ROOM_INDEX, Math.floor(index)));
    startRun(this.save.data, start);
    const rarity = startingEdgeRarity(this.save.data);
    if (rarity) this.save.data.runBoosts.push(startingEdge(this.rng, rarity).id);
    this.tutorialSkippedThisRoom = false;
    this.scoreAtRoomStart = 0;
    this.consecutiveFailures = 0;
    this.save.write();
    this.enterRoom(this.rooms.definition(start), start, false);
  }

  /** Picks up the paused run at its current floor. */
  continueRun(): void {
    const save = this.save.data;
    if (!save.runActive || save.runFloor > FINAL_ROOM_INDEX) return;
    this.scoreAtRoomStart = save.runScore;
    this.consecutiveFailures = 0;
    this.enterRoom(this.rooms.definition(save.runFloor), save.runFloor, false);
  }

  /** Level-select picks continue the active run when they point at its floor. */
  playSelected(index: number): void {
    const save = this.save.data;
    if (save.runActive && index === save.runFloor) this.continueRun();
    else this.playFrom(index);
  }

  /** Starts a fresh run at the first unlocked Depths floor (or floor 19 with the Master Key). */
  descend(): void {
    this.playFrom(descendStart(this.save.data, this.save.data.deepest));
  }

  /** Replays one of room 1's lessons (and everything after it) from the pause menu. */
  playLesson(lesson: Lesson): void {
    this.lessonFrom = lesson;
    this.playFrom(0);
  }

  playDaily(): void {
    this.scoreAtRoomStart = 0;
    this.tutorialSkippedThisRoom = false;
    this.consecutiveFailures = 0;
    this.enterRoom(dailyChallenge(new Date()).room, 0, true);
  }

  /** One incident per non-tutorial room; survival rooms get only the heat surge. */
  private incidentFor(def: RoomDefinition, index: number, daily: boolean): IncidentSpec | null {
    if (daily) return def.objective?.kind === 'survive' ? null : enforcerSpec(0);
    const boss = campaignBossType(index, def);
    if (boss) return headlinerSpec(boss);
    if (index < this.rooms.handcraftedCount) return null;
    return def.objective?.kind === 'survive' ? null : enforcerSpec(index);
  }

  private enterRoom(def: RoomDefinition, index: number, daily: boolean): void {
    const incident = this.incidentFor(def, index, daily);
    this.loadRoom(def, index, daily, incident);
    this.heat.reset(this.room);
    this.tutorialSkippedThisRoom = false;
    // Room 1 teaches until it has been sat through once; a replay names its lesson.
    const saved = this.save.data.tutorial;
    const lesson = this.lessonFrom ?? (saved === 'done' ? null : LESSONS.find((l) => l === saved) ?? 'move');
    this.lessonFrom = null;
    const firstVisit = !daily && this.save.data.deepest <= index;
    if (def.tutorial && !daily) this.tutorial.begin(lesson);
    else if (firstVisit && def.spotlight) this.tutorial.spotlight(def.spotlight);
    this.portal.setContext({ room: daily ? 'daily' : index + 1, hero: this.hero });
    this.setState('playing');
    this.funnelT0 = performance.now();
    this.funnelInput = this.funnelGrab = this.funnelThrow = this.funnelHit = false;
    this.bus.emit({ type: 'ROOM_START', room: index });
    // Campaign briefing: every room says what it is and what the mini-goal is,
    // once per first visit. New acts announce themselves; survival rooms name
    // the clock. Replays just show the room name.
    const briefing = briefingFor(def.id, index);
    const act = actFor(index);
    if (firstVisit && !def.tutorial && index > 0 && act.from === index) {
      this.hud.banner(act.name, act.tagline, 3.2);
    } else if (firstVisit && !def.tutorial) {
      const goal = def.objective?.kind === 'survive' ? `survive ${def.objective.seconds}s` : briefing.objective;
      this.hud.banner(`${index + 1} · ${def.name}`, goal, 3);
    }
    this.analytics.track('room_start', { room: index + 1, daily, generated: index >= this.rooms.handcraftedCount });
  }

  restartRoom(): void {
    this.lessonFrom = this.tutorial.resume;
    this.enterRoom(this.room.def, this.room.index, this.room.daily);
  }

  /** Starts a new run at this room after the ad/retry decision. */
  replayRoom(): void {
    this.playFrom(this.room.index);
  }

  async retryAfterFail(): Promise<void> {
    if (this.waitingForAd) return;
    await this.ads.onRetryAfterFailure();
    if (this.room.daily) {
      this.restartRoom();
      return;
    }
    if (this.room.index >= this.rooms.handcraftedCount) {
      const index = this.room.index;
      endRun(this.save.data);
      this.save.write();
      this.playFrom(index);
      return;
    }
    this.restartRoom();
  }

  async nextRoom(): Promise<void> {
    if (this.waitingForAd) return;
    await this.ads.onRoomComplete();
    if (this.room.daily || this.room.index >= FINAL_ROOM_INDEX) {
      this.toMenu();
      return;
    }
    this.scoreAtRoomStart = this.score.score;
    // A clear records the next floor; never walk past the last door.
    const next = Math.min(
      FINAL_ROOM_INDEX,
      Math.max(this.room.index + 1, this.save.data.runFloor),
    );
    this.enterRoom(this.rooms.definition(next), next, false);
  }

  /** Leaves a failed run and returns to the menu. */
  abandonRun(): void {
    if (this.save.data.runActive) {
      endRun(this.save.data);
      this.save.write();
    }
    this.toMenu();
  }

  /** SKIP was pressed during this attempt (the save keeps the historical flag too). */
  markTutorialSkipped(): void {
    this.save.data.tutorialSkipped = true;
    this.tutorialSkippedThisRoom = true;
    this.save.write();
  }

  /** Rewarded "second chance": back on your feet in the same room, as it stands. */
  async continueWithReward(): Promise<boolean> {
    if (this.state !== 'failed' || this.revived || this.waitingForAd) return false;
    const granted = await this.ads.showRewarded('second_chance');
    if (!granted || this.state !== 'failed') return false;
    this.revived = true;
    this.player.revive();
    this.room.failTimer = 0;
    this.setState('playing');
    this.hud.banner('SECOND CHANCE', '', 2);
    this.fx.burst('UP!', this.player.body.x, this.player.body.y - 60, 1.1, '#9be564', true);
    return true;
  }

  /** How far through the 50-room campaign this player has got, for the portal. */
  private reportProgress(): void {
    this.portal.reportProgress((this.save.data.deepest / this.rooms.roomCount) * 100);
  }

  toMenu(): void {
    this.portal.setContext(null);
    this.scoreAtRoomStart = 0;
    this.loadRoom(this.rooms.definition(0), 0, false);
    this.setState('menu');
  }

  togglePause(): void {
    if (this.state === 'playing') this.setState('paused');
    else if (this.state === 'paused') this.setState('playing');
  }

  get enemiesRemaining(): number {
    let alive = this.room.pending.length;
    for (const enemy of this.enemies) if (!enemy.defeated) alive++;
    return alive;
  }

  petDamageMultiplier(): number {
    return this.edges.petFrenzyMultiplier() * upgradePetMultiplier(this.save.data);
  }

  /** Buys a permanent ability with salvaged scrap. Returns '' or the reason it failed. */
  buyAbility(id: AbilityId): string {
    const def = ABILITIES.find((a) => a.id === id);
    if (!def) return 'no such ability';
    const save = this.save.data;
    if (save.abilities.includes(id)) return 'already owned';
    if (save.scrap < def.cost) return `needs ${def.cost} scrap`;
    save.scrap -= def.cost;
    save.abilities.push(id);
    this.save.write();
    document.body.classList.toggle('has-powers', this.abilities.hasAny());
    return '';
  }

  private summarize(cleared: boolean, challengeBonus: number): RoomSummary {
    const save = this.save.data;
    const isHighScore = this.score.score > save.highScore;
    if (isHighScore) save.highScore = this.score.score;
    save.bestChain = Math.max(save.bestChain, this.score.stats.bestChain);
    save.scrap += this.score.stats.scrap;

    const challenge = this.challenges.current;
    const wasDeepest = save.deepest;
    const roomBest = save.roomBests[this.room.def.id]?.score ?? 0;
    let firstClearBonus = 0;
    let dailyBonus = 0;
    let runEnded = false;
    let stars = 0;
    let isNewBestStars = false;
    let isNewRoomBest = false;
    let challengeText = challenge?.text ?? null;
    let challengePassed = challengeBonus > 0;

    if (cleared && !this.room.daily) {
      const index = this.room.index;
      const id = this.room.def.id;
      recordClear(save, index, this.score.score);
      save.roomsCleared++;
      // Lifetime contract counters: only cleared rooms count, so retries can't farm.
      save.totalKills += this.score.stats.kills;
      save.totalChains += this.score.stats.chainEvents;
      save.totalHazardKills += this.score.stats.hazardKills;
      if (this.room.hasBoss) save.bossesBeaten++;
      if (this.room.hasEnforcer) save.enforcersBeaten++;

      const firstClear = wasDeepest <= index;
      if (index === 0) {
        challengeText = 'finish the lesson plan';
        challengePassed = !this.tutorialSkippedThisRoom;
      }
      const starResult = starsFor(this.score.stats, challengePassed);
      stars = starResult.stars;
      const prevStars = save.roomStars[id] ?? 0;
      isNewBestStars = stars > prevStars;
      if (isNewBestStars || (save.roomStars[id] === undefined && stars > 0)) {
        save.roomStars[id] = stars;
      }
      if (firstClear) {
        firstClearBonus = this.room.hasBoss ? 100 : 40;
        save.scrap += firstClearBonus;
      }
      save.unlockedRoom = Math.max(save.unlockedRoom, Math.min(FINAL_ROOM_INDEX, index + 1));
      save.deepest = Math.max(save.deepest, Math.min(CAMPAIGN_ROOMS, index + 1));
      // Per-room bests for the level-select wall and replay bragging rights.
      const prev = save.roomBests[id];
      if (!prev || this.score.score > prev.score) {
        isNewRoomBest = true;
        save.roomBests[id] = {
          score: this.score.score,
          chain: Math.max(this.score.stats.bestChain, prev?.chain ?? 0),
        };
      }

      if (index === FINAL_ROOM_INDEX) {
        endRun(save);
        runEnded = true;
      }
    } else if (cleared && this.room.daily) {
      // Daily streak: consecutive calendar days pay escalating scrap.
      const today = todayKey();
      if (save.lastDaily !== today) {
        save.dailyStreak = save.lastDaily === yesterdayKey() ? save.dailyStreak + 1 : 1;
        save.lastDaily = today;
      }
      dailyBonus = Math.min(50, 10 + save.dailyStreak * 10);
      save.scrap += dailyBonus;
      save.roomsCleared++;
      save.totalKills += this.score.stats.kills;
      save.totalChains += this.score.stats.chainEvents;
      save.totalHazardKills += this.score.stats.hazardKills;
    } else {
      if (!this.room.daily) recordFail(save, this.scoreAtRoomStart);
    }

    // Contracts: newly met goals pay out once, right here.
    const contractsNew: RoomSummary['contractsNew'] = [];
    if (cleared) {
      const totals = {
        totalKills: save.totalKills,
        totalChains: save.totalChains,
        totalHazardKills: save.totalHazardKills,
        bossesBeaten: save.bossesBeaten,
        roomsCleared: save.roomsCleared,
        discoveries: save.discoveries.length,
      };
      for (const contract of CONTRACTS) {
        if (save.contractsDone.includes(contract.id)) continue;
        if (contract.progress(totals) >= contract.target) {
          save.contractsDone.push(contract.id);
          save.scrap += contract.reward;
          contractsNew.push({ id: contract.id, name: contract.name, reward: contract.reward });
        }
      }
    }
    // Star Ledger: newly crossed milestones pay their scrap at the same desk.
    const ledgerClaims = cleared && !this.room.daily ? claimLedger(save) : [];
    this.save.write();
    const briefing = briefingFor(this.room.def.id, this.room.index);
    return {
      cleared,
      roomNumber: this.room.index + 1,
      roomName: this.room.def.name,
      daily: this.room.daily,
      score: this.score.score,
      highScore: save.highScore,
      isHighScore,
      bestChain: this.score.stats.bestChain,
      objectsUsed: this.score.stats.objectsUsed.size,
      newDiscoveries: this.discoveries.newThisRoom,
      challengeText,
      challengePassed,
      challengeBonus,
      firstClearBonus,
      roomBest,
      canContinue: !cleared && !this.revived && this.ads.isAvailable('rewarded'),
      stars,
      isNewBestStars,
      contractsNew,
      dailyBonus,
      actName: actFor(this.room.index).name,
      objective: briefing.objective,
      story: briefing.story,
      finale: cleared && !this.room.daily && this.room.index === FINAL_ROOM_INDEX,
      runEnded,
      ledgerClaims,
      // Task 9 progression fields (partial contract — see brief for full rules).
      roomScore: cleared ? this.score.score - this.scoreAtRoomStart : 0,
      isNewRoomBest,
      offer: [],
      nextRoom: null,
      nextEdge: null,
      nextGoal: { kind: 'store' as const, kicker: 'READY TO BUY' as const, name: '', detail: '', progress: 0, action: null },
      ledgerNext: null,
      ledgerStars: 0,
      totalStars: totalStars(save.roomStars),
      dailyStreak: save.dailyStreak,
      dailyReplay: false,
      dailyRareEdgeGranted: false,
      noSalvage: !cleared,
      buildMaxed: false,
      run: {
        floor: this.room.index + 1,
        nextFloor: cleared && !this.room.daily && this.room.index < FINAL_ROOM_INDEX ? this.room.index + 2 : null,
        streak: cleared && !this.room.daily ? save.runStreak + 1 : save.runStreak,
        score: cleared ? this.score.score : save.runScore,
        types: new Set(save.runBoosts).size,
        stacks: save.runBoosts.length,
        boosts: [...save.runBoosts],
        ended: runEnded,
      },
    };
  }

  private completeRoom(): void {
    const bonus = this.challenges.resolve();
    this.score.score += bonus;
    this.consecutiveFailures = 0;
    this.audio.setBossMusic(false);
    this.audio.play('roomClear', 1);
    this.bus.emit({ type: 'ROOM_COMPLETE', room: this.room.index });
    this.analytics.track('room_complete', {
      room: this.room.index + 1,
      score: this.score.score,
      seconds: Math.round(this.score.stats.time),
      bestChain: this.score.stats.bestChain,
    });
    if (!this.room.daily && this.room.index === 0 && !this.funnelClear) {
      this.funnelClear = true;
      this.analytics.track('first_clear', { ms: Math.round(performance.now() - this.funnelT0) });
    }
    // Finishing the last door for the first time is the one moment worth confetti.
    const lastRoom = !this.room.daily && this.room.index === FINAL_ROOM_INDEX;
    const firstTime = this.save.data.deepest <= this.room.index;
    const summary = this.summarize(true, bonus);
    this.reportProgress();
    if (lastRoom && firstTime) this.portal.celebrate();
    if (summary.contractsNew.length > 0) {
      const first = summary.contractsNew[0]!;
      this.hud.unlock('CONTRACT COMPLETE', first.name, `+${first.reward}`);
    }
    this.setState('cleared');
    this.hud.showSummary(summary);
  }

  private failRoom(): void {
    this.consecutiveFailures++;
    this.audio.setBossMusic(false);
    this.audio.play('fail', 1);
    this.bus.emit({ type: 'ROOM_FAIL', room: this.room.index });
    this.analytics.track('room_fail', { room: this.room.index + 1, failures: this.consecutiveFailures });
    const summary = this.summarize(false, 0);
    this.setState('failed');
    this.hud.showSummary(summary);
  }

  // ───────────── simulation ─────────────

  private timeScale(): number {
    if (this.state !== 'playing' && this.state !== 'menu') return 0;
    if (this.hitStopLeft > 0) return 0.03;
    if (this.slowLeft > 0) return this.slowScale;
    return 1;
  }

  /** One fixed step. Public so tests and tools can advance the simulation deterministically. */
  tick(dt: number): void {
    const input = this.input.sample(this.camera.screenToWorld, this.player.body.x, this.player.body.y);
    if (this.state === 'menu') {
      // Keep the backdrop alive (settling objects, particles) without any gameplay.
      this.world.step(dt);
      this.pet?.update(this, dt);
      this.particles.update(dt);
      return;
    }
    if (this.state !== 'playing') return;

    if (!this.funnelInput &&
      (input.primaryPressed || input.primaryDown || input.moveX !== 0 || input.moveY !== 0 || input.dodgePressed)) {
      this.funnelInput = true;
      this.analytics.track('first_input', { room: this.room.index + 1, ms: Math.round(performance.now() - this.funnelT0) });
    }

    this.time += dt;
    this.tickCount++;
    this.replay.record(input);

    const room = this.room;
    this.rooms.updateSpawns(this, room, dt);
    this.objectHeatTimer += dt;
    if (this.objectHeatTimer >= 1) {
      this.objectHeatTimer -= 1;
      this.objectHeatWindow = 0;
    }
    this.heat.update(dt, room, this.enemies, (event) => this.onHeatEvent(event));
    this.nav.update(this, dt);

    this.player.update(this, input, dt);
    if (!this.player.charging) this.audio.chargeStop();
    for (let i = 0; i < this.enemies.length; i++) this.enemies[i]!.update(this, dt);
    this.pet?.update(this, dt);
    updateRage(this, dt);
    for (let i = 0; i < this.objects.length; i++) {
      const object = this.objects[i]!;
      if (!object.alive) continue;
      object.update(this, dt);
      object.preStep();
    }

    this.world.step(dt);

    for (let i = 0; i < this.objects.length; i++) {
      const object = this.objects[i]!;
      if (object.alive) object.postStep();
    }
    this.impacts.process();

    this.zones.update(this, dt);
    if (this.tickCount % OVERLAP_EVERY_TICKS === 0) this.interactions.updateOverlaps(dt * OVERLAP_EVERY_TICKS);

    this.score.update(dt);
    this.abilities.update(dt);
    this.tutorial.update(dt);
    this.particles.update(dt);
    this.sweep();
    this.updateRoomOutcome(dt);
  }

  private updateRoomOutcome(dt: number): void {
    const room = this.room;
    if (!this.player.alive) {
      room.failTimer += dt;
      if (room.failTimer >= FAIL_DELAY) this.failRoom();
      return;
    }
    if (!room.cleared && this.enemiesRemaining === 0) {
      room.cleared = true;
      room.clearTimer = 0;
      this.hud.stamp('CLEARED');
    }
    // Survival rooms: outlast the clock and whoever is left flees.
    if (!room.cleared && room.survive !== null && room.elapsed >= room.survive) {
      room.pending.length = 0;
      for (const enemy of this.enemies) {
        if (enemy.defeated) continue;
        enemy.defeated = true;
        enemy.alive = false;
        this.particles.burst('dust', enemy.body.x, enemy.body.y, 8, 120);
      }
      this.audio.play('poof', 0.6);
      room.cleared = true;
      room.clearTimer = 0;
      this.hud.stamp('SURVIVED');
    }
    if (room.cleared) {
      room.clearTimer += dt;
      room.exitOpen = Math.min(1, room.exitOpen + dt * 2);
      if (room.clearTimer >= CLEAR_DELAY) this.completeRoom();
    }
  }

  private sweep(): void {
    let write = 0;
    for (let i = 0; i < this.objects.length; i++) {
      const object = this.objects[i]!;
      if (object.alive) this.objects[write++] = object;
      else this.world.remove(object.body);
    }
    this.objects.length = write;

    write = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i]!;
      if (enemy.alive) this.enemies[write++] = enemy;
      else this.world.remove(enemy.body);
    }
    this.enemies.length = write;
  }

  /** Per display frame: real-time effects and drawing. */
  private frame(alpha: number, frameDt: number): void {
    if (this.hitStopLeft > 0) this.hitStopLeft -= frameDt;
    else if (this.slowLeft > 0) this.slowLeft -= frameDt;

    const pb = this.player.body;
    this.camera.follow(pb.prevX + (pb.x - pb.prevX) * alpha, pb.prevY + (pb.y - pb.prevY) * alpha, frameDt);
    this.camera.update(frameDt);
    this.fx.update(frameDt);
    if (this.cinema > 0) this.cinema -= frameDt;
    this.updateSoundscape(frameDt);
    if (this.state === 'playing') {
      let write = 0;
      for (let i = 0; i < this.popups.length; i++) {
        const p = this.popups[i]!;
        p.life -= frameDt;
        p.y -= 34 * frameDt;
        if (p.life > 0) this.popups[write++] = p;
      }
      this.popups.length = write;
    }
    this.renderer.render(alpha, frameDt);
    this.hud.frame(frameDt);
  }

  /** Hazard room tone and how many layers of the score are playing. */
  private updateSoundscape(dt: number): void {
    let fire = 0;
    let electric = 0;
    if (this.state === 'playing') {
      for (const zone of this.zones.zones) {
        if (!zone.alive) continue;
        if (zone.zone === 'fire') fire += zone.r > 20 ? 1 : 0.3;
        else if ((zone.zone === 'electric' && !zone.tags.has('outlet')) || zone.energized) electric += 0.6;
      }
    }
    this.audio.ambience(fire, electric, dt);

    let level = 0;
    if (this.state === 'paused') level = -1;
    else if (this.state === 'playing') {
      let alive = 0;
      for (const enemy of this.enemies) if (!enemy.defeated) alive++;
      const combo = this.score.combo;
      level = combo >= 4 || this.player.rage > 0 ? 3 : alive >= 3 || combo >= 2 ? 2 : alive >= 1 ? 1 : 0;
    }
    this.audio.setMusicIntensity(level);
  }

  // ───────────── services used by gameplay systems ─────────────

  spawnObject(id: string, x: number, y: number, angle = 0): PhysicsObject | null {
    if (this.objects.length >= MAX_OBJECTS) return null;
    const object = createObject(id, x, y, angle);
    if (!object) return null;
    this.objects.push(object);
    this.world.add(object.body);
    object.syncEmitters(this);
    return object;
  }

  spawnEnemy(type: EnemyTypeId, x: number, y: number, dirX = -1, dirY = 0): Enemy {
    return this.spawnEnemyType(ENEMY_TYPES[type], x, y, dirX, dirY);
  }

  /** Spawns an already-built type, for scaled Enforcer variants. */
  spawnEnemyType(type: EnemyType, x: number, y: number, dirX = -1, dirY = 0): Enemy {
    const enemy = new Enemy(type, x, y, dirX, dirY);
    this.enemies.push(enemy);
    this.world.add(enemy.body);
    if (enemy.type.electric) {
      this.zones.spawn(this, 'electric', x, y, enemy.type.radius + 9, {
        attached: enemy,
        level: SOURCE_LEVEL,
        extraTags: ['carried'],
      });
    }
    return enemy;
  }

  /** Radial blast: shoves everything, hurts creatures, breaks and ignites what it can. */
  explode(
    x: number,
    y: number,
    radius: number,
    damage: number,
    forceScale: number,
    chain: Chain | null,
    source: Thing | null,
    style: BlastStyle = 'fire',
  ): void {
    let hitEnemy = false;
    const victims: Array<{ thing: Thing; fall: number; dx: number; dy: number }> = [];
    this.world.queryCircle(x, y, radius, (body) => {
      const owner = body.owner;
      if (!owner || owner === source) return;
      const dx = body.x - x;
      const dy = body.y - y;
      const d = Math.hypot(dx, dy);
      if (d > radius + body.boundR) return;
      const fall = Math.max(0.15, 1 - d / radius);
      victims.push({ thing: owner, fall, dx: d > 0.01 ? dx / d : 1, dy: d > 0.01 ? dy / d : 0 });
    });

    // Collected first: reacting to a blast can spawn or remove bodies mid-query.
    for (const { thing, fall, dx, dy } of victims) {
      if (thing.kind === 'object') {
        if (!thing.alive) continue;
        const b = thing.body;
        b.applyImpulse(dx * 5200 * fall * forceScale, dy * 5200 * fall * forceScale);
        b.vz = Math.max(b.vz, 200 * fall);
        b.z = Math.max(b.z, 2);
        b.w += (Math.random() - 0.5) * 16 * fall;
        if (thing.restingOn) thing.leaveSurface();
        if (chain && !freshChain(thing, this.time)) {
          thing.chain = extendChain(chain, thing.label);
          thing.chainAt = this.time;
        }
        thing.tip(this, dx, dy);
        thing.applyDamage(this, 55 * fall * thing.material.fragility);
        if (style !== 'steam' && thing.alive && thing.def.flammable && fall > 0.45) {
          thing.igniteExposure += fall * 1.2 * thing.material.flammability;
          if (thing.igniteExposure >= 1) thing.ignite(this, chain);
        }
      } else if (thing.kind === 'enemy') {
        if (thing.defeated) continue;
        thing.stun = Math.max(thing.stun, 0.9 * thing.type.staggerFactor + 0.2);
        thing.squash = 1;
        thing.body.vx += dx * 560 * fall * thing.type.staggerFactor;
        thing.body.vy += dy * 560 * fall * thing.type.staggerFactor;
        thing.damage(this, damage * fall, { type: 'explosion', source, chain, label: 'EXPLOSION', dirX: dx, dirY: dy });
        if (chain) {
          thing.chain = extendChain(chain, thing.label);
          thing.chainAt = this.time;
        }
        hitEnemy = true;
      } else if (thing.kind === 'player') {
        if (thing.hurt(this, 1, 'EXPLOSION')) {
          thing.body.vx += dx * 420 * fall;
          thing.body.vy += dy * 420 * fall;
        }
      }
    }

    if (style === 'steam') {
      // a lid going through the ceiling: scalding, but nothing catches fire
      this.particles.burst('steam', x, y - 10, 34, 420);
      this.particles.burst('spark', x, y, 10, 500);
      this.fx.ring(x, y, 4, radius * 0.75, 0.6, 'rgba(228,247,251,0.9)', 4);
      this.fx.burst('PSSSHT!', x, y - 40, 1.6, '#e4f7fb', true);
      this.audio.play('explosion', 0.7);
      this.audio.play('hiss', 1);
    } else if (style === 'sparkle') {
      this.zones.spawn(this, 'fire', x, y, 22, { ttl: 2.2, chain: chain ? extendChain(chain, 'FIRE') : null });
      this.addDecal('scorch', x, y, radius * 0.3);
      this.particles.burst('confetti', x, y - 10, 46, 560);
      this.particles.burst('spark', x, y - 10, 40, 700);
      this.particles.burst('star', x, y - 10, 12, 380);
      this.fx.ring(x, y, 4, radius * 0.75, 0.6, 'rgba(255,90,138,0.9)', 4);
      this.fx.burst('BANG!', x, y - 40, 1.6, '#ff5a8a', true);
      this.audio.play('explosion', 0.6);
      this.audio.play('crackle', 1);
    } else {
      this.zones.spawn(this, 'fire', x, y, 34, { ttl: 4.5, chain: chain ? extendChain(chain, 'FIRE') : null });
      this.addDecal('scorch', x, y, radius * 0.55);
      this.particles.burst('ember', x, y, 40, 520);
      this.particles.burst('smoke', x, y, 18, 160);
      this.particles.burst('spark', x, y, 24, 600);
      this.fx.ring(x, y, 4, radius * 0.75, 0.6, 'rgba(255,159,28,0.9)', 4);
      this.fx.burst('KABOOM!', x, y - 40, 1.7, '#ff5a4e', true);
      this.audio.play('explosion', 1);
    }
    // Steam keeps its cool palette; fire and fireworks get the red spark shower.
    if (style !== 'steam') this.impactSpark(x, y - 10, 0.9);
    this.camera.addShake(0.9);
    this.camera.punchZoom(0.05);
    this.fx.flash('#ffffff', 0.6);
    this.fx.ring(x, y, 10, radius * 1.15, 0.45, 'rgba(255,255,255,0.95)', 7);
    this.hitStop(0.09);
    this.slowMotion(0.35, 0.45);
    this.noise(x, y, 1.5);
    this.bus.emit({ type: 'EXPLOSION', x, y, radius });
    if (hitEnemy) this.discoveries.unlock('kaboom');
  }

  /** Loud events draw intruders that have not noticed the player yet. */
  noise(x: number, y: number, loudness: number): void {
    const range = 520 * loudness;
    for (const enemy of this.enemies) {
      if (Math.hypot(enemy.body.x - x, enemy.body.y - y) < range) enemy.hearNoise(x, y);
    }
    this.bus.emit({ type: 'NOISE', x, y, loudness });
  }

  /** A decoy noise: movers in range head for it instead of for the player. */
  lure(x: number, y: number, radius: number, seconds: number): number {
    let count = 0;
    for (const enemy of this.enemies) {
      if (Math.hypot(enemy.body.x - x, enemy.body.y - y) < radius && enemy.lure(x, y, seconds)) count++;
    }
    return count;
  }

  /** A floating word (score receipt, reaction, animal noise). Skipped when
   *  `TEXT_VISIBLE` is false. */
  popup(text: string, x: number, y: number, color = '#fff3d6', size = 20, seconds = 1.1): void {
    if (!TEXT_VISIBLE) return;
    if (this.popups.length > 24) this.popups.shift();
    this.popups.push({ text, x, y, life: seconds, maxLife: seconds, color, size, tilt: (Math.random() - 0.5) * 0.22 });
  }

  addDecal(kind: Decal['kind'], x: number, y: number, r: number): void {
    if (this.decals.length > 30) this.decals.shift();
    this.decals.push({ kind, x, y, r });
  }

  slowMotion(scale: number, seconds: number): void {
    this.slowScale = scale;
    this.slowLeft = Math.max(this.slowLeft, seconds);
  }

  hitStop(seconds: number): void {
    this.hitStopLeft = Math.max(this.hitStopLeft, seconds);
  }

  /** Compact red spark burst for impacts outside the enemy-hit path. */
  impactSpark(x: number, y: number, power: number, dirX = 0, dirY = 0): void {
    const p = Math.max(0.2, Math.min(1, power));
    const cone = dirX !== 0 || dirY !== 0 ? { dirX, dirY, spread: 1 } : undefined;
    this.particles.burst('sparkle', x, y, Math.round(10 + p * 18), 200 + p * 180, cone);
    this.particles.ringBurst('sparkle', x, y, Math.round(6 + p * 8), 220 + p * 120, 26);
    if (p >= 0.35) this.particles.burst('glint', x, y - 4, p >= 0.8 ? 2 : 1, 40);
    if (p >= 0.4) this.particles.burst('shock', x, y, 1, 0);
  }

  // ───────────── juice: turn gameplay events into feedback ─────────────

  /** Dev-only funnel: where first-time players stall, in milliseconds since room entry. */
  private wireFunnel(): void {
    const elapsed = (): number => Math.round(performance.now() - this.funnelT0);
    const room = (): number => this.room.index + 1;
    this.bus.on('OBJECT_GRABBED', () => {
      if (this.funnelGrab) return;
      this.funnelGrab = true;
      this.analytics.track('first_grab', { room: room(), ms: elapsed() });
    });
    this.bus.on('OBJECT_THROWN', () => {
      if (this.funnelThrow) return;
      this.funnelThrow = true;
      this.analytics.track('first_throw', { room: room(), ms: elapsed() });
    });
    this.bus.on('ENEMY_HIT', () => {
      if (this.funnelHit) return;
      this.funnelHit = true;
      this.analytics.track('first_hit', { room: room(), ms: elapsed() });
    });
  }

  /** Player chaos feeds the incident meter. */
  private wireHeat(): void {
    const bus = this.bus;
    bus.on('ENEMY_DEFEATED', (e) => {
      this.heat.add(e.cause.type === 'fire' || e.cause.type === 'explosion' ? 12 : 7);
    });
    bus.on('PLAYER_HIT', () => this.heat.add(5));
    bus.on('CHAIN', () => this.heat.add(10));
    bus.on('OBJECT_BROKEN', () => this.heat.add(2));
    bus.on('OBJECT_HIT', (e) => {
      if (e.impulse < 1400 || this.objectHeatWindow >= 4) return;
      this.objectHeatWindow += 0.5;
      this.heat.add(0.5);
    });
  }

  private onHeatEvent(event: HeatEvent): void {
    const room = this.room.index + 1;
    switch (event.kind) {
      case 'tier':
        this.analytics.track('heat_tier', { tier: event.tier, room, seconds: Math.round(this.room.elapsed) });
        if (event.tier === 1) {
          rushRegulars(this.room);
          this.hud.banner('THEY NOTICED', 'the door is getting louder', 2);
        } else {
          this.incidentSurge(false);
          this.hud.banner('THE ROOM IS LOSING IT', 'watch the floor', 2);
        }
        break;
      case 'release':
        if (!releaseIncident(this.room)) this.incidentSurge(true);
        break;
      case 'surge':
        this.incidentSurge(true);
        break;
    }
  }

  /** Fire lands where the room is already chaotic; the zone does the damage. */
  private incidentSurge(final: boolean): void {
    const def = this.room.def;
    const count = final ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const x = this.rng.range(70, Math.max(71, def.width - 70));
      const y = this.rng.range(70, Math.max(71, def.height - 50));
      this.zones.spawn(this, 'fire', x, y, final ? 40 : 30, { ttl: final ? 6 : 4.5 });
      this.fx.ring(x, y, 6, final ? 58 : 42, 0.35, 'rgba(255,120,60,0.9)', 3);
      this.particles.burst('ember', x, y - 8, final ? 16 : 10, 220);
      this.audio.play('explosion', final ? 0.9 : 0.7);
      this.camera.addShake(final ? 0.5 : 0.3);
    }
  }

  private wireFeedback(): void {
    const bus = this.bus;
    // First-hit guarantee for room 1 (independent of funnel listener order).
    let firstRoomHitDone = false;
    bus.on('ROOM_START', () => {
      firstRoomHitDone = false;
    });
    bus.on('OBJECT_BROKEN', (e) => {
      const object = e.object;
      const b = object.body;
      const brittle = object.material.sound === 'glass';
      const top = b.y - b.z - object.def.height * 0.5;
      this.particles.burst(object.material.debris, b.x, top, brittle ? 20 : 13, 290);
      this.particles.burst('dust', b.x, b.y, 5, 110);
      this.impactSpark(b.x, top, brittle ? 0.8 : 0.55);
      if (brittle) {
        this.audio.play('glassBreak', 0.9);
        this.fx.burst('SMASH!', b.x, top - 22, 1, '#d9fbf0');
      } else {
        this.audio.impact(object.material.sound, 1, b.mass);
        const sound = object.material.sound;
        this.fx.burst(sound === 'wood' ? 'CRACK!' : sound === 'soft' ? 'POOF!' : 'CRUNCH!', b.x, top - 22, 0.95);
      }
      this.fx.ring(b.x, b.y, 8, b.boundR + 44, 0.3, 'rgba(255,255,255,0.85)', 3);
      this.camera.addShake(0.24);
      this.noise(b.x, b.y, 0.8);
      this.analytics.track('object_break', { object: object.def.id });
    });

    bus.on('OBJECT_FALLEN', (e) => {
      const b = e.object.body;
      this.fx.burst(e.object.def.id === 'bookshelf' ? 'TIMBER!' : 'WHUMP!', b.x, b.y - 34, e.object.def.id === 'bookshelf' ? 1.3 : 0.95);
    });

    bus.on('ENEMY_HIT', (e) => {
      const enemy = e.enemy;
      const b = enemy.body;
      const cause = e.cause;
      const pitch = enemy.type.voice;
      const big = e.damage >= 14;
      const huge = e.damage >= 28;
      const massive = e.damage >= 40;
      // First-60-seconds: the very first hit of room 1 must land, even on a weak
      // undercharged throw. Same material-specific sounds, just guaranteed readable
      // feedback (word + ring + settle) without changing damage or balance.
      const firstHit = this.room.index === 0 && !firstRoomHitDone;
      if (this.room.index === 0) firstRoomHitDone = true;
      const showWord = big || firstHit;
      const source = cause.source;
      const weapon = source && source.kind === 'object' ? source : null;

      if (cause.type === 'shock') {
        this.audio.voice('yelp', pitch, enemy.type.id);
        this.fx.burst('ZZAP!', b.x, b.y - 36, 1.05, '#fff27a');
        this.particles.burst('spark', b.x, b.y - 10, 10, 260);
      } else if (cause.type === 'fire') {
        this.audio.voice('panic', pitch, enemy.type.id);
      } else {
        this.audio.voice('oof', pitch, enemy.type.id);
        // Flesh thump under the material hit when a thrown thing connects.
        if (cause.type === 'impact' && cause.source && cause.source.kind === 'object') {
          this.audio.impactFlesh(e.damage);
        }
        if (showWord) {
          const quirk = weapon ? weapon.def.quirk : undefined;
          const word =
            quirk === 'gong'
              ? 'DONG!'
              : quirk === 'squeak'
                ? 'SQUEAK!'
                : cause.type === 'impact' && weapon
                  ? impactWord(weapon.material.sound)
                  : cause.type === 'slam'
                    ? 'WHAM!'
                    : cause.type === 'glass'
                      ? 'OUCH!'
                      : cause.type === 'explosion'
                        ? ''
                        : 'BONK!';
          if (word) this.fx.burst(word, b.x - cause.dirX * 8, b.y - 34, 0.85 + Math.min(0.8, e.damage / 55));
        }
      }

      const directional = cause.dirX !== 0 || cause.dirY !== 0;
      const cone = directional ? { dirX: cause.dirX, dirY: cause.dirY, spread: 0.75 } : undefined;
      // Translucent red smoke: body for the hit without hiding the enemy.
      this.particles.burst('blast', b.x, b.y - 18, Math.min(10, 4 + Math.floor(e.damage / 6)), 190 + Math.min(200, e.damage * 3), cone ? { ...cone, spread: 1 } : undefined);
      this.particles.ringBurst('blast', b.x, b.y - 18, 4 + Math.min(6, Math.floor(e.damage / 8)), 200 + Math.min(150, e.damage * 2), 38);
      // A red impact flare at the point of contact; only heavy blows earn it.
      this.particles.burst('glint', b.x + cause.dirX * 5, b.y - 20, (big ? 1 : 0) + (huge ? 1 : 0), 40);
      // Red-hot sparks: a dense shower of short streaks with hot tips.
      this.particles.burst('sparkle', b.x, b.y - 18, Math.min(36, 18 + Math.floor(e.damage / 3)), 220 + Math.min(280, e.damage * 4), cone ? { ...cone, spread: 1 } : undefined);
      this.particles.ringBurst('sparkle', b.x, b.y - 18, 14 + Math.min(12, Math.floor(e.damage / 4)), 230 + Math.min(170, e.damage * 3), 38);
      if (big) {
        // heavy hits keep shedding sparks as the cloud drifts up and cools
        this.particles.burst('blast', b.x, b.y - 30, Math.min(6, 2 + Math.floor(e.damage / 8)), 150, { dirX: 0, dirY: -1, spread: 0.8 });
        this.particles.burst('sparkle', b.x, b.y - 30, Math.min(16, 6 + Math.floor(e.damage / 4)), 190, { dirX: 0, dirY: -1, spread: 0.8 });
        // fine hot grit inside the smoke adds sparkle without more big shapes
        this.particles.burst('ember', b.x, b.y - 20, Math.min(12, 4 + Math.floor(e.damage / 5)), 260, { dirX: cause.dirX, dirY: cause.dirY - 0.35, spread: 1.05, color: '#ff5a3c' });
      }
      // The shockwave is spawned last so it draws over the smoke and sparks.
      this.particles.burst('shock', b.x, b.y - 18, 1, 0);
      // Shrapnel of whatever did the hitting: splinters for wood, sparks for metal,
      // shards for glass/ceramic — a frying pan reads differently from a lamp.
      if (weapon && (big || firstHit)) {
        this.particles.burst(
          weapon.material.debris,
          b.x,
          b.y - 14,
          Math.min(12, 2 + Math.floor(e.damage / 6)),
          320,
          cone ? { ...cone, spread: 0.95 } : undefined,
        );
      }
      // Light taps still kick up dust so every connection lands; big hits are all smoke.
      if (!big) this.particles.burst('dust', b.x, b.y + 4, 2, 70, cone);
      if (big || firstHit) this.fx.ring(b.x, b.y, 6, 34 + e.damage * 0.7, 0.3, 'rgba(255,70,58,0.9)', 4);
      else if (e.damage >= 10) this.fx.ring(b.x, b.y, 4, 18 + e.damage * 0.6, 0.22, 'rgba(255,90,78,0.7)', 2);
      // Huge hits get a second, tighter shockwave on top: the "double-crack" feel.
      if (huge) this.fx.ring(b.x, b.y, 4, 22 + e.damage * 0.45, 0.32, 'rgba(255,120,86,0.95)', 3);
      // Massive hits flash the room red for a beat (scaled by the reduced-shake setting).
      if (massive) this.fx.flash('#ff2e2e', 0.14);
      this.camera.addShake(firstHit ? Math.max(0.35, Math.min(0.65, e.damage / 70)) : Math.min(0.65, e.damage / 70));
      if (showWord) this.camera.punchZoom(0.025 + Math.min(0.04, e.damage / 1000));
      if (directional) this.camera.kick(cause.dirX * Math.min(10, e.damage / 4.5), cause.dirY * Math.min(10, e.damage / 4.5));
      if (e.damage >= 38) this.hitStop(0.1);
      else if (e.damage >= 20) this.hitStop(0.06);
      else if (e.damage >= 10) this.hitStop(0.035);
      else if (firstHit) this.hitStop(0.06);
    });

    bus.on('ENEMY_DEFEATED', (e) => {
      const b = e.enemy.body;
      this.audio.voice('defeat', e.enemy.type.voice, e.enemy.type.id);
      if (e.enemy.type.boss) {
        this.audio.bossRoar(e.enemy.type.id, e.enemy.type.voice, true);
        this.hud.banner(e.enemy.type.bossTitle ?? 'LANDLORD EVICTED', '', 2.2);
        this.discoveries.unlock(e.enemy.type.bossDiscovery ?? 'mom_says_no');
      }
      // the box bursts: packing peanuts everywhere, plus a starburst in the
      // direction of the killing blow so the knockout tops the hit that caused it
      this.particles.burst('peanut', b.x, b.y - 14, 30, 340);
      this.particles.burst('sparkle', b.x, b.y - 20, 26, 300);
      this.particles.ringBurst('sparkle', b.x, b.y - 20, 14, 260, 28);
      this.particles.burst('shock', b.x, b.y - 20, 1, 0);
      this.particles.burst('glint', b.x, b.y - 22, 2, 55);
      const killDir = e.cause.dirX !== 0 || e.cause.dirY !== 0;
      this.particles.burst(
        'star',
        b.x,
        b.y - 12,
        8,
        300,
        killDir ? { dirX: e.cause.dirX, dirY: e.cause.dirY, spread: 0.8 } : undefined,
      );
      this.fx.ring(b.x, b.y, 10, 92, 0.42, 'rgba(255,255,255,0.9)', 5);
      this.particles.burst('dust', b.x, b.y + 6, 6, 120);
      this.fx.ring(b.x, b.y, 4, 40, 0.35, 'rgba(255,210,63,0.9)', 3);
      if (this.enemiesRemaining === 0) {
        // The last one out gets the full treatment: letterbox, slow motion, a push-in.
        this.cinema = 1.25;
        this.slowMotion(0.18, 1.15);
        this.camera.focus(b.x, b.y, 1.25, 1.2);
        this.camera.addShake(0.45);
        this.fx.burst('K.O.!', b.x, b.y - 48, 1.5, '#ff5a4e', true);
        this.fx.flash('#ffffff', 0.3);
        this.particles.burst('confetti', b.x, b.y - 14, 26, 420);
        this.hitStop(0.12);
      } else {
        this.camera.addShake(0.38);
        this.camera.punchZoom(0.035);
        this.fx.flash('#ffffff', 0.12);
        this.hitStop(0.11);
      }
      this.analytics.track('enemy_defeat', {
        enemy: e.enemy.type.id,
        cause: e.cause.type,
        with: e.cause.label,
        chain: e.cause.chain ? e.cause.chain.steps.length : 0,
      });
    });

    bus.on('PLAYER_DEFEATED', () => {
      this.slowMotion(0.25, 1.2);
      this.audio.play('scream', 0.8);
      this.particles.burst('star', this.player.body.x, this.player.body.y, 16, 240);
      this.impactSpark(this.player.body.x, this.player.body.y - 10, 0.7);
    });

    bus.on('OBJECT_GRABBED', (e) => this.analytics.track('object_grab', { object: e.object.def.id }));
    bus.on('OBJECT_THROWN', (e) => this.analytics.track('object_throw', { object: e.object.def.id, charge: Math.round(e.charge * 100) }));
    bus.on('DISCOVERY', (e) => {
      // like a camera flash going off: this one is going on the evidence board
      if (e.isNew) this.fx.flash('#ffffff', 0.2);
      this.analytics.track('new_discovery', { id: e.id, total: this.discoveries.count });
    });
    bus.on('CHAIN', (e) => {
      this.camera.addShake(0.25);
      this.analytics.track('chain_reaction', { length: e.length, steps: e.steps.join('>') });
    });
    bus.onAny((event) => this.replay.observe(event));
  }

  /** Advances the simulation by a number of fixed steps without waiting for frames (tests, tools). */
  stepManually(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.tick(FIXED_DT);
  }
}
