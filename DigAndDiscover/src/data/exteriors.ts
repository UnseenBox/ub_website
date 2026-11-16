/** Outside looks of a rock. Deliberately unrelated to what is inside. */
export interface ExteriorDef {
  id: string;
  name: string;
  base: number;
  light: number;
  shade: number;
  speckle: number;
  /** 0 = perfectly round, higher = lumpier silhouette. */
  bumpiness: number;
  /** Vertical squash of the silhouette. */
  squash: number;
}

export const EXTERIORS: readonly ExteriorDef[] = [
  { id: 'dusty', name: 'Dusty Nodule', base: 0xc8a57a, light: 0xe8cfa8, shade: 0x8e6c48, speckle: 0x7a5b3c, bumpiness: 0.16, squash: 0.86 },
  { id: 'cobble', name: 'Grey Cobble', base: 0xa3a19c, light: 0xd3d1cb, shade: 0x6c6a66, speckle: 0x55534f, bumpiness: 0.12, squash: 0.8 },
  { id: 'rusty', name: 'Rusty Lump', base: 0xb8714f, light: 0xe0a07a, shade: 0x7c4430, speckle: 0x5e3121, bumpiness: 0.2, squash: 0.9 },
  { id: 'basalt', name: 'Dark Basalt', base: 0x6e6974, light: 0x9a949f, shade: 0x45414b, speckle: 0x2f2c33, bumpiness: 0.14, squash: 0.84 },
  { id: 'egg', name: 'Speckled Egg', base: 0xe5d8bf, light: 0xfff7e6, shade: 0xb3a487, speckle: 0x7d6e55, bumpiness: 0.08, squash: 0.92 },
  { id: 'mossy', name: 'Mossy Stone', base: 0x8d9b7a, light: 0xc0cba6, shade: 0x5c6a4a, speckle: 0x46603a, bumpiness: 0.15, squash: 0.85 },
  { id: 'crusted', name: 'Crusted Slab', base: 0xb0a89a, light: 0xe8e2d4, shade: 0x75695c, speckle: 0xd8cfbc, bumpiness: 0.22, squash: 0.88 },
  { id: 'river', name: 'River Pebble', base: 0xa8b0ae, light: 0xd6dedb, shade: 0x6d7674, speckle: 0x59615f, bumpiness: 0.05, squash: 0.95 },
  { id: 'charred', name: 'Charred Crag', base: 0x3c3636, light: 0x6b5a52, shade: 0x1c1817, speckle: 0x8a4a22, bumpiness: 0.18, squash: 0.83 },
  { id: 'glassy', name: 'Glassy Sliver', base: 0x8f9aa8, light: 0xcdd8e4, shade: 0x5d6672, speckle: 0xb8c6d6, bumpiness: 0.09, squash: 0.9 },
];
