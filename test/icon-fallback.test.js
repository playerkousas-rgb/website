/* ════════════════════════════════════════════════════════════════
   test/icon-fallback.test.js
   外部連結「細圖降級」機制

   背景：自家 app 一定跟真理倉 docs/33 有 512；
        但**外部連結**（第三方網站、老站）我哋控制唔到，
        有啲真係只得 16×16 favicon。硬放大到 68px 就係一嚿糊。

   規則：載入後量 naturalWidth
         · ≥ 64px → 正常顯示
         · < 64px → 換成字母牌（分類色底 + 名稱首字）

   呢度唔用真瀏覽器，只檢查：
   1) store.js 真係有掛 onload 檢查
   2) `MIN_ICON_PX` 門檻冇被改細
   3) fallback chain 由「大圖」開始（app 自己 → GitHub 460 → s2 256 → 全站 Logo）
   4) 字母牌 CSS 存在
   ════════════════════════════════════════════════════════════════ */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const store = read("store.js");
const html = read("index.html");

/* ── 1) 降級機制存在 ─────────────────────────────────────── */
assert.match(store, /function favImgOnLoad\(/, "store.js 要有 favImgOnLoad（量天然尺寸）");
assert.match(store, /function iconLetterFallback\(/, "store.js 要有 iconLetterFallback（換字母牌）");
assert.match(store, /const MIN_ICON_PX = (\d+)/, "要有 MIN_ICON_PX 門檻");
const minPx = Number(store.match(/const MIN_ICON_PX = (\d+)/)[1]);
assert.ok(minPx >= 64, `MIN_ICON_PX 唔可以細過 64（而家 ${minPx}）—— 64 以下放大到 68px 一定糊`);
console.log(`✓ 細圖降級門檻：< ${minPx}px 會換字母牌`);

/* ── 2) 兩個 <img> 分支都掛咗 onload ─────────────────────── */
/* 只有「由外部嚟嘅圖」需要檢查尺寸：
   · upload（用戶上傳）
   · favicon（抓人哋個站）
   「none」分支係直接用全站 Logo，本身一定夠大，唔需要檢查。 */
const imgTags = [...store.matchAll(/return `<img[^>]*>/g)].map((m) => m[0])
  .filter((t) => !t.includes("${SITE_LOGO}\" alt"));
assert.ok(imgTags.length >= 2, "store.js 應該有 upload 同 favicon 兩個要檢查嘅 <img> 分支");
for (const tag of imgTags) {
  assert.match(tag, /onload="favImgOnLoad\(this\)"/, `<img> 缺 onload 檢查：${tag.slice(0, 60)}…`);
  assert.match(tag, /\$\{nameAttr\}/, "<img> 要插入 nameAttr（字母牌靠 data-app-name 攞首字）");
}
// nameAttr 真係有 data-app-name
assert.match(store, /const nameAttr = ` data-app-name="\$\{esc\(app\.name \|\| ""\)\}"`/,
  "nameAttr 要用 data-app-name");
console.log(`✓ ${imgTags.length} 個 <img> 分支全部掛咗 onload + data-app-name`);

/* ── 2b) 哨兵：chain 最後唔可以係全站 Logo ─────────────────── */
assert.match(store, /out\.push\(""\);\s*\n\s*return out;/, "chain 最後要用哨兵空字串，唔可以用全站 Logo");
console.log("✓ chain 最後係哨兵（用字母牌，唔會冒充本站 Logo）");

/* ── 2c) 細圖要先試盡候選，唔可以即刻放棄 ─────────────────── */
assert.match(store, /function favTryNext\(img\)/, "要有 favTryNext 逐個試候選");
assert.match(store, /if \(!favTryNext\(img\)\)/, "onload 太細時要行 favTryNext 先");
assert.match(store, /loadTries/, "要有防迴圈上限");
console.log("✓ 細圖先試盡候選（GitHub 460 / s2 256），全部唔得先用字母牌");

/* ── 3) fallback chain：由大圖開始 ───────────────────────── */
assert.match(store, /github\.com\/" \+ repo\[1\] \+ "\.png\?size=460"/,
  "GitHub 頭像要用 size=460（唔係 64）");
assert.match(store, /s2\/favicons\?domain=" \+ host \+ "&sz=256/,
  "Google s2 要用 sz=256（唔係 64）");
assert.doesNotMatch(store, /sz=64/, "唔可以再用 sz=64 —— 外部站有 512 都只會攞到 64px");
assert.doesNotMatch(store, /\.png\?size=64/, "唔可以再用 GitHub size=64");
console.log("✓ fallback chain 用最大尺寸：GitHub 460、Google s2 256");

/* ── 4) 自家 app 優先於第三方 ───────────────────────────── */
const chainBlock = store.slice(store.indexOf("function faviconCandidates"), store.indexOf("function refreshAppIcons"));
const ownIdx = chainBlock.indexOf("/api/favicon?host=");
const ghIdx = chainBlock.indexOf("github.com/");
const s2Idx = chainBlock.indexOf("google.com/s2");
const sentinelIdx = chainBlock.indexOf('out.push("")');
assert.ok(ownIdx > 0 && ownIdx < ghIdx, "自己 /api/favicon 要排喺 GitHub 頭像之前");
assert.ok(ghIdx < s2Idx, "GitHub 頭像要排喺 Google s2 之前");
assert.ok(sentinelIdx > 0, "chain 要有哨兵");
assert.ok(s2Idx < sentinelIdx, "Google s2 要排喺哨兵之前");
console.log("✓ 次序：自己 /api/favicon → GitHub 460 → Google s2 256 → 哨兵（字母牌）");

/* ── 5) 字母牌 CSS ──────────────────────────────────────── */
assert.match(html, /\.icon-letter\s*\{/, "index.html 要有 .icon-letter 樣式");
assert.match(html, /\.icon-letter[^}]*var\(--cat/, "字母牌要用分類色（--cat）做底");
console.log("✓ 字母牌樣式存在，用分類色");

console.log("\n✅ icon-fallback.test.js 全部通過");
