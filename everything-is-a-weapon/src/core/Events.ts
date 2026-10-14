import type { DamageCause, Thing } from './types';
import type { PhysicsObject } from '../entities/PhysicsObject';
import type { Enemy } from '../entities/Enemy';
import type { InteractionRule } from '../interactions/InteractionRule';

export type GameEvent =
  | { type: 'OBJECT_HIT'; a: Thing; b: Thing; impulse: number; x: number; y: number }
  | { type: 'OBJECT_DAMAGED'; object: PhysicsObject }
  | { type: 'OBJECT_BROKEN'; object: PhysicsObject }
  | { type: 'OBJECT_DESTROYED'; object: PhysicsObject }
  | { type: 'OBJECT_FALLEN'; object: PhysicsObject }
  | { type: 'OBJECT_ACTIVATED'; object: PhysicsObject }
  | { type: 'OBJECT_GRABBED'; object: PhysicsObject }
  | { type: 'OBJECT_THROWN'; object: PhysicsObject; charge: number }
  | { type: 'OBJECT_LANDED'; object: PhysicsObject; speed: number }
  | { type: 'ELECTRICITY_CONTACT'; target: Thing }
  | { type: 'WATER_CONTACT'; target: Thing }
  | { type: 'FIRE_CONTACT'; target: Thing }
  | { type: 'ENEMY_HIT'; enemy: Enemy; damage: number; cause: DamageCause }
  | { type: 'ENEMY_STUNNED'; enemy: Enemy }
  | { type: 'ENEMY_DEFEATED'; enemy: Enemy; cause: DamageCause }
  | { type: 'PLAYER_HIT'; cause: string }
  | { type: 'PLAYER_DEFEATED' }
  | { type: 'EXPLOSION'; x: number; y: number; radius: number }
  | { type: 'NOISE'; x: number; y: number; loudness: number }
  | { type: 'RULE_FIRED'; rule: InteractionRule; source: Thing; target: Thing | null; x: number; y: number }
  | { type: 'DISCOVERY'; id: string; isNew: boolean }
  | { type: 'CHAIN'; length: number; steps: readonly string[] }
  | { type: 'ROOM_START'; room: number }
  | { type: 'ROOM_COMPLETE'; room: number }
  | { type: 'ROOM_FAIL'; room: number };

export type GameEventType = GameEvent['type'];
type EventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
type Handler<T extends GameEventType> = (event: EventOf<T>) => void;

/**
 * Central gameplay event bus. Systems never call each other directly for reactions;
 * they emit facts ("object broken") and whoever cares listens.
 */
export class EventBus {
  private handlers = new Map<GameEventType, Array<(event: GameEvent) => void>>();
  private anyHandlers: Array<(event: GameEvent) => void> = [];

  on<T extends GameEventType>(type: T, handler: Handler<T>): void {
    let list = this.handlers.get(type);
    if (!list) {
      list = [];
      this.handlers.set(type, list);
    }
    list.push(handler as (event: GameEvent) => void);
  }

  onAny(handler: (event: GameEvent) => void): void {
    this.anyHandlers.push(handler);
  }

  emit(event: GameEvent): void {
    const list = this.handlers.get(event.type);
    if (list) {
      for (let i = 0; i < list.length; i++) this.safeCall(list[i]!, event);
    }
    for (let i = 0; i < this.anyHandlers.length; i++) this.safeCall(this.anyHandlers[i]!, event);
  }

  // One broken listener must never take the simulation down with it.
  private safeCall(handler: (event: GameEvent) => void, event: GameEvent): void {
    try {
      handler(event);
    } catch (error) {
      console.error(`[events] handler for ${event.type} failed`, error);
    }
  }
}
