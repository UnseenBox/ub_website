// The whole game's colour discipline, in one place.
//
// Black is the ground state and white is the material. Structures, debris,
// scenery, particles and most readouts are drawn in the greyscale ramp below,
// so when nothing is happening the screen is monochrome.
//
// Two accents, and only two, both reserved for information the player must
// act on:
//
//   ACC (amber)  — the things that steer the next shot: the aim arc, the
//                  power readout, the live core targets, the loaded shot.
//   HOT (red)    — exceptional events only: a core going offline, a chain
//                  reaction, a structural collapse, an overdrive launch.
//
// Nothing else gets colour. Adding a third accent, or using ACC for ordinary
// scenery or score popups, is what makes the screen read as noise instead of
// as a signal, so new colour belongs in this file or nowhere.
export const PAL = {
  black: '#000000',
  void: '#0a0c12',    // the sky sits a shade above black so black silhouettes read as holes in it
  white: '#ffffff',
  bone: '#dcdad2',    // primary material tone
  grey: '#8e8c84',    // secondary structure, mid scenery
  dim: '#54534c',     // far scenery, inert detail
  faint: '#2a2a26',   // deepest readable tone
  acc: '#ffb000',     // amber: aim, power, live cores
  accDim: '#8a5f00',
  hot: '#ff2f45',     // red: destruction, combos, collapse
};

// Material identity comes from glyph density and pattern, never from hue.
// Each entry is a greyscale tone plus the character set that builds it:
// heavy packed glyphs for stone, open linework for timber, sparse delicate
// marks for glass, solid banding for immovable steel.
export const MAT = {
  // `thinV`/`thinH` are the single glyph a member collapses to in the wide
  // shot, chosen by its orientation: a beam drawn with the upright glyph
  // reads as a row of pickets instead of a beam.
  stone: {
    tone: PAL.bone, edge: PAL.white, dim: PAL.grey,
    border: '#', thinV: '#', thinH: '#',
    fill: ['#', '%', '&', '@', '#'], density: 0.92, weight: 'heavy',
  },
  wood: {
    tone: PAL.grey, edge: PAL.bone, dim: PAL.dim,
    border: '|', thinV: '|', thinH: '=',
    fill: ['+', '=', '|', '+'], density: 0.46, weight: 'open',
  },
  glass: {
    tone: PAL.dim, edge: PAL.bone, dim: PAL.faint,
    border: ':', thinV: ':', thinH: '-',
    fill: ['.', ':', '·'], density: 0.17, weight: 'sparse',
  },
  steel: {
    tone: PAL.white, edge: PAL.white, dim: PAL.grey,
    border: '=', thinV: '#', thinH: '=',
    fill: ['#', '#', '=', '#'], density: 0.98, weight: 'solid',
  },
};

// Debris glyph sets, by material, for particles and fragments.
export const DEBRIS = {
  stone: ['#', '%', '&', '*'],
  wood: ['+', '=', '/', '|'],
  glass: ['.', ':', '*', '·'],
  steel: ['#', '='],
};
