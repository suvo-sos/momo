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
    <key>CFBundleShortVersionString</key><string>0.1.0</string>
    <key>CFBundleVersion</key>           <string>1</string>
    <key>LSMinimumSystemVersion</key>    <string>13.0</string>
    <key>LSUIElement</key>               <true/>
    <key>NSHighResolutionCapable</key>   <true/>
    <key>NSHumanReadableCopyright</key>  <string>Momo · CMC API Hackathon 2026</string>
</dict>
</plist>
PLIST

echo "→ signing (ad-hoc)"
codesign --force --deep -s - "$APP" 2>/dev/null || echo "  (codesign skipped)"

echo "done: $(pwd)/$APP"
