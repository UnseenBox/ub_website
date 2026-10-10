import { dist } from '../core/Mathx';
import type { InteractionStats } from '../interactions/InteractionSystem';
import type { Player } from '../player/Player';
import type { Room } from '../world/Room';

export type ObjectiveKind =
  | 'REACH_EXIT'
  | 'STEAL_AND_EXIT'
  | 'ACTIVATE_SWITCHES'
  | 'POWER_OFF'
  | 'DISTRACT'
  | 'WAKE_SLEEPER'
  | 'USE_DECOY';

export interface ObjectiveSpec {
  readonly kind: ObjectiveKind;
  /** Short line shown in the HUD. */
  readonly label: string;
  /** Inventory ids that must be held. */
  readonly items?: readonly string[];
  /** Object ids that must be switched on. */
  readonly switches?: readonly string[];
  /** Creature this objective is about. */
  readonly targetTag?: string;
  /** Id of the way out. Defaults to the first EXIT in the room. */
  readonly exitId?: string;
  /** Hard constraint: a single click fails the room. */
  readonly forbidClicks?: boolean;
  /** Hard constraint: being detected once fails the room rather than only costing score. */
  readonly forbidDetection?: boolean;
  /** Optional extra for score, never required. */
  readonly bonusLabel?: string;
}

export interface ObjectiveStep {
  text: string;
  done: boolean;
}

/**
 * Objectives as readable conditions over world state. Nothing here knows how the
 * player satisfied a step, which is what leaves room for several solutions.
 */
export class ObjectiveSystem {
  readonly steps: ObjectiveStep[] = [];
  complete = false;
  failReason: string | null = null;

  /** Latched once the target creature has been successfully distracted. */
  private distracted = false;
  private woke = false;
  private lastSummary = '';

  constructor(private spec: ObjectiveSpec) {
    this.rebuild();
  }

  setSpec(spec: ObjectiveSpec): void {
    this.spec = spec;
    this.reset();
  }

  reset(): void {
    this.complete = false;
    this.failReason = null;
    this.distracted = false;
    this.woke = false;
    this.rebuild();
  }

  private rebuild(): void {
    this.steps.length = 0;
    const s = this.spec;
    switch (s.kind) {
      case 'STEAL_AND_EXIT':
        this.steps.push({ text: s.label, done: false });
        break;
      case 'ACTIVATE_SWITCHES':
        this.steps.push({ text: s.label, done: false });
        break;
      case 'POWER_OFF':
        this.steps.push({ text: s.label, done: false });
        break;
      case 'DISTRACT':
        this.steps.push({ text: s.label, done: false });
        break;
      case 'WAKE_SLEEPER':
        this.steps.push({ text: s.label, done: false });
        break;
      case 'USE_DECOY':
        this.steps.push({ text: s.label, done: false });
        break;
      case 'REACH_EXIT':
        break;
    }
    this.steps.push({ text: 'GET OUT', done: false });
  }

  private exit(room: Room) {
    if (this.spec.exitId) return room.findObject(this.spec.exitId);
    return room.objects.find((o) => o.def.isExit);
  }

  update(room: Room, player: Player, stats: InteractionStats): void {
    const s = this.spec;

    if (s.forbidClicks && stats.clicks > 0 && !this.failReason) {
      this.failReason = 'YOU CLICKED';
    }

    // Latching observations, because "it was distracted" is a moment, not a state.
    if (s.targetTag) {
      const target = room.findEnemyByTag(s.targetTag);
      if (target) {
        if (target.lureTimer > 0.2) this.distracted = true;
        if (!target.asleep) this.woke = true;
      }
    }

    let primaryDone = true;
    if (this.steps.length > 1) {
      switch (s.kind) {
        case 'STEAL_AND_EXIT':
          primaryDone = (s.items ?? []).every((id) => player.inventory.has(id));
          break;
        case 'ACTIVATE_SWITCHES':
          primaryDone = (s.switches ?? []).every((id) => {
            const o = room.findObject(id);
            return !!o && (o.state === 'on' || o.state === 'open');
          });
          break;
        case 'POWER_OFF':
          primaryDone = room.lights.every((l) => !l.on);
          break;
        case 'DISTRACT':
          primaryDone = this.distracted;
          break;
        case 'WAKE_SLEEPER':
          primaryDone = this.woke;
          break;
        case 'USE_DECOY':
          primaryDone = stats.decoysUsed > 0;
          break;
        default:
          primaryDone = true;
      }
      this.steps[0].done = primaryDone;
    }

    const exit = this.exit(room);
    const exitOpen = !!exit && exit.state === 'open';
    const atExit = !!exit && dist(player.x, player.y, exit.x, exit.y) < 30;
    const out = this.steps[this.steps.length - 1];
    out.done = exitOpen && atExit && primaryDone;

    if (out.done && !this.complete && !this.failReason) this.complete = true;
  }

  /** One line for the HUD: the next thing that is not done. */
  get currentText(): string {
    for (const step of this.steps) {
      if (!step.done) {
        this.lastSummary = step.text;
        return step.text;
      }
    }
    return this.lastSummary || 'GET OUT';
  }

  get bonusLabel(): string | undefined {
    return this.spec.bonusLabel;
  }

  get forbidsDetection(): boolean {
    return this.spec.forbidDetection === true;
  }

  get forbidsClicks(): boolean {
    return this.spec.forbidClicks === true;
  }
}
