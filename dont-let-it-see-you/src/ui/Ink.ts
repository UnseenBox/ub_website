/**
 * The shared ink layer.
 *
 * Everything the interface draws goes through one SVG filter that displaces it
 * along a noise field, so straight lines come out slightly wrong, the way a line
 * drawn by hand against a ruler comes out slightly wrong. It is the single cheap
 * trick that stops the UI reading as a web page laid over a game.
 *
 * One `<svg>` of definitions is injected once and referenced by id from anywhere.
 */

const DEFS_ID = 'ink-defs';

export const INK = {
  rough: 'url(#ink-rough)',
  roughSoft: 'url(#ink-rough-soft)',
  smudge: 'url(#ink-smudge)',
} as const;

export function installInkDefs(): void {
  if (document.getElementById(DEFS_ID)) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = DEFS_ID;
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  svg.innerHTML = `
    <defs>
      <filter id="ink-rough" x="-25%" y="-25%" width="150%" height="150%" filterUnits="objectBoundingBox">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="ink-rough-soft" x="-25%" y="-25%" width="150%" height="150%" filterUnits="objectBoundingBox">
        <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="19" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="ink-smudge" x="-30%" y="-30%" width="160%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="3" result="grain"/>
        <feColorMatrix in="grain" type="saturate" values="0" result="grey"/>
        <feComponentTransfer in="grey" result="speck">
          <feFuncA type="discrete" tableValues="0 0 0 0 0.35 0 0 0"/>
        </feComponentTransfer>
        <feComposite in="speck" in2="SourceGraphic" operator="in" result="specks"/>
        <feMerge>
          <feMergeNode in="SourceGraphic"/>
          <feMergeNode in="specks"/>
        </feMerge>
      </filter>
    </defs>`;
  document.body.append(svg);
}

const NS = 'http://www.w3.org/2000/svg';

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/**
 * Icon set, drawn as stroked paths so they inherit `currentColor` and the ink
 * filter. Hand shaped rather than geometric: the eye is not a perfect ellipse.
 */
export const ICON_PATHS = {
  /** An eye. `openness` 0..1 squashes the lids shut. */
  eye: (open: number): string => {
    const h = 3 + open * 7;
    return `M2 11 C 7 ${11 - h}, 19 ${11 - h}, 24 11 C 19 ${11 + h * 0.82}, 7 ${11 + h * 0.82}, 2 11 Z`;
  },
  pupil: 'M13 11 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0',
  /** Sound coming off something, the brackets from the reference sheet. */
  waveLeft: 'M5 5 C 1 8, 1 14, 5 17 M9 7.5 C 6.6 9.4, 6.6 12.6, 9 14.5',
  waveRight: 'M21 5 C 25 8, 25 14, 21 17 M17 7.5 C 19.4 9.4, 19.4 12.6, 17 14.5',
  key: 'M8 11 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M12 11 L22 11 M18.5 11 L18.5 15 M21.5 11 L21.5 14.2',
  foot: 'M9 4 C 12 4, 13 7, 12.4 11 C 12 14, 9.4 14.6, 8 13 C 6.6 11.4, 6.6 5, 9 4 Z M10.6 16.6 C 12.2 16.4, 13 17.6, 12.6 18.8 C 12.2 20, 10.4 20.2, 9.6 19.2 C 8.9 18.3, 9.4 16.8, 10.6 16.6 Z',
  hidden: 'M2 11 C 7 5, 19 5, 24 11 C 19 17, 7 17, 2 11 Z M3 3 L23 19',
  alert: 'M13 2 L16 9 L23 11 L16 13 L13 20 L10 13 L3 11 L10 9 Z',
  cross: 'M13 4 L13 18 M6 11 L20 11',
} as const;

export function iconSvg(
  path: string,
  size: number,
  strokeWidth = 1.6,
  extraPath?: string,
): SVGSVGElement {
  const node = svg('svg', {
    viewBox: '0 0 26 22',
    width: size,
    height: Math.round((size * 22) / 26),
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  node.append(svg('path', { d: path }));
  if (extraPath) node.append(svg('path', { d: extraPath, fill: 'currentColor', stroke: 'none' }));
  node.style.filter = INK.rough;
  return node;
}
