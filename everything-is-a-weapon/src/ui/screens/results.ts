import type { RoomSummary } from '../../core/Game';
import { EDGE_BY_ID } from '../../gameplay/Edges';
import { el, formatScore } from '../dom';

import defeatBanner from '../../ui-kit/bonk2/assets/banners/defeat@2x.png';
import newBestBanner from '../../ui-kit/bonk2/assets/banners/new-best@2x.png';
import victoryBanner from '../../ui-kit/bonk2/assets/banners/victory@2x.png';
import trophyIcon from '../../ui-kit/bonk2/assets/icons/trophy@2x.png';

export interface ResultsActions {
  next(): void;
  retry(): void;
  continueWithReward(): void;
  home(): void;
  /** Called at the moment the rubber stamp hits the page. */
  stamped(): void;
}

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

interface ConfirmHandle {
  /** Reverts to the original label and makes the next click non-destructive. */
  disarm(): void;
}

/** Two-step guard for an action that throws away the current run. */
function confirmAction(
  button: HTMLButtonElement,
  confirmLabel: string,
  resetLabel: string,
  run: () => void,
): ConfirmHandle {
  let armed = false;
  let requireConfirm = true;
  const label = button.querySelector<HTMLElement>('.b2-results__actionlabel')!;
  button.addEventListener('click', () => {
    if (requireConfirm && !armed) {
      armed = true;
      label.textContent = confirmLabel;
      return;
    }
    run();
  });
  return {
    disarm() {
      requireConfirm = false;
      armed = false;
      label.textContent = resetLabel;
    },
  };
}

function noteLine(kind: string, text: string, variant: string): HTMLElement {
  const row = el('div', `b2-report__line b2-report__line--${variant}`);
  row.append(
    el('span', 'b2-report__linekind', kind),
    el('span', 'b2-report__linedot', ' · '),
    el('span', 'b2-report__linetext', text),
  );
  return row;
}

function runChip(summary: RoomSummary): HTMLElement {
  const text = summary.finale
    ? 'RUN COMPLETE · 50 FLOORS'
    : `RUN · FLOOR ${summary.run.floor} · STREAK ${summary.run.streak}`;
  return el('span', 'b2-chip b2-report__run', text);
}

/** Aggregated build, first-seen order. */
function buildList(summary: RoomSummary, limit = 4): HTMLElement {
  const wrap = el('div', 'b2-report__build');
  wrap.append(el('h3', 'b2-label', 'YOUR BUILD'));
  const counts = new Map<string, number>();
  for (const id of summary.run.boosts) counts.set(id, (counts.get(id) ?? 0) + 1);
  if (counts.size === 0) {
    wrap.append(el('p', 'b2-report__buildempty', 'NO EDGES YET.'));
    return wrap;
  }
  let shown = 0;
  for (const [id, stacks] of counts) {
    if (shown >= limit) break;
    const name = EDGE_BY_ID[id as keyof typeof EDGE_BY_ID]?.name ?? id.toUpperCase();
    const row = el('div', 'b2-report__buildline');
    row.append(
      el('span', 'b2-report__buildname', name),
      el('span', 'b2-report__buildstacks', `×${stacks}`),
    );
    wrap.append(row);
    shown++;
  }
  const more = counts.size - shown;
  if (more > 0) wrap.append(el('span', 'b2-report__buildmore', `+${more} MORE`));
  return wrap;
}

function ledgerStrip(summary: RoomSummary): HTMLElement {
  const strip = el('div', 'b2-report__ledger');
  strip.append(el('span', 'b2-report__sectionlabel', 'STAR LEDGER'));
  for (const claim of summary.ledgerClaims) {
    const row = el('div', 'b2-report__ledgerline');
    row.append(
      el('span', 'b2-report__ledgerstar', '★'),
      el('span', 'b2-report__ledgername', claim.name),
      el('span', 'b2-report__ledgerreward', claim.reward),
    );
    strip.append(row);
  }
  return strip;
}

/** The winning screen: the clear, the draft, the build, and three plain actions. */
function buildVictory(summary: RoomSummary, actions: ResultsActions): HTMLElement {
  const screen = el('div', 'screen results cleared victory b2-stage b2-stage--navy b2-results b2-results--victory');
  const shell = el('div', 'b2-results__shell');

  const ribbon = banner(victoryBanner);
  shell.append(ribbon);

  const panel = el('section', 'b2-panel b2-report b2-report--simple');
  const titleId = 'b2-results-title';
  panel.setAttribute('aria-labelledby', titleId);

  const head = el('div', 'b2-panel__head b2-report__head');
  const title = el('h2', 'b2-panel__title', summary.finale ? 'FINAL VICTORY' : 'ROOM CLEARED');
  title.id = titleId;
  head.append(title);
  panel.append(head);

  const primary = summary.daily || summary.finale
    ? null
    : actionButton('NEXT ROOM', 'lime', actions.next, true);
  if (primary) chevron(primary);

  const home = actionButton('HOME', 'lavender', actions.home);

  let replay: HTMLButtonElement | null = null;
  if (!summary.daily) {
    const armedReplay = summary.run.boosts.length > 0 && !summary.run.ended;
    replay = armedReplay
      ? actionButton('REPLAY ROOM', 'blue', () => {})
      : actionButton('REPLAY ROOM', 'blue', actions.retry);
    if (armedReplay) confirmAction(replay, 'TAP AGAIN · NEW RUN', 'REPLAY ROOM', actions.retry);
  }

  const body = el('div', 'b2-panel__body b2-report__body');

  // ── where: room badge, room name, run position ──
  const meta = el('div', 'b2-report__meta');
  const roomTag = el('span', 'b2-badge b2-report__roomtag', summary.daily ? 'D' : String(summary.roomNumber));
  roomTag.title = summary.daily ? 'Daily challenge' : `Room ${summary.roomNumber}`;
  meta.append(roomTag, el('span', 'b2-report__roomname', summary.roomName.toLowerCase()));
  if (!summary.daily) meta.append(runChip(summary));

  // ── the score ──
  const hero = el('div', 'b2-report__hero');
  if (summary.isHighScore && summary.score > 0) {
    const best = el('span', 'b2-chip b2-report__best');
    best.setAttribute('aria-label', 'New best score');
    const text = el('span', 'b2-chip__text');
    text.append(el('span', 'b2-chip__value', 'NEW BEST'), el('span', 'b2-chip__label', 'PERSONAL RECORD'));
    best.append(art(trophyIcon, 'b2-chip__icon'), text);
    hero.append(best);
  }
  const shownScore = summary.daily ? summary.score : summary.run.score;
  const score = el('div', 'b2-report__score b2-outlined b2-num', '0');
  score.setAttribute('aria-label', `${formatScore(shownScore)} chaos points`);
  hero.append(score, el('div', 'b2-label b2-report__scorelabel', 'CHAOS POINTS'));
  hero.append(el('div', 'b2-label b2-report__roomscoresub', `THIS ROOM +${formatScore(summary.roomScore)}`));
  countUp(score, shownScore);

  // ── stars and the few rewards worth calling out ──
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

  if (summary.ledgerClaims.length > 0) marks.append(ledgerStrip(summary));

  const notes = el('div', 'b2-report__notes');
  if (summary.finale) {
    notes.append(noteLine('FINALE', `50 FLOORS · ${summary.run.types} TYPES · ${summary.run.stacks} STACKS · ${formatScore(summary.run.score)} RUN SCORE`, 'finale'));
  }
  if (summary.challengePassed && summary.challengeBonus > 0) {
    notes.append(noteLine('CHALLENGE', `+${formatScore(summary.challengeBonus)}`, 'objective'));
  }
  if (summary.firstClearBonus > 0) {
    notes.append(noteLine('FIRST CLEAR', `+${summary.firstClearBonus} SCRAP`, 'contract'));
  }
  if (summary.isNewRoomBest) notes.append(noteLine('ROOM BEST', 'NEW ROOM BEST', 'contract'));
  for (const contract of summary.contractsNew) {
    notes.append(noteLine('CONTRACT', `${contract.name} · +${contract.reward} SCRAP`, 'contract'));
  }
  if (summary.daily) {
    notes.append(noteLine('DAILY STREAK', `${summary.dailyStreak} ${summary.dailyStreak === 1 ? 'DAY' : 'DAYS'}`, 'daily'));
    if (summary.dailyBonus > 0) notes.append(noteLine('DAILY BONUS', `+${summary.dailyBonus} SCRAP`, 'daily'));
    if (summary.dailyRareEdgeGranted) notes.append(noteLine('LEGENDARY EDGE', 'UNLOCKED', 'daily'));
    if (summary.dailyReplay) notes.append(noteLine('PRACTICE', 'NO REWARD', 'daily'));
  }
  if (notes.childElementCount > 0) marks.append(notes);

  body.append(meta, hero);
  body.append(marks);
  panel.append(body);
  shell.append(panel);

  const actionsRow = el('div', 'b2-results__actions');
  if (summary.daily) {
    actionsRow.append(actionButton('DONE', 'lime', actions.next, true));
  } else if (summary.finale) {
    if (replay) actionsRow.append(replay);
    home.classList.add('primary');
    actionsRow.append(home);
  } else {
    if (primary) actionsRow.append(primary);
    if (replay) actionsRow.append(replay);
    actionsRow.append(home);
  }
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
  if (!summary.daily) meta.append(runChip(summary));

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

  if (!summary.daily) {
    const report = el('div', 'b2-report__runreport');
    report.append(
      fieldRow('RUN SCORE', formatScore(summary.run.score)),
      fieldRow('EDGES', `${summary.run.types} TYPES · ${summary.run.stacks} STACKS`),
    );
    report.append(buildList(summary, 3));
    report.append(fieldRow('NEXT GOAL', `${summary.nextGoal.kicker} · ${summary.nextGoal.name}`));
    summaryBody.append(report);
    const runNote = el(
      'div',
      summary.runEnded
        ? 'b2-report__runnote b2-report__runnote--ended'
        : 'b2-report__runnote b2-report__runnote--kept',
      summary.runEnded ? 'RUN ENDED · EDGES LOST' : 'EDGES KEPT · STREAK RESET',
    );
    summaryBody.append(runNote);
  }

  const noSalvage = el('div', 'b2-report__nosalvage');
  noSalvage.append(el('span', 'b2-report__nosalvagekind', 'NO SALVAGE'));
  noSalvage.append(el(
    'span',
    'b2-report__nosalvagetext',
    summary.daily ? 'PRACTICE · NO REWARD.' : 'THE FAILED ROOM PAID NOTHING.',
  ));
  summaryBody.append(noSalvage);

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
