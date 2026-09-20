/* ════════════════════════════════════════════════════════════════
   scripts/lint.js — 零依賴「防增肥」守護檢查（node scripts/lint.js）
   呢個專案刻意唔用 ESLint（會拖幾十 MB devDependencies 入 repo／Vercel）；
   呢度手寫最要緊嗰啲規則，commit / 部署前跑一次就夠。
   任何一項 ✗ 都會 exit 1 —— npm run build 会 fail，壞嘢推唔上 Vercel。
   ════════════════════════════════════════════════════════════════ */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
let failed = 0;
const ok = (m) => console.log("✓ " + m);
const bad = (m) => { failed++; console.error("✗ " + m); };
const warn = (m) => console.warn("⚠ " + m);

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const exists = (f) => fs.existsSync(path.join(ROOT, f));

/* ── 1) package.json 必須零運行期依賴 ─────────────────────────── */
const pkg = JSON.parse(read("package.json"));
if (pkg.dependencies && Object.keys(pkg.dependencies).length) {
  bad(`package.json 有 dependencies：${Object.keys(pkg.dependencies).join(", ")} —— 本站係純靜態+一個 serverless，任何運行期套件都係死重，唔應該存在`);
} else {
  ok("package.json 零 dependencies（運行期靠 CDN 單一 UMD 檔，唔使 npm 套件）");
}
const devDeps = Object.keys(pkg.devDependencies || {});
if (devDeps.length) warn(`package.json 有 devDependencies：${devDeps.join(", ")} —— 可以，但每個都要有存在理由（見 OPTIMIZATION.md）`);
else ok("package.json 連 devDependencies 都係零（lint/test 全用 node 內建模組）");

/* ── 2) .vercelignore 必須存在而且擋住 node_modules ───────────── */
if (!exists(".vercelignore")) {
  bad("根目錄冇 .vercelignore —— 部署會成個 repo 上傳（死重來源）。要加返。");
} else {
  const vi = read(".vercelignore");
  ok(".vercelignore 存在");
  for (const need of ["node_modules", "*.bak", "*.log", "uploads/", "dist/"]) {
    if (vi.includes(need)) ok(`.vercelignore 擋住「${need}」`);
    else bad(`.vercelignore 冇擋住「${need}」—— 補返，否則呢類死重會上傳去 Vercel`);
  }
}

/* ── 3) 死重檔案唔准存在（bak/tmp/old/log/uploads…）──────────── */
const JUNK = [/\.bak$/i, /\.old$/i, /\.tmp$/i, /\.temp$/i, /\.log$/i, /\.swp$/i, /\.orig$/i, /~$/, /-copy\.\w+$/i];
const SKIP_DIRS = new Set([".git", "node_modules", ".vercel"]);
const junkHits = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name)); continue; }
    if (JUNK.some((re) => re.test(e.name))) junkHits.push(path.relative(ROOT, path.join(dir, e.name)));
  }
})(ROOT);
for (const junkDir of ["uploads", "dist", "build", ".next", ".cache", "coverage"]) {
  if (fs.existsSync(path.join(ROOT, junkDir))) junkHits.push(junkDir + "/");
}
if (junkHits.length) bad(`搵到備份／暫存／建置死重：${junkHits.join("、")} —— 刪走（備份應該用 git，唔係 copy 檔案）`);
else ok("冇 *.bak / *.tmp / *.old / *.log / uploads / dist 等死重");

/* ── 4) 圖片體積上限（而家全站 PNG 淨係 icons/）───────────────── */
const PNG_LIMIT = 200 * 1024; // 200KB —— 512px 圖標量化後約 140KB，仲有位
const bigPng = [];
(function walk2(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk2(path.join(dir, e.name)); continue; }
    if (/\.png$/i.test(e.name)) {
      const sz = fs.statSync(path.join(dir, e.name)).size;
      if (sz > PNG_LIMIT) bigPng.push(`${path.relative(ROOT, path.join(dir, e.name))} (${(sz / 1024).toFixed(0)}KB)`);
    }
  }
})(ROOT);
if (bigPng.length) bad(`PNG 超過 ${PNG_LIMIT / 1024}KB 上限：${bigPng.join("、")} —— 行一次壓縮（方法見 OPTIMIZATION.md「圖片體積」）先好 commit`);
else ok(`所有 PNG 都喺 ${PNG_LIMIT / 1024}KB 以內`);

/* ── 5) index.html：外部 script 要鎖版本＋SRI（防供應鏈＋快取亂跳）*/
const html = read("index.html");
const extScripts = [...html.matchAll(/<script[^>]+src="(https?:\/\/[^"]+)"[^>]*>/g)];
if (!extScripts.length) warn("index.html 冇外部 script —— 如果日後加返 Supabase CDN，記得鎖版本＋integrity");
for (const m of extScripts) {
  const tag = m[0], url = m[1];
  const pinned = /@(\d+\.\d+\.\d+)/.test(url) || /@[\w-]+\/[\w.-]+@\d+\.\d+\.\d+\//.test(url);
  const hasSri = /integrity="/.test(tag);
  const hasCross = /crossorigin=/.test(tag);
  if (!pinned) bad(`外部 script 未鎖死版本：${url} —— 用 @2.116.0 呢種確實版本號，唔好用 @2/@latest（新版隨時加代碼拖慢全站）`);
  else ok(`外部 script 已鎖版本：${url.replace(/^https:\/\/[^/]+/, "")}`);
  if (!hasSri || !hasCross) bad(`外部 script 缺 integrity/crossorigin：${url} —— SRI 令瀏覽器拒收畀人改過嘅 CDN 回應`);
  else ok(`外部 script 有 SRI + crossorigin`);
}

/* ── 6) index.html：站內引用嘅檔案必須存在（防刪錐嘢唔覺）───────── */
const localRefs = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1].split("?")[0].split("#")[0]);
const missing = [...new Set(localRefs)].filter((u) => u !== "/" && !exists(u.replace(/^\//, "")));
if (missing.length) bad(`index.html 引用咗但 repo 冇嘅檔案：${missing.join("、")} —— 縮圖／清理時刪錐嘢喇，快啲修復`);
else ok(`index.html 引用嘅 ${new Set(localRefs).size} 個站內路徑全部存在`);

/* ── 7) sw.js：cache 版本號 + ASSETS 預載清單齊腳 ─────────────── */
const sw = read("sw.js");
const cacheV = sw.match(/const CACHE = 'scout-tools-v(\d+)'/);
if (!cacheV) bad("sw.js 搵唔到 `const CACHE = 'scout-tools-vN'` —— 版本號規範唔可以郁");
else ok(`sw.js cache = v${cacheV[1]}（改咗 core 檔案記得 +1）`);
const assets = sw.match(/const ASSETS = \[([^\]]*)\]/);
if (assets) {
  const list = assets[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  const miss = list.filter((u) => u !== "/" && !exists(u.replace(/^\//, "")));
  if (miss.length) bad(`sw.js ASSETS 預載咗唔存在嘅檔案：${miss.join("、")} —— install 會 fail，service worker 裝唔起`);
  else ok(`sw.js ASSETS ${list.length} 項全部存在`);
} else {
  bad("sw.js 搵唔到 ASSETS 清單");
}

/* ── 結算 ───────────────────────────────────────────────────── */
console.log("");
if (failed) {
  console.error(`lint 失敗：${failed} 項要修。規則解釋見 OPTIMIZATION.md`);
  process.exit(1);
}
console.log("✅ lint 通過：防增肥規則全部達標");
