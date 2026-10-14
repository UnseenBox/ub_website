// Camera: world<->screen transform, smooth cursor-anchored zoom, soft follow.
//
// The physics simulation never sees this file. World coordinates are the single
// source of truth; the camera only decides which slice of the world is on
// screen. Every zoom-dependent quantity is expressed as `relScale` so it
// behaves identically at any canvas size or device pixel ratio.
import { GROUND_Y } from './levels.js';

// viewW === BASE_VIEW_W means one world unit == one css px on a 1920-wide
// stage (relScale 1 — the game's original 1:1 framing).
export const BASE_VIEW_W = 1920;
export const MIN_VIEW_W = 520;   // deep inspection: read a single joint
export const MAX_VIEW_W = 7600;  // vast overview: the whole yard

// Floor on how few pixels a world unit may get in the DEFAULT framing.
// Composition is authored in world units, but legibility is measured in
// pixels: the same framing that reads as a vast yard on a wide display turns
// a 16-unit post into a 5px smudge in a small window. The default view is
// therefore tightened on small viewports, while a level that needs a wider
// shot to fit its structure at all still gets one. Manual zoom is unaffected.
const MIN_DEFAULT_SCALE = 0.40;

// Camera roam limits. The yard extends far past the play area so zooming out
// reveals world rather than hitting an invisible wall.
export const ROAM = { minX: -2800, maxX: 5400, minY: -3600, maxY: GROUND_Y + 460 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createCamera() {
  const cam = {
    cx: 900, cy: 430, viewW: 2600,
    tcx: 900, tcy: 430, tViewW: 2600,
    homeView: null,
    cssW: 1920, cssH: 1080, aspect: 9 / 16,
    anchor: null,   // {sx,sy,wx,wy}: hold this world point under the cursor
    followOn: true,
    home: { cx: 900, cy: 430, w: 2600 },
  };

  function clampTarget() {
    const vw = cam.tViewW, vh = vw * cam.aspect;
    const xlo = ROAM.minX + vw / 2, xhi = ROAM.maxX - vw / 2;
    const ylo = ROAM.minY + vh / 2, yhi = ROAM.maxY - vh / 2;
    cam.tcx = xlo > xhi ? (ROAM.minX + ROAM.maxX) / 2 : clamp(cam.tcx, xlo, xhi);
    cam.tcy = ylo > yhi ? (ROAM.minY + ROAM.maxY) / 2 : clamp(cam.tcy, ylo, yhi);
  }
  function clampLive() {
    const vw = cam.viewW, vh = vw * cam.aspect;
    const xlo = ROAM.minX + vw / 2, xhi = ROAM.maxX - vw / 2;
    const ylo = ROAM.minY + vh / 2, yhi = ROAM.maxY - vh / 2;
    cam.cx = xlo > xhi ? (ROAM.minX + ROAM.maxX) / 2 : clamp(cam.cx, xlo, xhi);
    cam.cy = ylo > yhi ? (ROAM.minY + ROAM.maxY) / 2 : clamp(cam.cy, ylo, yhi);
  }

  const api = {
    cam,
    setViewport(cssW, cssH) {
      const first = cam.cssW;
      cam.cssW = Math.max(2, cssW); cam.cssH = Math.max(2, cssH);
      cam.aspect = cam.cssH / cam.cssW;
      // the legibility floor depends on the viewport, so a resize has to
      // re-resolve the default framing — but only if the player is still on it
      if (cam.homeView && first !== cam.cssW && api.atHome()) api.setHome(cam.homeView, true);
      clampTarget(); clampLive();
    },
    // px per world unit (css px), and that scale relative to the 1:1 baseline
    scale() { return cam.cssW / cam.viewW; },
    relScale() { return BASE_VIEW_W / cam.viewW; },
    viewH() { return cam.viewW * cam.aspect; },

    toWorld(sx, sy) {
      const k = cam.viewW / cam.cssW;
      return { x: (sx - cam.cssW / 2) * k + cam.cx, y: (sy - cam.cssH / 2) * k + cam.cy };
    },
    toScreen(wx, wy) {
      const s = cam.cssW / cam.viewW;
      return { x: (wx - cam.cx) * s + cam.cssW / 2, y: (wy - cam.cy) * s + cam.cssH / 2 };
    },
    viewRect() {
      const vw = cam.viewW, vh = vw * cam.aspect;
      return { x0: cam.cx - vw / 2, y0: cam.cy - vh / 2, x1: cam.cx + vw / 2, y1: cam.cy + vh / 2 };
    },

    // Wheel zoom anchored on the cursor's world position. The anchor is
    // re-solved every frame while smoothing runs, so the point under the
    // cursor stays put for the whole transition instead of only at the end.
    zoomAt(sx, sy, rawDelta) {
      const d = clamp(rawDelta, -260, 260);
      const w = api.toWorld(sx, sy);
      cam.tViewW = clamp(cam.tViewW * Math.exp(d * 0.0013), MIN_VIEW_W, MAX_VIEW_W);
      cam.anchor = { sx, sy, wx: w.x, wy: w.y };
      clampTarget();
    },
    // Discrete zoom (keys / buttons) about the view centre.
    zoomBy(factor) {
      cam.anchor = null;
      cam.tViewW = clamp(cam.tViewW * factor, MIN_VIEW_W, MAX_VIEW_W);
      clampTarget();
    },
    panByScreen(dxPx, dyPx) {
      cam.anchor = null;
      const k = cam.viewW / cam.cssW;
      cam.tcx -= dxPx * k; cam.tcy -= dyPx * k;
      // a manual pan takes over: stop fighting the follow for this shot
      cam.followOn = false;
      clampTarget();
    },

    // Frame a world box with margin. `view` overrides from a level win.
    frame(box, instant = false) {
      const pad = 0.80; // fraction of the view the content may occupy
      let w = Math.max(box.w / pad, (box.h / pad) / cam.aspect);
      w = clamp(w, MIN_VIEW_W, MAX_VIEW_W);
      cam.tViewW = w;
      cam.tcx = box.cx; cam.tcy = box.cy;
      cam.home = { cx: box.cx, cy: box.cy, w };
      cam.anchor = null; cam.followOn = true;
      clampTarget();
      if (instant) { cam.cx = cam.tcx; cam.cy = cam.tcy; cam.viewW = cam.tViewW; clampLive(); }
    },
    // Resolve a level's requested framing against this viewport. `minW` is the
    // width below which the structure no longer fits and is always honoured;
    // above it the view is tightened toward the legibility floor. With
    // `anchorGround` the vertical centre is derived from the final width so
    // the horizon keeps its place in frame at any window size.
    setHome(view, instant = false) {
      cam.homeView = view;
      const minW = Math.max(MIN_VIEW_W, view.minW ?? MIN_VIEW_W);
      const legible = Math.max(minW, cam.cssW / MIN_DEFAULT_SCALE);
      const w = clamp(view.w, minW, Math.min(MAX_VIEW_W, legible));
      const cy = view.anchorGround ? GROUND_Y - 0.26 * (w * cam.aspect) : view.cy;
      cam.tViewW = w;
      cam.tcx = view.cx; cam.tcy = cy;
      cam.home = { cx: view.cx, cy, w };
      cam.anchor = null; cam.followOn = true;
      clampTarget();
      if (instant) { cam.cx = cam.tcx; cam.cy = cam.tcy; cam.viewW = cam.tViewW; clampLive(); }
    },
    resetView() {
      cam.tcx = cam.home.cx; cam.tcy = cam.home.cy; cam.tViewW = cam.home.w;
      cam.anchor = null; cam.followOn = true;
      clampTarget();
    },
    atHome() {
      return Math.abs(cam.tViewW - cam.home.w) < 1
        && Math.abs(cam.tcx - cam.home.cx) < 1 && Math.abs(cam.tcy - cam.home.cy) < 1;
    },

    // Keep a point inside the inner `box` fraction of the view by moving the
    // target centre only — never the zoom. Eases, so it never jerks.
    follow(x, y, box = 0.44) {
      if (!cam.followOn) return;
      const vw = cam.tViewW, vh = vw * cam.aspect;
      const mx = vw * 0.5 * box, my = vh * 0.5 * box;
      let dx = 0, dy = 0;
      if (x > cam.tcx + mx) dx = x - (cam.tcx + mx);
      else if (x < cam.tcx - mx) dx = x - (cam.tcx - mx);
      if (y > cam.tcy + my) dy = y - (cam.tcy + my);
      else if (y < cam.tcy - my) dy = y - (cam.tcy - my);
      if (dx === 0 && dy === 0) return;
      cam.anchor = null;
      cam.tcx += dx; cam.tcy += dy;
      clampTarget();
    },

    update(dt) {
      const k = 1 - Math.exp(-Math.min(0.1, dt) * 13);
      cam.viewW += (cam.tViewW - cam.viewW) * k;
      if (cam.anchor) {
        // re-solve the centre so the anchored world point stays under the cursor
        const a = cam.anchor, kk = cam.viewW / cam.cssW;
        cam.cx = a.wx - (a.sx - cam.cssW / 2) * kk;
        cam.cy = a.wy - (a.sy - cam.cssH / 2) * kk;
        clampLive();
        cam.tcx = cam.cx; cam.tcy = cam.cy;
        if (Math.abs(cam.tViewW - cam.viewW) < 0.4) cam.anchor = null;
      } else {
        cam.cx += (cam.tcx - cam.cx) * k;
        cam.cy += (cam.tcy - cam.cy) * k;
        clampLive();
      }
    },

    applyTransform(g, dpr) {
      const s = cam.cssW / cam.viewW;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.translate(cam.cssW / 2, cam.cssH / 2);
      g.scale(s, s);
      g.translate(-cam.cx, -cam.cy);
    },
  };
  return api;
}

// Bounding box of a level's physical content, used for auto-framing.
export function contentBox(def) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (l, t, r, b) => { if (l < x0) x0 = l; if (t < y0) y0 = t; if (r > x1) x1 = r; if (b > y1) y1 = b; };
  for (const b of def.blocks || []) add(b.x - b.w / 2, b.y - b.h / 2, b.x + b.w / 2, b.y + b.h / 2);
  for (const p of def.platforms || []) add(p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2);
  for (const t of def.targets || []) add(t.x - t.r, t.y - t.r, t.x + t.r, t.y + t.r);
  if (!isFinite(x0)) return { cx: 900, cy: 430, w: 2600, h: 1462 };
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}
