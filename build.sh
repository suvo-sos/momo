#!/bin/bash
# Build Momo.app — a double-clickable, ad-hoc signed bundle.
set -euo pipefail
cd "$(dirname "$0")"

APP="Momo.app"
BIN="momo"

echo "→ compiling"
swiftc -O -o "$BIN" main.swift MomoFeed.swift -framework Cocoa -framework WebKit

echo "→ assembling $APP"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cp "$BIN" "$APP/Contents/MacOS/momo"
cp skin.html "$APP/Contents/Resources/skin.html"
cp settings.html "$APP/Contents/Resources/settings.html"
cp assets/AppIcon.icns "$APP/Contents/Resources/Momo.icns"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>              <string>Momo</string>
    <key>CFBundleDisplayName</key>       <string>Momo</string>
    <key>CFBundleIdentifier</key>        <string>com.suvog.momo</string>
    <key>CFBundleExecutable</key>        <string>momo</string>
    <key>CFBundlePackageType</key>       <string>APPL</string>
    <key>CFBundleShortVersionString</key><string>0.1.1</string>
    <key>CFBundleVersion</key>           <string>2</string>
    <key>LSMinimumSystemVersion</key>    <string>13.0</string>
    <key>LSUIElement</key>               <true/>
    <key>CFBundleIconFile</key>           <string>Momo</string>
    <key>NSHighResolutionCapable</key>   <true/>
    <key>NSHumanReadableCopyright</key>  <string>Momo · CMC API Hackathon 2026</string>
</dict>
</plist>
PLIST

echo "→ signing (ad-hoc)"
codesign --force --deep -s - "$APP" 2>/dev/null || echo "  (codesign skipped)"

# Restart the running copy so a build always ends with the new binary live.
# `./build.sh --no-launch` builds without touching what is running.
if [[ "${1:-}" != "--no-launch" ]]; then
  echo "→ restarting Momo"
  pkill -f "Momo.app/Contents/MacOS/momo" 2>/dev/null || true
  sleep 0.4
  open -a "$(pwd)/$APP" || open "$(pwd)/$APP"
fi

echo "done: $(pwd)/$APP"
