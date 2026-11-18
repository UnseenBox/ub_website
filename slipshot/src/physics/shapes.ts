import * as planck from 'planck';

export interface ShapeArea {
  shape: planck.Shape;
  area: number;
}

export interface FixtureEntry extends ShapeArea {
  userData: unknown;
  /** Overrides the body-level friction for this fixture (e.g. feet). */
  friction?: number;
}

/** A capsule (stadium) built from a box plus two end circles. */
export function capsuleShapes(a: planck.Vec2Value, b: planck.Vec2Value, r: number): ShapeArea[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const hx = len / 2;
  const box = new planck.Box(hx, r, new planck.Vec2((a.x + b.x) / 2, (a.y + b.y) / 2), Math.atan2(dy, dx));
  const circleArea = Math.PI * r * r;
  return [
    { shape: box, area: 4 * hx * r },
    { shape: new planck.Circle(new planck.Vec2(a.x, a.y), r), area: circleArea },
    { shape: new planck.Circle(new planck.Vec2(b.x, b.y), r), area: circleArea },
  ];
}

export function circleShape(center: planck.Vec2Value, r: number): ShapeArea {
  return { shape: new planck.Circle(new planck.Vec2(center.x, center.y), r), area: Math.PI * r * r };
}

export function boxShape(hx: number, hy: number, center: planck.Vec2Value, angle = 0): ShapeArea {
  return {
    shape: new planck.Box(hx, hy, new planck.Vec2(center.x, center.y), angle),
    area: 4 * hx * hy,
  };
}

/**
 * Attach fixtures so the body's total mass equals `mass`. Density is derived
 * from the summed shape areas, which is exactly how Planck computes mass, so
 * overlapping capsule end-circles do not skew the result.
 */
export function addMassFixtures(
  body: planck.Body,
  entries: FixtureEntry[],
  mass: number,
  opts: { friction: number; restitution: number; filterGroupIndex?: number },
): void {
  const totalArea = entries.reduce((s, e) => s + e.area, 0);
  const density = mass / totalArea;
  for (const e of entries) {
    body.createFixture(e.shape, {
      density,
      friction: e.friction ?? opts.friction,
      restitution: opts.restitution,
      filterGroupIndex: opts.filterGroupIndex ?? 0,
      userData: e.userData,
    });
  }
}
