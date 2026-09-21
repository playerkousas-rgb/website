# ⭐ 瘦身與防增肥守則（OPTIMIZATION.md）

> **呢份文件係防「之後改版改改下忘記」嘅護身符。**
> 本站部署喺 Vercel，儲存空間有配額；任何令 repo／部署產物變肥嘅改動，
> 都會慢慢食盡個 quota。改版之前花兩分鐘睇晒呢頁，慳返之後大執嘅時間。

**架構一句講晒**：純靜態站（`index.html` + 3 個 JS + 圖標）＋ 一個 serverless（`api/favicon.js`），
**source 直上**（冇建置產物）、**零 npm 運行期依賴**（Supabase 用 CDN 單檔引入）。
會部署嘅總體積 ≈ **349 KB**（`npm run build` 會印出最新數字）。

---

## ✅ 2026-09-20 瘦身紀錄（今次做咗咩）

### 掃描結果：死重檔案 = 0
全文 Grep 過 `images/ assets/ public/` 類目錄同所有檔案：**15 個檔案全部有被引用**，
冇孤立截圖、冇設計原稿、冇備份檔（`*.bak *.tmp *.old`）——所以「冇檔案可以刪」。
真正嘅死重喺**圖片體積**同**部署配置缺失**，已經處理：

### 圖片無損瘦身（視覺不變，RMSE ≈ 1%）
| 檔案 | 之前 | 之後 | 慳咗 |
|---|---|---|---|
| `icons/icon-512.png` | 296 KB | 138 KB | **−158 KB（−53%）** |
| `icons/icon-192.png` | 48 KB | 22 KB | **−26 KB（−54%）** |
| `icons/ig-qr.png` | 4.0 KB | 0.8 KB | **−3.3 KB（−81%）** |
| **合計** | **348 KB** | **161 KB** | **−187 KB** |

方法（256 色盤量化，對漸層底＋線稿 icon 完全唔覺；QR 碼係 bit-exact）：
```bash
convert icons/icon-512.png -strip -colors 256 -depth 8 icons/icon-512.png
```

### 部署配置（防止 Vercel 攞成個開發環境）
- ➕ `.vercelignore`（之前**冇**）——擋走 `node_modules`、`test/`、`scripts/` 以外嘅開發檔、
  `*.bak *.log` 等備份、`uploads/`、`dist/` 建置快取。上傳乜嘢由呢個檔話事。
- ➕ `.gitignore`——同一套規則擋住唔准入 git。
- ➕ `package.json`（之前**冇**）——**刻意零 `dependencies`**：
  `npm run check`（lint＋單測）、`npm run build`（check＋部署清單核對）、`npm run preview`（本地 dev server）。
  全部用 node 內建模組寫（`scripts/lint.js`、`scripts/verify-assets.js`），
  連 ESLint 都唔裝——慳幾十 MB，亦係俾 Vercel 部署前跑一次檢查嘅閘門。
- ➕ `package-lock.json`（236 B，零依賴鎖）——Vercel install 即完成。

### 修復／加固（bug review 結果）
- 🐛 **Supabase CDN 用浮動版本 `@2` + 冇 SRI** → 鎖死 `@2.116.0`＋加
  `integrity="sha384-…"`＋`crossorigin`。舊寫法有兩個問題：CDN 一出 v3/改版全站被動跟住變
  （隨時更肥更慢甚至炸）；同埋 CDN 畀人篡改嘅話瀏覽器照收（供應鏈風險）。
- 🧹 `sw.js` cache `v20 → v21`（改咗 index.html／icon，照檔案頂慣例 +1）。
- ✅ 檢查過**冇問題唔使郁**嘅：`sw.js` fetch handler 永遠 network-first（唔會食住舊版）；
  `esc()` XSS 轉義涵蓋所有用戶資料渲染位；`/api/favicon` SSRF 防護（拒 IP/內網/port）+ 9s 預算；
  `apps.json` 永不入 SW cache；`index.html` 導航 no-cache + controllerchange reload 機制。
  `store.js` 內 `SUPABASE_CONFIG.anonKey` 係公開 anon key，安全性靠 Supabase RLS（全表 SELECT 公開、寫入限 authenticated），屬設計之內。

### 🔥 教訓（2026-09-21，PR #13 Vercel 部署失敗）
兩層原因，逐層揭：
1. **`test/` 曾經被放入 `.vercelignore`** —— Vercel 行 `npm run build` → `npm run check`
   → `node test/*.js` 時 `MODULE_NOT_FOUND`，build 直接爆。
   **規則：`.vercelignore` 只准擋「build 完全用唔到」嘅嘢。
   `test/`、`scripts/`、`package.json`、`package-lock.json` 係 build 閘門嘅一部分，
   必須上傳（夾埋先 ~90KB，唔係死重）。** `scripts/lint.js` 已加規則自動把關。
2. **Vercel 一見 `package.json` 有 `build` script 就自動行，行完預設搵 `public/` 目錄做輸出** ——
   本站係「根目錄直上」，冇 `public/`，就算 build 成功都會爆
   `No Output Directory named "public" found`。
   **規則：`vercel.json` 鎖死 `framework: null` + `buildCommand: npm run build` +
   `outputDirectory: "."`，唔好靠自動偵測。** `scripts/lint.js` 亦鎖埋呢三個值。

---

## 📏 鐵律（改版前必讀，違者 lint 會擋）

### 1. `dependencies` 永遠 = 0
- 運行期套件一律**唔准入** `package.json` —— 個站係靜態檔，所有 JS 已經喺 repo／CDN。
- 話口輕量想裝lodash、axios、day.js？全部唔使：原生 JS 有 `Object.groupBy`／`fetch`／`Intl`。
- 真係要建置工具（例：日後加 Vite／Tailwind）→ 只准入 **`devDependencies`**，
  並喺 `package.json` 該欄位旁邊寫明理由；`node_modules` 永遠唔入 git／部署（`.vercelignore` 已擋）。

### 2. 外部 CDN script：鎖死版本 + SRI
而家唯一外部依賴係 `index.html` 內 Supabase UMD。規則：
- **唔准用 `@2`／`@latest` 呢類浮動版本**；
- 一定要有 `integrity` + `crossorigin="anonymous"`（`scripts/lint.js` 會驗）。

**CDN 依賴升級 SOP**：
```bash
npm view @supabase/supabase-js dist-tags          # 1) 揀 latest 確實版本號
npm pack @supabase/supabase-js@X.Y.Z --silent     # 2) 攞份 UMD 檔
tar -xzf supabase-supabase-js-X.Y.Z.tgz package/dist/umd/supabase.js
openssl dgst -sha384 -binary package/dist/umd/supabase.js | openssl base64 -A
# 3) index.html 更新版本號 + integrity="sha384-<上面個 hash>" → npm run check
```

### 3. 圖片：入 repo 前 100KB 內，上限 200KB
- `icons/` 以外**唔好開新嘅圖片目錄**；截圖／設計原稿唔好入 repo（放雲端硬碟／issue attachment）。
- 新圖先行壓縮：`convert in.png -strip -colors 256 -depth 8 out.png`，再 `compare -metric RMSE` 目測對比。
- 512px icon 保持 ≤200KB；超咗 `scripts/lint.js` 會 fail。

### 4. 死重檔案唔准入 repo
`*.bak *.tmp *.old *.log *.swp *~ *-copy.*`、`uploads/`、`dist/ build/ .next/` 等一律唔准入
——備份用 git（commit 就係備份），唔係 copy 檔案。lint 會掃全 repo。

### 5. `.vercelignore` 同「部署清單」要同步維護
- 新加**會部署**嘅檔案 → 加入 `scripts/verify-assets.js` 嘅 `DEPLOY` 白名單；
- 新加**純開發**嘅檔案 → 加入 `DEV_ONLY`，並確認 `.vercelignore` 擋住佢。
- 跑 `npm run build` 就會印出部署總體積＋揪出「無主」檔案，數字突然暴增即係有嘢漏擋。
- ⚠️ **`test/`、`scripts/`、`package*.json` 永遠唔准入 `.vercelignore`**
  （Vercel 喺上傳集上面行 `npm run build`，擋走佢 = 部署爆 MODULE_NOT_FOUND）。
  改完 `.vercelignore` 想本地驗證？模擬 Vercel 上傳集跑一次：
  ```bash
  rm -rf /tmp/vsim && cp -r . /tmp/vsim/ && cd /tmp/vsim
  rm -rf .git node_modules dev-server.mjs README.md OPTIMIZATION.md
  npm run build   # 呢個狀態行唔過，Vercel 都一樣會爆
  ```

### 6. 改咗 core 檔案（index.html / store.js / app.js / admin.js / icons）→ `sw.js` Cache 版本 +1
檔案頂有註解慣例：`scout-tools-vN` +1，activate 自動清舊 cache，用戶即刻攞到新版。

### 7. 部署前守門
```bash
npm run check    # lint（防增肥規則）+ 單測
npm run build    # check + 部署清單核對 + 體積報告
npm run preview  # 本地 http://localhost:8080 行一次（#admin 都入去撳撳）
```
Vercel 會喺每次 push 自動行 `npm run build` —— **測試唔過 = 部署唔出**，所以本地先行一次。

---

## 🖥 Vercel 設定（維持呢個樣）
- `vercel.json` 已鎖死：`framework: null`、`buildCommand: npm run build`、`outputDirectory: "."`
  —— 呢三個值係 PR #13 部署爆咗兩次嘅教訓，**唔好改返做自動偵測**（lint 會擋）。
- `api/` 自動變 serverless（`/api/favicon`），唔使設定
- Quota 喺 **Vercel Dashboard → Settings → Usage** 睇；部署 artifact 淨係 ≈349 KB，點都食唔爆
