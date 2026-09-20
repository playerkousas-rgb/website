/* ════════════════════════════════════════════════════════════════
   scripts/verify-assets.js — 生產「部署清單」體積報告（零依賴）
   本站係「source 直上 Vercel 靜態根」模式：repo 入面邊啲檔案會部署、
   邊啲純開發用，要長期有意識。呢個 script：
     1) 核對「會部署」白名單一個唔少、一個唔多；
     2) sw.js 預載清單 ⊆ 白名單；
     3) 報告部署總體積（呢個先係 Vercel 用嘅位）。
   ════════════════════════════════════════════════════════════════ */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
let failed = 0;
const bad = (m) => { failed++; console.error("✗ " + m); };
const ok = (m) => console.log("✓ " + m);

/* 會部署去 Vercel、用戶瀏覽器會攞嘅全部檔案 */
const DEPLOY = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "store.js",
  "admin.js",
  "app.js",
  "apps.json",
  "api/favicon.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/ig-qr.png"
];
/* 純開發用（.vercelignore 擋走，或者 Vercel build 用完即棄） */
const DEV_ONLY = [
  "package.json", "package-lock.json",
  ".vercelignore", ".gitignore",
  "README.md", "OPTIMIZATION.md",
  "dev-server.mjs",
  "scripts/lint.js", "scripts/verify-assets.js",
  "test/favicon.test.js", "test/labels.test.js"
];

const kb = (n) => (n / 1024).toFixed(1) + " KB";

console.log("── 會部署嘅檔案（Vercel 用戶側）──────────────────");
let total = 0;
for (const f of DEPLOY) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { bad(`部署清單缺檔：${f}`); continue; }
  const sz = fs.statSync(p).size;
  total += sz;
  console.log(`  ${kb(sz).padStart(9)}  ${f}`);
}
ok(`部署總體積 ≈ ${kb(total)}（未計 Vercel edge 壓縮，gzip 後再細一截）`);

console.log("");
console.log("── 核對 sw.js 預載 ⊆ 部署清單 ────────────────────");
const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const m = sw.match(/const ASSETS = \[([^\]]*)\]/);
if (!m) { bad("sw.js 搵唔到 ASSETS"); }
else {
  const list = m[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter((u) => u && u !== "/");
  const outside = list.filter((u) => !DEPLOY.includes(u.replace(/^\//, "")));
  if (outside.length) bad(`sw.js 預載咗唔喺部署清單入面嘅檔案：${outside.join("、")}`);
  else ok(`sw.js ${list.length} 項預載全部喺部署清單入面`);
}

console.log("");
console.log("── repo 入面有冇「無主」檔案 ─────────────────────");
const KNOWN = new Set([...DEPLOY, ...DEV_ONLY]);
const SKIP_DIRS = new Set([".git", "node_modules", ".vercel"]);
const stray = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name)); continue; }
    const rel = path.relative(ROOT, path.join(dir, e.name));
    if (!KNOWN.has(rel)) stray.push(rel);
  }
})(ROOT);
if (stray.length) bad(`以下檔案唔喺部署清單亦唔喺開發清單（新加嘅？）：${stray.join("、")}\n   → 會部署嘅加入 DEPLOY；純開發用加入 DEV_ONLY 並確保 .vercelignore 擋住`);
else ok("無主檔案：0（所有檔案都清楚係部署定開發用）");

console.log("");
if (failed) { console.error(`verify-assets 失敗：${failed} 項`); process.exit(1); }
console.log("✅ 部署清單核對通過");
