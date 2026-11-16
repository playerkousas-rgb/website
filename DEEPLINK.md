# 深層連結（`/?app=<slug>`）—— 方向、定位、交接

> 一句話：**APP STORE 係唯一派發點。** 分享／複製／QR／卡片 href 一律派
> `https://scoutappstore.vercel.app/?app=<slug>`，唔再派子站網址；
> 真正「入子站」只有 `openApp()` 同詳情 sheet 嘅「開啟」掣。

---

## 1. 為咗解決咩

子站將來會開「準入白名單」（只認指定入口）。一旦開閘：

- ❌ WhatsApp／舊 QR／書籤一條子站直連 → 收 link 嘅人撞白名單卡
- ✅ 派 `?app=<slug>` → 落 APP STORE 詳情 → 撳「開啟」入子站
  → 子站見到嘅 `Referer` 天然就係 APP STORE

所以次序係：**先改 APP STORE 嘅出口，之後先逐隻子站開閘。**
呢一步**唔會**令任何子站變白名單；`apps.url` 一個字都冇改。

---

## 2. 定位表（改動位置，2026-11-16）

### 資料層 `store.js`
| 位置 | 內容 |
|---|---|
| L694–703 | `isValidSlug()`／`normalizeSlug()`（細楷 a–z、0–9、-；2–40 字） |
| L714 | `rowsToApp()` 帶出 `slug`（DB 未加欄位都係 `null`，唔會炸） |
| L862 | `normalizeApp()` 用 `normalizeSlug()` |
| L895 | `appPayload()` 寫入 `slug` |
| L911 | `OPTIONAL_APP_COLS` 加 `"slug"`（未跑 migration 一樣儲存得到） |
| L913–925 | `writeAppRow()`：slug **撞 unique／格式錯**唔再當「欄位未存在」靜靜甩走，會拋返上後台 |

### 深層連結 `app.js`
| 位置 | 內容 |
|---|---|
| L69 | `STORE_ORIGIN`（唯一硬編碼網域） |
| L73 | `appSlug(app)` = `slug ‖ _id` |
| L79 | `appDeepLink(app)` —— **所有分享出口只用呢個** |
| L87 | `setSheetUrl(app)` —— 開詳情寫 `?app=`、閂詳情還原（`replaceState`） |
| L100 | `findAppByDeepKey(key)` —— 只掃 `enabled` 分頁 + `visible !== false` |
| L120 | `handleDeepLink()` —— 進站解析：切分頁／清篩選／開 sheet；對唔到 → 清 query + toast |
| L181 / L190 | `openAppSheet(idx)` → `openAppSheetByApp(app)`（今期主打同深層連結唔靠 REG 索引） |
| L245 / L262 | 開／閂 sheet 同步網址欄 |
| L299 | 卡片 `href` = `appDeepLink` |
| L359 | 排行榜 `href` = `appDeepLink`（按鈕字改「詳情」） |
| L781 | `main()` 喺 `render()` 之後叫 `handleDeepLink()` |
| L798 | 撳卡委派：中鍵／⌘／Ctrl／Shift 唔 `preventDefault`（新分頁跟 href） |
| L838 / L842 / L851 / L860 | 分享面板顯示、QR、複製、五個平台全部用 `appDeepLink` |
| L34–56 | `openApp()` **冇改**：仍然 `window.location.href = app.url`，冇 `noreferrer` |
| L206–216 | sheet「開啟」掣 **冇改**：同上 |

### 版面 `index.html`
| 位置 | 內容 |
|---|---|
| L2283–2287 | 「今期主打」大掣：改開詳情 sheet（`openAppSheetByApp`），唔再 `window.open(app.url)`；亦唔再自己 `trackClick` |
| L2321–2329 | `shareApp()`（Web Share／複製）用 `appDeepLink(app)` |

### 後台 `admin.js`
| 位置 | 內容 |
|---|---|
| L533–536 | 表單新增「深層連結代號（slug）」欄 + 說明 |
| L171–175 | 儲存前驗格式（唔合格式就 `alert`，唔會靜靜幫你改） |
| L195 | `adminSaveApp({ slug: slugRaw || null })` |

### 其他
- `sw.js` L46 `CACHE = scout-tools-v45`（+1 版，用戶即刻用新版）
- `test/deeplink.test.js`（新）＋ `package.json` test 鏈加咗佢
- `migrations/20261116-app-slug.sql`、`migrations/20261116-app-slug-seed.sql`

---

## 3. 契約（唔准破）

1. `https://scoutappstore.vercel.app/?app=<key>` → 直接開該 App 詳情 sheet，唔白屏、唔跳子站。
2. `key` = `apps.slug`（細楷 ASCII）；`slug` 空 → fallback `apps.id`。
3. 對唔到／`visible=false`／分頁關閉 → 静靜返首頁 + `showToast("搵唔到呢個 App")`。
4. 開詳情 → 網址欄 `replaceState` 寫 `?app=<slug>`；閂詳情 → 還原。
5. `?from=<portal>` 只作備註：**接受但完全忽略**（唔記、唔存、唔影響行為）。
6. `openApp()` 同 sheet「開啟」保留 `app.url`、保留真實 `Referer`，**唔准**加 `noreferrer`。
7. `manifest.webmanifest` `start_url`／`scope` = `/`，唔准改。
8. `bump_clicks`／`bump_stars`／`bump_hearts` 語意不變：一次「開啟」＝一次 click。
   （今期主打改開詳情之後唔再自己 `trackClick`，由 sheet「開啟」計，避免一撳變兩次。）

---

## 4. Supabase 接入後嘅次序（下一個對話照跑）

```sql
-- ① 結構（一定要行先）
--    migrations/20261116-app-slug.sql
-- ② 種子名單（68 條已知網域 → slug；apps 表冇嗰條就 no-op，唔會覆蓋你改過嘅）
--    migrations/20261116-app-slug-seed.sql
-- ③ 檢查
select count(*) filter (where slug is null) as 未填, count(*) filter (where slug is not null) as 已填 from public.apps;
select id, name, url from public.apps where slug is null order by created_at desc;
select slug, count(*) from public.apps where slug is not null group by slug having count(*) > 1;
```

**要特別核對（我未接 DB，未親眼睇過）：**

- [ ] `apps` 表現有幾多隻、邊幾隻唔喺 68 條種子名單（自訂網域／外部網站）
- [ ] 種子名單有冇「同一隻 App 兩條 url」（例如有斜線／冇斜線）→ 只會中一條，另一條要手動補
- [ ] `visible=false` 嘅項目係唔係都唔應該有 slug（有都無害，深層連結照樣開唔到）
- [ ] 後台「作品審核」批准新上架（`review_work`）唔會帶 slug → 新 App 用 `id` fallback，之後後台補
- [ ] 有冇 slug 同 `apps.id` 前綴撞（實務上唔會，但檢查 query 第二條會睇到 null 清單）

---

## 5. 驗收清單（6 項）

| # | 項目 | 自動化 | 真機 |
|:--:|---|---|---|
| 1 | 分享面板顯示／複製係 `?app=…` | ✅ `test/deeplink.test.js` | ⬜ 未做（未接 DB） |
| 2 | QR 編碼同一條 link、手機掃到詳情 | ✅ 編碼內容 | ⬜ 未做 |
| 3 | 無痕貼 `?app=<slug>` → 詳情 → 「開啟」入子站 | ✅ vm 跑過 | ⬜ 未做 |
| 4 | 亂打 `?app=not-exist` → 唔白屏、toast、停首頁 | ✅ vm 跑過 | ⬜ 未做 |
| 5 | 撳卡開 sheet、網址欄 `?app=`、新分頁唔跳走 | ✅ vm 跑過 | ⬜ 未做 |
| 6 | 已加入主畫面仍入首頁（`start_url` 冇改） | ✅ 測試鎖住 manifest | ⬜ 未做 |

> 本機 `npm run preview` 冇 App 資料（`apps.json` 係空殼、Supabase 未接），
> 所以真機嗰 6 項一定要喺 Supabase 接入後、用正式/預覽網址行。

---

## 6. 已知取捨（可隨時改返）

1. **排行榜按鈕字由「開啟」改「詳情」** —— 因為佢而家真係開詳情，唔再直跳子站。想保留「開啟」兩字就改 `app.js` L359。
2. **今期主打唔再即時計 click** —— 由 sheet「開啟」計。理由見契約 8。
3. **`?from=` 完全忽略** —— 想要統計就要另外定（會牽涉新表，唔喺呢步做）。
4. **`slug` 上架後唔好改** —— 改咗，之前派出去嘅 QR／連結就開唔到（後台已有提示）。
