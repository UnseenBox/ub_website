import { ENEMY_TYPES, type EnemyTypeId } from '../entities/EnemyTypes';

export type IncidentKind = 'headliner' | 'enforcer';

export interface IncidentSpec {
  readonly kind: IncidentKind;
  readonly name: string;
  readonly line: string;
  readonly baseType: EnemyTypeId;
  readonly hpScale: number;
  readonly speedScale: number;
}

export interface PendingEnemy {
  readonly type: EnemyTypeId;
  delay: number;
  incident?: IncidentSpec;
}

/** Heavy footsteps start this long before the incident reaches the door. */
export const INCIDENT_WALK_LEAD = 4.7;
/** The release delay leaves room for the walk-in cue and the door knock. */
export const INCIDENT_RELEASE_LEAD = 5.2;

interface EnforcerEntry {
  readonly name: string;
  readonly line: string;
  readonly type: EnemyTypeId;
}

const ENFORCERS: readonly EnforcerEntry[] = [
  { name: 'THE FOREMAN', line: 'the building sent someone worse.', type: 'heavy' },
  { name: 'THE BAILIFF', line: 'he brought a shield to a furniture fight.', type: 'shield' },
  { name: 'THE INSPECTOR', line: 'everything here is a violation.', type: 'hurler' },
  { name: 'THE NIGHT SHIFT', line: 'nobody clocks out on his watch.', type: 'fast' },
  { name: 'THE CONTRACTOR', line: 'the quote did not include mercy.', type: 'bulwark' },
  { name: 'THE COLLECTOR', line: 'he is here for what you owe.', type: 'helmet' },
];

export const ENFORCER_NAMES = ENFORCERS.map((entry) => entry.name);

export function headlinerSpec(type: EnemyTypeId): IncidentSpec {
  const boss = ENEMY_TYPES[type];
  return {
    kind: 'headliner',
    name: boss.bossBanner ?? boss.name.toUpperCase(),
    line: boss.bossBlurb ?? boss.bossTitle ?? 'the main event has arrived.',
    baseType: type,
    hpScale: 1,
    speedScale: 1,
  };
}

export function enforcerSpec(index: number): IncidentSpec {
  const entry = ENFORCERS[((index % ENFORCERS.length) + ENFORCERS.length) % ENFORCERS.length]!;
  const depth = Math.max(0, index - 7);
  return {
    kind: 'enforcer',
    name: entry.name,
    line: entry.line,
    baseType: entry.type,
    hpScale: Math.min(3, 2.2 + depth * 0.1),
    speedScale: 1.15,
  };
}

/**
 * Sets the incident's walk-in delay. The remaining delay is what RoomManager uses
 * for the footsteps and the knock, so never spawn it on the same tick.
 */
export function releaseIncident(room: {
  elapsed: number;
  pending: PendingEnemy[];
  bossReleased: boolean;
}): boolean {
  const incident = room.pending.find((spec) => spec.incident);
  if (!incident) return false;
  incident.delay = room.elapsed + INCIDENT_RELEASE_LEAD;
  room.bossReleased = true;
  room.pending.sort((a, b) => a.delay - b.delay);
  return true;
}

/** Tier 1 pressure: regulars already queued outside hurry to the door. */
export function rushRegulars(room: { elapsed: number; pending: PendingEnemy[] }, lead = 2): void {
  for (const spec of room.pending) {
    if (spec.incident) continue;
    spec.delay = Math.min(spec.delay, room.elapsed + lead);
  }
  room.pending.sort((a, b) => a.delay - b.delay);
}
