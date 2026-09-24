#!/usr/bin/env bash
# Builds an unsigned .ipa for sideloading with SideStore/AltStore.
# SideStore signs it with your own Apple ID on the iPhone.
#
#   ./scripts/build-ipa.sh         Release → dist/Focus.ipa
#   ./scripts/build-ipa.sh --dev   Debug   → dist/FocusDev.ipa ("Focus Dev",
#                                  own bundle id, loads JS live from Metro
#                                  on this Mac over Wi-Fi: Fast Refresh)
set -euo pipefail

MODE=release
if [ "${1:-}" = "--dev" ]; then
  MODE=dev
fi

cd "$(dirname "$0")/.."
ROOT="$PWD"
DIST_DIR="$ROOT/dist"
if [ "$MODE" = dev ]; then
  CONFIGURATION=Debug
  BUILD_DIR="$ROOT/ios/build-dev"
  IPA_NAME=FocusDev
else
  CONFIGURATION=Release
  BUILD_DIR="$ROOT/ios/build"
  IPA_NAME=Focus
fi

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "✗ Xcode fehlt oder ist nicht ausgewählt." >&2
  echo "  1. Xcode aus dem App Store installieren und einmal öffnen" >&2
  echo "  2. sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
  echo "  3. sudo xcodebuild -license accept" >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "→ npm install"
  npm install
fi

if [ ! -f ios/Pods/Manifest.lock ] || [ ios/Podfile -nt ios/Pods/Manifest.lock ]; then
  echo "→ pod install"
  if command -v pod >/dev/null; then
    # CocoaPods from Homebrew (brew install cocoapods) – avoids macOS system Ruby.
    (cd ios && pod install)
  else
    (cd ios && bundle install && bundle exec pod install)
  fi
fi

# Version from package.json, build number = commit count. Every new commit
# is therefore a higher build, which is how SideStore recognises updates.
VERSION="${FOCUS_VERSION:-$(node -p "require('./package.json').version")}"
BUILD_NUMBER="${FOCUS_BUILD:-$(git rev-list --count HEAD 2>/dev/null || echo 1)}"

echo "→ $CONFIGURATION-Build $VERSION ($BUILD_NUMBER), unsigniert …"
xcodebuild \
  -workspace ios/Focus.xcworkspace \
  -scheme Focus \
  -configuration "$CONFIGURATION" \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$BUILD_DIR" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  MARKETING_VERSION="$VERSION" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  build | { command -v xcbeautify >/dev/null && xcbeautify || grep -E "error:|warning: .*Focus|BUILD (SUCCEEDED|FAILED)"; }

APP="$BUILD_DIR/Build/Products/$CONFIGURATION-iphoneos/Focus.app"
if [ ! -d "$APP" ]; then
  echo "✗ Focus.app nicht gefunden – Build fehlgeschlagen?" >&2
  exit 1
fi

if [ "$MODE" = dev ]; then
  # Separate app next to the real Focus, so the daily app never depends
  # on the Mac. Changed after the build: the app is unsigned anyway.
  PLIST="$APP/Info.plist"
  /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.justin25313.focus.dev" "$PLIST"
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Focus Dev" "$PLIST"
fi

echo "→ Packe $IPA_NAME.ipa …"
mkdir -p "$DIST_DIR"
rm -rf "$DIST_DIR/Payload" "$DIST_DIR/$IPA_NAME.ipa" && mkdir -p "$DIST_DIR/Payload"
cp -R "$APP" "$DIST_DIR/Payload/"
(cd "$DIST_DIR" && zip -qry "$IPA_NAME.ipa" Payload && rm -rf Payload)

if [ "$MODE" = dev ]; then
  echo "✓ Fertig: $DIST_DIR/FocusDev.ipa"
  echo "  AirDrop → SideStore. Danach am Mac 'npm start' – Focus Dev lädt"
  echo "  Änderungen live (gleiches WLAN, lokales Netzwerk erlauben)."
  exit 0
fi

cp ios/Focus/Images.xcassets/AppIcon.appiconset/AppIcon-1024.png "$DIST_DIR/icon.png"
printf '%s\n%s\n' "$VERSION" "$BUILD_NUMBER" > "$DIST_DIR/version.txt"

echo "✓ Fertig: $DIST_DIR/Focus.ipa ($VERSION, Build $BUILD_NUMBER)"
