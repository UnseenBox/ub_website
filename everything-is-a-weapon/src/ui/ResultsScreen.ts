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

/** Hand-drawn SVG icons for the victory tickets. Ink strokes, flat fills, no emoji. */
const ICONS: Record<string, string> = {
  bolt: '<path d="M13 2.5 4.5 14H11l-1.2 7.5L18.5 10H12z"/>',
  crate: '<path d="M12 3l8.5 4.3v9.4L12 21l-8.5-4.3V7.3z"/><path class="nofill" d="M3.5 7.3 12 11.7l8.5-4.4M12 11.7V21"/>',
  loupe: '<circle cx="10.5" cy="10.5" r="6"/><path class="nofill" d="M15.3 15.3 20.5 20.5"/>',
  cog: '<circle cx="12" cy="12" r="5.4"/><circle class="hub" cx="12" cy="12" r="1.8"/><path class="nofill" d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8"/>',
  crown: '<path d="M3.5 8.5 5.5 17.5h13l2-9-4.7 3.2L12 5.5l-3.8 6.2z"/>',
  star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>',
};

function icon(name: string): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `vicon vicon-${name}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name] ?? '';
  return svg;
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

/** The winning screen: a trophy card. Starburst seal, one big number, icon tickets, almost no words. */
function buildVictory(summary: RoomSummary, actions: ResultsActions): HTMLElement {
  const screen = el('div', 'screen results cleared victory');
  const card = el('div', 'victory-card');

  // Ribbon banner: the visual payoff. The slam still fires the sound.
  const sealWrap = el('div', 'victory-seal-wrap');
  if (summary.isHighScore && summary.score > 0) {
    const best = el('div', 'victory-best');
    best.title = 'New best';
    best.setAttribute('aria-label', 'New best score');
    best.append(icon('crown'));
    sealWrap.append(best);
  }
  const ribbon = el('div', 'victory-ribbon', 'CLEARED');
  sealWrap.append(ribbon);
  card.append(sealWrap);
  window.setTimeout(() => {
    if (!ribbon.isConnected) return;
    ribbon.classList.add('show');
    actions.stamped();
  }, 420);

  // Where: a keyring tag with the room number + the room name, nothing else.
  const where = el('div', 'victory-where');
  const tag = el('span', 'victory-keytag', summary.daily ? 'D' : String(summary.roomNumber));
  tag.title = summary.daily ? 'Daily challenge' : `Room ${summary.roomNumber}`;
  where.append(el('span', 'victory-ring'), tag, el('span', 'victory-room', summary.roomName.toLowerCase()));
  card.append(where);
  // Campaign: stars for this room.
  if (!summary.daily) {
    const stars = el('div', 'victory-stars');
    stars.title = `Clear ★ · bonus ${summary.challengePassed ? '★' : '☆'} · style ${summary.stars >= (summary.challengePassed ? 3 : 2) ? '★' : '☆'}`;
    stars.setAttribute('aria-label', `Stars: ${summary.stars} of 3`);
    stars.textContent = `${'★'.repeat(summary.stars)}${'☆'.repeat(Math.max(0, 3 - summary.stars))}${summary.isNewBestStars ? ' · new!' : ''}`;
    card.append(stars);
  }
  if (summary.objective && summary.daily) card.append(el('div', 'victory-objective', `◎ ${summary.objective.toLowerCase()}`));
  for (const contract of summary.contractsNew) {
    card.append(el('div', 'victory-contract', `✚ ${contract.name.toLowerCase()} +${contract.reward}`));
  }
  if (summary.dailyBonus > 0) card.append(el('div', 'victory-contract', `🔥 +${summary.dailyBonus}`));
  if (summary.finale) card.append(el('div', 'victory-contract', '★ lease reclaimed ★'));

  const score = el('div', 'victory-score', '0');
  card.append(score);
  countUp(score, summary.score);
  card.append(el('div', 'victory-perforation'));

  // Perforated stat tickets: icon + number, no words. Full text lives in tooltips.
  const tickets = el('div', 'victory-tickets');
  const ticket = (iconName: string, value: string, label: string, extra = ''): void => {
    const stub = el('span', `vticket${extra ? ` ${extra}` : ''}`);
    stub.title = label;
    stub.setAttribute('aria-label', `${label}: ${value}`);
    const badge = el('span', 'vticket-icon');
    badge.append(icon(iconName));
    stub.append(badge, el('span', 'vticket-value', value));
    tickets.append(stub);
  };
  if (summary.bestChain > 0) ticket('bolt', `×${summary.bestChain}`, 'Best chain', 'hot');
  ticket('crate', String(summary.objectsUsed), 'Objects used');
  if (summary.newDiscoveries > 0) ticket('loupe', String(summary.newDiscoveries), 'New discoveries');
  if (summary.challengeText && summary.cleared && summary.challengePassed)
    ticket('star', `+${formatScore(summary.challengeBonus)}`, summary.challengeText, 'gold');
  if (summary.firstClearBonus > 0 && summary.cleared) ticket('cog', `+${summary.firstClearBonus}`, 'First clear scrap bonus', 'scrap');
  // A fresh best already wears the crown; the old record only shows when it survived.
  if (summary.roomBest > 0 && !summary.daily && !summary.isHighScore)
    ticket('crown', formatScore(summary.roomBest), 'Your best here');
  card.append(tickets);

  // Power offer: one compact ticket, name + buy button.
  const offer = summary.offer;
  if (offer) {
    const line = el('div', 'victory-offer');
    const buy = el('button', 'ability-buy', `BUY · ${offer.cost}`);
    buy.type = 'button';
    buy.title = `${offer.cost} scrap`;
    buy.addEventListener('click', () => {
      if (actions.buy(offer.id)) return;
      buy.replaceWith(el('span', 'ability-owned', 'YOURS'));
    });
    const badge = el('span', 'vticket-icon');
    badge.append(icon('bolt'));
    line.append(badge, el('span', 'victory-offer-name', offer.name.toLowerCase()), el('span', 'scrap-dot'), buy);
    line.title = offer.blurb;
    card.append(line);
  }

  // Next room: whoever waits there + an arrow + its key tag + its name.
  const next = summary.next;
  if (next) {
    const door = el('div', next.isNew ? 'victory-next new' : 'victory-next');
    const mover = ENEMY_TYPES[next.mover];
    const mug = el('span', `mug mug-${next.mover}`);
    mug.style.setProperty('--mug', mover.color);
    mug.title = mover.name;
    mug.append(el('span', 'mug-face'));
    const ntag = el('span', `victory-keytag sm${next.isNew ? ' fresh' : ''}`, String(next.number));
    ntag.title = next.isNew ? `New key: room ${next.number}` : `Next: room ${next.number}`;
    door.append(mug, el('span', 'victory-arrow', '→'), ntag, el('span', 'victory-next-name', next.name.toLowerCase()));
    door.title = next.teaser;
    card.append(door);
  }

  screen.append(card);

  const buttons = el('div', 'menu-buttons row');
  buttons.append(button(summary.daily ? 'DONE' : 'NEXT →', 'primary', actions.next), button('↻ REPLAY', '', actions.retry));
  buttons.append(button('⌂ HOME', '', actions.home));
  screen.append(buttons);
  if (summary.adMissed) screen.append(el('p', 'ad-note', 'no ad right now'));
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
  const score = field('BILL', '0');
  fields.append(
    score.row,
    field('CHAIN', summary.bestChain > 0 ? `x${summary.bestChain}` : '—').row,
    field('OBJECTS', String(summary.objectsUsed)).row,
    field('NEW', String(summary.newDiscoveries)).row,
  );
  // Something to beat on a replay.
  if (summary.roomBest > 0 && !summary.daily) fields.append(field('BEST', formatScore(summary.roomBest)).row);
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
  if (summary.canContinue) buttons.append(button('▶ CONTINUE', 'ad-offer', actions.continueWithReward));
  buttons.append(button('HOME', '', actions.home));
  screen.append(buttons);
  if (summary.adMissed) screen.append(el('p', 'ad-note', 'no ad right now'));
  return screen;
}
