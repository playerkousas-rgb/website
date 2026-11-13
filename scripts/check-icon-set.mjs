#!/usr/bin/env node
/**
 * check-icon-set.mjs —— APP 上架前圖標自我檢查
 *
 * 用法（喺 APP repo 根目錄跑）：
 *   node check-icon-set.mjs                        # 自動搵 icons/ 或 public/icons/
 *   node check-icon-set.mjs path/to/icons          # 指定資料夾
 *   node check-icon-set.mjs --html                # 連 index.html 嘅 <link> 一齊查
 *
 * 檢查項目對應 ICON-STANDARD.md §2 / §3 / §4：
 *   ① 9 個必要檔齊唔齊、尺寸對唔對
 *   ② <head> 有冇 4 條 link，有冇寫 type / sizes
 *   ③ manifest 有冇 4 個 icon，any / maskable 有冇分開
 *   ④ 檔案大小（≤260KB 合計、512 唔可以太細）
 *   ⑤ maskable 主體有冇越出中央 66%
 *
 * 零依賴，只用 node 內建模組。可以直接抄去任何 repo。
 */

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { inflateSync } from "node:zlib";

/* ───────── PNG 尺寸／色彩資訊（讀 IHDR，唔解碼整張圖） ───────── */
function pngInfo(buf) {
  if (buf.length < 24 || buf[0] !== 0x89 || buf.toString("ascii", 1, 4) !== "PNG") return null;
  return {
    w: buf.readUInt32BE(16),
    h: buf.readUInt32BE(20),
    depth: buf[24 - 8 + 8] ?? buf[24],
    colorType: buf[25],
  };
}

/* ───────── 必需檔案（對應 docs/33 §2） ───────── */
const REQUIRED = [
  { names: ["favicon.ico"], size: null, label: "favicon.ico", note: "16+32+48 三合一" },
  { names: ["favicon-16.png"], size: 16, label: "favicon-16", note: "手繪，唔可以縮" },
  { names: ["favicon-32.png"], size: 32, label: "favicon-32" },
  { names: ["apple-touch-icon.png"], size: 180, label: "apple-touch-icon" },
  { names: ["icon-192.png"], size: 192, label: "icon-192" },
  { names: ["icon-512.png"], size: 512, label: "icon-512" },
  { names: ["icon-maskable-192.png"], size: 192, label: "maskable-192" },
  { names: ["icon-maskable-512.png"], size: 512, label: "maskable-512" },
  { names: ["og-image.png"], size: [1200, 630], label: "og-image" },
];

/* 容許 -v2 / -v3 之類後綴 */
function findFile(dir, base) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir);
  const stem = base.replace(/\.(png|ico)$/i, "");
  const ext = base.match(/\.(png|ico)$/i)?.[0] || "";
  const exact = files.find((f) => f === base);
  if (exact) return join(dir, exact);
  const versioned = files.find((f) => new RegExp(`^${stem}-v\\d+\\${ext}$`, "i").test(f));
  return versioned ? join(dir, versioned) : null;
}

/* ───────── 讀 PNG 主體有冇越出中央 66%（用粗略像素掃描） ───────── */
function maskableSafe(file) {
  let buf;
  try { buf = readFileSync(file); } catch { return null; }
  const info = pngInfo(buf);
  if (!info) return null;
  if (![0, 2, 3, 4, 6].includes(info.colorType)) return { skipped: "未知 colorType" };

  // 解碼（只處理 8-bit 非交錯，夠用）
  const chunks = [];
  let pos = 8, interlace = 0;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    if (type === "IHDR") interlace = buf[pos + 8 + 12];
    if (type === "IDAT") chunks.push(buf.subarray(pos + 8, pos + 8 + len));
    if (type === "IEND") break;
    pos += 12 + len;
  }
  if (interlace) return { skipped: "interlaced PNG" };
  if (info.depth !== 8 && info.colorType !== 3) return { skipped: `${info.depth}-bit（只查 8-bit）` };

  let raw, palette = null;
  {
    let p2 = 8;
    while (p2 < buf.length) {
      const len = buf.readUInt32BE(p2);
      const type = buf.toString("ascii", p2 + 4, p2 + 8);
      if (type === "PLTE") palette = buf.subarray(p2 + 8, p2 + 8 + len);
      if (type === "IEND") break;
      p2 += 12 + len;
    }
  }
  try { raw = inflateSync(Buffer.concat(chunks)); } catch { return null; }
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[info.colorType] || 3;
  const stride = info.w * ch;
  const out = Buffer.alloc(info.h * stride);
  let rp = 0;
  for (let y = 0; y < info.h; y++) {
    const ft = raw[rp++];
    const line = raw.subarray(rp, rp + stride); rp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (ft === 1) v = (v + a) & 255;
      else if (ft === 2) v = (v + b) & 255;
      else if (ft === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (ft === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      cur[x] = v;
    }
  }

  // 底色 = 四角平均
  const px = (x, y) => {
    const o = y * stride + x * ch;
    if (info.colorType === 3 && palette) {
      const i = out[o] * 3;
      return [palette[i], palette[i + 1], palette[i + 2]];
    }
    if (ch <= 2) return [out[o], out[o], out[o]];
    return [out[o], out[o + 1], out[o + 2]];
  };
  const corners = [px(0, 0), px(info.w - 1, 0), px(0, info.h - 1), px(info.w - 1, info.h - 1)];
  const bg = [0, 1, 2].map((i) => corners.reduce((s, c) => s + c[i], 0) / 4);

  /* maskable 規格（W3C / Google）：
     安全區 = 中央直徑 66% 嘅圓（半徑 33%）。
     **背景色可以延伸到邊緣**（Android 會自己裁成圓角／水滴形），
     只有「主角」唔可以伸出安全圓之外。

     判準：對每個圓外像素，量佢同底色嘅距離。
     背景延伸（同底色一樣或漸變）→ 距離細 → 安全
     主角伸出（同底色差好遠）→ 距離大 → 唔安全

     ⚠️ 唔可以數「色桶數目」：圓角邊框係第二個色，但佢係裝飾，
        唔係主角，一樣可以伸出邊緣。
     */
  const cx = info.w / 2, cy = info.h / 2;
  const safeR = Math.min(info.w, info.h) * 0.33;

  /* 底色幅度：量「圓角方 icon 嘅底色帶」有幾多變化。
     重點係唔可以用「圓內最光嘅像素」做基準 —— 好多 icon 圓內已經有主角。
     做法：取圓內半徑 0.55–0.75 嘅環帶（通常仍然係底色），
     量佢最暗（＝真底色）同最亮之間嘅差。漸層底會大，平塗底會細。 */
  const dist = (c) => Math.max(...[0, 1, 2].map((i) => Math.abs(c[i] - bg[i])));
  const band = [];
  for (let y = 0; y < info.h; y += 4) for (let x = 0; x < info.w; x += 4) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > safeR * 0.55 && d < safeR * 0.78) band.push(dist(px(x, y)));
  }
  band.sort((a, b) => a - b);
  const bgSpread = band.length ? band[Math.floor(band.length * 0.9)] - band[Math.floor(band.length * 0.1)] : 0;

  /* 主角門檻 = 底色帶幅度 + 明確差距，最少 45。
     （舊版用 max 60 太寬鬆：本站金色細線同黑底差 200+ 都會漏網，
       但因為細線像素太少而佔比低，結果照樣過關 → 改為同時要求「佔比」。）*/
  const subjectMin = Math.max(45, bgSpread + 30);

  let outsideN = 0, subjectOut = 0;
  const hist = [];
  for (let y = 0; y < info.h; y += 2) {
    for (let x = 0; x < info.w; x += 2) {
      if (Math.hypot(x - cx, y - cy) <= safeR) continue;
      outsideN++;
      const d = dist(px(x, y));
      if (d >= subjectMin) { subjectOut++; hist.push(d); }
    }
  }
  if (!outsideN) return { ok: true, note: "安全圓以外冇像素" };

  /* 容許值：圓外「明顯唔同底色」嘅像素 ≤ 8%。
     真正伸出安全圓嘅主角，通常會佔幾個百分比以上。 */
  const outPct = Math.round((subjectOut / outsideN) * 100);
  // 絕對像素：圓外主體像素超過 400 個（取樣 1/4 → 實際 1600）都算問題
  const tooMany = subjectOut > 400;
  return {
    safeR: Math.round(safeR),
    outPct,
    subjectMin: Math.round(subjectMin),
    bgSpread: Math.round(bgSpread),
    ok: outPct <= 4 && !tooMany,
    note: outPct <= 4 && !tooMany
      ? `安全圓外只有 ${outPct}% 明顯主體像素（${subjectOut} 點）—— 主角喺安全區內`
      : `安全圓外有 ${outPct}% 主體像素（${subjectOut} 點）—— 主角伸出，Android 裁圓時會切到`,
  };
}

/* ───────── head / manifest 檢查 ───────── */
function checkHead(root) {
  const candidates = ["index.html", "web/index.html", "public/index.html", "src/index.html"];
  const file = candidates.map((f) => join(root, f)).find((f) => existsSync(f));
  if (!file) return { found: false };

  const html = readFileSync(file, "utf8");
  const head = html.slice(0, html.indexOf("</head>") > 0 ? html.indexOf("</head>") : 8000);
  const links = (head.match(/<link\b[^>]*>/gi) || [])
    .filter((t) => /rel\s*=\s*["'][^"']*icon/i.test(t));

  const issues = [];
  const has = (re) => links.some((t) => re.test(t));
  if (!has(/sizes\s*=\s*["']16x16/i)) issues.push("缺 16x16 link");
  if (!has(/sizes\s*=\s*["']32x32/i)) issues.push("缺 32x32 link");
  if (!has(/sizes\s*=\s*["']180x180/i) && !has(/apple-touch-icon/i)) issues.push("缺 apple-touch-icon link");
  if (has(/apple-touch-icon/i) && !has(/apple-touch-icon[^>]*sizes/i))
    issues.push("apple-touch-icon 冇寫 sizes（網站要猜，建議寫明 180x180）");
  // 只有 .png 需要 type；.ico 唔寫係正常（瀏覽器一定識）
  const pngNoType = links.filter((t) => /href\s*=\s*["'][^"']*\.png/i.test(t) && !/type\s*=/i.test(t));
  if (pngNoType.length) issues.push(`${pngNoType.length} 條 PNG link 冇寫 type`);

  // 最細嘅 link（會唔會被網站當成主要來源）
  const sizes = links.map((t) => {
    const m = t.match(/sizes\s*=\s*["'](\d+)x(\d+)/);
    return m ? Math.max(+m[1], +m[2]) : null;
  }).filter(Boolean);
  const largest = sizes.length ? Math.max(...sizes) : null;

  return { found: true, file, count: links.length, issues, largest };
}

function checkManifest(root) {
  const candidates = [
    "manifest.webmanifest", "site.webmanifest", "manifest.json",
    "web/public/manifest.webmanifest", "public/manifest.webmanifest",
    "web/public/manifest.json", "public/manifest.json",
  ];
  const file = candidates.map((f) => join(root, f)).find((f) => existsSync(f));
  if (!file) return { found: false };

  let data;
  try { data = JSON.parse(readFileSync(file, "utf8")); } catch { return { found: true, file, error: "JSON 解析失敗" }; }
  const icons = Array.isArray(data.icons) ? data.icons : [];
  const any = icons.filter((i) => (i.purpose || "any").includes("any"));
  const mask = icons.filter((i) => (i.purpose || "").includes("maskable"));

  const issues = [];
  if (!any.some((i) => /192/.test(String(i.sizes)))) issues.push("any 缺 192");
  if (!any.some((i) => /512/.test(String(i.sizes)))) issues.push("any 缺 512");
  if (!mask.length) issues.push("缺 maskable（Android 主畫面會自己加白邊）");
  else {
    if (!mask.some((i) => /192/.test(String(i.sizes)))) issues.push("maskable 缺 192");
    if (!mask.some((i) => /512/.test(String(i.sizes)))) issues.push("maskable 缺 512");
  }
  const sameSrcMaskable = any.some((a) => mask.some((m) => m.src === a.src));
  if (sameSrcMaskable) issues.push("any 同 maskable 用同一個檔（主體會俾 Android 裁走）");

  return { found: true, file, icons: icons.length, issues };
}

/* ───────── CLI ───────── */
const args = process.argv.slice(2);
const doHtml = args.includes("--html");
const target = args.find((a) => !a.startsWith("--"));

const root = resolve(target && !target.endsWith(".html") ? target : ".");
const iconDirs = ["icons", "public/icons", "web/public/icons", "static/icons", "src/icons"]
  .map((d) => join(root, d))
  .filter((d) => existsSync(d) && statSync(d).isDirectory());
const iconDir = target && existsSync(join(root, "..")) && existsSync(join(root, "icon-192.png"))
  ? root
  : iconDirs[0];

let failures = 0;
const fail = (msg) => { failures++; console.log(`  ✗ ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ⚠ ${msg}`);

console.log("\n  APP 圖標檢查（對照 ICON-STANDARD.md）\n");
console.log(`  目標：${iconDir || root}\n`);

if (!iconDir) {
  fail("搵唔到 icons 資料夾（試過 icons/、public/icons/、web/public/icons/）");
  process.exit(1);
}

// ① 9 個必要檔
console.log("  ── ① 必要檔案 ─────────────────────────────");
let totalKB = 0;
for (const req of REQUIRED) {
  const found = req.names.map((n) => findFile(iconDir, n)).find(Boolean);
  if (!found) {
    fail(`缺 ${req.label}${req.note ? `（${req.note}）` : ""}`);
    continue;
  }
  const size = statSync(found).size;
  totalKB += size / 1024;
  const info = req.size && found.endsWith(".png") ? pngInfo(readFileSync(found)) : null;
  if (info && req.size) {
    if (Array.isArray(req.size)) {
      if (info.w !== req.size[0] || info.h !== req.size[1])
        fail(`${req.label} 尺寸 ${info.w}×${info.h}，應為 ${req.size[0]}×${req.size[1]}`);
      else ok(`${req.label} ${info.w}×${info.h}（${(size / 1024).toFixed(1)}KB）`);
    } else if (info.w !== req.size || info.h !== req.size) {
      fail(`${req.label} 尺寸 ${info.w}×${info.h}，應為 ${req.size}×${req.size}`);
    } else if (req.label === "icon-512" && size < 40 * 1024) {
      warn(`${req.label} 只有 ${(size / 1024).toFixed(1)}KB —— 咁細通常代表過度壓縮或內容太少`);
    } else {
      ok(`${req.label} ${info.w}×${info.h}（${(size / 1024).toFixed(1)}KB）`);
    }
  } else if (found.endsWith(".ico")) {
    ok(`${req.label}（${(size / 1024).toFixed(1)}KB）`);
  } else {
    ok(`${req.label}`);
  }
}
if (totalKB > 260) fail(`9 個檔合計 ${totalKB.toFixed(0)}KB，超過 260KB 預算`);
else if (totalKB > 0) ok(`合計 ${totalKB.toFixed(0)}KB（預算 260KB）`);

// ② maskable 安全區
console.log("\n  ── ② maskable 安全區（中央 66%） ──────────");
const m512 = findFile(iconDir, "icon-maskable-512.png");
if (m512) {
  const r = maskableSafe(m512);
  if (r && r.skipped) warn(`略過：${r.skipped}`);
  else if (r) {
    if (r.ok) ok(r.note);
    else fail(`${r.note}（安全半徑 ${r.safeR}px）`);
  }
} else warn("冇 maskable-512，跳過");

// ③ head
if (doHtml || args.length === 0) {
  console.log("\n  ── ③ <head> icon link ─────────────────────");
  const h = checkHead(root);
  if (!h.found) warn("搵唔到 index.html，略過");
  else if (!h.count) fail("head 完全冇 icon link");
  else {
    ok(`搵到 ${h.count} 條 icon link（最大 ${h.largest}px）`);
    for (const i of h.issues) fail(i);
    if (h.largest && h.largest < 180)
      fail(`最大只有 ${h.largest}px —— 網站要放大至 68px 會化開（最少要有 180px）`);
  }

  console.log("\n  ── ④ manifest ─────────────────────────────");
  const m = checkManifest(root);
  if (!m.found) warn("搵唔到 manifest，略過");
  else if (m.error) fail(`manifest ${m.error}`);
  else {
    ok(`manifest 有 ${m.icons} 個 icon`);
    for (const i of m.issues) fail(i);
  }
}

// 總結
console.log("\n  " + "─".repeat(50));
if (!failures) {
  console.log("  ✅ 全部通過，可以上架\n");
  process.exit(0);
}
console.log(`  ✗ ${failures} 項要處理 —— 見 ICON-STANDARD.md\n`);
console.log("  最常見修法：");
console.log("   · 補一張 180×180 apple-touch-icon.png");
console.log("   · 唔好只用 32/48px 做唯一 PNG，最少要有 180 或 192");
console.log("   · maskable 主體縮到 66% 再置中\n");
process.exit(1);
