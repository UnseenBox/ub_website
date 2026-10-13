import type { Boost } from '../abilities/Cards';
import { BOOST_COSTS, coinsFor } from '../abilities/Cards';
import { AudioManager } from '../audio/AudioManager';
import { Music } from '../audio/Music';
import { SKINS, skinOf, type Skin } from '../ball/Skins';
import { saveLang, tr } from './i18n';
import sfxIndex from '../assets/sfx.json';
import sfxUrl from '../assets/sfx.wav?url';
import { SoundLibrary } from '../audio/SoundLibrary';
import { Ball } from '../ball/Ball';
import { BallTrail } from '../ball/BallTrail';
import { ShotController, speedForPower, type Shot } from '../ball/ShotController';
import { TrajectoryPreview } from '../ball/TrajectoryPreview';
import { DebugOverlay } from '../debug/DebugOverlay';
import { DuelController } from '../duel/DuelController';
import { boostFeedback, wireFeedback } from '../feedback/Feedback';
import { CELEBRATION_TIMING, GoalCelebration } from '../goal/GoalCelebration';
import { classifyMiss, type MissKind } from '../goal/GoalDetector';
import { GoalNet } from '../goal/GoalNet';
import { InputManager } from '../input/InputManager';
import { Level } from '../levels/Level';
import type { LevelDefinition } from '../levels/LevelDefinition';
import type { MechEventKind, MechSink } from '../mechanics/Mechanic';
import { ParticleSystem } from '../particles/ParticleSystem';
import { Popups } from '../particles/Popups';
import { FIXED_DT, type ContactListener } from '../physics/PhysicsWorld';
import type { RigidBody } from '../physics/RigidBody';
import { aimOffset } from '../rendering/AimArt';
import { Camera } from '../rendering/Camera';
import { Renderer } from '../rendering/Renderer';
import { SaveManager, type LevelRecord } from '../save/SaveManager';
import { scoreShot } from '../scoring/ScoreSystem';
import { ShotAnalyzer } from '../scoring/ShotAnalyzer';
import { Hud } from '../ui/HUD';
import { AbilityBar } from '../ui/AbilityBar';
import { portal, isCrazyGames } from '../portal/Portal';
import { Overlay } from '../ui/Overlay';
import { EventBus, type GameEvents } from './EventBus';
import { GameLoop } from './GameLoop';
import type { GameState } from './GameState';
import { Time } from './Time';

/** Coins for watching a rewarded ad on a portal. The shop stays the coin-free alternative. */
const REWARD_COINS = 30;
/** A ball slower than this for STILL_SECONDS is over. */
const STILL_SPEED = 4;
const STILL_SECONDS = 0.1;
/** No shot is allowed to run longer than this, whatever the street does to it. */
const MAX_FLIGHT = 9;
/** How long the miss label holds before the ball is put back, by how close it was. */
const MISS_HOLD = 0.5;
const NEAR_MISS_HOLD = 0.8;
/** Drag on a ball that is over the line: the net takes the pace off it. */
const NET_DRAG = 5.5;
/** Points kept of a shot's path, one every few physics steps. */
const PATH_POINTS = 420;
const PATH_EVERY = 5;

/** The route a shot took, kept so it can be chalked on the ground afterwards. */
export class ShotPath {
  readonly points = new Float32Array(PATH_POINTS * 2);
  /** Where the goalkeeper stood at each point (NaN when there is none), for duel replays. */
  readonly keeper = new Float32Array(PATH_POINTS);
  count = 0;

  clear(): void {
    this.count = 0;
  }

  /** A NaN pair marks a break in the line (the ball went down a pipe). */
  push(x: number, y: number, keeperX = NaN): void {
    if (this.count >= PATH_POINTS) return;
    this.points[this.count * 2] = x;
    this.points[this.count * 2 + 1] = y;
    this.keeper[this.count] = keeperX;
    this.count++;
  }
}

/**
 * What the street did during a shot that a replay should show again, in the order they are
 * numbered when stored. Sand and soft clinks are left out: they are only noise.
 */
export const REPLAY_KINDS: readonly MechEventKind[] = ['boing', 'bumper', 'spin', 'wind', 'pipe', 'smash', 'bell', 'save', 'scooter', 'burn', 'magnet'];
const MAX_EVENT_NUMBERS = 160;

/** What a finished shot amounted to, for whoever is keeping score. */
export interface ShotOutcome {
  goal: boolean;
  score: number;
  path: ShotPath;
  /** Flat groups of four: path index, kind (an index into REPLAY_KINDS), x, y. */
  events: number[];
  /** Where the scooters were as the ball was struck (see Level.moverState). */
  movers: number[];
}

/** A shot as it was recorded, ready to be shown again. */
export interface ReplayData {
  /** Flat x, y pairs; a null pair is a break in the line. */
  path: readonly (number | null)[];
  /** The keeper's x at each path point. */
  keeper: readonly (number | null)[];
  /** Whether the recorded shot went in, so the ending can be celebrated. */
  goal: boolean;
  events: readonly number[];
  movers: readonly number[];
  boost: Boost | null;
}

interface Replay extends ReplayData {
  points: number;
  t: number;
  /** Last path segment a bounce was looked for on. */
  segment: number;
  /** Next entry of `events` to fire. */
  cursor: number;
  onDone: () => void;
}

/** A big line of text over the alley, for moments the duel wants to announce. */
export interface Banner {
  text: string;
  good: boolean;
  /** Seconds it has been up, and how long it stays. */
  t: number;
  dur: number;
}

/**
 * Who is who on a duel alley. Each duelist keeps one colour for the whole match: it is on
 * their ball when they shoot and on their goal when they defend.
 */
export interface DuelLook {
  attacker: string;
  defender: string;
  /** Written over the ball: "YOU", or the opponent's name. */
  ballTag: string;
  /** Written over the goal: "YOUR GOAL", or whose it is. */
  goalTag: string;
}

/** The duel scoreboard shown in place of the solo best score. */
export interface DuelScore {
  round: number;
  /** Per round: true scored, false missed, null not played yet. */
  mine: (boolean | null)[];
  theirs: (boolean | null)[];
  opponent: string;
  mineColor: string;
  theirColor: string;
}

/** Path points per second of flight. */
const REPLAY_RATE = 240 / PATH_EVERY;

/**
 * Owns the systems and the shot state machine. It decides what happens (launch, goal, miss,
 * reset) and announces it on the event bus; how that looks and sounds lives in Feedback.
 */
export class Game {
  readonly events = new EventBus<GameEvents>();
  readonly time = new Time();
  readonly camera = new Camera();
  readonly audio = new AudioManager();
  readonly sounds = new SoundLibrary(this.audio);
  private readonly music = new Music();
  /** The ball the player chose. */
  skin: Skin;
  readonly particles = new ParticleSystem();
  readonly popups = new Popups();
  readonly save = new SaveManager();
  readonly shot = new ShotController();
  readonly analyzer = new ShotAnalyzer();
  readonly celebration = new GoalCelebration();
  readonly trail = new BallTrail();
  readonly debug = new DebugOverlay();
  readonly hud = new Hud();
  readonly input: InputManager;
  readonly renderer: Renderer;
  readonly loop: GameLoop;
  readonly ball: Ball;
  readonly preview: TrajectoryPreview;

  /** These three are replaced whenever a level loads. */
  level: Level;
  net: GoalNet;
  record: LevelRecord;

  state: GameState = 'menu';
  /** Real seconds spent in the current state. */
  stateT = 0;
  /** True while the pause card or the level list is up over a level. */
  paused = false;
  missKind: MissKind = 'miss';
  lastScore = 0;
  /** 1 as a goal goes in, fading to 0: lights the frame and flashes the screen. */
  goalFlash = 0;
  /** Where the ball is drawn relative to its body while the player pulls back. */
  readonly aimDraw = { x: 0, y: 0 };
  /** The previous shot's route, chalked on the ground. */
  lastPath = new ShotPath();

  /** 'single' is the duel rule: one shot, no retry, the result goes to `onShotEnd`. */
  shotRule: 'free' | 'single' = 'free';
  shotTaken = false;
  onShotEnd: ((outcome: ShotOutcome) => void) | null = null;
  /** Called as a duel shot leaves the boot, before anything else happens to it. */
  onShotStart: (() => void) | null = null;
  /** The boost that will ride on the next shot (a duel card). */
  armedBoost: Boost | null = null;
  /** The boost on the ball that is flying, or being replayed. */
  flightBoost: Boost | null = null;
  /** 0 to 1: how thick the smoke over the street is (a duel trick), easing towards its target. */
  smoke = 0;
  smokeTarget = 0;
  banner: Banner | null = null;
  duelScore: DuelScore | null = null;
  duelLook: DuelLook | null = null;
  /** Replaces "ZENQA nn" on the level plaque. */
  hudLabel: string | null = null;
  readonly duel: DuelController;
  readonly abilities: AbilityBar;
  private replay: Replay | null = null;

  private path = new ShotPath();
  private readonly overlay: Overlay;
  private accumulator = 0;
  private stillFor = 0;
  private flightFor = 0;
  private pathTick = 0;
  private buttonsUp = false;
  private shotEvents: number[] = [];
  private shotMovers: number[] = [];
  private readonly magnetField = (b: RigidBody): void => {
    this.level.magnetField(b);
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    overlayRoot: HTMLElement,
    readonly levels: readonly LevelDefinition[],
  ) {
    this.skin = skinOf(this.save.data.skin);
    const start = this.furthestUnlocked();
    this.level = new Level(levels[start], start);
    this.net = new GoalNet(this.level.goal);
    this.record = this.save.level(this.level.def.id);
    const { ballStart } = this.level.def;
    this.ball = new Ball(ballStart.x, ballStart.y);
    this.preview = new TrajectoryPreview(this.ball.radius);

    this.renderer = new Renderer(canvas, this.camera);
    this.frameCamera();
    this.input = new InputManager(canvas);
    this.input.onGesture = () => this.audio.unlock();
    this.audio.muted = this.save.data.muted;
    this.audio.setVolumes(this.save.data.sound, this.save.data.music);
    this.audio.loadSheet(sfxUrl, sfxIndex);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.camera.shakeScale = 0.3;
      this.particles.reduced = true;
    }

    this.overlay = new Overlay(overlayRoot, {
      play: () => this.play(),
      resume: () => this.setPaused(false),
      restart: () => {
        this.setPaused(false);
        this.resetShot();
      },
      pause: () => this.setPaused(true),
      home: () => this.returnToMenu(),
      canDuel: () => !isCrazyGames,
      reward: () => this.watchReward(),
      volumes: () => ({ sound: this.save.data.sound, music: this.save.data.music }),
      setSound: (v) => this.setVolumes(v, this.save.data.music),
      setMusic: (v) => this.setVolumes(this.save.data.sound, v),
      setLang: (next) => {
        // Every screen is built once in one language, so a change starts the page again.
        saveLang(next);
        location.reload();
      },
      skins: () => SKINS.map((s) => ({ ...s, open: this.totalStars() >= s.need, selected: s.id === this.skin.id })),
      pickSkin: (id) => {
        this.skin = skinOf(id);
        this.save.data.skin = this.skin.id;
        this.save.save();
        this.sounds.ui();
      },
      stars: () => ({ n: this.totalStars(), max: this.levels.length * 3 }),
      resetProgress: () => this.resetProgress(),
      levels: () => this.openLevels(),
      select: (index) => this.selectLevel(index),
      closeLevels: () => this.closeLevels(),
      next: () => this.nextLevel(),
      retry: () => this.resetShot(),
      duel: () => this.duel.open(),
    });
    this.overlay.showMenu();
    this.abilities = new AbilityBar({
      wallet: () => this.save.data.coins,
      armed: () => this.armedBoost,
      canShow: () => this.shopVisible(),
      buy: (id) => this.buyAbility(id),
    });
    this.overlay.addFloating(this.abilities.el);
    this.duel = new DuelController(this, this.overlay, canvas.parentElement ?? document.body);

    wireFeedback(this);
    this.loop = new GameLoop(
      (dt) => this.frame(dt),
      () => this.renderer.render(this),
    );
    new ResizeObserver(() => this.renderer.resize()).observe(canvas);
    this.renderer.resize();
    // A hidden tab is a break: freeze play wherever it is, in every build.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.paused && this.state !== 'menu' && (this.state === 'ready' || this.state === 'aiming' || this.state === 'flight' || this.state === 'replay')) {
        this.setPaused(true);
      }
    });
  }

  start(): void {
    this.loop.start();
  }

  private totalStars(): number {
    return this.levels.reduce((sum, def) => sum + this.save.level(def.id).stars, 0);
  }

  /** Erases every record and puts the player back on the first alley. */
  resetProgress(): void {
    this.save.data.levels = {};
    this.save.data.coins = 0;
    this.save.save();
    this.loadLevel(0);
  }

  private setVolumes(sound: number, music: number): void {
    this.audio.unlock();
    this.audio.setVolumes(sound, music);
    this.save.data.sound = sound;
    this.save.data.music = music;
    this.save.save();
  }

  /** A level is open once the one before it has been scored on. */
  isUnlocked(index: number): boolean {
    return index === 0 || this.save.level(this.levels[index - 1].id).goals > 0;
  }

  private furthestUnlocked(): number {
    let i = 0;
    while (i + 1 < this.levels.length && this.isUnlocked(i + 1)) i++;
    return i;
  }

  /** Landscape keeps the HUD beside the alley; portrait stacks it above the goal. */
  private frameCamera(): void {
    const { arena } = this.level.def;
    const cx = arena.x + arena.w / 2;
    // A duel keeps a strip free under the kerb for the row of cards.
    const tall = arena.h + 520 + (this.shotRule === 'single' ? 84 : 0);
    this.camera.setFrames(
      { cx, cy: arena.y - 170 + (arena.h + 244) / 2, w: arena.w + 660, h: arena.h + 244 },
      { cx, cy: arena.y - 390 + tall / 2, w: arena.w + 110, h: tall },
    );
  }

  /** The boost to draw on the ball right now: the one armed while waiting, the one in play once struck. */
  get shownBoost(): Boost | null {
    if (this.state === 'ready' || this.state === 'aiming') return this.armedBoost;
    return this.state === 'flight' || this.state === 'replay' ? this.flightBoost : null;
  }

  private clearDuelState(): void {
    this.onShotStart = null;
    this.armedBoost = null;
    this.flightBoost = null;
    this.smoke = 0;
    this.smokeTarget = 0;
    this.banner = null;
    this.replay = null;
  }

  /** Swaps the alley. Everything belonging to the old one is dropped. */
  loadLevel(index: number): void {
    const def = this.levels[index];
    if (!def) return;
    // A paid boost never vanishes into a loading screen: hand the coins back.
    if (this.armedBoost) {
      this.save.data.coins += BOOST_COSTS[this.armedBoost];
      this.armedBoost = null;
      this.save.save();
    }
    this.shotRule = 'free';
    this.onShotEnd = null;
    this.clearDuelState();
    this.duelScore = null;
    this.duelLook = null;
    this.hudLabel = null;
    this.install(new Level(def, index), this.save.level(def.id));
  }

  /**
   * Loads an alley that is not one of the solo levels (a duel round). Nothing about it is
   * saved, and it allows exactly one shot.
   */
  loadCustom(def: LevelDefinition): void {
    this.shotRule = 'single';
    this.clearDuelState();
    this.duelLook = null;
    // Index -1: not a numbered alley, so no tutorial and no "next".
    this.install(new Level(def, -1), { best: 0, attempts: 0, goals: 0, stars: 0 });
  }

  private install(level: Level, record: LevelRecord): void {
    this.paused = false;
    this.level = level;
    this.net = new GoalNet(this.level.goal);
    this.record = record;
    this.shotTaken = false;
    this.lastScore = 0;
    this.lastPath.clear();
    this.path.clear();
    this.popups.clear();
    this.frameCamera();
    this.hud.invalidate();
    this.renderer.invalidate();
    this.state = 'ready';
    this.resetShot();
  }

  /** Duel: this alley is only to be looked at (a shot already taken here, or someone else's turn). */
  lockShot(): void {
    this.shotTaken = true;
  }

  /** Duel: plays a recorded shot over the current alley, then calls `onDone`. */
  playReplay(data: ReplayData, onDone: () => void): void {
    this.replay = { ...data, points: Math.floor(data.path.length / 2), t: 0, segment: 0, cursor: 0, onDone };
    this.level.setMoverState(data.movers);
    this.flightBoost = data.boost;
    this.shotTaken = true;
    this.trail.clear();
    this.setState('replay');
  }

  /** Duel: jumps a replay to its last frame. */
  skipReplay(): void {
    if (this.replay) this.replay.t = Math.max(this.replay.t, this.replay.points - 1.001);
  }

  showBanner(text: string, good: boolean, seconds = 2.6): void {
    this.banner = { text, good, t: 0, dur: seconds };
  }

  /** The solo ability shop is for free play only, while the ball waits to be struck. */
  private shopVisible(): boolean {
    return (
      this.shotRule === 'free' &&
      !this.duelScore &&
      !this.duel.active &&
      !this.paused &&
      (this.state === 'ready' || this.state === 'aiming')
    );
  }

  /** Buys a boost for the next shot, or takes it back off for a refund. */
  buyAbility(id: Boost): void {
    if (!this.shopVisible()) return;
    this.audio.unlock();
    if (this.armedBoost === id) {
      this.armedBoost = null;
      this.save.data.coins += BOOST_COSTS[id];
      this.save.save();
      this.sounds.card(false);
      return;
    }
    const spare = this.armedBoost ? BOOST_COSTS[this.armedBoost] : 0;
    if (this.save.data.coins + spare < BOOST_COSTS[id]) return;
    this.save.data.coins += spare - BOOST_COSTS[id];
    this.armedBoost = id;
    this.save.save();
    this.sounds.card(true);
  }

  /** Back to the title card, on the furthest solo houma reached. */
  returnToMenu(): void {
    portal.gameplayStop();
    this.loadLevel(this.furthestUnlocked());
    this.state = 'menu';
    this.overlay.showMenu();
  }

  /** Leaves the title card. */
  play(): void {
    if (this.state !== 'menu') return;
    this.audio.unlock();
    this.sounds.ui();
    this.overlay.hide();
    this.state = 'ready';
    this.stateT = 0;
    this.ball.reset(this.level.def.ballStart.x, this.level.def.ballStart.y);
    portal.gameplayStart();
  }

  setPaused(paused: boolean): void {
    if (this.state === 'menu' || paused === this.paused) return;
    this.paused = paused;
    if (paused) {
      if (this.state === 'aiming') this.cancelAim();
      portal.gameplayStop();
      if (this.duel.active) this.duel.showPause();
      else {
        this.overlay.showPause();
        this.overlay.setReward(this.rewardOffer());
      }
    } else {
      this.overlay.hide();
      this.syncButtons(true);
      portal.gameplayStart();
    }
    this.abilities.refresh(BOOST_COSTS);
  }

  /** A rewarded ad for coins, offered in the pause menu while one can be shown. */
  private rewardOffer(): { label: string } | null {
    if (!portal.ads || this.duel.active || this.shotRule !== 'free' || portal.rewardCooldown() > 0) return null;
    return { label: tr('+30 COINS') };
  }

  private watchReward(): void {
    const granted = portal.rewarded(this, () => {
      this.save.data.coins += REWARD_COINS;
      this.save.save();
      this.sounds.card(true);
      this.overlay.setReward(null);
    });
    if (!granted) {
      this.sounds.ui();
      this.overlay.setReward({ label: tr('TRY LATER') });
      window.setTimeout(() => {
        if (this.paused) this.overlay.setReward(this.rewardOffer());
      }, 1600);
    }
  }

  openLevels(): void {
    this.sounds.ui();
    if (this.state === 'aiming') this.cancelAim();
    if (this.state !== 'menu') this.paused = true;
    portal.gameplayStop();
    this.overlay.showLevels(
      this.levels.map((def, i) => {
        const rec = this.save.level(def.id);
        return { name: def.name, hint: def.hint, stars: rec.stars, best: rec.best, unlocked: this.isUnlocked(i) };
      }),
      this.level.index,
    );
    this.abilities.refresh(BOOST_COSTS);
  }

  closeLevels(): void {
    if (this.state === 'menu') {
      this.overlay.showMenu();
      return;
    }
    this.paused = false;
    this.overlay.hide();
    this.syncButtons(true);
    this.abilities.refresh(BOOST_COSTS);
    portal.gameplayStart();
  }

  selectLevel(index: number): void {
    if (!this.isUnlocked(index)) return;
    this.audio.unlock();
    this.sounds.ui();
    this.paused = false;
    this.overlay.hide();
    this.loadLevel(index);
    portal.gameplayStart();
  }

  /** Between houmas: the portal may take a midgame break first, then the next street loads. */
  nextLevel(): void {
    if (this.level.index + 1 >= this.levels.length) {
      this.openLevels();
      return;
    }
    const next = this.level.index + 1;
    if (!portal.midroll(this, () => this.selectLevel(next))) this.selectLevel(next);
  }

  toggleSound(): boolean {
    const muted = !this.audio.muted;
    this.audio.unlock();
    this.audio.setMuted(muted);
    this.save.data.muted = muted;
    this.save.save();
    return !muted;
  }

  /** Called when a web font finishes loading: cached text was drawn in the fallback face. */
  fontsChanged(): void {
    this.hud.invalidate();
    this.renderer.invalidate();
  }

  /** Shoots without the pointer. Used by tests and, later, by replays. */
  fire(dirX: number, dirY: number, power: number): void {
    if (this.state === 'menu') this.play();
    if (this.state !== 'ready') this.resetShot();
    const len = Math.hypot(dirX, dirY) || 1;
    const b = this.ball.body;
    this.launch({ dirX: dirX / len, dirY: dirY / len, power, speed: speedForPower(power), spin: 0, charge: 0, launchX: b.x, launchY: b.y });
  }

  private frame(realDt: number): void {
    const input = this.input;
    this.music.update(this.audio);
    if (import.meta.env.DEV && input.consume('debug')) this.debug.toggle();
    if (input.consume('mute')) this.toggleSound();
    if (input.consume('pause')) {
      // Escape backs out of a pull before it pauses the game.
      if (this.state === 'aiming') this.cancelAim();
      else this.setPaused(!this.paused);
    }

    if (!this.paused) {
      if (this.state === 'menu') {
        if (input.consume('confirm')) this.play();
      } else if (this.shotRule === 'single') {
        // One shot and no going back: the pointer only matters until it is taken.
        if (!this.shotTaken && this.state !== 'replay') this.handlePointer(realDt);
      } else {
        if (input.consume('restart')) this.resetShot();
        if (input.consume('confirm') && this.state === 'goal' && this.celebration.canRetry) this.nextLevel();
        this.handlePointer(realDt);
      }
      this.stateT += realDt;
      const dt = this.time.step(realDt);
      this.simulate(dt);
      this.updateVisuals(dt, realDt);
    }
    input.endFrame();
  }

  private handlePointer(realDt: number): void {
    const p = this.input.pointer;
    if (p.pressed) {
      // Any press is "go again": after a miss or a goal it resets and starts the next pull at once.
      if (this.state === 'missed' || (this.state === 'goal' && this.celebration.canRetry)) this.resetShot();
      if (this.state === 'ready') this.beginAim();
    }
    if (this.state !== 'aiming') return;

    // The pull is measured on screen and converted at the resting scale, so a camera that is
    // still easing out of a zoom cannot change how far the player has dragged.
    const scale = this.camera.scale;
    const stepped = this.shot.update((p.x - this.input.pressX) / scale, (p.y - this.input.pressY) / scale, realDt);
    if (stepped) this.events.emit('AIM_STEP', { step: this.shot.step });
    this.sounds.pull(this.shot.power, realDt);
    if (this.shot.armed) {
      this.preview.compute(this.level.world, this.ball.body, this.shot.dirX, this.shot.dirY, this.shot.speed, this.shot.power, this.armedBoost === 'magnet' ? this.magnetField : null);
    } else {
      this.preview.clear();
    }

    if (p.cancelled) this.cancelAim();
    else if (p.released) this.releaseShot();
  }

  private beginAim(): void {
    this.shot.begin();
    this.preview.clear();
    this.setState('aiming');
    this.events.emit('AIM_STARTED', { x: this.ball.body.x, y: this.ball.body.y });
  }

  private cancelAim(): void {
    const wasArmed = this.shot.armed;
    this.shot.cancel();
    this.preview.clear();
    this.setState('ready');
    if (wasArmed) this.events.emit('AIM_CANCELLED', { x: this.ball.body.x, y: this.ball.body.y });
  }

  private releaseShot(): void {
    const b = this.ball.body;
    const shot = this.shot.release(b.x, b.y);
    this.preview.clear();
    if (shot) this.launch(shot);
    else this.setState('ready');
  }

  private launch(shot: Shot): void {
    const b = this.ball.body;
    b.vx = shot.dirX * shot.speed;
    b.vy = shot.dirY * shot.speed;
    b.angVel = shot.spin;
    this.ball.stretch(shot.dirX, shot.dirY, 0.1 + 0.2 * shot.power);
    this.level.arm(this.armedBoost, b);
    this.flightBoost = this.armedBoost;
    this.armedBoost = null;
    this.smokeTarget = 0;
    this.shotEvents = [];
    this.shotMovers = this.level.moverState();
    if (this.shotRule === 'single') this.onShotStart?.();
    this.analyzer.begin(shot, this.level.goal);
    this.trail.clear();
    this.shotTaken = true;
    this.path.clear();
    this.path.push(b.x, b.y, this.keeperX());
    this.pathTick = 0;
    this.stillFor = 0;
    this.flightFor = 0;
    this.record.attempts++;
    this.save.save();
    this.setState('flight');
    this.events.emit('BALL_LAUNCHED', { x: b.x, y: b.y, dirX: shot.dirX, dirY: shot.dirY, power: shot.power, speed: shot.speed });
  }

  private simulate(dt: number): void {
    this.accumulator += dt;
    while (this.accumulator >= FIXED_DT) {
      this.accumulator -= FIXED_DT;
      this.stepWorld();
    }
    const moving = this.state === 'flight' || this.state === 'goal';
    this.ball.interpolate(moving ? this.accumulator / FIXED_DT : 1);
  }

  private stepWorld(): void {
    const ball = this.ball;
    const goal = this.level.goal;
    // The street keeps moving whether or not a ball is in play.
    const live = this.state === 'flight' || this.state === 'goal';
    if (live) ball.savePrev();
    this.level.step(ball.body, FIXED_DT, live, this.onContact, this.onMechanic);
    if (this.state !== 'flight') return;

    this.analyzer.track(ball.body, FIXED_DT, goal);
    this.flightFor += FIXED_DT;
    if (++this.pathTick >= PATH_EVERY) {
      this.pathTick = 0;
      this.path.push(ball.body.x, ball.body.y, this.keeperX());
    }
    if (goal.contains(ball.body.x, ball.body.y)) {
      this.scoreGoal();
    } else if (ball.speed < STILL_SPEED || this.flightFor > MAX_FLIGHT) {
      this.stillFor += FIXED_DT;
      if (this.stillFor >= STILL_SECONDS) this.missShot();
    } else {
      this.stillFor = 0;
    }
  }

  private keeperX(): number {
    return this.level.keeper ? this.level.keeper.body.x : NaN;
  }

  private readonly onContact: ContactListener = (_body, other, c, impact) => {
    const bounce = this.state === 'flight' ? this.analyzer.registerContact(other.surface, other.id, impact) : 0;
    this.events.emit('BALL_COLLIDED', { x: c.px, y: c.py, nx: c.nx, ny: c.ny, impact, surface: other.surface, bodyId: other.id, bounce });
    if (other.surface === 'post' && bounce > 0) this.events.emit('BALL_HIT_POST', { x: c.px, y: c.py, impact });
  };

  private readonly onMechanic: MechSink = (e) => {
    if (this.state === 'flight') this.analyzer.registerMechanic(e.kind);
    const code = REPLAY_KINDS.indexOf(e.kind);
    if (code >= 0 && this.state === 'flight' && this.shotEvents.length < MAX_EVENT_NUMBERS) this.shotEvents.push(this.path.count, code, Math.round(e.x), Math.round(e.y));
    if (e.kind === 'pipe') {
      // Break the chalk line and the dust trail: the ball did not travel between the holes.
      this.path.push(e.x, e.y);
      this.path.push(NaN, NaN);
      this.path.push(this.ball.body.x, this.ball.body.y);
      this.trail.clear();
      this.ball.savePrev();
    }
    this.events.emit('MECHANIC', e);
  };

  private scoreGoal(): void {
    const b = this.ball.body;
    const goal = this.level.goal;
    const card = scoreShot(this.analyzer.finish(true, b, goal, this.level.hasKeeper), this.record.best, this.level.def.stars);
    this.record.goals++;
    this.lastScore = card.total;
    // Every solo goal mints Kora Coins for the ability shop, and ends the level.
    if (this.shotRule === 'free') {
      this.save.data.coins += coinsFor(card.total);
      portal.gameplayStop();
    }
    if (card.newBest) this.record.best = card.total;
    if (card.stars > this.record.stars) this.record.stars = card.stars;
    this.save.save();

    b.drag = NET_DRAG;
    this.goalFlash = 1;
    this.path.push(b.x, b.y);
    this.setState('goal');
    this.celebration.start(card);
    this.time.hitStop(CELEBRATION_TIMING.hitStop);
    this.time.slowMo(CELEBRATION_TIMING.slowMoScale, CELEBRATION_TIMING.slowMoSeconds);
    this.camera.zoomTo(goal.cx, goal.lineY + 40, 0.45);
    this.net.punch(b.x, b.vx * 0.1, b.vy * 0.08);
    this.events.emit('GOAL_SCORED', { x: b.x, y: b.y, speed: Math.hypot(b.vx, b.vy), total: card.total, bounces: card.bounces, stars: card.stars, newBest: card.newBest });
    if (this.shotRule === 'single') this.onShotEnd?.({ goal: true, score: card.total, path: this.path, events: this.shotEvents, movers: this.shotMovers });
  }

  private missShot(): void {
    const b = this.ball.body;
    b.vx = 0;
    b.vy = 0;
    this.path.push(b.x, b.y);
    this.missKind = classifyMiss(this.analyzer.finish(false, b, this.level.goal, this.level.hasKeeper));
    this.setState('missed');
    this.events.emit('SHOT_FAILED', { kind: this.missKind, x: b.x, y: b.y });
    if (this.shotRule === 'single') this.onShotEnd?.({ goal: false, score: 0, path: this.path, events: this.shotEvents, movers: this.shotMovers });
  }

  /** Puts the ball back on its spot, from any state. This is the whole retry flow. */
  resetShot(): void {
    if (this.state === 'menu') return;
    const { x, y } = this.level.def.ballStart;
    // The shot just taken becomes the chalk line on the ground.
    if (this.path.count > 1) {
      const swap = this.lastPath;
      this.lastPath = this.path;
      this.path = swap;
    }
    this.path.clear();
    this.shot.cancel();
    this.preview.clear();
    this.celebration.stop();
    this.time.clear();
    this.camera.zoomOut();
    this.trail.clear();
    this.level.resetShot();
    this.flightBoost = null;
    this.ball.reset(x, y);
    this.setState('ready');
    this.events.emit('SHOT_RESET', { x, y });
  }

  /** Moves the ball (and the keeper) along a recorded shot. The physics is not run again. */
  private stepReplay(dt: number): void {
    const r = this.replay;
    if (!r) return;
    const b = this.ball.body;
    const last = r.points - 1;
    const before = r.t;
    r.t = Math.min(last, r.t + dt * REPLAY_RATE);
    const i = Math.max(0, Math.min(last - 1, Math.floor(r.t)));
    const ax = r.path[i * 2];
    const ay = r.path[i * 2 + 1];
    const bx = r.path[i * 2 + 2];
    const by = r.path[i * 2 + 3];
    if (ax !== null && ay !== null && bx !== null && by !== null) {
      const f = r.t - i;
      b.x = ax + (bx - ax) * f;
      b.y = ay + (by - ay) * f;
      // A velocity for the ball to roll and trail by; it is never integrated.
      b.vx = (bx - ax) * REPLAY_RATE;
      b.vy = (by - ay) * REPLAY_RATE;
    } else if (r.t < last) {
      // A break in the line (a manhole): jump to the far side and carry on.
      r.t = Math.min(last, i + 1);
      this.trail.clear();
    }
    if (i !== r.segment) {
      r.segment = i;
      this.replayBounce(r, i);
    }
    // What the street did at this point of the shot: break the pane, lift the shutter, burn the crate.
    while (r.cursor + 3 < r.events.length && r.events[r.cursor] <= r.t + 0.5) {
      const kind = REPLAY_KINDS[r.events[r.cursor + 1]];
      const ex = r.events[r.cursor + 2];
      const ey = r.events[r.cursor + 3];
      r.cursor += 4;
      if (!kind) continue;
      this.level.replayEvent(kind, ex, ey);
      this.events.emit('MECHANIC', { kind, x: ex, y: ey, strength: 0.8 });
    }
    this.ball.savePrev();
    this.ball.interpolate(1);
    const kx = r.keeper[Math.min(r.keeper.length - 1, Math.round(r.t))];
    if (this.level.keeper && typeof kx === 'number') this.level.keeper.body.x = kx;

    if (r.t >= last && before < last) {
      b.vx = 0;
      b.vy = 0;
      // Leave their route chalked on your street.
      this.lastPath.clear();
      for (let k = 0; k < r.points; k++) {
        const x = r.path[k * 2];
        const y = r.path[k * 2 + 1];
        this.lastPath.push(x ?? NaN, y ?? NaN);
      }
      if (r.goal) {
        // The recorded shot went in: give it the same send-off a live goal gets.
        this.goalFlash = 1;
        this.net.punch(b.x, 0, -280);
        this.events.emit('GOAL_SCORED', { x: b.x, y: b.y, speed: 300, total: 0, bounces: 0, stars: 0, newBest: false });
      }
      r.onDone();
    }
  }

  /**
   * A recorded path has no contacts in it, but a sharp turn between two segments is one.
   * Announcing it as a collision gives the replay its sound, dust and shake back.
   */
  private replayBounce(r: Replay, i: number): void {
    if (i < 1) return;
    const p = r.path;
    const x0 = p[i * 2 - 2];
    const y0 = p[i * 2 - 1];
    const x1 = p[i * 2];
    const y1 = p[i * 2 + 1];
    const x2 = p[i * 2 + 2];
    const y2 = p[i * 2 + 3];
    if (x0 === null || y0 === null || x1 === null || y1 === null || x2 === null || y2 === null) return;
    const ax = x1 - x0;
    const ay = y1 - y0;
    const bx = x2 - x1;
    const by = y2 - y1;
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (la < 3 || lb < 3) return;
    const dot = (ax * bx + ay * by) / (la * lb);
    if (dot > 0.93) return;
    // The surface pushed the ball from its old heading to its new one: that difference is the normal.
    let nx = bx / lb - ax / la;
    let ny = by / lb - ay / la;
    const n = Math.hypot(nx, ny) || 1;
    nx /= n;
    ny /= n;
    const impact = 80 + la * REPLAY_RATE * Math.min(1, (1 - dot) * 1.2);
    this.events.emit('BALL_COLLIDED', { x: x1 - nx * this.ball.radius, y: y1 - ny * this.ball.radius, nx, ny, impact, surface: 'wall', bodyId: -1, bounce: 0 });
  }

  private setState(state: GameState): void {
    this.state = state;
    this.stateT = 0;
    this.canvas.classList.toggle('is-aiming', state === 'aiming');
    this.syncButtons(false);
  }

  /** The retry and next buttons belong to the result card: up a beat after a goal, gone on anything else. */
  private syncButtons(force: boolean): void {
    const want = this.shotRule === 'free' && this.state === 'goal' && this.celebration.active && this.celebration.t >= CELEBRATION_TIMING.buttonsAfter && !this.paused;
    if (want === this.buttonsUp && !force) return;
    this.buttonsUp = want;
    this.overlay.setResult(want, this.level.index + 1 < this.levels.length);
  }

  private updateVisuals(dt: number, realDt: number): void {
    const ball = this.ball;
    ball.update(dt);
    if (dt > 0 && (this.state === 'flight' || this.state === 'goal' || this.state === 'replay')) this.trail.push(ball.renderX, ball.renderY, ball.speed);
    this.level.update(dt);
    this.net.update(dt);
    this.particles.update(dt);
    this.popups.update(dt);
    this.celebration.update(realDt);
    if (this.goalFlash > 0) this.goalFlash = Math.max(0, this.goalFlash - realDt * 1.5);
    aimOffset(this.shot, this.time.elapsed, this.aimDraw);
    this.camera.update(realDt, ball.renderX, ball.renderY);
    if (this.state === 'goal') this.syncButtons(false);
    if (this.banner) this.banner.t += realDt;
    this.smoke += (this.smokeTarget - this.smoke) * Math.min(1, realDt * (this.smokeTarget > this.smoke ? 2.4 : 4.5));
    if (this.state === 'replay') this.stepReplay(dt);
    boostFeedback(this, dt);
    this.duel.update(realDt);

    if (this.shotRule === 'free' && this.state === 'missed' && this.stateT >= (this.missKind === 'miss' ? MISS_HOLD : NEAR_MISS_HOLD)) this.resetShot();
    this.abilities.refresh(BOOST_COSTS);
  }
}
