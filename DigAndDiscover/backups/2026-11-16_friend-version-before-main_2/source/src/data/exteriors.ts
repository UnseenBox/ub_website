import type { Rng } from '../core/Random';

/**
 * Outside looks of a rock: the 61 hand-painted rocks (art/rocks/rock-NN.png). Each belongs to a tier
 * that follows rarity - plain stones for common finds up to glowing crystals and lava for legendary
 * ones - but the match is only a lean, never a promise (see pickExterior).
 */
export interface ExteriorDef {
  id: string;
  name: string;
  /** Texture key of the painted rock. */
  sprite: string;
  /** 0 = plain stone ... 4 = the showiest rocks. Follows the rarity tier. */
  tier: number;
  /** Colours of the picture, used for the rind of the cut rock. */
  base: number;
  light: number;
  shade: number;
  speckle: number;
  /** Half the picture's height as a share of half its width: the rock's footprint on the bench. */
  squash: number;
}

export const ROCK_SPRITE_PREFIX = 'rocksprite-';

function ex(n: number, tier: number, base: number, light: number, shade: number, speckle: number, squash: number): ExteriorDef {
  const id = `rock-${String(n).padStart(2, '0')}`;
  return { id, name: `Rock ${n}`, sprite: ROCK_SPRITE_PREFIX + id, tier, base, light, shade, speckle, squash };
}

export const EXTERIORS: readonly ExteriorDef[] = [
  ex(1, 0, 0xab9290, 0xd4c0b8, 0x69615a, 0x526b0f, 0.807),
  ex(2, 0, 0xaa3e27, 0xf8865a, 0x7c271f, 0x702421, 0.851),
  ex(3, 2, 0xe97c01, 0xfee952, 0xb04c03, 0xaa4401, 0.861),
  ex(4, 3, 0x4c465f, 0x6c6187, 0x2c234f, 0x3d01b0, 0.796),
  ex(5, 0, 0xe5ae79, 0xf9e0b6, 0xd18130, 0xa66d47, 0.804),
  ex(6, 2, 0x00a5fd, 0x9cf0fd, 0x0067fa, 0x005fe9, 1.071),
  ex(7, 0, 0x768141, 0xb3d224, 0x525837, 0x445526, 0.83),
  ex(8, 0, 0x2b2a48, 0x7a78a1, 0x141628, 0x111423, 0.837),
  ex(9, 2, 0x6a3aa4, 0xe28afe, 0x6202c2, 0x5208a8, 0.908),
  ex(10, 0, 0xbf5c36, 0xf7a552, 0x602514, 0x4f2226, 0.805),
  ex(11, 2, 0x97a0c0, 0xe4e0e2, 0x67729a, 0x546491, 0.842),
  ex(12, 3, 0xc52617, 0xfd8500, 0x432833, 0x322333, 0.796),
  ex(13, 3, 0x8b2234, 0xdc6f7b, 0x711725, 0x900216, 0.859),
  ex(14, 1, 0x7398e5, 0xb1d0fa, 0x4f6ebb, 0x2c6bb3, 0.76),
  ex(15, 2, 0x37866d, 0x5ac79a, 0x096154, 0x04594e, 0.822),
  ex(16, 2, 0x2045ca, 0x5c99fc, 0x0e27a0, 0x072183, 0.866),
  ex(17, 0, 0xf09e35, 0xfdd472, 0xb36829, 0xaa5e22, 0.914),
  ex(18, 4, 0x754018, 0xf0ad07, 0x472c25, 0x3a292b, 0.832),
  ex(19, 3, 0xaa02e9, 0xfb7dfb, 0x5e05a6, 0x2d2239, 0.962),
  ex(20, 1, 0xa0765b, 0xe5af76, 0x735238, 0x52454a, 0.789),
  ex(21, 0, 0x915946, 0xd2905f, 0x673e2b, 0x603422, 0.747),
  ex(22, 2, 0x03cdb3, 0xc1f4f1, 0x0097a7, 0x038f94, 0.833),
  ex(23, 3, 0xea0e02, 0xfd4d01, 0x412330, 0x311d31, 0.847),
  ex(24, 1, 0xbc999c, 0xcdbbfa, 0x7975e8, 0x6d63d4, 0.821),
  ex(25, 0, 0x797e4b, 0xaac205, 0x506126, 0x415231, 0.788),
  ex(26, 0, 0x7d7789, 0xc0b8be, 0x565164, 0x49455d, 0.713),
  ex(27, 0, 0xb45b2f, 0xf19c5a, 0x81381b, 0x70321d, 0.729),
  ex(28, 0, 0xdf9e5a, 0xfedc92, 0xb26938, 0xa75f31, 0.754),
  ex(29, 0, 0x3b3c51, 0x8c89a5, 0x1c1c2b, 0x171626, 0.813),
  ex(30, 0, 0x756466, 0xbbac9a, 0x326001, 0x453e37, 0.749),
  ex(31, 0, 0xb32e18, 0xfd6934, 0x84190d, 0x6f180c, 0.712),
  ex(32, 2, 0x0299fb, 0x3af8ff, 0x0260f7, 0x0151da, 0.917),
  ex(33, 2, 0x7e01fe, 0xf978fb, 0x4e00c5, 0x4300a2, 0.884),
  ex(34, 3, 0x00aa70, 0x92f5a7, 0x017150, 0x015b4f, 0.806),
  ex(35, 2, 0xd27001, 0xfcf304, 0x5c413e, 0x4f342b, 0.796),
  ex(36, 1, 0x9195a9, 0xe5e9ef, 0x555d7b, 0x4d5272, 0.815),
  ex(37, 0, 0xc25320, 0xfead5c, 0x8c2e1a, 0x74281c, 0.746),
  ex(38, 2, 0x5fc7fd, 0xc1f3f9, 0x38a7f9, 0x3696e9, 0.799),
  ex(39, 3, 0x7b3342, 0xfdad00, 0x37222f, 0x42111e, 0.732),
  ex(40, 3, 0x7500ca, 0x7b4a86, 0x2d1c33, 0x251630, 0.725),
  ex(41, 1, 0x04968a, 0x34ebd6, 0x065a5b, 0x004c4e, 0.685),
  ex(42, 1, 0xbc895a, 0xfacb7f, 0x97592d, 0x78513f, 0.749),
  ex(43, 2, 0xdcaa70, 0xedcc9d, 0x9c6637, 0x885b3c, 0.781),
  ex(44, 0, 0x88737d, 0xcbbabc, 0x554a52, 0x483c4b, 0.756),
  ex(45, 0, 0x81303e, 0xf35549, 0x5e1622, 0x58101a, 0.713),
  ex(46, 0, 0xa09091, 0xccbab1, 0x685c67, 0x634c47, 0.675),
  ex(47, 2, 0xb2a0a4, 0xd6d0cc, 0x64647b, 0x58576a, 0.767),
  ex(48, 4, 0x6b4774, 0xe9bcf1, 0x5107b7, 0x37145e, 0.832),
  ex(49, 1, 0xf98012, 0xf3d6c5, 0xb2451d, 0x993415, 0.654),
  ex(50, 2, 0x5e5650, 0xa0ce45, 0x353433, 0x2b2e2b, 0.764),
  ex(51, 3, 0xfd6e04, 0xfcd000, 0xd53b01, 0xaf3d03, 0.86),
  ex(52, 3, 0x119af2, 0x9df5fd, 0x03569a, 0x064893, 0.746),
  ex(53, 0, 0xe68f24, 0xfdcd6f, 0xab5212, 0x9a4a0f, 0.702),
  ex(54, 1, 0x484157, 0xac928d, 0x252037, 0x1f1828, 0.799),
  ex(55, 1, 0xe8bb8e, 0xfaf5e3, 0xc38e6d, 0xb87a50, 0.815),
  ex(56, 3, 0x860cb0, 0xaa57b9, 0x3d0f5d, 0x300e4c, 0.735),
  ex(57, 4, 0x367675, 0xf4c907, 0x254039, 0x10393b, 0.728),
  ex(58, 1, 0x82a3f0, 0xfafafc, 0x435380, 0x41496c, 0.736),
  ex(59, 3, 0x287605, 0x92ef0c, 0x2c3e2b, 0x233525, 0.753),
  ex(60, 4, 0xd0022c, 0xfd6e86, 0x91000e, 0x720119, 0.768),
  ex(61, 0, 0x66739a, 0xadb8c8, 0x333d5d, 0x2c344f, 0.64),
];

const BY_TIER: ExteriorDef[][] = [0, 1, 2, 3, 4].map((t) => EXTERIORS.filter((e) => e.tier === t));

/**
 * The rock's outside for a rarity tier: mostly a rock of its own tier, sometimes one a step plainer or
 * showier, so a glowing rock is a good sign but never a sure one.
 */
export function pickExterior(rng: Rng, tier: number): ExteriorDef {
  const roll = rng();
  const t = Math.max(0, Math.min(4, roll < 0.7 ? tier : roll < 0.9 ? tier - 1 : tier + 1));
  let pool = BY_TIER[t];
  for (let d = 1; pool.length === 0 && d < 5; d++) pool = BY_TIER[Math.max(0, t - d)].length ? BY_TIER[Math.max(0, t - d)] : BY_TIER[Math.min(4, t + d)];
  return pool[Math.floor(rng() * pool.length)];
}
