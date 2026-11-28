import { SHAMBLER_HEIGHT, SHEET_PARTS, SheetPart, ZOMBIE_SHEET_TEXTURE } from './zombieSheetFrames';

export type FigurePartName = 'head' | 'torso' | 'armL' | 'armR' | 'thighL' | 'thighR' | 'shinL' | 'shinR';

/** A cut-out figure: its texture, its joint pivots and the size the rig draws it at. */
export interface Figure {
  texture: string;
  /** Feet to top of head, in figure units. */
  height: number;
  parts: Record<FigurePartName, SheetPart>;
  /** Half the figure's widest span, for quick hit rejection. */
  halfWidth: number;
  /** Shoulder pivot to the bottom of an arm, in figure units. */
  armReach: number;
}

function armReachOf(parts: Record<FigurePartName, SheetPart>): number {
  return parts.armL.h * (1 - parts.armL.oy);
}

/** Enemy look -> cut figure. Looks not listed here are puppets (or drawn procedurally). */
export const FIGURES: Record<string, Figure> = {
  shambler: {
    texture: ZOMBIE_SHEET_TEXTURE,
    height: SHAMBLER_HEIGHT,
    parts: SHEET_PARTS,
    halfWidth: 135,
    armReach: armReachOf(SHEET_PARTS),
  },
};
