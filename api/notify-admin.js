/* ════════════════════════════════════════════════════════════════
   api/notify-admin.js — 投稿「多送一份」去 Scout Admin
   ────────────────────────────────────────────────────────────────
   做咩：瀏覽器成功寫入 Supabase（照舊直接 call submit_work RPC，呢度唔碰）之後，
        由伺服器將同一份資料 POST 去 Scout Admin 嘅 Google Apps Script 接收端：
          ① 自動登記落 Google Sheet「作品投稿」  ② MailApp 發電郵畀 ADMIN_EMAIL
        管理員喺電郵／Sheet 登記完，再按「轉寄給」嗰個信箱轉交負責人。

   做咩要經伺服器（唔好前端直送）：
     · Apps Script 唔回 CORS 標頭 → 瀏覽器 no-cors 直送**讀唔到回應**，
       送失敗都當成功（假成功）；經呢度先至攞到 Apps Script 嘅
       {status:"success"/"error"} 回報，俾用戶睇到真話。
     · 順手做欄位白名單＋長度上限＋限流，防人用任意鍵喺管理員張 Sheet 加欄、
       或者將呢個 endpoint 做免費郵件炸彈。

   環境變數（Vercel → Settings → Environment Variables；全部**選填**）：
     SCOUT_APPS_SCRIPT_URL  Apps Script Web App /exec 網址（預設 = Scout Admin 說明書嗰條）
     ADMIN_FORWARD_EMAIL    通知信入面寫明「登記後轉寄俾邊個」（預設同 Apps Script ADMIN_EMAIL）
     STORE_REVIEW_URL       管理員返嚟審核嘅連結（預設用請求 origin + /#admin）
     STORE_NOTIFY_DISABLED  = 1 時唔送通知（例如測試環境）
   ════════════════════════════════════════════════════════════════ */

// Scout Admin Apps Script 接收端（公開資料：佢自己嘅說明書都係咁貼出嚟）。
const DEFAULT_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxj5BDDGgjs559smkK4Z5aYImWYeXbN5af8U1ObON0z9WnsN6QJW4I1XWolhs5kQ_H-UQ/exec";
const DEFAULT_FORWARD_EMAIL = "playerkousas@hotmail.com";

// 得呢啲鍵會送落 Apps Script（其他一律抹走 → 唔畀人隨意在管理員張 Sheet 開新欄）。
// aliases 係「收嘅時候容許邊個名」，送出去時一律用 key（key 就係 Sheet 欄名／電郵內文標籤）。
const FIELDS = [
  { key: "name", label: "作品名稱", max: 80, required: true },
  { key: "url", label: "作品連結", max: 2048, required: true, kind: "url" },
  { key: "author", label: "作者名稱", max: 80, required: true },
  { key: "page", label: "作品類型", max: 40, aliases: ["page", "作品類型"] },
  { key: "category", label: "分類", max: 60, aliases: ["category", "分類"] },
  { key: "description", label: "作品簡介", max: 1000, required: true, aliases: ["description", "desc", "作品簡介"] },
  { key: "tags", label: "標籤", max: 200, kind: "tags" },
  { key: "商店編號", label: "投稿編號", max: 64, aliases: ["商店編號", "id", "submissionId"] },
  { key: "聯絡電郵", label: "聯絡電郵", max: 160, kind: "email", aliases: ["聯絡電郵", "contact", "email"] },
  { key: "聯絡電話", label: "聯絡電話", max: 40, kind: "phone", aliases: ["聯絡電話", "phone", "tel"] },
  { key: "審核頁", label: "審核頁", max: 300, kind: "link", aliases: ["審核頁", "reviewUrl"] },
  { key: "轉寄給", label: "轉寄給", max: 160, kind: "email", aliases: ["轉寄給", "forwardTo"] }
];
const SOURCE_APP = "SCOUT APP STORE";
const MAX_BODY = 16 * 1024;         // 投稿本身用唔到 16KB；超大即亂碼／濫用
const WINDOW_MS = 15 * 60 * 1000;   // 同 /api/admin-login 一樣：單執行個體每 IP 基本限流
const MAX_PER_WINDOW = 8;
const DEDUPE_MS = 5 * 60 * 1000;     // 同一個投稿編號 5 分鐘內唔好送兩次（防撳兩下）

const attempts = new Map();   // 每 IP 計次（serverless 多執行個體會各計各，見 README「安全說明」）
const sentIds = new Map();    // 已送達嘅投稿編號 → 去重

// 壓成單行安全字串：換行／控制字符變空格，再截上限。
// （唔係美容：留住行字符就可以喺管理員嗰封電郵偽造多幾行「欄位」）
function clean(value, max) {
  const oneLine = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f\u2000-\u200f\u2028\u2029\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const limit = Number(max) || 500;
  return oneLine.length > limit ? oneLine.slice(0, Math.max(0, limit - 1)) + "…" : oneLine;
}
function cleanEmail(value) {
  const v = clean(value, 160);
  return /^[^\s@,;:]+@[^\s@,;.]+\.[^\s@,;.]{2,}$/.test(v) ? v : null;
}
function cleanPhone(value) {
  return clean(value, 40).replace(/[^\d+()\-\s.,]/g, "").trim();
}
// 只接受 http(s) 連結（Sheet 入面會被当做超連結，唔使畀 javascript: 之類）
function cleanUrl(value) {
  const v = clean(value, 2048);
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    return u.href;
  } catch {
    return null;
  }
}

function pick(raw, field) {
  for (const key of field.aliases || [field.key]) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "") return raw[key];
  }
  return "";
}
function asText(value, kind, max) {
  if (kind === "tags") {
    const list = Array.isArray(value) ? value : String(value ?? "").split(/[,，、\n]/);
    return list.map(t => clean(t, 20)).filter(Boolean).slice(0, 8).join("、");
  }
  if (kind === "email") return cleanEmail(clean(value, max));
  if (kind === "phone") return cleanPhone(value);
  if (kind === "url") return cleanUrl(value);
  if (kind === "link") { const u = cleanUrl(value); return u || clean(value, max); }
  return clean(value, max);
}

function buildPayload(raw, fallbackReviewUrl) {
  const out = { type: "appstore", sourceApp: SOURCE_APP };
  const problems = [];  // 致命：必需欄位缺失／格式唔啱 → 400
  const soft = [];      // 非致命：選填欄位格式唔啱 → 抹走佢照樣通知（唔值得為一個電話阻人交表）
  for (const f of FIELDS) {
    const rawValue = pick(raw, f);
    const has = rawValue !== "" && rawValue !== undefined && rawValue !== null;
    const value = has ? asText(rawValue, f.kind, f.max) : "";
    if (!value || typeof value !== "string") {
      if (f.required) problems.push(has ? f.label + "格式唔正確" : f.label + "未填");
      else if (has) soft.push(f.label + "格式唔正確，已略過");
      continue;
    }
    out[f.key] = value;
  }
  // 呢兩個由伺服器話事（唔使信瀏覽器傳嘅嘢）
  const forward = cleanEmail(process.env.ADMIN_FORWARD_EMAIL || DEFAULT_FORWARD_EMAIL);
  if (forward) out["轉寄給"] = forward;
  // 審核連結：env > 請求 origin > （都冇先考慮客端值）—— 唔畀人喺管理員信入面擺 phishing 連結
  const review = asText(process.env.STORE_REVIEW_URL || "", "link", 300) || cleanUrl(fallbackReviewUrl) || cleanUrl(out["審核頁"] || "");
  if (review) out["審核頁"] = review;
  return { payload: out, problems, soft };
}

module.exports = async function (req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const send = (code, data) => res.status(code).send(JSON.stringify(data));
  if (req.method !== "POST") return send(405, { ok: false, error: "只接受 POST" });
  try {
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
      return send(403, { ok: false, error: "來源不符" });
  } catch {
    return send(403, { ok: false, error: "來源不符" }); }

  const scriptUrl = process.env.SCOUT_APPS_SCRIPT_URL || DEFAULT_SCRIPT_URL;
  if (!scriptUrl || process.env.STORE_NOTIFY_DISABLED === "1")
    return send(200, { ok: false, skipped: true, error: "通知功能未啟用" });

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0];
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.until < now) attempts.delete(key);
  for (const [key, until] of sentIds) if (until < now) sentIds.delete(key);
  const entry = attempts.get(ip) || { count: 0, until: now + WINDOW_MS };
  if (entry.count >= MAX_PER_WINDOW)
    return send(429, { ok: false, error: "通知太頻密，請 15 分鐘後再試。" });
  entry.count++;
  attempts.set(ip, entry);

  let raw;
  try {
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
    if (body.length > MAX_BODY) return send(413, { ok: false, error: "資料過長" });
    raw = JSON.parse(body || "{}");
  } catch {
    return send(400, { ok: false, error: "無效請求" }); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return send(400, { ok: false, error: "無效請求" });

  const fallbackReviewUrl = (() => {
    const host = req.headers.host;
    if (!host) return "";
    const proto = req.headers["x-forwarded-proto"] || "https";
    return cleanUrl(`${proto}://${host}/#admin`) || "";
  })();
  const { payload, problems, soft } = buildPayload(raw, fallbackReviewUrl);
  if (problems.length) return send(400, { ok: false, error: "資料唔啱：" + problems.join("、") });

  // 「多送一份」唔應該令投稿失敗：送唔到都係 200 + sent:false，由前端講明。
  const workId = payload["商店編號"] || "";
  if (workId && sentIds.has(workId)) return send(200, { ok: true, sent: true, deduped: true, warnings: soft });
  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: AbortSignal.timeout(10000)
    });
    const text = await response.text().catch(() => "");
    let result = null;
    try { result = JSON.parse(text); } catch { result = null; }
    if (!response.ok || !result || result.status === "error") {
      console.error("[notify-admin] Apps Script 拒絕：", response.status, String(text).slice(0, 200));
      return send(200, { ok: false, sent: false, error: "登記端未能確認收到，請通知管理員到後台手動處理。", warnings: soft });
    }
    if (workId) sentIds.set(workId, Date.now() + DEDUPE_MS);
    attempts.delete(ip); // 成功就唔食限流名額
    return send(200, { ok: true, sent: true, message: clean(result.message, 200), warnings: soft });
  } catch (e) {
    console.error("[notify-admin] 連線失敗：", e && e.name, e && e.message);
    return send(200, { ok: false, sent: false, error: "登記端暫時連線唔到，投稿仍然有效（管理員會喺後台睇到）。", warnings: soft });
  }
};
