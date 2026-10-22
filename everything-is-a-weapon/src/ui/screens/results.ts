import type { RoomSummary } from '../../core/Game';
import { ENEMY_TYPES } from '../../entities/EnemyTypes';
import type { AbilityId } from '../../gameplay/Abilities';
import type { EdgeId } from '../../gameplay/Edges';
import { el, formatScore } from '../dom';

import defeatBanner from '../../ui-kit/bonk2/assets/banners/defeat@2x.png';
import newBestBanner from '../../ui-kit/bonk2/assets/banners/new-best@2x.png';
import victoryBanner from '../../ui-kit/bonk2/assets/banners/victory@2x.png';
import boltIcon from '../../ui-kit/bonk2/assets/icons/bolt@2x.png';
import boxIcon from '../../ui-kit/bonk2/assets/icons/box@2x.png';
import coffeeIcon from '../../ui-kit/bonk2/assets/icons/coffee@2x.png';
import coinIcon from '../../ui-kit/bonk2/assets/icons/coin@2x.png';
import trophyIcon from '../../ui-kit/bonk2/assets/icons/trophy@2x.png';
import dashPowerIcon from '../../ui-kit/bonk2/assets/icons/power-dash@2x.png';
import slamPowerIcon from '../../ui-kit/bonk2/assets/icons/power-slam@2x.png';
import staticPowerIcon from '../../ui-kit/bonk2/assets/icons/power-static@2x.png';

export interface ResultsActions {
  next(): void;
  retry(): void;
  continueWithReward(): void;
  home(): void;
  /** Picks a run-long Edge and continues to the next floor. */
  pickEdge(id: EdgeId): void;
  /** Buys an ability with scrap. Returns '' or the reason it failed. */
  buy(id: AbilityId): string;
  /** Called at the moment the rubber stamp hits the page. */
  stamped(): void;
}

const POWER_ICONS: Record<AbilityId, string> = {
  blast: slamPowerIcon,
  overdrive: dashPowerIcon,
  freeze: staticPowerIcon,
};

/** Kit image: always decorative, the live text beside it carries the meaning. */
function art(src: string, className = ''): HTMLImageElement {
  const img = el('img', className);
  img.src = src;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.draggable = false;
  return img;
}

/**
 * Counts a number up over about a second, like someone totting up a bill.
 * The final value always lands even when frames are throttled.
 */
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
  window.setTimeout(() => {
    if (node.isConnected) node.textContent = formatScore(target);
  }, duration + 200);
}

/** Ribbon banners are decorative; the panel header says what happened. */
function banner(src: string, extra = ''): HTMLElement {
  const wrap = el('div', `b2-ribbon b2-results__ribbon${extra ? ` ${extra}` : ''}`);
  wrap.append(art(src));
  return wrap;
}

function actionButton(
  label: string,
  variant: 'lime' | 'lavender' | 'blue' | 'yellow',
  onClick: () => void,
  primary = false,
): HTMLButtonElement {
  const node = el('button', `b2-btn b2-btn--${variant} b2-results__action${primary ? ' primary' : ''}`);
  node.type = 'button';
  node.append(el('span', 'b2-results__actionlabel', label));
  node.addEventListener('click', onClick);
  return node;
}

function chevron(node: HTMLButtonElement): void {
  const mark = el('span', 'b2-btn__chev', '›');
  mark.setAttribute('aria-hidden', 'true');
  node.append(mark);
}

function ticket(src: string, value: string, label: string, extra = ''): HTMLElement {
  const chip = el('div', `b2-chip b2-report__ticket${extra ? ` ${extra}` : ''}`);
  chip.title = `${label}: ${value}`;
  chip.setAttribute('aria-label', `${label}: ${value}`);
  const text = el('span', 'b2-chip__text');
  text.append(el('span', 'b2-chip__value', value), el('span', 'b2-chip__label', label));
  chip.append(art(src, 'b2-chip__icon'), text);
  return chip;
}

function noteLine(kind: string, text: string, variant: string): HTMLElement {
  const row = el('div', `b2-report__line b2-report__line--${variant}`);
  row.append(el('span', 'b2-report__linekind', kind), el('span', 'b2-report__linetext', text));
  return row;
}

/** The winning screen: a damage report with one huge live number at the top. */
function buildVictory(summary: RoomSummary, actions: ResultsActions): HTMLElement {
  const screen = el('div', 'screen results cleared victory b2-stage b2-stage--navy b2-results b2-results--victory');
  const shell = el('div', 'b2-results__shell');

  const ribbon = banner(victoryBanner);
  shell.append(ribbon);

  const panel = el('section', 'b2-panel b2-report');
  const titleId = 'b2-damage-report-title';
  panel.setAttribute('aria-labelledby', titleId);

  const head = el('div', 'b2-panel__head b2-report__head');
  const title = el('h2', 'b2-panel__title', 'DAMAGE REPORT');
  title.id = titleId;
  head.append(title);
  panel.append(head);

  const body = el('div', 'b2-panel__body b2-report__body');

  // ── where: room badge, room name, and the run this clear belongs to ──
  const meta = el('div', 'b2-report__meta');
  const roomTag = el('span', 'b2-badge b2-report__roomtag', summary.daily ? 'D' : String(summary.roomNumber));
  roomTag.title = summary.daily ? 'Daily challenge' : `Room ${summary.roomNumber}`;
  meta.append(roomTag, el('span', 'b2-report__roomname', summary.roomName.toLowerCase()));
  if (!summary.daily && (summary.runFloor > 0 || summary.runStreak > 0)) {
    const run = el('span', 'b2-report__run', `RUN · FLOOR ${summary.runFloor + 1} · STREAK ${summary.runStreak}`);
    run.title = 'Your current run. A new floor keeps every Edge you picked.';
    meta.append(run);
  }

  // ── the score: the one number the whole screen is about ──
  const hero = el('div', 'b2-report__hero');
  if (summary.isHighScore && summary.score > 0) {
    const best = el('span', 'b2-chip b2-report__best');
    best.setAttribute('aria-label', 'New best score');
    const text = el('span', 'b2-chip__text');
    text.append(el('span', 'b2-chip__value', 'NEW BEST'), el('span', 'b2-chip__label', 'PERSONAL RECORD'));
    best.append(art(trophyIcon, 'b2-chip__icon'), text);
    hero.append(best);
  }
  const score = el('div', 'b2-report__score b2-outlined b2-num', '0');
  score.setAttribute('aria-label', `${formatScore(summary.score)} chaos points`);
  hero.append(score, el('div', 'b2-label b2-report__scorelabel', 'CHAOS POINTS'));
  countUp(score, summary.score);

  // ── campaign marks: stars, objective, contracts, daily bonus, finale ──
  const marks = el('div', 'b2-report__marks');
  if (!summary.daily) {
    const stars = el('div', 'b2-report__stars');
    stars.title = `Clear ★ · bonus ${summary.challengePassed ? '★' : '☆'} · style ${summary.stars >= (summary.challengePassed ? 3 : 2) ? '★' : '☆'}`;
    stars.setAttribute('aria-label', `Stars: ${summary.stars} of 3`);
    stars.append(el(
      'span',
      'b2-report__starline b2-outlined',
      `${'★'.repeat(summary.stars)}${'☆'.repeat(Math.max(0, 3 - summary.stars))}`,
    ));
    if (summary.isNewBestStars) stars.append(el('span', 'b2-chip b2-report__newstars', 'NEW!'));
    marks.append(stars);
  }

  const notes = el('div', 'b2-report__notes');
  if (summary.objective && summary.daily) {
    notes.append(noteLine('OBJECTIVE', summary.objective.toLowerCase(), 'objective'));
  }
  for (const contract of summary.contractsNew) {
    notes.append(noteLine('CONTRACT', `${contract.name} · +${contract.reward} SCRAP`, 'contract'));
  }
  if (summary.dailyBonus > 0) {
    notes.append(noteLine('DAILY BONUS', `+${summary.dailyBonus} SCRAP`, 'daily'));
  }
  if (summary.finale) {
    notes.append(noteLine('FINALE', '★ LEASE RECLAIMED ★', 'finale'));
  }
  if (notes.childElementCount > 0) marks.append(notes);

  // ── stat tickets: icon + live value + a plain label ──
  const stats = el('div', 'b2-report__stats');
  const tickets = el('div', 'b2-report__tickets');
  if (summary.bestChain > 0) tickets.append(ticket(boltIcon, `×${summary.bestChain}`, 'BEST CHAIN', 'is-hot'));
  tickets.append(ticket(boxIcon, String(summary.objectsUsed), 'OBJECTS USED'));
  if (summary.newDiscoveries > 0) tickets.append(ticket(coffeeIcon, String(summary.newDiscoveries), 'NEW DISCOVERIES'));
  if (summary.challengeText && summary.cleared && summary.challengePassed && summary.challengeBonus > 0) {
    tickets.append(ticket(trophyIcon, `+${formatScore(summary.challengeBonus)}`, 'CHALLENGE', 'is-gold'));
  }
  if (summary.firstClearBonus > 0 && summary.cleared) {
    tickets.append(ticket(coinIcon, `+${summary.firstClearBonus}`, 'FIRST CLEAR', 'is-scrap'));
  }
  if (summary.roomBest > 0 && !summary.daily && !summary.isHighScore) {
    tickets.append(ticket(trophyIcon, formatScore(summary.roomBest), 'YOUR BEST HERE'));
  }
  if (tickets.childElementCount > 0) stats.append(tickets);

  // ── Star Ledger: permanent milestones crossed by this clear ──
  if (summary.ledgerClaims.length > 0) {
    const ledger = el('div', 'b2-report__ledger');
    ledger.append(el('div', 'b2-label b2-report__sectionlabel', 'STAR LEDGER'));
    for (const claim of summary.ledgerClaims) {
      const line = el('div', 'victory-ledger-line b2-report__ledgerline');
      line.append(
        el('span', 'b2-report__ledgerstar', '★'),
        el('span', 'b2-report__ledgername', claim.name),
        el('span', 'b2-report__ledgerreward', claim.reward),
      );
      ledger.append(line);
    }
    stats.append(ledger);
  }

  // ── run reward: one power offer, then three Edge cards ──
  const side = el('div', 'b2-report__side');
  const offer = summary.offer;
  if (offer) {
    const line = el('div', 'b2-report__offer');
    line.title = offer.blurb;
    const text = el('div', 'b2-report__offertext');
    text.append(
      el('span', 'b2-label', 'POWER AVAILABLE'),
      el('span', 'b2-report__offername', offer.name),
      el('span', 'b2-report__offerblurb', offer.blurb),
    );
    const buy = el('button', 'b2-btn b2-btn--yellow b2-btn--sm b2-report__buy', `BUY · ${offer.cost}`);
    buy.type = 'button';
    buy.title = `${offer.cost} scrap`;
    buy.setAttribute('aria-label', `Buy ${offer.name} for ${offer.cost} scrap`);
    buy.addEventListener('click', () => {
      if (actions.buy(offer.id)) return;
      buy.replaceWith(el('span', 'b2-chip b2-report__owned', 'YOURS'));
    });
    line.append(art(POWER_ICONS[offer.id], 'b2-icon b2-report__offericon'), text, buy);
    side.append(line);
  }

  if (!summary.daily && summary.edgeOffer.length > 0) {
    const choice = el('div', 'b2-report__edges');
    choice.append(el('div', 'b2-label b2-report__sectionlabel', 'CHOOSE ONE · IT STACKS FOR THE RUN'));
    const cards = el('div', 'b2-report__edgegrid');
    let picked = false;
    for (const edge of summary.edgeOffer) {
      const cardButton = el(
        'button',
        `edge-card edge-${edge.category} edge-${edge.rarity} b2-edge b2-edge--${edge.category} b2-edge--${edge.rarity}`,
      );
      cardButton.type = 'button';
      const top = el('span', 'b2-edge__top');
      top.append(
        el('span', 'b2-edge__kicker', edge.category),
        el('span', 'b2-edge__rarity', edge.rarity),
      );
      cardButton.append(
        top,
        el('span', 'b2-edge__name', edge.name),
        el('span', 'b2-edge__effect', edge.effect),
        el('span', 'b2-edge__flavor', edge.flavor),
      );
      cardButton.setAttribute('aria-label', `${edge.name}: ${edge.effect} ${edge.flavor}`);
      cardButton.addEventListener('click', () => {
        if (picked) return;
        picked = true;
        for (const other of cards.querySelectorAll('button')) other.disabled = true;
        actions.pickEdge(edge.id);
      });
      cards.append(cardButton);
    }
    choice.append(cards);
    side.append(choice);
  }

  // ── next room: whoever waits there + its key tag + its name ──
  const next = summary.next;
  if (next) {
    const door = el('div', next.isNew ? 'b2-report__next is-new' : 'b2-report__next');
    door.title = next.teaser;
    door.setAttribute('aria-label', `Next room ${next.number}: ${next.name}. ${next.teaser}`);
    const mover = ENEMY_TYPES[next.mover];
    const mugWrap = el('span', 'b2-badge b2-report__mug');
    const mug = el('span', `mug mug-${next.mover}`);
    mug.style.setProperty('--mug', mover.color);
    mug.title = mover.name;
    mug.append(el('span', 'mug-face'));
    mugWrap.append(mug);
    const info = el('div', 'b2-report__nextinfo');
    info.append(
      el('span', 'b2-label', next.isNew ? 'NEW ROOM NEXT' : 'NEXT ROOM'),
      el('span', 'b2-report__nextname', next.name.toLowerCase()),
    );
    const key = el('span', 'b2-badge b2-report__keytag', String(next.number));
    key.title = next.isNew ? `New key: room ${next.number}` : `Next: room ${next.number}`;
    door.append(mugWrap, info, key);
    side.append(door);
  }

  body.append(meta, hero, marks, side, stats);
  panel.append(body);
  shell.append(panel);

  const actionsRow = el('div', 'b2-results__actions');
  if (summary.daily) {
    actionsRow.append(actionButton('DONE', 'lime', actions.next, true));
  } else if (summary.edgeOffer.length === 0) {
    // An Edge card is the next action; NEXT only exists when there is no offer.
    const nextButton = actionButton('NEXT', 'lime', actions.next, true);
    chevron(nextButton);
    actionsRow.append(nextButton);
  }
  actionsRow.append(
    actionButton('REPLAY', 'blue', actions.retry),
    actionButton('HOME', 'lavender', actions.home),
  );
  shell.append(actionsRow);
  if (summary.adMissed) shell.append(el('p', 'b2-results__adnote', 'no ad right now'));

  screen.append(shell);

  // The victory banner drops in a beat after the panel, with the stamp sound.
  window.setTimeout(() => {
    if (!ribbon.isConnected) return;
    ribbon.classList.add('is-shown');
    actions.stamped();
  }, 420);

  return screen;
}

function fieldRow(label: string, value: string | HTMLElement): HTMLElement {
  const row = el('div', 'b2-report__field');
  row.append(el('span', 'b2-report__fieldlabel', label), el('span', 'b2-report__leader'));
  const valueNode = typeof value === 'string' ? el('span', 'b2-report__fieldvalue b2-num', value) : value;
  row.append(valueNode);
  return row;
}

/** The end-of-room screen: a damage report on a win, an incident report on a fail. */
export function buildResults(summary: RoomSummary, actions: ResultsActions): HTMLElement {
  if (summary.cleared) return buildVictory(summary, actions);

  const screen = el('div', 'screen results failed b2-stage b2-stage--navy b2-results b2-results--failed');
  const shell = el('div', 'b2-results__shell');

  const ribbon = banner(defeatBanner);
  shell.append(ribbon);

  const panel = el('section', 'b2-panel b2-report b2-report--failed');
  const titleId = 'b2-incident-report-title';
  panel.setAttribute('aria-labelledby', titleId);

  const head = el('div', 'b2-panel__head b2-panel__head--red b2-report__head');
  const title = el('h2', 'b2-panel__title', 'INCIDENT REPORT');
  title.id = titleId;
  head.append(title);
  panel.append(head);

  const body = el('div', 'b2-panel__body b2-report__body');

  // ── where and which report this is ──
  const meta = el('div', 'b2-report__meta');
  const location = el('span', 'b2-report__location');
  location.append(
    el('span', 'b2-label', 'LOCATION'),
    el('span', 'b2-report__roomname', `${summary.daily ? 'daily challenge' : `room ${summary.roomNumber}`} — ${summary.roomName.toLowerCase()}`),
  );
  meta.append(location);
  meta.append(el('span', 'b2-chip b2-report__sheetno', summary.daily ? 'DAILY' : `No. ${String(summary.roomNumber).padStart(3, '0')}`));

  // ── the bill: the huge live number, the stamp, the new-best plate ──
  const hero = el('div', 'b2-report__hero b2-report__hero--failed');
  const scoreWrap = el('div', 'b2-report__scorewrap');
  const score = el('div', 'b2-report__score b2-outlined b2-num', '0');
  score.setAttribute('aria-label', `${formatScore(summary.score)} chaos points, the final bill`);
  scoreWrap.append(score, el('div', 'b2-label b2-report__scorelabel', 'BILL · CHAOS POINTS'));
  countUp(score, summary.score);

  const stamp = el('div', 'b2-report__stamp', 'EVICTED');
  stamp.setAttribute('aria-label', 'Evicted');
  hero.append(scoreWrap, stamp);

  const summaryBody = el('div', 'b2-report__bodycopy');
  summaryBody.append(hero);
  if (summary.isHighScore && summary.score > 0) {
    const best = el('div', 'b2-ribbon b2-results__best');
    const img = art(newBestBanner);
    img.alt = 'New personal best';
    img.removeAttribute('aria-hidden');
    best.append(img);
    summaryBody.append(best);
  }

  // ── the rest of the incident: chain, objects, discoveries, old best ──
  const fields = el('div', 'b2-report__fields');
  fields.append(
    fieldRow('CHAIN', summary.bestChain > 0 ? `×${summary.bestChain}` : '—'),
    fieldRow('OBJECTS', String(summary.objectsUsed)),
    fieldRow('NEW', String(summary.newDiscoveries)),
  );
  if (summary.roomBest > 0 && !summary.daily) fields.append(fieldRow('BEST', formatScore(summary.roomBest)));
  summaryBody.append(fields);

  // Failed runs never carry challenge/first-clear bonuses, offers, or next-room teasers.
  if (!summary.daily) {
    summaryBody.append(el(
      'div',
      summary.runEnded
        ? 'b2-report__runnote b2-report__runnote--ended'
        : 'b2-report__runnote b2-report__runnote--kept',
      summary.runEnded ? 'RUN ENDED · EDGES LOST' : 'EDGES KEPT · RUN STREAK RESET',
    ));
  }

  body.append(meta, summaryBody);
  panel.append(body);
  shell.append(panel);

  const actionsRow = el('div', 'b2-results__actions');
  actionsRow.append(actionButton('RETRY', 'lime', actions.retry, true));
  // Only offered when a rewarded ad is genuinely available; never forced.
  // The label says plainly that it costs an advert; RETRY beside it is free.
  if (summary.canContinue) {
    const continueButton = actionButton('CONTINUE', 'yellow', actions.continueWithReward);
    continueButton.title = 'Watch an advert to keep this run alive';
    actionsRow.append(continueButton);
  }
  actionsRow.append(actionButton('HOME', 'lavender', actions.home));
  shell.append(actionsRow);
  if (summary.adMissed) shell.append(el('p', 'b2-results__adnote', 'no ad right now'));

  screen.append(shell);

  // The stamp hits the page a beat after the report is laid down.
  window.setTimeout(() => {
    if (!stamp.isConnected) return;
    stamp.classList.add('is-shown');
    actions.stamped();
  }, 420);

  return screen;
}
