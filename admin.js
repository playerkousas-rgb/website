/* ════════════════════════════════════════════════════════════════
   管理面板 admin.js（童軍小工具 · 多分頁）
   隱藏入口：你嘅網址 + #admin
   兩個版面：
   ① 管理 — 分頁開/關、每頁加分類、改/刪分類、每頁加/改/刪項目、
            童軍級別標籤、排序、公開顯示(逐個開/關)、改密碼
   ② 總覽 — 同公開版面一樣嘅預覽（🔒 = 隱藏緊）
   額外：
   ♻️ 一鍵重設 —— 清空 DB/local 再建立「預設模板」（4分頁 + 三分類）
   📤 備份｜♻️ 還原（完整覆蓋）
   Supabase 模式：登入；未配置自動入 demo 模式（存本瀏覽器）
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
  _listener: false,

  async init() {
    document.getElementById("admin-panel").hidden = false;
    const sb = getSB();
    if (sb) {
      const { data } = await sb.auth.getSession();
      this.authed = !!data?.session;
    } else {
      this.authed = true;
    }
    if (!this._listener) {
      this._listener = true;
      const root = document.getElementById("admin-content");
      root.addEventListener("click", (e) => ADMIN.onAction(e));
      // 勾選狀態即時反映喺 UI（級別標籤／分頁開關／公開顯示）
      root.addEventListener("change", (e) => {
        const tc = e.target.closest(".tag-check");
        if (tc) tc.classList.toggle("on", e.target.checked);
        const po = e.target.closest(".page-on");
        if (po) {
          po.classList.toggle("on", e.target.checked);
          const txt = po.querySelector(".page-on-txt");
          if (txt) txt.textContent = e.target.checked ? "開放中" : "已關閉";
        }
        const vl = e.target.closest(".vis-lbl");
        if (vl) {
          vl.classList.toggle("on", e.target.checked);
          const txt = vl.querySelector(".vis-txt");
          if (txt) txt.textContent = e.target.checked ? "公開顯示中" : "已隱藏";
        }
      });
    }
    await this.refresh();
  },

  async refresh() {
    const r = await loadSites();
    this.sites = r.sites;
    renderAdmin();
  },

  setTab(t) { this.tab = t; renderAdmin(); },

  async login() {
    const sb = getSB();
    const email = SUPABASE_CONFIG.adminEmail || val("l-email");
    if (!email) { document.getElementById("l-err").textContent = "請填 email"; return; }
    const { error } = await sb.auth.signInWithPassword({ email, password: val("l-pass") });
    if (error) { document.getElementById("l-err").textContent = error.message; return; }
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
    if (p1.length < 8) { alert("密碼要至少 8 個字符"); return; }
    const p2 = prompt("請再輸入一次新密碼：");
    if (p1 !== p2) { alert("兩次輸入唔同"); return; }
    try { await adminChangePassword(p1); alert("改咗密碼 ✅"); }
    catch (e) { alert("改密碼失敗：" + e.message + "\n（可以去 Supabase Dashboard → Authentication → Users 改）"); }
  },

  // ── 資料輔助 ─────────────────────────────
  findApp(id) {
    for (const p of this.sites.pages) for (const c of p.categories) {
      const a = c.apps.find((x) => x._id === id);
      if (a) return { ...a, category: c.name, page: p.id };
    }
    return null;
  },
  catsOfPage(pageId) {
    const p = this.sites.pages.find((x) => x.id === pageId);
    return p ? p.categories : [];
  },

  edit(id) {
    const a = this.findApp(id);
    if (a) { this.editId = id; this.form = a; this.tab = "manage"; renderAdmin(); window.scrollTo({ top: 0 }); }
  },
  cancelEdit() { this.editId = null; this.form = {}; renderAdmin(); },

  // 新增/儲存項目（含分頁 + 分類 + 標籤）
  submit() {
    const pageSel = document.getElementById("f-page");
    const page = pageSel ? pageSel.value : this.form.page || "apps";
    const catSel = document.getElementById("f-cat");
    const category = catSel && catSel.value === "__new__"
      ? val("f-cat-new") : (catSel ? catSel.value : this.form.category);
    const name = val("f-name");
    const url = val("f-url");
    if (!name || !url || !category || !page) { alert("名稱、URL、分頁、分類都係必填"); return; }
    const tags = SCOUT_TAGS.filter((t) => {
      const el = document.getElementById("tag-" + t);
      return el && el.checked;
    });
    const visEl = document.getElementById("f-visible");
    // 圖示來源：radio 值優先；冇 radio 嘅就睇舊 icon 內容猜
    const srcRadio = document.querySelector('input[name="f-iconSource"]:checked');
    const iconSource = srcRadio ? srcRadio.value : iconSourceOf(this.form);
    // emoji 從 #f-icon 拎，upload 從 #f-icon-url 拎（兩個 input 唔同 id）
    const rawIcon = iconSource === "emoji" ? val("f-icon")
                   : iconSource === "upload" ? val("f-icon-url")
                   : "";
    // 「favicon」/「none」會忽略 icon 欄位（避免舊 emoji/URL 殘留）
    const icon = (iconSource === "emoji" || iconSource === "upload") ? rawIcon : "";
    try {
      adminSaveApp({
        name, url, page, category, tags,
        description: val("f-desc"), icon, iconSource,
        github: val("f-gh"), note: val("f-note"),
        visible: visEl ? visEl.checked : true
      }, this.editId).then(() => {
        this.editId = null; this.form = {};
        return this.refresh();
      }).catch((e) => alert("保存失敗：" + e.message));
    } catch (e) { alert("保存失敗：" + e.message); }
  },

  async removeItem(id) {
    const a = this.findApp(id);
    if (!a || !confirm(`確定刪除「${a.name}」？呢個操作不可逆。`)) return;
    try {
      await adminDeleteApp(id);
      if (this.editId === id) { this.editId = null; this.form = {}; }
      await this.refresh();
    } catch (e) { alert("刪除失敗：" + e.message); }
  },
  async toggleVisible(id) {
    const a = this.findApp(id);
    if (!a) return;
    try {
      await adminSaveApp({ ...a, visible: a.visible === false }, id);
      if (this.editId === id) { this.editId = null; this.form = {}; }
      await this.refresh();
    } catch (e) { alert("操作失敗：" + e.message); }
  },
  async moveApp(id, dir) {
    try { await adminMoveApp(id, dir); await this.refresh(); }
    catch (e) { alert("排序失敗：" + e.message); }
  },

  // ── 分類動作 ─────────────────────────────
  addCatFlow(page) {
    const name = prompt("新分類名稱：");
    if (!name || !name.trim()) return;
    openEmojiPicker((emoji) => {
      adminAddCategory(page, name.trim(), emoji || "")
        .then(() => this.refresh())
        .catch((e) => alert("新增分類失敗：" + e.message));
    });
  },
  async renameCat(page, name) {
    const nn = prompt("改名做（重新輸入）：", name);
    if (!nn || !nn.trim() || nn.trim() === name) return;
    try { await adminRenameCategory(page, name, nn.trim()); await this.refresh(); }
    catch (e) { alert("改名失敗：" + e.message); }
  },
  async setCatIcon(page, name) {
    openEmojiPicker(async (emoji) => {
      try { await adminSetCategoryIcon(page, name, emoji || ""); await this.refresh(); }
      catch (e) { alert("改 icon 失敗：" + e.message); }
    });
  },
  async deleteCat(page, name) {
    const pg = this.sites.pages.find((p) => p.id === page);
    const c = pg && pg.categories.find((x) => x.name === name);
    const n = c ? c.apps.length : 0;
    if (!confirm(`確定刪除分類「${name}」？\n${n ? "連帶佢入面 " + n + " 個項目一齊刪。\n" : ""}呢個操作不可逆。`)) return;
    try { await adminDeleteCategory(page, name); await this.refresh(); }
    catch (e) { alert("刪除失敗：" + e.message); }
  },
  async moveCat(page, name, dir) {
    try { await adminMoveCategory(page, name, dir); await this.refresh(); }
    catch (e) { alert("分類排序失敗：" + e.message); }
  },

  // ── 分頁開關 ─────────────────────────────
  async togglePage(id) {
    const pg = this.sites.pages.find((p) => p.id === id);
    if (!pg) return;
    try { await adminSetPageEnabled(id, !pg.enabled); await this.refresh(); }
    catch (e) { alert("開關分頁失敗：" + e.message); }
  },

  // ── 一鍵重設 ─────────────────────────────
  async resetAll() {
    const msg = "一鍵重設會：\n\n" +
      "1) 刪走現時 DB / 本機 嘅所有項目同分類\n" +
      "2) 建立「預設模板」：\n" +
      "   · 小工具 Apps 分頁（開放）＋ 三分類：電子進度紀錄 / 小工具 / 小遊戲\n" +
      "   · 學習圖卡、PPT 簡報、有用連結 三分頁（暫關閉，之後逐個開）\n\n" +
      "⚠️ 不可逆，會完整覆蓋而家所有資料。確定要繼續？";
    if (!confirm(msg)) return;
    if (!confirm("再確認一次：真係要清空全部資料並重設？")) return;
    try {
      const r = await resetToDefault();
      alert(`重設完成 ✅\n${r.pages} 個分頁 · ${r.categories} 個分類（已清空，可以開始加內容）`);
      this.editId = null; this.form = {};
      await this.refresh();
    } catch (e) { alert("重設失敗：" + e.message + "\n（可能需要先去 Supabase 執行 README 嘅 migration SQL）"); }
  },

  // ── 備份 / 還原 ─────────────────────────
  doExport() { if (this.sites) exportSites(this.sites); },
  doRestore() {
    let input = document.getElementById("restore-file");
    if (!input) {
      input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.id = "restore-file";
      input.hidden = true;
      document.body.appendChild(input);
      input.addEventListener("change", () => this._onRestoreFile(input));
    }
    input.value = "";
    input.click();
  },
  async _onRestoreFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    let backup;
    try { backup = JSON.parse(await file.text()); }
    catch { alert("讀唔到呢個檔案 — 請揀「📤 備份」下載嘅 .json 檔"); return; }
    if (!backup || !(Array.isArray(backup.pages) || Array.isArray(backup.categories))) {
      alert("備份檔格式唔啱 — 需要 pages/categories 陣列（同「📤 備份」下載嘅格式）");
      return;
    }
    let cN = 0, iN = 0;
    const pages = backup.pages || [{ categories: backup.categories }];
    pages.forEach((p) => (p.categories || []).forEach((c) => { cN++; iN += (c.apps || []).length; }));
    if (!confirm(`確定用「${file.name}」還原？\n會有 ${pages.length} 個分頁、${cN} 個分類、${iN} 個項目。\n⚠️ 現有資料會被完整覆蓋（唔係合併），不可逆。`)) return;
    if (!confirm("再確認一次：真係要覆蓋而家全部資料？")) return;
    try {
      const r = await restoreFromBackup(backup);
      alert(`還原完成 ✅\n${r.pages} 個分頁 · ${r.categories} 個分類 · ${r.items} 個項目`);
      this.editId = null; this.form = {};
      await this.refresh();
    } catch (e) { alert("還原失敗：" + e.message); }
  },

  doQR() {
    const target = location.origin + location.pathname;
    window.open("https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" + encodeURIComponent(target), "_blank");
  },
  close() { history.replaceState(null, "", location.pathname + location.search); location.reload(); },

  // ── 委派動作 ─────────────────────────────
  onAction(e) {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    const act = t.dataset.act;
    const p = t.dataset.page, n = t.dataset.name, d = t.dataset.dir, id = t.dataset.id;
    if (act === "page-toggle") { this.togglePage(p); }
    else if (act === "page-addcat") { this.addCatFlow(p); }
    else if (act === "cat-rename") { this.renameCat(p, n); }
    else if (act === "cat-icon") { this.setCatIcon(p, n); }
    else if (act === "cat-del") { this.deleteCat(p, n); }
    else if (act === "cat-move") { this.moveCat(p, n, Number(d)); }
    else if (act === "item-edit") { this.edit(id); }
    else if (act === "item-hide") { this.toggleVisible(id); }
    else if (act === "item-del") { this.removeItem(id); }
    else if (act === "item-move") { this.moveApp(id, Number(d)); }
    else if (act === "reset") { this.resetAll(); }
  }
};

/* ── Emoji 揀選 ───────────────────────────────────────────
   WhatsApp 式：分「種類」tag ＋ 搜尋 ＋ 最近用過 ＋ 常用。 */
let EMOJI_CB = null;
let _emojiCtx = null;   // { recent, tab, query } 開picker 嗰下嘅狀態
function buildEmojiGrid(emojiArr) {
  return emojiArr.map((x) => `<button type="button" class="emoji-cell" data-emoji="${esc(x)}">${x}</button>`).join("");
}
function refreshEmojiPanel() {
  const grid = document.querySelector("#emoji-panel .emoji-grid");
  if (!grid) return;
  const ctx = _emojiCtx || { tab: "recent", query: "" };
  const q = (ctx.query || "").trim().toLowerCase();
  let html = "";
  if (q) {
    const res = emojiSearch(q);
    const hits = res.hits.slice(0, 40);
    if (hits.length) {
      html = buildEmojiGrid(hits.map((h) => h.e)) +
        `<div class="emoji-none-hint">結果唔啱？可以喺下面每個分類入面直接揀，或者自己打喺輸入框</div>`;
    } else {
      html = `<div class="emoji-none-hint">搵唔到「${esc(q)}」相關嘅 emoji，可以喺分類度直接揀</div>`;
    }
  } else if (ctx.tab === "recent") {
    const rec = (ctx.recent || []).slice(0, 40);
    html = rec.length ? buildEmojiGrid(rec) : `<div class="emoji-none-hint">未用過 emoji — 揀咗一個之後會喺度記住，方便下次快揀</div>`;
  } else if (ctx.tab === "all") {
    html = buildEmojiGrid(EMOJI_ALL);
  } else {
    const g = EMOJI_GROUPS.find((x) => x.key === ctx.tab);
    html = g ? buildEmojiGrid(g.emojis) : "";
  }
  grid.innerHTML = html;
}
function openEmojiPicker(cb) {
  EMOJI_CB = cb;
  // 上一格揀咗／而家開嗰刻：記住最近用過同個 tab
  _emojiCtx = { recent: emojiRecentGet(), tab: _emojiCtx && _emojiCtx.tab !== "recent" ? _emojiCtx.tab : "recent", query: "" };
  let panel = document.getElementById("emoji-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "emoji-panel";
    panel.className = "emoji-panel";
    const tabs = EMOJI_GROUPS.map((g) =>
      `<button type="button" class="emoji-tab" data-emoji-tab="${g.key}" title="${esc(g.label.replace(/^.{1,2}\s/, ""))}">${esc(g.label)}</button>`).join("");
    panel.innerHTML = `
      <div class="emoji-panel-inner">
        <div class="emoji-panel-head">揀個 emoji <span class="spacer"></span><button type="button" class="mini-btn iconish" data-emoji-close="1">×</button></div>
        <input id="emoji-search" class="emoji-search" type="search" placeholder="🔍 搜尋 emoji（例如：露營、地圖、獎…）" autocomplete="off" enterkeyhint="done" />
        <div class="emoji-tabs">
          <button type="button" class="emoji-tab on" data-emoji-tab="recent">🕘 最近</button>
          <button type="button" class="emoji-tab" data-emoji-tab="all">☰ 全部</button>
          ${tabs}
        </div>
        <div class="emoji-grid"></div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="mini-btn" data-emoji-none="1">🚫 不用 emoji（預設用我哋 Logo）</button>
          <span class="emoji-total">共 ${EMOJI_ALL.length} 個</span>
        </div>
      </div>`;
    const syncTabs = () => {
      panel.querySelectorAll(".emoji-tab").forEach((b) => {
        const on = _emojiCtx && (_emojiCtx.query ? false : b.dataset.emojiTab === _emojiCtx.tab);
        b.classList.toggle("on", !!on);
      });
    };
    const setTab = (k) => { if (_emojiCtx) { _emojiCtx.tab = k; _emojiCtx.query = ""; const s = document.getElementById("emoji-search"); if (s) s.value = ""; } refreshEmojiPanel(); syncTabs(); };
    panel.addEventListener("click", (e) => {
      const cell = e.target.closest("[data-emoji]");
      const tab = e.target.closest("[data-emoji-tab]");
      const none = e.target.closest("[data-emoji-none]");
      const close = e.target.closest("[data-emoji-close]");
      if (cell && EMOJI_CB) { const cb = EMOJI_CB; EMOJI_CB = null; emojiRecentPush(cell.dataset.emoji); panel.hidden = true; cb(cell.dataset.emoji); }
      else if (tab) setTab(tab.dataset.emojiTab);
      else if (none && EMOJI_CB) { const cb = EMOJI_CB; EMOJI_CB = null; panel.hidden = true; cb(""); }
      else if (close) { EMOJI_CB = null; panel.hidden = true; }
    });
    const search = panel.querySelector("#emoji-search");
    if (search) {
      search.addEventListener("input", () => { if (_emojiCtx) _emojiCtx.query = search.value; refreshEmojiPanel(); syncTabs(); });
      search.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") e.preventDefault(); // 唔好捲頁
      });
    }
    document.body.appendChild(panel);
  }
  panel.hidden = false;
  refreshEmojiPanel();
  const tabsBar = panel.querySelectorAll(".emoji-tab");
  tabsBar.forEach((b) => {
    const on = _emojiCtx && (_emojiCtx.query ? false : b.dataset.emojiTab === _emojiCtx.tab);
    b.classList.toggle("on", !!on);
  });
  const qb = document.getElementById("emoji-search");
  if (qb) { qb.value = ""; requestAnimationFrame(() => qb.focus()); }
}
function pickIntoInput(inputId) {
  openEmojiPicker((emoji) => {
    const el = document.getElementById(inputId);
    if (el) el.value = emoji;
    const src = document.querySelector('input[name="f-iconSource"]');
    if (src) onIconSourceChange("emoji");
  });
}

/* ── 登入頁 ─────────────────────────────────────────────── */
function loginHTML() {
  const preset = SUPABASE_CONFIG.adminEmail;
  return `
  <div class="login-wrap">
  <div class="admin-card">
    <div class="admin-head">
      <img class="admin-logo" src="/icons/icon-192.png" alt="" />
      <h2>🔐 管理員登入</h2>
    </div>
    <p style="font-size:13px;color:var(--muted);margin:4px 0 6px;line-height:1.5">${preset ? "帳號已預填，只需要打密碼。" : "只有已授權用戶可以登入。"}</p>
    ${preset
      ? `<div class="admin-lbl">帳號</div><input style="width:100%" value="${esc(preset)}" disabled autocomplete="username" />`
      : `<div class="admin-lbl">Email</div><input id="l-email" type="email" style="width:100%" placeholder="you@example.com" autocomplete="username" inputmode="email" />`}
    <div class="admin-lbl">Password</div>
    <input id="l-pass" type="password" style="width:100%" placeholder="••••••••" autocomplete="current-password" />
    <div class="admin-actions" style="margin-top:16px">
      <button class="mini-btn primary full" onclick="ADMIN.login()">登入</button>
      <button class="mini-btn full" onclick="ADMIN.close()">返回展示櫃</button>
    </div>
    <div id="l-err" style="color:var(--danger);font-size:13px;margin-top:10px;min-height:1.2em"></div>
  </div>
  </div>`;
}

/* ── 新增/編輯項目 表單 ─────────────────────────────────── */
function tagCheckHTML(checkedTags) {
  return `<div class="tag-check-wrap">` +
    SCOUT_TAGS.map((t) => {
      const on = Array.isArray(checkedTags) && checkedTags.includes(t);
      return `<label class="tag-check ${on ? "on" : ""}">
        <input type="checkbox" id="tag-${esc(t)}" ${on ? "checked" : ""} />
        <span class="tc-box" aria-hidden="true"></span>${esc(t)}</label>`;
    }).join("") + `</div>`;
}

function formHTML() {
  const f = ADMIN.form;
  const edit = !!ADMIN.editId;
  const pages = ADMIN.sites.pages;
  // 編輯時用 item 本身分頁；新增用第一個開放/Apps 分頁
  const selPage = f.page || (pages.find((p) => p.id === "apps") ? "apps" : pages[0].id);
  const cats = ADMIN.catsOfPage(selPage);
  const catInList = cats.some((c) => c.name === f.category);
  return `
  <div class="admin-card">
    <div class="admin-lbl">${edit ? "✏️ 編輯項目" : "＋ 新增項目"}</div>
    <div class="admin-row">
      <input id="f-name" placeholder="名稱 *" value="${esc(f.name || "")}" autocomplete="off" />
      <input id="f-url" placeholder="連結 URL *（https://…）" value="${esc(f.url || "")}" inputmode="url" autocomplete="off" />
    </div>
    <div class="admin-row">
      <select id="f-page">
        ${pages.map((p) => `<option value="${esc(p.id)}" ${p.id === selPage ? "selected" : ""}>${esc((p.icon ? p.icon + " " : "") + p.label)}${p.enabled ? "" : "（關閉中）"}</option>`).join("")}
      </select>
      <select id="f-cat">
        ${cats.map((c) => `<option value="${esc(c.name)}" ${(!edit && f.category === c.name) || (edit && c.name === f.category) ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
        <option value="__new__" ${f.category === "__new__" ? "selected" : ""}>＋ 呢頁新分類…</option>
      </select>
    </div>
    <input id="f-cat-new" placeholder="新分類名稱（喺揀定嘅分頁開新分類）" style="display:${f.category === "__new__" ? "" : "none"};margin-top:8px;min-height:44px;padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);width:100%" value="${esc(edit && !catInList ? f.category : "")}" />
    <div class="admin-lbl">適用童軍級別（可多選，公開版可篩選）</div>
    ${tagCheckHTML(f.tags)}
    <div class="admin-lbl">介紹（公開版面顯示，可選）</div>
    <input id="f-desc" placeholder="介紹…" value="${esc(f.description || "")}" />
    <div class="admin-lbl">圖示來源</div>
    ${iconSourceHTML(f)}
    <div id="f-icon-wrap">
      <div class="admin-row" id="f-emoji-row" style="${iconSourceOf(f) === "emoji" ? "" : "display:none"}">
        <input id="f-icon" placeholder="emoji" value="${esc(f.icon || "")}" style="flex:2" />
        <button class="mini-btn" onclick="pickIntoInput('f-icon')">🎨 揀 emoji</button>
      </div>
      <div class="admin-row" id="f-upload-row" style="${iconSourceOf(f) === "upload" ? "" : "display:none"}">
        <input id="f-icon-url" placeholder="圖片網址 https://…" value="${esc(f.icon || "")}" style="flex:2" inputmode="url" />
        <span class="muted" style="font-size:12px">用 https 開頭嘅圖片連結</span>
      </div>
    </div>
    <div class="admin-row">
      <input id="f-gh" placeholder="GitHub repo（可選）" value="${esc(f.github || "")}" inputmode="url" />
      <input id="f-note" placeholder="內部備註（只有管理見到）" value="${esc(f.note || "")}" />
    </div>
    <label class="vis-lbl ${f.visible !== false ? "on" : ""}">
      <input id="f-visible" type="checkbox" ${f.visible !== false ? "checked" : ""} />
      <span class="switch" aria-hidden="true"></span>
      <span class="vis-txt">${f.visible !== false ? "公開顯示中" : "已隱藏"}</span>
      <span style="font-size:12px;color:var(--muted);font-weight:600">（關 = 收埋呢個項目）</span>
    </label>
    <div class="admin-actions" style="margin-top:12px">
      <button class="mini-btn primary" onclick="ADMIN.submit()">💾 ${edit ? "儲存" : "加入"}</button>
      ${edit ? '<button class="mini-btn" onclick="ADMIN.cancelEdit()">取消</button>' : ""}
    </div>
  </div>`;
}

/* ── 分頁 + 分類 + 項目 管理列 ──────────────────────────── */

// 表單：揀「圖示來源」後即時切換顯示嘅輸入框
function iconSourceOf(f) {
  if (f.iconSource === "favicon" || f.iconSource === "emoji" ||
      f.iconSource === "upload" || f.iconSource === "none") return f.iconSource;
  if (f.icon && /^https?:\/\//i.test(f.icon)) return "upload";
  if (f.icon && f.icon.length) return "emoji";
  return "favicon";
}
function iconSourceHTML(f) {
  const cur = iconSourceOf(f);
  const opt = (v, label, hint) => `
    <label class="icon-src-opt ${cur === v ? "on" : ""}">
      <input type="radio" name="f-iconSource" value="${v}" ${cur === v ? "checked" : ""} onchange="onIconSourceChange(this.value)" />
      <span class="iso-dot" aria-hidden="true"></span>
      <span class="iso-lbl">${label}</span>
      <span class="iso-hint">${hint}</span>
    </label>`;
  return `<div class="icon-src-row">
    ${opt("favicon", "🌐 App 自帶 Logo", "有 GitHub repo 用 repo 頭像，否則用該網站 favicon")}
    ${opt("emoji", "😀 Emoji", "由你揀一個字符")}
    ${opt("upload", "🖼 圖片網址", "貼一張 https 圖片 URL")}
    ${opt("none", "🚫 不用", "直接用我哋全站 Logo")}
  </div>`;
}
function onIconSourceChange(v) {
  document.querySelectorAll(".icon-src-opt").forEach((el) => {
    const inp = el.querySelector("input");
    const on = inp.value === v;
    el.classList.toggle("on", on);
    if (on) inp.checked = true; // 撳咗 picker 揀完都同步返 radio
  });
  const er = document.getElementById("f-emoji-row");
  const ur = document.getElementById("f-upload-row");
  if (er) er.style.display = v === "emoji" ? "" : "none";
  if (ur) ur.style.display = v === "upload" ? "" : "none";
}
function itemRowHTML(a) {
  const tags = a.tags && a.tags.length ? a.tags.map((t) => `<span class="mini-tag">${esc(t)}</span>`).join("") : "";
  const icon = appIconHTML(a, "row");
  return `
  <div class="admin-app-row">
    <span style="font-size:18px;line-height:1">${icon}</span>
    <b>${esc(a.name)}</b>
    ${a.visible === false ? '<span class="lock-tag">🔒 隱藏</span>' : ""}
    ${tags ? `<span class="mini-tag-row">${tags}</span>` : ""}
    <span class="u" title="${esc(a.note || "")}">${esc(a.url)}${a.note ? " · 📌" : ""}${a.clicks ? ` · ${a.clicks} 次` : ""}</span>
    <div class="admin-app-actions">
      <button class="mini-btn iconish" data-act="item-move" data-id="${a._id}" data-dir="-1" title="上移">▲</button>
      <button class="mini-btn iconish" data-act="item-move" data-id="${a._id}" data-dir="1" title="下移">▼</button>
      <button class="mini-btn" data-act="item-edit" data-id="${a._id}">編輯</button>
      <button class="mini-btn" data-act="item-hide" data-id="${a._id}">${a.visible === false ? "顯示" : "隱藏"}</button>
      <button class="mini-btn danger" data-act="item-del" data-id="${a._id}">刪除</button>
    </div>
  </div>`;
}

function pageGroupHTML(p) {
  const cats = p.categories;
  const itemCount = cats.reduce((n, c) => n + c.apps.length, 0);
  const hidden = cats.reduce((n, c) => n + c.apps.filter((a) => a.visible === false).length, 0);
  const catHTML = cats.map((c) => `
    <div class="admin-cat-head">
      <span>${c.icon ? c.icon + " " : `<img class="row-ico" src="${SITE_LOGO}" alt="" style="vertical-align:-4px;margin-right:2px" /> `}${esc(c.name)}</span>
      <span class="num-badge">${c.apps.length}</span>
      <span style="flex:1"></span>
      <button class="mini-btn iconish" data-act="cat-move" data-page="${esc(p.id)}" data-name="${esc(c.name)}" data-dir="-1" title="分類上移">▲</button>
      <button class="mini-btn iconish" data-act="cat-move" data-page="${esc(p.id)}" data-name="${esc(c.name)}" data-dir="1" title="分類下移">▼</button>
      <button class="mini-btn" data-act="cat-rename" data-page="${esc(p.id)}" data-name="${esc(c.name)}">改名</button>
      <button class="mini-btn" data-act="cat-icon" data-page="${esc(p.id)}" data-name="${esc(c.name)}">🎨 emoji</button>
      <button class="mini-btn danger" data-act="cat-del" data-page="${esc(p.id)}" data-name="${esc(c.name)}">刪分類</button>
    </div>
    ${c.apps.map(itemRowHTML).join("") || '<div style="color:var(--muted);font-size:12.5px;padding:6px 12px">（呢個分類仲未有任何項目）</div>'}
  `).join("");

  return `
  <div class="page-block">
    <div class="page-block-head">
      <span class="page-ico">${p.icon || `<img class="row-ico" src="${SITE_LOGO}" alt="" />`}</span>
      <div class="page-meta">
        <div class="page-title">${esc(p.label)} <span class="num-badge">${cats.length} 分類 · ${itemCount} 項${hidden ? " · 🔒" + hidden : ""}</span></div>
        <div style="font-size:11.5px;color:var(--muted)">id: ${esc(p.id)}</div>
      </div>
      <span style="flex:1"></span>
      <label class="page-on ${p.enabled ? "on" : ""}">
        <input type="checkbox" ${p.enabled ? "checked" : ""} onchange="ADMIN.togglePage('${esc(p.id)}')" />
        <span class="switch" aria-hidden="true"></span>
        <span class="page-on-txt">${p.enabled ? "開放中" : "已關閉"}</span>
      </label>
    </div>
    ${catHTML}
    <button class="mini-btn" style="margin-top:10px" data-act="page-addcat" data-page="${esc(p.id)}">＋ 呢頁加分類</button>
  </div>`;
}

function manageHTML() {
  return `
  ${formHTML()}
  <div class="admin-card">
    <div class="admin-lbl">分頁 ＋ 分類 ＋ 項目 管理</div>
    <div class="banner" style="background:var(--accent-soft);color:var(--accent-text);border:1px solid color-mix(in srgb,var(--accent) 30%,transparent)">
      每頁可獨立「開放 / 關閉」（✓開放先至會喺公開版出現）。關閉咗嘅分頁內容仍然保留，隨時可以開返。<br/>
      分類只屬某一個分頁 —— 改/刪分類、加項目都要先揀啱分頁。項目可揀童軍級別標籤，公開版畀用戶篩選。
    </div>
    ${ADMIN.sites.pages.map(pageGroupHTML).join("")}
  </div>`;
}

/* ── 總覽 ───────────────────────────────────────────────── */
function tilesForCat(cat) {
  return cat.apps.map((a) => {
    const [g1, g2] = tileBg(a.name);
    const inner = appIconHTML(a, "tile");
    return `
    <a class="tile" href="${esc(a.url)}" title="${esc((a.description || "") + (a.visible === false ? "（隱藏中）" : ""))}" target="_blank" rel="noopener">
      ${a.visible === false ? '<span class="lock-tag" style="position:absolute;top:2px;right:2px;z-index:2">🔒</span>' : ""}
      <div class="tile-icon" style="background:linear-gradient(145deg,${g1},${g2})">${inner}</div>
      <div class="tile-name">${esc(a.name)}</div>
      ${(a.tags && a.tags.length) ? `<div class="tile-tags">${a.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
      ${a.description ? `<div class="tile-desc">${esc(a.description)}</div>` : ""}
    </a>`;
  }).join("");
}

function allViewHTML() {
  let total = 0, pub = 0, hidden = 0;
  const enabled = ADMIN.sites.pages.filter((p) => p.enabled);
  const html = enabled.map((p) => {
    const catsHtml = p.categories.map((c) => {
      const shown = c.apps.filter((a) => a.visible !== false);
      total += shown.length; hidden += c.apps.length - shown.length; pub += shown.length;
      return shown.length ? `
      <div class="sec-head" style="margin-top:14px">
        ${c.icon ? `<span class="sec-ico">${c.icon}</span>` : ""}
        <h2>${esc(c.name)}</h2><span class="num">${shown.length}</span>
      </div>
      <div class="grid">${tilesForCat({ ...c, apps: shown })}</div>` : "";
    }).join("");
    return catsHtml
      ? `<div class="page-sublabel">${esc((p.icon ? p.icon + " " : "") + p.label)}</div>${catsHtml}`
      : `<div class="page-sublabel">${esc((p.icon ? p.icon + " " : "") + p.label)} <span style="color:var(--muted)">（未有內容）</span></div>`;
  }).join("");

  return `
  <div class="admin-card">
    <div class="banner ok">公眾版面預覽：${pub} 公開 · ${hidden} 隱藏（🔒）· ${ADMIN.sites.pages.filter((p) => p.enabled).length} 個開放分頁。</div>
    <div style="font-size:12.5px;color:var(--muted);margin-bottom:4px">關閉咗嘅分頁唔會顯示喺下面。</div>
    ${html || '<p style="color:var(--muted);font-size:13px;padding:12px 0">所有分頁都未開放／未有內容</p>'}
  </div>`;
}

/* ── 主渲染 ─────────────────────────────────────────────── */
function renderAdmin() {
  const el = document.getElementById("admin-content");
  const sb = getSB();

  if (sb && !ADMIN.authed) {
    el.innerHTML = loginHTML();
    const pass = document.getElementById("l-pass");
    if (pass) { pass.focus(); pass.addEventListener("keydown", (e) => { if (e.key === "Enter") ADMIN.login(); }); }
    return;
  }
  if (!ADMIN.sites) {
    el.innerHTML = '<div class="admin-card" style="text-align:center;color:var(--muted)">載入中…</div>';
    return;
  }

  el.innerHTML = `
  <div class="admin-card">
    <div class="admin-head">
      <img class="admin-logo" src="/icons/icon-192.png" alt="" onclick="goldfingerClick()" />
      <div>
        <h2>⚙️ 管理面板</h2>
        <div style="font-size:12px;color:var(--muted);margin-top:-2px">分頁／分類／項目管理 · 童軍小工具</div>
      </div>
    </div>
    ${sb
      ? '<div class="banner ok">已連接 Supabase — 改動即時生效，所有人都見到</div>'
      : '<div class="banner warn">⚠️ Demo 模式：改動只存喺呢部裝置。配置方法見 README.md</div>'}
    <div class="tab-bar">
      <button type="button" class="tab-btn ${ADMIN.tab === "manage" ? "on" : ""}" onclick="ADMIN.setTab('manage')">🛠 管理</button>
      <button type="button" class="tab-btn ${ADMIN.tab === "all" ? "on" : ""}" onclick="ADMIN.setTab('all')">👀 總覽</button>
    </div>
    ${ADMIN.tab === "manage" ? manageHTML() : allViewHTML()}
    <div class="admin-actions">
      <button type="button" class="mini-btn" onclick="ADMIN.doExport()">📤 備份</button>
      <button type="button" class="mini-btn" onclick="ADMIN.doRestore()" title="上傳 backup 完整覆蓋">♻️ 還原</button>
      <button type="button" class="mini-btn" onclick="ADMIN.doQR()">🔳 QR</button>
      <button type="button" class="mini-btn danger" onclick="ADMIN.resetAll()" title="清空所有並建立預設模板">⚠️ 一鍵重設</button>
      <span class="spacer"></span>
      <button type="button" class="mini-btn primary full" onclick="ADMIN.close()">✅ 完成</button>
      ${sb && ADMIN.authed ? '<button type="button" class="mini-btn danger" onclick="ADMIN.logout()">登出</button>' : ""}
    </div>
  </div>`;

  // 新增/編輯項目：分頁 → 分類 連動
  const pageSel = document.getElementById("f-page");
  const catSel = document.getElementById("f-cat");
  if (pageSel) {
    pageSel.onchange = () => {
      const page = pageSel.value;
      const cats = ADMIN.catsOfPage(page);
      catSel.innerHTML = cats.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("") +
        '<option value="__new__">＋ 呢頁新分類…</option>';
      catSel.onchange();
    };
  }
  if (catSel) {
    catSel.onchange = () => {
      const nc = document.getElementById("f-cat-new");
      if (nc) nc.style.display = catSel.value === "__new__" ? "" : "none";
    };
  }
}
