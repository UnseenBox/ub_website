import { DISCOVERIES, type DiscoverySystem } from '../gameplay/DiscoverySystem';
import { MODIFIERS, type ModifierId } from '../gameplay/ChallengeSystem';
import type { RunStats, ScoreResult } from '../gameplay/ScoreSystem';
import type { SaveManager, Settings } from '../save/SaveManager';
import { ROOMS } from '../world/Rooms';
import { el, formatTime, menuButton, panel, sliderRow, statRow, toggleRow } from './Dom';
import { INK, svg } from './Ink';

export interface UICallbacks {
  onContinue(): void;
  onSelectRoom(index: number): void;
  onOpen(screen: ScreenName): void;
  onBack(): void;
  onStartChallenge(roomIndex: number, mods: readonly ModifierId[]): void;
  onStartDaily(): void;
  onStartEndless(): void;
  onResume(): void;
  onRestart(): void;
  onQuit(): void;
  onNextRoom(): void;
  onSettingChange(patch: Partial<Settings>): void;
  onWipeSave(): void;
}

export type ScreenName =
  | 'none'
  | 'menu'
  | 'rooms'
  | 'challenges'
  | 'discoveries'
  | 'settings'
  | 'howto'
  | 'paused'
  | 'results'
  | 'dead'
  | 'intro'
  | 'mouse';

export interface ResultsData {
  roomLabel: string;
  roomName: string;
  score: ScoreResult;
  stats: RunStats;
  newBestTime: boolean;
  newBestScore: boolean;
  bestTimeMs: number;
  bestScore: number;
  discoveriesThisRun: number;
  hasNextRoom: boolean;
  isChallenge: boolean;
}

export interface DeathData {
  roomName: string;
  killedBy: string;
  seconds: number;
  /** The one thing worth telling them about what just happened. */
  lesson: string;
}

function screen(extraClass = ''): HTMLElement {
  return el('div', `screen${extraClass ? ` ${extraClass}` : ''}`);
}

/**
 * The ruled divider that runs under the title and under section headings: a
 * surveyor's scale, which is the same motif as the crosses on the floor.
 */
function ruledLine(width = 520): SVGSVGElement {
  const node = svg('svg', {
    viewBox: `0 0 ${width} 10`,
    width: '100%',
    height: 10,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-linecap': 'round',
  });
  node.append(svg('path', { d: `M2 7 L${width - 2} 7`, 'stroke-width': 1.2, opacity: 0.5 }));
  for (let i = 0; i <= 24; i++) {
    const x = 2 + (i / 24) * (width - 4);
    const major = i % 6 === 0;
    node.append(
      svg('path', {
        d: `M${x.toFixed(1)} 7 L${x.toFixed(1)} ${major ? 1 : 4}`,
        'stroke-width': major ? 1.3 : 0.8,
        opacity: major ? 0.75 : 0.35,
      }),
    );
  }
  node.style.filter = INK.roughSoft;
  return node;
}

export function mainMenu(save: SaveManager, discovery: DiscoverySystem, cb: UICallbacks): HTMLElement {
  const s = screen();
  const title = el('h1', 'title');
  title.innerHTML = 'DON&rsquo;T LET IT <span class="eye">SEE</span> YOU';
  s.append(title);
  const rule = el('div', 'title-rule');
  rule.append(ruledLine());
  s.append(rule);
  s.append(el('p', 'tagline', 'IT CANNOT SEE YOU. IT CAN SEE WHAT YOU ARE LOOKING AT.'));

  const completed = ROOMS.filter((r) => save.record(r.id).completed).length;
  const menu = el('div', 'menu');
  menu.append(
    menuButton(completed === 0 ? 'BEGIN' : 'CONTINUE', () => cb.onContinue()),
    menuButton('ROOMS', () => cb.onOpen('rooms'), completed > 0 || save.unlocked > 1),
    menuButton('CHALLENGES', () => cb.onOpen('challenges'), completed > 0),
    menuButton('DISCOVERIES', () => cb.onOpen('discoveries')),
    menuButton('SETTINGS', () => cb.onOpen('settings')),
    menuButton('HOW TO PLAY', () => cb.onOpen('howto')),
  );
  s.append(menu);

  const foot = el(
    'div',
    'hint-line',
    `${completed} / ${ROOMS.length} ROOMS   ${discovery.count} / ${discovery.total} DISCOVERIES`,
  );
  s.append(foot);
  if (!save.storageAvailable) {
    s.append(el('div', 'hint-line', 'PROGRESS CANNOT BE SAVED IN THIS BROWSER'));
  }
  return s;
}

export function roomSelect(save: SaveManager, cb: UICallbacks): HTMLElement {
  const s = screen('is-quiet');
  s.append(el('h2', 'subtitle', 'Rooms'));
  const p = panel('THE BUILDING');
  p.classList.add('wide');
  const grid = el('div', 'grid-cards');

  ROOMS.forEach((room, i) => {
    const rec = save.record(room.id);
    const unlocked = i < save.unlocked || rec.completed;
    const card = el('button', `card${rec.completed ? ' done' : ''}`);
    card.type = 'button';
    card.disabled = !unlocked;
    card.append(el('span', 'idx', `ROOM ${String(i + 1).padStart(2, '0')}`));
    card.append(el('span', 'nm', unlocked ? room.name : 'LOCKED'));
    const meta = unlocked
      ? rec.completed
        ? `${formatTime(rec.bestTimeMs)}   ${rec.bestScore}${rec.perfect ? '   PERFECT' : ''}`
        : room.teaches
      : 'FINISH THE ROOM BEFORE IT';
    card.append(el('span', 'meta', meta));
    if (unlocked) card.addEventListener('click', () => cb.onSelectRoom(i));
    grid.append(card);
  });

  p.append(grid);
  const menu = el('div', 'menu');
  menu.append(menuButton('BACK', () => cb.onBack()));
  s.append(p, menu);
  return s;
}

export function challenges(save: SaveManager, cb: UICallbacks): HTMLElement {
  const s = screen('is-quiet');
  s.append(el('h2', 'subtitle', 'Challenges'));

  const selected = new Set<ModifierId>();
  let roomIndex = 0;

  const modPanel = panel('RULES');
  modPanel.classList.add('wide');
  const chips = el('div', 'chip-row');
  for (const mod of MODIFIERS) {
    const chip = el('button', 'chip', mod.name);
    chip.type = 'button';
    chip.title = mod.note;
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', () => {
      if (selected.has(mod.id)) selected.delete(mod.id);
      else selected.add(mod.id);
      chip.setAttribute('aria-pressed', String(selected.has(mod.id)));
      note.textContent = describe(selected);
    });
    chips.append(chip);
  }
  const note = el('p', 'note', describe(selected));
  modPanel.append(chips, note);

  const roomPanel = panel('ROOM');
  roomPanel.classList.add('wide');
  const grid = el('div', 'grid-cards');
  const cards: HTMLButtonElement[] = [];
  ROOMS.forEach((room, i) => {
    const rec = save.record(room.id);
    const card = el('button', `card${i === 0 ? ' selected' : ''}`);
    card.type = 'button';
    card.disabled = !rec.completed;
    card.append(el('span', 'idx', `ROOM ${String(i + 1).padStart(2, '0')}`));
    card.append(el('span', 'nm', rec.completed ? room.name : 'NOT YET'));
    card.addEventListener('click', () => {
      roomIndex = i;
      for (const c of cards) c.classList.remove('selected');
      card.classList.add('selected');
    });
    cards.push(card);
    grid.append(card);
  });
  roomPanel.append(grid);

  const menu = el('div', 'menu');
  menu.append(
    menuButton('START', () => cb.onStartChallenge(roomIndex, Array.from(selected))),
    menuButton('TODAY’S ROOM', () => cb.onStartDaily()),
    menuButton('UNMAPPED ROOM', () => cb.onStartEndless()),
    menuButton('BACK', () => cb.onBack()),
  );

  s.append(modPanel, roomPanel, menu);
  return s;
}

function describe(selected: Set<ModifierId>): string {
  if (selected.size === 0) return 'Pick any combination. Harder rules are worth more.';
  const names = MODIFIERS.filter((m) => selected.has(m.id));
  const scale = names.reduce((acc, m) => acc * m.scoreScale, 1);
  return `${names.map((m) => m.note).join(' ')}  Score x${scale.toFixed(2)}`;
}

export function discoveries(discovery: DiscoverySystem, cb: UICallbacks): HTMLElement {
  const s = screen('is-quiet');
  s.append(el('h2', 'subtitle', 'Discoveries'));
  s.append(
    el('p', 'tagline', `${discovery.count} OF ${DISCOVERIES.length} FOUND`),
  );

  const wrap = el('div', 'panel wide');
  for (const group of discovery.grouped()) {
    wrap.append(el('h3', undefined, group.group));
    for (const entry of group.entries) {
      const row = el('div', `discovery-entry${entry.found ? '' : ' locked'}`);
      row.append(el('div', 'dh', entry.found ? entry.def.title : '???'));
      row.append(el('div', 'dl', entry.found ? entry.def.text : '. . . . . . . . . .'));
      wrap.append(row);
    }
  }
  s.append(wrap);

  const menu = el('div', 'menu');
  menu.append(menuButton('BACK', () => cb.onBack()));
  s.append(menu);
  return s;
}

export function settingsScreen(save: SaveManager, cb: UICallbacks): HTMLElement {
  const s = screen('is-quiet');
  s.append(el('h2', 'subtitle', 'Settings'));
  const p = panel('SOUND');
  const st = save.settings;
  p.append(
    sliderRow('MASTER', st.masterVolume, (v) => cb.onSettingChange({ masterVolume: v })),
    sliderRow('ROOM TONE', st.ambienceVolume, (v) => cb.onSettingChange({ ambienceVolume: v })),
    sliderRow('EFFECTS', st.effectsVolume, (v) => cb.onSettingChange({ effectsVolume: v })),
  );

  const p2 = panel('COMFORT');
  p2.append(
    toggleRow('SCREEN SHAKE', st.screenShake, (v) => cb.onSettingChange({ screenShake: v })),
    toggleRow('REDUCED HORROR EFFECTS', st.reducedEffects, (v) =>
      cb.onSettingChange({ reducedEffects: v }),
    ),
    toggleRow('HIGH CONTRAST CURSOR', st.highContrastCursor, (v) =>
      cb.onSettingChange({ highContrastCursor: v }),
    ),
    toggleRow('SHOW HINTS', st.showHints, (v) => cb.onSettingChange({ showHints: v })),
  );
  p2.append(
    el(
      'p',
      'note',
      'Reduced effects removes flashing, distortion and the cursor tremor. It never changes how the creatures behave.',
    ),
  );

  const menu = el('div', 'menu');
  menu.append(
    menuButton('BACK', () => cb.onBack()),
    menuButton('ERASE ALL PROGRESS', () => {
      if (window.confirm('Erase every room, record and discovery?')) cb.onWipeSave();
    }),
  );

  s.append(p, p2, menu);
  return s;
}

export function howTo(cb: UICallbacks): HTMLElement {
  const s = screen('is-quiet');
  s.append(el('h2', 'subtitle', 'How To Play'));

  const p = panel('THE RULE');
  const rule = el('p', 'note');
  rule.innerHTML =
    'The creatures in these rooms cannot see your body. They can see <strong>where your cursor is</strong>, ' +
    'how fast it moved, how long it has been sitting still, and whether it is pointed at them. ' +
    'You can walk right past something and be fine. Look at it and you will not be.';
  p.append(rule);

  const p2 = panel('CONTROLS');
  const rows = el('div', 'rows');
  const controls: [string, string][] = [
    ['WASD', 'Move your body'],
    ['SHIFT', 'Sneak. Quieter, slower'],
    ['MOUSE', 'Move your attention'],
    ['LEFT CLICK', 'Use whatever is under the cursor. Always makes a sound'],
    ['RIGHT CLICK', 'Cancel what you are doing'],
    ['E', 'Use the nearest thing without pointing at it'],
    ['SPACE', 'Hide, when you are standing in cover'],
    ['R', 'Restart the room'],
    ['ESC', 'Pause'],
  ];
  for (const [k, v] of controls) rows.append(statRow(k, v));
  p2.append(rows);

  const p3 = panel('THINGS WORTH KNOWING');
  const list = el('p', 'note');
  list.innerHTML =
    'Clicking empty air still makes a noise, right where you pointed. <br>' +
    'Darkness blurs your attention, it does not erase it. <br>' +
    'Being noticed is not being caught: break the line of sight and keep moving. <br>' +
    'Everything in the room is a tool. Most of them are loud.';
  p3.append(list);

  const menu = el('div', 'menu');
  menu.append(menuButton('BACK', () => cb.onBack()));
  s.append(p, p2, p3, menu);
  return s;
}

export function pauseScreen(roomName: string, cb: UICallbacks): HTMLElement {
  const s = screen('is-quiet');
  s.append(el('h2', 'subtitle', 'Paused'));
  s.append(el('p', 'tagline', roomName));
  const menu = el('div', 'menu');
  menu.append(
    menuButton('RESUME', () => cb.onResume()),
    menuButton('RESTART ROOM', () => cb.onRestart()),
    menuButton('SETTINGS', () => cb.onOpen('settings')),
    menuButton('HOW TO PLAY', () => cb.onOpen('howto')),
    menuButton('LEAVE', () => cb.onQuit()),
  );
  s.append(menu);
  return s;
}

export function resultsScreen(data: ResultsData, cb: UICallbacks): HTMLElement {
  const s = screen();
  s.append(el('h2', 'subtitle', 'Escape Complete'));
  s.append(el('p', 'tagline', `${data.roomLabel}   ${data.roomName}`));
  if (data.score.perfect) {
    s.append(el('div', 'stamp perfect', 'PERFECT ESCAPE'));
  } else {
    s.append(el('div', 'stamp', data.score.grade));
  }

  const p = panel('THE RUN');
  const rows = el('div', 'rows');
  rows.append(statRow('TIME', formatTime(data.stats.timeSeconds * 1000), data.newBestTime ? 'good' : undefined));
  rows.append(
    statRow('DETECTIONS', String(data.stats.detections), data.stats.detections === 0 ? 'good' : 'bad'),
  );
  rows.append(statRow('CLICKS', String(data.stats.clicks)));
  rows.append(
    statRow('NEAR MISSES', String(data.stats.nearMisses), data.stats.nearMisses > 0 ? 'good' : undefined),
  );
  if (data.stats.decoysUsed > 0) rows.append(statRow('DECOYS', String(data.stats.decoysUsed)));
  if (data.stats.secretsFound > 0) rows.append(statRow('FOUND', String(data.stats.secretsFound), 'good'));
  if (data.discoveriesThisRun > 0) {
    rows.append(statRow('NEW DISCOVERIES', String(data.discoveriesThisRun), 'good'));
  }
  p.append(rows);

  const sp = panel('SCORE');
  const lines = el('div', 'score-lines');
  for (const line of data.score.lines) {
    lines.append(statRow(line.label, line.value >= 0 ? `+${line.value}` : String(line.value), line.value >= 0 ? undefined : 'bad'));
  }
  sp.append(lines);
  const total = el('div', 'score-total');
  total.append(el('span', undefined, 'TOTAL'), el('span', undefined, String(data.score.total)));
  sp.append(total);
  if (data.newBestScore) sp.append(el('div', 'hint-line', 'NEW BEST'));
  else sp.append(el('div', 'hint-line', `BEST ${data.bestScore}   ${formatTime(data.bestTimeMs)}`));

  const menu = el('div', 'menu');
  if (data.hasNextRoom && !data.isChallenge) {
    menu.append(menuButton('NEXT ROOM', () => cb.onNextRoom()));
  }
  menu.append(
    menuButton('RUN IT AGAIN', () => cb.onRestart()),
    menuButton('LEAVE', () => cb.onQuit()),
  );

  s.append(p, sp, menu);
  return s;
}

export function deathScreen(data: DeathData, cb: UICallbacks): HTMLElement {
  const s = screen();
  s.append(el('div', 'stamp dead', 'IT SAW YOU'));
  s.append(el('p', 'tagline', `${data.killedBy}   ${data.roomName}`));
  if (data.lesson) s.append(el('p', 'note', data.lesson));
  const menu = el('div', 'menu');
  menu.append(
    menuButton('TRY AGAIN', () => cb.onRestart()),
    menuButton('LEAVE', () => cb.onQuit()),
  );
  s.append(menu);
  s.append(el('div', 'hint-line', 'R TO RESTART'));
  return s;
}

export function mouseRequired(): HTMLElement {
  const s = screen('is-quiet');
  s.append(el('h2', 'subtitle', 'Mouse Required'));
  s.append(
    el(
      'p',
      'note',
      'Your attention left the room, so the room is holding its breath. Move the pointer back inside to carry on.',
    ),
  );
  return s;
}

export function introScreen(lines: readonly string[], index: number): HTMLElement {
  const s = screen('is-black');
  s.append(el('p', 'intro-line', lines[Math.min(index, lines.length - 1)]));
  return s;
}
