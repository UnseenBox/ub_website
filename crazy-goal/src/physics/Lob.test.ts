import { describe, expect, it } from 'vitest';
import { box, circle, Layer } from './Collider';
import { ALTITUDE, altitudeVz, autoAltitude, HEIGHT_KEY_STEP, KICK, launchVz, lobVz, snapHeight } from './Flight';
import { FIXED_DT, PhysicsWorld } from './PhysicsWorld';
import { createBody } from './RigidBody';

describe('the height of a lob', () => {
  it('runs from the lowest lob to the highest, and clamps outside that', () => {
    expect(altitudeVz(0)).toBe(ALTITUDE.vzMin);
    expect(altitudeVz(1)).toBe(ALTITUDE.vzMax);
    expect(altitudeVz(-2)).toBe(ALTITUDE.vzMin);
    expect(altitudeVz(5)).toBe(ALTITUDE.vzMax);
  });

  it('the automatic height is the lob the power gives', () => {
    for (const power of [0, 0.25, 0.5, 0.75, 1]) {
      expect(altitudeVz(autoAltitude(power))).toBeCloseTo(launchVz(power), 6);
      expect(lobVz(power, null)).toBe(launchVz(power));
    }
  });

  it('a picked height overrides the power', () => {
    expect(lobVz(0.1, 0.9)).toBe(altitudeVz(0.9));
    expect(lobVz(1, 0)).toBe(ALTITUDE.vzMin);
  });

  it('the lowest lob still rises above a car, and the highest goes higher', () => {
    const apex = (vz: number): number => (vz * vz) / (2 * KICK.gravity);
    expect(apex(ALTITUDE.vzMin)).toBeGreaterThan(44);
    expect(apex(ALTITUDE.vzMax)).toBeGreaterThan(apex(ALTITUDE.vzMin));
  });

  it('a picked height lands on twentieths, and one key press moves a tenth', () => {
    expect(snapHeight(0.52)).toBe(0.5);
    expect(snapHeight(0.53)).toBe(0.55);
    expect(snapHeight(-1)).toBe(0);
    expect(snapHeight(3)).toBe(1);
    expect(HEIGHT_KEY_STEP).toBeCloseTo(0.1, 6);
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
  it('a high lob flies over a car, and a ball on the ground is stopped by it', () => {
    expect(runInto(44, 0.01, altitudeVz(0.7))).toBeGreaterThan(120);
    expect(runInto(44, 0, 0)).toBeLessThan(80);
  });

  it('a lob too low for the car is stopped by it', () => {
    expect(runInto(44, 0.01, altitudeVz(0))).toBeLessThan(80);
  });

  it('a boundary wall, solid at every height, stops even the highest lob', () => {
    expect(runInto(undefined, 0.01, altitudeVz(1))).toBeLessThan(80);
  });
});
