/**
 * A real football for the HTML side of the game (kick controls, store, menus): shaded white leather,
 * a black pentagon in the middle with five more turning away round the rim, the seams between them,
 * a dark outline and a shine. Drawn on a 100-unit square; `football()` places and sizes it.
 */

const INK = '#1b2540';

const pentagon = (cx: number, cy: number, r: number, rot: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * Math.PI * 2) / 5;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
};

const UP = -Math.PI / 2;
const polar = (r: number, a: number): string => `${(50 + Math.cos(a) * r).toFixed(2)},${(50 + Math.sin(a) * r).toFixed(2)}`;

/** The ball's parts on the 100-unit square, built once. */
const BODY = (() => {
  const centre = pentagon(50, 50, 17, UP);
  let rim = '';
  let seams = '';
  for (let k = 0; k < 5; k++) {
    const a = UP + Math.PI / 5 + (k * Math.PI * 2) / 5;
    // Patches turning away over the edge: centred on the rim, so the outline cuts them.
    rim += pentagon(50 + Math.cos(a) * 51, 50 + Math.sin(a) * 51, 15, a + Math.PI);
    // Seams: out from each corner of the middle patch, then forking to the patches either side.
    const v = UP + (k * Math.PI * 2) / 5;
    seams += `M${polar(17, v)}L${polar(30, v)}M${polar(30, v)}L${polar(37, v - 0.42)}M${polar(30, v)}L${polar(37, v + 0.42)}`;
  }
  return { centre, rim, seams };
})();

/** The ball as SVG markup, centred on (cx, cy) with radius r. Gradient and clip ids are shared by every copy. */
export function football(cx: number, cy: number, r: number): string {
  const s = r / 50;
  return (
    `<g transform="translate(${(cx - r).toFixed(2)} ${(cy - r).toFixed(2)}) scale(${s.toFixed(4)})">` +
    `<defs><radialGradient id="kb-leather" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#eef1f6"/><stop offset="1" stop-color="#aeb9cc"/></radialGradient>` +
    `<clipPath id="kb-clip"><circle cx="50" cy="50" r="46"/></clipPath></defs>` +
    `<circle cx="50" cy="50" r="46" fill="url(#kb-leather)"/>` +
    `<g clip-path="url(#kb-clip)"><path d="${BODY.seams}" fill="none" stroke="${INK}" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="${BODY.rim}" fill="${INK}"/></g>` +
    `<path d="${BODY.centre}" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `<circle cx="50" cy="50" r="46" fill="none" stroke="${INK}" stroke-width="6"/>` +
    `<ellipse cx="33" cy="29" rx="12" ry="6.5" transform="rotate(-35 33 29)" fill="#fff" opacity=".8"/>` +
    `</g>`
  );
}

/** A whole SVG of just the ball. */
export const footballSvg = (className = ''): string =>
  `<svg viewBox="0 0 100 100" class="${className}" aria-hidden="true" focusable="false">${football(50, 50, 50)}</svg>`;

/** The ball as a data URL, for CSS backgrounds such as a slider's knob. */
export const footballUrl = (): string =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${football(50, 50, 50)}</svg>`)}")`;
