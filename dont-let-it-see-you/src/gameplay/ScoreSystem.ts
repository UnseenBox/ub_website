import { SCORE } from '../core/Tuning';
import { clamp01 } from '../core/Mathx';

export interface RunStats {
  timeSeconds: number;
  clicks: number;
  usefulClicks: number;
  interactions: number;
  detections: number;
  /** Survived brushes with detection. The PANIC stat. */
  nearMisses: number;
  alarms: number;
  decoysUsed: number;
  distractionsUsed: number;
  hidesUsed: number;
  secretsFound: number;
  loudestNoise: number;
  cursorDistance: number;
}

export function emptyStats(): RunStats {
  return {
    timeSeconds: 0,
    clicks: 0,
    usefulClicks: 0,
    interactions: 0,
    detections: 0,
    nearMisses: 0,
    alarms: 0,
    decoysUsed: 0,
    distractionsUsed: 0,
    hidesUsed: 0,
    secretsFound: 0,
    loudestNoise: 0,
    cursorDistance: 0,
  };
}

export interface ScoreLine {
  label: string;
  value: number;
}

export interface ScoreResult {
  lines: ScoreLine[];
  total: number;
  /** Clean, quiet and quick. The thing worth replaying for. */
  perfect: boolean;
  /** The one-word grade shown on the results screen. */
  grade: string;
}

/**
 * Scoring exists to name the kind of play the game admires: quiet, unhurried,
 * and unseen, with credit for the risks you survive rather than the ones you avoid.
 */
export class ScoreSystem {
  evaluate(stats: RunStats, parTime: number): ScoreResult {
    const lines: ScoreLine[] = [];

    lines.push({ label: 'ESCAPE', value: SCORE.roomBase });

    // Speed: full marks at par, tapering to nothing at triple par.
    const speedFactor = clamp01(1 - (stats.timeSeconds - parTime) / (parTime * 2));
    const speed = Math.round(SCORE.parTimeBonus * speedFactor);
    if (speed > 0) lines.push({ label: 'TIME', value: speed });

    if (stats.detections === 0) {
      lines.push({ label: 'NEVER SEEN', value: SCORE.noDetectionBonus });
    } else {
      lines.push({ label: `SEEN x${stats.detections}`, value: -400 * stats.detections });
    }

    if (stats.clicks === 0) {
      lines.push({ label: 'NO CLICKS', value: SCORE.clicklessBonus });
    } else if (stats.clicks === stats.usefulClicks) {
      lines.push({ label: 'NOTHING WASTED', value: Math.round(SCORE.clicklessBonus * 0.5) });
    }

    if (stats.alarms === 0 && stats.loudestNoise < 10) {
      lines.push({ label: 'QUIET', value: SCORE.silentBonus });
    }

    if (stats.decoysUsed > 0) {
      lines.push({ label: 'DECEPTION', value: SCORE.decoyBonus * Math.min(3, stats.decoysUsed) });
    }

    if (stats.nearMisses > 0) {
      lines.push({
        label: `PANIC x${stats.nearMisses}`,
        value: SCORE.nearMissBonus * Math.min(5, stats.nearMisses),
      });
    }

    if (stats.secretsFound > 0) {
      lines.push({ label: 'FOUND SOMETHING', value: SCORE.secretBonus * stats.secretsFound });
    }

    const perfect =
      stats.detections === 0 &&
      stats.clicks === stats.usefulClicks &&
      stats.alarms === 0 &&
      stats.timeSeconds <= parTime * 1.25;

    if (perfect) lines.push({ label: 'PERFECT ESCAPE', value: SCORE.perfectBonus });

    const total = Math.max(0, lines.reduce((sum, l) => sum + l.value, 0));

    return { lines, total, perfect, grade: gradeFor(total, perfect) };
  }
}

function gradeFor(total: number, perfect: boolean): string {
  if (perfect) return 'UNSEEN';
  if (total >= 4200) return 'CAREFUL';
  if (total >= 3000) return 'LUCKY';
  if (total >= 1800) return 'MESSY';
  return 'LOUD';
}
