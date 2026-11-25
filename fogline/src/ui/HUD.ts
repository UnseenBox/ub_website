import Phaser from 'phaser';
import { appendLog, clipWords, portraitInitial, wordCount } from './messages';
import { DEFENSES, MODS, SUPPORT } from '../data/upgrades';
import { WEAPONS, weaponById } from '../data/weapons';
import { VIEW } from '../game/config';
import { DEPTH } from '../game/depths';
import { HUD_LAYOUT } from '../rendering/HudArt';
import { Abilities } from '../systems/Abilities';
import { BunkerManager } from '../systems/BunkerManager';
import { EconomyManager } from '../systems/EconomyManager';
import { SupportSystem } from '../systems/SupportSystem';
import { WaveManager } from '../systems/WaveManager';
import { WeaponManager } from '../systems/WeaponManager';

const MONO = 'Consolas, "Courier New", monospace';
const STENCIL = 'Impact, "Arial Narrow Bold", "Arial Black", sans-serif';

interface Slot {
  x: number;
  w: number;
  frame: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  key: Phaser.GameObjects.Text;
  top: Phaser.GameObjects.Text;
  bottom: Phaser.GameObjects.Text;
  shade: Phaser.GameObjects.Rectangle;
  bar: Phaser.GameObjects.Rectangle;
  hit: Phaser.GameObjects.Zone;
  state: string;
}

/** Portrait tint per speaker. */
const PORTRAIT_TINT: Record<string, number> = {
  HALE: 0x7a8a6a, VARGA: 0x6a7a9a, KESTREL: 0x8a9ab0, DOT: 0xb08a4a, MARA: 0x6a8a6a,
  BRICK: 0x8a6a4a, ROOK: 0x9a7a5a, VESNA: 0x7a6a8a,
};

export interface HudActions {
  weapon(slot: number): void;
  mod(index: number): void;
  support(index: number): void;
  defense(index: number): void;
  /** Tap/click on the Focus bar (touch players have no SHIFT key). */
  focus?(): void;
}

function setText(t: Phaser.GameObjects.Text, s: string): void {
  if (t.text !== s) t.setText(s);
}

/** Bottom-panel HUD plus the in-field ammo counter, wave banner and warnings. */
export class HUD {
  private weaponSlots: Slot[] = [];
  private modSlots: Slot[] = [];
  private supportSlots: Slot[] = [];
  private defenseSlots: Slot[] = [];
  private hpBar: Phaser.GameObjects.Graphics;
  private hpText: Phaser.GameObjects.Text;
  private cashText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  private hostilesText: Phaser.GameObjects.Text;
  private shieldText: Phaser.GameObjects.Text;
  private ammoBig: Phaser.GameObjects.Text;
  private ammoSmall: Phaser.GameObjects.Text;
  private weaponName: Phaser.GameObjects.Text;
  private bannerTitle: Phaser.GameObjects.Text;
  private bannerSub: Phaser.GameObjects.Text;
  private bannerBack: Phaser.GameObjects.Rectangle;
  private bannerLeft = 0;
  private bannerSticky = false;
  private critical: Phaser.GameObjects.Text;
  private critVignette: Phaser.GameObjects.Rectangle;
  private activeList: Phaser.GameObjects.Text;
  private focusBar: Phaser.GameObjects.Graphics;
  private focusLabel: Phaser.GameObjects.Text;
  private streakText: Phaser.GameObjects.Text;
  private objectiveText: Phaser.GameObjects.Text;
  private bossName: Phaser.GameObjects.Text;
  private bossBar: Phaser.GameObjects.Graphics;
  private hintBox: Phaser.GameObjects.Container | null = null;
  private pendingHint: { caps: string[]; label: string } | null = null;
  private hintLeft = 0;
  private threatBox: Phaser.GameObjects.Container | null = null;
  private threatLeft = 0;
  private pips: Phaser.GameObjects.Graphics;
  private card: Phaser.GameObjects.Container | null = null;
  /** Every radio line of this battle in full, for the radio log in the pause menu. */
  readonly radioLog: { who: string; text: string }[] = [];
  private radioPortrait: Phaser.GameObjects.Graphics;
  private radioInitial: Phaser.GameObjects.Text;
  private radioBack: Phaser.GameObjects.Rectangle;
  private radioWho: Phaser.GameObjects.Text;
  private radioText: Phaser.GameObjects.Text;
  private radioQueue: { who: string; text: string }[] = [];
  private radioLeft = 0;
  private cashFlash = 0;
  private lastCash = -1;
  private lastHp = -1;
  private hpLag = 1;
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly d: {
      weapons: WeaponManager; abilities: Abilities; economy: EconomyManager; bunker: BunkerManager; waves: WaveManager; support: SupportSystem;
      /** Whether this mission offers an item (`weapon:m4`, `mod:ap`…). Items it doesn't stay off the HUD. */
      offers: (id: string) => boolean;
      /** Weapon ids on keys 1–4, in order. */
      weaponSlots: string[];
    },
    actions: HudActions,
  ) {
    this.objectiveText = scene.add.text(VIEW.centerX, 10, '', {
      fontFamily: MONO, fontSize: '15px', color: '#e8d8a0', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(DEPTH.banner + 1);
    this.bossName = scene.add.text(VIEW.centerX, 40, '', {
      fontFamily: STENCIL, fontSize: '20px', color: '#ff9070', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(DEPTH.banner + 1).setVisible(false);
    this.bossBar = scene.add.graphics().setDepth(DEPTH.banner + 1);
    // Focus meter and kill streak, bottom left above the panel.
    this.focusBar = scene.add.graphics().setDepth(DEPTH.hud + 1);
    this.focusLabel = scene.add.text(24, VIEW.hudTop - 44, '', {
      fontFamily: MONO, fontSize: '12px', color: '#c8d8ff', stroke: '#000', strokeThickness: 3,
    }).setDepth(DEPTH.hud + 1);
    this.streakText = scene.add.text(24, VIEW.hudTop - 66, '', {
      fontFamily: STENCIL, fontSize: '17px', color: '#ffd060', stroke: '#000', strokeThickness: 4,
    }).setDepth(DEPTH.hud + 1);
    const focusZone = scene.add.zone(20, VIEW.hudTop - 48, 230, 34).setOrigin(0).setDepth(DEPTH.hud + 5).setInteractive({ useHandCursor: true });
    focusZone.on('pointerdown', () => actions.focus?.());
    this.pips = scene.add.graphics().setDepth(DEPTH.banner + 1);
    this.radioBack = scene.add.rectangle(16, 16, 440, 34, 0x000000, 0.55).setOrigin(0).setDepth(DEPTH.banner).setVisible(false);
    this.radioPortrait = scene.add.graphics().setDepth(DEPTH.banner + 1).setVisible(false);
    this.radioInitial = scene.add.text(40, 33, '', { fontFamily: STENCIL, fontSize: '15px', color: '#fff4c8', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH.banner + 2).setVisible(false);
    this.radioWho = scene.add.text(62, 33, '', { fontFamily: STENCIL, fontSize: '15px', color: '#e8c060', stroke: '#000', strokeThickness: 3 }).setOrigin(0, 0.5).setDepth(DEPTH.banner + 1);
    this.radioText = scene.add.text(130, 33, '', { fontFamily: MONO, fontSize: '14px', color: '#e0dcc0', stroke: '#000', strokeThickness: 3, wordWrap: { width: 290 } }).setOrigin(0, 0.5).setDepth(DEPTH.banner + 1);
    const L = HUD_LAYOUT;
    scene.add.image(0, L.top, 'hud_panel').setOrigin(0).setDepth(DEPTH.hud);
    // block clicks on the panel from reaching anything else
    const S = L.sections;
    // Four weapon slots; the loadout fills them in order and the rest stay empty.
    for (let i = 0; i < 4; i++) {
      const id = d.weaponSlots[i];
      const icon = id ? weaponById(id).iconTexture : WEAPONS[0].iconTexture;
      this.weaponSlots.push(this.makeSlot(S.weapons.x + i * (S.weapons.slotW + L.gap), S.weapons.slotW, icon, String(i + 1), 0.62, () => actions.weapon(i + 1)));
    }
    MODS.forEach((m, i) => this.modSlots.push(this.makeSlot(S.mods.x + i * (S.mods.slotW + L.gap), S.mods.slotW, m.icon, m.key, 0.95, () => actions.mod(i))));
    SUPPORT.forEach((s, i) => this.supportSlots.push(this.makeSlot(S.support.x + i * (S.support.slotW + L.gap), S.support.slotW, s.icon, s.key, 0.95, () => actions.support(i))));
    DEFENSES.forEach((s, i) => this.defenseSlots.push(this.makeSlot(S.defense.x + i * (S.defense.slotW + L.gap), S.defense.slotW, s.icon, s.key, 0.95, () => actions.defense(i))));

    const st = L.status;
    const sx = st.x + 10;
    scene.add.text(sx, L.top + 14, 'BUNKER INTEGRITY', { fontFamily: MONO, fontSize: '10px', color: '#9a9a86' }).setDepth(DEPTH.hud + 1);
    this.shieldText = scene.add.text(st.x + st.w - 10, L.top + 14, '', { fontFamily: MONO, fontSize: '10px', color: '#e0c050' }).setOrigin(1, 0).setDepth(DEPTH.hud + 1);
    this.hpBar = scene.add.graphics().setDepth(DEPTH.hud + 1);
    this.hpText = scene.add.text(st.x + st.w - 10, L.top + 46, '', { fontFamily: MONO, fontSize: '13px', color: '#d8e8c8', stroke: '#000', strokeThickness: 3 }).setOrigin(1, 0).setDepth(DEPTH.hud + 2);
    this.cashText = scene.add.text(sx, L.top + 66, '', { fontFamily: STENCIL, fontSize: '30px', color: '#c8d890', stroke: '#000', strokeThickness: 4 }).setDepth(DEPTH.hud + 1);
    this.waveText = scene.add.text(st.x + st.w - 10, L.top + 70, '', { fontFamily: MONO, fontSize: '13px', color: '#c8c8b0' }).setOrigin(1, 0).setDepth(DEPTH.hud + 1);
    this.waveText.setVisible(false);
    this.hostilesText = scene.add.text(st.x + st.w - 10, L.top + 88, '', { fontFamily: MONO, fontSize: '13px', color: '#d89070' }).setOrigin(1, 0).setDepth(DEPTH.hud + 1);

    this.ammoBig = scene.add.text(VIEW.width - 132, VIEW.hudTop - 12, '', { fontFamily: STENCIL, fontSize: '44px', color: '#e8e0c0', stroke: '#000', strokeThickness: 5 }).setOrigin(1, 1).setDepth(DEPTH.hud);
    this.ammoSmall = scene.add.text(VIEW.width - 128, VIEW.hudTop - 18, '', { fontFamily: MONO, fontSize: '16px', color: '#b8b098', stroke: '#000', strokeThickness: 4 }).setOrigin(0, 1).setDepth(DEPTH.hud);
    this.weaponName = scene.add.text(VIEW.width - 132, VIEW.hudTop - 58, '', { fontFamily: MONO, fontSize: '12px', color: '#a8a890', stroke: '#000', strokeThickness: 3 }).setOrigin(1, 1).setDepth(DEPTH.hud);
    this.activeList = scene.add.text(VIEW.width - 120, 30, '', { fontFamily: MONO, fontSize: '14px', color: '#e0d0a0', stroke: '#000', strokeThickness: 4, align: 'right' }).setOrigin(1, 0).setDepth(DEPTH.hud);

    this.bannerBack = scene.add.rectangle(VIEW.centerX, 120, VIEW.width, 92, 0x000000, 0.45).setDepth(DEPTH.banner).setVisible(false);
    this.bannerTitle = scene.add.text(VIEW.centerX, 100, '', { fontFamily: STENCIL, fontSize: '40px', color: '#e0dcc0', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(DEPTH.banner + 1);
    this.bannerSub = scene.add.text(VIEW.centerX, 142, '', { fontFamily: MONO, fontSize: '16px', color: '#c8c4a0', stroke: '#000', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(DEPTH.banner + 1);
    this.critical = scene.add.text(VIEW.centerX, 196, 'BUNKER CRITICAL', { fontFamily: STENCIL, fontSize: '26px', color: '#ff4030', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(DEPTH.banner).setVisible(false);
    this.critVignette = scene.add.rectangle(0, 0, VIEW.width, VIEW.hudTop, 0xff0000, 0).setOrigin(0).setDepth(DEPTH.overlay).setStrokeStyle(40, 0xaa0000, 0.0);
  }

  private makeSlot(x: number, w: number, icon: string, key: string, iconScale: number, onClick: () => void): Slot {
    const L = HUD_LAYOUT;
    const s = this.scene;
    const y = L.slotY;
    const frame = s.add.graphics().setDepth(DEPTH.hud + 3);
    const img = s.add.image(x + w / 2, y + 44, icon).setScale(iconScale).setDepth(DEPTH.hud + 1);
    const keyT = s.add.text(x + 4, y + 2, key, { fontFamily: STENCIL, fontSize: '16px', color: '#e0d8b0', stroke: '#000', strokeThickness: 3 }).setDepth(DEPTH.hud + 4);
    const top = s.add.text(x + w - 4, y + 4, '', { fontFamily: MONO, fontSize: '11px', color: '#c8c8b0' }).setOrigin(1, 0).setDepth(DEPTH.hud + 4);
    const bottom = s.add.text(x + w / 2, y + L.slotH - 4, '', { fontFamily: MONO, fontSize: '11px', color: '#c8c8b0', align: 'center' }).setOrigin(0.5, 1).setDepth(DEPTH.hud + 4);
    const shade = s.add.rectangle(x, y, w, L.slotH, 0x000000, 0.6).setOrigin(0).setDepth(DEPTH.hud + 2);
    const bar = s.add.rectangle(x + 2, y + L.slotH - 3, w - 4, 3, 0xe0b040).setOrigin(0, 0.5).setDepth(DEPTH.hud + 3).setVisible(false);
    const hit = s.add.zone(x, y, w, L.slotH).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(DEPTH.hud + 5);
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.leftButtonDown()) onClick();
    });
    return { x, w, frame, icon: img, key: keyT, top, bottom, shade, bar, hit, state: '' };
  }

  /**
   * An item the mission doesn't offer leaves an empty, darkened slot: no icon, key or
   * labels, so the bar only shows what the player can actually use. Returns `available`.
   */
  private showSlot(slot: Slot, available: boolean): boolean {
    slot.icon.setVisible(available);
    slot.key.setVisible(available);
    slot.top.setVisible(available);
    slot.bottom.setVisible(available);
    slot.hit.input!.enabled = available;
    if (!available) {
      slot.shade.setVisible(true).setAlpha(0.85);
      slot.bar.setVisible(false);
      this.drawFrame(slot, 0, 0, 0);
    } else {
      slot.shade.setAlpha(1);
    }
    return available;
  }

  private drawFrame(slot: Slot, color: number, alpha: number, width: number): void {
    const st = `${color}:${alpha}:${width}`;
    if (slot.state === st) return;
    slot.state = st;
    const g = slot.frame;
    g.clear();
    if (alpha <= 0) return;
    g.lineStyle(width, color, alpha);
    g.strokeRect(slot.x + width / 2, HUD_LAYOUT.slotY + width / 2, slot.w - width, HUD_LAYOUT.slotH - width);
  }

  banner(title: string, sub: string, seconds: number, sticky = false): void {
    setText(this.bannerTitle, title);
    setText(this.bannerSub, sub);
    this.bannerLeft = seconds;
    this.bannerSticky = sticky;
    this.bannerTitle.setAlpha(1).setVisible(true);
    this.bannerSub.setAlpha(1).setVisible(true);
    this.bannerBack.setVisible(true).setAlpha(1);
  }

  /** Focus meter: `meter` fills 0–1; `active` is the time left in a running Focus (0–1). */
  setFocus(enabled: boolean, meter: number, active: number): void {
    const g = this.focusBar;
    g.clear();
    this.focusLabel.setVisible(enabled);
    if (!enabled) return;
    const x = 24, y = VIEW.hudTop - 26, w = 200, h = 10;
    const full = meter >= 1;
    g.fillStyle(0x000000, 0.65).fillRect(x - 2, y - 2, w + 4, h + 4);
    const f = active > 0 ? active : meter;
    const pulse = full && active <= 0 ? 0.6 + 0.4 * Math.sin(this.time * 8) : 1;
    g.fillStyle(active > 0 ? 0x80a8ff : full ? 0xc8e0ff : 0x5a78b8, pulse).fillRect(x, y, w * f, h);
    setText(this.focusLabel, active > 0 ? 'FOCUS' : full ? 'FOCUS READY  [SHIFT]' : 'FOCUS');
  }

  /** Kill streak (0 hides it), its cash multiplier, and flares left at night (-1 hides). */
  setStreak(streak: number, mul: number, flares: number): void {
    const parts: string[] = [];
    if (streak >= 5) parts.push(`STREAK ${streak}${mul > 1 ? `  ·  CASH ×${mul}` : ''}`);
    if (flares >= 0) parts.push(`FLARES ${flares}  [Q]`);
    setText(this.streakText, parts.join('     '));
  }

  /** The mission objective's status line at the top of the screen (empty hides it). */
  setObjective(text: string): void {
    setText(this.objectiveText, text);
  }

  /** The boss health bar; `name` null hides it. */
  setBoss(name: string | null, fraction: number): void {
    const g = this.bossBar;
    g.clear();
    this.bossName.setVisible(!!name);
    if (!name) return;
    setText(this.bossName, name);
    const w = 520, x = VIEW.centerX - w / 2, y = 66;
    g.fillStyle(0x000000, 0.75).fillRect(x - 2, y - 2, w + 4, 14);
    g.fillStyle(0x6a1a12, 1).fillRect(x, y, w, 10);
    g.fillStyle(0xd84a30, 1).fillRect(x, y, w * Math.max(0, fraction), 10);
    g.fillStyle(0xffffff, 0.15).fillRect(x, y, w * Math.max(0, fraction), 3);
  }

  /** A control hint: key caps and a short label, for a few seconds. It waits behind banners and wave cards. */
  hint(caps: string[], label: string): void {
    if (this.busy()) {
      this.pendingHint = { caps, label };
      return;
    }
    this.showHint(caps, label);
  }

  /** New enemies: a card per enemy (name and up to three tags), top right, for a few seconds. */
  threatCards(cards: { name: string; tags: string[] }[]): void {
    this.threatBox?.destroy();
    const s = this.scene;
    const parts: Phaser.GameObjects.GameObject[] = [];
    cards.slice(0, 2).forEach((c, i) => {
      const y = i * 74;
      parts.push(s.add.rectangle(0, y, 268, 66, 0x000000, 0.82).setOrigin(0).setStrokeStyle(2, 0xc8e070));
      parts.push(s.add.text(12, y + 7, 'NEW THREAT', { fontFamily: MONO, fontSize: '11px', color: '#c8e070' }));
      parts.push(s.add.text(12, y + 24, c.name.toUpperCase(), { fontFamily: STENCIL, fontSize: '20px', color: '#f1ead0' }));
      parts.push(s.add.text(12, y + 47, c.tags.join('  ·  '), { fontFamily: MONO, fontSize: '11px', color: '#c8d0b0' }));
    });
    this.threatBox = s.add.container(VIEW.width - 282, 150, parts).setDepth(DEPTH.banner + 1);
    this.threatLeft = 4.5;
  }

  /** A banner or a wave card is on screen: messages take turns. */
  private busy(): boolean {
    return this.bannerLeft > 0 || this.bannerSticky || this.card !== null;
  }

  private showHint(caps: string[], label: string): void {
    this.hintBox?.destroy();
    const s = this.scene;
    const parts: Phaser.GameObjects.GameObject[] = [];
    let x = 0;
    for (const c of caps) {
      const w = Math.max(30, c.length * 11 + 16);
      parts.push(s.add.rectangle(x, 0, w, 30, 0x0c0d0b, 0.92).setOrigin(0, 0.5).setStrokeStyle(2, 0xe8e0c8));
      parts.push(s.add.text(x + w / 2, 0, c, { fontFamily: MONO, fontSize: '14px', color: '#f4ecd0', fontStyle: 'bold' }).setOrigin(0.5));
      x += w + 6;
    }
    const gap = caps.length ? 6 : 0;
    const lbl = s.add.text(x + gap, 0, label, { fontFamily: STENCIL, fontSize: '19px', color: '#fff4c8', stroke: '#000', strokeThickness: 4 }).setOrigin(0, 0.5);
    parts.push(lbl);
    const width = x + gap + lbl.width;
    this.hintBox = s.add.container(VIEW.centerX - width / 2, VIEW.hudTop - 150, parts).setDepth(DEPTH.banner + 2);
    this.hintLeft = 6;
  }

  /** Radio chatter at the top left: a portrait, the line (at most six words) and the full line kept in the log. */
  radio(lines: { who: string; text: string }[]): void {
    for (const l of lines) appendLog(this.radioLog, l);
    this.radioQueue.push(...lines);
    if (this.radioLeft <= 0) this.nextRadio();
  }

  private radioParts(): (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text | Phaser.GameObjects.Graphics)[] {
    return [this.radioBack, this.radioWho, this.radioText, this.radioPortrait, this.radioInitial];
  }

  private nextRadio(): void {
    const line = this.radioQueue.shift();
    if (!line) {
      this.radioLeft = 0;
      for (const o of this.radioParts()) o.setVisible(false);
      return;
    }
    const shown = clipWords(line.text);
    setText(this.radioWho, line.who);
    setText(this.radioText, shown);
    const h = Math.max(34, this.radioText.height + 14);
    this.radioBack.height = h;
    const cy = 16 + h / 2;
    this.radioWho.setY(cy);
    this.radioText.setY(cy);
    this.radioInitial.setY(cy);
    setText(this.radioInitial, portraitInitial(line.who));
    this.radioPortrait.clear().fillStyle(PORTRAIT_TINT[line.who] ?? 0x5a5c58, 1).fillCircle(40, cy, 14)
      .lineStyle(2, 0xe8c060, 1).strokeCircle(40, cy, 14);
    // Long enough to read: a base plus time per word shown.
    this.radioLeft = 2.2 + wordCount(shown) * 0.36;
    for (const o of this.radioParts()) o.setVisible(true).setAlpha(1);
  }

  /** Between waves: the wave, its bonus, and the two things to do next, each with its key. Stays until the next wave starts. */
  waveCard(wave: number, reward: number, armory: { label: string; key: string | null }, next: { label: string; key: string | null }): void {
    this.hideCard();
    const s = this.scene;
    const W = 560, H = 176;
    const parts: Phaser.GameObjects.GameObject[] = [];
    parts.push(s.add.rectangle(0, 0, W, H, 0x000000, 0.74).setStrokeStyle(2, 0xe8c060));
    parts.push(s.add.graphics().lineStyle(7, 0x93c36c, 1).beginPath()
      .moveTo(-W / 2 + 30, -H / 2 + 46).lineTo(-W / 2 + 46, -H / 2 + 62).lineTo(-W / 2 + 74, -H / 2 + 30).strokePath());
    parts.push(s.add.text(-W / 2 + 84, -H / 2 + 46, `WAVE ${wave}`, { fontFamily: STENCIL, fontSize: '38px', color: '#e0dcc0', stroke: '#000', strokeThickness: 5 }).setOrigin(0, 0.5));
    parts.push(s.add.text(W / 2 - 24, -H / 2 + 46, `+$${reward}`, { fontFamily: STENCIL, fontSize: '30px', color: '#c8d890', stroke: '#000', strokeThickness: 4 }).setOrigin(1, 0.5));
    const cardButton = (x: number, b: { label: string; key: string | null }, primary: boolean): void => {
      const bw = 240, bh = 62, y = H / 2 - 50;
      parts.push(s.add.rectangle(x, y, bw, bh, primary ? 0x2a3a20 : 0x1e1f1c, 1).setStrokeStyle(2, primary ? 0x6aae4a : 0x6a7a8a));
      parts.push(s.add.text(x, b.key ? y - 9 : y, b.label, { fontFamily: STENCIL, fontSize: '22px', color: '#e8e0c0' }).setOrigin(0.5));
      if (b.key) parts.push(s.add.text(x, y + 14, `[${b.key}]`, { fontFamily: MONO, fontSize: '12px', color: '#a8a890' }).setOrigin(0.5));
    };
    cardButton(-W / 4 - 4, armory, false);
    cardButton(W / 4 + 4, next, true);
    this.card = s.add.container(VIEW.centerX, 150, parts).setDepth(DEPTH.banner + 1);
  }

  private hideCard(): void {
    this.card?.destroy();
    this.card = null;
  }

  /** Wave pips under the objective: one per wave, filled once it has started, the live one outlined. */
  private drawPips(): void {
    const g = this.pips;
    g.clear();
    const w = this.d.waves;
    if (w.endless || w.totalWaves <= 0) return;
    const n = w.totalWaves, pw = 14, gap = 6, y = 34;
    const x0 = VIEW.centerX - (n * pw + (n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (pw + gap);
      g.fillStyle(i < w.wave ? 0xd8a840 : 0x6a6a5a, 1).fillRect(x, y, pw, 8);
      if (i === w.wave - 1 && w.phase === 'active') g.lineStyle(2, 0xffffff, 0.9).strokeRect(x - 1, y - 1, pw + 2, 10);
    }
  }

  hideBanner(): void {
    this.threatBox?.destroy();
    this.threatBox = null;
    this.threatLeft = 0;
    this.bannerLeft = 0;
    this.bannerSticky = false;
    this.bannerTitle.setVisible(false);
    this.bannerSub.setVisible(false);
    this.bannerBack.setVisible(false);
  }

  clearBanner(): void {
    this.hideCard();
    if (this.bannerSticky || this.bannerLeft > 0.5) this.bannerLeft = 0.5;
    this.bannerSticky = false;
  }

  update(dt: number): void {
    this.time += dt;
    this.drawPips();
    const { weapons, abilities, economy, bunker, waves, support, offers } = this.d;

    if (this.hintLeft > 0) {
      this.hintLeft -= dt;
      this.hintBox?.setAlpha(Math.min(1, this.hintLeft / 0.6));
      if (this.hintLeft <= 0) {
        this.hintBox?.destroy();
        this.hintBox = null;
      }
    }
    if (this.threatLeft > 0) {
      this.threatLeft -= dt;
      this.threatBox?.setAlpha(Math.min(1, this.threatLeft / 0.6));
      if (this.threatLeft <= 0) {
        this.threatBox?.destroy();
        this.threatBox = null;
      }
    }
    if (this.pendingHint && !this.busy()) {
      const h = this.pendingHint;
      this.pendingHint = null;
      this.showHint(h.caps, h.label);
    }
    if (this.radioLeft > 0) {
      this.radioLeft -= dt;
      const a = Math.min(1, this.radioLeft / 0.4);
      for (const o of this.radioParts()) o.setAlpha(a);
      if (this.radioLeft <= 0) this.nextRadio();
    }

    // weapons
    this.weaponSlots.forEach((s, i) => {
      const id = this.d.weaponSlots[i];
      if (!this.showSlot(s, !!id && offers(`weapon:${id}`))) return;
      const w = weaponById(id);
      const st = weapons.states.get(w.id)!;
      const selected = weapons.current.def.id === w.id;
      s.shade.setVisible(!st.owned);
      s.icon.setAlpha(st.owned ? 1 : 0.35);
      setText(s.top, st.owned ? '' : st.unlocked ? `$${w.price}` : 'LOCKED');
      setText(s.bottom, st.owned ? `${w.shortName}  ${st.reserve === Infinity ? `${st.mag}/∞` : `${st.mag}/${st.reserve}`}` : `${w.shortName}`);
      s.bottom.setColor(st.owned && st.mag === 0 && st.reserve === 0 ? '#ff6040' : st.owned ? '#d0d0b8' : '#7a7a6a');
      if (selected) this.drawFrame(s, 0xe8b440, 1, 3);
      else this.drawFrame(s, 0x000000, 0, 0);
    });

    // mods
    MODS.forEach((m, i) => {
      const s = this.modSlots[i];
      if (!this.showSlot(s, offers(`mod:${m.id}`))) return;
      const st = abilities.mods.get(m.id)!;
      const active = st.activeLeft > 0;
      s.shade.setVisible(st.charges <= 0 && !active);
      setText(s.top, st.charges > 0 ? `×${st.charges}` : '');
      setText(s.bottom, active ? `${Math.ceil(st.activeLeft)}s` : m.short);
      s.bottom.setColor(active ? '#ffe090' : '#b0b09a');
      s.bar.setVisible(active);
      if (active) {
        s.bar.setFillStyle(m.color);
        s.bar.width = (s.w - 4) * Math.min(1, st.activeLeft / st.duration);
        const pulse = 0.6 + 0.4 * Math.sin(this.time * 6);
        this.drawFrame(s, m.color, Math.round(pulse * 10) / 10, 3);
      } else this.drawFrame(s, 0, 0, 0);
    });

    // support
    SUPPORT.forEach((sp, i) => {
      const s = this.supportSlots[i];
      if (!this.showSlot(s, offers(`support:${sp.id}`))) return;
      const st = abilities.support.get(sp.id)!;
      const cd = st.cooldownLeft;
      const running = sp.id === 'gunship' && support.gunshipActive;
      s.shade.setVisible(st.charges <= 0 || cd > 0);
      setText(s.top, st.charges > 0 ? `×${st.charges}` : '');
      setText(s.bottom, running ? `${Math.ceil(support.gunshipRemaining)}s` : cd > 0 ? `${Math.ceil(cd)}s` : st.charges > 0 ? 'READY' : `$${sp.price}`);
      s.bottom.setColor(running ? '#ffe090' : st.charges > 0 && cd <= 0 ? '#a8e090' : '#8a8a7a');
      s.bar.setVisible(cd > 0);
      if (cd > 0) {
        s.bar.setFillStyle(0x8090a0);
        s.bar.width = (s.w - 4) * (1 - cd / st.cooldown);
      }
      if (running) this.drawFrame(s, 0xe8b440, 1, 3);
      else this.drawFrame(s, 0, 0, 0);
    });

    DEFENSES.forEach((df, i) => {
      const s = this.defenseSlots[i];
      if (!this.showSlot(s, offers(`defense:${df.id}`))) return;
      const st = abilities.defense.get(df.id)!;
      const cd = st.cooldownLeft;
      const running = df.id === 'wall' && bunker.shielded;
      s.shade.setVisible(st.charges <= 0 || cd > 0);
      setText(s.top, st.charges > 0 ? `×${st.charges}` : '');
      setText(s.bottom, running ? `${Math.ceil(bunker.shieldRemaining)}s` : cd > 0 ? `${Math.ceil(cd)}s` : st.charges > 0 ? 'READY' : `$${df.price}`);
      s.bottom.setColor(running ? '#ffe090' : st.charges > 0 && cd <= 0 ? '#a8e090' : '#8a8a7a');
      if (running) this.drawFrame(s, 0xe0c050, 1, 3);
      else this.drawFrame(s, 0, 0, 0);
    });

    // bunker health
    const frac = bunker.fraction;
    this.hpLag += (frac - this.hpLag) * Math.min(1, dt * 2.2);
    if (frac > this.hpLag) this.hpLag = frac;
    const st = HUD_LAYOUT.status;
    const bx = st.x + 10, by = HUD_LAYOUT.top + 28, bw = st.w - 20, bh = 16;
    const g = this.hpBar;
    g.clear();
    g.fillStyle(0x0a0b0a, 1).fillRect(bx, by, bw, bh);
    g.fillStyle(0xd8d0b0, 0.5).fillRect(bx + 1, by + 1, (bw - 2) * this.hpLag, bh - 2);
    const col = frac > 0.5 ? 0x5fae3c : frac > 0.25 ? 0xc8a830 : 0xc83a28;
    g.fillStyle(col, 1).fillRect(bx + 1, by + 1, (bw - 2) * frac, bh - 2);
    g.fillStyle(0xffffff, 0.12).fillRect(bx + 1, by + 1, (bw - 2) * frac, 4);
    g.fillStyle(0x000000, 0.55);
    for (let k = 1; k < 20; k++) g.fillRect(bx + (bw * k) / 20, by + 1, 1, bh - 2);
    if (bunker.shielded) {
      g.lineStyle(2, 0xe0c050, 0.6 + 0.4 * Math.sin(this.time * 8));
      g.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);
    }
    const hp = Math.ceil(bunker.health);
    if (hp !== this.lastHp) {
      this.lastHp = hp;
      setText(this.hpText, `${hp} / ${bunker.max}`);
    }
    this.hpText.setPosition(st.x + st.w - 10, by + bh + 2);
    setText(this.shieldText, bunker.shielded ? `SHUTTERS ${Math.ceil(bunker.shieldRemaining)}s` : '');

    // cash
    if (economy.cash !== this.lastCash) {
      if (this.lastCash >= 0) this.cashFlash = economy.cash > this.lastCash ? 0.35 : -0.35;
      this.lastCash = economy.cash;
      setText(this.cashText, `$${economy.cash.toLocaleString('en-US')}`);
    }
    if (this.cashFlash > 0) {
      this.cashFlash = Math.max(0, this.cashFlash - dt);
      this.cashText.setColor(this.cashFlash > 0 ? '#f0ffb0' : '#c8d890').setScale(1 + this.cashFlash * 0.25);
    } else if (this.cashFlash < 0) {
      this.cashFlash = Math.min(0, this.cashFlash + dt);
      this.cashText.setColor(this.cashFlash < 0 ? '#ff9a70' : '#c8d890').setScale(1);
    }

    setText(this.hostilesText, `HOSTILES ${waves.phase === 'cleared' || waves.phase === 'idle' ? 0 : waves.remaining}`);

    // ammo counter
    const cur = weapons.current;
    setText(this.ammoBig, `${cur.mag}`);
    setText(this.ammoSmall, cur.reserve === Infinity ? '/ ∞' : `/ ${cur.reserve}`);
    setText(this.weaponName, cur.def.name.toUpperCase());
    this.ammoBig.setColor(cur.mag === 0 ? '#ff5a40' : cur.mag <= Math.ceil(cur.def.magazine * 0.25) ? '#ffb050' : '#e8e0c0');

    // active effects list (top right)
    const lines: string[] = [];
    for (const m of MODS) {
      const a = abilities.mods.get(m.id)!;
      if (a.activeLeft > 0) lines.push(`${m.name.toUpperCase()}  ${Math.ceil(a.activeLeft)}s`);
    }
    if (support.gunshipActive) lines.push(`GUNSHIP ON STATION  ${Math.ceil(support.gunshipRemaining)}s`);
    if (support.nukePending) lines.push('NUCLEAR LAUNCH DETECTED');
    if (bunker.shielded) lines.push(`BLAST SHUTTERS  ${Math.ceil(bunker.shieldRemaining)}s`);
    setText(this.activeList, lines.join('\n'));

    // critical warning
    const crit = bunker.critical;
    this.critical.setVisible(crit && Math.sin(this.time * 7) > -0.2);
    this.critVignette.setStrokeStyle(60, 0xaa0000, crit ? 0.18 + 0.12 * Math.sin(this.time * 5) : 0);

    // banner fade
    if (!this.bannerSticky && this.bannerLeft > 0) {
      this.bannerLeft -= dt;
      const a = Math.min(1, this.bannerLeft / 0.5);
      this.bannerTitle.setAlpha(a);
      this.bannerSub.setAlpha(a);
      this.bannerBack.setAlpha(a);
      if (this.bannerLeft <= 0) {
        this.bannerTitle.setVisible(false);
        this.bannerSub.setVisible(false);
        this.bannerBack.setVisible(false);
      }
    }
  }
}
