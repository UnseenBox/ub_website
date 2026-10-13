import { lang, tr, type Lang } from '../core/i18n';

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
  retry(): void;
  duel(): void;
  volumes(): { sound: number; music: number };
  setSound(volume: number): void;
  setMusic(volume: number): void;
  setLang(lang: Lang): void;
  skins(): SkinTile[];
  pickSkin(id: string): void;
  stars(): { n: number; max: number };
  resetProgress(): void;
}

export interface LevelTile {
  name: string;
  hint: string;
  stars: number;
  best: number;
  unlocked: boolean;
}

const BALL_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <defs><clipPath id="cg-o"><circle cx="50" cy="50" r="45"/></clipPath></defs>
  <circle cx="50" cy="50" r="45" fill="#fbf7ee"/>
  <g clip-path="url(#cg-o)" fill="#1b2540">
    <polygon points="50,29 70,43.5 62.4,67 37.6,67 30,43.5"/>
    <polygon points="50,-4 70,6 66,22 34,22 30,6"/>
    <polygon points="102,33 95,54 79,50 80,30 92,18"/>
    <polygon points="82,97 64,104 56,88 70,76 88,82"/>
    <polygon points="18,97 12,82 30,76 44,88 36,104"/>
    <polygon points="-2,33 8,18 20,30 21,50 5,54"/>
  </g>
  <circle cx="50" cy="50" r="45" fill="none" stroke="#1b2540" stroke-width="4"/>
</svg>`;

const STAR_SVG = `<svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0-10 2.4-5.7 7.1-7.1 5.7-2.4 10 0 5.7 2.4 7.1 7.1 2.4 5.7 0 10-2.4 5.7-7.1 7.1-5.7 2.4-10 0-5.7-2.4-7.1-7.1-2.4-5.7Z"/></svg>`;

const CHAPTERS: ReadonlyArray<{ until: number; title: string }> = [
  { until: 12, title: 'THE HOUMA' },
  { until: 24, title: 'NEW GROUNDS' },
  { until: 36, title: 'CRAZY LEAGUE' },
  { until: 48, title: 'LEGENDS' },
  { until: 60, title: 'STREET KINGS' },
  { until: 72, title: 'NIGHT LEAGUE' },
  { until: 84, title: 'GOLDEN HOUR' },
  { until: 96, title: 'HALL OF FAME' },
  { until: Number.POSITIVE_INFINITY, title: 'THE FINALS' },
];

function chapterOf(index: number): string {
  for (const c of CHAPTERS) if (index < c.until) return c.title;
  return CHAPTERS[CHAPTERS.length - 1].title;
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
  b.addEventListener('click', onClick);
  return b;
}

function slider(label: string, onInput: (volume: number) => void): { row: HTMLElement; input: HTMLInputElement } {
  const row = el('label', 'setting');
  const input = el('input', 'setting-range');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '5';
  input.addEventListener('input', () => onInput(Number(input.value) / 100));
  input.addEventListener('keydown', (e) => e.stopPropagation());
  row.append(el('span', 'setting-name', label), input);
  return { row, input };
}

export class Overlay {
  private readonly menu: HTMLElement;
  private readonly pause: HTMLElement;
  private readonly levels: HTMLElement;
  private readonly settings: HTMLElement;
  private readonly skins: HTMLElement;
  private readonly levelBody: HTMLElement;
  private readonly levelProgress: HTMLElement;
  private readonly skinGrid: HTMLElement;
  private readonly skinProgress: HTMLElement;
  private readonly starCount: HTMLElement;
  private readonly sound: HTMLInputElement;
  private readonly music: HTMLInputElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly result: HTMLElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly rewardButton: HTMLButtonElement;
  private readonly screens: HTMLElement[];
  private settingsFrom: HTMLElement;
  private resetArmed = false;
  private readonly resetButton: HTMLButtonElement;

  constructor(
    private readonly root: HTMLElement,
    private readonly handlers: OverlayHandlers,
  ) {
    this.menu = el('div', 'screen menu menu-bg');
    const mark = el('h1', 'wordmark');
    mark.setAttribute('aria-label', 'Crazy Kora');
    mark.dir = 'ltr';
    mark.append(el('span', 'word crazy', 'CRAZY'));
    const kora = el('span', 'word goal');
    const o = el('span', 'ball-o');
    o.innerHTML = BALL_SVG;
    kora.append('K', o, 'RA');
    mark.append(kora);
    this.starCount = el('p', 'star-count');
    const more = el('div', 'menu-grid');
    if (handlers.canDuel()) more.append(button('btn menu-tile is-terra', 'DUEL A FRIEND', handlers.duel));
    more.append(
      button('btn menu-tile is-blue', 'HOUMA', handlers.levels),
      button('btn menu-tile is-green', 'BALLS', () => this.showSkins()),
      button('btn menu-tile is-navy', 'SETTINGS', () => this.showSettings()),
    );
    const actions = el('div', 'actions');
    actions.append(button('btn btn-primary btn-play', 'PLAY', handlers.play), more);
    this.menu.append(mark, el('p', 'tagline', 'HOW CRAZY CAN YOU SCORE?'), actions, this.starCount);
    this.settingsFrom = this.menu;

    this.pause = el('div', 'screen pause');
    const panel = el('div', 'panel');
    this.rewardButton = button('btn btn-ghost reward-button', '+30 COINS', handlers.reward);
    this.rewardButton.hidden = true;
    panel.append(
      el('h2', 'panel-title', 'PAUSED'),
      button('btn btn-primary', 'RESUME', handlers.resume),
      button('btn btn-ghost', 'RESTART SHOT', handlers.restart),
      button('btn btn-ghost', 'HOUMA', handlers.levels),
      button('btn btn-ghost', 'HOME', handlers.home),
      this.rewardButton,
      button('btn btn-ghost', 'SETTINGS', () => this.showSettings()),
    );
    this.pause.append(panel);

    this.levels = el('div', 'screen levels');
    const sheet = el('div', 'sheet sheet-wide');
    this.levelProgress = el('div', 'level-progress');
    this.levelBody = el('div', 'level-body');
    const back = button('btn btn-ghost', 'BACK', handlers.closeLevels);
    sheet.append(el('h2', 'panel-title', 'THE HOUMA'), this.levelProgress, this.levelBody, back);
    this.levels.append(sheet);

    this.settings = el('div', 'screen pause');
    const prefs = el('div', 'panel');
    const sound = slider('SOUND', handlers.setSound);
    const music = slider('MUSIC', handlers.setMusic);
    this.sound = sound.input;
    this.music = music.input;
    const langs = el('div', 'setting');
    const pick = el('div', 'lang-pick');
    for (const [code, name] of [['en', 'ENGLISH'], ['ar', 'العربية']] as const) {
      const b = button(`btn btn-ghost lang-button${code === lang ? ' is-on' : ''}`, name, () => handlers.setLang(code));
      b.setAttribute('aria-pressed', String(code === lang));
      pick.append(b);
    }
    langs.append(el('span', 'setting-name', 'LANGUAGE'), pick);
    this.resetButton = button('btn btn-ghost reset-button', 'RESET PROGRESS', () => this.confirmReset());
    prefs.append(el('h2', 'panel-title', 'SETTINGS'), sound.row, music.row, langs, this.resetButton, button('btn btn-primary', 'BACK', () => this.show(this.settingsFrom)));
    this.settings.append(prefs);

    this.skins = el('div', 'screen levels');
    const balls = el('div', 'sheet sheet-wide');
    this.skinProgress = el('p', 'skin-progress');
    this.skinGrid = el('div', 'grid');
    balls.append(el('h2', 'panel-title', 'BALLS'), this.skinProgress, this.skinGrid, button('btn btn-ghost', 'BACK', () => this.showMenu()));
    this.skins.append(balls);

    root.append(this.menu, this.pause, this.levels, this.settings, this.skins);
    this.screens = [this.menu, this.pause, this.levels, this.settings, this.skins];

    this.pauseButton = button('pause-button', '', handlers.pause);
    this.pauseButton.setAttribute('aria-label', 'Pause');
    this.pauseButton.append(el('span', 'pause-bar'), el('span', 'pause-bar'));
    this.pauseButton.hidden = true;

    this.result = el('div', 'result');
    this.nextButton = button('btn btn-primary', 'NEXT HOUMA', handlers.next);
    this.result.append(button('btn btn-ghost', 'AGAIN', handlers.retry), this.nextButton);
    this.result.hidden = true;
    root.after(this.pauseButton, this.result);
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
    screen?.querySelector('button')?.focus({ preventScroll: true });
  }

  showMenu(): void {
    const { n, max } = this.handlers.stars();
    this.starCount.textContent = tr('STARS {n} / {max}', { n, max });
    this.show(this.menu);
  }

  showPause(): void {
    this.show(this.pause);
  }

  /** A rewarded-ad offer in the pause menu, or null for none. */
  setReward(offer: { label: string } | null): void {
    this.rewardButton.hidden = offer === null;
    if (offer) this.rewardButton.textContent = tr(offer.label);
  }

  private showSettings(): void {
    this.settingsFrom = this.pause.hidden ? this.menu : this.pause;
    const { sound, music } = this.handlers.volumes();
    this.sound.value = String(Math.round(sound * 100));
    this.music.value = String(Math.round(music * 100));
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
    this.handlers.resetProgress();
    this.resetArmed = false;
    this.resetButton.textContent = tr('PROGRESS ERASED');
    window.setTimeout(() => this.showMenu(), 600);
  }

  private showSkins(): void {
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
        b.setAttribute('aria-label', `${tr(skin.name)}, ${skin.open ? tr('BEST {n}', { n: '' }).trim() : tr('{n} STARS', { n: skin.need })}`);
        const ball = el('span', 'skin-ball');
        ball.style.setProperty('--base', skin.base);
        ball.style.setProperty('--patch', skin.patch);
        b.append(ball, el('span', 'tile-name', skin.name), el('span', 'skin-need', skin.open ? (skin.selected ? '●' : '') : tr('{n} STARS', { n: skin.need })));
        return b;
      }),
    );
    this.show(this.skins);
  }

  showLevels(tiles: readonly LevelTile[], current: number): void {
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

    this.levelBody.innerHTML = '';
    let chapter = '';
    let grid: HTMLElement | null = null;
    tiles.forEach((tile, i) => {
      const want = chapterOf(i);
      if (want !== chapter) {
        chapter = want;
        const h = document.createElement('h3');
        h.className = 'chapter-title';
        h.textContent = tr(chapter);
        this.levelBody.append(h);
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
      stars.innerHTML = [0, 1, 2].map((s) => `<span class="${s < tile.stars ? 'on' : ''}">${STAR_SVG}</span>`).join('');
      const bestLine = document.createElement('span');
      bestLine.className = 'tile-best';
      bestLine.textContent = tile.best > 0 ? String(tile.best) : tile.unlocked ? '—' : '🔒';
      b.append(el('span', 'tile-number', String(i + 1).padStart(2, '0')), el('span', 'tile-name', tile.unlocked ? tile.name : 'LOCKED'), stars, bestLine);
      grid?.append(b);
    });
    this.show(this.levels);
  }

  setResult(visible: boolean, hasNext: boolean): void {
    this.result.hidden = !visible;
    this.nextButton.textContent = tr(hasNext ? 'NEXT HOUMA' : 'THE HOUMA');
  }

  hide(): void {
    this.show(null);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
}
