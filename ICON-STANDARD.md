# 圖標交付要求（APP → SCOUT APP STORE）

> **版本**：v1.0 · 2026-11-12
> **適用**：所有喺 SCOUT APP STORE 上架嘅自家 APP
> **配合文檔**：真理倉 `readme` 嘅 `docs/33-icon-standard.md`（G11 全套 9 檔規格）
>
> 呢份文件係**參考用**，唔係「為咗呢個站而額外要求」。
>
> **APP 端唔需要改任何嘢**：真理倉 `docs/33` 已經規定所有 APP 都有齊 9 檔（包 512），
> 而本站（2026-11-12 起）一定會攞最大嗰張。兩邊已經對齊。
>
> 呢份文件嘅用途：
> 1. 解釋「以前點解會化開」（方便日後 debug）
> 2. 新 APP 想自檢圖標時有個清單（`scripts/check-icon-set.mjs`）
> 3. 外部連結（我哋控制唔到）嘅降級規則寫喺 §9

---

## 0. 一句話原則

> **網站一定會攞你最大嗰張圖。你唔提供大圖，就會被當成細圖放大，然後化開。**

---

## 1. 點解會有「化開」

網站上每個 APP 圖標顯示 **68px**（手機 58px、列表 20px）。但要清晰，來源圖最少要有：

```
顯示 68px × 2（高密度螢幕）= 136px
```

如果 APP 只提供 32–48px，瀏覽器就要**用 32px 放大到 68px 顯示**，邊緣就會被插值成一格格糊邊 → 就係你見到嘅「化開」。

**實測（2026-11，4 本紀錄冊）**：

| APP | 舊網站攞到 | 結果 |
|---|---|---|
| VSBOOK | `favicon-48.png`（48px） | 邊緣有鋸齒＋光暈 |
| SCOUTBOOK | `favicon-32-v2.png`（32px） | 明顯糊 |
| ROVERBOOK | `favicon-32.png`（32px） | 明顯糊 |
| CUBSBOOK | `favicon-48.png`（48px） | 邊緣有光暈 |

四本書嘅 **512 原圖本身全部合格**，問題純粹係「有 180/512 但冇被用」。

> ⚠️ 網站端已經修好（2026-11-12：大圖優先評分 + link／manifest 合併排序）。
> 但**APP 端仍然要提供大圖**，兩邊配合先穩陣。

---

## 2. 必要檔案（9 個，缺一不可）

規格跟真理倉 `docs/33-icon-standard.md` §2：

| # | 檔名 | 尺寸 | 用途 |
|---|---|---|---|
| 1 | `favicon.ico` | 16+32+48 三合一 | 舊瀏覽器、書籤 |
| 2 | `favicon-16.png` | 16×16 | 分頁標籤（**要手繪，唔可以縮**） |
| 3 | `favicon-32.png` | 32×32 | 分頁標籤 |
| 4 | `apple-touch-icon.png` | 180×180 | iOS 主畫面 |
| 5 | `icon-192.png` | 192×192 | Android 主畫面 |
| 6 | `icon-512.png` | 512×512 | PWA 安裝、商店列表 |
| 7 | `icon-maskable-192.png` | 192×192 | Android 自適應圖標 |
| 8 | `icon-maskable-512.png` | 512×512 | Android 自適應圖標 |
| 9 | `og-image.png` | 1200×630 | 分享預覽卡 |

**冇 1024**（docs/33 明確唔要）。

### ⚠️ 三個最常犯嘅錯

1. **冇 `apple-touch-icon.png` 180px**
   好多 APP 只做 16/32 就收工。冇 180px = 網站只能攞 32px 放大。

2. **`<link rel="apple-touch-icon">` 冇寫 `sizes`**
   ```html
   <!-- ✅ 好 -->
   <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">
   <!-- ⚠️ 可以，但網站要猜（已修：當 180px） -->
   <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
   ```
   寫明 `sizes` 最穩陣。

3. **ROVERBOOK 型：只做 4 個檔**
   ```
   icons/apple-touch-icon.png  180x180 ✅
   icons/favicon.png           180x180 （同一個檔改名，冇 16/32）
   icons/icon-192.png          192x192 ✅
   icons/icon-512.png          512x512 ✅
   ```
   **缺**：favicon-16、favicon-32、favicon.ico、maskable 192/512、og-image。
   唔會即刻壞，但 iOS／Android 主畫面會用錯圖。

---

## 3. `<head>` 要寫嘅（4 條 link）

```html
<link rel="icon" href="/icons/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">
```

**規則**：

- `type` **一定要寫**（否則網站要靠副檔名猜）
- `sizes` **一定要寫**（尤其 apple-touch-icon）
- **唔好**放 32/48px 做唯一 PNG link —— 網站會攞佢
- 大圖（180/192/512）**放得越前越安全**

---

## 4. `manifest.webmanifest` 要寫嘅

```json
"icons": [
  { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

**兩個要點**：

1. **`purpose: "any"` 同 `"maskable"` 一定要分開兩個檔**（唔可以同一個檔兩個 purpose）
2. **maskable 嘅主體要收喺中央 66%**（見 §5）

---

## 5. maskable 安全區（最易錯）

Android 會用各種形狀裁切（圓形、方形、水滴形）。**主體一定要收喺中央圓形 66% 以內**：

```
邊長 512px
├─ 安全圓半徑 = 512 × 0.33 = 169px
└─ 即係主體最遠點離中心唔可以超過 169px
```

**做法**：由 512 母圖縮到 **340×340**，貼喺 512×512 中央，四周圍補返底色。

```bash
# 安全做法：主體縮到 66% 再置中
convert mother-512.png -resize 340x340 -background '#你的底色' -gravity center -extent 512x512 icon-maskable-512.png
```

**唔好**直接將滿版母圖改名做 maskable（本網站自己犯過呢個錯）。

---

## 6. 風格：自由，但有三條底線

**唔要求統一風格**。風景、字母、印章、線稿、插畫……全部可以。只有三條：

### 底線 1：16px 要認得出

16×16 係**手繪格仔**，唔可以縮圖。做法：

- 開一個 16×16 網格
- 每一筆最少 **2px 闊**
- 所有細節、文字、幼線、漸層 → **全部刪**
- 只留一個最有辨識度嘅形（水滴、字母、山、書本……）

**測試**：把 16px 圖放大 10 倍睇，如果形狀模糊、認唔出 → 重畫。

### 底線 2：主體 vs 底色，對比最少 3:1

```
✅ 深紅底 + 米白字   (VSBOOK，對比 7.9)
✅ 深藍底 + 金黃字   (ROVERBOOK，對比 6.5)
⚠️ 橄欖底 + 暗金字   (CUBSBOOK，同色系，邊緣易溶)
❌ 深灰底 + 淺灰字   (對比 <2.5，遠睇一嚿)
```

**同色系（深橄欖＋暗金）唔係唔得，但邊緣要多留 2px 空隙**，否則縮細時會同底色溶埋。

### 底線 3：唔好靠光暈／外發光去造層次

```
✅ 平塗色塊（VSBOOK 做法）→ 縮細最穩
⚠️ 漸層底 + 柔光邊（CUBSBOOK 做法）→ 縮細容易糊
❌ 多重外發光 + 陰影 → 縮到 48px 一定化開
```

想要層次，用**色階**（3–4 個平塗色）而唔係漸層。真理倉 docs/33 §4 都係咁講。

---

## 7. 自我檢查（上架前跑）

```bash
# 1) 9 個檔齊唔齊、尺寸對唔對
ls -la icons/

# 2) 每個檔真實尺寸（一定要逐個核）
for f in icons/*.png; do identify -format "%f %wx%h\n" "$f"; done

# 3) 16px 係唔係手繪（唔係縮出嚟）
identify -format "%k 色\n" icons/favicon-16.png   # 色數 ≤16 = 似手繪

# 4) maskable 主體有冇越界（睇中央 66% 圓）
convert icons/icon-maskable-512.png -fill none -stroke red -strokewidth 2 \
  -draw "circle 256,256 256,87" /tmp/check.png   # 主體唔應該掂到紅圈
```

**最低驗收**：

- [ ] 9 個檔全部存在、尺寸正確
- [ ] `icon-512.png` ≥ 40KB（太細通常代表過度壓縮／內容太少）
- [ ] `favicon-16.png` 放大 10 倍仍然認得出形狀
- [ ] `icon-maskable-512.png` 主體喺中央 66% 內
- [ ] `<head>` 有 4 條 link，全部寫明 `type` 同 `sizes`
- [ ] `manifest` 有 4 個 icon，`any` / `maskable` 分開
- [ ] 9 個檔合計 ≤ 260KB

---

## 8. 快速對照：4 兄弟實際情況

| | VSBOOK | SCOUTBOOK | ROVERBOOK | CUBSBOOK |
|---|---|---|---|---|
| favicon.ico | ✅ | ✅ | ❌ | ✅ |
| favicon-16 | ✅ | ✅ | ❌ | ✅ |
| favicon-32 | ✅ | ✅ | ❌ | ✅ |
| apple-touch-180 | ✅ | ✅ | ✅ | ✅ |
| icon-192 | ✅ | ✅ | ✅ | ✅ |
| icon-512 | ✅ | ✅ | ✅ | ✅ |
| maskable-192 | ✅ | ✅ | ❌ | ✅ |
| maskable-512 | ✅ | ✅ | ❌ | ✅ |
| og-image | ✅ | ✅ | ❌ | ✅ |
| `<head>` sizes 寫明 | ✅ | ✅ | ⚠️ 部分 | ✅ |
| **合格** | **✅** | **✅** | **❌ 缺 6 個** | **✅** |

> ⚠️ **以上只係現況觀察，唔係要求。**
> 真理倉 `docs/33` 已經係全站統一要求：**所有 APP 都必須有 512**。
> ROVERBOOK 嘅缺檔係歷史遺留，唔影響網站顯示（網站會攞佢 512），
> 亦**唔需要**為咗呢個站而補檔。呢個表只係用嚟解釋「點解以前睇落唔同」。

---

## 9. 網站端已經做咗咩（2026-11-12）

| 改動 | 影響 |
|---|---|
| 大圖優先評分（512→+12、180/192→+10、32–95→+4） | 有 180/512 就一定攞大圖 |
| link 同 manifest 合併排序 | 唔再「link 行完就收工」而漏咗 manifest 512 |
| `apple-touch-icon` 冇 `sizes` → 當 180px | 修好 ROVERBOOK 型寫法 |
| 冇 `type` → 由副檔名推斷 | `.png` 唔會再被當未知格式 |
| `X-Favicon-Size` / `X-Favicon-Small` header | 一睇就知邊個 APP 仲用細圖 |
| `object-fit: cover` → `contain` | 唔再裁邊後放大 |
| GitHub 頭像 `size=64` → `size=460` | 冇 favicon 嘅 GitHub 專案都夠清 |
| Google s2 `sz=64` → `sz=256` | 外部連結攞到最大尺寸 |
| **細圖降級：< 64px → 字母牌** | 外部連結真係冇大圖時，唔顯示糊圖 |
| chain 最後由「全站 Logo」改為哨兵 | 唔會令人誤會外部連結係本站嘅 |

實測：4 本書全部由 32–48px 升級到 **180px**。

### 外部連結（我哋控制唔到）

有時加入嘅係第三方網站，我哋唔知佢有咩圖。網站會依次試：

```
① 佢自己站嘅 favicon（/api/favicon，會攞佢最大嗰張）
② 佢 GitHub 頭像 460px（如果填咗 github）
③ Google s2 256px
④ 全部都細過 64px → 顯示「字母牌」（分類色底 + 名稱首字）
```

所以**唔會再出現「一嚿糊」**。字母牌用該項目嘅分類色，同站內色系一致。

---

## 10. 要記住嘅一句

> 你嘅 APP 唔需要同其他 APP 一樣樣。
> 但你**一定要俾 180px 同 512px 出嚟**，因為網站同手機主畫面都係靠佢。
> 只有 32px 嘅話，就算你畫得幾靚，出到嚟都會化開。
