const WAREHOUSE_W = 36;
const WAREHOUSE_H = 10;
const WAREHOUSE_WALL_T = 0.4;
const PLATFORM_T = 0.24;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function num(v, fallback) {
  return Number.isFinite(v) ? v : fallback;
}

function overlap(a, b, pad = 0) {
  return a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;
}

function pointInBox(p, b, pad = 0) {
  return p.x > b.x - pad && p.x < b.x + b.w + pad && p.y > b.y - pad && p.y < b.y + b.h + pad;
}

function solidProps(props) {
  return props.filter((p) => p.type !== `lamp`);
}

// Reachability budgets measured against the REAL player ragdoll (see tools/test_interiorreach.mjs): the jump peak is about
// 2.1 m above the feet and a running jump clears a surface ~1.1 m higher with room to spare. Everything below stays well
// inside the TASK 6e caps (rise <= 1.6 m above the jump-from surface, gap <= 2.5 m, width >= 3 m) so every seed is reachable.
const MIN_RISE = 0.9; // platform top above the previous surface
const MAX_RISE = 1.1; // kept well under the 1.6 m cap so the ragdoll never clips a platform edge
const MIN_GAP = 0.7; // horizontal gap between platform edges
const MAX_GAP = 0.95; // kept well under the 2.5 m cap so a running jump always carries
const MIN_W = 3.4; // platform width (task minimum is 3 m; the ragdoll is ~0.6 m wide)
const MAX_W = 4.0;
const SHELF_MAX_RISE = 0.5; // shelf height: a low box the ragdoll can jump onto from the floor

export function createInterior(kind, seed, opts = {}) {
  const s = Number.isFinite(seed) ? seed : 0;
  const rnd = mulberry32(s >>> 0);
  const w = WAREHOUSE_W, h = WAREHOUSE_H, wallT = WAREHOUSE_WALL_T;
  const door = { x: 1.2, w: 1.6, h: 2.6 };
  const spawn = { x: 2.6 };
  const minX = door.x + door.w + 3.4;
  const maxX = w - 0.8;
  const platforms = [];
  const props = [];
  const loot = [];

  // Three platforms marching up and to the right: each one is a single comfortable running jump from the surface before it
  // (floor -> p1 -> p2 -> p3). Tops stay around 1.0 / 2.0 / 3.0 m, so the ceiling (10 m) leaves > 2.2 m of headroom to stand.
  let px = 8.8 + rnd() * 0.8;
  let top = 1.0 + rnd() * 0.15;
  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      const prev = platforms[i - 1];
      px = prev.x + prev.w + MIN_GAP + rnd() * (MAX_GAP - MIN_GAP);
      top = prev.y + prev.h + MIN_RISE + rnd() * (MAX_RISE - MIN_RISE);
    }
    const pw = MIN_W + rnd() * (MAX_W - MIN_W);
    platforms.push({ x: px, y: top - PLATFORM_T, w: pw, h: PLATFORM_T });
  }

  const lampCount = 2 + (rnd() < 0.5 ? 1 : 0);
  for (let i = 0; i < lampCount; i++) {
    const lh = 0.45 + rnd() * 0.25;
    const lw = 0.9 + rnd() * 0.5;
    props.push({ type: `lamp`, x: 8.0 + i * 6.5 + rnd() * 1.0, y: h - lh, w: lw, h: lh });
  }

  // Coins: one on the open floor before the first platform (walked over on the way in), one on p1 and one on the last
  // platform, all centred on wide flat stretches and clear of the landing strip edges.
  const p1 = platforms[0];
  const last = platforms[platforms.length - 1];
  const top1 = p1.y + p1.h, topLast = last.y + last.h;
  const coin = (lo, hi, y) => ({ x: lo + rnd() * (hi - lo), y });
  loot.push(coin(minX + 0.3, p1.x - 1.3, 0.55));
  loot.push(coin(p1.x + 0.7, p1.x + p1.w - 0.7, top1 + 0.55));
  loot.push(coin(last.x + 0.7, last.x + last.w - 0.7, topLast + 0.55));

  // Props live only on the open floor to the right of the last platform, well clear of every landing zone and the door, so
  // nothing can block a jump. The shelf is a 0.35-0.5 m step; crates/barrels are <= 1 m and >= 0.8 m wide, all jumpable.
  const propZone = { lo: last.x + last.w + 1.0, hi: maxX };
  const propClear = (box) => {
    if (box.x < propZone.lo - 1e-9 || box.x + box.w > propZone.hi + 1e-9) return false;
    for (const p of platforms) if (overlap(box, p, 0.3)) return false;
    for (const solid of solidProps(props)) if (overlap(box, solid, 0.05)) return false;
    for (const l of loot) if (pointInBox(l, box, 0.35)) return false;
    return true;
  };
  const placeProp = (type, pw, ph) => {
    if (propZone.hi - propZone.lo < pw) return false;
    for (let a = 0; a < 120; a++) {
      const box = { x: propZone.lo + rnd() * (propZone.hi - propZone.lo - pw), y: 0, w: pw, h: ph };
      if (propClear(box)) {
        props.push({ type, ...box });
        return true;
      }
    }
    return false;
  };
  const shelfW = 1.0 + rnd() * 0.35, shelfH = Math.min(SHELF_MAX_RISE, 0.35 + rnd() * 0.15);
  if (!placeProp(`shelf`, shelfW, shelfH)) props.push({ type: `shelf`, x: propZone.lo, y: 0, w: shelfW, h: shelfH });
  for (let i = 0; i < 3; i++) {
    const type = rnd() < 0.5 ? `crate` : `barrel`;
    const cw = type === `crate` ? 0.9 + rnd() * 0.3 : 0.8 + rnd() * 0.15;
    const ch = type === `crate` ? 0.7 + rnd() * 0.3 : 0.8 + rnd() * 0.2;
    if (placeProp(type, cw, ch)) continue;
    let placed = false;
    for (let x = propZone.lo; x <= propZone.hi - cw && !placed; x += 0.1) {
      const box = { x, y: 0, w: cw, h: ch };
      if (propClear(box)) {
        props.push({ type, ...box });
        placed = true;
      }
    }
    if (!placed) props.push({ type: `crate`, x: propZone.lo + i * 1.3, y: 0, w: cw, h: ch });
  }

  // Pickups (task 7b): one random weapon + a 50% chance of a heal. All pickup random numbers are drawn AFTER every
  // other draw above, so existing seeds keep their platform/prop/coin layout. Spots sit on reachable flat surfaces
  // (platform tops / open floor), >= 1 m from every prop/platform edge, every coin, and each other.
  const o = opts || {};
  const weaponIds = Array.isArray(o.weaponIds) ? o.weaponIds.filter((id) => typeof id === `string` && id.length > 0) : [];
  const pickups = [];
  if (weaponIds.length > 0) {
    const solids = [...platforms, ...solidProps(props)];
    const spotClear = (x, y, support, avoid) => {
      for (const b of solids) {
        if (b === support) {
          if (x - b.x < 1 - 1e-9 || b.x + b.w - x < 1 - 1e-9) return false;
          continue;
        }
        const cx = Math.max(b.x, Math.min(x, b.x + b.w));
        const cy = Math.max(b.y, Math.min(y, b.y + b.h));
        const ddx = x - cx, ddy = y - cy;
        if (ddx * ddx + ddy * ddy < 1 - 1e-9) return false;
      }
      for (const l of loot) {
        const ddx = x - l.x, ddy = y - l.y;
        if (ddx * ddx + ddy * ddy < 1 - 1e-9) return false;
      }
      for (const a of avoid) {
        const ddx = x - a.x, ddy = y - a.y;
        if (ddx * ddx + ddy * ddy < 1 - 1e-9) return false;
      }
      return true;
    };
    const pickSpot = (surfaces, avoid) => {
      for (let a = 0; a < 48; a++) {
        const s = surfaces[Math.floor(rnd() * surfaces.length)];
        const x = s.lo + rnd() * (s.hi - s.lo);
        if (spotClear(x, s.y, s.support, avoid)) return { x, y: s.y };
      }
      for (const s of surfaces) {
        for (let x = s.lo; x <= s.hi + 1e-9; x += 0.05) {
          if (spotClear(x, s.y, s.support, avoid)) return { x, y: s.y };
        }
      }
      return null;
    };
    const platSurfaces = platforms.map((p) => ({ lo: p.x + 1.0, hi: p.x + p.w - 1.0, y: p.y + p.h + 0.55, support: p }));
    const farFloor = { lo: propZone.lo, hi: w - 1.0, y: 0.55, support: null };
    const leftFloor = { lo: minX, hi: p1.x - 1.0, y: 0.55, support: null };
    const weaponId = weaponIds[Math.floor(rnd() * weaponIds.length)];
    const wSpot = pickSpot([...platSurfaces, farFloor], []);
    if (wSpot) pickups.push({ kind: `weapon`, weaponId, x: wSpot.x, y: wSpot.y });
    if (rnd() < 0.5) {
      const hSpot = pickSpot([...platSurfaces, farFloor, leftFloor], pickups);
      if (hSpot) pickups.push({ kind: `heal`, amount: 35, x: hSpot.x, y: hSpot.y });
    }
  }

  return { kind: `warehouse`, seed: s, w, h, wallT, door, spawn, platforms, props, loot, pickups };
}

export function interiorSolids(def) {
  const d = def || {};
  const w = num(d.w, WAREHOUSE_W), h = num(d.h, WAREHOUSE_H), t = num(d.wallT, WAREHOUSE_WALL_T);
  const out = [
    { x: 0, y: -t, w, h: t },
    { x: -t, y: 0, w: t, h },
    { x: w, y: 0, w: t, h },
    { x: 0, y: h, w, h: t },
  ];
  for (const p of d.platforms || []) out.push({ x: p.x, y: p.y, w: p.w, h: p.h });
  for (const p of d.props || []) if (p.type !== `lamp`) out.push({ x: p.x, y: p.y, w: p.w, h: p.h });
  return out;
}

export function doorZone(def) {
  const door = (def && def.door) || {};
  const x0 = num(door.x, 1.2);
  return { x0, x1: x0 + num(door.w, 1.6), y0: 0, y1: num(door.h, 2.6) };
}

export function inDoorZone(def, px, py) {
  const z = doorZone(def);
  const e = 1e-9;
  return px >= z.x0 - e && px <= z.x1 + e && py >= z.y0 - e && py <= z.y1 + e;
}

export function clampToInterior(def, x) {
  const w = num(def && def.w, WAREHOUSE_W);
  return Math.min(w - 0.6, Math.max(0.6, x));
}

export class InteriorSession {
  constructor(def, returnInfo) {
    this.def = def;
    this.returnInfo = returnInfo;
    this.coinsTaken = new Set();
    this.pickupsTaken = new Set();
    this.time = 0;
  }

  collect(px, py, radius = 0.9) {
    const loot = (this.def && this.def.loot) || [];
    let best = -1, bestD = num(radius, 0.9) ** 2;
    for (let i = 0; i < loot.length; i++) {
      if (this.coinsTaken.has(i)) continue;
      const dx = px - loot[i].x, dy = py - loot[i].y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD) {
        bestD = d2;
        best = i;
      }
    }
    if (best >= 0) this.coinsTaken.add(best);
    return best;
  }

  collectPickup(px, py, radius = 0.9) {
    const pickups = (this.def && this.def.pickups) || [];
    let best = -1, bestD = num(radius, 0.9) ** 2;
    for (let i = 0; i < pickups.length; i++) {
      if (this.pickupsTaken.has(i)) continue;
      const dx = px - pickups[i].x, dy = py - pickups[i].y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD) {
        bestD = d2;
        best = i;
      }
    }
    if (best >= 0) this.pickupsTaken.add(best);
    return best;
  }

  allLooted() {
    const loot = (this.def && this.def.loot) || [];
    for (let i = 0; i < loot.length; i++) if (!this.coinsTaken.has(i)) return false;
    return true;
  }

  snapshot() {
    return {
      def: this.def,
      returnInfo: this.returnInfo,
      coinsTaken: [...this.coinsTaken].sort((a, b) => a - b),
      pickupsTaken: [...this.pickupsTaken].sort((a, b) => a - b),
      time: this.time,
    };
  }

  static restore(snap) {
    const s = snap || {};
    const session = new InteriorSession(s.def, s.returnInfo);
    session.coinsTaken = new Set(Array.isArray(s.coinsTaken) ? s.coinsTaken : []);
    session.pickupsTaken = new Set(Array.isArray(s.pickupsTaken) ? s.pickupsTaken : []);
    session.time = num(s.time, 0);
    return session;
  }
}