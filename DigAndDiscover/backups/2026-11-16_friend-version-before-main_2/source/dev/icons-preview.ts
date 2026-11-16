import { UI_ICON_KEYS, drawUiIcon } from '../src/art/UiIcons';

const SIZES = [128, 48, 24];
const BACKGROUNDS: { name: string; color: string }[] = [
  { name: 'light', color: '#fff3dc' },
  { name: 'dark', color: '#3b2616' },
  { name: 'sky', color: '#7fcfff' },
];

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function buildPanel(background: string, key: string): HTMLElement {
  const panel = document.createElement('div');
  panel.className = `panel ${background}`;
  for (const size of SIZES) {
    const canvas = makeCanvas(size);
    const ctx = canvas.getContext('2d');
    if (ctx) drawUiIcon(ctx, key as (typeof UI_ICON_KEYS)[number], size);
    panel.appendChild(canvas);
  }
  return panel;
}

function build(): void {
  const root = document.getElementById('root');
  if (!root) return;
  for (const key of UI_ICON_KEYS) {
    const card = document.createElement('div');
    card.className = 'card';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = key;
    const row = document.createElement('div');
    row.className = 'row';
    for (const bg of BACKGROUNDS) row.appendChild(buildPanel(bg.name, key));
    card.appendChild(name);
    card.appendChild(row);
    root.appendChild(card);
  }
}

build();
