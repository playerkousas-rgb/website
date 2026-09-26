/* ════════════════════════════════════════════════════════════════
   test/boot-order.test.js
   防止「boot script 行到一半爆錯 → 成個公開版一個 APP 都顯示唔到」

   2026-09-26 真係試過：底部常駐列嘅 #ig-qr-btn 搬咗去 footer（喺 boot
   script 之下），boot 入面 `document.getElementById("ig-qr-btn")
   .addEventListener(...)` 攞到 null → TypeError → 成段 script 停咗，
   最底嘅 goRoute() → main() → render() 行唔到，成頁只剩 skeleton。

   兩個防護：
   1) 靜態：每個 script 入面「直駁 member access」嗰啲 getElementById，
      個 ID 必須喺 HTML 出現、而且要喺該 script 之前。
   2) 動態：用一個「HTML 有咩 ID 先有咩元素」嘅 fake DOM 跑晒全部
      script，任何 null deref 都會即刻爆出嚟。
   ════════════════════════════════════════════════════════════════ */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const html = read("index.html");
const lines = html.split("\n");

/* ── 收集 script（照文件順序）──────────────────────────────── */
const scripts = [];
for (const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  const open = m[0].slice(0, m[0].indexOf(">"));
  const src = /src="([^"]+)"/.exec(open);
  const pos = html.slice(0, m.index).split("\n").length - 1; // 0-based 行號
  if (src) {
    if (/^https?:/i.test(src[1])) continue; // 外部 CDN：單測環境冇載
    scripts.push({ name: src[1], pos, code: read(src[1]) });
  } else {
    scripts.push({ name: "index.html#inline", pos, code: m[1] });
  }
}
assert.ok(scripts.length >= 5, "index.html 應該載入 store/admin/app/market + inline boot");

/* ── 1) 靜態：直駁 getElementById("x"). 嗰啲，ID 要喺 script 之前 ── */
const htmlIds = new Map(); // id -> 最早出現行號
lines.forEach((l, i) => {
  for (const m of l.matchAll(/id="([^"]+)"/g)) if (!htmlIds.has(m[1])) htmlIds.set(m[1], i);
});
let checked = 0;
for (const s of scripts) {
  for (const m of s.code.matchAll(/document\.getElementById\(\s*["']([^"']+)["']\s*\)\./g)) {
    const id = m[1];
    checked++;
    assert.ok(htmlIds.has(id), `${s.name}: getElementById("${id}"). 撠住咗個 HTML 冇嘅 ID`);
    assert.ok(htmlIds.get(id) < s.pos,
      `${s.name}: getElementById("${id}"). 用咗第 ${htmlIds.get(id) + 1} 行先定義嘅元素，` +
      `但 script 喺第 ${s.pos + 1} 行 —— parse 到嗰陣元素未存在，會 TypeError 殺死成段 boot`);
  }
}
assert.ok(checked > 5, "靜態檢查要涵蓋多個掣");

/* ── 2) 動態：fake DOM 只會有 HTML 入面存在嘅 ID ─────────────── */
function fakeEl(id) {
  const set = new Set();
  return {
    id, hidden: false, innerHTML: "", textContent: "", value: "", checked: false, disabled: false,
    dataset: {}, style: { setProperty() {} }, offsetHeight: 40, offsetTop: 0, offsetWidth: 300,
    isConnected: true, files: [],
    classList: {
      _s: set,
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
const els = {};
const mem = new Map();
const DB = {
  pages: [{ id: "apps", label: "小工具 Apps", icon: "🧰", enabled: true, sort_order: 0 }],
  categories: [{ name: "小工具", icon: "🧰", page: "apps", sort_order: 0 }],
  apps: [{
    id: "a1", name: "行軍地圖計算", url: "https://example.com", description: "計埋行軍路線",
    category: "小工具", page: "apps", visible: true, featured: true, tags: ["童軍"],
    clicks: 0, stars: 0, hearts: 0, sort_order: 0, created_at: "2026-09-01"
  }]
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
const document = {
  documentElement: { dataset: { theme: "dark" }, style: { setProperty() {} } },
  body: fakeEl("body"),
  // 關鍵：HTML 冇嘅 ID 一定回 null（瀏覽器行為），唔可以自動變出嚟
  getElementById(id) { return htmlIds.has(id) ? (els[id] || (els[id] = fakeEl(id))) : null; },
  querySelector() { return null; }, querySelectorAll() { return []; },
  addEventListener() {}, createElement() { return fakeEl("c"); }
};
const ctx = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  AbortSignal: { timeout: () => null },
  navigator: { onLine: true, clipboard: { writeText: async () => {} } },
  location: { href: "https://scoutappstore.vercel.app/", hash: "", reload() {} },
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
  localStorage: ctx.localStorage,
  supabase: { createClient: () => ({ from: makeTable, auth: { getSession: async () => ({ data: { session: null } }), updateUser: async () => ({ error: null }) }, rpc: async () => ({ data: null, error: null }) }) },
  matchMedia: () => ({ matches: false, addEventListener() {} })
};
ctx.globalThis = ctx;
ctx.window.window = ctx.window;
vm.createContext(ctx);

let threw = null;
try {
  for (const s of scripts) vm.runInContext(s.code, ctx, { filename: s.name });
} catch (e) {
  threw = e;
}
assert.equal(threw, null,
  "載入頁面 script 嗰時爆咗錯：'" + (threw && threw.message) + "' —— " +
  "呢種錯會令 goRoute()/main() 行唔到，成個公開版一個 APP 都顯示唔到");

(async () => {
  await new Promise((r) => setTimeout(r, 60));
  const rendered = (els.sections ? els.sections.innerHTML : "");
  assert.ok(rendered.includes("tile-name"), "跑完 boot 之後 #sections 應該有項目卡片");
  assert.ok(rendered.includes("行軍地圖計算"), "Supabase 返嚟嘅項目要渲染出嚟");
  assert.ok(els["hero-title"] && els["hero-title"].textContent === "行軍地圖計算", "今期主打要顯示 featured 項目");
  console.log("✅ boot-order: script/DOM 順序靜態檢查 + 全 script 動態執行（一個 APP 都唔會無聲消失）全部通過");
})().catch((e) => { console.error(e); process.exitCode = 1; });
