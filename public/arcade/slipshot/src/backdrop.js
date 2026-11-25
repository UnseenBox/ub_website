// src/backdrop.js
// Alien space backdrop module for SLIPSHOT endless mode (task 7a).
// ES module, no dependencies, canvas 2D paths only (no images).
// Deterministic seeded RNG, all visual parameters in BACKDROP_CFG.

const TAU = Math.PI * 2;
const HALF_PI = Math.PI * 0.5;

// ---- Seeded RNG (Mulberry32) ----
function makeRNG(seed) {
  let state = seed >>> 0;
  return function rng() {
    state += 0x6D2B79F5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Helpers ----
const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

function hashSeed(seed, salt) {
  let h = (seed ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 1 | h);
  h ^= h + Math.imul(h ^ (h >>> 7), 61 | h);
  return (h ^ (h >>> 14)) >>> 0;
}

function rngRange(rng, min, max) {
  return min + rng() * (max - min);
}

function rngInt(rng, min, max) {
  return Math.floor(rngRange(rng, min, max + 1));
}

function rngChoice(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function rngBool(rng, p = 0.5) {
  return rng() < p;
}

// Color utilities
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function rgbToHex(r, g, b) {
  const toHex = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixColors(c1, c2, t) {
  return {
    r: lerp(c1.r, c2.r, t),
    g: lerp(c1.g, c2.g, t),
    b: lerp(c1.b, c2.b, t),
  };
}

function colorWithAlpha(hex, alpha) {
  const c = hexToRgb(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${alpha})`;
}

// ---- Configuration ----
export const BACKDROP_CFG = {
  quality: { high: { stars: 50, galaxies: 4, moons: 1, ships: 7, skylinePieces: 14, planetStripes: 8 }, low: { stars: 10, galaxies: 2, moons: 0, ships: 1, skylinePieces: 4, planetStripes: 3 } },

  parallax: {
    galaxies: 0.02,
    nebula: 0.02,
    starsFar: 0.03,
    starsMid: 0.05,
    starsNear: 0.08,
    planet: 0.05,
    moons: 0.06,
    skylineFar: 0.10,
    skylineNear: 0.22,
    shipsFar: 0.06,
    shipsMid: 0.12,
    shipsNear: 0.18,
    mothership: 0.06,
    haze: 0.15,
    aurora: 0.04,
  },

  planet: { radiusFraction: 0.38, maxAlpha: 0.85, stripeCount: { high: 8, low: 6 } },
  skyline: { wrapMin: 90, wrapMax: 120, pieceWidthMin: 3, pieceWidthMax: 8, maxHeightFar: 0.45, maxHeightNear: 0.55 },
  stars: { twinkleSpeed: 2.5, shootingIntervalMin: 9, shootingIntervalMax: 14, shootingDuration: 0.8 },
  ships: { driftSpeed: 0.02, wrapMargin: 100 },
  galaxies: { rotationSpeed: 0.008, armCount: 2 },
  haze: { maxAlpha: 0.35, heightFraction: 0.15 },
  aurora: { maxAlpha: 0.18, count: 2, frequency: 0.003, amplitude: 0.08, speed: 0.0005 },

  colors: {
    skyTop: '#040b19',
    skyMid: '#0a1b35',
    skyBottom: '#14325d',
    star: '#6f9fd8',
    windowWarm: '#ffd86b',
    windowTeal: '#6de8ff',
    windowPink: '#ffb3d9',
    galaxyCore: '#b9a8ff',
    galaxyArm: '#6d5ca6',
    nebulaPurple: '#4b3f72',
    nebulaTeal: '#2aa8a8',
    nebulaMagenta: '#a84a8a',
    planetTeal: '#2a8a8a',
    planetOrange: '#cc6633',
    planetViolet: '#6a4a9a',
    planetRing: '#8a7a9a',
    planetAtmo: '#4aa8a8',
    skylineFar: '#2b2557',
    skylineNear: '#1c1745',
    skylineRim: '#a99bff',
    shipGlow: '#ffd86b',
    shipEngine: '#ff8844',
    shipHull: '#4a4062',
    hazePurple: '#4b3f72',
    hazeTeal: '#2a8a8a',
    auroraTeal: '#4ae8a8',
    auroraPurple: '#a86ae8',
  },
};

// ---- Backdrop data creation ----
export function createBackdrop(seed) {
  const rng = makeRNG(seed >>> 0);
  const cfg = BACKDROP_CFG;
  const q = cfg.quality.high;

  const planetFamily = rngInt(rng, 0, 2);
  const planetBaseColor = planetFamily === 0 ? cfg.colors.planetTeal : planetFamily === 1 ? cfg.colors.planetOrange : cfg.colors.planetViolet;
  const planetBaseRgb = hexToRgb(planetBaseColor);

  // Galaxies
  const galaxies = [];
  for (let i = 0; i < q.galaxies; i++) {
    const type = i % 3; // spiral, elliptical, barred ...
    const angle = rngRange(rng, 0, TAU);
    const coreAlpha = rngRange(rng, 0.5, 0.75);
    const armAlpha = rngRange(rng, 0.3, 0.5);
    const size = rngRange(rng, 0.13, 0.26);
    const posX = (i + 0.5) / q.galaxies + rngRange(rng, -0.06, 0.06); // evenly spread over one strip period
    const posY = rngRange(rng, 0.2, 0.5);
    galaxies.push({
      type,
      angle,
      coreAlpha,
      armAlpha,
      size,
      posX,
      posY,
      rotationOffset: rngRange(rng, 0, TAU),
      arms: Array.from({ length: cfg.galaxies.armCount }, () => ({
        tightness: rngRange(rng, 0.3, 0.8),
        length: rngRange(rng, 0.7, 1.1),
        width: rngRange(rng, 0.03, 0.06),
      })),
    });
  }

  // Nebulae
  const nebulae = [];
  for (let i = 0; i < 2; i++) {
    const colors = [cfg.colors.nebulaPurple, cfg.colors.nebulaTeal, cfg.colors.nebulaMagenta];
    nebulae.push({
      posX: rngRange(rng, -0.3, 1.3),
      posY: rngRange(rng, -0.2, 0.7),
      radius: rngRange(rng, 0.3, 0.6),
      color: rngChoice(rng, colors),
      alpha: rngRange(rng, 0.06, 0.15),
      drift: rngRange(rng, -0.0001, 0.0001),
    });
  }

  // Stars (three depth bands)
  const stars = { far: [], mid: [], near: [] };
  const createStars = (count, band) => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: rngRange(rng, -0.1, 1.1),
        y: rngRange(rng, -0.05, 0.75),
        size: rngRange(rng, 0.5, band === 'near' ? 2.5 : band === 'mid' ? 1.8 : 1.2),
        brightness: rngRange(rng, 0.3, 1.0),
        twinklePhase: rngRange(rng, 0, TAU),
        twinkleSpeed: rngRange(rng, 0.8, 1.2) * cfg.stars.twinkleSpeed,
        color: rngBool(rng, 0.85) ? cfg.colors.star : rngChoice(rng, [cfg.colors.windowWarm, cfg.colors.windowTeal, cfg.colors.windowPink]),
      });
    }
    return arr;
  };
  stars.far = createStars(Math.floor(q.stars * 0.4), 'far');
  stars.mid = createStars(Math.floor(q.stars * 0.35), 'mid');
  stars.near = createStars(Math.floor(q.stars * 0.25), 'near');

  // Shooting stars
  const shootingStars = [];
  for (let i = 0; i < 2; i++) {
    shootingStars.push({
      startX: rngRange(rng, -0.2, 1.2),
      startY: rngRange(rng, -0.1, 0.5),
      angle: rngRange(rng, -0.8, -0.3),
      speed: rngRange(rng, 0.8, 1.5),
      interval: rngRange(rng, cfg.stars.shootingIntervalMin, cfg.stars.shootingIntervalMax),
      phase: rngRange(rng, 0, TAU),
      length: rngRange(rng, 0.15, 0.35),
    });
  }

  // Planet - posX adjusted to be visible at camX=0
  const planetRadiusFraction = cfg.planet.radiusFraction;
  const maxStripes = cfg.planet.stripeCount.high;
  const planet = {
    radiusFraction: planetRadiusFraction,
    posX: rngRange(rng, 0.2, 0.7), // visible on screen
    posY: rngRange(rng, 0.05, 0.35),
    baseColor: planetBaseColor,
    baseColorRgb: planetBaseRgb,
    stripeCount: maxStripes,
    stripeColors: Array.from({ length: maxStripes }, () => {
      const t = rngRange(rng, 0.15, 0.45);
      return rgbToHex(
        lerp(planetBaseRgb.r, 0.05, t) * 255,
        lerp(planetBaseRgb.g, 0.05, t) * 255,
        lerp(planetBaseRgb.b, 0.05, t) * 255
      );
    }),
    ring: {
      innerRadius: planetRadiusFraction * 1.15,
      outerRadius: planetRadiusFraction * 1.65,
      tilt: rngRange(rng, 0.25, 0.55),
      color: cfg.colors.planetRing,
      alpha: rngRange(rng, 0.25, 0.45),
      rotation: rngRange(rng, 0, TAU),
      rotationSpeed: rngRange(rng, 0.00005, 0.00015),
    },
    atmosphere: {
      thickness: planetRadiusFraction * 0.04,
      color: cfg.colors.planetAtmo,
      alpha: rngRange(rng, 0.15, 0.35),
    },
    terminator: rngRange(rng, 0, TAU),
    terminatorSpeed: rngRange(rng, 0.00002, 0.00008),
    maxAlpha: cfg.planet.maxAlpha,
  };

  // Moons
  const moons = [];
  for (let i = 0; i < q.moons; i++) {
    const moonRng = makeRNG(hashSeed(seed, 1000 + i));
    const maxCraters = 8;
    moons.push({
      radiusFraction: rngRange(moonRng, 0.025, 0.055),
      orbitRadius: planetRadiusFraction * rngRange(moonRng, 1.8, 3.2),
      orbitAngle: rngRange(moonRng, 0, TAU),
      orbitSpeed: rngRange(moonRng, 0.00008, 0.00025),
      tilt: rngRange(moonRng, 0.1, 0.6),
      craterCount: rngInt(moonRng, 3, maxCraters),
      craters: Array.from({ length: maxCraters }, () => ({
        x: rngRange(moonRng, -0.7, 0.7),
        y: rngRange(moonRng, -0.7, 0.7),
        r: rngRange(moonRng, 0.08, 0.22),
      })),
      litAngle: rngRange(moonRng, 0, TAU),
    });
  }

  // Skyline (two bands): a CITY of alien towers (task 7a2). Pieces are narrow towers in clusters with gaps; geometry is built at draw time
  // from (type, width, height, seed) so windows only ever sit inside solid walls.
  const skylineWrap = rngRange(rng, cfg.skyline.wrapMin, cfg.skyline.wrapMax);
  const CITY_TYPE_WEIGHTS = [18, 14, 12, 10, 12, 12, 8, 14]; // needle, ziggurat, mushroom, dome complex, saucer, corkscrew, arch, twin towers
  const pickCityType = (r) => {
    let t = r() * 100;
    for (let k = 0; k < CITY_TYPE_WEIGHTS.length; k++) { t -= CITY_TYPE_WEIGHTS[k]; if (t < 0) return k; }
    return 0;
  };
  const createSkyline = (band) => {
    const isFar = band === 'far';
    const cr = makeRNG(hashSeed(seed, isFar ? 5100 : 5200));
    const pieces = [];
    let x = 0, inCluster = 0, clusterLen = rngInt(cr, 3, 6);
    for (let guard = 0; guard < 400; guard++) {
      const type = pickCityType(cr);
      const wide = type === 3 || type === 6 || type === 7;
      const width = wide ? rngRange(cr, isFar ? 1.3 : 2.2, isFar ? 2.2 : 3.4) : rngRange(cr, isFar ? 0.38 : 0.55, isFar ? 1.1 : 1.5);
      if (x + width > skylineWrap - 0.5) break;
      const hf = isFar ? rngRange(cr, 0.10, 0.32) : rngRange(cr, 0.17, 0.48);
      pieces.push({ x, width, height: wide ? hf * 0.85 : hf, type, seed: rngInt(cr, 1, 1000000000) });
      x += width + rngRange(cr, 0, 0.5);
      if (++inCluster >= clusterLen) { inCluster = 0; clusterLen = rngInt(cr, 3, 6); x += rngRange(cr, 1.0, 3.0); }
    }
    return { pieces, wrapWidth: skylineWrap, color: isFar ? cfg.colors.skylineFar : cfg.colors.skylineNear, rimColor: cfg.colors.skylineRim, isFar };
  };
  const skylineFar = createSkyline('far');
  const skylineNear = createSkyline('near');

  // Ships (task 7a2): 3 depth bands, sizes in px at a 540 px tall screen (scaled at draw time), all drifting along a repeating strip.
  const ships = [];
  const shipPlan = q.ships >= 5
    ? [['saucer', 2], ['cruiser', 2], ['fighters', 1], ['saucer', 1], ['cruiser', 0], ['saucer', 0], ['fighters', 0]]
    : [['saucer', 2], ['cruiser', 1]];
  for (let i = 0; i < shipPlan.length; i++) {
    const [type, depthBand] = shipPlan[i];
    const shipRng = makeRNG(hashSeed(seed, 2000 + i));
    const sizePx = depthBand === 2 ? rngRange(shipRng, 62, 92) : depthBand === 1 ? rngRange(shipRng, 34, 50) : rngRange(shipRng, 16, 26);
    ships.push({
      type,
      depthBand,
      x: (i + 0.5) / shipPlan.length + rngRange(shipRng, -0.05, 0.05), // fraction of the strip period
      y: rngRange(shipRng, 0.1, 0.3),
      speed: rngRange(shipRng, 6, 18) * (depthBand === 0 ? 0.5 : depthBand === 1 ? 0.8 : 1) * (rngBool(shipRng, 0.5) ? 1 : -1), // px/s at 540 px height
      sizePx,
      size: sizePx / 540,
      angle: rngRange(shipRng, -0.04, 0.04),
      windowCount: rngInt(shipRng, 5, 9),
      engineGlow: true,
      alpha: depthBand === 0 ? 0.75 : 0.95,
      lights: [],
    });
  }
  // One huge distant mothership silhouette
  const mothershipRng = makeRNG(hashSeed(seed, 9999));
  const mothershipLights = [];
  for (let i = 0; i < 26; i++) {
    mothershipLights.push({
      relX: rngRange(mothershipRng, -0.45, 0.4),
      relY: rngRange(mothershipRng, -0.08, 0.08),
      color: rngChoice(mothershipRng, [cfg.colors.windowWarm, cfg.colors.windowTeal]),
    });
  }
  ships.push({
    type: 'mothership',
    depthBand: 0,
    x: rngRange(mothershipRng, 0.1, 0.9),
    y: rngRange(mothershipRng, 0.14, 0.26),
    speed: rngRange(mothershipRng, 2, 4) * (rngBool(mothershipRng, 0.5) ? 1 : -1),
    sizePx: 260,
    size: 260 / 540,
    angle: rngRange(mothershipRng, -0.03, 0.03),
    windowCount: mothershipLights.length,
    engineGlow: true,
    alpha: 0.55,
    lights: mothershipLights,
  });

  // Haze / Aurora
  const haze = {
    color1: cfg.colors.hazePurple,
    color2: cfg.colors.hazeTeal,
    heightFraction: cfg.haze.heightFraction,
    maxAlpha: cfg.haze.maxAlpha,
  };

  const auroras = [];
  for (let i = 0; i < cfg.aurora.count; i++) {
    auroras.push({
      color: rngBool(rng, 0.5) ? cfg.colors.auroraTeal : cfg.colors.auroraPurple,
      phase: rngRange(rng, 0, TAU),
      frequency: cfg.aurora.frequency * rngRange(rng, 0.7, 1.3),
      amplitude: cfg.aurora.amplitude * rngRange(rng, 0.7, 1.3),
      yCenter: rngRange(rng, 0.1, 0.4),
      thickness: rngRange(rng, 0.02, 0.05),
      alpha: rngRange(rng, 0.06, cfg.aurora.maxAlpha),
      speed: cfg.aurora.speed * rngRange(rng, 0.5, 1.5),
    });
  }

  return {
    seed: seed >>> 0,
    galaxies,
    nebulae,
    stars,
    shootingStars,
    planet,
    moons,
    skylineFar,
    skylineNear,
    ships,
    haze,
    auroras,
    skylineWrap,
    cfg: {
      parallax: cfg.parallax,
      colors: cfg.colors,
      stars: cfg.stars,
      quality: cfg.quality,
      galaxies: { rotationSpeed: cfg.galaxies.rotationSpeed, armCount: cfg.galaxies.armCount },
    },
  };
}

// ---- Drawing ----
function drawGalaxies(ctx, view, time, backdrop, opts) {
  const { width, height, camX } = view;
  const pxPerMetre = opts.pxPerMetre ?? 40;
  const parallax = backdrop.cfg.parallax.galaxies;
  const shift = -camX * parallax * pxPerMetre;
  const rotSpeed = backdrop.cfg.galaxies.rotationSpeed;
  const quality = opts.quality ?? 'high';
  const maxGalaxies = backdrop.cfg.quality[quality].galaxies;
  const period = width * 1.6;
  const dots = quality === "low" ? 10 : 28;
  const n = Math.min(backdrop.galaxies.length, maxGalaxies);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const g = backdrop.galaxies[i];
    const size = Math.max(60, g.size * Math.min(width, height) * 1.0);
    const baseX = (((g.posX * period + shift) % period) + period) % period - period * 0.2; // strip repeats every `period`
    for (let rep = 0; rep < 2; rep++) {
      const gx = baseX + rep * period;
      if (gx < -size * 1.4 || gx > width + size * 1.4) continue;
      const gy = g.posY * height;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(g.angle + time * rotSpeed + g.rotationOffset);
      if (g.type === 1) ctx.scale(1, 0.45); // edge-on elliptical

      const core = backdrop.cfg.colors.galaxyCore;
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.6);
      coreGrad.addColorStop(0, colorWithAlpha(core, g.coreAlpha));
      coreGrad.addColorStop(0.35, colorWithAlpha(core, g.coreAlpha * 0.35));
      coreGrad.addColorStop(1, colorWithAlpha(core, 0));
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.6, 0, TAU);
      ctx.fill();
      const hot = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.14);
      hot.addColorStop(0, 'rgba(255,244,214,0.85)');
      hot.addColorStop(1, 'rgba(255,244,214,0)');
      ctx.fillStyle = hot;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.14, 0, TAU);
      ctx.fill();

      const armCol = backdrop.cfg.colors.galaxyArm;
      if (g.type === 2) { // barred: bright bar through the core, the spiral arms start from it
        const barGrad = ctx.createLinearGradient(-size * 0.5, 0, size * 0.5, 0);
        barGrad.addColorStop(0, colorWithAlpha(armCol, 0));
        barGrad.addColorStop(0.5, colorWithAlpha(armCol, Math.min(1, g.armAlpha * 1.6)));
        barGrad.addColorStop(1, colorWithAlpha(armCol, 0));
        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.5, size * 0.12, 0, 0, TAU);
        ctx.fill();
      }
      if (g.type !== 1) { // spiral arms (types 0 and 2)
        for (let arm = 0; arm < g.arms.length; arm++) {
          const a = g.arms[arm];
          ctx.save();
          ctx.rotate((arm / g.arms.length) * TAU);
          for (let k = 0; k < dots; k++) {
            const t = k / dots;
            const r = size * a.length * (0.15 + 0.85 * t);
            const theta = t * 4.2 * a.tightness * Math.PI;
            const dotSize = Math.max(1, size * a.width * (1 - t * 0.5));
            ctx.fillStyle = colorWithAlpha(armCol, Math.min(1, g.armAlpha * (1 - t * 0.6)));
            ctx.beginPath();
            ctx.arc(Math.cos(theta) * r, Math.sin(theta) * r, dotSize, 0, TAU);
            ctx.fill();
          }
          ctx.restore();
        }
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawNebulae(ctx, view, time, backdrop, opts) {
  const { width, height, camX } = view;
  const pxPerMetre = opts.pxPerMetre ?? 40;
  const parallax = backdrop.cfg.parallax.nebula;
  const cx = width * 0.5 - camX * parallax * pxPerMetre;

  for (const n of backdrop.nebulae) {
    const nx = cx + (n.posX + n.drift * time) * width;
    const ny = n.posY * height;
    const radius = n.radius * Math.min(width, height);
    const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, radius);
    grad.addColorStop(0, colorWithAlpha(n.color, n.alpha));
    grad.addColorStop(0.5, colorWithAlpha(n.color, n.alpha * 0.3));
    grad.addColorStop(1, colorWithAlpha(n.color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(nx, ny, radius, 0, TAU);
    ctx.fill();
  }
}

function drawStars(ctx, view, time, backdrop, opts) {
  const { width, height, camX } = view;
  const pxPerMetre = opts.pxPerMetre ?? 40;
  const quality = opts.quality ?? 'high';
  const starCounts = backdrop.cfg.quality[quality].stars;
  const isLow = quality === 'low';

  const bands = [
    { stars: backdrop.stars.far, parallax: backdrop.cfg.parallax.starsFar, maxCount: Math.floor(starCounts * 0.4) },
    { stars: backdrop.stars.mid, parallax: backdrop.cfg.parallax.starsMid, maxCount: Math.floor(starCounts * 0.35) },
    { stars: backdrop.stars.near, parallax: backdrop.cfg.parallax.starsNear, maxCount: Math.floor(starCounts * 0.25) },
  ];

  for (const band of bands) {
    const cx = width * 0.5 - camX * band.parallax * pxPerMetre;
    const count = isLow ? band.maxCount : band.stars.length;
    // Batch stars by color to reduce fillStyle changes
    const byColor = {};
    for (let i = 0; i < count; i++) {
      const s = band.stars[i];
      const twinkle = 0.5 + 0.5 * Math.sin(time * s.twinkleSpeed + s.twinklePhase);
      const alpha = s.brightness * twinkle;
      const sx = (cx + s.x * width) % width;
      const sy = s.y * height;
      if (sx < -2 || sx > width + 2 || sy < -2 || sy > height + 2) continue;
      const key = `${s.color}|${alpha.toFixed(2)}|${s.size.toFixed(1)}`;
      if (!byColor[key]) byColor[key] = [];
      byColor[key].push({ x: sx, y: sy, size: s.size });
    }
    for (const [key, stars] of Object.entries(byColor)) {
      const [color, alphaStr, sizeStr] = key.split('|');
      const alpha = parseFloat(alphaStr);
      ctx.fillStyle = colorWithAlpha(color, alpha);
      for (const s of stars) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(0.5, parseFloat(sizeStr)), 0, TAU);
        ctx.fill();
      }
    }
  }

  // Shooting stars
  for (const ss of backdrop.shootingStars) {
    const cx = width * 0.5 - camX * backdrop.cfg.parallax.starsMid * pxPerMetre;
    const cycle = (time + ss.phase) / ss.interval;
    const phase = cycle - Math.floor(cycle);
    if (phase < ss.duration / ss.interval) {
      const t = phase * ss.interval / ss.duration;
      const sx = cx + (ss.startX + Math.cos(ss.angle) * t * ss.length) * width;
      const sy = (ss.startY + Math.sin(ss.angle) * t * ss.length) * height;
      if (sx > -50 && sx < width + 50 && sy > -50 && sy < height + 50) {
        const grad = ctx.createLinearGradient(sx, sy, sx - Math.cos(ss.angle) * 30, sy - Math.sin(ss.angle) * 30);
        grad.addColorStop(0, colorWithAlpha(backdrop.cfg.colors.star, 0.9));
        grad.addColorStop(1, colorWithAlpha(backdrop.cfg.colors.star, 0));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - Math.cos(ss.angle) * 30, sy - Math.sin(ss.angle) * 30);
        ctx.stroke();
      }
    }
  }
}

function drawPlanet(ctx, view, time, backdrop, opts) {
  const { width, height, camX } = view;
  const pxPerMetre = opts.pxPerMetre ?? 40;
  const parallax = backdrop.cfg.parallax.planet;
  const cx = width * 0.5 - camX * parallax * pxPerMetre;
  const quality = opts.quality ?? 'high';
  const maxStripes = backdrop.cfg.quality[quality].planetStripes ?? backdrop.planet.stripeCount;

  const p = backdrop.planet;
  const radius = p.radiusFraction * Math.min(width, height);
  const px = cx + p.posX * width;
  const py = p.posY * height;

  // No culling - planet should always draw (major feature)
  ctx.save();
  ctx.translate(px, py);

  // Planet body - banded stripes
  const stripeCount = Math.min(p.stripeCount, maxStripes);
  for (let i = 0; i < stripeCount; i++) {
    const t = i / stripeCount;
    const stripeY = (t - 0.5) * 2 * radius;
    const stripeHeight = radius * 2 / stripeCount * 1.1;
    const stripeColor = p.stripeColors[i % p.stripeColors.length];
    const alpha = p.maxAlpha * (0.7 + 0.3 * Math.cos(t * TAU * 2 + time * 0.0001));

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.clip();
    ctx.fillStyle = colorWithAlpha(stripeColor, alpha);
    ctx.fillRect(-radius, stripeY - stripeHeight * 0.5, radius * 2, stripeHeight);
    ctx.restore();
  }

  // Terminator (dark side)
  const termAngle = p.terminator + time * p.terminatorSpeed;
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.clip();
  const termGrad = ctx.createLinearGradient(-radius, 0, radius, 0);
  termGrad.addColorStop(0, 'rgba(0,0,0,0)');
  termGrad.addColorStop(0.5 - Math.cos(termAngle) * 0.4, 'rgba(0,0,0,0.15)');
  termGrad.addColorStop(0.5 + Math.cos(termAngle) * 0.4, 'rgba(0,0,0,0.45)');
  termGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = termGrad;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();

  // Ring (drawn in two passes: back, then front)
  const ringInner = p.ring.innerRadius * Math.min(width, height);
  const ringOuter = p.ring.outerRadius * Math.min(width, height);
  const ringTilt = p.ring.tilt;
  const ringRot = p.ring.rotation + time * p.ring.rotationSpeed;

  // Back part of ring (behind planet)
  ctx.save();
  ctx.rotate(ringRot);
  ctx.scale(1, Math.sin(ringTilt));
  const ringGradBack = ctx.createRadialGradient(0, 0, ringInner, 0, 0, ringOuter);
  ringGradBack.addColorStop(0, colorWithAlpha(p.ring.color, p.ring.alpha * 0.6));
  ringGradBack.addColorStop(0.5, colorWithAlpha(p.ring.color, p.ring.alpha));
  ringGradBack.addColorStop(1, colorWithAlpha(p.ring.color, 0));
  ctx.fillStyle = ringGradBack;
  ctx.beginPath();
  ctx.arc(0, 0, ringOuter, Math.PI, 0, true);
  ctx.arc(0, 0, ringInner, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Atmosphere rim
  const atmoRadius = radius + p.atmosphere.thickness * Math.min(width, height);
  const atmoGrad = ctx.createRadialGradient(0, 0, radius, 0, 0, atmoRadius);
  atmoGrad.addColorStop(0, colorWithAlpha(p.atmosphere.color, p.atmosphere.alpha));
  atmoGrad.addColorStop(1, colorWithAlpha(p.atmosphere.color, 0));
  ctx.fillStyle = atmoGrad;
  ctx.beginPath();
  ctx.arc(0, 0, atmoRadius, 0, TAU);
  ctx.fill();

  // Front part of ring (in front of planet)
  ctx.save();
  ctx.rotate(ringRot);
  ctx.scale(1, Math.sin(ringTilt));
  const ringGradFront = ctx.createRadialGradient(0, 0, ringInner, 0, 0, ringOuter);
  ringGradFront.addColorStop(0, colorWithAlpha(p.ring.color, p.ring.alpha * 0.6));
  ringGradFront.addColorStop(0.5, colorWithAlpha(p.ring.color, p.ring.alpha));
  ringGradFront.addColorStop(1, colorWithAlpha(p.ring.color, 0));
  ctx.fillStyle = ringGradFront;
  ctx.beginPath();
  ctx.arc(0, 0, ringOuter, 0, Math.PI);
  ctx.arc(0, 0, ringInner, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // Moons (skip for low quality)
  if (quality === 'high') {
    const maxMoonCraters = 5;
    for (const m of backdrop.moons) {
      const moonRadius = m.radiusFraction * Math.min(width, height);
      const orbitR = m.orbitRadius * Math.min(width, height);
      const angle = m.orbitAngle + time * m.orbitSpeed;
      const mx = px + Math.cos(angle) * orbitR;
      const my = py + Math.sin(angle) * orbitR * Math.sin(m.tilt);

      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(m.tilt);

      // Moon disc
      ctx.fillStyle = colorWithAlpha('#6a6a7a', 0.7);
      ctx.beginPath();
      ctx.arc(0, 0, moonRadius, 0, TAU);
      ctx.fill();

      // Craters (limited by quality)
      const cratersToDraw = m.craters.slice(0, maxMoonCraters);
    for (const c of cratersToDraw) {
      const cx = c.x * moonRadius;
      const cy = c.y * moonRadius;
      const cr = c.r * moonRadius;
      ctx.fillStyle = 'rgba(40,40,50,0.4)';
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, TAU);
      ctx.fill();
    }

    // Crescent lighting
    const litAngle = m.litAngle + time * 0.00001;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, moonRadius, 0, TAU);
    ctx.clip();
    const crescentGrad = ctx.createLinearGradient(-moonRadius, 0, moonRadius, 0);
    crescentGrad.addColorStop(0, 'rgba(0,0,0,0.6)');
    crescentGrad.addColorStop(0.5 + Math.cos(litAngle) * 0.4, 'rgba(0,0,0,0)');
    crescentGrad.addColorStop(1, 'rgba(255,255,255,0.3)');
    ctx.fillStyle = crescentGrad;
    ctx.fillRect(-moonRadius, -moonRadius, moonRadius * 2, moonRadius * 2);
    ctx.restore();

    ctx.restore();
  }
}
}

// ---- City skyline drawing (task 7a2) ----
function cityHash(a, b, c, d) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483629) + Math.imul(d | 0, 40503)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Solid wall rectangles of one tower in local px: x from the piece's left edge, y0..y1 measured UP from the ground.
// Non-rectangular decorations (needle taper, domes, caps, discs) are drawn directly into `ctx` in the body colour.
function drawCityShape(ctx, piece, bw, ph, s, groundY, beacons) {
  const rects = [];
  const R = (x, w, y0, y1, win = true) => rects.push({ x, w, y0, y1, win });
  const Y = (y) => groundY - y; // local up-px -> canvas y
  switch (piece.type) {
    case 0: { // needle spire: slim tower + tapering needle + beacon
      R(bw * 0.22, bw * 0.56, 0, ph * 0.7);
      ctx.beginPath(), ctx.moveTo(bw * 0.3, Y(ph * 0.7)), ctx.lineTo(bw * 0.5, Y(ph)), ctx.lineTo(bw * 0.7, Y(ph * 0.7)), ctx.closePath(), ctx.fill();
      beacons.push({ x: bw * 0.5, y: ph + 2 * s });
      break;
    }
    case 1: { // stepped ziggurat, four tiers
      R(0, bw, 0, ph * 0.3);
      R(bw * 0.1, bw * 0.8, ph * 0.3, ph * 0.55);
      R(bw * 0.2, bw * 0.6, ph * 0.55, ph * 0.78);
      R(bw * 0.3, bw * 0.4, ph * 0.78, ph);
      beacons.push({ x: bw * 0.5, y: ph + 2 * s });
      break;
    }
    case 2: { // mushroom tower: stalk + wide cap
      R(bw * 0.38, bw * 0.24, 0, ph * 0.72);
      ctx.beginPath(), ctx.ellipse(bw * 0.5, Y(ph * 0.76), bw * 0.5, Math.max(4 * s, ph * 0.1), 0, Math.PI, TAU), ctx.lineTo(bw, Y(ph * 0.72)), ctx.lineTo(0, Y(ph * 0.72)), ctx.closePath(), ctx.fill();
      R(bw * 0.12, bw * 0.76, ph * 0.66, ph * 0.74);
      break;
    }
    case 3: { // dome complex: wide base + big dome + two small domes + antenna
      R(0, bw, 0, ph * 0.38);
      ctx.beginPath(), ctx.ellipse(bw * 0.5, Y(ph * 0.38), bw * 0.32, ph * 0.4, 0, Math.PI, TAU), ctx.closePath(), ctx.fill();
      ctx.beginPath(), ctx.ellipse(bw * 0.13, Y(ph * 0.38), bw * 0.11, ph * 0.16, 0, Math.PI, TAU), ctx.closePath(), ctx.fill();
      ctx.beginPath(), ctx.ellipse(bw * 0.87, Y(ph * 0.38), bw * 0.11, ph * 0.16, 0, Math.PI, TAU), ctx.closePath(), ctx.fill();
      R(bw * 0.495, Math.max(1.5, 1.5 * s), ph * 0.78, ph, false);
      beacons.push({ x: bw * 0.5, y: ph + 1 * s });
      break;
    }
    case 4: { // saucer on a stalk
      R(bw * 0.46, bw * 0.08, 0, ph * 0.72, false);
      ctx.beginPath(), ctx.ellipse(bw * 0.5, Y(ph * 0.74), bw * 0.5, Math.max(3 * s, ph * 0.06), 0, 0, TAU), ctx.fill();
      ctx.beginPath(), ctx.ellipse(bw * 0.5, Y(ph * 0.78), bw * 0.2, Math.max(3 * s, ph * 0.05), 0, Math.PI, TAU), ctx.closePath(), ctx.fill();
      beacons.push({ x: bw * 0.12, y: ph * 0.74 }, { x: bw * 0.5, y: ph * 0.7 }, { x: bw * 0.88, y: ph * 0.74 });
      break;
    }
    case 5: { // corkscrew tower: slices shifted alternately left/right
      const n = 6;
      for (let j = 0; j < n; j++) {
        const dx = (j % 2 === 0 ? -0.1 : 0.1) * bw;
        R(bw * 0.225 + dx, bw * 0.55, (ph * j) / n, (ph * (j + 1)) / n + 1);
      }
      beacons.push({ x: bw * 0.5 + (n % 2 === 0 ? 0.1 : -0.1) * bw, y: ph + 2 * s });
      break;
    }
    case 6: { // arch gate: two pillars + lintel, glowing gap
      R(0, bw * 0.22, 0, ph * 0.8);
      R(bw * 0.78, bw * 0.22, 0, ph * 0.8);
      R(0, bw, ph * 0.72, ph * 0.82, false);
      beacons.push({ x: bw * 0.5, y: ph * 0.82 + 2 * s });
      break;
    }
    default: { // twin towers + skybridge
      R(0, bw * 0.3, 0, ph * 0.9);
      R(bw * 0.7, bw * 0.3, 0, ph);
      R(bw * 0.3, bw * 0.4, ph * 0.45, ph * 0.52);
      beacons.push({ x: bw * 0.15, y: ph * 0.9 + 2 * s }, { x: bw * 0.85, y: ph + 2 * s });
    }
  }
  return rects;
}

function drawCityBand(ctx, view, time, city, parallax, isFar, opts, colors) {
  const { width, height, camX, horizonY } = view;
  const ppm = opts.pxPerMetre ?? 40;
  const s = height / 540;
  const low = opts.quality === 'low';
  const cx = width * 0.5 - camX * parallax * ppm;
  const wrapPx = city.wrapWidth * ppm;
  const baseX = ((cx % wrapPx) + wrapPx) % wrapPx;
  const cell = isFar ? { w: 3 * s, h: 4 * s, px: 6 * s, py: 8 * s, m: 2 * s, lit: low ? 0.25 : 0.4, a: 0.6 } : { w: 4 * s, h: 6 * s, px: 8 * s, py: 11 * s, m: 3 * s, lit: low ? 0.35 : 0.5, a: 0.9 };
  const winColors = [colors.windowWarm, colors.windowTeal, colors.windowPink];
  const groups = new Map();
  const solids = [];
  const beaconList = [];
  let maxTop = 0;

  for (let rep = -1; rep <= 1; rep++) {
    for (let i = 0; i < city.pieces.length; i++) {
      const piece = city.pieces[i];
      const bw = piece.width * ppm;
      const x0 = baseX + rep * wrapPx + piece.x * ppm;
      if (x0 + bw < -10 || x0 > width + 10) continue;
      const ph = piece.height * height;
      ctx.save();
      ctx.translate(x0, 0);
      ctx.fillStyle = city.color;
      const beacons = [];
      const rects = drawCityShape(ctx, piece, bw, ph, s, horizonY, beacons);
      for (let r = 0; r < rects.length; r++) {
        const q = rects[r];
        ctx.fillRect(q.x, horizonY - q.y1, q.w, q.y1 - q.y0);
        solids.push(x0 + q.x, horizonY - q.y1, q.w, q.y1 - q.y0);
        if (q.y1 > maxTop) maxTop = q.y1;
        // lit windows on a regular grid strictly inside the wall
        if (!q.win || (low && isFar)) continue;
        const cols = Math.floor((q.w - 2 * cell.m + (cell.px - cell.w)) / cell.px);
        const rows = Math.floor((q.y1 - q.y0 - 2 * cell.m + (cell.py - cell.h)) / cell.py);
        for (let rr = 0; rr < rows; rr++) {
          for (let c = 0; c < cols; c++) {
            const hv = cityHash(piece.seed, r, c, rr);
            if (hv > cell.lit) continue;
            const ci = hv < cell.lit * 0.7 ? 0 : (hv < cell.lit * 0.85 ? 1 : 2);
            const ai = Math.floor(cityHash(piece.seed, r + 7, c, rr) * 3);
            const key = ci * 3 + ai;
            let list = groups.get(key);
            if (!list) groups.set(key, list = []);
            list.push(x0 + q.x + cell.m + c * cell.px, horizonY - q.y1 + cell.m + rr * cell.py);
          }
        }
      }
      for (const b of beacons) beaconList.push(x0 + b.x, horizonY - b.y, cityHash(piece.seed, 99, 0, 0));
      ctx.restore();
    }
  }

  // rim light on the left edge and shade on the right edge of every wall (near band only: the far band stays a flat silhouette)
  if (!isFar && !low) {
    ctx.fillStyle = colorWithAlpha(city.rimColor, 0.5);
    ctx.beginPath();
    for (let k = 0; k < solids.length; k += 4) ctx.rect(solids[k], solids[k + 1], Math.max(1, s), solids[k + 3]);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    for (let k = 0; k < solids.length; k += 4) ctx.rect(solids[k] + solids[k + 2] - Math.max(1, s), solids[k + 1], Math.max(1, s), solids[k + 3]);
    ctx.fill();
  }

  // windows: batched by colour x flicker group (one path and one fill per group)
  for (const [key, list] of groups) {
    const ci = Math.floor(key / 3), ai = key % 3;
    const flick = 0.78 + 0.22 * Math.sin(time * 0.6 + ai * 2.1 + (isFar ? 1.3 : 0));
    ctx.fillStyle = colorWithAlpha(winColors[ci], Math.min(1, cell.a * flick));
    ctx.beginPath();
    for (let k = 0; k < list.length; k += 2) ctx.rect(list[k], list[k + 1], cell.w, cell.h);
    ctx.fill();
  }

  // blinking beacons on tips / antennas / saucer rims
  for (let k = 0; k < beaconList.length; k += 3) {
    const on = Math.sin(time * 2.1 + beaconList[k + 2] * TAU) > -0.2;
    ctx.fillStyle = colorWithAlpha(beaconList[k + 2] < 0.5 ? colors.windowPink : colors.windowTeal, on ? (isFar ? 0.7 : 0.95) : 0.25);
    ctx.beginPath();
    ctx.arc(beaconList[k], beaconList[k + 1], (isFar ? 1.4 : 1.9) * s, 0, TAU);
    ctx.fill();
  }

  // fog melting the towers into the horizon
  const fogH = Math.max(20 * s, maxTop * 0.45);
  const fog = ctx.createLinearGradient(0, horizonY - fogH, 0, horizonY);
  fog.addColorStop(0, 'rgba(20,50,93,0)');
  fog.addColorStop(1, `rgba(20,50,93,${isFar ? 0.6 : 0.4})`);
  ctx.fillStyle = fog;
  ctx.fillRect(0, horizonY - fogH, width, fogH);
}

function drawSkylineBand(ctx, view, time, skyline, parallax, isFar, opts, colors) {
  drawCityBand(ctx, view, time, skyline, parallax, isFar, opts, colors);
}

function drawSkyline(ctx, view, time, backdrop, opts) {
  drawSkylineBand(ctx, view, time, backdrop.skylineFar, backdrop.cfg.parallax.skylineFar, true, opts, backdrop.cfg.colors);
  drawSkylineBand(ctx, view, time, backdrop.skylineNear, backdrop.cfg.parallax.skylineNear, false, opts, backdrop.cfg.colors);
}

function drawShips(ctx, view, time, backdrop, opts) {
  const { width, height, camX } = view;
  const ppm = opts.pxPerMetre ?? 40;
  const s = height / 540;
  const colors = backdrop.cfg.colors;
  const low = (opts.quality ?? 'high') === 'low';
  const period = width * 1.5;
  const list = backdrop.ships;
  const maxShips = low ? 3 : list.length;
  const hullTop = '#8b80c2', hullBottom = '#3a3268';

  ctx.save();
  for (let i = 0; i < Math.min(list.length, maxShips); i++) {
    const ship = list[i];
    const parallax = ship.type === 'mothership' ? backdrop.cfg.parallax.mothership : ship.depthBand === 0 ? backdrop.cfg.parallax.shipsFar : ship.depthBand === 1 ? backdrop.cfg.parallax.shipsMid : backdrop.cfg.parallax.shipsNear;
    const shift = -camX * parallax * ppm;
    const S = (ship.sizePx ?? ship.size * 540) * s;
    const x = ((((ship.x * period + ship.speed * s * time + shift) % period) + period) % period) - period * 0.2;
    const y = ship.y * height;
    if (x < -S * 1.2 || x > width + S * 1.2) continue;
    const a = ship.alpha ?? 0.9;
    const dir = ship.speed >= 0 ? 1 : -1;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ship.angle);
    ctx.scale(dir, 1); // face the direction of travel

    if (ship.type === 'saucer') {
      const hull = ctx.createLinearGradient(0, -S * 0.12, 0, S * 0.14);
      hull.addColorStop(0, colorWithAlpha(hullTop, a));
      hull.addColorStop(1, colorWithAlpha(hullBottom, a));
      ctx.fillStyle = hull;
      ctx.beginPath(), ctx.ellipse(0, 0, S * 0.5, S * 0.13, 0, 0, TAU), ctx.fill();
      ctx.fillStyle = colorWithAlpha('#a8f0ff', a * 0.7); // glass dome
      ctx.beginPath(), ctx.ellipse(0, -S * 0.07, S * 0.2, S * 0.16, 0, Math.PI, TAU), ctx.closePath(), ctx.fill();
      ctx.fillStyle = colorWithAlpha('#ffffff', a * 0.35);
      ctx.beginPath(), ctx.ellipse(-S * 0.07, -S * 0.14, S * 0.06, S * 0.03, -0.4, 0, TAU), ctx.fill();
      ctx.fillStyle = colorWithAlpha(colors.windowWarm, a); // rim lights
      ctx.beginPath();
      for (let k = -2; k <= 2; k++) ctx.rect(k * S * 0.18 - Math.max(1, S * 0.015), S * 0.02, Math.max(2, S * 0.03), Math.max(1.5, S * 0.025));
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(0, S * 0.14, 0, 0, S * 0.14, S * 0.55);
      glow.addColorStop(0, colorWithAlpha(colors.shipEngine, a * 0.55));
      glow.addColorStop(1, colorWithAlpha(colors.shipEngine, 0));
      ctx.fillStyle = glow;
      ctx.beginPath(), ctx.arc(0, S * 0.14, S * 0.55, 0, TAU), ctx.fill();
      ctx.restore();
    } else if (ship.type === 'cruiser') {
      const hull = ctx.createLinearGradient(0, -S * 0.1, 0, S * 0.1);
      hull.addColorStop(0, colorWithAlpha(hullTop, a));
      hull.addColorStop(1, colorWithAlpha(hullBottom, a));
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.moveTo(-S * 0.5, -S * 0.06);
      ctx.lineTo(S * 0.38, -S * 0.1);
      ctx.quadraticCurveTo(S * 0.58, 0, S * 0.38, S * 0.1);
      ctx.lineTo(-S * 0.5, S * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = colorWithAlpha(hullTop, a); // bridge tower
      ctx.fillRect(-S * 0.05, -S * 0.19, S * 0.18, S * 0.1);
      ctx.fillStyle = colorWithAlpha(colors.windowTeal, a * 0.9);
      ctx.fillRect(S * 0.0, -S * 0.16, S * 0.1, Math.max(1.5, S * 0.025));
      ctx.fillStyle = colorWithAlpha(colors.windowWarm, a * 0.95); // portholes
      ctx.beginPath();
      for (let k = 0; k < ship.windowCount; k++) ctx.rect(-S * 0.42 + k * (S * 0.78 / ship.windowCount), -S * 0.015, Math.max(1.5, S * 0.03), Math.max(1.5, S * 0.03));
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const eng = ctx.createRadialGradient(-S * 0.52, 0, 0, -S * 0.52, 0, S * 0.28);
      eng.addColorStop(0, colorWithAlpha(colors.shipEngine, a * 0.9));
      eng.addColorStop(1, colorWithAlpha(colors.shipEngine, 0));
      ctx.fillStyle = eng;
      ctx.beginPath(), ctx.arc(-S * 0.52, 0, S * 0.28, 0, TAU), ctx.fill();
      const trail = ctx.createLinearGradient(-S * 0.5, 0, -S * 1.1, 0);
      trail.addColorStop(0, colorWithAlpha(colors.shipEngine, a * 0.5));
      trail.addColorStop(1, colorWithAlpha(colors.shipEngine, 0));
      ctx.fillStyle = trail;
      ctx.fillRect(-S * 1.1, -S * 0.02, S * 0.6, S * 0.04);
      ctx.restore();
    } else if (ship.type === 'fighters') {
      for (let f = -1; f <= 1; f++) {
        const fx = f * S * 0.7, fy = Math.abs(f) * S * 0.25;
        ctx.fillStyle = colorWithAlpha(hullTop, a);
        ctx.beginPath(), ctx.moveTo(fx + S * 0.28, fy), ctx.lineTo(fx - S * 0.12, fy - S * 0.12), ctx.lineTo(fx - S * 0.04, fy), ctx.lineTo(fx - S * 0.12, fy + S * 0.12), ctx.closePath(), ctx.fill();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const eng = ctx.createRadialGradient(fx - S * 0.1, fy, 0, fx - S * 0.1, fy, S * 0.2);
        eng.addColorStop(0, colorWithAlpha(colors.shipEngine, a * 0.9));
        eng.addColorStop(1, colorWithAlpha(colors.shipEngine, 0));
        ctx.fillStyle = eng;
        ctx.beginPath(), ctx.arc(fx - S * 0.1, fy, S * 0.2, 0, TAU), ctx.fill();
        ctx.restore();
      }
    } else { // mothership: huge dark silhouette with lit rows and big engines
      ctx.fillStyle = colorWithAlpha('#2d2552', a);
      ctx.beginPath();
      ctx.moveTo(-S * 0.5, -S * 0.07);
      ctx.lineTo(S * 0.4, -S * 0.09);
      ctx.quadraticCurveTo(S * 0.52, 0, S * 0.4, S * 0.09);
      ctx.lineTo(-S * 0.5, S * 0.07);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-S * 0.1, -S * 0.15, S * 0.28, S * 0.07);
      for (let k = 0; k < ship.lights.length; k++) {
        const l = ship.lights[k];
        ctx.fillStyle = colorWithAlpha(l.color, a * (0.7 + 0.3 * Math.sin(time * 1.5 + k)));
        ctx.fillRect(l.relX * S, l.relY * S, Math.max(1.5, S * 0.012), Math.max(1.5, S * 0.012));
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = -1; k <= 1; k++) {
        const eng = ctx.createRadialGradient(-S * 0.52, k * S * 0.045, 0, -S * 0.52, k * S * 0.045, S * 0.09);
        eng.addColorStop(0, colorWithAlpha(colors.shipEngine, a * 1.6));
        eng.addColorStop(1, colorWithAlpha(colors.shipEngine, 0));
        ctx.fillStyle = eng;
        ctx.beginPath(), ctx.arc(-S * 0.52, k * S * 0.045, S * 0.09, 0, TAU), ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawHaze(ctx, view, time, backdrop, opts) {
  const { width, height, horizonY } = view;
  const haze = backdrop.haze;
  const hazeHeight = haze.heightFraction * height;
  const quality = opts.quality ?? 'high';

  // Horizon haze gradient
  const grad = ctx.createLinearGradient(0, horizonY - hazeHeight, 0, horizonY + hazeHeight * 0.3);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, colorWithAlpha(haze.color1, haze.maxAlpha * 0.6));
  grad.addColorStop(1, colorWithAlpha(haze.color2, haze.maxAlpha * 0.2));
  ctx.fillStyle = grad;
  ctx.fillRect(0, horizonY - hazeHeight, width, hazeHeight * 1.3);

  // Aurora ribbons (quality-dependent)
  if (quality === 'high') {
    for (const a of backdrop.auroras) {
      const yCenter = a.yCenter * height;
      const amplitude = a.amplitude * height;
      const thickness = a.thickness * height;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      const grad2 = ctx.createLinearGradient(0, yCenter - thickness, 0, yCenter + thickness);
      grad2.addColorStop(0, colorWithAlpha(a.color, 0));
      grad2.addColorStop(0.5, colorWithAlpha(a.color, a.alpha));
      grad2.addColorStop(1, colorWithAlpha(a.color, 0));
      ctx.fillStyle = grad2;

      ctx.beginPath();
      const freq = a.frequency;
      const speed = a.speed;
      ctx.moveTo(0, yCenter);
      for (let x = 0; x <= width; x += 20) {
        const y = yCenter + Math.sin(x * freq + time * speed + a.phase) * amplitude;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, yCenter + thickness);
      ctx.lineTo(0, yCenter + thickness);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }
}

export function drawBackdrop(ctx, view, time, backdrop, opts = {}) {
  if (!ctx || typeof ctx !== 'object' || !view || !backdrop) return;

  const W = fin(view.width, 800);
  const H = fin(view.height, 600);
  const camX = fin(view.camX, 0);
  const horizonY = fin(view.horizonY, H * 0.85);
  const t = fin(time, 0);
  const quality = opts.quality ?? 'high';
  const pxPerMetre = fin(opts.pxPerMetre, 40);
  const layers = opts.layers ?? ['galaxies', 'stars', 'planet', 'skylineFar', 'skylineNear', 'ships', 'haze'];

  const viewNorm = { width: W, height: H, camX, horizonY };

  ctx.save();

  if (layers.includes('galaxies')) {
    drawGalaxies(ctx, viewNorm, t, backdrop, { quality, pxPerMetre });
    drawNebulae(ctx, viewNorm, t, backdrop, { quality, pxPerMetre });
  }
  if (layers.includes('stars')) {
    drawStars(ctx, viewNorm, t, backdrop, { quality, pxPerMetre });
  }
  if (layers.includes('planet')) {
    drawPlanet(ctx, viewNorm, t, backdrop, { quality, pxPerMetre });
  }
  if (layers.includes('skylineFar')) {
    drawSkylineBand(ctx, viewNorm, t, backdrop.skylineFar, backdrop.cfg.parallax.skylineFar, true, { quality, pxPerMetre }, backdrop.cfg.colors);
  }
  if (layers.includes('skylineNear')) {
    drawSkylineBand(ctx, viewNorm, t, backdrop.skylineNear, backdrop.cfg.parallax.skylineNear, false, { quality, pxPerMetre }, backdrop.cfg.colors);
  }
  if (layers.includes('ships')) {
    drawShips(ctx, viewNorm, t, backdrop, { quality, pxPerMetre });
  }
  if (layers.includes('haze')) {
    drawHaze(ctx, viewNorm, t, backdrop, { quality, pxPerMetre });
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}