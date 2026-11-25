import { describe, expect, it } from 'vitest';
import { CLASSIC_WEAPONS as WEAPONS } from '../data/weapons';
import { buildSteps, canAdvance, fireAllowed, GATE_PAUSE_SECONDS, Facts, wavesAllowed } from './tutorialSteps';

const opts = (touch: boolean) => ({ touch, legSlow: { factor: 0.55, seconds: 2.5 } });
const facts = (over: Partial<Facts> = {}): Facts => ({
  fireDone: false, keys: new Set<string>(), shopOpened: false, waveStarted: false, ...over,
});
const byId = (touch: boolean, id: string) => buildSteps(opts(touch)).find((s) => s.id === id)!;

describe('tutorial briefing', () => {
  it('opens with the welcome and closes with the finish', () => {
    const steps = buildSteps(opts(false));
    expect(steps[0].id).toBe('welcome');
    expect(steps[steps.length - 1].id).toBe('finish');
  });

  it('covers the weapons, the controls, the enemies, the bunker and the armory', () => {
    const ids = buildSteps(opts(false)).map((s) => s.id);
    for (const id of ['weapons', 'switch', 'reload', 'enemies', 'zones', 'bunker', 'arsenal', 'armory', 'waves']) {
      expect(ids).toContain(id);
    }
  });

  it('names every weapon in the weapons step', () => {
    const text = byId(false, 'weapons').lines.join(' ');
    for (const w of WEAPONS.filter((w) => w.unlockAfterWave > 0)) expect(text).toContain(w.shortName);
  });

  it('explains that a locked weapon stays locked until its wave is cleared', () => {
    const text = byId(false, 'switch').lines.join(' ');
    expect(text).toContain('locked');
    expect(text).toContain('wave 1');
  });

  it('speaks of taps on touch and of keys and clicks on desktop', () => {
    expect(buildSteps(opts(true)).flatMap((s) => s.lines).join(' ')).toContain('Tap');
    expect(buildSteps(opts(false)).flatMap((s) => s.lines).join(' ')).toContain('SPACE');
  });
});

describe('what lets the player move on', () => {
  it('practice steps wait for the real action', () => {
    expect(canAdvance(byId(false, 'fire'), facts())).toBe(false);
    expect(canAdvance(byId(false, 'fire'), facts({ fireDone: true }))).toBe(true);
    expect(canAdvance(byId(false, 'reload'), facts())).toBe(false);
    expect(canAdvance(byId(false, 'reload'), facts({ keys: new Set(['r']) }))).toBe(true);
    expect(canAdvance(byId(false, 'armory'), facts())).toBe(false);
    expect(canAdvance(byId(false, 'armory'), facts({ shopOpened: true }))).toBe(true);
    expect(canAdvance(byId(false, 'waves'), facts())).toBe(false);
    expect(canAdvance(byId(false, 'waves'), facts({ waveStarted: true }))).toBe(true);
  });

  it('the switch step passes on a weapon key and ignores other keys', () => {
    const sw = byId(false, 'switch');
    expect(canAdvance(sw, facts())).toBe(false);
    expect(canAdvance(sw, facts({ keys: new Set(['q', 'escape']) }))).toBe(false);
    expect(canAdvance(sw, facts({ keys: new Set(['2']) }))).toBe(true);
  });

  it('information steps never hold the player', () => {
    for (const s of buildSteps(opts(false)).filter((s) => s.gate === 'continue')) {
      expect(canAdvance(s, facts())).toBe(true);
    }
  });

  it('a passed gate pauses briefly before moving on', () => {
    expect(GATE_PAUSE_SECONDS).toBeGreaterThan(0);
    expect(GATE_PAUSE_SECONDS).toBeLessThan(2);
  });
});

describe('what the game may do while the briefing runs', () => {
  it('holds waves back until the waves step', () => {
    expect(wavesAllowed('welcome')).toBe(false);
    expect(wavesAllowed('zones')).toBe(false);
    expect(wavesAllowed('waves')).toBe(true);
    expect(wavesAllowed('finish')).toBe(false);
  });

  it('only fires on the fire step, so clicks on the panel never shoot', () => {
    expect(fireAllowed('fire')).toBe(true);
    expect(fireAllowed('welcome')).toBe(false);
    expect(fireAllowed('weapons')).toBe(false);
  });
});
