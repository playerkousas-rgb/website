-- 2026-09-25：投稿加「聯絡電郵／聯絡電話」（選填），並寫進批准後嘅項目備註
-- 目的：管理員收到 Scout Admin 嗰封電郵＋Google Sheet 登記之後，可以直接回覆作者／轉交負責人。
-- 依賴 migrations/20260924-market.sql（submissions 表＋submit_work／review_work）。
-- 冚辦掂：可重複執行；冇跑呢個升級都唔影響投稿（多咗嘅 jsonb 鍵會被舊版函數忽略）。
begin;

-- 1) 兩欄新增（可空；RLS 之下 submissions 只限管理員讀，聯絡資料唔會公開）
alter table public.submissions add column if not exists contact text;
alter table public.submissions add column if not exists phone text;

-- 2) 格式守門（容許 NULL／空字串 = 冇填）；約束已存在就跳過
do $$ begin
  alter table public.submissions add constraint submissions_contact_shape
    check (contact is null or (char_length(contact) <= 160 and
           (btrim(contact) = '' or contact ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.submissions add constraint submissions_phone_shape
    check (phone is null or (char_length(phone) <= 40 and
           (btrim(phone) = '' or phone ~ '^[0-9+()., -]+$')));
exception when duplicate_object then null; end $$;

-- 3) submit_work：除咗原本欄位，多收 contact／phone（空白存做 NULL，唔好留「」）
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
 insert into submissions(name,url,description,author,page,category,tags,contact,phone)
 values(btrim(work->>'name'),btrim(work->>'url'),btrim(work->>'description'),btrim(work->>'author'),work->>'page',work->>'category',clean_tags,
        nullif(btrim(coalesce(work->>'contact','')), ''), nullif(btrim(coalesce(work->>'phone','')), '')) returning id into sid;
 return sid;
end $$;

-- 4) review_work：批准時連聯絡方式一齊寫入項目備註（內部欄，公開版唔會顯示）
create or replace function public.review_work(submission_id uuid, approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare s submissions; aid uuid; contact_line text := '';
begin
 if not public.is_store_admin() then raise exception '未獲授權'; end if;
 select * into s from submissions where id=submission_id for update;
 if not found or s.status <> 'pending' then raise exception '此投稿已處理或不存在'; end if;
 if approve then
   if not exists(select 1 from categories c join pages p on p.id=c.page where c.page=s.page and c.name=s.category and p.enabled) then raise exception '原分類已關閉或刪除，請先恢復分類'; end if;
   if nullif(btrim(coalesce(s.contact,'')),'') is not null then contact_line := contact_line || ' · 電郵：' || btrim(s.contact); end if;
   if nullif(btrim(coalesce(s.phone,'')),'') is not null then contact_line := contact_line || ' · 電話：' || btrim(s.phone); end if;
   insert into apps(name,url,description,note,page,category,tags,visible)
   values(s.name,s.url,s.description,'作者：' || s.author || contact_line,s.page,s.category,s.tags,true) returning id into aid;
 end if;
 update submissions set status=case when approve then 'approved' else 'rejected' end, reviewed_at=now(),app_id=aid where id=s.id;
end $$;

revoke all on function public.submit_work(jsonb) from public;
grant execute on function public.submit_work(jsonb) to anon, authenticated;
commit;
