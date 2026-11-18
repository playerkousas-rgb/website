-- 2026-11-18：A 組落閘前，補齊 docs/51 §1.1 冇 slug 嘅 5 隻（4 隻按 host 精確配對 ＋ card 按 host 形狀）
-- ════════════════════════════════════════════════════════════════
-- 目標 5 隻（docs/51 §1.1）：
--   scoutdesign.vercel.app          → scoutdesign        （seed 已有，第 49 行）
--   skw-radar-hunt2.vercel.app      → skw-radar-hunt2    （seed 已有，第 53 行）
--   skw-score.vercel.app            → skw-score          （seed 已有，第 54 行）
--   veritas-delta-seven.vercel.app  → veritas            （seed 已有，第 61 行）
--   card（正式 production host 未確認，見下）             → card
--
-- 背景（實查 2026-11-18）：
--   · 前 4 隻 seed 本身已經包含 → 正常跑一次 20261116-app-slug-seed.sql 就會填。
--     若仍然係 slug IS NULL，最可能原因：
--       ① apps.url 帶 query／fragment（seed 冇清 ?...#...，配對唔到）—— 本檔已清洗；
--       ② 同一 host 喺 apps 表有多過一列（unique_host 只理單一列，多列自動跳過）；
--       ③ 目標 slug 已被其他列佔用（not exists 保護，靜靜跳過）；
--       ④ url 根本唔係 seed 嗰個 host（例如存咗別名）→ fill 唔到，睇尾段「診斷」。
--   · card 特別處理，原因見下面「§②」。
--
-- ✅ **本檔係「可選」** —— 你可以完全唔跑：slug 只係 apps 表一條普通欄位，
--    喺 APP STORE 後台逐個 App「編輯」→「深層連結代號（slug，可選）」填就得，
--    保存會即刻經 Supabase 寫入 apps.slug（admin.js L563 個輸入框、L177 格式檢查、
--    L212 撞 unique 會提示）。本檔只係「想一次過批量填」時嘅捷徑。
--
-- ⚠️ 本檔只會 UPDATE `slug`：
--     唔會改 url／visible／featured／clicks／stars／hearts，唔會掂 RLS，唔會刪任何列。
-- ⚠️ 填 slug **唔會**令 ?app=<slug> 即刻開得到 —— 前端 findAppByDeepKey() 會跳過
--     `visible = false` 嘅 App（app.js L100）。要 ?app= 開得到，該列一定要 visible = true。
-- ⚠️ 重複執行安全（slug is null ＋ not exists 兩重保護）。
-- ════════════════════════════════════════════════════════════════
--
-- §① 4 隻：按「正式 Vercel host」完全相等配對（唔靠 repo 名猜）
-- ────────────────────────────────────────────────────────────────

begin;

with seed(host, slug) as (values
  ('scoutdesign.vercel.app',         'scoutdesign'),
  ('skw-radar-hunt2.vercel.app',     'skw-radar-hunt2'),
  ('skw-score.vercel.app',           'skw-score'),
  ('veritas-delta-seven.vercel.app', 'veritas')
),
norm as (
  -- host 清洗：去 scheme → 去 path → 去 query → 去 fragment → 去 www. → 細楷
  select id,
         regexp_replace(
           lower(
             split_part(
               split_part(
                 split_part(
                   regexp_replace(btrim(url), '^[a-z]+://', '', 'i'),
                   '/', 1),
                 '?', 1),
               '#', 1)),
           '^www\.', '') as host
  from public.apps
),
unique_host as (
  -- 同一 host 有多過一列 → 全部跳過（同原 seed 語意；唔幫你夾硬揀）
  select host, (array_agg(id))[1] as id
  from norm
  group by host
  having count(*) = 1
)
update public.apps a
set slug = s.slug
from seed s
join unique_host u on u.host = s.host
where a.id = u.id
  and a.slug is null                                        -- 已填（或後台改過）一律唔郁
  and not exists (select 1 from public.apps x where x.slug = s.slug);  -- 撞 unique 就跳過

-- ════════════════════════════════════════════════════════════════
-- §② card：正式 production host 未確認，所以用「host 形狀」而唔用猜出嚟嘅網域
-- ────────────────────────────────────────────────────────────────
-- 實查（2026-11-18）：
--   · repo `card` 嘅 GitHub homepage ＝
--       https://card-git-arena-01a0f5ad-card-playerkousas-rgbs-projects.vercel.app/
--     —— 即 git branch 預覽網址（90 個 repo 之中**唯一**一隻係咁）。
--   · 該預覽網址同 `card-playerkousas-rgbs-projects.vercel.app` 現時對匿名
--     瀏覽者回「Log in to Vercel / Protected Deployment」，即連匿名都入唔到。
--   · 所以 card **冇已證實嘅穩定 production 網域**；本檔唔會寫死任何猜出嚟嘅 host。
--
-- 呢段嘅做法：只認「host 係 card.vercel.app 或者 card-*.vercel.app」嘅唯一一列，
-- 填 slug = 'card'。好處：
--   ① 唔使等 production 網域先有可讀 slug（今日 ?app=card 就用得）；
--   ② 唔會靠名字配對，仍然係「認網域」；
--   ③ 唯一性檢查：多過一列符合就整段跳過，唔會亂揀。
-- 限制（要記住）：
--   · 填 slug ≠ 修好 apps.url。apps.url 一日仍係 branch 預覽網址，
--     詳情卡撳「開啟」就會去一個會失效／已被保護嘅網址。
--   · 所以：card 未換到穩定 production 網域之前，**唔好**為佢落白名單（docs/51 §1.1）。
--     有 production 網域之後：改 apps.url → 再跑一次本檔（idempotent，唔會覆蓋已填嘅 slug）。
-- ────────────────────────────────────────────────────────────────

with norm as (
  select id,
         regexp_replace(
           lower(
             split_part(
               split_part(
                 split_part(
                   regexp_replace(btrim(url), '^[a-z]+://', '', 'i'),
                   '/', 1),
                 '?', 1),
               '#', 1)),
           '^www\.', '') as host
  from public.apps
),
cand as (
  select id, host
  from norm
  where host = 'card.vercel.app'
     or host ~ '^card-[a-z0-9-]{1,60}\.vercel\.app$'   -- 包括 card-git-… 預覽同 card-<team> 別名
),
single_row as (
  select id from cand
  where (select count(*) from cand) = 1                  -- 多過一列 → 唔估，留待人手
)
update public.apps a
set slug = 'card'
where a.id in (select id from single_row)
  and a.slug is null
  and not exists (select 1 from public.apps x where x.slug = 'card');

commit;

-- ════════════════════════════════════════════════════════════════
-- 驗收／診斷（跑完逐個睇；任何一條唔對路就停低問，唔好夾硬）
-- ════════════════════════════════════════════════════════════════
-- 1) 5 隻實況（slug 有冇填到？url 係咪預期 host？visible 係唔使 true 先開得到 ?app=）：
-- select id, name, url, slug, visible from public.apps
--   where url ilike '%scoutdesign%'
--      or url ilike '%radar-hunt2%'
--      or url ilike '%skw-score%'
--      or url ilike '%veritas%'
--      or url ilike '%card%'
--   order by url;
--
-- 2) 成個 A 組 35 隻仲有邊隻 slug IS NULL（docs/51 §1.1 對照）：
-- select slug, name, url, visible from public.apps
--   where slug is null
--     and (url ilike '%aircraft-encyclopedia-web%' or url ilike '%ayp-eight%'
--       or url ilike '%bp-nine-beryl%'        or url ilike '%card%'
--       or url ilike '%course-six-coral%'     or url ilike '%cubsgame%'
--       or url ilike '%cubsmeeting%'          or url ilike '%dbs-teal-iota%'
--       or url ilike '%doll-ivory%'           or url ilike '%drawtheroute-yd8p%'
--       or url ilike '%forward-black%'        or url ilike '%game-blond-nu%'
--       or url ilike '%ghmeeting%'            or url ilike '%hkcamping%'
--       or url ilike '%hkmap%'                or url ilike '%icon-maker-tau%'
--       or url ilike '%knotmaster%'           or url ilike '%map3d-chi%'
--       or url ilike '%mc-script%'            or url ilike '%minigame-one-red%'
--       or url ilike '%mirror-ten-sand%'      or url ilike '%photo-edit-vert%'
--       or url ilike '%photo-prep-eight%'     or url ilike '%pioneer-ecru%'
--       or url ilike '%router-gold%'          or url ilike '%scoutdesign%'
--       or url ilike '%scoutmeeting%'         or url ilike '%skw-radar-hunt2%'
--       or url ilike '%skw-score%'            or url ilike '%skw-tracking-signs%'
--       or url ilike '%troop-router%'         or url ilike '%upgrade-ashen%'
--       or url ilike '%veritas-delta-seven%'  or url ilike '%voice-slide-web%'
--       or url ilike '%vsmeeting%')
--   order by name;
--
-- 3) 全表有冇 branch 預覽／preview 網址（**落閘前必須 0 行**；有行就係白名單會認錯 origin）：
-- select id, name, url, slug, visible from public.apps
--   where url ~* '(-git-|--preview|\bpreview\b|\.vercel\.app/preview)'
--   order by name;
--
-- 4) 同一 host 多過一列（解釋點解 unique_host 跳過）：
-- select regexp_replace(lower(split_part(regexp_replace(btrim(url), '^[a-z]+://', '', 'i'), '/', 1)), '^www\.', '') as host,
--        count(*), array_agg(id) as ids
--   from public.apps group by 1 having count(*) > 1;
--
-- 5) slug 撞咗（正常 0 行；有行代表 not exists 條件擋咗）：
-- select slug, count(*) from public.apps where slug is not null group by slug having count(*) > 1;
--
-- 6) ?app= 開得到嘅前提：visible = true（前端 findAppByDeepKey 會跳過 visible=false）
-- select count(*) filter (where slug is null) as 未填,
--        count(*) filter (where slug is not null) as 已填,
--        count(*) filter (where visible is false) as 隱藏
--   from public.apps;
