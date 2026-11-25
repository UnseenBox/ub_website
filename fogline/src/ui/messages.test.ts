import { describe, expect, it } from 'vitest';
import { SCREEN_WORDS, appendLog, clipWords, portraitInitial, wordCount } from './messages';

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

  it('uses the first letter of the speaker as the portrait', () => {
    expect(portraitInitial('kestrel')).toBe('K');
    expect(portraitInitial('')).toBe('?');
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
    expect(threatTags(ENEMIES.spitter)).toEqual(['RANGED', 'HEAD']);
    expect(threatTags(ENEMIES.howler)).toEqual(['HOWLS', 'HEAD']);
    expect(threatTags(ENEMIES.sapper)).toEqual(['EXPLODES', 'FAST']);
    expect(threatTags(ENEMIES.juggernaut)).toEqual(['ARMOURED']);
    expect(threatTags(ENEMIES.bloom)[0]).toBe('BOSS');
    for (const def of Object.values(ENEMIES)) expect(threatTags(def).length).toBeLessThanOrEqual(3);
  });
});
