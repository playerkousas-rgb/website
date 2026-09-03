# App 展示櫃

一個 PWA 展示櫃，將你所有 app 分類排放，一個入口打開全部。
可以「加入主畫面」安裝做手機 App，之後唔使逐个 app 加落桌面。

## 檔案結構

| 檔案 | 用途 |
|---|---|
| `index.html` | 頁面本體（一般唔使改） |
| `apps.json` | 示例/備用清單（配置好 Supabase 後以 DB 為準） |
| `store.js` | ⭐ 數據層 — **Supabase 配置填呢度**（`SUPABASE_CONFIG`） |
| `admin.js` | 管理面板邏輯 |
| `manifest.webmanifest` | PWA 配置 |
| `sw.js` | Service worker（離線可開展示櫃） |
| `icons/` | 桌面圖標 |

## 部署（Vercel）

1. 將成個資料夾 push 上 GitHub repo
2. [vercel.com](https://vercel.com) → Add New → Project → Import repo → Deploy
3. 完成。之後每次 push 都自動重新部署

## 加新 app（前端直接加，唔使改 Git）

1. 打開你嘅網站，網址尾加 `#admin` → 例如 `https://xxx.vercel.app/#admin`
2. 登入（Supabase 模式；配置咗 `adminEmail` 之後其他人只使打密碼）
3. 填 名稱 + URL + 分類（可加介紹、emoji、GitHub、內部備註、隱藏開關）→「加入」
4. 改完「完成」— 公眾頁面即時見到，唔使重新部署

### 管理面板功能

| 功能 | 說明 |
|---|---|
| ＋ 加入 / 編輯 / 刪除 | 名稱、URL、分類、介紹（顯示喺公開版面）、emoji、GitHub、內部備註（只有 admin 見到）、隱藏開關 |
| ▲▼ App 排序 | 每個 app 可以用 ▲▼ 喺分類內排序 |
| 分類管理 | 「＋ 新增分類」直接開新分類；每個分類都有 ▲▼ 排序 |
| 隱藏 / 顯示 | 隱藏咗 app 公開版面唔見；「全部 App 總覽」版面會帶 🔒 標記 |
| 👀 全部 App 總覽 | 同公開版面一樣嘅預覽，方便你檢查「公眾見到咩」 |
| 點擊統計 | 每個 app 被打開嘅次數（管理版面 list 見到） |
| 金手指改密碼（隱藏） | 登入後**連點 Logo 20 次**先至開啟改密碼 — 冇任何按鈕或提示，其他有密碼嘅人唔會知呢個功能存在 |
| 📤 備份 JSON | 一鍵下載成個清單做 backup |
| 🔳 QR code | 生成展示櫃 URL 嘅 QR 圖，貼公告版俾隊員掃碼「加入主畫面」 |

> 入口係隱藏嘅：冇人知道 `#admin` 就睇唔到管理面板；
> Supabase 模式仲要登入先入到去。

## Admin 帳號同密碼

- **帳號（email）可以用假嘅**。Supabase Auth 用 email 做帳號 ID，但唔會真係發送任何
  email（建用戶時勾「自動確認」）。例如用 `admin@troop` 做帳號就係。
- **共用帳號**：所有需要用嘅人（你、副隊長…）都用同一個帳號。
  配置咗 `store.js` 嘅 `adminEmail` 之後，登入頁會預填帳號，其他人只需要打密碼。
- **收回權限 = 改密碼**。改完只把新密碼俾你要俾嘅人；舊密碼即時失效
  （已經登入嘅 session 約 1 小時內自動到期）。
- **改密碼嘅方法（金手指，隱藏）**：
  1. **連點 Logo 20 次**（兩次之間隔超過 1 秒會重新計數）— 喺公開版面嘅左上角 Logo，
     或者管理面板入面嘅 Logo，登入咗先有效。成功就會彈出改密碼提示。
     呢個功能完全冇按鈕冇提示，知道嘅人先至用得到。
  2. 或者 Supabase Dashboard → Authentication → Users → 你嘅帳號 → 重置
- 密碼**唔喺你嘅靜態代碼入面**，佢放喺 Supabase 嘅用戶資料庫，
  所以改密碼同網站部署完全無關。

## Admin 設置（Supabase，免費）

未配置時入 `#admin` 係 **demo 模式**：改動只存喺你自己瀏覽器。
想真正生效（所有人即時見到），照下列步驟：

1. 去 [supabase.com](https://supabase.com) 建免費項目
2. **加你自己嘅帳號**：Dashboard → Authentication → Users → Add user
   - Email 可以填假嘅（例如 `admin@troop`），勾「**Auto-confirm user**」（唔會真發 email）
   - 設好密碼 — 呢個就係管理面板嘅登入密碼
3. **建 table**：Dashboard → SQL Editor → 貼以下 SQL → Run

   ```sql
   create table categories (
     name text primary key,
     icon text,
     sort_order int not null default 0
   );

   create table apps (
     id uuid primary key default gen_random_uuid(),
     name text not null,
     url text not null,
     description text,
     icon text,
     github text,
     note text,
     category text not null default '其他',
     visible boolean not null default true,
     clicks int not null default 0,
     sort_order int not null default 0,
     created_at timestamptz not null default now()
   );

   alter table categories enable row level security;
   alter table apps enable row level security;

   -- 任何人都可以讀
   create policy "public read apps" on apps for select using (true);
   create policy "public read categories" on categories for select using (true);

   -- 只有登入咗嘅用戶（你）可以增刪改
   create policy "admin insert apps" on apps for insert to authenticated with check (true);
   create policy "admin update apps" on apps for update to authenticated using (true);
   create policy "admin delete apps" on apps for delete to authenticated using (true);
   create policy "admin insert categories" on categories for insert to authenticated with check (true);
   create policy "admin update categories" on categories for update to authenticated using (true);
   create policy "admin delete categories" on categories for delete to authenticated using (true);

   -- 公開頁面每次打開 app 會調用（只加數，無敏感操作）
   create or replace function bump_clicks(p_id uuid)
   returns void
   language sql
   security definer
   set search_path = public
   as $$
     update apps set clicks = clicks + 1 where id = p_id;
   $$;
   ```

   > 如果你之前已經建過舊版 table，改貼以下嘅就行（再補 `categories` table 同 `bump_clicks`）：
   >
   > ```sql
   > alter table apps add column description text;
   > alter table apps add column note text;
   > alter table apps add column visible boolean not null default true;
   > alter table apps add column clicks int not null default 0;
   > create table if not exists categories (
   >   name text primary key, icon text, sort_order int not null default 0
   > );
   > alter table categories enable row level security;
   > create policy "public read categories" on categories for select using (true);
   > create policy "admin insert categories" on categories for insert to authenticated with check (true);
   > create policy "admin update categories" on categories for update to authenticated using (true);
   > create policy "admin delete categories" on categories for delete to authenticated using (true);
   > ```

4. **填配置**：將項目資料填入 `store.js` 頂部嘅 `SUPABASE_CONFIG`：

   ```js
   const SUPABASE_CONFIG = {
     url: "https://xxxx.supabase.co",   // Project Settings → API → Project URL
     anonKey: "eyJhbGciOi...",          // anon public key
     adminEmail: "admin@troop"          // 第 2 步建用戶時用嘅 email（假嘅都得）
   };
   ```

5. Push → 自動部署。入 `#admin` 打密碼登入就得
6. （第一次）將 `apps.json` 入面嘅現有 app 用管理面板加埋去 DB，之後全部喺前端管理

安全說明：`anon key` 係公開嘅（設計上就係俾前端用），真正嘅保護來自
Row Level Security — 未登入嘅人只能讀，寫唔到。
`bump_clicks` 係 `security definer`（任何人可調用），但它只能加點擊數，
冇其他副作用。

## 單一登入（SSO）路線圖 — 之後先至需要

而家個展示櫃公眾免登入，SSO 只係之後想**童軍 app 之間登入一次全通行**先至要搞。
`vercel.app` 喺 Public Suffix List 入面，各 `xxx.vercel.app` 之間 browser 唔會共享
cookie，所以要有以下其中一個方法：

### 方案 A：自訂域名 + 子域 SSO（推薦）

1. 買域名（例如 `yourtroop.org.hk`），DNS 指去 Vercel，加 wildcard `*.yourtroop.org.hk`
2. 每個 app 部署去自己子域（`tasks.yourtroop.org.hk`…）
3. session cookie 設 `Domain=.yourtroop.org.hk` → 所有子域共享
4. 認證：
   - **Vercel Authentication**（app 係 Next.js 時最省力，Vercel 內建）
   - **Supabase Auth**（免費，任何 framework 都得 — 同展示櫃 admin 用同一個項目就得）
5. 新 app 只要部署去新子域，自動享有 SSO，零額外代碼

### 方案 B：JWT 交棒（保持 vercel.app 都可行）

1. 展示櫃（或獨立 login 頁）做登入入口
2. 撳 app 時簽發短命 signed JWT，經 URL 交棒俾目標 app
3. 每個 app 加一段 middleware 驗證 JWT
4. **所有 app 共享同一個 env var：`JWT_SECRET`**（簽名 key）

### 童軍情境提示

如果使用者係隊員（未必有 email / Google 帳號），可以唔使外部供應商：
Supabase 放一張 `scouts` table（編號 + PIN hash），展示櫃做「隊員編號 + PIN」
登入頁，登入後發 JWT 交棒俾各 app。簡便、小朋友用得順手。
