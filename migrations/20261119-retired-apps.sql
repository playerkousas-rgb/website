-- migrations/20261119-retired-apps.sql
-- 「已下架」名單（公開版專區 ＋ 舊 ?app= 連結嘅解釋頁）
--
-- 設計鐵律（2026-11-19 用戶指示）：
--   「已下架」嘅首要條件係**曾經上過架**，唔係單單 apps.visible = false。
--   所以名單由管理員喺後台逐個 SET（明確寫入呢張表），
--   **唔准**由 apps 嘅隱藏列自動推斷 —— 隱藏列好多係從未公開嘅內容。
--   listed_at 記低該項目上架時間做憑據；admin.js 喺標記前會要管理員確認。
--
-- 私隱：apps 嘅 RLS 仍然只放 visible = true（見 20260924-market.sql）。
--   呢張新表只放「代號／名／兩個日期」，唔放 url／description／內部備註，
--   所以隱藏列唔會因為呢個功能而曝光。
--
-- 前置：migrations/20260924-market.sql（要有 public.is_store_admin()）。
-- 執行：Supabase SQL Editor 貼上跑一次；冇跑嘅話公開版 loadRetired() 會
--       靜靜返 []（唔會白屏、唔會將隱藏項目當成已下架）。
-- 可重跑：create table if not exists／drop policy if exists／notify reload。

begin;

create table if not exists public.retired_apps (
  id         uuid primary key default gen_random_uuid(),
  app_id     uuid not null unique references public.apps(id) on delete cascade,
  deep_key   text not null unique,          -- 舊 ?app= 代號（slug；未填用 apps.id）
  name       text not null check (char_length(name) between 1 and 120),
  listed_at  timestamptz not null,          -- 曾經上架嘅憑據（必要條件）
  retired_at timestamptz not null default now(),
  check (char_length(deep_key) between 1 and 128)
);

alter table public.retired_apps enable row level security;

-- 匿名／已登入都讀到「已下架」名單（得呢幾欄，冇敏感資料）
drop policy if exists "public retired list" on public.retired_apps;
create policy "public retired list" on public.retired_apps
  for select to anon, authenticated using (true);

-- 寫入只限管理員（同一個 is_store_admin() 判斷，唔開新權限）
drop policy if exists "admin manage retired" on public.retired_apps;
create policy "admin manage retired" on public.retired_apps
  for all to authenticated
  using (public.is_store_admin()) with check (public.is_store_admin());

grant select on public.retired_apps to anon, authenticated;
grant insert, update, delete on public.retired_apps to authenticated;

-- PostgREST 即時見到新表（唔使等 schema cache 自動 refresh）
notify pgrst, 'reload schema';

commit;

-- ── 驗收（可選，另開一個 query 跑）────────────────────────────
-- select deep_key, name, listed_at, retired_at from public.retired_apps order by retired_at desc;
-- select count(*) as 隱藏但未標記 from public.apps where visible = false;
-- 上面兩條數字**唔應該**自動相等：隱藏 ≠ 已下架。
