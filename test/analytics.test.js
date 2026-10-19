// 後台「📊 統計」面板：⭐ 收藏 ＋ ❤️ 讚好 統計（唔使瀏覽器，node 直接跑）
// 運行：node test/analytics.test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const storeSrc = read("store.js");
const adminSrc = read("admin.js");
const html = read("index.html");

// ── 最小 fake DOM（同 labels.test.js 嗰套）────────────────────
function fakeEl(id) {
  const set = new Set();
  return {
    id, hidden: true, innerHTML: "", textContent: "", value: "", dataset: {},
    style: { setProperty() {} }, offsetHeight: 40, offsetTop: 0,
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    appendChild() {}, focus() {}, scrollIntoView() {}
  };
}
const els = {};
const ctx = {
  document: {
    documentElement: { dataset: { theme: "dark" }, style: { setProperty() {} } },
    getElementById(id) { return els[id] || (els[id] = fakeEl(id)); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, createElement() { return fakeEl("c"); }
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { hash: "", href: "http://x/" },
  window: { addEventListener() {}, scrollTo() {}, location: { href: "http://x/" } },
  navigator: {}, console, setTimeout, clearTimeout, fetch: () => Promise.resolve({ ok: true })
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(storeSrc + "\n" + adminSrc + "\n;this.__admin = { ADMIN, analyticsHTML };", ctx);
const { ADMIN, analyticsHTML } = ctx.__admin;

// ── 假資料：兩個 App，收藏／讚好／點擊數唔同 ─────────────────
ADMIN.sites = {
  name: "SCOUT APP STORE",
  pages: [{
    id: "apps", label: "小工具 Apps", icon: "🧰", enabled: true,
    categories: [{
      name: "小工具", icon: "🧰",
      apps: [
        { _id: "1", name: "甲", url: "https://a", icon: "🧭", iconSource: "emoji", tags: [], clicks: 10, stars: 5, hearts: 1, visible: true },
        { _id: "2", name: "乙", url: "https://b", icon: "🧰", iconSource: "emoji", tags: [], clicks: 2, stars: 30, hearts: 9, visible: true }
      ]
    }]
  }]
};

const data = {
  totalVisitors: 100, todayVisitors: 8, last7Visitors: 40, visitorDays: 12,
  daily: [{ date: "2026-10-18", visitors: 5 }]
};
const out = analyticsHTML(data);

// ── KPI：⭐ 收藏、❤️ 讚好、🔥 點擊 ───────────────────────────
assert.ok(out.includes("⭐ 全站收藏"), "KPI 要有「⭐ 全站收藏」");
assert.ok(out.includes("❤️ 全站讚好"), "KPI 要有「❤️ 全站讚好」");
assert.ok(out.includes("🔥 App 總點擊"), "KPI 要保留「🔥 App 總點擊」");
assert.ok(out.includes(">35<"), "⭐ 收藏總數 = 5 + 30 = 35");
assert.ok(out.includes(">10<"), "❤️ 讚好總數 = 1 + 9 = 10");
assert.ok(out.includes(">12<"), "🔥 點擊總數 = 10 + 2 = 12");
assert.ok(out.includes("👥 累計獨立訪客"), "Supabase 模式要有訪客 KPI");

// ── 新分區：每個 App 嘅 ⭐ 收藏 ＋ ❤️ 讚好 ───────────────────
assert.ok(out.includes("⭐ 收藏 ＋ ❤️ 讚好"), "要有「⭐ 收藏 ＋ ❤️ 讚好」分區");
assert.ok(out.includes("⭐ 30") && out.includes("❤️ 9"), "逐個 App 都要列出收藏／讚好數");
assert.ok(out.includes("analytics-fav-track"), "每行要有收藏／讚好 bar");
assert.ok(out.includes("trk-star") && out.includes("trk-heart"), "bar 要分金色（收藏）同紅色（讚好）");
// 排位：收藏多行先
const rows = out.match(/analytics-app-row[\s\S]*?<\/div>\s*<\/div>/g) || [];
assert.ok(out.indexOf("⭐ 30") < out.indexOf("⭐ 5"), "收藏多的排前面");

// ── Demo 模式：冇訪客數，但 ⭐／❤️ 照計 ─────────────────────
const demo = analyticsHTML(null, { demo: true });
assert.ok(demo.includes("Demo 模式"), "Demo 模式要有提示");
assert.ok(!demo.includes("👥 累計獨立訪客"), "Demo 模式唔應該假裝有訪客數");
assert.ok(demo.includes("⭐ 全站收藏") && demo.includes("❤️ 全站讚好"), "Demo 模式一樣有收藏／讚好統計");
assert.ok(!demo.includes("近 30 日入站趨勢"), "Demo 模式冇入站趨勢圖");

// ── CSS 都要有（新欄位唔可以爆版）───────────────────────────
assert.ok(/\.analytics-fav-track/.test(html), "要有 .analytics-fav-track 樣式");
assert.ok(/\.analytics-fav-nums/.test(html), "要有 .analytics-fav-nums 樣式");
assert.ok(/grid-template-columns: repeat\(3, 1fr\)/.test(html), "KPI 排 3 欄（6 格唔會甩一截出嚟）");

console.log("✅ analytics.test.js 全部通過");
