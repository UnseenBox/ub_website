import type { HeroId } from '../core/Hero';

/** The silhouette the in-game body is drawn with. */
export type OutfitKind = 'openRobePajamas' | 'pajamaShirt' | 'bedJacket' | 'dinoOnesie';
export type HairKind = 'bun' | 'ponytail' | 'curls' | 'dinoHood';
export type FeetKind = 'bunny' | 'duck' | 'feather' | 'claw' | 'sneaker';
export type MaskKind = 'forehead' | 'neck' | 'none';

/**
 * One source of truth for the in-game character art. The portraits and menu cast
 * use the same outfit names and palette; the sprite is the same character at
 * gameplay scale, not a separate design.
 */
export interface HeroLook {
  readonly outfit: OutfitKind;
  readonly hairStyle: HairKind;
  readonly feet: FeetKind;
  readonly maskStyle: MaskKind;
  readonly coverage: 'full';
  /** Main garment: violet robe, teal shirt, rose bed jacket, lime onesie. */
  readonly outfitMain: string;
  readonly outfitShade: string;
  readonly outfitLight: string;
  /** Layer under the main garment: pale blue top, teal shirt, lilac nightgown, yellow belly. */
  readonly top: string;
  readonly topShade: string;
  readonly pants: string;
  readonly pantsShade: string;
  readonly piping: string;
  /** Cream sash, feather trim, hood teeth. */
  readonly trim: string;
  readonly trimShade: string;
  readonly skin: string;
  readonly skinShade: string;
  readonly hair: string;
  readonly hairLight: string;
  readonly mask: string;
  readonly maskShade: string;
  /** Optional contrast colour for the kid's dino plates and crest. */
  readonly spike?: string;
  readonly slipper: string;
  readonly slipperShade: string;
  /** Small metal/plastic accent: scrunchie, glasses pin, flashlight. */
  readonly accent: string;
  readonly scale: number;
  readonly lashes?: boolean;
  readonly glasses?: boolean;
}

export const HERO_LOOKS: Record<HeroId, HeroLook> = {
  tenant: {
    outfit: 'openRobePajamas',
    hairStyle: 'bun',
    feet: 'bunny',
    maskStyle: 'forehead',
    coverage: 'full',
    outfitMain: '#7c5cd8',
    outfitShade: '#5a3fb0',
    outfitLight: '#a48cf2',
    top: '#bfe9ff',
    topShade: '#8fc6e6',
    pants: '#bfe9ff',
    pantsShade: '#8fc6e6',
    piping: '#7c5cd8',
    trim: '#fff3d6',
    trimShade: '#e2cfa4',
    skin: '#f6c49a',
    skinShade: '#e0a070',
    hair: '#9a5226',
    hairLight: '#d18845',
    mask: '#6fe0c2',
    maskShade: '#3aa98d',
    slipper: '#ff9ec4',
    slipperShade: '#e56f9f',
    accent: '#6fe0c2',
    scale: 1,
  },
  flatmate: {
    outfit: 'pajamaShirt',
    hairStyle: 'ponytail',
    feet: 'duck',
    maskStyle: 'forehead',
    coverage: 'full',
    outfitMain: '#2fb3a6',
    outfitShade: '#1e867c',
    outfitLight: '#7fe0d4',
    top: '#9ff0e7',
    topShade: '#5cc9bd',
    pants: '#238f88',
    pantsShade: '#176e69',
    piping: '#ff7aa8',
    trim: '#fff3d6',
    trimShade: '#e2cfa4',
    skin: '#c98b62',
    skinShade: '#a56a44',
    hair: '#3b2a4f',
    hairLight: '#7a5aa6',
    mask: '#ff7aa8',
    maskShade: '#d94f82',
    slipper: '#ffd23f',
    slipperShade: '#e0a91f',
    accent: '#ffd23f',
    scale: 1.06,
    lashes: true,
  },
  gran: {
    outfit: 'bedJacket',
    hairStyle: 'curls',
    feet: 'feather',
    maskStyle: 'none',
    coverage: 'full',
    outfitMain: '#e58fb0',
    outfitShade: '#b9607f',
    outfitLight: '#ffc2d6',
    top: '#e7b9cd',
    topShade: '#c58fa9',
    pants: '#e7b9cd',
    pantsShade: '#c58fa9',
    piping: '#e58fb0',
    trim: '#fffdf6',
    trimShade: '#d8d2c2',
    skin: '#f2c9a8',
    skinShade: '#d39c74',
    hair: '#c8c6d6',
    hairLight: '#f1f0f7',
    mask: '#7c5cd8',
    maskShade: '#5a3fb0',
    slipper: '#ef9ab5',
    slipperShade: '#c46a8b',
    accent: '#ffd23f',
    scale: 0.94,
    glasses: true,
  },
  kid: {
    outfit: 'dinoOnesie',
    hairStyle: 'dinoHood',
    feet: 'sneaker',
    maskStyle: 'none',
    coverage: 'full',
    outfitMain: '#6cc24a',
    outfitShade: '#47962c',
    outfitLight: '#b4ea8a',
    top: '#fff27a',
    topShade: '#e0c94a',
    pants: '#6cc24a',
    pantsShade: '#47962c',
    piping: '#fff27a',
    trim: '#fffdf6',
    trimShade: '#e0d6c2',
    skin: '#e8ad80',
    skinShade: '#c98558',
    hair: '#c56a2b',
    hairLight: '#e89a4f',
    mask: '#ff9f1c',
    maskShade: '#d97706',
    spike: '#2f9c95',
    slipper: '#2f9c95',
    slipperShade: '#1f6f6b',
    accent: '#ffd23f',
    scale: 0.82,
  },
};
