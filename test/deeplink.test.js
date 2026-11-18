/* ════════════════════════════════════════════════════════════════
   test/deeplink.test.js
   守住「APP STORE 深層連結」契約（docs/50 SG9／SG9-a）：

   1) 分享／複製／QR／卡片 href 一定係 https://scoutappstore.vercel.app/?app=…
      —— 唔可以再派子站網址（子站一開白名單，收到直連嘅人就會撞卡）。
   2) ?app=<slug> 打開該 App 詳情 sheet；slug 未填 fallback 用 _id。
   3) ?app= 對唔到／visible=false／分頁關閉 → 静靜返首頁 + toast，唔白屏、唔開到。
   4) 真正「入子站」只有 openApp() 同 sheet「開啟」—— 仍然係 app.url，而且
      冇 noreferrer（子站靠真實 Referer 認入口）。
   5) manifest 嘅 start_url／scope 唔准改（已加入主畫面嘅用戶要照樣入首頁）。

   做法同 boot-order.test.js 一樣：用「HTML 有咩 ID 先有咩元素」嘅 fake DOM
   真係跑一次 index.html 嘅 script，然後驗結果（唔靠人手撳）。
   ════════════════════════════════════════════════════════════════ */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const html = read("index.html");
const lines = html.split("\n");

/* ── 靜態守衛（唔使跑都要成立）──────────────────────────────── */

// manifest：start_url 同 scope 一定要係 "/"（加入主畫面嘅人照樣入首頁）
const manifest = JSON.parse(read("manifest.webmanifest"));
assert.equal(manifest.start_url, "/", "manifest.start_url 唔可以改（PWA 已加入主畫面嘅用戶要照樣入首頁）");
assert.equal(manifest.scope, "/", "manifest.scope 唔可以改");

// 去掉註釋（只睇真正會執行嘅 code —— 註釋會提到 noreferrer，唔算違規）
function codeOnly(src) {
  let out = "", i = 0, q = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (q) {
      out += c;
      if (c === "\\") { out += n || ""; i += 2; continue; }
      if (c === q) q = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === "`") { q = c; out += c; i++; continue; }
    if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    out += c; i++;
  }
  return out;
}

// 子站網址唔可以再出現喺分享／卡片／QR／排行榜（只准喺 openApp 同 sheet「開啟」）
const appJs = read("app.js");
const appCode = codeOnly(appJs);
assert.equal((appCode.match(/href="\$\{esc\(app\.url\)\}"/g) || []).length, 0,
  "卡片／排行榜 href 唔可以再直接寫子站網址 —— 要用 appDeepLink(app)");
assert.ok(!/encodeURIComponent\(app\.url\)/.test(appCode), "QR code 唔可以再編碼子站網址");
assert.ok(!/writeText\(_currentShareApp\.url\)/.test(appCode), "複製分享連結唔可以再複製子站網址");
assert.equal((appCode.match(/encodeURIComponent\(_currentShareApp\.url\)/g) || []).length, 0,
  "五個平台分享唔可以再用子站網址");

// 真正「入子站」嘅兩個位：保留 app.url，而且唔准加 noreferrer
const openAppIdx = appCode.indexOf("function openApp(app)");
const openAppBody = appCode.slice(openAppIdx, appCode.indexOf("function appSlug", openAppIdx));
assert.ok(/window\.location\.href = app\.url;/.test(openAppBody), "openApp() 一定要仍然去 app.url");
assert.ok(!/noreferrer/.test(openAppBody), "openApp() 唔准加 noreferrer（子站靠 Referer 認入口）");
assert.ok(!/noreferrer/.test(appCode), "app.js 任何真正執行嘅位置都唔准加 noreferrer");

// 首頁「今期主打」唔可以再 window.open 子站
assert.ok(!/window\.open\(f\.app\.url/.test(read("index.html")), "今期主打唔可以再 window.open 子站網址");

// 資料層：slug 讀寫 + 備份還原保留 slug + 未跑 migration 都唔會炸（optional 欄位）
const storeJs = read("store.js");
assert.ok(/slug: r\.slug \|\| null/.test(storeJs), "rowsToApp 要將 slug 帶出嚟");
assert.ok(/slug: normalizeSlug\(a\.slug\)/.test(storeJs.slice(storeJs.indexOf("function restoreFromBackup"))),
  "restoreFromBackup 一定要保留 slug（否則後台備份還原會清走全部深層連結代號）");
assert.ok(/OPTIONAL_APP_COLS = \[[^\]]*"slug"/.test(storeJs), "slug 要加入 OPTIONAL_APP_COLS（未跑 migration 都儲存得到）");

// 後台自主管理：列表睇到 ?app= 代號、有一撳複製分享連結掣
const adminJs = read("admin.js");
assert.ok(/\?app=\$\{esc\(a\.slug\)\}/.test(adminJs), "後台列表要顯示 ?app=<slug>");
assert.ok(/data-act="item-copy"/.test(adminJs), "後台列表要有一撳複製深層連結掣");

// migration 一定要有：欄位 + 格式 CHECK + unique（Vercel 上傳會 .vercelignore 擋走 migrations/，同 market.test.js 做法）
const migPath = path.join(ROOT, "migrations/20261116-app-slug.sql");
if (fs.existsSync(migPath)) {
  const mig = fs.readFileSync(migPath, "utf8");
  assert.ok(/add column if not exists slug text/.test(mig), "migration 要加 slug 欄");
  assert.ok(/unique index if not exists apps_slug_key/.test(mig), "migration 要加 unique index");
  assert.ok(/apps_slug_fmt/.test(mig), "migration 要有格式 CHECK");
}

// 自動 slug trigger migration：INSERT 生效、security definer、只留 a-z0-9-、撞名加尾、唔覆寫人手 slug
const autoPath = path.join(ROOT, "migrations/20261118-app-slug-auto.sql");
if (fs.existsSync(autoPath)) {
  const auto = fs.readFileSync(autoPath, "utf8");
  assert.ok(/create or replace function public\.apps_auto_slug\(\)/.test(auto), "要有 apps_auto_slug() 函數");
  assert.ok(/before insert on public\.apps/.test(auto), "trigger 只掛 BEFORE INSERT（舊 row 唔會自己變）");
  assert.ok(/security definer/.test(auto), "uniqueness 查詢要 bypass RLS（數到隱藏 row）");
  assert.ok(/new\.slug is not null/.test(auto), "手填 slug 一律唔郁");
  assert.ok(/apps_auto_slug_trg/.test(auto), "要有 trigger 名（drop+create 重跑安全）");
  const noComments = auto.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.ok(!/update\s+public\.apps/i.test(noComments), "migration 唔准 update 現有 apps row");
}

/* ── 動態：真跑一次 boot，再用 ?app= 開機 ───────────────────── */
const scripts = [];
for (const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  const open = m[0].slice(0, m[0].indexOf(">"));
  const src = /src="([^"]+)"/.exec(open);
  if (src && !/^https?:/i.test(src[1])) scripts.push({ name: src[1], code: read(src[1]) });
  else if (!src) scripts.push({ name: "index.html#inline", code: m[1] });
}

const htmlIds = new Set();
lines.forEach((l) => { for (const m of l.matchAll(/id="([^"]+)"/g)) htmlIds.add(m[1]); });

function fakeEl(id) {
  const set = new Set();
  return {
    id, hidden: false, innerHTML: "", textContent: "", value: "", checked: false, disabled: false,
    dataset: {}, style: { setProperty() {} }, offsetHeight: 40, offsetTop: 0, offsetWidth: 300,
    isConnected: true, files: [], src: "", alt: "",
    classList: {
      toggle(c, f) { const v = f === undefined ? !set.has(c) : !!f; v ? set.add(c) : set.delete(c); return v; },
      add(c) { set.add(c); }, remove(c) { set.delete(c); }, contains(c) { return set.has(c); }
    },
    querySelector() { return fakeEl("q"); }, querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    removeAttribute() {}, appendChild() {}, remove() {}, focus() {}, blur() {}, scrollIntoView() {},
    closest() { return null; }, contains() { return false; }, showModal() {}, close() {}, reset() {},
    get elements() { return {}; }, getContext() { return { drawImage() {} }; },
    toDataURL() { return "data:image/png;base64,x"; }
  };
}

// 三個項目：有 slug 嘅（apps 頁）、冇 slug 要 fallback _id 嘅（apps 頁）、
// 另一個分頁（cards）嘅、同一個 visible=false 嘅（深層連結唔准開到）
const DB = {
  pages: [
    { id: "apps", label: "小工具 Apps", icon: "🧰", enabled: true, sort_order: 0 },
    { id: "cards", label: "學習圖卡", icon: "🃏", enabled: true, sort_order: 1 }
  ],
  categories: [
    { name: "小工具", icon: "🧰", page: "apps", sort_order: 0 },
    { name: "圖卡", icon: "🃏", page: "cards", sort_order: 0 }
  ],
  apps: [
    {
      id: "a1", name: "行軍地圖計算", url: "https://hm20c.vercel.app/", slug: "hm20c",
      description: "計埋行軍路線", category: "小工具", page: "apps", visible: true, featured: false,
      tags: [], clicks: 20, stars: 0, hearts: 0, sort_order: 0, created_at: "2026-09-01"
    },
    {
      id: "a2", name: "未有代號嘅工具", url: "https://no-slug.vercel.app/", slug: null,
      description: "fallback 用 id", category: "小工具", page: "apps", visible: true, featured: false,
      tags: [], clicks: 0, stars: 0, hearts: 0, sort_order: 1, created_at: "2026-09-02"
    },
    {
      id: "a3", name: "童軍圖卡", url: "https://cub-book.vercel.app/", slug: "cub-book",
      description: "圖卡內容", category: "圖卡", page: "cards", visible: true, featured: true,
      tags: [], clicks: 0, stars: 0, hearts: 0, sort_order: 0, created_at: "2026-09-03"
    },
    {
      id: "a4", name: "已收起嘅工具", url: "https://hidden.vercel.app/", slug: "hidden-one",
      description: "唔應該開到", category: "小工具", page: "apps", visible: false, featured: false,
      tags: [], clicks: 0, stars: 0, hearts: 0, sort_order: 2, created_at: "2026-09-04"
    }
  ]
};

function makeTable(name) {
  const rows = () => DB[name] || [];
  const q = {
    _f: [],
    select() { return q; }, order() { return q; }, limit() { return q; },
    eq(c, v) { q._f.push([c, v]); return q; },
    in(c, v) { q._f.push([c, v]); return q; },
    gte() { return q; },
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    then(res, rej) {
      let data = rows();
      for (const [c, v] of q._f) data = data.filter((r) => (Array.isArray(v) ? v.includes(r[c]) : r[c] === v));
      return Promise.resolve({ data, error: null, count: data.length }).then(res, rej);
    }
  };
  q.update = (patch) => { rows().forEach((r) => { if (q._f.every(([c, v]) => r[c] === v)) Object.assign(r, patch); }); return Promise.resolve({ data: null, error: null }); };
  q.insert = (row) => { rows().push({ id: "n1", ...row }); return Promise.resolve({ data: null, error: null }); };
  q.delete = () => Promise.resolve({ data: null, error: null });
  return q;
}

// 起一個「URL 有 search 嘅」瀏覽器環境，回傳 { ctx, els, replaced }
function boot(search) {
  const els = {};
  const mem = new Map();
  const replaced = [];
  const document = {
    documentElement: { dataset: { theme: "dark" }, style: { setProperty() {} } },
    body: fakeEl("body"),
    getElementById(id) { return htmlIds.has(id) ? (els[id] || (els[id] = fakeEl(id))) : null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, createElement() { return fakeEl("c"); }
  };
  const URL_BASE = "https://scoutappstore.vercel.app/";
  const location = {
    href: URL_BASE + search, search, pathname: "/", protocol: "https:", hash: "", reload() {},
    assign(u) { location.href = u; }
  };
  const ctx = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    URL, URLSearchParams,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    AbortSignal: { timeout: () => null },
    navigator: { onLine: true, clipboard: { writeText: async () => {} } },
    location,
    history: { replaceState(state, title, url) { replaced.push(url); if (url) location.href = "https://scoutappstore.vercel.app" + url; } },
    document,
    localStorage: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k)
    },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: async () => ({ ok: true, json: async () => ({}), text: async () => "" }),
    alert() {}, confirm: () => true, prompt: () => "",
    IntersectionObserver: null,
    window: null
  };
  ctx.window = {
    addEventListener() {}, removeEventListener() {}, scrollTo() {}, open() {},
    location: ctx.location, navigator: ctx.navigator, document,
    localStorage: ctx.localStorage, history: ctx.history,
    supabase: { createClient: () => ({ from: makeTable, auth: { getSession: async () => ({ data: { session: null } }), updateUser: async () => ({ error: null }) }, rpc: async () => ({ data: null, error: null }) }) },
    matchMedia: () => ({ matches: false, addEventListener() {} })
  };
  ctx.globalThis = ctx;
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  for (const s of scripts) vm.runInContext(s.code, ctx, { filename: s.name });
  return { ctx, els, replaced, location };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  /* 1) 直接開首頁：卡片／排行榜 href 係深層連結，唔係子站 */
  const home = boot("");
  await wait(80);
  const cardsHTML = home.els.sections.innerHTML;
  assert.ok(cardsHTML.includes("https://scoutappstore.vercel.app/?app=hm20c"),
    "卡片 href 要用深層連結（/?app=hm20c）");
  assert.ok(cardsHTML.includes("https://scoutappstore.vercel.app/?app=a2"),
    "slug 未填要 fallback 用 _id（/?app=a2），唔會出 undefined");
  assert.ok(!/href="https:\/\/hm20c\.vercel\.app/.test(cardsHTML), "卡片 href 唔可以再係子站網址");
  assert.ok(!/hidden\.vercel\.app/.test(cardsHTML), "visible=false 嘅項目唔會渲染出嚟");

  // 分享面板：顯示、QR、複製全部用深層連結
  home.ctx.openShareModal("a1");
  assert.equal(home.els["share-modal-url"].value, "https://scoutappstore.vercel.app/?app=hm20c",
    "分享面板要顯示深層連結");
  assert.ok(decodeURIComponent(home.els["share-modal-qr"].src).includes("https://scoutappstore.vercel.app/?app=hm20c"),
    "QR code 要編碼深層連結");
  assert.equal(home.ctx.appDeepLink({ slug: "hm20c" }), "https://scoutappstore.vercel.app/?app=hm20c");
  assert.equal(home.ctx.appDeepLink({ _id: "uuid-1234" }), "https://scoutappstore.vercel.app/?app=uuid-1234");

  // sheet「開啟」掣：仍然入子站（保留 Referer）
  home.ctx.openAppSheet(0);
  assert.equal(home.els["app-sheet"].hidden, false, "撳卡／開 sheet 要見到詳情");
  home.els["sheet-open"].onclick();
  assert.equal(home.location.href, "https://hm20c.vercel.app/", "sheet「開啟」仍然要直入子站");

  /* 2) ?app=<slug>：開該 App 詳情 */
  const deep = boot("?app=hm20c");
  await wait(80);
  assert.equal(deep.els["app-sheet"].hidden, false, "?app=hm20c 要直接開詳情 sheet");
  assert.equal(deep.els["sheet-name"].textContent, "行軍地圖計算");
  assert.ok(deep.replaced.some((u) => u && u.includes("app=hm20c")), "網址欄要寫返 ?app=hm20c");

  /* 3) 另一個分頁嘅 App 都開得到（會自己切分頁） */
  const deep2 = boot("?app=cub-book");
  await wait(80);
  assert.equal(deep2.els["app-sheet"].hidden, false, "跨分頁深層連結都要開得到詳情");
  assert.equal(deep2.els["sheet-name"].textContent, "童軍圖卡");

  /* 4) 打錯 slug：唔白屏、有 toast、停喺首頁 */
  const bad = boot("?app=not-exist");
  await wait(80);
  assert.ok(!bad.els["app-sheet"] || bad.els["app-sheet"].hidden, "打錯 slug 唔應該開任何 sheet");
  assert.equal(bad.els.toast.textContent, "搵唔到呢個 App", "打錯 slug 要出「搵唔到呢個 App」");
  assert.ok(bad.els.sections.innerHTML.includes("tile-name"), "打錯 slug 都要正常顯示首頁");
  assert.ok(bad.replaced.some((u) => u === "/"), "打錯 slug 要靜靜清走 ?app=");

  /* 5) visible=false：深層連結唔准偷偷開到 */
  const hidden = boot("?app=hidden-one");
  await wait(80);
  assert.ok(!hidden.els["app-sheet"] || hidden.els["app-sheet"].hidden, "visible=false 唔可以經深層連結開到");
  assert.equal(hidden.els.toast.textContent, "搵唔到呢個 App");

  /* 6) ?from= 只作備註：唔影響行為，亦唔會加任何 state */
  const from = boot("?app=hm20c&from=library");
  await wait(80);
  assert.equal(from.els["app-sheet"].hidden, false, "有 ?from= 都照樣開到詳情");
  assert.equal(from.els["sheet-name"].textContent, "行軍地圖計算");

  console.log("✅ deeplink: 分享／QR／卡片一律指 APP STORE、?app= 開詳情、打錯返首頁、visible=false 開唔到、子站入口照舊（全部通過）");
})().catch((e) => { console.error(e); process.exitCode = 1; });
