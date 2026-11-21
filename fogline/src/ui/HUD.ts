import Phaser from 'phaser';
import { DEFENSES, MODS, SUPPORT } from '../data/upgrades';
import { WEAPONS } from '../data/weapons';
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
  state: string;
}

export interface HudActions {
  weapon(slot: number): void;
  mod(index: number): void;
  support(index: number): void;
  defense(index: number): void;
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
  private cashFlash = 0;
  private lastCash = -1;
  private lastHp = -1;
  private hpLag = 1;
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly d: {
      weapons: WeaponManager; abilities: Abilities; economy: EconomyManager; bunker: BunkerManager; waves: WaveManager; support: SupportSystem;
    },
    actions: HudActions,
  ) {
    const L = HUD_LAYOUT;
    scene.add.image(0, L.top, 'hud_panel').setOrigin(0).setDepth(DEPTH.hud);
    // block clicks on the panel from reaching anything else
    const S = L.sections;
    WEAPONS.forEach((w, i) => this.weaponSlots.push(this.makeSlot(S.weapons.x + i * (S.weapons.slotW + L.gap), S.weapons.slotW, w.iconTexture, String(w.slot), 0.62, () => actions.weapon(w.slot))));
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
    return { x, w, frame, icon: img, key: keyT, top, bottom, shade, bar, state: '' };
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

  hideBanner(): void {
    this.bannerLeft = 0;
    this.bannerSticky = false;
    this.bannerTitle.setVisible(false);
    this.bannerSub.setVisible(false);
    this.bannerBack.setVisible(false);
  }

  clearBanner(): void {
    if (this.bannerSticky || this.bannerLeft > 0.5) this.bannerLeft = 0.5;
    this.bannerSticky = false;
  }

  update(dt: number): void {
    this.time += dt;
    const { weapons, abilities, economy, bunker, waves, support } = this.d;

    // weapons
    WEAPONS.forEach((w, i) => {
      const s = this.weaponSlots[i];
      const st = weapons.states.get(w.id)!;
      const selected = weapons.current.def.id === w.id;
      s.shade.setVisible(!st.owned);
      s.icon.setAlpha(st.owned ? 1 : 0.35);
      setText(s.top, st.owned ? '' : `$${w.price}`);
      setText(s.bottom, st.owned ? `${w.shortName}  ${st.reserve === Infinity ? `${st.mag}/∞` : `${st.mag}/${st.reserve}`}` : `${w.shortName}`);
      s.bottom.setColor(st.owned && st.mag === 0 && st.reserve === 0 ? '#ff6040' : st.owned ? '#d0d0b8' : '#7a7a6a');
      if (selected) this.drawFrame(s, 0xe8b440, 1, 3);
      else this.drawFrame(s, 0x000000, 0, 0);
    });

    // mods
    MODS.forEach((m, i) => {
      const s = this.modSlots[i];
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

    setText(this.waveText, waves.wave > 0 ? `WAVE ${waves.wave}/${waves.totalWaves}` : `WAVE 0/${waves.totalWaves}`);
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
