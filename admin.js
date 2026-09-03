/* ════════════════════════════════════════════════════════════════
   管理面板 admin.js
   隱藏入口：你嘅網址 + #admin  →  例如 https://xxx.vercel.app/#admin
   兩個版面：
     ① 管理 — 加 / 減 / 改介紹地址 / 隱藏 / 備註 / 排序 / 分類管理 / 改密碼
     ② 總覽 — 同公開版面一樣嘅預覽（🔒 = 而家隱藏緊）
   Supabase 模式：登入（配置咗 adminEmail 就只使打密碼）
   未配置 Supabase：自動進入 demo 模式（數據只存喺本瀏覽器）
   ════════════════════════════════════════════════════════════════ */

function isAdminRoute() {
  return location.hash === "#admin";
}
const val = (id) => {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
};

const ADMIN = {
  authed: false,
  tab: "manage", // "manage" | "all"
  editId: null,
  form: {},
  sites: null,

  async init() {
    document.getElementById("admin-panel").hidden = false;
    const sb = getSB();
    if (sb) {
      const { data } = await sb.auth.getSession();
      this.authed = !!data?.session;
    } else {
      this.authed = true; // demo 模式
    }
    await this.refresh();
  },

  async refresh() {
    const r = await loadSites();
    this.sites = r.sites;
    renderAdmin();
  },

  setTab(t) {
    this.tab = t;
    renderAdmin();
  },

  async login() {
    const sb = getSB();
    const email = SUPABASE_CONFIG.adminEmail || val("l-email");
    if (!email) {
      document.getElementById("l-err").textContent = "請填 email";
      return;
    }
    const { error } = await sb.auth.signInWithPassword({ email, password: val("l-pass") });
    if (error) {
      document.getElementById("l-err").textContent = error.message;
      return;
    }
    this.authed = true;
    await this.refresh();
  },

  async logout() {
    await getSB().auth.signOut();
    this.authed = false;
    renderAdmin();
  },

  async changePassword() {
    const p1 = prompt("新密碼（至少 8 個字符）：");
    if (!p1) return;
    if (p1.length < 8) {
      alert("密碼要至少 8 個字符");
      return;
    }
    const p2 = prompt("請再輸入一次新密碼：");
    if (p1 !== p2) {
      alert("兩次輸入唔同");
      return;
    }
    try {
      await adminChangePassword(p1);
      alert("改咗密碼 ✅ 而家可以把新密碼俾其他需要用嘅人");
    } catch (e) {
      alert("改密碼失敗：" + e.message + "\n（都可以喺 Supabase Dashboard → Authentication → Users 改）");
    }
  },

  async submit() {
    const name = val("f-name");
    const url = val("f-url");
    const catSel = val("f-cat");
    const category = catSel === "__new__" ? val("f-cat-new") : catSel;
    const visEl = document.getElementById("f-visible");
    if (!name || !url || !category) {
      alert("名稱、URL、分類都係必填");
      return;
    }
    try {
      await adminSaveApp(
        {
          name,
          url,
          description: val("f-desc"),
          icon: val("f-icon"),
          github: val("f-gh"),
          note: val("f-note"),
          category,
          visible: visEl ? visEl.checked : true
        },
        this.editId
      );
      this.editId = null;
      this.form = {};
      await this.refresh();
    } catch (e) {
      alert("保存失敗：" + e.message);
    }
  },

  findApp(id) {
    for (const c of this.sites.categories) {
      const a = c.apps.find((x) => x._id === id);
      if (a) return { ...a, category: c.name };
    }
    return null;
  },

  edit(id) {
    const a = this.findApp(id);
    if (a) {
      this.editId = id;
      this.form = a;
      this.tab = "manage";
      renderAdmin();
      window.scrollTo({ top: 0 });
    }
  },

  cancelEdit() {
    this.editId = null;
    this.form = {};
    renderAdmin();
  },

  async toggleVisible(id) {
    const a = this.findApp(id);
    if (!a) return;
    try {
      await adminSaveApp({ ...a, visible: a.visible === false }, id);
      if (this.editId === id) {
        this.editId = null;
        this.form = {};
      }
      await this.refresh();
    } catch (e) {
      alert("操作失敗：" + e.message);
    }
  },

  async remove(id) {
    const a = this.findApp(id);
    if (!a || !confirm(`確定刪除「${a.name}」？呢個操作不可逆。`)) return;
    try {
      await adminDeleteApp(id);
      if (this.editId === id) {
        this.editId = null;
        this.form = {};
      }
      await this.refresh();
    } catch (e) {
      alert("刪除失敗：" + e.message);
    }
  },

  // 排序
  async moveApp(id, dir) {
    try {
      await adminMoveApp(id, dir);
      await this.refresh();
    } catch (e) {
      alert("排序失敗：" + e.message);
    }
  },

  async moveCat(name, dir) {
    try {
      await adminMoveCategory(name, dir);
      await this.refresh();
    } catch (e) {
      alert("分類排序失敗：" + e.message);
    }
  },

  async addCat() {
    const name = prompt("新分類名稱：");
    if (!name || !name.trim()) return;
    const icon = prompt("分類圖標（emoji，可留空）：") || "";
    try {
      await adminAddCategory(name, icon);
      await this.refresh();
    } catch (e) {
      alert("新增分類失敗：" + e.message);
    }
  },

  doExport() {
    if (this.sites) exportSites(this.sites);
  },

  async doImport() {
    if (!confirm("由 apps.json 匯入所有尚未存在嘅 app 入 DB？（按 URL 判重，唔會重複）")) return;
    try {
      const n = await importFromJson();
      alert(`匯入咗 ${n} 個 app`);
      await this.refresh();
    } catch (e) {
      alert("匯入失敗：" + e.message);
    }
  },

  doQR() {
    const target = location.origin + location.pathname;
    window.open(
      "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" + encodeURIComponent(target),
      "_blank"
    );
  },

  close() {
    history.replaceState(null, "", location.pathname + location.search);
    location.reload();
  }
};

function loginHTML() {
  const preset = SUPABASE_CONFIG.adminEmail;
  return `
  <div class="admin-card" style="max-width:420px">
    <h2>🔐 管理員登入</h2>
    <p style="font-size:13px;color:var(--muted);margin:4px 0 10px">
      ${preset ? "帳號已預填，只需要打密碼。" : "只有已授權用戶（你自己）可以登入。"}
      設置方法見 README.md
    </p>
    ${
      preset
        ? `<div class="admin-lbl">帳號</div>
           <input style="width:100%" value="${esc(preset)}" disabled />`
        : `<div class="admin-lbl">Email</div>
           <input id="l-email" type="email" style="width:100%" placeholder="you@example.com" />`
    }
    <div class="admin-lbl">Password</div>
    <input id="l-pass" type="password" style="width:100%" placeholder="••••••••" />
    <div style="margin-top:14px;display:flex;gap:8px">
      <button class="mini-btn" onclick="ADMIN.login()">登入</button>
      <button class="mini-btn" onclick="ADMIN.close()">返回</button>
    </div>
    <div id="l-err" style="color:#ef4444;font-size:13px;margin-top:8px"></div>
  </div>`;
}

function manageHTML() {
  const f = ADMIN.form;
  const cats = ADMIN.sites.categories.map((c) => c.name);
  return `
  <div class="admin-card">
    <div class="admin-lbl">${ADMIN.editId ? "✏️ 編輯 app" : "＋ 新增 app"}</div>
    <div class="admin-row">
      <input id="f-name" placeholder="名稱 *" value="${esc(f.name || "")}" />
      <input id="f-url" placeholder="URL *（https://…vercel.app）" value="${esc(f.url || "")}" />
    </div>
    <div class="admin-row">
      <select id="f-cat">
        ${cats.map((c) => `<option value="${esc(c)}" ${f.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
        <option value="__new__" ${f.category === "__new__" ? "selected" : ""}>＋ 新分類…</option>
      </select>
      <input id="f-cat-new" placeholder="新分類名稱" style="display:${f.category === "__new__" ? "" : "none"}" value="${esc(f.category === "__new__" ? f.newCat || "" : "")}" />
    </div>
    <div class="admin-row">
      <input id="f-desc" placeholder="介紹（顯示喺公開版面，可選）" value="${esc(f.description || "")}" />
    </div>
    <div class="admin-row">
      <input id="f-icon" placeholder="圖標 emoji（可選）" value="${esc(f.icon || "")}" style="max-width:120px" />
      <input id="f-gh" placeholder="GitHub repo（可選）" value="${esc(f.github || "")}" />
    </div>
    <div class="admin-row">
      <input id="f-note" placeholder="內部備註（只有管理版面見到，可選）" value="${esc(f.note || "")}" />
    </div>
    <div class="admin-row">
      <label class="vis-lbl">
        <input id="f-visible" type="checkbox" ${f.visible !== false ? "checked" : ""} />
        公開顯示（取消 = 隱藏，公眾唔見）
      </label>
    </div>
    <div class="admin-row" style="margin-top:12px">
      <button class="mini-btn" onclick="ADMIN.submit()">💾 ${ADMIN.editId ? "儲存" : "加入"}</button>
      ${ADMIN.editId ? '<button class="mini-btn" onclick="ADMIN.cancelEdit()">取消</button>' : ""}
    </div>
    <div class="admin-lbl">目前嘅 apps（▲▼ 排序｜隱藏/顯示即時生效）</div>
    ${listHTML()}
    <div style="margin-top:10px">
      <button class="mini-btn" onclick="ADMIN.addCat()">＋ 新增分類</button>
    </div>
  </div>`;
}

function listHTML() {
  return ADMIN.sites.categories
    .map(
      (c, ci) => `
    <div style="display:flex;align-items:center;gap:6px;margin:12px 0 4px">
      <span style="font-size:13px;font-weight:700">${c.icon ? c.icon + " " : ""}${esc(c.name)}</span>
      <span style="flex:1"></span>
      <button class="mini-btn" title="分類上移" onclick='ADMIN.moveCat(${JSON.stringify(c.name)}, -1)'>▲</button>
      <button class="mini-btn" title="分類下移" onclick='ADMIN.moveCat(${JSON.stringify(c.name)}, 1)'>▼</button>
    </div>
    ${c.apps
      .map(
        (a) => `
      <div class="admin-app-row">
        <span>${a.icon || "📦"}</span>
        <b>${esc(a.name)}</b>
        ${a.visible === false ? '<span class="lock-tag">🔒 隱藏</span>' : ""}
        <span class="u" title="${esc(a.note || "")}">${esc(a.url)}${a.note ? " · 📌" : ""}${a.clicks ? ` · ${a.clicks} 次打開` : ""}</span>
        <button class="mini-btn" title="上移" onclick='ADMIN.moveApp(${JSON.stringify(a._id || "")}, -1)'>▲</button>
        <button class="mini-btn" title="下移" onclick='ADMIN.moveApp(${JSON.stringify(a._id || "")}, 1)'>▼</button>
        <button class="mini-btn" onclick='ADMIN.edit(${JSON.stringify(a._id || "")})'>編輯</button>
        <button class="mini-btn" onclick='ADMIN.toggleVisible(${JSON.stringify(a._id || "")})'>${a.visible === false ? "顯示" : "隱藏"}</button>
        <button class="mini-btn danger" onclick='ADMIN.remove(${JSON.stringify(a._id || "")})'>刪除</button>
      </div>`
      )
      .join("")}`
    )
    .join("");
}

function allViewHTML() {
  const allApps = [];
  ADMIN.sites.categories.forEach((c) => c.apps.forEach((a) => allApps.push(a)));
  const visibleCount = allApps.filter((a) => a.visible !== false).length;
  const sections = ADMIN.sites.categories
    .map(
      (c) => `
    <div style="font-size:13px;font-weight:700;margin:14px 0 8px">${c.icon ? c.icon + " " : ""}${esc(c.name)}</div>
    <div class="grid" style="grid-template-columns:repeat(4,1fr)">${tilesForCat(c)}</div>`
    )
    .join("");
  return `
  <div class="admin-card">
    <div class="banner ok">呢個就係公眾見到嘅版面（共 ${allApps.length} 個：${visibleCount} 個公開、${allApps.length - visibleCount} 個隱藏）。🔒 = 目前隱藏緊，公眾唔見。</div>
    ${sections || '<p style="color:var(--muted);font-size:13px">仲未有任何 app</p>'}
  </div>`;
}

function tilesForCat(cat) {
  return cat.apps
    .map((a) => {
      const [g1, g2] = tileBg(a.name);
      let inner = "";
      if (a.icon) {
        if (/^https?:\/\//i.test(a.icon)) inner = `<img src="${esc(a.icon)}" alt="" />`;
        else inner = esc(a.icon);
      }
      return `
      <a class="tile" href="${esc(a.url)}" title="${esc((a.description || "") + (a.visible === false ? "（隱藏中）" : ""))}">
        ${a.visible === false ? '<span class="lock-tag" style="position:absolute;top:-5px;right:-5px">🔒</span>' : ""}
        <div class="tile-icon" style="background:linear-gradient(135deg,${g1},${g2})">${inner || "📦"}</div>
        <div class="tile-name">${esc(a.name)}</div>
        ${a.description ? `<div class="tile-desc">${esc(a.description)}</div>` : ""}
      </a>`;
    })
    .join("");
}

function renderAdmin() {
  const el = document.getElementById("admin-content");
  const sb = getSB();

  if (sb && !ADMIN.authed) {
    el.innerHTML = loginHTML();
    return;
  }
  if (!ADMIN.sites) {
    el.innerHTML = '<div class="admin-card">載入中…</div>';
    return;
  }

  el.innerHTML = `
  <div class="admin-card">
    <div class="admin-head">
      <img class="admin-logo" src="/icons/icon-192.png" alt="" onclick="goldfingerClick()" />
      <h2>⚙️ 管理面板</h2>
    </div>
    ${
      sb
        ? '<div class="banner ok">已連接 Supabase — 改動即時生效，所有人都見到</div>'
        : '<div class="banner warn">⚠️ Demo 模式（未配置 Supabase）：改動只存喺你嘅瀏覽器，唔會同步。配置方法見 README.md</div>'
    }
    <div class="tab-bar">
      <button class="tab-btn ${ADMIN.tab === "manage" ? "on" : ""}" onclick="ADMIN.setTab('manage')">🛠 管理</button>
      <button class="tab-btn ${ADMIN.tab === "all" ? "on" : ""}" onclick="ADMIN.setTab('all')">👀 全部 App 總覽</button>
    </div>
    ${ADMIN.tab === "manage" ? manageHTML() : allViewHTML()}
    <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="mini-btn" onclick="ADMIN.doExport()">📤 備份 JSON</button>
      <button class="mini-btn" onclick="ADMIN.doQR()">🔳 QR code</button>
      ${sb && ADMIN.authed ? '<button class="mini-btn" onclick="ADMIN.doImport()">📥 匯入 apps.json</button>' : ""}
      <span style="flex:1"></span>
      <button class="mini-btn" onclick="ADMIN.close()">✅ 完成，返回展示櫃</button>
      ${sb && ADMIN.authed ? '<button class="mini-btn danger" onclick="ADMIN.logout()">登出</button>' : ""}
    </div>
  </div>`;

  const sel = document.getElementById("f-cat");
  if (sel) {
    sel.onchange = (e) => {
      document.getElementById("f-cat-new").style.display = e.target.value === "__new__" ? "" : "none";
    };
  }
}
