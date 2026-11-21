// Render layering. Battlefield objects (props, zombies, fog bands, the gunship)
// use depthForZ() in the 1000–2000 range so nearer things draw on top.
export const DEPTH = {
  sky: 0,
  clouds: 1,
  backdrop: 2,
  ground: 5,
  decals: 10,
  worldFx: 2500,
  parapet: 3000,
  shutters: 3050,
  tracer: 3500,
  frame: 3900,
  gun: 4000,
  muzzle: 4010,
  casings: 4020,
  overlay: 4200,
  floatText: 4500,
  hud: 5000,
  banner: 5200,
  crosshair: 5500,
} as const;
