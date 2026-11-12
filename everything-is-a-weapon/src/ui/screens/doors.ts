import type { Door } from '../../gameplay/NightShift';
import { FINAL_ROOM_INDEX } from '../../gameplay/Campaign';
import { el } from '../dom';

export interface DoorActions {
  /** Walk through the door at this room index. */
  pick(index: number): void;
  /** Leave the shift where it stands; CONTINUE reopens the same doors. */
  home(): void;
}

/**
 * The Night Shift choice card. Three doors, one decision: the room, the reward,
 * and the risk are all read from the real room data, so the card never lies.
 */
export function buildDoors(
  doors: readonly Door[],
  step: number,
  total: number,
  actions: DoorActions,
): HTMLElement {
  const screen = el('div', 'screen doors b2-stage b2-stage--navy b2-doors');
  const shell = el('div', 'b2-doors__shell');

  const finale = doors.length === 1 && doors[0]?.index === FINAL_ROOM_INDEX;
  const head = el('header', 'b2-doors__head');
  head.append(
    el(
      'p',
      'b2-doors__kicker',
      finale ? 'NIGHT SHIFT · THE LAST DOOR' : `NIGHT SHIFT · CHOICE ${step} OF ${total}`,
    ),
    el('h1', 'b2-doors__title b2-display b2-outlined', finale ? 'ONE DOOR LEFT.' : 'PICK A DOOR.'),
    el(
      'p',
      'b2-doors__sub',
      finale ? 'THE KING OF CARDBOARD IS BEHIND IT.' : 'ONE ROOM. ONE REWARD. ONE RISK.',
    ),
  );

  const grid = el('div', `b2-doors__grid b2-doors__grid--${doors.length}`);
  const cards = doors.map((door) => {
    const card = el('button', `b2-door b2-door--${door.reward.kind}`);
    card.type = 'button';
    card.dataset.index = String(door.index);
    card.dataset.reward = door.reward.kind;
    card.setAttribute(
      'aria-label',
      `Room ${door.number}, ${door.name}. Reward: ${door.reward.label}. Risk: ${door.risk.label}, ${door.risk.detail}.`,
    );

    const top = el('span', 'b2-door__top');
    const number = el('span', 'b2-door__num', String(door.number).padStart(2, '0'));
    const act = el('span', 'b2-door__act');
    act.append(el('span', 'b2-door__actname', door.actName), el('span', 'b2-door__acttag', door.actTagline));
    top.append(number, act);

    const name = el('span', 'b2-door__name', door.name);

    const reward = el('span', `b2-door__reward b2-door__reward--${door.reward.kind}`);
    reward.append(
      el('span', 'b2-door__rewardlabel', door.reward.label),
      el('span', 'b2-door__detail', door.reward.detail),
    );

    const risk = el('span', `b2-door__risk b2-door__risk--${door.risk.label.toLowerCase()}`);
    risk.append(
      el('span', 'b2-door__riskchip', `RISK · ${door.risk.label}`),
      el('span', 'b2-door__detail', door.risk.detail),
    );

    const go = el('span', 'b2-door__go');
    go.append(el('span', '', 'TAKE THIS DOOR'), el('span', 'b2-door__chev', '›'));

    card.append(top, name, reward, risk, go);
    card.addEventListener('click', () => actions.pick(door.index));
    return card;
  });
  grid.append(...cards);

  const foot = el('footer', 'b2-doors__foot');
  foot.append(el('p', 'b2-doors__hint', 'Every line on these doors is true. Your run is saved: CONTINUE reopens them.'));
  const home = el('button', 'b2-btn b2-btn--lavender b2-doors__home');
  home.type = 'button';
  home.append(el('span', '', 'BACK TO THE LOBBY'));
  home.addEventListener('click', actions.home);
  foot.append(home);

  shell.append(head, grid, foot);
  screen.append(shell);
  cards[0]?.setAttribute('data-autofocus', '');
  return screen;
}
