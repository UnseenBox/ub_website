import { box, circle, Layer } from '../physics/Collider';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { createBody, type RigidBody } from '../physics/RigidBody';
import type { GoalDef } from '../levels/LevelDefinition';

/**
 * A goal set into the top rail, mouth facing down the pitch. Geometry only: posts you can
 * hit, a soft net behind them, and the area that counts as "in".
 */
export class Goal {
  readonly cx: number;
  readonly lineY: number;
  /** Clear opening between the posts. */
  readonly width: number;
  readonly depth: number;
  readonly postR = 10;
  /** How tall the frame stands; only used for drawing. */
  readonly height = 52;
  /** How far each side of the net leans in towards the back. */
  readonly taper = 14;
  readonly leftPostX: number;
  readonly rightPostX: number;
  readonly postY: number;
  readonly backY: number;
  /** Screen height of the crossbar, and of the net's top edge at the back. */
  readonly barY: number;
  readonly backTopY: number;
  readonly bodies: RigidBody[] = [];

  constructor(def: GoalDef) {
    this.cx = def.x;
    this.lineY = def.lineY;
    this.width = def.width;
    this.depth = def.depth;
    this.leftPostX = def.x - def.width / 2 - this.postR;
    this.rightPostX = def.x + def.width / 2 + this.postR;
    // Posts sit a touch proud of the rail so a shot can catch them.
    this.postY = def.lineY - this.postR + 3;
    this.backY = def.lineY - def.depth;
    this.barY = this.postY - this.height;
    this.backTopY = this.backY - this.height * 0.7;
  }

  addTo(world: PhysicsWorld): void {
    const add = (b: RigidBody): void => {
      this.bodies.push(world.addStatic(b));
    };
    for (const x of [this.leftPostX, this.rightPostX]) {
      add(createBody({ shape: circle(this.postR), surface: 'post', x, y: this.postY, restitution: 0.74, friction: 0.1 }));
    }
    // The net swallows almost all of the ball's energy.
    const net = { surface: 'net', layer: Layer.Net, restitution: 0.08, friction: 0.6 } as const;
    add(createBody({ ...net, shape: box(this.width + this.postR * 2, 12), x: this.cx, y: this.backY - 6 }));
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? this.leftPostX : this.rightPostX;
      const x1 = x0 - side * this.taper;
      const y0 = this.lineY - this.postR;
      const y1 = this.backY;
      add(
        createBody({
          ...net,
          shape: box(Math.hypot(x1 - x0, y1 - y0) + 8, 10),
          x: (x0 + x1) / 2 + side * 5,
          y: (y0 + y1) / 2,
          angle: Math.atan2(y1 - y0, x1 - x0),
        }),
      );
    }
  }

  /** True once the centre of the ball is properly over the line and between the posts. */
  contains(x: number, y: number): boolean {
    return y < this.lineY - 6 && y > this.backY - 4 && x > this.leftPostX && x < this.rightPostX;
  }

  /** Distance from a point to the open goal mouth. */
  distanceToMouth(x: number, y: number): number {
    const half = this.width / 2;
    const dx = Math.max(0, Math.abs(x - this.cx) - half);
    return Math.hypot(dx, y - this.lineY);
  }
}
