import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { PALETTE, outlinedStyle } from '../config/Theme';
import { EVT, state, subscribe } from '../core/GameState';
import { intRange, range } from '../core/Random';
import type { Rock } from '../core/types';
import { ART_RES, ensureRockTextures, releaseRockTextures, rockKeys } from '../art/RockArt';
import { paintStrata } from '../art/StrataArt';
import { paintHome, paintMine } from '../art/SurfaceArt';
import {
  CLOUDS, RIDGE_FAR, RIDGE_MID, RIDGE_NEAR, RIDGE_W, SKY, SUN_DISC, SUN_RAYS, createScenicTextures,
} from '../art/ScenicArt';
import { HOLE_RADIUS, HOLE_VARIANTS, SHOVEL } from '../art/TextureFactory';
import { makeCanvasTexture } from '../art/paint';
import { sfx } from '../audio/Sfx';
import { generateRock } from '../systems/RockGenerator';
import type { DigBoost, DigResult } from '../systems/ExcavationSystem';
import { PLAIN_SWING, type SwingRoll } from '../systems/TraitSystem';
import { TRAIT_EFFECTS } from '../data/traits';
import type { Profile } from '../data/digShapes';
import { ensureFindTexture } from '../art/FindArt';
import { uiIcon } from '../art/UiIcons';
import { depositTint } from '../data/deposits';
import { CATEGORY_STYLE, type FindDef } from '../data/finds';
import { computeLayout, type Layout } from '../ui/layout';

const WORLD = GAME_CONFIG.world;
const W = WORLD.width;
const SURFACE = WORLD.surfaceY;
const TOTAL_H = state.dig.totalHeight;
const SKY_HEIGHT = 900;
const SHOVEL_SCALE = 1.05 / ART_RES;
const HOME_W = 520;
const HOME_H = 300;

/** Mouse wheel: screen pixels scrolled per wheel pixel. */
const WHEEL_GAIN = 1.5;
/** Arrow keys: screen pixels scrolled per second. */
const KEY_SCROLL_SPEED = 760;
/** A touch that drags further than this (screen px) scrolls the view instead of digging. */
const TOUCH_PAN_THRESHOLD = 10;
/** A touch shorter than this that did not drag is a tap: it digs once, on release. */
const TAP_MAX_MS = 280;
/** A finger held still this long starts digging continuously (until it lifts or drags). */
const HOLD_START_MS = 140;
/** Scrolling keeps gliding after the finger lifts, faster than this (px per ms), fading out. */
const FLING_MIN = 0.06;
const FLING_MAX = 2.4;
const FLING_DECAY_MS = 340;
/** Ground must be this far (field units) below the top of the view to count as diggable: leaves room for the shovel. */
const FLOOR_TOP_PAD = 70;
/** Mouse shovel: how quickly it catches up with the cursor (ms time constant; lower = tighter). */
const SHOVEL_FOLLOW_MS = 35;
/** Mouse shovel: tip rests at least this far above the ground and at most this far above it (field units). */
const SHOVEL_HOVER_MIN = 14;
const SHOVEL_HOVER_MAX = 130;
const SHOVEL_REST_ANGLE = 18;
/** A find texture is 160px; this display size is about 70 field units across. */
const FIND_SIZE = 70;
/** Junk is a little smaller on screen. */
const JUNK_SIZE = 56;
/** Find textures are painted at this many pixels (see ensureFindTexture). */
const FIND_TEXTURE = 160;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Linear blend of two 0xRRGGBB colours. */
function mixColor(a: number, b: number, t: number): number {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Sky tint over the working day: warm dawn, clear midday, golden late afternoon. */
const SKY_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0xffddc2],
  [0.2, 0xffffff],
  [0.7, 0xffffff],
  [1, 0xffb98a],
];

function skyTint(p: number): number {
  for (let i = 1; i < SKY_STOPS.length; i++) {
    if (p <= SKY_STOPS[i][0]) {
      const [p0, c0] = SKY_STOPS[i - 1];
      const [p1, c1] = SKY_STOPS[i];
      return mixColor(c0, c1, (p - p0) / (p1 - p0));
    }
  }
  return SKY_STOPS[SKY_STOPS.length - 1][1];
}

/** A pocket in the shaft wall holding a rock - or, now and then, a find. */
interface EmbeddedRock {
  rock: Rock | null;
  find: FindDef | null;
  /** The bobbing "?" over a find that is still a mystery. */
  mark: Phaser.GameObjects.Text | null;
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  glint: Phaser.Time.TimerEvent | null;
}

/**
 * The excavation site: a side-view cross-section dug from the top down.
 * All terrain lives in one RenderTexture we erase craters out of; a darker copy
 * of the same strata behind it becomes the wall of the shaft. The logical depth
 * of every column lives in state.dig (a heightmap), never in game objects.
 * Field coordinates: x across the pit, y downward with the grass line at SURFACE.
 */
export class DigScene extends Phaser.Scene {
  private L!: Layout;
  private sky!: Phaser.GameObjects.Image;
  private sun!: Phaser.GameObjects.Image;
  private sunRays!: Phaser.GameObjects.Image;
  private ridgeFar!: Phaser.GameObjects.Image;
  private ridgeMid!: Phaser.GameObjects.Image;
  private ridgeNear!: Phaser.GameObjects.Image;
  private clouds: Phaser.GameObjects.Image[] = [];
  private wrap!: Phaser.GameObjects.Container;
  private root!: Phaser.GameObjects.Container;
  private rockLayer!: Phaser.GameObjects.Container;
  private popLayer!: Phaser.GameObjects.Container;
  private soil!: Phaser.GameObjects.RenderTexture;
  private stamp!: Phaser.GameObjects.Image;

  private rig!: Phaser.GameObjects.Container;
  private shovel!: Phaser.GameObjects.Image;
  private swingEndsAt = 0;
  private pips!: Phaser.GameObjects.Graphics;
  private hint: Phaser.GameObjects.Container | null = null;
  private tiredText!: Phaser.GameObjects.Image;
  private rings: Phaser.GameObjects.Image[] = [];
  private ringIndex = 0;
  private glints: Phaser.GameObjects.Image[] = [];
  private glintIndex = 0;

  /** One emitter per layer so each geology throws its own kind of debris. */
  private dirtFx: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private dustFx: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private pebbleFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkleFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private crystalFx!: Phaser.GameObjects.Particles.ParticleEmitter;

  private embedded: EmbeddedRock[] = [];
  private bedrockAnnounced = false;
  private restartTimer = 0;
  private aimMark!: Phaser.GameObjects.Image;
  private fieldScale = 1;
  private visL = 0;
  private visR: number = W;
  private scrollY = 0;
  private scrollMin = 0;
  private scrollMax = 0;
  /**
   * Field y the camera wants on the focus line. It only changes when the player
   * scrolls or digs below it - never because a tap landed somewhere else.
   */
  private focusY: number = SURFACE;
  private lastX: number = W / 2;
  private holdPointer: Phaser.Input.Pointer | null = null;
  private gesturePointer: Phaser.Input.Pointer | null = null;
  private panning = false;
  private touchDownAt = 0;
  private touchHolding = false;
  private panLastY = 0;
  private panHistory: Array<{ t: number; y: number }> = [];
  private flingV = 0;
  private keyUp: Phaser.Input.Keyboard.Key | null = null;
  private keyDown: Phaser.Input.Keyboard.Key | null = null;
  private nextDigAt = 0;
  private lastFullWarning = 0;
  private lastBottomWarning = 0;
  private lastMissWarning = 0;
  private lastTouch = false;
  private skyProgress = -1;
  private emberFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private callouts: Phaser.GameObjects.Text[] = [];
  private calloutIndex = 0;
  private ghosts: Phaser.GameObjects.Image[] = [];
  private ghostIndex = 0;
  private shots: Phaser.GameObjects.Image[] = [];
  private shotIndex = 0;
  private rageShown = false;
  private nextRageEmber = 0;
  /** Rocks that popped out and have not yet been handed to the bag; each entry finishes one of them. */
  private pendingPops = new Set<() => void>();

  /** "Back to the hole" chip, shown while the last dig site is out of view. */
  private chip!: Phaser.GameObjects.Container;
  private chipBg!: Phaser.GameObjects.Graphics;
  private chipText!: Phaser.GameObjects.Text;
  private chipDir = 0;
  private readonly chipRect = new Phaser.Geom.Rectangle();

  constructor() {
    super('Dig');
  }

  create(): void {
    this.embedded = [];
    this.bedrockAnnounced = false;
    this.clouds = [];
    this.rings = [];
    this.glints = [];
    this.dirtFx = [];
    this.dustFx = [];
    this.lastX = W / 2;
    this.focusY = SURFACE;
    this.chipDir = 0;
    this.callouts = [];
    this.ghosts = [];
    this.shots = [];
    this.rageShown = false;
    this.pendingPops = new Set();
    this.cameras.main.setBackgroundColor(0x232433);

    this.buildField();
    this.buildEffects();
    this.buildShovel();
    this.buildLayerLabels();
    this.buildReturnChip();
    this.onResize();
    this.snapCamera();
    this.applyTimeOfDay(state.day.clock.progress);
    this.buildHint();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-SPACE', this.digWithKeyboard, this);
      kb.on('keydown-PAGE_UP', () => this.scrollBy(-this.L.play.h * 0.8));
      kb.on('keydown-PAGE_DOWN', () => this.scrollBy(this.L.play.h * 0.8));
      this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
      this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    }
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.on(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.events.on(Phaser.Scenes.Events.SLEEP, this.finishPops, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.finishPops();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.events.off(Phaser.Scenes.Events.WAKE, this.onWake, this);
      this.events.off(Phaser.Scenes.Events.SLEEP, this.finishPops, this);
    });
    subscribe(this, EVT.inventoryChanged, () => this.tryReleaseStuckRocks());
    subscribe(this, EVT.capacityChanged, () => this.onResize());
    subscribe(this, EVT.toolChanged, () => this.applyToolLook());
    subscribe(this, EVT.relocated, () => this.onRelocated());
    subscribe(this, EVT.runReset, () => this.onRelocated()); // a restarted run: the ground starts over too
    subscribe(this, EVT.layerEntered, () => this.cameras.main.shake(260, 0.004));
    this.cameras.main.fadeIn(250, 30, 20, 12);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100);
    this.sunRays.rotation += dt * 0.00005;
    for (const cloud of this.clouds) {
      cloud.x += cloud.getData('speed') * dt;
      if (cloud.x - cloud.displayWidth / 2 > W + 400) cloud.x = -400 - cloud.displayWidth / 2;
    }
    if (this.holdPointer) {
      if (!this.holdPointer.isDown) this.holdPointer = null;
      else if (this.inPlayArea(this.holdPointer.y)) this.tryDig(this.toFieldX(this.holdPointer.x));
    }
    if (this.panning && !this.gesturePointer?.isDown) this.panning = false;
    // Touch: a steady press digs while held; a drag scrolls and keeps gliding after release.
    const gp = this.gesturePointer;
    if (gp && gp.wasTouch && gp.isDown && !this.panning && state.canWork) {
      if (!this.touchHolding && this.time.now - this.touchDownAt >= HOLD_START_MS) this.touchHolding = true;
      if (this.touchHolding && this.inPlayArea(gp.y)) this.tryDig(this.toFieldX(gp.x));
    }
    if (this.flingV !== 0) {
      this.scrollBy(this.flingV * dt, true);
      this.flingV *= Math.exp(-dt / FLING_DECAY_MS);
      if (Math.abs(this.flingV) < 0.02) this.flingV = 0;
    }
    const keyDir = (this.keyDown?.isDown ? 1 : 0) - (this.keyUp?.isDown ? 1 : 0);
    if (keyDir !== 0) this.scrollBy((keyDir * KEY_SCROLL_SPEED * dt) / 1000);
    this.updateRage();
    this.followCursor(dt);
    this.followCamera(dt);
    this.updateReturnChip();
    const p = state.day.clock.progress;
    if (Math.abs(p - this.skyProgress) > 0.004) this.applyTimeOfDay(p);
  }

  // ---------- construction ----------

  private buildField(): void {
    makeCanvasTexture(this.textures, 'strata', W, TOTAL_H, (ctx) =>
      paintStrata(ctx, { width: W, height: TOTAL_H, surfaceY: SURFACE, bands: state.dig.bands }),
    );
    createScenicTextures(this.textures);
    makeCanvasTexture(this.textures, 'home', HOME_W, HOME_H, (ctx, w, h) => paintHome(ctx, w, h));
    makeCanvasTexture(this.textures, 'mine', HOME_W, HOME_H, (ctx, w, h) => paintMine(ctx, w, h));

    this.sky = this.add.image(-1500, -SKY_HEIGHT, SKY).setOrigin(0, 0).setDisplaySize(W + 3000, SKY_HEIGHT + SURFACE + 2);
    this.sunRays = this.add.image(0, 0, SUN_RAYS).setAlpha(0.5).setScale(1.5);
    this.sun = this.add.image(0, 0, SUN_DISC).setScale(1.55);
    for (let i = 0; i < 4; i++) {
      const cloud = this.add.image(W * (0.06 + i * 0.28), SURFACE - 230 - (i % 2) * 70 - i * 12, CLOUDS[i % CLOUDS.length]);
      cloud.setAlpha(0.96).setScale(1.15 - i * 0.1);
      cloud.setData('speed', 0.005 + i * 0.0035);
      this.clouds.push(cloud);
    }
    // Three ridges, far to near, like cut-paper stage flats; the far ones drift slower as the view scrolls.
    const ridgeX = -(RIDGE_W - W) / 2;
    this.ridgeFar = this.add.image(ridgeX, SURFACE + 8, RIDGE_FAR).setOrigin(0, 1);
    this.ridgeMid = this.add.image(ridgeX, SURFACE + 12, RIDGE_MID).setOrigin(0, 1);
    this.ridgeNear = this.add.image(ridgeX, SURFACE + 18, RIDGE_NEAR).setOrigin(0, 1);
    const home = this.add.image(W / 2 - 215, SURFACE + 6, 'home').setOrigin(0.5, 1).setScale(0.8);
    const mine = this.add.image(W / 2 + 215, SURFACE + 6, 'mine').setOrigin(0.5, 1).setScale(0.8);

    // The back wall of the shaft: the same strata, darkened. Cropped so the grass is not repeated.
    const under = this.add.image(0, 0, 'strata').setOrigin(0, 0).setTint(0x5d5a6c);
    under.setCrop(0, SURFACE + 6, W, TOTAL_H - SURFACE - 6);
    this.rockLayer = this.add.container(0, 0);
    this.soil = this.add.renderTexture(0, 0, W, TOTAL_H).setOrigin(0, 0);
    this.soil.draw('strata', 0, 0);
    // Each deposit has its own colour wash.
    this.soil.setTint(depositTint(state.progress.deposit));
    this.popLayer = this.add.container(0, 0);

    this.wrap = this.add.container(0, 0);
    this.root = this.add.container(-W / 2, 0);
    this.wrap.add(this.root);
    this.root.add([this.sky, this.sunRays, this.sun, ...this.clouds, this.ridgeFar, this.ridgeMid, this.ridgeNear, home, mine, under, this.rockLayer, this.soil, this.popLayer]);
    this.stamp = this.make.image({ key: 'hole0', add: false });
  }

  private buildEffects(): void {
    state.layers.forEach((layer) => {
      const f = layer.feel;
      this.dirtFx.push(
        this.add.particles(0, 0, 'chunk', {
          emitting: false,
          lifespan: { min: 450, max: 800 },
          speed: { min: 160, max: 420 },
          angle: { min: 205, max: 335 },
          gravityY: 1300,
          scale: { min: 0.55 * f.chunkScale, max: 1.35 * f.chunkScale },
          rotate: { min: 0, max: 360 },
          alpha: { start: 1, end: 0, ease: 'Expo.easeIn' },
          tint: [...f.chunkTints],
        }),
      );
      this.dustFx.push(
        this.add.particles(0, 0, 'soft', {
          emitting: false,
          lifespan: 600,
          speed: { min: 20, max: 90 },
          angle: { min: 190, max: 350 },
          scale: { start: 0.6, end: 2.2 },
          alpha: { start: 0.45, end: 0 },
          tint: f.dustTint,
        }),
      );
    });
    this.pebbleFx = this.add.particles(0, 0, 'pebble', {
      emitting: false,
      lifespan: 800,
      speed: { min: 260, max: 440 },
      angle: { min: 235, max: 305 },
      gravityY: 1400,
      rotate: { start: 0, end: 540 },
      scale: { min: 0.7, max: 1.2 },
      alpha: { start: 1, end: 0, ease: 'Expo.easeIn' },
    });
    this.sparkleFx = this.add.particles(0, 0, 'star', {
      emitting: false,
      lifespan: 650,
      speed: { min: 80, max: 260 },
      scale: { start: 0.7, end: 0 },
      rotate: { min: 0, max: 180 },
      tint: [0xffffff, 0xfff1a0],
      blendMode: Phaser.BlendModes.ADD,
    });
    this.crystalFx = this.add.particles(0, 0, 'star', {
      emitting: false,
      lifespan: 520,
      speed: { min: 60, max: 240 },
      angle: { min: 200, max: 340 },
      gravityY: 500,
      scale: { start: 0.5, end: 0 },
      rotate: { min: 0, max: 180 },
      tint: [0x6fe6ff, 0xb59bff, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
    });
    for (let i = 0; i < 3; i++) this.rings.push(this.add.image(0, 0, 'ring').setVisible(false).setTint(0xfff0d0));
    for (let i = 0; i < 4; i++) this.glints.push(this.add.image(0, 0, 'star').setVisible(false).setBlendMode(Phaser.BlendModes.ADD));
    this.pips = this.add.graphics().setAlpha(0);
    this.tiredText = this.add.image(0, 0, uiIcon('zzz')).setDisplaySize(64, 64).setVisible(false);
    this.emberFx = this.add.particles(0, 0, 'soft', {
      emitting: false,
      lifespan: 520,
      speed: { min: 40, max: 200 },
      angle: { min: 235, max: 305 },
      gravityY: -120,
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xff5a2a, 0xff9a3a, 0xffd36a],
      blendMode: Phaser.BlendModes.ADD,
    });
    for (let i = 0; i < 3; i++) this.callouts.push(this.add.text(0, 0, '', outlinedStyle(46, '#ffffff')).setOrigin(0.5).setVisible(false));
    for (let i = 0; i < 8; i++) this.shots.push(this.add.image(0, 0, 'pebble').setVisible(false).setTint(0xffe9a8));
    this.popLayer.add([
      ...this.rings, ...this.dustFx, ...this.dirtFx, this.pebbleFx, this.sparkleFx, this.crystalFx, this.emberFx, ...this.glints, this.pips,
      ...this.shots, ...this.callouts,
    ]);
  }

  private buildShovel(): void {
    const tool = state.tool;
    this.shovel = this.add.image(0, 0, tool.textureKey).setOrigin(0.5, SHOVEL.tipY / SHOVEL.height).setScale(SHOVEL_SCALE);
    this.rig = this.add.container(W / 2 + 60, SURFACE - 70, [this.shovel]).setAngle(14);
    // A soft shadow on the ground where the next swing will land.
    this.aimMark = this.add.image(0, 0, 'soft').setTint(0x1a0f08).setScale(0.95, 0.24).setAlpha(0);
    for (let i = 0; i < 3; i++) {
      this.ghosts.push(
        this.add.image(0, 0, tool.textureKey).setOrigin(0.5, SHOVEL.tipY / SHOVEL.height).setScale(SHOVEL_SCALE).setVisible(false).setBlendMode(Phaser.BlendModes.ADD),
      );
    }
    this.popLayer.add([this.aimMark, ...this.ghosts, this.rig, this.tiredText]);
    this.applyToolLook();
    // Gentle idle sway on the inner image so swings (on the rig) never fight it.
    this.tweens.add({ targets: this.shovel, angle: { from: -2.5, to: 2.5 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** A fresh deposit: fade out, rebuild the ground from scratch, fade back in. */
  private onRelocated(): void {
    const cam = this.cameras.main;
    // `force` matters: a fade already running (the fade-in after waking from the workshop) would otherwise swallow
    // this one, the restart would never happen and the old terrain, with its holes, would stay.
    cam.fade(380, 20, 12, 8, true);
    // A plain timer, not the fade's completion event: a scene that slept in the workshop, or one whose fade was
    // interrupted, never fires it, and then the old terrain (and the hole in it) would stay.
    if (this.restartTimer) window.clearTimeout(this.restartTimer);
    this.restartTimer = window.setTimeout(() => {
      this.restartTimer = 0;
      this.scene.restart();
    }, 420);
  }

  /** The equipped tool's own in-world sprite. Called at start and whenever the tool changes. */
  private applyToolLook(): void {
    this.shovel.setTexture(state.tool.textureKey);
    if (this.rageShown) this.shovel.setTint(0xff6a4a);
    else this.shovel.clearTint();
  }

  /** Small depth labels where each new layer begins, written into the dirt. */
  private buildLayerLabels(): void {
    for (const band of state.dig.bands) {
      if (band.index === 0) continue;
      const meters = (band.top - SURFACE) / WORLD.unitsPerMeter;
      const label = this.add
        .text(W / 2, band.top + 30, `${Math.round(meters)} m`, outlinedStyle(22, '#fff3dc'))
        .setOrigin(0.5)
        .setAlpha(0.8);
      this.popLayer.add(label);
    }
  }

  private buildHint(): void {
    const arrow = this.add.graphics();
    arrow.fillStyle(0x3b2616).fillTriangle(-17, 4, 17, 4, 0, 30);
    arrow.fillStyle(0xffffff).fillTriangle(-12, 6, 12, 6, 0, 24);
    this.hint = this.add.container(W / 2, SURFACE - 38, [arrow]);
    this.popLayer.add(this.hint);
    this.tweens.add({ targets: this.hint, y: this.hint.y - 12, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ---------- layout & camera ----------

  private onResize(): void {
    const { width: w, height: h } = this.scale;
    const L = (this.L = computeLayout(w, h, state.inventory.capacity));
    // Never show empty space beside the pit; never shrink the pit below a readable width.
    const lower = L.play.w / W;
    const upper = Math.min(L.play.w / WORLD.minVisibleWidth, WORLD.maxScale);
    const s = Math.max(lower, Math.min(upper, L.play.h / WORLD.viewHeight));
    this.fieldScale = s;
    this.wrap.setPosition(w / 2, 0).setScale(s);
    this.visL = Math.max(20, W / 2 - w / 2 / s + 20);
    this.visR = Math.min(W - 20, W / 2 + w / 2 / s - 20);

    const startSurfaceScreenY = L.play.y + L.play.h * WORLD.startSurfaceFraction;
    this.scrollMin = SURFACE - startSurfaceScreenY / s;
    this.scrollMax = Math.max(this.scrollMin, TOTAL_H - h / s);
    // Keep looking at the same spot of the ground when the window changes shape.
    this.setFocus(this.focusY, true);
    this.placeReturnChip();
  }

  /** Screen y of the line the camera tries to keep the digging point on. */
  private focusScreenY(): number {
    return this.L.play.y + this.L.play.h * WORLD.cameraFocus;
  }

  private scrollFor(focusY: number): number {
    return clamp(focusY - this.focusScreenY() / this.fieldScale, this.scrollMin, this.scrollMax);
  }

  /** Point the camera at a field y. Eased unless instant. Always stays inside the world. */
  private setFocus(focusY: number, instant = false): void {
    const offset = this.focusScreenY() / this.fieldScale;
    this.focusY = clamp(focusY, this.scrollMin + offset, this.scrollMax + offset);
    if (instant) {
      this.scrollY = this.scrollFor(this.focusY);
      this.applyScroll();
    }
  }

  /** The player scrolls the view by some screen pixels (positive = further down). */
  private scrollBy(screenPx: number, instant = false): void {
    this.setFocus(this.focusY + screenPx / this.fieldScale, instant);
  }

  /** Back to the last dig site: the floor of the hole goes on the focus line. */
  private snapCamera(): void {
    this.setFocus(state.dig.floorAt(this.lastX), true);
  }

  private returnToHole(): void {
    this.setFocus(state.dig.floorAt(this.lastX));
  }

  /**
   * Digging deeper pulls the view down so the hole stays on screen. It never pulls
   * it up or sideways: a tap on some other spot must not make the camera jump.
   */
  private followFloor(floorY: number): void {
    if (floorY > this.focusY) this.setFocus(floorY);
  }

  /** Frame-rate independent ease toward the wanted view. */
  private followCamera(dt: number): void {
    const diff = this.scrollFor(this.focusY) - this.scrollY;
    if (Math.abs(diff) < 0.05) return;
    this.scrollY += diff * (1 - Math.exp(-dt / 140));
    this.applyScroll();
  }

  /** Is ground at this field y on screen, with room for the shovel above it? */
  private floorInView(floorY: number): boolean {
    const sy = (floorY - this.scrollY) * this.fieldScale;
    return sy >= this.L.play.y + FLOOR_TOP_PAD * this.fieldScale && sy <= this.L.play.y + this.L.play.h - 6;
  }

  /**
   * The column to dig for a tap at x: the tapped one when its ground is on screen,
   * else the nearest dug-out ground within aimAssist, else null (nothing to dig there).
   */
  private aim(x: number): number | null {
    const dig = state.dig;
    if (this.floorInView(dig.floorAt(x))) return x;
    const step = WORLD.columnWidth;
    for (let d = step; d <= GAME_CONFIG.dig.aimAssist; d += step) {
      for (const cx of [x - d, x + d]) {
        if (cx >= this.visL && cx <= this.visR && this.floorInView(dig.floorAt(cx))) return cx;
      }
    }
    return null;
  }

  // ---------- "back to the hole" chip ----------

  private buildReturnChip(): void {
    this.chipBg = this.add.graphics();
    this.chipText = this.add.text(12, 0, '', outlinedStyle(16, '#fff6e6')).setOrigin(0.5);
    this.chip = this.add.container(0, 0, [this.chipBg, this.chipText]).setDepth(30).setVisible(false);
  }

  /** Shown only while the last dig site is off screen; points toward it. */
  private updateReturnChip(): void {
    const floorY = state.dig.floorAt(this.lastX);
    let dir = 0;
    if (!this.floorInView(floorY)) dir = floorY < this.scrollY + this.L.play.h / (2 * this.fieldScale) ? -1 : 1;
    if (dir === this.chipDir) return;
    this.chipDir = dir;
    this.placeReturnChip();
  }

  private placeReturnChip(): void {
    const dir = this.chipDir;
    this.chip.setVisible(dir !== 0);
    if (dir === 0) return;
    const L = this.L;
    const h = L.compact ? 30 : 34;
    const w = 58; // just an arrow, no words
    const x = L.w / 2;
    const y = dir < 0 ? L.play.y + 70 : L.play.y + L.play.h - 30;
    this.chip.setPosition(x, y);
    const g = this.chipBg;
    g.clear();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 3, w, h, h / 2);
    g.fillStyle(PALETTE.tray, 0.94).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.lineStyle(2, PALETTE.gold, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    const ax = 0;
    g.fillStyle(0xffd23f);
    if (dir < 0) g.fillTriangle(ax - 8, 5, ax + 8, 5, ax, -7);
    else g.fillTriangle(ax - 8, -5, ax + 8, -5, ax, 7);
    this.chipRect.setTo(x - w / 2 - 6, y - h / 2 - 6, w + 12, h + 12);
  }

  private chipHit(pointer: Phaser.Input.Pointer): boolean {
    return this.chip.visible && this.chipRect.contains(pointer.x, pointer.y);
  }

  private applyScroll(): void {
    // Snap to whole screen pixels so the terrain never shimmers while scrolling.
    this.root.y = -Math.round(this.scrollY * this.fieldScale) / this.fieldScale;
    // Parallax: the distant ridges lag behind the ground as the view scrolls.
    this.ridgeFar.y = SURFACE + 8 + this.scrollY * 0.5;
    this.ridgeMid.y = SURFACE + 12 + this.scrollY * 0.25;
  }

  private applyTimeOfDay(p: number): void {
    this.skyProgress = p;
    const tint = skyTint(p);
    this.sky.setTint(tint);
    const sunColor = mixColor(0xfff3b0, 0xffa94d, Math.max(0, (p - 0.6) / 0.4));
    const sx = Phaser.Math.Linear(W * 0.12, W * 0.88, p);
    const sy = SURFACE - 90 - Math.sin(Math.PI * p) * 150;
    this.sun.setPosition(sx, sy).setTint(sunColor);
    this.sunRays.setPosition(sx, sy).setTint(sunColor);
    // The mountains and hills take the light too, the far ones most.
    this.ridgeFar.setTint(mixColor(0xffffff, tint, 0.8));
    this.ridgeMid.setTint(mixColor(0xffffff, tint, 0.55));
    this.ridgeNear.setTint(mixColor(0xffffff, tint, 0.3));
  }

  private toFieldX(sx: number): number {
    return clamp((sx - this.wrap.x) / this.fieldScale + W / 2, this.visL, this.visR);
  }

  private inPlayArea(sy: number): boolean {
    return sy >= this.L.play.y && sy <= this.L.play.y + this.L.play.h;
  }

  // ---------- input ----------

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.inPlayArea(pointer.y)) return;
    this.lastTouch = pointer.wasTouch;
    if (this.chipHit(pointer)) {
      this.returnToHole();
      return;
    }
    this.flingV = 0;
    if (pointer.wasTouch) {
      // Touch: a press only starts a gesture. A quick tap digs on release, a steady press digs
      // while held, and a drag scrolls - so scrolling never swings the shovel by accident.
      if (this.gesturePointer?.isDown && this.gesturePointer !== pointer) return; // one finger at a time
      this.gesturePointer = pointer;
      this.panning = false;
      this.touchHolding = false;
      this.holdPointer = null;
      this.touchDownAt = this.time.now;
      this.panLastY = pointer.y;
      this.panHistory = [];
      return;
    }
    this.gesturePointer = pointer;
    this.panning = false;
    this.holdPointer = pointer;
    this.tryDig(this.toFieldX(pointer.x));
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    this.lastTouch = pointer.wasTouch;
    if (pointer.wasTouch) this.touchPan(pointer);
    // Mouse: the shovel follows the cursor every frame (see followCursor).
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch || pointer !== this.gesturePointer) return;
    const quick = this.time.now - this.touchDownAt < TAP_MAX_MS;
    if (!this.panning && !this.touchHolding && quick) this.tryDig(this.toFieldX(pointer.x));
    // Let a fast flick keep gliding. Speed comes from the last ~110 ms of the drag, never from one frame.
    if (this.panning) {
      const h = this.panHistory;
      const first = h[0];
      const last = h[h.length - 1];
      const span = first && last ? last.t - first.t : 0;
      if (span >= 30 && this.time.now - last.t < 90) {
        const v = (first.y - last.y) / span;
        if (Math.abs(v) > FLING_MIN) this.flingV = clamp(v, -FLING_MAX, FLING_MAX);
      }
    }
    this.panning = false;
    this.touchHolding = false;
  }

  /**
   * With a mouse, the shovel's tip is glued to the cursor: it tracks the pointer
   * (smoothly, ~35 ms behind), leans into the direction of travel, and never goes
   * below the ground or too far above it. It keeps following while you scroll the
   * view or hold the button; only a swing in progress takes it over.
   */
  private followCursor(dt: number): void {
    if (!state.canWork || this.time.now < this.swingEndsAt) {
      this.aimMark.setAlpha(0);
      return;
    }
    // Touch: the shovel follows the finger sideways while it rests on the screen, and stays
    // put (no tug-of-war) while the view scrolls. Mouse: it follows the cursor.
    const touch = this.lastTouch;
    const gp = this.gesturePointer;
    if (touch && (!gp || !gp.isDown || this.panning)) {
      this.aimMark.setAlpha(0);
      return;
    }
    const pointer = touch && gp ? gp : this.input.activePointer;
    if (!this.inPlayArea(pointer.y)) return;
    const x = this.aim(this.toFieldX(pointer.x));
    if (x === null) return; // over the bare wall: stay where we are
    const floorY = state.dig.floorAt(x);
    const cursorY = touch ? floorY - 70 : pointer.y / this.fieldScale + this.scrollY;
    // Tip at the cursor, but resting just above the ground and not floating too high.
    const targetY = clamp(cursorY, floorY - SHOVEL_HOVER_MAX, floorY - SHOVEL_HOVER_MIN);
    const k = 1 - Math.exp(-dt / SHOVEL_FOLLOW_MS);
    const dx = (x - this.rig.x) * k;
    this.rig.x += dx;
    this.rig.y += (targetY - this.rig.y) * k;
    this.lastX = x;
    this.aimMark.setPosition(x, floorY + 3).setAlpha(0.3);
    const lean = clamp(dx * 2.2, -14, 14);
    this.rig.angle += (SHOVEL_REST_ANGLE + lean - this.rig.angle) * k;
  }

  /** Dragging a finger scrolls the view: 1:1 with the finger, and it cancels the dig that touch started. */
  private touchPan(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown || pointer !== this.gesturePointer || this.touchHolding) return;
    if (!this.panning && Math.abs(pointer.y - pointer.downY) > TOUCH_PAN_THRESHOLD) {
      this.panning = true;
      this.holdPointer = null;
      this.panLastY = pointer.y; // the view follows the finger from here, no jump
      this.panHistory = [];
    }
    if (!this.panning) return;
    const now = this.time.now;
    const dy = this.panLastY - pointer.y;
    this.panLastY = pointer.y;
    this.panHistory.push({ t: now, y: pointer.y });
    while (this.panHistory.length > 2 && now - this.panHistory[0].t > 110) this.panHistory.shift();
    this.scrollBy(dy, true);
  }

  private onWheel(pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    const lines = (pointer.event as WheelEvent | undefined)?.deltaMode === 1;
    this.scrollBy((lines ? dy * 32 : dy) * WHEEL_GAIN);
  }

  private digWithKeyboard(): void {
    // Space means "dig where I was digging": if that hole is out of view, bring the view back first.
    if (!this.floorInView(state.dig.floorAt(this.lastX))) {
      this.returnToHole();
      return;
    }
    // With a mouse the shovel is already where the cursor is: dig exactly there.
    const jitter = this.lastTouch ? range(Math.random, -22, 22) : 0;
    this.tryDig(clamp(this.lastX + jitter, this.visL, this.visR));
  }

  // ---------- digging ----------

  /** A tap landed where there is nothing to dig (the wall of the shaft, ground that is out of view). */
  private missedAim(): void {
    const now = this.time.now;
    if (now - this.lastMissWarning < 900) return;
    this.lastMissWarning = now;
    sfx.denied(); // no sentence: the shovel simply does not bite
  }

  /** Touch is imprecise: a tap beside the hole still digs the hole, as long as its floor is on screen. */
  private fallbackAim(): number | null {
    if (!this.lastTouch) return null;
    const x = clamp(this.lastX, this.visL, this.visR);
    return this.floorInView(state.dig.floorAt(x)) ? x : null;
  }

  private tryDig(tapX: number): void {
    if (!state.canWork) return;
    const now = this.time.now;
    if (now < this.nextDigAt) return;
    const x = this.aim(tapX) ?? this.fallbackAim();
    if (x === null) {
      this.nextDigAt = now + 350;
      this.missedAim();
      return;
    }
    const dig = state.dig;
    if (dig.isBottom(x)) {
      this.nextDigAt = now + 500;
      if (now - this.lastBottomWarning > 2500) {
        this.lastBottomWarning = now;
        state.bus.emit(EVT.bedrock);
      }
      return;
    }
    const layer = dig.layerAt(x);
    const traits = state.traits;
    const cost = state.tool.staminaMult * layer.staminaMult * traits.staminaMult(now);
    let paid = state.stamina.trySpend(cost);
    if (!paid) {
      // Second Wind: once a day, running dry gives a breather instead.
      const wind = traits.trySecondWind(state.day.day);
      if (wind > 0) {
        state.stamina.restore(state.stamina.max * wind);
        sfx.wind();
        this.callout('SECOND WIND!', x, dig.floorAt(x) - 120, '#8dff9a');
        paid = state.stamina.trySpend(cost);
      }
    }
    if (!paid) {
      this.nextDigAt = now + 450;
      this.showTired(x);
      return;
    }
    const roll = traits.rollSwing(x, now);
    // Hard ground makes the swing heavier and slower, not just less effective; a rage makes it faster.
    this.nextDigAt = now + state.tool.swingCooldownMs * (1 + 0.5 * layer.feel.clang) * traits.cooldownMult(now);
    this.swing(x, layer.feel.clang, roll);
  }

  /** Gameplay timing runs on the scene clock; tweens are purely cosmetic. */
  private swing(x: number, clang: number, roll: SwingRoll): void {
    const plungeMs = state.tool.plungeMs * (1 + 0.6 * clang) * (roll.raging ? 0.7 : 1);
    const floorY = state.dig.floorAt(x);
    this.lastX = x;
    this.swingEndsAt = this.time.now + plungeMs + 190;
    state.beginActivity();
    if (roll.rageStarted) this.onRageStart(x);
    this.tweens.killTweensOf(this.rig);
    if (Phaser.Math.Distance.Between(this.rig.x, this.rig.y, x, floorY) > 160) {
      this.rig.setPosition(x + 20, floorY - 60).setAngle(30);
    }
    this.tweens.add({ targets: this.rig, x, y: floorY + 6, angle: 4, duration: plungeMs, ease: 'Quad.easeIn' });
    if (state.tool.motion === 'jitter') {
      // Hammers and drills shake while they bite instead of only swinging down.
      this.tweens.add({
        targets: this.shovel,
        x: { from: -1.6, to: 1.6 },
        yoyo: true,
        repeat: Math.max(1, Math.round(plungeMs / 40)),
        duration: 40,
        onComplete: () => this.shovel.setX(0),
      });
    }
    this.time.delayedCall(plungeMs, () => {
      this.impact(x, roll);
      const squash = 1 + clang;
      this.shovel.setScale(SHOVEL_SCALE * (1 + 0.08 * squash), SHOVEL_SCALE * (1 - 0.12 * squash));
      this.tweens.add({ targets: this.shovel, scaleX: SHOVEL_SCALE, scaleY: SHOVEL_SCALE, duration: 200, ease: 'Back.easeOut' });
      this.tweens.killTweensOf(this.rig);
      const upY = state.dig.floorAt(x) - 40 - 14 * clang;
      this.tweens.add({ targets: this.rig, x: x + 16, y: upY, angle: 24 + 10 * clang, duration: 170, ease: 'Back.easeOut' });
      this.time.delayedCall(190, () => state.endActivity());
    });
  }

  /** The tool bites: digs its own shape of hole, then rolls for rocks. Ghost swings (After Image) cost nothing and echo no skills. */
  private impact(x: number, roll: SwingRoll = PLAIN_SWING, ghost = false): void {
    const res = this.digAt(x, roll.depth !== 1 || roll.width !== 1 ? roll : undefined, ghost);
    const feel = res.layer.feel;
    const y = res.floorBefore;
    const target = this.strikeTarget(x, y);
    sfx.dig(!!target, feel.clang);
    this.ring(x, y);
    // The swing that reaches bedrock: offer a new deposit once the dust settles.
    if (!this.bedrockAnnounced && state.dig.atBottom) {
      this.bedrockAnnounced = true;
      this.time.delayedCall(900, () => state.bus.emit(EVT.bedrock));
    }
    const touch = this.sys.game.device.input.touch ? 0.6 : 1;
    this.cameras.main.shake(roll.bigHole ? 240 : 100, feel.shake * touch * (roll.bigHole ? 2.4 : ghost ? 0.5 : 1));
    this.dismissHint();

    if (target) {
      this.hitEmbedded(target);
    } else if (this.embedded.length >= GAME_CONFIG.dig.maxEmbeddedRocks) {
      state.discovery.skip();
    } else if (res.dug && state.discovery.roll(res.layer, Math.random)) {
      const value = (res.layer.discovery.valueMult ?? 1) * state.depositValueMult;
      this.embedRock(res.cx, res.layer.discovery.rarityWeights, res.layer.discovery.freeHits, value, res.layerIndex);
      // Double Find: sometimes the dig turns up a second rock beside the first.
      if (state.traits.rollDoubleFind() && this.embedded.length <= GAME_CONFIG.dig.maxEmbeddedRocks) {
        this.embedRock(res.cx, res.layer.discovery.rarityWeights, res.layer.discovery.freeHits, value, res.layerIndex, (Math.random() < 0.5 ? -1 : 1) * 84);
        this.callout('DOUBLE FIND!', res.cx, y - 130, '#ffe27a');
      }
    } else if (res.dug) {
      const def = state.finds.roll(res.layerIndex, Math.random, (id) => state.findsInv.collectionCount(id) > 0);
      if (def) this.embedFind(res.cx, def);
    }

    if (ghost) return;
    if (roll.bigHole) {
      this.callout('BIG HOLE!', x, y - 120, '#ffb347');
      sfx.blast(0.6);
      this.dirtFx[res.layerIndex].explode(22, x, y);
    }
    if (roll.afterimage) this.spawnAfterimage(x);
    if (roll.shots > 0) this.fireScrapShots(x, roll.shots, res.floorAfter - res.floorBefore);
  }

  /** Digs at x with the equipped tool and paints every part of its hole. Shared by swings, ghosts and blasts. */
  private digAt(x: number, boost: DigBoost | undefined, quiet: boolean): DigResult {
    const res = state.dig.dig(x, state.tool, boost);
    const feel = res.layer.feel;
    const y = res.floorBefore;
    if (res.dug) {
      for (const p of res.parts) this.paintCrater(p.cx, p.cy, p.rx, p.ry, p.profile, false);
      this.followFloor(state.dig.floorAt(x));
      const lite = this.sys.game.device.input.touch ? 0.65 : 1; // phones: fewer particles
      const chunks = Math.max(3, Math.round(feel.chunks * (0.55 + 0.45 * res.efficiency) * lite * (quiet ? 0.6 : 1)));
      this.dirtFx[res.layerIndex].explode(chunks, x, y);
      this.dustFx[res.layerIndex].explode(3, x, y - 6);
      if (!quiet && Math.random() < GAME_CONFIG.dig.pebbleChance * (0.6 + feel.clang)) this.pebbleFx.explode(1, x, y);
      if (feel.sparks > 0 && Math.random() < 0.7) this.crystalFx.explode(feel.sparks, x, y - 4);
    }
    return res;
  }

  /**
   * The embedded rock a swing at x strikes, or null. It must be beside the swing and at most `strikeRise` above the
   * floor (or just below it): the shaft may have gone down past it, and it still counts. The closest one wins.
   */
  private strikeTarget(x: number, floorY: number): EmbeddedRock | null {
    let best: EmbeddedRock | null = null;
    let bestD = Infinity;
    for (const b of this.embedded) {
      const dx = Math.abs(b.x - x);
      const above = floorY - b.y;
      if (dx > b.r + GAME_CONFIG.dig.nearHitPadding || above > GAME_CONFIG.dig.strikeRise || above < -(b.r + GAME_CONFIG.dig.nearHitPadding)) continue;
      const d = dx + Math.abs(above) * 0.25;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  // ---------- terrain painting ----------

  /** Carve the heightmap and erase the same shape from the visible soil. */
  private paintCrater(cx: number, cy: number, rx: number, ry: number, profile: Profile = 'round', carve = true): void {
    if (carve) state.dig.carve(cx, cy, rx, ry, profile);
    this.stamp
      .setTexture(this.stampKey(profile))
      .setScale(rx / HOLE_RADIUS, ry / HOLE_RADIUS)
      .setFlipX(Math.random() < 0.5)
      .setRotation(0)
      .setAlpha(1);
    this.soil.erase(this.stamp, cx, cy);
  }

  private stampKey(profile: Profile): string {
    switch (profile) {
      case 'scoop': return 'hole-scoop';
      case 'vee': return 'hole-vee';
      case 'tube': return 'hole-tube';
      case 'ragged': return 'hole-ragged' + intRange(Math.random, 0, 1);
      default: return 'hole' + intRange(Math.random, 0, HOLE_VARIANTS - 1);
    }
  }

  // ---------- rocks ----------

  /** A swing turns up a rock: it appears half-buried in the floor of the shaft. */
  private embedRock(
    nearX: number,
    rarityWeights: readonly number[],
    freeHits: { min: number; max: number },
    valueMult = 1,
    layerIndex = 0,
    sideOffset = 0,
  ): void {
    const rock = generateRock(Math.random, rarityWeights, valueMult, layerIndex);
    ensureRockTextures(this.textures, rock);
    const k = GAME_CONFIG.rock.discoveryScale;
    const r = GAME_CONFIG.rock.baseRadius * rock.size * k;
    const x = clamp(nearX + sideOffset + range(Math.random, -18, 18), r + 14, W - r - 14);
    // On the floor of the shaft that was just dug, not on the ground beside it: a narrow bore or spike leaves a needle-thin
    // shaft, and the ground next to it can be thousands of units higher.
    const y = state.dig.floorAt(nearX) + r * GAME_CONFIG.dig.rockSinkFactor;
    const sprite = this.add.image(x, y + 24, rockKeys(rock).outside).setScale(0).setAngle(range(Math.random, -20, 20));
    this.rockLayer.add(sprite);
    const maxHp = intRange(Math.random, freeHits.min, freeHits.max);
    const b: EmbeddedRock = { rock, find: null, mark: null, sprite, x, y, r, hp: maxHp, maxHp, glint: null };
    this.embedded.push(b);
    this.tweens.add({ targets: sprite, y, scale: k / ART_RES, duration: 280, ease: 'Back.easeOut' });
    // Open a pocket around its top so the find is clearly visible, never just a sliver.
    this.paintCrater(x, y - r * 0.3, r * 0.8, r * 0.62);
    sfx.collect();
    this.sparkleFx.explode(6, x, y - r * 0.5);
    this.showPips(b);
    if (rock.sparkly) {
      b.glint = this.time.addEvent({ delay: range(Math.random, 1400, 2400), loop: true, callback: () => this.glint(b) });
    }
  }

  private hitEmbedded(b: EmbeddedRock): void {
    // Quick Crack: now and then one hit is enough.
    const instant = !!b.rock && state.traits.rollInstantCrack();
    b.hp = instant ? 0 : Math.max(0, b.hp - 1);
    if (instant) this.callout('CRACK!', b.x, b.y - b.r - 50, '#ffe27a');
    const frac = 1 - b.hp / b.maxHp;
    this.paintCrater(
      b.x + range(Math.random, -0.3, 0.3) * b.r,
      b.y - b.r * 0.1,
      b.r * (0.62 + 0.45 * frac),
      b.r * (0.55 + 0.4 * frac),
    );
    const layerIndex = state.dig.layerIndexAtY(b.y);
    this.dirtFx[layerIndex].explode(6, b.x, b.y - b.r * 0.3);
    this.tweens.add({ targets: b.sprite, angle: b.sprite.angle + Phaser.Math.Between(-9, 9), duration: 90, yoyo: true, ease: 'Sine.easeOut' });
    this.showPips(b);
    if (b.hp > 0.001) return;
    // A worthless rock may still go hot (and never reach the bag), so a full bag does not block it.
    if (b.rock && state.inventory.isFull && !state.traits.mayGoHot(b.rock)) {
      b.hp = 0.01;
      if (this.time.now - this.lastFullWarning > 2500) {
        this.lastFullWarning = this.time.now;
        sfx.denied();
      }
      return;
    }
    this.unearth(b);
  }

  private showPips(b: EmbeddedRock): void {
    const g = this.pips;
    const n = b.maxHp;
    const done = Math.min(n, Math.round((b.maxHp - b.hp) * 100) / 100);
    const spacing = 22;
    const x0 = b.x - ((n - 1) * spacing) / 2;
    const y = b.y - b.r - 28;
    g.clear();
    for (let i = 0; i < n; i++) {
      const fill = Phaser.Math.Clamp(done - i, 0, 1);
      g.fillStyle(0x3b2616, 0.85).fillCircle(x0 + i * spacing, y, 9);
      if (fill > 0) g.fillStyle(0xffd23f).fillCircle(x0 + i * spacing, y, 6 * Math.sqrt(fill));
    }
    this.tweens.killTweensOf(g);
    g.setAlpha(1);
    this.tweens.add({ targets: g, alpha: 0, delay: 1100, duration: 400 });
  }

  private glint(b: EmbeddedRock): void {
    const star = this.glints[this.glintIndex++ % this.glints.length];
    this.tweens.killTweensOf(star);
    star
      .setPosition(b.x + range(Math.random, -0.5, 0.5) * b.r, b.y + range(Math.random, -0.6, 0.2) * b.r)
      .setScale(0)
      .setAngle(0)
      .setVisible(true);
    this.tweens.add({
      targets: star, scale: 0.7, angle: 90, duration: 260, yoyo: true, ease: 'Sine.easeOut',
      onComplete: () => star.setVisible(false),
    });
  }

  private unearth(b: EmbeddedRock): void {
    if (b.find) {
      this.unearthFind(b);
      return;
    }
    const { rock, sprite } = b;
    if (!rock) return;
    if (state.traits.rollHotRock(rock)) {
      this.igniteHotRock(b);
      return;
    }
    // Take it off the list first: adding to the bag fires inventoryChanged, which looks for stuck rocks.
    this.embedded = this.embedded.filter((o) => o !== b);
    if (state.inventory.add(rock) < 0) {
      this.embedded.push(b);
      return;
    }
    b.glint?.remove();
    state.recordFind();
    state.beginActivity();

    const layerIndex = state.dig.layerIndexAtY(b.y);
    this.paintCrater(b.x, b.y - b.r * 0.1, b.r * 1.25, b.r * 1.15);
    this.dirtFx[layerIndex].explode(24, b.x, b.y);
    this.dustFx[layerIndex].explode(7, b.x, b.y - b.r * 0.5);
    this.pebbleFx.explode(2, b.x, b.y);
    if (rock.sparkly) this.sparkleFx.explode(10, b.x, b.y);
    this.cameras.main.shake(140, 0.004);
    sfx.discover();

    // Pop out: squash, leap, land, then hand off to the HUD's flight to the bag.
    this.rockLayer.remove(sprite);
    this.popLayer.addAt(sprite, 0);
    const base = GAME_CONFIG.rock.discoveryScale / ART_RES;
    const landY = b.y - b.r * 0.2;
    this.tweens.killTweensOf(sprite);
    this.tweens.chain({
      targets: sprite,
      tweens: [
        { scaleX: base * 1.3, scaleY: base * 0.72, duration: 70, ease: 'Quad.easeOut' },
        { y: landY - 150, scaleX: base * 0.86, scaleY: base * 1.18, angle: sprite.angle + 160, duration: 280, ease: 'Quad.easeOut' },
        { y: landY - 20, scaleX: base, scaleY: base, angle: sprite.angle + 360, duration: 230, ease: 'Quad.easeIn' },
        { scaleX: base * 1.2, scaleY: base * 0.82, duration: 70, yoyo: true, ease: 'Quad.easeOut' },
        { scaleX: base, scaleY: base, duration: 120 },
      ],
    });
    // The hand-off to the bag runs on the scene clock, which stops while the workshop is open. Without the safety net
    // below, a rock sold in the workshop would lose its texture while this sprite still draws it, and the next frame would throw.
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      this.pendingPops.delete(finish);
      const m = sprite.getWorldTransformMatrix();
      state.bus.emit(EVT.rockCollected, rock, m.tx, m.ty, base * this.fieldScale);
      this.tweens.killTweensOf(sprite);
      sprite.destroy();
      state.endActivity();
    };
    this.pendingPops.add(finish);
    this.time.delayedCall(860, finish);
  }

  /** The scene is about to sleep or close: every rock that is still popping out goes to the bag now. */
  private finishPops(): void {
    for (const finish of [...this.pendingPops]) finish();
  }

  /** A buried object: shows up as a dark silhouette with a "?" until it is dug free. */
  private embedFind(nearX: number, def: FindDef): void {
    const junk = def.category === 'junk';
    const size = junk ? JUNK_SIZE : FIND_SIZE;
    const r = size * 0.7;
    const scale = size / FIND_TEXTURE;
    const x = clamp(nearX + range(Math.random, -18, 18), r + 14, W - r - 14);
    const y = state.dig.floorAt(nearX) + r * GAME_CONFIG.dig.rockSinkFactor;
    const key = ensureFindTexture(this.textures, def);
    const sprite = this.add.image(x, y + 24, key).setScale(0).setTintFill(0x120a06).setAngle(range(Math.random, -12, 12));
    this.rockLayer.add(sprite);
    const maxHp = junk ? 1 : intRange(Math.random, 1, 2);
    // The colour of the "?" hints at the kind: gold artifact, teal collection item, grey rubbish.
    const mark = this.add
      .text(x, y - r - 30, '?', outlinedStyle(junk ? 30 : 40, CATEGORY_STYLE[def.category].css))
      .setOrigin(0.5)
      .setScale(0);
    this.popLayer.add(mark);
    const b: EmbeddedRock = { rock: null, find: def, mark, sprite, x, y, r, hp: maxHp, maxHp, glint: null };
    this.embedded.push(b);
    this.tweens.add({ targets: sprite, y, scale, duration: 280, ease: 'Back.easeOut' });
    this.tweens.add({ targets: mark, scale: 1, duration: 300, delay: 120, ease: 'Back.easeOut' });
    this.tweens.add({ targets: mark, y: mark.y - 10, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 420 });
    this.paintCrater(x, y - r * 0.3, r * 0.8, r * 0.62);
    if (!junk) {
      sfx.collect();
      sfx.haptic(12);
      this.sparkleFx.explode(8, x, y - r * 0.5);
    }
    this.showPips(b);
  }

  /**
   * A find bursts out of the ground. Artifacts make the biggest fuss, collection items a smaller
   * one, junk just flops. Nothing here pays money: the HUD card only names what it is, and
   * artifacts are sold later from the Finds screen.
   */
  private unearthFind(b: EmbeddedRock): void {
    const { find: def, sprite } = b;
    if (!def) return;
    this.embedded = this.embedded.filter((o) => o !== b);
    if (b.mark) {
      this.tweens.killTweensOf(b.mark);
      b.mark.destroy();
    }
    state.beginActivity();
    const cat = def.category;
    const junk = cat === 'junk';
    const artifact = cat === 'artifact';
    const tier = def.tier;
    const base = (junk ? JUNK_SIZE : FIND_SIZE) / FIND_TEXTURE;
    const layerIndex = state.dig.layerIndexAtY(b.y);
    this.paintCrater(b.x, b.y - b.r * 0.1, b.r * (junk ? 1.2 : 1.5), b.r * (junk ? 1.05 : 1.3));
    this.dirtFx[layerIndex].explode(junk ? 14 : 28, b.x, b.y);
    this.dustFx[layerIndex].explode(junk ? 5 : 9, b.x, b.y - b.r * 0.5);
    if (!junk) {
      this.sparkleFx.explode((artifact ? 14 : 8) + tier * (artifact ? 6 : 3), b.x, b.y - b.r * 0.4);
      this.cameras.main.shake(artifact ? 170 + tier * 60 : 120, artifact ? 0.005 + tier * 0.0018 : 0.004);
    }
    if (artifact && tier >= 3) this.cameras.main.flash(280, 255, 244, 190);
    sprite.clearTint();
    this.rockLayer.remove(sprite);
    this.popLayer.addAt(sprite, 0);

    // The player's own reaction, shouted over the hole (not for rubbish).
    if (!junk) {
      const shout = this.add.text(b.x, b.y - 110, '!', outlinedStyle(artifact ? 64 : 48, CATEGORY_STYLE[cat].css)).setOrigin(0.5).setScale(0);
      this.popLayer.add(shout);
      this.tweens.add({ targets: shout, scale: 1.1, angle: { from: -8, to: 4 }, duration: 220, ease: 'Back.easeOut' });
      this.tweens.add({ targets: shout, y: shout.y - 50, alpha: 0, delay: 800, duration: 380, onComplete: () => shout.destroy() });
    }

    const landY = b.y - b.r * 0.2;
    this.tweens.killTweensOf(sprite);
    if (junk) {
      // A dull flop: hop, land, lie there.
      this.tweens.chain({
        targets: sprite,
        tweens: [
          { y: landY - 50, scaleX: base * 1.1, scaleY: base * 0.9, angle: sprite.angle + 40, duration: 180, ease: 'Quad.easeOut' },
          { y: landY, scale: base, angle: sprite.angle + 70, duration: 170, ease: 'Quad.easeIn' },
        ],
      });
    } else {
      this.tweens.chain({
        targets: sprite,
        tweens: [
          { scaleX: base * 1.3, scaleY: base * 0.7, duration: 70, ease: 'Quad.easeOut' },
          { y: landY - 190, scaleX: base * 1.15, scaleY: base * 1.2, angle: 360, duration: 360, ease: 'Quad.easeOut' },
          { y: landY - 170, scale: base * (artifact ? 1.35 : 1.2), angle: 372, duration: 420, yoyo: true, ease: 'Sine.easeInOut' },
        ],
      });
    }

    // Record it right away (the HUD card shows at once). Never any cash here.
    const item = state.finds.makeItem(def, Math.random, state.depositValueMult);
    state.recordFindItem(def, item);
    if (artifact) {
      sfx.surprise(tier);
      sfx.haptic(tier >= 3 ? [30, 40, 70] : 25);
    } else if (cat === 'collection') {
      sfx.surprise(Math.min(2, tier));
      sfx.haptic(15);
    } else {
      sfx.collect();
    }
    this.time.delayedCall(junk ? 450 : artifact ? 900 : 700, () => {
      this.tweens.killTweensOf(sprite);
      this.tweens.add({
        targets: sprite, scale: 0, alpha: 0, y: sprite.y - (junk ? 10 : 40), duration: 260, ease: 'Back.easeIn',
        onComplete: () => {
          sprite.destroy();
          state.endActivity();
        },
      });
    });
  }

  /** After selling frees a slot, rocks that were dug out but blocked by a full bag pop right away. */
  private tryReleaseStuckRocks(): void {
    if (state.inventory.isFull) return;
    const stuck = this.embedded.find((b) => b.hp <= 0.01);
    if (stuck && this.scene.isActive()) this.unearth(stuck);
  }

  // ---------- skills ----------

  /** A short word over the hole: BIG HOLE!, ANGRY!, CRACK!... */
  private callout(text: string, x: number, y: number, color: string): void {
    const t = this.callouts[this.calloutIndex++ % this.callouts.length];
    this.tweens.killTweensOf(t);
    t.setText(text).setColor(color).setPosition(clamp(x, this.visL + 120, this.visR - 120), y).setAlpha(1).setScale(0.4).setVisible(true);
    this.tweens.add({ targets: t, scale: 0.85, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, delay: 650, duration: 420, onComplete: () => t.setVisible(false) });
  }

  /** Angry Shoveler: the digger snaps. */
  private onRageStart(x: number): void {
    this.callout('ANGRY!', x, state.dig.floorAt(x) - 130, '#ff6a4a');
    this.cameras.main.shake(220, 0.006);
    sfx.rage();
    this.emberFx.explode(14, this.rig.x, this.rig.y - 30);
  }

  /** The rage look: a red shovel and rising embers for as long as it lasts. */
  private updateRage(): void {
    const now = this.time.now;
    const raging = state.traits.raging(now);
    if (raging !== this.rageShown) {
      this.rageShown = raging;
      if (raging) this.shovel.setTint(0xff6a4a);
      else this.applyToolLook();
    }
    if (raging && now >= this.nextRageEmber) {
      this.nextRageEmber = now + 70;
      this.emberFx.explode(1, this.rig.x + range(Math.random, -10, 10), this.rig.y - 40);
    }
  }

  /** After Image: a ghost copy of the tool drops in a moment later and digs the same spot for free. */
  private spawnAfterimage(x: number): void {
    const E = TRAIT_EFFECTS.afterimage;
    const ghost = this.ghosts[this.ghostIndex++ % this.ghosts.length];
    const floorY = state.dig.floorAt(x);
    this.tweens.killTweensOf(ghost);
    ghost.setTexture(state.tool.textureKey).setVisible(true).setAlpha(0).setTint(0x9fe8ff).setPosition(x + 36, floorY - 120).setAngle(26);
    this.tweens.add({ targets: ghost, alpha: 0.75, duration: 140 });
    this.callout('AFTER IMAGE!', x, floorY - 150, '#9fe8ff');
    sfx.ghost();
    this.time.delayedCall(E.delayMs, () => {
      const landY = state.dig.floorAt(x) + 6;
      this.tweens.add({
        targets: ghost, x, y: landY, angle: 4, duration: state.tool.plungeMs * 1.3, ease: 'Quad.easeIn',
        onComplete: () => {
          this.impact(x, PLAIN_SWING, true);
          this.tweens.add({ targets: ghost, alpha: 0, y: ghost.y - 34, duration: 280, onComplete: () => ghost.setVisible(false) });
        },
      });
    });
  }

  /** Scrap Shot: mini projectiles leave the shovel and each dig a small hole beside the main one. */
  private fireScrapShots(x: number, count: number, step: number): void {
    const E = TRAIT_EFFECTS.scrapShot;
    const radius = state.tool.craterRadius;
    const startY = state.dig.floorAt(x) - 60;
    this.callout('SCRAP SHOT!', x, startY - 70, '#ffd36a');
    for (let i = 0; i < count; i++) {
      const shot = this.shots[this.shotIndex++ % this.shots.length];
      const lx = clamp(x + range(Math.random, -E.spread, E.spread) * radius, this.visL, this.visR);
      this.tweens.killTweensOf(shot);
      shot.setPosition(x, startY).setVisible(true).setAlpha(1).setScale(1);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: i * 70,
        duration: 300,
        ease: 'Quad.easeIn',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          shot.setPosition(x + (lx - x) * t, startY + (state.dig.floorAt(lx) - startY) * t - Math.sin(Math.PI * t) * 90);
          shot.setAngle(shot.angle + 24);
        },
        onComplete: () => {
          shot.setVisible(false);
          this.miniHole(x, lx - x, step);
        },
      });
    }
  }

  /** One small crater from a projectile, dug into the bottom of the hole at x. */
  private miniHole(x: number, offset: number, step: number): void {
    const E = TRAIT_EFFECTS.scrapShot;
    const part = state.dig.miniHole(x, offset, step * E.depthSteps, state.tool.craterRadius * E.widthMult);
    this.paintCrater(part.cx, part.cy, part.rx, part.ry, 'round', false);
    const layerIndex = state.dig.layerIndexAtY(part.cy);
    this.dirtFx[layerIndex].explode(5, part.cx, state.dig.floorAt(part.cx));
    this.dustFx[layerIndex].explode(2, part.cx, state.dig.floorAt(part.cx) - 4);
    this.followFloor(state.dig.floorAt(x));
  }

  /** Hot Rock: a worthless rock turns red hot where it lies, then blows a big hole. */
  private igniteHotRock(b: EmbeddedRock): void {
    const E = TRAIT_EFFECTS.hotRock;
    this.embedded = this.embedded.filter((o) => o !== b);
    b.glint?.remove();
    state.recordFind();
    state.beginActivity();
    b.sprite.setTint(0xff7a3a);
    this.tweens.killTweensOf(b.sprite);
    this.tweens.add({ targets: b.sprite, scale: b.sprite.scale * 1.16, duration: 110, yoyo: true, repeat: Math.round(E.fuseMs / 220) });
    this.callout('HOT ROCK!', b.x, b.y - b.r - 60, '#ff8a3d');
    this.emberFx.explode(10, b.x, b.y - b.r * 0.4);
    this.time.delayedCall(E.fuseMs, () => this.detonate(b));
  }

  private detonate(b: EmbeddedRock): void {
    const E = TRAIT_EFFECTS.hotRock;
    const rock = b.rock;
    this.tweens.killTweensOf(b.sprite);
    b.sprite.destroy();
    if (rock) releaseRockTextures(this.textures, rock);
    const res = this.digAt(b.x, { depth: E.depthMult, width: E.widthMult }, false);
    this.emberFx.explode(26, b.x, b.y - b.r * 0.3);
    this.pebbleFx.explode(4, b.x, b.y);
    this.cameras.main.shake(300, 0.009);
    this.cameras.main.flash(120, 255, 170, 90);
    sfx.blast(1);
    this.ring(b.x, res.floorBefore);
    state.endActivity();
  }

  // ---------- feedback ----------

  private ring(x: number, y: number): void {
    const ring = this.rings[this.ringIndex++ % this.rings.length];
    this.tweens.killTweensOf(ring);
    ring.setPosition(x, y).setScale(0.15, 0.08).setAlpha(0.7).setVisible(true);
    this.tweens.add({ targets: ring, scaleX: 0.9, scaleY: 0.45, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => ring.setVisible(false) });
  }

  private showTired(x: number): void {
    sfx.tired();
    state.bus.emit(EVT.staminaDenied);
    this.tweens.killTweensOf(this.rig);
    this.swingEndsAt = 0;
    this.tweens.add({ targets: this.rig, x: { from: this.rig.x - 8, to: this.rig.x }, duration: 300, ease: 'Elastic.easeOut' });
    const t = this.tiredText;
    this.tweens.killTweensOf(t);
    t.setPosition(clamp(x, this.visL + 180, this.visR - 180), state.dig.floorAt(x) - 100).setAlpha(1).setScale(0.35).setVisible(true);
    this.tweens.add({ targets: t, scale: 0.5, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, delay: 650, duration: 400, onComplete: () => t.setVisible(false) });
  }

  private dismissHint(): void {
    const hint = this.hint;
    if (!hint) return;
    this.hint = null;
    this.tweens.killTweensOf(hint);
    this.tweens.add({ targets: hint, alpha: 0, scale: 0.6, duration: 200, onComplete: () => hint.destroy() });
  }

  /** Coming back from the workshop: the shaft is exactly as it was left. */
  private onWake(): void {
    this.holdPointer = null;
    this.gesturePointer = null;
    this.panning = false;
    this.touchHolding = false;
    this.flingV = 0;
    this.swingEndsAt = 0;
    this.input.keyboard?.resetKeys();
    this.snapCamera();
    this.tryReleaseStuckRocks();
    this.cameras.main.fadeIn(220, 30, 20, 12);
  }
}
