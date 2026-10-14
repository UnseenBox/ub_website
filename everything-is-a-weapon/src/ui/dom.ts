/** Tiny DOM helpers shared by the HUD and the menu screens. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** A strip of torn paper you can press. The paper and its tape are drawn by CSS around the label. */
export function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = el('button', `btn ${className}`.trim());
  node.type = 'button';
  node.append(el('span', 'btn-label', text));
  node.addEventListener('click', onClick);
  return node;
}

export function formatScore(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** Stable pseudo-random in [0,1) so cut-out letters look the same every time a screen is rebuilt. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const CUT_STYLES = 8;

/**
 * Sets a line of text as a ransom note: every letter is a different clipping, cut
 * from a different page, glued on at a slightly different angle.
 */
export function ransom(text: string, seed = 1, className = ''): HTMLElement {
  const root = el('span', `ransom ${className}`.trim());
  root.setAttribute('role', 'text');
  root.setAttribute('aria-label', text);
  let index = 0;
  let previous = -1;
  for (const word of text.split(' ')) {
    if (!word) continue;
    const group = el('span', 'ransom-word');
    group.setAttribute('aria-hidden', 'true');
    for (const char of word) {
      let style = Math.floor(hash(seed * 31 + index * 7.13 + char.charCodeAt(0)) * CUT_STYLES);
      if (style === previous) style = (style + 3) % CUT_STYLES;
      previous = style;
      const letter = el('span', `cut cut-${style} cut-shape-${index % 3}`, char);
      letter.style.setProperty('--r', `${((hash(index * 3.3 + seed) - 0.5) * 13).toFixed(1)}deg`);
      letter.style.setProperty('--y', `${((hash(index * 5.1 + seed * 2) - 0.5) * 0.16).toFixed(3)}em`);
      letter.style.setProperty('--s', (0.9 + hash(index * 1.7 + seed * 3) * 0.24).toFixed(2));
      letter.style.setProperty('--i', String(index));
      group.append(letter);
      index++;
    }
    root.append(group);
  }
  return root;
}
