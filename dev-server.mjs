// 本地 dev server：靜態檔案 + /api/favicon（同 Vercel 部署行為一致）
// 用法：node dev-server.mjs [port]   （預設 8080）
// 部署去 Vercel 後唔使運行呢個檔案（Vercel 會自動將 api/ 內嘅 function 挂去 /api/*）。
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import faviconHandler from "./api/favicon.js";

import loginHandler from "./api/admin-login.js";
import notifyHandler from "./api/notify-admin.js";

const PORT = Number(process.argv[2] || 8080);
const ROOT = process.cwd();
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer(async (req, res) => {
  const isApiPost = u0 => u0.startsWith("/api/admin-login") || u0.startsWith("/api/notify-admin");
  if (!isApiPost(req.url) && req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }
  const u = new URL(req.url, "http://localhost");

  // /api/* → 行 Vercel serverless function
  if (u.pathname.startsWith("/api/")) {
    const mock = {
      code: 200,
      headers: {},
      status(c) { this.code = c; return this; },
      setHeader(k, v) { this.headers[k] = v; return this; },
      send(b) { res.writeHead(this.code, this.headers); res.end(req.method === "HEAD" ? undefined : b); }
    };
    try {
      if (u.pathname === '/api/admin-login' || u.pathname === '/api/notify-admin') {
        const limit = u.pathname === '/api/notify-admin' ? 20480 : 4096;
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > limit) { res.writeHead(413).end(); return; } }
        const reqObj = { method: req.method, headers: req.headers, socket: req.socket, body };
        await (u.pathname === '/api/admin-login' ? loginHandler : notifyHandler)(reqObj, mock);
      } else await faviconHandler({ url: req.url }, mock);
    } catch (e) {
      console.error("api error:", e);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end("api error");
    }
    return;
  }

  // 靜態檔案
  let p = normalize(join(ROOT, u.pathname === "/" ? "/index.html" : u.pathname));
  if (u.pathname.split("/").some(x => x.startsWith(".")) || u.pathname.startsWith("/migrations/")) { res.writeHead(403).end(); return; }
  if (!p.startsWith(ROOT + "/")) { res.writeHead(403).end(); return; }
  if (!existsSync(p) || !extname(p)) { res.writeHead(404, { "content-type": "text/plain" }).end("not found"); return; }
  try {
    const b = await readFile(p);
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }).end(req.method === "HEAD" ? undefined : b);
  } catch {
    res.writeHead(500).end();
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`showcase dev server → http://localhost:${PORT}（靜態 + /api/favicon）`));
