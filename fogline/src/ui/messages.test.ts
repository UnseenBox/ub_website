import { describe, expect, it } from 'vitest';
import { SCREEN_WORDS, appendLog, clipWords, wordCount } from './messages';

describe('battle text rules', () => {
  it('keeps a line that is already short', () => {
    expect(clipWords('Heads. Keep them off the wall.')).toBe('Heads. Keep them off the wall.');
  });

  it('shows the first sentence when it fits the limit', () => {
    expect(clipWords('Warden, the fog is moving again. Hold this bunker until the convoys are out.')).toBe('Warden, the fog is moving again.');
  });

  it('never shows more words than the limit', () => {
    const long = 'Lurkers wait in the mud and come up right in front of the wire every single time';
    const out = clipWords(long);
    expect(wordCount(out.replace('…', ''))).toBeLessThanOrEqual(SCREEN_WORDS);
    expect(out.endsWith('…')).toBe(true);
  });

  it('cuts a long first sentence to the limit with an ellipsis', () => {
    expect(clipWords('One two three four five six seven eight.')).toBe('One two three four five six…');
  });

  it('collapses whitespace', () => {
    expect(clipWords('  Hold   the\nline.  ')).toBe('Hold the line.');
  });

  it('counts words', () => {
    expect(wordCount(' a  b c ')).toBe(3);
  });

  it('keeps only the newest lines in the log', () => {
    const log: number[] = [];
    for (let i = 0; i < 50; i++) appendLog(log, i, 40);
    expect(log).toHaveLength(40);
    expect(log[0]).toBe(10);
    expect(log[39]).toBe(49);
  });
});

import { ENEMIES } from '../data/enemies';
import { bonusValue, threatTags } from './messages';

describe('results and threat text', () => {
  it('shows a short value for each bonus star', () => {
    expect(bonusValue({ kind: 'headshots', count: 12 })).toBe('12');
    expect(bonusValue({ kind: 'accuracy', fraction: 0.7 })).toBe('70%');
    expect(bonusValue({ kind: 'saveAll' })).toBe('ALL');
    expect(bonusValue({ kind: 'noSupport', id: 'gunship' })).toBe('NO GUNSHIP');
  });

  it('tags the new things about an enemy, three at most', () => {
    expect(threatTags(ENEMIES.spitter)).toEqual(['RANGED', 'HEAD', 'GLOWS = SPIT']);
    expect(threatTags(ENEMIES.howler)).toEqual(['HOWLS', 'HEAD']);
    expect(threatTags(ENEMIES.sapper)).toEqual(['EXPLODES', 'FAST']);
    expect(threatTags(ENEMIES.juggernaut)).toEqual(['ARMOURED']);
    expect(threatTags(ENEMIES.bloom)[0]).toBe('BOSS');
    for (const def of Object.values(ENEMIES)) expect(threatTags(def).length).toBeLessThanOrEqual(3);
  });
});

import { gainChip, objectiveLabel } from './messages';
import { MISSIONS } from '../data/missions';

describe('map and workshop labels', () => {
  it('names each objective in a word or two', () => {
    const find = (id: string) => MISSIONS.find((m) => m.id === id)!;
    expect(objectiveLabel(find('a1m1').objective)).toBe('HOLD');
    expect(objectiveLabel(MISSIONS.find((m) => m.objective.kind === 'protect' && m.objective.asset === 'mast')!.objective)).toBe('RELAY MAST');
    expect(objectiveLabel(MISSIONS.find((m) => m.objective.kind === 'evacuate')!.objective)).toBe('SAVE 2/3 BUS');
    expect(objectiveLabel(find('a2m2').objective)).toBe('DESTROY 3 NESTS');
    expect(objectiveLabel(find('a1m9').objective)).toBe('BOSS');
  });

  it('shows the gain of a workshop level as one number', () => {
    expect(gainChip('+8% damage')).toBe('+8%');
    expect(gainChip('+6% fire rate, -8% spread')).toBe('+6%');
    expect(gainChip('-8% reload time')).toBe('-8%');
    expect(gainChip('+150 bunker health')).toBe('+150');
  });
});

import { stripChips, type StripState } from './messages';

describe('the objective strip', () => {
  const state: StripState = { asset: 1, nestsLeft: 3, saved: 0, lost: 0, headshots: 0, accuracy: null, supportsUsed: [] };

  it('shows the objective and the progress to the bonus star', () => {
    expect(stripChips({ kind: 'hold' }, { kind: 'headshots', count: 12 }, { ...state, headshots: 4 })).toEqual([
      { icon: 'shield', text: 'HOLD', tone: 'plain' },
      { icon: 'head', text: '4/12', tone: 'gold' },
    ]);
    expect(stripChips({ kind: 'hold' }, { kind: 'headshots', count: 12 }, { ...state, headshots: 30 })[1])
      .toEqual({ icon: 'head', text: '12/12', tone: 'green' });
  });

  it('has no bonus chip in modes without stars', () => {
    expect(stripChips({ kind: 'boss', enemy: 'juggernaut' }, null, state)).toEqual([{ icon: 'skull', text: 'BOSS', tone: 'red' }]);
  });

  it('warns when a protected asset or a bonus is slipping', () => {
    const chips = stripChips(
      MISSIONS.find((m) => m.objective.kind === 'protect')!.objective,
      { kind: 'noSupport', id: 'nuke' },
      { ...state, asset: 0.2, supportsUsed: ['nuke'] },
    );
    expect(chips.map((c) => c.tone)).toEqual(['red', 'red']);
  });
});
