// src/interior_look.js
// Interior look for the enterable building interior (task 6b): a warehouse proof of concept.
// ES module, no dependencies, canvas 2D paths only (no images).
//
// View convention (documented so the integration step can build `view` from the game camera):
//   view = { camX, camY, scale, width, height }      // scale = pixels per metre
//   world metres -> screen pixels:
//     sx = (x - camX) * scale + width / 2
//     sy = height / 2 + camY * scale - scale * y     (y points up, screen y flipped)
//   This matches Renderer.camera.apply in src/game.js (setTransform scale, 0, 0, -scale, ...).
//
// Exports: INTERIOR_LOOK (palette), drawInterior(ctx, def, view, time, opts),
// drawInteriorFade(ctx, width, height, t).

const TAU = Math.PI * 2;

const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);

const CRATE_TINTS = [`#5a4f72`, `#62557c`, `#53476b`];
function crateTint(i) {
  return CRATE_TINTS[(i % CRATE_TINTS.length + CRATE_TINTS.length) % CRATE_TINTS.length];
}

// Dark purple-grey alien-colony warehouse, warm lamp glow, hazard-stripe door frame
// matching the purple colony buildings outside (TERRAIN_LOOK hazardA/hazardB).
const INTERIOR_LOOK = {
  ink: `#0d0a1c`,
  wall: `#4b3f72`,
  wallLight: `#6d5ca6`,
  wallDark: `#2a2147`,
  ceiling: `#231e33`,
  floor: `#3a3450`,
  floorEdge: `#524a6e`,
  beam: `#2d263e`,
  beamLight: `#4a4062`,
  pipe: `#161024`,
  rivet: `#6e628c`,
  glass: `#1a2442`,
  glassOff: `#3b3354`,
  glow: `#ffd23f`,
  glowDim: `#e8b84d`,
  coin: `#b8e62e`,
  coinEdge: `#7aa510`,
  crateLine: `#2a2147`,
  barrel: `#4a3e5c`,
  barrelBand: `#6e628c`,
  exit: `#ffd23f`,
  hazardA: `#ffcc33`,
  hazardB: `#1b2036`,
  steel: `#5a5a6e`,
  steelEdge: `#8a8aa8`,
  shelf: `#3d3450`,
  shelfItem: `#ffd23f`,
  lamp: `#fff3b0`,
  lampGlow: `rgba(255, 243, 176, 0.35)`,
  lampCord: `#4a4062`,
};

export { INTERIOR_LOOK };

export function drawInterior(ctx, def, view, time, opts = {}) {
  if (!ctx || typeof ctx !== `object` || !view) return;
  const W = fin(view.width, 800);
  const H = fin(view.height, 600);
  const scale = fin(view.scale, 30);
  if (!Number.isFinite(scale) || scale <= 0) return;
  const camX = fin(view.camX, 0);
  const camY = fin(view.camY, 0);
  const t = fin(time, 0);
  const alpha = fin(opts.alpha, 1);
  const d = def || {};
  const w = fin(d.w, 24);
  const h = fin(d.h, 7);
  const wallT = fin(d.wallT, 0.4);
  const door = typeof d.door === `object` && d.door ? d.door : {};
  const dx = fin(door.x, w * 0.5);
  const dw = fin(door.w, 1.6);
  const dh = fin(door.h, 2.6);
  const platforms = Array.isArray(d.platforms) ? d.platforms : [];
  const props = Array.isArray(d.props) ? d.props : [];
  const loot = Array.isArray(d.loot) ? d.loot : [];
  const collected = Array.isArray(opts.collected) ? opts.collected : [];

  const hw = W / (2 * scale);
  const hh = H / (2 * scale);
  const vx0 = camX - hw - 1;
  const vx1 = camX + hw + 1;
  const vy0 = camY - hh - 1;
  const vy1 = camY + hh + 1;
  const visible = (x, y, ww, hh_) => x + ww >= vx0 && x <= vx1 && y + hh_ >= vy0 && y <= vy1;

  ctx.save();
  ctx.transform(scale, 0, 0, -scale, W / 2 - camX * scale, H / 2 + camY * scale);
  ctx.globalAlpha = alpha;
  ctx.lineJoin = `round`;
  ctx.lineCap = `round`;
  const L = INTERIOR_LOOK;

  // ---- back wall: panels, rivets, pipes, vents, dim windows
  if (visible(0, 0, w, h)) {
    ctx.fillStyle = L.wall;
    ctx.fillRect(0, 0, w, h);
    const panelW = 2;
    for (let x = 0; x < w; x += panelW) {
      const pw_ = Math.min(panelW, w - x);
      if (!visible(x, 0, pw_, h)) continue;
      ctx.save();
      ctx.fillStyle = crateTint(Math.floor(x / panelW));
      ctx.fillRect(x + 0.06, 0.06, pw_ - 0.12, h - 0.12);
      ctx.fillStyle = L.rivet;
      ctx.beginPath();
      ctx.arc(x + 0.12, 0.12, 0.05, 0, TAU);
      ctx.arc(x + pw_ - 0.12, 0.12, 0.05, 0, TAU);
      ctx.arc(x + 0.12, h - 0.12, 0.05, 0, TAU);
      ctx.arc(x + pw_ - 0.12, h - 0.12, 0.05, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = L.pipe;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const py = h * (0.22 + i * 0.17);
      ctx.moveTo(0.6, py);
      ctx.lineTo(w - 0.6, py);
    }
    ctx.moveTo(w * 0.5, 0.4);
    ctx.lineTo(w * 0.5, h - 0.4);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const vx = w * (0.25 + i * 0.25);
      const vy = h - 1.4;
      const vw = 0.9;
      const vh = 0.9;
      ctx.fillStyle = L.wallDark;
      ctx.fillRect(vx, vy, vw, vh);
      ctx.strokeStyle = L.ink;
      ctx.lineWidth = 0.03;
      ctx.moveTo(vx, vy + vh * 0.33);
      ctx.lineTo(vx + vw, vy + vh * 0.33);
      ctx.moveTo(vx, vy + vh * 0.66);
      ctx.lineTo(vx + vw, vy + vh * 0.66);
      ctx.moveTo(vx + vw * 0.33, vy);
      ctx.lineTo(vx + vw * 0.33, vy + vh);
      ctx.moveTo(vx + vw * 0.66, vy);
      ctx.lineTo(vx + vw * 0.66, vy + vh);
    }
    ctx.stroke();
    ctx.fillStyle = L.glassOff;
    ctx.globalAlpha = alpha * (0.45 + 0.25 * Math.sin(t * 1.1));
    for (let i = 0; i < 2; i++) {
      const wx = w * (0.12 + i * 0.76);
      const wy = h * 0.55;
      ctx.fillRect(wx + 0.05, wy + 0.05, 0.7, 0.6);
    }
    ctx.globalAlpha = alpha;
  }

  // ---- floor slab + side walls
  if (visible(0, -wallT, w, wallT)) {
    ctx.fillStyle = L.floor;
    ctx.fillRect(0, -wallT, w, wallT);
    ctx.strokeStyle = L.floorEdge;
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.stroke();
  }
  if (visible(-wallT, 0, wallT, h)) {
    ctx.fillStyle = L.wallDark;
    ctx.fillRect(-wallT, 0, wallT, h);
  }
  if (visible(w, 0, wallT, h)) {
    ctx.fillStyle = L.wallDark;
    ctx.fillRect(w, 0, wallT, h);
  }

  // ---- ceiling beams
  ctx.fillStyle = L.beam;
  ctx.strokeStyle = L.beamLight;
  ctx.lineWidth = 0.04;
  for (let bx = 0; bx < w; bx += 3) {
    const bw = Math.min(2.6, w - bx);
    if (!visible(bx, h - 0.5, bw, 0.5)) continue;
    ctx.fillRect(bx, h - 0.5, bw, 0.5);
    ctx.beginPath();
    ctx.moveTo(bx, h);
    ctx.lineTo(bx + bw, h);
    ctx.stroke();
  }

  // ---- platforms: steel catwalks / shelf tops with edge highlights
  for (const p of platforms) {
    const x = fin(p.x, 0);
    const y = fin(p.y, 0);
    const pw_ = fin(p.w, 2);
    const ph = fin(p.h, 0.4);
    if (pw_ <= 0 || ph <= 0 || !visible(x, y, pw_, ph)) continue;
    ctx.save();
    ctx.fillStyle = L.steel;
    ctx.fillRect(x, y, pw_, ph);
    ctx.strokeStyle = L.steelEdge;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(x, y + ph);
    ctx.lineTo(x + pw_, y + ph);
    ctx.moveTo(x, y);
    ctx.lineTo(x, 0);
    ctx.moveTo(x + pw_, y);
    ctx.lineTo(x + pw_, 0);
    ctx.stroke();
    ctx.restore();
  }

  // ---- props: crates, barrels, shelves, lamps
  for (let i = 0; i < props.length; i++) {
    const pr = props[i] || {};
    const type = pr.type || `crate`;
    const x = fin(pr.x, 0);
    const y = fin(pr.y, 0);
    const pw_ = fin(pr.w, 1);
    const ph = fin(pr.h, 1);
    if (pw_ <= 0 || ph <= 0 || !visible(x, y, pw_, ph)) continue;
    ctx.save();
    if (type === `crate`) {
      ctx.fillStyle = crateTint(i);
      ctx.fillRect(x, y, pw_, ph);
      ctx.strokeStyle = L.crateLine ?? L.ink;
      ctx.lineWidth = 0.05;
      ctx.strokeRect(x, y, pw_, ph);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + pw_, y + ph);
      ctx.moveTo(x + pw_, y);
      ctx.lineTo(x, y + ph);
      ctx.stroke();
    } else if (type === `barrel`) {
      ctx.fillStyle = L.barrel ?? L.wallDark;
      ctx.fillRect(x, y, pw_, ph);
      ctx.strokeStyle = L.barrelBand ?? L.rivet;
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(x, y + ph * 0.33);
      ctx.lineTo(x + pw_, y + ph * 0.33);
      ctx.moveTo(x, y + ph * 0.66);
      ctx.lineTo(x + pw_, y + ph * 0.66);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + pw_ * 0.5, y + ph, pw_ * 0.42, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (type === `shelf`) {
      ctx.fillStyle = L.shelf;
      ctx.fillRect(x, y, pw_, ph);
      ctx.strokeStyle = L.steelEdge;
      ctx.lineWidth = 0.04;
      const shelves = Math.max(1, Math.floor(ph / 1.2));
      for (let s = 1; s <= shelves; s++) {
        const sy = y + (ph * s) / (shelves + 1);
        ctx.beginPath();
        ctx.moveTo(x, sy);
        ctx.lineTo(x + pw_, sy);
        ctx.stroke();
      }
      ctx.fillStyle = L.shelfItem;
      const items = Math.max(1, Math.floor(pw_ / 0.7));
      for (let k = 0; k < items; k++) {
        const ix = x + 0.2 + k * 0.7;
        if (ix + 0.25 <= x + pw_) ctx.fillRect(ix, y + ph, 0.25, 0.25);
      }
    } else {
      // lamp: hangs from the ceiling, cord up to y = h, soft glow cone below
      const cx = x + pw_ * 0.5;
      const topY = Math.min(h, y + ph);
      ctx.strokeStyle = L.lampCord;
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(cx, y + ph);
      ctx.lineTo(cx, h);
      ctx.stroke();
      ctx.fillStyle = L.lampGlow;
      ctx.beginPath();
      ctx.arc(cx, y + ph * 0.5, pw_ * 0.9, 0, TAU);
      ctx.fill();
      ctx.fillStyle = L.lamp;
      ctx.beginPath();
      ctx.arc(cx, y + ph * 0.5, pw_ * 0.35, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.25 * alpha;
      ctx.fillStyle = L.glow;
      ctx.beginPath();
      ctx.moveTo(cx, y + ph * 0.5);
      ctx.lineTo(cx - ph * 0.7, y - 0.15);
      ctx.lineTo(cx + ph * 0.7, y - 0.15);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }
    ctx.restore();
  }

  // ---- door: hazard-stripe frame + pulsing EXIT sign
  const frameW = 0.07;
  const jx = dx - frameW;
  if (visible(jx, 0, frameW * 2 + dw, dh + 0.3)) {
    ctx.fillStyle = L.hazardB;
    ctx.fillRect(jx, 0, frameW, dh);
    ctx.fillRect(dx + dw, 0, frameW, dh);
    ctx.fillRect(dx, dh, dw, frameW);
    ctx.fillStyle = L.wallDark;
    ctx.fillRect(dx, 0, dw, dh);
    ctx.strokeStyle = L.hazardA;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    for (let y = -0.2; y < dh + 0.2; y += 0.3) {
      ctx.moveTo(jx, y);
      ctx.lineTo(jx + frameW, y + 0.24);
      ctx.moveTo(dx + dw, y);
      ctx.lineTo(dx + dw + frameW, y + 0.24);
    }
    for (let sx = dx - 0.2; sx <= dx + dw + 0.2; sx += 0.3) {
      ctx.moveTo(sx, dh);
      ctx.lineTo(sx + 0.24, dh + frameW);
    }
    ctx.stroke();
    ctx.strokeStyle = L.ink;
    ctx.lineWidth = 0.05;
    ctx.strokeRect(jx - 0.02, -0.02, frameW * 2 + dw + 0.04, dh + 0.04);
    ctx.beginPath();
    ctx.arc(dx + dw - 0.22, dh * 0.5, 0.05, 0, TAU);
    ctx.fillStyle = L.ink;
    ctx.fill();
  }
  const sx = dx - 0.18;
  const sy = dh + 0.22;
  const sw = dw + 0.36;
  const sh = 0.5;
  if (visible(sx, sy, sw, sh)) {
    const pulse = 0.7 + 0.3 * Math.sin(t * 4);
    ctx.save();
    ctx.globalAlpha = alpha * pulse;
    ctx.fillStyle = L.exit;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = L.ink;
    ctx.lineWidth = 0.05;
    ctx.strokeRect(sx, sy, sw, sh);
    const lh = 0.34;
    const ly = sy + (sh - lh) / 2;
    const lx0 = sx + 0.16;
    const step = (sw - 0.64) / 3; // letters E X I T: the last one (0.32 wide) must end inside the sign
    const bar = 0.3;
    ctx.fillStyle = L.ink;
    ctx.fillRect(lx0, ly, 0.07, lh);
    ctx.fillRect(lx0, ly, bar, 0.07);
    ctx.fillRect(lx0, ly + lh / 2 - 0.035, bar - 0.04, 0.07);
    ctx.fillRect(lx0, ly + lh - 0.07, bar, 0.07);
    const xx = lx0 + step;
    ctx.strokeStyle = L.ink;
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(xx, ly);
    ctx.lineTo(xx + 0.28, ly + lh);
    ctx.moveTo(xx + 0.28, ly);
    ctx.lineTo(xx, ly + lh);
    ctx.stroke();
    ctx.fillRect(lx0 + 2 * step, ly, 0.07, lh);
    const tx = lx0 + 3 * step;
    ctx.fillRect(tx, ly + lh - 0.07, 0.32, 0.07); // crossbar on TOP (world is y-up)
    ctx.fillRect(tx + 0.125, ly, 0.07, lh);
    ctx.restore();
  }

  // ---- loot coins: glowing yellow-green, bobbing with time
  for (let i = 0; i < loot.length; i++) {
    if (collected.indexOf(i) >= 0) continue;
    const c = loot[i] || {};
    const cx = fin(c.x, 0);
    const cy = fin(c.y, 0);
    const r = 0.12;
    if (!visible(cx - r, cy - r, r * 2, r * 2)) continue;
    const yy = cy + 0.12 * Math.sin(t * 2.5 + i);
    ctx.save();
    ctx.fillStyle = `rgba(184, 230, 46, 0.35)`;
    ctx.beginPath();
    ctx.arc(cx, yy, 0.26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = L.coin;
    ctx.beginPath();
    ctx.arc(cx, yy, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = L.coinEdge;
    ctx.lineWidth = 0.03;
    ctx.stroke();
    ctx.fillStyle = `#ffffff`;
    ctx.globalAlpha = 0.5 * alpha;
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, yy - r * 0.35, r * 0.35, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.restore();
  }

  // ---- pickups (task 7b): weapon crate in the weapon colour + healing capsule, 1.6x coin size
  const pickups = Array.isArray(d.pickups) ? d.pickups : [];
  const takenPickups = Array.isArray(opts.pickups) ? opts.pickups : [];
  const weaponColors = opts.weaponColors && typeof opts.weaponColors === `object` ? opts.weaponColors : {};
  for (let i = 0; i < pickups.length; i++) {
    if (takenPickups.indexOf(i) >= 0) continue;
    const pk = pickups[i] || {};
    const px = fin(pk.x, 0);
    const py = fin(pk.y, 0);
    const r = 0.19;
    if (!visible(px - 0.45, py - 0.45, 0.9, 0.9)) continue;
    const yy = py + 0.12 * Math.sin(t * 2.5 + i * 1.7);
    ctx.save();
    if (pk.kind === `heal`) {
      const pulse = 0.75 + 0.25 * Math.sin(t * 3 + i);
      ctx.fillStyle = `rgba(80, 220, 120, 0.3)`;
      ctx.beginPath();
      ctx.arc(px, yy, 0.42 * pulse, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `#3fd16b`;
      ctx.beginPath();
      ctx.arc(px, yy + 0.06, 0.13, 0, Math.PI);
      ctx.arc(px, yy - 0.06, 0.13, Math.PI, TAU);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `#1d7a3c`;
      ctx.lineWidth = 0.03;
      ctx.stroke();
      ctx.fillStyle = `#ffffff`;
      ctx.fillRect(px - 0.04, yy - 0.12, 0.08, 0.24);
      ctx.fillRect(px - 0.12, yy - 0.04, 0.24, 0.08);
    } else {
      const col = typeof weaponColors[pk.weaponId] === `string` ? weaponColors[pk.weaponId] : L.coin;
      ctx.globalAlpha = alpha * (0.3 + 0.15 * Math.sin(t * 3 + i));
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, yy, 0.42, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * TAU) / 6;
        const hx = px + r * Math.cos(a);
        const hy = yy + r * Math.sin(a);
        if (k === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = L.ink;
      ctx.lineWidth = 0.03;
      ctx.stroke();
      const letter = typeof pk.weaponId === `string` && pk.weaponId.length > 0 ? pk.weaponId[0].toUpperCase() : `?`;
      ctx.fillStyle = L.ink;
      ctx.font = `bold 0.26px sans-serif`;
      ctx.textAlign = `center`;
      ctx.textBaseline = `middle`;
      ctx.save();
      ctx.translate(px, yy);
      ctx.scale(1, -1);
      ctx.fillText(letter, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  ctx.restore();
}

export function drawInteriorFade(ctx, width, height, t) {
  if (!ctx || typeof ctx !== `object`) return;
  const a = Math.max(0, Math.min(1, fin(t, 0)));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = `#000000`;
  ctx.fillRect(0, 0, fin(width, 0), fin(height, 0));
  ctx.restore();
}
