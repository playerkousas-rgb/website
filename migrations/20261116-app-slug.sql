-- 2026-11-16：apps 表加 `slug`（APP STORE 深層連結用）
-- 目的：令每隻 App 有一條穩定、細楷 ASCII 嘅代號，可以砌出
--       https://scoutappstore.vercel.app/?app=<slug>
--       —— 分享／QR／複製 全部指返 APP STORE，而唔再派子站網址。
--
-- 規則（同 docs/50 SG9 / SG9-a 一致）：
--   · 只准 a-z 0-9 - ；2–40 字；唔准中文、唔准大細楷混用（避免 QR／WhatsApp 大小寫走樣）
--   · unique（但要容許 null —— 未填就前端 fallback 用 apps.id）
--   · 由後台編輯，唔會自動跟 name 改（name 改咗，分享出去嘅連結唔會死）
--
-- ⚠️ 本檔只改結構，唔會改任何 app 嘅 `url`。
-- ⚠️ 種子名單（邊隻 App 叫邊個 slug）喺另一檔：20261116-app-slug-seed.sql
-- 重複執行安全（if not exists / drop constraint if exists）。

begin;

-- 1) 欄位
alter table public.apps add column if not exists slug text;

-- 2) 格式約束：細楷 ASCII，2–40 字，唔可以開頭／結尾係 -
alter table public.apps drop constraint if exists apps_slug_fmt;
alter table public.apps add constraint apps_slug_fmt check (
  slug is null or slug ~ '^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$'
);

-- 3) 唯一（只喺有值時生效；多個 null 唔會撞）
create unique index if not exists apps_slug_key on public.apps (slug) where slug is not null;

comment on column public.apps.slug is
  'APP STORE 深層連結代號（/?app=<slug>）；細楷 ASCII，留空則前端 fallback 用 id。由後台編輯。';

commit;

-- 4) 檢查（跑完可以睇吓現況）
-- select count(*) filter (where slug is null) as 未填, count(*) filter (where slug is not null) as 已填
--   from public.apps;
-- select id, name, url from public.apps where slug is null order by created_at desc;
