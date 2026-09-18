// 顯示層標籤單測：級別一個字、分類短名、手機／桌面兩用 markup
// 運行：node test/labels.test.js
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

// store.js 係瀏覽器 script（無 module），用 vm + 最小 stub 跑一次攞函數
const storeSrc = fs.readFileSync(path.join(ROOT, "store.js"), "utf8");
const sandbox = {
  window: {}, document: { documentElement: { dataset: {} } },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  console
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(storeSrc + "\n;this.__api = { esc, scoutTagShort, catShort, SCOUT_TAGS };", sandbox);
const { esc, scoutTagShort, catShort, SCOUT_TAGS } = sandbox.__api;

// ── 1) 適用級別：全名照舊係真相，顯示層一個字 ─────────────────
assert.deepStrictEqual(Array.from(SCOUT_TAGS), ["小童軍", "幼童軍", "童軍", "深資童軍", "樂行童軍"], "級別仍係五個全名（無「領袖」）");
assert.strictEqual(SCOUT_TAGS.includes("領袖"), false, "唔應該有「領袖」級別");
assert.strictEqual(scoutTagShort("小童軍"), "小");
assert.strictEqual(scoutTagShort("幼童軍"), "幼");
assert.strictEqual(scoutTagShort("童軍"), "童");
assert.strictEqual(scoutTagShort("深資童軍"), "深");
assert.strictEqual(scoutTagShort("樂行童軍"), "樂");
// 未知／自訂級別名：兩字以下原樣，其餘取第一字
assert.strictEqual(scoutTagShort("幼儀"), "幼儀");
assert.strictEqual(scoutTagShort("深資童軍（預備）"), "深");
assert.strictEqual(scoutTagShort(""), "");

// ── 2) 分類短名：夠短就用原名，長就削修飾詞 ──────────────────
assert.strictEqual(catShort("小工具"), "小工具", "3 字唔好郁佢");
assert.strictEqual(catShort("小遊戲"), "小遊戲");
assert.strictEqual(catShort("學習圖卡"), "學習圖卡", "4 字照顯示");
assert.strictEqual(catShort("有用連結"), "有用連結");
assert.strictEqual(catShort("電子進度紀錄"), "進度紀錄", "削走「電子」");
assert.strictEqual(catShort("小工具 Apps"), "小工具", "削走 Apps");
assert.strictEqual(catShort("電子進度紀錄系統"), "進度紀錄", "削走電子＋系統");
assert.strictEqual(catShort("童軍活動簡報（2026）"), "童軍活動簡報", "括號內容削走");
assert.ok(catShort("一個好長好長好長嘅分類名稱").length <= 7, "最尾都有上限，唔會爆版");
assert.strictEqual(catShort(""), "");

// ── 3) app.js：手機／桌面兩用 markup（wide-only / narrow-only）──
const appSrc = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
assert.ok(appSrc.includes('class="wide-only"'), "全名要喺 .wide-only（手機收埋）");
assert.ok(appSrc.includes('class="narrow-only"'), "短名要喺 .narrow-only（得手機顯示）");
// 排序掣：emoji 一直顯示，文字放 .wide-only → 手機淨係 🔥／⭐／🗂
assert.ok(/chip-ico">\$\{s\.ico\}<\/span><span class="wide-only">/.test(appSrc), "排序掣 = emoji + wide-only 文字");
// 級別掣：一個字 + title/aria 留全名
assert.ok(/class="tag-chip lv-chip/.test(appSrc) && appSrc.includes("aria-pressed"), "級別掣要有 lv-chip + aria-pressed");
assert.ok(/tile-tags">\$\{tags\.map\(\(t\) => `<span title="\$\{esc\(t\)\}">\$\{esc\(scoutTagShort\(t\)\)/.test(appSrc), "tile 小標籤用一個字");
// 搜尋要同時認到全名同一字
assert.ok(appSrc.includes("concat((a.tags || []).map(scoutTagShort))"), "haystack 要包埋短名");
// esc 唔可以漏（分類名直接入 HTML）
assert.ok(/chipTxt\(full, short\)/.test(appSrc) && esc("<a>") === "&lt;a&gt;", "chipTxt 內部要 esc");
assert.ok(!/class="chip[^"]*">\$\{c\.name\}/.test(appSrc), "分類名唔可以裸 insert HTML");

// ── 4) index.html：mobile media query 要擺喺 style 最尾（先贏 cascade）──
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
const mobileIdx = style.indexOf("手機版：成列標籤一齊收細");
const chipIdx = style.indexOf(".chips {");
const tagChipIdx = style.indexOf(".tag-chip {");
assert.ok(mobileIdx > chipIdx && mobileIdx > tagChipIdx, "手機版規則要喺 base 規則之後");
assert.ok(style.includes(".narrow-only { display: none; }"), "桌面預設唔顯示短名");
// 今期主打：默認收起 + 唔顯示點擊數
assert.ok(/collapsedByDefault:\s*true/.test(html), "SPOTLIGHT 默認收起");
assert.ok(/showStars:\s*true/.test(html), "SPOTLIGHT 保留收藏數");
assert.ok(!/bits\.push\("🔥/.test(html), "hero 唔再顯示點擊數（新項目多數 0 次）");
assert.ok(!html.includes("SPOTLIGHT.showStats"), "showStats 已換成 showStars");

console.log("✅ labels.test.js 全部通過");
