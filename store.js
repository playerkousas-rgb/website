/* ════════════════════════════════════════════════════════════════
   數據層 store.js
   讀取優先序：Supabase（已配置）→ localStorage（demo）→ apps.json
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

function getSB() {
  if (SUPABASE_CONFIG.url && typeof window.supabase !== "undefined") {
    if (!_sb) _sb = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }
  return _sb;
}

function rowsToApp(r) {
  return {
    name: r.name,
    url: r.url,
    description: r.description || null,
    icon: r.icon || null,
    github: r.github || null,
    note: r.note || null,
    visible: r.visible !== false,
    clicks: r.clicks || 0,
    sort_order: r.sort_order ?? 0,
    _id: r.id
  };
}

async function loadSites() {
  const sb = getSB();
  if (sb) {
    const [catsRes, appsRes] = await Promise.all([
      sb.from("categories").select("*").order("sort_order"),
      sb.from("apps").select("*").order("sort_order").order("created_at")
    ]);
    if (!appsRes.error && appsRes.data) {
      const catList = [];
      const byName = new Map();
      if (!catsRes.error && catsRes.data) {
        for (const c of catsRes.data) {
          const obj = { name: c.name, icon: c.icon || "", apps: [] };
          catList.push(obj);
          byName.set(c.name, obj);
        }
      }
      for (const r of appsRes.data) {
        let c = byName.get(r.category);
        if (!c) {
          c = { name: r.category, icon: "", apps: [] };
          catList.push(c);
          byName.set(c.name, c);
        }
        c.apps.push(rowsToApp(r));
      }
      return {
        source: "supabase",
        sites: { name: "我的 App 展示櫃", sub: "全部 app，一個入口", categories: catList }
      };
    }
  }
  try {
    const ls = JSON.parse(localStorage.getItem(LS_KEY));
    if (ls && ls.categories) return { source: "demo", sites: ls };
  } catch {}
  const res = await fetch("apps.json", { cache: "no-cache" });
  const sites = await res.json();
  return { source: "json", sites };
}

// ── 分類確保存在（Supabase） ─────────────────────────────────
async function ensureCategory(name, icon) {
  const sb = getSB();
  if (!sb) return;
  const { data: exists } = await sb.from("categories").select("name").eq("name", name).maybeSingle();
  if (exists) return;
  const { count } = await sb.from("categories").select("*", { count: "exact", head: true });
  await sb.from("categories").insert({ name, icon: icon || "", sort_order: count || 0 });
}

// ── 首次匯入：apps.json → DB（只補尚未存在嘅 app，按 URL 判重） ──
async function importFromJson() {
  const sb = getSB();
  if (!sb) throw new Error("只可以喺 Supabase 模式用");
  const res = await fetch("apps.json", { cache: "no-cache" });
  const sites = await res.json();
  const { data: existing } = await sb.from("apps").select("url");
  const have = new Set((existing || []).map((r) => r.url));
  let added = 0;
  for (const c of sites.categories) {
    await ensureCategory(c.name, c.icon);
    for (const a of c.apps) {
      if (have.has(a.url)) continue;
      const { error } = await sb.from("apps").insert({
        name: a.name,
        url: a.url,
        description: a.description || null,
        icon: a.icon || null,
        github: a.github || null,
        category: c.name,
        visible: true
      });
      if (error) throw error;
      added++;
    }
  }
  return added;
}

// ── Admin 寫入 ────────────────────────────────────────────────
async function adminSaveApp(app, id) {
  const payload = {
    name: app.name,
    url: app.url,
    description: app.description || null,
    icon: app.icon || null,
    github: app.github || null,
    note: app.note || null,
    category: app.category,
    visible: app.visible !== false
  };
  const sb = getSB();
  if (sb) {
    await ensureCategory(app.category, "");
    const { error } = id
      ? await sb.from("apps").update(payload).eq("id", id)
      : await sb.from("apps").insert(payload);
    if (error) throw error;
    return;
  }
  // demo 模式：整份寫入 localStorage
  const { sites } = await loadSites();
  if (id) {
    for (const c of sites.categories) {
      const i = c.apps.findIndex((a) => a._id === id);
      if (i >= 0) c.apps[i] = { ...c.apps[i], ...payload };
    }
  } else {
    let cat = sites.categories.find((c) => c.name === app.category);
    if (!cat) {
      cat = { name: app.category, icon: "", apps: [] };
      sites.categories.push(cat);
    }
    cat.apps.push({
      ...payload,
      clicks: 0,
      _id: "demo-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)
    });
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
  sites.categories.forEach((c) => (c.apps = c.apps.filter((a) => a._id !== id)));
  sites.categories = sites.categories.filter((c) => c.apps.length);
  localStorage.setItem(LS_KEY, JSON.stringify(sites));
}

// ── 分類：新增 / 排序 ─────────────────────────────────────────
async function adminAddCategory(name, icon) {
  name = (name || "").trim();
  if (!name) throw new Error("分類名稱必填");
  const sb = getSB();
  if (sb) {
    const { data: exists } = await sb.from("categories").select("name").eq("name", name).maybeSingle();
    if (exists) throw new Error("分類已經存在");
    const { count } = await sb.from("categories").select("*", { count: "exact", head: true });
    const { error } = await sb.from("categories").insert({ name, icon: icon || "", sort_order: count || 0 });
    if (error) throw error;
    return;
  }
  const { sites } = await loadSites();
  if (sites.categories.some((c) => c.name === name)) throw new Error("分類已經存在");
  sites.categories.push({ name, icon: icon || "", apps: [] });
  localStorage.setItem(LS_KEY, JSON.stringify(sites));
}

async function adminMoveCategory(name, dir) {
  const sb = getSB();
  if (sb) {
    const { data } = await sb.from("categories").select("*").order("sort_order");
    if (!data || data.length < 2) return;
    const ordered = data.map((c) => c.name);
    const i = ordered.indexOf(name);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    for (let k = 0; k < ordered.length; k++) {
      const cur = data.find((c) => c.name === ordered[k]);
      if (cur.sort_order !== k) {
        await sb.from("categories").update({ sort_order: k }).eq("name", cur.name);
      }
    }
    return;
  }
  const { sites } = await loadSites();
  const i = sites.categories.findIndex((c) => c.name === name);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sites.categories.length) return;
  [sites.categories[i], sites.categories[j]] = [sites.categories[j], sites.categories[i]];
  localStorage.setItem(LS_KEY, JSON.stringify(sites));
}

// ── App 排序（分類之內） ──────────────────────────────────────
async function adminMoveApp(id, dir) {
  const sb = getSB();
  if (sb) {
    const { data: all } = await sb.from("apps").select("*").order("sort_order").order("created_at");
    if (!all) return;
    const app = all.find((a) => a.id === id);
    if (!app) return;
    const siblings = all.filter((a) => a.category === app.category);
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
  for (const c of sites.categories) {
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

// ── 改密碼（只喺管理面板、登入咗先可以用） ─────────────────────
async function adminChangePassword(next) {
  const sb = getSB();
  if (!sb) throw new Error("demo 模式冇帳號");
  const { error } = await sb.auth.updateUser({ password: next });
  if (error) throw error;
}

// ── 點擊統計（公開頁面每次打開 app 時調用） ─────────────────────
function trackClick(id) {
  if (!id) return;
  const sb = getSB();
  if (sb) {
    // 用 REST + keepalive：頁面跳走之前都會送出
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
  // demo 模式
  try {
    const ls = JSON.parse(localStorage.getItem(LS_KEY));
    if (ls) {
      for (const c of ls.categories) {
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
  a.download = "showcase-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
}
