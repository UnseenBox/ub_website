import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audio } from '../audio/AudioManager';
import { MIDGAME_GAP_S, MIDGAME_MIN_WINS, REWARD_GAP_S, midgameAllowed, rewardAllowed, rewardWait } from './adRules';
import type { CrazySdk } from './Portal';
import { Portal } from './Portal';
import type { KeyValueStore } from '../systems/Profile';

describe('ad rules', () => {
  const base = { adsReady: true, adOpen: false, now: 10_000, last: 0 };

  it('keeps midgame breaks out of the first missions and three minutes apart', () => {
    expect(midgameAllowed({ ...base, wins: MIDGAME_MIN_WINS - 1 })).toBe(false);
    expect(midgameAllowed({ ...base, wins: MIDGAME_MIN_WINS })).toBe(true);
    expect(midgameAllowed({ ...base, wins: 9, last: base.now - MIDGAME_GAP_S + 1 })).toBe(false);
    expect(midgameAllowed({ ...base, wins: 9, last: base.now - MIDGAME_GAP_S })).toBe(true);
    expect(MIDGAME_GAP_S).toBeGreaterThanOrEqual(180);
  });

  it('never shows anything with ads off or one already open', () => {
    expect(midgameAllowed({ ...base, adsReady: false, wins: 9 })).toBe(false);
    expect(rewardAllowed({ ...base, adsReady: false })).toBe(false);
    expect(rewardAllowed({ ...base, adOpen: true })).toBe(false);
  });

  it('spaces rewarded ads out', () => {
    expect(rewardAllowed(base)).toBe(true);
    expect(rewardAllowed({ ...base, last: base.now - 5 })).toBe(false);
    expect(rewardWait(base.now, base.now - 5)).toBe(REWARD_GAP_S - 5);
    expect(rewardWait(base.now, 0)).toBe(0);
  });
});

class MemoryStore implements KeyValueStore {
  readonly map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
}

/** A stand-in for the CrazyGames SDK that records calls and lets the test finish or fail ads. */
function fakeSdk(environment = 'local') {
  const calls: string[] = [];
  let pending: { finished?: () => void; error?: (e: unknown) => void } = {};
  const data = new MemoryStore();
  const sdk: CrazySdk = {
    environment,
    init: async () => undefined,
    game: {
      loadingStart: () => calls.push('loadingStart'),
      loadingStop: () => calls.push('loadingStop'),
      gameplayStart: () => calls.push('gameplayStart'),
      gameplayStop: () => calls.push('gameplayStop'),
      happytime: () => calls.push('happytime'),
      settings: { muteAudio: false },
    },
    ad: {
      requestAd: (type, cb) => {
        calls.push(`ad:${type}`);
        pending = { finished: cb?.adFinished, error: cb?.adError };
      },
    },
    data,
  };
  return { sdk, calls, data, finish: () => pending.finished?.(), fail: () => pending.error?.(new Error('no fill')) };
}

describe('Portal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 2, 1, 12));
    (globalThis as unknown as { window: unknown }).window = globalThis;
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as unknown as { CrazyGames?: unknown }).CrazyGames;
  });

  async function boot(adsOn = true, environment = 'local') {
    const f = fakeSdk(environment);
    (globalThis as unknown as { CrazyGames: unknown }).CrazyGames = { SDK: f.sdk };
    const p = new Portal({ portal: 'crazygames', adsOn });
    return { p, ...f };
  }

  it('does nothing at all outside the CrazyGames build', async () => {
    const f = fakeSdk();
    (globalThis as unknown as { CrazyGames: unknown }).CrazyGames = { SDK: f.sdk };
    const p = new Portal({ portal: '', adsOn: true });
    await p.init();
    p.gameplayStart();
    expect(p.live).toBe(false);
    expect(p.adsReady).toBe(false);
    expect(p.rewarded(() => undefined)).toBe(false);
    expect(f.calls).toEqual([]);
  });

  it('replays loading that happened before the SDK was ready, and hands over the cloud store', async () => {
    const { p, calls, data } = await boot();
    let cloud: KeyValueStore | null = null;
    p.onCloud = (s) => { cloud = s; };
    p.loadingStart();
    p.loadingStop();
    await p.init();
    expect(calls.slice(0, 2)).toEqual(['loadingStart', 'loadingStop']);
    expect(cloud).toBe(data);
  });

  it('ignores an SDK in an unknown environment', async () => {
    const { p } = await boot(true, 'disabled');
    await p.init();
    expect(p.live).toBe(false);
  });

  it('sends gameplay changes once, no closer than a second apart', async () => {
    const { p, calls } = await boot();
    await p.init();
    p.gameplayStart();
    p.gameplayStop();
    p.gameplayStart();
    expect(calls.filter((c) => c.startsWith('gameplay'))).toEqual(['gameplayStart']);
    p.gameplayStop();
    vi.advanceTimersByTime(1000);
    expect(calls.filter((c) => c.startsWith('gameplay'))).toEqual(['gameplayStart', 'gameplayStop']);
  });

  it('pays a rewarded ad only when it finishes, mutes meanwhile, and spaces them out', async () => {
    const { p, finish, fail } = await boot();
    await p.init();
    let paid = 0;
    const settled: boolean[] = [];
    expect(p.rewarded(() => paid++, (g) => settled.push(g))).toBe(true);
    expect(audio.held).toBe(true);
    expect(p.adsReady).toBe(false);
    finish();
    expect(paid).toBe(1);
    expect(audio.held).toBe(false);
    expect(p.rewarded(() => paid++)).toBe(false);
    vi.advanceTimersByTime(REWARD_GAP_S * 1000);
    expect(p.rewarded(() => paid++, (g) => settled.push(g))).toBe(true);
    fail();
    expect(paid).toBe(1);
    expect(settled).toEqual([true, false]);
  });

  it('runs midgame breaks only when the rules allow, and always calls back', async () => {
    const { p, calls, finish } = await boot();
    await p.init();
    let done = 0;
    expect(p.midgame(1, () => done++)).toBe(false);
    expect(p.midgame(5, () => done++)).toBe(true);
    finish();
    expect(done).toBe(1);
    expect(p.midgame(6, () => done++)).toBe(false);
    expect(calls.filter((c) => c === 'ad:midgame')).toHaveLength(1);
  });

  it('offers no ads when the build has them switched off', async () => {
    const { p } = await boot(false);
    await p.init();
    expect(p.live).toBe(true);
    expect(p.rewardReady).toBe(false);
    expect(p.midgame(9, () => undefined)).toBe(false);
  });

  it('follows the platform mute switch', async () => {
    const { p, sdk } = await boot();
    const seen: boolean[] = [];
    p.watchMute((m) => seen.push(m));
    (sdk.game as { settings: { muteAudio: boolean } }).settings.muteAudio = true;
    await p.init();
    expect(seen).toEqual([true]);
  });
});
