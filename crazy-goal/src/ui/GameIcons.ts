/**
 * The game's icons, drawn as stickers: a dark navy outline, fills with a light-to-dark gradient, and
 * a white shine on the upper left, like the logo and the ball art. Each is an SVG string on a 48-unit
 * grid. Gradient ids are fixed per icon, so two copies on a page share identical definitions.
 */

const INK = '#13203d';
const svg = (body: string, defs = ''): string =>
  `<svg class="game-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
const linear = (id: string, top: string, bottom: string): string =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;
const shine = (cx: number, cy: number, rx: number, ry: number, rot = -30): string =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="#fff" opacity=".55"/>`;

/** A gear's outline: `teeth` square-ish teeth round a disc. */
function gearPath(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    for (const [da, r] of [
      [-0.3, inner],
      [-0.18, outer],
      [0.18, outer],
      [0.3, inner],
    ] as const) {
      const t = a + da * step * 1.6;
      pts.push(`${(cx + Math.cos(t) * r).toFixed(2)},${(cy + Math.sin(t) * r).toFixed(2)}`);
    }
  }
  return `M${pts.join('L')}Z`;
}

export const ICONS = {
  /** Settings: a silver gear with a gold hub. */
  gear: svg(
    `<path d="${gearPath(24, 24, 20, 15.5, 8)}" fill="url(#gi-gear)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
     <circle cx="24" cy="24" r="7" fill="url(#gi-hub)" stroke="${INK}" stroke-width="3"/>
     ${shine(17, 15, 6, 3)}`,
    linear('gi-gear', '#ffffff', '#9fb4dc') + linear('gi-hub', '#ffe066', '#f0a21c'),
  ),
  /** Play or resume: a fat rounded triangle. */
  play: svg(
    `<path d="M15 8.5c0-2.3 2.5-3.7 4.5-2.5l20 13.2c1.9 1.2 1.9 4 0 5.2L19.5 37.6c-2 1.2-4.5-.2-4.5-2.5Z" fill="url(#gi-play)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
     ${shine(20, 14, 4, 2.2, 30)}`,
    linear('gi-play', '#ffffff', '#d7f7df'),
  ),
  /** Retake the shot: a gold arrow chasing its tail. */
  replay: svg(
    `<path d="M24 13A13 13 0 1 1 12.7 19.5" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
     <path d="M24 13A13 13 0 1 1 12.7 19.5" fill="none" stroke="url(#gi-replay)" stroke-width="4.5" stroke-linecap="round"/>
     <path d="M17.2 9.2 5.4 15.8l12.8 10.2Z" fill="url(#gi-replay)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
    linear('gi-replay', '#fff3b0', '#f5b324'),
  ),
  /** The stadiums: a goal with its net and a ball in front of it. */
  goal: svg(
    `<path d="M5 37V12a3 3 0 0 1 3-3h32a3 3 0 0 1 3 3v25" fill="url(#gi-net)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
     <path d="M12 9v28M20 9v28M28 9v28M36 9v28M5 17h38M5 25h38" stroke="#7da7d9" stroke-width="1.6"/>
     <path d="M5 37V12a3 3 0 0 1 3-3h32a3 3 0 0 1 3 3v25" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/>
     <path d="M5 37V12a3 3 0 0 1 3-3h32a3 3 0 0 1 3 3v25" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round" opacity=".5"/>
     <circle cx="31" cy="34" r="9" fill="#fff" stroke="${INK}" stroke-width="3"/>
     <path d="M31 30.2l3.4 2.5-1.3 4h-4.2l-1.3-4Z" fill="${INK}"/>
     ${shine(28, 30, 2.6, 1.5)}`,
    linear('gi-net', '#eaf3ff', '#bcd4f2'),
  ),
  /** Home: a little house with a red roof and a blue door. */
  home: svg(
    `<path d="M10 22v18a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V22" fill="url(#gi-wall)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
     <path d="M20 42V31a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v11" fill="#2f74d0" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
     <path d="M4.5 24.5 24 6l19.5 18.5" fill="url(#gi-roof)" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
     <path d="M31 9.5V6h5v8.5" fill="#c9c2b8" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
     ${shine(17, 15, 4.5, 2)}`,
    linear('gi-wall', '#fffaf0', '#f0dfc2') + linear('gi-roof', '#ff6b52', '#c2321f'),
  ),
  /** A video ad: a little TV with a gold play button. */
  ad: svg(
    `<rect x="4.5" y="10" width="39" height="28" rx="7" fill="url(#gi-tv)" stroke="${INK}" stroke-width="3"/>
     <path d="M20 17.5v13l11-6.5Z" fill="url(#gi-tvplay)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
     <path d="M17 44h14" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>
     ${shine(13, 15, 4, 1.8, -20)}`,
    linear('gi-tv', '#5a8fe0', '#1e3f86') + linear('gi-tvplay', '#fff3b0', '#f5b324'),
  ),
  /** Locked: a gold padlock with a silver shackle. */
  lock: svg(
    `<path d="M15 22v-6a9 9 0 0 1 18 0v6" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
     <path d="M15 22v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#d9e1ee" stroke-width="3.5" stroke-linecap="round"/>
     <rect x="8.5" y="21" width="31" height="23" rx="6" fill="url(#gi-lock)" stroke="${INK}" stroke-width="3"/>
     <path d="M24 29.5v6" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
     ${shine(15, 26, 3.5, 1.6, -15)}`,
    linear('gi-lock', '#ffe27a', '#e69a12'),
  ),
  /** Sound: a speaker with two waves. */
  sound: svg(
    `<path d="M6 19h7l10-8.5v27L13 29H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" fill="url(#gi-spk)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
     <path d="M30 17.5a9 9 0 0 1 0 13M35.5 12.5a16 16 0 0 1 0 23" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
     <path d="M30 17.5a9 9 0 0 1 0 13M35.5 12.5a16 16 0 0 1 0 23" fill="none" stroke="#7fd4ff" stroke-width="2.6" stroke-linecap="round"/>
     ${shine(10, 21, 2.6, 1.4)}`,
    linear('gi-spk', '#ffffff', '#b9c9e6'),
  ),
  /** Music: two notes joined by a beam. */
  music: svg(
    `<path d="M17 34V11l22-5v24" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
     <path d="M17 34V11l22-5v24" fill="none" stroke="#ff8fb6" stroke-width="2.6" stroke-linejoin="round"/>
     <ellipse cx="12" cy="35" rx="7" ry="5.5" fill="url(#gi-note)" stroke="${INK}" stroke-width="3"/>
     <ellipse cx="34" cy="31" rx="7" ry="5.5" fill="url(#gi-note)" stroke="${INK}" stroke-width="3"/>
     ${shine(10, 33, 2.4, 1.2)}`,
    linear('gi-note', '#ff8fb6', '#d6336c'),
  ),
  /** Language: a globe. */
  globe: svg(
    `<circle cx="24" cy="24" r="19" fill="url(#gi-sea)" stroke="${INK}" stroke-width="3"/>
     <path d="M13 12c4 3 2 7 6 8s6 5 3 9-1 7-4 9M30 7c-1 4 3 5 6 4s5 3 4 7c-3 1-5 3-3 7s-1 7-4 7" fill="#5ccf6a" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
     <circle cx="24" cy="24" r="19" fill="none" stroke="${INK}" stroke-width="3"/>
     ${shine(16, 14, 5, 2.4)}`,
    linear('gi-sea', '#7ccbff', '#2d78d2'),
  ),
  /** Back: a fat arrow pointing left. */
  back: svg(
    `<path d="M22 7.5 5.5 24 22 40.5V31h17a3 3 0 0 0 3-3v-8a3 3 0 0 0-3-3H22Z" fill="url(#gi-back)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
     ${shine(16, 19, 3.6, 1.6, -40)}`,
    linear('gi-back', '#ffffff', '#cfe0f5'),
  ),
} as const;

export type IconName = keyof typeof ICONS;
