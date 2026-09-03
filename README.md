# 童軍小工具（前身：App 展示櫃）

一個 PWA「分類展示櫃」：將 童軍 Apps／學習圖卡／簡報／有用連結 全部用**分頁**分開，
每個分頁內再按**分類**排列，一個入口打開全部。可以「加入主畫面」裝做手機 App。

每個「項目」基本上都係一個**連結**（App、圖卡、PPT、網站都可以係一條 link），
可以揀 1–5 個 **童軍級別標籤**（小童軍／幼童軍／童軍／深資童軍／樂行童軍），
公開版用戶可以按自己嘅級別篩選睇咩。

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
| `app.js` | 公開版面渲染（分頁＋分類＋級別篩選） |
| `manifest.webmanifest` | PWA 配置 |
| `sw.js` | Service worker（離線可開） |
| `icons/` | 桌面圖標 |

## 部署（Vercel）

1. 成個資料夾 push 上 GitHub repo
2. vercel.com → Add New → Project → Import repo → Deploy
3. 完成。之後每次 push 自動重新部署

## 管理員點用（網址尾加 `#admin`）

登入後兩個分頁：

- **🛠 管理**
  - 頂部表單：**＋ 新增項目** —— 揀 **分頁** ＋ **分類**，填 名稱＋連結，
    㨂 **童軍級別**（可多選）、介紹、emoji 圖示（有揀選器）、GitHub、內部備註、
    「公開顯示」開關。揀「＋ 呢頁新分類…」可以直接喺該分頁開新分類。
  - 「分頁＋分類＋項目 管理」：
    - 每個分頁一個 block，右上 **開放/關閉** 開關控制成個分頁
    - 分類列有 ▲▼排序、**改名**、**🎨 emoji**、**刪分類**（連帶刪入面所有項目）
    - 每頁可以「＋ 呢頁加分類」（用 emoji 揀選器揀 icon）
    - 每頁嘅項目逐行 ▲▼／編輯／隱藏／刪除
- **👀 總覽** —— 同公開版一樣嘅預覽，檢查公眾見到咩

其他按鈕：📤 備份｜♻️ 還原（完整覆蓋）｜🔳 QR｜**⚠️ 一鍵重設**｜登出

### 圖示來源（每個項目有 4 選 1）

新增 / 編輯項目時，揀「圖示來源」：

| 選項 | 行為 | 適用場景 |
|---|---|---|
| 🌐 **App 自帶 Logo**（預設） | 自動攞該網站嘅 favicon（Google s2，64px）；攞唔到就退我哋全站 Logo | 對外連結到自己嘅 Vercel/網站，最方便 |
| 😀 **Emoji** | 由你揀一個字符 | 自家內部工具、快速標記 |
| 🖼 **圖片網址** | 貼一張 https 圖片連結 | 想用特定 PNG / 設計過嘅 logo |
| 🚫 **不用** | 直接用我哋全站 Logo | 想統一一個 brand |

> 舊資料冇 `icon_source` 欄位會自動推測：icon 係 https URL 視為「圖片網址」；
> 其他非空字串視為「Emoji」；空字串視為「App 自帶 Logo」—— 行為兼容唔使人手改。

### ⚠️ 一鍵重設（清空 + 建立預設模板）

登入後撳「一鍵重設」會**完整清空** DB／本機嘅所有分類同項目，並建立預設模板：

- 4 個分頁（Apps 開放；圖卡／PPT／連結 關閉，等你之後逐個開）
- `apps` 分頁三分類：**電子進度紀錄 / 小工具 / 小遊戲**（全部空，等你加內容）

> 因為而家後台連「刪分類」都做到，你可以自己逐個刪；
> 但最乾淨係直接「一鍵重設」。會問兩次先執行，不可逆。

### 童軍級別標籤（用戶篩選）

- 固定五個：小童軍、幼童軍、童軍、深資童軍、樂行童軍
- 加項目時可㨂多個；公開版該分頁下方會出現「適用級別」一排按鈕，
  撳一個就只顯示啱嗰個級別嘅項目
- 項目右上 / tile 下會顯示細級別標籤

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
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 1) 舊表補新欄位（分頁 + 童軍級別標籤 + 圖示來源）
alter table categories add column if not exists page text not null default 'apps';
alter table apps add column if not exists page text not null default 'apps';
alter table apps add column if not exists tags text[];
alter table apps add column if not exists icon_source text;

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
```

### 建 admin 帳號（如果未建）

Dashboard → Authentication → Users → Add user → 填假 email（例 `ai@scoutsystem.com`）、
勾 **Auto-confirm user**、設密碼。呢個密碼就係管理面板登入密碼。

### 填配置

將項目資料填入 `store.js` 頂部 `SUPABASE_CONFIG`（現已預填）：

```js
const SUPABASE_CONFIG = {
  url: "https://xxxx.supabase.co",
  anonKey: "eyJhbGci...",
  adminEmail: "ai@scoutsystem.com"
};
```

部署後入 `#admin` 打密碼登入 → 撳一次「⚠️ 一鍵重設」建立預設模板 → 開始加內容。

安全說明：`anon key` 係公開嘅；真正保護嚟自 Row Level Security ——
未登入只能讀，寫唔到。

## Admin 帳號同密碼備忘

- 密碼**唔喺**靜態代碼入面，喺 Supabase 用戶資料庫，同部署無關。
- 共用帳號：所有人都用同一個（`ai@scoutsystem.com`），登入頁自動預填，只打密碼。
- 收回權限 = 改密碼（舊 session 約 1 小時內自動到期）。
