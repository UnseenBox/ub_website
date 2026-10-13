import type { Surface } from '../physics/Collider';
import type { MissKind } from '../goal/GoalDetector';
import type { MechEvent } from '../mechanics/Mechanic';

/** Everything gameplay announces. Feedback systems listen here instead of being called directly. */
export interface GameEvents {
  AIM_STARTED: { x: number; y: number };
  AIM_STEP: { step: number };
  AIM_CANCELLED: { x: number; y: number };
  BALL_LAUNCHED: { x: number; y: number; dirX: number; dirY: number; power: number; speed: number };
  /** `bounce` is the running bounce count of this shot, or 0 when the touch was too soft to count. */
  BALL_COLLIDED: { x: number; y: number; nx: number; ny: number; impact: number; surface: Surface; bodyId: number; bounce: number };
  BALL_HIT_POST: { x: number; y: number; impact: number };
  GOAL_SCORED: { x: number; y: number; speed: number; total: number; bounces: number; stars: number; newBest: boolean };
  SHOT_FAILED: { kind: MissKind; x: number; y: number };
  SHOT_RESET: { x: number; y: number };
  /** A mechanic did its thing: a tyre boinged, a pane broke, the cat made a save. */
  MECHANIC: MechEvent;
}

type Handler<P> = (payload: P) => void;

export class EventBus<E extends object> {
  private readonly handlers: { [K in keyof E]?: Handler<E[K]>[] } = {};

  on<K extends keyof E>(type: K, fn: Handler<E[K]>): () => void {
    const target: Handler<E[K]>[] = this.handlers[type] ?? [];
    this.handlers[type] = target;
    target.push(fn);
    return () => {
      const i = target.indexOf(fn);
      if (i >= 0) target.splice(i, 1);
    };
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const list = this.handlers[type];
    if (!list) return;
    for (let i = 0; i < list.length; i++) list[i](payload);
  }
}
