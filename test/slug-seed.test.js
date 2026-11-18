/* ════════════════════════════════════════════════════════════════
   test/slug-seed.test.js
   守住「slug 種子名單」嘅資料契約（docs/51 §1.1、docs/50 SG9／SG9-a）：

   1) 所有 migration 入面嘅 (host, slug) 配對：
      · slug 一定符合 DB CHECK：^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$（2–40 字）
      · 全 repo 唔可以出現同一個 slug 兩次（apps_slug_key unique index）
      · host 一定係細楷、冇 scheme／path／query（配對靠 host 完全相等）
   2) host 一定唔可以係 git branch 預覽／preview 網址（會令白名單認錯 origin）
   3) docs/51 §1.1 嗰 5 隻「冇 slug」嘅 App，一定要有 migration 覆蓋
   4) appSlug() 嘅 `slug || _id` fallback 唔准消失（缺 slug 時嘅保險）
   5) 分享出口唔准改返做子站直連（openApp()／sheet「開啟」以外冇 app.url）

   呢個測試係純靜態（唔上網、唔連 DB），所以 Vercel build 一定跑得過。
   ════════════════════════════════════════════════════════════════ */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const MIGRATIONS = fs.readdirSync(path.join(ROOT, "migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();

// DB 嘅 apps_slug_fmt CHECK
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;

// 由 SQL 抽出 ('host', 'slug') 配對（seed CTE 同本檔嘅 card 段都係呢個形狀）
function stripSqlComments(src) {
  // 只留真正會執行嘅 SQL：整行 `--` 註釋全部剪走（註釋入面有示範 values）
  return src.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
}
function pairsOf(file) {
  const src = stripSqlComments(read(path.join("migrations", file)));
  const out = [];
  for (const m of src.matchAll(/\(\s*'([^'\n]+)'\s*,\s*'([^'\n]+)'\s*\)/g)) {
    out.push({ file, host: m[1], slug: m[2] });
  }
  return out;
}

const all = MIGRATIONS.flatMap(pairsOf);
assert.ok(all.length >= 67, `slug 種子對照太少（而家只有 ${all.length} 條）—— seed 名單唔可以縮水`);

/* ── 1) 格式 ────────────────────────────────────────────────── */
for (const { file, host, slug } of all) {
  assert.match(slug, SLUG_RE, `${file}：slug「${slug}」唔符合 DB CHECK（要細楷 a-z／0-9／-，2–40 字）`);
  assert.equal(slug.toLowerCase(), slug, `${file}：slug「${slug}」有大細楷 —— QR／WhatsApp 會走樣`);
  assert.ok(!host.includes("://"), `${file}：host「${host}」唔可以帶 scheme（配對用 host 完全相等）`);
  assert.ok(!host.includes("/") && !host.includes("?"), `${file}：host「${host}」唔可以帶 path／query`);
  assert.equal(host.toLowerCase(), host, `${file}：host「${host}」要細楷`);
}

/* ── 2) 唯一：同一個 slug 唔可以指去兩個唔同 host（DB unique index） ──
   注意：同一對 (host, slug) 刻意可以出現兩次（seed 定咗，補漏檔再寫一次），
   呢個係 idempotent 重跑，唔算撞 index；撞 index 只會發生喺「同一 slug、兩個 host」。 */
const seen = new Map();
for (const { file, host, slug } of all) {
  if (!seen.has(slug)) { seen.set(slug, { host, file }); continue; }
  const prev = seen.get(slug);
  assert.equal(host, prev.host,
    `slug「${slug}」指去兩個唔同 host：「${prev.host}」（${prev.file}）同「${host}」（${file}）—— 會撞 apps_slug_key`);
}

/* ── 3) 唔准有 branch 預覽／preview 網址入種子 ─────────────── */
for (const { file, host } of all) {
  assert.ok(!/-git-/.test(host), `${file}：host「${host}」係 git branch 預覽網址 —— 每次 push 都變，唔可以入種子`);
  assert.ok(!/preview/.test(host), `${file}：host「${host}」係 preview 網址 —— 唔可以入種子`);
}

/* ── 4) docs/51 §1.1 嗰 5 隻一定要被覆蓋 ────────────────────── */
const bySlug = new Map(all.map((p) => [p.slug, p]));
const A_GROUP_MISSING = [
  ["scoutdesign", "scoutdesign.vercel.app"],
  ["skw-radar-hunt2", "skw-radar-hunt2.vercel.app"],
  ["skw-score", "skw-score.vercel.app"],
  ["veritas", "veritas-delta-seven.vercel.app"]
];
for (const [slug, host] of A_GROUP_MISSING) {
  const hit = bySlug.get(slug);
  assert.ok(hit, `docs/51 §1.1 嘅 slug「${slug}」冇任何 migration 覆蓋 —— 補返`);
  assert.equal(hit.host, host, `slug「${slug}」配錯 host：而家係「${hit.host}」，應該係「${host}」`);
}

/* card：production host 未確認，只准用 host 形狀配對（唔准寫死一個猜出嚟嘅網域） */
const aGroup = stripSqlComments(read(path.join("migrations", "20261118-app-slug-a-group-missing.sql")));
assert.ok(/set slug = 'card'/.test(aGroup), "card 段一定要真係 set slug = 'card'");
assert.ok(/host = 'card\.vercel\.app'/.test(aGroup), "card 段要包含 host = 'card.vercel.app'");
assert.ok(/host ~ '\^card-\[a-z0-9-\]\{1,60\}\\\.vercel\\\.app\$'/.test(aGroup),
  "card 段要保留 card-*.vercel.app 嘅 host 形狀配對（涵蓋 card-git-… 預覽）");
assert.ok(!/'[a-z0-9-]*card-[a-z0-9-]*\.vercel\.app'\s*,\s*'card'/.test(aGroup),
  "card 唔准寫死一個猜出嚟嘅 production host —— 未經核實嘅網域會令配對永遠 fill 唔到");

/* ── 5) appSlug() fallback 唔准消失 ────────────────────────── */
const appJs = read("app.js");
assert.match(appJs, /function appSlug\(app\)\s*\{[^}]*app\.slug \|\| app\._id/,
  "appSlug() 一定要保留 `app.slug || app._id` fallback（缺 slug 時嘅唯一保險）");

/* ── 6) 分享出口唔准派子站直連 ─────────────────────────────── */
assert.ok(!/writeText\(_currentShareApp\.url\)/.test(appJs), "複製分享唔可以派子站網址");
assert.ok(/share-modal-url[\s\S]{0,120}appDeepLink\(app\)/.test(appJs), "分享面板網址一定要用 appDeepLink(app)");

console.log("✅ slug-seed: 67+ 條種子全部符合 DB CHECK、無重複、無 -git-／preview 網址；"
  + "docs/51 §1.1 五隻（card／scoutdesign／skw-radar-hunt2／skw-score／veritas）全部有覆蓋；"
  + "appSlug() fallback 與分享出口未動");
