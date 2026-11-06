# DESIGN — 本站設計語言（唯一真理）

> 用途：任何改 UI 之前先讀呢頁；新樣式只可以用下面嘅 token 同規則，唔准自己發明色／間距／圓角。
> 依據：`playerkousas-rgb/readme` 嘅 [`design-review`](https://github.com/playerkousas-rgb/readme/blob/main/templates/repo-starter/skills/promoted/design-review/SKILL.md)
> 19 條 house rules ＋ [docs/23 設計資源](https://github.com/playerkousas-rgb/readme/blob/main/docs/23-design-resources.md) 嘅「3／4／7 三步硬性要求」
> （有 design language、有 token、有齊 9 個圖標）。定案日期：2026-11-06。

## 1. 一句定位

> **一個分類展示櫃，唔係一個 dashboard。** 主角係每個 app 自己嘅圖標同名字；UI 只做安靜嘅畫框。

- 頁面感（唔係 app 屏幕）：大片留白、真圖標、少量文字。
- 唯一動作：撳個 app 入去。其餘（收藏／讚好／分享）一律做細。

## 2. 顏色（40 / 30 / 20 / 10）

| 份額 | 用途 | Token |
|---:|---|---|
| **40%** | 底 | `--bg`（深：`#0b0d12`｜淺：`#faf6ec`） |
| **30%** | 卡／面 | `--bg-card`、`--bg-elevated` |
| **20%** | 文字／邊框 | `--text`、`--muted`、`--border` |
| **10%** | **金**（唯一 accent） | `--accent`（深：`#e8c87a`｜淺：`#b3821a`） |

規矩：

1. **只准一隻 accent**。accent 出現喺「已選中」「主要動作」「今期主打」三類，每屏唔好超過 3 處。
2. 唔准再加第二隻彩色（曾經有藍 `#2563eb`、青 `#0d9488`、橙 `#d97706`，全部已清）。
3. 語意色只有三隻，全部只用喺狀態：`--danger`／`--ok`／`--warn`。
4. 金色要同 **9 個圖標**（暖黑底 + 金線徽章）一致：`#e8c87a` 係 icon 同 UI 共用嘅金。

## 3. 禁止清單（readme house rules，lint 第 9 條會攔）

| ✗ 唔准 | ✓ 改成 |
|---|---|
| 任何 `linear-gradient` / `radial-gradient` | 成片實色 + 邊框／留白分組 |
| 光暈、`filter: blur` 裝飾、`drop-shadow` 跟住鼠標 | 一個 elevation（`--shadow-sm`） |
| 英文 eyebrow（`MADE BY YOU` / `SETTINGS` / `REPORT / FEEDBACK`） | 直接用中文標題，層次靠字級 |
| 大寫 + `letter-spacing` 小 label | 正常句 |
| `01 02 03` 裝飾編號 | 真排名數字（`1 2 3`） |
| 每格唔同顏色嘅隨機 tile 底 | 真圖標 + 透明底 |
| 一排一樣嘅 icon card（同尺寸格） | 分類貨架（`shelf`）：橫滑大卡，每條貨架有自己的分類線稿圖標 |
| 假螢幕／假通知／假對話截圖 | 真資料（圖標、名稱、數字）；冇就唔顯示 |

## 4. 字階（6 級）

| Token | 尺寸 | 用喺 |
|---|---|---|
| `--fs-5` | 34px | 只用於 hero（預留） |
| `--fs-4` | 24px | 頁面主標題／hero 標題 |
| `--fs-3` | 17.5px | 區塊標題（`h2`） |
| `--fs-2` | 13.5px | tile 名、按鈕 |
| `--fs-1` | 12px | 輔助說明、計數 |
| — | 11px | 只限標籤（`.mini-tag`、badge） |

- 標題 **≤ 2 行**；孤字尾行唔准（`tile-name` 已用 `line-clamp: 2`）。
- 正文行長 ≤ 75 字符（`max-width` 由 `.wrap` 控制）。
- 字重只用三種：400／600–700／800–900。

## 5. 間距同圓角

- 間距 4 的倍數：`--space-1` 4 / `--space-2` 8 / `--space-3` 14 / `--space-4` 22。
- 圓角**只兩級**：卡片 `--radius` 16、控制項 `--radius-sm` 10；pill／chip 用 `999`。
- 區塊之間 22–24px，區塊內部 8–14px。
- 左右邊距相等（`.wrap` 用 `max(16px, env(safe-area-inset-*))`），手機唔會左右唔同。

## 6. 動效

- 只做「有原因」嘅動：`.tileIn`（進場 0.45s）、按下縮 0.88、hover 上移 2px。
- **冇**自動脈動、冇光束、冇閃星。
- `prefers-reduced-motion` 一律停。

## 7. 圖標配對（G11）

| 用途 | 檔案 |
|---|---|
| 分頁／書籤 | `favicon.ico`、`favicon-16.png`、`favicon-32.png` |
| iOS 主畫面 | `apple-touch-icon.png`（180，滿版無白邊） |
| PWA | `icon-192.png`、`icon-512.png`、`icon-maskable-192/512.png` |
| 分享預覽 | `og-image.png`（1200×630，實色底，金＋暖灰字） |

全部由 `bash scripts/make-icons.sh` 生成；換圖標要同步改 `store.js` 嘅 `ICON_VER` 同
`index.html`／`manifest.webmanifest` 嘅 `?v=`（lint 第 8 條會攔三處唔一致）。

## 8. 版面骨架（ROUND 2 · App Store 式）

靈感係 App Store 嘅 **Today + 分類貨架 + 詳情頁**，唔係儀表板。結構由上而下：

| 區塊 | 元素 | 規則 |
|---|---|---|
| 頂欄 | logo 44／標題 `clamp(19,4.6vw,23)`／副題 12.5 | 動作掣做 ghost（透明底＋細邊），**只有「提交作品」用實金** |
| 今期主打 | `.hero` 大卡：icon 88、標題 `clamp(23,5.2vw,30)`、金 pill badge | `collapsedByDefault`：默認一條細 bar，用戶自己展開；**冇假通知預覽** |
| 搜尋 | pill，內距 14／`font-size: 17px`（iOS 唔 zoom） | 一行過；右邊「⭐ 我的收藏」跟住同高 |
| 篩選 | 分頁 → 支部 → 排行榜指標 → 分類 chips | chip 未揀＝純文字（透明底、無邊），揀中＝實金；唔用 emoji 圖示阻位 |
| 貨架 | `.shelf-sec` → `.sec-head`（線稿分類 icon 22 + h2 + 數量 + `全部 ›`）＋ `.shelf` | 手機橫滑（`grid-auto-flow: column`、`scroll-snap-type: x proximity`）；≥700px 2 欄；≥1000px 3 欄，唔再橫滑 |
| 卡 | `.card`：icon 60（圓角 15）＋名（2 行封頂）＋描述（2 行封頂）＋`›` | 卡**唔載**動作掣；撳卡＝開詳情 |
| 詳情 sheet | `.sheet`：icon 76、名稱、分類、描述、支部 tag、真數字、`開啟`＋`☆ 收藏`／`♡ 讚好`／`↗ 分享` | 手機由底升起（圓角 22/22/0/0），≥620px 居中卡片；`Esc`／撳背景／✕ 都可閂；閂完 focus 返去嗰張卡 |
| 排行榜 | `.chart-list` 直立列表：排名數字（tabular-nums）＋icon 52＋名／描述＋數量 | 頭三名排名用 `--accent-text`；≥1000px 先分兩欄 |

分類圖標（`CAT_PATHS`，24×24 視框、`stroke-width 1.6`、`currentColor`）：

- 後台照舊用 emoji 揀分類圖示；**常見 emoji 會自動換成同一套線稿**（🧭→compass、🎮→game、🧰→tools、🃏→cards、📽️→slides、🔗→link…）。
- 對應唔到嘅 emoji **原樣保留**（唔好亂改用戶揀嘅嘢），所以 `.cat-ico-emoji` 要留。
- 分類圖標只可以用 `--accent`；貨架標題本身用 `--text`，唔好成行發光。

卡片節奏：`card` padding 12、icon 與文字 gap 12、貨架 gap 10、貨架之間 26。
任何新 element 都要落喺呢張表；表上冇嘅就唔好加。

## 9. 驗收（交付前）

1. `npm run build` 全綠（lint 內置 house rules 檢查）。
2. 390 / 768 / 1440 三個寬度親眼望一次：第一屏答到「呢個係乜、俾邊個、跟住做乜」；
   貨架喺 390 要滑得順、喺 768 變 2 欄、喺 1440 變 3 欄；撳卡→sheet→開啟條路要行得通。
3. 遮住 logo：頁面仲成立（= 有 idea，唔係模板）。
4. Squint：得返 2–3 嚿大細分明嘅 mass（標題／格／按鈕）。
5. 冇任何一條上面 §3 嘅禁止項。

> ⚠️ 呢個環境**冇瀏覽器截圖**。任何人（包括 AI）都唔准講「我望過圖、幾多分」；
> 只可以講「跑過 lint／單測」同「肉眼望過實際預覽」——後者要人手做。
