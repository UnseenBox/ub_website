import { GADGET_OBJECTS } from './GadgetObjects';
import { HOUSE_OBJECTS } from './HouseObjects';
import { MORE_OBJECTS } from './MoreObjects';
import { OBJECT_DEFINITIONS, type ObjectDefinition } from './ObjectDefinitions';
import { PICKUP_OBJECTS } from './PickupObjects';

class Registry {
  private readonly definitions = new Map<string, ObjectDefinition>();

  constructor(initial: readonly ObjectDefinition[]) {
    for (const def of initial) this.register(def);
  }

  register(def: ObjectDefinition): void {
    if (this.definitions.has(def.id)) console.warn(`[objects] "${def.id}" registered twice; replacing.`);
    this.definitions.set(def.id, def);
  }

  get(id: string): ObjectDefinition | undefined {
    return this.definitions.get(id);
  }

  ids(): string[] {
    return [...this.definitions.keys()];
  }
}

export const ObjectRegistry = new Registry([...OBJECT_DEFINITIONS, ...HOUSE_OBJECTS, ...GADGET_OBJECTS, ...PICKUP_OBJECTS, ...MORE_OBJECTS]);
