-- 2026-11-18：apps 表「自動 slug」— INSERT 時 slug 留空 → 由 url host 第一段自動生成
-- ════════════════════════════════════════════════════════════════
-- 目的：
--   · 之後新上架嘅 App 唔使人手填 slug——slug 欄留空，trigger 即刻補好。
--   · 已有 slug／後台改過嘅一律唔郁（先檢查 `new.slug`，唔會覆寫人手資料）。
--   · 撞咗同名 slug → 自動加 `-2`／`-3`…（-40 字以內，符合 apps_slug_fmt）。
--   · 舊 row 一律唔會自己變（只掛 BEFORE INSERT；現有未填嘅請跑
--     20261118-app-slug-a-group-missing.sql 或者手動 backfill）。
--
-- 規則（同 20261116-app-slug.sql CHECK 一致）：
--   · slug 只由細楷 a-z／0-9／- 砌成（host 第一段去 www、去 scheme、
--     去 query／fragment／path，非 a-z0-9 字元換成 `-`，連續 `-` 併一，
--     開頭／結尾 `-` 剪走）；唔夠 2 字就叫 `app`；基底最長 36 字，
--     留位畀 `-2`／`-3` 尾碼（slug CHECK 最多 40 字）。
--   · 生成嘅 slug 一定通過 ^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$。
--
-- ⚠️ 已知取捨（用戶定案：揀方案 A 全自動）：
--   · 你喺後台睇唔到「佢會點叫」——撞名自動 -2，唔會通知。
--   · host 係 git branch 預覽網址（例如 card-git-arena-…vercel.app）→
--     生成嘅 slug 會又長又醜（雖然合法）。預覽 url 本身就唔該上架；
--     真係唔順眼，入後台改返手填 slug 就得。
--   · 高並發下兩個 INSERT 搶同一 slug：while loop 檢查 + apps_slug_key
--     unique index 做最後防線——撞到嘅 transaction 會 error，重試即可。
--   · function 用 security definer + search_path = public：
--     匿名／非 admin 角色 INSERT 時，內部 uniqueness 查詢照數到
--     visible=false 嘅隱藏 row（避免生成同隱藏 row 撞名嘅 slug）。
--
-- 重複執行安全（create or replace / drop trigger if exists）。
-- 本檔唔會改任何現有 row 嘅 slug；只會喺之後嘅 INSERT 生效。

begin;

-- 1) 函數：生成 + 處理碰撞
create or replace function public.apps_auto_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base      text;
  candidate text;
  n         integer := 1;
begin
  -- 有填（或後台已改）→ 原封不動（格式由 apps_slug_fmt CHECK 把關）
  if new.slug is not null and btrim(new.slug) <> '' then
    return new;
  end if;

  -- 取 url 嘅 host：去 scheme → 去 path → 去 query → 去 fragment
  base := lower(split_part(split_part(split_part(
            regexp_replace(btrim(coalesce(new.url, '')), '^[a-z]+://', '', 'i'),
            '/', 1), '?', 1), '#', 1));
  -- 去 www.
  base := regexp_replace(base, '^www\.', '');
  -- 取第一段（subdomain）：cubsmonster.vercel.app → cubsmonster
  base := split_part(base, '.', 1);
  -- 只留細楷 ASCII a-z 0-9：其餘字元串併做一個 `-`
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := regexp_replace(base, '-{2,}', '-', 'g');
  base := trim(both '-' from base);
  -- 太短或乜都留唔低 → `app`
  if base is null or length(base) < 2 then
    base := 'app';
  end if;
  -- 留位畀 -2/-3 尾碼（slug CHECK 上限 40）
  base := left(base, 36);
  base := trim(both '-' from base);
  if base = '' then
    base := 'app';
  end if;

  -- 撞名就 -2、-3…（x.id is distinct from new.id：update-of-same-row 安全）
  candidate := base;
  while exists (
    select 1 from public.apps x
    where x.slug = candidate and x.id is distinct from new.id
  ) loop
    n := n + 1;
    candidate := left(base, 40 - length('-' || n)) || '-' || n;
  end loop;

  new.slug := candidate;
  return new;
end;
$$;

-- 2) trigger：只喺 INSERT 生效（舊 row 唔會自己變）
drop trigger if exists apps_auto_slug_trg on public.apps;
create trigger apps_auto_slug_trg
  before insert on public.apps
  for each row
  execute function public.apps_auto_slug();

commit;

-- ════════════════════════════════════════════════════════════════
-- 驗收（可選，跑完逐個睇；任何一條唔對路就停低問）
-- ════════════════════════════════════════════════════════════════
-- 1) 函數＋trigger 裝咗未：
-- select proname from pg_proc where proname = 'apps_auto_slug';
-- select tgname from pg_trigger where tgname = 'apps_auto_slug_trg';
--
-- 2) 乾跑試（整個包喺 transaction 入面，rollback 唔會留低資料）：
-- begin;
-- insert into public.apps (name, url) values ('__slug_probe__', 'https://cubsmonster.vercel.app')
--   returning id, slug;          -- 期望見到 slug = cubsmonster（撞咗就 cubsmonster-2）
-- rollback;
--
-- 3) 手填不受影響：
-- begin;
-- insert into public.apps (name, url, slug) values ('__slug_probe2__', 'https://whatever.example.com', 'my-custom')
--   returning id, slug;          -- 期望 my-custom（唔會被 trigger 改）
-- rollback;
--
-- 4) 撞名自動加尾：
-- begin;
-- insert into public.apps (name, url) values ('__slug_probe3__', 'https://cubsmonster.vercel.app') returning slug;
-- insert into public.apps (name, url) values ('__slug_probe4__', 'https://cubsmonster.vercel.app') returning slug;  -- 期望 cubsmonster-2
-- rollback;
