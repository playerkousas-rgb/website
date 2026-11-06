# AUDIT — 對照 readme（真理倉）嘅審閱報告

> **日期**：2026-11-06 · **基準**：`main` @ `7e27d0a` · **範圍**：成個 `playerkousas-rgb/website`（SCOUT APP STORE）
> **對照標準**：[`playerkousas-rgb/readme`](https://github.com/playerkousas-rgb/readme)
> 　五大鐵律 S／F／A／W／V（README §0）· [`docs/01-slim`](https://github.com/playerkousas-rgb/readme/blob/main/docs/01-slim.md) ·
> 　[`docs/33-icon-standard`](https://github.com/playerkousas-rgb/readme/blob/main/docs/33-icon-standard.md)（G11 圖標標準）·
> 　`templates/repo-starter/skills/promoted/repo-setup/SKILL.md`（12 樣核心、兩軸 review）
> **環境限制（照實講）**：沙盒只可以連 github／npm／pypi，**連唔到 Supabase 同四個紀錄冊嘅 live 網址**，
> 所以「DB 裡面 `icon_source` 實際值」「app 站實際回應」未能在線驗證；下面凡涉及線上狀態嘅，都寫明係「要你哋自己開一眼」。

---

## 0. 一句總結

> 個站本身 **S／F／A 三條鐵律基本達標**（零依賴、fail-closed、server-side 授權、SSRF 防護、測試齊），
> 但**圖標（G11）同 W／V 兩條鐵律未達標**，而且「圖標冇換」係**三個成因疊住**：
> 前端鏈路將 GitHub 頭像排第一 ＋ `/api/favicon` edge 快取 7 日 ＋ 我哋自己圖標檔缺 7 個（冇 `?v=` 版本策略）。
> 本次已修好成因鏈同補齊 9 個圖標，並加咗 lint 規則防再退步。**LICENSE 同 CI 兩項要你決定先動得。**

---

## 1. 本次改動（已 push 上 `arena/42aeb830-website`）

| 類別 | 改動 | 檔案 |
|---|---|---|
| 圖標鏈路 | **次序倒轉**：app 自己嘅 favicon 排第一，GitHub 頭像變後備（舊版永遠顯示帳號頭像） | `store.js` |
| 圖標鏈路 | 每條 icon URL 加 `?v=` cache-busting；`SITE_LOGO` 同步帶版本 | `store.js` |
| 圖標鏈路 | `/api/favicon`：edge 快取 **7 日 → 1 日**；`?v=`／`?refresh=1` → `no-store` 連上游 no-cache；失敗 404 亦 `no-store`（唔會爛足 7 日）；新增 `?debug=1` 回 JSON | `api/favicon.js` |
| 圖標鏈路 | 後台新增「🔄 重新抓取圖標」掣（換成時間戳版本，即時見新圖） | `admin.js`、`store.js` |
| 圖標資產 | 補齊 **9 個檔**（favicon.ico／16／32、apple-touch-icon 180、icon-192／512、maskable 192／512、og-image 1200×630），全部減色，合計 **192 KB**（預算 260 KB） | `icons/`、`scripts/make-icons.sh` |
| 圖標資產 | `index.html` head：**5 條 link ＋ og meta 一整套**（`og:image` 用絕對網址） | `index.html` |
| 圖標資產 | `manifest`：4 個 icon（any 192/512 ＋ **真 maskable** 192/512，唔再攞 any 冒充） | `manifest.webmanifest` |
| 部署 | `/icons/*` 落 `immutable` 一年、`sw.js` 落 `must-revalidate` | `vercel.json` |
| 防呆 | lint 新增第 8 條規則：9 個檔、IHDR 尺寸、體積預算、head 5 link＋og meta、manifest 4 icon —— 少一個 `npm run build` 就 fail | `scripts/lint.js` |
| 防呆 | 部署清單／單測同步；`sw` cache bump 到 **v39** | `scripts/verify-assets.js`、`test/*`、`sw.js` |

**驗證**：`npm run build` 全綠（lint 26 項、7 支單測、部署總體積 516.8 KB ≤ 1 MB）。

---

## 2. 「圖標冇換」—— 根因同查法

### 2.1 六層快取／優先序，逐層講

| # | 層 | 舊行為 | 為何會「換咗都見舊圖」 | 現況 |
|---|---|---|---|---|
| 1 | 前端鏈路 | GitHub 頭像排第一 | 只要 `github` 欄有填，**永遠**用帳號頭像，app 換幾多次 logo 都見唔到 | ✅ 改咗：app favicon 第一 |
| 2 | 我哋 `/api/favicon` | `s-maxage=604800`（7 日）＋ `stale-while-revalidate` 7 日 | 最壞 **14 日**都係舊圖 | ✅ 1 日；帶 `?v=` 即時 |
| 3 | 前端 URL | 冇版本參數 | 瀏覽器 HTTP cache 命中同一個 URL | ✅ 每條 URL 帶 `?v=` |
| 4 | Google s2 備援 | `sz=64` 冇版本 | Google 自己快取幾日 | ✅ 加 `?v=` |
| 5 | app 站自己 `/icons/*` | 通常 `immutable` 一年（readme `docs/33 §9.5` 明講唔可以原地覆蓋） | 就算我哋攞最新 HTML，個 icon 檔名唔變 → 仍然係舊 bytes | ⚠️ **要 app 站自己改檔名**（見 §2.3） |
| 6 | 本站 `sw.js` | cache `v38` 未 bump | 舊 cache 留住舊本體 | ✅ bump `v39` |

### 2.2 30 秒自查（由你哋喺瀏覽器做）

```text
① 睇 DB 嗰欄：後台 → 該 app「圖示來源」＝ 🌐 App 自帶 Logo（今次四個紀錄冊已確認係呢個）
② 睇伺服器攞到乜：
   https://scoutappstore.vercel.app/api/favicon?host=<app 網域>&debug=1
   → {"ok":true,"via":"link","checkedAt":"…"}   ← 伺服器端攞到嘅係新圖？
③ 睇 app 站自己：
   https://<app 網域>/icons/icon-192.png?v=20261106
   → 新圖 = 問題喺我哋（②③對比即知）；舊圖 = app 站自己未真正換（成因 5）
```

### 2.3 如果 ③ 係舊圖 —— 四個紀錄冊要點做

`docs/33 §9.5` 嘅硬規則：`/icons/*` 一年 immutable，**一改就要改檔名**，唔可以原地覆蓋。

1. 新圖另存做 `icon-192-v2.png`／`icon-512-v2.png`（maskable 同理）
2. 該 app 嘅 `index.html` 同 `manifest.webmanifest` 指去 `-v2` 檔名
3. `store.js`／`admin.js` 嗰邊**唔使改**（`/api/favicon` 會讀佢 HTML 攞最新 `<link rel=icon>`）
4. 部署後喺我哋後台撳一次「🔄 重新抓取圖標」

> 換句話講：**商店側已經修好，剩低嘅一半要喺四個紀錄冊自己嘅 repo 改檔名**。

---

## 3. G11 圖標標準（`docs/33`）前後對照

| 檔案 | 標準 | 改之前 | 改之後 |
|---|---|---|---|
| `favicon.ico`（16/32/48 三合一） | 必須 | ❌ 缺 | ✅ 7.2 KB |
| `favicon-16.png` | 必須（**手繪三層**，唔准縮圖） | ❌ 缺 | ✅ 0.2 KB（`convert -draw` 手繪） |
| `favicon-32.png` | 必須 | ❌ 缺 | ✅ 0.5 KB |
| `apple-touch-icon.png` 180 | 必須（iOS 主畫面，四角無白邊） | ❌ 用 `icon-192` 冒充（尺寸唔啱） | ✅ 7.5 KB |
| `icon-192.png` | 必須 | ✅ 22 KB | ✅ 8.3 KB（減色） |
| `icon-512.png` | 必須 | ✅ 138 KB | ✅ 91.2 KB |
| `icon-maskable-192.png` | 必須（中央 66–80% 安全區） | ❌ 缺 | ✅ 6.2 KB |
| `icon-maskable-512.png` | 必須 | ❌ 用 any 冒充（Android 裁圓會斬角） | ✅ 30.8 KB（滿版模糊底＋圓角主體） |
| `og-image.png` 1200×630 | 必須 | ❌ 缺（貼 WhatsApp 只有一行字） | ✅ 39.5 KB |
| `index.html` head | 5 link ＋ 4 meta | ⚠️ 只有 2 條 link、**0 條 og** | ✅ 齊 |
| `manifest` icons | any 192/512 ＋ maskable 192/512 | ⚠️ 3 個（maskable 假） | ✅ 4 個（真 maskable） |
| 9 檔體積 | ≤ 260 KB | — | ✅ 192 KB |
| `/icons/*` cache header | `immutable` 一年 | ❌ `vercel.json` 冇 headers | ✅ 已加 |
| 換圖標流程 | 唔可以原地覆蓋，要有版本策略 | ❌ 冇 | ✅ `?v=` ＋ `ICON_VER` ＋ lint 硬攔 |

重生指令：`bash scripts/make-icons.sh`（母圖 `icons/icon-512.png`；已寫明每一步嘅理由同 `docs/33` 對應）。

---

## 4. 五大鐵律對照（readme §0）

| 鐵律 | 現況 | 判斷 | 備註 |
|---|---|---|---|
| **S 瘦身**（`dist < 5MB`、bundle `< 2MB`、api 零依賴） | 部署 516.8 KB；零 dependencies；`api/*` 只用 Node 內建 | ✅ 達標 | `index.html` 110 KB 係最大單檔（見 P1-3） |
| **F 防呆**（fail closed、白名單、冪等、dry-run、CI 硬攔） | `api/admin-login` 缺環境變數即 503、origin 檢查、timingSafeEqual、限流；`api/notify-admin` 白名單＋去重＋限流；投稿失敗唔窒住；lint＋7 支單測喺 Vercel `buildCommand` 硬攔 | ✅ 大致達標 | **缺 GitHub CI**（P0-2）：Vercel 係唯一閘門，PR 階段冇攔 |
| **A 安全** | anon key 前後端分離（前端只有 anon）、admin 密碼只喺 server、RLS（`20260924-market.sql` 4 條 policy、`20261004-analytics.sql` 1 條）、`/api/favicon` 只收域名（擋 IP／localhost／`.local`／`.internal`）＋ 1 MB 上限＋9 秒預算 | ✅ 達標 | 4 位 PIN 同 in-memory rate limit 係已知限制，README §「已知限制」已披露（P0-3） |
| **W COPYRIGHT SCOUT SYSTEM** | 頁尾有 `© 2026 Scout System`；og-image 有 `© SCOUT SYSTEM` | ⚠️ 部分 | 大小寫同 readme 標準唔一致；生成圖冇「原圖／成品圖／使用紀錄」紀錄（PNG 唔適用 DCT 水印，但要紀錄來源）（P1-2） |
| **V 雙版號** | `package.json` 1.0.0、`sw.js` v39、icon `?v=20261106` —— 三套版本各自為政，README 冇版本表 | ⚠️ 未達標 | 非單一 HTML 專案，唔使 `app_v1.0.html` 命名，但要一個「邊個檔幾時改」嘅版本表（P1-1） |

---

## 5. `repo-setup` 12 樣核心（按本 repo 形式調整）

| 項目 | 有冇 | 說明 |
|---|---|---|
| `README.md` | ✅ | 36 KB，內容扎實（含已知限制），但缺目錄（P2） |
| `AGENTS.md` / `SCOPE.md` / `GLOSSARY.md` | ❌ | 冇（本專案無 AI 協作入口）。**建議至少加 `SCOPE.md`**（做乜／唔做乜兩條 bar） |
| `LICENSE` | ✅ | MIT（2026-11-06 用戶指定，已落檔） |
| `docs/`＋`docs/README.md` 索引 | ❌ | 冇；知識全塞 README／OPTIMIZATION.md |
| ADR（難逆轉決定） | ❌ | 例如「純靜態＋1 個 serverless、零依賴」「icon 鏈路次序」都值得一段 |
| `.gitignore` / `.vercelignore` | ✅ | 分得好，`test/`、`scripts/` 冇被擋（lint 有守） |
| `package.json` scripts（check／build） | ✅ | `lint + test + verify-assets` 三閘 |
| 單測（test/） | ✅ 7 支 | favicon／labels／analytics／market／notify-admin／report／boot-order |
| CI（`.github/workflows`） | ❌ | 用戶決定唔加（P0-2 已 close） |
| `migrations/` | ✅ 5 支 | 但冇「邊支對應邊個版本／邊個環境已跑」索引（P2） |
| `PREFLIGHT` / `guard` / `final_check`（真理倉 script） | ❌ | 本 repo 用自家 lint／verify-assets 代替，概念對得上 |
| 兩軸 review 報告 | ✅ | 就係本檔 §7、§8 |

---

## 6. 問題清單（P0 → P2）

### P0 —— 建議今個禮拜處理

| # | 問題 | 影響 | 決定 / 狀態 |
|---|---|---|---|
| P0-1 | **冇 `LICENSE`** | 對外分享／被 fork 時法律狀態不明 | ✅ **已解決（2026-11-06）**：用戶指定 **MIT**，`LICENSE` 已落檔並寫入 README |
| P0-2 | 冇 GitHub CI | 只有 Vercel 部署時才跑測試 | ⏸ **用戶決定唔加**（2026-11-06）。現時唯一閘門 = Vercel `buildCommand` → `npm run check` |
| P0-3 | 4 位 PIN ＋ in-memory 限流 | 暴力破解／多執行個體繞過 | ⏸ **用戶決定「收起來就算」**：本站只係展示櫃、冇敏感資料；後台入口維持 `#admin` 隱藏，唔再加 firewall。風險已知並接受 |
| P0-4 | 四個紀錄冊嘅圖標可能要**改檔名** | 唔改就永遠係舊圖（成因 5） | 用戶會自行核對「未 UPDATE 嗰兩本」，見 §2.3 四步 |

### P1 —— 一兩個 sprint 內

| # | 問題 | 建議 |
|---|---|---|
| P1-1 | 版本資訊散落三處（package 1.0.0／sw v39／icon `?v=`） | README 加「版本表」：日期｜本站版本｜sw cache｜icon `?v=`｜改咗乜。改版時三處一齊改（lint 可加對照） |
| P1-2 | W 版權細節（頁尾大寫、成品圖紀錄） | 頁尾統一 `© SCOUT SYSTEM`；`scripts/make-icons.sh` 已寫明母圖來源，再補一個 `docs/圖標使用紀錄.md`（母圖、生成指令、生成日期） |
| P1-3 | `index.html` 110 KB（HTML＋CSS＋boot 全塞一檔） | 每次改任何 UI，全站 cache 全部失效。可考慮抽 `site.css`（多一個請求，但 gzip 後更省）。**唔急，先量度真實 LCP 再決定** |
| P1-4 | 冇 `SCOPE.md`／`AGENTS.md`／ADR | 各寫一頁，之後 Agent 改呢個 repo 唔會亂加功能 |
| P1-5 | `og:image` 網域硬編碼 `scoutappstore.vercel.app` | 換 domain 時記得一齊改；寫入 README「部署清單」一節；或日後用 `VERCEL_URL` 生成 |
| P1-6 | 冇 `SECURITY.md`／`CONTRIBUTING.md` | 校內多人協作時有用（尤其「唔好自己改 admin PIN」呢類） |

### P2 —— 有時間先

| # | 問題 | 建議 |
|---|---|---|
| P2-1 | README 36 KB 冇目錄 | 開頭加 6 條錨點目錄 |
| P2-2 | `migrations/` 冇索引 | 加一張表：檔名｜改咗乜｜已跑環境｜日期 |
| P2-3 | 無障礙／對比度未驗 | 用 devtools 睇一次 390／768／1440；`prefers-reduced-motion` 已經有就更好 |
| P2-4 | `apps.json` 同 DB 兩套真相 | 現時 DB 優先、`apps.json` 只做預設模板，寫清楚喺 README 就夠（已寫） |
| P2-5 | 圖標 `?v=` 要人手同步三處（`index.html`／`manifest`／`store.js`） | lint 已能攔「唔一致」？**未**——可以加一條：三處版本號必須相同（我可以順手加） |

---

## 7. 兩軸 review — Standards（對返 repo 自己嘅標準）

- **硬違規（已修）**：G11 圖標 7 個檔缺失、head 缺 og meta、manifest maskable 造假、`/icons/*` 冇 immutable header → 全部喺本次改動修好，並由 lint 第 8 條規則鎖死。
- **硬違規（未修）**：缺 `LICENSE`、缺 CI。
- **Fowler smells 判斷（labelled judgement calls）**：
  - *Duplicated Code* — `admin.js` 同 `app.js` 各自 render tile（低風險，共用 `appIconHTML` 已足夠；**唔建議**為此抽 component）。
  - *Long File* — `index.html` 110 KB（見 P1-3）、`admin.js` 50 KB：可以接受，因為零 build step 係刻意設計（S 鐵律）。
  - *Speculative Generality* — `faviconCandidates` 四層 chain 略多，但每一層都有實戰理由（本站曾遇過 manifest-only 嘅站），保留。
  - *Temporary Field* — `ICON_VER` 為 module-level `let`，係刻意（要 runtime 改）；已寫註解。
- **最差一項**：**W／V 兩條鐵律只有半套**（版權字樣唔統一、版本資訊三套各自為政）。

## 8. 兩軸 review — Spec（逐句 quote 用戶要求）

| 用戶原話 | 分項 | 判斷 |
|---|---|---|
| 「參閱 readme.git」 | 讀真理倉 README ＋ `docs/33` ＋ `repo-setup` SKILL | ✅ 做咗（本檔引用全部有連結） |
| 「看看有什麼需要改善審閱檢討」 | 出審閱報告 | ✅ 本檔 §6 共 15 項，分 P0／P1／P2；**缺**：未能驗線上 DB／live 表現（環境限制，照實寫） |
| 「幫我檢查為什麼圖標沒有換」 | 根因分析 | ✅ §2 六層快取逐層；**做多咗**：直接修好三層（鏈路／快取／版本）而唔止解釋 |
| （上一輪答）「四個紀錄冊係用 App 自帶 Logo」 | 據此排除「上傳圖片」成因 | ✅ 已寫入 §2.2 第①步，並指出剩低一半喺 app repo |
| 「全部」 | 三項都做：修圖標／補 9 檔＋og＋manifest／出報告 | ✅ 三項完成；**未做**（需你決定）：LICENSE、CI |

---

## 9. 你要做嘅驗收（5 分鐘）

1. 部署後開 `https://scoutappstore.vercel.app/icons/og-image.png` → 見到 1200×630 預覽圖
2. 貼條連結落 WhatsApp → 有卡（唔再係一行字）
3. iOS Safari「加入主畫面」→ 有圖、四角無白邊
4. Android Chrome 安裝 → 圓形裁切唔會斬到金色徽章
5. 後台撳「🔄 重新抓取圖標」→ 四個紀錄冊圖標有冇更新（冇 → 行 §2.3）
6. `npm run build` 全綠（本機或 Vercel log）

---

## 10. 設計 pass（2026-11-06，ROUND 1）

用戶要求「UI 更美觀完善」，方向揀咗 **A. 照 house rules 徹底執** ＋ **圖標轉金色**。

### 10.1 做咗乜（可機械驗證）

| 項目 | 之前 | 之後 |
|---|---|---|
| 漸層 | `index.html` 19 處 ＋ `market.css` 5 處 ＋ 隨機 tile 漸層底 | **0 處**（lint 第 9 條硬攔） |
| 光暈／裝飾 blur | hero 脈動光暈 520px、聚光燈光束、5 粒閃星、`sections-blur` 6px blur、drop-shadow | **全部移除**（`backdrop-filter` 保留：嗰個係頂欄可讀性，唔係裝飾） |
| 英文 eyebrow | `MADE BY YOU`／`SETTINGS`／`SHARE`／`REPORT / FEEDBACK` | **全刪**，改用中文標題＋字級做層次 |
| 品牌色 | 金＋藍 `#2563eb`＋青 `#0d9488`＋橙 `#d97706`＋`#f59e0b` | **只有金**（深 `#e8c87a`／淺 `#b3821a`）＋語意色 danger/ok/warn |
| 隨機 tile 底色 | 10 色 palette by name hash | 透明底，真圖標做主角 |
| 排名編號 | `01 02 03` | `1 2 3` |
| 字階 | hero 24px vs tile 13.5px（≈1.8×） | hero `clamp(24,5.5vw,32)` vs 12–13.5px（≈2.4×）＋ token `--fs-1…5` |
| 9 個圖標 | 青藍霓虹 | **金色**（暖黑底 + 金線百合花，同四本紀錄冊同一語言），合計 78 KB |
| 設計語言文件 | 冇 | **`DESIGN.md`**（色 40/30/20/10、字階 6 級、圓角 2 級、禁止清單、驗收） |

### 10.2 六條 critique（只做得到嘅部分）

| Pass | 結果 |
|---|---|
| 1 秒／5 秒 | 第一屏：logo + 「SCOUT APP STORE」+ 副題 + 今期主打卡 → 答得到「呢個係乜」。**未證** 5 秒版本（要人眼） |
| Squint | 3 嚿 mass：頂欄／今期主打卡／tile 格 —— 層次分明（靜態判斷） |
| 遮 logo | 遮咗仍然係「童軍工具分類櫃」（副題＋分類 chips＋支部篩選都係本地語言）→ 有 idea |
| Edges | 文字左邊界只有 1 個 x 位置（`.wrap` 統一 16px）＋格內居中 → 通過 |
| Phone | 手機 tile 4 欄、`.tile-desc` ≤380px 隱藏、底欄細字唔 overflow（原本已有測試 `boot-order` 同 bnav 覆蓋）；**未親眼望** |
| Substance | 每個 app 有真名／真連結／真描述；排行榜數字係真實點擊數（<100 唔顯示）→ 冇假數字 |

### 10.3 冇做／做唔到

- **冇 screenshot**：沙盒冇 Chrome，`390／768／1440` 三張圖做唔到；所以**唔評 40/30/20/10 分數**（readme 明文：無圖唔准打分）。
- 未做手機獨立構圖重排（現時係 responsive 縮放，唔係另寫一套手機佈局）。
- 未改字體（仍用系統字 stack），未做深色／淺色 token 統一（兩套仍分開寫）。

---

## 11. 誠實聲明（做唔到嘅嘢）

- 冇連 Supabase／四個 app 網域，**未能實測** DB 值同 live favicon 回應。
- 冇真實瀏覽器截圖能力做 390／768／1440 望圖；只做咗靜態同單測驗證（boot-order 測試會實際執行全部 script）。
- 冇跑真理倉嘅 `preflight_v1.0.mjs`／`final_check_v1.0.mjs`（呢個環境冇嗰啲 script；概念上由本 repo 自家 lint＋test＋verify-assets 覆蓋）。
- 圖標設計沿用原本嘅霓虹金色／藍色母圖，冇重新生成美術風格（如果你想我出 4 個紀錄冊嘅新圖標，可以另外傾）。
