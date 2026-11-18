import type { WeaponId } from '../game/catalog';

// Weapon icons: 64x64 SVGs in one style. Dark outline, soft gradients and a gloss
// highlight, so every weapon reads at a glance on a card or in the HUD.

const OUT = '#1d2638';

function radial(id: string, light: string, dark: string): string {
  return `<radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></radialGradient>`;
}

function linear(id: string, a: string, b: string): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
}

/** A glossy ball with a soft highlight. */
function orb(id: string, cx: number, cy: number, r: number, light: string, dark: string): string {
  const hx = cx - r * 0.38;
  const hy = cy - r * 0.42;
  return `${radial(id, light, dark)}<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})" stroke="${OUT}" stroke-width="2.5"/><ellipse cx="${hx}" cy="${hy}" rx="${r * 0.3}" ry="${r * 0.17}" fill="#fff" opacity=".75" transform="rotate(-30 ${hx} ${hy})"/>`;
}

function shadow(cx: number, cy: number, rx: number): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="3.5" fill="#000" opacity=".22"/>`;
}

const ICONS: Record<WeaponId, (k: string) => string> = {
  hands: (k) => `
    <path d="M14 58 C12 48 13 40 18 35 L24 30 C26 28 29 29 29 32 L28 37" fill="#ffffff" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M18 35 C17 30 19 24 23 22 C27 20 30 22 30 26" fill="none" stroke="${OUT}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M14 58 L30 58 C33 52 34 46 33 40" fill="#ffffff" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>
    ${orb(`${k}-o`, 38, 22, 12, '#eaffd6', '#4fbf2a')}
    <path d="M30 31 Q33 36 31 41" stroke="#4fbf2a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M50 10 L54 6 M53 16 L58 15 M46 7 L46 2" stroke="#8dff5a" stroke-width="2.4" stroke-linecap="round"/>`,

  spray: (k) => `
    ${radial(`${k}-n`, '#d6fff3', '#2fa98a')}
    <rect x="7" y="23" width="23" height="18" rx="7" fill="url(#${k}-n)" stroke="${OUT}" stroke-width="2.5"/>
    <rect x="28" y="28" width="10" height="8" rx="2" fill="#1f7a66" stroke="${OUT}" stroke-width="2"/>
    <path d="M41 22 L39 28 M42 41 L40 36" stroke="#5ef2c2" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
    ${orb(`${k}-a`, 47, 17, 5.5, '#e6fff8', '#3ed6a8')}
    ${orb(`${k}-b`, 52, 32, 6, '#e6fff8', '#3ed6a8')}
    ${orb(`${k}-c`, 47, 47, 5.5, '#e6fff8', '#3ed6a8')}`,

  squirt: (k) => `
    ${radial(`${k}-b`, '#f2ffe0', '#6bbf3a')}
    <rect x="28" y="12" width="8" height="10" rx="2" fill="#4a7d2a" stroke="${OUT}" stroke-width="2"/>
    <path d="M23 27 Q22 22 28 22 L36 22 Q42 22 41 27 L42 50 Q42 57 35 57 L29 57 Q22 57 22 50 Z" fill="url(#${k}-b)" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M26 38 Q32 42 38 38" fill="none" stroke="${OUT}" stroke-width="1.5" opacity=".45"/>
    <circle cx="50" cy="21" r="3.2" fill="#b6ff8a" stroke="${OUT}" stroke-width="1.5"/>
    <circle cx="54" cy="33" r="3.6" fill="#b6ff8a" stroke="${OUT}" stroke-width="1.5"/>
    <circle cx="49" cy="46" r="2.8" fill="#b6ff8a" stroke="${OUT}" stroke-width="1.5"/>`,

  heavy: (k) => `
    ${shadow(32, 56, 18)}
    ${orb(`${k}-o`, 32, 31, 20, '#c9ffd9', '#17803f')}
    <path d="M13 37 Q32 47 51 37" fill="none" stroke="#0f4f2a" stroke-width="3" opacity=".5"/>`,

  balloon: (k) => `
    <path d="M32 47 Q27 52 33 57 Q38 61 32 63" fill="none" stroke="${OUT}" stroke-width="1.5"/>
    ${radial(`${k}-b`, '#fff3fb', '#ff7fcc')}
    <ellipse cx="32" cy="27" rx="14" ry="17" fill="url(#${k}-b)" stroke="${OUT}" stroke-width="2.5"/>
    <ellipse cx="25" cy="18" rx="3.5" ry="6" fill="#fff" opacity=".7" transform="rotate(20 25 18)"/>
    <path d="M29 44 L35 44 L32 48 Z" fill="#ff7fcc" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>`,

  clinger: (k) => `
    <path d="M22 28 Q12 24 9 14 M42 28 Q52 24 55 14 M26 40 Q14 44 10 54 M38 40 Q50 44 54 54 M32 45 Q32 54 26 60" fill="none" stroke="#ff7ad9" stroke-width="2" stroke-linecap="round"/>
    ${[[9, 14], [55, 14], [10, 54], [54, 54], [26, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.8" fill="#ffb3ec" stroke="${OUT}" stroke-width="1.4"/>`).join('')}
    ${orb(`${k}-o`, 32, 32, 13, '#ffe0f7', '#b8309a')}`,

  sniper: (k) => `
    <circle cx="32" cy="32" r="22" fill="#2a3450" stroke="${OUT}" stroke-width="2.5"/>
    <circle cx="32" cy="32" r="16" fill="#0f1626" stroke="#c8ff3d" stroke-width="1.5" opacity=".9"/>
    <path d="M32 12 V52 M12 32 H52" stroke="#c8ff3d" stroke-width="1.5" opacity=".85"/>
    ${orb(`${k}-o`, 32, 32, 5, '#f4ffd0', '#8fc41a')}`,

  glue: (k) => `
    ${linear(`${k}-g`, '#ffe3a0', '#d18b1e')}
    <ellipse cx="32" cy="58" rx="20" ry="3.5" fill="#ffc65c" opacity=".7"/>
    <path d="M12 42 L38 22 L46 30 L20 50 Z" fill="url(#${k}-g)" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M38 22 L44 15 L50 21 L46 30 Z" fill="#8a5a18" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M24 52 Q21 58 24 60 Q27 58 24 52 Z" fill="#ffc65c" stroke="${OUT}" stroke-width="1.2"/>
    <path d="M42 52 Q39 58 42 60 Q45 58 42 52 Z" fill="#ffc65c" stroke="${OUT}" stroke-width="1.2"/>`,

  bouncer: (k) => `
    <path d="M7 54 Q15 22 24 46" fill="none" stroke="#f5ff6b" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round"/>
    <path d="M40 46 Q49 22 57 54" fill="none" stroke="#f5ff6b" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round"/>
    ${shadow(32, 56, 12)}
    ${orb(`${k}-o`, 32, 40, 11.5, '#fffde0', '#c9cf2e')}`,

  splitter: (k) => `
    ${orb(`${k}-o`, 32, 32, 15, '#e6fdff', '#2aa9d0')}
    <path d="M32 19 L28 30 L36 36 L30 46" fill="none" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>
    ${orb(`${k}-a`, 11, 12, 4.5, '#e6fdff', '#2aa9d0')}
    ${orb(`${k}-b`, 53, 12, 4.5, '#e6fdff', '#2aa9d0')}
    ${orb(`${k}-c`, 11, 52, 4.5, '#e6fdff', '#2aa9d0')}
    ${orb(`${k}-d`, 53, 52, 4.5, '#e6fdff', '#2aa9d0')}`,

  seeker: (k) => `
    <circle cx="32" cy="34" r="22" fill="none" stroke="#ff9f5a" stroke-width="2" stroke-dasharray="4 4"/>
    ${orb(`${k}-o`, 32, 34, 11, '#ffe6cf', '#e8743a')}
    <path d="M32 4 L38 13 L26 13 Z" fill="#ff9f5a" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>`,

  boomerang: (k) => `
    ${linear(`${k}-b`, '#c9fff3', '#2aa98a')}
    <path d="M10 46 Q12 12 46 14 Q54 15 56 24 Q40 18 36 32 Q32 46 10 46 Z" fill="url(#${k}-b)" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M18 38 Q20 24 34 20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>`,

  grenade: (k) => `
    ${radial(`${k}-b`, '#7a88a8', '#1d2638')}
    <path d="M32 17 Q38 9 46 11" fill="none" stroke="#c8a16a" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="30" cy="37" r="17" fill="url(#${k}-b)" stroke="${OUT}" stroke-width="2.5"/>
    <rect x="25" y="17" width="10" height="7" rx="2" fill="#2a3450" stroke="${OUT}" stroke-width="2"/>
    <ellipse cx="23" cy="30" rx="4" ry="6" fill="#fff" opacity=".22" transform="rotate(25 23 30)"/>
    <path d="M50 3 L52 8 L57 9 L52 10 L50 15 L48 10 L43 9 L48 8 Z" fill="#ffe27a" stroke="${OUT}" stroke-width="1"/>`,

  cluster: (k) => `
    ${radial(`${k}-b`, '#7a88a8', '#1d2638')}
    <path d="M32 36 L12 20 M32 36 L52 18 M32 36 L54 44 M32 36 L22 50" stroke="#ffb0a0" stroke-width="1.5" opacity=".6"/>
    <circle cx="32" cy="36" r="12" fill="url(#${k}-b)" stroke="${OUT}" stroke-width="2.5"/>
    <rect x="28" y="22" width="8" height="6" rx="2" fill="#2a3450" stroke="${OUT}" stroke-width="1.5"/>
    ${orb(`${k}-a`, 12, 20, 5.5, '#ffd0c0', '#ff7a7a')}
    ${orb(`${k}-b2`, 52, 18, 5.5, '#ffd0c0', '#ff7a7a')}
    ${orb(`${k}-c`, 54, 45, 5.5, '#ffd0c0', '#ff7a7a')}
    ${orb(`${k}-d`, 22, 51, 5.5, '#ffd0c0', '#ff7a7a')}`,

  well: (k) => `
    <circle cx="32" cy="32" r="12" fill="#b47aff" opacity=".22"/>
    <path d="M32 10 A22 22 0 1 1 10 32" fill="none" stroke="#b47aff" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M32 18 A14 14 0 1 0 46 32" fill="none" stroke="#d7c2ff" stroke-width="3" stroke-linecap="round"/>
    <path d="M32 26 A6 6 0 1 1 38 32" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".9"/>
    ${orb(`${k}-o`, 32, 32, 4.5, '#ffffff', '#b47aff')}`,

  bomb: (k) => `
    ${radial(`${k}-b`, '#ffe4bf', '#e0743a')}
    <ellipse cx="32" cy="56" rx="22" ry="5" fill="#ffb36b" stroke="${OUT}" stroke-width="1.5"/>
    <path d="M32 8 C40 20 46 28 46 38 A14 14 0 0 1 18 38 C18 28 24 20 32 8 Z" fill="url(#${k}-b)" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="26" cy="36" rx="3.5" ry="6" fill="#fff" opacity=".6" transform="rotate(20 26 36)"/>`,

  cannon: (k) => `
    ${radial(`${k}-b`, '#e9ddff', '#7b5ab8')}
    <g transform="rotate(-22 30 36)">
      <rect x="10" y="30" width="40" height="13" rx="5" fill="url(#${k}-b)" stroke="${OUT}" stroke-width="2.5"/>
      <rect x="44" y="27" width="8" height="19" rx="2" fill="#2e2440" stroke="${OUT}" stroke-width="2"/>
    </g>
    <circle cx="24" cy="52" r="7" fill="#2e2440" stroke="${OUT}" stroke-width="2.5"/>
    <circle cx="24" cy="52" r="2.5" fill="#c49bff"/>
    ${orb(`${k}-o`, 54, 13, 5, '#f3eaff', '#c49bff')}`,
};

/** The SVG for a weapon's icon. `k` keeps gradient ids unique when several icons share a page. */
export function weaponIconSvg(id: WeaponId, k: string = id): string {
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${ICONS[id](k)}</svg>`;
}
