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
  // THE HOMEOWNER: teal dressing gown, sleep mask pushed up, gnome-red bunny slippers.
  tenant: {
    outfit: 'openRobePajamas',
    hairStyle: 'bun',
    feet: 'bunny',
    maskStyle: 'forehead',
    coverage: 'full',
    outfitMain: '#1f9c8f',
    outfitShade: '#157468',
    outfitLight: '#6fd3c4',
    top: '#ffe7a8',
    topShade: '#e8c87a',
    pants: '#ffe7a8',
    pantsShade: '#e8c87a',
    piping: '#ff9f2e',
    trim: '#fff4dc',
    trimShade: '#e6d2a6',
    skin: '#f6c49a',
    skinShade: '#e0a070',
    hair: '#7a4a2a',
    hairLight: '#b8773f',
    mask: '#ff9f2e',
    maskShade: '#d4711a',
    slipper: '#e2403a',
    slipperShade: '#a82a25',
    accent: '#ffd447',
    scale: 1,
  },
  // THE TEEN: pink ponytail, navy gaming pyjamas, a lime sweatband, teal duck slippers.
  flatmate: {
    outfit: 'pajamaShirt',
    hairStyle: 'ponytail',
    feet: 'duck',
    maskStyle: 'forehead',
    coverage: 'full',
    outfitMain: '#2b3a67',
    outfitShade: '#1c2747',
    outfitLight: '#5a6ea8',
    top: '#ffd447',
    topShade: '#d6a11b',
    pants: '#2b3a67',
    pantsShade: '#1c2747',
    piping: '#ffd447',
    trim: '#fff4dc',
    trimShade: '#e6d2a6',
    skin: '#c98b62',
    skinShade: '#a56a44',
    hair: '#ff6f9f',
    hairLight: '#ffb0c8',
    mask: '#7ad65b',
    maskShade: '#4fa83a',
    slipper: '#22b0a2',
    slipperShade: '#17857a',
    accent: '#7ad65b',
    scale: 1.06,
    lashes: true,
  },
  // GRANDMA: white curls, a forest-green cardigan, red feather slippers, reading glasses.
  gran: {
    outfit: 'bedJacket',
    hairStyle: 'curls',
    feet: 'feather',
    maskStyle: 'none',
    coverage: 'full',
    outfitMain: '#3f8f5a',
    outfitShade: '#2b6a41',
    outfitLight: '#82c79a',
    top: '#f4e3c3',
    topShade: '#d9c39a',
    pants: '#f4e3c3',
    pantsShade: '#d9c39a',
    piping: '#e8483d',
    trim: '#fffdf6',
    trimShade: '#d8d2c2',
    skin: '#f2c9a8',
    skinShade: '#d39c74',
    hair: '#e8e6ee',
    hairLight: '#ffffff',
    mask: '#e8483d',
    maskShade: '#b22f28',
    slipper: '#e8483d',
    slipperShade: '#b22f28',
    accent: '#ffd447',
    scale: 0.94,
    glasses: true,
  },
  // THE KID: an orange tiger onesie with black stripes, hood up, ready to pounce.
  kid: {
    outfit: 'dinoOnesie',
    hairStyle: 'dinoHood',
    feet: 'sneaker',
    maskStyle: 'none',
    coverage: 'full',
    outfitMain: '#ff9a2e',
    outfitShade: '#d4711a',
    outfitLight: '#ffc277',
    top: '#fff4dc',
    topShade: '#e8d5b0',
    pants: '#ff9a2e',
    pantsShade: '#d4711a',
    piping: '#3a2a1a',
    trim: '#fffdf6',
    trimShade: '#e0d6c2',
    skin: '#e8ad80',
    skinShade: '#c98558',
    hair: '#8a5530',
    hairLight: '#c4834a',
    mask: '#3a2a1a',
    maskShade: '#1f160d',
    spike: '#3a2a1a',
    slipper: '#3a2a1a',
    slipperShade: '#1f160d',
    accent: '#ffd447',
    scale: 0.82,
  },
};
