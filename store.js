/* ════════════════════════════════════════════════════════════════
   數據層 store.js
   讀取優先序：Supabase（已配置）→ localStorage（demo）→ apps.json

   ── 新版結構（多分頁）────────────────────────────────────
   全站名「SCOUT APP STORE」，含 4 個可分頁（每頁可獨立開放/關閉）：
     apps  (小工具/Apps)   cards(學習圖卡)   ppt(簡報)   links(有用連結)
   每個分頁有自己嘅一套分類；每頁入面嘅項目(全部係「連結」)逐個
   可開/關。每個項目可揀 童軍支部標籤（小童軍/幼童軍/童軍/深資童軍/樂行童軍）；
   公開版嗰列叫「適用支部」，可以**同時揀幾個**（OR：揀「小＋幼」= 兩個支部一齊睇）。
   ════════════════════════════════════════════════════════════════ */

// ⚙️ 建好 Supabase 項目後填呢度（步驟見 README.md「Admin 設置」）
const SUPABASE_CONFIG = {
  url: "https://visqyeskdauipodudpxz.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpc3F5ZXNrZGF1aXBvZHVkcHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjQ5MjUsImV4cCI6MjEwNDAwMDkyNX0.Ct2jJpJUtRFiVSux774aGRdegFG8fr5mWeD1RMm_dXs",
  // 你 admin 帳號嘅 email —— 必須同 Supabase Authentication 嘅管理員用戶、
  // Vercel 環境變數 ADMIN_EMAIL、同 migrations SQL 入面 is_store_admin() 嘅 email 完全一致，
  // 否則登入後會話會計為非管理員（後台入唔到／RLS 寫唔到）。
  adminEmail: "ai@skwscout.org.hk"
};

/* ⚙️ Scout Admin（旅團接入管理中心 https://scout-admin-blue.vercel.app/）对接配置
   投稿寫入 Supabase **之後**，會「多送一份」去呢度：
     Google Apps Script → ① 登記喺 Google Sheet「作品投稿」② MailApp 發電郵畀 ADMIN_EMAIL
     → 管理員喺 Sheet／電郵登記完，再按「轉寄給」嗰個信箱轉交負責人。
   呢度只係「瀏覽器用嘅預設值」；正式部署建議用 Vercel 環境變數覆寫
   （SCOUT_APPS_SCRIPT_URL / ADMIN_FORWARD_EMAIL），改嘢唔使人手改代碼。
   ⚠️ Apps Script 網址同 ADMIN 信箱本身都唔係秘密（Scout Admin 說明書公開晒），
      而且任何提交都唔需要 Key；真正嘅寫入權限仍然靠 Supabase RLS。 */
const SCOUT_ADMIN_CONFIG = {
  // Scout Admin 接收端（Apps Script Web App /exec）。留空 = 唔送通知。
  execUrl: "https://script.google.com/macros/s/AKfycbxj5BDDGgjs559smkK4Z5aYImWYeXbN5af8U1ObON0z9WnsN6QJW4I1XWolhs5kQ_H-UQ/exec",
  // 管理員登記後要轉寄俾邊個（同 Apps Script ADMIN_EMAIL 一樣 = 自己收咗就有副本）
  forwardEmail: "playerkousas@hotmail.com",
  // 通知信入面俾管理員返嚟審核嘅連結（留空 = 用而家嘅 domain + /#admin）
  reviewUrl: "",
  // Scout Admin 後台（管理員喺呢度睇 Sheet 登記結果）；留空 = 我哋後台唔顯示連結
  recordsUrl: "https://scout-admin-blue.vercel.app/"
};

const LS_KEY = "showcase-admin-demo";
let _sb = null;

/* 圖標 cache-busting 版本號
   ─────────────────────────────────────────────────────────────
   點解要：外部 app 換咗 favicon，但我哋睇到嘅係舊圖，成因有幾層快取
   （Vercel CDN 7 日、Google s2 幾日、app 站自己 icons/*  一年 immutable、
   瀏覽器 HTTP cache）。呢個版本號會加做 `?v=` 落所有 icon 網址，
   一改就等於換咗條 URL，所有快取層即刻當新資源。
   幾時改：① 見到某 app 換咗 logo 但商店仲係舊圖 → 後台撳「🔄 重新抓取圖標」
           ② 我哋自己換 icons/*.png → 改呢個字串（順手配合 vercel.json immutable）
   ⚠️ 唔好靠「原圖覆蓋同一檔名」：見 readme docs/33 §9.5。 */
let ICON_VER = "20261106";
const iconVer = () => encodeURIComponent(ICON_VER);

// 全站 Logo（項目／分類冇揀 icon 時嘅預設圖示）
const SITE_LOGO = "/icons/icon-192.png?v=" + iconVer();

// HTML escape（共用，公開 / 後台 / store 都用）
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/* ════════════════════════════════════════════════════════════════
   全站線稿圖標（UI icon set）
   ──────────────────────────────────────────────────────────────
   唔再用 emoji 做介面圖示：emoji 每個系統畫法唔同、粗幼唔一、顏色跟系統，
   睇落好「土炮」，亦做唔到「同一套語言」。所有 UI 圖示一律經 svgIcon() 出：
     24×24 viewBox、fill:none、stroke:currentColor、粗細 1.6、
     round cap/join；尺寸由 CSS 用 font-size 控制（預設 1em）。

   一隻字串欄位 icon 可以係：
     "i:compass" → 直接指定線稿圖標（後台新揀嘅寫法）
     "🧭"        → 舊資料 emoji，經 EMOJI_TO_ICON 對應
     對應唔到    → ICON_FALLBACK（通用方格），永遠唔會漏返 emoji 出街
   ════════════════════════════════════════════════════════════════ */
const ICON_PATHS = {
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4 13.4 13.4 8.4 15.6 10.6 10.6z"/>',
  game: '<rect x="2.5" y="8" width="19" height="9.5" rx="4.5"/><path d="M7 11.2v3M5.5 12.7h3"/><circle cx="16.3" cy="11.8" r="1"/><circle cx="18.4" cy="13.8" r="1"/>',
  tools: '<rect x="3" y="8" width="18" height="12" rx="2.5"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
  cards: '<rect x="3" y="5" width="11" height="15" rx="2"/><path d="M17 7.5l2 14.2"/><path d="M8.5 9.5h3M8.5 13h3.5"/>',
  slides: '<rect x="2.5" y="5" width="19" height="12.5" rx="2"/><path d="M12 17.5V21M8.5 21h7"/><path d="M6.5 9.5h6M6.5 13h4"/>',
  book: '<path d="M12 6.6C10.6 5.1 8.4 4.3 4 4.3v14.4c4.4 0 6.6.8 8 2.3 1.4-1.5 3.6-2.3 8-2.3V4.3c-4.4 0-6.6.8-8 2.3z"/><path d="M12 6.6v14.4"/>',
  note: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  art: '<path d="M12 3.2a8.9 8.9 0 1 0 0 17.8c1 0 1.8-.8 1.8-1.8 0-.6-.3-1-.3-1.7 0-1 .8-1.7 1.8-1.7h1.9a4.4 4.4 0 0 0 4.4-4.4c0-4.5-4.3-8.2-9.6-8.2z"/><circle cx="8.2" cy="10" r="1"/><circle cx="12" cy="7.6" r="1"/><circle cx="15.6" cy="9.6" r="1"/>',
  bell: '<path d="M18 15V10a6 6 0 1 0-12 0v5l-1.7 2.4h15.4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  map: '<path d="M9 3.8 3.5 6.2v14L9 17.8l6 2.4 5.5-2.4v-14L15 6.2 9 3.8z"/><path d="M9 3.8v14M15 6.2v14"/>',
  camp: '<path d="M12 4.6 3.4 20h17.2L12 4.6z"/><path d="M12 11.4V20"/>',
  trophy: '<path d="M8 3.8h8v5.4a4 4 0 0 1-8 0z"/><path d="M8 5.6H5.4V8a3 3 0 0 0 3 3M16 5.6h2.6V8a3 3 0 0 1-3 3"/><path d="M12 13.2v3.6M9 20h6"/>',
  lab: '<path d="M9.2 3h5.6"/><path d="M10.2 3v6.6L5.6 18a2 2 0 0 0 1.8 3h9.2a2 2 0 0 0 1.8-3l-4.6-8.4V3"/><path d="M7.6 15h8.8"/>',
  gear: '<circle cx="12" cy="12" r="3.1"/><path d="M12 3.2v2.2M12 18.6v2.2M4.8 7.9l1.9 1.1M17.3 15l1.9 1.1M4.8 16.1l1.9-1.1M17.3 9l1.9-1.1"/>',
  target: '<circle cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="4.9"/><circle cx="12" cy="12" r="1.3"/>',
  chart: '<path d="M4 20V4M4 20h16"/><rect x="7" y="12" width="3.2" height="5" rx="1.1"/><rect x="12.4" y="8.4" width="3.2" height="8.6" rx="1.1"/><rect x="17.4" y="5.2" width="3.2" height="11.8" rx="1.1"/>',
  clock: '<circle cx="12" cy="12" r="8.8"/><path d="M12 7.6V12l3.2 2"/>',
  calc: '<rect x="4.6" y="3" width="14.8" height="18" rx="2.6"/><path d="M8 7.6h8"/><circle cx="8.8" cy="12.2" r=".95"/><circle cx="12" cy="12.2" r=".95"/><circle cx="15.2" cy="12.2" r=".95"/><circle cx="8.8" cy="16.4" r=".95"/><circle cx="12" cy="16.4" r=".95"/><circle cx="15.2" cy="16.4" r=".95"/>',
  link: '<path d="M10 13.6a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.5 6.4"/><path d="M14 10.4a4 4 0 0 0-5.7 0L5.5 13.2a4 4 0 0 0 5.7 5.7l1.3-1.3"/>',
  globe: '<circle cx="12" cy="12" r="8.8"/><path d="M3.2 12h17.6"/><path d="M12 3.2c2.4 2.4 3.6 5.4 3.6 8.8s-1.2 6.4-3.6 8.8c-2.4-2.4-3.6-5.4-3.6-8.8S9.6 5.6 12 3.2z"/>',
  search: '<circle cx="11" cy="11" r="6.6"/><path d="M16 16l4.2 4.2"/>',
  close: '<path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8"/>',
  plus: '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
  minus: '<path d="M5.2 12h13.6"/>',
  check: '<path d="M5 12.8 9.8 17.5 19 6.5"/>',
  star: '<path d="M12 3.6l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 10l6-.8z"/>',
  heart: '<path d="M12 20.2s-7.6-4.6-7.6-9.7A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.6 3.2c0 5.1-7.6 9.7-7.6 9.7z"/>',
  flame: '<path d="M12 3.2c3.6 3.7 6 6.5 6 9.7a6 6 0 0 1-12 0c0-3.2 2.4-6 6-9.7z"/><path d="M12 20a3.3 3.3 0 0 0 3.3-3.3c0-1.9-1.5-3.1-3.3-4.9-1.8 1.8-3.3 3-3.3 4.9A3.3 3.3 0 0 0 12 20z"/>',
  sparkle: '<path d="M11 3.4l1.8 4.9 4.9 1.8-4.9 1.8L11 16.8 9.2 11.9 4.3 10.1l4.9-1.8z"/><path d="M18 15.4l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z"/>',
  download: '<path d="M12 4v10.4"/><path d="M7.8 10.6 12 14.8l4.2-4.2"/><path d="M4.6 19.4h14.8"/>',
  upload: '<path d="M12 20.4V10"/><path d="M7.8 13.8 12 9.6l4.2 4.2"/><path d="M4.6 4.6h14.8"/>',
  moon: '<path d="M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.4M12 18.8v2.4M4.5 12h2.4M17.1 12h2.4M6.4 6.4l1.7 1.7M15.9 15.9l1.7 1.7M6.4 17.6l1.7-1.7M15.9 8.1l1.7-1.7"/>',
  share: '<path d="M12 15.2V3.8"/><path d="M8.2 7.4 12 3.6l3.8 3.8"/><path d="M6.4 12.6H5.2a2 2 0 0 0-2 2v4.6a2 2 0 0 0 2 2h13.6a2 2 0 0 0 2-2v-4.6a2 2 0 0 0-2-2h-1.2"/>',
  copy: '<rect x="9" y="9" width="11.4" height="11.4" rx="2.4"/><path d="M15.4 6.2V5.4a2 2 0 0 0-2-2H5.4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h.8"/>',
  message: '<path d="M20.4 15.4a2.6 2.6 0 0 1-2.6 2.6H8.2L4 21V6.6A2.6 2.6 0 0 1 6.6 4h11.2a2.6 2.6 0 0 1 2.6 2.6z"/>',
  mail: '<rect x="3" y="5.2" width="18" height="13.6" rx="2.4"/><path d="M3.6 7.2 12 12.8l8.4-5.6"/>',
  phone: '<path d="M6.4 3.2h3l1.4 4-2 1.4a10.6 10.6 0 0 0 6.4 6.4l1.4-2 4 1.4v3a2.4 2.4 0 0 1-2.6 2.4C10.4 20 4 13.6 4 5.8a2.4 2.4 0 0 1 2.4-2.6z"/>',
  camera: '<rect x="3" y="6.6" width="18" height="13.4" rx="3"/><circle cx="12" cy="13.3" r="3.6"/><path d="M8.6 6.6 10 4h4l1.4 2.6"/>',
  qr: '<rect x="3" y="3" width="7.2" height="7.2" rx="1.6"/><rect x="13.8" y="3" width="7.2" height="7.2" rx="1.6"/><rect x="3" y="13.8" width="7.2" height="7.2" rx="1.6"/><path d="M13.8 13.8h3.4v3.4h-3.4z"/><path d="M20.4 13.8v3.4M17.2 20.4h3.2"/>',
  filter: '<path d="M3.6 5.2h16.8l-6.6 7.8V20l-3.6-2.2v-4.8z"/>',
  arrowUp: '<path d="M12 19.4V4.6"/><path d="M6.2 10.4 12 4.6l5.8 5.8"/>',
  chevronLeft: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  chevronRight: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  chevronDown: '<path d="M5.5 9.5 12 16l6.5-6.5"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-8.4 8.4"/><path d="M18.4 14.2v4.4a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.4"/>',
  eye: '<path d="M2.6 12S6.2 5.6 12 5.6 21.4 12 21.4 12 17.8 18.4 12 18.4 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="3"/>',
  users: '<circle cx="9.2" cy="8.2" r="3.4"/><path d="M3.4 20c0-3.3 2.6-5.6 5.8-5.6s5.8 2.3 5.8 5.6"/><path d="M16.2 5.4a3.4 3.4 0 0 1 0 6.6M17.8 14.8c1.8.7 2.8 2.4 2.8 4.6"/>',
  calendar: '<rect x="3.4" y="5" width="17.2" height="16" rx="2.6"/><path d="M8 2.8v4M16 2.8v4M3.4 10h17.2"/>',
  save: '<path d="M4.6 3.6h10.8L19.4 8v12.4H4.6z"/><path d="M8.2 3.6v5.6h7.2V3.6"/><rect x="8.2" y="13.4" width="7.2" height="7"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20.2 3.8v4.6h-4.6"/>',
  pin: '<path d="M12 21s6.2-5.4 6.2-10.2a6.2 6.2 0 1 0-12.4 0C5.8 15.6 12 21 12 21z"/><circle cx="12" cy="10.6" r="2.3"/>',
  bug: '<rect x="7.2" y="8" width="9.6" height="11" rx="4.8"/><path d="M12 4v4M7.2 12H4M20 12h-3.2M7.6 17 5.2 19.4M16.4 17l2.4 2.4M7.6 9.2 5.2 6.8M16.4 9.2l2.4-2.4"/>',
  thumbUp: '<path d="M7.2 20.4V10l4-6.4a2 2 0 0 1 2.6 1l.6 4.4h4.2a2 2 0 0 1 2 2.4l-1.4 7a2 2 0 0 1-2 1.6H7.2z"/><path d="M7.2 10H4.4v10.4h2.8"/>',
  thumbDown: '<path d="M16.8 3.6V14l-4 6.4a2 2 0 0 1-2.6-1l-.6-4.4H5.4a2 2 0 0 1-2-2.4l1.4-7a2 2 0 0 1 2-1.6h10z"/><path d="M16.8 14h2.8V3.6h-2.8"/>',
  lock: '<rect x="4.6" y="10" width="14.8" height="10.6" rx="2.6"/><path d="M8.2 10V7.6a3.8 3.8 0 0 1 7.6 0V10"/>',
  warning: '<path d="M12 3.8 2.8 20h18.4z"/><path d="M12 9.6v5"/><circle cx="12" cy="17.6" r=".95"/>',
  info: '<circle cx="12" cy="12" r="8.8"/><path d="M12 11v5.4"/><circle cx="12" cy="7.9" r=".95"/>',
  tag: '<path d="M11.2 3.2H6a2 2 0 0 0-2 2v5.2l9.6 9.6a2 2 0 0 0 2.8 0l4.4-4.4a2 2 0 0 0 0-2.8z"/><circle cx="8.4" cy="8.4" r="1.3"/>',
  folder: '<path d="M3.4 7.4a2 2 0 0 1 2-2h4.2l2.2 2.6h6.8a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2z"/>',
  cloud: '<path d="M7.6 18.6h9.6a3.8 3.8 0 0 0 .4-7.6 5.6 5.6 0 0 0-10.7-1.4 4.6 4.6 0 0 0 .7 9z"/>',
  image: '<rect x="3" y="4.6" width="18" height="14.8" rx="2.6"/><circle cx="8.4" cy="10" r="1.6"/><path d="M3.8 17.6 9.4 12l3.8 3.8 2.6-2.4 4.4 4.2"/>',
  trash: '<path d="M4.4 7h15.2"/><path d="M9.2 7V4.6h5.6V7"/><path d="M6.4 7l1 13.2h9.2l1-13.2"/>',
  pencil: '<path d="M4 20l4.2-1 10.6-10.6a2.3 2.3 0 0 0-3.2-3.2L5 15.8z"/><path d="M14.6 6.6 17.4 9.4"/>',
  play: '<path d="M8.6 5.4 19 12 8.6 18.6z"/>',
  home: '<path d="M3.6 10.4 12 3.6l8.4 6.8V20a1.6 1.6 0 0 1-1.6 1.6H5.2A1.6 1.6 0 0 1 3.6 20z"/><path d="M9.4 21.6v-7h5.2v7"/>',
  gift: '<rect x="3.4" y="9.2" width="17.2" height="4" rx="1.2"/><path d="M5 13.2v7.4a1.4 1.4 0 0 0 1.4 1.4h11.2a1.4 1.4 0 0 0 1.4-1.4v-7.4"/><path d="M12 9.2v12.8"/><path d="M12 9.2C10.4 6 8.6 4.4 7 5.2c-1.6.8-1 3 1.6 4zM12 9.2c1.6-3.2 3.4-4.8 5-4s1 3-1.6 4z"/>'
};

// 舊資料／後台舊選擇嘅 emoji → 線稿圖標（對應唔到一律用 ICON_FALLBACK）
const EMOJI_TO_ICON = {
  "🧭": "compass", "🎮": "game", "🕹️": "game", "🎲": "game",
  "🧰": "tools", "🛠️": "tools", "🔧": "tools", "⚒️": "tools",
  "🃏": "cards", "🎴": "cards", "📽️": "slides", "🎬": "slides", "🖥️": "slides",
  "🔗": "link", "🌐": "globe", "🌍": "globe", "🔌": "link",
  "📚": "book", "📖": "book", "📕": "book", "📘": "book", "📙": "book",
  "📝": "note", "📄": "note", "🗒️": "note", "📋": "list",
  "🎨": "art", "🖌️": "art", "🔔": "bell", "📣": "bell", "📢": "bell",
  "🗺️": "map", "🧭": "compass", "⛺": "camp", "🏕️": "camp", "⛰️": "camp",
  "🏆": "trophy", "🥇": "trophy", "🏅": "trophy", "🎖️": "trophy",
  "🧪": "lab", "⚗️": "lab", "⚙️": "gear", "🔧": "tools", "🛠": "tools",
  "🎯": "target", "📊": "chart", "📈": "chart", "📉": "chart",
  "⏱️": "clock", "⏰": "clock", "🕘": "clock", "🕒": "clock",
  "🧮": "calc", "🧾": "calc", "🔢": "calc",
  "📸": "camera", "📷": "camera", "🖼️": "image", "🏞️": "image", "🌄": "image",
  "📁": "folder", "🗂️": "folder", "📂": "folder",
  "☁️": "cloud", "💾": "save", "🔄": "refresh", "♻️": "refresh", "↻": "refresh",
  "🔍": "search", "🔎": "search", "✦": "sparkle", "✨": "sparkle", "🆕": "sparkle", "🌟": "sparkle",
  "⭐": "star", "★": "star", "☆": "star",
  "❤️": "heart", "♥": "heart", "♡": "heart", "💛": "heart",
  "🔥": "flame", "⚡": "flame", "💡": "info", "✅": "check", "✔️": "check", "☑️": "check",
  "⚠️": "warning", "❗": "warning", "🚫": "warning", "⛔": "warning", "❌": "close", "✕": "close", "✖️": "close",
  "📧": "mail", "✉️": "mail", "📮": "mail", "💬": "message", "📞": "phone", "☎️": "phone",
  "👥": "users", "👤": "users", "📅": "calendar", "🗓️": "calendar", "📌": "pin",
  "🔒": "lock", "🔐": "lock", "🔑": "lock", "👀": "eye", "🐛": "bug", "👍": "thumbUp", "👎": "thumbDown",
  "▶️": "play", "►": "play", "📤": "upload", "📥": "download", "⬇️": "download", "⬆️": "upload",
  "🏠": "home", "🎁": "gift", "🏷️": "tag", "🔳": "qr", "🔲": "qr", "☰": "list", "🗑️": "trash", "✏️": "pencil",
  "➡️": "chevronRight", "⬅️": "chevronLeft", "⬆": "arrowUp", "↑": "arrowUp", "→": "chevronRight", "‹": "chevronLeft", "›": "chevronRight"
};
const ICON_FALLBACK = "grid";

// 一隻 icon 值（"i:key" / emoji / key / 空）→ 圖標名
function iconName(v) {
  const s = String(v == null ? "" : v).trim();
  if (!s) return ICON_FALLBACK;
  if (s.startsWith("i:")) {
    const k = s.slice(2);
    return ICON_PATHS[k] ? k : ICON_FALLBACK;
  }
  if (ICON_PATHS[s]) return s;          // 直接寫 key（內部用）
  if (EMOJI_TO_ICON[s]) return EMOJI_TO_ICON[s];
  // emoji 後面可能帶 VARIATION SELECTOR（"🏕" vs "🏕️"）→ 試埋去掉 FE0F
  const bare = s.replace(/\uFE0F/g, "");
  if (EMOJI_TO_ICON[bare]) return EMOJI_TO_ICON[bare];
  return ICON_FALLBACK;
}

// 出 <svg>（class 只做尺寸／填色；粗細同圓角寫死喺度，唔靠外部 CSS）
function svgIcon(v, cls) {
  const name = iconName(v);
  return `<svg class="ic${cls ? " " + cls : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">` +
    `${ICON_PATHS[name] || ICON_PATHS[ICON_FALLBACK]}</svg>`;
}
/* 靜態 HTML 嘅 icon 位：<span data-icon="search"></span>
   由 boot／render 之後統一填 <svg>（唔喺 HTML 抄多次 path，保持單一來源）。*/
function hydrateIcons(root) {
  const scope = root || (typeof document !== "undefined" ? document : null);
  if (!scope || !scope.querySelectorAll) return;
  scope.querySelectorAll("[data-icon]:not([data-icon-ready])").forEach((el) => {
    el.innerHTML = svgIcon(el.dataset.icon);
    el.setAttribute("data-icon-ready", "1");
  });
}

// 後台 icon 選擇器用：圖標名清單（連中文名）
const ICON_LABELS = {
  grid: "通用", star: "收藏", heart: "讚好", flame: "熱門", sparkle: "最新", trophy: "排行榜",
  compass: "指南針", map: "地圖", camp: "露營", target: "目標", game: "遊戲", cards: "圖卡",
  slides: "簡報", book: "書本", note: "筆記", list: "清單", art: "美術", bell: "通告",
  tools: "工具", lab: "實驗", gear: "設定", chart: "圖表", calc: "計算", clock: "時間",
  link: "連結", globe: "網站", mail: "電郵", message: "訊息", phone: "電話", users: "成員",
  calendar: "日程", tag: "標籤", pin: "標記", folder: "資料夾", image: "圖片", camera: "相片",
  cloud: "雲端", save: "儲存", download: "下載", upload: "上載", refresh: "更新", search: "搜尋",
  share: "分享", copy: "複製", play: "播放", lock: "後台", eye: "預覽", bug: "問題", warning: "注意",
  info: "說明", check: "完成", close: "關閉", plus: "新增", pencil: "編輯", trash: "刪除", gift: "禮物", home: "主頁", qr: "QR Code", external: "外部連結"
};
// 揀得到嘅圖標（順序 = 後台顯示順序）
const ICON_CHOICES = [
  "grid", "compass", "map", "camp", "target", "trophy", "star", "heart", "flame", "sparkle",
  "game", "cards", "slides", "book", "note", "list", "art", "bell", "chart", "calc",
  "clock", "tools", "lab", "gear", "link", "globe", "mail", "phone", "users", "calendar",
  "tag", "folder", "image", "camera", "cloud", "play", "gift", "lock", "qr", "external"
];

// 攞外部 App 嘅圖示（64px）候選 chain，逐個試，失敗行落下一個：
//   1) 我哋自己 /api/favicon —— 用 Chrome 分頁標籤嗰個原理：伺服器端攞該站 HTML
//      讀 <link rel="icon">（瀏覽器受 CORS 限制讀唔到別站 HTML，所以要放伺服器做），
//      冇 link 就試 manifest icon 同 /favicon.ico；
//   2) GitHub repo 主人頭像 —— 該站完全冇 favicon 時嘅後備（有辨識度）；
//   3) Google s2 —— 備援（自己 API 未部署／被封／本地純靜態跑嗰陣）；
//   4) 全站 Logo。
// ⚠️ 次序（2026-11-06 改）：**app 自己嘅 favicon 一定排第一**。
//    舊版 GitHub 頭像排第一，結果任何填咗 github 欄嘅 app 都永遠顯示
//    帳號頭像，app 換咗 logo 都見唔到新圖（=「圖標冇換」其中一個主因）。
//    每一條 URL 都加 `?v=` cache-busting，繞過 CDN／Google／瀏覽器舊快取。
function faviconCandidates(app) {
  const v = iconVer();
  const out = [];
  // 只由「app 自己嘅網址」取 host。冇 url 只有 github 欄時，
  // 唔可以攞 github.com 做 host（咁只會攞到 GitHub 自己個 favicon，
  // 唔係 repo 主人嘅頭像）；呢種情況直接行 GitHub 頭像。
  let host = null;
  if (app.url) { try { host = new URL(app.url).hostname; } catch { host = null; } }
  if (host) out.push("/api/favicon?host=" + encodeURIComponent(host) + "&v=" + v);
  const repo = String(app.github || app.url || "").match(/github\.com\/([^/?#]+)/i);
  /* GitHub 頭像：size=460 係 GitHub 支援嘅最大值，
     唔好用 64 —— 68px tile 喺 2× 螢幕要 136px，64 一定化開。 */
  if (repo) out.push("https://github.com/" + repo[1] + ".png?size=460");
  /* Google s2：官方支援 sz 1–256。之前寫死 64，等於外部站有 512 都只攞到 64px。
     改用 256（s2 上限），細圖放大嘅情況大幅減少。
     ⚠️ 外部連結我哋控制唔到 figcaption，只能盡量攞最大；
        真係連 256 都冇（老站得 16px）就先放大再出（見 favImgOnLargest）。 */
  if (host) out.push("https://www.google.com/s2/favicons?domain=" + host + "&sz=256&v=" + v);
  /* 最後用哨兵 ""（唔係全站 Logo）：
     外部連結全部攞唔到靚圖時，顯示「字母牌」比顯示本站 Logo 好 ——
     後者會令人以為個連結係本站自己嘅嘢。自家 app 有 512，永遠行唔到呢步。 */
  out.push("");
  return out;
}

/* 強制全站重新抓外部圖標：把 ICON_VER 換成時間戳，所有 icon URL 即時變新 URL。
   公開版會重新 render；後台撳「🔄 重新抓取圖標」就係行呢個。 */
function refreshAppIcons() {
  ICON_VER = String(Date.now());
  try { if (typeof render === "function") render(); } catch { /* 唔喺公開版頁面就跳過 */ }
  try { if (typeof renderAdmin === "function" && typeof ADMIN !== "undefined" && ADMIN.sites) renderAdmin(); } catch { /* 同上 */ }
  return ICON_VER;
}

// <img> onerror：沿 data-favchain 行去下一個候選
function favChainOf(img) {
  try { return JSON.parse(img.dataset.favchain || "[]"); } catch { return []; }
}

// 試下一個候選；碰到哨兵 "" 或者已經到尾 → 回傳 false（交畀字母牌）
function favTryNext(img) {
  const chain = favChainOf(img);
  let i = Number(img.dataset.fi || 0);
  while (i + 1 < chain.length) {
    i += 1;
    if (chain[i]) { // 非哨兵
      img.dataset.fi = String(i);
      img.src = chain[i];
      return true;
    }
  }
  return false;
}

function favImgOnErr(img) {
  if (!favTryNext(img)) {
    img.onerror = null;
    iconLetterFallback(img);   // 全部候選都失敗 → 字母牌
  }
}

/* ────────────────────────────────────────────────────────────
   細圖降級（2026-11）

   背景：外部連結（唔係自家 app）我哋控制唔到佢交咩圖。
         有啲老站／第三方網站真係只得 16×16 favicon。
         硬將 16px 放大到 68px，出到嚟就係一嚿糊 —— 比冇圖更難睇。

   做法：圖片載入完成後量佢嘅天然尺寸（naturalWidth）。
         · ≥ 64px  → 正常顯示（可能輕微放大，可接受）
         · < 64px  → 唔顯示糊圖，改用「字母牌」：
                     分類色底 + 該項目名稱第一個字
                     一眼認得，又唔會似壞圖

   自家 app 有 512（真理倉 docs/33 已統一要求），永遠唔會跌落呢條路。
   ──────────────────────────────────────────────────────────── */
const MIN_ICON_PX = 64;

function iconLetterFallback(img) {
  // 已經降級過就唔再處理（防止 render 重入）
  if (img.dataset.lettered === "1") return;
  img.dataset.lettered = "1";

  const holder = img.parentElement;
  if (!holder) return;

  // 由最近嘅 .tile / .card / row 容器搵項目名稱
  const scope = holder.closest("[data-app-name], .tile, .card, .admin-app-row");
  const name = (img.dataset.appName
    || (scope && scope.dataset && scope.dataset.appName)
    || (scope && (scope.querySelector(".tile-name, .card-copy .tile-name, b") || {}).textContent)
    || "").trim();

  // 取第一個「有意思」嘅字：跳過空白、括號、標點、emoji
  const first = Array.from(name).find((ch) => /[\p{L}\p{N}]/u.test(ch)) || "?";

  const span = document.createElement("span");
  span.className = "icon-letter";
  span.textContent = first.toUpperCase();
  span.setAttribute("aria-hidden", "true");
  img.replaceWith(span);
}

// 圖片載入後檢查尺寸（onload 掛喺 render 出嚟嘅 <img> 上）
function favImgOnLoad(img) {
  // naturalWidth 係 0 表示未真正解碼（或者係 SVG 冇固有尺寸）→ 唔判斷
  const px = img.naturalWidth || 0;
  if (!px || px >= MIN_ICON_PX) {
    img.dataset.sized = "ok";
    return;
  }
  /* 太細。唔好即刻換字母牌 —— 下一個候選（GitHub 460、s2 256）
     可能係大圖。先試落去，全部細圖 / 失敗先至用字母牌。

     ⚠️ 防迴圈：如果所有候選都細，favTryNext 會逐個試到哨兵為止，
        試完之後 favchain 已經冇新候選，所以最多行 N 次（N = chain 長度）。
        再加一個硬上限，防止 image cache 同步觸發 onload 造成遞歸過深。 */
  img.dataset.loadTries = String(Number(img.dataset.loadTries || 0) + 1);
  if (Number(img.dataset.loadTries) > 6) {
    img.onload = null;
    iconLetterFallback(img);
    return;
  }
  if (!favTryNext(img)) {
    img.onload = null;
    iconLetterFallback(img);
  }
}

// 渲染 item 嘅圖示 HTML（公開 tile / 後台列表 / 總覽預覽 共用）
// app.iconSource: "favicon" (預設) | "emoji" | "upload" | "none"
//   舊資料冇 iconSource 時：icon 為 https URL 或 data:image/（後台本機上傳）視為 "upload"；其他非空字串視為 "emoji"；空字串視為 "favicon"
function resolveIconSource(app) {
  if (app.iconSource === "favicon" || app.iconSource === "emoji" ||
      app.iconSource === "upload" || app.iconSource === "none") return app.iconSource;
  if (app.icon && (/^https?:\/\//i.test(app.icon) || app.icon.startsWith("data:image/"))) return "upload";
  if (app.icon && app.icon.length) return "emoji";
  return "favicon";
}
function appIconHTML(app, size) {
  const src = resolveIconSource(app);
  const cls = size === "row" ? ' class="row-ico"' : "";
  const lazy = size === "row" ? "" : ' loading="lazy" decoding="async"';
  const fallback = `this.onerror=null;this.src='${SITE_LOGO}'`;
  // emoji 圖示都升級做線稿（"🧭" → compass，"i:compass" → compass）；
  // 對應唔到就用通用方格 —— 公開版唔會再見到大粒 emoji 當 app 圖標
  if (src === "emoji") return svgIcon(app.icon);
  const nameAttr = ` data-app-name="${esc(app.name || "")}"`;
  if (src === "upload") return `<img${cls} src="${esc(app.icon)}" alt=""${lazy}${nameAttr} onload="favImgOnLoad(this)" onerror="${fallback}" />`;
  if (src === "favicon") {
    // chain：(GitHub 頭像) → 自己 /api/favicon → Google s2 → 全站 Logo
    const chain = faviconCandidates(app);
    return `<img${cls} src="${esc(chain[0])}" alt=""${lazy}${nameAttr} data-favchain="${esc(JSON.stringify(chain))}" onload="favImgOnLoad(this)" onerror="favImgOnErr(this)" />`;
  }
  // "none" → 直接用全站 Logo
  return `<img${cls} src="${SITE_LOGO}" alt=""${lazy} />`;
}

// 童軍支部標籤（公開版叫「適用支部」；固定，唔可以喺後台加減）
// ⚠️ 全名先係「真相」：DB / 搜尋 / 篩選一律用全名，一個字只係「顯示層」。
//    點解？標籤答嘅係「呢個內容係為邊個支部而設」，唔係「邊個先用得著」——
//    所有工具本身就係畀領袖用，所以唔設「領袖」標籤（剔咗反而搞亂篩選）。
//    篩選係多選（OR）：揀「小＋幼」= 兩個支部嘅項目一齊顯示。
const SCOUT_TAGS = ["小童軍", "幼童軍", "童軍", "深資童軍", "樂行童軍"];
// 一個字（領隊一眼就識，唔使睇成串「深資童軍」）
const SCOUT_TAG_SHORT = { "小童軍": "小", "幼童軍": "幼", "童軍": "童", "深資童軍": "深", "樂行童軍": "樂" };
function scoutTagShort(t) {
  const s = String(t || "").trim();
  if (!s) return "";
  if (SCOUT_TAG_SHORT[s]) return SCOUT_TAG_SHORT[s];
  // 未知／日後新支部名：兩字以下照樣顯示，其餘取第一字（tooltip 仍有全名）
  return s.length > 2 ? s[0] : s;
}

// 分類／分頁名縮短（手機版 chips 用；桌面版照樣顯示全名）
// 規則：刪走空格／括號內容 → 長過 4 字就先削冇資訊量嘅修飾詞 → 仲長就截 6 字加 …
// 想完全控制縮寫？後台將分類改名做你想見嘅短名即可（≤4 字就原樣顯示）。
const CAT_NOISE = ["電子", "網上", "网上", "系統", "平台", "管理", "專用", "一般", "常用", "精選", "其他", "有用", "好用", "APPS", "Apps", "apps", "APP", "App", "app"];
function catShort(name) {
  let s = String(name || "").replace(/\s+/g, "").replace(/[（(【\[].*?[)）】\]]/g, "");
  const raw = s;
  if (s.length > 4) {
    for (const w of CAT_NOISE) {
      if (s.length > 4 && s.includes(w)) s = s.split(w).join("");
    }
  }
  if (!s) s = raw;
  if (s.length > 6) s = s.slice(0, 6) + "…";
  return s;
}

// Emoji 揀選器（WhatsApp 式：分「種類」tag，admin 揀 icon / 分類時用）
const EMOJI_GROUPS = [
  { key: "scout",   label: "🧭 童軍",  emojis: ["🏕️","⛺","🔥","🗺️","🧭","⚜️","🎖️","🏅","🏆","⭐","🌟","✨","💮","🧗","🚣","⛵","🏊","🚴","🚵","🔦","🪢","🎗️","🎀","🥾","🧦","🎒","🪖","🛟","🪁","🎯","🥌","🚀","⚓","⛳","🎪"] },
  { key: "sport",   label: "⚽ 運動",   emojis: ["⚽","🏀","🏈","⚾","🎾","🏐","🎱","🏓","🏸","🏒","🏑","🏏","⛸️","🥍","🎣","🤸","🤼","🏋️","🏇","⛷️","🏂","🏄","🤽","🏃","🚶","🎽","🥋","🥊","🤺","⛹️","🧘","🎿","🥏","⛳","🥅"] },
  { key: "outdoor", label: "🏞️ 風景",  emojis: ["🏔️","⛰️","🌋","🗻","🏕️","🌄","🌅","🌇","🌆","🌃","🌌","🌉","🌁","🌊","⛱️","🏖️","🏜️","🏝️","🌲","🌳","🌴","🌵","🌾","☘️","🌱","🌿","🍀","🌸","🌺","🌻","🌼","🍁","🍂","🌈","☀️","⛅","🌤️","⛈️","❄️","🌨️","🌬️","💨","🌫️","🌙"] },
  { key: "animal",  label: "🐾 動物",   emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🦄","🐴","🐝","🐞","🦋","🐌","🐢","🐍","🦎","🦖","🐙","🦑","🦀","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐦","🐧","🦆","🦉","🦅","🦇","🐺","🦌"] },
  { key: "food",    label: "🍎 食物",   emojis: ["🍎","🍌","🍇","🍉","🍊","🍋","🍑","🍒","🍓","🍍","🥭","🥝","🥑","🍆","🥦","🥕","🌽","🍞","🥖","🥐","🥯","🧀","🥚","🍳","🥞","🥓","🍗","🍔","🍟","🍕","🌭","🥪","🌮","🍜","🍲","🍣","🍙","🍚","🍤","🦐","🍦","🍧","🍨","🍰","🎂","🍪","🍩","🍫","🍿","🍬","🍭","☕","🍵","🥤"] },
  { key: "study",   label: "📚 學習",   emojis: ["📚","📖","📕","📘","📗","📙","📔","📒","📓","📑","📃","📜","📄","📋","📝","✏️","✒️","🖊️","🖋️","🖌️","🖍️","📏","📐","📌","📍","📎","🖇️","✂️","🗂️","🗃️","🗄️","📊","📈","📉","📰","📣","📢","🔔","💡","🧠","🎓","🏫","✍️","🧮"] },
  { key: "tech",    label: "📱 科技",   emojis: ["📱","💻","🖥️","⌨️","🖱️","🖨️","📷","📹","🎥","💽","💾","📀","📼","☎️","📞","📺","📻","📡","📶","🛰️","🔋","🔌","🧲","🧪","⚗️","🔬","🔭","🔧","🔨","🔩","⚙️","🛠️","🧰","🪛","⚒️","🗜️","⚖️","🔍"] },
  { key: "media",   label: "🎬 娛樂",   emojis: ["🎬","🎞️","📽️","🖼️","🎨","🎭","🎤","🎧","🎼","🎵","🎶","🎹","🥁","🎷","🎺","🎸","🪕","🎻","🎲","🧩","♟️","🕹️","🎮","🎪","🎟️","🎫","🎰","🃏","🎴","🎳","🧸","🎈","🎉","🎊","🥳","🎆","🎇"] },
  { key: "emoji",   label: "😀 表情",   emojis: ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","😉","😌","😍","🥰","😘","😋","😛","😝","🤪","🤩","🧐","🤓","😎","🤗","🤭","🤫","🤔","🤨","😏","😐","😶","😒","😞","😔","😟","🥺","😢","😭","😤","😠","🤬","🤯","😳","🥵","🥶","😱","😨","😥","🤞","👍","👎","👌","🤝","✌️","🙌","👏","💪","🙏","🫶","✊","👊"] },
  { key: "object",  label: "📦 生活",   emojis: ["📦","🎁","💼","👜","👝","🧳","👓","🕶️","🥽","🥼","👔","👕","👗","👘","🩰","👠","👟","🧢","👑","💍","⏰","⌚","🔑","🗝️","🚪","🪟","🛏️","🛋️","🚿","🛁","🧼","🧽","🧴","🧹","🧺","🧶","🪡","🪴"] },
  { key: "symbol",  label: "🔣 符號",   emojis: ["✅","❌","❎","➕","➖","➗","✖️","🔁","🔄","▶️","⏸️","⏹️","⬅️","➡️","⬆️","⬇️","↗️","↘️","↙️","↖️","🔃","🔙","🔚","🔝","🔜","🆗","🆙","🆕","🆓","💯","✔️","☑️","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🔺","🔻","🔸","🔹","💠","🔲","🔳","⛔","🚫","💬","💭","♻️","🚩","🏁"] }
];
// 全部 emoji 合埋一份（搜尋用）
const EMOJI_ALL = EMOJI_GROUPS.flatMap((g) => g.emojis);
// 顯示層關鍵字（繁中名 + emoji），搜尋命中就切去嗰一組並高亮
const EMOJI_INDEX = [
  { e: "🏕️", g: "scout",  k: ["camp","露營","營"] }, { e: "⛺", g: "scout", k: ["帳篷","露營"] },
  { e: "🔥", g: "scout", k: ["火","營火"] }, { e: "🗺️", g: "scout", k: ["地圖","map"] }, { e: "🧭", g: "scout", k: ["指南針","羅盤"] },
  { e: "🎖️", g: "scout", k: ["勳章","獎章","徽章","badge"] }, { e: "🏅", g: "scout", k: ["獎牌","獎"] }, { e: "🏆", g: "scout", k: ["獎杯","比賽"] },
  { e: "⭐", g: "scout", k: ["星","星章"] }, { e: "🌟", g: "scout", k: ["閃","星"] }, { e: "✨", g: "scout", k: ["閃亮"] },
  { e: "🧗", g: "scout", k: ["攀爬","攀石"] }, { e: "🚣", g: "scout", k: ["划艇","船"] }, { e: "⛵", g: "scout", k: ["船","帆船"] },
  { e: "🏊", g: "scout", k: ["游水","游泳"] }, { e: "🚴", g: "scout", k: ["單車","踩單車"] },
  { e: "🔦", g: "scout", k: ["電筒"] }, { e: "🎒", g: "scout", k: ["背囊","袋"] },
  { e: "🎯", g: "scout", k: ["目標","靶"] }, { e: "🚀", g: "scout", k: ["火箭","升空"] },
  { e: "🔍", g: "tech", k: ["search","搜尋","放大鏡"] }, { e: "💾", g: "tech", k: ["儲存","硬碟","save"] },
  { e: "📋", g: "study", k: ["list","清單","列表"] }, { e: "📊", g: "study", k: ["chart","圖表","數據","統計"] },
  { e: "✅", g: "symbol", k: ["ok","完成","tick","剔"] }, { e: "❌", g: "symbol", k: ["no","錯誤","cross"] },
  { e: "♻️", g: "symbol", k: ["recycle","回收"] }, { e: "⛔", g: "symbol", k: ["禁止"] }, { e: "🚫", g: "symbol", k: ["no","禁止"] },
  { e: "💡", g: "study", k: ["idea","主意","燈"] }, { e: "🧠", g: "study", k: ["大腦","brain","腦"] }
];
function emojiSearch(q) {
  const s = (q || "").trim().toLowerCase();
  if (!s) return { hits: [], foundKey: null };
  const hits = [];
  for (const it of EMOJI_INDEX) {
    const h = it.k.filter((kk) => String(kk).toLowerCase().includes(s));
    if (h.length) hits.push({ e: it.e, g: it.g, kw: h[0] });
  }
  return { hits, foundKey: hits.length ? hits[0].g : null };
}
// 「最近用過」記憶
function emojiRecentGet() {
  try { const a = JSON.parse(localStorage.getItem(EMOJI_RECENT_KEY)); return Array.isArray(a) ? a : []; } catch { return []; }
}
function emojiRecentPush(e) {
  if (!e) return;
  let arr = emojiRecentGet().filter((x) => x !== e);
  arr.unshift(e);
  if (arr.length > 24) arr.length = 24;
  try { localStorage.setItem(EMOJI_RECENT_KEY, JSON.stringify(arr)); } catch {}
}

function getSB() {
  if (SUPABASE_CONFIG.url && typeof window.supabase !== "undefined") {
    if (!_sb) _sb = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, { auth: { storage: sessionStorage } });
  }
  return _sb;
}

// ── 匿名入站統計 ─────────────────────────────────────────────
// visitor_id 由瀏覽器隨機產生，只放 localStorage；伺服器唔收 IP、User-Agent 或個人資料。
// site_visits 以「visitor_id + 香港日期」去重，所以後台睇到係獨立訪客，而唔係精確真人數。
const SITE_VISITOR_KEY = "scout-site-visitor-id";
const SITE_VISIT_SESSION_KEY = "scout-site-visit-sent";
function createSiteVisitorId() {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(18);
      globalThis.crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {}
  return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 18);
}
function getSiteVisitorId() {
  try {
    const existing = localStorage.getItem(SITE_VISITOR_KEY) || "";
    if (/^[A-Za-z0-9_-]{16,128}$/.test(existing)) return existing;
    const id = createSiteVisitorId();
    localStorage.setItem(SITE_VISITOR_KEY, id);
    return id;
  } catch {
    // 私人瀏覽／封鎖 storage 時仍可嘗試送一次匿名 id；無法持久化就不會假裝跨頁辨認同一人。
    return createSiteVisitorId();
  }
}
function trackSiteVisit() {
  const sb = getSB();
  if (!sb) return;
  let visitorId;
  try {
    visitorId = getSiteVisitorId();
    if (sessionStorage.getItem(SITE_VISIT_SESSION_KEY) === visitorId) return;
    sessionStorage.setItem(SITE_VISIT_SESSION_KEY, visitorId);
  } catch {
    visitorId = getSiteVisitorId();
  }
  fetch(SUPABASE_CONFIG.url + "/rest/v1/rpc/record_site_visit", {
    method: "POST",
    keepalive: true,
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      Authorization: "Bearer " + SUPABASE_CONFIG.anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_visitor_id: visitorId })
  }).catch(() => {});
}

/* ════════════════════════════════════════════════════════════════
   Scout Admin 投稿通知 — 欄位對齊＋清洗（全部純函數，單測覆蓋）
   Apps Script「作品投稿」工作表靠 FIELD_MAP 對名：
     作品名稱←name｜作品連結←url｜作者名稱←author｜作品類型←page
     分類←category｜作品簡介←description｜標籤←tags
   我哋多送嘅欄位（商店編號／聯絡電郵／聯絡電話／審核頁／轉寄給）
   佢會**自動加欄**寫入 Sheet，同時照樣列進電郵內文 → 管理員一次過睇齊，
   登記完撳「📧 轉寄」就交得出畀負責人。
   ⚠️ 所有值一律壓做單行 + 截長：否則有人喺「簡介」入面插行，
      就可以喺管理員嗰封電郵偽造多幾行「欄位」。
   ════════════════════════════════════════════════════════════════ */
const SCOUT_ADMIN_FIELD_CAPS = {
  name: 80, url: 2048, author: 80, page: 40, category: 60,
  description: 1000, tag: 20, contact: 160, phone: 40
};

// 任意欄位 → 單行安全字串（控制字符／換行變空格，再截上限）
function scoutAdminText(value, max) {
  const oneLine = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f\u2000-\u200f\u2028\u2029\ufeff]/g, " ")
    .replace(/\s+/g, " ").trim();
  const limit = Number(max) || 500;
  return oneLine.length > limit ? oneLine.slice(0, Math.max(0, limit - 1)) + "…" : oneLine;
}
// 電郵：格式唔啱就当冇（唔好將垃圾送進管理員信箱）
function scoutAdminEmail(value) {
  const v = scoutAdminText(value, SCOUT_ADMIN_FIELD_CAPS.contact);
  return /^[^\s@,;:]+@[^\s@,;.]+\.[^\s@,;.]{2,}$/.test(v) ? v : "";
}
// 電話：只留可讀字元（隔住 tel:／mailto: 注入）
function scoutAdminPhone(value) {
  return scoutAdminText(value, SCOUT_ADMIN_FIELD_CAPS.phone).replace(/[^\d+()\-\s.,]/g, "").trim();
}
// 管理員返嚟審核嘅連結
function scoutAdminReviewUrl() {
  const cfg = (typeof SCOUT_ADMIN_CONFIG === "object" && SCOUT_ADMIN_CONFIG) || {};
  if (cfg.reviewUrl) return scoutAdminText(cfg.reviewUrl, 300);
  const origin = typeof location !== "undefined" && location.origin ? String(location.origin) : "";
  return origin ? origin + "/#admin" : "";
}
// 組裝「多送一份」嘅 payload（鍵名就是 Apps Script FIELD_MAP 認嘅名）
function scoutAdminSubmissionPayload(record) {
  const r = record || {};
  const cap = SCOUT_ADMIN_FIELD_CAPS;
  const tagList = Array.isArray(r.tags)
    ? r.tags
    : String(r.tags ?? "").split(/[,，、\n]/);
  const out = {
    type: "appstore",                       // Apps Script doPost 分流用（唔係 Sheet 欄位）
    sourceApp: "SCOUT APP STORE",            // 邊個送嚟（Scout Admin 其他表都用呢個鍵）
    name: scoutAdminText(r.name, cap.name),
    url: scoutAdminText(r.url, cap.url),
    author: scoutAdminText(r.author, cap.author),
    page: scoutAdminText(r.page, cap.page),
    category: scoutAdminText(r.category, cap.category),
    description: scoutAdminText(r.description, cap.description),
    // Sheet 嗰欄係文字，用「、」分隔最啱睇（DB 嗰份照舊係 text[]）
    tags: [...new Set(tagList.map(t => scoutAdminText(t, cap.tag)).filter(Boolean))].slice(0, 8).join("、"),
    商店編號: scoutAdminText(r.id, 64),
    聯絡電郵: scoutAdminEmail(r.contact),
    聯絡電話: scoutAdminPhone(r.phone),
    審核頁: scoutAdminReviewUrl(),
    轉寄給: scoutAdminEmail(SCOUT_ADMIN_CONFIG.forwardEmail)
  };
  // 空欄位唔好送（免得 Sheet 多列「：」、電郵內文多行廢話）
  for (const k of Object.keys(out)) if (out[k] === "") delete out[k];
  return out;
}

// 電郵內文用嘅「逐欄列出」（管理員掃一眼就夠，唔使開返後台）
function scoutAdminRecordLines(s) {
  const r = s || {};
  const out = [
    "作品名稱：" + scoutAdminText(r.name, SCOUT_ADMIN_FIELD_CAPS.name),
    "作品連結：" + scoutAdminText(r.url, SCOUT_ADMIN_FIELD_CAPS.url),
    "作者：" + scoutAdminText(r.author, SCOUT_ADMIN_FIELD_CAPS.author),
    "分頁／分類：" + [scoutAdminText(r.page, 40), scoutAdminText(r.category, 60)].filter(Boolean).join(" / "),
    "簡介：" + scoutAdminText(r.description, SCOUT_ADMIN_FIELD_CAPS.description),
    "標籤：" + (Array.isArray(r.tags) ? r.tags : String(r.tags ?? "").split(/[,，、]/)).map(t => scoutAdminText(t, 20)).filter(Boolean).join("、"),
    "聯絡電郵：" + scoutAdminEmail(r.contact),
    "聯絡電話：" + scoutAdminPhone(r.phone),
    "投稿編號：" + scoutAdminText(r.id, 64),
    "提交時間：" + (r.created_at ? new Date(r.created_at).toLocaleString("zh-HK") : ""),
    "狀態：" + scoutAdminText(r.status, 20)
  ];
  return out.filter(line => !line.endsWith("："));
}
// ↗️「轉寄俾負責人」：預填好嘅 mailto（冇郵件伺服器都做得到，管理員執一撳就寄出）
function scoutAdminForwardMailto(s) {
  const to = scoutAdminEmail((s && s.轉寄給) || SCOUT_ADMIN_CONFIG.forwardEmail);
  if (!to) return "";
  const subject = "[SCOUT APP STORE] 新投稿跟進：" + scoutAdminText(s && s.name, 80);
  const body = [
    "以下投稿已寫入 Supabase，請登記後轉交負責人處理／回覆作者。",
    "",
    ...scoutAdminRecordLines(s),
    "",
    "審核頁：" + (scoutAdminReviewUrl() || "（請開 #admin 嘅「作品審核」）"),
    "",
    "— 由 SCOUT APP STORE 自動產生"
  ].join("\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
// 📧「回覆作者」（只有用家留咗電郵先會見到呢粒掣）
function scoutAdminReplyMailto(s) {
  const to = scoutAdminEmail(s && s.contact);
  if (!to) return "";
  const subject = "[SCOUT APP STORE] 你嘅作品《" + scoutAdminText(s.name, 60) + "》審核跟進";
  const body = [
    scoutAdminText(s.author, 80) + " 你好，",
    "",
    "多謝你投稿 SCOUT APP STORE。關於你嘅作品：",
    ...scoutAdminRecordLines(s).slice(0, 6),
    "",
    "（請喺呢度回覆）"
  ].join("\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ── 預設模板（一鍵重設 & apps.json fallback 用）──────────────
function makeDefaultSite() {
  return {
    name: "SCOUT APP STORE",
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
    iconSource: r.icon_source || r.iconSource || null,
    github: r.github || null,
    note: r.note || null,
    visible: r.visible !== false,
    tags: tags.map((t) => t.trim()).filter(Boolean),
    clicks: r.clicks || 0,
    stars: r.stars || 0,
    hearts: r.hearts || 0,
    // 保留上架時間，供排行榜的「最新上架」排序使用。
    created_at: r.created_at || null,
    featured: r.featured === true,
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
    stars: a.stars || 0,
    hearts: a.hearts || 0,
    created_at: a.created_at || null,
    featured: a.featured === true,
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
    icon_source: app.iconSource || null,
    github: app.github || null,
    note: app.note || null,
    category: app.category,
    page: app.page || "apps",
    tags: Array.isArray(app.tags) ? app.tags : [],
    visible: app.visible !== false,
    featured: app.featured === true
  };
}

/* 選擇性欄位：用戶未跑 README 嘅 migration 時，呢啲欄喺 DB 仲未存在。
   寫入失敗就逐個甩走再試，唔會整冧儲存（沿用原本 icon_source 嘅做法）。 */
const OPTIONAL_APP_COLS = ["icon_source", "featured", "stars", "hearts"];

async function writeAppRow(sb, payload, id) {
  const drop = [...OPTIONAL_APP_COLS];
  let p = { ...payload };
  let res = id ? await sb.from("apps").update(p).eq("id", id) : await sb.from("apps").insert(p);
  while (res.error && drop.length) {
    const bad = drop.find((k) => new RegExp(k.replace("_", "_?"), "i").test(res.error.message || ""));
    if (!bad) break;
    drop.splice(drop.indexOf(bad), 1);
    delete p[bad];
    res = id ? await sb.from("apps").update(p).eq("id", id) : await sb.from("apps").insert(p);
  }
  return res;
}

// ── Admin 寫入（新增/編輯 item）──────────────────────────────
async function adminSaveApp(app, id) {
  const payload = appPayload(app);
  const sb = getSB();
  if (sb) {
    await ensureCategory(app.page, app.category, "");
    const res = await writeAppRow(sb, payload, id);
    if (res.error) throw res.error;
    return;
  }
  const { sites } = await loadSites();
  // localStorage 模式用 camelCase
  const { icon_source, ...localPayload } = payload;
  localPayload.iconSource = icon_source;
  if (id) {
    for (const pg of sites.pages) for (const c of pg.categories) {
      const i = c.apps.findIndex((a) => a._id === id);
      if (i >= 0) c.apps[i] = { ...c.apps[i], ...localPayload };
    }
  } else {
    let pg = sites.pages.find((p) => p.id === app.page);
    if (!pg) { pg = { id: app.page, label: app.page, icon: "", enabled: true, categories: [] }; sites.pages.push(pg); }
    let cat = pg.categories.find((c) => c.name === app.category);
    if (!cat) { cat = { name: app.category, icon: "", apps: [] }; pg.categories.push(cat); }
    cat.apps.push({ ...localPayload, clicks: 0, _id: "demo-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) });
  }
  localStorage.setItem(LS_KEY, JSON.stringify(sites));
}

/* ── 今期推廣：全站只可以有一個 featured 項目 ──────────────────
   on = true  → 呢個項目做 hero，其他全部清走
   on = false → 取消推廣（hero 自動收埋） */
async function adminSetFeatured(id, on) {
  const sb = getSB();
  if (sb) {
    if (on) {
      const { error: ce } = await sb.from("apps").update({ featured: false }).eq("featured", true);
      // 未跑 migration（冇 featured 欄）→ 唔好擲錯，交返下面嗰句一齊報
      const { error: se } = await sb.from("apps").update({ featured: true }).eq("id", id);
      if (se) throw se;
      if (ce) throw ce;
    } else {
      const { error } = await sb.from("apps").update({ featured: false }).eq("id", id);
      if (error) throw error;
    }
    return;
  }
  const { sites } = await loadSites();
  for (const p of sites.pages) for (const c of p.categories) {
    for (const a of c.apps) a.featured = on ? a._id === id : (a._id === id ? false : a.featured);
  }
  localStorage.setItem(LS_KEY, JSON.stringify(sites));
}

// 由 sites 結構搵出目前嘅今期推廣項目（跨分頁／跨分類）
function getFeaturedApp(sites) {
  for (const p of (sites && sites.pages) || []) {
    for (const c of p.categories || []) {
      const a = (c.apps || []).find((x) => x.featured === true && x.visible !== false);
      if (a) return { app: a, page: p, cat: c };
    }
  }
  return null;
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

// 收藏數（全站累計）—— 同 trackClick 一樣 fire-and-forget，唔阻用戶
function trackStar(id, delta) {
  if (!id) return;
  const sb = getSB();
  if (sb) {
    fetch(SUPABASE_CONFIG.url + "/rest/v1/rpc/bump_stars", {
      method: "POST", keepalive: true,
      headers: { apikey: SUPABASE_CONFIG.anonKey, Authorization: "Bearer " + SUPABASE_CONFIG.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ p_id: id, p_delta: delta })
    }).catch(() => {});
    return;
  }
  try {
    const ls = JSON.parse(localStorage.getItem(LS_KEY));
    if (ls) {
      for (const p of ls.pages || []) for (const c of p.categories || []) {
        const a = c.apps.find((x) => x._id === id);
        if (a) a.stars = Math.max(0, (a.stars || 0) + delta);
      }
      localStorage.setItem(LS_KEY, JSON.stringify(ls));
    }
  } catch {}
}

// 讚好心數（全站累計）——「❤️ 最受歡迎」排行榜用，同 trackStar 一樣 fire-and-forget
function trackHeart(id, delta) {
  if (!id) return;
  const sb = getSB();
  if (sb) {
    fetch(SUPABASE_CONFIG.url + "/rest/v1/rpc/bump_hearts", {
      method: "POST", keepalive: true,
      headers: { apikey: SUPABASE_CONFIG.anonKey, Authorization: "Bearer " + SUPABASE_CONFIG.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ p_id: id, p_delta: delta })
    }).catch(() => {});
    return;
  }
  try {
    const ls = JSON.parse(localStorage.getItem(LS_KEY));
    if (ls) {
      for (const p of ls.pages || []) for (const c of p.categories || []) {
        const a = c.apps.find((x) => x._id === id);
        if (a) a.hearts = Math.max(0, (a.hearts || 0) + delta);
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
          icon: a.icon || null, icon_source: a.iconSource || null,
          github: a.github || null, note: a.note || null,
          category: c.name, page: p.id, tags: a.tags || [],
          visible: a.visible !== false, clicks: typeof a.clicks === "number" ? a.clicks : 0,
          stars: typeof a.stars === "number" ? a.stars : 0,
          hearts: typeof a.hearts === "number" ? a.hearts : 0,
          featured: a.featured === true,
          sort_order: a.sort_order ?? itemCount
        };
        const { error: ae } = await writeAppRow(sb, rowPayload, null);
        if (ae) throw ae;
        itemCount++;
      }
    }
  }
  return { pages: sites.pages.length, categories: sites.pages.reduce((n, p) => n + p.categories.length, 0), items: itemCount };
}
