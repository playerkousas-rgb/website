/* ════════════════════════════════════════════════════════════════
   數據層 store.js
   讀取優先序：Supabase（已配置）→ localStorage（demo）→ apps.json

   ── 新版結構（多分頁）────────────────────────────────────
   全站改名「童軍小工具」，含 4 個可分頁（每頁可獨立開放/關閉）：
     apps  (小工具/Apps)   cards(學習圖卡)   ppt(簡報)   links(有用連結)
   每個分頁有自己嘅一套分類；每頁入面嘅項目(全部係「連結」)逐個
   可開/關。每個項目可揀 童軍級別標籤（小童軍/幼童軍/童軍/深資童軍/樂行童軍）
   方便用戶篩選適合自己嘅內容。
   ════════════════════════════════════════════════════════════════ */

// ⚙️ 建好 Supabase 項目後填呢度（步驟見 README.md「Admin 設置」）
const SUPABASE_CONFIG = {
  url: "https://visqyeskdauipodudpxz.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpc3F5ZXNrZGF1aXBvZHVkcHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjQ5MjUsImV4cCI6MjEwNDAwMDkyNX0.Ct2jJpJUtRFiVSux774aGRdegFG8fr5mWeD1RMm_dXs",
  // 你 admin 帳號嘅 email（可以用假嘅，例如 "admin@troop"）。
  // 填咗之後，管理面板登入頁會預填 email，其他人只需要打密碼。
  adminEmail: "ai@scoutsystem.com"
};

const LS_KEY = "showcase-admin-demo";
let _sb = null;

// 全站 Logo（項目／分類冇揀 icon 時嘅預設圖示）
const SITE_LOGO = "/icons/icon-192.png";

// HTML escape（共用，公開 / 後台 / store 都用）
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// 攞外部 App 嘅 favicon（用 Google s2，64px）。
// 失敗嗰陣 caller 會退返 SITE_LOGO。
function faviconUrl(url) {
  try { return "https://www.google.com/s2/favicons?domain=" + new URL(url).hostname + "&sz=64"; }
  catch { return null; }
}

// 渲染 item 嘅圖示 HTML（公開 tile / 後台列表 / 總覽預覽 共用）
// app.iconSource: "favicon" (預設) | "emoji" | "upload" | "none"
//   舊資料冇 iconSource 時：icon 為 https URL 視為 "upload"；其他非空字串視為 "emoji"；空字串視為 "favicon"
function resolveIconSource(app) {
  if (app.iconSource === "favicon" || app.iconSource === "emoji" ||
      app.iconSource === "upload" || app.iconSource === "none") return app.iconSource;
  if (app.icon && /^https?:\/\//i.test(app.icon)) return "upload";
  if (app.icon && app.icon.length) return "emoji";
  return "favicon";
}
function appIconHTML(app, size) {
  const src = resolveIconSource(app);
  const cls = size === "row" ? ' class="row-ico"' : "";
  const lazy = size === "row" ? "" : ' loading="lazy" decoding="async"';
  const fallback = `this.onerror=null;this.src='${SITE_LOGO}'`;
  if (src === "emoji") return esc(app.icon);
  if (src === "upload") return `<img${cls} src="${esc(app.icon)}" alt=""${lazy} onerror="${fallback}" />`;
  if (src === "favicon") {
    const fav = faviconUrl(app.url);
    if (fav) return `<img${cls} src="${esc(fav)}" alt=""${lazy} onerror="${fallback}" />`;
    return `<img${cls} src="${SITE_LOGO}" alt=""${lazy} />`;
  }
  // "none" → 直接用全站 Logo
  return `<img${cls} src="${SITE_LOGO}" alt=""${lazy} />`;
}

// 童軍級別標籤（固定，唔可以喺後台加減）
const SCOUT_TAGS = ["小童軍", "幼童軍", "童軍", "深資童軍", "樂行童軍"];

// 分類 emoji 建議清單（admin 揀選用）
const CATEGORY_EMOJI = [
  "🧭","📊","📈","📋","🗂️","🧰","🔧","🛠️","🎮","🎲","🧩","🃏",
  "📖","🖼️","🎨","🧠","📽️","📺","🔗","🌐","💡","⭐","🎖️","🏅",
  "⛺","🔥","🧗","🚣","🏕️","🗺️","🧭","📱","💻","📚","✏️","📝",
  "📷","🎬","🎵","🗓️","✅","🔍","🧪","⚽","🏊","🚴"
];

function getSB() {
  if (SUPABASE_CONFIG.url && typeof window.supabase !== "undefined") {
    if (!_sb) _sb = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }
  return _sb;
}

// ── 預設模板（一鍵重設 & apps.json fallback 用）──────────────
function makeDefaultSite() {
  return {
    name: "童軍小工具",
    pages: [
      {
        id: "apps", label: "小工具 Apps", icon: "🧰", enabled: true,
        categories: [
          { name: "電子進度紀錄", icon: "🧭", apps: [] },
          { name: "小工具", icon: "🧰", apps: [] },
          { name: "小遊戲", icon: "🎮", apps: [] }
        ]
      },
      { id: "cards", label: "學習圖卡", icon: "🃏", enabled: false, categories: [] },
      { id: "ppt",   label: "PPT 簡報", icon: "📽️", enabled: false, categories: [] },
      { id: "links", label: "有用連結", icon: "🔗", enabled: false, categories: [] }
    ]
  };
}

function rowsToApp(r) {
  const tags = Array.isArray(r.tags)
    ? r.tags
    : (typeof r.tags === "string" && r.tags ? r.tags.split(",") : []);
  return {
    name: r.name,
    url: r.url,
    description: r.description || null,
    icon: r.icon || null,
    iconSource: r.iconSource || null,
    github: r.github || null,
    note: r.note || null,
    visible: r.visible !== false,
    tags: tags.map((t) => t.trim()).filter(Boolean),
    clicks: r.clicks || 0,
    sort_order: r.sort_order ?? 0,
    _id: r.id,
    page: r.page || "apps"
  };
}

// 將「apps + categories」rows 組合成 pages 結構
function buildSites(pagesData, catsData, appsData) {
  const pageMap = new Map();
  (pagesData || []).forEach((p, i) => {
    const obj = {
      id: p.id,
      label: p.label || p.id,
      icon: p.icon || "",
      enabled: p.enabled !== false,
      sort: p.sort_order ?? i,
      categories: []
    };
    pageMap.set(p.id, obj);
  });
  // 確保四個預設頁都存在（即使 DB 未有某頁）
  makeDefaultSite().pages.forEach((dp) => {
    if (!pageMap.has(dp.id)) pageMap.set(dp.id, { id: dp.id, label: dp.label, icon: dp.icon, enabled: false, categories: [] });
  });

  const catByKey = new Map(); // `${page}::${name}`
  const catByName = new Map(); // legacy: name
  const ensureCat = (pageId, name, icon, order) => {
    const key = pageId + "::" + name;
    let c = catByKey.get(key);
    if (!c) {
      c = { name, icon: icon || "", apps: [] };
      catByKey.set(key, c);
      if (!pageMap.has(pageId)) {
        pageMap.set(pageId, { id: pageId, label: pageId, icon: "", enabled: false, categories: [] });
      }
      pageMap.get(pageId).categories.push(c);
    }
    return c;
  };

  (catsData || []).forEach((c, i) => {
    const page = c.page || "apps";
    const key = page + "::" + c.name;
    if (!catByKey.has(key)) {
      const obj = { name: c.name, icon: c.icon || "", apps: [] };
      catByKey.set(key, obj);
      if (!pageMap.has(page)) pageMap.set(page, { id: page, label: page, icon: "", enabled: false, categories: [] });
      pageMap.get(page).categories.push(obj);
      catByName.set(c.name, obj);
    }
  });
  (appsData || []).forEach((r) => {
    const page = r.page || "apps";
    const cat = catByKey.get(page + "::" + r.category) || ensureCat(page, r.category, "", 0);
    cat.apps.push(rowsToApp(r));
  });
  const pages = [...pageMap.values()].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  return { pages };
}

async function loadSites() {
  const sb = getSB();
  if (sb) {
    const pagesRes = await sb.from("pages").select("*").order("sort_order");
    const newSchema = !pagesRes.error && pagesRes.data;
    if (newSchema) {
      const [catsRes, appsRes] = await Promise.all([
        sb.from("categories").select("*").order("sort_order"),
        sb.from("apps").select("*").order("sort_order").order("created_at")
      ]);
      const cats = !catsRes.error ? catsRes.data || [] : [];
      const apps = !appsRes.error ? appsRes.data || [] : [];
      const sites = makeDefaultSite();
      const built = buildSites(pagesRes.data, cats, apps);
      sites.pages = built.pages;
      return { source: "supabase", sites };
    }
    // 舊 schema（未行 migration）→ legacy 單頁 fallback，唔會整冧個站
    const [catsRes, appsRes] = await Promise.all([
      sb.from("categories").select("*").order("sort_order"),
      sb.from("apps").select("*").order("sort_order").order("created_at")
    ]);
    const cats = !catsRes.error ? catsRes.data || [] : [];
    const apps = !appsRes.error ? appsRes.data || [] : [];
    const sites = makeDefaultSite();
    sites.pages = buildSites(null, cats, apps).pages;
    return { source: "supabase", sites };
  }
  try {
    const ls = JSON.parse(localStorage.getItem(LS_KEY));
    if (ls && (ls.pages || ls.categories)) {
      return { source: "demo", sites: normalizeSites(ls) };
    }
  } catch {}
  const res = await fetch("apps.json", { cache: "no-cache" });
  const json = await res.json();
  return { source: "json", sites: normalizeSites(json) };
}

// 將舊格式 { categories: [...] } 轉成新版 pages（demo/apps.json 兼容）
function normalizeSites(raw) {
  const sites = makeDefaultSite();
  if (raw.name) sites.name = raw.name;
  if (raw.pages && Array.isArray(raw.pages)) {
    sites.pages = raw.pages.map((p) => ({
      id: p.id || p.page || "apps",
      label: p.label || p.id || "未命名",
      icon: p.icon || "",
      enabled: p.enabled !== false,
      categories: (p.categories || []).map((c) => ({
        name: c.name, icon: c.icon || "",
        apps: (c.apps || []).map((a, ai) => normalizeApp(a, ai, c.name, p.id || p.page || "apps"))
      }))
    }));
    return sites;
  }
  // legacy categories 單頁包裝
  const allCats = [];
  const page = { id: "apps", label: "小工具 Apps", icon: "🧰", enabled: true, categories: allCats };
  (raw.categories || []).forEach((c) => {
    allCats.push({
      name: c.name, icon: c.icon || "",
      apps: (c.apps || []).map((a, ai) => normalizeApp(a, ai, c.name, "apps"))
    });
  });
  sites.pages = [page];
  return sites;
}

function normalizeApp(a, i, catName, page) {
  return {
    name: a.name,
    url: a.url,
    description: a.description || null,
    icon: a.icon || null,
    iconSource: a.iconSource || null,
    github: a.github || null,
    note: a.note || null,
    visible: a.visible !== false,
    tags: Array.isArray(a.tags) ? a.tags.filter(Boolean) : [],
    clicks: a.clicks || 0,
    sort_order: a.sort_order ?? i,
    _id: a._id || "demo-" + Date.now() + "-" + i + "-" + Math.random().toString(36).slice(2, 6),
    page
  };
}

// ── 分類確保存在（Supabase）──────────────────────────────────
async function ensureCategory(page, name, icon) {
  const sb = getSB();
  if (!sb) return;
  const { data: exists } = await sb.from("categories").select("name").eq("name", name).eq("page", page).maybeSingle();
  if (exists) return;
  const { count } = await sb.from("categories").select("*", { count: "exact", head: true }).eq("page", page);
  await sb.from("categories").insert({ name, icon: icon || "", page, sort_order: count || 0 });
}

function appPayload(app) {
  return {
    name: app.name,
    url: app.url,
    description: app.description || null,
    icon: app.icon || null,
    iconSource: app.iconSource || null,
    github: app.github || null,
    note: app.note || null,
    category: app.category,
    page: app.page || "apps",
    tags: Array.isArray(app.tags) ? app.tags : [],
    visible: app.visible !== false
  };
}

// ── Admin 寫入（新增/編輯 item）──────────────────────────────
async function adminSaveApp(app, id) {
  const payload = appPayload(app);
  const sb = getSB();
  if (sb) {
    await ensureCategory(app.page, app.category, "");
    // 先嘗試帶 iconSource 寫入；若 Supabase 嘅 apps table 仲未加呢欄
    // （用戶未跑 README 嘅 migration），就 fallback 唔寫 iconSource
    let p = payload;
    let res = id
      ? await sb.from("apps").update(p).eq("id", id)
      : await sb.from("apps").insert(p);
    if (res.error && /icon_source/i.test(res.error.message || "")) {
      p = { ...payload };
      delete p.iconSource;
      res = id
        ? await sb.from("apps").update(p).eq("id", id)
        : await sb.from("apps").insert(p);
    }
    if (res.error) throw res.error;
    return;
  }
  const { sites } = await loadSites();
  if (id) {
    for (const pg of sites.pages) for (const c of pg.categories) {
      const i = c.apps.findIndex((a) => a._id === id);
      if (i >= 0) c.apps[i] = { ...c.apps[i], ...payload };
    }
  } else {
    let pg = sites.pages.find((p) => p.id === app.page);
    if (!pg) { pg = { id: app.page, label: app.page, icon: "", enabled: true, categories: [] }; sites.pages.push(pg); }
    let cat = pg.categories.find((c) => c.name === app.category);
    if (!cat) { cat = { name: app.category, icon: "", apps: [] }; pg.categories.push(cat); }
    cat.apps.push({ ...payload, clicks: 0, _id: "demo-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) });
  }
  localStorage.setItem(LS_KEY, JSON.stringify(sites));
}

async function adminDeleteApp(id) {
  const sb = getSB();
  if (sb) {
    const { error } = await sb.from("apps").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  const { sites } = await loadSites();
  sites.pages.forEach((p) => p.categories.forEach((c) => (c.apps = c.apps.filter((a) => a._id !== id))));
  sites.pages = sites.pages.filter((p) => p.categories.some((c) => c.apps.length) || p.enabled);
  // 避免整頁變空但 enabled=false 被刪——改為只刪空且 disabled 嘅頁以外的空分類
  sites.pages.forEach((p) => (p.categories = p.categories.filter((c) => c.apps.length)));
  sites.pages = sites.pages.filter((p) => p.categories.length || p.enabled);
  localStorage.setItem(LS_KEY, JSON.stringify(sites));
}

// ── 分類：新增 ───────────────────────────────────────────────
async function adminAddCategory(page, name, icon) {
  name = (name || "").trim();
  if (!name) throw new Error("分類名稱必填");
  const sb = getSB();
  if (sb) {
    const { data: exists } = await sb.from("categories").select("name").eq("name", name).eq("page", page).maybeSingle();
    if (exists) throw new Error("呢個分頁已經有「" + name + "」");
    const { count } = await sb.from("categories").select("*", { count: "exact", head: true }).eq("page", page);
    const { error } = await sb.from("categories").insert({ name, icon: icon || "", page, sort_order: count || 0 });
    if (error) throw error;
    return;
  }
  const { sites } = await loadSites();
  const pg = sites.pages.find((p) => p.id === page);
  if (pg && pg.categories.some((c) => c.name === name)) throw new Error("呢個分頁已經有「" + name + "」");
  (pg || sites.pages.find((p) => p.id === "apps") || sites.pages[0]).categories.push({ name, icon: icon || "", apps: [] });
  localStorage.setItem(LS_KEY, JSON.stringify(sites));
}

// ── 分類：改名 ───────────────────────────────────────────────
async function adminRenameCategory(page, oldName, newName) {
  newName = (newName || "").trim();
  if (!newName) throw new Error("分類名稱必填");
  if (oldName === newName) return;
  const sb = getSB();
  if (sb) {
    const { data: dup } = await sb.from("categories").select("name").eq("page", page).eq("name", newName).maybeSingle();
    if (dup) throw new Error("呢個分頁已經有「" + newName + "」");
    const { error } = await sb.from("categories").update({ name: newName }).eq("page", page).eq("name", oldName);
    if (error) throw error;
    // 同步更新該分類下所有項目嘅 category
    const { data: appList } = await sb.from("apps").select("id").eq("page", page).eq("category", oldName);
    if (appList && appList.length) {
      const { error: e2 } = await sb.from("apps").update({ category: newName }).eq("page", page).eq("category", oldName);
      if (e2) throw e2;
    }
    return;
  }
  const { sites } = await loadSites();
  for (const p of sites.pages) {
    if (p.id !== page) continue;
    if (p.categories.some((c) => c.name === newName)) throw new Error("呢個分頁已經有「" + newName + "」");
    const c = p.categories.find((x) => x.name === oldName);
    if (c) c.name = newName;
  }
  localStorage.setItem(LS_KEY, JSON.stringify(sites));
}

// ── 分類：改 icon ────────────────────────────────────────────
async function adminSetCategoryIcon(page, name, icon) {
  const sb = getSB();
  if (sb) {
    const { error } = await sb.from("categories").update({ icon: icon || "" }).eq("page", page).eq("name", name);
    if (error) throw error;
    return;
  }
  const { sites } = await loadSites();
  const pg = sites.pages.find((p) => p.id === page);
  const c = pg && pg.categories.find((x) => x.name === name);
  if (c) c.icon = icon || "";
  localStorage.setItem(LS_KEY, JSON.stringify(sites));
}

// ── 分類：刪除（連帶佢入面所有項目一齊刪）────────────────────
async function adminDeleteCategory(page, name) {
  const sb = getSB();
  if (sb) {
    const { data: appList } = await sb.from("apps").select("id").eq("page", page).eq("category", name);
    if (appList && appList.length) {
      const { error: e1 } = await sb.from("apps").delete().eq("page", page).eq("category", name);
      if (e1) throw e1;
    }
    const { error } = await sb.from("categories").delete().eq("page", page).eq("name", name);
    if (error) throw error;
    return;
  }
  const { sites } = await loadSites();
  const pg = sites.pages.find((p) => p.id === page);
  if (pg) pg.categories = pg.categories.filter((c) => c.name !== name);
  localStorage.setItem(LS_KEY, JSON.stringify(sites));
}

// ── 分類：頁內排序 ───────────────────────────────────────────
async function adminMoveCategory(page, name, dir) {
  const sb = getSB();
  if (sb) {
    const { data } = await sb.from("categories").select("*").eq("page", page).order("sort_order");
    if (!data || data.length < 2) return;
    const ordered = data.map((c) => c.name);
    const i = ordered.indexOf(name);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    for (let k = 0; k < ordered.length; k++) {
      const cur = data.find((c) => c.name === ordered[k]);
      if (cur.sort_order !== k) {
        await sb.from("categories").update({ sort_order: k }).eq("name", cur.name).eq("page", cur.page);
      }
    }
    return;
  }
  const { sites } = await loadSites();
  const pg = sites.pages.find((p) => p.id === page);
  if (!pg) return;
  const i = pg.categories.findIndex((c) => c.name === name);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= pg.categories.length) return;
  [pg.categories[i], pg.categories[j]] = [pg.categories[j], pg.categories[i]];
  localStorage.setItem(LS_KEY, JSON.stringify(sites));
}

// ── 分頁：開關（開放/關閉成個分頁）──────────────────────────
async function adminSetPageEnabled(id, enabled) {
  const sb = getSB();
  if (sb) {
    const { error } = await sb.from("pages").update({ enabled: enabled !== false }).eq("id", id);
    if (error) throw error;
    return;
  }
  const { sites } = await loadSites();
  const pg = sites.pages.find((p) => p.id === id);
  if (pg) pg.enabled = enabled !== false;
  localStorage.setItem(LS_KEY, JSON.stringify(sites));
}

// ── App 排序（分類之內）──────────────────────────────────────
async function adminMoveApp(id, dir) {
  const sb = getSB();
  if (sb) {
    const { data: all } = await sb.from("apps").select("*").order("sort_order").order("created_at");
    if (!all) return;
    const app = all.find((a) => a.id === id);
    if (!app) return;
    const siblings = all.filter((a) => a.category === app.category && a.page === app.page);
    const i = siblings.findIndex((a) => a.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= siblings.length) return;
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    for (let k = 0; k < siblings.length; k++) {
      if (siblings[k].sort_order !== k) {
        await sb.from("apps").update({ sort_order: k }).eq("id", siblings[k].id);
      }
    }
    return;
  }
  const { sites } = await loadSites();
  for (const p of sites.pages) for (const c of p.categories) {
    const i = c.apps.findIndex((a) => a._id === id);
    if (i < 0) continue;
    const j = i + dir;
    if (j < 0 || j >= c.apps.length) return;
    [c.apps[i], c.apps[j]] = [c.apps[j], c.apps[i]];
    c.apps.forEach((a, k) => (a.sort_order = k));
    localStorage.setItem(LS_KEY, JSON.stringify(sites));
    return;
  }
}

// ── 一鍵重設：清空 DB/local 再建立預設模板 ───────────────────
async function resetToDefault() {
  const sb = getSB();
  const def = makeDefaultSite();
  if (!sb) {
    localStorage.setItem(LS_KEY, JSON.stringify(def));
    return { categories: 3, items: 0, pages: 4 };
  }
  // 1) 刪全部 items
  const { data: oldApps } = await sb.from("apps").select("id");
  if (oldApps && oldApps.length) {
    const { error } = await sb.from("apps").delete().in("id", oldApps.map((r) => r.id));
    if (error) throw error;
  }
  // 2) 刪全部 categories
  const { data: oldCats } = await sb.from("categories").select("name");
  if (oldCats && oldCats.length) {
    const { error } = await sb.from("categories").delete().in("name", oldCats.map((r) => r.name));
    if (error) throw error;
  }
  // 3) pages（先刪再建，確保 4 頁齊）
  const { error: delPages } = await sb.from("pages").delete().gte("sort_order", -1);
  if (delPages && !/does not exist/i.test(delPages.message)) { /* 若 table 未有就當係新 */ }
  let catCount = 0;
  for (let pi = 0; pi < def.pages.length; pi++) {
    const p = def.pages[pi];
    const { error: pe } = await sb.from("pages").insert({
      id: p.id, label: p.label, icon: p.icon || "", enabled: p.enabled, sort_order: pi
    });
    if (pe && !/duplicate/i.test(pe.message)) throw pe;
    for (const c of p.categories) {
      const { error: ce } = await sb.from("categories").insert({
        name: c.name, icon: c.icon || "", page: p.id, sort_order: catCount++
      });
      if (ce && !/duplicate/i.test(ce.message)) throw ce;
    }
  }
  return { categories: 3, items: 0, pages: def.pages.length };
}

// ── 改密碼 ──────────────────────────────────────────────────
async function adminChangePassword(next) {
  const sb = getSB();
  if (!sb) throw new Error("demo 模式冇帳號");
  const { error } = await sb.auth.updateUser({ password: next });
  if (error) throw error;
}

// ── 點擊統計（公開頁面每次打開 item 時調用）────────────────────
function trackClick(id) {
  if (!id) return;
  const sb = getSB();
  if (sb) {
    fetch(SUPABASE_CONFIG.url + "/rest/v1/rpc/bump_clicks", {
      method: "POST",
      keepalive: true,
      headers: {
        apikey: SUPABASE_CONFIG.anonKey,
        Authorization: "Bearer " + SUPABASE_CONFIG.anonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_id: id })
    }).catch(() => {});
    return;
  }
  try {
    const ls = JSON.parse(localStorage.getItem(LS_KEY));
    if (ls) {
      for (const p of ls.pages || []) for (const c of p.categories || []) {
        const a = c.apps.find((x) => x._id === id);
        if (a) a.clicks = (a.clicks || 0) + 1;
      }
      localStorage.setItem(LS_KEY, JSON.stringify(ls));
    }
  } catch {}
}

// ── JSON 備份匯出 ────────────────────────────────────────────
function exportSites(sites) {
  const blob = new Blob([JSON.stringify(sites, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "scout-tools-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── 由備份檔一鍵還原（完整覆蓋，唔係合併）────────────────────
async function restoreFromBackup(backup) {
  const sites = normalizeSites(backup);
  const sb = getSB();
  if (!sb) {
    localStorage.setItem(LS_KEY, JSON.stringify(sites));
    let n = 0, c = 0;
    sites.pages.forEach((p) => { c += p.categories.length; p.categories.forEach((x) => (n += x.apps.length)); });
    return { pages: sites.pages.length, categories: c, items: n };
  }
  // 清空
  const { data: oldApps } = await sb.from("apps").select("id");
  if (oldApps && oldApps.length) {
    const { error } = await sb.from("apps").delete().in("id", oldApps.map((r) => r.id));
    if (error) throw error;
  }
  const { data: oldCats } = await sb.from("categories").select("name");
  if (oldCats && oldCats.length) {
    const { error } = await sb.from("categories").delete().in("name", oldCats.map((r) => r.name));
    if (error) throw error;
  }
  // 清空 pages，再按 backup 重建
  try {
    const { data: oldPages } = await sb.from("pages").select("id");
    if (oldPages && oldPages.length) {
      const { error } = await sb.from("pages").delete().in("id", oldPages.map((r) => r.id));
      if (error) throw error;
    }
  } catch {}
  let catCount = 0, itemCount = 0;
  for (let pi = 0; pi < sites.pages.length; pi++) {
    const p = sites.pages[pi];
    const { error: pe } = await sb.from("pages").insert({
      id: p.id, label: p.label, icon: p.icon || "", enabled: p.enabled !== false, sort_order: pi
    });
    if (pe && !/duplicate/i.test(pe.message)) throw pe;
    for (const c of p.categories) {
      const { error: ce } = await sb.from("categories").insert({
        name: c.name, icon: c.icon || "", page: p.id, sort_order: catCount++
      });
      if (ce && !/duplicate/i.test(ce.message)) throw ce;
      for (const a of c.apps) {
        if (!a.name || !a.url) continue;
        let rowPayload = {
          name: a.name, url: a.url, description: a.description || null,
          icon: a.icon || null, iconSource: a.iconSource || null,
          github: a.github || null, note: a.note || null,
          category: c.name, page: p.id, tags: a.tags || [],
          visible: a.visible !== false, clicks: typeof a.clicks === "number" ? a.clicks : 0,
          sort_order: a.sort_order ?? itemCount
        };
        let { error: ae } = await sb.from("apps").insert(rowPayload);
        if (ae && /icon_source/i.test(ae.message || "")) {
          const { iconSource, ...rest } = rowPayload;
          rowPayload = rest;
          ({ error: ae } = await sb.from("apps").insert(rowPayload));
        }
        if (ae) throw ae;
        itemCount++;
      }
    }
  }
  return { pages: sites.pages.length, categories: sites.pages.reduce((n, p) => n + p.categories.length, 0), items: itemCount };
}
