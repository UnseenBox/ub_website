import type { EnemyTypeId } from '../entities/EnemyTypes';
import type { ZoneKind } from '../hazards/Zone';

export type Side = 'left' | 'right' | 'top' | 'bottom';

/** Which part of the flat this is: decides the floor, the walls and what hangs on them. */
export type RoomTheme =
  | 'bedroom' | 'office' | 'bathroom' | 'living' | 'kitchen' | 'garage'
  | 'garden' | 'pool' | 'jail' | 'porch' | 'basement';

export interface DoorSpec {
  readonly side: Side;
  /** Position along that wall, in room units from its left/top end. */
  readonly pos: number;
}

export interface RoomObjectSpec {
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly angle?: number;
  /** Index (in this room's object list) of the surface this object sits on. */
  readonly on?: number;
}

export interface RoomZoneSpec {
  readonly kind: ZoneKind;
  readonly x: number;
  readonly y: number;
  readonly r: number;
  /** A wall socket: an electricity source that only matters once water reaches it. */
  readonly outlet?: boolean;
}

export interface RoomEnemySpec {
  readonly type: EnemyTypeId;
  /** Seconds after the room starts before this intruder walks in. */
  readonly delay: number;
}

export interface RugSpec {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: string;
}

/** How a generated room is won. Omitted: kill everything that walks in. */
export interface RoomObjective {
  /** Survive the clock: whoever is left standing flees when it runs out. */
  readonly kind: 'survive';
  /** Seconds to stay breathing. */
  readonly seconds: number;
}

/** A room is pure data. Coordinates are in interior space: (0,0) is the top-left floor corner. */
export interface RoomDefinition {
  readonly id: string;
  readonly name: string;
  readonly theme?: RoomTheme;
  readonly width: number;
  readonly height: number;
  readonly objects: readonly RoomObjectSpec[];
  readonly zones: readonly RoomZoneSpec[];
  readonly enemies: readonly RoomEnemySpec[];
  /** Optional boss for this room (replaces the every-third-room Landlord here). */
  readonly boss?: EnemyTypeId;
  readonly entrance: DoorSpec;
  readonly exit: DoorSpec;
  readonly playerStart: { readonly x: number; readonly y: number };
  readonly rug?: RugSpec;
  readonly challenge?: string;
  readonly tutorial?: boolean;
  /** One line on what is new here: shown on the way in, and on the door from the room before. */
  readonly teaser?: string;
  /** Object ids that glow on a first visit: this room's new toys. */
  readonly spotlight?: readonly string[];
  /** Seed for gameplay randomness in this room, so it can be replayed exactly. */
  readonly seed: number;
  /** Non-extermination win condition (generated depths only). */
  readonly objective?: RoomObjective;
}

export function doorPosition(room: RoomDefinition, door: DoorSpec, inset: number): { x: number; y: number; dirX: number; dirY: number } {
  switch (door.side) {
    case 'left':
      return { x: inset, y: door.pos, dirX: 1, dirY: 0 };
    case 'right':
      return { x: room.width - inset, y: door.pos, dirX: -1, dirY: 0 };
    case 'top':
      return { x: door.pos, y: inset, dirX: 0, dirY: 1 };
    case 'bottom':
      return { x: door.pos, y: room.height - inset, dirX: 0, dirY: -1 };
  }
}
