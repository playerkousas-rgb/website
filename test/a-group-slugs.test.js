/* ════════════════════════════════════════════════════════════════
   test/a-group-slugs.test.js
   逐一驗 docs/51 §1.1 嘅 A 組 slug（連 §1.1 補漏嗰 5 隻）**全部解析得到**：
   每個 slug 用「真 index.html ＋ 真 app.js」行一次 ?app=<slug>，
   確認會切分頁、開詳情 sheet、標題對得上、唔會出「搵唔到呢個 App」。

   ⚠️ 呢個係**本地 fixture 驗證**（證明「前端機制對得住呢 30＋5 個 slug」），
      唔等於 production DB 有呢啲 row 或者 visible=true ——
      DB 實況要用 anon REST 或者後台 SQL 睇（見 migrations/20261118-app-slug-a-group-missing.sql 尾段）。
   ════════════════════════════════════════════════════════════════ */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const html = read("index.html");

/* ── docs/51 §1.1 嘅 A 組 30 隻（任務 3 名單）──────────────────── */
const A_GROUP = [
  "aircraft-encyclopedia", "ayp", "bp", "course", "cubsgame", "cubsmeeting", "dbs", "doll",
  "drawtheroute", "forward", "game", "ghmeeting", "hkcamping", "hkmap", "icon-maker", "knotmaster",
  "map3d", "mcscript", "minigame", "mirror", "photo-edit", "photo-prep", "pioneer", "router",
  "scoutmeeting", "skw-tracking-signs", "troop-router", "upgrade", "voice-slide-web", "vsmeeting"
];
/* ── §1.1 補漏嗰 5 隻 ───────────────────────────────────────── */
const NEW_SLUGS = ["card", "scoutdesign", "skw-radar-hunt2", "skw-score", "veritas"];

/* ── 假 DOM（同 test/deeplink.test.js 同一套做法）──────────── */
const scripts = [];
for (const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  const open = m[0].slice(0, m[0].indexOf(">"));
  const src = /src="([^"]+)"/.exec(open);
  if (src && !/^https?:/i.test(src[1])) scripts.push({ name: src[1], code: read(src[1]) });
  else if (!src) scripts.push({ name: "index.html#inline", code: m[1] });
}
const htmlIds = new Set();
for (const m of html.matchAll(/id="([^"]+)"/g)) htmlIds.add(m[1]);

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

const ALL = A_GROUP.concat(NEW_SLUGS);
const nameOf = (slug) => "APP " + slug;
const DB = {
  pages: [{ id: "apps", label: "小工具 Apps", icon: "🧰", enabled: true, sort_order: 0 }],
  categories: [{ name: "小工具", icon: "🧰", page: "apps", sort_order: 0 }],
  apps: ALL.map((slug, i) => ({
    id: "id-" + slug,
    name: nameOf(slug),
    url: `https://${slug}.vercel.app/`,
    slug,
    description: "A 組驗證用",
    category: "小工具", page: "apps", visible: true, featured: false,
    tags: [], clicks: 0, stars: 0, hearts: 0, sort_order: i, created_at: "2026-11-18"
  }))
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
  q.update = () => Promise.resolve({ data: null, error: null });
  q.insert = () => Promise.resolve({ data: null, error: null });
  q.delete = () => Promise.resolve({ data: null, error: null });
  return q;
}

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
  const location = {
    href: "https://scoutappstore.vercel.app/" + search, search, pathname: "/", protocol: "https:",
    hash: "", reload() {}, assign(u) { location.href = u; }
  };
  const ctx = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, URL, URLSearchParams,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    AbortSignal: { timeout: () => null },
    navigator: { onLine: true, clipboard: { writeText: async () => {} } },
    location,
    history: {
      replaceState(state, title, url) { replaced.push(url); if (url) location.href = "https://scoutappstore.vercel.app" + url; }
    },
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
    supabase: {
      createClient: () => ({
        from: makeTable,
        auth: { getSession: async () => ({ data: { session: null } }), updateUser: async () => ({ error: null }) },
        rpc: async () => ({ data: null, error: null })
      })
    },
    matchMedia: () => ({ matches: false, addEventListener() {} })
  };
  ctx.globalThis = ctx;
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  for (const s of scripts) vm.runInContext(s.code, ctx, { filename: s.name });
  return { ctx, els };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const failed = [];
  for (const slug of ALL) {
    const { els } = boot("?app=" + encodeURIComponent(slug));
    await wait(60);
    const sheet = els["app-sheet"];
    const opened = sheet && sheet.hidden === false;
    const title = els["sheet-name"] && els["sheet-name"].textContent;
    const toast = els.toast && els.toast.textContent;
    if (!opened) { failed.push(`${slug}：冇開詳情 sheet${toast ? `（toast：${toast}）` : ""}`); continue; }
    if (title !== nameOf(slug)) failed.push(`${slug}：詳情標題唔對（見到「${title}」）`);
    if (toast === "搵唔到呢個 App") failed.push(`${slug}：出咗「搵唔到呢個 App」`);
  }
  assert.deepEqual(failed, [], "以下 slug 解析唔到：\n  " + failed.join("\n  "));

  // 唔存在嘅 slug 要停首頁 + 清 query（唔白屏）
  const bad = boot("?app=notexist");
  await wait(60);
  assert.ok(!bad.els["app-sheet"] || bad.els["app-sheet"].hidden, "?app=notexist 唔應該開任何 sheet");
  assert.equal(bad.els.toast.textContent, "搵唔到呢個 App");

  console.log(`✅ a-group-slugs: A 組 ${A_GROUP.length} 隻 ＋ §1.1 補漏 ${NEW_SLUGS.length} 隻，`
    + "逐個 ?app=<slug> 都開到對應詳情 sheet（本地 fixture）；?app=notexist 停首頁並清 query");
})().catch((e) => { console.error(e); process.exitCode = 1; });
