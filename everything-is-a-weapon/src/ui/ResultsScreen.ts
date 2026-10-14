import type { RoomSummary } from '../core/Game';
import { ENEMY_TYPES } from '../entities/EnemyTypes';
import type { AbilityId } from '../gameplay/Abilities';
import { button, el, formatScore } from './dom';

export interface ResultsActions {
  next(): void;
  retry(): void;
  continueWithReward(): void;
  home(): void;
  /** Buys an ability with scrap. Returns '' or the reason it failed. */
  buy(id: AbilityId): string;
  /** Called at the moment the rubber stamp hits the page. */
  stamped(): void;
}

function field(labelText: string, value: string): { row: HTMLElement; value: HTMLElement } {
  const row = el('div', 'field');
  const valueNode = el('span', 'field-value', value);
  row.append(el('span', 'field-label', labelText), el('span', 'field-dots'), valueNode);
  return { row, value: valueNode };
}

/** Counts a number up over about a second, like someone totting up a bill. */
function countUp(node: HTMLElement, target: number): void {
  const start = performance.now();
  const duration = 900;
  const step = (now: number): void => {
    if (!node.isConnected) return;
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = formatScore(target * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  // If frames are throttled the final value must still land.
  window.setTimeout(() => {
    if (node.isConnected) node.textContent = formatScore(target);
  }, duration + 200);
}

/** The winning screen: a compact, centered victory card. Big score, icons, almost no sentences. */
function buildVictory(summary: RoomSummary, actions: ResultsActions): HTMLElement {
  const screen = el('div', 'screen results cleared victory');
  const card = el('div', 'victory-card');

  // Seal + stamp: the visual payoff, centered. The stamp slam still fires the sound.
  const seal = el('div', 'victory-seal', '★');
  const stamp = el('div', 'victory-stamp', 'CLEARED');
  card.append(seal, stamp);
  window.setTimeout(() => {
    if (!stamp.isConnected) return;
    stamp.classList.add('show');
    actions.stamped();
  }, 420);

  card.append(el('div', 'victory-kicker', summary.daily ? 'DAILY · CLEARED' : `ROOM ${summary.roomNumber} · CLEARED`));
  card.append(el('div', 'victory-room', summary.roomName.toLowerCase()));

  const scoreWrap = el('div', 'victory-score-wrap');
  const score = el('div', 'victory-score', '0');
  scoreWrap.append(score);
  card.append(scoreWrap);
  countUp(score, summary.score);

  // Icon stat chips, centered — no field labels, no dotted leaders.
  const chips = el('div', 'victory-chips');
  if (summary.bestChain > 0) {
    const chip = el('span', 'vchip');
    chip.title = 'Best chain';
    chip.append(el('span', 'vchip-icon', '⚡'), el('span', 'vchip-value', `×${summary.bestChain}`));
    chips.append(chip);
  }
  {
    const chip = el('span', 'vchip');
    chip.title = 'Objects used';
    chip.append(el('span', 'vchip-icon', '📦'), el('span', 'vchip-value', String(summary.objectsUsed)));
    chips.append(chip);
  }
  if (summary.newDiscoveries > 0) {
    const chip = el('span', 'vchip');
    chip.title = 'New discoveries';
    chip.append(el('span', 'vchip-icon', '✨'), el('span', 'vchip-value', String(summary.newDiscoveries)));
    chips.append(chip);
  }
  card.append(chips);

  // Bonuses collapse into tiny pills. Missed challenges stay silent to keep it clean.
  const pills = el('div', 'victory-pills');
  if (summary.isHighScore && summary.score > 0) pills.append(el('span', 'vpill vpill-best', '👑 NEW BEST'));
  if (summary.challengeText && summary.cleared && summary.challengePassed)
    pills.append(el('span', 'vpill vpill-bonus', `★ +${formatScore(summary.challengeBonus)}`));
  if (summary.firstClearBonus > 0 && summary.cleared)
    pills.append(el('span', 'vpill vpill-scrap', `+${summary.firstClearBonus} SCRAP`));
  if (summary.roomBest > 0 && !summary.daily) pills.append(el('span', 'vpill vpill-record', `BEST ${formatScore(summary.roomBest)}`));
  if (pills.childElementCount > 0) card.append(pills);

  // Power offer: one compact centered row, icon + buy button.
  const offer = summary.offer;
  if (offer) {
    const line = el('div', 'victory-offer');
    const buy = el('button', 'ability-buy', `BUY · ${offer.cost} SCRAP`);
    buy.type = 'button';
    buy.addEventListener('click', () => {
      if (actions.buy(offer.id)) return;
      buy.replaceWith(el('span', 'ability-owned', 'YOURS'));
    });
    line.append(el('span', 'victory-offer-icon', '⚡'), el('span', 'victory-offer-name', offer.name.toLowerCase()), buy);
    line.title = offer.blurb;
    card.append(line);
  }

  // Next room: mugshot + arrow + name, centered on one line.
  const next = summary.next;
  if (next) {
    const door = el('div', next.isNew ? 'victory-next new' : 'victory-next');
    const mover = ENEMY_TYPES[next.mover];
    const mug = el('span', `mug mug-${next.mover}`);
    mug.style.setProperty('--mug', mover.color);
    mug.title = mover.name;
    mug.append(el('span', 'mug-face'));
    door.append(mug, el('span', 'victory-next-label', next.isNew ? `ROOM ${next.number}` : `→ ${next.number}`), el('span', 'victory-next-name', next.name.toLowerCase()));
    door.title = next.teaser;
    card.append(door);
  }

  screen.append(card);

  const buttons = el('div', 'menu-buttons row');
  buttons.append(button(summary.daily ? 'DONE' : 'NEXT ROOM', 'primary', actions.next), button('REPLAY', '', actions.retry));
  buttons.append(button('HOME', '', actions.home));
  screen.append(buttons);
  if (summary.adMissed) screen.append(el('p', 'ad-note', 'no advert available right now'));
  return screen;
}

/** The end-of-room screen: a victory card on a win, an incident report on a fail. */
export function buildResults(summary: RoomSummary, actions: ResultsActions): HTMLElement {
  if (summary.cleared) return buildVictory(summary, actions);
  const screen = el('div', 'screen results failed');
  const clipboard = el('div', 'clipboard');
  const sheet = el('div', 'sheet');

  const head = el('div', 'sheet-head');
  head.append(
    el('span', 'sheet-title', 'INCIDENT REPORT'),
    el('span', 'sheet-no', summary.daily ? 'DAILY' : `No. ${String(summary.roomNumber).padStart(3, '0')}`),
  );
  const where = el('div', 'sheet-where');
  where.append(
    el('span', 'field-label', 'LOCATION'),
    el('span', 'handwritten', `${summary.daily ? 'daily challenge' : `room ${summary.roomNumber}`} — ${summary.roomName.toLowerCase()}`),
  );

  const fields = el('div', 'fields');
  const score = field('DAMAGE BILL', '0');
  fields.append(
    score.row,
    field('LONGEST CHAIN', summary.bestChain > 0 ? `x${summary.bestChain}` : '—').row,
    field('OBJECTS MISUSED', String(summary.objectsUsed)).row,
    field('NEW EVIDENCE', String(summary.newDiscoveries)).row,
  );
  // Something to beat on a replay.
  if (summary.roomBest > 0 && !summary.daily) fields.append(field('YOUR BEST HERE', formatScore(summary.roomBest)).row);
  countUp(score.value, summary.score);

  sheet.append(head, where, fields);

  // Failed runs never carry challenge/first-clear bonuses, offers, or next-room teasers.
  const stamp = el('div', 'stamp-mark', 'EVICTED');
  sheet.append(stamp);
  window.setTimeout(() => {
    if (!stamp.isConnected) return;
    stamp.classList.add('show');
    actions.stamped();
  }, 420);

  if (summary.isHighScore && summary.score > 0) sheet.append(el('div', 'best-sticker', 'NEW BEST'));

  clipboard.append(el('div', 'clip'), sheet);
  screen.append(clipboard);

  const buttons = el('div', 'menu-buttons row');
  buttons.append(button('RETRY', 'primary', actions.retry));
  // Only offered when a rewarded ad is genuinely available; never forced.
  // The label says plainly that it costs an advert; RETRY beside it is the same size and free.
  if (summary.canContinue) buttons.append(button('▶ WATCH AD: CONTINUE', 'ad-offer', actions.continueWithReward));
  buttons.append(button('HOME', '', actions.home));
  screen.append(buttons);
  if (summary.adMissed) screen.append(el('p', 'ad-note', 'no advert available right now'));
  return screen;
}
