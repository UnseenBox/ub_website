import type { Chain, ChainRoot, Thing } from '../core/types';

/** A link stops counting as part of a chain reaction once it has been idle this long. */
export const CHAIN_FRESH_SECONDS = 8;

let nextChainId = 1;

export function startChain(now: number, originUid: number, originLabel: string): Chain {
  const root: ChainRoot = {
    id: nextChainId++,
    startedAt: now,
    originUid,
    originLabel,
    kills: 0,
    maxLen: 1,
    rewardedLen: 0,
  };
  return { root, steps: [originLabel] };
}

export function freshChain(thing: Thing | null, now: number): Chain | null {
  if (!thing || !thing.chain) return null;
  return now - thing.chainAt <= CHAIN_FRESH_SECONDS ? thing.chain : null;
}

export function extendChain(chain: Chain, label: string): Chain {
  const steps = [...chain.steps, label];
  if (steps.length > chain.root.maxLen) chain.root.maxLen = steps.length;
  return { root: chain.root, steps };
}

/**
 * Hands the cause-and-effect history from one thing to the thing it just affected.
 * A thing can only appear once per chain, so two objects rattling against each other
 * cannot inflate the count.
 */
export function passChain(from: Thing, to: Thing, now: number): Chain | null {
  if (to.kind === 'wall') return null;
  const incoming = freshChain(from, now);
  if (!incoming) return null;
  const existing = freshChain(to, now);
  if (existing) {
    if (existing.root === incoming.root) {
      to.chainAt = now;
      return existing;
    }
    // A newer chain never gets overwritten by a stale one. Without this, re-throwing a book at
    // an intruder it already hit would inherit the intruder's old chain and count as a "reaction".
    if (existing.root.startedAt > incoming.root.startedAt) return existing;
    if (existing.root.startedAt === incoming.root.startedAt && existing.steps.length > incoming.steps.length) return existing;
  }
  const extended = extendChain(incoming, to.label);
  to.chain = extended;
  to.chainAt = now;
  return extended;
}
