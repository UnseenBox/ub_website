/** A picture painted on the ball, wrapped round the sphere (see rendering/SphereBall.ts). */
export type TextureId = 'hex' | 'honey' | 'tri' | 'flame' | 'toxic' | 'star' | 'ice' | 'skull';

/**
 * A ball the player can pick: a picture wrapped round it. Its colours are only the fallback shown
 * while the picture loads. The first one is the free starter.
 */
export interface Skin {
  id: string;
  name: string;
  base: string;
  patch: string;
  /** Total stars, across every alley, needed to unlock it. */
  need: number;
  texture: TextureId;
}

export const SKINS: readonly Skin[] = [
  { id: 'tex-hex', name: 'HEX', base: '#fbf7ee', patch: '#1b2540', need: 0, texture: 'hex' },
  { id: 'tex-honey', name: 'HONEY', base: '#ffc83a', patch: '#1b2540', need: 18, texture: 'honey' },
  { id: 'tex-tri', name: 'TRIANGLE', base: '#fbf7ee', patch: '#1f5fa8', need: 28, texture: 'tri' },
  { id: 'tex-flame', name: 'FLAME', base: '#ff5a2b', patch: '#ffd65c', need: 38, texture: 'flame' },
  { id: 'tex-toxic', name: 'TOXIC', base: '#2b3a2a', patch: '#9dff3a', need: 48, texture: 'toxic' },
  { id: 'tex-star', name: 'STARS', base: '#fbf7ee', patch: '#5b2bb0', need: 58, texture: 'star' },
  { id: 'tex-ice', name: 'ICE', base: '#e8f6ff', patch: '#3d9df2', need: 68, texture: 'ice' },
  { id: 'tex-skull', name: 'SKULL', base: '#1b1b1b', patch: '#ff7a1a', need: 78, texture: 'skull' },
];

/** The free starter: the ball a new player has, and the one a removed skin falls back to. */
export const STARTER_SKIN = SKINS[0].id;

export const skinOf = (id: string): Skin => SKINS.find((s) => s.id === id) ?? SKINS[0];
