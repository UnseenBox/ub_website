import { dist } from '../core/Mathx';
import type { Enemy } from './Enemy';

export type AlertType = 'cursor' | 'noise' | 'peer' | 'decoy';

export interface EnemyAlertEvent {
  sourceId: string;
  x: number;
  y: number;
  /** 0..1. How badly the sender wants everyone to look over there. */
  intensity: number;
  type: AlertType;
  /** Prevents an alert from ricocheting between two creatures forever. */
  hops: number;
}

/**
 * One creature noticing something should be able to ruin the whole room.
 *
 * Alerts are queued during a step and delivered at the end of it, so the order
 * creatures happen to update in cannot change the outcome.
 */
export class EnemyCommunication {
  private readonly queue: EnemyAlertEvent[] = [];
  private static readonly RANGE = 330;
  private static readonly MAX_HOPS = 2;

  broadcast(ev: EnemyAlertEvent): void {
    if (ev.hops > EnemyCommunication.MAX_HOPS) return;
    this.queue.push(ev);
  }

  /** Deliver everything queued this step. Returns the number of alerts handled. */
  dispatch(enemies: readonly Enemy[]): number {
    if (this.queue.length === 0) return 0;
    const batch = this.queue.splice(0, this.queue.length);
    for (const ev of batch) {
      for (const e of enemies) {
        if (e.id === ev.sourceId) continue;
        if (e.state.is('DEAD', 'DISABLED', 'PURSUING')) continue;
        const d = dist(e.x, e.y, ev.x, ev.y);
        const range = EnemyCommunication.RANGE * e.def.awareness.hearingScale;
        if (d > range) continue;
        const falloff = 1 - d / range;
        e.receiveAlert(ev, falloff);
      }
    }
    return batch.length;
  }

  clear(): void {
    this.queue.length = 0;
  }
}
