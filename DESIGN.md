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
| 一排一樣嘅 icon card | 格狀 launcher（App Store 式），或者一個主張 |

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

## 8. 驗收（交付前）

1. `npm run build` 全綠（lint 內置 house rules 檢查）。
2. 390 / 768 / 1440 三個寬度親眼望一次：第一屏答到「呢個係乜、俾邊個、跟住做乜」。
3. 遮住 logo：頁面仲成立（= 有 idea，唔係模板）。
4. Squint：得返 2–3 嚿大細分明嘅 mass（標題／格／按鈕）。
5. 冇任何一條上面 §3 嘅禁止項。

> ⚠️ 呢個環境**冇瀏覽器截圖**。任何人（包括 AI）都唔准講「我望過圖、幾多分」；
> 只可以講「跑過 lint／單測」同「肉眼望過實際預覽」——後者要人手做。
