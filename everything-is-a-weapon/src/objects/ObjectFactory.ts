import { Layer, RigidBody } from '../physics/RigidBody';
import { PhysicsObject } from '../entities/PhysicsObject';
import { MATERIALS } from './Materials';
import { ObjectRegistry } from './ObjectRegistry';

const OBJECT_MASK = Layer.Wall | Layer.Object | Layer.Player | Layer.Enemy;

/** Builds a PhysicsObject (body + gameplay state) from a registered definition id. */
export function createObject(id: string, x: number, y: number, angle = 0): PhysicsObject | null {
  const def = ObjectRegistry.get(id);
  if (!def) {
    console.warn(`[objects] unknown object id "${id}"`);
    return null;
  }
  const material = MATERIALS[def.material];
  const body = new RigidBody({
    type: def.fixed ? 'static' : 'dynamic',
    shape: def.shape,
    x,
    y,
    angle,
    mass: def.mass,
    friction: material.friction,
    restitution: def.restitution ?? material.restitution,
    groundFriction: def.groundFriction ?? (def.rolls ? 240 : 820),
    angularDrag: def.rolls ? 1.2 : def.mass > 30 ? 9 : 4.5,
    layer: Layer.Object,
    mask: OBJECT_MASK,
  });
  return new PhysicsObject(def, material, body);
}
