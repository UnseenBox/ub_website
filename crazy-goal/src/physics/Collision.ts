import type { RigidBody } from './RigidBody';

export interface Contact {
  /** Unit normal pointing from the other body towards the circle. */
  nx: number;
  ny: number;
  depth: number;
  /** Contact point on the other body's surface. */
  px: number;
  py: number;
}

export const emptyContact = (): Contact => ({ nx: 0, ny: 1, depth: 0, px: 0, py: 0 });

/** Tests a circle against a circle or a (rotated) box. Fills `out` and returns true on overlap. */
export function circleVsBody(cx: number, cy: number, r: number, b: RigidBody, out: Contact): boolean {
  const dx = cx - b.x;
  const dy = cy - b.y;

  if (b.shape.kind === 'circle') {
    const reach = r + b.shape.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= reach * reach) return false;
    const d = Math.sqrt(d2);
    if (d > 1e-6) {
      out.nx = dx / d;
      out.ny = dy / d;
    } else {
      out.nx = 0;
      out.ny = 1;
    }
    out.depth = reach - d;
    out.px = b.x + out.nx * b.shape.r;
    out.py = b.y + out.ny * b.shape.r;
    return true;
  }

  // Work in the box's own frame, where it is axis aligned.
  const { hw, hh } = b.shape;
  const lx = dx * b.cos + dy * b.sin;
  const ly = -dx * b.sin + dy * b.cos;
  let qx = lx < -hw ? -hw : lx > hw ? hw : lx;
  let qy = ly < -hh ? -hh : ly > hh ? hh : ly;
  const ex = lx - qx;
  const ey = ly - qy;
  const d2 = ex * ex + ey * ey;
  if (d2 >= r * r) return false;

  let nlx: number;
  let nly: number;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    nlx = ex / d;
    nly = ey / d;
    out.depth = r - d;
  } else {
    // Centre is inside the box: leave through the nearest face.
    const penX = hw - Math.abs(lx);
    const penY = hh - Math.abs(ly);
    if (penX < penY) {
      nlx = lx < 0 ? -1 : 1;
      nly = 0;
      qx = nlx * hw;
      out.depth = penX + r;
    } else {
      nlx = 0;
      nly = ly < 0 ? -1 : 1;
      qy = nly * hh;
      out.depth = penY + r;
    }
  }
  out.nx = nlx * b.cos - nly * b.sin;
  out.ny = nlx * b.sin + nly * b.cos;
  out.px = b.x + qx * b.cos - qy * b.sin;
  out.py = b.y + qx * b.sin + qy * b.cos;
  return true;
}
