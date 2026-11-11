#!/usr/bin/env node
/* Reduces the validator's jitter-only output to the small file Quick Five relies on.

     node tools/free-kicks/validate.js --jitter-only --out tools/free-kicks/cards.v1.jitter.raw.json
     node tools/free-kicks/jitter-corners.js

   Reads cards.v1.jitter.raw.json and writes cards.v1.jitter.json: for every card Quick Five can
   draw (everything except Expert cards) the touch/mouse make rate with the ball moved to each of
   its four jitter corners. check-quick.js compares the worst corner with the touch floors and
   refuses the file when the physics or the cards changed since it was made. */
"use strict";
const fs = require("fs");
const path = require("path");

const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, "cards.v1.jitter.raw.json"), "utf8"));
const lib = JSON.parse(fs.readFileSync(path.resolve(__dirname, "cards.v1.json"), "utf8"));
const pool = new Set(lib.cards.filter((c) => c.tier !== "Expert").map((c) => c.id));
const corners = {};
for (const r of raw.results) {
  if (!pool.has(r.id) || !/^jitter\(/.test(r.variant)) continue;
  (corners[r.id] = corners[r.id] || []).push({ corner: r.variant, touch: r.touch, mouse: r.mouse, tier: r.tierMeasured });
}
const out = {
  tool: "fk-validate --jitter-only",
  generated: raw.generated,
  grid: raw.model && raw.model.grid ? raw.model.grid : "normal",
  physicsFingerprint: raw.physics.fingerprint,
  cardsFingerprint: raw.cards.fingerprint,
  jitterPx: Math.max(...lib.cards.map((c) => c.jitter || 0)),
  note: "Touch/mouse make rates of each pool card with the ball moved to its four jitter corners (+-jitter px). Quick Five relies on these.",
  corners,
};
fs.writeFileSync(path.resolve(__dirname, "cards.v1.jitter.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`wrote cards.v1.jitter.json: ${Object.keys(corners).length} cards, ${Object.values(corners).reduce((n, a) => n + a.length, 0)} corners`);
