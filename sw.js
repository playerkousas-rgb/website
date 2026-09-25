// 簡單 offline cache：展示櫃本體可以離線打開（app 本身當然要上網）
// v20：升級 cache 版本 → activate 時自動清走舊 cache（scout-tools-v19 等），
//      解決「打開先見舊版殘留、之後先跳新版」嘅問題。
//      以後改咗 core 檔案想令用戶即刻用上新版，就 +1 個數。
//      v19 = 手機版標籤收細（支部一個字／排序得 emoji／分類短名）＋ 今期主打默認收起
//      v20 = 「適用級別」改叫「適用支部」＋支部篩選改做可多選（OR）＋分類 chips 識轉行
//      v21 = 瘦身版：icon PNG 壓縮（612K→172K 視覺不變）＋ Supabase CDN 鎖版本＋SRI
//      v23 = App Store 式 tile 漸變底＋提交按鈕移右上角＋footer 收做一行＋後台可本機上傳 ICON
//      v24 = 刪走商店介紹區（market-intro 太占位置）＋排行榜分數滿 100 先顯示
//      v25 = 全站改名「SCOUT APP STORE」＋副標題改「好工具，讓童軍生活更精彩。」
//      v26 = 排行榜三指標（🔥點擊／⭐收藏／❤️讚好）＋項目加心心＋探索分類走排序列
//            ＋「我的收藏」搬入搜尋行＋分類標籤改純文字＋「提交作品」按鈕改名
//      v28 = 投稿同時登記去 Scout Admin（Google Sheet＋電郵通知）＋表單加選填聯絡電郵／電話
//      v27 = 今期主打 ⭐／❤️ 數字跟排行榜一樣滿 100 先顯示（免得晒個位數難睇）
const CACHE = 'scout-tools-v28';
const ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/store.js', '/admin.js', '/app.js', '/market.js', '/market.css', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  if (e.request.url.endsWith('/apps.json')) return; // 永遠用最新版，唔入 cache
  if (e.request.url.endsWith('/sw.js')) return; // sw 本身要跟網絡，先至有新部署時自動更新
  // 頁面殼（HTML 導覽）行 network-first 並強制 no-cache：
  // 唔好俾瀏覽器 HTTP cache 攞住舊 index.html（「舊版殘留」主因之一）
  let pathname = "";
  try { pathname = new URL(e.request.url).pathname; } catch {}
  if (pathname.startsWith("/api/")) return;
  const isShell = e.request.mode === "navigate" || /\/(index\.html)?\/?$/.test(pathname);
  e.respondWith(
    // 核心 JS 行 network-first：有新部署即刻攞新版本（舊版行 cache-first，
    // 上網正常時永遠唔會更新 store.js/admin.js，導致後台改極都好似冇效）
    fetch(e.request, isShell ? { cache: "no-cache" } : undefined)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
