-- 2026-11-18：A 組落閘前，補「seed 已含但 DB 仍未填」嘅 slug（只補 4 隻）
-- ════════════════════════════════════════════════════════════════
-- 背景（實查 2026-11-18，branch arena/c8258cb8-website）：
--   · 20261116-app-slug-seed.sql 本身**已經包含**以下 4 隻
--     （seed 第 66／70／71／78 行），slug 配對如下：
--       scoutdesign.vercel.app         → scoutdesign
--       skw-radar-hunt2.vercel.app     → skw-radar-hunt2
--       skw-score.vercel.app           → skw-score
--       veritas-delta-seven.vercel.app → veritas
--   · 所以正常情況下「重跑 seed」已經會填。
--   · 如果跑咗 seed 呢 4 隻仍然係 slug IS NULL，最可能嘅原因係：
--       ① apps.url 入面 host 之外仲有 query string（seed 冇清 ?...，配對唔到）—— 本檔已加強清洗；
--       ② 同一 host 喺 apps 表有多過一列（unique_host 只理單一列，兩列都自動跳過）；
--       ③ 目標 slug 已被其他列佔用（not exists 保護，靜靜跳過）；
--       ④ url 根本唔係 seed 嗰個 host（例如 veritas 存咗做別名）。
--     第 ④ 種：本檔一樣 fill 唔到 → 跑完之後必睇下面「診斷」三條 select。
--   · card：**本檔刻意唔補**。apps.url 現時指向 git branch 預覽網址
--     （card-git-arena-01a0f5ad-card-playerkousas-rgbs-projects.vercel.app），
--     預覽網址唔穩定：branch 一有新 push／merge，舊預覽網址會即刻失效，
--     到時 ?app=card 會開到一隻死 App。未有穩定 production 網域之前：
--       ① 唔好夾硬填 slug（唔填 = appDeepLink() fallback ?app=<id>，照樣用得）；
--       ② 唔好落白名單（docs/51 §1.1 5 隻未填之一）；
--       ③ 等 card 有穩定 production 網域 → 先改 apps.url → 再跑本檔底部 card 段。
-- ════════════════════════════════════════════════════════════════
-- 規則同 20261116-app-slug.sql CHECK 一致：^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$，2–40 字。
-- 本檔唔會改 url／visible／RLS／任何其他欄；只會 UPDATE slug；重複執行安全。

begin;

with seed(host, slug) as (values
  ('scoutdesign.vercel.app',        'scoutdesign'),
  ('skw-radar-hunt2.vercel.app',    'skw-radar-hunt2'),
  ('skw-score.vercel.app',          'skw-score'),
  ('veritas-delta-seven.vercel.app','veritas')
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

commit;

-- ════════════════════════════════════════════════════════════════
-- 診斷（跑完逐個睇；任何一條唔對路就停低問，唔好夾硬）
-- ════════════════════════════════════════════════════════════════
-- 1) 呢 5 隻現時嘅實況（slug 有冇填到、url 係咪預期嗰個 host）：
-- select id, name, url, slug from public.apps
--   where url ilike '%scoutdesign%'
--      or url ilike '%radar-hunt2%'
--      or url ilike '%skw-score%'
--      or url ilike '%veritas%'
--      or url ilike '%card%'
--   order by url;
--
-- 2) 同一 host 多過一列（解釋點解 unique_host 跳過）：
-- select regexp_replace(lower(split_part(regexp_replace(btrim(url), '^[a-z]+://', '', 'i'), '/', 1)), '^www\.', '') as host,
--        count(*), array_agg(id) as ids
--   from public.apps group by 1 having count(*) > 1;
--
-- 3) slug 撞咗（正常 0 行；有行代表 seed 嘅 not exists 條件擋咗）：
-- select slug, count(*) from public.apps where slug is not null group by slug having count(*) > 1;
--
-- 4) 仍然未填嘅（睇吓 A 組仲有邊隻）：
-- select id, name, url from public.apps where slug is null order by created_at desc;

-- ════════════════════════════════════════════════════════════════
-- card 段（**刻意註解停用**；只喺 card 有穩定 production 網域並且已改好 apps.url 之後先跑）
-- 步驟：① 確認 card 嘅 production host（例如 https://card.vercel.app — 未核實，唔好照打）
--       ② Supabase 後台把該列 apps.url 改成嗰個 host
--       ③ 解除下面註解，把 CARD_PRODUCTION_HOST 換成真正 host，再跑
-- ════════════════════════════════════════════════════════════════
-- begin;
-- with seed(host, slug) as (values
--   ('CARD_PRODUCTION_HOST', 'card')
-- ),
-- norm as (
--   select id,
--          regexp_replace(
--            lower(split_part(split_part(split_part(
--              regexp_replace(btrim(url), '^[a-z]+://', '', 'i'),
--              '/', 1), '?', 1), '#', 1)),
--            '^www\.', '') as host
--   from public.apps
-- ),
-- unique_host as (
--   select host, (array_agg(id))[1] as id from norm group by host having count(*) = 1
-- )
-- update public.apps a
-- set slug = s.slug
-- from seed s
-- join unique_host u on u.host = s.host
-- where a.id = u.id
--   and a.slug is null
--   and not exists (select 1 from public.apps x where x.slug = s.slug);
-- commit;
