#!/usr/bin/env node
/* Copies tools/free-kicks/cards.v1.json into free-kicks.js (the
   shipped game cannot read tools/). Only the block between the fk-cards markers
   is touched, and it follows the file's own line endings.
     node tools/free-kicks/sync-cards.js           write
     node tools/free-kicks/sync-cards.js --check   exit 1 if the game is out of date */
"use strict";
const fs = require("fs");
const path = require("path");
const CARDS = path.resolve(__dirname, "cards.v1.json");
const GAME = require("./paths").gameFile;
const BEGIN = "/* fk-cards:begin";
const END = "/* fk-cards:end */";
const CRLF = String.fromCharCode(13, 10);
const LF = String.fromCharCode(10);

const lib = JSON.parse(fs.readFileSync(CARDS, "utf8"));
delete lib._note;
const json = JSON.stringify(lib, null, 2).split(LF).map((l, i) => (i ? "  " + l : l)).join(LF);
const block = `${BEGIN} (generated from tools/free-kicks/cards.v1.json by sync-cards.js - do not edit by hand) */${LF}  const CARD_LIBRARY = ${json};${LF}  ${END}`;

const src = fs.readFileSync(GAME, "utf8");
const eol = src.includes(CRLF) ? CRLF : LF;
const a = src.indexOf(BEGIN), b = src.indexOf(END);
if (a < 0 || b < 0) { console.error("fk-cards markers not found in free-kicks.js"); process.exit(2); }
const next = src.slice(0, a) + block.split(LF).join(eol) + src.slice(b + END.length);

if (process.argv.includes("--check")) {
  if (next !== src) { console.error("free-kicks.js card library is OUT OF DATE - run sync-cards.js"); process.exit(1); }
  console.log("OK: embedded card library matches cards.v1.json");
} else if (next === src) console.log("Already up to date.");
else { fs.writeFileSync(GAME, next); console.log("Embedded card library updated."); }
