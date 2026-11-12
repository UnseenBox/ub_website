/* The Daily Kick's seed: same for everyone on a date, valid for the Quick Five draw.  node tools/tests/daily.test.js */
"use strict";
const fs = require("fs");
const src = fs.readFileSync(require("../paths").gameFile, "utf8");
const win = {};
new Function("window", src)(win);
const Q = win.CrazyKoraFreeKicks.quick;
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";   // SEED_CHARS: no 0/O/1/I
let fails = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fails++; console.log("FAIL:", msg); } };

ok(typeof Q.seedForDate === "function", "quick.seedForDate is published");
ok(Q.seedForDate("2026-11-12") === Q.seedForDate("2026-11-12"), "the same date always gives the same seed");
ok(Q.seedForDate("2026-11-12") !== Q.seedForDate("2026-11-13"), "neighbouring dates differ");
ok(Q.seedForDate("2026-11-12") === "YJ4K96", "pinned value: every device must agree (changing the draw changes everyone's Daily Kick)");

// every date of a leap year and the next year: six characters from the alphabet, and a valid five-kick draw
const dates = [];
for (const year of [2026, 2028]) {
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= new Date(year, m, 0).getDate(); d++) dates.push(`${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
}
const seeds = new Set();
for (const date of dates) {
  const seed = Q.seedForDate(date);
  ok(typeof seed === "string" && seed.length === 6 && [...seed].every((c) => ALPHABET.includes(c)), `${date}: six characters from the seed alphabet (got ${seed})`);
  const draw = Q.draw(seed);
  ok(draw && draw.seed === seed && draw.kicks.length === 5, `${date}: the seed draws five kicks`);
  seeds.add(seed);
}
ok(seeds.size > dates.length * 0.99, `seeds are spread out (${seeds.size} distinct of ${dates.length})`);

// the same seed always draws the same five
const a = JSON.stringify(Q.draw(Q.seedForDate("2026-11-12")).kicks.map((k) => [k.card, k.mirror, k.dx, k.dy]));
const b = JSON.stringify(Q.draw(Q.seedForDate("2026-11-12")).kicks.map((k) => [k.card, k.mirror, k.dx, k.dy]));
ok(a === b, "a seed replays the same five kicks");

// anything that is not a date gives null, never a random seed
for (const bad of [undefined, null, "", "today", "2026-1-2", "2026-11-12T00:00", 20261112]) ok(Q.seedForDate(bad) === null, `not a date: ${JSON.stringify(bad)}`);

if (fails) { console.log(`${fails} of ${n} daily checks failed`); process.exit(1); }
console.log(`all ${n} daily checks passed`);
