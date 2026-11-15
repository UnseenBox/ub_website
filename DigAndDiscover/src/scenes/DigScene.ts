import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { PALETTE, outlinedStyle } from '../config/Theme';
import { EVT, state, subscribe } from '../core/GameState';
import { intRange, range } from '../core/Random';
import type { Rock } from '../core/types';
import { ART_RES, ensureRockTextures, rockKeys } from '../art/RockArt';
import { paintStrata } from '../art/StrataArt';
import { HOLE_RADIUS, HOLE_VARIANTS, SHOVEL } from '../art/TextureFactory';
import { makeCanvasTexture } from '../art/paint';
import { sfx } from '../audio/Sfx';
import { generateRock } from '../systems/RockGenerator';
import { ensureFindTexture } from '../art/FindArt';
import { uiIcon } from '../art/UiIcons';
import { SurfaceLife } from '../ui/SurfaceLife';
import { depositTint } from '../data/deposits';
import { CATEGORY_STYLE, type FindDef } from '../data/finds';
import { computeLayout, type Layout } from '../ui/layout';

const WORLD = GAME_CONFIG.world;
const W = WORLD.width;
const SURFACE = WORLD.surfaceY;
const TOTAL_H = state.dig.totalHeight;
const SKY_HEIGHT = 900;
const SHOVEL_SCALE = 1.05 / ART_RES;
/** Width, in field units, of the painted scene above the ground (its height follows the picture). */
const BACKDROP_W = 1300;
export const BACKDROP_KEY = 'above-surface';

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
  private backdrop!: Phaser.GameObjects.Image;
  private skyFill!: Phaser.GameObjects.Image;
  private life!: SurfaceLife;
  private lifeLayer!: Phaser.GameObjects.Container;
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
    this.rings = [];
    this.glints = [];
    this.dirtFx = [];
    this.dustFx = [];
    this.lastX = W / 2;
    this.focusY = SURFACE;
    this.chipDir = 0;
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.events.off(Phaser.Scenes.Events.WAKE, this.onWake, this);
    });
    subscribe(this, EVT.inventoryChanged, () => this.tryReleaseStuckRocks());
    subscribe(this, EVT.toolChanged, () => this.applyToolLook());
    subscribe(this, EVT.relocated, () => this.onRelocated());
    subscribe(this, EVT.runReset, () => this.onRelocated()); // a restarted run: the ground starts over too
    subscribe(this, EVT.layerEntered, () => this.cameras.main.shake(260, 0.004));
    this.cameras.main.fadeIn(250, 30, 20, 12);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100);
    this.life.update(dt);
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
    // Everything above the ground is one painted picture. Its bottom edge sits on the grass line;
    // a stretched copy of its top row carries the sky up past the top of the view.
    const tex = this.textures.get(BACKDROP_KEY).getSourceImage() as { width: number; height: number };
    const bs = BACKDROP_W / tex.width;
    const bx = -(BACKDROP_W - W) / 2 + 8; // the cottage stands just left of the dig
    this.backdrop = this.add.image(bx, SURFACE + 10, BACKDROP_KEY).setOrigin(0, 1).setScale(bs);
    this.skyFill = this.add.image(bx, SURFACE + 10 - tex.height * bs + 1, BACKDROP_KEY).setOrigin(0, 1).setCrop(0, 0, tex.width, 2);
    this.skyFill.setScale(bs, (SKY_HEIGHT + 400) / 2);
    this.lifeLayer = this.add.container(0, 0);
    this.life = new SurfaceLife(this, this.lifeLayer, { x: bx, bottom: SURFACE + 10, width: BACKDROP_W, height: tex.height * bs });

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
    this.root.add([this.skyFill, this.backdrop, this.lifeLayer, under, this.rockLayer, this.soil, this.popLayer]);
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
    this.popLayer.add([
      ...this.rings, ...this.dustFx, ...this.dirtFx, this.pebbleFx, this.sparkleFx, this.crystalFx, ...this.glints, this.pips,
    ]);
  }

  private buildShovel(): void {
    const tool = state.tool;
    this.shovel = this.add.image(0, 0, tool.textureKey).setOrigin(0.5, SHOVEL.tipY / SHOVEL.height).setScale(SHOVEL_SCALE);
    this.rig = this.add.container(W / 2 + 60, SURFACE - 70, [this.shovel]).setAngle(14);
    // A soft shadow on the ground where the next swing will land.
    this.aimMark = this.add.image(0, 0, 'soft').setTint(0x1a0f08).setScale(0.95, 0.24).setAlpha(0);
    this.popLayer.add([this.aimMark, this.rig, this.tiredText]);
    this.applyToolLook();
    // Gentle idle sway on the inner image so swings (on the rig) never fight it.
    this.tweens.add({ targets: this.shovel, angle: { from: -2.5, to: 2.5 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** A fresh deposit: fade out, rebuild the ground from scratch, fade back in. */
  private onRelocated(): void {
    const cam = this.cameras.main;
    cam.fadeOut(380, 20, 12, 8);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart());
  }

  /** Better tools wash the shovel sprite with their colour (until they get their own art). */
  private applyToolLook(): void {
    const tint = state.tool.tint;
    if (tint) this.shovel.setTint(tint);
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
    const L = (this.L = computeLayout(w, h));
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
  }

  /** The picture takes the light of the day: warm at dawn, bright at noon, amber in the evening. */
  private applyTimeOfDay(p: number): void {
    this.skyProgress = p;
    const tint = mixColor(0xffffff, skyTint(p), 0.7);
    this.backdrop.setTint(tint);
    this.skyFill.setTint(tint);
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
    if (!state.stamina.trySpend(state.tool.staminaMult * layer.staminaMult)) {
      this.nextDigAt = now + 450;
      this.showTired(x);
      return;
    }
    // Hard ground makes the swing heavier and slower, not just less effective.
    this.nextDigAt = now + state.tool.swingCooldownMs * (1 + 0.5 * layer.feel.clang);
    this.swing(x, layer.feel.clang);
  }

  /** Gameplay timing runs on the scene clock; tweens are purely cosmetic. */
  private swing(x: number, clang: number): void {
    const plungeMs = state.tool.plungeMs * (1 + 0.6 * clang);
    const floorY = state.dig.floorAt(x);
    this.lastX = x;
    this.swingEndsAt = this.time.now + plungeMs + 190;
    state.beginActivity();
    this.tweens.killTweensOf(this.rig);
    if (Phaser.Math.Distance.Between(this.rig.x, this.rig.y, x, floorY) > 160) {
      this.rig.setPosition(x + 20, floorY - 60).setAngle(30);
    }
    this.tweens.add({ targets: this.rig, x, y: floorY + 6, angle: 4, duration: plungeMs, ease: 'Quad.easeIn' });
    this.time.delayedCall(plungeMs, () => {
      this.impact(x);
      const squash = 1 + clang;
      this.shovel.setScale(SHOVEL_SCALE * (1 + 0.08 * squash), SHOVEL_SCALE * (1 - 0.12 * squash));
      this.tweens.add({ targets: this.shovel, scaleX: SHOVEL_SCALE, scaleY: SHOVEL_SCALE, duration: 200, ease: 'Back.easeOut' });
      this.tweens.killTweensOf(this.rig);
      const upY = state.dig.floorAt(x) - 40 - 14 * clang;
      this.tweens.add({ targets: this.rig, x: x + 16, y: upY, angle: 24 + 10 * clang, duration: 170, ease: 'Back.easeOut' });
      this.time.delayedCall(190, () => state.endActivity());
    });
  }

  private impact(x: number): void {
    const res = state.dig.dig(x, state.tool);
    const feel = res.layer.feel;
    const y = res.floorBefore;
    const target = this.nearestEmbedded(x, y);
    const direct = !!target && Phaser.Math.Distance.Between(x, y, target.x, target.y) <= target.r + GAME_CONFIG.dig.nearHitPadding;
    sfx.dig(direct, feel.clang);
    if (res.dug) {
      this.paintCrater(res.cx, res.cy, res.rx, res.ry);
      this.followFloor(state.dig.floorAt(x));
      const lite = this.sys.game.device.input.touch ? 0.65 : 1; // phones: fewer particles
      const chunks = Math.max(3, Math.round(feel.chunks * (0.55 + 0.45 * res.efficiency) * lite));
      this.dirtFx[res.layerIndex].explode(chunks, x, y);
      this.dustFx[res.layerIndex].explode(3, x, y - 6);
      if (Math.random() < GAME_CONFIG.dig.pebbleChance * (0.6 + feel.clang)) this.pebbleFx.explode(1, x, y);
      if (feel.sparks > 0 && Math.random() < 0.7) this.crystalFx.explode(feel.sparks, x, y - 4);
    }
    this.ring(x, y);
    // The swing that reaches bedrock: offer a new deposit once the dust settles.
    if (!this.bedrockAnnounced && state.dig.atBottom) {
      this.bedrockAnnounced = true;
      this.time.delayedCall(900, () => state.bus.emit(EVT.bedrock));
    }
    this.cameras.main.shake(100, feel.shake * (this.sys.game.device.input.touch ? 0.6 : 1));
    this.dismissHint();

    if (target && direct) {
      this.hitEmbedded(target);
    } else if (this.embedded.length >= GAME_CONFIG.dig.maxEmbeddedRocks) {
      state.discovery.skip();
    } else if (res.dug && state.discovery.roll(res.layer, Math.random)) {
      this.embedRock(res.cx, res.layer.discovery.rarityWeights, res.layer.discovery.freeHits, (res.layer.discovery.valueMult ?? 1) * state.depositValueMult, res.layerIndex);
    } else if (res.dug) {
      const def = state.finds.roll(res.layerIndex, Math.random, (id) => state.findsInv.collectionCount(id) > 0);
      if (def) this.embedFind(res.cx, def);
    }
  }

  private nearestEmbedded(x: number, y: number): EmbeddedRock | null {
    let best: EmbeddedRock | null = null;
    let bestD = Infinity;
    for (const b of this.embedded) {
      const d = Phaser.Math.Distance.Squared(x, y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  // ---------- terrain painting ----------

  /** Carve the heightmap and erase the same ellipse from the visible soil. */
  private paintCrater(cx: number, cy: number, rx: number, ry: number): void {
    state.dig.carveEllipse(cx, cy, rx, ry);
    this.stamp
      .setTexture(`hole${intRange(Math.random, 0, HOLE_VARIANTS - 1)}`)
      .setScale(rx / HOLE_RADIUS, ry / HOLE_RADIUS)
      .setRotation(0)
      .setAlpha(1);
    this.soil.erase(this.stamp, cx, cy);
  }

  // ---------- rocks ----------

  /** A swing turns up a rock: it appears half-buried in the floor of the shaft. */
  private embedRock(
    nearX: number,
    rarityWeights: readonly number[],
    freeHits: { min: number; max: number },
    valueMult = 1,
    layerIndex = 0,
  ): void {
    const rock = generateRock(Math.random, rarityWeights, valueMult, layerIndex);
    ensureRockTextures(this.textures, rock);
    const k = GAME_CONFIG.rock.discoveryScale;
    const r = GAME_CONFIG.rock.baseRadius * rock.size * k;
    const x = clamp(nearX + range(Math.random, -18, 18), r + 14, W - r - 14);
    const y = state.dig.floorAt(x) + r * GAME_CONFIG.dig.rockSinkFactor;
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
    b.hp = Math.max(0, b.hp - 1);
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
    if (b.rock && state.inventory.isFull) {
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
    this.time.delayedCall(860, () => {
      const m = sprite.getWorldTransformMatrix();
      state.bus.emit(EVT.rockCollected, rock, m.tx, m.ty, base * this.fieldScale);
      this.tweens.killTweensOf(sprite);
      sprite.destroy();
      state.endActivity();
    });
  }

  /** A buried object: shows up as a dark silhouette with a "?" until it is dug free. */
  private embedFind(nearX: number, def: FindDef): void {
    const junk = def.category === 'junk';
    const size = junk ? JUNK_SIZE : FIND_SIZE;
    const r = size * 0.7;
    const scale = size / FIND_TEXTURE;
    const x = clamp(nearX + range(Math.random, -18, 18), r + 14, W - r - 14);
    const y = state.dig.floorAt(x) + r * GAME_CONFIG.dig.rockSinkFactor;
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
