// 顯示層標籤 ＋ 支部多選篩選單測（唔使瀏覽器，node 直接跑）
// 運行：node test/labels.test.js
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const storeSrc = read("store.js");
const appSrc = read("app.js");
const html = read("index.html");

// ── 1) 純函數：支部一個字／分類短名 ──────────────────────────
const base = {
  window: {}, document: { documentElement: { dataset: {} } },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  console
};
base.globalThis = base;
vm.createContext(base);
vm.runInContext(storeSrc + "\n;this.__api = { esc, scoutTagShort, catShort, SCOUT_TAGS };", base);
const { esc, scoutTagShort, catShort, SCOUT_TAGS } = base.__api;

assert.deepStrictEqual(Array.from(SCOUT_TAGS), ["小童軍", "幼童軍", "童軍", "深資童軍", "樂行童軍"], "支部仍係五個全名（無「領袖」）");
assert.strictEqual(SCOUT_TAGS.includes("領袖"), false, "唔應該有「領袖」選項");
assert.strictEqual(scoutTagShort("小童軍"), "小");
assert.strictEqual(scoutTagShort("幼童軍"), "幼");
assert.strictEqual(scoutTagShort("童軍"), "童");
assert.strictEqual(scoutTagShort("深資童軍"), "深");
assert.strictEqual(scoutTagShort("樂行童軍"), "樂");
assert.strictEqual(scoutTagShort("幼儀"), "幼儀", "兩字以下照樣顯示");
assert.strictEqual(scoutTagShort("深資童軍（預備）"), "深");
assert.strictEqual(scoutTagShort(""), "");

assert.strictEqual(catShort("小工具"), "小工具", "3 字唔好郁佢");
assert.strictEqual(catShort("學習圖卡"), "學習圖卡", "4 字照顯示");
assert.strictEqual(catShort("電子進度紀錄"), "進度紀錄", "削走「電子」");
assert.strictEqual(catShort("小工具 Apps"), "小工具", "削走 Apps");
assert.strictEqual(catShort("電子進度紀錄系統"), "進度紀錄", "削走電子＋系統");
assert.strictEqual(catShort("童軍活動簡報（2026）"), "童軍活動簡報", "括號內容削走");
assert.ok(catShort("一個好長好長好長嘅分類名稱").length <= 7, "最尾都有上限，唔會爆版");
assert.strictEqual(catShort(""), "");

// ── 2) render() 實際輸出（最小 fake DOM）────────────────────
function fakeEl(id) {
  const set = new Set();
  const e = {
    id, hidden: true, innerHTML: "", textContent: "", value: "",
    dataset: {}, style: { setProperty() {} }, offsetHeight: 40, offsetTop: 0,
    classList: { _s: set, toggle(c, f) { const v = f === undefined ? !set.has(c) : !!f; v ? set.add(c) : set.delete(c); return v; }, add(c) { set.add(c); }, remove(c) { set.delete(c); }, contains(c) { return set.has(c); } },
    querySelector() { return fakeEl("q"); }, querySelectorAll() { return []; },
    addEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    appendChild() {}, focus() {}, scrollIntoView() {}
  };
  return e;
}
const els = {};
const mem = new Map();
const ctx = {
  document: {
    documentElement: { dataset: { theme: "dark" }, style: { setProperty() {} } },
    getElementById(id) { return els[id] || (els[id] = fakeEl(id)); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, createElement() { return fakeEl("c"); }
  },
  localStorage: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) },
  window: { addEventListener() {}, scrollTo() {}, location: { href: "http://x/" } },
  navigator: {}, console, setTimeout, clearTimeout, IntersectionObserver: null
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(storeSrc + "\n" + appSrc, ctx);

const SITES = {
  name: "童軍小工具",
  pages: [{
    id: "apps", label: "小工具 Apps", icon: "🧰", enabled: true,
    categories: [
      { name: "電子進度紀錄", icon: "🧭", apps: [
        { _id: "1", name: "小童軍集會助手", url: "https://a", description: "集會流程", tags: ["小童軍"], clicks: 0, stars: 0, visible: true, sort_order: 1 },
        { _id: "2", name: "幼童軍專章追蹤", url: "https://b", description: "", tags: ["幼童軍"], clicks: 12, stars: 3, visible: true, sort_order: 2 }
      ] },
      { name: "小工具", icon: "🧰", apps: [
        { _id: "3", name: "行軍地圖計算", url: "https://c", description: "", tags: ["童軍", "深資童軍", "樂行童軍"], clicks: 5, stars: 9, visible: true, sort_order: 1 }
      ] },
      { name: "小遊戲", icon: "🎮", apps: [] }
    ]
  }]
};
const run = (code) => vm.runInContext(code, ctx);
const names = () => (els.sections.innerHTML.match(/tile-name">([^<]*)/g) || []).map((x) => x.replace('tile-name">', ""));
run(`SITES = ${JSON.stringify(SITES)}; ACTIVE_PAGE = "apps"; render();`);

// 未揀：三行都齊、得一個字／emoji，同冇「已選」樣式
const tagRow = els["tag-row"].innerHTML;
assert.ok(tagRow.includes("適用支部"), "欄位叫「適用支部」，唔係「適用級別」");
assert.ok(!tagRow.includes("適用級別") && !appSrc.includes("適用級別"), "「適用級別」要完全咁消失");
assert.ok(/aria-pressed="false"[^>]*>小</.test(tagRow) && !/class="tag-chip lv-chip on"/.test(tagRow), "未揀就唔可以有 on 狀態");
assert.ok(tagRow.includes("（可多選）"), "桌面提示可多選");
assert.ok(!tagRow.includes("✕ 清除"), "冇揀就唔擺清除掣");
assert.ok(/class="tag-chip sort-chip on"[^>]*aria-pressed="true"/.test(els["sort-row"].innerHTML), "排序列保留目前選項嘅高亮");

// 多選 = OR
run("setTag('小童軍'); setTag('幼童軍');");
assert.deepStrictEqual(names(), ["小童軍集會助手", "幼童軍專章追蹤"], "揀「小＋幼」= 兩個支部嘅項目都顯示");
assert.strictEqual(run("tagFilter.length"), 2, "tagFilter 要係陣式（多選）");
assert.strictEqual(JSON.parse(mem.get("scout-tag-filter")).tags.length, 2, "篩選記住喺 localStorage");
assert.ok(/class="tag-chip lv-chip on"/.test(els["tag-row"].innerHTML), "揀咗就有 on");
assert.ok(els["tag-row"].innerHTML.includes("✕ 清除"), "揀咗就畀返條路 Exit：清除掣");

// 第三個 -> 再 OR 埋；撳多次同一個 -> 取消
run("setTag('童軍');");
assert.strictEqual(names().length, 3);
run("setTag('童軍');");
assert.strictEqual(names().length, 2, "再撳多次係取消該支部");
// 排序照舊用得（同篩選疊加）
run("setSort('clicks');");
assert.deepStrictEqual(names(), ["幼童軍專章追蹤", "小童軍集會助手"], "排序 + 支部篩選要疊加");
run("setSort('default'); clearTags();");
assert.strictEqual(names().length, 3, "清除之後返晒");
assert.strictEqual(JSON.parse(mem.get("scout-tag-filter")).tags.length, 0);

// 搜尋：一個字／全名都揾到（placeholder 顺序：支部／分類／項目）
els.search.value = "幼";
run("activeChip='all'; render();");
assert.deepStrictEqual(names(), ["幼童軍專章追蹤"], "搜一個字都揾到");
els.search.value = "小童軍";
run("render();");
assert.deepStrictEqual(names(), ["小童軍集會助手"], "搜全名都揾到");
els.search.value = "";
run("render();");
assert.ok(html.includes('placeholder="搜尋支部／分類／項目…"'), "搜尋欄提示順序 = 支部／分類／項目");

// chip markup：短名只喺手機顯示
assert.ok(els.chips.innerHTML.includes('<span class="wide-only">電子進度紀錄</span><span class="narrow-only">進度紀錄</span>'), "分類 chip：桌面全名／手機短名");
assert.ok(els.chips.innerHTML.includes('<span class="wide-only">我的最愛</span><span class="narrow-only">最愛</span>'), "我的最愛 -> 最愛");
assert.ok(els.sections.innerHTML.includes('<div class="tile-tags"><span title="小童軍">小</span></div>'), "tile 小標籤 = 一個字 + 全名 tooltip");
// jumpTo 有 boot 跳板（要順帶解除朦朧）
assert.ok(appSrc.includes("function publicJumpTo(id)"), "app.js 暴露 publicJumpTo");
assert.ok(html.includes("function jumpTo(id) { revealSections();"), "boot 有 jumpTo 跳板");

// ── 3) index.html 樣式規則 ──────────────────────────────────
const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
assert.ok(style.indexOf("手機版：成列標籤") > style.indexOf(".chips {"), "手機版規則要喺 base 之後（先贏 cascade）");
assert.ok(/\.chips \{[^}]*flex-wrap: wrap/.test(style), "分類 chips 要識轉行（否則尾幾個永遠睇唔到）");
assert.ok(/\.tag-row \{[^}]*flex-wrap: wrap/.test(style), "支部／排序列都要識轉行");
assert.ok(style.includes(".narrow-only { display: none; }"), "桌面預設唔顯示短名");
// 未揀嘅 chip 唔好有 accent 底（會令人以為已經揀咗）
const tagChipRule = style.slice(style.indexOf(".tag-chip {"), style.indexOf(".tag-chip:hover"));
assert.ok(tagChipRule.includes("var(--bg-card)") && !tagChipRule.includes("--accent-soft"), "未揀嘅 tag-chip 用中性外殼");
// 今期主打：默認收起 + 唔顯示點擊數
assert.ok(/collapsedByDefault:\s*true/.test(html), "SPOTLIGHT 默認收起");
assert.ok(/showStars:\s*true/.test(html), "SPOTLIGHT 保留收藏數");
assert.ok(!/bits\.push\("🔥/.test(html), "hero 唔再顯示點擊數（新项目多數 0 次）");
assert.ok(!html.includes("SPOTLIGHT.showStats"), "showStats 已換成 showStars");

console.log("✅ labels.test.js 全部通過");
