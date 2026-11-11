/* Where the shipped Free Kicks files are, for every tool in this folder.
   Repository layout:  crazy-goal/free-kicks/{free-kicks.js, game-modes.js, ...} with these tools in crazy-goal/free-kicks/tools/
   Older local layout: Main/assets/{free-kicks.js, ...} with the tools in <project>/tools/free-kicks/
   FK_GAME_DIR overrides both. */
"use strict";
const fs = require("fs");
const path = require("path");

const candidates = [
  process.env.FK_GAME_DIR && path.resolve(process.env.FK_GAME_DIR),
  path.resolve(__dirname, ".."),
  path.resolve(__dirname, "../../Main/assets"),
].filter(Boolean);
const gameDir = candidates.find((d) => fs.existsSync(path.join(d, "free-kicks.js")));
if (!gameDir) throw new Error("Free Kicks files not found; looked in:\n  " + candidates.join("\n  "));

module.exports = {
  gameDir,
  gameFile: path.join(gameDir, "free-kicks.js"),
  modesFile: path.join(gameDir, "game-modes.js"),
  /* a path for messages, relative to where the tools were started */
  show: (p) => path.relative(process.cwd(), p).split(path.sep).join("/") || p,
};
