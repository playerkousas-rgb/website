// Scout Admin 通知（多送一份）單測：欄位對齊／清洗／API 行為／前後端唔好甩街
// 運行：node test/notify-admin.test.js
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const apiSrc = read("api/notify-admin.js");
const handler = require("../api/notify-admin");
const originalFetch = global.fetch;

/* ── 0) 語法：所有瀏覽器脚本＋index.html 內聯脚本都唔可以爛 ───── */
for (const file of ["app.js", "admin.js", "store.js", "market.js", "sw.js"]) new vm.Script(read(file), { filename: file });
new vm.Script(apiSrc, { filename: "api/notify-admin.js" });
const html = read("index.html");
for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
console.log("✓ 語法：瀏覽器腳本＋api/notify-admin.js＋index.html 內聯腳本全部可 parse");

/* ── 1) 瀏覽器側：store.js 純函數（欄位對齊＋清洗）─────────────── */
const base = {
  window: {},
  document: { documentElement: { dataset: {} }, getElementById: () => ({ addEventListener() {}, reset() {}, elements: {}, querySelector: () => null }), querySelectorAll: () => [] },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  console,
  location: { origin: "https://scoutappstore.vercel.app" },
  navigator: { onLine: true },
  AbortSignal: { timeout: () => ({}) },
  fetch: async () => ({ ok: true, status: 200, json: async () => ({ sent: true }) })
};
base.globalThis = base;
vm.createContext(base);
vm.runInContext(read("store.js"), base);
vm.runInContext(read("market.js"), base);
vm.runInContext(`this.__api = { scoutAdminSubmissionPayload, scoutAdminText, scoutAdminEmail, scoutAdminPhone,
  scoutAdminRecordLines, scoutAdminForwardMailto, scoutAdminReplyMailto, notifyScoutAdmin, scoutAdminNotifyNote,
  reviewCardHTML, SCOUT_ADMIN_CONFIG };`, base);
const api = base.__api;

const record = {
  id: "11111111-2222-3333-4444-555555555555",
  name: "露營裝備清單",
  url: "https://example.org/gear",
  author: "陳大文",
  page: "apps",
  category: "小工具",
  description: "第一行\n第二行：$ 秘密欄位\u0007 控制字符",
  tags: ["童軍", "露營", "童軍"],
  contact: " Bob@Example.COM ",
  phone: "9123 4567 / call me"
};
const payload = api.scoutAdminSubmissionPayload(record);
assert.strictEqual(payload.type, "appstore", "type 一定要係 appstore（Apps Script doPost 分流）");
assert.strictEqual(payload.sourceApp, "SCOUT APP STORE", "帶明邊個送嚟");
assert.strictEqual(payload.name, "露營裝備清單");
assert.strictEqual(payload.url, "https://example.org/gear");
assert.strictEqual(payload.description, "第一行 第二行：$ 秘密欄位 控制字符", "換行／控制字符要壓做單行（免得偽造電郵欄位）");
assert.strictEqual(payload.tags, "童軍、露營", "標籤去重＋join「、」（Sheet 睇落整齊）");
assert.strictEqual(payload["商店編號"], record.id, "商店編號 = Supabase 投稿 id，兩邊對數用");
assert.strictEqual(payload["聯絡電郵"], "Bob@Example.COM", "電郵留低但削走兩邊空格");
assert.strictEqual(payload["聯絡電話"], "9123 4567", "電話只留數字與 + - ( ) 空格 逗號");
assert.strictEqual(payload["審核頁"], "https://scoutappstore.vercel.app/#admin", "審核頁用而家嘅 origin");
assert.strictEqual(payload["轉寄給"], "playerkousas@hotmail.com", "通知信寫明登記後轉寄邊個");
assert.ok(!/[\r\n\u0000-\u001f]/.test(JSON.stringify(payload)), "payload 入面唔應該再有控制字符");

const empty = api.scoutAdminSubmissionPayload({ name: "x", url: "https://x.io", author: "a", description: "d" });
assert.ok(!("聯絡電郵" in empty) && !("聯絡電話" in empty) && !("tags" in empty), "冇填／空值嘅欄位唔好送（免得多啲空列）");
assert.strictEqual(api.scoutAdminEmail("not-an-email"), "");
assert.strictEqual(api.scoutAdminEmail("a@b\nc.com"), "");
assert.strictEqual(api.scoutAdminPhone("abc"), "");
assert.strictEqual(api.scoutAdminText("甲".repeat(200), 80).length, 80, "超長要截住");
assert.ok(api.scoutAdminText("甲".repeat(200), 80).endsWith("…"), "截完有省略號提示");

const lines = api.scoutAdminRecordLines({ ...record, created_at: "2026-09-25T02:00:00.000Z", status: "pending" });
assert.ok(lines.some(l => l.startsWith("作品名稱：")), "逐欄列出畀電郵內文");
assert.ok(lines.some(l => l.startsWith("投稿編號：")), "編號要喺信入面");
assert.ok(!lines.some(l => l.endsWith("：")), "空欄唔應該出現");
const mailto = api.scoutAdminForwardMailto(record);
assert.ok(mailto.startsWith("mailto:playerkousas@hotmail.com?subject="), "轉寄掣＝預填 mailto");
assert.ok(decodeURIComponent(mailto).includes("露營裝備清單"), "內文帶齊資料");
assert.ok(decodeURIComponent(mailto).includes("SCOUT APP STORE 自動產生"), "內文講明邊度嚟");
assert.ok(api.scoutAdminReplyMailto(record).startsWith("mailto:Bob@Example.COM"), "有聯絡電郵先畀到「回覆作者」");
assert.strictEqual(api.scoutAdminReplyMailto({ name: "x", contact: "" }), "", "冇電郵就唔出呢粒掣");
console.log("✓ store.js：欄位對齊 FIELD_MAP、單行化清洗、mailto 轉寄／回覆內容");

/* ── 2) 前後端欄位白名單唔好甩街 ──────────────────────────────── */
const allowed = new Set(["type", "sourceApp", ...[...apiSrc.matchAll(/\{ key: "([^"]+)"/g)].map(m => m[1])]);
assert.ok(allowed.has("轉寄給") && allowed.has("聯絡電郵") && allowed.has("商店編號"), "API 白名單要收齊新欄位");
for (const key of Object.keys(payload)) assert.ok(allowed.has(key), `前端送出嘅欄位「${key}」唔喺 API 白名單 → 會被抹走`);
console.log(`✓ API 白名單涵蓋前端全部 ${Object.keys(payload).length} 個欄位`);

/* ── 3) 審核卡：轉寄／回覆掣＋聯絡顯示 ───────────────────────── */
const card = vm.runInContext(`reviewCardHTML(${JSON.stringify({ ...record, created_at: "2026-09-25T02:00:00.000Z", tags: ["童軍"] })})`, base);
assert.ok(card.includes("📧 轉寄負責人") && card.includes("✉️ 回覆作者"), "待審核卡有得轉寄／回覆");
assert.ok(card.includes("mailto:Bob@Example.COM"), "聯絡電郵顯示到（並可直接回覆）");
assert.ok(card.includes("data-review="), "批准／拒絕掣唔見咗");
assert.ok(/&amp;/.test(card), "mailto 入面嘅 & 一定要 escape 做 &amp;");
assert.ok(!card.includes("<script>"), "用家資料唔可以變成 HTML 標籤");
console.log("✓ market.js：審核卡顯示聯絡方式＋一撳轉寄／回覆");

/* ── 4) notifyScoutAdmin：经 API 有回執；冇 API 時退回直送 ────── */
(async () => {
  // (a) 經 /api/notify-admin 成功 → 講明已送達
  const calls = [];
  base.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 200, json: async () => ({ ok: true, sent: true, message: "已登記" }) };
  };
  assert.deepEqual(await api.notifyScoutAdmin(record), { sent: true, verified: true, deduped: false, warnings: [] });
  assert.match(api.scoutAdminNotifyNote({ sent: true, verified: true, deduped: false }), /已登記喺 Scout Admin/, "送達就報喜（講明有電郵通知）");
  assert.strictEqual(calls[0].url, "/api/notify-admin", "先打自己嘅 serverless（讀到 Apps Script 真結果）");
  assert.strictEqual(calls.length, 1, "成功就唔使再直送");
  const sentBody = JSON.parse(calls[0].opts.body);
  assert.strictEqual(sentBody.type, "appstore");
  assert.strictEqual(sentBody["聯絡電郵"], "Bob@Example.COM");
  assert.strictEqual(calls[0].opts.headers["Content-Type"], "application/json", "經自己嘅 server 就唔使理 CORS");
  assert.ok(calls[0].opts.signal, "要有 timeout，唔好令用家等到天荒地老");

  // (a2) 去重要講得老實：唔好當「先至啱送」
  base.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, sent: true, deduped: true }) });
  const dup = await api.notifyScoutAdmin(record);
  assert.equal(dup.deduped, true);
  assert.match(api.scoutAdminNotifyNote(dup), /唔會重送/, "5 分鐘內重撳＝話返已送過，唔好扮再寄一次");

  // (b) 假成功要拆穿：sent:false → 老實講
  base.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: false, sent: false, error: "登記端連線唔到" }) });
  const failed = await api.notifyScoutAdmin(record);
  assert.strictEqual(failed.sent, false, "sent:false 唔可以當成功");
  assert.match(failed.error, /連線唔到/);
  assert.match(api.scoutAdminNotifyNote(failed), /已喺資料庫/, "送唔到都要講明投稿已入庫、唔使人手重交");

  // (c) 冇 serverless（404）→ no-cors 直送，老實講「未確認」
  const direct = [];
  base.fetch = async (url, opts) => {
    direct.push({ url, opts });
    if (url === "/api/notify-admin") return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true };
  };
  const fallback = await api.notifyScoutAdmin(record);
  assert.deepStrictEqual({ sent: fallback.sent, verified: fallback.verified }, { sent: true, verified: false }, "直送讀唔到回應，只能話未確認");
  assert.strictEqual(direct[1].url, api.SCOUT_ADMIN_CONFIG.execUrl, "退回係直送 Apps Script");
  assert.strictEqual(direct[1].opts.mode, "no-cors", "Apps Script 冇回 CORS 標頭，要用 no-cors");
  assert.ok(!("headers" in direct[1].opts), "no-cors 唔好設 Content-Type（唔係 safelisted，會被靜靜抹走／觸發 preflight）");
  assert.match(api.scoutAdminNotifyNote(fallback), /已送交 Scout Admin/, "文案：未確認就話未確認");

  // (d) 完全冇配接收端 → 唔扮成功
  const savedUrl = api.SCOUT_ADMIN_CONFIG.execUrl;
  api.SCOUT_ADMIN_CONFIG.execUrl = "";
  base.fetch = async () => { throw new TypeError("network down"); };
  const off = await api.notifyScoutAdmin(record);
  assert.strictEqual(off.sent, false, "未設定接收端唔可以報成功");
  assert.match(api.scoutAdminNotifyNote(off), /通知未送達/);
  api.SCOUT_ADMIN_CONFIG.execUrl = savedUrl;
  console.log("✓ market.js：DB 寫入照舊、通知經 API（有回執）／後備 no-cors（講明未確認）");

  /* ── 5) api/notify-admin.js（serverless）行為 ──────────────────── */
  process.env.SCOUT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/TEST/exec";
  delete process.env.ADMIN_FORWARD_EMAIL;
  delete process.env.STORE_REVIEW_URL;
  delete process.env.STORE_NOTIFY_DISABLED;
  const request = async (body, bucket = "shared", extra = {}) => {
    if (body && typeof body === "object" && !("商店編號" in body)) body = { ...body, "商店編號": "id-" + (++seq) };
    const res = { headers: {}, status(code) { this.code = code; return this; }, setHeader(k, v) { this.headers[k] = v; return this; }, send(b) { this.body = JSON.parse(b); } };
    await handler({
      method: extra.method || "POST",
      headers: { host: "store.example", origin: "https://store.example", "x-forwarded-for": "ip-" + bucket, ...(extra.headers || {}) },
      socket: { remoteAddress: "1.2.3.4" },
      body
    }, res);
    return res;
  };
  const good = { ...payload };
  delete good["商店編號"]; // 每單自帶唯一編號（見 request()），免得撞咗去重測試
  let seq = 0;
  // 記錄「實際送咗啲乜去 Apps Script」嘅 mock（要重複用，因為有些測試會換走 global.fetch）
  const recordSuccess = () => { global.fetch = async (url, opts) => { forwarded = { url, body: JSON.parse(opts.body), headers: opts.headers }; return { ok: true, status: 200, text: async () => JSON.stringify({ status: "success", message: "作品已提交審核，多謝！" }) }; }; };
  const recordFail = () => { global.fetch = async (url, opts) => { forwarded = { url, body: JSON.parse(opts.body), headers: opts.headers }; return { ok: false, status: 500, text: async () => "" }; }; };
  let forwarded = null;
  recordSuccess();
  assert.equal((await request(good, "method", { method: "GET" })).code, 405, "只接受 POST");
  assert.equal((await request(good, "origin", { headers: { origin: "https://evil.example" } })).code, 403, "來源不符要擋（唔畀第三站用我哋嘅 endpoint 寄信）");

  const ok = await request(good, "ok");
  assert.equal(ok.code, 200);
  assert.equal(ok.body.sent, true, "Apps Script 收咗就話送達");
  assert.equal(forwarded.url, process.env.SCOUT_APPS_SCRIPT_URL, "用環境變數覆寫接收端");
  assert.equal(forwarded.headers["Content-Type"], "application/json; charset=utf-8", "server 端先可以用 JSON 標頭（冇 CORS 限制）");
  assert.equal(forwarded.body.type, "appstore", "type 由伺服器釘死");
  assert.equal(forwarded.body["轉寄給"], "playerkousas@hotmail.com", "轉寄對象由 env／預設話事");
  assert.match(forwarded.body["審核頁"], /^https:\/\/store\.example\/#admin$/, "審核連結用請求 origin，唔信客端傳嘅值（防 phishing 連結）");
  assert.ok(!("evil" in forwarded.body) && !("apikey" in forwarded.body), "白名單以外嘅鍵唔會送到人張 Sheet");

  // 客端扮嘢（改 type／加欄／灌長嘢／換行注入）全部食唔到
  const js = await request({ ...good, url: "javascript:alert(1)" }, "js");
  assert.equal(js.code, 400, "javascript: / data: 連結一律拒（唔好入得 Sheet 變超連結）");
  const tampered = await request({ ...good, type: "apply", apikey: "stolen", evil: "新欄位", name: "乙".repeat(3000), 聯絡電郵: "a@b.c\n偽造欄位：全部批准", 聯絡電話: "9123<script>4567" }, "tamper");
  assert.equal(tampered.code, 200, "超長／格式問題要清洗之後照送，唔好窒住人");
  assert.equal(forwarded.body.name.length, 80, "name 截返 80");
  assert.equal(forwarded.body.type, "appstore", "客端改唔到 type");
  assert.ok(!("apikey" in forwarded.body) && !("evil" in forwarded.body), "客端加唔到欄");
  assert.ok(!/偽造欄位/.test(JSON.stringify(forwarded.body)), "換行注入嘅假欄位會被整條抹走");
  assert.ok(!/[\r\n]/.test(JSON.stringify(forwarded.body)), "送出去嘅嘢唔可以有換行");

  // 缺必需欄位 → 400，唔會盲寄；冇 body／亂 body／超長 body 都唔好炸
  global.fetch = async () => { throw new Error("唔應該打出去"); };
  assert.equal((await request({ name: "只有名" }, "missing")).code, 400, "資料不完整要 400");
  assert.equal((await request("not json", "badjson")).code, 400, "唔係 JSON 就 400");
  assert.equal((await request("=".repeat(20 * 1024), "big")).code, 413, "超長 body 擋住");

  // Apps Script 鬧人 → 200 + sent:false（投稿已入庫，唔值得整死個表單）
  global.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: "error", message: "沒有收到任何資料" }) });
  const reject = await request(good, "reject");
  assert.equal(reject.code, 200, "登記端鬧人唔該 200，交返畀前端講");
  assert.equal(reject.body.sent, false);
  global.fetch = async () => ({ ok: false, status: 500, text: async () => "oops" });
  assert.equal((await request(good, "http500")).body.sent, false, "Apps Script 5xx → sent:false");
  global.fetch = async () => ({ ok: true, status: 200, text: async () => "HTML 唔係 JSON" });
  assert.equal((await request(good, "nojson")).body.sent, false, "回應讀唔到就係未確認");

  // 同一個編號重送會被去重（唔使再打 Apps Script）
  let hits = 0;
  const recordHits = () => { global.fetch = async (url, opts) => { hits++; forwarded = { url, body: JSON.parse(opts.body), headers: opts.headers }; return { ok: true, status: 200, text: async () => JSON.stringify({ status: "success" }) }; }; };
  recordHits();
  const first = await request({ ...good, 商店編號: "dedupe-me" }, "dedupe");
  const again = await request({ ...good, 商店編號: "dedupe-me" }, "dedupe");
  assert.equal(first.body.sent, true);
  assert.equal(again.body.deduped, true, "5 分鐘內同一個編號唔好送兩次");
  assert.equal(hits, 1, "去重係真係冇再打出去");

  // 限流：失敗計次，成功唔計
  recordFail();
  for (let i = 0; i < 8; i++) assert.equal((await request(good, "flood")).code, 200, "未爆配額前照試");
  assert.equal((await request(good, "flood")).code, 429, "15 分鐘 8 次就擋");

  // env 覆寫轉寄對象／停用開關
  process.env.ADMIN_FORWARD_EMAIL = "leader@example.hk";
  process.env.STORE_REVIEW_URL = "https://store.example/#admin";
  recordSuccess();
  await request(good, "env");
  assert.equal(forwarded.body["轉寄給"], "leader@example.hk", "ADMIN_FORWARD_EMAIL 覆寫到");
  assert.equal(forwarded.body["審核頁"], "https://store.example/#admin", "STORE_REVIEW_URL 覆寫到");
  delete process.env.ADMIN_FORWARD_EMAIL;
  delete process.env.STORE_REVIEW_URL;
  process.env.STORE_NOTIFY_DISABLED = "1";
  const disabled = await request(good, "disabled");
  assert.equal(disabled.body.skipped, true, "通知未啟用要講明 skipped，唔好報成功");
  delete process.env.STORE_NOTIFY_DISABLED;
  console.log("✓ api/notify-admin.js：來源檢查、白名單、清洗、去重、限流、失敗唔窒住投稿");

  /* ── 6) 前端寫入順序：Supabase 先行，先至送通知 ─────────────── */
  const marketSrc = read("market.js");
  assert.ok(marketSrc.indexOf("sb.rpc('submit_work'") < marketSrc.indexOf("notifyScoutAdmin({ ...work"), "一定要入庫成功先送通知（唔好寄咗個冇紀錄嘅投稿）");
  assert.ok(/await sb\.rpc\('submit_work'/.test(marketSrc), "Supabase 寫入路徑保持原樣（冇改行 serverless）");
  assert.ok(marketSrc.includes("if (error) throw"), "RPC 錯誤要照樣 throw（入庫失敗就唔會寄通知）");
  const form = html;
  assert.ok(form.includes('name="contact"') && form.includes('name="phone"'), "表單有選填聯絡電郵／電話");
  assert.ok(/name="contact" type="email"/.test(form), "電郵欄用 type=email 即刻喺表單擋住錯格式");
  assert.ok(form.includes("聯絡電郵（選填）") && form.includes("聯絡電話（選填）"), "兩者都要寫明選填");
  assert.ok(read("api/admin-login.js").includes("來源不符") && apiSrc.includes("no-store"), "通知結果唔准被 cache");
  console.log("✓ 流程：寫入 Supabase → 先至多送一份去 Scout Admin（表單選填聯絡欄已就位）");

  /* ── 7) migration 有 cover 住新欄位 ─────────────────────────── */
  const mig = "migrations/20260925-submission-contact.sql";
  if (fs.existsSync(path.join(ROOT, mig))) {
    const sql = read(mig);
    assert.match(sql, /add column if not exists contact text/);
    assert.match(sql, /add column if not exists phone text/);
    assert.match(sql, /create or replace function public\.submit_work/);
    assert.match(sql, /nullif\(btrim\(coalesce\(work->>'contact',''\)\), ''\)/);
    assert.match(sql, /grant execute on function public\.submit_work\(jsonb\) to anon, authenticated/);
    console.log("✓ migration：contact/phone 欄＋校驗＋submit_work 重寫（冚辦掂）");
  }

  console.log("\n✅ Scout Admin 通知：欄位對齊、清洗、API 行為、限流與前後端一致性全部通過");
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });
