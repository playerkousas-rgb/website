/* ════════════════════════════════════════════════════════════════
   公開版面 app.js  (SCOUT APP STORE · 多分頁渲染)
   store.js 載入後、admin.js 之後載入。
   全站 = 4 個分頁（每個可獨立開放/關閉）；每頁有自己的分類；
   每頁項目全部係「連結」，逐個可開/關，並可帶童軍支部標籤篩選（可多選）。
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

// ── 我的收藏（⭐ 每人自己嘅收藏清單，存瀏覽器）──────────────
const FAV_KEY = "showcase-favorites";
function getFavorites() { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch { return []; } }
function isFavorite(id) { return getFavorites().includes(id); }
function toggleFavorite(id) {
  let favs = getFavorites();
  const had = favs.includes(id);
  if (had) favs = favs.filter((x) => x !== id);
  else favs.unshift(id);
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  // 全站累計收藏數（「最多人收藏」排行榜用）；本地即刻同步，唔使等 reload
  if (SITES) {
    for (const p of SITES.pages) for (const c of p.categories) {
      const a = c.apps.find((x) => x._id === id);
      if (a) a.stars = Math.max(0, (a.stars || 0) + (had ? -1 : 1));
    }
  }
  if (typeof trackStar === "function") trackStar(id, had ? -1 : 1);
}

// ── 讚好（❤️ 「最受歡迎」排行用；唔係收藏清單，撳過會記住）───
const HEART_KEY = "showcase-hearts";
function getHearted() { try { return JSON.parse(localStorage.getItem(HEART_KEY)) || []; } catch { return []; } }
function isHearted(id) { return getHearted().includes(id); }
function toggleHeart(id) {
  let hearts = getHearted();
  const had = hearts.includes(id);
  if (had) hearts = hearts.filter((x) => x !== id);
  else hearts.unshift(id);
  localStorage.setItem(HEART_KEY, JSON.stringify(hearts));
  // 全站累計心數（「最受歡迎」排行榜用）；本地即刻同步
  if (SITES) {
    for (const p of SITES.pages) for (const c of p.categories) {
      const a = c.apps.find((x) => x._id === id);
      if (a) a.hearts = Math.max(0, (a.hearts || 0) + (had ? -1 : 1));
    }
  }
  if (typeof trackHeart === "function") trackHeart(id, had ? -1 : 1);
}
function openApp(app) {
  trackClick(app._id);
  window.location.href = app.url;
}

function iconHTML(app) {
  // App Store 式：每粒 icon 用名稱 hash 穩定取色嘅圓角漸變底
  const [g1, g2] = tileBg(app.name);
  return `<div class="tile-icon" style="background:linear-gradient(145deg,${g1},${g2})">${appIconHTML(app, "tile")}</div>`;
}

// ── 公開版面狀態 ─────────────────────────────────────────────
const chipsEl = document.getElementById("chips");
const pageNavEl = document.getElementById("page-nav");
const tagRowEl = document.getElementById("tag-row");
const sortRowEl = document.getElementById("sort-row");
const sectionsEl = document.getElementById("sections");
const emptyEl = document.getElementById("empty");
const searchEl = document.getElementById("search");
const searchClear = document.getElementById("search-clear");
const footCount = document.getElementById("foot-count");

let REG = [];
let SITES = null;
let ACTIVE_PAGE = null;
let activeChip = "all";
let marketView = "discover";
const CHART_METRICS = {
  clicks:  { title: "🔥 最多人點擊", unit: "次開啟", value: (a) => Number(a.clicks || 0) },
  stars:   { title: "⭐ 最多人收藏", unit: "收藏",   value: (a) => Number(a.stars || 0) },
  hearts:  { title: "❤️ 最受歡迎",   unit: "個心",   value: (a) => Number(a.hearts || 0) },
  latest:  { title: "🆕 最新上架",   unit: "上架",   value: (a) => {
    const time = Date.parse(a.created_at || "");
    return Number.isNaN(time) ? 0 : time;
  } }
};
// 排名照常顯示，但分數數字要達到 100 才顯示。
const CHART_SCORE_MIN = 100;
function setMarketView(view) {
  marketView = view;
  if (!SORTS.some((s) => s.id === sortMode)) sortMode = "clicks";
  document.querySelectorAll('[data-market]').forEach(b => {
    b.classList.toggle('on', b.dataset.market === view);
    b.setAttribute('aria-pressed', String(b.dataset.market === view));
  });
  render();
}
function chartHTML(apps) {
  const metric = CHART_METRICS[sortMode] ? sortMode : 'clicks';
  const m = CHART_METRICS[metric];
  const ranked = [...apps].sort((a, b) => m.value(b) - m.value(a) || a.name.localeCompare(b.name, 'zh-HK')).slice(0, 50);
  if (!ranked.length) return '';
  return `<section class="chart-section"><div class="sec-head"><h2>${m.title}</h2><span class="num">TOP ${ranked.length}</span></div><div class="chart-list">${ranked.map((a,i) => {
    const idx = REG.push(a)-1;
    const value = m.value(a);
    const scoreHTML = metric === 'latest'
      ? `<div class="chart-score"><b>${a.created_at ? new Date(a.created_at).toLocaleDateString('zh-HK') : '—'}</b><small>${m.unit}</small></div>`
      : value >= CHART_SCORE_MIN
        ? `<div class="chart-score"><b>${value.toLocaleString()}</b><small>${m.unit}</small></div>`
        : '';
    return `<a class="chart-item tile" href="${esc(a.url)}" data-idx="${idx}" data-id="${esc(a._id)}"><span class="chart-rank">${String(i+1).padStart(2,'0')}</span>${iconHTML(a)}<div class="chart-copy"><h3>${esc(a.name)}</h3><p>${esc(a.description || '')}</p></div>${scoreHTML}<span class="chart-open">開啟 ↗</span></a>`;
  }).join('')}</div></section>`;
}
// 適用支部篩選：可以**同時揀幾個**（OR —— 揀「小＋幼」= 兩個支部嘅嘢都俾我睇）
// 儲存仍係全名（小童軍／幼童軍…），公開版顯示做一個字
let tagFilter = [];
const ACTIVE_PAGE_KEY = "scout-active-page";
const TAGFILTER_KEY = "scout-tag-filter";
let _tagFilterRestored = false;
function restoreTagFilter() {
  if (_tagFilterRestored) return;
  _tagFilterRestored = true;
  try {
    const raw = JSON.parse(localStorage.getItem(TAGFILTER_KEY) || "null");
    if (raw && raw.page === ACTIVE_PAGE && Array.isArray(raw.tags)) {
      tagFilter = raw.tags.filter((t) => SCOUT_TAGS.includes(t));
    }
  } catch {}
}
function persistTagFilter() {
  try { localStorage.setItem(TAGFILTER_KEY, JSON.stringify({ page: ACTIVE_PAGE, tags: tagFilter })); } catch {}
}

// ── 排行榜指標（只在「排行榜」視圖揀；「探索分類」永遠用後台預設順序）──
// 手機版淨係顯示 emoji（文字包咗喺 .wide-only，細屏被 CSS 收埋）
const SORT_KEY = "showcase-sort";
const SORTS = [
  { id: "clicks", ico: "🔥", label: "最多人點擊", hint: "按開啟次數排名" },
  { id: "stars",  ico: "⭐", label: "最多人收藏", hint: "按全站收藏人數排名" },
  { id: "hearts", ico: "❤️", label: "最受歡迎",   hint: "按全站讚好心數排名" },
  { id: "latest", ico: "🆕", label: "最新上架",   hint: "按上架時間排序" }
];
let sortMode = SORTS.some((s) => s.id === localStorage.getItem(SORT_KEY))
  ? localStorage.getItem(SORT_KEY) : "clicks";

function setSort(m) {
  if (!SORTS.some((s) => s.id === m)) return;
  sortMode = m;
  localStorage.setItem(SORT_KEY, m);
  render();
}

function enabledPages() { return ((SITES && SITES.pages) || []).filter((p) => p.enabled); }
function pageById(id) { return ((SITES && SITES.pages) || []).find((p) => p.id === id); }
function activePage() { return pageById(ACTIVE_PAGE); }

function measurePanes() {
  const root = document.documentElement;
  const pnav = pageNavEl;
  const h = (pnav && !pnav.hidden && pnav.offsetHeight) ? pnav.offsetHeight : 0;
  root.style.setProperty("--pnav-h", h + "px");
  // 支部列（小／幼／童／深／樂）常駐置頂，需計入高度
  const tr = (typeof tagRowEl !== "undefined" && tagRowEl && !tagRowEl.hidden && tagRowEl.offsetHeight) ? tagRowEl.offsetHeight : 0;
  root.style.setProperty("--trow-h", tr + "px");
  // chips 列高度（手機版收細咗，section 嘅 scroll-margin 要跟實際值先唔會郁空）
  const ch = (chipsEl && !chipsEl.hidden && chipsEl.offsetHeight) ? chipsEl.offsetHeight : 0;
  if (ch) root.style.setProperty("--chip-h", ch + "px");
}

// ── 顯示層小工具：手機得 emoji／短名，桌面先顯示全名 ────────────
// 全部靠 CSS 嘅 .wide-only / .narrow-only 切換（見 index.html），
// 所以同一個掣喺手機細啲、喺桌面有完整文字，唔使 JS 偵測螢幕。
function chipTxt(full, short) {
  return `<span class="wide-only">${esc(full)}</span>` +
         `<span class="narrow-only">${esc(short || full)}</span>`;
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
      `<button type="button" class="page-btn ${p.id === ACTIVE_PAGE ? "on" : ""}" data-page="${esc(p.id)}" onclick="switchPage('${esc(p.id)}')" title="${esc(p.label)}">` +
      `${p.icon ? `<span class="chip-ico">${esc(p.icon)}</span>` : ""}${chipTxt(p.label, catShort(p.label))}</button>`
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
  bnavSection = sectionOfPage(p);
  localStorage.setItem(ACTIVE_PAGE_KEY, id);
  tagFilter = [];
  persistTagFilter();
  activeChip = "all";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Tile ─────────────────────────────────────────────────────
function tileHTML(idx, delay) {
  const app = REG[idx];
  const d = Math.min(delay || 0, 12) * 30;
  const starred = isFavorite(app._id);
  const hearted = isHearted(app._id);
  return `
  <a class="tile" href="${esc(app.url)}" title="${esc(app.description || app.name)}"
     data-idx="${idx}" data-id="${esc(app._id || "")}" style="animation-delay:${d}ms">
    ${app.github ? `<span class="gh-badge" title="GitHub repo" onclick="event.preventDefault(); event.stopPropagation(); window.open('${esc(app.github)}','_blank')">GH</span>` : ""}
    ${iconHTML(app)}
    <div class="tile-name">${esc(app.name)}</div>
    ${app.description ? `<div class="tile-desc">${esc(app.description)}</div>` : ""}
    <div class="tile-bar">
      <button type="button" class="tile-btn btn-heart fav-heart ${starred ? "on" : ""}" title="收藏" aria-label="收藏" data-id="${esc(app._id || "")}" onclick="event.preventDefault(); event.stopPropagation(); toggleFav(this)">
        <svg class="heart-ico" width="16" height="16" viewBox="0 0 24 24" fill="${starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
      <button type="button" class="tile-btn btn-star fav-star ${hearted ? "on" : ""}" title="支持" aria-label="支持" data-id="${esc(app._id || "")}" onclick="event.preventDefault(); event.stopPropagation(); toggleHeartBtn(this)">
        <svg class="star-ico" width="16" height="16" viewBox="0 0 24 24" fill="${hearted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
      <button type="button" class="tile-btn btn-share" title="分享" aria-label="分享" data-id="${esc(app._id || "")}" onclick="event.preventDefault(); event.stopPropagation(); openShareModal('${esc(app._id || "")}')">
        <svg class="share-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      </button>
    </div>
  </a>`;
}

function toggleFav(el) {
  const id = el.dataset.id;
  if (!id) return;
  toggleFavorite(id);
  const on = isFavorite(id);
  document.querySelectorAll(`.fav-heart[data-id="${id}"], .fav-star[data-id="${id}"]`).forEach(btn => {
    if (btn.classList.contains("fav-heart") || btn.title === "收藏") {
      btn.classList.toggle("on", on);
      const svg = btn.querySelector("svg");
      if (svg) svg.setAttribute("fill", on ? "currentColor" : "none");
    }
  });
}

function toggleHeartBtn(el) {
  const id = el.dataset.id;
  if (!id) return;
  toggleHeart(id);
  const on = isHearted(id);
  document.querySelectorAll(`.fav-heart[data-id="${id}"], .fav-star[data-id="${id}"]`).forEach(btn => {
    if (btn.classList.contains("fav-star") || btn.title === "支持") {
      btn.classList.toggle("on", on);
      const svg = btn.querySelector("svg");
      if (svg) svg.setAttribute("fill", on ? "currentColor" : "none");
    }
  });
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

function publicJumpTo(id) {
  if (id === "all") {
    activeChip = "all";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (id === "fav") {
    activeChip = "fav";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  // 選咗某個分類 → 只顯示該分類
  activeChip = id;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── 支部篩選（可多選）────────────────────────────────────────
function setTag(tag) {
  // 用家特意去揀支部 = 已經知道個篩選存在 → 唔使再朦朧住下面嘅工具
  if (typeof revealSections === "function") revealSections(); // 定義喺 index.html boot；後台/單測環境無
  const i = tagFilter.indexOf(tag);
  if (i >= 0) tagFilter.splice(i, 1);
  else tagFilter.push(tag);
  // 順序跟 SCOUT_TAGS，令 chip 顯示穩定（同埋分享／重開都一致）
  tagFilter = SCOUT_TAGS.filter((t) => tagFilter.includes(t));
  persistTagFilter();
  // 唔再強制跳返「全部」——保留目前揀咗嘅分類，等適用支部同分類可以疊加一齊用
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function clearTags() {
  if (!tagFilter.length) return;
  tagFilter = [];
  persistTagFilter();
  render();
}
const tagActive = (t) => tagFilter.includes(t);
function tagLabel(t) { return scoutTagShort(t) || t; }   // 一個字（小／幼／童／深／樂）

// ── 童軍支部篩選列 ───────────────────────────────────────────
function renderTagRow() {
  const pg = activePage();
  const hasTag = !!(pg && (pg.categories || []).some((c) => c.apps.some((a) => a.visible !== false && (a.tags || []).length)));
  if (!hasTag || !pg) { tagRowEl.hidden = true; return; }
  tagRowEl.hidden = false;
  tagRowEl.className = "tag-row branch-tabs";
  tagRowEl.innerHTML = SCOUT_TAGS.map((t) => {
    const on = tagActive(t);
    return `<button type="button" class="branch-tab ${on ? "on" : ""}" ` +
      `onclick="setTag('${esc(t)}')" title="${esc(t)}" ` +
      `aria-label="${esc(t)}" aria-pressed="${on ? "true" : "false"}">${esc(t)}</button>`;
  }).join("");
}

// ── 排行榜指標列 ─────────────────────────────────────────────
// 只喺「排行榜」視圖顯示：🔥 最多人點擊｜⭐ 最多人收藏｜❤️ 最受歡迎｜🆕 最新上架。
// 「探索分類」冇排序列 —— 永遠用後台排好嘅預設順序（排名啲嘢晒咗喺排行榜）。
// 手機：emoji；桌面：emoji + 全名
function renderSortRow() {
  if (!sortRowEl) return;
  if (marketView !== "charts") { sortRowEl.hidden = true; sortRowEl.innerHTML = ""; return; }
  const pg = activePage();
  const count = pg
    ? (pg.categories || []).reduce((n, c) => n + c.apps.filter((a) => a.visible !== false).length, 0)
    : 0;
  // 得 0／1 個項目就唔使排
  if (count < 2) { sortRowEl.hidden = true; sortRowEl.innerHTML = ""; return; }
  sortRowEl.hidden = false;
  sortRowEl.innerHTML =
    `<span class="tag-row-hint">🏆<span class="wide-only"> 排行榜</span>：</span>` +
    SORTS.map((s) => {
      const on = sortMode === s.id;
      return `<button type="button" class="tag-chip sort-chip ${on ? "on" : ""}" ` +
        `onclick="setSort('${s.id}')" title="${esc(s.label)} — ${esc(s.hint)}" ` +
        `aria-label="${esc(s.label)}" aria-pressed="${on ? "true" : "false"}">` +
        `<span class="chip-ico">${s.ico}</span><span class="wide-only">${esc(s.label)}</span></button>`;
    }).join("");
}

// ── 主要渲染 ─────────────────────────────────────────────────
function render() {
  // 底欄「連結／教學工具」專區：只顯示專區自己嘅內容。
  // 專區未開放（分頁關閉或未有公開項目）→ 佔位提示，唔兜底顯示其他分頁嘅分類。
  if (bnavSection === "links" || bnavSection === "tools") {
    const sp = sectionPageFor(bnavSection);
    if (!sp) { renderBnavPlaceholder(bnavSection); return; }
    if (ACTIVE_PAGE !== sp.id) ACTIVE_PAGE = sp.id;
  }
  if (!SITES) return;
  renderPages();
  restoreTagFilter();
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
    if (sortRowEl) sortRowEl.hidden = true;
    measurePanes();
    return;
  }

  const match = (a) => {
    // 多選之間係 OR：揀咗「小＋幼」= 兩個支部嘅項目都畀我睇
    if (tagFilter.length && !tagFilter.some((t) => (a.tags || []).includes(t))) return false;
    if (!q) return true;
    // 支部全名＋短名都入 haystack：用家搜「小童軍」定搜一個字「小」都揾到
    const tagStr = (a.tags || []).concat((a.tags || []).map(scoutTagShort)).join(" ");
    const hay = [a.name, a.cat, a.description, a.note, tagStr].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  };
  const visible = (a) => a.visible !== false;

  let html = "";
  // 探索分類 = 永遠預設順序（後台排好嗰個）；排名交返排行榜嗰三個指標
  const shownOf = (c) => c.apps.filter(visible).filter(match);
  // 呢頁「有內容」嘅分類 —— 唔畀目前搜尋／支部篩選收窄，
  // 咁分類同適用支部先至可以同時撳（唔會「LOCK 死」）。
  const catIdx = [];
  pg.categories.forEach((c, i) => { if (c.apps.some(visible)) catIdx.push({ c, i }); });

  // 「我的收藏」／單一分類／全部 —— 全部都同搜尋、支部篩選疊加（AND；支部之間係 OR）
  const favIds = new Set(getFavorites());
  if (activeChip === "fav") {
    const favApps = [];
    for (const { c } of catIdx) for (const a of shownOf(c)) if (favIds.has(a._id)) favApps.push(a);
    html += sectionHTML("我的收藏", "⭐", favApps, "favorites");
  } else if (activeChip !== "all") {
    // 揀咗某個分類 chip → 只顯示嗰個分類（可疊加支部／搜尋）
    const selIdx = Number(String(activeChip).replace("cat-", ""));
    const sel = pg.categories[selIdx];
    if (sel) html += sectionHTML(sel.name, sel.icon, shownOf(sel), activeChip);
  } else {
    // 「全部」→ 顯示所有分類（可疊加支部／搜尋）
    html += catIdx.map(({ c, i }) => sectionHTML(c.name, c.icon, shownOf(c), "cat-" + i)).join("");
  }

  if (marketView === 'charts') {
    let chartApps = catIdx.flatMap(({c,i}) => activeChip === 'all' || activeChip === 'fav' || activeChip === 'cat-' + i ? c.apps.filter(visible).filter(match) : []);
    if (activeChip === 'fav') chartApps = chartApps.filter(a => favIds.has(a._id));
    REG.length = 0;
    html = chartHTML(chartApps);
  }
  sectionsEl.innerHTML = html;
  if (html) {
    emptyEl.style.display = "none";
  } else {
    emptyEl.style.display = "block";
    const b = emptyEl.querySelector("b");
    const p = emptyEl.querySelector("p");
    if (activeChip === "fav") {
      b.textContent = "暫時未有收藏嘅項目";
      p.textContent = "喺項目右上角撳 ☆ 就可以加入我的收藏！";
    } else if (activeChip !== "all") {
      b.textContent = "呢個分類暫時冇項目";
      p.textContent = tagFilter.length
        ? `撳多次「${tagFilter.map(tagLabel).join("／")}」取消支部篩選，或者撳「✕ 清除」`
        : "試下撳「全部」睇下其他分類";
    } else if (tagFilter.length && q) {
      b.textContent = "冇符合嘅結果";
      p.textContent = `換個關鍵字，或者撳「✕ 清除」取消支部篩選`;
    } else if (tagFilter.length) {
      b.textContent = `暫時冇「${tagFilter.map(tagLabel).join("／")}」支部嘅項目`;
      p.textContent = "試下揀其他支部（可以同時揀幾個），或者撳「全部」睇晒";
    } else {
      b.textContent = "未有內容";
      p.textContent = "試下改關鍵字，或者撳「全部」／轉第二個分頁睇下";
    }
  }

  // Build chip bar — 純文字（emoji 圖示阻位，被刻意抽走）；
  // 「我的收藏」唔再係 chip，搬咗去搜尋欄嗰行（#fav-jump）。
  // 手機版用短名（全部／進度紀錄…），桌面版用全名。
  const chipBtn = (id, full, short) =>
    `<button type="button" class="chip ${activeChip === id ? "on" : ""}" data-chip="${esc(id)}" ` +
    `onclick="jumpTo('${esc(id)}')" title="${esc(full)}">${chipTxt(full, short)}</button>`;
  chipsEl.innerHTML =
    chipBtn("all", "全部", "全部") +
    catIdx.map(({ c, i }) => chipBtn("cat-" + i, c.name, catShort(c.name))).join("");

  // 搜尋欄隔籬嘅「⭐ 我的收藏」掣：收藏視圖時高亮
  const favJump = document.getElementById("fav-jump");
  if (favJump) {
    const on = activeChip === "fav";
    favJump.classList.toggle("on", on);
    favJump.setAttribute("aria-pressed", on ? "true" : "false");
  }

  renderTagRow();
  renderSortRow();
  measurePanes();
  watchSections();
  updateBnavState();
  if (typeof renderSpotlight === "function") renderSpotlight();
}

// IntersectionObserver：滾動自動高亮 chip
let _io = null;
function watchSections() {
  if (_io) _io.disconnect();
  if (!("IntersectionObserver" in window)) return;
  // 單一分類模式或我的收藏模式時，唔需要用 observer
  if (activeChip !== "all" || searchEl.value.trim() || tagFilter.length) return;
  const secs = sectionsEl.querySelectorAll("section[id]");
  if (!secs.length) return;
  _io = new IntersectionObserver(
    (entries) => {
      if (searchEl.value.trim() || tagFilter.length || activeChip !== "all") return;
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
    if (footCount) footCount.textContent = `${sites.name || "SCOUT APP STORE"} · 共 ${total} 個項目 · ${pages.length} 個分頁`;
    render();
  } catch (e) {
    sectionsEl.innerHTML = "";
    emptyEl.style.display = "block";
    emptyEl.querySelector("b").textContent = "載入失敗";
    emptyEl.querySelector("p").textContent = e.message || "請稍後再試";
    if (footCount) footCount.textContent = "載入失敗";
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

// ── 分享 Modal 與 設置 Modal ──────────────────────────────────
let _currentShareApp = null;
function openShareModal(id) {
  let app = REG.find(a => String(a._id) === String(id));
  if (!app && typeof SITES !== "undefined" && SITES) {
    for (const p of SITES.pages || []) {
      for (const c of p.categories || []) {
        const found = (c.apps || []).find(a => String(a._id) === String(id));
        if (found) { app = found; break; }
      }
      if (app) break;
    }
  }
  if (!app) return;
  _currentShareApp = app;
  const modal = document.getElementById("share-modal");
  if (!modal) {
    if (typeof shareApp === "function") shareApp(app);
    return;
  }
  const titleEl = document.getElementById("share-modal-title");
  if (titleEl) titleEl.textContent = app.name;
  const descEl = document.getElementById("share-modal-desc");
  if (descEl) descEl.textContent = app.description || "SCOUT APP STORE 實用工具";
  const urlEl = document.getElementById("share-modal-url");
  if (urlEl) urlEl.value = app.url;
  
  const qrImg = document.getElementById("share-modal-qr");
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(app.url)}`;
  }
  modal.hidden = false;
}

function closeShareModal() {
  const modal = document.getElementById("share-modal");
  if (modal) modal.hidden = true;
}

function copyShareUrl() {
  if (!_currentShareApp) return;
  navigator.clipboard.writeText(_currentShareApp.url).then(() => {
    if (typeof showToast === "function") showToast("📋 連結已複製！");
  }).catch(() => {
    if (typeof showToast === "function") showToast(_currentShareApp.url);
  });
}

function shareTo(platform) {
  if (!_currentShareApp) return;
  const url = encodeURIComponent(_currentShareApp.url);
  const text = encodeURIComponent((_currentShareApp.name || "") + " — " + (_currentShareApp.description || ""));
  
  if (platform === "whatsapp") {
    window.open(`https://api.whatsapp.com/send?text=${text}%20${url}`, "_blank");
  } else if (platform === "facebook") {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank");
  } else if (platform === "telegram") {
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, "_blank");
  } else if (platform === "x") {
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, "_blank");
  } else if (platform === "line") {
    window.open(`https://social-plugins.line.me/lineit/share?url=${url}`, "_blank");
  } else if (platform === "system") {
    if (typeof shareApp === "function") shareApp(_currentShareApp);
  }
}

function openSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (modal) modal.hidden = false;
}

function closeSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (modal) modal.hidden = true;
}

// ── 底欄導覽（分類／連結／教學工具／排行榜／收藏）───────────────────
// 三個「內容分區」各有自己嘅分頁：
//   分類     → 商店分頁（apps 等，用頂部分頁導覽瀏覽）
//   連結     → 有用連結（links）
//   教學工具 → 學習圖卡（cards）／PPT 簡報（ppt）
// 「連結」「教學工具」只會顯示自己專區嘅內容 —— 專區未開放
// （分頁關閉／未有公開項目）就顯示佔位提示，絕唔可以兜底展示其他
// 分頁（例如商店）嘅分類，免得亂曬錯內容。
// bnavSection：null = 跟目前分頁推斷；"links"/"tools" = 專區佔位中。
let bnavSection = null;

function pageHasVisible(p) {
  return !!(p && p.enabled && (p.categories || []).some((c) => c.apps.some((a) => a.visible !== false)));
}
function linksPageOf() {
  return ((typeof SITES !== "undefined" && SITES && SITES.pages) || [])
    .find((p) => p.id === "links" || (p.label && p.label.includes("連結"))) || null;
}
function teachPagesOf() {
  return ((typeof SITES !== "undefined" && SITES && SITES.pages) || []).filter((p) =>
    p.id === "cards" || p.id === "ppt" ||
    (p.label && (p.label.includes("圖卡") || p.label.includes("簡報") || p.label.includes("教學"))));
}
function sectionOfPage(p) {
  if (!p) return "discover";
  if (p.id === "links" || (p.label && p.label.includes("連結"))) return "links";
  if (p.id === "cards" || p.id === "ppt" ||
      (p.label && (p.label.includes("圖卡") || p.label.includes("簡報")))) return "tools";
  return "discover"; // apps 及其他 → 「分類」
}
// 專區第一個「有公開內容」嘅分頁；未開放就 null
function sectionPageFor(section) {
  if (section === "links") return pageHasVisible(linksPageOf()) ? linksPageOf() : null;
  if (section === "tools") return teachPagesOf().find(pageHasVisible) || null;
  return null;
}
function homePage() {
  const pages = ((typeof SITES !== "undefined" && SITES && SITES.pages) || []).filter((p) => p.enabled);
  return pages.find((p) => sectionOfPage(p) === "discover") || pages[0] || null;
}
// 專區未開放：淨係提示，唔帶出任何分類／其他分頁內容
function renderBnavPlaceholder(section) {
  pageNavEl.hidden = true;
  pageNavEl.innerHTML = "";
  tagRowEl.hidden = true;
  if (sortRowEl) { sortRowEl.hidden = true; sortRowEl.innerHTML = ""; }
  chipsEl.innerHTML = "";
  sectionsEl.innerHTML = "";
  REG.length = 0;
  // 今期主打都係商店推廣內容 —— 專區佔位時一併收埋，唔好亂曬入去
  const hero = document.getElementById("hero-spotlight");
  if (hero) hero.hidden = true;
  const b = emptyEl.querySelector("b");
  const p = emptyEl.querySelector("p");
  if (section === "links") {
    b.textContent = "「有用連結」尚未開放";
    p.textContent = "管理員仲未上架任何有用連結，敬請期待。";
  } else {
    b.textContent = "「教學工具」尚未開放";
    p.textContent = "學習圖卡、PPT 簡報等教學材料仲未上架，敬請期待。";
  }
  emptyEl.style.display = "block";
  measurePanes();
  updateBnavState();
}

function updateBnavState() {
  let activeNav = "discover";
  if (typeof marketView !== "undefined" && marketView === "charts") {
    activeNav = "charts";
  } else if (typeof activeChip !== "undefined" && activeChip === "fav") {
    activeNav = "fav";
  } else if (bnavSection === "links" || bnavSection === "tools") {
    activeNav = bnavSection;
  } else if (typeof activePage === "function") {
    // 由分頁推斷分區：apps/未知 → 分類；links → 連結；cards/ppt → 教學工具
    // （以前 apps 會映射去「教學工具」，搞到分類內容著錯燈、亂曬入去）
    activeNav = sectionOfPage(activePage());
  }
  document.querySelectorAll(".bnav-btn").forEach(btn => {
    btn.classList.toggle("on", btn.dataset.bnav === activeNav);
  });
  return activeNav;
}

function handleBnav(target) {
  // 轉去「商店」分頁（分類／排行榜／收藏都係以商店為基礎）
  const goHome = () => {
    if ((bnavSection === "links" || bnavSection === "tools") && !sectionPageFor(bnavSection)) {
      bnavSection = "discover"; // 離開未開放專區嘅佔位
    }
    const h = homePage();
    const cur = typeof activePage === "function" ? activePage() : null;
    if (h && (!cur || !pageHasVisible(cur) || sectionOfPage(cur) !== "discover")) {
      ACTIVE_PAGE = h.id;
      localStorage.setItem(ACTIVE_PAGE_KEY, h.id);
      tagFilter = [];
      persistTagFilter();
    }
    if (typeof activeChip !== "undefined") activeChip = "all";
  };
  // 轉去某個內容專區：只會顯示專區自己嘅分頁；未開放 → render() 顯示佔位
  const goSection = (section) => {
    bnavSection = section;
    const sp = sectionPageFor(section);
    if (sp) {
      ACTIVE_PAGE = sp.id;
      localStorage.setItem(ACTIVE_PAGE_KEY, sp.id);
      tagFilter = [];
      persistTagFilter();
    }
    if (typeof activeChip !== "undefined") activeChip = "all";
  };

  if (target === "discover") {
    bnavSection = "discover";
    goHome();
    if (typeof setMarketView === "function") setMarketView("discover");
    else render();
  } else if (target === "links") {
    goSection("links");
    if (typeof setMarketView === "function") setMarketView("discover");
    else render();
  } else if (target === "tools") {
    goSection("tools");
    if (typeof setMarketView === "function") setMarketView("discover");
    else render();
  } else if (target === "charts") {
    goHome();
    if (typeof setMarketView === "function") setMarketView("charts");
  } else if (target === "fav") {
    goHome();
    if (typeof jumpTo === "function") jumpTo("fav");
    else if (typeof publicJumpTo === "function") publicJumpTo("fav");
    else render();
  }
  updateBnavState();
}

