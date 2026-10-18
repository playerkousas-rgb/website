// 設計系統守門測試（唔使瀏覽器，node 直接跑）
// 目的：守住 DESIGN.md 嘅三支柱（單一 accent／chrome 退後／量度過），
// 避免日後改版又走樣（尤其係「自己加多隻品牌色」呢類最常見）。
// 運行：node test/design.test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const html = read("index.html");
const market = read("market.css");
const design = read("DESIGN.md");
const sw = read("sw.js");

// ── 1) DESIGN.md 本身：格式同內容 ────────────────────────────
assert.ok(/^---\nversion: alpha\nname: /m.test(design), "DESIGN.md 要有 frontmatter（version / name）");
assert.ok(/description: "/.test(design), "DESIGN.md 要有 description");
for (const sec of ["## colors", "## typography", "## spacing", "## motion", "## components", "## rules"]) {
  assert.ok(design.includes(sec), `DESIGN.md 缺少 ${sec} 段落`);
}
assert.ok(design.includes("⭐ = 收藏") && design.includes("❤️ = 讚好"), "DESIGN.md 要寫明圖示約定");

// ── 2) token 級數齊全（間距 8 級／動效 3 級／圓角 5 級）─────────
for (const t of ["--accent:", "--bg:", "--text:", "--muted:", "--border:", "--ring:",
  "--radius:", "--radius-sm:", "--radius-xs:", "--radius-lg:",
  "--sp-1:", "--sp-4:", "--sp-10:", "--dur-1:", "--dur-2:", "--dur-3:", "--ease:"]) {
  assert.ok(html.includes(t), `index.html 缺少設計 token ${t}`);
}
// 間距／動效級數要完整（唔准淨係定義頭尾）
for (let i = 1; i <= 10; i++) {
  if (i === 7 || i === 9) continue;   // 跳過 7／9（4px base 唔會用到）
  assert.ok(html.includes(`--sp-${i}:`), `缺少間距級數 --sp-${i}`);
}

// ── 3) 單一 accent：唔准再出現第二種品牌色 ────────────────────
const FORBIDDEN = [
  ["#6366f1", "底欄原本寫死嘅靛藍"],
  ["rgba(99, 102, 241", "底欄原本寫死嘅靛藍"],
  ["#2563eb", "提交作品頁原本嘅藍"],
  ["#60a5fa", "原本嘅 focus ring 藍"],
  ["#3b82f6", "藍色"],
];
for (const [bad, why] of FORBIDDEN) {
  assert.ok(!html.includes(bad), `index.html 仲有寫死色 ${bad}（${why}）—— 一律行 var(--*)`);
  assert.ok(!market.includes(bad), `market.css 仲有寫死色 ${bad}（${why}）—— 一律行 var(--*)`);
}
// 底欄選中態一定要用 accent token
assert.ok(/\.bnav-btn\.on \{[^}]*var\(--accent-text\)/.test(html), "底欄選中態要用 var(--accent-text)");
assert.ok(/\.bnav-btn\.on \.bnav-icon \{[^}]*var\(--accent-soft\)/.test(html), "底欄選中底色要用 var(--accent-soft)");

// ── 4) chrome 退後：App 圖標卡嘅漸變唔准再被壓死 ───────────
// 睇實際 CSS（唔好連註釋一齊計，否則註釋提到個舊值都會誤報）
const css = html.replace(/\/\*[\s\S]*?\*\//g, "");
const tileIcon = (css.match(/\n {2}\.tile-icon \{[^}]*\}/) || [""])[0];
assert.ok(!/background:\s*transparent\s*!important/.test(tileIcon),
  ".tile-icon 唔准再用 background: transparent !important（會壓死 app.js 內聯漸變，icon 變裸放）");
assert.ok(/box-shadow/.test(tileIcon), ".tile-icon 要有陰影（App Store 式圖標牌）");

// ── 5) UI chrome 唔准有漸變（漸變只留俾 .hero-icon / .pv-ico）──
const chromeGradients = (html.match(/\.chip\.on \{[^}]*\}| \.page-btn\.on \{[^}]*\}| \.tag-chip\.on \{[^}]*\}/g) || [])
  .filter((b) => /linear-gradient/.test(b));
assert.strictEqual(chromeGradients.length, 0, "chip／page-btn／tag-chip 嘅選中態唔准用漸變（要 flat accent）");

// ── 6) 圖示約定：⭐ 收藏、❤️ 讚好 ─────────────────────────────
const appJs = read("app.js");
assert.ok(!/bnav-icon">❤️/.test(html), "心心淨係留俾讚好，底欄「收藏」要用 ⭐");
assert.ok(/bnav-icon">⭐/.test(html), "底欄「收藏」要用 ⭐");
assert.ok(!/title="收藏"[\s\S]{0,220}?heart-ico/.test(appJs), "收藏掣唔可以用心形圖案");
assert.ok(/title="收藏"[\s\S]{0,220}?star-ico/.test(appJs), "收藏掣要用星星圖案");
assert.ok(/title="讚好"[\s\S]{0,220}?heart-ico/.test(appJs), "讚好掣要用心形圖案");
assert.ok(!/title="讚好"[\s\S]{0,220}?star-ico/.test(appJs), "讚好掣唔可以用星星圖案");

// ── 7) 動效級數 + 減少動效支援 ────────────────────────────────
assert.ok(/@media \(prefers-reduced-motion: reduce\)/.test(html), "要有 prefers-reduced-motion 支援");

// ── 8) 改咗 index.html → sw.js cache 版本要 +1 ────────────────
const v = Number((sw.match(/const CACHE = 'scout-tools-v(\d+)'/) || [])[1]);
assert.ok(Number.isFinite(v) && v > 37, `sw.js cache 版本要 bump 過 v37（而家 v${v}）`);

console.log("✅ design.test.js 全部通過");
