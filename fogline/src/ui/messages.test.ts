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
