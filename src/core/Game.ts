import { AWARENESS } from './Tuning';
import { Rng, clamp01, dist, hashString } from './Mathx';
import { EventBus } from './EventBus';
import { FIXED_DT, GameLoop } from './GameLoop';
import { InputManager } from '../input/InputManager';
import { CursorController } from '../cursor/CursorController';
import { AttentionSystem } from '../stealth/AttentionSystem';
import { Player } from '../player/Player';
import { Enemy, type EnemyContext } from '../enemies/Enemy';
import { EnemyCommunication } from '../enemies/EnemyCommunication';
import { Room, type RoomDefinition, type RoomEventSpec } from '../world/Room';
import { ROOMS } from '../world/Rooms';
import { generateRoom } from '../world/RoomGenerator';
import { validateRoom } from '../world/RoomValidator';
import { NoiseSystem } from '../interactions/NoiseSystem';
import { InteractionSystem, type InteractionStats } from '../interactions/InteractionSystem';
import { ParticleSystem } from '../particles/ParticleSystem';
import { Renderer } from '../rendering/Renderer';
import { AudioManager } from '../audio/AudioManager';
import { SaveManager, type Settings } from '../save/SaveManager';
import { DiscoverySystem } from '../gameplay/DiscoverySystem';
import { ObjectiveSystem } from '../gameplay/ObjectiveSystem';
import { ScoreSystem, emptyStats, type RunStats } from '../gameplay/ScoreSystem';
import { PatternMemory } from '../gameplay/PatternMemory';
import { ReplaySystem } from '../gameplay/ReplaySystem';
import {
  applyModifiersToRoom,
  dailyChallenge,
  noModifiers,
  resolveModifiers,
  type ActiveModifiers,
  type ModifierId,
} from '../gameplay/ChallengeSystem';
import { AdManager } from '../ads/AdManager';
import { AnalyticsManager } from '../analytics/AnalyticsManager';
import { DebugOverlay } from '../debug/DebugOverlay';
import { UIManager } from '../ui/UIManager';
import type { ScreenName, UICallbacks } from '../ui/Screens';

type Mode = 'menu' | 'intro' | 'playing' | 'paused' | 'screen' | 'results' | 'dead' | 'mouse-lost';

interface RoomSession {
  def: RoomDefinition;
  index: number;
  seed: number;
  modifiers: ActiveModifiers;
  isCampaign: boolean;
  challengeKey: string | null;
}

const NEAR_MISS_LINES = [
  'TOO CLOSE',
  'IT ALMOST SAW YOU',
  'NICE SAVE',
  'DO NOT DO THAT AGAIN',
  'YOU ARE GETTING CARELESS',
];

/**
 * The game.
 *
 * Owns the fixed-step simulation, the mode it is in, and the wiring between
 * systems that are otherwise unaware of each other. Nothing in here implements
 * gameplay rules; it decides what runs, in what order, and what happens at the
 * boundaries of a room.
 */
export class Game {
  private readonly bus = new EventBus();
  private readonly renderer: Renderer;
  private readonly input: InputManager;
  private readonly attention = new AttentionSystem();
  private readonly cursor: CursorController;
  private readonly player = new Player();
  private readonly noise: NoiseSystem;
  private readonly particles = new ParticleSystem();
  private readonly comms = new EnemyCommunication();
  private readonly patterns = new PatternMemory();
  private readonly save = new SaveManager();
  private readonly discovery: DiscoverySystem;
  private readonly score = new ScoreSystem();
  private readonly audio: AudioManager;
  private readonly ads = new AdManager();
  private readonly analytics = new AnalyticsManager();
  private readonly debugOverlay = new DebugOverlay();
  private readonly replay = new ReplaySystem(FIXED_DT);
  private readonly ui: UIManager;
  private readonly loop: GameLoop;

  private room: Room | null = null;
  private session: RoomSession | null = null;
  private objective: ObjectiveSystem | null = null;
  private interactions: InteractionSystem | null = null;

  private mode: Mode = 'menu';
  private roomTime = 0;
  private reveal = 0;
  private noticeFlash = 0;
  private introTimer = 0;
  private deathTimer = 0;
  private escapeTimer = 0;
  private debug = false;
  private rng = new Rng(1);

  private stats: InteractionStats = blankInteractionStats();
  private detections = 0;
  private nearMisses = 0;
  private alarms = 0;
  private readonly nearMissArmed = new Set<string>();
  private lastNearMissLine = -1;
  private pendingRestores: { at: number; run: () => void }[] = [];
  private hintText = '';
  private killedBy = '';
  private audioUnlocked = false;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement, appRoot: HTMLElement) {
    this.renderer = new Renderer(canvas);
    this.input = new InputManager(canvas, this.renderer.toLogical);
    this.cursor = new CursorController(this.bus, this.attention);
    this.noise = new NoiseSystem(this.bus);
    this.discovery = new DiscoverySystem(this.bus);
    this.discovery.load(this.save.all.discoveries);
    this.audio = new AudioManager(this.save.settings);
    this.appRoot = appRoot;

    this.ui = new UIManager(uiRoot, this.save, this.discovery, this.buildCallbacks());
    this.loop = new GameLoop(
      (dt) => this.step(dt),
      (alpha, frameDt) => this.render(alpha, frameDt),
    );

    this.wireEvents();
    this.applySettings(this.save.settings);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    // Audio may only be created from a gesture, so arm it on the first one.
    const unlock = () => this.unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
  }

  private readonly appRoot: HTMLElement;

  start(): void {
    this.input.attach();
    this.ui.show('menu');
    this.setCursorHidden(false);
    this.analytics.track('game_start', { rooms: ROOMS.length });
    void this.ads.initialize();
    this.loop.start();
  }

  // --- wiring ---------------------------------------------------------------

  private buildCallbacks(): UICallbacks {
    return {
      onContinue: () => {
        const index = Math.min(ROOMS.length - 1, this.firstUnfinishedRoom());
        this.startCampaignRoom(index);
      },
      onSelectRoom: (index) => this.startCampaignRoom(index),
      onOpen: (screen: ScreenName) => {
        this.mode = 'screen';
        this.ui.show(screen);
        this.setCursorHidden(false);
      },
      onBack: () => {
        this.ui.back();
        this.mode = this.ui.screen === 'paused' ? 'paused' : 'menu';
      },
      onStartChallenge: (index, mods) => this.startChallenge(index, mods),
      onStartDaily: () => this.startDaily(),
      onStartEndless: () => this.startEndless(),
      onResume: () => this.resume(),
      onRestart: () => this.restartRoom(),
      onQuit: () => this.quitToMenu(),
      onNextRoom: () => {
        const next = (this.session?.index ?? 0) + 1;
        if (next < ROOMS.length) this.startCampaignRoom(next);
        else this.quitToMenu();
      },
      onSettingChange: (patch) => {
        const next = this.save.updateSettings(patch);
        this.applySettings(next);
      },
      onWipeSave: () => {
        this.save.wipe();
        this.discovery.load([]);
        this.applySettings(this.save.settings);
        this.ui.show('menu');
        this.mode = 'menu';
      },
    };
  }

  private wireEvents(): void {
    this.bus.on('TOAST', ({ text, tone }) => this.ui.toast(text, tone));
    this.bus.on('SHAKE', ({ amount }) => this.renderer.camera.kick(amount));

    this.bus.on('NOISE_CREATED', (ev) => {
      const sound =
        ev.kind === 'glass'
          ? 'glass'
          : ev.kind === 'metal'
            ? 'metal'
            : ev.kind === 'switch'
              ? 'switch'
              : ev.kind === 'ring'
                ? 'ring'
                : ev.kind === 'door'
                  ? 'door'
                  : ev.kind === 'drawer'
                    ? 'drawer'
                    : ev.kind === 'alarm'
                      ? 'alarm'
                      : ev.kind === 'footstep'
                        ? 'footstep'
                        : 'click';
      this.audio.playAt(sound, ev.x, { gain: Math.min(1, 0.12 + ev.level / 26) });
      if (ev.kind === 'alarm' && ev.byPlayer) this.alarms++;
      if (ev.level >= 8) this.renderer.camera.kick(Math.min(4, ev.level * 0.12));
      if (ev.byPlayer && ev.level >= 2) {
        this.analytics.track('click_noise', { level: ev.level, kind: ev.kind });
      }
    });

    this.bus.on('PLAYER_DETECTED', ({ kind }) => {
      this.detections++;
      this.save.noteDetection();
      this.killedBy = kind;
      this.noticeFlash = 1;
      this.renderer.camera.kick(6);
      this.renderer.camera.push(1.04);
      this.audio.play('notice', { gain: 0.9 });
      this.ui.toast('IT SEES YOU', 'hot');
      this.analytics.track('cursor_detected', { kind, t: Math.round(this.roomTime) });
      if (this.session?.modifiers.oneLife || this.objective?.forbidsDetection) {
        this.failRoom('ONE LOOK WAS ENOUGH');
      }
    });

    this.bus.on('PLAYER_ESCAPED_DETECTION', ({ enemyId }) => {
      this.nearMissArmed.delete(enemyId);
      this.nearMisses++;
      this.discovery.find('mechanic-escape');
      this.audio.play('wake', { gain: 0.3 });
      this.ui.toast('IT LOST YOU', 'cool');
      this.analytics.track('cursor_escape', {});
    });

    this.bus.on('ENEMY_ALERTED', ({ enemyId, kind, source }) => {
      this.audio.play('stinger', { gain: 0.25 });
      if (kind === 'SCOUT') this.discovery.find('scout-alert');
      if (source === 'decoy') {
        this.discovery.find('mechanic-decoy');
        this.bus.emit('DECOY_FOOLED_ENEMY', { decoyId: 'unknown', enemyId });
      }
    });

    this.bus.on('OBJECT_INTERACTED', ({ kind }) => {
      if (kind === 'KEY' || kind === 'BOOK' || kind === 'TOY') this.audio.play('pickup', { gain: 0.5 });
    });

    this.bus.on('DECOY_SPAWNED', ({ pattern, sourceId }) => {
      this.audio.play('decoy', { gain: 0.35 });
      this.analytics.track('decoy_used', { pattern, source: sourceId ?? 'none' });
    });

    this.bus.on('DISCOVERY_FOUND', ({ id }) => {
      this.save.setDiscoveries(this.discovery.all);
      this.analytics.track('discovery_found', { id });
    });

    this.bus.on('OBJECT_BLOCKED', ({ reason }) => {
      if (reason === 'locked') this.ui.toast('IT NEEDS A KEY', 'warm');
      else if (reason === 'out-of-reach') this.ui.toast('TOO FAR AWAY', 'warm');
    });

    this.bus.on('PLAYER_HIDDEN', () => this.audio.play('drawer', { gain: 0.3 }));
  }

  private applySettings(settings: Settings): void {
    this.audio.applySettings(settings);
    this.renderer.camera.shakeEnabled = settings.screenShake;
  }

  private unlockAudio(): void {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    this.audio.unlock();
    this.audio.applySettings(this.save.settings);
  }

  private setCursorHidden(hidden: boolean): void {
    this.appRoot.classList.toggle('hide-cursor', hidden);
  }

  private readonly onResize = (): void => {
    this.renderer.resize();
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) {
      this.audio.suspend();
      if (this.mode === 'playing') this.pause();
    } else {
      this.audio.resume();
    }
  };

  // --- room lifecycle -------------------------------------------------------

  private firstUnfinishedRoom(): number {
    for (let i = 0; i < ROOMS.length; i++) {
      if (!this.save.record(ROOMS[i].id).completed) return i;
    }
    return ROOMS.length - 1;
  }

  private startCampaignRoom(index: number): void {
    const def = ROOMS[Math.max(0, Math.min(ROOMS.length - 1, index))];
    this.patterns.resetAll();
    this.loadRoom({
      def,
      index,
      seed: hashString(def.id),
      modifiers: noModifiers(),
      isCampaign: true,
      challengeKey: null,
    });
  }

  private startChallenge(index: number, mods: readonly ModifierId[]): void {
    const def = ROOMS[Math.max(0, Math.min(ROOMS.length - 1, index))];
    const modifiers = resolveModifiers(mods);
    this.patterns.resetAll();
    this.loadRoom({
      def,
      index,
      seed: hashString(def.id + mods.join(',')),
      modifiers,
      isCampaign: false,
      challengeKey: `${def.id}:${[...mods].sort().join(',')}`,
    });
  }

  private startDaily(): void {
    const daily = dailyChallenge(new Date(), ROOMS.length);
    const def = ROOMS[daily.roomIndex];
    const modifiers = resolveModifiers(daily.modifiers);
    this.patterns.resetAll();
    this.loadRoom({
      def,
      index: daily.roomIndex,
      seed: daily.seed,
      modifiers,
      isCampaign: false,
      challengeKey: `daily:${daily.label}`,
    });
    this.ui.toast(`TODAY: ${daily.modifiers.join('  ')}`, 'warm');
  }

  private startEndless(): void {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const completed = ROOMS.filter((r) => this.save.record(r.id).completed).length;
    const def = generateRoom(seed, completed);
    const report = validateRoom(def);
    if (!report.ok) {
      // generateRoom already falls back, so this should not happen. Say so rather
      // than handing the player a room that cannot be finished.
      console.warn('[rooms] generated room failed validation', report.problems);
      this.ui.toast('THAT ROOM CAME OUT WRONG', 'hot');
      return;
    }
    this.patterns.resetAll();
    this.loadRoom({
      def,
      index: 0,
      seed,
      modifiers: noModifiers(),
      isCampaign: false,
      challengeKey: null,
    });
  }

  private loadRoom(session: RoomSession): void {
    this.session = session;
    this.rng = new Rng(session.seed);

    const room = new Room(session.def);
    applyModifiersToRoom(room, session.modifiers, session.seed);
    this.room = room;

    this.objective = new ObjectiveSystem(session.def.objective);
    this.stats = blankInteractionStats();
    this.detections = 0;
    this.nearMisses = 0;
    this.alarms = 0;
    this.nearMissArmed.clear();
    this.pendingRestores.length = 0;
    this.roomTime = 0;
    this.reveal = 0;
    this.noticeFlash = 0;
    this.deathTimer = 0;
    this.escapeTimer = 0;
    this.killedBy = '';
    this.hintText = '';

    this.player.reset(session.def.playerSpawn.x, session.def.playerSpawn.y);
    this.cursor.reset(session.def.playerSpawn.x + 40, session.def.playerSpawn.y - 30);
    if (session.modifiers.jumpyCursor) this.cursor.sensor.potency = 1.6;
    else this.cursor.sensor.potency = 1;

    this.noise.reset();
    this.particles.reset();
    this.comms.clear();
    this.patterns.beginAttempt();
    this.discovery.beginRun();
    this.renderer.camera.reset();
    this.audio.reset();
    this.ui.clearToasts();
    this.ui.setRoomName(session.def.name);

    this.interactions = new InteractionSystem({
      room,
      player: this.player,
      cursor: this.cursor,
      noise: this.noise,
      particles: this.particles,
      bus: this.bus,
      patterns: this.patterns,
      stats: this.stats,
      rng: this.rng,
      discover: (id) => this.discovery.find(id),
    });

    this.save.noteAttempt(session.def.id);
    this.replay.begin(session.def.id, session.seed, session.modifiers.ids);
    this.analytics.track('room_start', {
      room: session.def.id,
      modifiers: session.modifiers.ids.join(','),
    });
    this.ads.setGameplayActive(true);

    const record = this.save.record(session.def.id);
    const showIntro = !!session.def.intro && record.attempts <= 1;
    if (showIntro && session.def.intro) {
      this.mode = 'intro';
      this.introTimer = 1.5;
      this.ui.beginIntro(session.def.intro);
      this.setCursorHidden(false);
    } else {
      this.beginPlay();
    }
  }

  private beginPlay(): void {
    this.mode = 'playing';
    this.ui.show('none');
    this.setCursorHidden(true);
    this.bus.emit('ROOM_STARTED', {
      roomId: this.session?.def.id ?? '',
      attempt: this.save.record(this.session?.def.id ?? '').attempts,
    });
  }

  private restartRoom(): void {
    if (!this.session) return;
    this.loadRoom({ ...this.session });
  }

  private quitToMenu(): void {
    this.room = null;
    this.session = null;
    this.interactions = null;
    this.objective = null;
    this.mode = 'menu';
    this.ads.setGameplayActive(false);
    this.audio.reset();
    this.ui.show('menu');
    this.setCursorHidden(false);
  }

  private pause(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.input.releaseAll();
    this.ads.setGameplayActive(false);
    this.ui.show('paused');
    this.setCursorHidden(false);
  }

  private resume(): void {
    if (!this.room) {
      this.quitToMenu();
      return;
    }
    this.mode = 'playing';
    this.ads.setGameplayActive(true);
    this.ui.show('none');
    this.setCursorHidden(true);
  }

  // --- the simulation -------------------------------------------------------

  private step(dt: number): void {
    this.renderer.camera.update(dt);
    this.noticeFlash = Math.max(0, this.noticeFlash - dt * 1.8);

    if (this.mode === 'intro') {
      this.stepIntro(dt);
      return;
    }

    if (this.mode !== 'playing' && this.mode !== 'mouse-lost') {
      // Keyboard still works on the pause, results and death screens: ESC to come
      // back, R to go again. The simulation stays frozen.
      this.input.beginStep();
      const a = this.input.actions;
      if (a.pause && this.mode === 'paused') this.resume();
      else if (a.restart && this.session && (this.mode === 'paused' || this.mode === 'dead' || this.mode === 'results')) {
        this.restartRoom();
      }
      this.input.endStep();
      this.audio.update(dt, 0, 0, false);
      return;
    }

    this.input.beginStep();
    this.handleGlobalKeys();

    if (this.mode !== 'playing' && this.mode !== 'mouse-lost') {
      this.input.endStep();
      return;
    }

    // The cursor leaving the play field is a real state, not a gap in the rules.
    // The room holds still rather than letting a player become unreadable.
    const pointerInside = this.input.pointer.inside;
    if (!pointerInside && this.mode === 'playing' && this.roomTime > 0.3) {
      this.mode = 'mouse-lost';
      this.bus.emit('CURSOR_LOST', { lost: true });
      this.ui.show('mouse');
      this.setCursorHidden(false);
      this.input.endStep();
      return;
    }
    if (pointerInside && this.mode === 'mouse-lost') {
      this.mode = 'playing';
      this.bus.emit('CURSOR_LOST', { lost: false });
      this.ui.show('none');
      this.setCursorHidden(true);
    }
    if (this.mode === 'mouse-lost') {
      this.input.endStep();
      this.audio.update(dt, this.room?.tension ?? 0, 0, false);
      return;
    }

    const room = this.room;
    const interactions = this.interactions;
    const objective = this.objective;
    const session = this.session;
    if (!room || !interactions || !objective || !session) {
      this.input.endStep();
      return;
    }

    this.reveal = Math.min(1, this.reveal + dt * 1.6);
    this.roomTime += dt;
    this.replay.capture(this.input.actions, this.input.pointer);

    if (this.player.dead) {
      this.stepDeath(dt);
      this.input.endStep();
      return;
    }
    if (this.player.escaped) {
      this.stepEscape(dt);
      this.input.endStep();
      return;
    }

    const lightAt = (x: number, y: number): number =>
      session.modifiers.alwaysVisible ? 1 : room.lightAt(x, y);

    this.cursor.update(dt, this.input.pointer, this.roomTime, lightAt);

    const danger = this.cursor.displayHeat;
    this.player.update(dt, this.input.actions, room.solids, danger, (step) => {
      this.noise.emit(step.x, step.y, step.level, 'footstep', true);
      this.audio.playAt('footstep', step.x, { gain: 0.18 });
    });

    this.handlePlayerActions(interactions, session.modifiers);
    interactions.update(dt, this.cursor.x, this.cursor.y);
    room.update(dt);
    this.runRoomEvents(room, session);
    this.runPendingRestores();

    this.updateEnemies(dt, room);

    this.noise.update(dt);
    const airflow = room.objects.some((o) => o.kind === 'FAN' && o.state === 'on') ? 1 : 0;
    this.particles.update(dt, airflow);

    this.updateThreat(room);
    objective.update(room, this.player, this.stats);

    if (objective.failReason) {
      this.failRoom(objective.failReason);
    } else if (objective.complete) {
      this.player.escaped = true;
      this.escapeTimer = 0.7;
      this.audio.play('success', { gain: 0.5 });
    }

    const radioOn = room.objects.some(
      (o) => (o.kind === 'RADIO' || o.kind === 'TELEVISION') && o.state === 'on',
    );
    this.audio.update(dt, room.tension, this.cursor.displayHeat, radioOn);

    this.updateHud(room, session);
    this.input.endStep();
  }

  private stepIntro(dt: number): void {
    this.introTimer -= dt;
    if (this.introTimer > 0) return;
    this.introTimer = 1.5;
    if (!this.ui.advanceIntro()) this.beginPlay();
  }

  private handleGlobalKeys(): void {
    const a = this.input.actions;
    if (a.toggleDebug && import.meta.env.DEV) {
      this.debug = !this.debug;
      this.ui.toast(this.debug ? 'DEBUG ON' : 'DEBUG OFF', 'cool');
    }
    if (a.pause) {
      if (this.mode === 'playing' || this.mode === 'mouse-lost') this.pause();
    }
    if (a.restart && this.session) {
      this.restartRoom();
    }
  }

  private handlePlayerActions(interactions: InteractionSystem, mods: ActiveModifiers): void {
    const pointer = this.input.pointer;
    const actions = this.input.actions;

    if (pointer.primaryDown) {
      if (mods.noClicking) {
        this.ui.toast('NO CLICKING', 'hot');
        this.failRoom('YOU CLICKED');
        return;
      }
      interactions.handleClick(pointer.x, pointer.y, 0);
    }
    if (pointer.secondaryDown) {
      interactions.handleClick(pointer.x, pointer.y, 2);
    }
    if (actions.interact) {
      interactions.handleKeyInteract();
    }
    if (actions.hide) {
      if (mods.noHiding) this.ui.toast('NOWHERE TO GO', 'hot');
      else interactions.toggleHide();
    }
  }

  private updateEnemies(dt: number, room: Room): void {
    const ctx: EnemyContext = {
      bus: this.bus,
      sources: this.attention.all,
      blockers: room.blockers,
      solids: room.solids,
      playerX: this.player.x,
      playerY: this.player.y,
      playerHidden: this.player.hidden,
      roomTime: this.roomTime,
      comms: this.comms,
      patterns: this.patterns,
      spawnDecoy: (spec) => {
        this.cursor.spawnDecoy(spec);
      },
      recentAttention: (window, out) =>
        this.cursor.sensor.recentAttentionPoint(window, this.roomTime, out),
    };

    // Noises raised this step are heard this step, before anyone decides anything.
    const noises = this.noise.drain();
    if (noises.length > 0) {
      const mask = 1 - room.noiseMask * 0.45;
      for (const n of noises) {
        // A running fan muddies quiet sounds. It does nothing for breaking glass.
        const masked = n.level < 8 ? { ...n, level: n.level * mask } : n;
        for (const e of room.enemies) e.hear(masked, ctx);
      }
    }

    for (const e of room.enemies) {
      e.update(dt, ctx);
      if (e.caughtPlayer && !this.player.dead) this.killPlayer(e);
    }

    this.comms.dispatch(room.enemies);

    // Decoys that click make a sound of their own, which is what sells them.
    for (const decoy of this.cursor.decoys) {
      if (decoy.clickedThisStep && decoy.noiseLevel > 0) {
        this.noise.emit(decoy.x, decoy.y, decoy.noiseLevel, 'tick', false);
      }
    }
  }

  /** Roll up the room into the single number every feedback system reads. */
  private updateThreat(room: Room): void {
    let heat = 0;
    let exposed = false;
    let pursued = false;

    for (const e of room.enemies) {
      heat = Math.max(heat, e.awareness);
      if (e.reading.inRadius && e.reading.visible) exposed = true;
      if (e.state.current === 'PURSUING') pursued = true;

      // Near miss: it got close to certain and then lost interest, with no
      // detection in between. This is the moment the game is built around.
      if (e.awareness >= AWARENESS.nearMiss && e.state.current !== 'PURSUING') {
        this.nearMissArmed.add(e.id);
      } else if (this.nearMissArmed.has(e.id) && e.awareness < AWARENESS.suspicious * 0.8) {
        this.nearMissArmed.delete(e.id);
        this.nearMisses++;
        this.renderer.camera.kick(1.5);
        let line = this.rng.int(0, NEAR_MISS_LINES.length);
        if (line === this.lastNearMissLine) line = (line + 1) % NEAR_MISS_LINES.length;
        this.lastNearMissLine = line;
        this.ui.toast(NEAR_MISS_LINES[line], 'warm');
        this.teachFrom(e);
      }
      if (e.state.current === 'PURSUING') this.nearMissArmed.delete(e.id);
    }

    this.cursor.heat = heat;
    this.cursor.exposed = exposed;
    this.cursor.pursued = pursued;
    this.renderer.camera.push(pursued ? 1.05 : 1);
  }

  /** Turn a close call into knowledge: the book fills in through experience. */
  private teachFrom(e: Enemy): void {
    const r = e.reading;
    switch (e.def.kind) {
      case 'WATCHER':
        if (r.pointing > 0.4) this.discovery.find('watcher-gaze');
        else if (r.proximity > 0.4) this.discovery.find('mechanic-proximity');
        if (r.coneMultiplier < 0.5) this.discovery.find('watcher-flank');
        break;
      case 'HOUND':
        if (r.speed > 0.3) {
          this.discovery.find('hound-speed');
          this.discovery.find('mechanic-speed');
        }
        break;
      case 'SLEEPER':
        if (r.dwell > 0.3) this.discovery.find('sleeper-dwell');
        this.discovery.find('mechanic-dwell');
        break;
      case 'MIRROR':
        this.discovery.find('mirror-turn');
        break;
      case 'ANALYST':
        this.discovery.find('analyst-learn');
        this.discovery.find('mechanic-trail');
        break;
      case 'PARASITE':
        this.discovery.find('parasite-neglect');
        break;
      case 'MIMIC':
        this.discovery.find('mimic-decoy');
        break;
      case 'LIAR':
        this.discovery.find('liar-tell');
        break;
      default:
        break;
    }
    if (r.pointing > 0.5) this.discovery.find('mechanic-gaze');
  }

  private killPlayer(e: Enemy): void {
    this.player.kill();
    this.killedBy = e.def.name;
    this.deathTimer = 1.3;
    this.renderer.camera.kick(9);
    this.audio.play('fail', { gain: 0.8 });
    this.particles.burst(this.player.x, this.player.y, 18, 'spark');
    this.bus.emit('PLAYER_KILLED', { enemyId: e.id });
    this.save.noteDeath();
    this.analytics.track('player_killed', {
      room: this.session?.def.id ?? '',
      by: e.def.kind,
      t: Math.round(this.roomTime),
    });
  }

  private stepDeath(dt: number): void {
    this.deathTimer -= dt;
    this.reveal = Math.max(0.25, this.reveal - dt * 0.8);
    if (this.deathTimer > 0) return;
    this.mode = 'dead';
    this.ads.setGameplayActive(false);
    this.setCursorHidden(false);
    this.bus.emit('ROOM_FAILED', { roomId: this.session?.def.id ?? '', reason: 'caught' });
    this.analytics.track('room_fail', { room: this.session?.def.id ?? '', reason: 'caught' });
    this.ui.show('dead', {
      roomName: this.session?.def.name ?? '',
      killedBy: this.killedBy,
      seconds: this.roomTime,
      lesson: this.lessonForDeath(),
    });
  }

  private lessonForDeath(): string {
    const room = this.room;
    if (!room) return '';
    const worst = room.enemies.reduce((a, b) => (a.peakAwareness > b.peakAwareness ? a : b));
    const r = worst.reading;
    if (worst.def.kind === 'HOUND') return 'It reads how fast your hand moves. Slow down.';
    if (worst.def.kind === 'SLEEPER') return 'Sound and loitering wake it. Try E instead of clicking.';
    if (worst.def.kind === 'PARASITE') return 'That one wants to be looked at. Ignoring it is the mistake.';
    if (r.pointing > 0.4) return 'You pointed straight at it. Move the cursor around it, not through it.';
    if (r.dwell > 0.4) return 'You left the cursor sitting too long. Keep it drifting.';
    if (this.stats.clicks > 6) return 'Every click is a sound where you pointed.';
    return 'Your body was never the problem. Your cursor was.';
  }

  private failRoom(reason: string): void {
    if (this.player.dead) return;
    this.player.kill();
    this.killedBy = reason;
    this.deathTimer = 0.8;
    this.audio.play('fail', { gain: 0.7 });
  }

  private stepEscape(dt: number): void {
    this.escapeTimer -= dt;
    this.reveal = Math.max(0.3, this.reveal - dt * 0.9);
    if (this.escapeTimer > 0) return;
    this.finishRoom();
  }

  private finishRoom(): void {
    const session = this.session;
    if (!session) return;

    const runStats: RunStats = {
      ...emptyStats(),
      timeSeconds: this.roomTime,
      clicks: this.stats.clicks,
      usefulClicks: this.stats.usefulClicks,
      interactions: this.stats.interactions,
      detections: this.detections,
      nearMisses: this.nearMisses,
      alarms: this.alarms,
      decoysUsed: this.stats.decoysUsed,
      distractionsUsed: this.stats.distractionsUsed,
      hidesUsed: this.stats.hidesUsed,
      secretsFound: this.countSecrets(),
      loudestNoise: this.noise.loudestByPlayer,
      cursorDistance: this.cursor.sensor.data.distanceMoved,
    };

    const result = this.score.evaluate(runStats, session.def.parTime);
    const scaled = Math.round(result.total * session.modifiers.scoreScale);
    const finalResult = { ...result, total: scaled };

    this.save.noteClicks(runStats.clicks);
    const records = session.isCampaign
      ? this.save.noteEscape(
          session.def.id,
          Math.round(this.roomTime * 1000),
          scaled,
          result.perfect,
          session.index,
          ROOMS.length,
        )
      : { newBestTime: false, newBestScore: false };

    let newBestScore = records.newBestScore;
    if (session.challengeKey) {
      newBestScore = this.save.noteChallenge(session.challengeKey, scaled) || newBestScore;
      this.analytics.track('challenge_complete', {
        key: session.challengeKey,
        score: scaled,
      });
    }

    this.replay.end();
    this.mode = 'results';
    this.ads.setGameplayActive(false);
    this.ads.noteRoomFinished();
    this.setCursorHidden(false);
    this.bus.emit('ROOM_COMPLETED', { roomId: session.def.id });
    this.analytics.track('room_complete', {
      room: session.def.id,
      score: scaled,
      time: Math.round(this.roomTime),
      detections: this.detections,
      perfect: result.perfect,
    });

    const record = this.save.record(session.def.id);
    this.ui.show('results', {
      roomLabel: session.isCampaign ? `ROOM ${String(session.index + 1).padStart(2, '0')}` : 'CHALLENGE',
      roomName: session.def.name,
      score: finalResult,
      stats: runStats,
      newBestTime: records.newBestTime,
      newBestScore,
      bestTimeMs: record.bestTimeMs,
      bestScore: Math.max(record.bestScore, session.challengeKey ? this.save.challengeScore(session.challengeKey) : 0),
      discoveriesThisRun: this.discovery.runCount,
      hasNextRoom: session.isCampaign && session.index + 1 < ROOMS.length,
      isChallenge: !session.isCampaign,
    });

    void this.ads.maybeShowInterstitial('room-complete');
  }

  private countSecrets(): number {
    const room = this.room;
    if (!room) return 0;
    const ids = room.def.secrets ?? [];
    let found = 0;
    for (const id of ids) if (this.player.inventory.has(id)) found++;
    return found;
  }

  // --- scripted room moments ------------------------------------------------

  private runRoomEvents(room: Room, session: RoomSession): void {
    const events = session.def.events;
    if (!events) return;
    for (let i = 0; i < events.length; i++) {
      if (room.firedEvents.has(i)) continue;
      const spec = events[i];
      if (!this.eventReady(spec, room)) continue;
      room.firedEvents.add(i);
      this.fireEvent(spec, room);
    }
  }

  private eventReady(spec: RoomEventSpec, room: Room): boolean {
    if (spec.requiresHabit && this.patterns.count(spec.requiresHabit.key) < spec.requiresHabit.times) {
      return false;
    }
    if (spec.at !== undefined && this.roomTime < spec.at) return false;
    if (spec.trigger) {
      const d = dist(this.player.x, this.player.y, spec.trigger.x, spec.trigger.y);
      if (d > spec.trigger.radius) return false;
    }
    if (spec.onObjectState) {
      const o = room.findObject(spec.onObjectState.id);
      if (!o || o.state !== spec.onObjectState.state) return false;
    }
    if (spec.kind === 'MOVE_OBJECT' && spec.targetId) {
      // The whole point is that it happens while you are not looking at it.
      const o = room.findObject(spec.targetId);
      if (o && dist(this.cursor.x, this.cursor.y, o.x, o.y) < 190) return false;
    }
    return true;
  }

  private fireEvent(spec: RoomEventSpec, room: Room): void {
    switch (spec.kind) {
      case 'LIGHTS_OUT': {
        const wereOn = room.lights.filter((l) => l.on);
        for (const l of wereOn) l.on = false;
        this.renderer.camera.kick(4);
        this.audio.play('switch', { gain: 0.6 });
        const restoreAt = this.roomTime + (spec.a ?? 6);
        this.pendingRestores.push({
          at: restoreAt,
          run: () => {
            for (const l of wereOn) l.on = true;
            this.audio.play('switch', { gain: 0.4 });
          },
        });
        break;
      }
      case 'DOOR_CLOSES': {
        const o = spec.targetId ? room.findObject(spec.targetId) : null;
        if (o) {
          o.setState('closed');
          room.markGeometryDirty();
          this.audio.playAt('door', o.x, { gain: 0.7 });
        }
        break;
      }
      case 'MOVE_OBJECT': {
        const o = spec.targetId ? room.findObject(spec.targetId) : null;
        if (o) {
          o.x += spec.a ?? 20;
          o.y += spec.b ?? 0;
          room.markGeometryDirty();
          this.discovery.find('secret-moved');
        }
        break;
      }
      case 'SECOND_CURSOR': {
        this.cursor.spawnDecoy({
          pattern: 'RANDOM',
          x: this.cursor.x + 80,
          y: this.cursor.y + 40,
          duration: spec.a ?? 7,
          potency: 1,
          noise: 0,
          radius: 90,
          sourceId: 'enemy-room',
        });
        this.discovery.find('secret-second-cursor');
        break;
      }
      case 'ENEMY_VANISH': {
        const e = spec.targetId ? room.findEnemyByTag(spec.targetId) : null;
        if (e) e.disable(spec.a ?? 5, this.makeLightEnemyContext(room));
        break;
      }
      case 'WAKE_ENEMY': {
        const e = spec.targetId ? room.findEnemyByTag(spec.targetId) : null;
        if (e) e.distractTo(this.player.x, this.player.y, 2);
        break;
      }
      case 'WHISPER':
        break;
    }
    if (spec.text) this.ui.toast(spec.text, 'hot');
  }

  /** Minimal context for pokes that happen outside the normal enemy update. */
  private makeLightEnemyContext(room: Room): EnemyContext {
    return {
      bus: this.bus,
      sources: this.attention.all,
      blockers: room.blockers,
      solids: room.solids,
      playerX: this.player.x,
      playerY: this.player.y,
      playerHidden: this.player.hidden,
      roomTime: this.roomTime,
      comms: this.comms,
      patterns: this.patterns,
      spawnDecoy: (spec) => {
        this.cursor.spawnDecoy(spec);
      },
      recentAttention: (window, out) =>
        this.cursor.sensor.recentAttentionPoint(window, this.roomTime, out),
    };
  }

  private runPendingRestores(): void {
    for (let i = this.pendingRestores.length - 1; i >= 0; i--) {
      if (this.roomTime < this.pendingRestores[i].at) continue;
      this.pendingRestores[i].run();
      this.pendingRestores.splice(i, 1);
    }
  }

  // --- hud ------------------------------------------------------------------

  private updateHud(room: Room, session: RoomSession): void {
    this.hintText = this.save.settings.showHints ? this.currentHint(room, session) : '';
    this.ui.updateHud({
      roomLabel: session.isCampaign
        ? `ROOM ${String(session.index + 1).padStart(2, '0')}`
        : session.challengeKey?.startsWith('daily')
          ? 'TODAY'
          : 'CHALLENGE',
      roomName: session.def.name,
      objective: this.objective?.currentText ?? '',
      seconds: this.roomTime,
      score: 0,
      heat: clamp01(this.cursor.displayHeat),
      cursorState: this.cursor.state,
      detections: this.detections,
      hint: this.hintText,
      carrying: this.player.inventory.has('key'),
      modifiers: session.modifiers.ids,
    });
  }

  /** One short line at a time, and only while the player still needs it. */
  private currentHint(room: Room, session: RoomSession): string {
    if (!session.isCampaign) return '';
    if (session.index === 0) {
      if (this.roomTime < 5) return 'W A S D TO MOVE';
      if (this.roomTime < 11) return 'NOW MOVE THE CURSOR. SLOWLY.';
      if (this.cursor.heat > 0.25 && this.roomTime < 30) return 'IT IS LOOKING AT YOUR CURSOR';
      if (!this.player.inventory.has('key') && this.stats.interactions === 0 && this.roomTime > 18) {
        return 'E USES THE NEAREST THING WITHOUT POINTING AT IT';
      }
      return '';
    }
    if (session.index === 1 && this.roomTime < 9) return 'GOING AROUND COSTS NOTHING';
    if (session.index === 2 && this.roomTime < 9) return 'EVERYTHING YOU USE MAKES A SOUND';
    if (session.index === 3 && this.roomTime < 9) return 'MOVE THE CURSOR SLOWLY';
    if (session.index === 4 && this.roomTime < 9) return 'DO NOT LEAVE THE CURSOR SITTING ON IT';
    if (session.index === 8 && this.roomTime < 9) return 'THE PROJECTOR MAKES A CURSOR THAT IS NOT YOURS';
    if (this.player.hidden) return 'SPACE TO COME OUT';
    void room;
    return '';
  }

  // --- render ---------------------------------------------------------------

  private render(_alpha: number, _frameDt: number): void {
    this.renderer.draw({
      room: this.room,
      player: this.player,
      cursor: this.cursor,
      noise: this.noise,
      particles: this.particles,
      interactions: this.interactions,
      settings: this.save.settings,
      time: this.roomTime,
      reveal: this.mode === 'menu' ? 1 : this.reveal,
      noticeFlash: this.noticeFlash,
      debug: this.debug,
      cursorLost: this.mode === 'mouse-lost',
    });

    if (this.debug && this.room && import.meta.env.DEV) {
      const input = {
        room: this.room,
        cursor: this.cursor,
        player: this.player,
        noise: this.noise,
        particles: this.particles,
        stats: this.loop.stats,
        roomTime: this.roomTime,
        seed: this.session?.seed ?? 0,
      };
      this.renderer.withCamera((ctx) => this.debugOverlay.drawWorld(ctx, input));
      this.renderer.withScreen((ctx) => this.debugOverlay.drawPanel(ctx, input));
    }
  }

  dispose(): void {
    this.loop.stop();
    this.input.detach();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.analytics.track('session_end', {});
    this.audio.dispose();
  }
}

function blankInteractionStats(): InteractionStats {
  return {
    clicks: 0,
    usefulClicks: 0,
    interactions: 0,
    decoysUsed: 0,
    distractionsUsed: 0,
    brokenObjects: 0,
    hidesUsed: 0,
  };
}
