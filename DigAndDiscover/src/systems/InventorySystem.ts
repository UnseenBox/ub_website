import type { Rock } from '../core/types';

/** Fixed-slot bag. Rocks keep their slot until sold, so the UI never shuffles. */
export class InventorySystem {
  private readonly slots: (Rock | null)[];

  constructor(readonly capacity: number, private readonly onChange: () => void) {
    this.slots = new Array<Rock | null>(capacity).fill(null);
  }

  get(index: number): Rock | null {
    return this.slots[index] ?? null;
  }

  get count(): number {
    return this.slots.reduce((n, r) => (r ? n + 1 : n), 0);
  }

  get uncutCount(): number {
    return this.slots.reduce((n, r) => (r && !r.cut ? n + 1 : n), 0);
  }

  get isFull(): boolean {
    return this.slots.every((r) => r !== null);
  }

  indexOf(id: string): number {
    return this.slots.findIndex((r) => r?.id === id);
  }

  firstUncut(): Rock | null {
    return this.slots.find((r): r is Rock => r !== null && !r.cut) ?? null;
  }

  /** Returns the slot index used, or -1 when the bag is full. */
  add(rock: Rock): number {
    const index = this.slots.indexOf(null);
    if (index < 0) return -1;
    this.slots[index] = rock;
    this.onChange();
    return index;
  }

  remove(id: string): Rock | null {
    const index = this.indexOf(id);
    if (index < 0) return null;
    const rock = this.slots[index];
    this.slots[index] = null;
    this.onChange();
    return rock;
  }

  markCut(id: string): void {
    const rock = this.slots[this.indexOf(id)];
    if (!rock || rock.cut) return;
    rock.cut = true;
    this.onChange();
  }
}
