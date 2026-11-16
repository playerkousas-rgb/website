-- 2026-11-16：apps 表 slug 種子名單（配合 20261116-app-slug.sql）
-- 目的：一次過幫「已知嘅子 App 網域」填好穩定代號，唔使人手喺後台逐隻打。
--
-- 呢張表係由 playerkousas-rgb 名下 repo 嘅 Vercel 網域整理出嚟（67 條），
-- 另外手動加咗 Gemini 輔助工具（private repo GEMINI → gemini-woad-sigma.vercel.app）。
--
-- 設計上「認網域、唔認名字」：
--   · 只會 update 現有 apps 列，靠 url 的 host 完全相等去配對；
--   · 只會填 slug is null 嘅列（你後台改過嘅一律唔會被覆蓋）；
--   · apps 表冇嗰條網域 → 呢條 values 列完全冇作用（no-op），安全；
--   · 一條都唔會改 apps.url。
-- 重複執行安全。

begin;

with seed(host, slug) as (values
  ('aircraft-encyclopedia-web.vercel.app'  , 'aircraft-encyclopedia'),
  ('avian-dex.vercel.app'                  , 'aviandex'),
  ('ayp-eight.vercel.app'                  , 'ayp'),
  ('birddex3.vercel.app'                   , 'birddex3'),
  ('bp-nine-beryl.vercel.app'              , 'bp'),
  ('cardmaster-pi.vercel.app'              , 'cardmaster'),
  ('cert-tan.vercel.app'                   , 'cert'),
  ('code-zeta-beryl.vercel.app'            , 'code'),
  ('course-six-coral.vercel.app'           , 'course'),
  ('cubsbadge.vercel.app'                  , 'cubsbadge'),
  ('cubsbook.vercel.app'                   , 'cubsbook'),
  ('cubsgame.vercel.app'                   , 'cubsgame'),
  ('cubsmeeting.vercel.app'                , 'cubsmeeting'),
  ('dbs-teal-iota.vercel.app'              , 'dbs'),
  ('districtbadgesystem30.vercel.app'      , 'dbs3-0'),
  ('decode-sandy-eight.vercel.app'         , 'decode'),
  ('dga-five.vercel.app'                   , 'dga'),
  ('doll-ivory.vercel.app'                 , 'doll'),
  ('drawtheroute-yd8p.vercel.app'          , 'drawtheroute'),
  ('event-zeta-sage.vercel.app'            , 'event'),
  ('forward-black.vercel.app'              , 'forward'),
  ('game-blond-nu.vercel.app'              , 'game'),
  ('gemini-woad-sigma.vercel.app'          , 'gemini'),
  ('ghmeeting.vercel.app'                  , 'ghmeeting'),
  ('hkcamping.vercel.app'                  , 'hkcamping'),
  ('hkmap.vercel.app'                      , 'hkmap'),
  ('hm20c.vercel.app'                      , 'hm20c'),
  ('icon-maker-tau.vercel.app'             , 'icon-maker'),
  ('knotmaster.vercel.app'                 , 'knotmaster'),
  ('map3d-chi.vercel.app'                  , 'map3d'),
  ('mc-script.vercel.app'                  , 'mcscript'),
  ('member-portal-sigma-swart.vercel.app'  , 'member-portal'),
  ('minigame-one-red.vercel.app'           , 'minigame'),
  ('mirror-ten-sand.vercel.app'            , 'mirror'),
  ('morse-beacon-app.vercel.app'           , 'morse-beacon-app'),
  ('orienteering-tan.vercel.app'           , 'orienteering'),
  ('photo-edit-vert.vercel.app'            , 'photo-edit'),
  ('photo-prep-eight.vercel.app'           , 'photo-prep'),
  ('pioneer-ecru.vercel.app'               , 'pioneer'),
  ('router-gold.vercel.app'                , 'router'),
  ('roverbadge.vercel.app'                 , 'roverbadge'),
  ('roverbook.vercel.app'                  , 'roverbook'),
  ('scout-circulars.vercel.app'            , 'scout-circulars'),
  ('scout-district-portal.vercel.app'      , 'scout-district-portal'),
  ('scout3d-gamma.vercel.app'              , 'scout3d'),
  ('scoutapp-vico.vercel.app'              , 'scoutapp'),
  ('scoutbadge.vercel.app'                 , 'scoutbadge'),
  ('scoutbook-five.vercel.app'             , 'scoutbook'),
  ('scoutdesign.vercel.app'                , 'scoutdesign'),
  ('scoutmeeting.vercel.app'               , 'scoutmeeting'),
  ('scoutworld.vercel.app'                 , 'scoutworld'),
  ('skw-birdex2.vercel.app'                , 'skw-birdex2'),
  ('skw-radar-hunt2.vercel.app'            , 'skw-radar-hunt2'),
  ('skw-score.vercel.app'                  , 'skw-score'),
  ('skw-tracking-signs-8r55.vercel.app'    , 'skw-tracking-signs'),
  ('troop-attendance.vercel.app'           , 'troop-attendance'),
  ('troop-camera.vercel.app'               , 'troop-camera'),
  ('troop-portal.vercel.app'               , 'troop-portal'),
  ('troop-router.vercel.app'               , 'troop-router'),
  ('upgrade-ashen.vercel.app'              , 'upgrade'),
  ('veritas-delta-seven.vercel.app'        , 'veritas'),
  ('voice-slide-web.vercel.app'            , 'voice-slide-web'),
  ('vs-portal-pi.vercel.app'               , 'vs-portal'),
  ('vsbadge.vercel.app'                    , 'vsbadge'),
  ('vsbook-sand.vercel.app'                , 'vsbook'),
  ('vsmeeting.vercel.app'                  , 'vsmeeting'),
  ('zentangle-pattern-generator.vercel.app', 'zentangle-pattern-generator')
)
update public.apps a
set slug = s.slug
from seed s
where a.slug is null
  and regexp_replace(
        lower(split_part(regexp_replace(btrim(a.url), '^[a-z]+://', '', 'i'), '/', 1)),
        '^www\.', ''
      ) = s.host;

commit;

-- 跑完睇吓仲有邊幾隻未填（通常係外部網站／自訂網域，或者新上架未填）
-- select id, name, url from public.apps where slug is null order by created_at desc;
--
-- 亦可以檢查有冇 slug 撞（正常應該 0 行，撞會喺 unique index 就 fail）
-- select slug, count(*) from public.apps where slug is not null group by slug having count(*) > 1;
