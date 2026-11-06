#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# scripts/make-icons.sh — 一次過出齊 readme docs/33 要求嘅 9 個圖標檔
#
# 用法：bash scripts/make-icons.sh
# 來源：icons/icon-512.png（母圖，512×512 滿版）
# 產出：
#   icons/favicon.ico                16/32/48 三合一
#   icons/favicon-16.png             16×16（手繪三層，唔靠縮圖）
#   icons/favicon-32.png             32×32
#   icons/apple-touch-icon.png       180×180（iOS 主畫面，滿版無白邊）
#   icons/icon-192.png               192×192
#   icons/icon-512.png               512×512（減色重壓）
#   icons/icon-maskable-192.png      192×192（主體收喺中央 66–80% 安全區）
#   icons/icon-maskable-512.png      512×512
#   icons/og-image.png               1200×630（WhatsApp／FB 預覽，必須絕對網址）
#
# ⚠️ 換圖標嘅正確做法（docs/33 §9.5）：唔好原地覆蓋同名檔再靠 CDN 更新，
#    而係 ① 跑呢支 script ② 改 store.js 嘅 ICON_VER ③ index.html／manifest
#    嘅 `?v=` 一齊改。三樣一齊做，用戶先一定見到新圖。
# ════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

BG="#0b0d12"        # 同 manifest background_color / theme_color 一致
CYAN="#7fe3ff"
GOLD="#e8c87a"
SRC="icons/icon-512.png"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "▸ 母圖 → 減色（580 秒內完成，肉眼睇唔出分別）"
convert "$SRC" -resize 512x512 -dither None -colors 64 -strip "PNG8:$TMP/base.png"

echo "▸ icon-512 / icon-192"
convert "$TMP/base.png" -strip "PNG8:icons/icon-512.png"
convert "$TMP/base.png" -resize 192x192 -dither None -colors 48 -strip "PNG8:icons/icon-192.png"

echo "▸ apple-touch-icon 180（滿版，iOS 自己裁圓 → 四角唔可以有白邊）"
convert "$TMP/base.png" -resize 180x180 -dither None -colors 48 -strip "PNG8:icons/apple-touch-icon.png"

echo "▸ favicon-32（縮圖夠用）"
convert "$TMP/base.png" -resize 32x32 -dither None -colors 32 -strip "PNG8:icons/favicon-32.png"

echo "▸ favicon-16（手繪三層：底色／六角環／中央徽章，唔靠 512 縮圖）"
convert -size 16x16 "xc:$BG" \
  -fill "#1b3f7a" -draw "polygon 8,1 14.5,4.5 14.5,11.5 8,15 1.5,11.5 1.5,4.5" \
  -fill "$BG"     -draw "polygon 8,2.6 13,5.4 13,10.6 8,13.4 3,10.6 3,5.4" \
  -fill "$CYAN"   -draw "polygon 8,3.4 9.3,5.6 9.3,10 8,11.8 6.7,10 6.7,5.6" \
  -draw "rectangle 4,6 5,7" -draw "rectangle 10,6 11,7" \
  -draw "rectangle 6,9 9,10" \
  -strip "PNG8:icons/favicon-16.png"

echo "▸ favicon-48（ico 中間尺寸）"
convert "$TMP/base.png" -resize 48x48 -dither None -colors 48 -strip "PNG8:$TMP/f48.png"

echo "▸ favicon.ico（16+32+48 三合一）"
convert "icons/favicon-16.png" "icons/favicon-32.png" "$TMP/f48.png" "icons/favicon.ico"

echo "▸ maskable（滿版模糊底 + 中央圓角主體；Android 裁圓都唔會斬到徽章）"
# 為何唔係「純色底 + 縮細主體」：母圖本身有漸變／紋理，硬貼一個縮細方塊
# 喺純色底上會見到明顯方框。用「自己放大模糊做背景」先至無縫。
# 先放大到 900 再裁 512（= 只取中央顏色場）才模糊，避免見到徽章輪廓殘影
convert "$TMP/base.png" -resize 900x900 -gravity center -crop 512x512+0+0 +repage -blur 0x40 -modulate 55 "$TMP/mask-bg.png"
convert "$TMP/base.png" -resize 330x330 \
  \( +clone -alpha extract -fill black -colorize 100 -fill white -draw "roundrectangle 0,0 329,329 58,58" \) \
  -alpha off -compose CopyOpacity -composite "$TMP/mask-fg.png"
convert "$TMP/mask-bg.png" "$TMP/mask-fg.png" -gravity center -composite -strip "PNG8:$TMP/mask-512.png"
convert "$TMP/mask-512.png" -resize 192x192 -strip "PNG8:icons/icon-maskable-192.png"
convert "$TMP/mask-512.png" -strip "PNG8:icons/icon-maskable-512.png"

echo "▸ og-image 1200×630"
# 背景：深色漸變 + 兩團柔和光暈（screen 疊上，唔會硬邊）
convert -size 1200x630 "gradient:#071026-#0b0d12" "$TMP/og-bg.png"
convert -size 1200x630 xc:black \
  -fill "#0f3358" -draw "circle 1080,40 1330,40" \
  -fill "#123a68" -draw "circle 1150,640 1420,640" \
  -blur 0x70 "$TMP/og-glow.png"
convert "$TMP/og-bg.png" "$TMP/og-glow.png" -compose screen -composite "$TMP/og-plate.png"
# Logo：圓角磚（同 app tile 一致），避免硬邊方塊貼喺漸變上
convert "$TMP/base.png" -resize 320x320 \
  \( +clone -alpha extract -fill black -colorize 100 -fill white -draw "roundrectangle 0,0 319,319 56,56" \) \
  -alpha off -compose CopyOpacity -composite "$TMP/og-logo.png"
convert "$TMP/og-plate.png" "$TMP/og-logo.png" -geometry +96+155 -composite \
  -font DejaVu-Sans-Bold -pointsize 58 -fill "$CYAN"  -annotate +460+258 "SCOUT APP STORE" \
  -font DejaVu-Sans      -pointsize 32 -fill "#c9d3e6" -annotate +462+322 "Good tools for a better scout life." \
  -font DejaVu-Sans      -pointsize 25 -fill "$GOLD"  -annotate +462+380 "Apps · Flashcards · Slides · Links" \
  -font DejaVu-Sans      -pointsize 23 -fill "#6d7c96" -annotate +96+560 "© SCOUT SYSTEM" \
  -dither None -colors 72 -strip "PNG8:icons/og-image.png"

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
