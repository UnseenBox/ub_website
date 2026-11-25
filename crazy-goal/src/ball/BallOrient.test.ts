import { describe, expect, it } from 'vitest';
import { Ball, BALL_TUNING } from './Ball';

/** The angle between the ball's third axis now and at the start (the axis it starts with, z). */
function turnedBy(ball: Ball): number {
  const z = ball.orient[8];
  return Math.acos(Math.max(-1, Math.min(1, z)));
}

describe('the ball turns as it rolls', () => {
  it('turns by the distance it rolls over its radius, at the pace of the patches', () => {
    const ball = new Ball(0, 0);
    const speed = 100;
    ball.body.vx = speed;
    ball.body.vy = 0;
    const dt = 1 / 240;
    const steps = 120;
    for (let i = 0; i < steps; i++) ball.update(dt);
    const expected = (speed * steps * dt * BALL_TUNING.rollVisual) / ball.radius;
    // Short of half a turn, so the angle reads back without wrapping.
    expect(expected).toBeLessThan(Math.PI);
    expect(turnedBy(ball)).toBeCloseTo(expected, 4);
  });

  it('a ball at rest keeps its picture still', () => {
    const ball = new Ball(0, 0);
    const before = Array.from(ball.orient);
    for (let i = 0; i < 60; i++) ball.update(1 / 60);
    expect(Array.from(ball.orient)).toEqual(before);
  });
});
