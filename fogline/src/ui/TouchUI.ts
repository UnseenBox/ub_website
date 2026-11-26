import Phaser from 'phaser';
import { DEPTH } from '../game/depths';
import { edgeShift } from '../game/screen';
import { TOUCH_LAYOUT, TouchButton, TouchCircle, touchLayout } from '../game/touchControls';

const MONO = '"Saira", sans-serif';
const STENCIL = '"Saira Stencil One", sans-serif';

interface Round {
  g: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  c: TouchCircle;
  accent: number;
  pressed: boolean;
}

/**
 * On-screen phone controls: a FIRE button, RELOAD, SHOP, PAUSE and a
 * "deploy next wave" pill, plus a faint AIM hint on the left. Pure visuals —
 * GameScene does the pointer routing via touchButtonAt().
 */
export class TouchUI {
  private buttons = new Map<TouchButton, Round>();
  private deployG: Phaser.GameObjects.Graphics;
  private deployText: Phaser.GameObjects.Text;
  private aimHint: Phaser.GameObjects.Graphics;
  private aimLabel: Phaser.GameObjects.Text;
  private enabled = false;
  private deployShown = false;
  private hintLeft = 5;
  private reloadArc = 0;
  private reloading = false;
  private time = 0;

  constructor(scene: Phaser.Scene) {
    const L = TOUCH_LAYOUT;
    const d = DEPTH.hud - 2;
    this.aimHint = scene.add.graphics().setDepth(d);
    this.aimLabel = scene.add.text(200, 470, 'DRAG TO AIM', {
      fontFamily: MONO, fontSize: '18px', color: '#e0dcc0', letterSpacing: 4,
    }).setOrigin(0.5).setDepth(d).setAlpha(0.7);
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

  /** The aim thumb touched the pad, so the hint can go away. */
  noteAimUsed(): void {
    this.hintLeft = Math.min(this.hintLeft, 0.6);
  }

  private apply(): void {
    const on = this.enabled;
    for (const b of this.buttons.values()) {
      b.g.setVisible(on);
      b.label.setVisible(on);
    }
    this.aimHint.setVisible(on);
    this.aimLabel.setVisible(on);
    this.deployG.setVisible(on && this.deployShown);
    this.deployText.setVisible(on && this.deployShown);
  }

  update(dt: number, state: {
    reloading: boolean; reloadProgress: number; deploy: string | null; inputLocked: boolean;
  }): void {
    this.time += dt;
    if (!this.enabled) return;
    const show = !state.inputLocked;
    for (const b of this.buttons.values()) {
      b.g.setVisible(show);
      b.label.setVisible(show);
    }
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
    const aimX = 200 - edgeShift();
    this.aimLabel.setX(aimX);

    // faint aim pad hint that fades after the first touch
    this.hintLeft = Math.max(0, this.hintLeft - dt);
    const a = Math.min(1, this.hintLeft / 1.2);
    const g = this.aimHint;
    g.clear();
    if (a > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.4);
      g.lineStyle(3, 0xe0dcc0, (0.22 + 0.12 * pulse) * a);
      g.strokeCircle(aimX, 448, 78);
      g.lineStyle(2, 0xe0dcc0, 0.16 * a);
      g.strokeCircle(aimX, 448, 36);
      g.lineBetween(aimX - 108, 448, aimX - 52, 448);
      g.lineBetween(aimX + 52, 448, aimX + 108, 448);
      g.lineBetween(aimX, 448 - 108, aimX, 448 - 52);
      g.lineBetween(aimX, 448 + 52, aimX, 448 + 108);
    }
    this.aimLabel.setAlpha(0.75 * a);

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
