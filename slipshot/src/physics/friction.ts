import { SLIME } from '../config';
import type { Tag } from './tags';

/**
 * Friction override for a contact side. Returns null when that side is not
 * slimed. PhysicsManager applies the minimum of both sides through
 * Contact.setFriction() inside the pre-solve callback, so the solver itself
 * uses the reduced value. Nothing here fakes motion.
 */
export function slimeFrictionFor(tag: Tag): number | null {
  switch (tag.kind) {
    case 'puddle':
      return SLIME.puddleFriction;
    case 'part':
      if (tag.ragdoll.slimeTimer <= 0) return null;
      return tag.foot ? SLIME.coatFootFriction : SLIME.coatBodyFriction;
    case 'object':
      return tag.obj.slimeTimer > 0 ? SLIME.coatObjectFriction : null;
    default:
      return null;
  }
}
