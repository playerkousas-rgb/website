/* ════════════════════════════════════════════════════════════════
   test/retired.test.js
   「已下架」專區 ＋ 舊 ?app= 連結解釋 單測

   守住（2026-11-19 用戶指示）：
   1) 名單唯一真相 = 管理員喺後台逐個 SET（public.retired_apps），
      **唔准**由 apps.visible=false 推斷 —— 隱藏中 ≠ 曾經上過架。
   2) 公開版有「已下架」細條專區，文案只講「已下架、唔係故障」，唔寫原因。
   3) 舊 ?app=<slug> 對到已下架名單 → 展開專區＋highlight＋唔係故障，
      唔再淨係「搵唔到呢個 App」；對唔到就維持原本行為。
   4) 後台「標記已下架」會收起書架；隱藏中嘅項目要管理員明確確認
      「曾經上架」先准標記；「重新上架」會清走紀錄並公開顯示。
   5) migration 有 RLS（anon 只讀、admin 先寫到）同 listed_at 憑據欄。
   ════════════════════════════════════════════════════════════════ */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const html = read("index.html");
const appSrc = read("app.js");
const storeSrc = read("store.js");
const adminSrc = read("admin.js");
const migration = read("migrations/20261119-retired-apps.sql");

/* ── 1) 靜態：版面／文案／設定 ────────────────────────────────── */
for (const id of ["retired-shelf", "retired-toggle", "retired-list", "retired-items",
  "retired-count", "retired-note", "retired-jump"]) {
  assert.ok(html.includes(`id="${id}"`), `HTML 要有 #${id}`);
}
assert.ok(html.includes('data-icon="folder"'), "已下架圖示用線稿 folder（唔准 emoji）");
assert.ok(/const RETIRED_COPY = \{/.test(html), "要有 RETIRED_COPY 設定物件（改文案只改呢度）");
const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
assert.ok(/\.retired\[hidden\] \{[^}]*display: none/.test(style), "冇標記過任何項目時專區要完全收埋");
assert.ok(/\.retired-item\.hit \{/.test(style), "舊連結帶過去嗰項要有 highlight 樣式");

const copy = (() => {
  const m = html.match(/const RETIRED_COPY = \{[\s\S]*?\n\};/);
  assert.ok(m, "搵到 RETIRED_COPY 物件");
  const ctx = { RETIRED_COPY: null };
  vm.createContext(ctx);
  vm.runInContext(m[0] + "\nthis.__c = RETIRED_COPY;", ctx);
  return ctx.__c;
})();
assert.ok(copy.lead.includes("唔係故障"), "文案要講明唔係故障");
assert.ok(copy.lead.includes("已下架"), "文案要講明已下架");
for (const reason of ["少人用", "無人用", "使用率", "因為", "由於", "沒人用"]) {
  assert.ok(!copy.lead.includes(reason) && !copy.hint.includes(reason),
    `用戶指示「唔使特別寫原因」：文案唔應該出現「${reason}」`);
}
// 置頂公告嘅硬性禁用字眼唔可以因為新功能而走入 index.html
for (const banned of ["使用數據", "打開次數", "定期睇", "舊連結會搵唔到", "政策更新", "無人使用嘅 App 會下架"]) {
  assert.ok(!html.includes(banned), `index.html 唔應該出現禁用字眼「${banned}」`);
}

/* ── 2) 靜態：資料層／後台／migration ────────────────────────── */
assert.ok(/async function loadRetired\(/.test(storeSrc), "store.js 要有 loadRetired()");
assert.ok(/async function adminSetRetired\(/.test(storeSrc), "store.js 要有 adminSetRetired()");
assert.ok(/from\("retired_apps"\)/.test(storeSrc), "資料層要讀 retired_apps 表");
assert.ok(/唔係\*\*由 apps\.visible = false 推斷/.test(storeSrc), "要寫明隱藏 ≠ 已下架");
assert.ok(/item-retire/.test(adminSrc) && /toggleRetired\(/.test(adminSrc), "後台要有「標記已下架」動作");
assert.ok(/曾經上架/.test(adminSrc), "後台要守住「曾經上過架」呢個首要條件");
assert.ok(/reListFromRetired/.test(adminSrc), "編輯表單改返「公開顯示」要自動清走已下架紀錄");
assert.ok(/function retiredPanelHTML\(/.test(adminSrc), "管理頁要有「已下架一覽」方便 review／還原");
assert.ok(/create table if not exists public\.retired_apps/.test(migration), "migration 要有新表");
assert.ok(/enable row level security/.test(migration), "新表要開 RLS");
assert.ok(/for select to anon, authenticated using \(true\)/.test(migration), "anon 要讀到已下架名單");
assert.ok(/for all to authenticated[\s\S]*is_store_admin\(\)/.test(migration), "寫入只限管理員");
assert.ok(/listed_at\s+timestamptz not null/.test(migration), "listed_at 係「曾經上架」嘅憑據欄");
assert.ok(/notify pgrst/.test(migration), "要 reload PostgREST schema cache");
const retiredCacheV = Number((read("sw.js").match(/const CACHE = 'scout-tools-v(\d+)'/) || [])[1]);
assert.ok(Number.isFinite(retiredCacheV) && retiredCacheV >= 48, "sw.js cache 要 +1（用戶即刻用新版；大過等於 v48 就得）");

/* ── 3) 動態：fake DOM 真跑一次 boot ─────────────────────────── */
const lines = html.split("\n");
const htmlIds = new Set();
lines.forEach((l) => { for (const m of l.matchAll(/id="([^"]+)"/g)) htmlIds.add(m[1]); });

const scripts = [];
for (const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  const open = m[0].slice(0, m[0].indexOf(">"));
  const src = /src="([^"]+)"/.exec(open);
  if (src && !/^https?:/i.test(src[1])) scripts.push({ name: src[1], code: read(src[1]) });
  else if (!src) scripts.push({ name: "index.html#inline", code: m[1] });
}

function fakeEl(id) {
  const set = new Set();
  return {
    id, hidden: false, innerHTML: "", textContent: "", value: "", checked: false, disabled: false,
    dataset: {}, style: { setProperty() {} }, offsetHeight: 40, offsetTop: 0, offsetWidth: 300,
    isConnected: true, files: [], src: "", alt: "",
    classList: {
      _s: set,
      toggle(c, f) { const v = f === undefined ? !set.has(c) : !!f; v ? set.add(c) : set.delete(c); return v; },
      add(c) { set.add(c); }, remove(c) { set.delete(c); }, contains(c) { return set.has(c); }
    },
    querySelector() { return fakeEl("q"); }, querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    removeAttribute() {}, appendChild() {}, remove() {}, focus() {}, blur() {}, scrollIntoView() {},
    closest() { return null; }, contains() { return false; }, showModal() {}, close() {}, reset() {},
    get elements() { return {}; }, getContext() { return { drawImage() {} }; },
    toDataURL() { return "data:image/png;base64,x"; }
  };
}

function freshDB() {
  return {
    pages: [
      { id: "apps", label: "小工具 Apps", icon: "", enabled: true, sort_order: 0 },
      { id: "cards", label: "學習圖卡", icon: "", enabled: true, sort_order: 1 }
    ],
    categories: [
      { name: "小工具", icon: "", page: "apps", sort_order: 0 },
      { name: "圖卡", icon: "", page: "cards", sort_order: 0 }
    ],
    apps: [
      { id: "a1", name: "行軍地圖計算", url: "https://hm20c.vercel.app/", slug: "hm20c",
        description: "", category: "小工具", page: "apps", visible: true, featured: false,
        tags: [], clicks: 0, stars: 0, hearts: 0, sort_order: 0, created_at: "2026-09-01" },
      // 隱藏中、但從未上架 → 唔應該自動變成「已下架」
      { id: "a4", name: "已收起但未上架嘅工具", url: "https://hidden.vercel.app/", slug: "hidden-one",
        description: "", category: "小工具", page: "apps", visible: false, featured: false,
        tags: [], clicks: 0, stars: 0, hearts: 0, sort_order: 1, created_at: "2026-09-04" }
    ],
    // 管理員喺後台 SET 過嘅「已下架」（曾經上架、之後落架）
    retired_apps: [
      { id: "r1", app_id: "old-1", deep_key: "old-tool", name: "舊點名冊",
        listed_at: "2026-09-03T00:00:00Z", retired_at: "2026-11-19T00:00:00Z" }
    ]
  };
}

function makeTable(DB, name) {
  const rows = () => (DB[name] = DB[name] || []);
  const q = {
    _f: [], _op: null, _payload: null,
    select() { return q; }, order() { return q; }, limit() { return q; },
    eq(c, v) { q._f.push([c, v]); return q; },
    in(c, v) { q._f.push([c, v]); return q; },
    gte() { return q; },
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    delete() { q._op = "delete"; return q; },
    insert(row) { q._op = "insert"; q._payload = row; return q; },
    update(patch) { q._op = "update"; q._payload = patch; return q; },
    then(res, rej) {
      const match = (r) => q._f.every(([c, v]) => Array.isArray(v) ? v.includes(r[c]) : r[c] === v);
      if (q._op === "delete") {
        DB[name] = rows().filter((r) => !match(r));
        return Promise.resolve({ data: null, error: null }).then(res, rej);
      }
      if (q._op === "insert") {
        rows().push({ id: "r" + (rows().length + 1), ...q._payload });
        return Promise.resolve({ data: null, error: null }).then(res, rej);
      }
      if (q._op === "update") {
        rows().forEach((r) => { if (match(r)) Object.assign(r, q._payload); });
        return Promise.resolve({ data: null, error: null }).then(res, rej);
      }
      let data = rows();
      for (const [c, v] of q._f) data = data.filter((r) => Array.isArray(v) ? v.includes(r[c]) : r[c] === v);
      return Promise.resolve({ data, error: null, count: data.length }).then(res, rej);
    }
  };
  return q;
}

function boot(search, opts = {}) {
  const DB = opts.DB || freshDB();
  const els = {};
  const mem = new Map();
  const replaced = [];
  const document = {
    documentElement: { dataset: { theme: "dark" }, style: { setProperty() {} } },
    body: fakeEl("body"),
    getElementById(id) { return (opts.allIds || htmlIds.has(id)) ? (els[id] || (els[id] = fakeEl(id))) : null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, createElement() { return fakeEl("c"); }
  };
  const location = {
    href: "https://scoutappstore.vercel.app/" + search, search, pathname: "/", protocol: "https:",
    hash: opts.admin ? "#admin" : "", reload() {}, assign(u) { location.href = u; }
  };
  const ctx = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    URL, URLSearchParams,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    AbortSignal: { timeout: () => null },
    navigator: { onLine: true, clipboard: { writeText: async () => {} } },
    location,
    history: { replaceState(state, title, url) { replaced.push(url); if (url) location.href = "https://scoutappstore.vercel.app" + url; } },
    document,
    localStorage: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k)
    },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: async () => ({ ok: true, json: async () => ({}), text: async () => "" }),
    alert() {}, confirm: () => (opts.confirm === false ? false : true), prompt: () => "",
    IntersectionObserver: null,
    window: null
  };
  ctx.window = {
    addEventListener() {}, removeEventListener() {}, scrollTo() {}, open() {},
    location: ctx.location, navigator: ctx.navigator, document,
    localStorage: ctx.localStorage, history: ctx.history,
    supabase: {
      createClient: () => ({
        from: (name) => makeTable(DB, name),
        auth: { getSession: async () => ({ data: { session: null } }), updateUser: async () => ({ error: null }) },
        rpc: async () => ({ data: null, error: null })
      })
    },
    matchMedia: () => ({ matches: false, addEventListener() {} })
  };
  ctx.globalThis = ctx;
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  for (const s of scripts) vm.runInContext(s.code, ctx, { filename: s.name });
  return { ctx, els, replaced, location, DB, get: (expr) => vm.runInContext(expr, ctx) };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  /* 3a) 舊連結對到「已下架」→ 展開專區、highlight、講明唔係故障 */
  const old = boot("?app=old-tool");
  await wait(90);
  assert.ok(!old.els["app-sheet"] || old.els["app-sheet"].hidden, "已下架嘅舊連結唔應該開詳情 sheet");
  assert.equal(old.els["retired-shelf"].hidden, false, "有已下架標記就要顯示專區");
  assert.ok(old.els["retired-shelf"].classList.contains("expanded"), "舊連結要自動展開專區");
  assert.equal(old.els["retired-list"].hidden, false, "展開後清單要顯示");
  assert.ok(old.els["retired-items"].innerHTML.includes("舊點名冊"), "要列出已下架項目個名");
  assert.ok(/retired-item hit/.test(old.els["retired-items"].innerHTML), "要 highlight 舊連結對應嗰項");
  assert.ok(old.els.toast.textContent.includes("已下架") && old.els.toast.textContent.includes("唔係故障"),
    "toast 要講明已下架、唔係故障");
  assert.ok(old.replaced.some((u) => u === "/"), "舊連結要靜靜清走 ?app=");
  assert.ok(old.els["retired-note"].textContent.includes("唔係故障"), "專區內文要講明唔係故障");

  /* 3b) 隱藏中（從未上架）唔會自動變成已下架 */
  const hidden = boot("?app=hidden-one");
  await wait(90);
  assert.equal(hidden.els.toast.textContent, "搵唔到呢個 App", "隱藏中項目維持原本 toast");
  assert.ok(!hidden.els["retired-items"].innerHTML.includes("已收起但未上架"),
    "apps.visible=false 唔准自動列入已下架名單");

  /* 3c) 打錯 slug 維持原本行為 */
  const bad = boot("?app=not-exist");
  await wait(90);
  assert.equal(bad.els.toast.textContent, "搵唔到呢個 App", "打錯 slug 仍然係「搵唔到呢個 App」");
  assert.ok(!bad.els["retired-shelf"].classList.contains("expanded"), "打錯 slug 唔應該展開已下架專區");

  /* 3d) 現役 App 嘅深層連結完全唔受影響 */
  const live = boot("?app=hm20c");
  await wait(90);
  assert.equal(live.els["app-sheet"].hidden, false, "現役 App 照樣開詳情");
  assert.equal(live.els["sheet-name"].textContent, "行軍地圖計算");

  /* 3e) 冇任何已下架標記 → 專區完全唔顯示（例如未跑 migration） */
  const none = boot("", { DB: (() => { const d = freshDB(); d.retired_apps = []; return d; })() });
  await wait(90);
  assert.equal(none.els["retired-shelf"].hidden, true, "冇標記就唔顯示專區");
  assert.equal(none.els["retired-jump"].hidden, true, "冇標記就唔顯示底欄捷徑");

  /* 3f) 管理員 SET：標記 → 收起書架＋寫入名單；重新上架 → 清走＋公開 */
  const adm = boot("", { DB: (() => { const d = freshDB(); d.retired_apps = []; return d; })() });
  await wait(60);
  const app = { _id: "a1", slug: "hm20c", name: "行軍地圖計算", created_at: "2026-09-01", visible: true };
  await adm.ctx.adminSetRetired(app, true);
  assert.ok(adm.DB.retired_apps.some((r) => r.deep_key === "hm20c" && r.name === "行軍地圖計算"),
    "標記已下架要寫入 retired_apps（用 slug 做舊連結代號）");
  assert.ok(adm.DB.retired_apps[0].listed_at, "要有 listed_at 做「曾經上架」憑據");
  assert.equal(adm.DB.apps.find((a) => a.id === "a1").visible, false, "標記後要由書架收起");
  const listed = await adm.ctx.loadRetired();
  assert.equal(listed.length, 1, "loadRetired() 要讀得返管理員 SET 嘅名單");
  assert.equal(listed[0].deepKey, "hm20c");
  await adm.ctx.adminSetRetired(app, false);
  assert.equal(adm.DB.retired_apps.length, 0, "重新上架要清走已下架紀錄");
  assert.equal(adm.DB.apps.find((a) => a.id === "a1").visible, true, "重新上架要公開顯示");

  /* 3g) 後台守則：隱藏中嘅項目要管理員確認「曾經上架」先准標記 */
  const ADMIN = adm.get("ADMIN");
  ADMIN.retired = [];
  const hiddenApp = { _id: "a4", slug: "hidden-one", name: "已收起但未上架嘅工具", visible: false };
  assert.equal(ADMIN.isRetired(hiddenApp), false, "未標記就唔係已下架");
  const rowBefore = adm.DB.retired_apps.length;
  const refused = boot("", { DB: (() => { const d = freshDB(); d.retired_apps = []; return d; })(), confirm: false });
  await wait(60);
  const ADMIN2 = refused.get("ADMIN");
  ADMIN2.retired = [];
  ADMIN2.sites = { pages: [{ id: "apps", label: "小工具 Apps", enabled: true, categories: [
    { name: "小工具", apps: [{ _id: "a4", slug: "hidden-one", name: "已收起但未上架嘅工具", visible: false }] }
  ] }] };
  await ADMIN2.toggleRetired("a4", true);
  assert.equal(refused.DB.retired_apps.length, rowBefore,
    "管理員否認「曾經上架」就唔准標記（confirm=false）");

  /* 3h) 後台項目列：已下架有專屬標籤同「重新上架」掣 */
  ADMIN.retired = [{ appId: "a1", deepKey: "hm20c", name: "行軍地圖計算" }];
  const rowHTML = adm.ctx.itemRowHTML({ _id: "a1", slug: "hm20c", name: "行軍地圖計算", visible: false, tags: [] });
  assert.ok(rowHTML.includes("已下架") && rowHTML.includes("重新上架"),
    "已下架項目要顯示標籤同「重新上架」掣");
  assert.ok(rowHTML.includes("item-retire"), "要有 item-retire 委派動作");
  ADMIN.sites = { pages: [{ id: "apps", label: "小工具 Apps", enabled: true, categories: [
    { name: "小工具", apps: [{ _id: "a1", slug: "hm20c", name: "行軍地圖計算", visible: false }] }
  ] }] };
  const panelHTML = adm.ctx.retiredPanelHTML();
  assert.ok(panelHTML.includes("已下架") && panelHTML.includes('data-act="item-retire"'),
    "已下架一覽要列出名單同一撳還原");
  assert.ok(!panelHTML.includes("已收起但未上架"), "一覽唔可以撈入隱藏中嘅項目");
  ADMIN.retired = [];
  assert.equal(adm.ctx.retiredPanelHTML(), "", "冇標記就唔顯示一覽");

  /* 3i) 編輯表單將已下架項目改返「公開顯示」→ 自動清走紀錄，唔留矛盾狀態 */
  const edit = boot("", { allIds: true, DB: (() => {
    const d = freshDB();
    d.retired_apps = [{ id: "r9", app_id: "a1", deep_key: "hm20c", name: "行軍地圖計算",
      listed_at: "2026-09-01T00:00:00Z", retired_at: "2026-11-19T00:00:00Z" }];
    d.apps.find((a) => a.id === "a1").visible = false;
    return d;
  })() });
  await wait(60);
  const EA = edit.get("ADMIN");
  EA.sites = { pages: [{ id: "apps", label: "小工具 Apps", enabled: true, categories: [
    { name: "小工具", apps: [{ _id: "a1", slug: "hm20c", name: "行軍地圖計算", visible: false }] }
  ] }] };
  EA.retired = [{ appId: "a1", deepKey: "hm20c", name: "行軍地圖計算" }];
  EA.editId = "a1";
  EA.form = { page: "apps", category: "小工具", iconSource: "favicon", featured: false };
  EA.refresh = async () => {};   // 唔使真 render 後台，淨係驗資料一致性
  const E = (id) => edit.ctx.document.getElementById(id);  // allIds：表單欄位即場生成
  E("f-name").value = "行軍地圖計算";
  E("f-url").value = "https://hm20c.vercel.app/";
  E("f-page").value = "apps";
  E("f-cat").value = "小工具";
  E("f-slug").value = "hm20c";
  E("f-visible").checked = true;
  EA.submit();
  await wait(120);
  assert.equal(edit.DB.retired_apps.length, 0, "表單重新上架要清走已下架紀錄");
  assert.equal(edit.DB.apps.find((a) => a.id === "a1").visible, true, "表單重新上架要公開顯示");

  console.log("✅ retired: 名單只由後台 SET（隱藏≠已下架）、舊連結帶去唔係故障解釋、後台確認守則、表單一致性、RLS migration 全部通過");
})().catch((e) => { console.error(e); process.exitCode = 1; });
