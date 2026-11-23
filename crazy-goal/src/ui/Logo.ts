import { football } from './Football';
import { uniqueIds } from './GameIcons';

/**
 * The CRAZY KORA wordmark as a vector, so it is sharp at any size on any screen: CRAZY in sun yellow
 * over KORA in hot pink, each letter with a solid 3D edge under it, the ball for the O and a green dot.
 * Drawn in Bungee (bundled with the game).
 */

const FACE = `font-family="'Bungee', 'Arial Black', sans-serif" font-weight="400"`;

/** One line of lettering: the deep edge, the mid edge, then the face with a gradient and a soft top light. */
function word(text: string, x: number, y: number, size: number, grad: string, mid: string, deep: string, spacing: number): string {
  const t = (dx: number, dy: number, fill: string): string =>
    `<text x="${x + dx}" y="${y + dy}" font-size="${size}" letter-spacing="${spacing}" ${FACE} fill="${fill}">${text}</text>`;
  return t(5, 9, deep) + t(3, 5, mid) + t(0, 0, `url(#${grad})`);
}

export function logoSvg(className = ''): string {
  return uniqueIds(
    `<svg class="${className}" viewBox="0 0 364 300" role="img" aria-label="Crazy Kora" focusable="false">` +
    `<defs>` +
    `<linearGradient id="lg-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff07a"/><stop offset="0.5" stop-color="#ffd21f"/><stop offset="1" stop-color="#ffb800"/></linearGradient>` +
    `<linearGradient id="lg-pink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a8c"/><stop offset="0.55" stop-color="#ff1f5e"/><stop offset="1" stop-color="#e0104c"/></linearGradient>` +
    `<radialGradient id="lg-dot" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#9dff8a"/><stop offset="1" stop-color="#1fc24c"/></radialGradient>` +
    `</defs>` +
    `<g transform="rotate(-5 182 80)">${word('CRAZY', 14, 128, 116, 'lg-sun', '#e09a00', '#8a4d00', 2)}</g>` +
    `<g transform="rotate(-3 182 230)">` +
    word('K', 14, 252, 116, 'lg-pink', '#b8123f', '#6e0a26', 0) +
    // The ball sits where the O would be, a little low and a little big, with its shadow on the ground.
    `<ellipse cx="130" cy="262" rx="38" ry="6" fill="#0b1022" opacity=".18"/>` +
    football(128, 214, 44) +
    word('RA', 176, 252, 116, 'lg-pink', '#b8123f', '#6e0a26', 2) +
    `<circle cx="331" cy="240" r="9" fill="#0e7a30"/><circle cx="329" cy="237" r="9" fill="url(#lg-dot)"/>` +
    `</g>` +
    `</svg>`
  );
}
