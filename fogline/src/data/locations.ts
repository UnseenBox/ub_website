// Battle locations. Every location is the same bunker view with its own light,
// fog colour and props, so the valley feels like different places.

export type LocationId = 'farm' | 'orchard' | 'station' | 'town' | 'highway' | 'bridge' | 'quarry' | 'railyard' | 'gate' | 'lab' | 'harbour' | 'lighthouse' | 'fort';

export interface PropPlacement {
  key: string;
  /** World position in metres: x across, z distance from the bunker. */
  x: number;
  z: number;
  heightM: number;
  flip?: boolean;
}

export interface LocationDef {
  id: LocationId;
  name: string;
  /** Multiplied into the sky/skyline backdrop and the ground. */
  skyTint: number;
  groundTint: number;
  /** Tint of the drifting fog bands. */
  fogTint: number;
  /** A road crossing the field from side to side at this distance (evacuation route). */
  crossRoadZ?: number;
  props: PropPlacement[];
  /** The burning barrel near the wire (fire and smoke come from here). */
  barrel: { x: number; z: number };
  /** Red fuel drums in the field: shoot one and it blows up the dead around it. */
  drums: { x: number; z: number }[];
  /** A river crossing the field (the bridge location): water between these distances. */
  river?: { near: number; far: number };
}

const NEAR_DEFENCES: PropPlacement[] = [
  { key: 'hedgehog', x: -6.2, z: 12, heightM: 1.5 },
  { key: 'hedgehog', x: 5.4, z: 14.5, heightM: 1.5, flip: true },
  { key: 'hedgehog', x: 11.5, z: 10, heightM: 1.5 },
  { key: 'barrel', x: -7.4, z: 8.5, heightM: 0.9 },
  { key: 'wire_coil', x: 0, z: 7.2, heightM: 0.9 },
];

export const LOCATIONS: Record<LocationId, LocationDef> = {
  farm: {
    id: 'farm',
    name: 'Harlow Farm',
    skyTint: 0xffffff,
    groundTint: 0xffffff,
    fogTint: 0xffffff,
    barrel: { x: -7.4, z: 8.5 },
    drums: [{ x: -4, z: 22 }, { x: 6, z: 34 }],
    props: [
      { key: 'silo', x: -30, z: 62, heightM: 16 },
      { key: 'barn', x: 30, z: 70, heightM: 9, flip: true },
      { key: 'tree_0', x: -40, z: 72, heightM: 9 },
      { key: 'tree_1', x: 34, z: 50, heightM: 8.5, flip: true },
      { key: 'tree_2', x: -24, z: 36, heightM: 7.5 },
      { key: 'tree_1', x: -58, z: 90, heightM: 10 },
      { key: 'tree_2', x: 52, z: 85, heightM: 9 },
      { key: 'pole', x: -9, z: 64, heightM: 9 },
      { key: 'pole', x: -9, z: 38, heightM: 9 },
      { key: 'car', x: -14, z: 52, heightM: 1.6, flip: true },
      { key: 'barrier', x: -3.4, z: 30, heightM: 0.85 },
      { key: 'barrier', x: 3.6, z: 46, heightM: 0.85 },
      ...NEAR_DEFENCES,
    ],
  },
  orchard: {
    id: 'orchard',
    name: 'Orchard Road',
    skyTint: 0xf4e8d4,
    groundTint: 0xe8ecd0,
    fogTint: 0xf0ead8,
    barrel: { x: -7.4, z: 8.5 },
    drums: [{ x: 3, z: 20 }, { x: -5, z: 38 }],
    props: [
      // Rows of bare fruit trees on both sides of the road.
      ...[30, 40, 52, 66, 82].flatMap((z, i): PropPlacement[] => [
        { key: 'orchard_tree', x: -11 - i * 1.5, z, heightM: 5.2, flip: i % 2 === 0 },
        { key: 'orchard_tree', x: -19 - i * 2, z: z + 4, heightM: 5.4 },
        { key: 'orchard_tree', x: 12 + i * 1.5, z: z + 2, heightM: 5.0 },
        { key: 'orchard_tree', x: 20 + i * 2, z: z + 6, heightM: 5.3, flip: true },
      ]),
      { key: 'shed', x: 26, z: 26, heightM: 4.5, flip: true },
      { key: 'car', x: 8.5, z: 24, heightM: 1.6 },
      { key: 'barrier', x: -3.4, z: 30, heightM: 0.85 },
      { key: 'pole', x: -9, z: 22, heightM: 9 },
      ...NEAR_DEFENCES,
    ],
  },
  station: {
    id: 'station',
    name: 'Millbrook Station',
    skyTint: 0xd8e0ec,
    groundTint: 0xd4d8dc,
    fogTint: 0xdce4ee,
    crossRoadZ: 20,
    barrel: { x: -7.4, z: 8.5 },
    drums: [{ x: -3, z: 30 }, { x: 5, z: 44 }],
    props: [
      { key: 'station', x: -26, z: 48, heightM: 9 },
      { key: 'station', x: 30, z: 60, heightM: 8, flip: true },
      { key: 'bus_shelter', x: 12, z: 26, heightM: 2.8 },
      { key: 'lamp', x: -8, z: 26, heightM: 6 },
      { key: 'lamp', x: 9, z: 40, heightM: 6 },
      { key: 'lamp', x: -9, z: 58, heightM: 6 },
      { key: 'tree_2', x: -40, z: 80, heightM: 9 },
      { key: 'tree_0', x: 48, z: 88, heightM: 9 },
      { key: 'car', x: -14, z: 34, heightM: 1.6, flip: true },
      { key: 'barrier', x: 3.6, z: 46, heightM: 0.85 },
      ...NEAR_DEFENCES,
    ],
  },
  town: {
    id: 'town',
    name: 'Millbrook',
    skyTint: 0xdcd8d0,
    groundTint: 0xc8c4bc,
    fogTint: 0xe0dcd4,
    barrel: { x: -7.4, z: 8.5 },
    drums: [{ x: -3, z: 24 }, { x: 4, z: 36 }, { x: -6, z: 50 }],
    props: [
      // Terraced houses down both sides of the high street.
      ...[28, 40, 54, 70, 88].flatMap((z, i): PropPlacement[] => [
        { key: 'house', x: -14 - i * 2, z, heightM: 9 + (i % 2) * 2, flip: i % 2 === 0 },
        { key: 'house', x: 15 + i * 2, z: z + 3, heightM: 8 + ((i + 1) % 2) * 2, flip: i % 2 === 1 },
      ]),
      { key: 'lamp', x: -8, z: 22, heightM: 6 },
      { key: 'lamp', x: 8, z: 34, heightM: 6 },
      { key: 'car', x: -6, z: 30, heightM: 1.6, flip: true },
      { key: 'car', x: 9, z: 58, heightM: 1.6 },
      { key: 'barrier', x: 2, z: 26, heightM: 0.85 },
      ...NEAR_DEFENCES,
    ],
  },
  highway: {
    id: 'highway',
    name: 'Highway 9',
    skyTint: 0xe4ddd0,
    groundTint: 0xbcbab4,
    fogTint: 0xe8e2d6,
    barrel: { x: -7.4, z: 8.5 },
    drums: [{ x: 2, z: 18 }, { x: -6, z: 32 }, { x: 7, z: 46 }],
    props: [
      { key: 'overpass', x: 0, z: 64, heightM: 9 },
      // A jam of abandoned cars.
      { key: 'car', x: -4, z: 28, heightM: 1.6 },
      { key: 'car', x: 5, z: 36, heightM: 1.6, flip: true },
      { key: 'car', x: -9, z: 44, heightM: 1.6, flip: true },
      { key: 'car', x: 10, z: 52, heightM: 1.6 },
      { key: 'car', x: -2, z: 58, heightM: 1.6 },
      { key: 'guardrail', x: -13, z: 30, heightM: 0.9 },
      { key: 'guardrail', x: 13, z: 30, heightM: 0.9, flip: true },
      { key: 'guardrail', x: -15, z: 48, heightM: 0.9 },
      { key: 'guardrail', x: 15, z: 48, heightM: 0.9, flip: true },
      { key: 'lamp', x: -12, z: 40, heightM: 7 },
      { key: 'lamp', x: 12, z: 70, heightM: 7 },
      { key: 'tree_0', x: -40, z: 80, heightM: 9 },
      { key: 'tree_2', x: 44, z: 90, heightM: 9 },
      ...NEAR_DEFENCES,
    ],
  },
  bridge: {
    id: 'bridge',
    name: 'Millbrook River',
    skyTint: 0xd4dce4,
    groundTint: 0xc0c8cc,
    fogTint: 0xd8e2ea,
    crossRoadZ: 20,
    river: { near: 38, far: 52 },
    barrel: { x: -7.4, z: 8.5 },
    drums: [{ x: -4, z: 26 }, { x: 5, z: 30 }],
    props: [
      { key: 'bridge_rail', x: -7, z: 45, heightM: 1.6 },
      { key: 'bridge_rail', x: 7, z: 45, heightM: 1.6, flip: true },
      { key: 'house', x: -26, z: 70, heightM: 10 },
      { key: 'house', x: 28, z: 76, heightM: 9, flip: true },
      { key: 'station', x: -34, z: 92, heightM: 10 },
      { key: 'lamp', x: -8, z: 30, heightM: 6 },
      { key: 'lamp', x: 8, z: 58, heightM: 6 },
      { key: 'car', x: 10, z: 26, heightM: 1.6 },
      ...NEAR_DEFENCES,
    ],
  },
  // ---------------------------------------------------------- Act 3: the source
  quarry: {
    id: 'quarry',
    name: 'Harlow Quarry',
    skyTint: 0xe8dcc8,
    groundTint: 0xd8c8b0,
    fogTint: 0xece0cc,
    barrel: { x: -7.4, z: 8.5 },
    drums: [{ x: -5, z: 24 }, { x: 6, z: 30 }, { x: -2, z: 46 }],
    props: [
      { key: 'crusher', x: 26, z: 70, heightM: 14 },
      { key: 'rock_0', x: -22, z: 40, heightM: 4.5 },
      { key: 'rock_1', x: 18, z: 34, heightM: 3.5, flip: true },
      { key: 'rock_0', x: -34, z: 76, heightM: 7, flip: true },
      { key: 'rock_1', x: -10, z: 62, heightM: 3 },
      { key: 'rock_0', x: 44, z: 92, heightM: 8 },
      { key: 'shed', x: -26, z: 24, heightM: 4.5 },
      { key: 'pole', x: 9, z: 52, heightM: 9 },
      { key: 'barrier', x: 3, z: 28, heightM: 0.85 },
      ...NEAR_DEFENCES,
    ],
  },
  railyard: {
    id: 'railyard',
    name: 'Harlow Rail Yard',
    skyTint: 0xd8d8d4,
    groundTint: 0xb8b4ac,
    fogTint: 0xdcdcd6,
    crossRoadZ: 22,
    barrel: { x: -7.4, z: 8.5 },
    drums: [{ x: -4, z: 30 }, { x: 6, z: 36 }, { x: 0, z: 52 }],
    props: [
      { key: 'boxcar_0', x: -20, z: 40, heightM: 3.6 },
      { key: 'boxcar_1', x: 22, z: 48, heightM: 3.6, flip: true },
      { key: 'boxcar_0', x: -26, z: 66, heightM: 3.6, flip: true },
      { key: 'boxcar_1', x: 30, z: 80, heightM: 3.6 },
      { key: 'signal', x: -9, z: 30, heightM: 5 },
      { key: 'signal', x: 10, z: 58, heightM: 5 },
      { key: 'lamp', x: 8, z: 34, heightM: 7 },
      { key: 'station', x: -40, z: 92, heightM: 9 },
      ...NEAR_DEFENCES,
    ],
  },
  gate: {
    id: 'gate',
    name: 'Meridian Gate',
    skyTint: 0xc8d0c8,
    groundTint: 0xb0b8b0,
    fogTint: 0xc8d8c8,
    barrel: { x: -7.4, z: 8.5 },
    drums: [{ x: -5, z: 22 }, { x: 5, z: 38 }],
    props: [
      { key: 'meridian', x: 0, z: 96, heightM: 22 },
      { key: 'fence', x: -16, z: 52, heightM: 3.2 },
      { key: 'fence', x: 16, z: 52, heightM: 3.2, flip: true },
      { key: 'tower', x: -22, z: 56, heightM: 11 },
      { key: 'tower', x: 24, z: 60, heightM: 11, flip: true },
      { key: 'lamp', x: -8, z: 30, heightM: 7 },
      { key: 'lamp', x: 8, z: 42, heightM: 7 },
      { key: 'car', x: -11, z: 34, heightM: 1.6 },
      ...NEAR_DEFENCES,
    ],
  },
  lab: {
    id: 'lab',
    name: 'Meridian Station',
    skyTint: 0xb0b8b8,
    groundTint: 0xa0a8a4,
    fogTint: 0xbcd0c0,
    barrel: { x: -7.4, z: 8.5 },
    drums: [{ x: -6, z: 26 }, { x: 6, z: 24 }, { x: 0, z: 40 }],
    props: [
      { key: 'meridian', x: -6, z: 70, heightM: 24 },
      { key: 'tank', x: -30, z: 46, heightM: 8 },
      { key: 'tank', x: 30, z: 52, heightM: 9, flip: true },
      { key: 'fence', x: -18, z: 30, heightM: 3.2 },
      { key: 'fence', x: 18, z: 32, heightM: 3.2, flip: true },
      { key: 'lamp', x: -9, z: 24, heightM: 7 },
      { key: 'lamp', x: 10, z: 36, heightM: 7 },
      ...NEAR_DEFENCES,
    ],
  },
  // ---------------------------------------------------------- Act 4: the coast
  harbour: {
    id: 'harbour',
    name: 'Saltmarsh Harbour',
    skyTint: 0xd0d8e0,
    groundTint: 0xb8bcb8,
    fogTint: 0xd8e2ea,
    barrel: { x: -7.4, z: 8.5 },
    drums: [{ x: -5, z: 24 }, { x: 6, z: 32 }, { x: -1, z: 48 }],
    props: [
      { key: 'crane', x: 28, z: 74, heightM: 18 },
      { key: 'crane', x: -36, z: 88, heightM: 18, flip: true },
      { key: 'container_0', x: -18, z: 40, heightM: 2.6 },
      { key: 'container_1', x: 20, z: 46, heightM: 2.6, flip: true },
      { key: 'container_1', x: -22, z: 60, heightM: 2.6 },
      { key: 'container_0', x: 14, z: 30, heightM: 2.6 },
      { key: 'boat', x: 34, z: 56, heightM: 5 },
      { key: 'lamp', x: -8, z: 28, heightM: 7 },
      ...NEAR_DEFENCES,
    ],
  },
  lighthouse: {
    id: 'lighthouse',
    name: 'Gull Point',
    skyTint: 0xd8dce4,
    groundTint: 0xc0c4b4,
    fogTint: 0xe0e6ee,
    barrel: { x: -7.4, z: 8.5 },
    drums: [{ x: -4, z: 26 }, { x: 5, z: 38 }],
    props: [
      { key: 'lighthouse', x: 26, z: 80, heightM: 26 },
      { key: 'rock_0', x: -24, z: 44, heightM: 4 },
      { key: 'rock_1', x: 16, z: 36, heightM: 3, flip: true },
      { key: 'rock_0', x: -40, z: 84, heightM: 7, flip: true },
      { key: 'boat', x: -20, z: 62, heightM: 5, flip: true },
      { key: 'house', x: 40, z: 60, heightM: 8 },
      { key: 'pole', x: -9, z: 40, heightM: 9 },
      ...NEAR_DEFENCES,
    ],
  },
  fort: {
    id: 'fort',
    name: 'Fort Ashby',
    skyTint: 0xc8ccd0,
    groundTint: 0xb4b0a4,
    fogTint: 0xd4c8d0,
    barrel: { x: -7.4, z: 8.5 },
    drums: [{ x: -6, z: 24 }, { x: 6, z: 28 }, { x: 0, z: 44 }],
    props: [
      { key: 'fort_wall', x: -20, z: 70, heightM: 8 },
      { key: 'fort_wall', x: 20, z: 72, heightM: 8, flip: true },
      { key: 'tower', x: -34, z: 60, heightM: 12 },
      { key: 'tower', x: 34, z: 64, heightM: 12, flip: true },
      { key: 'container_0', x: -14, z: 34, heightM: 2.6 },
      { key: 'lamp', x: 9, z: 30, heightM: 7 },
      ...NEAR_DEFENCES,
    ],
  },
};
