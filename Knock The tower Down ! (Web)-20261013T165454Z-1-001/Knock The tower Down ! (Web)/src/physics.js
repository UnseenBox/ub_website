// Custom lightweight 2D rigid-body physics for Knock the Tower Down.
// Supports: dynamic circles (projectiles, targets) + dynamic OBB rectangles
// (blocks) + static rectangles (platforms) + infinite ground plane y=GROUND_Y.
// Collision: circle-vs-ground, rect-vs-ground (corner contacts), circle-vs-OBB,
// OBB-vs-OBB via SAT + corner-in-box contacts. Sequential impulses w/ friction,
// restitution, Baumgarte positional correction, sleeping for settle.

export const GRAVITY = 1500;

// World cleanup limits. Generous enough that a monument's debris can scatter
// well past the structure without being culled mid-flight.
export const BOUNDS = { minX: -400, maxX: 2600, maxY: 1400 };

// Solver tunables, exposed so tools/validate-levels.mjs can sweep them.
//
// These values are the measured optimum, not a guess. This solver has no
// warm-starting, so raising `iter` over-solves and injects energy: at 14-20
// iterations the campaign starts destroying its own blocks at rest. Tightening
// `slop` or raising `baumgarte` does the same, because the positional
// correction divides by the inverse-mass sum and so grows sharply for heavy
// bodies. Measure before touching any of these.
export const TUNE = { iter: 8, slop: 0.8, baumgarte: 0.14, sort: false };

export const MATERIALS = {
  wood:  { density: 1.0,  friction: 0.62, restitution: 0.04, hp: 24,  score: 120, label: 'Wood' },
  stone: { density: 2.4,  friction: 0.85, restitution: 0.02, hp: 60,  score: 250, label: 'Stone' },
  glass: { density: 0.55, friction: 0.5, restitution: 0.06, hp: 10,  score: 150, label: 'Glass' },
  steel: { density: 0,    friction: 0.9,  restitution: 0.05, hp: 1e9, score: 0,   label: 'Steel' },
};

export const PROJECTILES = {
  rock:     { r: 13, density: 3.2, friction: 0.55, restitution: 0.12, dmgMul: 1.7, maxDmg: 60 },
  bouncy:   { r: 10, density: 0.85, friction: 0.45, restitution: 0.84, dmgMul: 0.55, maxDmg: 22 },
  splitter: { r: 11, density: 1.5, friction: 0.5, restitution: 0.28, dmgMul: 1.0, maxDmg: 34 },
  shard:    { r: 6,  density: 1.2, friction: 0.4, restitution: 0.45, dmgMul: 0.5, maxDmg: 14 },
};

let _nextId = 1;
let flip = false;
// Set when any body is destroyed during a step: support somewhere may have
// vanished, so stepWorld re-wakes sleepers (they re-sleep if still supported).
let disturbed = false;
// Sleeping-sleeping pairs skipped during the last contact pass. Support is
// propagated through them (ground/statics -> up the stack) so a floating
// island of sleepers is never mistaken for a supported structure.
let lastSleepPairs = [];

// A contact supports body b if the contact point is underneath its center.
function supportThresh(b) {
  return b.shape === 'circle' ? b.r * 0.25 : Math.min(b.w, b.h) * 0.15;
}

export function makeBlock(x, y, w, h, material = 'wood', angle = 0, opts = {}) {
  const m = MATERIALS[material];
  const area = (w * h) / 2500; // normalize so a 50x50 wood block ~ mass 1
  const mass = opts.isStatic ? 0 : Math.max(0.3, area * m.density);
  const inertia = mass > 0 ? (mass * (w * w + h * h)) / 12 : 0;
  return {
    id: _nextId++, kind: 'block', shape: 'rect', material,
    x, y, vx: 0, vy: 0, angle, angVel: 0,
    w, h, mass, invMass: mass > 0 ? 1 / mass : 0,
    inertia, invInertia: inertia > 0 ? 1 / inertia : 0,
    friction: opts.friction ?? m.friction, restitution: opts.restitution ?? m.restitution,
    hp: opts.hp ?? m.hp, maxHp: opts.hp ?? m.hp,
    isStatic: !!opts.isStatic, destroyed: false, sleepTime: 0, sleeping: false,
    flash: 0, groundHits: 0,
    // decorative interior glyph pattern hint ('braced'/'lattice'); purely
    // visual — the renderer draws it inside the block's physical bounds, so
    // it can never imply support the simulation does not actually have
    pattern: opts.pattern ?? null,
    // circumradius: rotation-invariant, so the broad phase never needs to
    // recompute it as the block tumbles
    _br: Math.hypot(w, h) / 2,
    stress: 0,
  };
}

export function makeBall(x, y, r, o = {}) {
  const mass = o.mass ?? (Math.PI * r * r / 2500) * (o.density ?? 1);
  const inertia = mass > 0 ? 0.5 * mass * r * r : 0;
  return {
    id: _nextId++, kind: o.kind ?? 'ball', shape: 'circle', material: o.material ?? 'rock',
    x, y, vx: o.vx ?? 0, vy: o.vy ?? 0, angle: o.angle ?? 0, angVel: o.angVel ?? 0,
    r, mass, invMass: mass > 0 ? 1 / mass : 0,
    inertia, invInertia: inertia > 0 ? 1 / inertia : 0,
    friction: o.friction ?? 0.5, restitution: o.restitution ?? 0.3,
    hp: o.hp ?? 25, maxHp: o.hp ?? 25,
    isStatic: false, isProjectile: !!o.isProjectile, isTarget: !!o.isTarget,
    noRoll: !!o.isTarget, // cores perch; they don't roll away on tiny tilts
    destroyed: false, sleepTime: 0, sleeping: false, flash: 0,
    homeX: x, homeY: y, touchedGround: false, dead: false,
    hasSplit: false, age: 0, trail: [],
    _br: r, stress: 0,
    // a core that starts on the dirt is sheltered by design, not already
    // defeated: ground contact must not count as a fall for it
    startsGrounded: !!o.isTarget && y + r >= (o.groundY ?? 936) - 3,
  };
}

export function corners(b) {
  const c = Math.cos(b.angle), s = Math.sin(b.angle);
  const hx = b.w / 2, hy = b.h / 2;
  const pts = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]];
  return pts.map(([lx, ly]) => ({ x: b.x + lx * c - ly * s, y: b.y + lx * s + ly * c }));
}

export function pointInOBB(px, py, box) {
  const dx = px - box.x, dy = py - box.y;
  const c = Math.cos(-box.angle), s = Math.sin(-box.angle);
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  return Math.abs(lx) <= box.w / 2 + 0.5 && Math.abs(ly) <= box.h / 2 + 0.5;
}

function obbAxes(b) {
  const c = Math.cos(b.angle), s = Math.sin(b.angle);
  return [{ x: c, y: s }, { x: -s, y: c }];
}

// SAT test for two OBBs. Returns {nx,ny,depth} (normal from A to B) or null.
export function satOBB(a, b) {
  const ca = corners(a), cb = corners(b);
  const axes = [...obbAxes(a), ...obbAxes(b)];
  let bestOverlap = Infinity, bestAxis = null;
  for (const ax of axes) {
    let mna = Infinity, mxa = -Infinity, mnb = Infinity, mxb = -Infinity;
    for (const p of ca) { const d = p.x * ax.x + p.y * ax.y; if (d < mna) mna = d; if (d > mxa) mxa = d; }
    for (const p of cb) { const d = p.x * ax.x + p.y * ax.y; if (d < mnb) mnb = d; if (d > mxb) mxb = d; }
    const overlap = Math.min(mxa, mxb) - Math.max(mna, mnb);
    if (overlap <= 0) return null;
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      // orient axis from A to B
      const dot = (b.x - a.x) * ax.x + (b.y - a.y) * ax.y;
      bestAxis = dot < 0 ? { x: -ax.x, y: -ax.y } : { x: ax.x, y: ax.y };
    }
  }
  return { nx: bestAxis.x, ny: bestAxis.y, depth: bestOverlap };
}

function contactList() { return []; }

// Record underneath-support from a contact point for both bodies.
function markSupport(A, B, px, py) {
  if (!A.isStatic && !A.destroyed && py > A.y + supportThresh(A)) A._sup = true;
  if (B && !B.isStatic && !B.destroyed && py > B.y + supportThresh(B)) B._sup = true;
}

// Build contacts between all body pairs + ground. Each contact:
// {a, b|null(ground), px, py, nx, ny, depth}
export function collectContacts(bodies, groundY, events) {
  const contacts = contactList();
  for (const b of bodies) b._sup = false; // support flag reset; set below
  lastSleepPairs = [];
  const dyn = bodies.filter(b => !b.destroyed && !b.isStatic);
  // ground contacts (normal points from body A toward ground B, i.e. +y/down)
  for (const b of dyn) {
    if (b.shape === 'circle') {
      const pen = b.y + b.r - groundY;
      if (pen > 0) { contacts.push({ a: b, b: null, px: b.x, py: groundY, nx: 0, ny: 1, depth: pen }); b._sup = true; }
    } else {
      for (const p of corners(b)) {
        const pen = p.y - groundY;
        if (pen > 0) { contacts.push({ a: b, b: null, px: p.x, py: groundY, nx: 0, ny: 1, depth: pen }); b._sup = true; }
      }
    }
  }
  // pair contacts
  for (let i = 0; i < bodies.length; i++) {
    const A = bodies[i];
    if (A.destroyed) continue;
    for (let j = i + 1; j < bodies.length; j++) {
      const B = bodies[j];
      if (B.destroyed) continue;
      if (A.isStatic && B.isStatic) continue;
      // Broad phase: circumradius reject. Cheap, exact (never discards a real
      // contact) and it is what makes a 40-body monument affordable — most of
      // the n^2 pairs in a large structure are nowhere near each other.
      const bdx = B.x - A.x, bdy = B.y - A.y, br = A._br + B._br;
      if (bdx * bdx + bdy * bdy > br * br) continue;
      // Both asleep: skip solving (nothing changed for this pair) but remember
      // it for support propagation. Support is NOT assumed here — it must flow
      // from a genuinely supported body, otherwise floating islands stay asleep.
      if (A.sleeping && B.sleeping) { lastSleepPairs.push([A, B]); continue; }
      if (A.shape === 'circle' && B.shape === 'circle') {
        const dx = B.x - A.x, dy = B.y - A.y;
        const dist = Math.hypot(dx, dy), minD = A.r + B.r;
        if (dist < minD && dist > 1e-6) {
          const nx = dx / dist, ny = dy / dist;
          const px = (A.x + B.x) / 2, py = (A.y + B.y) / 2;
          contacts.push({ a: A, b: B, px, py, nx, ny, depth: minD - dist });
          markSupport(A, B, px, py);
        }
      } else if (A.shape === 'circle' && B.shape === 'rect' || (A.shape === 'rect' && B.shape === 'circle')) {
        const C = A.shape === 'circle' ? A : B;
        const R = A.shape === 'rect' ? A : B;
        const firstIsCircle = A.shape === 'circle';
        // circle center to rect local
        const dx = C.x - R.x, dy = C.y - R.y;
        const c = Math.cos(-R.angle), s = Math.sin(-R.angle);
        let lx = dx * c - dy * s, ly = dx * s + dy * c;
        const hx = R.w / 2, hy = R.h / 2;
        const cx = Math.max(-hx, Math.min(hx, lx));
        const cy = Math.max(-hy, Math.min(hy, ly));
        const inside = (lx === cx && ly === cy);
        // closest point in world
        const cc = Math.cos(R.angle), ss = Math.sin(R.angle);
        const qx = R.x + cx * cc - cy * ss, qy = R.y + cx * ss + cy * cc;
        let nx = C.x - qx, ny = C.y - qy;
        let dist = Math.hypot(nx, ny);
        if (inside) {
          // push along min-penetration local axis
          const penX = hx - Math.abs(lx), penY = hy - Math.abs(ly);
          let lnx = 0, lny = 0, depth = 0;
          if (penX < penY) { lnx = lx > 0 ? 1 : -1; depth = penX + C.r; }
          else { lny = ly > 0 ? 1 : -1; depth = penY + C.r; }
          const wnx = lnx * cc - lny * ss, wny = lnx * ss + lny * cc;
          contacts.push({ a: A, b: B, px: qx, py: qy, nx: firstIsCircle ? -wnx : wnx, ny: firstIsCircle ? -wny : wny, depth });
          markSupport(A, B, qx, qy);
        } else if (dist < C.r) {
          if (dist < 1e-6) { nx = 0; ny = -1; dist = 1; } else { nx /= dist; ny /= dist; }
          // stored normal must point from A to B
          contacts.push({
            a: A, b: B, px: qx, py: qy,
            nx: firstIsCircle ? -nx : nx, ny: firstIsCircle ? -ny : ny,
            depth: C.r - dist,
          });
          markSupport(A, B, qx, qy);
        }
      } else {
        // rect vs rect
        const res = satOBB(A, B);
        if (!res) continue;
        // contact points: corners of each inside the other
        const pts = [];
        for (const p of corners(A)) if (pointInOBB(p.x, p.y, B)) pts.push(p);
        for (const p of corners(B)) if (pointInOBB(p.x, p.y, A)) pts.push(p);
        if (pts.length === 0) {
          // edge-edge: use midpoint between centers clamped along normal
          pts.push({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 });
        }
        // keep at most 2 deepest-ish (just first 2 to bound cost)
        const use = pts.slice(0, 2);
        for (const p of use) {
          contacts.push({ a: A, b: B, px: p.x, py: p.y, nx: res.nx, ny: res.ny, depth: res.depth });
          markSupport(A, B, p.x, p.y);
        }
      }
    }
  }
  return contacts;
}

function applyImpulse(b, px, py, ix, iy) {
  if (!b || b.isStatic || b.invMass === 0) return;
  b.vx += ix * b.invMass;
  b.vy += iy * b.invMass;
  const rx = px - b.x, ry = py - b.y;
  b.angVel += (rx * iy - ry * ix) * b.invInertia;
  if (b.sleeping && (Math.abs(ix) + Math.abs(iy)) > 0.5) b.sleeping = false;
}

export function solveContacts(contacts, events, damageScale = 1) {
  const ITER = TUNE.iter;
  const SLOP = TUNE.slop, BAUMGARTE = TUNE.baumgarte;
  for (let it = 0; it < ITER; it++) {
    for (const c of contacts) {
      const A = c.a, B = c.b;
      if (A.destroyed || (B && B.destroyed)) continue;
      const invA = A.isStatic ? 0 : A.invMass;
      const invB = !B || B.isStatic ? 0 : B.invMass;
      if (invA === 0 && invB === 0) continue;
      const invIA = A.isStatic ? 0 : A.invInertia;
      const invIB = !B || B.isStatic ? 0 : B.invInertia;

      const rax = c.px - A.x, ray = c.py - A.y;
      const rbx = B ? c.px - B.x : 0, rby = B ? c.py - B.y : 0;

      // relative velocity at contact
      const vax = A.vx - A.angVel * ray, vay = A.vy + A.angVel * rax;
      const vbx = B ? (B.vx - (B.angVel ?? 0) * rby) : 0;
      const vby = B ? (B.vy + (B.angVel ?? 0) * rbx) : 0;
      let rvx = vbx - vax, rvy = vby - vay;
      const vn = rvx * c.nx + rvy * c.ny;
      if (vn > 0.5 && it > 0) continue; // separating

      const raCn = rax * c.ny - ray * c.nx;
      const rbCn = B ? (rbx * c.ny - rby * c.nx) : 0;
      const kn = invA + invB + raCn * raCn * invIA + rbCn * rbCn * invIB;
      if (kn <= 0) continue;

      const e = Math.max(A.restitution, B ? B.restitution : 0.05);
      const bias = Math.max(0, -(vn + 28) * 0.02); // tiny bounce bias only for hard hits
      let dPn = (-(1 + (vn < -120 ? e : 0)) * vn + bias) / kn;
      // first iteration with restitution already handled: clamp
      if (dPn < 0) dPn = 0;

      // friction
      let rvTx = rvx + c.nx * (-vn), rvTy = rvy + c.ny * (-vn);
      // recompute tangent properly
      const tx = -c.ny, ty = c.nx;
      const vt = rvx * tx + rvy * ty;
      const raCt = rax * ty - ray * tx;
      const rbCt = B ? (rbx * ty - rby * tx) : 0;
      const kt = invA + invB + raCt * raCt * invIA + rbCt * rbCt * invIB;
      let dPt = kt > 0 ? -vt / kt : 0;
      const mu = Math.sqrt(A.friction * (B ? B.friction : 0.7));
      const maxF = mu * dPn;
      dPt = Math.max(-maxF, Math.min(maxF, dPt));

      const ix = c.nx * dPn + tx * dPt, iy = c.ny * dPn + ty * dPt;
      applyImpulse(A, c.px, c.py, -ix, -iy);
      if (B) applyImpulse(B, c.px, c.py, ix, iy);

      // damage + impact events only on first iteration
      if (it === 0 && vn < -90 && events) {
        const impact = -vn;
        events.push({ type: 'impact', x: c.px, y: c.py, speed: impact, a: A, b: B, nx: c.nx, ny: c.ny });
        // damage application (per-body harm reported so feedback can show numbers)
        const dmg = Math.max(0, (impact - 110) * 0.055) * damageScale;
        if (dmg > 0.4) {
          harmBody(A, dmg * massFactor(B, A) + (A.isProjectile ? 0 : dmg * 0.25), events, impact);
          if (B) harmBody(B, dmg * massFactor(A, B) + (B.isProjectile ? 0 : dmg * 0.25), events, impact);
        }
      }
    }
    // positional correction (translate + a little angular straightening for stacks)
    for (const c of contacts) {
      const A = c.a, B = c.b;
      if (A.destroyed || (B && B.destroyed)) continue;
      const invA = A.isStatic ? 0 : A.invMass;
      const invB = !B || B.isStatic ? 0 : B.invMass;
      const sum = invA + invB;
      if (sum === 0) continue;
      const corr = Math.max(0, c.depth - SLOP) * (BAUMGARTE / sum);
      // translate
      const cx = c.nx * corr, cy = c.ny * corr;
      if (!A.isStatic) { A.x -= cx * (invA / sum); A.y -= cy * (invA / sum); }
      if (B && !B.isStatic) { B.x += cx * (invB / sum); B.y += cy * (invB / sum); }
      // rotate slightly so leaning boxes in a stack get pushed back upright
      if (!A.isStatic && A.shape === 'rect') {
        const rax = c.px - A.x, ray = c.py - A.y;
        A.angle -= (rax * c.ny - ray * c.nx) * corr * 0.004 * A.invInertia * A.mass;
      }
      if (B && !B.isStatic && B.shape === 'rect') {
        const rbx = c.px - B.x, rby = c.py - B.y;
        B.angle += (rbx * c.ny - rby * c.nx) * corr * 0.004 * B.invInertia * B.mass;
      }
      c.depth -= corr * 0.5;
    }
  }
}

function massFactor(other, self) {
  if (!other) return 1;
  const m = other.mass || 1;
  return Math.min(2.2, 0.55 + m * 0.45);
}

function harmBody(b, dmg, events, impact) {
  if (!b || b.isStatic || b.destroyed) return;
  if (b.isProjectile && !b.isTarget) return; // projectiles don't take damage
  b.hp -= dmg;
  b.flash = 1;
  if (events) events.push({ type: 'harm', x: b.x, y: b.y, amount: dmg, body: b });
  if (b.sleeping && impact > 200) b.sleeping = false;
  if (b.hp <= 0 && !b.destroyed) {
    b.destroyed = true;
    disturbed = true; // support may have vanished -> stepWorld re-wakes sleepers
    if (events) events.push({ type: 'destroy', x: b.x, y: b.y, body: b, speed: impact });
  }
}

function damageBody(b, dmg, events, impact) {
  harmBody(b, dmg, events, impact);
}

export function integrate(bodies, dt, groundY) {
  for (const b of bodies) {
    if (b.destroyed || b.isStatic) continue;
    if (b.sleeping) { b.vx = 0; b.vy = 0; b.angVel = 0; continue; }
    b.vy += GRAVITY * dt;
    // damping (extra settle damping when slow kills micro-jitter so towers sleep)
    const spd0 = Math.hypot(b.vx, b.vy);
    const linD = b.shape === 'circle' ? 0.12 : 0.06;
    b.vx *= (1 - linD * dt);
    b.vy *= (1 - 0.01 * dt);
    const angD = b.noRoll ? 6.0 : (b.shape === 'circle' ? 0.25 : 0.6);
    b.angVel *= (1 - Math.min(0.9, angD * dt));
    if (b.noRoll) {
      b.angVel = Math.max(-2.2, Math.min(2.2, b.angVel));
      if (spd0 < 60) { b.vx *= (1 - Math.min(0.9, 3 * dt)); b.angVel *= (1 - Math.min(0.9, 6 * dt)); }
    } else if (spd0 < 60 && b.shape === 'rect') {
      b.vx *= (1 - Math.min(0.9, 1.6 * dt));
      b.angVel *= (1 - Math.min(0.9, 2.2 * dt));
    }
    // clamp
    const sp = Math.hypot(b.vx, b.vy);
    const MAXV = 2400;
    if (sp > MAXV) { b.vx *= MAXV / sp; b.vy *= MAXV / sp; }
    b.angVel = Math.max(-14, Math.min(14, b.angVel));
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.angle += b.angVel * dt;
    if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 4);
    b.age = (b.age || 0) + dt;
    // ground touch flag for targets
    if ((b.isTarget) && b.y + (b.r || 0) >= groundY - 2) b.touchedGround = true;
    // sleep check (targets & blocks rest; projectiles keep rolling a bit longer)
    const spd = Math.hypot(b.vx, b.vy);
    const sleepV = b.isProjectile && !b.isTarget ? 26 : 20;
    const sleepW = b.noRoll ? 0.9 : 0.7;
    if (spd < sleepV && Math.abs(b.angVel) < sleepW && b.y < groundY + 40) {
      b.sleepTime = (b.sleepTime || 0) + dt;
      if (b.sleepTime > 0.45) { b.sleeping = true; b.vx = b.vy = 0; b.angVel = 0; }
    } else b.sleepTime = 0;
    // out of bounds cleanup
    if (b.x < BOUNDS.minX || b.x > BOUNDS.maxX || b.y > BOUNDS.maxY) {
      if (b.isProjectile || b.isTarget) { b.destroyed = true; b.dead = true; }
      else { b.destroyed = true; }
    }
  }
}

// Settle a freshly built level before the player ever sees it, then freeze it.
// Exact authored stacking still leaves a few px of Baumgarte settling as load
// comes on, which reads as the structure slumping the moment the level opens.
// Damage is off here (events === null), so settling can never harm a block.
//
// Re-homing afterwards matters as much as the settling: homeX/homeY are what
// topple scoring and core displacement are measured against, so they have to
// describe the pose the player is actually shown.
// The sleep state the warm-up reaches is deliberately preserved. Clearing it
// is actively harmful: a settled stack carries penetration up to SLOP deep, so
// waking every body at once makes the positional correction shove the whole
// structure apart, and it bounces back hard enough to damage its own blocks.
// Left asleep, the level is frozen and perfectly steady; impulses, impact
// damage and the support-loss safety net all still wake bodies on contact.
export function warmup(bodies, groundY, steps = 180) {
  for (let i = 0; i < steps; i++) stepWorld(bodies, 1 / 60, groundY, null);
  for (const b of bodies) {
    if (b.isStatic) continue;
    b.vx = 0; b.vy = 0; b.angVel = 0;
    b.calmTime = 0;
    b.hp = b.maxHp; b.flash = 0; b.stress = 0;
    b.homeX = b.x; b.homeY = b.y;
    b.touchedGround = false;
    b.age = 0;
  }
}

export function stepWorld(bodies, dt, groundY, events) {
  // substeps to reduce tunneling; impact events collected every substep and
  // deduped per body-pair per step so the decisive hit is never missed.
  const SUB = 4;
  const sdt = dt / SUB;
  flip = !flip;
  let stepEvents = null;
  if (events) {
    stepEvents = [];
    events._seen = events._seen || new Map();
    events._seen.clear();
  }
  for (let s = 0; s < SUB; s++) {
    integrate(bodies, sdt, groundY);
    const contacts = collectContacts(bodies, groundY, events);
    // Ground-up ordering: a stack is only as stable as the speed at which
    // support reaches the top, and solving the lowest contacts first lets one
    // iteration carry the ground reaction up through every joint. The px
    // tie-break alternates each step so no systematic lean builds up.
    if (TUNE.sort) contacts.sort((a, b) => (b.py - a.py) || (flip ? a.px - b.px : b.px - a.px));
    else if (flip) contacts.reverse();
    const sub = events ? [] : null;
    solveContacts(contacts, sub);
    if (events) {
      for (const e of sub) {
        if (e.type === 'impact') {
          const ida = e.a?.id ?? 0, idb = e.b?.id ?? -1;
          const key = ida < idb ? 'i' + (ida * 100000 + idb + 100000) : 'i' + (idb * 100000 + ida + 100000);
          const prev = events._seen.get(key);
          if (prev === undefined || e.speed > prev.speed) {
            if (prev !== undefined) {
              const ix = stepEvents.indexOf(prev);
              if (ix >= 0) stepEvents.splice(ix, 1);
            }
            events._seen.set(key, e);
            stepEvents.push(e);
          }
        } else if (e.type === 'harm') {
          // one number per body per step (strongest tick wins)
          const key = 'h' + (e.body?.id ?? 0);
          const prev = events._seen.get(key);
          if (prev === undefined || e.amount > prev.amount) {
            if (prev !== undefined) {
              const ix = stepEvents.indexOf(prev);
              if (ix >= 0) stepEvents.splice(ix, 1);
            }
            events._seen.set(key, e);
            stepEvents.push(e);
          }
        } else stepEvents.push(e);
      }
    }
  }
  if (events) {
    for (const e of stepEvents) events.push(e);
    delete events._seen;
  }
  // If anything was destroyed this step, supports may have vanished: wake all
  // sleepers (still-supported ones re-sleep within ~0.5s; the rest must fall).
  if (disturbed) {
    disturbed = false;
    for (const b of bodies) {
      if (!b.isStatic && !b.destroyed && b.sleeping) { b.sleeping = false; b.sleepTime = 0; }
    }
  }
  // Safety net: a sleeping body with no support contact must not hover.
  // (Resting bodies always have ground/stack contacts; freed ones fall.)
  // Support flows from ground/statics through the contact graph (including
  // skipped sleeping-sleeping pairs) so only truly grounded islands stay asleep.
  for (let pass = 0; pass < bodies.length; pass++) {
    let changed = false;
    for (const pair of lastSleepPairs) {
      const A = pair[0], B = pair[1];
      if (A.destroyed || B.destroyed) continue;
      if (A._sup && !B._sup) { B._sup = true; changed = true; }
      else if (B._sup && !A._sup) { A._sup = true; changed = true; }
    }
    if (!changed) break;
  }
  for (const b of bodies) {
    if (!b.isStatic && !b.destroyed && b.sleeping && !b._sup) { b.sleeping = false; b.sleepTime = 0; }
  }
  return bodies;
}
