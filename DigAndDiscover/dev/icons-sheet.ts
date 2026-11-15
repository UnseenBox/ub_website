import { UI_ICON_KEYS, drawUiIcon } from '../src/art/UiIcons';
const g = document.getElementById('g')!;
for (const key of UI_ICON_KEYS) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  drawUiIcon(c.getContext('2d')!, key, 128);
  const d = document.createElement('div');
  d.className = 'c';
  d.append(c, document.createTextNode(key));
  g.append(d);
}
