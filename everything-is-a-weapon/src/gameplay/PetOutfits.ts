/** Cosmetic pet outfits bought with scrap. Colours come from the existing pet art. */
export type PetOutfitId = 'dog_bandana' | 'cat_bow' | 'hamster_hat';

export interface PetOutfitDefinition {
  readonly id: PetOutfitId;
  readonly name: string;
  readonly blurb: string;
  readonly color: string;
  readonly cost: number;
  /** Which existing pet icon the store should show. */
  readonly icon: 'dog' | 'cat' | 'hamster';
}

export const PET_OUTFITS: Readonly<Record<PetOutfitId, PetOutfitDefinition>> = {
  dog_bandana: {
    id: 'dog_bandana',
    name: 'RED BANDANA',
    blurb: 'A scrap of curtain, tied with attitude. Fits every pet.',
    color: '#c23b2e',
    cost: 20,
    icon: 'dog',
  },
  cat_bow: {
    id: 'cat_bow',
    name: 'GOLDEN BOW',
    blurb: 'A little bow with a lot of nerve. Fits every pet.',
    color: '#e8b13c',
    cost: 20,
    icon: 'cat',
  },
  hamster_hat: {
    id: 'hamster_hat',
    name: 'GREEN BEANIE',
    blurb: 'A tiny hat for a tiny head. Fits every pet.',
    color: '#4a5c3a',
    cost: 20,
    icon: 'hamster',
  },
};

export const PET_OUTFIT_IDS = Object.keys(PET_OUTFITS) as PetOutfitId[];

export function isPetOutfitId(value: string): value is PetOutfitId {
  return value in PET_OUTFITS;
}
