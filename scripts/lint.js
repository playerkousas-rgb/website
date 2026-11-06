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

/* ── 1b) build script 用到嘅檔案唔可以被 .vercelignore 擋走 ────
   Vercel 會喺佢收到嘅檔案集上面行 `npm run build` → `npm run check`
   → `node test/*.js`。test/ 或者 scripts/ 一旦入咗 .vercelignore，
   Vercel build 就 MODULE_NOT_FOUND（2026-09 試過真爆）。
   呢度確保佢哋永遠唔會再被擋。 */
const viRaw = exists(".vercelignore") ? read(".vercelignore") : "";
const ignoredLines = viRaw.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
for (const must of ["test/", "scripts/"]) {
  const hit = ignoredLines.some((l) => l === must || l === must.replace(/\/$/, "") || l.startsWith(must));
  if (hit) bad(`.vercelignore 擋住咗「${must}」—— Vercel build 要用佢行 npm run build，一擋就 MODULE_NOT_FOUND`);
  else ok(`.vercelignore 無擋住「${must}」（build 閘門用得到）`);
}

/* ── 1c) vercel.json：部署設定要钉死，唔准 drift ───────────────
   Vercel 一見 package.json 有 build script 就自動跑 build 之後搵 public/
   目錄——本站係「根目錄直上」，冇 public/，會爆
   「No Output Directory named "public" found」（2026-09 試過真爆）。
   vercel.json 明確聲明 framework=null + outputDirectory="."，
   呢兩個值一改，部署就會爆或者開始亂上傳，所以喺度鎖死。 */
if (!exists("vercel.json")) {
  bad("vercel.json 唔見咗 —— Vercel 會自動偵測 build 然後搵 public/ 目錄，部署會爆（見 OPTIMIZATION.md 教訓 #2）");
} else {
  try {
    const vj = JSON.parse(read("vercel.json"));
    if (vj.framework === null) ok("vercel.json framework=null（唔靠自動偵測）");
    else bad("vercel.json framework 一定要係 null —— 畀 Vercel 自動偵測會揀錯 preset");
    if (vj.outputDirectory === ".") ok("vercel.json outputDirectory=.（根目錄直上）");
    else bad(`vercel.json outputDirectory 應該係 \".\"（而家係 ${JSON.stringify(vj.outputDirectory)}）`);
    if (vj.buildCommand === "npm run build") ok("vercel.json buildCommand=npm run build（Vercel 上都會過 lint+單測閘門）");
    else bad("vercel.json buildCommand 應該係 \"npm run build\"");
  } catch (e) { bad("vercel.json 解析唔到： " + e.message); }
}

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

/* ── 8) 圖標標準（readme docs/33 · G11）：9 個檔 ＋ head 5 link 4 meta ──
   為咗防「圖標冇換／換咗冇人知」再發生：任何一個檔缺失、尺寸錯、
   head 少一條 link／meta、manifest 少一個 maskable，build 都會 fail。 */
const ICON_SPEC = [
  ["icons/favicon.ico", 0, 0],           // 0 = ICO，唔讀 IHDR
  ["icons/favicon-16.png", 16, 16],
  ["icons/favicon-32.png", 32, 32],
  ["icons/apple-touch-icon.png", 180, 180],
  ["icons/icon-192.png", 192, 192],
  ["icons/icon-512.png", 512, 512],
  ["icons/icon-maskable-192.png", 192, 192],
  ["icons/icon-maskable-512.png", 512, 512],
  ["icons/og-image.png", 1200, 630]
];
const iconProblems = [];
let iconBytes = 0;
for (const [f, w, h] of ICON_SPEC) {
  if (!exists(f)) { iconProblems.push(`缺 ${f}`); continue; }
  const buf = fs.readFileSync(path.join(ROOT, f));
  iconBytes += buf.length;
  if (w) {
    if (buf.slice(1, 4).toString() !== "PNG") { iconProblems.push(`${f} 唔係 PNG`); continue; }
    const pw = buf.readUInt32BE(16), ph = buf.readUInt32BE(20);
    if (pw !== w || ph !== h) iconProblems.push(`${f} 尺寸 ${pw}×${ph}，應該 ${w}×${h}`);
  }
}
if (iconBytes > 260 * 1024) iconProblems.push(`9 個圖標合計 ${(iconBytes / 1024).toFixed(0)}KB > 260KB 預算（跑 scripts/make-icons.sh 減色）`);

// head：5 條 link（ico / 16 / 32 / apple-touch / manifest）
const needLinks = [
  ['rel="icon" href="/icons/favicon.ico"', "favicon.ico"],
  ['sizes="16x16"', "16×16 PNG"],
  ['sizes="32x32"', "32×32 PNG"],
  ['rel="apple-touch-icon"', "apple-touch-icon 180"],
  ['rel="manifest"', "manifest"]
];
for (const [needle, name] of needLinks) if (!html.includes(needle)) iconProblems.push(`index.html head 缺 ${name}`);
// head：4 條 og meta（og:image 必須絕對網址）
const ogImage = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
if (!ogImage) iconProblems.push("index.html 缺 og:image（貼連結冇預覽）");
else if (!/^https:\/\//.test(ogImage)) iconProblems.push("og:image 一定要絕對網址（https://…），相對路徑分享平台攞唔到");
for (const prop of ["og:image:width", "og:image:height"]) {
  if (!html.includes(`property="${prop}"`)) iconProblems.push(`index.html 缺 ${prop}`);
}
// manifest：4 個 icon（any 192/512 ＋ maskable 192/512）
try {
  const mf = JSON.parse(read("manifest.webmanifest"));
  const list = Array.isArray(mf.icons) ? mf.icons : [];
  const hasAny = (sz) => list.some((i) => i.sizes === sz && (i.purpose || "any") === "any");
  const hasMask = (sz) => list.some((i) => i.sizes === sz && (i.purpose || "").includes("maskable"));
  for (const sz of ["192x192", "512x512"]) {
    if (!hasAny(sz)) iconProblems.push(`manifest 缺 any ${sz}`);
    if (!hasMask(sz)) iconProblems.push(`manifest 缺 maskable ${sz}`);
  }
  if (mf.theme_color !== "#0b0d12" || mf.background_color !== "#0b0d12") {
    warn("manifest theme_color／background_color 同圖標主色（#0b0d12）唔一致");
  }
} catch (e) { iconProblems.push("manifest.webmanifest 解析唔到：" + e.message); }

// 版本號一致性：store.js 嘅 ICON_VER ＝ index.html 嘅 ?v= ＝ manifest 嘅 ?v=
// （三處唔同步 = 換圖標時一部分用戶見到新圖、一部分見到舊圖）
const verMatch = read("store.js").match(/let ICON_VER = "([^"]+)"/);
if (!verMatch) iconProblems.push("store.js 搵唔到 `let ICON_VER = \"...\"`");
else {
  const v = verMatch[1];
  const htmlVers = [...html.matchAll(/[?&]v=([0-9A-Za-z._-]+)/g)].map((m) => m[1]);
  const mfVers = [...read("manifest.webmanifest").matchAll(/[?&]v=([0-9A-Za-z._-]+)/g)].map((m) => m[1]);
  const bad1 = htmlVers.filter((x) => x !== v);
  const bad2 = mfVers.filter((x) => x !== v);
  if (!htmlVers.length) iconProblems.push("index.html 圖標 URL 冇 ?v= cache-busting");
  else if (bad1.length) iconProblems.push(`index.html 嘅 ?v=${[...new Set(bad1)].join(",")} 同 store.js ICON_VER(${v}) 唔一致`);
  if (!mfVers.length) iconProblems.push("manifest 圖標 URL 冇 ?v= cache-busting");
  else if (bad2.length) iconProblems.push(`manifest 嘅 ?v=${[...new Set(bad2)].join(",")} 同 store.js ICON_VER(${v}) 唔一致`);
}

if (iconProblems.length) iconProblems.forEach((p) => bad("圖標標準：" + p));
else ok(`圖標標準 9 個檔齊、尺寸正確、合計 ${(iconBytes / 1024).toFixed(0)}KB（預算 260KB）；head 5 link ＋ og meta、manifest 4 個 icon 齊`);

/* ── 結算 ───────────────────────────────────────────────────── */
console.log("");
if (failed) {
  console.error(`lint 失敗：${failed} 項要修。規則解釋見 OPTIMIZATION.md`);
  process.exit(1);
}
console.log("✅ lint 通過：防增肥規則全部達標");
