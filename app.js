/* ════════════════════════════════════════════════════════════════
   公開版面 app.js  (童軍小工具 · 多分頁渲染)
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

// ── 我的最愛 ─────────────────────────────────────────────
const FAV_KEY = "showcase-favorites";
function getFavorites() { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch { return []; } }
function isFavorite(id) { return getFavorites().includes(id); }
function toggleFavorite(id) {
  let favs = getFavorites();
  const had = favs.includes(id);
  if (had) favs = favs.filter((x) => x !== id);
  else favs.unshift(id);
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  // 全站累計收藏數（「最多人收藏」排序用）；本地即刻同步，唔使等 reload
  if (SITES) {
    for (const p of SITES.pages) for (const c of p.categories) {
      const a = c.apps.find((x) => x._id === id);
      if (a) a.stars = Math.max(0, (a.stars || 0) + (had ? -1 : 1));
    }
  }
  if (typeof trackStar === "function") trackStar(id, had ? -1 : 1);
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
function setMarketView(view) {
  marketView = view;
  if (view === 'charts' && sortMode === 'default') sortMode = 'clicks';
  document.querySelectorAll('[data-market]').forEach(b => {
    b.classList.toggle('on', b.dataset.market === view);
    b.setAttribute('aria-pressed', String(b.dataset.market === view));
  });
  render();
}
// 分數要夠 100 先喺排行榜顯示 —— 太細嘅數字（例如 3 次開啟）擺上嚟唔好睇，
// 排名照舊顯示，只收埋右邊個分數格
const CHART_SCORE_MIN = 100;
function chartHTML(apps) {
  const metric = sortMode === 'stars' ? 'stars' : 'clicks';
  const ranked = [...apps].sort((a,b) => (b[metric] || 0) - (a[metric] || 0) || a.name.localeCompare(b.name, 'zh-HK')).slice(0, 50);
  if (!ranked.length) return '';
  return `<section class="chart-section"><div class="sec-head"><h2>${metric === 'stars' ? '收藏榜' : '人氣榜'}</h2><span class="num">TOP ${ranked.length}</span></div><p class="chart-note">目前分頁及篩選內的累計${metric === 'stars' ? '收藏' : '開啟'}次數排名 · 同分按名稱排序 · 滿 ${CHART_SCORE_MIN} 先顯示次數</p><div class="chart-list">${ranked.map((a,i) => {
    const idx = REG.push(a)-1;
    const score = Number(a[metric] || 0);
    const scoreHTML = score >= CHART_SCORE_MIN ? `<div class="chart-score"><b>${score.toLocaleString()}</b><small>${metric === 'stars' ? '收藏' : '次開啟'}</small></div>` : '';
    return `<a class="chart-item tile" href="${esc(a.url)}" data-idx="${idx}" data-id="${esc(a._id)}"><span class="chart-rank">${String(i+1).padStart(2,'0')}</span>${iconHTML(a)}<div class="chart-copy"><h3>${esc(a.name)}</h3><p>${esc(a.description || '')}</p><div class="tile-tags">${(a.tags || []).map(t=>`<span>${esc(t)}</span>`).join('')}</div></div>${scoreHTML}<span class="chart-open">開啟 ↗</span></a>`;
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

// ── 排序模式 ─────────────────────────────────────────────────
// 手機版淨係顯示 emoji（文字包咗喺 .wide-only，細屏被 CSS 收埋）
const SORT_KEY = "showcase-sort";
const SORTS = [
  { id: "default", ico: "🗂", label: "預設順序", hint: "用後台排好嘅順序" },
  { id: "clicks",  ico: "🔥", label: "最多人點擊", hint: "按開啟次數排序" },
  { id: "stars",   ico: "⭐", label: "最多人收藏", hint: "按全站收藏人數排序" }
];
let sortMode = SORTS.some((s) => s.id === localStorage.getItem(SORT_KEY))
  ? localStorage.getItem(SORT_KEY) : "default";

function setSort(m) {
  if (!SORTS.some((s) => s.id === m)) return;
  sortMode = m;
  localStorage.setItem(SORT_KEY, m);
  render();
}

// 穩定排序：同分時保留原本嘅 sort_order
function sortApps(list) {
  const byOrder = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);
  if (sortMode === "clicks") {
    return [...list].sort((a, b) => (b.clicks || 0) - (a.clicks || 0) || byOrder(a, b));
  }
  if (sortMode === "stars") {
    return [...list].sort((a, b) => (b.stars || 0) - (a.stars || 0) || (b.clicks || 0) - (a.clicks || 0) || byOrder(a, b));
  }
  return list;
}

function enabledPages() { return (SITES.pages || []).filter((p) => p.enabled); }
function pageById(id) { return (SITES.pages || []).find((p) => p.id === id); }
function activePage() { return pageById(ACTIVE_PAGE); }

function measurePanes() {
  const root = document.documentElement;
  const pnav = pageNavEl;
  const h = (pnav && !pnav.hidden && pnav.offsetHeight) ? pnav.offsetHeight : 0;
  root.style.setProperty("--pnav-h", h + "px");
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
  const tags = (app.tags || []).filter(Boolean);
  const starred = isFavorite(app._id);
  return `
  <a class="tile" href="${esc(app.url)}" title="${esc((app.description || app.name) + (tags.length ? " 標籤：" + tags.join("、") : ""))}"
     data-idx="${idx}" data-id="${esc(app._id || "")}" style="animation-delay:${d}ms">
    <span class="fav-star ${starred ? "on" : ""}" title="加入我的最愛" data-id="${esc(app._id || "")}" onclick="event.preventDefault(); event.stopPropagation(); toggleFav(this)"></span>
    ${app.github ? `<span class="gh-badge" title="GitHub repo" onclick="event.preventDefault(); event.stopPropagation(); window.open('${esc(app.github)}','_blank')">GH</span>` : ""}
    ${iconHTML(app)}
    <div class="tile-name">${esc(app.name)}</div>
    ${tags.length ? `<div class="tile-tags">${tags.map((t) => `<span title="${esc(t)}">${esc(scoutTagShort(t))}</span>`).join("")}</div>` : ""}
    ${app.description ? `<div class="tile-desc">${esc(app.description)}</div>` : ""}
  </a>`;
}

function toggleFav(el) {
  const id = el.dataset.id;
  if (!id) return;
  toggleFavorite(id);
  el.classList.toggle("on", isFavorite(id));
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
// 全名（小童軍／深資童軍…）留喺 title／aria-label，肉眼見到就係一個字。
// 未揀嘅時候一律用「中性」外殼（唔好一睇以為已經撳咗），撳咗先變 accent。
function renderTagRow() {
  const pg = activePage();
  const hasTag = !!(pg && (pg.categories || []).some((c) => c.apps.some((a) => a.visible !== false && (a.tags || []).length)));
  if (!hasTag || !pg) { tagRowEl.hidden = true; return; }
  tagRowEl.hidden = false;
  const n = tagFilter.length;
  tagRowEl.innerHTML =
    `<span class="tag-row-hint">🔍<span class="wide-only"> 適用支部</span>：</span>` +
    SCOUT_TAGS.map((t) => {
      const on = tagActive(t);
      return `<button type="button" class="tag-chip lv-chip ${on ? "on" : ""}" ` +
        `onclick="setTag('${esc(t)}')" title="${esc(t)}（撳一下篩選／再撳取消）" ` +
        `aria-label="${esc(t)}" aria-pressed="${on ? "true" : "false"}">${esc(scoutTagShort(t))}</button>`;
    }).join("") +
    (n
      ? `<span class="tag-row-note"><span class="wide-only">已揀 ${n} 個支部</span><span class="narrow-only">${n} 個</span></span>` +
        `<button type="button" class="tag-chip tag-clear" onclick="clearTags()" title="清晒支部篩選" aria-label="清晒支部篩選">✕ 清除</button>`
      : `<span class="tag-row-hint wide-only muted-hint">（可多選）</span>`);
}

// ── 排序列 ───────────────────────────────────────────────────
// 手機：🔥／⭐／🗂 三個 emoji；桌面：emoji + 全名
function renderSortRow() {
  if (!sortRowEl) return;
  const pg = activePage();
  const count = pg
    ? (pg.categories || []).reduce((n, c) => n + c.apps.filter((a) => a.visible !== false).length, 0)
    : 0;
  // 得 0／1 個項目就唔使排序
  if (count < 2) { sortRowEl.hidden = true; return; }
  sortRowEl.hidden = false;
  sortRowEl.innerHTML =
    `<span class="tag-row-hint">↕<span class="wide-only"> 排序</span>：</span>` +
    SORTS.filter(s => marketView !== "charts" || s.id !== "default").map((s) => {
      const on = sortMode === s.id;
      return `<button type="button" class="tag-chip sort-chip ${on ? "on" : ""}" ` +
        `onclick="setSort('${s.id}')" title="${esc(s.label)} — ${esc(s.hint)}" ` +
        `aria-label="${esc(s.label)}" aria-pressed="${on ? "true" : "false"}">` +
        `<span class="chip-ico">${s.ico}</span><span class="wide-only">${esc(s.label)}</span></button>`;
    }).join("");
}

// ── 主要渲染 ─────────────────────────────────────────────────
function render() {
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
  const shownOf = (c) => sortApps(c.apps.filter(visible).filter(match));
  // 呢頁「有內容」嘅分類 —— 唔畀目前搜尋／支部篩選收窄，
  // 咁分類同適用支部先至可以同時撳（唔會「LOCK 死」）。
  const catIdx = [];
  pg.categories.forEach((c, i) => { if (c.apps.some(visible)) catIdx.push({ c, i }); });

  // 「我的最愛」／單一分類／全部 —— 全部都同搜尋、支部篩選疊加（AND；支部之間係 OR）
  const favIds = new Set(getFavorites());
  if (activeChip === "fav") {
    const favApps = [];
    for (const { c } of catIdx) for (const a of shownOf(c)) if (favIds.has(a._id)) favApps.push(a);
    html += sectionHTML("我的最愛", "⭐", favApps, "favorites");
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
      b.textContent = "暫時未有我的最愛";
      p.textContent = "喺項目右上角撳 ☆ 就可以加入收藏！";
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

  // Build chip bar with 「我的最愛」chip
  // 手機版用短名（全部／最愛／進度紀錄…），桌面版用全名；emoji 兩邊都顯示
  const chipBtn = (id, ico, full, short) =>
    `<button type="button" class="chip ${activeChip === id ? "on" : ""}" data-chip="${esc(id)}" ` +
    `onclick="jumpTo('${esc(id)}')" title="${esc(full)}">` +
    `${ico ? `<span class="chip-ico">${esc(ico)}</span>` : ""}${chipTxt(full, short)}</button>`;
  chipsEl.innerHTML =
    chipBtn("all", "⌂", "全部", "全部") +
    chipBtn("fav", "⭐", "我的最愛", "最愛") +
    catIdx.map(({ c, i }) => chipBtn("cat-" + i, c.icon, c.name, catShort(c.name))).join("");

  renderTagRow();
  renderSortRow();
  measurePanes();
  watchSections();
  if (typeof renderSpotlight === "function") renderSpotlight();
}

// IntersectionObserver：滾動自動高亮 chip
let _io = null;
function watchSections() {
  if (_io) _io.disconnect();
  if (!("IntersectionObserver" in window)) return;
  // 單一分類模式或我的最愛模式時，唔需要用 observer
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
    footCount.textContent = `${sites.name || "童軍小工具"} · 共 ${total} 個項目 · ${pages.length} 個分頁`;
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
