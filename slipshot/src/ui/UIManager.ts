import { UPGRADE_MAX_LEVEL } from '../config';
import { UPGRADES, type UpgradeId } from '../game/Progression';

export interface HudState {
  hp: number;
  maxHp: number;
  wave: number;
  score: number;
  levels: Record<UpgradeId, number>;
}

export interface UIHandlers {
  onRestart(): void;
  onUpgrade(id: UpgradeId): void;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

/** DOM overlays: HUD, upgrade picker, game over, restart and hint. */
export class UIManager {
  private readonly hpFill = byId<HTMLDivElement>('player-hp-fill');
  private readonly hpText = byId<HTMLDivElement>('player-hp-text');
  private readonly waveText = byId<HTMLDivElement>('wave-text');
  private readonly scoreText = byId<HTMLDivElement>('score-text');
  private readonly levelsEl = byId<HTMLDivElement>('upgrade-levels');
  private readonly upgradePanel = byId<HTMLDivElement>('upgrade-panel');
  private readonly upgradeOptions = byId<HTMLDivElement>('upgrade-options');
  private readonly gameoverPanel = byId<HTMLDivElement>('gameover-panel');
  private readonly gameoverSub = byId<HTMLParagraphElement>('gameover-sub');
  private readonly hint = byId<HTMLDivElement>('hint');
  private lastHud = '';

  constructor(private readonly handlers: UIHandlers) {
    byId<HTMLButtonElement>('restart-btn').addEventListener('click', () => this.handlers.onRestart());
    byId<HTMLButtonElement>('gameover-restart').addEventListener('click', () => this.handlers.onRestart());
  }

  setHud(s: HudState): void {
    const key = [s.hp, s.maxHp, s.wave, s.score, s.levels.power, s.levels.splat, s.levels.duration].join('|');
    if (key === this.lastHud) return;
    this.lastHud = key;
    const frac = Math.max(0, Math.min(1, s.hp / s.maxHp));
    this.hpFill.style.transform = `scaleX(${frac.toFixed(4)})`;
    this.hpText.textContent = `${Math.ceil(s.hp)} / ${s.maxHp}`;
    this.waveText.textContent = `WAVE ${s.wave}`;
    this.scoreText.textContent = `Score ${s.score}`;
    this.levelsEl.innerHTML = UPGRADES.map(
      (u) => `<span class="chip">${u.title} <b>${s.levels[u.id]}</b></span>`,
    ).join('');
  }

  showUpgrades(levels: Record<UpgradeId, number>, wave: number): void {
    byId<HTMLHeadingElement>('upgrade-title').textContent = `Wave ${wave} cleared!`;
    this.upgradeOptions.innerHTML = '';
    for (const u of UPGRADES) {
      const level = levels[u.id];
      const maxed = level >= UPGRADE_MAX_LEVEL;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'upgrade-card';
      btn.disabled = maxed;
      btn.innerHTML = `
        <span class="upgrade-title">${u.title}</span>
        <span class="upgrade-detail">${u.detail}</span>
        <span class="pips">${Array.from({ length: UPGRADE_MAX_LEVEL }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('')}</span>
        <span class="upgrade-state">${maxed ? 'MAX' : `Level ${level} → ${level + 1}`}</span>`;
      btn.addEventListener('click', () => this.handlers.onUpgrade(u.id));
      this.upgradeOptions.appendChild(btn);
    }
    this.upgradePanel.classList.remove('hidden');
  }

  hideUpgrades(): void {
    this.upgradePanel.classList.add('hidden');
  }

  showGameOver(text: string): void {
    this.gameoverSub.textContent = text;
    this.gameoverPanel.classList.remove('hidden');
  }

  hideGameOver(): void {
    this.gameoverPanel.classList.add('hidden');
  }

  showHint(): void {
    this.hint.classList.remove('hidden');
  }

  hideHint(): void {
    this.hint.classList.add('hidden');
  }
}
