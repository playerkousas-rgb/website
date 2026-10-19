---
version: alpha
name: Scout-App-Store-design
description: "童軍工具 App Store 嘅視覺語言：暖米白『行軍手冊紙』底 ＋ 徽章金單一 accent，hairline 邊界、克制陰影、量度過嘅負字距。UI chrome 退後（Apple 原則），色彩只留一個主色（Linear 原則），emoji 圖標放喺柔色漸變方卡上做 App Store 式圖標牌。深色模式唔係反相，而係『夜晚營地』：近黑底＋更亮嘅徽章金。"
---

# SCOUT APP STORE — 設計語言

> 呢份係「改版前必讀」嘅設計規範（格式參考 Google Stitch 嘅 `DESIGN.md` 概念：
> `AGENTS.md` 講點 build，`DESIGN.md` 講成個 product 應該點樣）。
> 任何 AI agent 或者人改版面之前，**先對一次呢頁**，
> 唔好即場發揮出新 token／新圓角／新陰影 —— 一致先至有「設計感」。

---

## 設計三支柱

| 支柱 | 點做 | 例子 |
|---|---|---|
| **一個 accent** | 全站只有徽章金一個主色，唔好再出現第二種「品牌色」 | 底欄之前用住硬編碼靛藍 `#6366f1`（已改） |
| **Chrome 退後** | UI 框架用 hairline 邊界＋淺陰影，唔用重陰影；漸變只可以出現喺「產品」上面（App 圖標卡） | `.tile-icon` 漸變底 = 產品；`.chip`／`.card` 淨係 flat |
| **量度過** | 字距、圓角、動效全部有級數，唔靠 feel | `--radius` 只准用 4 級、`--dur` 只准用 3 級 |

---

## colors

單一 accent（徽章金）＋ 中性暖灰階。

```
colors:
  primary: "#c98b0b"            # 徽章金（主色：主要按鈕、已選狀態、focus）
  primary-hover: "#a56c05"
  primary-soft: "rgba(201,139,11,.12)"
  on-primary: "#241a05"          # 金底上用深啡字（對比度 > 7:1）
  ink: "#1e1a12"                 # 主文字
  ink-muted: "#7a6a4e"           # 次要文字
  canvas: "#f8f4e9"              # 米白紙底
  surface: "#fffdf8"             # 卡／晶片
  surface-hover: "#fbf4e4"
  hairline: "rgba(93,71,27,.12)"  # 唯一嘅邊界線
  hairline-strong: "rgba(93,71,27,.22)"
  semantic-danger: "#c02626"
  semantic-success: "#059669"
  semantic-warn: "#b45309"
```

**深色模式（「夜晚營地」）** —— 唔係反相：

```
  canvas: "#0a0c11"              # 近黑
  surface: "#151923"
  surface-hover: "#1c2230"
  ink: "#f2f4f8"
  ink-muted: "#98a1b3"
  hairline: "rgba(255,255,255,.08)"
  primary: "#f5b942"             # 金要更亮先睇得清
  on-primary: "#12100a"
```

> 規則：深色模式唔准用純黑 `#000`，亦唔准用純白 `#fff` 做底；
> 漸變／陰影嘅 alpha 喺深色模式要再低少少（唔好「深色模式好刺眼」）。

---

## typography

系統字（PingFang / Noto Sans TC 優先），**字距要量過**：

```
typography:
  display:      # h1 站名：clamp(21px,5vw,26px) / 700 / -.03em
  headline:     # 分區標題 h2：18px / 700 / -.02em
  title:        # 卡片名 tile-name：13.5px / 600 / -.01em
  body:         # 16px / 400 / 0
  body-sm:      # 14px / 400
  caption:      # 12px / 500 / +.01em（數字、備註）
  numeric:      # 所有統計數字：font-variant-numeric: tabular-nums
```

- 中文標題唔好加粗過 700（`800/900` 會「漚」）。
- 純文字標題（`h1`／`h2`）一律 **唔加 emoji**（emoji 已經有 `.sec-ico` 位置）。
- 數字（KPI、排名、收藏數）全部 `tabular-nums`，唔好跳數。

---

## spacing / radius / elevation / motion

### spacing
```
4 8 12 16 20 24 32 40        # --sp-1 … --sp-10，只用呢 8 級
```

### radius
```
pill: 999px     # chip、膠囊掣
xl: 22px        # hero、modal、admin 卡
lg: 18px        # App 圖標卡
md: 12px        # 輸入框、細卡
sm: 8px         # 小掣
```

### elevation
```
0: none         # 靠 hairline 分層
1: 0 1px 2px rgba(30,20,5,.06)
2: 1px + 8px 24px rgba(30,20,5,.06)      # 卡、sticky 列
3: 2px + 16px 40px rgba(30,20,5,.10)     # hover、浮層
```

### motion
```
fast: 120ms    # 按掣、圖標
base: 200ms     # 卡片、chip
slow: 320ms     # 面板、modal
easing: cubic-bezier(.22, 1, .36, 1)
```

> **唔准**出現唔喺上面表嘅圓角／陰影／動效值。
> 所有動效都要對 `prefers-reduced-motion: reduce` 有回應（關掉位移／縮放）。

---

## components

### icon-tile（App 圖標卡）
- 68px（手機）／76px（≥560px）方形，圓角 18px。
- 底色 = `app.js` 內聯漸變（每個 App 名 hash 穩定取色，深色模式用深色 palette）。
  ⚠️ CSS **唔准**再用 `background: transparent !important` 壓死佢。
- 上面加一層玻璃高光（`::after` 漸層，深色模式 alpha 減半）。
- emoji 圖標 34px 置中；真圖片（favicon／上傳）`object-fit: contain` + 7px 內距。
- 唯一一個**可以有漸變同陰影**嘅地方（係「產品」唔係「框架」）。
- Hover：上移 3px ＋ 縮放 1.04，陰影升去 level 3。

### chip / tag-chip（分類、支部、排序列）
- 全部 pill 形，min-height 34–40px（手機收細到 30px）。
- 未揀：中性（surface + hairline），字色 muted —— 睇落「可以撳」而唔係「已揀」。
- 揀咗：accent 底 ＋ on-primary 字 ＋ 26% accent 陰影（**唔用漸變**，保持 flat）。
- 揀咗幾多要講清楚（例：`已揀 3 個 · ✕ 清除`）。

### page-nav（分頁導覽）
- 桌面 = **segmented control**：一條圓角（999px）surface 容器 ＋ 內部 pill 掣；選中 = accent 實心。
- 容器**貼內容**（`width: fit-content; max-width: 100%`）—— 唔好拉成全闊，否則似工具欄多過 segmented control。
- 手機（<560px）分頁名會轉行（要睇晒全部分頁），容器跟住改成圓角 18px 嘅卡。

### tile（App 卡）
- 4 欄（手機）→ 8 欄（≥920px）；名最多兩行、描述兩行（<380px 隱藏描述）。
- 名 = title 級；描述 = body-sm 級 muted。
- Hover：底色變 surface-hover ＋ inset hairline（唔會位移）。
- 底下三粒掣：⭐ 收藏／❤️ 讚好／分享 —— **圖示約定見下**。
- 三粒掣嗰行用 `margin-top: auto` 推到底 → app 名長短唔一，掣位仍然一行對齊。
- 手機 3 粒掣要收到 `svg 14px / padding 4px 2px`（3 × 18 + 2 × 2 = 58px ≤ 320px 闊一格 59px）。

### 圖示約定（全站唯一，唔准各自為政）
- **⭐ = 收藏**（`stars` 欄位、底欄「收藏」、「最多人收藏」排行榜、⭐ N 人收藏徽章）
- **❤️ = 讚好**（`hearts` 欄位、「最受歡迎」排行榜、❤️ N 人讚好徽章）
- 兩個唔可以互換（之前 APP 卡用 ❤️ 做收藏、底欄用 ⭐ 做收藏，好怪）。

### bnav（底部導覽）＝ 浮動 dock
- 固定底、**浮起喺頁面上面**：`margin: 8px 10px 6px`、圓角 22px、glass（blur 20px + saturate 1.6）、
  hairline 邊、level 2 陰影；`pointer-events` 喺 bar 度收埋，只俾兩個仔掣食到。
- 桌面（≥560px）**收窄到 540px 置中** —— 拉成 1280px 全闊會似工具欄，唔似 dock；手機維持貼邊。
- 選中態 = accent 文字 ＋ accent-soft 底 ＋ 底部 2px accent 指示線。
- **唔准**再寫死第二種品牌色（之前嘅 `#6366f1` 已改）。
- 下面嘅 credit line 淨係一行細字（半透明 ＋ blur），唔好再搶視線。

### hero（今期主打）＝ feature card
- 收埋態 = 一條細條（唔食手機版面）；展開態 = 大卡 ＋ 徽章 ＋ 圖標 ＋ 標題 ＋ CTA。
- 收埋態背景要 **flat（`background: var(--bg-card)`）**：留住角落 radial gradient 會喺細條右邊
  剩低一撻怪金燈，唔似一條 bar。
- 背景：**童軍地圖點陣**（1px 點、20px 間距、向下淡出）＋ 右上角柔光，淨係「氣氛」唔係主角。
- ⚠️ 唔准再加「聚光燈光束」同「星塵 twinkle」—— 太花，同品牌唔夾。
- 圖標 72px 圓角 20px、金色漸變 ＋ 玻璃高光 ＋ 柔光陰影。
- 徽章用 accent 底 ＋ on-primary 字（唔好斜住，斜住似「貼紙」）。
- 主 CTA = accent 實心 ＋ 14px 圓角；次 CTA = flat surface。
  桌面版主 CTA 收窄到 **340px**（唔好拉成 960px banner 鈕），手機版先滿闊。
- 收起掣用 **inline SVG 箭嘴**（`stroke: currentColor`）—— 唔好用 `▴`／`▾` 字型，
  部分系統冇呢兩個 glyph，會出豆腐格。

### toast / 空狀態
- Toast 用中性 surface（唔再用金色框），圓角 14px ＋ blur ＋ level 3 陰影。
- 空狀態 icon = accent-soft → surface 漸層嘅方牌，唔係灰盒。

### 排行榜卡（chart-item）
- 每張卡：surface 底 ＋ hairline ＋ 圓角 18px ＋ level 1 陰影；hover 上移 2px。
- 排名 badge：accent-soft 底；頭三名 = accent 實心。
- 分數用 `tabular-nums`。

### modal / sheet
- 圓角 22–24px、hairline、level 3 陰影；背景 blur 6px；加入場動畫（280ms）。

### admin（後台）
- 卡 = surface + hairline + level 2；tab 選中態 = accent 底。
- KPI 卡：數字用 display 級 + `tabular-nums`。

---

## rules（唔准違反）

1. **一個 accent** —— 全站主色只有徽章金。新增顏色要問：可唔可以改用 accent／muted／hairline？
2. **漸變只喺產品** —— App 圖標卡、hero 光暈可以；掣、卡、輸入框唔可以。
3. **唔准寫死色值喺選擇器** —— 一律行 `var(--*)`（`#6366f1` 呢類係反面教材）。
4. **圓角只准 4 級**（pill / xl / lg / md / sm）。
5. **所有互動都要有 hover ＋ active ＋ focus-visible**（`:focus-visible` 用 accent outline 2px + offset 2px）。
6. **手機優先** —— 320px 闊都要用到：掣最少 44px 高、唔可以靠 `overflow:hidden` 切走嘢。
7. **數字用 tabular-nums**；**文字唔好超過兩行**（`-webkit-line-clamp: 2`）。
8. 改完要跑 `npm run check`（lint + 單測）同 `npm run build`（部署清單）先 push。
9. 改咗 `index.html`／`app.js`／`store.js`／`admin.js` → **`sw.js` cache 版本 +1**。

---

## 參考

- 格式：`https://github.com/google-labs-code/design.md`（Google Stitch 嘅 DESIGN.md 格式）
- 品牌語言參考：`https://github.com/VoltAgent/awesome-design-md`（84 個品牌 DESIGN.md 分析）
  - 呢份主要參考 **Linear**（單一 accent、hairline、負字距、克制）
  - 同 **Apple**（chrome 退後、漸變只喺產品、一個 signature shadow）
