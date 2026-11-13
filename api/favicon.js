/* ─────────────────────────────────────────────────────────────
   api/favicon.js — 伺服器端「自己讀 favicon」（Vercel serverless）

   原理同 Chrome 分頁標籤讀 ICON 一樣，順序：
     1. 攞該網站嘅 HTML
     2. 搵 <link rel="icon" ...>（包括 shortcut icon / apple-touch-icon）
     3. 冇 link（或 link 失敗）→ 讀該站 PWA manifest 入面嘅 icon
        （好多 Vercel 站真 logo 只放 manifest，例如「出門玩」MINI GAME）
     4. 仲冇 → 試該站根目錄 /favicon.ico

   點解要放伺服器：瀏覽器受 CORS 限制讀唔到「另一個網站」嘅 HTML
   （Chrome 讀到係因為個頁係佢自己開嘅）。伺服器攞完加返 CORS
   header 回傳圖片 bytes，前端 <img> 直接用。

   本地測試：node dev-server.mjs ，或者
     node -e "require('./api/favicon').resolveFavicon('google.com').then(r=>console.log(r.via,r.type,r.buf.length)).catch(e=>console.log('ERR',e.message))"
   ───────────────────────────────────────────────────────────── */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HTML_BYTES = 256 * 1024; // icon link 基本上喺 <head>，唔使撳齊成頁
const IMG_BYTES = 1024 * 1024; // 單個 icon 上限
const TOTAL_BUDGET = 9000; // 總時間預算（Vercel free tier 非流式 function 預設 10s 超時）

// 只接受「域名」：唔俾 IP / localhost / 內網位址（防 SSRF）
const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
function safeHost(h) {
  h = String(h || "").toLowerCase();
  if (!HOST_RE.test(h)) return null;
  if (h.split(".").every((l) => /^\d+$/.test(l))) return null; // 純 IPv4
  if (h.endsWith(".local") || h.endsWith(".internal")) return null;
  return h;
}

function fetchWithTimeout(url, ms, extraHeaders) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, {
    redirect: "follow",
    signal: ctrl.signal,
    headers: Object.assign(
      { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      extraHeaders || {}
    )
  }).finally(() => clearTimeout(t));
}

function attr(tag, name) {
  const m = tag.match(new RegExp(name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', "i"));
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? null;
}

// 由 HTML 抽出所有 icon 候選（按分數排序，高分優先）
function iconCandidates(html, baseUrl) {
  const out = [];
  const re = /<link\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const rel = (attr(tag, "rel") || "").toLowerCase().split(/\s+/);
    // rel 要有 icon 類嘅 token：icon / shortcut icon / apple-touch-icon…
    if (!rel.some((t) => t === "icon" || t.endsWith(" icon") || t.startsWith("apple-touch-icon"))) continue;
    const href = attr(tag, "href");
    if (!href) continue;
    let u;
    try { u = new URL(href, baseUrl); } catch { continue; }
    if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    /* type 可能冇寫（例：<link rel="apple-touch-icon" href="/touch.png">），
       由副檔名補返 —— 否則明明係 180px PNG 都會被當成「未知格式」。 */
    let type = (attr(tag, "type") || "").toLowerCase();
    if (!type) {
      const path = u.pathname.toLowerCase();
      if (path.endsWith(".png")) type = "image/png";
      else if (path.endsWith(".svg")) type = "image/svg+xml";
      else if (path.endsWith(".ico")) type = "image/x-icon";
      else if (path.endsWith(".webp")) type = "image/webp";
    }
    const sizesAttr = attr(tag, "sizes") || "";
    const sizes = sizesAttr.match(/(\d{1,4})\s*x\s*(\d{1,4})/);
    let px = sizes ? Math.max(+sizes[1], +sizes[2]) : null;
    /* <link rel="apple-touch-icon" href="..."> 唔寫 sizes 係極常見寫法，
       Apple 官方規格就係 180×180 —— 唔當佢做「未知尺寸」而排到最後，
       否則明明有 180px 大圖都會輸畀 32px 小圖。 */
    if (px == null && rel.some((t) => t.startsWith("apple-touch-icon"))) px = 180;
    // 格式分：PNG 最穩陣（<img> 永遠啱），SVG 次之，ICO／未知最後
    let score = 3;
    if (type.includes("png")) score = 10;
    else if (type.includes("svg")) score = 5;
    /* 尺寸分（2026-11 改）：**越大越好**。
       舊版 32–128px 得 +6、≥256px 只得 +3，結果 app 明明有 512 大圖，
       我哋偏偏攞個 48px 小圖返嚟，再放大到 68px 顯示 → 一定蒙。
       （用戶實測：同一批 app，用 favicon-48 嗰個特別化開）
       而家按「至少夠 2× tile（>136px）」畀最高分，細圖仍然可用但排後面。 */
    if (px == null) score += 1;                 // sizes 冇寫 → 靠後
    else if (px >= 256) score += 12;            // 512 / 1024：縮細最清
    else if (px >= 136) score += 10;            // 180 / 192：2× tile 夠用
    else if (px >= 96) score += 7;
    else if (px >= 32) score += 4;              // 32–95：只夠 1× tile
    else if (px >= 16) score += 2;
    else score += 1;
    out.push({ url: u.href, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 4);
}

function guessType(u, upstreamType) {
  const head = (upstreamType || "").split(";")[0].trim().toLowerCase();
  if (head && head.startsWith("image/")) return head;
  const path = new URL(u).pathname.toLowerCase();
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".ico")) return "image/x-icon";
  if (path.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

// 下載一個 icon 候選，成功回傳 {buf, type}，失敗回傳 null
const NO_CACHE = { "cache-control": "no-cache", pragma: "no-cache" };

async function fetchIconBuf(url, ms, force) {
  try {
    const res = await fetchWithTimeout(
      url, ms,
      Object.assign({ accept: "image/*,*/*;q=0.8" }, force ? NO_CACHE : {})
    );
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > IMG_BYTES) return null;
    return { buf, type: guessType(url, res.headers.get("content-type")) };
  } catch { return null; }
}

// 由 PWA manifest 抽出 icon 候選。
// 好多 Vercel 站（例如「出門玩」MINI GAME）唔寫 <link rel="icon">、亦冇 /favicon.ico，
// 真 logo 只放喺 manifest 嘅 icons 入面 —— 呢個就係為咗讀佢而設。
async function manifestIconCandidates(html, baseUrl, left, force) {
  // 先搵 <link rel="manifest" href="...">（最準），冇就用常見預設位置
  let manifestUrl = null;
  const re = /<link\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const rel = (attr(tag, "rel") || "").toLowerCase();
    if (rel.split(/\s+/).includes("manifest")) {
      const href = attr(tag, "href");
      if (href) { try { manifestUrl = new URL(href, baseUrl).href; } catch { /* ignore */ } }
      break;
    }
  }
  const tries = [];
  if (manifestUrl) tries.push(manifestUrl);
  tries.push(new URL("manifest.webmanifest", baseUrl).href);
  tries.push(new URL("manifest.json", baseUrl).href);

  for (const url of tries) {
    const ms = left(2500);
    if (ms < 500) break;
    let text = null;
    try {
      const res = await fetchWithTimeout(url, ms, Object.assign({ accept: "application/manifest+json,application/json" }, force ? NO_CACHE : {}));
      if (!res.ok) continue;
      text = (await res.text()).slice(0, 256 * 1024);
    } catch { continue; }
    let data = null;
    try { data = JSON.parse(text); }
    catch {
      // 整段 JSON 解析唔到就試硬抽 "icons":[...]
      const mm = text.match(/"icons"\s*:\s*(\[[\s\S]*?\])\s*[,}\]]/);
      if (mm) { try { data = { icons: JSON.parse(mm[1]) }; } catch { data = null; } }
    }
    const icons = data && Array.isArray(data.icons) ? data.icons : [];
    const out = [];
    for (const ic of icons) {
      const src = ic && ic.src;
      if (!src) continue;
      let u; try { u = new URL(src, url); } catch { continue; }
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      const type = String(ic.type || "").toLowerCase();
      let score = 3; // ico / 未知
      if (type.includes("png")) score = 11;
      else if (type.includes("svg")) score = 8;
      // PWA icon 通常 192/512；尺寸夠大縮去 64px 先至清晰
      /* 尺寸分（2026-11 改）：manifest 嘅 192／512 係最靚嘅來源，
         之前只 +3，輸畀 link 入面嘅 32px 小圖。而家 512 → +12。 */
      const px = (String(ic.sizes || "").match(/(\d{1,4})\s*x\s*(\d{1,4})/) || [])[1];
      if (px && +px >= 256) score += 12;
      else if (px && +px >= 136) score += 10;
      else if (px && +px >= 48) score += 4;
      else if (ic.sizes === "any") score += 6;
      out.push({ url: u.href, score, via: "manifest" });
    }
    if (out.length) return out.sort((a, b) => b.score - a.score).slice(0, 4);
    // 搵到 manifest 但唔含 icon → 唔使再試其他位置
    if (manifestUrl && url === manifestUrl) break;
  }
  return [];
}

/* ── 核心：畀個域名，回傳最啱嘅 icon ─────────────────────── */
/* opts.force = true（?refresh=1 或 ?v=時間戳）：連上游都要 no-cache，
   唔好被對方 CDN／中間 proxy 嘅舊 HTML／舊圖陰到。 */
async function resolveFavicon(host, opts) {
  host = safeHost(host);
  if (!host) throw new Error("bad host");
  const force = !!(opts && opts.force);
  const noCache = force ? { "cache-control": "no-cache", pragma: "no-cache" } : undefined;
  const start = Date.now();
  const left = (cap) => Math.min(cap, TOTAL_BUDGET - (Date.now() - start));

  // 1) 攞 HTML（https 唔通試 http）
  let html = null;
  let htmlUrl = null;
  for (const base of ["https://" + host + "/", "http://" + host + "/"]) {
    const ms = left(4000);
    if (ms < 700) break;
    try {
      const res = await fetchWithTimeout(base, ms, noCache);
      if (!res.ok) continue;
      html = (await res.text()).slice(0, HTML_BYTES);
      htmlUrl = res.url || base;
      break;
    } catch { /* 試下一個 protocol */ }
  }
  if (!htmlUrl) throw new Error("site unreachable");

  const seen = new Set();

  /* 2) 合併「link」同「manifest」兩組候選，按分數統一排序再逐個試。
     ⚠️ 舊版係「link 行完就 return」，所以永遠唔會試 manifest 嘅 512 大圖，
        最後攞個 48px 小圖放大到 68px 顯示 → 一定蒙。
        而家兩邊一齊排，512／192 大圖自然排最前。 */
  const linkCands = iconCandidates(html, htmlUrl).map((c) => ({ ...c, via: "link" }));
  let manifestCands = [];
  if (left(1000) >= 600) {
    try {
      manifestCands = (await manifestIconCandidates(html, htmlUrl, left, force)).map((c) => ({ ...c, via: "manifest" }));
    } catch { manifestCands = []; }
  }
  const merged = [...linkCands, ...manifestCands]
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  for (const cand of merged) {
    if (seen.has(cand.url)) continue;
    seen.add(cand.url);
    const ms = left(2500);
    if (ms < 500) break;
    const got = await fetchIconBuf(cand.url, ms, force);
    if (got) return { buf: got.buf, type: got.type, via: cand.via, url: cand.url };
  }

  // 4) 最後回退該站根目錄 /favicon.ico
  {
    const ms = left(2500);
    if (ms >= 500) {
      const u = new URL("favicon.ico", htmlUrl).href;
      if (!seen.has(u)) {
        const got = await fetchIconBuf(u, ms, force);
        if (got) return { buf: got.buf, type: got.type, via: "favicon.ico" };
      }
    }
  }
  throw new Error("no favicon");
}

/* ── 由 PNG 標頭讀尺寸（唔使解碼整張圖） ───────────────────── */
function pngSize(buf) {
  if (!buf || buf.length < 24) return null;
  // PNG signature 之後第一個 chunk 一定係 IHDR
  if (buf[0] !== 0x89 || buf.toString("ascii", 1, 4) !== "PNG") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/* ── Vercel handler ──────────────────────────────────────── */
module.exports = async function faviconHandler(req, res) {
  const u = new URL(req.url || "/", "http://localhost");
  // Vercel 傳入完整路徑 /api/favicon；dev-server / 測試亦用同一 format
  if (u.pathname !== "/api/favicon" || u.searchParams.get("host") === null) {
    return res.status(404).send("nope");
  }
  const host = safeHost(u.searchParams.get("host"));
  if (!host) return res.status(400).send("bad host");

  /* 快取策略（2026-11-06 改）：
     · ?v=<任何值> 或 ?refresh=1 —— 前端「換咗 logo 但仲見舊圖」時用：
       連上游一齊 no-cache，回應亦 no-store，即刻見新圖。
     · 平時：瀏覽器 1 日、Vercel edge 1 日（舊版 7 日，一個換 icon 要等
       成個星期先反映，就係「圖標冇換」嘅其中一個原因）。 */
  const force = u.searchParams.has("v") || u.searchParams.get("refresh") === "1";

  // ?debug=1：唔回圖，回 JSON（邊個 URL 揀咗、經由邊條路徑攞到）方便查「點解係舊圖」
  if (u.searchParams.get("debug") === "1") {
    try {
      const { type, via } = await resolveFavicon(host, { force: true });
      return res
        .status(200)
        .setHeader("Content-Type", "application/json; charset=utf-8")
        .setHeader("Cache-Control", "no-store")
        .send(JSON.stringify({ host, ok: true, via, type, checkedAt: new Date().toISOString() }));
    } catch (e) {
      return res
        .status(404)
        .setHeader("Content-Type", "application/json; charset=utf-8")
        .setHeader("Cache-Control", "no-store")
        .send(JSON.stringify({ host, ok: false, error: String(e && e.message || e) }));
    }
  }

  try {
    const { buf, type, via } = await resolveFavicon(host, { force });
    /* 診斷用：回傳圖嘅真實尺寸。前端見到 X-Favicon-Small=1
       就知呢個 app 只提供細圖（<64px），放大顯示一定蒙，
       可以引導站主補一張 192／512。 */
    const dim = type === "image/png" ? pngSize(buf) : null;
    const small = !!(dim && Math.max(dim.w, dim.h) < 64);
    res
      .status(200)
      .setHeader("Content-Type", type)
      .setHeader("X-Favicon-Size", dim ? `${dim.w}x${dim.h}` : "unknown")
      .setHeader("X-Favicon-Small", small ? "1" : "0")
      .setHeader("Access-Control-Allow-Origin", "*")
      .setHeader(
        "Cache-Control",
        force
          ? "no-store, max-age=0"
          : "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
      )
      .setHeader("X-Favicon-Via", via)
      .send(buf);
  } catch {
    res.status(404)
      .setHeader("Access-Control-Allow-Origin", "*")
      .setHeader("Cache-Control", "no-store") // 失敗唔好快取，下次再試
      .send("no favicon"); // 前端 <img> onerror 會行落后备 chain
  }
};
module.exports.resolveFavicon = resolveFavicon;
module.exports.iconCandidates = iconCandidates;
module.exports.safeHost = safeHost;
