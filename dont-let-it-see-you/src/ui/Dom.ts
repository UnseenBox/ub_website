/** Tiny DOM helpers. The UI is a handful of dark panels, so this is all it needs. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function menuButton(label: string, onClick: () => void, enabled = true): HTMLButtonElement {
  const b = el('button', 'item', label);
  b.type = 'button';
  b.disabled = !enabled;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

export function statRow(key: string, value: string, tone?: 'good' | 'bad'): HTMLElement {
  const row = el('div', `row${tone ? ` ${tone}` : ''}`);
  row.append(el('span', 'k', key), el('span', 'v', value));
  return row;
}

export function panel(title: string): HTMLElement {
  const p = el('div', 'panel');
  p.append(el('h3', undefined, title));
  return p;
}

export function formatTime(ms: number): string {
  if (ms <= 0) return '--:--';
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const cs = Math.floor((totalSeconds * 100) % 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function toggleRow(
  label: string,
  value: boolean,
  onChange: (next: boolean) => void,
): HTMLElement {
  const row = el('div', 'toggle-line');
  const l = el('label', undefined, label);
  const b = el('button', 'swbtn', value ? 'ON' : 'OFF');
  b.type = 'button';
  b.setAttribute('aria-pressed', String(value));
  b.addEventListener('click', () => {
    const next = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(next));
    b.textContent = next ? 'ON' : 'OFF';
    onChange(next);
  });
  row.append(l, b);
  return row;
}

export function sliderRow(
  label: string,
  value: number,
  onChange: (next: number) => void,
): HTMLElement {
  const row = el('div', 'toggle-line');
  const l = el('label', undefined, label);
  const input = el('input');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '1';
  input.value = String(Math.round(value * 100));
  input.addEventListener('input', () => onChange(Number(input.value) / 100));
  row.append(l, input);
  return row;
}
