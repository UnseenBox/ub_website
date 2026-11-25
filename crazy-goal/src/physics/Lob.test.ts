import { describe, expect, it } from 'vitest';
import { box, circle, Layer } from './Collider';
import { KICK, launchVz } from './Flight';
import { FIXED_DT, PhysicsWorld } from './PhysicsWorld';
import { createBody } from './RigidBody';

describe('the lob an AIR shot is struck with', () => {
  it('rises higher with more power, within its range', () => {
    expect(launchVz(0)).toBe(KICK.vzMin);
    expect(launchVz(1)).toBe(KICK.vzMax);
    expect(launchVz(-1)).toBe(KICK.vzMin);
    expect(launchVz(3)).toBe(KICK.vzMax);
  });

  it('even the lowest lob peaks above a car, and the highest goes higher', () => {
    const apex = (vz: number): number => (vz * vz) / (2 * KICK.gravity);
    expect(apex(KICK.vzMin)).toBeGreaterThan(44);
    expect(apex(KICK.vzMax)).toBeGreaterThan(apex(KICK.vzMin));
  });
});

/**
 * Fires a ball at a box that stands in its path (x 80 to 120) and returns how far it gets in a second.
 * `clear` is the box's clearance; `undefined` makes it solid at every height, as the boundary is.
 */
function runInto(clear: number | undefined, z: number, vz: number): number {
  const world = new PhysicsWorld();
  world.addStatic(createBody({ shape: box(40, 200), surface: 'car', x: 100, y: 0, angle: 0, restitution: 0.5, friction: 0.1, clear }));
  // The ball is a moving body on the ball layer, as the game builds it: it hits solids, not other balls.
  const ball = createBody({
    shape: circle(10),
    surface: 'wall',
    isStatic: false,
    layer: Layer.Ball,
    mask: Layer.Solid | Layer.Net,
    x: 0,
    y: 0,
    restitution: 0.8,
    friction: 0.1,
  });
  ball.vx = 600;
  ball.z = z;
  ball.vz = vz;
  for (let t = 0; t < 1; t += FIXED_DT) world.stepBody(ball, FIXED_DT, null);
  return ball.x;
}

describe('a lofted ball over the objects in a level', () => {
  it('a full-power lob flies over a car, and a ball on the ground is stopped by it', () => {
    expect(runInto(44, 0.01, launchVz(1))).toBeGreaterThan(120);
    expect(runInto(44, 0, 0)).toBeLessThan(80);
  });

  it('a boundary wall, solid at every height, stops even the highest lob', () => {
    expect(runInto(undefined, 0.01, launchVz(1))).toBeLessThan(80);
  });
});
