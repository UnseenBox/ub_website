import { fortressIconSvg } from '../art/fortressIcons';
import { weaponIconSvg } from '../art/icons';
import type { UpgradeId, WeaponId } from '../game/catalog';
import type { FortressItemId } from '../game/fortressItems';

export type CatalogTab = 'weapons' | 'upgrades' | 'fortress' | 'kit';
export type CatalogFrom = 'menu' | 'pause' | 'shop' | 'build';
export type Overlay = 'menu' | 'hud' | 'pause' | 'catalog' | 'gameover' | 'build';

export interface HudState {
  hp: number;
  maxHp: number;
  wave: number;
  score: number;
  coins: number;
  weaponId: WeaponId;
  weaponName: string;
  /** Share of the wave's enemies already defeated, 0..1. */
  progress: number;
  stamina: number;
  maxStamina: number;
  /** True for a moment after an action fails for lack of stamina. */
  staminaFlash: boolean;
  /** Current enemy-hit chain, and the share of its timer left (0..1). */
  combo: number;
  comboTime: number;
  /** True while the player is down and can spend stamina to get up. */
  canGetUp: boolean;
}

export interface FortressCard {
  id: FortressItemId;
  name: string;
  blurb: string;
  color: string;
  hp: number;
  price: number;
  unlock: number;
  unlocked: boolean;
  canUnlock: boolean;
  canBuy: boolean;
  /** Pieces in the inventory, and pieces standing in the fortress. */
  owned: number;
  placed: number;
  maxPlaced: number;
}

export interface FortressModel {
  /** False when the catalog was opened from build mode (Back returns there). */
  canPlace: boolean;
  items: FortressCard[];
}

export interface BuildItem {
  id: FortressItemId;
  name: string;
  color: string;
  count: number;
  placed: number;
  maxPlaced: number;
  canPlace: boolean;
}

export interface BuildModel {
  coins: number;
  rotated: boolean;
  /** The item being dragged, if any. */
  dragging: FortressItemId | null;
  items: BuildItem[];
  /** Items still locked, shown as a hint to visit the shop. */
  lockedCount: number;
}

export interface CatalogWeapon {
  id: WeaponId;
  name: string;
  blurb: string;
  badge: string;
  color: string;
  price: number;
  owned: boolean;
  equipped: boolean;
  canBuy: boolean;
  /** Meters, each 0..1: damage, rate of fire, projectile speed. */
  power: number;
  rate: number;
  speed: number;
}

export interface CatalogUpgrade {
  id: UpgradeId;
  name: string;
  blurb: string;
  level: number;
  cap: number;
  cost: number;
  canBuy: boolean;
}

export interface CatalogModel {
  from: CatalogFrom;
  tab: CatalogTab;
  coins: number;
  /** Shop only: the wave that was just cleared, and the bonus paid for it. */
  wave: number;
  bonus: number;
  equipped: WeaponId;
  weapons: CatalogWeapon[];
  upgrades: CatalogUpgrade[];
  fortress: FortressModel;
  repair: { cost: number; heal: number; canBuy: boolean };
  /** The field kit tab only exists in the shop. */
  showKit: boolean;
}

export interface UIHandlers {
  onPlay(): void;
  onMenuCatalog(tab: CatalogTab): void;
  onPause(): void;
  onResume(): void;
  onPauseCatalog(tab: CatalogTab): void;
  onRestartRun(): void;
  onMainMenu(): void;
  onCatalogTab(tab: CatalogTab): void;
  onCatalogClose(): void;
  onCycleWeapon(): void;
  onBuyWeapon(id: WeaponId): void;
  onEquipWeapon(id: WeaponId): void;
  onBuyUpgrade(id: UpgradeId): void;
  onBuyRepair(): void;
  onUnlockItem(id: FortressItemId): void;
  onBuyItem(id: FortressItemId): void;
  onEnterBuild(): void;
  onExitBuild(): void;
  onRotateBuild(): void;
  onBuildShop(): void;
  /** A drag started on a build tray slot, at a client (viewport) point. */
  onTrayDrag(id: FortressItemId, clientX: number, clientY: number): void;
  onResetProfile(): void;
  onJump(): void;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const TAB_LABELS: Record<CatalogTab, string> = { weapons: 'Weapons', upgrades: 'Upgrades', fortress: 'Fortress', kit: 'Field kit' };

/**
 * DOM layer: the HUD, the main menu, the pause menu, the catalog (weapons,
 * upgrades, fortress pieces and field kit), build mode's tray, and game over.
 * One delegated click handler routes every button through the controller.
 */
export class UIManager {
  private readonly hud = byId<HTMLDivElement>('hud');
  private readonly hpFill = byId<HTMLDivElement>('player-hp-fill');
  private readonly hpText = byId<HTMLDivElement>('player-hp-text');
  private readonly waveText = byId<HTMLDivElement>('wave-text');
  private readonly scoreText = byId<HTMLDivElement>('score-text');
  private readonly waveFill = byId<HTMLDivElement>('wave-fill');
  private readonly staminaFill = byId<HTMLDivElement>('stamina-fill');
  private readonly staminaTrack = byId<HTMLDivElement>('stamina-track');
  private readonly coinsText = byId<HTMLDivElement>('coins-text');
  private readonly weaponBtn = byId<HTMLButtonElement>('weapon-btn');
  private readonly jumpBtn = byId<HTMLButtonElement>('jump-btn');
  private readonly jumpLabel = byId<HTMLSpanElement>('jump-label');
  private readonly combo = byId<HTMLDivElement>('combo-chip');
  private readonly comboText = byId<HTMLDivElement>('combo-text');
  private readonly comboFill = byId<HTMLDivElement>('combo-fill');
  private readonly menuPanel = byId<HTMLDivElement>('menu-panel');
  private readonly menuCoins = byId<HTMLDivElement>('menu-coins');
  private readonly menuWeapon = byId<HTMLDivElement>('menu-weapon');
  private readonly menuHome = byId<HTMLDivElement>('menu-home');
  private readonly pausePanel = byId<HTMLDivElement>('pause-panel');
  private readonly catalogPanel = byId<HTMLDivElement>('catalog-panel');
  private readonly catalogTitle = byId<HTMLHeadingElement>('catalog-title');
  private readonly catalogCoins = byId<HTMLDivElement>('catalog-coins');
  private readonly catalogSub = byId<HTMLDivElement>('catalog-sub');
  private readonly catalogTabs = byId<HTMLDivElement>('catalog-tabs');
  private readonly catalogBody = byId<HTMLDivElement>('catalog-body');
  private readonly catalogClose = byId<HTMLButtonElement>('catalog-close');
  private readonly buildPanel = byId<HTMLDivElement>('build-panel');
  private readonly buildCoins = byId<HTMLDivElement>('build-coins');
  private readonly buildTray = byId<HTMLDivElement>('build-tray');
  private readonly buildRotate = byId<HTMLButtonElement>('build-rotate');
  private readonly buildHint = byId<HTMLDivElement>('build-hint');
  private readonly gameoverPanel = byId<HTMLDivElement>('gameover-panel');
  private readonly gameoverSub = byId<HTMLParagraphElement>('gameover-sub');
  private readonly hint = byId<HTMLDivElement>('hint');
  private lastHud = '';
  private lastCoins: number | null = null;

  constructor(private readonly handlers: UIHandlers) {
    byId<HTMLDivElement>('app').addEventListener('click', (e) => this.onClick(e));
    // Tray slots start a drag on press, not on click, so the piece follows the finger at once.
    this.buildTray.addEventListener('pointerdown', (e) => {
      const slot = (e.target as HTMLElement).closest<HTMLElement>('[data-tray]');
      if (!slot) return;
      e.preventDefault();
      this.handlers.onTrayDrag(slot.dataset.tray as FortressItemId, e.clientX, e.clientY);
    });
  }

  private onClick(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    const id = el.dataset.id ?? '';
    const h = this.handlers;
    switch (el.dataset.act) {
      case 'play':
        h.onPlay();
        break;
      case 'menu-weapons':
        h.onMenuCatalog('weapons');
        break;
      case 'menu-upgrades':
        h.onMenuCatalog('upgrades');
        break;
      case 'reset-profile':
        h.onResetProfile();
        break;
      case 'pause':
        h.onPause();
        break;
      case 'resume':
        h.onResume();
        break;
      case 'pause-weapons':
        h.onPauseCatalog('weapons');
        break;
      case 'pause-upgrades':
        h.onPauseCatalog('upgrades');
        break;
      case 'build':
        h.onEnterBuild();
        break;
      case 'build-done':
        h.onExitBuild();
        break;
      case 'build-rotate':
        h.onRotateBuild();
        break;
      case 'build-shop':
        h.onBuildShop();
        break;
      case 'f-unlock':
        h.onUnlockItem(id as FortressItemId);
        break;
      case 'f-buy':
        h.onBuyItem(id as FortressItemId);
        break;
      case 'restart':
        h.onRestartRun();
        break;
      case 'main-menu':
        h.onMainMenu();
        break;
      case 'tab':
        h.onCatalogTab(id as CatalogTab);
        break;
      case 'close':
        h.onCatalogClose();
        break;
      case 'cycle':
        h.onCycleWeapon();
        break;
      case 'buy':
        h.onBuyWeapon(id as WeaponId);
        break;
      case 'equip':
        h.onEquipWeapon(id as WeaponId);
        break;
      case 'upgrade':
        h.onBuyUpgrade(id as UpgradeId);
        break;
      case 'repair':
        h.onBuyRepair();
        break;
      case 'jump':
        h.onJump();
        break;
      default:
        break;
    }
  }

  /** Show exactly one of the menu, HUD, pause, catalog, build or game-over layers. */
  showOverlay(o: Overlay): void {
    this.menuPanel.classList.toggle('hidden', o !== 'menu');
    this.pausePanel.classList.toggle('hidden', o !== 'pause');
    this.catalogPanel.classList.toggle('hidden', o !== 'catalog');
    this.gameoverPanel.classList.toggle('hidden', o !== 'gameover');
    this.buildPanel.classList.toggle('hidden', o !== 'build');
    this.hud.classList.toggle('hidden', o === 'menu' || o === 'build');
    if (o !== 'hud') this.hideHint();
  }

  showMenu(info: { coins: number; weaponId: WeaponId; weaponName: string; fortressPieces: number }): void {
    this.menuCoins.textContent = `${info.coins} coins`;
    this.menuWeapon.innerHTML = `<span class="menu-ic">${weaponIconSvg(info.weaponId, `m-${info.weaponId}`)}</span><span>${info.weaponName}</span>`;
    const n = info.fortressPieces;
    this.menuHome.textContent = n > 0 ? `Fortress: ${n} ${n === 1 ? 'piece' : 'pieces'}` : 'Fortress: empty';
  }

  setHud(s: HudState): void {
    const key = [
      s.hp,
      s.maxHp,
      s.wave,
      s.score,
      s.coins,
      s.weaponId,
      Math.round(s.progress * 100),
      Math.round(s.stamina),
      s.staminaFlash,
      s.combo,
      Math.round(s.comboTime * 100),
      s.canGetUp,
    ].join('|');
    if (key === this.lastHud) return;
    const coinsChanged = this.lastCoins !== null && s.coins > this.lastCoins;
    this.lastCoins = s.coins;
    this.lastHud = key;
    this.staminaFill.style.transform = `scaleX(${Math.max(0, Math.min(1, s.stamina / s.maxStamina)).toFixed(4)})`;
    this.staminaTrack.classList.toggle('is-empty', s.staminaFlash);
    this.combo.classList.toggle('hidden', s.combo < 2);
    if (s.combo >= 2) {
      this.comboText.textContent = `COMBO ×${s.combo}`;
      this.comboFill.style.transform = `scaleX(${Math.max(0, Math.min(1, s.comboTime)).toFixed(3)})`;
    }
    this.jumpBtn.classList.toggle('is-getup', s.canGetUp);
    this.jumpLabel.textContent = s.canGetUp ? 'Get up' : 'Jump';
    const frac = Math.max(0, Math.min(1, s.hp / s.maxHp));
    this.hpFill.style.transform = `scaleX(${frac.toFixed(4)})`;
    this.hpText.textContent = `${Math.ceil(s.hp)} / ${s.maxHp}`;
    this.waveText.textContent = `WAVE ${s.wave}`;
    this.scoreText.textContent = `${s.score}`;
    this.waveFill.style.transform = `scaleX(${Math.max(0, Math.min(1, s.progress)).toFixed(4)})`;
    this.coinsText.textContent = `${s.coins} coins`;
    if (coinsChanged) this.bump(this.coinsText);
    this.weaponBtn.innerHTML = `<span class="wb-ic">${weaponIconSvg(s.weaponId, `h-${s.weaponId}`)}</span><span>${s.weaponName}</span>`;
  }

  /** Restart a short pop animation on an element. */
  private bump(el: HTMLElement): void {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  /** Render the catalog from a model. Called on open, on tab changes and after every purchase. */
  showCatalog(m: CatalogModel): void {
    const shop = m.from === 'shop';
    this.catalogTitle.textContent = shop ? `Wave ${m.wave} cleared` : TAB_LABELS[m.tab];
    this.catalogCoins.textContent = `${m.coins} coins`;
    this.catalogSub.textContent = shop && m.bonus > 0 ? `+${m.bonus}` : '';
    this.catalogClose.textContent = shop ? 'Next wave' : m.from === 'build' ? 'Back to building' : 'Back';

    const tabs: CatalogTab[] = m.showKit ? ['weapons', 'upgrades', 'fortress', 'kit'] : ['weapons', 'upgrades', 'fortress'];
    this.catalogTabs.innerHTML = tabs
      .map((t) => `<button class="tab${t === m.tab ? ' is-active' : ''}" data-act="tab" data-id="${t}">${TAB_LABELS[t]}</button>`)
      .join('');

    const bodies: Record<CatalogTab, () => string> = {
      weapons: () => this.weaponsHtml(m),
      upgrades: () => this.upgradesHtml(m),
      fortress: () => this.fortressHtml(m.fortress),
      kit: () => this.kitHtml(m),
    };
    this.catalogBody.innerHTML = bodies[m.tab]();
    this.catalogBody.scrollTop = 0;
    this.catalogPanel.classList.remove('hidden');
  }

  /** A weapon as a small artwork tile: icon, name, one badge, three meters, one action. */
  private weaponsHtml(m: CatalogModel): string {
    return `<div class="wgrid">${m.weapons
      .map((w) => {
        let action: string;
        if (!w.owned) {
          action = `<button class="wbuy" data-act="buy" data-id="${w.id}" ${w.canBuy ? '' : 'disabled'}>${w.price}</button>`;
        } else if (w.equipped) {
          action = `<span class="wtick">Equipped</span>`;
        } else {
          action = `<button class="wbuy wequip" data-act="equip" data-id="${w.id}">Equip</button>`;
        }
        const cls = `wcard${w.equipped ? ' is-equipped' : ''}${w.owned ? '' : ' is-locked'}`;
        return `<div class="${cls}" style="--c:${w.color}" title="${w.blurb}">
          <div class="wart">${weaponIconSvg(w.id, `c-${w.id}`)}</div>
          <div class="wname">${w.name}</div>
          <div class="wbadge">${w.badge}</div>
          <div class="wmeters" aria-hidden="true">
            <i style="--v:${w.power.toFixed(2)}"></i><i style="--v:${w.rate.toFixed(2)}"></i><i style="--v:${w.speed.toFixed(2)}"></i>
          </div>
          <div class="wfoot">${action}</div>
        </div>`;
      })
      .join('')}</div>`;
  }

  private upgradesHtml(m: CatalogModel): string {
    return `<div class="card-grid">${m.upgrades
      .map((u) => {
        const maxed = u.level >= u.cap;
        const pips = Array.from({ length: u.cap }, (_, i) => `<i class="${i < u.level ? 'on' : ''}"></i>`).join('');
        const action = maxed
          ? `<button class="btn small" disabled>MAX</button>`
          : `<button class="btn small" data-act="upgrade" data-id="${u.id}" ${u.canBuy ? '' : 'disabled'}>Buy ${u.cost}</button>`;
        return `<div class="card">
          <div class="card-title">${u.name}</div>
          <div class="card-blurb">${u.blurb}</div>
          <div class="pips">${pips}</div>
          ${action}
        </div>`;
      })
      .join('')}</div>`;
  }

  /**
   * Fortress pieces as art tiles. Locked pieces show their unlock price; unlocked
   * ones a buy button and how many are in the bag and in the fortress.
   */
  private fortressHtml(f: FortressModel): string {
    const place = f.canPlace ? `<button class="btn small build-go" data-act="build">Place pieces</button>` : '';
    const cards = f.items
      .map((it) => {
        const action = it.unlocked
          ? `<button class="wbuy" data-act="f-buy" data-id="${it.id}" ${it.canBuy ? '' : 'disabled'}>${it.price}</button>`
          : `<button class="wbuy funlock" data-act="f-unlock" data-id="${it.id}" ${it.canUnlock ? '' : 'disabled'}>Unlock ${it.unlock}</button>`;
        const stats = it.unlocked
          ? `<span title="In your bag">Bag ${it.owned}</span><span title="Standing in the fortress">Built ${it.placed}/${it.maxPlaced}</span>`
          : `<span>Locked</span>`;
        return `<div class="wcard fcard${it.unlocked ? '' : ' is-locked'}" style="--c:${it.color}" title="${it.blurb}">
          <div class="wart">${fortressIconSvg(it.id)}</div>
          <div class="wname">${it.name}</div>
          <div class="fblurb">${it.blurb}</div>
          <div class="fstats"><span>♥ ${it.hp}</span>${stats}</div>
          <div class="wfoot">${action}</div>
        </div>`;
      })
      .join('');
    return `<div class="fhead"><span>Buy pieces, then drag them onto your island.</span>${place}</div><div class="wgrid">${cards}</div>`;
  }

  private kitHtml(m: CatalogModel): string {
    const r = m.repair;
    return `<div class="card-grid"><div class="card card-wide">
        <div class="card-title">Repair Kit</div>
        <div class="card-blurb">Restores ${r.heal} health.</div>
        <button class="btn small" data-act="repair" ${r.canBuy ? '' : 'disabled'}>Buy ${r.cost}</button>
      </div></div>`;
  }

  // ---- Build mode -----------------------------------------------------------

  showBuild(m: BuildModel): void {
    this.buildCoins.textContent = `${m.coins} coins`;
    this.buildRotate.classList.toggle('is-on', m.rotated);
    const slots = m.items
      .map((it) => {
        const full = it.placed >= it.maxPlaced;
        const cls = `tray-slot${it.canPlace ? '' : ' is-empty'}${m.dragging === it.id ? ' is-held' : ''}`;
        const badge = full ? 'Max' : `×${it.count}`;
        return `<button class="${cls}" data-tray="${it.id}" style="--c:${it.color}" type="button" title="${it.name}">
          <span class="tray-art">${fortressIconSvg(it.id)}</span>
          <span class="tray-name">${it.name}</span>
          <span class="tray-count">${badge}</span>
        </button>`;
      })
      .join('');
    const more = `<button class="tray-slot tray-more" data-act="build-shop" type="button">
        <span class="tray-plus">+</span><span class="tray-name">${m.lockedCount > 0 ? `${m.lockedCount} to unlock` : 'Buy more'}</span>
      </button>`;
    this.buildTray.innerHTML = slots + more;
    const anyPieces = m.items.some((i) => i.count > 0);
    this.buildHint.textContent = m.dragging
      ? 'Drop it on your island. Drop it back here to keep it.'
      : anyPieces
        ? 'Drag a piece onto your island. Drag a built piece to move it.'
        : 'Your bag is empty. Buy pieces in the shop.';
  }

  /** True when a client point is over the build tray (dropping there cancels a placement). */
  isOverTray(clientX: number, clientY: number): boolean {
    const r = this.buildTray.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  /** A quick no-no shake on a tray slot that cannot be used. */
  shakeTraySlot(id: FortressItemId): void {
    const el = this.buildTray.querySelector<HTMLElement>(`[data-tray="${id}"]`);
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  showGameOver(text: string): void {
    this.gameoverSub.textContent = text;
  }

  showHint(): void {
    this.hint.classList.remove('hidden');
  }

  hideHint(): void {
    this.hint.classList.add('hidden');
  }
}
