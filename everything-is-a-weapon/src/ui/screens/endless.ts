import type { EndlessSummary } from '../../gameplay/Endless';
import { el, formatScore } from '../dom';

export interface EndlessActions {
  again(): void;
  continueWithReward(): void;
  home(): void;
}

function button(label: string, variant: string, onClick: () => void): HTMLButtonElement {
  const node = el('button', `b2-btn b2-btn--${variant}`);
  node.type = 'button';
  node.append(el('span', 'b2-btn__label', label));
  node.addEventListener('click', onClick);
  return node;
}

function row(label: string, value: string, highlight = false): HTMLElement {
  const node = el('div', `b2-endless__row${highlight ? ' is-new' : ''}`);
  node.append(el('span', 'b2-endless__label', label), el('strong', 'b2-endless__value b2-num', value));
  return node;
}

/** The end-of-run card: how far you got, what you beat, and the one button that matters. */
export function buildEndlessOver(summary: EndlessSummary, actions: EndlessActions): HTMLElement {
  const screen = el('div', 'screen endless b2-stage b2-stage--dim b2-endless');
  const panel = el('section', 'b2-panel b2-endless__panel');
  panel.setAttribute('aria-labelledby', 'b2-endless-title');
  const head = el('div', 'b2-panel__head b2-panel__head--lavender');
  const record = summary.newBestFloor || summary.newBestScore;
  const title = el('h1', 'b2-panel__title', record ? 'NEW BEST!' : 'RUN OVER.');
  title.id = 'b2-endless-title';
  head.append(title);

  const body = el('div', 'b2-panel__body b2-endless__body');
  const reached = el('div', 'b2-endless__reached');
  reached.append(el('span', 'b2-endless__reachedlabel', 'REACHED FLOOR'), el('strong', 'b2-endless__floor b2-display', String(summary.floor)));
  const stats = el('div', 'b2-endless__stats');
  stats.append(
    row('SCORE', formatScore(summary.score), summary.newBestScore),
    row('BEST FLOOR', String(Math.max(summary.bestFloor, 0)), summary.newBestFloor),
    row('BEST SCORE', formatScore(summary.bestScore)),
    row('BOSSES', String(summary.bosses)),
    row('COINS', `+${summary.scrap}`),
  );

  const actionsBox = el('div', 'b2-endless__actions');
  const again = button('ONE MORE RUN', 'lime', actions.again);
  again.classList.add('primary', 'b2-endless__again');
  again.dataset.autofocus = '';
  actionsBox.append(again);
  if (summary.canContinue) {
    actionsBox.append(button('▶ WATCH AD: CONTINUE', 'blue', actions.continueWithReward));
  }
  actionsBox.append(button('MAIN MENU', 'lavender', actions.home));
  if (summary.adMissed) body.append(el('p', 'b2-panel__note', 'No ad available right now.'));

  body.prepend(reached, stats);
  body.append(actionsBox);
  panel.append(head, body);
  screen.append(panel);
  return screen;
}
