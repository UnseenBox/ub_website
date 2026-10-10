export type EnemyStateName =
  /** Asleep or switched off. Not evaluating much. */
  | 'IDLE'
  /** Awake and unbothered: patrolling or idling. */
  | 'CALM'
  /** Something registered. It stops and turns. */
  | 'SUSPICIOUS'
  /** It is walking to where the attention was. */
  | 'INVESTIGATING'
  /** It knows something is wrong and is moving fast. */
  | 'ALERT'
  /** It has you. */
  | 'PURSUING'
  /** It lost you and is sweeping the area. */
  | 'SEARCHING'
  /** Heading back to its post. */
  | 'RETURNING'
  /** Stunned by the environment. */
  | 'DISABLED'
  | 'DEAD';

/**
 * Records which state a creature is in and for how long. The transition *rules*
 * live in Enemy, because they are awareness-driven; this only keeps the books so
 * every creature reports state changes the same way.
 */
export class EnemyStateMachine {
  current: EnemyStateName;
  previous: EnemyStateName;
  timeInState = 0;
  /** Set on the step a state is entered, cleared at the end of that step. */
  justEntered = true;

  constructor(initial: EnemyStateName) {
    this.current = initial;
    this.previous = initial;
  }

  set(next: EnemyStateName): boolean {
    if (next === this.current) return false;
    this.previous = this.current;
    this.current = next;
    this.timeInState = 0;
    this.justEntered = true;
    return true;
  }

  advance(dt: number): void {
    this.timeInState += dt;
  }

  endStep(): void {
    this.justEntered = false;
  }

  is(...states: EnemyStateName[]): boolean {
    return states.includes(this.current);
  }
}

/** Ordering used for "most alarmed creature in the room" readouts. */
export const STATE_RANK: Readonly<Record<EnemyStateName, number>> = {
  DEAD: 0,
  DISABLED: 0,
  IDLE: 1,
  CALM: 2,
  RETURNING: 3,
  SEARCHING: 4,
  SUSPICIOUS: 5,
  INVESTIGATING: 6,
  ALERT: 7,
  PURSUING: 8,
};
