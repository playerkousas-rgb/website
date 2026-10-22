-- 2026-10-22：新增「🌐 網站分享」及「📚 教材分享」預設分類與投稿審核放寬
-- 目的：降低用戶分享門檻，除咗「提交作品（Apps）」外，支援直接投稿「網站分享（links）」及「教材分享（cards / ppt）」，
--       即使該分頁尚未公開開放，用戶仍可率先投稿；管理員批准時自動建立分類並開放對應分頁。
-- 依賴 migrations/20260924-market.sql 及 migrations/20260925-submission-contact.sql。
begin;

-- 1) 確保四個預設分頁存在
insert into public.pages (id, label, icon, enabled, sort_order) values
  ('apps',  '小工具 Apps', '🧰', true,  0),
  ('cards', '學習圖卡',    '🃏', false, 1),
  ('ppt',   'PPT 簡報',    '📽️', false, 2),
  ('links', '有用連結',    '🔗', false, 3)
on conflict (id) do nothing;

-- 2) 為「網站分享（links）」及「教材分享（cards / ppt）」補齊預設分類
insert into public.categories (name, icon, page, sort_order) values
  ('童軍技能及知識',     '🪢', 'links', 0),
  ('露營及行山資訊',     '⛺', 'links', 1),
  ('集會及活動資源',     '🎯', 'links', 2),
  ('官方及總會網站',     '⚜️', 'links', 3),
  ('其他實用網站',       '🌐', 'links', 4),
  ('技能及專章圖卡',     '🃏', 'cards', 0),
  ('步操及禮儀圖卡',     '🎖️', 'cards', 1),
  ('工作紙及考驗筆記',   '📝', 'cards', 2),
  ('其他圖文教材',       '📚', 'cards', 3),
  ('集會教學簡報',       '📽️', 'ppt',   0),
  ('專章及訓練簡報',     '📊', 'ppt',   1),
  ('領袖訓練及行政範本', '📋', 'ppt',   2),
  ('教學影片及多媒體',   '🎬', 'ppt',   3)
on conflict (page, name) do nothing;

-- 3) submit_work：容許向任何已存在分頁（apps / cards / ppt / links）投稿
create or replace function public.submit_work(work jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid; clean_tags text[]; target_page text; target_cat text;
begin
 target_page := btrim(coalesce(work->>'page', ''));
 target_cat  := btrim(coalesce(work->>'category', ''));
 if target_page = '' or target_cat = '' or char_length(target_cat) > 60 then
   raise exception '請選擇開放中的分類';
 end if;
 if not exists (select 1 from pages p where p.id = target_page) then
   raise exception '請選擇開放中的分類';
 end if;
 select coalesce(array_agg(distinct btrim(value)), '{}') into clean_tags from jsonb_array_elements_text(coalesce(work->'tags','[]')) where btrim(value) <> '';
 if cardinality(clean_tags)>8 or exists(select 1 from unnest(clean_tags) t where char_length(t)>20) then raise exception '最多 8 個標籤，每個最多 20 字'; end if;
 perform pg_advisory_xact_lock(hashtextextended(btrim(work->>'url'), 0));
 if exists(select 1 from submissions where url=btrim(work->>'url') and status='pending') or exists(select 1 from apps where url=btrim(work->>'url')) then raise exception '此連結已上架或正在審核'; end if;
 insert into submissions(name,url,description,author,page,category,tags,contact,phone)
 values(btrim(work->>'name'),btrim(work->>'url'),btrim(work->>'description'),btrim(work->>'author'),target_page,target_cat,clean_tags,
        nullif(btrim(coalesce(work->>'contact','')), ''), nullif(btrim(coalesce(work->>'phone','')), '')) returning id into sid;
 return sid;
end $$;

-- 4) review_work：管理員批准上架時，若目標分類未建立或分頁未開放，自動補建分類並開放分頁
create or replace function public.review_work(submission_id uuid, approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare s submissions; aid uuid; contact_line text := '';
begin
 if not public.is_store_admin() then raise exception '未獲授權'; end if;
 select * into s from submissions where id=submission_id for update;
 if not found or s.status <> 'pending' then raise exception '此投稿已處理或不存在'; end if;
 if approve then
   if not exists(select 1 from pages p where p.id=s.page) then raise exception '原分類已關閉或刪除，請先恢復分類'; end if;
   update pages set enabled = true where id = s.page and enabled = false;
   insert into categories(name, icon, page, sort_order)
   values (s.category, '', s.page, 99)
   on conflict (page, name) do nothing;
   if nullif(btrim(coalesce(s.contact,'')),'') is not null then contact_line := contact_line || ' · 電郵：' || btrim(s.contact); end if;
   if nullif(btrim(coalesce(s.phone,'')),'') is not null then contact_line := contact_line || ' · 電話：' || btrim(s.phone); end if;
   insert into apps(name,url,description,note,page,category,tags,visible)
   values(s.name,s.url,s.description,'作者：' || s.author || contact_line,s.page,s.category,s.tags,true) returning id into aid;
 end if;
 update submissions set status=case when approve then 'approved' else 'rejected' end, reviewed_at=now(),app_id=aid where id=s.id;
end $$;

revoke all on function public.submit_work(jsonb) from public;
grant execute on function public.submit_work(jsonb) to anon, authenticated;
revoke all on function public.review_work(uuid,boolean) from public;
grant execute on function public.review_work(uuid,boolean) to authenticated;
commit;
