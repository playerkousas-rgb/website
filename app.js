/* ════════════════════════════════════════════════════════════════
   公開版面 app.js  (童軍小工具 · 多分頁渲染)
   store.js 載入後、admin.js 之後載入。
   全站 = 4 個分頁（每個可獨立開放/關閉）；每頁有自己的分類；
   每頁項目全部係「連結」，逐個可開/關，並可帶童軍級別標籤篩選。
   ════════════════════════════════════════════════════════════════ */

// ── 圖標背景配色（按名稱 hash 穩定取色）──────────────────────
const PALETTE = [
  ["#dbeafe", "#93c5fd"], ["#fee2e2", "#fca5a5"], ["#dcfce7", "#86efac"],
  ["#fef9c3", "#fde047"], ["#fae8ff", "#e879f9"], ["#e0f2fe", "#7dd3fc"],
  ["#ffedd5", "#fdba74"], ["#f3e8ff", "#c4b5fd"], ["#ccfbf1", "#5eead4"],
  ["#fce7f3", "#f9a8d4"]
];
const PALETTE_DARK = [
  ["#1e3a5f", "#2563eb"], ["#4c1d1d", "#ef4444"], ["#14532d", "#22c55e"],
  ["#422006", "#eab308"], ["#4a044e", "#d946ef"], ["#0c4a6e", "#0ea5e9"],
  ["#431407", "#f97316"], ["#2e1065", "#8b5cf6"], ["#134e4a", "#14b8a6"],
  ["#500724", "#ec4899"]
];
function tileBg(name) {
  let h = 0;
  for (const c of String(name || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const dark = document.documentElement.dataset.theme === "dark";
  const pal = dark ? PALETTE_DARK : PALETTE;
  return pal[h % pal.length];
}
// esc() 喺 store.js 內定義（global），呢度直接用

// ── 最近使用（只記「小工具 Apps」分頁）────────────────────────
const RECENT_KEY = "showcase-recent";
function getRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } }
function addRecent(app) {
  let r = getRecent().filter((x) => x.url !== app.url);
  r.unshift({ name: app.name, url: app.url, icon: app.icon || null, iconSource: app.iconSource || null, cat: "最近", description: app.description || null, _id: app._id });
  r = r.slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(r));
}
function openApp(app) {
  addRecent(app);
  trackClick(app._id);
  window.location.href = app.url;
}

function iconHTML(app) {
  const [c1, c2] = tileBg(app.name);
  // 圖示 HTML 由 store.js 統一提供（iconSource：favicon / emoji / upload / none）
  return `<div class="tile-icon" style="background:linear-gradient(145deg,${c1},${c2})">${appIconHTML(app, "tile")}</div>`;
}

// ── 公開版面狀態 ─────────────────────────────────────────────
const chipsEl = document.getElementById("chips");
const pageNavEl = document.getElementById("page-nav");
const tagRowEl = document.getElementById("tag-row");
const sectionsEl = document.getElementById("sections");
const emptyEl = document.getElementById("empty");
const searchEl = document.getElementById("search");
const searchClear = document.getElementById("search-clear");
const footCount = document.getElementById("foot-count");

let REG = [];
let SITES = null;
let ACTIVE_PAGE = null;
let activeChip = "all";
let tagFilter = null;
const ACTIVE_PAGE_KEY = "scout-active-page";

function enabledPages() { return (SITES.pages || []).filter((p) => p.enabled); }
function pageById(id) { return (SITES.pages || []).find((p) => p.id === id); }
function activePage() { return pageById(ACTIVE_PAGE); }

function measurePanes() {
  const pnav = pageNavEl;
  const h = (pnav && !pnav.hidden && pnav.offsetHeight) ? pnav.offsetHeight : 0;
  document.documentElement.style.setProperty("--pnav-h", h + "px");
}

// ── 分頁導覽 ─────────────────────────────────────────────────
function renderPages() {
  const pages = enabledPages();
  pageNavEl.hidden = pages.length < 2;
  if (!pages.length) { ACTIVE_PAGE = null; pageNavEl.innerHTML = ""; measurePanes(); return; }
  if (!pageById(ACTIVE_PAGE) || !pageById(ACTIVE_PAGE).enabled) {
    const saved = localStorage.getItem(ACTIVE_PAGE_KEY);
    ACTIVE_PAGE = (saved && pageById(saved) && pageById(saved).enabled) ? saved : pages[0].id;
  }
  pageNavEl.innerHTML =
    `<button type="button" class="page-btn" data-page="__prev" onclick="switchPage()" title="上一頁" aria-label="上一頁">‹</button>` +
    pages.map((p) =>
      `<button type="button" class="page-btn ${p.id === ACTIVE_PAGE ? "on" : ""}" data-page="${esc(p.id)}" onclick="switchPage('${esc(p.id)}')">${esc(p.icon ? p.icon + " " : "")}${esc(p.label)}</button>`
    ).join("") +
    `<button type="button" class="page-btn" data-page="__next" onclick="switchPage()" title="下一頁" aria-label="下一頁">›</button>`;
  // 上一頁/下一頁
  const arr = pages.map((p) => p.id);
  const i = arr.indexOf(ACTIVE_PAGE);
  const prev = arr[i - 1], next = arr[i + 1];
  const pBtn = pageNavEl.querySelector('[data-page="__prev"]');
  const nBtn = pageNavEl.querySelector('[data-page="__next"]');
  pBtn.disabled = !prev; pBtn.onclick = prev ? () => switchPage(prev) : null;
  nBtn.disabled = !next; nBtn.onclick = next ? () => switchPage(next) : null;
  measurePanes();
}

function switchPage(id) {
  if (!id) return;
  const p = pageById(id);
  if (!p || !p.enabled) return;
  ACTIVE_PAGE = id;
  localStorage.setItem(ACTIVE_PAGE_KEY, id);
  tagFilter = null;
  activeChip = "all";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Tile ─────────────────────────────────────────────────────
function tileHTML(idx, delay) {
  const app = REG[idx];
  const d = Math.min(delay || 0, 12) * 30;
  const tags = (app.tags || []).filter(Boolean);
  return `
  <a class="tile" href="${esc(app.url)}" title="${esc((app.description || app.name) + (tags.length ? "　標籤：" + tags.join("、") : ""))}"
     data-idx="${idx}" style="animation-delay:${d}ms">
    ${app.github ? `<span class="gh-badge" title="GitHub repo" onclick="event.preventDefault(); event.stopPropagation(); window.open('${esc(app.github)}','_blank')">GH</span>` : ""}
    ${iconHTML(app)}
    <div class="tile-name">${esc(app.name)}</div>
    ${tags.length ? `<div class="tile-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
    ${app.description ? `<div class="tile-desc">${esc(app.description)}</div>` : ""}
  </a>`;
}

function sectionHTML(title, icon, apps, id) {
  if (!apps.length) return "";
  const start = REG.length;
  apps.forEach((a) => REG.push(a));
  const tiles = apps.map((_, i) => tileHTML(start + i, i)).join("");
  return `
  <section id="${id}">
    <div class="sec-head">
      ${icon ? `<span class="sec-ico">${icon}</span>` : `<img class="sec-ico-logo" src="${SITE_LOGO}" alt="" />`}
      <h2>${esc(title)}</h2>
      <span class="num">${apps.length}</span>
    </div>
    <div class="grid">${tiles}</div>
  </section>`;
}

function setActiveChip(id) {
  activeChip = id;
  chipsEl.querySelectorAll(".chip").forEach((el) => el.classList.toggle("on", el.dataset.chip === id));
}

function jumpTo(id) {
  setActiveChip(id);
  if (id === "all") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setTag(tag) {
  tagFilter = tagFilter === tag ? null : tag;
  activeChip = "all";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── 童軍標籤列 ───────────────────────────────────────────────
function renderTagRow() {
  const pg = activePage();
  const hasTag = !!(pg && (pg.categories || []).some((c) => c.apps.some((a) => a.visible !== false && (a.tags || []).length)));
  if (!hasTag || !pg) { tagRowEl.hidden = true; return; }
  tagRowEl.hidden = false;
  tagRowEl.innerHTML =
    `<span class="tag-row-hint">適用級別：</span>` +
    SCOUT_TAGS.map((t) =>
      `<button type="button" class="tag-chip ${tagFilter === t ? "on" : ""}" onclick="setTag('${esc(t)}')">${esc(t)}</button>`
    ).join("");
}

// ── 主要渲染 ─────────────────────────────────────────────────
function render() {
  if (!SITES) return;
  renderPages();
  const pg = activePage();
  sectionsEl.innerHTML = "";
  REG.length = 0;
  const q = searchEl.value.trim().toLowerCase();
  searchClear.classList.toggle("show", !!q);

  if (!pg) {
    emptyEl.style.display = "block";
    emptyEl.querySelector("b").textContent = "未有開放嘅分頁";
    emptyEl.querySelector("p").textContent = "管理員喺後台仲未開放任何分頁。";
    chipsEl.innerHTML = "";
    tagRowEl.hidden = true;
    measurePanes();
    return;
  }

  const match = (a) => {
    if (tagFilter && !((a.tags || []).includes(tagFilter))) return false;
    if (!q) return true;
    const hay = [a.name, a.cat, a.description, a.note, (a.tags || []).join(" ")].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  };
  const visible = (a) => a.visible !== false;

  let html = "";
  const cats = pg.categories
    .map((c, i) => ({ c, i, shown: c.apps.filter(visible).filter(match) }))
    .filter((x) => x.shown.length);

  // 「最近使用」只喺小工具/Apps 分頁、冇搜尋冇篩選時顯示
  if (!q && !tagFilter && ACTIVE_PAGE === "apps") {
    const recent = getRecent().filter((r) => r.visible !== false);
    if (recent.length) html += sectionHTML("最近使用", "🕘", recent, "recent");
  }

  html += cats.map((x) => sectionHTML(x.c.name, x.c.icon, x.shown, "cat-" + x.i)).join("");
  sectionsEl.innerHTML = html;
  emptyEl.style.display = html ? "none" : "block";

  chipsEl.innerHTML =
    `<button type="button" class="chip ${!q && activeChip === "all" ? "on" : ""}" data-chip="all" onclick="jumpTo('all')">⌂ 全部</button>` +
    cats.map((x) =>
      `<button type="button" class="chip ${!q && activeChip === ("cat-" + x.i) ? "on" : ""}" data-chip="cat-${x.i}" onclick="jumpTo('cat-${x.i}')">${esc((x.c.icon ? x.c.icon + " " : "") + x.c.name)}</button>`
    ).join("");

  renderTagRow();
  measurePanes();
  watchSections();
}

// IntersectionObserver：滾動自動高亮 chip
let _io = null;
function watchSections() {
  if (_io) _io.disconnect();
  if (!("IntersectionObserver" in window)) return;
  const secs = sectionsEl.querySelectorAll("section[id]");
  if (!secs.length) return;
  _io = new IntersectionObserver(
    (entries) => {
      if (searchEl.value.trim() || tagFilter) return;
      const v = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (!v.length) return;
      const id = v[0].target.id;
      if (id && id !== activeChip) {
        activeChip = id;
        chipsEl.querySelectorAll(".chip").forEach((el) => el.classList.toggle("on", el.dataset.chip === id));
        const on = chipsEl.querySelector(".chip.on");
        if (on && on.scrollIntoView) on.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    },
    { rootMargin: "-30% 0px -55% 0px", threshold: [0.1, 0.35, 0.6] }
  );
  secs.forEach((s) => _io.observe(s));
}

async function main() {
  REG.length = 0;
  try {
    const { sites } = await loadSites();
    SITES = sites;
    document.getElementById("site-name").textContent = sites.name;
    renderPages();
    const pages = enabledPages();
    const total = pages.reduce((n, p) => n + p.categories.reduce((m, c) => m + c.apps.filter((a) => a.visible !== false).length, 0), 0);
    footCount.textContent = `共 ${total} 個項目 · ${pages.length} 個分頁`;
    render();
  } catch (e) {
    sectionsEl.innerHTML = "";
    emptyEl.style.display = "block";
    emptyEl.querySelector("b").textContent = "載入失敗";
    emptyEl.querySelector("p").textContent = e.message || "請稍後再試";
    footCount.textContent = "載入失敗";
  }
}

// 公開版面 click 委派（tile 開啟／GH badge）
sectionsEl.addEventListener("click", (e) => {
  const gh = e.target.closest(".gh-badge");
  if (gh) return; // GH 已經自帶 window.open
  const a = e.target.closest(".tile");
  if (!a) return;
  e.preventDefault();
  const idx = Number(a.dataset.idx);
  if (REG[idx]) openApp(REG[idx]);
});
searchEl.addEventListener("input", () => { activeChip = "all"; render(); });
searchClear.addEventListener("click", () => { searchEl.value = ""; searchEl.focus(); activeChip = "all"; render(); });

// 重新渲染（主題切換等）後由 index 調用
function rerenderPublic() { if (SITES) render(); }
