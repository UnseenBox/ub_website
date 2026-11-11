#!/usr/bin/env node
/* Copy checker for Free Kicks. Reads the game's own text, never changes it.
     node tools/free-kicks/check-strings.js              check, exit 1 on a problem
     node tools/free-kicks/check-strings.js --sheet      also (re)write arabic-review.md
   Checks: EN and AR have the same keys and the same {placeholders} in both
   string tables (free-kicks.js RUN_STRINGS, game-modes.js COPY) and in the
   card/stage names; every key the game asks for exists in both languages (so
   no raw key ever shows on screen); every Arabic string contains Arabic
   letters (catches an untranslated line). Warns about keys nothing uses. */
"use strict";
const fs = require("fs");
const path = require("path");

const PATHS = require("./paths");
const FK = fs.readFileSync(PATHS.gameFile, "utf8");
const GM = fs.readFileSync(PATHS.modesFile, "utf8");
const LIB = JSON.parse(fs.readFileSync(path.join(__dirname, "cards.v1.json"), "utf8"));
const wantSheet = process.argv.includes("--sheet");

const literal = (src, name) => {
  const m = src.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n  \\});`));
  if (!m) throw new Error(`could not find ${name}`);
  return new Function(`return ${m[1]}`)();
};
const RUN = literal(FK, "RUN_STRINGS");
const COPY = literal(GM, "COPY");

const problems = [];
const warnings = [];
const bad = (m) => problems.push(m);
const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(" ");
const hasArabic = (s) => /[؀-ۿ]/.test(s);

function parity(label, tables) {
  const en = Object.keys(tables.en);
  const ar = Object.keys(tables.ar);
  for (const k of en) if (!ar.includes(k)) bad(`${label}: "${k}" has no Arabic`);
  for (const k of ar) if (!en.includes(k)) bad(`${label}: "${k}" has no English`);
  for (const k of en) {
    if (!(k in tables.ar)) continue;
    if (!String(tables.en[k]).trim()) bad(`${label}: "${k}" is empty in English`);
    if (!String(tables.ar[k]).trim()) bad(`${label}: "${k}" is empty in Arabic`);
    if (ph(tables.en[k]) !== ph(tables.ar[k])) bad(`${label}: "${k}" placeholders differ ("${ph(tables.en[k])}" vs "${ph(tables.ar[k])}")`);
    if (!hasArabic(tables.ar[k])) bad(`${label}: "${k}" has no Arabic letters: ${tables.ar[k]}`);
  }
}
parity("RUN_STRINGS", RUN);
parity("COPY", COPY);

/* every key the game asks for */
const merged = { en: Object.assign({}, COPY.en, RUN.en), ar: Object.assign({}, COPY.ar, RUN.ar) };
const used = new Set();
/* every quoted word inside a this.s(...) call (balanced parentheses, so nested ternaries count) */
for (const m of FK.matchAll(/\bs\(/g)) {
  let depth = 1;
  let i = m.index + m[0].length;
  const from = i;
  for (; i < FK.length && depth; i++) {
    if (FK[i] === "(") depth++;
    else if (FK[i] === ")") depth--;
  }
  for (const q of FK.slice(from, i - 1).matchAll(/"(\w+)"/g)) used.add(q[1]);
}
for (const m of FK.matchAll(/\b(?:title|note|text): "(\w+)"/g)) used.add(m[1]);
/* the keys built from a number (runNoteStars0..3, runQuickNote0..1) */
for (let n = 0; n <= 3; n++) used.add("runNoteStars" + n);
for (let n = 0; n <= 1; n++) used.add("runQuickNote" + n);
used.delete("runNoteStars");
used.delete("runQuickNote");
for (const k of [...used]) {
  if (k === "resultSavedAirNote") continue;   // optional: the game falls back to resultSavedNote
  for (const lang of ["en", "ar"]) if (!(k in merged[lang])) bad(`the game asks for "${k}" but ${lang.toUpperCase()} has no such string`);
}
used.add("resultSavedAirNote");
for (const k of Object.keys(RUN.en)) if (!used.has(k)) warnings.push(`RUN_STRINGS "${k}" is never used`);

/* names of cards and stages */
const names = [];
for (const c of LIB.cards) names.push({ key: `card ${c.id}`, ...c.name });
for (const s of LIB.sets) names.push({ key: `stage ${s.id}`, ...s.name });
for (const n of names) {
  if (!n.en || !n.ar) bad(`${n.key}: missing a name (${JSON.stringify({ en: n.en, ar: n.ar })})`);
  else if (!hasArabic(n.ar)) bad(`${n.key}: Arabic name has no Arabic letters`);
}
const seen = new Map();
for (const n of names) {
  if (seen.has(n.ar)) bad(`Arabic name "${n.ar}" is used twice (${seen.get(n.ar)} and ${n.key})`);
  seen.set(n.ar, n.key);
}

if (wantSheet) {
  /* notes for the native reviewer: things I could not settle myself */
  const NOTES = {
    resultSaved: "Neutral wording chosen on purpose: Mimi is female in Classic's Arabic (ميمي تقول لا), so a masculine verb was wrong.",
    resultSavedNote: "Feminine verb for Mimi. The button name must match the game's AIR button (هوائية).",
    resultSavedAirNote: "Lob saved: data shows these are almost always too soft, so the advice is more power.",
    "card 5.2": "The Squeeze: الضغط also means pressure, and stage 5 is تحت الضغط. Is there a clearer word (الممر الضيق?)",
    "card 3.4": "Four men in the wall: is \"أربعة\" enough, or \"أربعة لاعبين\"?",
    runGoals: "Digits are kept (Western numerals), as in the rest of the game.",
    cupRules: "Numbers with plurals: 3-10 take the plural form, 11+ the singular. Check each.",
  };
  const rows = [];
  const add = (section, entries) => {
    rows.push(`\n## ${section}\n`, "| Key | English | Arabic | Note |", "|---|---|---|---|");
    for (const [k, en, ar] of entries) rows.push(`| \`${k}\` | ${String(en).replace(/\|/g, "\\|")} | ${String(ar).replace(/\|/g, "\\|")} | ${NOTES[k] || ""} |`);
  };
  const entries = (t) => Object.keys(t.en).map((k) => [k, t.en[k], t.ar[k]]);
  rows.push("# Free Kicks: Arabic copy for native review", "", "Generated by `node tools/free-kicks/check-strings.js --sheet` from the game's own text. Do not edit by hand: send corrections back and they are applied in `game-modes.js`, `free-kicks.js` (both in `crazy-goal/free-kicks/`) or `cards.v1.json` (in its `tools/` folder).", "", "Placeholders such as `{n}` are filled in by the game. Mimi, the goalkeeper cat, is female in Classic's Arabic.");
  add("Menus, hub and shot results (game-modes.js)", entries(COPY));
  add("Stage runner and practice (free-kicks.js)", entries(RUN));
  add("Kick names (card library)", LIB.cards.map((c) => [`card ${c.id}`, c.name.en, c.name.ar]));
  add("Stage names", LIB.sets.map((s) => [`stage ${s.id}`, s.name.en, s.name.ar]));
  fs.writeFileSync(path.join(__dirname, "arabic-review.md"), rows.join("\n") + "\n", "utf8");
  console.log("wrote tools/free-kicks/arabic-review.md");
}

console.log(`strings: ${Object.keys(RUN.en).length} runner + ${Object.keys(COPY.en).length} menu strings, ${names.length} names; ${used.size} keys used by the game`);
for (const w of warnings) console.log("  warn: " + w);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log("OK: English and Arabic match, every key the game asks for exists.");
