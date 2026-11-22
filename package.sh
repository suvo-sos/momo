#!/bin/bash
# package.sh — build Momo.app and package it for download.
#
# Produces:
#   Momo.dmg   — the download for judges (Momo.app + Applications shortcut)
#   Momo.zip   — fallback for anyone who prefers a zip
#
# Run on a Mac:
#   ./package.sh
# Then upload Momo.dmg to a GitHub Release (see the end of this script's output).
#
# The app is not notarized and carries no Developer ID signature, so macOS
# Gatekeeper will block it on first open on a downloaded copy. That's expected
# for a hackathon build — the README and the release notes carry the one-line
# fix:  xattr -d com.apple.quarantine /Applications/Momo.app
set -euo pipefail
cd "$(dirname "$0")"

APP="Momo.app"
DMG="Momo.dmg"
ZIP="Momo.zip"
STAGE=".dmg-staging"

# 1. Build the app (without restarting the running copy).
echo "→ building"
./build.sh --no-launch

if [[ ! -d "$APP" ]]; then
  echo "error: $APP was not produced" >&2
  exit 1
fi

# 2. Stage the .dmg contents: the app + a shortcut to /Applications.
echo "→ staging"
rm -rf "$STAGE" "$DMG" "$ZIP"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"

# 3. Build the .dmg (compressed, read-only).
echo "→ creating $DMG"
hdiutil create -volname "Momo" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
rm -rf "$STAGE"

# 4. Zip fallback (keeps the app bundle intact, resource forks included).
echo "→ creating $ZIP"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"

echo ""
echo "done:"
ls -lh "$DMG" "$ZIP"
echo ""
echo "Next — publish it as a GitHub Release (one of these):"
echo ""
echo "  gh release create v0.1.1 \"$DMG\" \"$ZIP\" \\"
echo "    --title \"Momo v0.1.1\" \\"
echo "    --notes \"Live macOS portfolio wallpaper. Download Momo.dmg, drag Momo.app to Applications, then run: xattr -d com.apple.quarantine /Applications/Momo.app\""
echo ""
echo "  or: open https://github.com/suvo-sos/momo/releases/new , tag v0.1.1,"
echo "  and drag $DMG (and $ZIP) into the release."
echo ""
echo "The README links to https://github.com/suvo-sos/momo/releases/latest"
echo "so the download button starts working the moment the release is live."
