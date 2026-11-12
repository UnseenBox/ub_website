/**
 * Pictures for the free-kick controls and the tutorial card. Plain SVG strings with no words in them:
 * the lessons are shown, not written. Colours are the game's own (ink, sun, pitch green).
 */

const INK = '#1b2540';
const SUN = '#ffc83a';
const PITCH = '#2f9a46';
const PITCH_DARK = '#25803a';
const WHITE = '#ffffff';

const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A little football, centred on x, y. */
const ball = (x: number, y: number, r: number): string =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${WHITE}" stroke="${INK}" stroke-width="${(r * 0.26).toFixed(1)}"/>` +
  `<path d="M${x} ${y - r * 0.5}l${r * 0.48} ${r * 0.36}-${r * 0.18} ${r * 0.56}h-${r * 0.6}l-${r * 0.18}-${r * 0.56}z" fill="${INK}"/>`;

const svg = (box: string, body: string, cls = ''): string => `<svg viewBox="${box}" class="${cls}" aria-hidden="true" focusable="false">${body}</svg>`;

/** Button and chip icons, 48 x 48. */
export const ICON = {
  /** The ball rolling along the ground, with speed lines. */
  ground: svg(
    '0 0 48 48',
    `<path d="M5 41h38" stroke="${INK}" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M4 25h9M2 31h11M5 37h8" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity=".5"/>` +
      ball(24, 30, 9) +
      `<path d="M35 30h9m-4-5 5 5-5 5" fill="none" stroke="${SUN}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  /** The ball flying high over a defender. */
  air: svg(
    '0 0 48 48',
    `<path d="M5 42h38" stroke="${INK}" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>` +
      `<rect x="21" y="26" width="7" height="16" rx="3" fill="${INK}"/><circle cx="24.5" cy="23" r="3.6" fill="${INK}"/>` +
      `<path d="M5 38Q24-14 43 38" fill="none" stroke="${SUN}" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="1 6"/>` +
      ball(24, 8, 6.5),
  ),
  /** A curling arrow. */
  bend: svg(
    '0 0 48 48',
    `<path d="M12 42C2 28 12 14 32 10" fill="none" stroke="${SUN}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M28 2l9 7-8 7" fill="none" stroke="${SUN}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
      ball(14, 38, 6.5),
  ),
  /** A finger pulling the ball back: press, drag, let go. */
  pull: svg(
    '0 0 48 48',
    ball(24, 11, 7) +
      `<path d="M24 20v10" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 5"/>` +
      `<circle cx="24" cy="36" r="8" fill="${WHITE}" stroke="${INK}" stroke-width="3.4"/>` +
      `<path d="M24 32v8m-4-4 4 4 4-4" fill="none" stroke="${SUN}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  /** A finger tapping. */
  tap: svg(
    '0 0 48 48',
    `<circle cx="24" cy="24" r="9" fill="${WHITE}" stroke="${INK}" stroke-width="3.6"/>` +
      `<circle cx="24" cy="24" r="16" fill="none" stroke="${SUN}" stroke-width="3.4" stroke-dasharray="3 6" stroke-linecap="round"/>`,
  ),
  check: svg('0 0 24 24', `<path d="M5 13l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),
};

/** A short sunlit arrow head at the end of a path, drawn from the last two points. */
export function arrowHead(x: number, y: number, fromX: number, fromY: number, size = 7): string {
  const a = Math.atan2(y - fromY, x - fromX);
  const p = (k: number): string => `${(x - Math.cos(a + k) * size).toFixed(1)} ${(y - Math.sin(a + k) * size).toFixed(1)}`;
  return `M${p(0.5)}L${x.toFixed(1)} ${y.toFixed(1)}L${p(-0.5)}`;
}

/** The little curve in the bend control: shows which way the ball will curl. */
export function bendGlyph(bend: number): string {
  const b = Math.max(-1, Math.min(1, bend));
  const sx = 40;
  const sy = 50;
  const ex = 40 + b * 18;
  const ey = 8;
  const cx = 40 - b * 30;
  const cy = 28;
  const d = `M${sx} ${sy}Q${cx} ${cy} ${ex} ${ey}`;
  // Tangent at the end of a quadratic points from the control point to the end.
  const head = arrowHead(ex, ey, cx, cy, 8);
  return `<path d="${d}" fill="none" stroke="${SUN}" stroke-width="5" stroke-linecap="round"/><path d="${head}" fill="none" stroke="${SUN}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const goalTop = (x: number): string =>
  `<path d="M${x - 17} 24V8h34v16" fill="none" stroke="${WHITE}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` + `<path d="M${x - 14} 12h28M${x - 14} 18h28M${x - 7} 9v14M${x} 9v14M${x + 7} 9v14" stroke="${WHITE}" stroke-opacity=".35" stroke-width="1.2"/>`;

const defender = (x: number, y: number): string => `<rect x="${x - 9}" y="${y - 6}" width="18" height="12" rx="4" fill="${INK}"/><circle cx="${x}" cy="${y}" r="4" fill="#e0b48f"/>`;

/** A ball that runs along `path` for ever (a still ball when the player asks for less motion). */
const runner = (path: string, x: number, y: number): string =>
  reduced()
    ? ball(x, y, 6.5)
    : `<g>${ball(0, 0, 6.5)}<animateMotion dur="1.9s" repeatCount="indefinite" path="${path}"/></g>`;

const route = (path: string): string => `<path d="${path}" class="mv-flow" fill="none" stroke="${SUN}" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="1 7"/>`;

const pitch = (): string => `<rect width="160" height="92" rx="14" fill="${PITCH}"/><rect y="46" width="160" height="23" fill="${PITCH_DARK}" opacity=".5"/><rect y="0" width="160" height="23" fill="${PITCH_DARK}" opacity=".5"/>`;

/** The picture of each lesson's move, 160 x 92: what it looks like, with no words. */
export const MOVE_ART: Readonly<Record<'straight' | 'bend' | 'air' | 'bank' | 'free', () => string>> = {
  straight: () => {
    const path = 'M80 78L80 20';
    return svg('0 0 160 92', pitch() + goalTop(80) + route(path) + runner(path, 80, 78), 'mv');
  },
  bend: () => {
    const path = 'M80 78C26 70 30 24 76 20';
    return svg('0 0 160 92', pitch() + goalTop(80) + defender(72, 50) + defender(88, 50) + route(path) + runner(path, 80, 78), 'mv');
  },
  // Side view: the only way to show "over".
  air: () => {
    const path = 'M26 72Q80-26 134 66';
    return svg(
      '0 0 160 92',
      `<rect width="160" height="92" rx="14" fill="#4a79c9"/><rect y="74" width="160" height="18" rx="0" fill="${PITCH}"/>` +
        `<rect x="74" y="42" width="13" height="32" rx="5" fill="${INK}"/><circle cx="80.5" cy="37" r="7" fill="#e0b48f"/>` +
        `<path d="M138 74V40h14v34" fill="none" stroke="${WHITE}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` +
        route(path) +
        runner(path, 26, 72),
      'mv',
    );
  },
  bank: () => {
    const path = 'M80 78L140 44L96 20';
    return svg('0 0 160 92', pitch() + `<rect x="148" y="14" width="6" height="64" rx="3" fill="${WHITE}"/>` + goalTop(80) + `<rect x="60" y="44" width="40" height="10" rx="3" fill="${INK}"/>` + route(path) + runner(path, 80, 78), 'mv');
  },
  free: () => {
    const curl = 'M80 78C34 72 34 28 74 22';
    const lob = 'M80 78Q80 -4 80 22';
    const bank = 'M80 78L136 48L92 22';
    return svg(
      '0 0 160 92',
      pitch() +
        goalTop(80) +
        defender(70, 52) +
        defender(90, 52) +
        route(curl) +
        route(bank) +
        `<path d="${lob}" class="mv-flow" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="1 7"/>` +
        ball(80, 78, 6.5),
      'mv',
    );
  },
};
