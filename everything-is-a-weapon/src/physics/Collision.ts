import type { BoxShape, CircleShape, RigidBody } from './RigidBody';

/** Narrow-phase result. The normal always points from body A towards body B. */
export interface Manifold {
  nx: number;
  ny: number;
  depth: number;
  px: number;
  py: number;
}

export function createManifold(): Manifold {
  return { nx: 1, ny: 0, depth: 0, px: 0, py: 0 };
}

export function collide(a: RigidBody, b: RigidBody, m: Manifold): boolean {
  const sa = a.shape;
  const sb = b.shape;
  if (sa.kind === 'circle') {
    if (sb.kind === 'circle') return circleCircle(a, sa, b, sb, m);
    return circleBox(a, sa, b, sb, m, false);
  }
  if (sb.kind === 'circle') return circleBox(b, sb, a, sa, m, true);
  return boxBox(a, sa, b, sb, m);
}

function circleCircle(a: RigidBody, sa: CircleShape, b: RigidBody, sb: CircleShape, m: Manifold): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const r = sa.r + sb.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  const d = Math.sqrt(d2);
  if (d < 1e-6) {
    m.nx = 1;
    m.ny = 0;
  } else {
    m.nx = dx / d;
    m.ny = dy / d;
  }
  m.depth = r - d;
  m.px = a.x + m.nx * (sa.r - m.depth * 0.5);
  m.py = a.y + m.ny * (sa.r - m.depth * 0.5);
  return true;
}

/** `boxIsA` says which body is A in the caller's ordering, so the normal can be flipped accordingly. */
function circleBox(
  circle: RigidBody,
  sc: CircleShape,
  box: RigidBody,
  sb: BoxShape,
  m: Manifold,
  boxIsA: boolean,
): boolean {
  const cos = Math.cos(box.angle);
  const sin = Math.sin(box.angle);
  const dx = circle.x - box.x;
  const dy = circle.y - box.y;
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;

  const cx = lx < -sb.hw ? -sb.hw : lx > sb.hw ? sb.hw : lx;
  const cy = ly < -sb.hh ? -sb.hh : ly > sb.hh ? sb.hh : ly;

  // Local normal pointing from the box towards the circle.
  let nlx: number;
  let nly: number;
  let depth: number;
  let qx = cx;
  let qy = cy;

  if (cx === lx && cy === ly) {
    // Circle centre is inside the box: push out through the nearest face.
    const ex = sb.hw - Math.abs(lx);
    const ey = sb.hh - Math.abs(ly);
    if (ex < ey) {
      nlx = lx < 0 ? -1 : 1;
      nly = 0;
      depth = sc.r + ex;
      qx = nlx * sb.hw;
    } else {
      nlx = 0;
      nly = ly < 0 ? -1 : 1;
      depth = sc.r + ey;
      qy = nly * sb.hh;
    }
  } else {
    const ddx = lx - cx;
    const ddy = ly - cy;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 >= sc.r * sc.r) return false;
    const d = Math.sqrt(d2);
    nlx = ddx / d;
    nly = ddy / d;
    depth = sc.r - d;
  }

  const nwx = nlx * cos - nly * sin;
  const nwy = nlx * sin + nly * cos;
  m.px = box.x + qx * cos - qy * sin;
  m.py = box.y + qx * sin + qy * cos;
  m.depth = depth;
  if (boxIsA) {
    m.nx = nwx;
    m.ny = nwy;
  } else {
    m.nx = -nwx;
    m.ny = -nwy;
  }
  return true;
}

function boxBox(a: RigidBody, A: BoxShape, b: RigidBody, B: BoxShape, m: Manifold): boolean {
  const ca = Math.cos(a.angle);
  const sa = Math.sin(a.angle);
  const cb = Math.cos(b.angle);
  const sb = Math.sin(b.angle);
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  let best = Infinity;
  let bnx = 1;
  let bny = 0;

  // Separating-axis test over the two face normals of each box.
  for (let i = 0; i < 4; i++) {
    let ax: number;
    let ay: number;
    if (i === 0) {
      ax = ca;
      ay = sa;
    } else if (i === 1) {
      ax = -sa;
      ay = ca;
    } else if (i === 2) {
      ax = cb;
      ay = sb;
    } else {
      ax = -sb;
      ay = cb;
    }
    const ra = A.hw * Math.abs(ca * ax + sa * ay) + A.hh * Math.abs(-sa * ax + ca * ay);
    const rb = B.hw * Math.abs(cb * ax + sb * ay) + B.hh * Math.abs(-sb * ax + cb * ay);
    const t = dx * ax + dy * ay;
    const overlap = ra + rb - Math.abs(t);
    if (overlap <= 0) return false;
    // The small bias keeps the chosen axis from flickering between near-equal candidates.
    if (overlap < best - 0.01) {
      best = overlap;
      const s = t < 0 ? -1 : 1;
      bnx = ax * s;
      bny = ay * s;
    }
  }

  m.nx = bnx;
  m.ny = bny;
  m.depth = best;

  // Contact point: average of every corner of one box that lies inside the other.
  let count = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < 4; i++) {
    const ix = i < 2 ? 1 : -1;
    const iy = i % 2 === 0 ? 1 : -1;
    const bx = b.x + cb * B.hw * ix - sb * B.hh * iy;
    const by = b.y + sb * B.hw * ix + cb * B.hh * iy;
    if (a.containsPoint(bx, by, 0.6)) {
      sx += bx;
      sy += by;
      count++;
    }
    const axw = a.x + ca * A.hw * ix - sa * A.hh * iy;
    const ayw = a.y + sa * A.hw * ix + ca * A.hh * iy;
    if (b.containsPoint(axw, ayw, 0.6)) {
      sx += axw;
      sy += ayw;
      count++;
    }
  }
  if (count > 0) {
    m.px = sx / count;
    m.py = sy / count;
  } else {
    m.px = (a.x + b.x) * 0.5;
    m.py = (a.y + b.y) * 0.5;
  }
  return true;
}
