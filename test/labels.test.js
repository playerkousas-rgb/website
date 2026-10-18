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
    querySelector(sel) { const k = id + "::" + sel; return els[k] || (els[k] = fakeEl(k)); }, querySelectorAll() { return []; },
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
  name: "SCOUT APP STORE",
  pages: [{
    id: "apps", label: "小工具 Apps", icon: "🧰", enabled: true,
    categories: [
      { name: "電子進度紀錄", icon: "🧭", apps: [
        { _id: "1", name: "小童軍集會助手", url: "https://a", description: "集會流程", tags: ["小童軍"], clicks: 0, stars: 0, hearts: 2, visible: true, sort_order: 1 },
        { _id: "2", name: "幼童軍專章追蹤", url: "https://b", description: "", tags: ["幼童軍"], clicks: 12, stars: 3, hearts: 7, visible: true, sort_order: 2 }
      ] },
      { name: "小工具", icon: "🧰", apps: [
        { _id: "3", name: "行軍地圖計算", url: "https://c", description: "", tags: ["童軍", "深資童軍", "樂行童軍"], clicks: 5, stars: 9, hearts: 1, visible: true, sort_order: 1 }
      ] },
      { name: "小遊戲", icon: "🎮", apps: [] }
    ]
  }]
};
const run = (code) => vm.runInContext(code, ctx);
const names = () => (els.sections.innerHTML.match(/tile-name">([^<]*)/g) || []).map((x) => x.replace('tile-name">', ""));
run(`SITES = ${JSON.stringify(SITES)}; ACTIVE_PAGE = "apps"; render();`);

// 未揀：五個支部都係中性外殼、有提示、手機有單字短名，同冇「已選」樣式
const tagRow = els["tag-row"].innerHTML;
assert.ok(tagRow.includes("小童軍") && tagRow.includes("樂行童軍"), "支部列包含全部童軍支部（桌面出全名）");
assert.ok(!tagRow.includes("適用級別") && !appSrc.includes("適用級別"), "「適用級別」要完全咁消失");
assert.ok(!/tag-chip lv-chip on/.test(tagRow), "未揀就唔可以有 on 狀態");
assert.strictEqual((tagRow.match(/aria-pressed="false"/g) || []).length, 5, "五個支部都係 aria-pressed=false");
assert.ok(tagRow.includes('class="tag-row-hint"') && tagRow.includes("適用支部"), "支部列要有「🔍 適用支部：」提示");
assert.ok(tagRow.includes('<span class="narrow-only">小</span>'), "手機版支部收做一個字（小）");
assert.ok(tagRow.includes("可多選"), "未揀時要有「可多選」提示");
assert.ok(!tagRow.includes("tag-clear"), "未揀支部時唔應該有清除掣");
assert.ok(!appSrc.includes("branch-tab"), "舊 .branch-tab 灰字 tabs 已經唔再用");
assert.ok(els["sort-row"].hidden === true && els["sort-row"].innerHTML === "", "探索分類唔再有排序列（排名晒喺排行榜）");
assert.ok(els.sections.innerHTML.includes("like-heart"), "每個項目下方都有心心（讚好）");
assert.ok(els.sections.innerHTML.includes("fav-star"), "項目保留收藏星星");

// 多選 = OR
run("setTag('小童軍'); setTag('幼童軍');");
assert.deepStrictEqual(names(), ["小童軍集會助手", "幼童軍專章追蹤"], "揀「小＋幼」= 兩個支部嘅項目都顯示");
assert.strictEqual(run("tagFilter.length"), 2, "tagFilter 要係陣式（多選）");
assert.strictEqual(JSON.parse(mem.get("scout-tag-filter")).tags.length, 2, "篩選記住喺 localStorage");
// 揀咗要有明顯樣式：accent 底（.on）＋ ✓，同埋行尾「已揀 N 個 · ✕ 清除」
assert.ok(/class="tag-chip lv-chip on"/.test(els["tag-row"].innerHTML), "揀咗就有 on（accent 漸層）");
assert.ok((els["tag-row"].innerHTML.match(/✓/g) || []).length === 2, "揀咗嘅支部各有一個 ✓");
assert.ok(els["tag-row"].innerHTML.includes("已揀 2 個"), "要顯示「已揀 N 個」");
assert.ok(/class="tag-chip tag-clear"/.test(els["tag-row"].innerHTML) && appSrc.includes('onclick="clearTags()"'),
  "要有「✕ 清除」掣，而且駁住 clearTags()");

// 第三個 -> 再 OR 埋；撳多次同一個 -> 取消
run("setTag('童軍');");
assert.strictEqual(names().length, 3);
run("setTag('童軍');");
assert.strictEqual(names().length, 2, "再撳多次係取消該支部");
// 探索分類唔再跟排序指標 —— 永遠預設順序（排行榜指標淨係影響排行榜）
run("setSort('clicks');");
assert.deepStrictEqual(names(), ["小童軍集會助手", "幼童軍專章追蹤"], "探索分類永遠預設順序");
run("clearTags();");
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

// chip markup：純文字（冇 emoji 阻位）；短名只喺手機顯示
assert.ok(els.chips.innerHTML.includes('<span class="wide-only">電子進度紀錄</span><span class="narrow-only">進度紀錄</span>'), "分類 chip：桌面全名／手機短名");
assert.ok(!els.chips.innerHTML.includes("chip-ico"), "分類標籤純文字，冇圖示阻位");
assert.ok(!els.chips.innerHTML.includes('data-chip="fav"'), "「我的收藏」唔再係下方標籤");
assert.ok(!els.chips.innerHTML.includes("收藏"), "下方標籤唔再有收藏入口");
assert.ok(!html.includes('id="fav-jump"'), "搜尋欄那行的我的收藏已移走");
assert.ok(html.includes('id="bottom-nav"') && html.includes('data-bnav="fav"'), "底欄有常駐收藏入口");
assert.ok(html.includes("我的收藏"), "入口叫「我的收藏」，唔係「我的最愛」");
assert.ok(html.includes("提交作品") && !html.includes("提交我的作品"), "投稿掣改名做「提交作品」");
assert.ok(!els.sections.innerHTML.includes('<div class="tile-tags">'), "每個 APP 下方唔再標支部");
assert.ok(els.sections.innerHTML.includes('title="收藏"') && els.sections.innerHTML.includes('title="讚好"') && els.sections.innerHTML.includes('title="分享"'), "每個 APP 下方改為 3 個按鈕 星 (收藏) 心 (讚好) 分享");
// 圖示要全站一致：⭐ = 收藏、❤️ = 讚好（底欄「收藏」都係星星，唔可以一邊心一邊星）
assert.ok(/btn-star fav-star[^>]*title="收藏"/.test(els.sections.innerHTML), "收藏掣用星星 ⭐");
assert.ok(/btn-heart like-heart[^>]*title="讚好"/.test(els.sections.innerHTML), "讚好掣用心心 ❤️");
assert.ok(/data-bnav="fav"[\s\S]{0,120}?bnav-icon">⭐/.test(html), "底欄「收藏」用星星 ⭐，唔係心心");
assert.ok(!/bnav-icon">❤️/.test(html), "心心淨係留俾讚好，唔好再當收藏用");

// 心心（讚好）：撳 = +1 並記住，再撳 = 取消
run("SITES.pages[0].categories[1].apps[0].hearts = 1;");
assert.strictEqual(run("isHearted('3')"), false, "一開始未讚好");
run("toggleHeart('3');");
assert.strictEqual(run("isHearted('3')"), true, "撳咗就記住");
assert.strictEqual(run("SITES.pages[0].categories[1].apps[0].hearts"), 2, "讚好即時 +1");
assert.deepStrictEqual(JSON.parse(mem.get("showcase-hearts")), ["3"], "讚好紀錄存瀏覽器");
run("toggleHeart('3');");
assert.strictEqual(run("isHearted('3')"), false, "再撳係取消");
assert.strictEqual(run("SITES.pages[0].categories[1].apps[0].hearts"), 1, "取消即時 -1");
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
// 今期主打：默認收起 + 唔顯示點擊數 + 收藏／讚好滿 100 先顯示
assert.ok(/collapsedByDefault:\s*true/.test(html), "SPOTLIGHT 默認收起");
assert.ok(/showStars:\s*true/.test(html), "SPOTLIGHT 保留收藏數");
assert.ok(!/bits\.push\("🔥/.test(html), "hero 唔再顯示點擊數（新项目多數 0 次）");
assert.ok(!html.includes("SPOTLIGHT.showStats"), "showStats 已換成 showStars");
assert.ok(/\(a\.stars \|\| 0\) >= minShow/.test(html) && /\(a\.hearts \|\| 0\) >= minShow/.test(html), "今期主打 ⭐／❤️ 滿 100 先顯示（同排行榜一樣）");

// ── 3b) 手機版唔可以有「掣被擠走／切走／疊住」──────────────────
// 三種以前真係會發生嘅情況：header 掣擠出螢幕、底欄細字行 overflow:hidden 切走 QR／edit、
// 一格 tile 放唔落 3 粒掣（凸出去疊住隔籬）。以下係回歸鎖。
const mobile = style.slice(style.indexOf("@media (max-width: 559.98px)"));
// 註解都會含有樣式字眼，檢查「有冇用 nowrap 呢個寫法」之前要剝走註解
const styleCode = style.replace(/\/\*[\s\S]*?\*\//g, "");
assert.ok(mobile.length > 400, "搵到手機版 CSS 區塊");
assert.ok(/\.head-row \{[^}]*flex-wrap: wrap/.test(mobile), "手機 header 識轉行（唔會將掣擠出螢幕外）");
assert.ok(/\.head-titles \{[^}]*min-width: 150px/.test(mobile), "標題欄有最小闊度（唔會縮到 0 逼走啲掣）");
assert.ok(/\.head-actions \{[^}]*flex-wrap: wrap/.test(mobile), "header 動作掣自己都識轉行");
assert.ok(/\.page-nav \{[^}]*flex-wrap: wrap/.test(mobile), "手機分頁導覽識轉行（尾幾個分頁唔會隱形）");
assert.ok(!/flex-wrap:\s*nowrap\s*;/.test(styleCode), "唔准再用 nowrap 令啲掣滑出螢幕");
assert.ok(/\.bottom-credit-line \.credit-copy \{[^}]*text-overflow: ellipsis/.test(style), "版權文字識刪節（唔會推走 QR／edit 掣）");
assert.ok(!/\.bottom-credit-line \{[^}]*overflow: hidden/.test(style), "底欄細字行唔可以 overflow:hidden 切走啲掣");
assert.ok(mobile.includes(".bottom-credit-line .ig-sub"), "手機先收走裝飾文字（童軍工具·教學），留住啲掣");
assert.ok(/\.tile-bar \{[^}]*gap: 4px/.test(style) && /\.tile-btn \{[^}]*padding: 4px 4px/.test(style),
  "tile 3 粒掣（收藏／支持／分享）要收窄到放得落一格");
assert.ok(/\.tile-btn svg \{ width: 14px/.test(mobile), "手機 tile 掣圖示再細一格（14px：3 粒掣喺 320px 闊都放得落）");
assert.ok(/\.admin-cat-head \{[^}]*flex-wrap: wrap/.test(styleCode), "後台分類列識轉行（🎨 emoji／刪分類唔會走出螢幕）");

// ── 3c) 今期主打嘅通知預覽：內文跟項目嘅「介紹」──────────────────
assert.ok(/function spotlightPreviewMsg[\s\S]{0,240}app\.description/.test(html), "通知預覽內文讀項目嘅介紹");
assert.ok(/if \(pvm\) pvm\.textContent = spotlightPreviewMsg\(a\)/.test(html), "推送預覽用 spotlightPreviewMsg(a)");
assert.ok(!/pvm\.textContent = SPOTLIGHT\.preview\.msg/.test(html), "唔可以再寫死一句「本週活動安排已更新」");

console.log("✅ labels.test.js 全部通過");

// Store charts: aggregate across categories, apply filters and exclude hidden works.
els.search.value = '';
run(`SITES = ${JSON.stringify(SITES)}; tagFilter=[]; activeChip='all'; setMarketView('charts');`);
const chartNames = () => (els.sections.innerHTML.match(/<h3>([^<]*)<\/h3>/g) || []).map(x => x.replace(/<\/?h3>/g,''));
assert.deepStrictEqual(chartNames(), ['幼童軍專章追蹤','行軍地圖計算','小童軍集會助手']);
run("setSort('stars');");
assert.deepStrictEqual(chartNames(), ['行軍地圖計算','幼童軍專章追蹤','小童軍集會助手']);
run("setSort('hearts');");
assert.deepStrictEqual(chartNames(), ['幼童軍專章追蹤','小童軍集會助手','行軍地圖計算'], "❤️ 最受歡迎按心數排名");
assert.ok(els["sort-row"].innerHTML.includes("最多人點擊") && els["sort-row"].innerHTML.includes("最多人收藏") && els["sort-row"].innerHTML.includes("最受歡迎"), "排行榜指標列 = 🔥⭐❤️ 三選一");
assert.ok(els.sections.innerHTML.includes("❤️ 最受歡迎"), "排行榜標題跟指標改");
run("setSort('clicks');");
run("activeChip='cat-0'; render();");
assert.equal(chartNames().length,2);
run("activeChip='all'; SITES.pages[0].categories[1].apps[0].visible=false; render();");
assert.ok(!chartNames().includes('行軍地圖計算'));
els.search.value = '幼童軍'; run('render();');
assert.deepStrictEqual(chartNames(), ['幼童軍專章追蹤']);
run('setMarketView("discover");');
assert.deepStrictEqual(names(), ['幼童軍專章追蹤']);
console.log('✅ charts: counts, cross-category ranking, visibility, search and navigation passed');

// ── 4) 底欄導覽：「連結」／「教學工具」唔可以兜底曬出商店分類 ─────────
// (a) 未開放（links/cards/ppt 關閉＋冇內容）→ 專區佔位，唔顯示 apps 分類
const SITES_SHOP = {
  name: "SCOUT APP STORE",
  pages: [
    { id: "apps", label: "小工具 Apps", icon: "🧰", enabled: true,
      categories: [{ name: "電子進度紀錄", icon: "🧭", apps: [
        { _id: "1", name: "小童軍集會助手", url: "https://a", tags: [], clicks: 0, stars: 0, hearts: 0, visible: true }
      ] }] },
    { id: "cards", label: "學習圖卡", icon: "🃏", enabled: false, categories: [] },
    { id: "ppt",   label: "PPT 簡報", icon: "📽️", enabled: false, categories: [] },
    { id: "links", label: "有用連結", icon: "🔗", enabled: false, categories: [] }
  ]
};
els.search.value = "";
els["hero-spotlight"] = fakeEl("hero-spotlight");
els["hero-spotlight"].hidden = false; // 假設商店 hero 正顯示緊
run(`SITES = ${JSON.stringify(SITES_SHOP)}; ACTIVE_PAGE = "apps"; bnavSection = null; activeChip = "all"; tagFilter = []; marketView = "discover"; render();`);
assert.ok(names().includes("小童軍集會助手"), "商店分類照常顯示");
assert.strictEqual(run("updateBnavState()"), "discover", "apps 分頁嘅內容要著「分類」燈（以前錯著「教學工具」）");

run("handleBnav('links');");
assert.ok(!els.sections.innerHTML.includes("小童軍集會助手") && !els.sections.innerHTML.includes("電子進度紀錄"),
  "「連結」未開放就唔可以兜底顯示商店分類／項目");
assert.strictEqual(els.sections.innerHTML, "", "「連結」佔位唔渲染任何分類區");
assert.strictEqual(els.empty.style.display, "block", "「連結」佔位顯示提示");
assert.strictEqual(els["empty::b"].textContent, "「有用連結」尚未開放", "「連結」佔位文案");
assert.strictEqual(els.chips.innerHTML, "", "「連結」佔位唔顯示分類 chips");
assert.strictEqual(els["page-nav"].hidden, true, "「連結」佔位唔顯示頂部分頁導覽");
assert.strictEqual(els["hero-spotlight"].hidden, true, "「連結」佔位連今期主打都收埋（都係商店內容）");
assert.strictEqual(run("updateBnavState()"), "links", "「連結」著燈");

run("handleBnav('tools');");
assert.ok(!els.sections.innerHTML.includes("小童軍集會助手") && !els.sections.innerHTML.includes("電子進度紀錄"),
  "「教學工具」未開放就唔可以兜底顯示商店分類／項目");
assert.strictEqual(els["empty::b"].textContent, "「教學工具」尚未開放", "「教學工具」佔位文案");
assert.strictEqual(run("updateBnavState()"), "tools", "「教學工具」著燈");

run("handleBnav('discover');");
assert.ok(names().includes("小童軍集會助手"), "返去「分類」即刻見返商店內容");
assert.strictEqual(run("updateBnavState()"), "discover");

// (b) 專區有公開內容 → 只顯示專區自己嘅嘢
const SITES_OPEN = JSON.parse(JSON.stringify(SITES_SHOP));
SITES_OPEN.pages[1].enabled = true;
SITES_OPEN.pages[1].categories = [{ name: "徽章圖卡", icon: "🃏", apps: [
  { _id: "C1", name: "徽章圖卡組", url: "https://c", tags: [], clicks: 0, stars: 0, hearts: 0, visible: true }
] }];
SITES_OPEN.pages[3].enabled = true;
SITES_OPEN.pages[3].categories = [{ name: "官方網站", icon: "🔗", apps: [
  { _id: "L1", name: "童軍總會", url: "https://b", tags: [], clicks: 0, stars: 0, hearts: 0, visible: true }
] }];
run(`SITES = ${JSON.stringify(SITES_OPEN)}; ACTIVE_PAGE = "apps"; bnavSection = null; activeChip = "all"; marketView = "discover"; render();`);

run("handleBnav('links');");
assert.deepStrictEqual(names(), ["童軍總會"], "「連結」只顯示有用連結專區內容");
assert.ok(!els.sections.innerHTML.includes("小童軍集會助手"), "「連結」唔會夾雜商店分類內容");

run("handleBnav('tools');");
assert.deepStrictEqual(names(), ["徽章圖卡組"], "「教學工具」只顯示教學專區（學習圖卡）內容");
assert.ok(!els.sections.innerHTML.includes("小童軍集會助手"), "「教學工具」唔會夾雜商店分類內容");

run("handleBnav('discover');");
assert.deepStrictEqual(names(), ["小童軍集會助手"], "「分類」返商店分類內容");

run("handleBnav('charts');");
assert.ok(els.sections.innerHTML.includes("最多人點擊"), "排行榜照常運作");
assert.strictEqual(run("updateBnavState()"), "charts", "排行榜著燈");
run("handleBnav('discover');");
assert.strictEqual(run("updateBnavState()"), "discover");
console.log("✅ bnav: 「連結」／「教學工具」未開放顯示佔位，有內容只顯示專區自己嘅嘢");
