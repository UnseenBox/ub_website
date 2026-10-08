/**
 * The typed event vocabulary of the game. Systems talk through this bus so that,
 * for example, the audio layer can react to a noise without the interaction code
 * knowing that audio exists.
 */

import type { CursorStateName } from '../cursor/CursorState';
import type { EnemyStateName } from '../enemies/EnemyStateMachine';

export type NoiseKind =
  | 'tick'
  | 'switch'
  | 'metal'
  | 'glass'
  | 'ring'
  | 'radio'
  | 'door'
  | 'drawer'
  | 'alarm'
  | 'footstep'
  | 'object'
  | 'enemy';

export interface NoiseEvent {
  x: number;
  y: number;
  /** Loudness in the design units described in the brief: tick 1 ... alarm 25. */
  level: number;
  kind: NoiseKind;
  /** True when the player caused it, which is what scoring cares about. */
  byPlayer: boolean;
}

export interface GameEvents {
  CURSOR_MOVED: { x: number; y: number; speed: number };
  CURSOR_CLICKED: { x: number; y: number; button: number; onObject: string | null };
  CURSOR_STATE_CHANGED: { from: CursorStateName; to: CursorStateName };
  CURSOR_ENTERED_AWARENESS: { enemyId: string };
  CURSOR_LEFT_AWARENESS: { enemyId: string };
  CURSOR_LOST: { lost: boolean };

  OBJECT_INTERACTED: { objectId: string; kind: string; state: string };
  OBJECT_BROKEN: { objectId: string; kind: string };
  OBJECT_BLOCKED: { objectId: string; reason: 'out-of-reach' | 'locked' | 'spent' };
  NOISE_CREATED: NoiseEvent;

  ENEMY_STATE_CHANGED: { enemyId: string; kind: string; from: EnemyStateName; to: EnemyStateName };
  ENEMY_SUSPICIOUS: { enemyId: string; kind: string };
  ENEMY_INVESTIGATING: { enemyId: string; kind: string; x: number; y: number };
  ENEMY_ALERTED: { enemyId: string; kind: string; source: 'cursor' | 'noise' | 'peer' | 'decoy' };
  ENEMY_CALMED: { enemyId: string; kind: string };
  ENEMY_DISABLED: { enemyId: string; kind: string };

  PLAYER_DETECTED: { enemyId: string; kind: string };
  PLAYER_ESCAPED_DETECTION: { enemyId: string; heat: number };
  PLAYER_HIDDEN: { objectId: string };
  PLAYER_UNHIDDEN: { objectId: string };
  PLAYER_KILLED: { enemyId: string };

  DECOY_SPAWNED: { decoyId: string; pattern: string; sourceId: string | null };
  DECOY_EXPIRED: { decoyId: string };
  DECOY_FOOLED_ENEMY: { decoyId: string; enemyId: string };

  NEAR_MISS: { enemyId: string; heat: number };
  DISCOVERY_FOUND: { id: string };

  OBJECTIVE_PROGRESS: { text: string; done: boolean };
  ROOM_STARTED: { roomId: string; attempt: number };
  ROOM_COMPLETED: { roomId: string };
  ROOM_FAILED: { roomId: string; reason: string };

  TOAST: { text: string; tone: 'warm' | 'cool' | 'hot' };
  SHAKE: { amount: number };
}

export type GameEventName = keyof GameEvents;
