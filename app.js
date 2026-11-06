/* ════════════════════════════════════════════════════════════════
   公開版面 app.js  (SCOUT APP STORE · 多分頁渲染)
   store.js 載入後、admin.js 之後載入。
   全站 = 4 個分頁（每個可獨立開放/關閉）；每頁有自己的分類；
   每頁項目全部係「連結」，逐個可開/關，並可帶童軍支部標籤篩選（可多選）。
   ════════════════════════════════════════════════════════════════ */

// ── 圖標背景配色（按名稱 hash 穩定取色）──────────────────────
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
  if (typeof trackClick === "function") trackClick(app._id);
  window.location.href = app.url;
}

/* ════════════════════════════════════════════════════════════════
   App 詳情 sheet（App Store 式 bottom sheet）
   撳卡唔再即刻跳走：先睇詳情 → 再撳「開啟」。
   收藏／讚好／分享全部收埋喺呢度，主畫面（貨架）可以保持安靜。
   ════════════════════════════════════════════════════════════════ */
let _sheetApp = null;
let _sheetEscBound = false;
let _sheetTrigger = null;   // 閂 sheet 之後，focus 要返去撳佢嗰張卡（鍵盤／讀屏用）

function syncSheetButtons() {
  const app = _sheetApp;
  if (!app) return;
  const favBtn = document.getElementById("sheet-fav");
  const heartBtn = document.getElementById("sheet-heart");
  const favOn = isFavorite(app._id), heartOn = isHearted(app._id);
  if (favBtn) {
    favBtn.classList.toggle("on", favOn);
    favBtn.setAttribute("aria-pressed", favOn ? "true" : "false");
    favBtn.innerHTML = `${favOn ? "★" : "☆"} 收藏`;
  }
  if (heartBtn) {
    heartBtn.classList.toggle("on", heartOn);
    heartBtn.setAttribute("aria-pressed", heartOn ? "true" : "false");
    heartBtn.innerHTML = `${heartOn ? "♥" : "♡"} 讚好`;
  }
}

function openAppSheet(idx) {
  const app = REG[idx];
  if (!app) return;
  const sheet = document.getElementById("app-sheet");
  if (!sheet) { openApp(app); return; } // markup 未載入 → 退化做直接開，唔會撳咗冇反應
  _sheetApp = app;
  _sheetTrigger = document.activeElement;

  const iconEl = document.getElementById("sheet-icon");
  if (iconEl) iconEl.innerHTML = appIconHTML(app, "sheet");
  const nameEl = document.getElementById("sheet-name");
  if (nameEl) nameEl.textContent = app.name || "";
  const subEl = document.getElementById("sheet-sub");
  if (subEl) subEl.textContent = app.cat || "";
  const descEl = document.getElementById("sheet-desc");
  if (descEl) {
    descEl.textContent = app.description || app.note || "未有簡介。";
    descEl.hidden = false;
  }
  const tagsEl = document.getElementById("sheet-tags");
  if (tagsEl) {
    const tags = app.tags || [];
    tagsEl.innerHTML = tags.map((t) => `<span class="sheet-tag">${esc(t)}</span>`).join("");
    tagsEl.hidden = !tags.length;
  }
  const statsEl = document.getElementById("sheet-stats");
  if (statsEl) {
    const bits = [];
    if (app.clicks >= 100) bits.push(`🔥 ${Number(app.clicks).toLocaleString()} 次開啟`);
    if (app.stars >= 100) bits.push(`⭐ ${Number(app.stars).toLocaleString()} 收藏`);
    if (app.hearts >= 100) bits.push(`❤️ ${Number(app.hearts).toLocaleString()} 讚好`);
    statsEl.innerHTML = bits.map((b) => `<span class="sheet-stat">${b}</span>`).join("");
    statsEl.hidden = !bits.length;
  }

  const openBtn = document.getElementById("sheet-open");
  if (openBtn) openBtn.onclick = () => {
    if (typeof trackClick === "function") trackClick(app._id);
    window.location.href = app.url;
  };
  const favBtn = document.getElementById("sheet-fav");
  if (favBtn) {
    favBtn.dataset.id = app._id || "";
    favBtn.onclick = () => { toggleFav(favBtn); syncSheetButtons(); };
  }
  const heartBtn = document.getElementById("sheet-heart");
  if (heartBtn) {
    heartBtn.dataset.id = app._id || "";
    heartBtn.onclick = () => { toggleHeartBtn(heartBtn); syncSheetButtons(); };
  }
  const shareBtn = document.getElementById("sheet-share");
  if (shareBtn) shareBtn.onclick = () => openShareModal(app._id);
  syncSheetButtons();

  sheet.hidden = false;
  document.body.classList.add("sheet-open");
  const panel = sheet.querySelector(".sheet-panel");
  if (panel) panel.focus?.();

  if (!_sheetEscBound) {
    _sheetEscBound = true;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !document.getElementById("app-sheet")?.hidden) closeAppSheet();
    });
  }
}

function closeAppSheet() {
  const sheet = document.getElementById("app-sheet");
  if (!sheet || sheet.hidden) return;
  sheet.hidden = true;
  document.body.classList.remove("sheet-open");
  _sheetApp = null;
  if (_sheetTrigger && typeof _sheetTrigger.focus === "function") {
    try { _sheetTrigger.focus({ preventScroll: true }); } catch { _sheetTrigger.focus(); }
  }
  _sheetTrigger = null;
}

function iconHTML(app) {
  // 唔再為每粒 app 隨機上漸層底色（readme design-review：無漸層、accent 只落一處）。
  // icon 自己就係主角：真圖標 + 留白，比「十種顏色嘅圓角方塊」安靜得多。
  return `<div class="tile-icon">${appIconHTML(app, "tile")}</div>`;
}

/* ════════════════════════════════════════════════════════════════
   ROUND 2 · App Store 版面
   ── 貨架（shelf）＋ 大卡 ＋ 詳情 sheet ＋ 統一線稿分類圖標
   規則見 DESIGN.md：冇漸層、冇光暈、一隻金 accent、icon 做主角。
   ════════════════════════════════════════════════════════════════ */

/* 分類小圖標：後台仍然可以揀 emoji，但常見嘅會換成同一套 24px 線稿，
   令每條貨架嘅開頭一致（以前係 🧭🎮🧰🃏 乜都有，睇落好雜）。
   未對應到嘅 emoji 照用返後台設定，唔會亂咁改人嘅選擇。 */
const CAT_ICON_MAP = {
  "🧭": "compass", "🎮": "game", "🕹️": "game", "🧰": "tools", "🛠️": "tools",
  "🃏": "cards", "📽️": "slides", "🎬": "slides", "🔗": "link", "🌐": "globe",
  "📚": "book", "📖": "book", "📝": "note", "🎨": "art", "🔔": "bell",
  "🗺️": "map", "⛺": "camp", "🏆": "trophy", "🧪": "lab", "⚙️": "gear",
  "🎯": "target", "📊": "chart", "⏱️": "clock", "🧮": "calc"
};
const CAT_PATHS = {
  compass: '<circle cx="12" cy="12" r="9"/><polygon points="15.4 8.6 13.3 13.3 8.6 15.4 10.7 10.7"/>',
  game: '<rect x="2.5" y="8" width="19" height="9.5" rx="4.5"/><path d="M7 11.2v3M5.5 12.7h3"/><circle cx="16.5" cy="12" r="1"/><circle cx="18.6" cy="14" r="1"/>',
  tools: '<rect x="3" y="8" width="18" height="12" rx="2.5"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
  cards: '<rect x="3" y="5" width="11" height="15" rx="2"/><path d="M17 7.5l2 14.2"/><path d="M9 9.5h2.2M9 13h3"/>',
  slides: '<rect x="2.5" y="5" width="19" height="12.5" rx="2"/><path d="M12 17.5V21M8.5 21h7"/><path d="M6.5 9.5h6M6.5 13h4"/>',
  link: '<path d="M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11.4 6"/><path d="M14 11a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7L12.6 18"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z"/>',
  note: '<path d="M5 3.5h9l5 5V21H5z"/><path d="M14 3.5v5h5M8 13h8M8 17h5"/>',
  art: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2s-.7-2 .6-2H18a3 3 0 0 0 3-3c0-6-4-9-9-9z"/><circle cx="8.5" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="15.5" cy="10" r="1"/>',
  bell: '<path d="M18 15V10a6 6 0 1 0-12 0v5l-1.8 3h15.6z"/><path d="M10 21h4"/>',
  map: '<path d="M9 4l6 2.5 5-2v14l-5 2-6-2.5-5 2v-14z"/><path d="M9 4v14M15 6.5v14"/>',
  camp: '<path d="M12 4l8.5 15.5h-17z"/><path d="M12 9.5l4 10M12 9.5l-4 10"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5.5H5.5A2.5 2.5 0 0 0 8 10M16 5.5h2.5A2.5 2.5 0 0 1 16 10"/><path d="M12 13v4M9 20h6"/>',
  lab: '<path d="M9.5 3v6L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14.5 9V3"/><path d="M8 3h8M7 14h10"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7" y="12" width="3" height="5" rx="1"/><rect x="12" y="8" width="3" height="9" rx="1"/><rect x="17" y="5" width="3" height="12" rx="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.4 2"/>',
  calc: '<rect x="4.5" y="2.5" width="15" height="19" rx="2.5"/><path d="M8 7h8"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18.5h.01M12 18.5h.01M15.5 18.5h.01"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>'
};
function catIconHTML(emoji, name) {
  const key = CAT_ICON_MAP[String(emoji || "").trim()] || (emoji ? null : "grid");
  if (key && CAT_PATHS[key]) {
    return `<span class="cat-ico" aria-hidden="true"><svg viewBox="0 0 24 24">${CAT_PATHS[key]}</svg></span>`;
  }
  // 後台自己揀嘅 emoji 冇線稿版本 → 照用（唔好亂改人嘅選擇）
  if (emoji) return `<span class="cat-ico cat-ico-emoji" aria-hidden="true">${esc(emoji)}</span>`;
  return `<span class="cat-ico" aria-hidden="true"><svg viewBox="0 0 24 24">${CAT_PATHS.grid}</svg></span>`;
}

/* 貨架卡：icon 左、名＋描述右（App Store「編輯精選」橫向卡）。
   一粒卡只做一件事：撳落去開詳情 sheet；收藏／讚好／分享搬入 sheet。 */
function cardHTML(idx, delay) {
  const app = REG[idx];
  const d = Math.min(delay || 0, 12) * 30;
  const desc = String(app.description || app.note || "").trim();
  // 冇描述就唔好留個空 span（會偷偷撐高卡，每張卡高矮唔一）
  const descHTML = desc ? `<span class="card-desc">${esc(desc)}</span>` : "";
  return `
  <a class="card" href="${esc(app.url)}" data-idx="${idx}" data-id="${esc(app._id || "")}"
     style="animation-delay:${d}ms" aria-label="${esc(app.name)}：開啟詳情">
    <span class="card-icon">${appIconHTML(app, "card")}</span>
    <span class="card-copy">
      <span class="tile-name">${esc(app.name)}</span>
      ${descHTML}
    </span>
    <span class="card-go" aria-hidden="true">›</span>
  </a>`;
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
    return `<a class="chart-item tile" href="${esc(a.url)}" data-idx="${idx}" data-id="${esc(a._id)}"><span class="chart-rank">${i+1}</span>${iconHTML(a)}<div class="chart-copy"><h3>${esc(a.name)}</h3><p>${esc(a.description || '')}</p></div>${scoreHTML}<span class="chart-open">開啟 ↗</span></a>`;
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

function toggleFav(el) {
  const id = el.dataset.id;
  if (!id) return;
  toggleFavorite(id);
  const on = isFavorite(id);
  // 收藏 = 星星（⭐）：底欄「收藏」、「最多人收藏」排行榜都係星星，圖示要一致
  document.querySelectorAll(`.fav-star[data-id="${id}"]`).forEach(btn => {
    btn.classList.toggle("on", on);
    const svg = btn.querySelector("svg");
    if (svg) svg.setAttribute("fill", on ? "currentColor" : "none");
  });
}

function toggleHeartBtn(el) {
  const id = el.dataset.id;
  if (!id) return;
  toggleHeart(id);
  const on = isHearted(id);
  // 讚好 = 心心（❤️）：「最受歡迎」排行榜、「N 人讚好」都係心心
  document.querySelectorAll(`.like-heart[data-id="${id}"]`).forEach(btn => {
    btn.classList.toggle("on", on);
    const svg = btn.querySelector("svg");
    if (svg) svg.setAttribute("fill", on ? "currentColor" : "none");
  });
}

function sectionHTML(title, icon, apps, id) {
  if (!apps.length) return "";
  const start = REG.length;
  apps.forEach((a) => REG.push(a));
  const cards = apps.map((_, i) => cardHTML(start + i, i)).join("");
  // 分類貨架先有「全部」；「我的收藏」唔需要。
  // 得 1–2 個就唔出（貨架本身都睇得晒，多粒掣反而嘈）。
  const more = /^cat-\d+$/.test(String(id)) && apps.length > 2
    ? `<button type="button" class="sec-more" onclick="jumpTo('${esc(id)}')" ` +
      `aria-label="睇晒「${esc(title)}」全部 ${apps.length} 個">全部 <span aria-hidden="true">›</span></button>`
    : "";
  return `
  <section id="${id}" class="shelf-sec">
    <div class="sec-head">
      ${catIconHTML(icon, title)}
      <h2>${esc(title)}</h2>
      <span class="num">${apps.length}</span>
      ${more}
    </div>
    <div class="shelf">${cards}</div>
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

// ── 童軍支部篩選列（可多選）─────────────────────────────────
// 未揀 = 中性外殼（睇落係「可以撳」）；揀咗 = accent 漸層＋✓ ——
// 以前得一句灰字加條好幼嘅底線，手機上根本睇唔出揀咗邊個支部。
// 標籤用 chipTxt：桌面出全名（小童軍），手機收做一個字（小）；
// 標籤列 flex-wrap 識轉行，所以窄屏都唔會有標籤被推出螢幕外。
function renderTagRow() {
  const pg = activePage();
  const hasTag = !!(pg && (pg.categories || []).some((c) => c.apps.some((a) => a.visible !== false && (a.tags || []).length)));
  if (!hasTag || !pg) { tagRowEl.hidden = true; return; }
  tagRowEl.hidden = false;
  tagRowEl.className = "tag-row";
  const picked = tagFilter.length;
  tagRowEl.innerHTML =
    `<span class="tag-row-hint">🔍<span class="wide-only"> 適用支部</span><span class="narrow-only">支部</span>：</span>` +
    SCOUT_TAGS.map((t) => {
      const on = tagActive(t);
      return `<button type="button" class="tag-chip lv-chip${on ? " on" : ""}" ` +
        `onclick="setTag('${esc(t)}')" title="${esc(t)}" ` +
        `aria-label="${esc(t)}" aria-pressed="${on ? "true" : "false"}">` +
        `${on ? '<span class="chip-ico" aria-hidden="true">✓</span>' : ""}` +
        `${chipTxt(t, scoutTagShort(t))}</button>`;
    }).join("") +
    (picked
      ? `<span class="tag-row-note">已揀 ${picked} 個</span>` +
        `<button type="button" class="tag-chip tag-clear" onclick="clearTags()" ` +
        `title="清除支部篩選" aria-label="清除支部篩選">✕ 清除</button>`
      : `<span class="tag-row-note muted-hint">可多選</span>`);
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
  const emptyAct = document.getElementById("empty-action");
  if (emptyAct) { emptyAct.hidden = true; emptyAct.innerHTML = ""; }
  if (html) {
    emptyEl.style.display = "none";
  } else {
    emptyEl.style.display = "block";
    const b = emptyEl.querySelector("b");
    const p = emptyEl.querySelector("p");
    if (activeChip === "fav") {
      b.textContent = "暫時未有收藏嘅項目";
      p.textContent = "喺項目下面撳 ☆ 就可以加入我的收藏！";
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
  // 「我的收藏」唔再係 chip，入口喺底部常駐列（data-bnav="fav"）。
  // 手機版用短名（全部／進度紀錄…），桌面版用全名。
  const chipBtn = (id, full, short) =>
    `<button type="button" class="chip ${activeChip === id ? "on" : ""}" data-chip="${esc(id)}" ` +
    `onclick="jumpTo('${esc(id)}')" title="${esc(full)}">${chipTxt(full, short)}</button>`;
  chipsEl.innerHTML =
    chipBtn("all", "全部", "全部") +
    catIdx.map(({ c, i }) => chipBtn("cat-" + i, c.name, catShort(c.name))).join("");

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
  // 只喺公開版記錄入站；管理員頁唔會混入訪客數字。
  if (typeof trackSiteVisit === "function") trackSiteVisit();
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

// 公開版面 click 委派：撳卡 → 開詳情 sheet（唔再一下就跳走，App Store 式）
// 舊 tile（.tile）仍然支援：排行榜以外嘅舊 markup／後台預覽會用到。
sectionsEl.addEventListener("click", (e) => {
  const gh = e.target.closest(".gh-badge");
  if (gh) return; // GH 已經自帶 window.open
  const hit = e.target.closest(".card, .tile");
  if (!hit) return;
  e.preventDefault();
  const idx = Number(hit.dataset.idx);
  if (!REG[idx]) return;
  if (hit.classList.contains("tile") && !hit.classList.contains("card")) openApp(REG[idx]);
  else openAppSheet(idx);
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
  const act = document.getElementById("empty-action");
  if (section === "links") {
    b.textContent = "「有用連結」尚未開放";
    p.textContent = "管理員仲未上架任何有用連結，歡迎率先分享好用網站！";
    if (act) {
      act.hidden = false;
      act.innerHTML = `<button type="button" class="market-submit share-link-btn" onclick="submissionOpen('link')">🌐 立即分享網站連結</button>`;
    }
  } else {
    b.textContent = "「教學工具」尚未開放";
    p.textContent = "學習圖卡、PPT 簡報等教學材料仲未上架，歡迎率先分享雲端教材！";
    if (act) {
      act.hidden = false;
      act.innerHTML = `<button type="button" class="market-submit share-material-btn" onclick="submissionOpen('material')">📚 立即分享教材連結</button>`;
    }
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

