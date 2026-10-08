import type { DiscoverySystem } from '../gameplay/DiscoverySystem';
import type { SaveManager } from '../save/SaveManager';
import { HUD, type HudState } from './HUD';
import { el } from './Dom';
import {
  challenges,
  deathScreen,
  discoveries,
  howTo,
  introScreen,
  mainMenu,
  mouseRequired,
  pauseScreen,
  resultsScreen,
  roomSelect,
  settingsScreen,
  type DeathData,
  type ResultsData,
  type ScreenName,
  type UICallbacks,
} from './Screens';

/**
 * Owns the DOM overlay: which screen is up, the HUD, and the toast stack.
 *
 * Screens are rebuilt when shown rather than kept around and synced. They are
 * small, they only appear when the simulation is paused, and rebuilding removes
 * a whole class of stale-state bugs for no measurable cost.
 */
export class UIManager {
  private readonly root: HTMLElement;
  private readonly screenHost: HTMLElement;
  private readonly toastHost: HTMLElement;
  readonly hud: HUD;

  private current: ScreenName = 'none';
  /** Where to return to when a nested screen is closed. */
  private returnTo: ScreenName = 'menu';
  private introLines: readonly string[] = [];
  private introIndex = 0;

  constructor(
    root: HTMLElement,
    private readonly save: SaveManager,
    private readonly discovery: DiscoverySystem,
    private readonly callbacks: UICallbacks,
  ) {
    this.root = root;
    this.screenHost = el('div');
    this.screenHost.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    this.toastHost = el('div', 'toasts');
    this.hud = new HUD(this.root);
    this.root.append(this.screenHost, this.toastHost);
  }

  get screen(): ScreenName {
    return this.current;
  }

  /** True when a screen is up that should stop the simulation. */
  get blocking(): boolean {
    return this.current !== 'none';
  }

  show(name: ScreenName, data?: ResultsData | DeathData): void {
    this.current = name;
    this.screenHost.replaceChildren();
    this.screenHost.style.pointerEvents = name === 'none' ? 'none' : 'auto';
    this.hud.setVisible(name === 'none' || name === 'mouse');

    switch (name) {
      case 'none':
        break;
      case 'menu':
        this.returnTo = 'menu';
        this.screenHost.append(mainMenu(this.save, this.discovery, this.callbacks));
        break;
      case 'rooms':
        this.screenHost.append(roomSelect(this.save, this.callbacks));
        break;
      case 'challenges':
        this.screenHost.append(challenges(this.save, this.callbacks));
        break;
      case 'discoveries':
        this.screenHost.append(discoveries(this.discovery, this.callbacks));
        break;
      case 'settings':
        this.screenHost.append(settingsScreen(this.save, this.callbacks));
        break;
      case 'howto':
        this.screenHost.append(howTo(this.callbacks));
        break;
      case 'paused':
        this.returnTo = 'paused';
        this.screenHost.append(pauseScreen(this.hudRoomName, this.callbacks));
        break;
      case 'results':
        this.screenHost.append(resultsScreen(data as ResultsData, this.callbacks));
        break;
      case 'dead':
        this.screenHost.append(deathScreen(data as DeathData, this.callbacks));
        break;
      case 'mouse':
        this.screenHost.append(mouseRequired());
        break;
      case 'intro':
        this.screenHost.append(introScreen(this.introLines, this.introIndex));
        break;
    }
  }

  private hudRoomName = '';

  setRoomName(name: string): void {
    this.hudRoomName = name;
  }

  /** Where BACK goes from a nested screen. */
  back(): void {
    this.show(this.returnTo === 'paused' ? 'paused' : 'menu');
  }

  beginIntro(lines: readonly string[]): void {
    this.introLines = lines;
    this.introIndex = 0;
    if (lines.length > 0) this.show('intro');
  }

  /** Returns true when the intro has more to say. */
  advanceIntro(): boolean {
    this.introIndex++;
    if (this.introIndex >= this.introLines.length) return false;
    this.show('intro');
    return true;
  }

  get introLineCount(): number {
    return this.introLines.length;
  }

  updateHud(state: HudState): void {
    this.hud.update(state);
  }

  toast(text: string, tone: 'warm' | 'cool' | 'hot'): void {
    const node = el('div', `toast ${tone === 'warm' ? '' : tone}`.trim(), text);
    this.toastHost.append(node);
    // Keep the stack short so a cascade of events does not become a wall of text.
    while (this.toastHost.childElementCount > 3) {
      this.toastHost.firstElementChild?.remove();
    }
    window.setTimeout(() => node.remove(), 2700);
  }

  clearToasts(): void {
    this.toastHost.replaceChildren();
  }
}
