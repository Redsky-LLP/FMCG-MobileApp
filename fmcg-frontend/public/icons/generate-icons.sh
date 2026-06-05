#!/bin/bash
# PATH: public/icons/generate-icons.sh
# Run this once after editing icon.svg to produce all required PNG sizes.
#
# Requires ImageMagick (magick) OR Inkscape.
# Install ImageMagick: brew install imagemagick  (Mac)
#                      sudo apt install imagemagick  (Ubuntu)

set -e
cd "$(dirname "$0")"

echo "Generating PNG icons from icon.svg..."

SIZES=(16 32 72 96 128 144 152 167 180 192 384 512)

for size in "${SIZES[@]}"; do
  if command -v magick &>/dev/null; then
    magick icon.svg -resize "${size}x${size}" "icon-${size}.png"
  elif command -v inkscape &>/dev/null; then
    inkscape icon.svg --export-png="icon-${size}.png" --export-width="$size" --export-height="$size" 2>/dev/null
  elif command -v rsvg-convert &>/dev/null; then
    rsvg-convert -w "$size" -h "$size" icon.svg -o "icon-${size}.png"
  else
    echo "ERROR: Install ImageMagick (magick), Inkscape, or librsvg (rsvg-convert)"
    exit 1
  fi
  echo "  ✓ icon-${size}.png"
done

# ── Maskable icon (512x512 with safe-zone padding) ────────────────────────────
# Maskable icons need ~20% padding on each side so the logo isn't clipped
# by Android's circular/rounded-square adaptive icon mask.
# We create a 512x512 canvas with the logo scaled to 72% (centered).
if command -v magick &>/dev/null; then
  magick icon.svg \
    -resize 370x370 \
    -gravity center \
    -background "#2563EB" \
    -extent 512x512 \
    icon-512-maskable.png
  echo "  ✓ icon-512-maskable.png (maskable)"
fi

echo ""
echo "All icons generated. Copy this folder to public/icons/ in your project."
echo ""
echo "For splash screens, use https://appsco.pe/developer/splash-screens"
echo "or https://progressier.com/pwa-icons-and-screenshots-generator"