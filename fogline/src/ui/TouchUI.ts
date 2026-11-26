import Phaser from 'phaser';
import { DEPTH } from '../game/depths';
import { TOUCH_LAYOUT, TouchButton, TouchCircle, TouchPoint, stickHome, touchLayout } from '../game/touchControls';

const STENCIL = '"Saira Stencil One", sans-serif';

interface Round {
  g: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  c: TouchCircle;
  accent: number;
  pressed: boolean;
}

/**
 * On-screen phone controls: the aim stick on the left, a FIRE button, RELOAD,
 * SHOP, PAUSE and a "deploy next wave" pill. Pure visuals — GameScene does the
 * pointer routing with the rules in game/touchControls.ts.
 */
export class TouchUI {
  private buttons = new Map<TouchButton, Round>();
  private deployG: Phaser.GameObjects.Graphics;
  private deployText: Phaser.GameObjects.Text;
  private stickG: Phaser.GameObjects.Graphics;
  private aimLabel: Phaser.GameObjects.Text;
  private enabled = false;
  private deployShown = false;
  private reloadArc = 0;
  private reloading = false;
  private time = 0;

  constructor(scene: Phaser.Scene) {
    const L = TOUCH_LAYOUT;
    const d = DEPTH.hud - 2;
    this.stickG = scene.add.graphics().setDepth(d);
    this.aimLabel = scene.add.text(0, 0, 'AIM', {
      fontFamily: STENCIL, fontSize: '22px', color: '#f2ead0', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(d).setAlpha(0.75);
    this.add(scene, 'fire', L.fire, 'FIRE', 0xd8452c, 26, d);
    this.add(scene, 'reload', L.reload, 'RLD', 0xc8a040, 13, d);
    this.add(scene, 'pause', L.pause, 'II', 0x7a8a9a, 18, d);
    this.add(scene, 'shop', L.shop, 'SHOP', 0xc8a040, 11, d);
    this.deployG = scene.add.graphics().setDepth(d);
    this.deployText = scene.add.text(L.deploy.x, L.deploy.y, '', {
      fontFamily: STENCIL, fontSize: '26px', color: '#ffe9c8', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(d + 1);
    this.apply();
  }

  private add(scene: Phaser.Scene, key: TouchButton, c: TouchCircle, text: string, accent: number, size: number, depth: number): void {
    const g = scene.add.graphics().setDepth(depth);
    const label = scene.add.text(c.x, key === 'fire' ? c.y - 22 : c.y, text, {
      fontFamily: STENCIL, fontSize: `${size}px`, color: '#f2ead0', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(depth + 1);
    this.buttons.set(key, { g, label, c, accent, pressed: false });
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    this.apply();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get deployVisible(): boolean {
    return this.enabled && this.deployShown;
  }

  setPressed(key: TouchButton, pressed: boolean): void {
    const b = this.buttons.get(key);
    if (b) b.pressed = pressed;
  }

  private apply(): void {
    const on = this.enabled;
    for (const b of this.buttons.values()) {
      b.g.setVisible(on);
      b.label.setVisible(on);
    }
    this.stickG.setVisible(on);
    this.aimLabel.setVisible(on);
    this.deployG.setVisible(on && this.deployShown);
    this.deployText.setVisible(on && this.deployShown);
  }

  update(dt: number, state: {
    reloading: boolean; reloadProgress: number; deploy: string | null; inputLocked: boolean;
    /** The held aim stick, or null while no thumb is on it. */
    stick: { base: TouchPoint; knob: TouchPoint } | null;
  }): void {
    this.time += dt;
    if (!this.enabled) return;
    const show = !state.inputLocked;
    for (const b of this.buttons.values()) {
      b.g.setVisible(show);
      b.label.setVisible(show);
    }
    this.stickG.setVisible(show);
    this.aimLabel.setVisible(show);
    const wantDeploy = state.deploy !== null && show;
    if (wantDeploy !== this.deployShown) this.deployShown = wantDeploy;
    this.deployG.setVisible(wantDeploy);
    this.deployText.setVisible(wantDeploy);
    if (!show) return;

    this.reloading = state.reloading;
    this.reloadArc = state.reloadProgress;
    // The buttons follow the screen's edges, which move when the browser's bars or full screen change.
    const layout = touchLayout();
    for (const [key, b] of this.buttons) {
      if (key !== 'deploy') b.c = layout[key];
      b.label.setPosition(b.c.x, key === 'fire' ? b.c.y - 22 : b.c.y);
      this.drawRound(key, b);
    }
    this.drawStick(state.stick);

    if (wantDeploy) {
      const L = TOUCH_LAYOUT.deploy;
      const dg = this.deployG;
      dg.clear();
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
      dg.fillStyle(0x1b1c1b, 0.9);
      dg.fillRoundedRect(L.x - L.w / 2, L.y - L.h / 2, L.w, L.h, 14);
      dg.lineStyle(3, 0xd8452c, 0.65 + 0.35 * pulse);
      dg.strokeRoundedRect(L.x - L.w / 2, L.y - L.h / 2, L.w, L.h, 14);
      this.deployText.setText(state.deploy!);
    }
  }

  /** The stick rests at home and moves to wherever the thumb takes hold of it. */
  private drawStick(held: { base: TouchPoint; knob: TouchPoint } | null): void {
    const home = stickHome();
    const base = held ? held.base : home;
    const knob = held ? held.knob : home;
    const r = home.r;
    const g = this.stickG;
    g.clear();
    g.fillStyle(0x000000, held ? 0.34 : 0.24);
    g.fillCircle(base.x, base.y, r);
    g.lineStyle(3, 0xe0dcc0, held ? 0.75 : 0.45);
    g.strokeCircle(base.x, base.y, r);
    // four arrow heads around the rim
    g.fillStyle(0xe0dcc0, held ? 0.7 : 0.45);
    const tip = r - 8, foot = r - 20, half = 8;
    for (const [ax, ay] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      g.fillTriangle(
        base.x + ax * tip, base.y + ay * tip,
        base.x + ax * foot - ay * half, base.y + ay * foot + ax * half,
        base.x + ax * foot + ay * half, base.y + ay * foot - ax * half,
      );
    }
    // knob
    g.fillStyle(0x000000, 0.45);
    g.fillCircle(knob.x + 2, knob.y + 4, 34);
    g.fillStyle(held ? 0x34302c : 0x1e1f1e, 0.92);
    g.fillCircle(knob.x, knob.y, 34);
    g.lineStyle(3, 0xe0dcc0, held ? 1 : 0.8);
    g.strokeCircle(knob.x, knob.y, 34);
    g.lineStyle(1.5, 0xffffff, 0.14);
    g.strokeCircle(knob.x, knob.y, 26);

    this.aimLabel.setPosition(home.x, home.y - r - 20);
    this.aimLabel.setAlpha(held ? 0 : 0.75);
  }

  private drawRound(key: TouchButton, b: Round): void {
    const g = b.g;
    const { x, y, r } = b.c;
    g.clear();
    const down = b.pressed;
    const scale = down ? 0.94 : 1;
    const rr = r * scale;
    // drop shadow + body
    g.fillStyle(0x000000, 0.45);
    g.fillCircle(x + 2, y + 4, rr);
    g.fillStyle(down ? 0x34302c : 0x1e1f1e, 0.9);
    g.fillCircle(x, y, rr);
    g.fillStyle(b.accent, down ? 0.55 : key === 'fire' ? 0.3 : 0.14);
    g.fillCircle(x, y, rr - 4);
    g.lineStyle(key === 'fire' ? 5 : 3, b.accent, down ? 1 : 0.85);
    g.strokeCircle(x, y, rr);
    g.lineStyle(1.5, 0xffffff, 0.14);
    g.strokeCircle(x, y, rr - 7);
    if (key === 'fire') {
      // crosshair glyph
      const c = down ? 0xffffff : 0xffe9c8;
      g.lineStyle(2.4, c, 0.9);
      g.strokeCircle(x, y + 18, 15);
      g.fillStyle(c, 0.9);
      g.fillCircle(x, y + 18, 2.6);
      g.lineBetween(x - 26, y + 18, x - 10, y + 18);
      g.lineBetween(x + 10, y + 18, x + 26, y + 18);
    }
    if (key === 'reload' && this.reloading) {
      g.lineStyle(5, 0xe8d890, 1);
      g.beginPath();
      g.arc(x, y, rr + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.reloadArc);
      g.strokePath();
    }
    if (key === 'fire' && this.reloading) {
      g.lineStyle(5, 0xe8d890, 0.9);
      g.beginPath();
      g.arc(x, y, rr + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.reloadArc);
      g.strokePath();
    }
    b.label.setScale(scale).setAlpha(down ? 1 : 0.95);
  }
}
