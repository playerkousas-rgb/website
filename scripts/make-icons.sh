#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# scripts/make-icons.sh — 一次過出齊 readme docs/33 要求嘅 9 個圖標檔
#
# 用法：
#   bash scripts/make-icons.sh                       # 用 icons/icon-512.png 做母圖
#   GOLDIFY=舊母圖.png bash scripts/make-icons.sh     # 由青藍母圖轉金色再出全套
#
# 品牌色（2026-11-06 定案）：
#   金色徽章 = 童軍支部紀錄冊嘅共同語言（VSBOOK／ROVERBOOK／SCOUTBOOK／CUBBOOK
#   四個 icon 都係「深底 + 金色線條徽章」），所以本站圖標同 UI accent 一律金色，
#   唔再用「青藍霓虹」——兩個品牌色打架係設計扣分位。
#
# 產出 9 個檔（docs/33 G11）：
#   icons/favicon.ico                16/32/48 三合一
#   icons/favicon-16.png             16×16（手繪三層，唔靠縮圖）
#   icons/favicon-32.png             32×32
#   icons/apple-touch-icon.png       180×180（滿版無白邊）
#   icons/icon-192.png               192×192
#   icons/icon-512.png               512×512（母圖）
#   icons/icon-maskable-192.png      192×192（主體收喺安全區）
#   icons/icon-maskable-512.png      512×512
#   icons/og-image.png               1200×630（分享預覽，必須絕對網址）
#
# ⚠️ 換圖標嘅正確做法（docs/33 §9.5）：唔好原地覆蓋同名檔再靠 CDN 更新，而係
#    ① 跑呢支 script ② 改 store.js 嘅 ICON_VER ③ index.html／manifest 嘅
#    `?v=` 一齊改（lint 第 8 條會攔住三處唔一致）。
# ════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

BG="#12100c"        # 暖黑（同 UI dark 主題 --bg 一致）
GOLD="#e8c87a"      # 金色徽章
GOLD_DIM="#8a6a2a"  # 金線暗位
INK="#cfc6b4"       # 暖灰字
SRC="icons/icon-512.png"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ── 由青藍母圖轉金色（只跑一次；之後 icons/icon-512.png 本身就係金色）──
if [ -n "${GOLDIFY:-}" ]; then
  echo "▸ 青藍母圖 → 金色徽章（金色線條 + 暖黑底，保留原六角／百合花線稿）"
  # 硬門檻（+ 輕微模糊做抗鋸齒）：母圖背景有暗角／紋理，用 level 會把底紋
  # 當成半透明金 overlay，出到「右邊一撻較光」嘅方框（踩過）。
  convert "$GOLDIFY" -colorspace gray -blur 0x0.8 -threshold 42% -blur 0x0.6 "$TMP/mask.png"
  convert -size 512x512 "xc:$GOLD" "$TMP/gold.png"
  convert "$TMP/gold.png" "$TMP/mask.png" -alpha off -compose CopyOpacity -composite "$TMP/lines.png"
  convert -size 512x512 "xc:$BG" \
    \( "$TMP/lines.png" -blur 0x6 -alpha set -channel A -evaluate multiply 0.35 +channel \) -composite \
    "$TMP/lines.png" -composite "$TMP/base-src.png"
  SRC="$TMP/base-src.png"
fi

echo "▸ 母圖 → 減色"
convert "$SRC" -resize 512x512 -dither None -colors 48 -strip "PNG8:$TMP/base.png"

# 母圖自己嘅底色（量化後唔一定等於 $BG，差 1-2 級就會見到一塊「唔同色嘅方框」）
PLATE=$(convert "$TMP/base.png" -format "%[pixel:p{2,2}]" info:)

echo "▸ icon-512 / icon-192"
convert "$TMP/base.png" -strip "PNG8:icons/icon-512.png"
convert "$TMP/base.png" -resize 192x192 -dither None -colors 40 -strip "PNG8:icons/icon-192.png"

echo "▸ apple-touch-icon 180（滿版，iOS 自己裁圓 → 四角唔可以有白邊）"
convert "$TMP/base.png" -resize 180x180 -dither None -colors 40 -strip "PNG8:icons/apple-touch-icon.png"

echo "▸ favicon-32（縮圖夠用）"
convert "$TMP/base.png" -resize 32x32 -dither None -colors 24 -strip "PNG8:icons/favicon-32.png"

echo "▸ favicon-16（手繪三層：底色／六角環／中央徽章，唔靠縮圖）"
convert -size 16x16 "xc:$BG" \
  -fill "$GOLD_DIM" -draw "polygon 8,1 14.5,4.5 14.5,11.5 8,15 1.5,11.5 1.5,4.5" \
  -fill "$BG"       -draw "polygon 8,2.6 13,5.4 13,10.6 8,13.4 3,10.6 3,5.4" \
  -fill "$GOLD"     -draw "polygon 8,3.4 9.3,5.6 9.3,10 8,11.8 6.7,10 6.7,5.6" \
  -draw "rectangle 4,6 5,7" -draw "rectangle 10,6 11,7" \
  -draw "rectangle 6,9 9,10" \
  -strip "PNG8:icons/favicon-16.png"

echo "▸ favicon-48（ico 中間尺寸）"
convert "$TMP/base.png" -resize 48x48 -dither None -colors 32 -strip "PNG8:$TMP/f48.png"

echo "▸ favicon.ico（16+32+48 三合一）"
convert "icons/favicon-16.png" "icons/favicon-32.png" "$TMP/f48.png" "icons/favicon.ico"

echo "▸ maskable（滿版母圖：Android 裁圓都唔會斬到中央百合花）"
# 做過兩個版本都失手：① 純色底 + 縮細方塊 → 見到明顯方框；
# ② 模糊母圖做底 + 圓角主體 → 母圖本身有暗角，會出現「唔同色嘅圓角影」。
# 母圖本身已經係「深底 + 中央徽章」，滿版直接用最乾淨，安全區（中央 ~66%）亦夠。
# 192 版另存，唔由 512 縮（縮細再減色會糊）。
for SZ in 192 512; do
  convert "$TMP/base.png" -resize ${SZ}x${SZ} -dither None -colors 48 -strip "PNG8:icons/icon-maskable-${SZ}.png"
done

echo "▸ og-image 1200×630（實色底，唔用漸層 —— readme design-review house rules）"
convert -size 1200x630 "xc:$PLATE" \
  -fill none -stroke "$GOLD_DIM" -strokewidth 2 -draw "circle 1180,120 1420,120" \
  -stroke none \
  \( "$TMP/base.png" -resize 320x320 \) -geometry +96+155 -compose Over -composite \
  -font DejaVu-Sans-Bold -pointsize 58 -fill "$GOLD"  -annotate +460+258 "SCOUT APP STORE" \
  -font DejaVu-Sans      -pointsize 32 -fill "$INK"   -annotate +462+322 "Good tools for a better scout life." \
  -font DejaVu-Sans      -pointsize 25 -fill "$GOLD"  -annotate +462+380 "Apps · Flashcards · Slides · Links" \
  -font DejaVu-Sans      -pointsize 23 -fill "#6d6459" -annotate +96+560 "© SCOUT SYSTEM" \
  -dither None -colors 64 -strip "PNG8:icons/og-image.png"

echo ""
echo "── 體積目錄 ──────────────────────────────"
TOTAL=0
for f in favicon.ico favicon-16.png favicon-32.png apple-touch-icon.png \
         icon-192.png icon-512.png icon-maskable-192.png icon-maskable-512.png og-image.png; do
  SZ=$(stat -c %s "icons/$f")
  TOTAL=$(( TOTAL + SZ ))
  awk -v s="$SZ" -v f="$f" 'BEGIN{printf "  %7.1f KB  %s\n", s/1024, f}'
done
awk -v s="$TOTAL" 'BEGIN{printf "  %7.1f KB  ── 合計（預算 260 KB）\n", s/1024}'
