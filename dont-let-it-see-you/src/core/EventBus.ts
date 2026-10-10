import type { GameEventName, GameEvents } from './Events';

type Handler<K extends GameEventName> = (payload: GameEvents[K]) => void;

/**
 * Minimal typed pub/sub. Handlers are copied before dispatch so a listener can
 * subscribe or unsubscribe during its own callback without corrupting the walk.
 * Listener errors are contained: one bad subscriber must not stall a frame.
 */
export class EventBus {
  private readonly handlers = new Map<GameEventName, Set<Handler<GameEventName>>>();

  on<K extends GameEventName>(name: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(handler as Handler<GameEventName>);
    return () => {
      set!.delete(handler as Handler<GameEventName>);
    };
  }

  once<K extends GameEventName>(name: K, handler: Handler<K>): () => void {
    const off = this.on(name, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  emit<K extends GameEventName>(name: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(name);
    if (!set || set.size === 0) return;
    for (const handler of Array.from(set)) {
      try {
        (handler as Handler<K>)(payload);
      } catch (err) {
        console.error(`[events] handler for ${name} threw`, err);
      }
    }
  }

  /** Drop every listener. Used when tearing a room down. */
  clear(): void {
    this.handlers.clear();
  }
}
