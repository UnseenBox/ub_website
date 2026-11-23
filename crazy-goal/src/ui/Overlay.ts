import { ICONS, type IconName } from './GameIcons';
import starUrl from '../assets/ui/arcade-star.png';
import coinUrl from '../assets/ui/arcade-coin.png';
import { lang, tr, type Lang } from '../core/i18n';
import { chapterOf } from '../progression/Progression';
import type { Division, SeasonResult, StandingRow } from '../progression/League';
import type { Boost } from '../abilities/Cards';
import { cardOf } from '../abilities/Cards';
import { UPGRADE_MAX, type UpgradeId } from '../progression/Upgrades';
import { ABILITY_ICON } from './abilityIcons';
import { football, footballSvg } from './Football';
import { logoSvg } from './Logo';

export interface SkinTile {
  id: string;
  name: string;
  base: string;
  patch: string;
  need: number;
  open: boolean;
  selected: boolean;
}

export interface OverlayHandlers {
  play(): void;
  resume(): void;
  restart(): void;
  pause(): void;
  home(): void;
  /** Portals without duels (their server lives elsewhere) hide the tile. */
  canDuel(): boolean;
  /** A rewarded ad for coins, from the pause menu. */
  reward(): void;
  levels(): void;
  select(index: number): void;
  closeLevels(): void;
  next(): void;
  /** Watch an ad to double the first-clear coins. */
  double(): void;
  retry(): void;
  duel(): void;
  volumes(): { sound: number; music: number };
  setSound(volume: number): void;
  setMusic(volume: number): void;
  setLang(lang: Lang): void;
  skins(): SkinTile[];
  pickSkin(id: string): void;
  /** The balls screen was opened. */
  skinsSeen(): void;
  stars(): { n: number; max: number };
  /** Everything the main menu shows besides its fixed buttons. */
  menuInfo(): MenuInfo;
  /** What the store sells and what the player has. */
  store(): StoreInfo;
  /** Buys the next level of an upgrade; false when it cannot. */
  buyUpgrade(id: UpgradeId): boolean;
  /** Buys `count` charges of an ability; false when the coins are short. */
  buyAbilities(id: Boost, count: number): boolean;
  resetProgress(): void;
  /** CLAIM on the season result card: pays that season's prize, once. */
  claimSeasonPrize(): void;
}

/** The store screen: shot upgrades with their level and next price, and abilities to stock up on. */
export interface StoreInfo {
  coins: number;
  upgrades: { id: UpgradeId; name: string; hint: string; level: number; price: number | null }[];
  abilities: { id: Boost; owned: number; single: number; pack: number }[];
}

/** STREET LEAGUE as the screen shows it: the division, the days left, the table, the prizes, and the last season's result while unclaimed. */
export interface LeagueInfo {
  division: Division;
  daysLeft: number;
  rows: StandingRow[];
  prizes: { position: number; coins: number; trophy: boolean }[];
  trophies: number;
  pending: SeasonResult | null;
}

/** What the main menu draws. The Game fills it in; the Overlay never reads the save. */
export interface MenuInfo {
  stars: { n: number; max: number };
  coins: number;
  /** The match LET'S PLAY continues at: its number (1-based) and its stadium's name. */
  continueNumber: number;
  /** The level Continue goes to is one of the tutorial lessons. */
  lesson: boolean;
  continueName: string;
  /** A ball has unlocked that the player has not been told about. */
  newBall: boolean;
  /** CLUB LEVEL: the level, the XP into it, and the XP the level needs. */
  club: { level: number; xp: number; need: number };
  /** STREET LEAGUE: the table, the prizes, and any season result whose prize is unclaimed. */
  league: LeagueInfo;
}

/** WORLD COMPLETE, as the panel shows it: the world, its stars, its reward, and a preview of the next world. */
export interface WorldInfo {
  world: number;
  /** English; `tr()` translates it. */
  title: string;
  stars: number;
  max: number;
  reward: number;
  trophies: number;
  nextTitle: string | null;
  /** The next world's theme, as a label (English; `tr()` translates it). */
  nextTheme: string | null;
}

export interface LevelTile {
  name: string;
  /** The heading it is listed under (English; `tr()` translates it) and the number printed on the tile. */
  group: string;
  label: string;
  hint: string;
  stars: number;
  best: number;
  unlocked: boolean;
  /** The next star still to win here and the Crazy Score it needs; absent at three stars. */
  next?: { star: number; target: number };
  /** Set when the chapter's star gate is the only thing keeping this level shut. */
  gate?: { need: number; have: number };
  /** The level's coin has not been collected yet. */
  coin?: boolean;
  /** The match is its world's boss: a red BOSS badge on the tile. */
  boss?: boolean;
  /** The match's bonus objective has been met: a medal on the tile. */
  bonus?: boolean;
}

/** One chapter's gate, for the header on the map: stars asked, stars had, and whether it blocks. */
export interface ChapterGate {
  need: number;
  have: number;
  open: boolean;
}

/** The arcade star sprite used wherever a star shows in the DOM. */
const starSprite = (): HTMLImageElement => {
  const img = document.createElement('img');
  img.src = starUrl;
  img.alt = '';
  img.draggable = false;
  return img;
};



/** The Free Kicks tile's picture: a goal, a wall of three and a ball curling round it. Pure decoration. */
let uiClick: (() => void) | null = null;
/** Registers the sound played on menu/UI button taps. */
export function setUiClick(fn: (() => void) | null): void {
  uiClick = fn;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, textContent?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (textContent !== undefined) node.textContent = tr(textContent);
  return node;
}

function button(className: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className, label);
  b.type = 'button';
  b.addEventListener('click', () => {
    uiClick?.();
    onClick();
  });
  return b;
}

/** The groove of a slider is green up to the knob; the stylesheet reads how far from `--fill`. */
function paintFill(input: HTMLInputElement): void {
  input.style.setProperty('--fill', `${input.value}%`);
}

/** A setting's name with its sticker in front. */
function settingName(label: string, icon: IconName): HTMLElement {
  const name = el('span', 'setting-name');
  const art = el('span', 'setting-icon');
  art.innerHTML = ICONS[icon];
  name.append(art, el('span', '', label));
  return name;
}

/** A white BACK button with the arrow sticker. */
function backButton(className: string, onClick: () => void): HTMLButtonElement {
  const b = button(className, '', onClick);
  const art = el('span', 'btn-icon');
  art.innerHTML = ICONS.back;
  b.append(art, el('span', 'btn-label', 'BACK'));
  return b;
}

function slider(label: string, icon: IconName, onInput: (volume: number) => void): { row: HTMLElement; input: HTMLInputElement } {
  const row = el('label', 'setting');
  const input = el('input', 'setting-range');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '5';
  input.addEventListener('input', () => {
    paintFill(input);
    onInput(Number(input.value) / 100);
  });
  input.addEventListener('keydown', (e) => e.stopPropagation());
  row.append(settingName(label, icon), input);
  return { row, input };
}

/** The pause cabinet's icons, from the sticker set: play, replay, goal, home and a gear. */

const pauseButton = (className: string, label: string, icon: string, onClick: () => void): HTMLButtonElement => {
  const b = button(className, '', onClick);
  const art = el('span', 'btn-icon');
  art.innerHTML = icon;
  b.append(art, el('span', 'btn-label', label));
  return b;
};

export class Overlay {
  private readonly menu: HTMLElement;
  private readonly pause: HTMLElement;
  private readonly levels: HTMLElement;
  private readonly settings: HTMLElement;
  private readonly skins: HTMLElement;
  private readonly storeScreen: HTMLElement;
  private readonly worldScreen: HTMLElement;
  private readonly worldBody: HTMLElement;
  private readonly leagueScreen: HTMLElement;
  private readonly leagueBody: HTMLElement;
  private readonly resultScreen: HTMLElement;
  private readonly resultBody: HTMLElement;
  private readonly storeBody: HTMLElement;
  private readonly storeCoins: HTMLElement;
  private readonly levelBody: HTMLElement;
  private readonly levelProgress: HTMLElement;
  private readonly skinGrid: HTMLElement;
  private readonly skinProgress: HTMLElement;
  private readonly starCount: HTMLElement;
  private readonly starText: HTMLElement;
  private readonly coinText: HTMLElement;
  private readonly clubLabel: HTMLElement;
  private readonly clubFill: HTMLElement;
  private readonly continueLine: HTMLElement;
  private readonly ballsDot: HTMLElement;
  private readonly sound: HTMLInputElement;
  private readonly music: HTMLInputElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly playButton: HTMLButtonElement;
  private readonly result: HTMLElement;
  private readonly nextButton: HTMLButtonElement;
  /** The NEXT MATCH ring's fill, 0 to 1, or -1 when there is no ring. */
  private advanceShown = -1;
  private readonly doubleButton: HTMLButtonElement;
  private readonly rewardButton: HTMLButtonElement;
  private readonly screens: HTMLElement[];
  private settingsFrom: HTMLElement;
  private settingsClose: (() => void) | null = null;
  private resetArmed = false;
  private readonly resetButton: HTMLButtonElement;
  private readonly rewardLabel: HTMLElement;
  private readonly toast: HTMLElement;
  private toastTimer = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly handlers: OverlayHandlers,
  ) {
    this.menu = el('div', 'screen menu menu-bg');

    const top = el('div', 'menu-top');
    const gear = button('menu-gear', '', () => this.showSettings());
    gear.setAttribute('aria-label', tr('SETTINGS'));
    gear.innerHTML = ICONS.gear;
    const coinPill = el('p', 'star-count coin-count');
    const coinIcon = el('span', 'star-count-icon');
    const coinImg = document.createElement('img');
    coinImg.src = coinUrl;
    coinImg.alt = '';
    coinImg.draggable = false;
    coinIcon.append(coinImg);
    this.coinText = el('span', 'star-count-text');
    coinPill.append(coinIcon, this.coinText);
    this.starCount = el('p', 'star-count');
    const starIcon = el('span', 'star-count-icon');
    starIcon.append(starSprite());
    this.starText = el('span', 'star-count-text');
    this.starCount.append(starIcon, this.starText);
    const topRight = el('div', 'menu-top-right');
    topRight.append(coinPill, this.starCount);
    // CLUB LEVEL: a thin bar under the coin and star pills.
    const clubBar = el('div', 'club-bar');
    this.clubLabel = el('span', 'club-label');
    const clubTrack = el('div', 'club-track');
    this.clubFill = el('span', 'club-fill');
    clubTrack.append(this.clubFill);
    clubBar.append(this.clubLabel, clubTrack);
    const meters = el('div', 'menu-meters');
    meters.append(topRight, clubBar);
    top.append(gear, meters);

    const mark = el('h1', 'menu-logo');
    mark.setAttribute('aria-label', 'Crazy Kora');
    mark.dir = 'ltr';
    // The wordmark is drawn as a vector, so it is sharp on every screen.
    mark.innerHTML = logoSvg('menu-logo-art');

    // The hero action: continue the campaign where the player left off.
    const hero = el('div', 'menu-actions');
    const play = button('menu-play', '', handlers.play);
    play.setAttribute('aria-label', tr('PLAY'));
    this.playButton = play;
    // A real button rather than a picture of one: the play sticker, the words, an arrow.
    const playIcon = el('span', 'menu-play-icon');
    playIcon.innerHTML = ICONS.play;
    play.append(playIcon, el('span', 'menu-play-label', "LET'S PLAY"), el('span', 'menu-play-arrow', '➜'));
    this.continueLine = el('p', 'menu-continue');
    hero.append(play, this.continueLine);

    // The two shelves: the stadiums (the matches) and the balls.
    const shortcuts = el('div', 'menu-shortcuts');
    const stadiums = button('menu-shortcut menu-shortcut-stadiums', '', handlers.levels);
    stadiums.setAttribute('aria-label', tr('STADIUMS'));
    const stadiumsArt = el('span', 'menu-shortcut-art menu-shortcut-icon');
    stadiumsArt.innerHTML = ICONS.goal;
    stadiums.append(stadiumsArt, el('span', 'menu-shortcut-label', 'STADIUMS'));
    const ballsButton = button('menu-shortcut menu-shortcut-balls', '', () => this.showSkins());
    ballsButton.setAttribute('aria-label', tr('BALLS'));
    // Three of the balls to collect, piled up.
    const ballsArt = el('span', 'menu-shortcut-art menu-shortcut-icon');
    ballsArt.innerHTML =
      `<svg class="game-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">` +
      football(14, 30, 11, { base: '#fff4e0', patch: '#f08a24' }) +
      football(35, 30, 11, { base: '#fbf7ee', patch: '#1f5fa8' }) +
      football(24, 20, 13) +
      `</svg>`;
    this.ballsDot = el('span', 'menu-new-dot');
    this.ballsDot.hidden = true;
    ballsButton.append(ballsArt, el('span', 'menu-shortcut-label', 'BALLS'), this.ballsDot);
    const storeButton = button('menu-shortcut menu-shortcut-store', '', () => this.showStore());
    storeButton.setAttribute('aria-label', tr('STORE'));
    const storeArt = el('span', 'menu-shortcut-art menu-shortcut-icon');
    storeArt.innerHTML = ICONS.store;
    storeButton.append(storeArt, el('span', 'menu-shortcut-label', 'STORE'));
    // STREET LEAGUE: the fourth card, with the trophy sticker. On a phone the four go in a 2 x 2 grid.
    const leagueButton = button('menu-shortcut menu-shortcut-league', '', () => this.showLeague());
    leagueButton.setAttribute('aria-label', tr('LEAGUE'));
    const leagueArt = el('span', 'menu-shortcut-art menu-shortcut-icon');
    leagueArt.innerHTML = ICONS.trophy;
    leagueButton.append(leagueArt, el('span', 'menu-shortcut-label', 'LEAGUE'));
    shortcuts.append(stadiums, ballsButton, storeButton, leagueButton);

    // A duel against a friend, where the server is reachable.
    const secondary = el('div', 'menu-secondary');
    if (handlers.canDuel()) secondary.append(button('menu-duel', 'DUEL A FRIEND', handlers.duel));

    const menuPanel = el('div', 'menu-panel');
    menuPanel.append(mark, hero, shortcuts, secondary);
    const frame = el('div', 'menu-frame');
    frame.append(top, menuPanel);
    this.menu.append(frame);
    this.settingsFrom = this.menu;

    this.pause = el('div', 'screen pause');
    const panel = el('div', 'panel pause-panel');
    this.rewardButton = button('btn btn-sun reward-button', '', handlers.reward);
    const rewardArt = el('span', 'btn-icon');
    rewardArt.innerHTML = ICONS.ad;
    this.rewardLabel = el('span', 'btn-label', '+30 COINS');
    this.rewardButton.append(rewardArt, this.rewardLabel);
    this.rewardButton.hidden = true;
    panel.append(
      el('h2', 'panel-title', 'PAUSED'),
      pauseButton('btn btn-primary', 'RESUME', ICONS.play, handlers.resume),
      pauseButton('btn btn-sun', 'RESTART SHOT', ICONS.replay, handlers.restart),
      pauseButton('btn btn-navy', 'STADIUMS', ICONS.goal, handlers.levels),
      pauseButton('btn btn-red', 'HOME', ICONS.home, handlers.home),
      this.rewardButton,
      pauseButton('btn btn-ghost', 'SETTINGS', ICONS.gear, () => this.showSettings()),
    );
    this.pause.append(panel);

    this.levels = el('div', 'screen levels');
    const sheet = el('div', 'sheet sheet-wide');
    this.levelProgress = el('div', 'level-progress');
    this.levelBody = el('div', 'level-body');
    const back = backButton('btn btn-ghost', handlers.closeLevels);
    sheet.append(el('h2', 'panel-title', 'STADIUMS'), this.levelProgress, this.levelBody, back);
    this.levels.append(sheet);

    this.settings = el('div', 'screen pause');
    const prefs = el('div', 'panel settings-panel');
    const sound = slider('SOUND', 'sound', handlers.setSound);
    const music = slider('MUSIC', 'music', handlers.setMusic);
    this.sound = sound.input;
    this.music = music.input;
    const langs = el('div', 'setting');
    const pick = el('div', 'lang-pick');
    for (const [code, name] of [['en', 'ENGLISH'], ['ar', 'العربية']] as const) {
      const b = button(`btn btn-ghost lang-button${code === lang ? ' is-on' : ''}`, name, () => handlers.setLang(code));
      b.setAttribute('aria-pressed', String(code === lang));
      pick.append(b);
    }
    langs.append(settingName('LANGUAGE', 'globe'), pick);
    this.resetButton = button('btn btn-ghost reset-button', 'RESET PROGRESS', () => this.confirmReset());
    prefs.append(el('h2', 'panel-title', 'SETTINGS'), sound.row, music.row, langs, this.resetButton, backButton('btn btn-primary', () => this.closeSettings()));
    this.settings.append(prefs);

    this.skins = el('div', 'screen levels');
    const balls = el('div', 'sheet sheet-wide');
    this.skinProgress = el('p', 'skin-progress');
    this.skinGrid = el('div', 'grid');
    balls.append(el('h2', 'panel-title', 'BALLS'), this.skinProgress, this.skinGrid, backButton('btn btn-ghost', () => this.showMenu()));
    this.skins.append(balls);

    this.storeScreen = el('div', 'screen levels store');
    const storeSheet = el('div', 'sheet sheet-wide store-sheet');
    this.storeCoins = el('p', 'store-wallet');
    this.storeBody = el('div', 'store-body');
    storeSheet.append(el('h2', 'panel-title', 'STORE'), this.storeCoins, this.storeBody, backButton('btn btn-ghost', () => this.showMenu()));
    this.storeScreen.append(storeSheet);
    // STREET LEAGUE: the table, with BACK always under it.
    this.leagueScreen = el('div', 'screen levels league');
    const leagueSheet = el('div', 'sheet sheet-wide league-sheet');
    this.leagueBody = el('div', 'league-body');
    leagueSheet.append(el('h2', 'panel-title', 'STREET LEAGUE'), this.leagueBody, backButton('btn btn-ghost league-back', () => this.showMenu()));
    this.leagueScreen.append(leagueSheet);
    // The season result: shown on the first open of a new week, until its prize is claimed.
    this.resultScreen = el('div', 'screen levels league');
    const resultSheet = el('div', 'sheet sheet-wide league-sheet');
    this.resultBody = el('div', 'league-result');
    resultSheet.append(el('h2', 'panel-title', 'SEASON RESULT'), this.resultBody);
    this.resultScreen.append(resultSheet);
    // WORLD COMPLETE: the first time a world's boss match is cleared.
    this.worldScreen = el('div', 'screen levels world');
    const worldSheet = el('div', 'sheet sheet-wide world-sheet');
    this.worldBody = el('div', 'world-body');
    worldSheet.append(el('h2', 'panel-title', 'WORLD COMPLETE'), this.worldBody);
    this.worldScreen.append(worldSheet);

    root.append(this.menu, this.pause, this.levels, this.settings, this.skins, this.storeScreen, this.leagueScreen, this.resultScreen, this.worldScreen);
    this.screens = [this.menu, this.pause, this.levels, this.settings, this.skins, this.storeScreen, this.leagueScreen, this.resultScreen, this.worldScreen];

    this.pauseButton = button('pause-button', '', handlers.pause);
    this.pauseButton.setAttribute('aria-label', 'Pause');
    this.pauseButton.append(el('span', 'pause-bar'), el('span', 'pause-bar'));
    this.pauseButton.hidden = true;

    this.result = el('div', 'result');
    this.nextButton = button('btn btn-primary', 'NEXT MATCH', handlers.next);
    this.doubleButton = button('btn btn-sun result-double', '', handlers.double);
    const doubleArt = el('span', 'btn-icon');
    doubleArt.innerHTML = ICONS.ad;
    this.doubleButton.append(doubleArt, el('span', 'btn-label', 'x2 COINS'));
    this.doubleButton.hidden = true;
    this.result.append(button('btn btn-navy', 'AGAIN', handlers.retry), this.nextButton, this.doubleButton);
    this.result.hidden = true;
    this.toast = el('div', 'toast');
    this.toast.hidden = true;
    this.toast.setAttribute('role', 'status');
    root.after(this.pauseButton, this.result, this.toast);
  }

  addScreen(screen: HTMLElement): void {
    screen.hidden = true;
    this.root.append(screen);
    this.screens.push(screen);
  }

  addFloating(...nodes: HTMLElement[]): void {
    this.root.after(...nodes);
  }

  showScreen(screen: HTMLElement): void {
    this.show(screen);
  }

  private show(screen: HTMLElement | null): void {
    for (const s of this.screens) s.hidden = s !== screen;
    this.root.classList.toggle('is-open', screen !== null);
    this.pauseButton.hidden = screen !== null;
    if (screen) this.result.hidden = true;
    if (screen === this.menu) this.playButton.focus({ preventScroll: true });
    else screen?.querySelector('button')?.focus({ preventScroll: true });
  }

  /** True while the stadium list or the balls screen is up: menus, where the match's sound stops. */
  get inMenus(): boolean {
    return this.root.classList.contains('is-open') && (!this.levels.hidden || !this.skins.hidden || !this.storeScreen.hidden || !this.leagueScreen.hidden || !this.resultScreen.hidden);
  }

  showMenu(): void {
    const info = this.refreshMenu();
    // A season that has just ended comes first, until its prize is claimed.
    this.show(info.league.pending ? this.resultScreen : this.menu);
  }

  showPause(): void {
    this.show(this.pause);
  }

  /** A rewarded-ad offer in the pause menu, or null for none. */
  setReward(offer: { label: string } | null): void {
    this.rewardButton.hidden = offer === null;
    if (offer) this.rewardLabel.textContent = tr(offer.label);
  }

  /** Settings over whatever is up (Free Kicks' arena); `onClose` runs after BACK. */
  openSettings(onClose: (() => void) | null): void {
    this.settingsClose = onClose;
    // The arena's layer sits above the overlay: lift the overlay over it while the card is up.
    this.root.parentElement?.classList.toggle('is-above', onClose !== null);
    this.showSettings();
  }

  /** BACK on the settings card: to wherever it was opened from, or back to the arena. */
  closeSettings(): void {
    if (this.settings.hidden) return;
    const close = this.settingsClose;
    this.settingsClose = null;
    if (close) {
      // Opened over the arena: only the card goes, the screens beneath stay as they were.
      this.settings.hidden = true;
      this.root.parentElement?.classList.remove('is-above');
      close();
    } else {
      this.show(this.settingsFrom);
    }
  }

  menuVisible(): boolean {
    return !this.menu.hidden || !this.resultScreen.hidden;
  }

  /** A short message with one action (the new-ball toast); it fades on its own or when tapped away. */
  showToast(text: string, actionLabel: string, onAction: () => void, ms = 7000): void {
    this.toast.replaceChildren();
    const msg = el('span', 'toast-text');
    msg.textContent = text;
    const use = button('toast-action', '', () => {
      onAction();
      this.hideToast();
    });
    use.textContent = actionLabel;
    // A note with nothing to do about it has no button.
    use.hidden = !actionLabel;
    this.toast.append(msg, use);
    this.toast.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.hideToast(), ms);
  }

  private hideToast(): void {
    window.clearTimeout(this.toastTimer);
    this.toast.hidden = true;
  }

  /** Redraws everything the menu shows from the current save. Cheap; called whenever any of it may have changed. */
  refreshMenu(): MenuInfo {
    const info = this.handlers.menuInfo();
    this.starText.textContent = tr('{n} / {max}', { n: info.stars.n, max: info.stars.max });
    this.starCount.setAttribute('aria-label', tr('STARS {n} / {max}', { n: info.stars.n, max: info.stars.max }));
    this.coinText.textContent = String(info.coins);
    this.coinText.parentElement?.setAttribute('aria-label', tr('{n} COINS', { n: info.coins }));
    this.continueLine.textContent = `${tr(info.lesson ? 'LESSON {n}' : 'MATCH {n}', { n: info.continueNumber })} · ${tr(info.continueName)}`;
    this.playButton.setAttribute('aria-label', `${tr('PLAY')}, ${this.continueLine.textContent}`);
    this.ballsDot.hidden = !info.newBall;
    const club = info.club;
    this.clubLabel.textContent = tr('CLUB LV {n}', { n: club.level });
    this.clubFill.style.width = `${Math.min(100, Math.round((club.xp / club.need) * 100))}%`;
    this.clubLabel.parentElement?.setAttribute('aria-label', `${tr('CLUB LV {n}', { n: club.level })}, ${club.xp} / ${club.need}`);
    this.renderLeague(info.league);
    this.renderResult(info.league.pending);
    return info;
  }

  private showSettings(): void {
    this.settingsFrom = this.pause.hidden ? this.menu : this.pause;
    const { sound, music } = this.handlers.volumes();
    this.sound.value = String(Math.round(sound * 100));
    this.music.value = String(Math.round(music * 100));
    paintFill(this.sound);
    paintFill(this.music);
    this.resetArmed = false;
    this.resetButton.textContent = tr('RESET PROGRESS');
    this.show(this.settings);
  }

  private confirmReset(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.resetButton.textContent = tr('ARE YOU SURE? TAP AGAIN TO ERASE EVERYTHING.');
      return;
    }
    this.resetArmed = false;
    // The game puts itself back on the title card, which shows the menu at once. A delayed showMenu() used to
    // run here, and could put the menu back over a match the player had just started.
    this.handlers.resetProgress();
    this.showToast(tr('PROGRESS ERASED'), '', () => {}, 2400);
  }

  /** The store: shot upgrades (three levels each) and abilities to stock up on, paid in coins. */
  private showStore(): void {
    const info = this.handlers.store();
    const coinImg = (): HTMLImageElement => {
      const img = document.createElement('img');
      img.src = coinUrl;
      img.alt = '';
      img.draggable = false;
      img.className = 'store-coin';
      return img;
    };
    this.storeCoins.replaceChildren(coinImg(), el('span', 'store-wallet-n', String(info.coins)));
    this.storeCoins.setAttribute('aria-label', tr('{n} COINS', { n: info.coins }));

    // A price button: the coin and the number, or MAX. Short of coins it shakes and says how many more.
    const priceButton = (cls: string, price: number | null, label: string, buy: () => boolean): HTMLButtonElement => {
      const b = button(`btn ${cls} store-buy`, '', () => {
        if (price === null) return;
        if (buy()) {
          this.showStore();
          return;
        }
        b.classList.remove('is-short');
        void b.offsetWidth;
        b.classList.add('is-short');
        this.showToast(tr('NEED {n} MORE COINS', { n: price - this.handlers.store().coins }), '', () => {}, 2200);
      });
      if (price === null) {
        b.append(el('span', 'btn-label', 'MAX'));
        b.disabled = true;
      } else {
        if (label) b.append(el('span', 'store-buy-count', label));
        b.append(coinImg(), el('span', 'btn-label', String(price)));
        b.classList.toggle('is-dear', price > info.coins);
      }
      return b;
    };

    const row = (art: HTMLElement, title: string, sub: HTMLElement, buys: HTMLElement[]): HTMLElement => {
      const r = el('div', 'store-row');
      const words = el('div', 'store-words');
      words.append(el('span', 'store-name', title), sub);
      const actions = el('div', 'store-actions');
      actions.append(...buys);
      r.append(art, words, actions);
      return r;
    };

    const upgrades = info.upgrades.map((u) => {
      const art = el('span', 'store-art');
      art.innerHTML = ICONS[u.id];
      const sub = el('span', 'store-sub');
      const pips = el('span', 'store-pips');
      for (let i = 0; i < UPGRADE_MAX; i++) pips.append(el('span', i < u.level ? 'store-pip is-on' : 'store-pip'));
      sub.append(pips, el('span', 'store-hint', u.hint));
      return row(art, u.name, sub, [priceButton('btn-primary', u.price, '', () => this.handlers.buyUpgrade(u.id))]);
    });

    const abilities = info.abilities.map((a) => {
      const art = el('span', 'store-art store-art-ability');
      const img = document.createElement('img');
      img.src = ABILITY_ICON[a.id];
      img.alt = '';
      img.draggable = false;
      art.append(img);
      const sub = el('span', 'store-sub');
      sub.append(el('span', a.owned > 0 ? 'store-owned is-some' : 'store-owned', tr('OWNED {n}', { n: a.owned })));
      return row(art, cardOf(a.id).name, sub, [
        priceButton('btn-sun', a.single, '×1', () => this.handlers.buyAbilities(a.id, 1)),
        priceButton('btn-sun', a.pack, '×5', () => this.handlers.buyAbilities(a.id, 5)),
      ]);
    });

    this.storeBody.replaceChildren(
      el('h3', 'chapter-title', 'SHOT UPGRADES'),
      ...upgrades,
      el('h3', 'chapter-title', 'ABILITIES'),
      el('p', 'store-note', 'ONE FOR EACH SHOT. USED BEFORE COINS.'),
      ...abilities,
    );
    this.show(this.storeScreen);
  }

  /** STREET LEAGUE: the table, from the menu's info as it stands now. */
  private showLeague(): void {
    this.refreshMenu();
    this.show(this.leagueScreen);
  }

  /** STREET LEAGUE: the division, the days left, the table with promotion and relegation, and the prizes. */
  private renderLeague(league: LeagueInfo): void {
    const head = el('div', 'league-head');
    head.append(el('span', `league-badge is-${league.division.toLowerCase()}`, league.division), el('p', 'league-days', tr('{n} DAYS LEFT', { n: league.daysLeft })));
    const table = el('div', 'league-table');
    for (const row of league.rows) {
      const zone = row.zone === 'promote' ? ' is-promote' : row.zone === 'relegate' ? ' is-relegate' : '';
      const you = row.isPlayer ? ' is-you' : '';
      const line = el('div', `league-row${zone}${you}`);
      line.append(el('span', 'league-pos', String(row.position)), el('span', 'league-club', row.club), el('span', 'league-lp', tr('{n} LP', { n: row.lp })));
      table.append(line);
    }
    const legend = el('div', 'league-legend');
    if (league.division !== 'GOLD') legend.append(el('span', 'is-promote-key', 'PROMOTION'));
    if (league.division !== 'BRONZE') legend.append(el('span', 'is-relegate-key', 'RELEGATION'));
    const prizes = el('div', 'league-prizes');
    const medal = ['1ST', '2ND', '3RD'];
    for (const p of league.prizes) {
      const cell = el('div', 'league-prize');
      cell.append(el('span', 'league-prize-place', medal[p.position - 1]), el('span', 'league-prize-coins', tr('+{n} COINS', { n: p.coins })));
      if (p.trophy) cell.append(el('span', 'league-prize-trophy', '+1 TROPHY'));
      prizes.append(cell);
    }
    // The legend and the prizes sit in a side column, which a short (landscape) phone puts beside the table.
    const side = el('div', 'league-side');
    side.append(legend, el('h3', 'league-subtitle', 'PRIZES'), prizes, el('p', 'league-trophies', tr('{n} TROPHIES', { n: league.trophies })));
    this.leagueBody.replaceChildren(head, table, side);
  }

  /** The season result: where the player finished, promotion or relegation, and the prize to CLAIM. */
  private renderResult(result: SeasonResult | null): void {
    if (!result) {
      this.resultBody.replaceChildren();
      return;
    }
    const place = tr(result.position <= 3 ? ['1ST PLACE', '2ND PLACE', '3RD PLACE'][result.position - 1] : '{n}TH PLACE', { n: result.position });
    const zone =
      result.zone === 'promote'
        ? tr('PROMOTED TO {division}', { division: tr(result.nextDivision) })
        : result.zone === 'relegate'
          ? tr('RELEGATED TO {division}', { division: tr(result.nextDivision) })
          : tr('STAYS IN {division}', { division: tr(result.division) });
    const prize = `${tr('+{n} COINS', { n: result.coins })}${result.trophy ? ` · ${tr('+1 TROPHY')}` : ''}`;
    this.resultBody.replaceChildren(
      el('p', 'league-result-place', place),
      el('p', 'league-result-line', zone),
      el('p', 'league-result-line', prize),
      button('btn btn-primary league-claim', 'CLAIM', () => {
        this.handlers.claimSeasonPrize();
        this.showMenu();
      }),
    );
  }

  /** WORLD COMPLETE: the panel for a world just completed, with its stars, its trophy and reward, and the next world. */
  showWorld(info: WorldInfo, onContinue: () => void): void {
    const trophy = el('div', 'world-trophy');
    trophy.innerHTML = ICONS.trophy;
    const next = el('div', 'world-next');
    if (info.nextTitle !== null) {
      next.append(el('span', 'world-next-label', 'NEXT WORLD'), el('span', 'world-next-name', info.nextTitle));
      if (info.nextTheme !== null) next.append(el('span', 'world-next-theme', info.nextTheme));
    } else {
      next.append(el('span', 'world-next-label', 'ALL WORLDS WON'));
    }
    this.worldBody.replaceChildren(
      trophy,
      el('p', 'world-name', info.title),
      el('p', 'world-stars', tr('STARS {n} / {max}', { n: info.stars, max: info.max })),
      el('p', 'world-reward', tr('+{n} COINS', { n: info.reward })),
      next,
      el('p', 'world-trophies', tr('WORLD TROPHIES {n} / {max}', { n: info.trophies, max: 8 })),
      button('btn btn-primary world-continue', 'CONTINUE', () => {
        this.show(null);
        onContinue();
      }),
    );
    this.show(this.worldScreen);
  }

  private showSkins(): void {
    this.handlers.skinsSeen();
    const skins = this.handlers.skins();
    const { n } = this.handlers.stars();
    const next = skins.filter((s) => !s.open).sort((a, b) => a.need - b.need)[0];
    this.skinProgress.textContent = next ? tr('STARS {n} / {max}', { n, max: next.need }) + ' → ' + tr(next.name) : tr('STARS {n} / {max}', { n, max: n });
    this.skinGrid.replaceChildren(
      ...skins.map((skin) => {
        const b = button(`tile skin${skin.selected ? ' is-current' : ''}`, '', () => {
          this.handlers.pickSkin(skin.id);
          this.showSkins();
        });
        b.disabled = !skin.open;
        b.setAttribute('aria-label', `${tr(skin.name)}, ${skin.open ? tr(skin.selected ? 'SELECTED' : 'UNLOCKED') : tr('{n} STARS', { n: skin.need })}`);
        // The real ball in this skin's colours.
        const ball = el('span', 'skin-ball');
        ball.innerHTML = footballSvg('skin-ball-art', { base: skin.base, patch: skin.patch });
        b.append(ball, el('span', 'tile-name', skin.name), el('span', 'skin-need', skin.open ? (skin.selected ? '●' : '') : tr('{n} STARS', { n: skin.need })));
        return b;
      }),
    );
    this.show(this.skins);
  }

  showLevels(
    tiles: readonly LevelTile[],
    current: number,
    focus?: number,
    gates: Readonly<Record<number, ChapterGate>> = {},
    worlds: { won: number; total: number } = { won: 0, total: 0 },
  ): void {
    const { n, max } = this.handlers.stars();
    const open = tiles.filter((t) => t.unlocked).length;
    const pct = max > 0 ? Math.round((n / max) * 100) : 0;
    this.levelProgress.innerHTML = '';
    const top = document.createElement('div');
    top.className = 'progress-top';
    const label = document.createElement('span');
    label.className = 'progress-label';
    label.textContent = tr('STARS {n} / {max}', { n, max });
    const count = document.createElement('span');
    count.className = 'progress-count';
    count.textContent = tr('{done}/{total} OPEN', { done: open, total: tiles.length });
    top.append(label, count);
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = `${pct}%`;
    bar.append(fill);
    this.levelProgress.append(top, bar);
    // WORLD TROPHIES: one for each world whose boss match has been cleared.
    const trophyRow = el('p', 'world-trophies');
    const trophyIcon = el('span', 'world-trophies-icon');
    trophyIcon.innerHTML = ICONS.trophy;
    trophyRow.append(trophyIcon, el('span', 'world-trophies-text', tr('WORLD TROPHIES {n} / {max}', { n: worlds.won, max: worlds.total })));
    this.levelProgress.append(trophyRow);

    this.levelBody.innerHTML = '';
    let chapter = '';
    let grid: HTMLElement | null = null;
    // Stars won and available in each chapter, for the headers.
    const chapterTotals = new Map<string, { stars: number; max: number }>();
    tiles.forEach((t) => {
      const sum = chapterTotals.get(t.group) ?? { stars: 0, max: 0 };
      sum.stars += t.stars;
      sum.max += 3;
      chapterTotals.set(t.group, sum);
    });
    const buttons: HTMLButtonElement[] = [];
    tiles.forEach((tile, i) => {
      const want = tile.group;
      if (want !== chapter) {
        chapter = want;
        const num = chapterOf(i);
        const total = chapterTotals.get(want);
        const gate = gates[num];
        const h = document.createElement('h3');
        h.className = 'chapter-title';
        const name = document.createElement('span');
        name.textContent = tr(chapter);
        h.append(name);
        if (total) {
          const stars = document.createElement('span');
          stars.className = 'chapter-stars';
          stars.append(starSprite(), document.createTextNode(`${total.stars} / ${total.max}`));
          stars.setAttribute('aria-label', tr('STARS {n} / {max}', { n: total.stars, max: total.max }));
          h.append(stars);
        }
        this.levelBody.append(h);
        if (gate && !gate.open) {
          const note = document.createElement('p');
          note.className = 'chapter-gate';
          note.textContent = tr('{n} STARS TO OPEN. YOU HAVE {have}.', { n: gate.need, have: gate.have });
          this.levelBody.append(note);
        }
        grid = document.createElement('div');
        grid.className = 'grid';
        this.levelBody.append(grid);
      }
      const b = button(`tile${i === current ? ' is-current' : ''}${tile.stars === 3 ? ' is-perfect' : ''}`, '', () => this.handlers.select(i));
      b.disabled = !tile.unlocked;
      const best = tile.best > 0 ? ` · ${tile.best}` : '';
      b.setAttribute('aria-label', `${tr(tile.name)}${best}, ${tile.unlocked ? `${tile.stars} / 3` : tr('LOCKED')}`);
      b.title = tile.unlocked ? tr(tile.hint) : tr('LOCKED');
      const stars = el('span', 'tile-stars');
      for (let s = 0; s < 3; s++) {
        const slot = el('span', s < tile.stars ? 'on' : '');
        slot.append(starSprite());
        stars.append(slot);
      }
      const bestLine = document.createElement('span');
      bestLine.className = 'tile-best';
      if (tile.best > 0) bestLine.textContent = String(tile.best);
      else if (tile.unlocked) bestLine.textContent = '—';
      else {
        // A padlock drawn as a shape, not an emoji that would ignore the theme and the language.
        bestLine.classList.add('tile-lock');
        bestLine.innerHTML = ICONS.lock;
      }
      // A locked match still shows its name (greyed, with the padlock below), so the player can see what is coming.
      const nameLine = tile.gate ? el('span', 'tile-name tile-gate') : el('span', 'tile-name', tile.name);
      if (tile.gate) {
        nameLine.textContent = tr('{n} STARS TO OPEN', { n: tile.gate.need });
        b.title = tr('YOU HAVE {have} OF {need} STARS', { have: tile.gate.have, need: tile.gate.need });
        b.setAttribute('aria-label', `${tr(tile.name)}, ${b.title}`);
      }
      b.append(el('span', 'tile-number', tile.label), nameLine, stars, bestLine);
      if (tile.boss) {
        // The world's last match: a red badge on the tile, whether or not it is open yet.
        b.append(el('span', 'tile-boss', tr('BOSS')));
        b.setAttribute('aria-label', `${b.getAttribute('aria-label')}, ${tr('BOSS MATCH')}`);
      }
      if (tile.unlocked && tile.bonus) {
        // The bonus objective was met on this match: a medal on the tile.
        const medal = el('span', 'tile-medal');
        medal.innerHTML = ICONS.medal;
        b.append(medal);
        b.setAttribute('aria-label', `${b.getAttribute('aria-label')}, ${tr('BONUS')}`);
      }
      if (tile.unlocked && tile.coin) {
        // The alley's coin is still out there.
        const coin = el('span', 'tile-coin');
        const img = document.createElement('img');
        img.src = coinUrl;
        img.alt = '';
        img.draggable = false;
        coin.append(img);
        b.append(coin);
        b.setAttribute('aria-label', `${b.getAttribute('aria-label')}, ${tr('COIN TO COLLECT')}`);
      }
      if (tile.unlocked && tile.next) {
        // What the next star needs, so a player blocked by a gate can see where stars are still to be had.
        const next = el('span', 'tile-next');
        const pips = el('span', 'tile-next-pips');
        for (let s = 0; s < tile.next.star; s++) pips.append(starSprite());
        next.append(pips, document.createTextNode(tile.next.target.toLocaleString('en-US')));
        b.append(next);
        b.setAttribute('aria-label', `${b.getAttribute('aria-label')}, ${tr('NEXT STAR AT {n}', { n: tile.next.target })}`);
      }
      grid?.append(b);
      buttons.push(b);
    });
    this.show(this.levels);
    // Bring the level that matters into view: the gate that just stopped NEXT, else where the player is.
    buttons[focus ?? current]?.scrollIntoView({ block: 'center' });
  }

  /** Shows or hides the "x2 COINS" ad button on the result card. */
  setDouble(visible: boolean): void {
    this.doubleButton.hidden = !visible;
  }

  /** The NEXT MATCH ring on a first clear: how far it has filled, 0 to 1; -1 takes it away. */
  setAdvance(p: number): void {
    if (p === this.advanceShown) return;
    this.advanceShown = p;
    this.nextButton.classList.toggle('is-timed', p >= 0);
    if (p >= 0) this.nextButton.style.setProperty('--ring', p.toFixed(3));
  }

  setResult(visible: boolean, hasNext: boolean, double = false): void {
    this.result.hidden = !visible;
    this.doubleButton.hidden = !(visible && double);
    this.nextButton.textContent = tr(hasNext ? 'NEXT MATCH' : 'STADIUMS');
  }

  hide(): void {
    this.show(null);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
}
