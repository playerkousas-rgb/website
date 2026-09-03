// 離線單測 api/favicon.js 嘅核心流程（mock global fetch，唔使真網絡）
// 運行：node test/favicon.test.js
const assert = require("node:assert");

// ── mock 網站世界 ─────────────────────────────────────────────
const SITES = {
  // 正常站：有多個 icon link，應該揀 32x32 PNG（分數最高）
  "multi.test": {
    paths: {
      "/": {
        status: 200,
        html: `<!doctype html><html><head>
          <link rel="icon" sizes="16x16" href="/fav-16.ico" type="image/x-icon">
          <link rel="icon" sizes="32x32" href="/fav-32.png" type="image/png">
          <link rel="apple-touch-icon" sizes="180x180" href="/apple.png">
          <link rel="manifest" href="/manifest.webmanifest">
        </head><body>hi</body></html>`
      },
      "/fav-16.ico": { status: 200, body: Buffer.from("ICO16"), type: "image/x-icon" },
      "/fav-32.png": { status: 200, body: Buffer.from("PNG32DATA"), type: "image/png" },
      "/apple.png": { status: 200, body: Buffer.from("APPLEPNG"), type: "image/png" },
      "/favicon.ico": { status: 200, body: Buffer.from("ICO"), type: "image/x-icon" }
    }
  },
  // 冇 link，只有 /favicon.ico
  "icoonly.test": {
    paths: {
      "/": { status: 200, html: "<html><head><title>t</title></head></html>" },
      "/favicon.ico": { status: 200, body: Buffer.from("ONLYICO"), type: "image/x-icon" }
    }
  },
  // 完全冇 favicon
  "none.test": {
    paths: { "/": { status: 200, html: "<html></html>" }, "/favicon.ico": { status: 404 } }
  },
  // https 死咗、http 得；link href 係相對路徑 + 有重定向
  "redir.test": {
    httpsDown: true,
    paths: {
      "/": { status: 301, location: "http://redir.test/site/" },
      "/site/": { status: 200, html: '<html><head><link rel="shortcut icon" href="img/site.ico"></head></html>' },
      "/site/img/site.ico": { status: 200, body: Buffer.from("REDIRICO"), type: "image/x-icon" }
    }
  },
  // link 指住嘅圖 404 → 應該 fallback 返去 /favicon.ico
  "brokenlink.test": {
    paths: {
      "/": { status: 200, html: '<html><head><link rel="icon" href="/missing.png"></head></html>' },
      "/missing.png": { status: 404 },
      "/favicon.ico": { status: 200, body: Buffer.from("FALLBACKICO"), type: "image/x-icon" }
    }
  },
  // 只有 SVG icon（唔寫 type 都應該識）
  "svg.test": {
    paths: {
      "/": { status: 200, html: '<html><head><link rel="icon" href="/i.svg"></head></html>' },
      "/i.svg": { status: 200, body: Buffer.from("<svg/>"), type: "image/svg+xml" }
    }
  },
  // MINI GAME（出門玩）嗰種：冇 <link rel=icon>、冇 /favicon.ico，icon 只喺 manifest
  "manifest.test": {
    paths: {
      "/": { status: 200, html: '<html><head><link rel="manifest" href="/manifest.webmanifest"></head></html>' },
      "/manifest.webmanifest": {
        status: 200,
        body: '{"name":"出門玩","icons":[{"src":"./icon.svg","sizes":"any","type":"image/svg+xml","purpose":"any maskable"}]}',
        type: "application/manifest+json"
      },
      "/icon.svg": { status: 200, body: Buffer.from("<svg>diece</svg>"), type: "image/svg+xml" }
    }
  },
  // 連 <link rel=manifest> 都冇、但預設位置 /manifest.webmanifest 有
  "manifest2.test": {
    paths: {
      "/": { status: 200, html: "<html><head></head></html>" },
      "/manifest.webmanifest": {
        status: 200,
        body: '{"icons":[{"src":"/m.png","sizes":"192x192","type":"image/png"},{"src":"/m.svg","sizes":"any","type":"image/svg+xml"}]}',
        type: "application/manifest+json"
      },
      "/m.png": { status: 200, body: Buffer.from("MANIFESTPNG"), type: "image/png" },
      "/m.svg": { status: 200, body: Buffer.from("<svg/>"), type: "image/svg+xml" }
    }
  }
};

function mockFetch() {
  return async (url) => {
    const u = new URL(url);
    const site = SITES[u.hostname];
    // 跟 30x
    let cur = u, hops = 0, p = null;
    if (site) {
      if (u.protocol === "https:" && site.httpsDown) throw new Error("ECONNRESET");
      for (;;) {
        p = site.paths[cur.pathname + cur.search];
        if (!p) break;
        if (p.status >= 300 && p.status < 400) {
          cur = new URL(p.location, cur); hops++;
          if (hops > 5 || cur.hostname !== u.hostname) { p = null; break; }
          continue;
        }
        break;
      }
    }
    const body = p ? (p.body !== undefined ? p.body : (p.html || "")) : "";
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
    const status = p ? p.status : 404;
    const type = p ? (p.type || (status === 404 ? undefined : "text/html")) : undefined;
    return {
      ok: status >= 200 && status < 300,
      status,
      url: cur.href, // 最終 URL（跟晒重定向）
      headers: { get: (k) => (k.toLowerCase() === "content-type" ? type || null : null) },
      text: async () => buf.toString(),
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    };
  };
}

const realFetch = globalThis.fetch;
globalThis.fetch = mockFetch();
const { resolveFavicon, safeHost, iconCandidates } = require("../api/favicon.js");

(async () => {
  // 1) 多 icon → 揀 32x32 PNG
  let r = await resolveFavicon("multi.test");
  assert.equal(r.via, "link"); assert.equal(r.type, "image/png");
  assert.equal(r.buf.toString(), "PNG32DATA");
  console.log("✓ 多個 <link rel=icon> → 揀分數最高嘅 32x32 PNG");

  // 2) 冇 link → /favicon.ico
  r = await resolveFavicon("icoonly.test");
  assert.equal(r.via, "favicon.ico"); assert.equal(r.buf.toString(), "ONLYICO");
  console.log("✓ 冇 link tag → 回退 /favicon.ico");

  // 3) 完全冇 → 拋錯（前端 chain 會行 Google s2）
  await assert.rejects(() => resolveFavicon("none.test"), /no favicon/);
  console.log("✓ 完全冇 favicon → 明確失敗（前端行備援 chain）");

  // 4) https 死 → http；301 重定向；相對 href
  r = await resolveFavicon("redir.test");
  assert.equal(r.via, "link"); assert.equal(r.buf.toString(), "REDIRICO");
  assert.equal(r.type, "image/x-icon");
  console.log("✓ https 不通轉 http + 跟重定向 + 解析相對路徑");

  // 5) link 嘅圖 404 → fallback /favicon.ico
  r = await resolveFavicon("brokenlink.test");
  assert.equal(r.via, "favicon.ico"); assert.equal(r.buf.toString(), "FALLBACKICO");
  console.log("✓ icon link 404 → 再回退 /favicon.ico");

  // 6) SVG（唔寫 type）
  r = await resolveFavicon("svg.test");
  assert.equal(r.via, "link"); assert.equal(r.type, "image/svg+xml");
  console.log("✓ SVG icon（無 type 屬性）");

  // 6a) MINI GAME 嗰種：冇 link、冇 favicon.ico，icon 只喺 manifest
  r = await resolveFavicon("manifest.test");
  assert.equal(r.via, "manifest"); assert.equal(r.type, "image/svg+xml");
  assert.equal(r.buf.toString(), "<svg>diece</svg>");
  console.log("✓ PWA manifest icon（無 <link rel=icon>／無 favicon.ico → 讀 manifest 嘅 icon.svg）");

  // 6b) 連 <link rel=manifest> 都冇、但預設位置有 manifest；多個 icon 應揀 PNG(192)
  r = await resolveFavicon("manifest2.test");
  assert.equal(r.via, "manifest"); assert.equal(r.type, "image/png");
  assert.equal(r.buf.toString(), "MANIFESTPNG");
  console.log("✓ 預設位置 manifest + 多 icon 揀 PNG(192)");

  // 7) safeHost 防 SSRF
  assert.equal(safeHost("127.0.0.1"), null);
  assert.equal(safeHost("169.254.169.254"), null);
  assert.equal(safeHost("localhost"), null);
  assert.equal(safeHost("evil.local"), null);
  assert.equal(safeHost("sub.example.com"), "sub.example.com");
  assert.equal(safeHost("EXAMPLE.com"), "example.com");
  assert.equal(safeHost("http://x.com/"), null); // 有 path 唔俾
  assert.equal(safeHost("example.com:8080"), null); // 有 port 唔俾
  console.log("✓ safeHost 攔截 IP / localhost / 內網 / 帶 port");

  // 8) iconCandidates 分數排序
  const cands = iconCandidates(
    '<link rel="icon" sizes="16x16" href="/a.ico" type="image/x-icon">' +
    '<link rel="icon" sizes="32x32" href="/b.png" type="image/png">' +
    '<link rel="apple-touch-icon" sizes="180x180" href="/c.png">',
    "https://x.test/");
  assert.equal(cands[0].url, "https://x.test/b.png");
  console.log("✓ 候選按「PNG + 32–128px」分數排序");

  // 9) Vercel handler（mock req/res）
  const mod = require("../api/favicon.js");
  const mkRes = () => ({
    code: 200, headers: {}, body: null,
    status(c) { this.code = c; return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
    send(b) { this.body = b; }
  });
  let res = mkRes();
  await mod({ url: "/api/favicon?host=multi.test" }, res);
  assert.equal(res.code, 200);
  assert.equal(res.headers["Content-Type"], "image/png");
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
  assert.match(res.headers["Cache-Control"], /s-maxage=604800/);
  res = mkRes();
  await mod({ url: "/api/favicon?host=127.0.0.1" }, res);
  assert.equal(res.code, 400);
  res = mkRes();
  await mod({ url: "/api/favicon?host=none.test" }, res);
  assert.equal(res.code, 404);
  console.log("✓ handler：200 + CORS + 長 cache / 400 bad host / 404 冇 favicon");

  globalThis.fetch = realFetch;
  console.log("\n全部通過 ✅");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
