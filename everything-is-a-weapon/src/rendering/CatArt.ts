import { INK } from '../core/constants';
import type { Game } from '../core/Game';
import { TAU } from '../core/math';
import { FRENZY_SECONDS, type Cat } from '../entities/Cat';
import { RAGE_SECONDS } from '../gameplay/Pickups';
import { TYPE_FONT, hash, type Ctx } from './draw';

/**
 * BISCUIT, drawn side-on like a sticker: a ginger loaf with a cream bib. The pose says
 * everything about what it is doing — trotting, sitting, flattened and shaking on top of the
 * fridge, stretched out at full gallop with its eyes lit up, or lost inside a cartoon
 * fight cloud on some mover's face.
 */

const FUR = '#f08a2c';
const FUR_DARK = '#c9621a';
const CREAM = '#fff0d0';
const NOSE = '#ff8fa3';
const EYE = '#b6f25a';

function inked(ctx: Ctx, fill: string, width = 2.6): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.stroke();
}

function tail(ctx: Ctx, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, width: number): void {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 3;
  ctx.stroke();
  ctx.strokeStyle = FUR;
  ctx.lineWidth = width;
  ctx.stroke();
  // darker tip
  ctx.beginPath();
  ctx.moveTo(x1 + (cx - x1) * 0.22, y1 + (cy - y1) * 0.22);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = FUR_DARK;
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function leg(ctx: Ctx, x: number, top: number, footX: number, footY: number): void {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(footX, footY);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.4;
  ctx.stroke();
  ctx.strokeStyle = FUR;
  ctx.lineWidth = 2.8;
  ctx.stroke();
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.arc(footX, footY, 1.5, 0, TAU);
  ctx.fill();
  ctx.lineCap = 'butt';
}

type Face = 'calm' | 'scared' | 'war' | 'smug';

function head(ctx: Ctx, x: number, y: number, face: Face, time: number, earsBack: number): void {
  // ears with tufts
  for (const side of [-1, 1]) {
    ctx.beginPath();
    const ex = x + side * 3.6 - earsBack * 2;
    const tipX = ex + side * (1.4 + earsBack * 4) - earsBack * 2;
    const tipY = y - 9.5 + earsBack * 5;
    ctx.moveTo(ex - 2.6, y - 3.6);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(ex + 2.6, y - 4);
    ctx.closePath();
    inked(ctx, FUR, 2.2);
    ctx.fillStyle = NOSE;
    ctx.beginPath();
    ctx.moveTo(ex - 1, y - 4.6);
    ctx.lineTo(tipX * 0.6 + ex * 0.4, tipY * 0.6 + (y - 4.6) * 0.4);
    ctx.lineTo(ex + 1.2, y - 4.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + side * 1.6, tipY - 2.6);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  ctx.beginPath();
  ctx.ellipse(x, y, 6.6, 5.8, 0, 0, TAU);
  inked(ctx, FUR);
  // teal collar with a brass bell
  ctx.strokeStyle = '#1e867c';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 5.4, y + 4.6);
  ctx.quadraticCurveTo(x, y + 7.4, x + 5.4, y + 4.6);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x + 1, y + 7.6, 1.7, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff3c0';
  ctx.beginPath();
  ctx.arc(x + 0.5, y + 7.1, 0.6, 0, TAU);
  ctx.fill();
  // forehead stripes
  ctx.strokeStyle = FUR_DARK;
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const dx of [-1.8, 0, 1.8]) {
    ctx.moveTo(x + dx, y - 5);
    ctx.lineTo(x + dx, y - 3);
  }
  ctx.stroke();
  // muzzle
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.ellipse(x + 1.6, y + 2.2, 3.8, 2.7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = NOSE;
  ctx.beginPath();
  ctx.moveTo(x + 0.6, y + 0.8);
  ctx.lineTo(x + 2.8, y + 0.8);
  ctx.lineTo(x + 1.7, y + 2.2);
  ctx.closePath();
  ctx.fill();

  // eyes
  const ey = y - 1.2;
  for (const dx of [-2.3, 3.5]) {
    const ex = x + dx;
    if (face === 'smug') {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(ex, ey + 0.6, 1.5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (face === 'scared') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex, ey, 2.7, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ex + Math.sin(time * 40 + dx) * 0.3, ey, 0.75, 0, TAU);
      ctx.fill();
    } else if (face === 'war') {
      ctx.fillStyle = '#fff27a';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 2.3, 1.9, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(ex + 0.4, ey, 0.55, 1.7, 0, 0, TAU);
      ctx.fill();
      // furious brow
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(ex - 2.6, ey - 3.4 + (dx < 0 ? 0 : 1.6));
      ctx.lineTo(ex + 2.6, ey - 3.4 + (dx < 0 ? 1.6 : 0));
      ctx.stroke();
    } else {
      const blink = (time + 1.3) % 4.1 < 0.12;
      if (blink) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(ex - 1.5, ey);
        ctx.lineTo(ex + 1.5, ey);
        ctx.stroke();
      } else {
        ctx.fillStyle = EYE;
        ctx.beginPath();
        ctx.ellipse(ex, ey, 1.9, 2.1, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(ex + 0.3, ey, 0.8, 1.7, 0, 0, TAU);
        ctx.fill();
      }
    }
  }

  // mouth
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  if (face === 'war' || face === 'scared') {
    ctx.fillStyle = face === 'war' ? '#7a1f2b' : INK;
    ctx.beginPath();
    ctx.ellipse(x + 1.7, y + 3.7, face === 'war' ? 2.2 : 1.3, face === 'war' ? 1.7 : 1.1, 0, 0, TAU);
    ctx.fill();
    if (face === 'war') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x + 0.3, y + 2.6);
      ctx.lineTo(x + 0.9, y + 4.4);
      ctx.lineTo(x + 1.5, y + 2.6);
      ctx.moveTo(x + 2, y + 2.6);
      ctx.lineTo(x + 2.6, y + 4.4);
      ctx.lineTo(x + 3.2, y + 2.6);
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(x + 0.2, y + 3.3);
    ctx.quadraticCurveTo(x + 1, y + 4.2, x + 1.7, y + 2.6);
    ctx.quadraticCurveTo(x + 2.4, y + 4.2, x + 3.2, y + 3.3);
    ctx.stroke();
  }
  // whiskers
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(x + 1.7 + s * 3.2, y + 2);
    ctx.lineTo(x + 1.7 + s * 8.5, y + 0.6);
    ctx.moveTo(x + 1.7 + s * 3.2, y + 3);
    ctx.lineTo(x + 1.7 + s * 8.5, y + 3.8);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function stripes(ctx: Ctx, x: number, y: number, rx: number): void {
  ctx.strokeStyle = FUR_DARK;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const t of [-0.45, -0.05, 0.35]) {
    ctx.moveTo(x + rx * t, y - 5.6);
    ctx.lineTo(x + rx * t - 0.8, y - 2.4);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** The classic: a ball of dust with bits of cat sticking out of it. */
function fightCloud(ctx: Ctx, time: number, seed: number): void {
  const spin = time * 9;
  // things poking out, behind the cloud
  for (let i = 0; i < 3; i++) {
    const a = spin * 0.6 + i * 2.1 + seed;
    const out = 15 + Math.sin(time * 17 + i * 2) * 5;
    const px = Math.cos(a) * out;
    const py = Math.sin(a) * out * 0.75;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px * 0.4, py * 0.4);
    ctx.lineTo(px, py);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = i === 0 ? FUR_DARK : FUR;
    ctx.lineWidth = 3.2;
    ctx.stroke();
    if (i > 0) {
      // claws out
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const k of [-0.5, 0, 0.5]) {
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a + k) * 4.5, py + Math.sin(a + k) * 3.6);
      }
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
  // the cloud itself
  const puffs = 8;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < puffs; i++) {
      const a = (i / puffs) * TAU + Math.sin(time * 5 + i) * 0.25;
      const r = 9 + Math.sin(time * 13 + i * 1.9) * 2.5;
      const cx = Math.cos(a) * r;
      const cy = Math.sin(a) * r * 0.72;
      const size = 7.5 + hash(i + seed) * 3 + Math.sin(time * 11 + i * 3) * 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, size + (pass === 0 ? 1.6 : 0), 0, TAU);
      ctx.fillStyle = pass === 0 ? INK : i % 2 === 0 ? '#f4ecdc' : '#e2d6bf';
      ctx.fill();
    }
  }
  ctx.fillStyle = '#f4ecdc';
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 8, 0, 0, TAU);
  ctx.fill();
  // one furious eye surfacing now and then, and the usual punctuation
  if (Math.floor(time * 5) % 3 === 0) {
    ctx.fillStyle = '#fff27a';
    ctx.beginPath();
    ctx.ellipse(-3, -1, 2.6, 2, 0, 0, TAU);
    ctx.ellipse(4, -1, 2.6, 2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(-3, -1, 0.6, 1.8, 0, 0, TAU);
    ctx.ellipse(4, -1, 0.6, 1.8, 0, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = -spin * 0.4 + i * 1.6;
    const r0 = 21 + (i % 2) * 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * 0.75);
    ctx.lineTo(Math.cos(a) * (r0 + 6), Math.sin(a) * (r0 + 6) * 0.75);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

export function drawCat(ctx: Ctx, cat: Cat, x: number, y: number, z: number, time: number): void {
  const state = cat.state;

  if (state === 'maul') {
    ctx.save();
    ctx.translate(x, y - z);
    fightCloud(ctx, time, cat.seed);
    ctx.restore();
    return;
  }

  // shadow on whatever it is standing on
  ctx.fillStyle = 'rgba(34, 27, 54, 0.22)';
  ctx.beginPath();
  ctx.ellipse(x + 1, y - Math.min(z, cat.z) + 2, 10, 4, 0, 0, TAU);
  ctx.fill();

  const scared = cat.fear > 0.5;
  const war = cat.frenzy > 0;
  const speed = Math.hypot(cat.vx, cat.vy);
  const running = speed > 40;
  const tremble = scared && !running ? Math.sin(time * 62) * 0.9 : 0;

  ctx.save();
  ctx.translate(x + tremble, y - z);
  ctx.scale(cat.facing, 1);
  ctx.lineJoin = 'round';

  if (war && running) {
    // afterimage: it is moving faster than a cat should
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ffb84d';
    ctx.beginPath();
    ctx.ellipse(-16, -8, 13, 5, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (cat.sitting && !running && !scared) {
    // ── sitting: an upright loaf with the tail wrapped round ──
    const lick = state === 'smug' && time % 1.2 < 0.6;
    const swish = Math.sin(time * 2.4 + cat.seed) * 3;
    tail(ctx, -5, -3, -13, -1 + swish * 0.4, -3 + swish, 0.5, 3.2);
    ctx.beginPath();
    ctx.ellipse(0, -8, 7.2, 8.4, 0, 0, TAU);
    inked(ctx, FUR);
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.ellipse(2.6, -6.4, 3.4, 5.2, 0, 0, TAU);
    ctx.fill();
    stripes(ctx, -2.5, -8, 6);
    leg(ctx, 2, -4, 3, 0);
    if (lick) leg(ctx, 5, -8, 7.5, -15.5);
    else leg(ctx, 5.4, -4, 6.2, 0);
    head(ctx, 3.4, -19 + (lick ? 1.2 : 0), state === 'smug' ? 'smug' : 'calm', time, 0);
  } else if (scared && !running) {
    // ── flattened, puffed up, shaking ──
    const puff = Math.sin(time * 30) * 0.6;
    tail(ctx, -9, -5, -15, -13, -11 + puff, -19, 6.4);
    ctx.beginPath();
    // spiky back
    ctx.moveTo(-11, -2);
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      ctx.lineTo(-11 + t * 20, -8.5 - Math.sin(t * Math.PI) * 2.4 - (i % 2 === 0 ? 2.6 : 0));
    }
    ctx.lineTo(10, -1.5);
    ctx.closePath();
    inked(ctx, FUR);
    stripes(ctx, -1, -5.5, 8);
    leg(ctx, -7, -2.5, -8.5, 0);
    leg(ctx, 6, -2.5, 8.5, 0);
    if (state === 'swipe') {
      leg(ctx, 8, -6, 17, -9);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      for (const k of [-4, 0, 4]) {
        ctx.beginPath();
        ctx.arc(14, -8 + k, 12, -0.7, 0.7);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    head(ctx, 9, -8.5, 'scared', time, 1);
    // sweat
    ctx.fillStyle = '#9fe3ff';
    for (let i = 0; i < 2; i++) {
      const t = (time * 1.8 + i * 0.5 + cat.seed) % 1;
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.arc(11 + i * 4 + t * 5, -16 - t * 9, 1.4, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    // ── on the move (or just standing) ──
    const gallop = war || scared;
    const stride = running ? Math.sin(cat.walkPhase) * (gallop ? 6.5 : 3.6) : 0;
    const bounce = running ? Math.abs(Math.cos(cat.walkPhase)) * (gallop ? 2.6 : 1.2) : 0;
    const by = -8 - bounce;
    const rx = gallop && running ? 12 : 10;
    if (scared) tail(ctx, -9, by, -17, by - 8, -14, by - 15, 6);
    else if (war) tail(ctx, -10, by, -18, by - 2, -22, by - 7 + Math.sin(time * 20) * 1.5, 3.2);
    else tail(ctx, -9, by - 1, -15, by - 10, -10 + Math.sin(time * 3 + cat.seed) * 2.5, by - 15, 3.2);
    leg(ctx, -6.5, by + 3, -7 - stride, 0);
    leg(ctx, 6, by + 3, 6.5 + stride, 0);
    ctx.beginPath();
    ctx.ellipse(0, by, rx, 6.4, 0, 0, TAU);
    inked(ctx, FUR);
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.ellipse(1, by + 3.6, rx * 0.62, 2.4, 0, 0, Math.PI);
    ctx.fill();
    stripes(ctx, 0, by, rx);
    leg(ctx, -4, by + 3.5, -4 + stride, 0);
    leg(ctx, 8, by + 3.5, 8.5 - stride, 0);
    head(ctx, rx - 0.5, by - 5.5 + (gallop && running ? 2.5 : 0), war ? 'war' : scared ? 'scared' : 'calm', time, scared ? 0.8 : war ? 0.35 : 0);
  }
  ctx.restore();
}

function tag(ctx: Ctx, text: string, x: number, y: number, fill: string, color: string, tilt: number): void {
  ctx.font = `700 11px ${TYPE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 12;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = 'rgba(34, 27, 54, 0.35)';
  ctx.fillRect(-w / 2 + 2, -8 + 3, w, 16);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -8);
  ctx.lineTo(w / 2 - 1.5, -8.5);
  ctx.lineTo(w / 2, 8);
  ctx.lineTo(-w / 2 + 2, 7.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0.5);
  ctx.restore();
}

/** A countdown ring on the floor: full circle at the start, gone when the time is up. */
function timerRing(ctx: Ctx, x: number, y: number, rx: number, left: number, color: string, time: number): void {
  const t = Math.max(0, Math.min(1, left));
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(34, 27, 54, 0.5)';
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, rx, rx * 0.66, 0, 0, TAU);
  ctx.stroke();
  // flashes in the last fifth
  if (t > 0.2 || Math.floor(time * 8) % 2 === 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, rx, rx * 0.66, 0, -Math.PI / 2, -Math.PI / 2 + TAU * t);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

/** Floor rings: drawn before the characters so they stand on top of them. */
export function drawPowerRings(ctx: Ctx, game: Game, px: number, py: number, cx: number, cy: number, time: number): void {
  if (game.state !== 'playing') return;
  const player = game.player;
  if (player.rage > 0 && player.alive) timerRing(ctx, px, py, 31, player.rage / RAGE_SECONDS, '#ff5a4e', time);
  const pet = game.pet;
  if (pet && pet.frenzy > 0 && !pet.riding && pet.species !== 'parrot') timerRing(ctx, cx, cy - pet.z, 15, pet.frenzy / FRENZY_SECONDS, '#ffb84d', time);
}

/** Over the characters: the anger vein, and how many seconds of each power-up are left. */
export function drawPowerTags(ctx: Ctx, game: Game, px: number, py: number, cx: number, cy: number, time: number): void {
  if (game.state !== 'playing') return;
  const player = game.player;
  if (player.rage > 0 && player.alive) {
    // the cross-shaped vein that means "furious"
    const pulse = 1 + Math.sin(time * 16) * 0.16;
    ctx.save();
    ctx.translate(px + 15, py - 56);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    for (const [width, color] of [[5, INK], [2.4, '#ff3b2f']] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        const c = Math.cos(a);
        const s = Math.sin(a);
        ctx.moveTo(c * 1.6 - s * 4.5, s * 1.6 + c * 4.5);
        ctx.quadraticCurveTo(c * 3, s * 3, c * 1.6 + s * 4.5, s * 1.6 - c * 4.5);
      }
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.restore();
    tag(ctx, `RAGE ${Math.ceil(player.rage)}`, px, py - 74, '#ff5a4e', '#ffffff', -0.05);
  }
  if (player.armor > 0 && player.alive) {
    // wrapped: a sheet of bubbles round the gown, one row per hit left
    ctx.strokeStyle = 'rgba(34, 27, 54, 0.45)';
    ctx.fillStyle = 'rgba(217, 241, 251, 0.75)';
    ctx.lineWidth = 0.8;
    for (let row = 0; row < player.armor; row++) {
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.08 + (i / 6) * 0.84);
        const bx = px + Math.cos(a) * 15;
        const by = py - 9 - row * 7 + Math.sin(a) * 5 + Math.sin(time * 3 + i) * 0.4;
        ctx.beginPath();
        ctx.arc(bx, by, 2.9, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  const pet = game.pet;
  if (pet && pet.frenzy > 0) tag(ctx, `${pet.treatLabel} ${Math.ceil(pet.frenzy)}`, cx, cy - pet.z - (pet.species === 'hamster' ? 52 : 34), '#ffb84d', INK, 0.05);
}

/** Screen-space: the edges of the world go red while the pepper lasts. */
export function drawRageVignette(ctx: Ctx, game: Game, w: number, h: number, time: number): void {
  const player = game.player;
  if (player.rage <= 0 || !player.alive || game.state !== 'playing') return;
  const fade = Math.min(1, player.rage / 1.5);
  const alpha = (0.2 + 0.07 * Math.sin(time * 9)) * fade;
  const edge = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.72);
  edge.addColorStop(0, 'rgba(255, 59, 47, 0)');
  edge.addColorStop(1, `rgba(255, 59, 47, ${alpha.toFixed(3)})`);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
}
