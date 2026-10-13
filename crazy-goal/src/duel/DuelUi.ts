import { CARDS, type CardId } from '../abilities/Cards';
import { tr } from '../core/i18n';
import type { DuelMode } from './DuelApi';
import type { Overlay } from '../ui/Overlay';

export interface LobbyRow {
  id: string;
  opponent: string;
  score: string;
  status: string;
  icon: RowIcon;
  mode: DuelMode;
  /** True when it is this player's move. */
  yourTurn: boolean;
}

/** A recent opponent, one tap away from another duel. */
export interface Rival {
  id: string;
  name: string;
}

/** The glyph marking what a duel row is waiting on. */
export type RowIcon = 'play' | 'eye' | 'wait' | 'win' | 'lose' | 'draw';

export interface DuelUiHandlers {
  challenge(code: string): void;
  mode(mode: DuelMode): void;
  rival(id: string): void;
  copyId(): void;
  rename(name: string): void;
  enter(duelId: string): void;
  back(): void;
  /** Share a link that brings a friend straight to a duel with this player. */
  invite(): void;
  help(): void;
  /** A card in the hand was tapped. */
  card(id: CardId): void;
  pause(): void;
}

export interface PanelButton {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

/** One card of the hand as it should look right now. */
export interface CardView {
  id: CardId;
  /** 'used' has been played in an earlier round; 'off' cannot be played in this one. */
  state: 'ready' | 'used' | 'off';
  selected: boolean;
}

/** Where the hand goes when the window is wide: a column, in CSS pixels. */
export interface ColumnRect {
  left: number;
  top: number;
  width: number;
}

const ICONS: Readonly<Record<CardId, string>> = {
  fire: '<path d="M12.6 2c.5 3.4 4.9 5.6 4.9 10.8a5.5 5.5 0 0 1-11 0c0-2.300 1.200-3.900 2.400-5.100.1 1.700.8 2.900 1.900 3.300-.2-3.500.100-6.600 1.800-9Z"/><path d="M7 21.200h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  magnet: '<path d="M4 8h5v4a3 3 0 0 0 6 0V8h5v4a8 8 0 0 1-16 0Z"/><path d="M4 3h5v3.500H4zM15 3h5v3.500h-5z"/>',
  rubber: '<circle cx="12" cy="8.500" r="6"/><path d="M3.500 20.500c2.800-3.600 5.600-3.600 8.500 0 2.900-3.600 5.700-3.600 8.500 0" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round"/>',
  cat: '<path fill-rule="evenodd" d="M4 3.500 8.500 7h7L20 3.500V13a8 8 0 0 1-16 0ZM9 11a1.500 1.500 0 1 0 0 3 1.500 1.500 0 0 0 0-3Zm6 0a1.500 1.500 0 1 0 0 3 1.500 1.500 0 0 0 0-3Z"/>',
  shutter: '<path d="M3 4h18v3H3zM3 8.500h18v3H3zM3 13h18v3H3zM3 17.500h18V20H3z"/>',
  smoke: '<path d="M7 19.500a4.500 4.500 0 0 1-.6-8.960A5.500 5.500 0 0 1 17 9.700a4.900 4.900 0 0 1 .5 9.800Z"/>',
};

const icon = (id: CardId): string => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id]}</svg>`;

/** Small glyphs for modes, rows and buttons. Drawn in the surrounding text colour. */
const GLYPHS: Readonly<Record<string, string>> = {
  classic: '<path d="M6 3h12v2h3v4a5 5 0 0 1-5 5h-.58A6 6 0 0 1 13 17.93V20h4v2H7v-2h4v-2.07A6 6 0 0 1 8.58 14H8a5 5 0 0 1-5-5V5h3V3zm-1 4H4v2a3 3 0 0 0 3 3V7zm14 0h-2v5a3 3 0 0 0 3-3V7z"/>',
  quick: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
  pure: '<path d="M12 2s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 9 12 2 12 2z"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  eye: '<path d="M12 5c5 0 9.3 3 11 7-1.7 4-6 7-11 7S2.7 16 1 12c1.7-4 6-7 11-7zm0 9.5A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5.5zm0-7.5C8.2 7 4.8 9 3.2 12c1.6 3 5 5 8.8 5s7.2-2 8.8-5c-1.6-3-5-5-8.8-5z"/>',
  wait: '<path d="M6 2h12v4l-4.5 4L18 14v4H6v-4l4.5-4L6 6V2zm2 2v2.2l2.3 2.3L8 10.8V15h8v-4.2l-2.3-2.3L16 6.2V4H8z"/>',
  win: '<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z"/>',
  lose: '<path d="M6.5 5 12 10.5 17.5 5 19 6.5 13.5 12 19 17.5 17.5 19 12 13.5 6.5 19 5 17.5 10.5 12 5 6.5z"/>',
  draw: '<path d="M5 9.5h14V12H5zm0 4h14v2.5H5z"/>',
  link: '<path d="M10 14a4 4 0 0 0 6 .4l3-3a4 4 0 0 0-5.6-5.6l-1.7 1.7 1.4 1.4 1.7-1.7a2 2 0 0 1 2.8 2.8l-3 3a2 2 0 0 1-2.8 0L11.4 12 10 13.4l1.4 1.4-1.4-1.4zM14 10a4 4 0 0 0-6-.4l-3 3a4 4 0 0 0 5.6 5.6l1.7-1.7-1.4-1.4-1.7 1.7a2 2 0 0 1-2.8-2.8l3-3a2 2 0 0 1 2.8 0l1.4 1.4L14 10z"/>',
  copy: '<path d="M8 3h11v13h-2V5H8V3zM5 7h11v13H5z"/>',
  stepBall: '<circle cx="12" cy="12" r="8"/><path d="M12 7l1.8 3.6 4 0.6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4L6.2 11.2l4-.6z" fill="#fbf7ee"/>',
  stepShot: '<path d="M3 11l14-7 2 3.5L7.5 15 4 13.5z"/><circle cx="19" cy="18" r="3"/>',
  stepCards: '<rect x="4" y="6" width="10" height="13" rx="2"/><rect x="10" y="5" width="10" height="13" rx="2" fill="#fbf7ee"/>',
};

const glyph = (name: string): string => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${GLYPHS[name] ?? ''}</svg>`;

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

/**
 * The duel's DOM: the lobby, a message card, the page that explains the cards, the hand of
 * cards itself, and the single button under the alley.
 */
export class DuelUi {
  private readonly lobby: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly panelTitle: HTMLElement;
  private readonly panelText: HTMLElement;
  private readonly panelButtons: HTMLElement;
  private readonly help: HTMLElement;
  private readonly helpCards: HTMLElement;
  private readonly code: HTMLButtonElement;
  private readonly nameInput: HTMLInputElement;
  private readonly friendInput: HTMLInputElement;
  private readonly inviteButton: HTMLButtonElement;
  private readonly note: HTMLElement;
  private readonly rows: HTMLElement;
  private readonly modes: HTMLElement;
  private readonly modeButtons = new Map<DuelMode, HTMLButtonElement>();
  private readonly rivals: HTMLElement;
  private readonly rivalRow: HTMLElement;
  private readonly action: HTMLButtonElement;
  private readonly bar: HTMLElement;
  private readonly tip: HTMLElement;
  private readonly trickLabel: HTMLElement;
  private readonly cardButtons = new Map<CardId, HTMLButtonElement>();
  private onAction: (() => void) | null = null;
  private onHelpClosed: (() => void) | null = null;
  /** What should be on show once no card is in the way. */
  private actionOn = false;
  private cardsOn = false;
  private screenOpen = false;
  private rowMode = true;

  constructor(
    private readonly overlay: Overlay,
    private readonly app: HTMLElement,
    private readonly handlers: DuelUiHandlers,
  ) {
    // Lobby.
    this.lobby = el('div', 'screen levels duel-lobby');
    const sheet = el('div', 'sheet duel-sheet');
    this.modes = el('div', 'mode-tiles');
    for (const id of ['classic', 'quick', 'pure'] as const) {
      const b = button('mode-tile', '', () => handlers.mode(id));
      const art = el('span', 'mode-icon');
      art.innerHTML = glyph(id);
      b.append(art, el('span', 'mode-name', id === 'classic' ? 'CLASSIC' : id === 'quick' ? 'QUICK CLASH' : 'PURE'), el('span', 'mode-sub', ''));
      this.modeButtons.set(id, b);
      this.modes.append(b);
    }
    this.code = el('button', 'duel-code', '......');
    this.code.type = 'button';
    this.code.title = tr('TAP TO COPY');
    this.code.addEventListener('click', () => handlers.copyId());
    this.inviteButton = button('btn btn-primary duel-copy', 'INVITE', handlers.invite);
    const idRow = el('div', 'duel-row');
    idRow.append(this.code, this.inviteButton);

    this.nameInput = el('input', 'duel-input');
    this.nameInput.maxLength = 14;
    this.nameInput.placeholder = tr('YOUR NAME');
    this.nameInput.autocomplete = 'off';
    this.nameInput.addEventListener('change', () => handlers.rename(this.nameInput.value));

    this.rivalRow = el('div', 'rival-row');
    this.rivals = el('div', 'rival-chips');
    this.rivalRow.append(this.rivals);

    this.friendInput = el('input', 'duel-input duel-friend');
    this.friendInput.maxLength = 8;
    this.friendInput.placeholder = tr("FRIEND'S ID");
    this.friendInput.autocomplete = 'off';
    this.friendInput.autocapitalize = 'characters';
    this.friendInput.spellcheck = false;
    const go = (): void => handlers.challenge(this.friendInput.value);
    this.friendInput.addEventListener('keydown', (e) => {
      // Keep typing out of the game's own keys (R restarts, M mutes).
      e.stopPropagation();
      if (e.key === 'Enter') go();
    });
    this.nameInput.addEventListener('keydown', (e) => e.stopPropagation());
    const friendRow = el('div', 'duel-row');
    friendRow.append(this.friendInput, button('btn btn-primary duel-go', 'CHALLENGE', go));

    this.note = el('p', 'duel-note');
    this.rows = el('div', 'duel-list');
    const foot = el('div', 'duel-row');
    foot.append(button('btn btn-ghost', 'BACK', handlers.back), button('btn btn-ghost', 'HOW IT WORKS', handlers.help));
    sheet.append(
      el('h2', 'panel-title', 'DUEL'),
      this.modes,
      idRow,
      this.nameInput,
      this.rivalRow,
      friendRow,
      this.note,
      this.rows,
      foot,
    );
    this.lobby.append(sheet);
    this.rows.addEventListener('click', (e) => {
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-duel]') : null;
      if (target?.dataset.duel) handlers.enter(target.dataset.duel);
    });

    // Message card.
    this.panel = el('div', 'screen pause duel-panel');
    const card = el('div', 'panel');
    this.panelTitle = el('h2', 'panel-title duel-panel-title');
    this.panelText = el('p', 'duel-panel-text');
    this.panelButtons = el('div', 'actions');
    card.append(this.panelTitle, this.panelText, this.panelButtons);
    this.panel.append(card);

    // How a duel works, and what each card does.
    this.help = el('div', 'screen levels duel-help');
    const helpSheet = el('div', 'sheet duel-sheet');
    const steps = el('div', 'help-steps');
    for (const [art, line] of [['stepBall', 'Same streets for both.'], ['stepShot', 'One shot each. Most goals wins.'], ['stepCards', 'Six cards. Each works once.']] as const) {
      const row = el('div', 'help-step');
      const badge = el('span', 'help-step-icon');
      badge.innerHTML = glyph(art);
      row.append(badge, el('span', 'help-step-words', line));
      steps.append(row);
    }
    this.helpCards = el('div', 'duel-help-cards');
    helpSheet.append(el('h2', 'panel-title', 'HOW A DUEL WORKS'), steps, this.helpCards, button('btn btn-primary', 'GOT IT', () => this.closeHelp()));
    this.help.append(helpSheet);

    overlay.addScreen(this.lobby);
    overlay.addScreen(this.panel);
    overlay.addScreen(this.help);

    // The action button and the hand sit outside the overlay so they show over the game.
    this.action = button('btn btn-primary duel-action', '', () => this.onAction?.());
    this.action.hidden = true;

    this.bar = el('div', 'duel-bar is-row');
    this.bar.hidden = true;
    const top = el('div', 'duel-bar-top');
    this.tip = el('p', 'duel-tip');
    const pause = button('duel-bar-pause', '', handlers.pause);
    pause.setAttribute('aria-label', 'Pause');
    pause.append(el('span', 'pause-bar'), el('span', 'pause-bar'));
    top.append(this.tip, pause);
    const groups = el('div', 'duel-groups');
    this.trickLabel = el('p', 'duel-group-label', "FOR YOUR FRIEND'S NEXT SHOT");
    for (const kind of ['boost', 'trick'] as const) {
      const group = el('div', `duel-group is-${kind}`);
      const cards = el('div', 'duel-group-cards');
      for (const c of CARDS) {
        if (c.kind !== kind) continue;
        const b = button('duel-card', '', () => handlers.card(c.id));
        b.style.setProperty('--card', c.color);
        const art = el('span', 'duel-card-icon');
        art.innerHTML = icon(c.id);
        b.append(art, el('span', 'duel-card-name', c.name));
        this.cardButtons.set(c.id, b);
        cards.append(b);
      }
      group.append(kind === 'boost' ? el('p', 'duel-group-label', 'FOR YOUR SHOT') : this.trickLabel, cards);
      groups.append(group);
    }
    this.bar.append(top, groups);
    overlay.addFloating(this.action, this.bar);
  }

  private sync(): void {
    this.action.hidden = !this.actionOn || this.screenOpen;
    const bar = this.cardsOn && !this.screenOpen;
    this.bar.hidden = !bar;
    // In a row the hand covers the corner the pause button lives in, so it brings its own.
    this.app.classList.toggle('duel-hand-row', bar && this.rowMode);
  }

  private open(screen: HTMLElement): void {
    this.screenOpen = true;
    this.sync();
    this.overlay.showScreen(screen);
  }

  showLobby(id: string, name: string): void {
    this.code.textContent = id;
    if (document.activeElement !== this.nameInput) this.nameInput.value = name;
    this.setAction(null, null);
    this.hideCards();
    this.open(this.lobby);
  }

  setNote(text: string): void {
    this.note.textContent = text;
  }

  /** Which way to play is picked: Classic, Quick Clash or Pure. */
  setModes(selected: DuelMode): void {
    for (const [id, b] of this.modeButtons) {
      const on = id === selected;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
      const rounds = id === 'quick' ? 5 : 10;
      (b.querySelector('.mode-sub') as HTMLElement).textContent = `${tr('{n} ROUNDS', { n: rounds })} · ${id === 'pure' ? tr('NO CARDS') : tr('CARDS')}`;
    }
  }

  /** One tap to duel again: the last few opponents. */
  setRivals(rivals: readonly Rival[]): void {
    this.rivalRow.hidden = rivals.length === 0;
    this.rivals.replaceChildren(
      ...rivals.map((r) => {
        const b = button('rival-chip', '', () => this.handlers.rival(r.id));
        const dot = el('span', 'rival-dot');
        b.append(dot, el('span', 'rival-name', r.name || r.id));
        b.setAttribute('aria-label', `${r.name || r.id} — ${tr('REMATCH')}`);
        b.title = r.id;
        return b;
      }),
    );
  }

  setFriend(id: string): void {
    this.friendInput.value = id;
  }

  /** Briefly swaps the invite button's label, to say what tapping it just did. */
  flashInvite(label: string): void {
    this.inviteButton.textContent = tr(label);
    window.setTimeout(() => (this.inviteButton.textContent = tr('INVITE')), 1600);
  }

  setRows(rows: readonly LobbyRow[]): void {
    this.rows.replaceChildren(
      ...rows.map((row) => {
        const b = el('button', `duel-item${row.yourTurn ? ' is-turn' : ''}`);
        b.type = 'button';
        b.dataset.duel = row.id;
        b.setAttribute('aria-label', `${row.opponent}, ${row.score}, ${tr(row.status)}`);
        b.title = tr(row.status);
        const badge = el('span', `row-icon is-${row.icon}`);
        badge.innerHTML = glyph(row.icon);
        const meta = el('span', 'row-meta');
        meta.append(el('span', 'duel-item-name', row.opponent), el('span', 'duel-item-score', row.score));
        b.append(badge, meta);
        if (row.mode !== 'classic') {
          const tag = el('span', `mode-mini is-${row.mode}`);
          tag.innerHTML = glyph(row.mode);
          tag.title = tr(row.mode === 'quick' ? 'QUICK CLASH' : 'PURE');
          b.append(tag);
        }
        return b;
      }),
    );
  }

  /** A card with a title, a line of text and up to a few buttons. */
  showPanel(title: string, text: string, buttons: readonly PanelButton[]): void {
    this.panelTitle.textContent = title;
    this.panelText.textContent = text;
    this.panelButtons.replaceChildren(...buttons.map((b) => button(`btn ${b.primary ? 'btn-primary' : 'btn-ghost'}`, b.label, b.onClick)));
    this.open(this.panel);
  }

  /** The rules and the six cards. `friend` is written into the tricks' descriptions. */
  showHelp(friend: string, onClosed: () => void): void {
    this.onHelpClosed = onClosed;
    this.helpCards.replaceChildren(
      ...CARDS.map((c) => {
        const row = el('div', 'duel-help-card');
        row.style.setProperty('--card', c.color);
        const art = el('span', 'duel-card-icon');
        art.innerHTML = icon(c.id);
        const words = el('div', 'duel-help-words');
        words.append(el('strong', '', c.name), el('span', '', tr(c.blurb, { friend })));
        row.append(art, words);
        return row;
      }),
    );
    this.open(this.help);
  }

  private closeHelp(): void {
    const done = this.onHelpClosed;
    this.onHelpClosed = null;
    done?.();
  }

  /** Back to the game: whatever was showing under the card comes back. */
  hideScreens(): void {
    this.screenOpen = false;
    this.overlay.hide();
    this.sync();
  }

  /** The one button under the alley; a null label hides it. */
  setAction(label: string | null, onClick: (() => void) | null): void {
    this.onAction = onClick;
    this.actionOn = label !== null;
    if (label !== null) this.action.textContent = tr(label);
    this.action.disabled = false;
    this.sync();
  }

  /** The same button as a notice that cannot be pressed: "SENDING...", "WAITING FOR SAMI...". */
  status(label: string): void {
    this.onAction = null;
    this.actionOn = true;
    this.action.textContent = label;
    this.action.disabled = true;
    this.sync();
  }

  /** Shows the hand. `tip` is the line above it; `friend` names who the tricks are for. */
  showCards(cards: readonly CardView[], tip: string, friend: string): void {
    for (const view of cards) {
      const b = this.cardButtons.get(view.id);
      if (!b) continue;
      b.disabled = view.state !== 'ready';
      b.classList.toggle('is-used', view.state === 'used');
      b.classList.toggle('is-selected', view.selected);
      b.setAttribute('aria-pressed', String(view.selected));
    }
    this.tip.textContent = tip;
    this.trickLabel.textContent = tr("FOR {friend}'S NEXT SHOT", { friend });
    this.cardsOn = true;
    this.sync();
  }

  hideCards(): void {
    this.cardsOn = false;
    this.sync();
  }

  /**
   * Wide window: the hand stands in the column under the street plaque. Tall window (null):
   * it lies in a row along the bottom of the screen.
   */
  placeCards(column: ColumnRect | null): void {
    const row = column === null;
    if (row !== this.rowMode) {
      this.rowMode = row;
      this.bar.classList.toggle('is-row', row);
      this.bar.classList.toggle('is-column', !row);
      if (row) this.bar.removeAttribute('style');
      this.sync();
    }
    if (!column) return;
    this.bar.style.left = `${Math.round(column.left)}px`;
    this.bar.style.top = `${Math.round(column.top)}px`;
    this.bar.style.width = `${Math.round(column.width)}px`;
  }
}
