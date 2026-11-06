# DESIGN — 本站設計語言（唯一真理）

> 用途：任何改 UI 之前先讀呢頁；新樣式只可以用下面嘅 token 同規則，唔准自己發明色／間距／圓角。
> 依據：`playerkousas-rgb/readme` 嘅 [`design-review`](https://github.com/playerkousas-rgb/readme/blob/main/templates/repo-starter/skills/promoted/design-review/SKILL.md)
> 19 條 house rules ＋ [docs/23 設計資源](https://github.com/playerkousas-rgb/readme/blob/main/docs/23-design-resources.md) 嘅「3／4／7 三步硬性要求」
> （有 design language、有 token、有齊 9 個圖標）。定案日期：2026-11-06。

## 1. 一句定位

> **一個分類展示櫃，唔係一個 dashboard。** 主角係每個 app 自己嘅圖標同名字；UI 只做安靜嘅畫框。

- 頁面感（唔係 app 屏幕）：大片留白、真圖標、少量文字。
- 唯一動作：撳個 app 入去。其餘（收藏／讚好／分享）一律做細。

## 2. 顏色（金 = 品牌，6 色 = 分類）

對象係青少年（2026-11-06 用戶指示：「整個 UI 太陰沉，要活潑一點」），所以色版由
「只准一隻金」擴展成 **金 ＋ 6 隻分類色**。原則是「**只准呢一套**」：唔可以隨手加第七隻色 ——
咁樣先同時做到「活潑」同「唔似雜牌」。

| 角色 | Token | 淺色 | 深色 | 用喺邊 |
|---|---|---|---|---|
| 底 | `--bg` | `#faf6ec` 奶油 | `#12141c` | 頁面底 |
| 卡／面 | `--bg-card`、`--bg-elevated` | `#ffffff` | `#1d2231` / `#1b1f2a` | 卡、sheet、modal |
| 文字 | `--text`、`--muted` | `#241a05` / `#8a7350` | `#f1f5f9` / `#94a3b8` | 全部文字 |
| **品牌金** | `--accent` | `#b3821a` | `#e8c87a` | 主要動作（提交作品／開啟）、今期主打、已選支部 |
| 分類 1 青綠 | `--c1` | `#10897a` | `#4fd6c2` | 第 1 條貨架 |
| 分類 2 天藍 | `--c2` | `#2f6fd0` | `#7fb3f7` | 第 2 條貨架 |
| 分類 3 珊瑚 | `--c3` | `#d4553c` | `#ff9d7c` | 第 3 條貨架 |
| 分類 4 紫 | `--c4` | `#7a55c9` | `#bda2f5` | 第 4 條貨架 |
| 分類 5 草綠 | `--c5` | `#3d8b3f` | `#94dc8f` | 第 5 條貨架 |
| 分類 6 琥珀 | `--c6` | `#b8860b` | `#f0cf8a` | 第 6 條貨架（循環） |
| 排名 | `--rank-1/2/3` | 金／銀／銅 | 對應提亮 | 排行榜頭三名 |
| 語意 | `--danger`／`--ok`／`--warn` | — | — | 只限狀態 |

規矩：

1. **分類色只出現喺「分類」身上**：貨架標題圖標、卡片細邊／icon 底盤、chip 選中、底欄選中。
   佢唔可以搶主要動作 —— 「開啟」「提交作品」永遠係金。
2. **金仍然係品牌色**：主要 CTA、今期主打、已選支部、focus ring。
3. 分類色按次序 `cat-0..5 → c1..c6` 循環（`[data-catn]` 屬性控制），**唔係隨機**，所以每次載入都一樣。
4. 顏色一律用 token，唔准喺組件寫死 hex；`scripts/lint.js` 會捉「色板以外嘅彩色」。
5. 深色主題嘅分類色係**提亮版**（因為要放喺深底）；彩色底上面嘅字用 `--on-cat`。
6. 語意色只有三隻，全部只用在狀態。
7. 金色要同 **9 個圖標**（暖黑底＋金線徽章）一致：`#e8c87a` 係 icon 同 UI 共用嘅金。

## 2b. 主題

- **預設跟系統**（`prefers-color-scheme`）；用戶撳過 🌙 之後就用佢自己揀嘅並記住。
- 深色底一路提亮到 `#1f2430`（由 `#0b0d12` → `#12141c` → `#1f2430`）——「太黑」＝陰沉，深色主題要「炭灰」唔係「墨黑」。
  卡面 `#2b3141`、hover `#363d50`、邊框 `rgba(255,255,255,.11)`；文字 `#f1f5f9` 對卡面 11.9:1、次要字 `#aab6c8` 對卡面 6.3:1。
- 深色底色喺**三處**同步：`:root` 深色 `--bg`、`<meta name="theme-color">`／Apple 底色、`manifest.webmanifest`；`scripts/lint.js` 直接讀 `--bg` 對三處，唔一致就 fail（避免狀態欄／PWA 啟動畫面同頁面唔同色）。
- 陰影喺淺底會「化」得深，所以深色主題陰影 opacity 比淺色低（`.30` / 首頁 hover `.42`）。

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
| 頂部彩色條 | `.head-strip` 6 段 3px（c1–c6） | 一眼認出「青春版」；唔用漸層，用 6 個實色段 |
| 貨架 | `.shelf-sec`（帶 `data-catn`）→ `.sec-head`（分類色線稿 icon 22 + h2 + 數量 + `全部 ›`）＋ `.shelf` | 手機橫滑（`grid-auto-flow: column`、`scroll-snap-type: x proximity`）；≥700px 2 欄；≥1000px 3 欄，唔再橫滑 |
| 卡 | `.card`：icon 62（圓角 17、**分類色底盤**）＋名（2 行封頂）＋描述（2 行封頂）＋`›` | 卡**唔載**動作掣；邊框用分類色 22%，hover 55% |
| 詳情 sheet | `.sheet`：icon 76、名稱、分類、描述、支部 tag、真數字、`開啟`＋`☆ 收藏`／`♡ 讚好`／`↗ 分享` | 手機由底升起（圓角 22/22/0/0），≥620px 居中卡片；`Esc`／撳背景／✕ 都可閂；閂完 focus 返去嗰張卡 |
| 排行榜 | `.chart-list` 直立列表：排名數字（tabular-nums）＋icon 52＋名／描述＋數量 | 頭三名排名用 `--accent-text`；≥1000px 先分兩欄 |

分類圖標（`CAT_PATHS`，24×24 視框、`stroke-width 1.6`、`currentColor`）：

- 後台照舊用 emoji 揀分類圖示；**常見 emoji 會自動換成同一套線稿**（🧭→compass、🎮→game、🧰→tools、🃏→cards、📽️→slides、🔗→link…）。
- 對應唔到嘅 emoji **原樣保留**（唔好亂改用戶揀嘅嘢），所以 `.cat-ico-emoji` 要留。
- 分類圖標只可以用 `--accent`；貨架標題本身用 `--text`，唔好成行發光。

卡片節奏：`card` padding 12、icon 與文字 gap 12、貨架 gap 10、貨架之間 26。
任何新 element 都要落喺呢張表；表上冇嘅就唔好加。

## 9. 圖標系統（emoji 全面退役）

**規矩：介面圖示一律用線稿 SVG，唔准用 emoji。** emoji 每個系統畫法唔同、粗幼唔一、
顏色跟系統、放大又會起格 —— 睇落就係「土炮」。而家全站（公開＋後台）都係同一套圖標。

| 項目 | 規格 |
|---|---|
| viewBox | `0 0 24 24` |
| 線粗 | `stroke-width: 1.6`，`round` cap／join |
| 填色 | `fill: none`（狀態版例外：已收藏 ★／已讚好 ♥ 加 `.is-fill`） |
| 顏色 | `currentColor`（跟文字色），分類／排行榜圖標用 `--accent` |
| 尺寸 | 由 `font-size` 控制（`.ic { width: 1em; height: 1em }`），唔好寫死 px |
| 來源 | `store.js` 嘅 `ICON_PATHS`（69 個）＋ `svgIcon()`；公開／後台共用 |

用法：

```js
svgIcon("compass")        // 直接出 <svg class="ic" …>
svgIcon("star", "is-fill") // 已收藏（實心星）
catIconHTML(c.icon, name)  // 貨架頭（值可以係 "i:compass" 或舊 emoji "🧭"）
```

- 靜態 HTML 唔抄 path：寫 `<span data-icon="search"></span>`，boot 時 `hydrateIcons()` 填 `<svg>`。
- 資料欄位（分類／分頁 icon）新寫法係 `"i:compass"`；舊 emoji 經 `EMOJI_TO_ICON`（132 個）自動對應。
- **對應唔到嘅值一律退做 `grid`（通用方格）**，公開版永遠唔會漏返 emoji 出街。
- 後台「揀圖標」面板：40 個常用圖標（`ICON_CHOICES`，附中文名），存 `"i:key"`。
- App 自己嘅 icon：`iconSource="favicon"`（首選，用 app 自己個站嘅 logo）→ `upload` → `emoji`（已升級做線稿）。

## 10. 驗收（交付前）

1. `npm run build` 全綠（lint 內置 house rules 檢查）。
2. 390 / 768 / 1440 三個寬度親眼望一次：第一屏答到「呢個係乜、俾邊個、跟住做乜」；
   貨架喺 390 要滑得順、喺 768 變 2 欄、喺 1440 變 3 欄；撳卡→sheet→開啟條路要行得通。
3. 遮住 logo：頁面仲成立（= 有 idea，唔係模板）。
4. Squint：得返 2–3 嚿大細分明嘅 mass（標題／格／按鈕）。
5. 冇任何一條上面 §3 嘅禁止項。
6. 冇任何 emoji 做介面圖示（`npm test` 有硬性斷言：HTML／app.js／market.js／render 輸出）。

> ⚠️ 呢個環境**冇瀏覽器截圖**。任何人（包括 AI）都唔准講「我望過圖、幾多分」；
> 只可以講「跑過 lint／單測」同「肉眼望過實際預覽」——後者要人手做。
