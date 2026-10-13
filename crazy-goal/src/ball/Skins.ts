/** A look for the ball: the leather colour, the colour of its patches, and the stars it costs. */
export interface Skin {
  id: string;
  name: string;
  base: string;
  patch: string;
  /** Total stars, across every alley, needed to unlock it. */
  need: number;
}

export const SKINS: readonly Skin[] = [
  { id: 'classic', name: 'CLASSIC', base: '#fbf7ee', patch: '#1b2540', need: 0 },
  { id: 'orange', name: 'ORANGE', base: '#fff4e0', patch: '#f08a24', need: 3 },
  { id: 'algiers', name: 'ALGIERS', base: '#fbf7ee', patch: '#1f5fa8', need: 6 },
  { id: 'mint', name: 'MINT', base: '#e9fff3', patch: '#2f9a63', need: 10 },
  { id: 'sunset', name: 'SUNSET', base: '#ffe9b8', patch: '#cf5c36', need: 15 },
  { id: 'night', name: 'NIGHT', base: '#2b3350', patch: '#ffc83a', need: 22 },
  { id: 'candy', name: 'CANDY', base: '#ffe3f1', patch: '#e2478f', need: 30 },
  { id: 'gold', name: 'GOLD', base: '#ffd65c', patch: '#a04426', need: 40 },
  { id: 'sky', name: 'SKY', base: '#dff3ff', patch: '#1f5fa8', need: 50 },
  { id: 'lava', name: 'LAVA', base: '#3a1c1c', patch: '#ff5a2b', need: 60 },
  { id: 'zebra', name: 'ZEBRA', base: '#ffffff', patch: '#222222', need: 70 },
  { id: 'sahara', name: 'SAHARA', base: '#f6e2a4', patch: '#a04426', need: 80 },
  { id: 'galaxy', name: 'GALAXY', base: '#1b1b3a', patch: '#8a5aff', need: 92 },
  { id: 'champion', name: 'CHAMPION', base: '#ffc83a', patch: '#1f5fa8', need: 102 },
  { id: 'ember', name: 'EMBER', base: '#3a1c1c', patch: '#ff8a3d', need: 112 },
  { id: 'ocean', name: 'OCEAN', base: '#d8f4ff', patch: '#0e7c86', need: 122 },
  { id: 'royal', name: 'ROYAL', base: '#3d2b8f', patch: '#ffd65c', need: 132 },
  { id: 'legend', name: 'LEGEND', base: '#fff4d6', patch: '#e2472b', need: 142 },
  { id: 'coral', name: 'CORAL', base: '#ffe0d6', patch: '#ff5a5a', need: 155 },
  { id: 'storm', name: 'STORM', base: '#2e3a4e', patch: '#7fe0ff', need: 168 },
  { id: 'volt', name: 'VOLT', base: '#f4ff4d', patch: '#1b2540', need: 182 },
  { id: 'rose', name: 'ROSE', base: '#ffd6e8', patch: '#a4184e', need: 196 },
  { id: 'tiger', name: 'TIGER', base: '#ff9e2b', patch: '#26221c', need: 210 },
  { id: 'frost', name: 'FROST', base: '#e8f6ff', patch: '#3d9df2', need: 225 },
  { id: 'pharaoh', name: 'PHARAOH', base: '#1f5fa8', patch: '#ffd65c', need: 242 },
  { id: 'diamond', name: 'DIAMOND', base: '#f2fbff', patch: '#8ad8ff', need: 262 },
  { id: 'eternal', name: 'ETERNAL', base: '#fff7ad', patch: '#ff3d81', need: 285 },
];

export const skinOf = (id: string): Skin => SKINS.find((s) => s.id === id) ?? SKINS[0];
