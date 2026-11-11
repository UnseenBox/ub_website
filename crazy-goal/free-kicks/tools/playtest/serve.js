#!/usr/bin/env node
/* Local server for the Free Kicks playtest page.
     node tools/free-kicks/playtest/serve.js          this computer only (127.0.0.1:8150)
     node tools/free-kicks/playtest/serve.js --lan    also reachable by phones on the same Wi-Fi
   It serves ONLY the playtest page and the few game files it needs, never the
   rest of the project. --lan opens the port to your local network (Windows may
   ask to allow it); stop the server (Ctrl+C) when the session is over. */
"use strict";
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ASSETS = require("../paths").gameDir;
const PAGE = path.join(__dirname, "playtest.html");
const PORT = 8150;
const LAN = process.argv.includes("--lan");
const ALLOW = /^(free-kicks\.(js|css)|game-modes\.js|unbounded-latin-wght-normal-[\w-]+\.woff2|arcade-star-[\w-]+\.png)$/;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".woff2": "font/woff2" };

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    let file = null;
    if (url === "/" || url === "/playtest.html") file = PAGE;
    else if (url.startsWith("/assets/") && ALLOW.test(url.slice(8))) file = path.join(ASSETS, url.slice(8));
    if (!file || !fs.existsSync(file)) {
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end("not found");
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, LAN ? "0.0.0.0" : "127.0.0.1", () => {
    console.log(`Free Kicks playtest page: http://127.0.0.1:${PORT}/`);
    if (LAN) {
      for (const list of Object.values(os.networkInterfaces()))
        for (const i of list || []) if (i.family === "IPv4" && !i.internal) console.log(`  on your Wi-Fi:         http://${i.address}:${PORT}/`);
      console.log("The port is open to your local network. Press Ctrl+C when the session is over.");
    }
  });
