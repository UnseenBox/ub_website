import { SLIME } from '../config';
import type { Tag } from './tags';

/** Dry friction of the rig's parts (see rig.ts). Slime and grip blend between these and the coated values. */
const NORMAL_BODY_FRICTION = 0.5;
const NORMAL_FOOT_FRICTION = 0.95;

/**
 * Friction override for a contact side. Returns null when that side is not
 * slimed. PhysicsManager applies the minimum of both sides through
 * Contact.setFriction() inside the pre-solve callback, so the solver itself
 * uses the reduced value. Nothing here fakes motion.
 */
export function slimeFrictionFor(tag: Tag): number | null {
  switch (tag.kind) {
    case 'puddle':
      return tag.puddle.friction;
    case 'part': {
      if (tag.ragdoll.slimeTimer <= 0) return null;
      // Grip upgrades blend the slimed friction back toward the normal value.
      const slimed = tag.foot ? SLIME.coatFootFriction : SLIME.coatBodyFriction;
      const normal = tag.foot ? NORMAL_FOOT_FRICTION : NORMAL_BODY_FRICTION;
      return slimed + (normal - slimed) * tag.ragdoll.slipResist;
    }
    case 'object':
      return tag.obj.slimeTimer > 0 ? SLIME.coatObjectFriction : null;
    default:
      return null;
  }
}
