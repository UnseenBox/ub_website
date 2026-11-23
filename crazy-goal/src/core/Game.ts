import type { Boost } from '../abilities/Cards';
import { BOOST_COSTS } from '../abilities/Cards';
import { abilityPrice, aimScale, curlScale, nextPrice, noUpgrades, powerScale, UPGRADES, type UpgradeId } from '../progression/Upgrades';
import { CLUB_START, ballIsOpen, gainXp, nextLockedBall, xpForScore, xpToNext, type LevelReward } from '../progression/Club';
import { addLeagueLp, claimLeague as claimPrize, freshLeague, lpForGoal, pendingResult, prizeFor, seasonClock, settleLeague, standings } from '../progression/League';
import { bonusFor } from '../levels/bonus';
import { hintText } from '../levels/hints';
import { FRENZY_COIN_PER_GOAL, frenzyPool, frenzyUnlocked, livesAfterGoal, newFrenzyRun, type FrenzyRun } from '../progression/Frenzy';
import { BOSS_COIN_MULTIPLIER, WORLD_COUNT, WORLD_REWARD, nextWorld, worldOf, worldRange, worldStars, worldTitle, worldThemeName } from '../progression/Worlds';
import { BONUS_COINS, bonusMet, type BonusId } from '../scoring/Bonus';
import { AudioManager } from '../audio/AudioManager';
import { SKINS, skinOf, type Skin } from '../ball/Skins';
import { saveLang, tr } from './i18n';
import bgMusicUrl from '../../assets/sfx/bg music.mp3?url';
import clickSfxUrl from '../../assets/sfx/click.mp3?url';
import dropSfxUrl from '../../assets/sfx/drop.mp3?url';
import fireAbilitySfxUrl from '../../assets/sfx/hrissa ability.mp3?url';
import funnyMeowSfxUrl from '../../assets/sfx/funny Meow.mp3?url';
import glassBreakSfxUrl from '../../assets/sfx/glass_break.mp3?url';
import glassTapSfxUrl from '../../assets/sfx/glass tap.mp3?url';
import goalSfxUrl from '../../assets/sfx/GOAL.mp3?url';
import magnetAbilitySfxUrl from '../../assets/sfx/magnet ability.mp3?url';
import kickBallSfxUrl from '../../assets/sfx/kick the Ball.mp3?url';
import metalSfxUrl from '../../assets/sfx/metal.mp3?url';
import plankSfxUrl from '../../assets/sfx/planquw.mp3?url';
import powerUpSfxUrl from '../../assets/sfx/power up.mp3?url';
import rubberAbilitySfxUrl from '../../assets/sfx/rubber ability.mp3?url';
import stoneSfxUrl from '../../assets/sfx/rock.mp3?url';
import tinSfxUrl from '../../assets/sfx/tin.mp3?url';
import whistleSfxUrl from '../../assets/sfx/whistle.mp3?url';
import woodSfxUrl from '../../assets/sfx/wood.mp3?url';
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
import { Juice } from '../feedback/Juice';
import { CELEBRATION_TIMING, GoalCelebration } from '../goal/GoalCelebration';
import { classifyMiss, type MissKind } from '../goal/GoalDetector';
import { GoalNet } from '../goal/GoalNet';
import { InputManager } from '../input/InputManager';
import { Level } from '../levels/Level';
import { PAUSE_REWARD_ENABLED, STUCK_MISSES, starsToNextSkin, BOOST_INTRO_FREE_MAGNETS, BOOST_INTRO_LEVEL, LEVEL_COIN_VALUE, chapterOf, coinsForGoal, gateStatus, isGateBlocked, isLevelUnlocked, matchInfo, nextStarTarget, totalStars, type TipKey } from '../progression/Progression';
import type { LevelDefinition } from '../levels/LevelDefinition';
import type { MechEventKind, MechSink } from '../mechanics/Mechanic';
import { ParticleSystem } from '../particles/ParticleSystem';
import { Popups } from '../particles/Popups';
import { FIXED_DT, type ContactListener } from '../physics/PhysicsWorld';
import type { RigidBody } from '../physics/RigidBody';
import { aimOffset } from '../rendering/AimArt';
import { saveSession, loadSession, type SessionScreen } from './session';
import { analytics, wireAnalytics } from '../analytics/Analytics';
import { Camera } from '../rendering/Camera';
import { Renderer } from '../rendering/Renderer';
import { SaveManager, freshLevelRecord, type LevelRecord } from '../save/SaveManager';
import { scoreShot } from '../scoring/ScoreSystem';
import { STREET_LABELS } from '../scoring/StyleRecognizer';
import { ShotAnalyzer } from '../scoring/ShotAnalyzer';
import { Hud } from '../ui/HUD';
import { AbilityBar } from '../ui/AbilityBar';
import { KickControls } from '../ui/KickControls';
import { GuideCard, type GuideInfo } from '../ui/GuideCard';
import { GUIDE_ASSIST_MISSES, guideAssist, guideNeed, guideShot, snapBend, type GuideNeed } from './Guide';
import type { GuideDef } from '../levels/LevelDefinition';
import { airSpeed, KICK, launchVz, type ShotType } from '../physics/Flight';
import { traceShot, type Trace } from '../levels/sweep';
import { portal, isCrazyGames } from '../portal/Portal';
import { forgetStands } from '../rendering/StadiumArt';
import { Overlay, setUiClick, type LeagueInfo, type MenuInfo, type StoreInfo, type WorldInfo } from '../ui/Overlay';
import { EventBus, type GameEvents } from './EventBus';
import { GameLoop } from './GameLoop';
import type { GameState } from './GameState';
import { Time } from './Time';

/** Coins for watching a rewarded ad on a portal. The shop stays the coin-free alternative. */
const REWARD_COINS = 30;
/** A ball slower than this for STILL_SECONDS is over. */
const BEND_STEPS = [-1, -0.5, 0, 0.5, 1] as const;
const STILL_SPEED = 4;
const STILL_SECONDS = 0.1;
/** No shot is allowed to run longer than this, whatever the street does to it. */
const MAX_FLIGHT = 9;
/** How long the miss label holds before the ball is put back, by how close it was. */
// A miss hands the ball back after this long on its own (a press retries at once, at any time).
const MISS_HOLD = 0.3;
const NEAR_MISS_HOLD = 0.35;
/** A first clear moves on to the next match by itself after this long, unless AGAIN or pause stops it. */
const AUTO_ADVANCE_SECONDS = 4;
/** Misses in a row on one match before a gentle hint pill (what the sweep says scores there). */
const HINT_MISSES = 6;
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
  /** The ball the player chose. */
  skin: Skin;
  readonly particles = new ParticleSystem();
  readonly popups = new Popups();
  /** The running spectacle: flash, speed lines, live combo, trick callout, goal rush. */
  readonly juice = new Juice();
  readonly save = new SaveManager();
  readonly shot = new ShotController();
  readonly analyzer = new ShotAnalyzer();
  readonly celebration = new GoalCelebration();
  readonly trail = new BallTrail();
  readonly debug = new DebugOverlay();
  /** Whether the match's sound (the crowd) is on: see syncSoundScene. */
  private soundInMatch = false;
  readonly hud = new Hud();
  readonly input: InputManager;
  readonly renderer: Renderer;
  readonly loop: GameLoop;
  readonly ball: Ball;
  readonly preview: TrajectoryPreview;
  /** The lesson's own dotted path (the shot the ghost hand is about to make). */
  readonly guidePreview: TrajectoryPreview;

  /** These three are replaced whenever a level loads. */
  level: Level;
  net: GoalNet;
  record: LevelRecord;

  state: GameState = 'menu';
  /** Real seconds spent in the current state. */
  stateT = 0;
  /** Where the player was, for the per-tab resume after a reload; mirrors what is on screen. */
  private sessionScreen: SessionScreen = 'menu';
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
  /** The boost that will ride on the next shot (a duel card, or one bought or won in solo play). */
  armedBoost: Boost | null = null;
  /** The armed boost was a free charge, not coins: taking it back returns the charge. */
  private armedFree = false;
  /** A one-time scoring tip to show over the street until the next shot, or null. */
  tip: { key: string; text: string } | null = null;
  /** The boost on the ball that is flying, or being replayed. */
  flightBoost: Boost | null = null;
  /** 0 to 1: how thick the smoke over the street is (a duel trick), easing towards its target. */
  smoke = 0;
  smokeTarget = 0;
  banner: Banner | null = null;
  duelScore: DuelScore | null = null;
  duelLook: DuelLook | null = null;
  /** The alley's coin: where it hangs, and whether it was grabbed this attempt. */
  coinX = 0;
  coinY = 0;
  /** The coin cannot be collected now: already taken once, ever, or this is a duel street. */
  coinTaken = false;
  /** Kora Coins the last solo goal paid (first clear and new stars), shown on the result card. */
  goalCoins = 0;
  /** CLUB LEVEL on the goal card: the XP this goal was worth, the levels it reached, and the coins those paid. */
  goalXp = 0;
  clubLevels: LevelReward[] = [];
  clubCoins = 0;
  /** STREET LEAGUE: the LP this goal earned, for the goal card. */
  goalLp = 0;
  /** BONUS OBJECTIVE: the match's objective, whether this goal met it, and the coins it paid (once). */
  goalBonus: { id: BonusId; met: boolean; coins: number } | null = null;
  /** Seconds the NEXT MATCH ring has filled on a first clear, or -1 when it is not running. */
  advanceT = -1;
  /** WORLDS: the world a boss match has just completed, whose panel is due after the celebration. */
  pendingWorld: WorldInfo | null = null;
  /** FRENZY: the run in progress, or null on the campaign. */
  frenzy: FrenzyRun | null = null;
  /** The last solo goal was the level's first clear, and its coins have been doubled by an ad. */
  private goalFirstClear = false;
  private goalDoubled = false;
  /** Misses on this houma since it loaded or was last scored: the "stuck" offer counts them. */
  private missStreak = 0;
  private stuckAnnounced = false;
  /** Stars missing for the next ball, as of the last solo goal (the result card shows it). */
  ballGap: number | null = null;
  readonly duel: DuelController;
  readonly abilities: AbilityBar;
  readonly kickControls: KickControls;
  readonly guideCard: GuideCard;
  /** The lesson has set the controls for the player after missed shots. */
  private guideAssisted = false;
  /** An ability lesson: the boost on the ball is the lesson's own, free, and put back after every shot. */
  private lessonBoost = false;
  /** The ghost's two flights for an ability lesson: the shot without the ability, then with it. */
  abilityDemo: { boost: Boost; plain: Trace; boosted: Trace } | null = null;
  private guideKey = '';
  /** How the next solo shot is struck: along the ground or lofted, and how much it bends (-1 to 1). */
  /** The free-kick choices: GROUND or AIR, and the bend. */
  readonly kick: { type: ShotType; bend: number } = { type: 'ground', bend: 0 };
  private replay: Replay | null = null;

  private path = new ShotPath();
  private readonly overlay: Overlay;
  private accumulator = 0;
  private stillFor = 0;
  private flightFor = 0;
  private pathTick = 0;
  private buttonsUp = false;
  /** Set once per shot as the ball closes on the goal mouth: starts the goal-cam slow motion. */
  private goalCine = false;
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
    this.placeCoin(this.level);
    const { ballStart } = this.level.def;
    this.ball = new Ball(ballStart.x, ballStart.y);
    this.preview = new TrajectoryPreview(this.ball.radius);
    this.guidePreview = new TrajectoryPreview(this.ball.radius);

    this.renderer = new Renderer(canvas, this.camera);
    this.frameCamera();
    this.input = new InputManager(canvas);
    this.input.onGesture = () => this.audio.unlock();
    this.audio.muted = this.save.data.muted;
    this.audio.setVolumes(this.save.data.sound, this.save.data.music);
    // CrazyGames' own mute switch takes priority over the player's in-game toggle.
    portal.watchMute((muted) => this.audio.setPlatformMuted(muted));
    this.audio.loadSheet(sfxUrl, sfxIndex);
    // Crowd cheering as background music (loops on the music bus).
    this.audio.loadMusic(bgMusicUrl);
    // New recordings replace the old sheet sounds (clips take priority in AudioManager.play).
    this.audio.loadClip('goal', goalSfxUrl);
    this.audio.loadClip('meow', funnyMeowSfxUrl);
    this.audio.loadClip('click', clickSfxUrl);
    this.audio.loadClip('drop', dropSfxUrl);
    this.audio.loadClip('glass_tap', glassTapSfxUrl);
    this.audio.loadClip('glass_break', glassBreakSfxUrl);
    this.audio.loadClip('metal', metalSfxUrl);
    this.audio.loadClip('plank', plankSfxUrl);
    this.audio.loadClip('stone', stoneSfxUrl);
    this.audio.loadClip('tin', tinSfxUrl);
    this.audio.loadClip('whistle', whistleSfxUrl);
    this.audio.loadClip('wood', woodSfxUrl);
    // Ability (boost) sounds.
    this.audio.loadClip('boost_fire', fireAbilitySfxUrl);
    this.audio.loadClip('boost_magnet', magnetAbilitySfxUrl);
    this.audio.loadClip('boost_rubber', rubberAbilitySfxUrl);
    this.audio.loadClip('power_up', powerUpSfxUrl);
    this.audio.loadClip('kick_ball', kickBallSfxUrl);
    setUiClick(() => this.sounds.click());
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.camera.shakeScale = 0.3;
      this.particles.reduced = true;
      this.juice.reduced = true;
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
      skins: () => {
        const total = this.totalStars();
        return SKINS.map((s) => ({ ...s, open: ballIsOpen(s, total, this.save.data.grantedSkins), selected: s.id === this.skin.id }));
      },
      pickSkin: (id) => this.useSkin(id),
      skinsSeen: () => this.markBallsSeen(),
      stars: () => ({ n: this.totalStars(), max: this.maxStars() }),
      menuInfo: () => this.menuInfo(),
      claimSeasonPrize: () => this.claimSeasonPrize(),
      frenzy: () => this.startFrenzy(),
      store: () => this.storeInfo(),
      buyUpgrade: (id) => this.buyUpgrade(id),
      buyAbilities: (id, count) => this.buyAbilities(id, count),
      resetProgress: () => this.resetProgress(),
      levels: () => this.openLevels(),
      select: (index) => this.selectLevel(index),
      closeLevels: () => this.closeLevels(),
      next: () => this.nextLevel(),
      double: () => this.doubleCoins(),
      retry: () => this.resetShot(),
      duel: () => this.duel.open(),
    });
    this.overlay.showMenu();
    this.abilities = new AbilityBar({
      wallet: () => this.save.data.coins,
      armed: () => this.armedBoost,
      free: () => this.save.data.freeBoosts,
      stuck: () => this.stuckOffer(),
      claimStuck: () => this.claimStuck(),
      canShow: () => this.shopVisible(),
      buy: (id) => this.buyAbility(id),
    });
    this.kickControls = new KickControls({
      visible: () => this.kickVisible(),
      parts: () => this.kickParts(),
      hint: () => this.guideNeedNow(),
      type: () => this.kick.type,
      bend: () => this.kick.bend,
      setType: (type) => {
        this.kick.type = type;
        this.sounds.ui();
      },
      setBend: (bend) => {
        this.kick.bend = snapBend(bend);
      },
      tick: () => this.sounds.ui(),
    });
    this.guideCard = new GuideCard({ info: () => this.guideInfo(), skip: () => this.skipTutorial() });
    this.overlay.addFloating(this.abilities.walletEl, this.abilities.el, this.kickControls.el, this.guideCard.el);
    this.duel = new DuelController(this, this.overlay, canvas.parentElement ?? document.body);

    wireFeedback(this);
    wireAnalytics(this.events, analytics);
    this.loop = new GameLoop(
      (dt) => this.frame(dt),
      () => this.renderer.render(this),
    );
    new ResizeObserver(() => this.renderer.resize()).observe(canvas);
    this.renderer.resize();
    // A hidden tab is a break: freeze play wherever it is, in every build.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.paused && this.state !== 'menu' && (this.state === 'ready' || this.state === 'aiming' || this.state === 'flight' || this.state === 'replay')) {
        // The CrazyGames SDK already tracks focus loss on its own; this pause is ours alone to report.
        this.setPaused(true, false);
      }
    });
    window.addEventListener('pagehide', () => {
      // A reload is imminent; skip the pause card and land back in the level instead.
      this.remember(this.sessionScreen === 'pause' ? 'game' : this.sessionScreen);
    });
    this.restoreSession();
  }

  start(): void {
    this.loop.start();
  }

  /** Remembers the screen on the way out, so a reload brings the player back to it. */
  private remember(screen: SessionScreen): void {
    const level = this.level?.index ?? 0;
    this.sessionScreen = screen;
    // A duel alley has no number; a reload lands back on the solo houma instead.
    saveSession({ screen: level < 0 ? 'menu' : screen, level: Math.max(0, level) });
  }

  /**
   * A reload starts the page again; bring the player back to the alley they were on
   * (or the houma list) instead of dumping them on the title card. Fresh visits
   * carry no per-tab session, so they still land on the menu.
   */
  private restoreSession(): void {
    const snapshot = loadSession();
    if (!snapshot || snapshot.screen === 'menu') {
      this.remember('menu');
      return;
    }
    if (snapshot.screen === 'levels') {
      this.openLevels();
      return;
    }
    const { level } = snapshot;
    if (level >= this.levels.length || !this.isUnlocked(level)) {
      this.remember('menu');
      return;
    }
    // 'game' and 'pause' both land back in the level; the reload already lost the in-flight shot.
    this.sessionScreen = 'game';
    this.overlay.hide();
    this.loadLevel(level);
    portal.gameplayStart();
    this.abilities.refresh(BOOST_COSTS);
    this.remember('game');
    this.onLevelEntered();
  }

  /** Chooses a ball (from the balls screen or the new-ball toast). */
  useSkin(id: string): void {
    this.skin = skinOf(id);
    this.save.data.skin = this.skin.id;
    this.save.save();
    this.sounds.ui();
  }

  /** Balls that are open (by stars or a club grant) and have not been shown to the player yet. */
  private unseenBalls() {
    const total = this.totalStars();
    return SKINS.filter((s) => s.need > 0 && ballIsOpen(s, total, this.save.data.grantedSkins) && !this.save.data.seenSkins.includes(s.id));
  }

  /** The balls screen was opened: every ball earned so far counts as seen, so the NEW dot goes. */
  private markBallsSeen(): void {
    const open = this.unseenBalls();
    if (open.length === 0) return;
    for (const s of open) this.save.data.seenSkins.push(s.id);
    this.save.save();
    this.overlay.refreshMenu();
  }

  /**
   * A toast for the newest ball the player has earned and not been told about, once per ball: after a
   * result card, or on the menu after a Free Kicks stage. The NEW dot on BALLS stays until the balls screen opens.
   */
  private offerBallToast(): void {
    const tips = this.save.data.tips;
    const fresh = this.unseenBalls().filter((s) => !tips.includes(`ball:${s.id}`));
    if (fresh.length === 0) return;
    for (const s of fresh) tips.push(`ball:${s.id}`);
    this.save.save();
    const newest = fresh[fresh.length - 1];
    this.overlay.showToast(tr('NEW BALL: {name}', { name: tr(newest.name) }), tr('USE IT'), () => this.useSkin(newest.id));
  }

  /** Stars still missing for the next ball (for the result card), or null. */
  starsToNextBall(): number | null {
    return starsToNextSkin(this.totalStars(), SKINS.filter((s) => !this.save.data.grantedSkins.includes(s.id)));
  }

  /** Stars won in the houmas alone: what opens chapters. */
  classicStars(): number {
    return totalStars(this.save.data);
  }

  /** Every star in the career: what opens balls. */
  totalStars(): number {
    return totalStars(this.save.data);
  }

  /** The most stars there are to win right now. */
  maxStars(): number {
    // Stars from older, retired stadiums still count, so the total never shows more earned than there is.
    return Math.max(this.levels.length * 3, this.totalStars());
  }

  refreshMenu(): void {
    this.overlay.refreshMenu();
    if (this.state === 'menu' && this.overlay.menuVisible()) this.offerBallToast();
  }

  /** What the main menu draws: where Continue goes, the wallet, the stars. */
  private menuInfo(): MenuInfo {
    this.openLeagueWeek();
    const at = this.furthestUnlocked();
    return {
      stars: { n: this.totalStars(), max: this.maxStars() },
      coins: this.save.data.coins,
      continueNumber: matchInfo(this.levels, at)[matchInfo(this.levels, at).lesson ? 'lesson' : 'match'] ?? at + 1,
      lesson: matchInfo(this.levels, at).lesson !== null,
      continueName: this.levels[at]?.name ?? '',
      newBall: this.unseenBalls().length > 0,
      club: { level: this.save.data.club.level, xp: this.save.data.club.xp, need: xpToNext(this.save.data.club.level) },
      league: this.leagueInfo(),
      frenzy: { unlocked: frenzyUnlocked((id) => this.save.data.levels[id]?.goals ?? 0), best: this.save.data.frenzyBest },
    };
  }

  /**
   * Erases every record and every reward the player has earned, then puts them back on the title card.
   * Sound, music, mute and language are kept: those are preferences, not progress.
   */
  resetProgress(): void {
    // Drop an armed boost first, so nothing is refunded into the wiped wallet.
    this.armedBoost = null;
    this.armedFree = false;
    this.tip = null;
    const data = this.save.data;
    data.levels = {};
    data.coins = 0;
    data.skin = 'tex-hex';
    data.upgrades = noUpgrades();
    data.freeBoosts = {};
    data.boostIntro = false;
    data.tips = [];
    data.seenSkins = [];
    data.club = { ...CLUB_START };
    data.grantedSkins = [];
    data.league = freshLeague(new Date());
    data.worlds = [];
    this.pendingWorld = null;
    data.frenzyBest = 0;
    this.frenzy = null;
    this.skin = skinOf('tex-hex');
    this.save.save();
    // Back to the title card, not into a match: a live match under the menu leaves the in-match controls
    // drawn over it, and nothing can start a shot from there. returnToMenu() also shows the menu.
    this.returnToMenu();
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
    return isLevelUnlocked(this.save.data, this.levels, index);
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
    // Solo: the level is fitted between a strip for the coach card and the coins above it and a strip for the
    // controls below it, so nothing on a phone is drawn over the pitch. A duel keeps its own framing.
    const solo = this.shotRule === 'free';
    this.camera.setFrames(
      // Wide screens: solo play frames just the pitch, the goal net above it and the near boards below, so the
      // pitch fills the height of a desktop window; the controls and the score live in the room either side.
      solo ? { cx, cy: arena.y - 100 + (arena.h + 150) / 2, w: arena.w + 560, h: arena.h + 150 } : { cx, cy: arena.y - 170 + (arena.h + 244) / 2, w: arena.w + 660, h: arena.h + 244 },
      // The frame is the pitch with the goal net above it and the near boards below, nothing more.
      solo ? { cx, cy: arena.y - 95 + (arena.h + 120) / 2, w: arena.w + 110, h: arena.h + 120 } : { cx, cy: arena.y - 390 + tall / 2, w: arena.w + 110, h: tall },
      solo ? (height) => ({ top: Math.max(100, height * 0.15), bottom: Math.max(158, height * 0.24) }) : undefined,
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
    this.armedFree = false;
    this.tip = null;
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
    // A paid boost never vanishes into a loading screen: hand the coins (or the free charge) back.
    if (this.armedBoost) {
      this.disarm();
      this.save.save();
    }
    this.shotRule = 'free';
    this.onShotEnd = null;
    this.clearDuelState();
    this.duelScore = null;
    this.duelLook = null;
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
    this.install(new Level(def, -1), freshLevelRecord());
  }

  private install(level: Level, record: LevelRecord): void {
    // A new stadium: whatever was still ringing from the last one stops, and its crowd starts over.
    this.audio.stopEffects();
    this.audio.restartMusic();
    this.paused = false;
    this.level = level;
    this.net = new GoalNet(this.level.goal);
    this.record = record;
    this.placeCoin(level);
    this.missStreak = 0;
    this.stuckAnnounced = false;
    this.shotTaken = false;
    this.lastScore = 0;
    this.lastPath.clear();
    this.path.clear();
    this.popups.clear();
    this.juice.reset();
    this.goalCine = false;
    this.frameCamera();
    this.renderer.invalidate();
    this.state = 'ready';
    // A lesson starts from a plain ground shot, so that switching the move on is the lesson.
    this.guideAssisted = false;
    this.guideKey = '';
    this.buildDemo();
    if (this.guideDef()) {
      this.kick.type = 'ground';
      this.kick.bend = 0;
    }
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

  /** An ability lesson puts its boost on the ball for every shot, for free. */
  private armLesson(): void {
    const boost = this.guideDef()?.boost;
    if (!boost || this.armedBoost) return;
    this.armedBoost = boost;
    this.armedFree = true;
    this.lessonBoost = true;
  }

  /** The ghost's two flights for the ability lesson on screen: the same shot without the ability, then with it. */
  private buildDemo(): void {
    const def = this.level.def.guide;
    if (!def?.boost) {
      this.abilityDemo = null;
      return;
    }
    const s = def.show;
    const plain = traceShot(this.level.def, this.level.index, s.angle, s.power, { air: s.air, bend: s.bend });
    const boosted = traceShot(this.level.def, this.level.index, s.angle, s.power, { air: s.air, bend: s.bend, boost: def.boost });
    this.abilityDemo = { boost: def.boost, plain, boosted };
  }

  /** The lesson this level teaches, while it is still the first time through (solo play only). */
  guideDef(): GuideDef | null {
    const def = this.level.def.guide;
    return def && this.shotRule === 'free' && this.record.goals === 0 ? def : null;
  }

  private guideNeedNow(): GuideNeed {
    const def = this.guideDef();
    return def ? guideNeed(def, this.kick) : null;
  }

  /** What the coach card shows, or null while something else is over the screen. */
  private guideInfo(): GuideInfo | null {
    const def = this.guideDef();
    if (!def || !this.controlsAllowed() || this.duel.active) return null;
    if (this.state === 'menu' || this.state === 'goal' || this.state === 'replay') return null;
    const series = def.series ?? 'tutorial';
    const lessons = this.levels.filter((l) => l.guide && (l.guide.series ?? 'tutorial') === series);
    return {
      move: def.move,
      step: lessons.indexOf(this.level.def) + 1,
      total: lessons.length,
      need: this.guideNeedNow(),
      boost: def.boost,
      skippable: matchInfo(this.levels, this.level.index).lesson !== null,
    };
  }

  /**
   * Skips the tutorial: every lesson counts as played (a goal and one star, so the stars are still there to
   * win) and the first real match starts. The lessons stay in the stadium list for anyone who wants them.
   */
  private skipTutorial(): void {
    let first = -1;
    this.levels.forEach((def, i) => {
      if (matchInfo(this.levels, i).lesson === null) {
        if (first < 0) first = i;
        return;
      }
      const rec = this.save.level(def.id);
      if (rec.goals === 0) rec.goals = 1;
      // A skipped lesson counts as won with one star. It is marked as paid, so that star never pays coins later.
      rec.stars = Math.max(rec.stars, 1);
      rec.paidStars = Math.max(rec.paidStars, 1);
    });
    if (first < 0) return;
    this.save.save();
    this.sounds.ui();
    this.loadLevel(first);
  }

  /** The shot the ghost hand and the dotted path show right now, or null (nothing to show yet, or the player is on their own). */
  guideGhost(): { angle: number; power: number } | null {
    const def = this.guideDef();
    if (!def || this.guideNeedNow() !== null) return null;
    // The last lesson lets the player choose; it only shows a shot once it has had to help.
    if (def.move === 'free' && !this.guideAssisted) return null;
    const s = guideShot(def, this.kick);
    return { angle: s.angle, power: s.power };
  }

  /** Lesson housekeeping, once a frame: help after misses, and keep the dotted path in step with the controls. */
  private updateGuide(): void {
    const def = this.guideDef();
    if (!def) {
      this.guideKey = '';
      return;
    }
    if (!this.guideAssisted && this.missStreak >= GUIDE_ASSIST_MISSES && (this.guideNeedNow() !== null || def.move === 'free')) {
      const a = guideAssist(def);
      this.kick.type = a.type;
      this.kick.bend = a.bend;
      this.guideAssisted = true;
      this.sounds.ui();
    }
    const ghost = this.guideGhost();
    // An ability lesson shows the ghost's two flights instead of the dotted path.
    if (!ghost || this.state !== 'ready' || def.boost) return;
    const key = `${this.level.index}|${this.kick.type}|${this.kick.bend}|${ghost.angle}|${ghost.power}`;
    if (key === this.guideKey) return;
    this.guideKey = key;
    const s = guideShot(def, this.kick);
    const a = (s.angle * Math.PI) / 180;
    const speed = s.air ? airSpeed(s.power) : speedForPower(s.power);
    this.guidePreview.compute(this.level, this.ball.body, Math.cos(a), Math.sin(a), speed, s.power, null, { air: s.air, bend: s.bend }, true);
  }

  /** Which free-kick controls to show: a lesson shows only the one it teaches. */
  kickParts(): { air: boolean; bend: boolean } {
    return this.guideDef()?.controls ?? { air: true, bend: true };
  }

  /** The free-kick controls: solo play, ball waiting or being aimed, nothing over the screen. */
  /**
   * The in-match controls (the kick, the abilities and their coin pill, the pause button, the coach card) show
   * only in a match with nothing over it: a match state, not paused, and no screen of the overlay up (menu,
   * stadiums, balls, store, settings, pause, league, world, run over).
   */
  controlsAllowed(): boolean {
    return this.state !== 'menu' && !this.paused && !this.overlay.open;
  }

  private kickVisible(): boolean {
    return this.controlsAllowed() && this.shotRule === 'free' && !this.duelScore && !this.duel.active && (this.state === 'ready' || this.state === 'aiming');
  }

  /** F flips between ground and air; Q and E step the bend left and right through straight and half and full. */
  private kickKeys(): void {
    const input = this.input;
    const air = input.consume('air');
    const left = input.consume('bendLeft');
    const right = input.consume('bendRight');
    if (!(air || left || right) || !this.kickVisible()) return;
    const parts = this.kickParts();
    if (air && parts.air) {
      this.kick.type = this.kick.type === 'air' ? 'ground' : 'air';
      this.sounds.ui();
    }
    if ((left || right) && parts.bend) {
      let i = 0;
      for (let k = 1; k < BEND_STEPS.length; k++) if (Math.abs(BEND_STEPS[k] - this.kick.bend) < Math.abs(BEND_STEPS[i] - this.kick.bend)) i = k;
      const next = Math.max(0, Math.min(BEND_STEPS.length - 1, i + (right ? 1 : 0) - (left ? 1 : 0)));
      this.kick.bend = BEND_STEPS[next];
      this.sounds.ui();
    }
  }

  /** What the ball shows beside it while it waits: a lift chevron when lofted, a curl arrow when bent; null when neither. */
  kickBadge(): { air: boolean; bend: number } | null {
    if (!(this.state === 'ready' || this.state === 'aiming') || this.paused || !this.kickVisible()) return null;
    const parts = this.kickParts();
    const air = parts.air && this.kick.type === 'air';
    const bend = parts.bend ? this.kick.bend : 0;
    return air || bend !== 0 ? { air, bend } : null;
  }

  /** The speed of a shot: a lofted one uses its own, gentler range. The store's POWER makes either quicker. */
  private kickSpeed(groundSpeed: number, power: number): number {
    const base = this.currentKick().air ? airSpeed(power) : groundSpeed;
    return base * (this.upgraded() ? powerScale(this.save.data.upgrades.power) : 1);
  }

  /** How a solo shot is struck; duels play with a plain ground ball. The store's CURL bends it further. */
  private currentKick(): { air: boolean; bend: number } {
    if (this.shotRule !== 'free') return { air: false, bend: 0 };
    const curl = this.upgraded() ? curlScale(this.save.data.upgrades.curl) : 1;
    return { air: this.kick.type === 'air', bend: this.kick.bend * curl };
  }

  /**
   * Store upgrades count in the campaign only: a tutorial lesson shows its shot with a ghost, and that
   * shot has to land for the player exactly as it does for the ghost.
   */
  private upgraded(): boolean {
    return this.shotRule === 'free' && !this.level.def.guide && !this.duel.active;
  }

  /** Everything the store screen shows. */
  private storeInfo(): StoreInfo {
    const ups = this.save.data.upgrades;
    return {
      coins: this.save.data.coins,
      upgrades: UPGRADES.map((u) => ({ id: u.id, name: u.name, hint: u.hint, level: ups[u.id], price: nextPrice(u.id, ups[u.id]) })),
      abilities: (['fire', 'magnet', 'rubber'] as const).map((id) => ({ id, owned: this.save.data.freeBoosts[id] ?? 0, single: abilityPrice(id, 1), pack: abilityPrice(id, 5) })),
    };
  }

  /** Buys the next level of a shot upgrade. False when it is maxed or the coins are short. */
  private buyUpgrade(id: UpgradeId): boolean {
    const price = nextPrice(id, this.save.data.upgrades[id]);
    if (price === null || this.save.data.coins < price) return false;
    this.save.data.coins -= price;
    this.save.data.upgrades[id] += 1;
    this.save.save();
    this.audio.play('power_up', { gain: 0.8 });
    this.overlay.refreshMenu();
    return true;
  }

  /** Buys ability charges for later: they sit in the column as owned and are used before any coins. */
  private buyAbilities(id: Boost, count: number): boolean {
    const price = abilityPrice(id, count);
    if (this.save.data.coins < price) return false;
    this.save.data.coins -= price;
    this.save.data.freeBoosts[id] = (this.save.data.freeBoosts[id] ?? 0) + count;
    this.save.save();
    this.audio.play(`boost_${id}`, { gain: 0.9 });
    this.overlay.refreshMenu();
    this.abilities.refresh(BOOST_COSTS);
    return true;
  }

  /** The solo ability shop is for free play only, while the ball waits to be struck. */
  private shopVisible(): boolean {
    return (
      this.controlsAllowed() &&
      this.shotRule === 'free' &&
      // The boost column is introduced at houma 6; before that it would only be clutter.
      this.save.data.boostIntro &&
      // An ability lesson has its boost already on the ball.
      !this.guideDef()?.boost &&
      !this.duelScore &&
      !this.duel.active &&
      !this.paused &&
      (this.state === 'ready' || this.state === 'aiming')
    );
  }

  /** Takes an armed boost back off: a paid one returns its coins, a free one its charge. */
  private disarm(): void {
    const id = this.armedBoost;
    if (!id) return;
    // A lesson's boost belongs to the lesson: nothing to refund.
    if (this.lessonBoost) {
      this.armedBoost = null;
      this.armedFree = false;
      this.lessonBoost = false;
      return;
    }
    if (this.armedFree) this.save.data.freeBoosts[id] = (this.save.data.freeBoosts[id] ?? 0) + 1;
    else this.save.data.coins += BOOST_COSTS[id];
    this.armedBoost = null;
    this.armedFree = false;
  }

  /** Arms a boost for the next shot (a free charge first, else coins), or takes it back off for a refund. */
  buyAbility(id: Boost): void {
    if (!this.shopVisible()) return;
    this.audio.unlock();
    if (this.armedBoost === id) {
      this.disarm();
      this.save.save();
      this.sounds.card(false);
      return;
    }
    const free = this.save.data.freeBoosts[id] ?? 0;
    const spare = this.armedBoost && !this.armedFree ? BOOST_COSTS[this.armedBoost] : 0;
    if (free <= 0 && this.save.data.coins + spare < BOOST_COSTS[id]) return;
    this.disarm();
    if (free > 0) {
      if (free === 1) delete this.save.data.freeBoosts[id];
      else this.save.data.freeBoosts[id] = free - 1;
      this.armedFree = true;
    } else {
      this.save.data.coins -= BOOST_COSTS[id];
    }
    this.armedBoost = id;
    this.save.save();
    this.audio.play(`boost_${id}`, { gain: 1 });
  }

  /** Shows a tip once ever (kept in the save) and holds it over the street until the next shot. */
  offerTip(key: TipKey, text: string): void {
    if (this.save.data.tips.includes(key)) return;
    this.save.data.tips.push(key);
    this.save.save();
    this.tip = { key, text };
  }

  /**
   * Things that happen the first time a player arrives on a level: the shop opens, with one free MAGNET, once the
   * ability lessons are behind them.
   */
  private onLevelEntered(): void {
    if (this.shotRule !== 'free' || this.level.index < 0 || this.paused) return;
    this.events.emit('LEVEL_STARTED', { level: this.level.index + 1, chapter: chapterOf(this.level.index) });
    if (this.level.index >= BOOST_INTRO_LEVEL && !this.save.data.boostIntro) {
      // The lessons have shown what each ability does: the shop opens, with one MAGNET on the house.
      this.save.data.boostIntro = true;
      this.save.data.freeBoosts.magnet = (this.save.data.freeBoosts.magnet ?? 0) + BOOST_INTRO_FREE_MAGNETS;
      this.save.save();
      this.abilities.refresh(BOOST_COSTS);
    }
  }

  /**
   * The crowd plays only inside a match. On the title card, the stadium list and the balls
   * screen it fades out, and every effect still ringing (a goal cheer) is cut; back in a match it
   * starts again from the top.
   */
  private syncSoundScene(): void {
    const inMatch = this.state !== 'menu' && !this.overlay.inMenus;
    if (inMatch === this.soundInMatch) return;
    this.soundInMatch = inMatch;
    if (!inMatch) this.audio.stopEffects();
    this.audio.setMusicOn(inMatch);
  }

  /** Back to the title card, on the furthest solo houma reached. */
  returnToMenu(): void {
    portal.gameplayStop();
    this.frenzy = null;
    // Silence first, so loading the menu's backdrop stadium does not start its crowd for a moment.
    this.soundInMatch = false;
    this.audio.setMusicOn(false);
    this.audio.stopEffects();
    this.loadLevel(this.furthestUnlocked());
    this.state = 'menu';
    this.overlay.showMenu();
    this.remember('menu');
  }

  /** Leaves the title card. */
  play(): void {
    if (this.state !== 'menu') {
      // Only ever a stuck menu over a live match. Put the game back on the title card first, so LET'S PLAY
      // always starts a lesson instead of doing nothing. Anything else (a match with no menu) stays as it is.
      if (!this.overlay.menuVisible()) return;
      this.returnToMenu();
    }
    this.audio.unlock();
    this.sounds.ui();
    this.overlay.hide();
    this.state = 'ready';
    this.stateT = 0;
    this.ball.reset(this.level.def.ballStart.x, this.level.def.ballStart.y);
    portal.gameplayStart();
    this.remember('game');
    this.onLevelEntered();
  }

  /**
   * `reportToPortal` is false only for a pause the tab's own visibility forced: the CrazyGames SDK
   * handles a hidden tab itself and asks games not to call gameplayStop for it, only for a pause
   * the player actually asked for.
   */
  setPaused(paused: boolean, reportToPortal = true): void {
    if (this.state === 'menu' || paused === this.paused) return;
    this.paused = paused;
    if (paused) {
      // Pause stops the countdown to the next match.
      this.advanceT = -1;
      if (this.state === 'aiming') this.cancelAim();
      if (reportToPortal) portal.gameplayStop();
      if (this.duel.active) this.duel.showPause();
      else {
        this.overlay.showPause();
        this.overlay.setReward(this.rewardOffer());
      }
      this.remember('pause');
    } else {
      this.overlay.hide();
      this.syncButtons(true);
      portal.gameplayStart();
      this.remember('game');
    }
    this.abilities.refresh(BOOST_COSTS);
  }

  /** The rewarded offers share one rule: a live ad path, solo play, and the cooldown over. */
  private rewardReady(): boolean {
    return portal.ads && !this.duel.active && this.shotRule === 'free' && portal.rewardCooldown() <= 0;
  }

  /** "STUCK? FREE MAGNET": after four misses on a houma, while the ball waits and the boost column is up. */
  private stuckOffer(): boolean {
    const due = this.missStreak >= STUCK_MISSES && this.state === 'ready' && this.rewardReady();
    // Tell analytics once per offer, when the chip first shows.
    if (due && !this.stuckAnnounced) {
      this.stuckAnnounced = true;
      this.events.emit('AD_OFFERED', { kind: 'stuck' });
    }
    return due;
  }

  private claimStuck(): void {
    if (!this.stuckOffer()) return;
    portal.rewarded(
      this,
      () => {
        this.save.data.freeBoosts.magnet = (this.save.data.freeBoosts.magnet ?? 0) + 1;
        this.missStreak = 0;
        this.stuckAnnounced = false;
        this.save.save();
        this.sounds.card(true);
        this.abilities.refresh(BOOST_COSTS);
      },
      (granted) => this.events.emit('AD_DONE', { kind: 'stuck', granted }),
    );
  }

  /** "x2 COINS" on the result card of a first clear that paid coins, once. */
  private doubleOffer(): boolean {
    return this.goalFirstClear && !this.goalDoubled && this.goalCoins > 0 && this.rewardReady();
  }

  private doubleCoins(): void {
    if (!this.doubleOffer()) return;
    portal.rewarded(
      this,
      () => {
        this.goalDoubled = true;
        this.save.data.coins += this.goalCoins;
        this.goalCoins *= 2;
        this.save.save();
        this.sounds.card(true);
        this.overlay.setDouble(false);
      },
      (granted) => this.events.emit('AD_DONE', { kind: 'double', granted }),
    );
  }

  /** A rewarded ad for coins, offered in the pause menu while one can be shown. */
  private rewardOffer(): { label: string } | null {
    if (!PAUSE_REWARD_ENABLED || !this.rewardReady()) return null;
    return { label: tr('+30 COINS') };
  }

  private watchReward(): void {
    const granted = portal.rewarded(
      this,
      () => {
        this.save.data.coins += REWARD_COINS;
        this.save.save();
        this.sounds.card(true);
        this.overlay.setReward(null);
      },
      (ok) => this.events.emit('AD_DONE', { kind: 'pause', granted: ok }),
    );
    if (!granted) {
      this.sounds.ui();
      this.overlay.setReward({ label: tr('TRY LATER') });
      window.setTimeout(() => {
        if (this.paused) this.overlay.setReward(this.rewardOffer());
      }, 1600);
    }
  }

  /** `focus` scrolls the map to that level: the first locked one when a chapter gate stopped NEXT. */
  openLevels(focus?: number): void {
    this.sounds.ui();
    if (this.state === 'aiming') this.cancelAim();
    if (this.state !== 'menu') this.paused = true;
    portal.gameplayStop();
    const gates: Record<number, { need: number; have: number; open: boolean }> = {};
    for (let c = 2; c <= 9; c++) gates[c] = gateStatus(this.save.data, this.levels, c);
    this.overlay.showLevels(
      this.levels.map((def, i) => {
        const rec = this.save.level(def.id);
        const gate = isGateBlocked(this.save.data, this.levels, i) ? gateStatus(this.save.data, this.levels, chapterOf(i)) : undefined;
        const m = matchInfo(this.levels, i);
        return { name: def.name, group: m.lesson ? 'TUTORIAL' : (def.world ?? 'OPENING SEASON'), label: m.lesson ? `1.${m.lesson}` : String(m.match).padStart(2, '0'), hint: def.hint, stars: rec.stars, best: rec.best, unlocked: this.isUnlocked(i), next: nextStarTarget(def, rec.stars) ?? undefined, gate, coin: !rec.coin, bonus: rec.bonus, boss: def.boss === true };
      }),
      this.level.index,
      focus,
      gates,
      { won: this.save.data.worlds.length, total: WORLD_COUNT },
    );
    this.abilities.refresh(BOOST_COSTS);
    this.remember('levels');
  }

  closeLevels(): void {
    if (this.state === 'menu') {
      this.overlay.showMenu();
      this.remember('menu');
      return;
    }
    this.paused = false;
    this.overlay.hide();
    this.syncButtons(true);
    this.abilities.refresh(BOOST_COSTS);
    portal.gameplayStart();
    this.remember('game');
  }

  selectLevel(index: number): void {
    if (!this.isUnlocked(index)) return;
    this.audio.unlock();
    this.sounds.ui();
    this.paused = false;
    this.overlay.hide();
    this.loadLevel(index);
    portal.gameplayStart();
    this.remember('game');
    this.onLevelEntered();
  }

  /** True when a midgame ad cannot interrupt a shot, a moving ball or a celebration still landing. */
  get adBreakAllowed(): boolean {
    if (this.state === 'goal') return this.celebration.t >= CELEBRATION_TIMING.buttonsAfter;
    return this.state === 'ready' || this.state === 'missed' || this.state === 'menu';
  }

  /** Between houmas: the portal may take a midgame break first, then the next street loads. */
  nextLevel(): void {
    this.audio.stop('goal');
    if (this.frenzy) {
      this.frenzyNextShot();
      return;
    }
    if (this.level.index + 1 >= this.levels.length) {
      this.openLevels();
      return;
    }
    const next = this.level.index + 1;
    if (!this.isUnlocked(next)) {
      // The chapter's star gate is shut: show the map at the gate instead of a locked level.
      const gate = gateStatus(this.save.data, this.levels, chapterOf(next));
      this.events.emit('LEVEL_GATE_BLOCKED', { level: next + 1, need: gate.need, have: gate.have });
      this.openLevels(next);
      return;
    }
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

  /** Called when a web font finishes loading. */
  fontsChanged(): void {
    forgetStands();
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
    if (import.meta.env.DEV && input.consume('debug')) this.debug.toggle();
    if (input.consume('mute')) this.toggleSound();
    if (input.consume('pause')) {
      // P backs out of a pull before it pauses the game.
      if (this.state === 'aiming') this.cancelAim();
      else this.setPaused(!this.paused);
    }
    this.syncSoundScene();

    if (!this.paused) {
      if (this.state === 'menu') {
        if (input.consume('confirm')) this.play();
      } else if (this.shotRule === 'single') {
        // One shot and no going back: the pointer only matters until it is taken.
        if (!this.shotTaken && this.state !== 'replay') this.handlePointer(realDt);
      } else {
        if (input.consume('restart')) this.retryShot();
        this.kickKeys();
        if (input.consume('confirm') && this.state === 'goal' && this.celebration.canRetry) this.nextLevel();
        this.handlePointer(realDt);
      }
      // The ring on NEXT MATCH fills on a first clear; when it is full, the next match starts by itself.
      if (this.advanceT >= 0) {
        this.advanceT += realDt;
        if (this.advanceT >= AUTO_ADVANCE_SECONDS) {
          this.advanceT = -1;
          this.nextLevel();
        }
      }
      this.overlay.setAdvance(this.advanceT < 0 ? -1 : this.advanceT / AUTO_ADVANCE_SECONDS);
      this.stateT += realDt;
      const dt = this.time.step(realDt);
      this.simulate(dt);
      this.updateVisuals(dt, realDt);
    }
    this.updateGuide();
    this.overlay.setControlsAllowed(this.controlsAllowed());
    this.kickControls.refresh();
    this.guideCard.refresh();
    input.endFrame();
  }

  private handlePointer(realDt: number): void {
    const p = this.input.pointer;
    if (p.pressed) {
      // A tap on the pitch after a miss is "go again": it resets and starts the next pull at once. After a goal
      // only the AGAIN and NEXT MATCH buttons act, so a tap anywhere else must not replay the match.
      if (this.state === 'missed') this.retryShot();
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
      this.preview.compute(this.level, this.ball.body, this.shot.dirX, this.shot.dirY, this.kickSpeed(this.shot.speed, this.shot.power), this.shot.power, this.armedBoost === 'magnet' ? this.magnetField : null, this.currentKick(), false, this.upgraded() ? aimScale(this.save.data.upgrades.aim) : 1);
    } else {
      this.preview.clear();
    }

    if (p.cancelled) this.cancelAim();
    else if (p.released) this.releaseShot();
  }

  private beginAim(): void {
    this.shot.begin();
    this.preview.clear();
    this.sounds.aimStart();
    this.setState('aiming');
    this.events.emit('AIM_STARTED', { x: this.ball.body.x, y: this.ball.body.y });
  }

  private cancelAim(): void {
    this.audio.stop('power_up');
    const wasArmed = this.shot.armed;
    this.shot.cancel();
    this.preview.clear();
    this.setState('ready');
    if (wasArmed) this.events.emit('AIM_CANCELLED', { x: this.ball.body.x, y: this.ball.body.y });
  }

  private releaseShot(): void {
    this.audio.stop('power_up');
    const b = this.ball.body;
    const shot = this.shot.release(b.x, b.y);
    this.preview.clear();
    if (shot) this.launch(shot);
    else this.setState('ready');
  }

  private launch(shot: Shot): void {
    const b = this.ball.body;
    const speed = this.kickSpeed(shot.speed, shot.power);
    b.vx = shot.dirX * speed;
    b.vy = shot.dirY * speed;
    b.angVel = shot.spin;
    const kick = this.currentKick();
    b.z = kick.air ? 0.01 : 0;
    b.vz = kick.air ? launchVz(shot.power) : 0;
    b.bend = kick.bend;
    b.turned = 0;
    this.ball.stretch(shot.dirX, shot.dirY, 0.1 + 0.2 * shot.power);
    if (this.armedBoost && this.shotRule === 'free' && !this.lessonBoost) this.events.emit('BOOST_USED', { boost: this.armedBoost, free: this.armedFree });
    this.level.arm(this.armedBoost, b);
    this.flightBoost = this.armedBoost;
    this.armedBoost = null;
    this.armedFree = false;
    this.lessonBoost = false;
    this.tip = null;
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
    this.goalCine = false;
    if (!this.frenzy) this.record.attempts++;
    this.save.save();
    this.setState('flight');
    this.events.emit('BALL_LAUNCHED', { x: b.x, y: b.y, dirX: shot.dirX, dirY: shot.dirY, power: shot.power, speed });
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
    // A coin punched out of the air: the wallet grows, the CRAZY SCORE stays pure.
    if (!this.coinTaken) {
      const dx = ball.body.x - this.coinX;
      const dy = ball.body.y - this.coinY;
      if (dx * dx + dy * dy < 36 * 36) this.collectCoin();
    }
    if (++this.pathTick >= PATH_EVERY) {
      this.pathTick = 0;
      this.path.push(ball.body.x, ball.body.y, this.keeperX());
    }
    // The last stretch before the mouth plays out in slow motion: the shot already has its
    // trajectory, so this only stretches the drama, it never changes where the ball goes.
    if (!this.goalCine && ball.body.vy < -80 && goal.distanceToMouth(ball.body.x, ball.body.y) < 200) {
      this.goalCine = true;
      this.time.slowMo(0.45, 0.34);
      this.camera.zoomTo(goal.cx, goal.lineY + 50, 0.42);
      this.juice.approach();
    }
    if (goal.contains(ball.body.x, ball.body.y)) {
      // A lofted ball above the crossbar goes over, not in.
      if (ball.body.z > KICK.barZ) this.missShot('over');
      else this.scoreGoal();
    } else if ((ball.speed < STILL_SPEED && ball.body.z <= 0) || this.flightFor > MAX_FLIGHT) {
      this.stillFor += FIXED_DT;
      if (this.stillFor >= STILL_SECONDS) this.missShot();
    } else {
      this.stillFor = 0;
    }
  }

  private keeperX(): number {
    return this.level.keeper ? this.level.keeper.body.x : NaN;
  }

  /** Strings the alley's coin along the natural ball-to-goal line, clear of static geometry. */
  private placeCoin(level: Level): void {
    this.coinTaken = this.coinSpent();
    this.coinX = level.coin.x;
    this.coinY = level.coin.y;
  }

  /** The alley's coin is drawn only on solo streets: a duel street has none. */
  get coinVisible(): boolean {
    return this.shotRule === 'free' && this.level.index >= 0;
  }

  /** True when the coin pays nothing: a duel street, or the one coin this alley has was already taken. */
  private coinSpent(): boolean {
    return !this.coinVisible || this.record.coin;
  }

  /** A coin punched out of mid-flight: it pays once per level, ever; the score stays pure. */
  private collectCoin(): void {
    this.coinTaken = true;
    this.record.coin = true;
    this.save.data.coins += LEVEL_COIN_VALUE;
    this.save.save();
    this.events.emit('COIN_SNATCHED', { x: this.coinX, y: this.coinY });
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

  /** STREET LEAGUE: a solo goal earns LP for the week's table, up to the daily cap for its match. */
  private awardLeague(newStars: number): void {
    this.openLeagueWeek();
    const r = addLeagueLp(this.save.data.league, new Date(), this.level.def.id, lpForGoal(newStars));
    this.save.data.league = r.league;
    this.goalLp = r.gained;
  }

  /** STREET LEAGUE: when the week has changed, ends the last season and pays any prize nobody claimed. */
  private openLeagueWeek(): void {
    const s = settleLeague(this.save.data.league, new Date());
    if (s.league === this.save.data.league) return;
    this.save.data.league = s.league;
    this.save.data.coins += s.coins;
    this.save.save();
  }

  /** STREET LEAGUE: the table for today, the prizes, the trophies, and the last season's result while its prize is unclaimed. */
  private leagueInfo(): LeagueInfo {
    const league = this.save.data.league;
    const clock = seasonClock(new Date());
    return {
      division: league.division,
      daysLeft: clock.daysLeft,
      rows: standings(league, clock.dayIndex),
      prizes: [1, 2, 3].map((position) => ({ position, ...prizeFor(position) })),
      trophies: league.trophies,
      pending: pendingResult(league),
    };
  }

  /** CLAIM on the season result card: pays that season's prize, once. */
  private claimSeasonPrize(): void {
    const c = claimPrize(this.save.data.league);
    this.save.data.league = c.league;
    this.save.data.coins += c.coins;
    this.save.save();
  }

  /** FRENZY: an endless run of random cleared matches, one shot each, with three lives. */
  startFrenzy(): void {
    if (!frenzyUnlocked((id) => this.save.data.levels[id]?.goals ?? 0)) return;
    this.audio.unlock();
    this.sounds.ui();
    this.overlay.hide();
    this.paused = false;
    this.frenzy = newFrenzyRun();
    portal.gameplayStart();
    this.remember('game');
    this.frenzyNextShot();
  }

  /** The next match of the run, picked at random from the matches already cleared, ready for its one shot. */
  private frenzyNextShot(): void {
    const run = this.frenzy;
    if (!run || run.over) return;
    const cleared = this.levels
      .map((_, i) => i)
      .filter((i) => matchInfo(this.levels, i).lesson === null && (this.save.data.levels[this.levels[i].id]?.goals ?? 0) > 0);
    const pool = frenzyPool(cleared, (i) => chapterOf(i), run.goals);
    if (pool.length === 0) return;
    const index = pool[Math.floor(Math.random() * pool.length)];
    this.overlay.hide();
    this.loadLevel(index);
  }

  /** A goal in a run: the streak, the score, two coins, a bonus life every five goals, and the best streak kept. */
  private frenzyScored(total: number): void {
    const run = this.frenzy;
    if (!run) return;
    run.goals++;
    run.streak++;
    run.bestStreak = Math.max(run.bestStreak, run.streak);
    run.score += total;
    run.lives = livesAfterGoal(run.lives, run.goals);
    run.coins += FRENZY_COIN_PER_GOAL;
    this.goalCoins = FRENZY_COIN_PER_GOAL;
    this.save.data.coins += FRENZY_COIN_PER_GOAL;
    if (run.streak > this.save.data.frenzyBest) this.save.data.frenzyBest = run.streak;
  }

  /** A miss in a run: a life goes, and the streak breaks. */
  private frenzyMissed(): void {
    const run = this.frenzy;
    if (!run) return;
    run.lives--;
    run.streak = 0;
  }

  /** The missed shot is over: the next match starts while a life is left, otherwise the run ends. */
  private frenzyAdvance(): void {
    const run = this.frenzy;
    if (!run || run.over) return;
    if (run.lives <= 0) this.frenzyOver();
    else this.frenzyNextShot();
  }

  /** RUN OVER: the streak, the score, the best streak kept, and the coins the run paid. */
  private frenzyOver(): void {
    const run = this.frenzy;
    if (!run || run.over) return;
    run.over = true;
    portal.gameplayStop();
    this.save.save();
    this.overlay.showRunOver(
      { streak: run.bestStreak, score: run.score, best: this.save.data.frenzyBest, coins: run.coins, goals: run.goals },
      () => this.startFrenzy(),
      () => this.returnToMenu(),
    );
  }

  /** WORLDS: the first time a world's boss match is cleared, the world is complete: a trophy, its reward, and a panel. */
  private completeWorldIfBoss(): void {
    if (!this.level.def.boss) return;
    const world = worldOf(this.level.index);
    const data = this.save.data;
    if (data.worlds.includes(world)) return;
    data.worlds.push(world);
    data.coins += WORLD_REWARD;
    const count = this.levels.length;
    const { stars, max } = worldStars(world, count, (i) => data.levels[this.levels[i].id]?.stars ?? 0);
    const next = nextWorld(world);
    this.pendingWorld = {
      world,
      title: worldTitle(world),
      stars,
      max,
      reward: WORLD_REWARD,
      trophies: data.worlds.length,
      nextTitle: next ? worldTitle(next) : null,
      nextTheme: next ? worldThemeName(this.levels[worldRange(next, count)[0]].theme) : null,
    };
  }

  /** Adds a goal's XP to the club, and pays each level it reaches. */
  private awardClub(score: number): void {
    const data = this.save.data;
    const xp = xpForScore(score);
    const gain = gainXp(data.club, xp);
    data.club = gain.club;
    this.goalXp = xp;
    this.clubLevels = gain.levels;
    for (const reward of gain.levels) {
      this.clubCoins += reward.coins;
      if (reward.ability) data.freeBoosts[reward.ability] = (data.freeBoosts[reward.ability] ?? 0) + 1;
      if (reward.ball) {
        const next = nextLockedBall(SKINS, this.totalStars(), data.grantedSkins);
        if (next) data.grantedSkins.push(next.id);
      }
    }
    data.coins += this.clubCoins;
  }

  private scoreGoal(): void {
    const b = this.ball.body;
    const goal = this.level.goal;
    const facts = this.analyzer.finish(true, b, goal, this.level.hasKeeper);
    const card = scoreShot(facts, this.record.best, this.level.def.stars);
    const firstClear = this.record.goals === 0;
    const starsBefore = this.record.stars;
    // A FRENZY shot keeps the campaign's records, stars, coins and rewards out of it.
    const frenzy = this.frenzy !== null;
    const campaign = this.shotRule === 'free' && !frenzy;
    this.goalFirstClear = campaign && firstClear;
    this.goalDoubled = false;
    this.missStreak = 0;
    this.stuckAnnounced = false;
    if (!frenzy) this.record.goals++;
    this.lastScore = card.total;
    this.goalCoins = 0;
    this.goalXp = 0;
    this.clubLevels = [];
    this.clubCoins = 0;
    this.goalLp = 0;
    this.goalBonus = null;
    // Solo coins are paid for progress only: the first clear, and each star won for the first time.
    if (campaign) {
      const stars = Math.max(this.record.stars, card.stars);
      this.goalCoins = coinsForGoal({ firstClear, oldStars: this.record.paidStars, newStars: stars, total: card.total });
      // A boss match pays double.
      if (this.level.def.boss) this.goalCoins *= BOSS_COIN_MULTIPLIER;
      this.record.paidStars = Math.max(this.record.paidStars, stars);
      this.save.data.coins += this.goalCoins;
      portal.gameplayStop();
      // The one moment in the whole campaign rare enough for the platform's own celebration: finishing it.
      if (firstClear && this.level.index === this.levels.length - 1) portal.happytime();
    }
    if (campaign) this.offerGoalTips(card.lines.map((l) => l.label));
    if (campaign && card.newBest) this.record.best = card.total;
    if (campaign && card.stars > this.record.stars) this.record.stars = card.stars;
    // CLUB LEVEL: every solo goal earns XP, replays too. Levels pay coins, and some give a ball or an ability.
    if (campaign) this.awardClub(card.total);
    if (campaign) this.completeWorldIfBoss();
    if (campaign) this.awardLeague(Math.max(0, card.stars - starsBefore));
    // BONUS OBJECTIVE: a solo goal that meets this match's objective pays BONUS_COINS, the first time only.
    const bonusId = campaign ? bonusFor(this.level.def.id) : null;
    if (bonusId) {
      const met = bonusMet(bonusId, facts);
      const paid = met && !this.record.bonus;
      if (paid) {
        this.record.bonus = true;
        this.save.data.coins += BONUS_COINS;
      }
      this.goalBonus = { id: bonusId, met, coins: paid ? BONUS_COINS : 0 };
    }
    if (frenzy) this.frenzyScored(card.total);
    this.save.save();
    this.ballGap = campaign ? this.starsToNextBall() : null;
    if (campaign) this.events.emit('LEVEL_GOAL', { level: this.level.index + 1, stars: card.stars, score: card.total, attempts: this.record.attempts, firstClear, bounces: card.bounces });

    b.drag = NET_DRAG;
    this.goalFlash = 1;
    this.path.push(b.x, b.y);
    this.setState('goal');
    this.celebration.start(card);
    this.time.hitStop(CELEBRATION_TIMING.hitStop);
    this.time.slowMo(CELEBRATION_TIMING.slowMoScale, CELEBRATION_TIMING.slowMoSeconds);
    this.camera.zoomTo(goal.cx, goal.lineY + 30, 0.85);
    this.camera.addTrauma(0.9);
    this.camera.punchZoom(0.16, b.x, b.y);
    this.net.punch(b.x, b.vx * 0.16, b.vy * 0.12);
    this.events.emit('GOAL_SCORED', { x: b.x, y: b.y, speed: Math.hypot(b.vx, b.vy), total: card.total, bounces: card.bounces, stars: card.stars, newBest: card.newBest });
    if (this.shotRule === 'single') this.onShotEnd?.({ goal: true, score: card.total, path: this.path, events: this.shotEvents, movers: this.shotMovers });
  }

  /** The first street trick and the first CHAIN REACTION each get one explaining line, shown on the next shot. */
  private offerGoalTips(labels: readonly string[]): void {
    const street = labels.find((l) => STREET_LABELS.has(l));
    if (!street) return;
    if (labels.includes('CHAIN REACTION')) {
      // A chain implies the first-trick tip: say the bigger thing once.
      if (!this.save.data.tips.includes('labels')) this.save.data.tips.push('labels');
      this.offerTip('chain', 'THREE DIFFERENT THINGS IN ONE SHOT: CHAIN REACTION.');
    } else {
      this.offerTip('labels', tr('{label}! USING THE STREET EARNS BONUS POINTS.', { label: tr(street) }));
    }
  }

  private missShot(forced?: MissKind): void {
    const b = this.ball.body;
    b.vx = 0;
    b.vy = 0;
    b.z = 0;
    b.vz = 0;
    b.bend = 0;
    this.path.push(b.x, b.y);
    this.missKind = forced ?? classifyMiss(this.analyzer.finish(false, b, this.level.goal, this.level.hasKeeper));
    if (this.shotRule === 'free' && !this.frenzy) {
      this.missStreak++;
      // Six misses in a row on one match: a gentle hint, from what the sweep says scores on it.
      const hint = this.missStreak === HINT_MISSES ? hintText(this.level.def.id) : null;
      if (hint) this.tip = { key: 'hint', text: hint };
    }
    this.setState('missed');
    if (this.frenzy) this.frenzyMissed();
    this.events.emit('SHOT_FAILED', { kind: this.missKind, x: b.x, y: b.y });
    if (this.shotRule === 'single') this.onShotEnd?.({ goal: false, score: 0, path: this.path, events: this.shotEvents, movers: this.shotMovers });
  }

  /** A retry is gameplay again: the goal that stopped the portal must hand it back. */
  private retryShot(): void {
    if (this.state === 'menu') return;
    if (this.frenzy) {
      // In a run a press after a miss moves on to the next match, never back to the same one.
      if (this.state === 'missed') this.frenzyAdvance();
      return;
    }
    this.resetShot();
    if (!this.paused) portal.gameplayStart();
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
    this.coinTaken = this.coinSpent();
    this.armLesson();
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
    // A world just completed: its panel comes up first, and the result card follows it.
    if (want && this.pendingWorld && !force) {
      const info = this.pendingWorld;
      this.pendingWorld = null;
      this.overlay.showWorld(info, () => this.syncButtons(true));
      return;
    }
    // A first clear moves on by itself: the ring on NEXT MATCH starts filling once the result card is up.
    if (!want) this.advanceT = -1;
    else if (this.goalFirstClear && this.advanceT < 0) this.advanceT = 0;
    const double = want && this.doubleOffer();
    this.overlay.setResult(want, this.frenzy !== null || (this.level.index + 1 < this.levels.length && this.isUnlocked(this.level.index + 1)), double, this.frenzy !== null);
    if (double) this.events.emit('AD_OFFERED', { kind: 'double' });
    if (want && !force) {
      if (!this.paused) this.offerBallToast();
    }
  }

  private updateVisuals(dt: number, realDt: number): void {
    const ball = this.ball;
    ball.update(dt);
    if (dt > 0 && (this.state === 'flight' || this.state === 'goal' || this.state === 'replay')) this.trail.push(ball.renderX, ball.renderY, ball.speed);
    this.level.update(dt);
    this.net.update(dt);
    this.particles.update(dt);
    this.popups.update(dt);
    this.juice.update(realDt);
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

    if (this.frenzy) {
      // In a run the missed shot is over: a short beat later the next match starts, or the run ends.
      if (this.state === 'missed' && this.stateT >= (this.missKind === 'miss' ? MISS_HOLD : NEAR_MISS_HOLD)) this.frenzyAdvance();
    } else if (this.shotRule === 'free' && this.state === 'missed' && this.stateT >= (this.missKind === 'miss' ? MISS_HOLD : NEAR_MISS_HOLD)) this.resetShot();
    this.abilities.refresh(BOOST_COSTS);
  }
}
