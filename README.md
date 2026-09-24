# SCOUT APP STORE（前身：童軍小工具）

一個 PWA「分類展示櫃」：將 童軍 Apps／學習圖卡／簡報／有用連結 全部用**分頁**分開，
每個分頁內再按**分類**排列，一個入口打開全部。可以「加入主畫面」裝做手機 App。

每個「項目」基本上都係一個**連結**（App、圖卡、PPT、網站都可以係一條 link），
可以揀 1–5 個 **童軍支部標籤**（小童軍／幼童軍／童軍／深資童軍／樂行童軍）。
公開版嗰列叫 **「適用支部」**，冇位晒名，所以**見到係一個字：小／幼／童／深／樂**
（領隊一眼就識；全名仍然係 DB／搜尋／篩選用嘅真相，hover／無障礙讀仲係全名）。
篩選係**多選**：同時揀「小＋幼」= 兩個支部嘅項目一齊顯示（OR），撳多次同一個就取消，
揀咗之後會見到「已揀 N 個 · ✕ 清除」，篩選會記住（重開頁面還在，轉分頁即清空）。

冇「領袖」呢個選項係刻意嘅：呢度所有工具本身就係畀領隊用，標籤只回答
「呢個內容係邊個支部用」——「小童軍集會助手」剔 `小童軍` 就得，唔使（亦都唔想）
連帶剔「領袖」，否則樂行領隊篩「領袖」會見到成排唔屬自己支部嘅嘢。
想有領隊專用區？直接把**分類**改名做「領袖用」就正。

## 四個分頁

| 分頁 id | 顯示名 | 預設 | 內容 |
|---|---|---|---|
| `apps` | 小工具 Apps | ✅ 開放 | 童軍 app（含三分類：電子進度紀錄 / 小工具 / 小遊戲） |
| `cards` | 學習圖卡 | 關閉 | 學習圖卡（全部用連結） |
| `ppt` | PPT 簡報 | 關閉 | 簡報（全部用連結） |
| `links` | 有用連結 | 關閉 | 其他有用連結 |

> 分頁同分頁入面嘅**每個項目**都可以獨立開放／關閉：
> 後台「開放分頁」✓ → 該分頁先喺公開版出現；
> 每個項目再各自 ✓「公開顯示」，先至逐個顯示。
> 圖卡／PPT／連結 都係透過後台加一條**連結**上去。

## 檔案結構

| 檔案 | 用途 |
|---|---|
| `index.html` | 頁面本體（樣式＋啟動 boot；一般唔使改） |
| `apps.json` | 預設模板／備用清單（配置好 Supabase 後以 DB 為準） |
| `store.js` | ⭐ 數據層 — **Supabase 配置填呢度**（`SUPABASE_CONFIG`）；兼預設模板 `makeDefaultSite()` |
| `admin.js` | 管理面板邏輯 |
| `app.js` | 公開版面渲染（分頁＋分類＋支部多選篩選） |
| `api/favicon.js` | ⭐ 伺服器端 favicon（Vercel serverless）—— 用 Chrome 分頁標籤嗰個原理，自己攞別站 HTML 讀 `<link rel="icon">` |
| `dev-server.mjs` | 本地 dev server（靜態＋`/api/favicon`，同 Vercel 行為一致） |
| `manifest.webmanifest` | PWA 配置 |
| `sw.js` | Service worker（離線可開） |
| `icons/` | 桌面圖標（已壓縮；新圖片規則見 OPTIMIZATION.md） |
| `package.json` | 極簡腳本：`npm run check`／`build`／`preview` —— **刻意零 dependencies** |
| `vercel.json` | 鎖死部署設定（framework null／build `npm run build`／輸出＝根目錄），唔靠 Vercel 自動偵測 |
| `.vercelignore` / `.gitignore` | 部署／commit 排除清單 —— 防死重上傳 Vercel（**test/、scripts/ 唔准擋**，build 閘門用得到） |
| `scripts/` | `lint.js`（防增肥守護）＋ `verify-assets.js`（部署清單核對），零依賴 |
| `OPTIMIZATION.md` | ⭐ 瘦身紀錄＋防增肥守則 —— **加套件／加圖片之前必讀** |

## 部署（Vercel）

1. 成個資料夾 push 上 GitHub repo
2. vercel.com → Add New → Project → Import repo → Deploy
3. 完成。之後每次 push 自動重新部署
4. `api/` 內嘅 function 會自動部署做 serverless（`/api/favicon`），唔使特別設定。

> **本地預覽**：`node dev-server.mjs`（預設 http://localhost:8080）。
> 用咗 `/api/favicon`，所以本地同 Vercel 行為一樣。單測：`node test/favicon.test.js`。

## 管理員點用（網址尾加 `#admin`）

登入後兩個分頁：

- **🛠 管理**
  - 頂部表單：**＋ 新增項目** —— 揀 **分頁** ＋ **分類**，填 名稱＋連結，
    㨂 **適用支部**（可多選）、介紹、emoji 圖示（有揀選器）、GitHub、內部備註、
    「公開顯示」開關。揀「＋ 呢頁新分類…」可以直接喺該分頁開新分類。
  - 「分頁＋分類＋項目 管理」：
    - 每個分頁一個 block，右上 **開放/關閉** 開關控制成個分頁
    - 分類列有 ▲▼排序、**改名**、**🎨 emoji**、**刪分類**（連帶刪入面所有項目）
    - 每頁可以「＋ 呢頁加分類」（用 emoji 揀選器揀 icon）
    - 每頁嘅項目逐行 **📣 今期推廣**／▲▼／編輯／隱藏／刪除
- **👀 總覽** —— 同公開版一樣嘅預覽，檢查公眾見到咩

### 📣 今期推廣（App Store 式推薦位）

公開版頂部有一個「今期主打」推薦位，**默認收起**：淨返一條
「今期主打 · 項目名」細條，唔食手機版面；用家有興趣撳一下先展開大圖
（邊個揀過收埋／展開會記住喺 `localStorage`）。推廣邊個項目**完全由後台控制**：

1. `#admin` → 🛠 管理 → 搵到想推廣嘅項目 → 撳 **「📣 今期推廣」**
2. 該項目即刻變成推薦位；按钮轉做 **「✅ 推廣中」**，撳多次就取消
3. **全站只可以有一個** —— 撳第二個會自動搶走，唔使人手取消舊嗰個
4. 管理頁頂部有 banner 顯示目前推廣緊邊個（連隱藏咗嘅都會報出嚟並警告）

推薦位嘅圖示／標題／介紹／連結全部自動攞該項目嘅資料；
展開後下面嘅徽章係**真實數據**：`⭐ N 人收藏`、`🎖 支部標籤`（一個字）。
**點擊數 `🔥` 刻意唔顯示** —— 主打多數係啱啱推出嘅新項目，嗰時係 0，晒出嚟難睇。
hero 右上角仲有一粒 **🔗 分享掣**：用 Web Share API 分享該項目，裝置唔支援就自動複製連結。

> 未設定任何今期推廣 → 推薦位自動收埋，下面嘅工具列表亦唔會朦朧。
> 需要 DB 有 `featured` 欄（見下方 SQL）；未加欄位㩒落去會彈出提示同嗰句 SQL。
> 徽章／按鈕嘅**文案**、`collapsedByDefault`（默認收起）、`showStars`（要不要顯示收藏數）
> 都改 `index.html` boot script 入面嘅 `SPOTLIGHT` 物件。

### 🔥 排序（預設／最多人點擊／最多人收藏）

公開版分類 chips 下面有一列「排序」：**🗂 預設順序｜🔥 最多人點擊｜⭐ 最多人收藏**。
手機版（<560px）只見到三個 emoji **🗂｜🔥｜⭐**（撳住有提示），省返成排位。

- `clicks` —— 每次喺公開版打開項目就 `+1`（`bump_clicks` RPC，舊站已自動累計）
- `stars` —— 每次 ⭐ 收藏 `+1`、取消 `-1`（`bump_stars` RPC）；全站累計，唔係個人
- 同分時保留後台嘅 ▲▼ 手動順序；項目少過 2 個唔顯示排序列
- 「⭐ 我的最愛」chip 仍係每個人自己嘅（存瀏覽器），同全站 `stars` 並存

> `clicks`／`stars` 都**唔使**理會 migration 都會安全（未加欄位就自動甩走再存）；
> 但要「最多人收藏」有真實數據，就要跑上面 `stars` 欄＋`bump_stars`。

### 📱 手機版：標籤點收細（同一個掣，細屏短、大螢幕全名）

三列 chips（分頁導覽／適用支部／分類）都係「同一個掣、兩套文字」，
由 CSS 切換（`index.html` 最尾嗰個 `@media (max-width: 559.98px)`）：

| 位置 | 手機版（<560px） | 桌面版 |
|---|---|---|
| 分頁導覽 | 🧰 小工具 | 🧰 小工具 Apps |
| 適用支部（可多選） | 小／幼／童／深／樂 | 同一個字（tooltip 有全名） |
| 排序 | 🗂／🔥／⭐ | 🗂 預設順序／🔥 最多人點擊／⭐ 最多人收藏 |
| 分類 chips | emoji + 短名（`catShort()`） | emoji + 全名 |
| tile 小標籤 | 一個字 | 一個字 |

**分類 chips 唔會再俾人截**：`flex-wrap: wrap` —— 一行放唔低就轉第二行
（以前得返一行橫捲，「小工具」之後幾個永遠睇唔到）。sticky 高度由 `measurePanes()`
實測，寫入 `--chip-h`，所以 `section` 嘅 `scroll-margin-top` 永遠啱。

**未撳 ≠ 已撳**：支部／排序 chip 未揀時用**中性外殼**（`--bg-card` + 灰字），
揀咗先變 accent 漸層；行頭有 `🔍 適用支部：`／`↕ 排序：` 同「（可多選）」提示，
避免一睇以為已經揀咗、唔知可以撳。

`catShort()`（喺 `store.js`）嘅規則：≤4 字原樣顯示 → 削走括號內容 →
長過 4 字就削冇資訊量嘅修飾詞（電子／系統／平台／管理／Apps…）→ 仲長就截 6 字加「…」。
**想完全控制縮寫？後台將分類改名做你想見嘅短名即可**（≤4 字就原樣顯示，唔會再被削）。


其他按鈕：📤 備份｜♻️ 還原（完整覆蓋）｜🔳 QR｜**⚠️ 一鍵重設**｜登出

### 圖示來源（每個項目有 4 選 1）

新增 / 編輯項目時，揀「圖示來源」：

| 選項 | 行為 | 適用場景 |
|---|---|---|
| 🌐 **App 自帶 Logo**（預設） | GitHub repo 欄（或 URL 本身係 github.com）有填 → 用 repo 主人嘅 GitHub 頭像（64px）；否則自動攞該網站 favicon，順序：① 我哋 `/api/favicon`（同 Chrome 分頁標籤一樣自己讀該站 HTML）→ ② Google s2 備援 → ③ 全站 Logo | 對外連結到自己嘅 Vercel/網站，最方便 |
| 😀 **Emoji** | 由你揀一個字符 | 自家內部工具、快速標記 |
| 🖼 **上傳圖片／圖片網址** | 後台直接由本機上傳圖片（自動縮到 192px 內、壓做 data URL），或者貼一張 https 圖片連結 | 想用特定 PNG / 設計過嘅 logo |
| 🚫 **不用** | 直接用我哋全站 Logo | 想統一一個 brand |

> 舊資料冇 `icon_source` 欄位會自動推測：icon 係 https URL 或 `data:image/…`（後台上傳）視為「上傳圖片」；
> 其他非空字串視為「Emoji」；空字串視為「App 自帶 Logo」—— 行為兼容唔使人手改。

### 🌐 自動 favicon 係點做嘅（Chrome 嗰個原理）

Chrome 分頁標籤識顯示 ICON，係因為佢**自己攞咗成頁 HTML**，然後：
讀 `<link rel="icon">` → 揀最啱尺寸 → 冇就試 `/favicon.ico`。

我哋個站係「另一個網站」，瀏覽器受 **CORS** 限制讀唔到別站 HTML，
所以放咗一個 Vercel serverless function（`api/favicon.js`）做同一件事：

1. 伺服器攞該站 HTML（https 唔通轉 http，跟重定向）
2. 搵所有 `<link rel="icon">`（包括 `shortcut icon` / `apple-touch-icon`），
   按「PNG 優先、32–128px 最啱 64px tile」打分揀最佳
3. 冇 link 或圖 404 → 試該站 `/favicon.ico`
4. 都冇 → 回 404，前端 `<img>` 自動行備援：Google s2 → 全站 Logo

附帶好處：唔使經 Google、edge cache 7 日、SSRF 防護（只收域名，唔收 IP/內網）。

### ⚠️ 一鍵重設（清空 + 建立預設模板）

登入後撳「一鍵重設」會**完整清空** DB／本機嘅所有分類同項目，並建立預設模板：

- 4 個分頁（Apps 開放；圖卡／PPT／連結 關閉，等你之後逐個開）
- `apps` 分頁三分類：**電子進度紀錄 / 小工具 / 小遊戲**（全部空，等你加內容）

> 因為而家後台連「刪分類」都做到，你可以自己逐個刪；
> 但最乾淨係直接「一鍵重設」。會問兩次先執行，不可逆。

### 童軍支部標籤（用戶篩選）

- 固定五個：小童軍、幼童軍、童軍、深資童軍、樂行童軍（**冇「領袖」**，見上文解釋）
- 加項目時可㨂多個；公開版該分頁下方會出現「🔍 適用支部」一排掣，
  顯示做一個字（小／幼／童／深／樂），**可以同時揀幾個**（OR）
- 揀咗之後行尾出現「已揀 N 個 · ✕ 清除」；篩選記住喺 `localStorage`
  （`scout-tag-filter`，含所屬分頁，轉分頁會清空），搜尋／分類/排序全部疊加（AND）
- tile 下會顯示一個字嘅支部小標籤（`title` 留全名）
- 搜尋欄（`搜尋支部／分類／項目…`）打全名或者一個字都揾到

### 金手指改密碼（隱藏）

登入後連點 Logo 20 次開改密碼（冇任何按鈕提示）。或去
Supabase Dashboard → Authentication → Users → 重置。

## ⚙️ 首次建表 / 舊站升級（Supabase）

> 未行下面 SQL 前，後台/公開版會自動當「apps 單頁」運作（舊資料會塞入 apps 分頁），
> 唔會整冧個站；行完 SQL 後再入 `#admin` 撳一次「一鍵重設」就有乾淨嘅新版。

Supabase → SQL Editor → 貼以下 SQL → Run（冚辦掂，可直接連跑）：

```sql
-- 0) 先保證三張表存在（全新 / 已存在都唔會整爛）
create table if not exists pages (
  id text primary key,
  label text not null,
  icon text,
  enabled boolean not null default true,
  sort_order int not null default 0
);
create table if not exists categories (
  name text not null,
  icon text,
  page text not null default 'apps',
  sort_order int not null default 0
);
create table if not exists apps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  description text,
  icon text,
  icon_source text, -- 'favicon' (預設) / 'emoji' / 'upload' / 'none'
  github text,
  note text,
  category text not null default '其他',
  page text not null default 'apps',
  tags text[],
  visible boolean not null default true,
  clicks int not null default 0,
  stars int not null default 0,
  featured boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 1) 舊表補新欄位（分頁 + 童軍支部標籤 + 圖示來源 + 今期推廣）
alter table categories add column if not exists page text not null default 'apps';
alter table apps add column if not exists page text not null default 'apps';
alter table apps add column if not exists tags text[];
alter table apps add column if not exists icon_source text;
alter table apps add column if not exists stars int not null default 0;
alter table apps add column if not exists featured boolean not null default false;

-- 2) 分類改用「(page, name)」組合主鍵，先可以每個分頁獨立用同名分類
alter table categories drop constraint if exists categories_pkey;
alter table categories add primary key (page, name);

-- 3) 開啟 RLS（冚 bar）
alter table pages enable row level security;
alter table categories enable row level security;
alter table apps enable row level security;

-- 4) 讀寫權限：任何人都可讀；只有登入嘅 admin 可寫
drop policy if exists "public read pages" on pages;
create policy "public read pages" on pages for select using (true);
drop policy if exists "public read categories" on categories;
create policy "public read categories" on categories for select using (true);
drop policy if exists "public read apps" on apps;
create policy "public read apps" on apps for select using (true);

drop policy if exists "admin insert pages" on pages;
create policy "admin insert pages" on pages for insert to authenticated with check (true);
drop policy if exists "admin update pages" on pages;
create policy "admin update pages" on pages for update to authenticated using (true);
drop policy if exists "admin delete pages" on pages;
create policy "admin delete pages" on pages for delete to authenticated using (true);

drop policy if exists "admin insert categories" on categories;
create policy "admin insert categories" on categories for insert to authenticated with check (true);
drop policy if exists "admin update categories" on categories;
create policy "admin update categories" on categories for update to authenticated using (true);
drop policy if exists "admin delete categories" on categories;
create policy "admin delete categories" on categories for delete to authenticated using (true);

drop policy if exists "admin insert apps" on apps;
create policy "admin insert apps" on apps for insert to authenticated with check (true);
drop policy if exists "admin update apps" on apps;
create policy "admin update apps" on apps for update to authenticated using (true);
drop policy if exists "admin delete apps" on apps;
create policy "admin delete apps" on apps for delete to authenticated using (true);

-- 5) 點擊數（公開頁每次打開項目會調用）
create or replace function bump_clicks(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update apps set clicks = clicks + 1 where id = p_id;
$$;

-- 6) 收藏數（公開頁 ⭐ 收藏／取消會調用；p_delta 传 1 或 -1）
create or replace function bump_stars(p_id uuid, p_delta int default 1)
returns void
language sql
security definer
set search_path = public
as $$
  update apps set stars = greatest(0, stars + p_delta) where id = p_id;
$$;
```

### 建 admin 帳號（如果未建）

Dashboard → Authentication → Users → Add user → 填假 email（例 `ai@skwscout.org.hk`）、
勾 **Auto-confirm user**、設密碼。呢個密碼就係管理面板登入密碼。

### 填配置

將項目資料填入 `store.js` 頂部 `SUPABASE_CONFIG`（現已預填）：

```js
const SUPABASE_CONFIG = {
  url: "https://xxxx.supabase.co",
  anonKey: "eyJhbGci...",
  adminEmail: "ai@skwscout.org.hk"
};
```

部署後入 `#admin` 打密碼登入 → 撳一次「⚠️ 一鍵重設」建立預設模板 → 開始加內容。

安全說明：`anon key` 係公開嘅；真正保護嚟自 Row Level Security ——
未登入只能讀，寫唔到。

## Admin 帳號同密碼備忘

- 密碼**唔喺**靜態代碼入面，喺 Supabase 用戶資料庫，同部署無關。
- 共用帳號：所有人都用同一個（`ai@skwscout.org.hk`），登入頁自動預填，只打密碼。
- 收回權限 = 改密碼（舊 session 約 1 小時內自動到期）。

## 2026-09 商店升級：分類、排行榜、社群投稿

- 公開版新增「探索分類／排行榜」，人氣榜按累計開啟次數、收藏榜按累計收藏數排序；套用目前分頁、分類、搜尋、支部篩選，同分按作品名稱排序，最多 50 個。不是每週榜或防作弊的獨立訪客統計。
- 「提交我的作品」接受名稱、HTTP(S) 連結、作者、簡介、分類及最多 8 個自訂標籤。不會自動上架，也不會假裝只存本機就是投稿成功。
- 後台新增待審核、已上架、已拒絕清單。批准時由資料庫交易一次過建立作品及更新審核狀態，避免重複批准。拒絕的作品不進公開商店。
- `/#admin` 及 `/#ADMIN` 都會進入登入頁。CDN 載入失敗或未設定服務時不會再自動取得管理權限。

### 必須完成的一次性部署設定

**只有修改程式碼並不會自動修改遠端 Supabase 或 Vercel 設定。未完成下列步驟時，登入／投稿會清楚顯示尚未設定，不會繞過權限。**

1. 先備份資料庫；在 Supabase SQL Editor 執行 `migrations/20260924-market.sql`（依賴本文原有 pages/categories/apps 基礎結構）。此升級保留作品，但會替換這三張表原有 RLS policies；若有其他服務共用，先審閱其權限需求。不要在升級後重新執行上方舊版寬鬆 policies。
2. Supabase Authentication 保留一個已確認的管理員帳戶 `ai@skwscout.org.hk`，為它設定**高強度的 Supabase 密碼**。建議關閉公開註冊。SQL 的管理員 email、`store.js` 的 adminEmail 和下列 ADMIN_EMAIL 必須相同。一般已登入使用者不會有管理權。
3. 在 Vercel 專案設定新增下列環境變數（Preview / Production 分開設定），然後重新部署：

   | 變數 | 值 |
   | --- | --- |
   | `ADMIN_PIN` | 使用者要求的 `0728`；保留開頭 0 |
   | `SUPABASE_URL` | 與 store.js 相同的 Supabase 專案 URL |
   | `SUPABASE_ANON_KEY` | 與 store.js 相同的公開 anon key |
   | `ADMIN_EMAIL` | `ai@skwscout.org.hk` |
   | `ADMIN_AUTH_PASSWORD` | 第 2 步的真實強密碼，只放伺服器環境變數，切勿提交到 Git |

   不需要 service-role key。伺服器驗證 PIN 後才向 Supabase 換取管理員 session；前端只保存 sessionStorage（分頁工作階段），不是保存 PIN 或底層帳戶密碼。變更 PIN 用 ADMIN_PIN，而不是舊的 Supabase 改密碼功能。已有 session 不會因改 PIN 自動撤銷，必要時在 Supabase 撤銷登入工作階段。

4. **四位 PIN 保護有限。** API 有單一執行個體每 IP 15 分鐘 5 次的基本限制，但 serverless 冷啟動／多執行個體可重設；正式對外前請在 Vercel Firewall 對 `/api/admin-login` 加跨執行個體 rate-limit，最好改用更長密碼。匿名投稿亦建議啟用 Supabase 端流量監控及 CAPTCHA／閘道限制，現版本只防重複連結及驗證內容長度，不是完整反垃圾系統。
5. 驗收：無痕視窗錯誤 PIN 應拒絕、正確 PIN 可登入；另一裝置提交作品後公開頁不應見到；後台批准後公開頁重新整理可見；拒絕後仍不可见；匿名直接寫入 apps、非管理員 review_work 應被拒絕。

本機以環境變數啟動 `npm run preview`，同樣走 `/api/admin-login`。`npm run build` 包含登入 API 模擬測試和 JS 語法檢查；真實 RLS／跨裝置審核須在 SQL 升級及遠端設定完成後驗收。
