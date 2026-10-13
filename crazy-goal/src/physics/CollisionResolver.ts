import type { Contact } from './Collision';
import type { RigidBody } from './RigidBody';

/** Below this closing speed a bounce fades out, so the ball settles instead of buzzing. */
const REST_FADE = 90;
/** Share of the sliding speed a rolling sphere gives up at a contact (2/7 for a solid ball). */
const GRIP = 2 / 7;

/**
 * Pushes a moving circle out of a static body and reflects it.
 * Returns the closing speed along the normal (0 if the pair was already separating).
 */
export function resolveCircleStatic(a: RigidBody, r: number, other: RigidBody, c: Contact): number {
  a.x += c.nx * c.depth;
  a.y += c.ny * c.depth;

  const vn = a.vx * c.nx + a.vy * c.ny;
  if (vn >= 0) return 0;
  const impact = -vn;

  let e = a.restitution * other.restitution;
  if (impact < REST_FADE) e *= impact / REST_FADE;

  const tx = -c.ny;
  const ty = c.nx;
  const vt = a.vx * tx + a.vy * ty;

  // Friction acts on how fast the ball's skin slides along the surface, spin included.
  const slip = vt - a.angVel * r;
  const limit = other.friction * (1 + e) * impact;
  let jt = -slip * GRIP;
  if (jt > limit) jt = limit;
  else if (jt < -limit) jt = -limit;

  const outN = impact * e;
  const outT = vt + jt;
  a.vx = c.nx * outN + tx * outT;
  a.vy = c.ny * outN + ty * outT;
  a.angVel -= (jt * 2.5) / r;
  return impact;
}
