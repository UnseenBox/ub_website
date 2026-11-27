import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { completionPercent } from '../systems/Campaign';
import { PROFILE_KEY, ProfileStore, defaultProfile, parseProfile, type KeyValueStore } from '../systems/Profile';
import { MISSIONS } from '../data/missions';
import { Portal, type CrazySdk } from './Portal';
import { deviceKind, isDesktop, isHandheld, setDeviceKind } from './flags';
import { moveSpot } from './mouseLock';

class MemoryStore implements KeyValueStore {
  readonly map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

function sdkFor(device: string) {
  const calls: unknown[][] = [];
  const log = (name: string) => (...args: unknown[]) => { calls.push([name, ...args]); };
  const sdk: CrazySdk = {
    environment: 'local',
    init: async () => undefined,
    game: {
      loadingStart: log('loadingStart'), loadingStop: log('loadingStop'), gameplayStart: log('gameplayStart'),
      gameplayStop: log('gameplayStop'), happytime: log('happytime'), reportGameCompletedPercentage: log('completed'),
      setGameContext: log('context'), clearGameContext: log('clear'),
    },
    ad: { requestAd: log('ad') },
    user: { systemInfo: { device: { type: device } } },
  };
  return { sdk, calls };
}

describe('the CrazyGames build', () => {
  beforeEach(() => {
    (globalThis as unknown as { window: unknown }).window = globalThis;
  });
  afterEach(() => {
    vi.useRealTimers();
    setDeviceKind(null);
    delete (globalThis as unknown as { CrazyGames?: unknown }).CrazyGames;
  });

  it('takes the portal’s word on the device over the touch screen', async () => {
    const { sdk } = sdkFor('desktop');
    await new Portal({ portal: 'crazygames', adsOn: false }).debugAttach(sdk, false);
    expect(deviceKind()).toBe('desktop');
    expect(isDesktop()).toBe(true);
    expect(isHandheld()).toBe(false);
    setDeviceKind('tablet');
    expect(isHandheld()).toBe(true);
    setDeviceKind('toaster');
    expect(deviceKind()).toBeNull();
  });

  it('waits for the SDK, but not for ever', async () => {
    vi.useFakeTimers();
    const portal = new Portal({ portal: 'crazygames', adsOn: false });
    let done = false;
    void portal.settled(5000).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(4999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(done).toBe(true);
    // elsewhere there is nothing to wait for
    await new Portal({ portal: '', adsOn: false }).settled(5000);
  });

  it('reports progress and context, replaying progress sent before the SDK was ready', async () => {
    const { sdk, calls } = sdkFor('desktop');
    const portal = new Portal({ portal: 'crazygames', adsOn: false });
    portal.reportCompleted(12.4);
    await portal.debugAttach(sdk, false);
    portal.reportCompleted(140);
    portal.context({ mission: 'a1m1' });
    portal.context(null);
    expect(calls.filter((c) => c[0] === 'completed')).toEqual([['completed', 12], ['completed', 100]]);
    expect(calls).toContainEqual(['context', { mission: 'a1m1' }]);
    expect(calls).toContainEqual(['clear']);
    expect(portal.rewardReady).toBe(false);
  });

  it('counts the campaign from 0 to 100', () => {
    const p = defaultProfile();
    expect(completionPercent(p)).toBe(0);
    for (const m of MISSIONS) p.missions[m.id] = { plays: 1, wins: 1, stars: 1, bestKills: 0 } as never;
    expect(completionPercent(p)).toBe(100);
  });

  it('moves the save into the portal’s store and drops the local copy', () => {
    const local = new MemoryStore(), cloud = new MemoryStore();
    const before = new ProfileStore(() => local);
    before.update((d) => { d.supplies = 321; });
    const store = new ProfileStore(() => local);
    store.moveTo(cloud);
    expect(parseProfile(cloud.getItem(PROFILE_KEY))!.supplies).toBe(321);
    expect(local.getItem(PROFILE_KEY)).toBeNull();
    store.update((d) => { d.supplies = 400; });
    expect(local.getItem(PROFILE_KEY)).toBeNull();
    expect(parseProfile(cloud.getItem(PROFILE_KEY))!.supplies).toBe(400);
  });

  it('lets the account’s save win over whatever the browser kept', () => {
    const local = new MemoryStore(), cloud = new MemoryStore();
    new ProfileStore(() => local).update((d) => { d.supplies = 999; });
    const account = defaultProfile();
    account.supplies = 5;
    cloud.setItem(PROFILE_KEY, JSON.stringify(account));
    const store = new ProfileStore(() => local);
    store.moveTo(cloud);
    expect(store.get().supplies).toBe(5);
  });

  it('keeps the local copy when the portal’s store will not take the save', () => {
    const local = new MemoryStore();
    new ProfileStore(() => local).update((d) => { d.supplies = 77; });
    const disabled: KeyValueStore = {
      getItem: () => { throw new Error('dataModuleDisabled'); },
      setItem: () => { throw new Error('dataModuleDisabled'); },
    };
    const store = new ProfileStore(() => local);
    store.moveTo(disabled);
    store.update((d) => { d.supplies += 1; });
    expect(parseProfile(local.getItem(PROFILE_KEY))!.supplies).toBe(78);
  });

  it('keeps a locked mouse on the canvas', () => {
    expect(moveSpot({ x: 100, y: 100 }, 10, -5, 2, 1280, 720)).toEqual({ x: 120, y: 90 });
    expect(moveSpot({ x: 5, y: 700 }, -500, 500, 1, 1280, 720)).toEqual({ x: 0, y: 720 });
  });
});
