-- 2026-10-04：匿名入站統計（獨立訪客）
-- Run AFTER migrations/20260924-market.sql（需要 public.is_store_admin()）。
-- 只儲存瀏覽器自行產生的隨機 visitor_id + 日期，不儲存 IP、User-Agent、姓名或其他個人資料。
-- 每個 visitor_id 每日一行，因此統計係「獨立訪客／訪客日」，唔係精確真人數。
begin;

create table if not exists public.site_visits (
  visitor_id text not null check (visitor_id ~ '^[A-Za-z0-9_-]{16,128}$'),
  visit_date date not null,
  created_at timestamptz not null default now(),
  primary key (visitor_id, visit_date)
);

create index if not exists site_visits_date_idx on public.site_visits (visit_date);

alter table public.site_visits enable row level security;
drop policy if exists "admin read site visits" on public.site_visits;
create policy "admin read site visits" on public.site_visits
  for select to authenticated using (public.is_store_admin());

-- 公開頁只可以經過呢個受限 RPC 寫入；唔開放直接 insert，亦唔會回傳訪客 id。
create or replace function public.record_site_visit(p_visitor_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_id text := btrim(coalesce(p_visitor_id, ''));
  hk_today date := (now() at time zone 'Asia/Hong_Kong')::date;
begin
  -- 無效值直接忽略，避免公開 endpoint 被人塞入任意字串。
  if clean_id !~ '^[A-Za-z0-9_-]{16,128}$' then return; end if;
  insert into public.site_visits(visitor_id, visit_date)
  values (clean_id, hk_today)
  on conflict (visitor_id, visit_date) do nothing;
end;
$$;

-- 後台只取聚合結果，唔將 visitor_id 暴露到瀏覽器。
create or replace function public.get_site_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hk_today date := (now() at time zone 'Asia/Hong_Kong')::date;
begin
  if not public.is_store_admin() then raise exception '未獲授權'; end if;
  return jsonb_build_object(
    'totalVisitors', (select count(distinct visitor_id) from public.site_visits),
    'todayVisitors', (select count(*) from public.site_visits where visit_date = hk_today),
    'last7Visitors', (select count(distinct visitor_id) from public.site_visits where visit_date >= hk_today - 6),
    'last30Visitors', (select count(distinct visitor_id) from public.site_visits where visit_date >= hk_today - 29),
    'visitorDays', (select count(*) from public.site_visits),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('date', d.visit_date, 'visitors', d.visitors) order by d.visit_date)
      from (
        select days.visit_date::date as visit_date, count(s.visitor_id) as visitors
        from generate_series(hk_today - 29, hk_today, interval '1 day') as days(visit_date)
        left join public.site_visits s on s.visit_date = days.visit_date::date
        group by days.visit_date::date
      ) d
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.record_site_visit(text) from public;
grant execute on function public.record_site_visit(text) to anon, authenticated;
revoke all on function public.get_site_analytics() from public;
grant execute on function public.get_site_analytics() to authenticated;

commit;
