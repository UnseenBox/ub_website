import type { FortressItemId } from '../game/fortressItems';

const OUT = '#1d2638';

/** 64x64 SVG art for each fortress piece, used in the shop and the build tray. */
const ART: Record<FortressItemId, string> = {
  brick: `
    <rect x="6" y="20" width="52" height="26" rx="4" fill="#e07a52" stroke="${OUT}" stroke-width="2.5"/>
    <path d="M6 33 H58 M24 20 V33 M42 33 V46" stroke="#a34a2a" stroke-width="2.4"/>
    <rect x="10" y="23" width="12" height="3" rx="1.5" fill="#ffb08f"/>
    <rect x="28" y="23" width="12" height="3" rx="1.5" fill="#ffb08f"/>`,
  metal: `
    <rect x="25" y="6" width="14" height="52" rx="2" fill="#a9b8c8" stroke="${OUT}" stroke-width="2.5"/>
    <path d="M27 12 L37 8" stroke="#eef4fb" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="32" cy="14" r="2" fill="${OUT}"/><circle cx="32" cy="50" r="2" fill="${OUT}"/>
    <path d="M28 30 L36 26 M28 40 L36 36" stroke="#d6e1ec" stroke-width="2" stroke-linecap="round"/>`,
  spikes: `
    <rect x="6" y="40" width="52" height="12" rx="3" fill="#5a6b8a" stroke="${OUT}" stroke-width="2.5"/>
    <path d="M8 40 L14 18 L20 40 M20 40 L26 14 L32 40 M32 40 L38 18 L44 40 M44 40 L50 14 L56 40" fill="#dfe6ef" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M14 22 L15 30 M26 18 L27 28 M50 18 L51 28" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>`,
  jelly: `
    <path d="M8 46 Q8 24 32 22 Q56 24 56 46 Z" fill="#ff7ad9" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="22" cy="32" rx="7" ry="4" fill="#ffd1f0" opacity=".9"/>
    <circle cx="40" cy="36" r="3" fill="#ffd1f0" opacity=".7"/><circle cx="46" cy="30" r="2" fill="#ffd1f0" opacity=".7"/>
    <path d="M14 14 Q32 4 50 14" fill="none" stroke="#ff7ad9" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="3 4"/>`,
  telescope: `
    <path d="M30 34 L18 58 M34 34 L46 58 M32 34 L32 58" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>
    <g transform="rotate(-28 32 28)">
      <rect x="12" y="22" width="40" height="12" rx="4" fill="#7a6cff" stroke="${OUT}" stroke-width="2.5"/>
      <rect x="46" y="20" width="10" height="16" rx="3" fill="#b7aeff" stroke="${OUT}" stroke-width="2.5"/>
      <rect x="18" y="24" width="14" height="3" rx="1.5" fill="#c9c2ff"/>
    </g>
    <circle cx="53" cy="10" r="3" fill="#ffffff"/>`,
  duck: `
    <ellipse cx="30" cy="42" rx="22" ry="14" fill="#ffd23f" stroke="${OUT}" stroke-width="2.5"/>
    <circle cx="40" cy="22" r="11" fill="#ffd23f" stroke="${OUT}" stroke-width="2.5"/>
    <path d="M49 22 Q58 22 56 27 Q52 29 48 26" fill="#ff8a3d" stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="42" cy="19" r="2.4" fill="${OUT}"/><circle cx="43" cy="18" r=".8" fill="#ffffff"/>
    <path d="M14 38 Q24 32 34 40" fill="none" stroke="#e0a800" stroke-width="2.4" stroke-linecap="round"/>`,
  cannon: `
    <g transform="rotate(-30 30 34)">
      <rect x="22" y="26" width="34" height="14" rx="6" fill="#5a6b8a" stroke="${OUT}" stroke-width="2.5"/>
      <rect x="50" y="24" width="7" height="18" rx="3" fill="#3d4a63" stroke="${OUT}" stroke-width="2.5"/>
    </g>
    <circle cx="26" cy="44" r="12" fill="#8a5a2b" stroke="${OUT}" stroke-width="2.5"/>
    <circle cx="26" cy="44" r="4" fill="#5a3a1a"/>
    <circle cx="54" cy="12" r="5" fill="#ffd23f" stroke="${OUT}" stroke-width="2"/>`,
};

export function fortressIconSvg(id: FortressItemId): string {
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${ART[id]}</svg>`;
}
