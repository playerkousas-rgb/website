-- ❤️ 最受歡迎（讚好）—— Run AFTER 20260924-market.sql。Does not delete catalogue data.
-- 公開版每個項目星星下方多咗粒心；「排行榜」新增「❤️ 最受歡迎」按呢個心數排名。
-- 未跑呢個 migration 嘅話：前端寫 hearts 欄會自動甩走再存（OPTIONAL_APP_COLS），
-- bump_hearts RPC 會靜靜失敗（fire-and-forget），網站照常運作，只係冇全站心數。
begin;
alter table public.apps add column if not exists hearts int not null default 0;
create or replace function public.bump_hearts(p_id uuid, p_delta int default 1)
returns void
language sql
security definer
set search_path = public
as $$
  update apps set hearts = greatest(0, hearts + p_delta) where id = p_id;
$$;
commit;
