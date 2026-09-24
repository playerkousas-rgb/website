-- Run AFTER the base schema in README. Does not delete catalogue data.
begin;
create or replace function public.is_store_admin() returns boolean
language sql stable security invoker set search_path = public
as $$ select coalesce(auth.jwt()->>'email' = 'ai@skwscout.org.hk', false) $$;

-- Replace legacy broad authenticated/anonymous write policies.
do $$ declare t text; p record; begin
  foreach t in array array['apps','categories','pages'] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('create policy "admin manage" on public.%I for all to authenticated using (public.is_store_admin()) with check (public.is_store_admin())', t);
    if t = 'apps' then
      execute 'create policy "public catalogue" on public.apps for select using (visible = true)';
    else
      execute format('create policy "public catalogue" on public.%I for select using (true)', t);
    end if;
  end loop;
end $$;

create table if not exists public.submissions (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(name) between 1 and 80),
 url text not null check (url ~ '^https?://[^[:space:]]+$' and char_length(url) <= 2048),
 description text not null check (char_length(description) between 1 and 1000),
 author text not null check (char_length(author) between 1 and 80),
 page text not null,
 category text not null,
 tags text[] not null default '{}',
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 app_id uuid references public.apps(id) on delete set null
);
alter table public.submissions enable row level security;
drop policy if exists "admin reviews" on public.submissions;
create policy "admin reviews" on public.submissions for select to authenticated using (public.is_store_admin());
-- No direct client insert/update: callers cannot supply status, counters or dates.
create or replace function public.submit_work(work jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid; clean_tags text[];
begin
 if not exists (select 1 from categories c join pages p on c.page=p.id where c.page=work->>'page' and c.name=work->>'category' and p.enabled) then
   raise exception '請選擇開放中的分類';
 end if;
 select coalesce(array_agg(distinct btrim(value)), '{}') into clean_tags from jsonb_array_elements_text(coalesce(work->'tags','[]')) where btrim(value) <> '';
 if cardinality(clean_tags)>8 or exists(select 1 from unnest(clean_tags) t where char_length(t)>20) then raise exception '最多 8 個標籤，每個最多 20 字'; end if;
 -- Serialize duplicate submissions, including simultaneous requests.
 perform pg_advisory_xact_lock(hashtextextended(btrim(work->>'url'), 0));
 if exists(select 1 from submissions where url=btrim(work->>'url') and status='pending') or exists(select 1 from apps where url=btrim(work->>'url')) then raise exception '此連結已上架或正在審核'; end if;
 insert into submissions(name,url,description,author,page,category,tags)
 values(btrim(work->>'name'),btrim(work->>'url'),btrim(work->>'description'),btrim(work->>'author'),work->>'page',work->>'category',clean_tags) returning id into sid;
 return sid;
end $$;
create or replace function public.review_work(submission_id uuid, approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare s submissions; aid uuid;
begin
 if not public.is_store_admin() then raise exception '未獲授權'; end if;
 select * into s from submissions where id=submission_id for update;
 if not found or s.status <> 'pending' then raise exception '此投稿已處理或不存在'; end if;
 if approve then
   if not exists(select 1 from categories c join pages p on p.id=c.page where c.page=s.page and c.name=s.category and p.enabled) then raise exception '原分類已關閉或刪除，請先恢復分類'; end if;
   insert into apps(name,url,description,note,page,category,tags,visible)
   values(s.name,s.url,s.description,'作者：' || s.author,s.page,s.category,s.tags,true) returning id into aid;
 end if;
 update submissions set status=case when approve then 'approved' else 'rejected' end, reviewed_at=now(),app_id=aid where id=s.id;
end $$;
revoke all on function public.submit_work(jsonb) from public;
grant execute on function public.submit_work(jsonb) to anon, authenticated;
revoke all on function public.review_work(uuid,boolean) from public;
grant execute on function public.review_work(uuid,boolean) to authenticated;
commit;
