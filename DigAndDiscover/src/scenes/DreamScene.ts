import Phaser from 'phaser';
import { FEATURES } from '../config/features';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { state } from '../core/GameState';
import { ALL_UPGRADES } from '../data/store';
import { TOOL_DEFS } from '../data/tools';
import { sfx } from '../audio/Sfx';
import { Button } from '../ui/Button';
import { ICON_SAW } from '../art/IconArt';
import { uiIcon } from '../art/UiIcons';
import { computeLayout } from '../ui/layout';
import type { HudScene } from './HudScene';

/**
 * THE DREAM (retention update). A brand-new player first plays the REAL game for a short while with everything
 * maxed out: the best tool, every upgrade and skill at maximum and a bag of fancy rocks (see GameState.beginDream).
 * They dig huge holes, cut rocks open and sell them like a champion. When the time is up the screen flashes white,
 * everything is taken away (GameState.endDream resets the run: Old Shovel, $0, day 1) and a card says
 * "It was only a dream..." before the real game starts.
 *
 * This scene is only an overlay: the countdown, the wake-up flash and the card. The gameplay underneath is the
 * normal Dig / Workshop / Hud scenes. Nothing is saved while the dream runs.
 */

/** How long the dream lasts, in seconds. The one number to tune. */
/** Kept for reference: the dream has no timer any more; it ends once every rock is cut. */
export const DREAM_SECONDS = 0;

const SEEN_KEY = 'dig-and-discover-dream-seen';
const SAVE_KEY = 'dig-and-discover-save-main2';
const CREAM = '#fff3dc';
const GOLD = '#ffd36b';

let seenThisPage = false;
let playedThisPage = false;

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function hasDreamFlag(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('dream');
  } catch {
    return false;
  }
}

function hasSave(): boolean {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

/** A returning player has any progress at all; the dream is only for a truly new run (it ends by resetting the run). */
function isBrandNewRun(): boolean {
  if (hasSave()) return false;
  try {
    const p = state.progress;
    if (state.day.day !== 1 || state.economy.money !== 0) return false;
    if (state.stats.found !== 0 || state.stats.cut !== 0 || state.stats.best !== null) return false;
    if (p.level !== 1 || p.deposit !== 1 || p.bestDepth !== 0) return false;
    if (state.findsInv.artifacts.length !== 0 || state.findsInv.collectionFound !== 0) return false;
    if (p.equippedToolId !== 'tool-old-shovel') return false;
    for (const id of Object.keys(TOOL_DEFS)) {
      if (id !== 'tool-old-shovel' && p.owns(id)) return false;
    }
    for (const item of ALL_UPGRADES) {
      if (p.upgradeLevel(item.id) > 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * True when the dream should play: the feature switch is on, it has not been seen on this device and the run is
 * brand new. `?dream` in the address forces it (dev server only, or on a brand-new run, so it can never wipe a real save).
 */
export function shouldPlayDream(): boolean {
  if (!FEATURES.v2 || seenThisPage || playedThisPage) return false;
  if (hasDreamFlag() && (import.meta.env.DEV || isBrandNewRun())) return true;
  return !readSeen() && isBrandNewRun();
}

/** Persists the "already seen" flag; storage failures still suppress a second play this page. */
export function markDreamSeen(): void {
  seenThisPage = true;
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Storage may be disabled in an embedded iframe; seenThisPage is enough for this load.
  }
}

type Phase = 'dream' | 'waking' | 'card';

export class DreamScene extends Phaser.Scene {
  private phase: Phase = 'dream';
  private finishing = false;
  private w = 360;
  private s = 1;

  // countdown banner
  private bannerBg!: Phaser.GameObjects.Graphics;
  private bannerText!: Phaser.GameObjects.Text;
  private bannerHint!: Phaser.GameObjects.Text;
  private skip!: Phaser.GameObjects.Text;
  private caption!: Phaser.GameObjects.Text;
  private doneAt = 0;
  private tutIconA!: Phaser.GameObjects.Image;
  private tutIconB!: Phaser.GameObjects.Image;
  private touchDevice = false;

  // wake-up flash and card
  private flash!: Phaser.GameObjects.Rectangle;
  private cardDim!: Phaser.GameObjects.Rectangle;
  private cardBg!: Phaser.GameObjects.Graphics;
  private shovel!: Phaser.GameObjects.Image;
  private cardTitle!: Phaser.GameObjects.Text;
  private cardBody!: Phaser.GameObjects.Text;
  private startButton!: Button;

  constructor() {
    super('Dream');
  }

  init(): void {
    this.phase = 'dream';
    this.finishing = false;
  }

  create(): void {
    playedThisPage = true;
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    this.bannerBg = this.add.graphics().setDepth(50);
    this.touchDevice = !this.sys.game.device.os.desktop;
    this.tutIconA = this.add.image(0, 0, uiIcon('pickaxe')).setDepth(51).setVisible(false);
    this.tutIconB = this.add.image(0, 0, ICON_SAW).setDepth(51).setVisible(false);
    this.bannerText = this.add.text(0, 0, '', outlinedStyle(22, GOLD)).setOrigin(0.5).setDepth(51);
    this.bannerHint = this.add.text(0, 0, '', textStyle(15, CREAM)).setOrigin(0.5).setDepth(51).setVisible(false);
    this.skip = this.add.text(0, 0, 'Skip', textStyle(16, CREAM)).setOrigin(0.5).setDepth(52).setAlpha(0).setStroke('#3b2616', 4);
    this.skip.setInteractive({ useHandCursor: true });
    this.skip.on(Phaser.Input.Events.POINTER_UP, this.wake, this);
    this.caption = this.add
      .text(0, 0, 'That night, Dad had a dream...', outlinedStyle(26, '#ffffff', { align: 'center' }))
      .setOrigin(0.5)
      .setDepth(51)
      .setAlpha(0);

    this.flash = this.add.rectangle(0, 0, 10, 10, 0xffffff, 0).setOrigin(0, 0).setDepth(80);
    this.cardDim = this.add.rectangle(0, 0, 10, 10, 0x120a04, 0).setOrigin(0, 0).setDepth(81).setVisible(false);
    this.cardBg = this.add.graphics().setDepth(82).setVisible(false);
    this.shovel = this.add.image(0, 0, TOOL_DEFS['tool-old-shovel']?.textureKey ?? 'shovel').setDepth(83).setVisible(false);
    this.cardTitle = this.add.text(0, 0, 'It was only a dream...', outlinedStyle(32, GOLD)).setOrigin(0.5).setDepth(83).setVisible(false);
    this.cardBody = this.add
      .text(
        0,
        0,
        "But Dad woke up with a plan. The bank wants its money, and every great mine starts with one Old Shovel. Let's get digging.",
        textStyle(21, '#ffffff', { align: 'center', wordWrap: { width: 300, useAdvancedWrap: true } }),
      )
      .setOrigin(0.5, 0)
      .setDepth(83)
      .setVisible(false);
    this.startButton = new Button(this, {
      width: 300,
      height: 56,
      label: 'Start digging',
      fontSize: 22,
      colors: BUTTON_COLORS.green,
      onClick: () => this.finish(),
    });
    this.startButton.setDepth(84).setVisible(false);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.input.keyboard?.on('keydown-ENTER', this.onEnter, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);

    // The caption fades in and out over the first seconds; the countdown already runs.
    this.tweens.add({ targets: this.caption, alpha: 1, duration: 500, hold: 1800, yoyo: true });
    this.time.delayedCall(1500, () => {
      if (this.phase === 'dream') this.tweens.add({ targets: this.skip, alpha: 0.85, duration: 300 });
    });
    // No timer: the dream ends when every rock is cut. This is only a safety net (a stuck dream).
    this.time.delayedCall(15 * 60 * 1000, () => {
      if (this.phase === 'dream') this.wake();
    });
  }

  update(): void {
    if (this.phase !== 'dream') return;
    this.drawTutorial();
    // Every rock cut (at least one cut happened, nothing left uncut, nothing running): wake up after a moment
    // to enjoy the reveal.
    const done = state.dreamRocksCut;
    if (!done) this.doneAt = 0;
    else if (this.doneAt === 0) this.doneAt = this.time.now;
    else if (this.time.now - this.doneAt > 4500) this.wake();
  }

  /**
   * A wordless tutorial: which input to use (mouse button or a finger) and a pulsing ring on the thing to press.
   * Step 1 dig, step 2 the round button that goes to the workshop, step 3 the Cut button.
   */
  private drawTutorial(): void {
    const g = this.bannerBg;
    g.clear();
    const { w, s } = this;
    const hud = this.scene.get('Hud') as unknown as { action?: Phaser.GameObjects.Container };
    const ws = this.scene.get('Workshop') as unknown as { cutBtn?: Phaser.GameObjects.Container };
    type Step = 'dig' | 'workshop' | 'cut' | 'none';
    let step: Step = 'dig';
    if (state.mode === 'workshop') step = state.stats.cut > 0 ? 'none' : 'cut';
    else if (state.dig.swingCount >= 6) step = 'workshop';
    if (step === 'none') {
      this.tutIconA.setVisible(false);
      this.tutIconB.setVisible(false);
      return;
    }
    const pulse = (this.time.now % 1000) / 1000;
    const GOLDC = 0xffc83d;

    // Where to press.
    let target: Phaser.Geom.Rectangle | null = null;
    if (step === 'dig') target = new Phaser.Geom.Rectangle(w / 2 - 50 * s, this.scale.height * 0.45 - 50 * s, 100 * s, 100 * s);
    else if (step === 'workshop' && hud.action) {
      const b = computeLayout(this.scale.width, this.scale.height, state.inventory.capacity).button;
      target = new Phaser.Geom.Rectangle(b.x, b.y, b.w, b.h);
    } else if (step === 'cut' && ws.cutBtn?.visible) {
      // The Cut button is 280x74 stage units; the world matrix carries the stage and button scale.
      const m = ws.cutBtn.getWorldTransformMatrix();
      const bw = 280 * m.scaleX;
      const bh = 74 * m.scaleY;
      target = new Phaser.Geom.Rectangle(m.tx - bw / 2, m.ty - bh / 2, bw, bh);
    }
    if (target) {
      const pad = (8 + 8 * pulse) * s;
      g.lineStyle(5 * s, GOLDC, 1 - pulse * 0.6).strokeRoundedRect(target.x - pad, target.y - pad, target.width + pad * 2, target.height + pad * 2, 22 * s);
      // A bouncing arrow above the target.
      const ax = target.centerX;
      const ay = target.y - 26 * s - 8 * s * Math.abs(Math.sin(pulse * Math.PI));
      g.fillStyle(0x3b2616, 1).fillTriangle(ax - 17 * s, ay - 14 * s, ax + 17 * s, ay - 14 * s, ax, ay + 12 * s);
      g.fillStyle(GOLDC, 1).fillTriangle(ax - 12 * s, ay - 10 * s, ax + 12 * s, ay - 10 * s, ax, ay + 7 * s);
    }

    // The pill at the top: [input] -> [what it does].
    const bw = 190 * s;
    const bh = 56 * s;
    const x = w / 2 - bw / 2;
    const y = 160 * s;
    g.fillStyle(0x000000, 0.28).fillRoundedRect(x, y + 3, bw, bh, 16 * s);
    g.fillStyle(0x2b1a0e, 0.86).fillRoundedRect(x, y, bw, bh, 16 * s);
    g.lineStyle(2 * s, PALETTE.gold, 0.9).strokeRoundedRect(x, y, bw, bh, 16 * s);
    const cy = y + bh / 2;
    const gx = x + 44 * s;
    if (this.touchDevice) {
      // A finger: a filled touch point with rings. Digging asks to hold, the rest to tap.
      const hold = step === 'dig';
      g.fillStyle(0xffe9c2, 1).fillCircle(gx, cy, 10 * s);
      g.lineStyle(3 * s, GOLDC, hold ? 0.9 : 1 - pulse).strokeCircle(gx, cy, (14 + (hold ? 6 : 14) * pulse) * s);
      if (hold) g.lineStyle(3 * s, GOLDC, 0.6).strokeCircle(gx, cy, 24 * s);
    } else {
      // A mouse with its left button lit.
      const mw = 24 * s;
      const mh = 36 * s;
      g.fillStyle(0xffe9c2, 1).fillRoundedRect(gx - mw / 2, cy - mh / 2, mw, mh, 11 * s);
      g.fillStyle(GOLDC, 0.55 + 0.45 * Math.abs(Math.sin(pulse * Math.PI))).fillRoundedRect(gx - mw / 2, cy - mh / 2, mw / 2, mh * 0.45, 7 * s);
      g.lineStyle(2 * s, 0x3b2616, 1).strokeRoundedRect(gx - mw / 2, cy - mh / 2, mw, mh, 11 * s);
      g.lineBetween(gx, cy - mh / 2, gx, cy - mh * 0.05);
      g.lineBetween(gx - mw / 2, cy - mh * 0.05, gx + mw / 2, cy - mh * 0.05);
    }
    // Arrow, then the action.
    const arx = x + 92 * s;
    g.fillStyle(GOLDC, 1).fillTriangle(arx - 8 * s, cy - 11 * s, arx - 8 * s, cy + 11 * s, arx + 12 * s, cy);
    const icon = step === 'dig' ? this.tutIconA : this.tutIconB;
    const other = step === 'dig' ? this.tutIconB : this.tutIconA;
    other.setVisible(false);
    icon.setVisible(true).setDisplaySize(40 * s, 40 * s).setPosition(x + 140 * s, cy);
  }

  /** Time is up (or skipped): flash, take everything away, show the card. */
  private wake(): void {
    if (this.phase !== 'dream') return;
    this.phase = 'waking';
    this.skip.disableInteractive();
    sfx.newDay();
    this.tweens.add({ targets: [this.bannerText, this.bannerHint, this.skip, this.caption], alpha: 0, duration: 200 });
    this.bannerBg.clear();
    this.tweens.add({
      targets: this.flash,
      fillAlpha: 1,
      duration: 380,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Everything is stripped away while the screen is white: Old Shovel, $0, day 1.
        // The deposit card ("new deposit at bedrock") must not survive the reset.
        this.scene.stop('Relocate');
        state.endDream();
        (this.scene.get('Hud') as HudScene | undefined)?.syncQuiet();
        // A rock that was still in the air when the run was reset may land in the new bag: sweep it out.
        this.time.delayedCall(700, () => state.clearBag());
        this.time.delayedCall(1600, () => state.clearBag());
        this.showCard();
        this.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 700, delay: 250 });
      },
    });
  }

  private showCard(): void {
    this.phase = 'card';
    this.cardDim.setVisible(true).setInteractive();
    this.tweens.add({ targets: this.cardDim, fillAlpha: 0.78, duration: 500, delay: 250 });
    for (const o of [this.cardBg, this.shovel, this.cardTitle, this.cardBody, this.startButton]) {
      o.setVisible(true).setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 500, delay: 450 });
    }
    this.layout();
  }

  private onEnter(): void {
    if (this.phase === 'card') this.finish();
  }

  /** The card is closed: the real game begins. */
  private finish(): void {
    if (this.finishing || this.phase !== 'card') return;
    this.finishing = true;
    markDreamSeen();
    state.clearBag();
    sfx.click();
    const hud = this.scene.get('Hud') as HudScene | undefined;
    this.scene.stop();
    // The "bank is waiting" card follows right away for the new run.
    hud?.maybeShowDebtNotice();
  }

  private onResize(): void {
    this.layout();
  }

  private layout(): void {
    const w = (this.w = this.scale.width);
    const h = this.scale.height;
    const s = (this.s = Phaser.Math.Clamp(Math.min(w / 360, h / 640), 0.85, 1.3));
    this.flash.setSize(w, h);
    this.cardDim.setSize(w, h);
    (this.cardDim.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, w, h);

    const bw = Math.min(260 * s, w * 0.7);
    const y = 160 * s;
    this.bannerText.setFontSize(Math.round(20 * s)).setPosition(w / 2, y + 16 * s);
    this.skip.setFontSize(Math.round(15 * s)).setPosition(w / 2 + bw / 2 + 28 * s, y + 16 * s);
    this.caption.setFontSize(Math.round(26 * s)).setPosition(w / 2, h * 0.36).setWordWrapWidth(w - 40 * s, true);

    // Wake-up card: old shovel, title, text, button.
    const cardW = Math.min(w * 0.88, 520);
    const cardH = Math.min(h * 0.8, 520);
    const cx = w / 2;
    const top = h / 2 - cardH / 2;
    this.cardBg.clear();
    this.cardBg.fillStyle(PALETTE.tray, 0.95).fillRoundedRect(cx - cardW / 2, top, cardW, cardH, 22 * s);
    this.cardBg.lineStyle(4 * s, PALETTE.gold, 0.95).strokeRoundedRect(cx - cardW / 2, top, cardW, cardH, 22 * s);
    const shovelH = Math.min(150 * s, cardH * 0.3);
    this.shovel.setDisplaySize(shovelH * (60 / 232), shovelH).setPosition(cx, top + 16 * s + shovelH / 2).setAngle(18);
    const titleY = top + 16 * s + shovelH + 30 * s;
    this.cardTitle.setFontSize(Math.round(30 * s)).setPosition(cx, titleY);
    this.cardBody.setFontSize(Math.round(21 * s)).setWordWrapWidth(cardW - 48 * s, true).setPosition(cx, titleY + 28 * s);
    this.startButton.resize(Math.min(cardW - 60 * s, 320), 58 * s, Math.round(22 * s)).setPosition(cx, top + cardH - 46 * s);
  }

  private cleanup(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.input.keyboard?.off('keydown-ENTER', this.onEnter, this);
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.skip.off(Phaser.Input.Events.POINTER_UP, this.wake, this);
  }
}
