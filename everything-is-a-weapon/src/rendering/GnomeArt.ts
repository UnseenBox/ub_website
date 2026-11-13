import { INK } from '../core/constants';
import { TAU } from '../core/math';
import type { Enemy } from '../entities/Enemy';
import type { EnemyTypeId } from '../entities/EnemyTypes';
import { hash, type Ctx } from './draw';

/**
 * THE GNOME ARMY. The garden gnomes have come in from the lawn and they want the house.
 * Every regular intruder is a gnome: a cone hat, a beard, a red nose, a coat and a belt.
 * What each type does shows in its hat, its colours and what it carries:
 *
 *   Gnome      blue coat, red hat: the rank and file
 *   Sprinter   green tracksuit, blue hat swept back, a scarf streaming behind
 *   Big Gnome  a barrel of a gnome in a brown coat, green hat, beard to the knees
 *   Pan Head   wears your saucepan for a helmet (until you knock it off)
 *   Bailiff    hides behind a KEEP OUT sign
 *   Sparky     yellow hat with a lightning bolt and a live bulb on the tip
 *   Porcelain  a china gnome with a blue glaze: breaks into glass
 *   Matryoshka a fat gnome with a small gnome in its pocket (it splits in two)
 *   Kaboom     black bomb hat, a lit fuse on the tip
 *   Trolley    pushes a sack truck and charges
 *   Gnat       a tiny gnome in a propeller beanie
 *   Chucker    a gnome with a throwing arm and a rock
 *   Bulwark    a steel pot on its head and a steel plate in front
 */

export type Tone = (color: string) => string;

interface Palette {
  readonly coat: string;
  readonly coatShade: string;
  readonly hat: string;
  readonly hatShade: string;
  readonly boots: string;
  readonly beard: string;
  readonly skin: string;
}

const SKIN = '#f6c6a0';
const BEARD = '#f4f1ea';

const PALETTES: Partial<Record<EnemyTypeId, Palette>> = {
  basic: { coat: '#3f7fd1', coatShade: '#2c5c9e', hat: '#e2403a', hatShade: '#a82a25', boots: '#5a3a22', beard: BEARD, skin: SKIN },
  mini: { coat: '#3f7fd1', coatShade: '#2c5c9e', hat: '#ff6a4d', hatShade: '#c4442d', boots: '#5a3a22', beard: BEARD, skin: SKIN },
  fast: { coat: '#3fae5a', coatShade: '#2a7f40', hat: '#2f6fe0', hatShade: '#1f4ea8', boots: '#e8483d', beard: BEARD, skin: SKIN },
  heavy: { coat: '#8a5a34', coatShade: '#5f3c20', hat: '#2e8f4e', hatShade: '#1d6436', boots: '#3b2614', beard: '#ece6d8', skin: '#efb88f' },
  helmet: { coat: '#c96f2b', coatShade: '#94501c', hat: '#7d4fc4', hatShade: '#5a3592', boots: '#5a3a22', beard: BEARD, skin: SKIN },
  shield: { coat: '#5e7a3a', coatShade: '#425728', hat: '#d9a520', hatShade: '#a57a10', boots: '#3b2614', beard: BEARD, skin: SKIN },
  electric: { coat: '#3a3a4a', coatShade: '#25252f', hat: '#ffd23f', hatShade: '#d4a514', boots: '#25252f', beard: BEARD, skin: SKIN },
  fragile: { coat: '#eef4f8', coatShade: '#bccbd8', hat: '#7fb2e0', hatShade: '#4f86bd', boots: '#7fb2e0', beard: '#ffffff', skin: '#fbe3d2' },
  nested: { coat: '#b04ec4', coatShade: '#7d3490', hat: '#ffcf3f', hatShade: '#d39d18', boots: '#5a3a22', beard: BEARD, skin: SKIN },
  kaboom: { coat: '#d13b2f', coatShade: '#962a21', hat: '#2b2b33', hatShade: '#16161c', boots: '#2b2b33', beard: BEARD, skin: SKIN },
  trolley: { coat: '#e07b2a', coatShade: '#a7581b', hat: '#2a8fa0', hatShade: '#1c6774', boots: '#3b2614', beard: BEARD, skin: SKIN },
  gnat: { coat: '#e0c93a', coatShade: '#a8951e', hat: '#e2403a', hatShade: '#a82a25', boots: '#25252f', beard: BEARD, skin: SKIN },
  hurler: { coat: '#7d4f9c', coatShade: '#5a3672', hat: '#3f9e6e', hatShade: '#2a7550', boots: '#3b2614', beard: BEARD, skin: SKIN },
  bulwark: { coat: '#4a5568', coatShade: '#323a48', hat: '#2b3340', hatShade: '#1a2029', boots: '#1a2029', beard: '#dcd8cc', skin: '#eab48c' },
};

export function gnomePalette(id: EnemyTypeId): Palette {
  return PALETTES[id] ?? PALETTES.basic!;
}

export function isGnome(id: EnemyTypeId): boolean {
  return PALETTES[id] !== undefined;
}

export interface GnomeFrame {
  readonly x: number;
  readonly y: number;
  readonly hw: number;
  readonly hd: number;
  readonly h: number;
  readonly fx: number;
  readonly fy: number;
  readonly hop: number;
  readonly lift: number;
  readonly windup: number;
  readonly time: number;
  readonly tone: Tone;
  readonly shockFrame: boolean;
}

/** Where the drawn gnome put its face and the tip of its hat, for the props drawn on top. */
export interface GnomeLayout {
  readonly faceTop: number;
  readonly faceBottom: number;
  readonly cx: number;
  readonly topY: number;
  readonly armY: number;
}

/** Draws one gnome (feet are drawn by the caller). */
export function drawGnome(ctx: Ctx, e: Enemy, f: GnomeFrame): GnomeLayout {
  const id = e.type.id;
  const pal = gnomePalette(id);
  const { x, y, hw, hd, h, fx, fy, hop, lift, windup, time, tone } = f;
  const away = fy < -0.6 && !e.defeated;
  const dead = e.defeated;
  const heavy = id === 'heavy' || id === 'nested' || id === 'bulwark';
  const flying = id === 'gnat';
  const bob = flying && !dead ? Math.sin(time * 9 + e.seed) * 2.5 - 3 : 0;

  // ── proportions, all from the collider so every type stays in its footprint ──
  const coatBottom = y + hd - lift + 2 + bob;
  const coatH = h * 0.66;
  const shoulders = coatBottom - coatH;
  const r = hw * (heavy ? 0.6 : 0.62);
  const headCy = shoulders - r * 0.2 - hop * 0.2;
  const brimY = headCy - r * 0.62;
  const hatH = h * (heavy ? 0.82 : 0.95) * (id === 'fast' ? 0.9 : 1);
  const lookX = away ? 0 : fx;
  const cx = x + lookX * hw * 0.22;

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // ── trolley: the gnome pushes; the truck itself is drawn by the caller ──

  // ── coat: a bell of cloth, wider at the hem ──
  const hemW = hw * (heavy ? 1.12 : 1.02);
  const shoulderW = hw * (heavy ? 0.86 : 0.72);
  ctx.fillStyle = tone(pal.coat);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  // Traced again for the fill, the clip and the outline (no Path2D: it is missing in some hosts).
  const coat = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - hemW, coatBottom);
    ctx.quadraticCurveTo(x - hemW - 1, shoulders + coatH * 0.35, x - shoulderW, shoulders + 2);
    ctx.quadraticCurveTo(x, shoulders - 5, x + shoulderW, shoulders + 2);
    ctx.quadraticCurveTo(x + hemW + 1, shoulders + coatH * 0.35, x + hemW, coatBottom);
    ctx.quadraticCurveTo(x, coatBottom + 4, x - hemW, coatBottom);
    ctx.closePath();
  };
  coat();
  ctx.fill();
  // shade on the far side, light from the upper left
  ctx.save();
  coat();
  ctx.clip();
  ctx.fillStyle = tone(pal.coatShade);
  ctx.beginPath();
  ctx.ellipse(x + hemW * 0.95, coatBottom - coatH * 0.4, hemW * 0.55, coatH, 0, 0, TAU);
  ctx.fill();
  if (id === 'fragile') {
    // blue glaze flowers on the china
    ctx.fillStyle = tone('#4f86bd');
    for (let i = 0; i < 5; i++) {
      const px = x + (hash(e.seed + i) - 0.5) * hemW * 1.5;
      const py = shoulders + 4 + hash(e.seed + i * 3) * coatH * 0.7;
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, TAU);
      ctx.fill();
    }
  } else if (id === 'nested') {
    ctx.fillStyle = tone('#ffcf3f');
    for (let i = 0; i < 6; i++) {
      const px = x + (hash(e.seed + i * 5) - 0.5) * hemW * 1.6;
      const py = shoulders + 5 + hash(e.seed + i * 7) * coatH * 0.75;
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, TAU);
      ctx.fill();
    }
  } else if (id === 'fast') {
    // tracksuit stripes
    ctx.strokeStyle = tone('#ffffff');
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * shoulderW * 0.7, shoulders + 4);
      ctx.lineTo(x + side * hemW * 0.78, coatBottom);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  coat();
  ctx.stroke();

  // ── belt and buckle ──
  const beltY = coatBottom - coatH * 0.4;
  ctx.fillStyle = tone('#3b2614');
  ctx.beginPath();
  ctx.moveTo(x - hemW * 0.93, beltY - 2.4);
  ctx.quadraticCurveTo(x, beltY + 1, x + hemW * 0.93, beltY - 2.4);
  ctx.lineTo(x + hemW * 0.95, beltY + 2.4);
  ctx.quadraticCurveTo(x, beltY + 5.5, x - hemW * 0.95, beltY + 2.4);
  ctx.closePath();
  ctx.fill();
  if (!away) {
    const bx = x + lookX * hw * 0.28;
    ctx.fillStyle = tone(id === 'kaboom' ? '#ffd23f' : '#f3c73a');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.rect(bx - 3.2, beltY - 2.2, 6.4, 5.2);
    ctx.fill();
    ctx.stroke();
  }

  // ── a pocket with a passenger (Matryoshka) ──
  if (id === 'nested' && !away && !dead) {
    const px = x - lookX * hw * 0.35 - hw * 0.25;
    const py = beltY + 5;
    ctx.fillStyle = tone(pal.coatShade);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.rect(px - 5, py, 10, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone('#e2403a');
    ctx.beginPath();
    ctx.moveTo(px - 4, py + 1);
    ctx.lineTo(px, py - 8 + Math.sin(time * 6) * 1.2);
    ctx.lineTo(px + 4, py + 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // ── face: skin under the hat brim, eyes, then the beard and the nose over it ──
  if (!away) {
    ctx.fillStyle = tone(pal.skin);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(cx, headCy, r, r * 0.86, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // the beard: a cloud from the cheeks down over the chest
    const beardTop = headCy + r * 0.05;
    const beardBottom = Math.min(beltY + 3, shoulders + coatH * (heavy ? 0.75 : 0.58));
    const bw = r * (heavy ? 1.25 : 1.1);
    ctx.fillStyle = tone(pal.beard);
    ctx.beginPath();
    ctx.moveTo(cx - bw, beardTop);
    ctx.quadraticCurveTo(cx - bw * 1.1, (beardTop + beardBottom) / 2, cx - bw * 0.55, beardBottom - 2);
    ctx.quadraticCurveTo(cx - bw * 0.3, beardBottom + 3, cx, beardBottom + 2);
    ctx.quadraticCurveTo(cx + bw * 0.3, beardBottom + 3, cx + bw * 0.55, beardBottom - 2);
    ctx.quadraticCurveTo(cx + bw * 1.1, (beardTop + beardBottom) / 2, cx + bw, beardTop);
    ctx.quadraticCurveTo(cx, beardTop + r * 0.5, cx - bw, beardTop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // curls in the beard
    ctx.strokeStyle = tone('#cfc8b8');
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      const lx = cx + i * bw * 0.42;
      ctx.moveTo(lx - 1.5, beardTop + (beardBottom - beardTop) * 0.45);
      ctx.quadraticCurveTo(lx + 1.5, beardTop + (beardBottom - beardTop) * 0.6, lx - 0.5, beardTop + (beardBottom - beardTop) * 0.78);
    }
    ctx.stroke();

    // a shout before a lunge: the beard opens
    if (windup > 0.2 && !dead) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(cx, beardTop + r * 0.42, 2.6 + windup * 2, 1.8 + windup * 2.6, 0, 0, TAU);
      ctx.fill();
    }

    // eyes and cross brows
    const eyeY = headCy - r * 0.12;
    const gap = r * 0.42;
    for (const side of [-1, 1]) {
      const ex = cx + side * gap + fx * 1.2;
      if (dead) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(ex - 2, eyeY - 2);
        ctx.lineTo(ex + 2, eyeY + 2);
        ctx.moveTo(ex + 2, eyeY - 2);
        ctx.lineTo(ex - 2, eyeY + 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(ex, eyeY + fy * 0.6, 1.7, 2.3, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 0.6, eyeY - 0.8, 0.6, 0, TAU);
        ctx.fill();
        // brows slant in: they are cross about everything
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(ex - side * 3, eyeY - 4.2 - windup * 1.5);
        ctx.lineTo(ex + side * 1.6, eyeY - 2.6);
        ctx.stroke();
      }
    }

    // the nose: big, round and red
    const noseX = cx + fx * r * 0.18;
    const noseY = headCy + r * 0.22;
    ctx.fillStyle = tone(id === 'fragile' ? '#f2a0a6' : '#f0786e');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(noseX, noseY, r * 0.34, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(noseX - r * 0.12, noseY - r * 0.12, r * 0.1, 0, TAU);
    ctx.fill();
  } else {
    // from behind: the back of the head and the beard poking out either side
    ctx.fillStyle = tone(pal.beard);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + side * r * 0.95, headCy + r * 0.45, r * 0.32, r * 0.5, side * 0.3, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = tone(pal.skin);
    ctx.beginPath();
    ctx.ellipse(x, headCy, r * 0.95, r * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  // ── crack lines on the china one, the harder it has been hit ──
  if (id === 'fragile' && !dead) {
    const hurt = 1 - Math.max(0, e.hp) / e.maxHp;
    if (hurt > 0.2) {
      ctx.strokeStyle = 'rgba(36, 26, 20, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.4, shoulders + 3);
      ctx.lineTo(x - hw * 0.15, shoulders + coatH * 0.3);
      ctx.lineTo(x - hw * 0.35, shoulders + coatH * 0.55);
      if (hurt > 0.5) {
        ctx.moveTo(x + hw * 0.3, shoulders + coatH * 0.2);
        ctx.lineTo(x + hw * 0.12, shoulders + coatH * 0.45);
        ctx.lineTo(x + hw * 0.38, shoulders + coatH * 0.7);
      }
      ctx.stroke();
    }
  }

  // ── the hat ──
  const sway = dead ? 0 : Math.sin(e.walkPhase) * 1.6;
  const sweep = id === 'fast' ? 2.2 : 1;
  const lean = -fx * 5 * sweep + sway + windup * 3 * (fx >= 0 ? -1 : 1);
  const hatW = r * 1.18;
  let topY = brimY - hatH;
  const helmeted = e.helmetHp > 0 && !dead;

  if (flying) {
    // a beanie with a propeller instead of a cone
    ctx.fillStyle = tone(pal.hat);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(x, brimY + 1, hatW, r * 0.75, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const capTop = brimY - r * 0.75;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, capTop);
    ctx.lineTo(x, capTop - 4);
    ctx.stroke();
    const spin = dead ? 0.3 : Math.abs(Math.cos(time * 40));
    ctx.fillStyle = tone('#4ad6e8');
    ctx.beginPath();
    ctx.ellipse(x, capTop - 5, 8 * spin + 1, 2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    topY = capTop - 8;
  } else if (helmeted) {
    // the looted pan (or, on a Bulwark, a stock pot) jammed on over the hat
    const pot = id === 'bulwark';
    const panY = brimY - (pot ? 7 : 3);
    ctx.fillStyle = tone(pot ? '#8b97a8' : '#5d6675');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    if (pot) {
      ctx.rect(x - hatW - 2, panY - 12, (hatW + 2) * 2, 14);
    } else {
      ctx.ellipse(x, panY, hatW + 3, r * 0.9, 0, Math.PI, TAU);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone(pot ? '#c3cbda' : '#8a93a3');
    ctx.beginPath();
    ctx.ellipse(x, pot ? panY - 12 : panY - r * 0.9 + 1, hatW + (pot ? 2 : 0), 2.6, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // the handle
    const side = fx >= 0 ? -1 : 1;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x + side * (hatW + 2), panY - 3);
    ctx.lineTo(x + side * (hatW + 12), panY - 7);
    ctx.stroke();
    ctx.strokeStyle = tone('#2b2b33');
    ctx.lineWidth = 2.6;
    ctx.stroke();
    // a dent for each knock it has taken
    const max = e.type.helmetHp ?? 1;
    if (e.helmetHp < max * 0.6) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x - 3, panY - 6, 3, 0.2, 2.4);
      ctx.stroke();
    }
    topY = panY - (pot ? 16 : r * 0.9 + 4);
  } else {
    // the cone: brim, body, a soft fold near the tip
    const tipX = x + lean;
    const tipY = brimY - hatH;
    const midX = x + lean * 0.45;
    ctx.fillStyle = tone(pal.hat);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    const cone = (): void => {
      ctx.beginPath();
      ctx.moveTo(x - hatW, brimY + 1.5);
      ctx.quadraticCurveTo(midX - hatW * 0.45, brimY - hatH * 0.55, tipX, tipY);
      ctx.quadraticCurveTo(midX + hatW * 0.55, brimY - hatH * 0.5, x + hatW, brimY + 1.5);
      ctx.quadraticCurveTo(x, brimY + 4.5, x - hatW, brimY + 1.5);
      ctx.closePath();
    };
    cone();
    ctx.fill();
    ctx.save();
    cone();
    ctx.clip();
    ctx.fillStyle = tone(pal.hatShade);
    ctx.beginPath();
    ctx.ellipse(x + hatW * 0.9, brimY - hatH * 0.3, hatW * 0.6, hatH * 0.8, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x - hatW * 0.45, brimY - hatH * 0.32, hatW * 0.18, hatH * 0.28, -0.15, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    cone();
    ctx.stroke();
    // the brim: a roll of felt
    ctx.fillStyle = tone(pal.hatShade);
    ctx.beginPath();
    ctx.ellipse(x, brimY + 1.5, hatW + 1.2, 2.8, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    topY = tipY;

    if (id === 'electric') {
      // a lightning bolt on the felt and a bulb on the tip that is very much on
      ctx.fillStyle = tone('#26252f');
      ctx.beginPath();
      const bx = x + lean * 0.35;
      const by = brimY - hatH * 0.42;
      ctx.moveTo(bx + 1, by - 6);
      ctx.lineTo(bx - 3, by + 1);
      ctx.lineTo(bx, by + 1);
      ctx.lineTo(bx - 1.5, by + 6);
      ctx.lineTo(bx + 3, by - 1);
      ctx.lineTo(bx, by - 1);
      ctx.closePath();
      ctx.fill();
      const glow = 0.6 + 0.4 * Math.sin(time * 18 + e.seed);
      ctx.fillStyle = `rgba(255, 242, 122, ${(0.35 * glow).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(tipX, tipY - 2, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = tone('#fff27a');
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(tipX, tipY - 2, 3.2, 0, TAU);
      ctx.fill();
      ctx.stroke();
      topY = tipY - 6;
    } else if (id === 'kaboom' && !dead) {
      // a fuse out of the tip, lit
      ctx.strokeStyle = tone('#c9a070');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.quadraticCurveTo(tipX + 4, tipY - 4, tipX + 2, tipY - 8);
      ctx.stroke();
      const flick = hash(Math.floor(time * 20) + e.seed);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(tipX + 2, tipY - 9, 2.6 + flick * 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ff6a2a';
      ctx.beginPath();
      ctx.arc(tipX + 2, tipY - 9, 1.4 + flick, 0, TAU);
      ctx.fill();
      // and the stripe that says what it is
      ctx.strokeStyle = tone('#ffd23f');
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x - hatW * 0.72, brimY - hatH * 0.18);
      ctx.quadraticCurveTo(x + lean * 0.2, brimY - hatH * 0.24, x + hatW * 0.72, brimY - hatH * 0.18);
      ctx.stroke();
      topY = tipY - 12;
    } else if (id === 'trolley' || id === 'hurler' || id === 'shield') {
      // a bobble on the tip
      ctx.fillStyle = tone('#fff4dc');
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 2.6, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  }

  // ── the Sprinter's scarf, streaming behind ──
  if (id === 'fast' && !dead) {
    const sx = x - fx * 4;
    const sy = shoulders + 2;
    const flap = Math.sin(time * 16 + e.seed) * 2.5;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx - fx * 12, sy - 2 + flap, sx - fx * 22, sy + flap * 1.6);
    ctx.stroke();
    ctx.strokeStyle = tone('#ffd23f');
    ctx.lineWidth = 3.4;
    ctx.stroke();
  }

  // ── a shock shows the gnome's wiring: it was never really clay ──
  if (f.shockFrame) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const sy = shoulders + 3 + i * (coatH / 3.5);
      ctx.moveTo(x - hemW * 0.6, sy);
      ctx.lineTo(x - hemW * 0.2, sy + 3);
      ctx.lineTo(x + hemW * 0.2, sy - 2);
      ctx.lineTo(x + hemW * 0.6, sy + 2);
    }
    ctx.stroke();
  }

  ctx.lineCap = 'butt';
  return {
    faceTop: brimY,
    faceBottom: coatBottom,
    cx,
    topY: Math.min(topY, brimY - 10),
    armY: shoulders + coatH * 0.32,
  };
}
