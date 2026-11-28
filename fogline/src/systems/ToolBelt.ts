// Charges and cooldowns of the special tools carried into a battle.

import { TOOLS, TOOL_EFFECTS, type ToolId } from '../data/tools';

export interface ToolSlot {
  id: ToolId;
  charges: number;
  cooldownLeft: number;
}

export class ToolBelt {
  readonly slots: ToolSlot[];

  constructor(owned: readonly ToolId[]) {
    this.slots = TOOLS.filter((t) => owned.includes(t.id))
      .map((t) => ({ id: t.id, charges: TOOL_EFFECTS.start, cooldownLeft: 0 }));
  }

  slot(id: ToolId): ToolSlot | undefined {
    return this.slots.find((s) => s.id === id);
  }

  ready(id: ToolId): boolean {
    const s = this.slot(id);
    return !!s && s.charges > 0 && s.cooldownLeft <= 0;
  }

  /** Spends a charge. False when there is none, or it is still cooling. */
  use(id: ToolId): boolean {
    if (!this.ready(id)) return false;
    const s = this.slot(id)!;
    s.charges--;
    s.cooldownLeft = TOOL_EFFECTS.cooldown;
    return true;
  }

  /** A wave was cleared: one more of each, up to the most that can be held. */
  restock(): void {
    for (const s of this.slots) s.charges = Math.min(TOOL_EFFECTS.max, s.charges + 1);
  }

  update(dt: number): void {
    for (const s of this.slots) s.cooldownLeft = Math.max(0, s.cooldownLeft - dt);
  }
}
