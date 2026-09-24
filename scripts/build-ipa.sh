#!/usr/bin/env bash
# Builds an unsigned Release .ipa for sideloading with SideStore/AltStore.
# SideStore signs it with your own Apple ID on the iPhone.
# Output: dist/Focus.ipa
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
BUILD_DIR="$ROOT/ios/build"
DIST_DIR="$ROOT/dist"

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

echo "→ Release-Build (unsigniert) …"
xcodebuild \
  -workspace ios/Focus.xcworkspace \
  -scheme Focus \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$BUILD_DIR" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  build | { command -v xcbeautify >/dev/null && xcbeautify || grep -E "error:|warning: .*Focus|BUILD (SUCCEEDED|FAILED)"; }

APP="$BUILD_DIR/Build/Products/Release-iphoneos/Focus.app"
if [ ! -d "$APP" ]; then
  echo "✗ Focus.app nicht gefunden – Build fehlgeschlagen?" >&2
  exit 1
fi

echo "→ Packe Focus.ipa …"
rm -rf "$DIST_DIR" && mkdir -p "$DIST_DIR/Payload"
cp -R "$APP" "$DIST_DIR/Payload/"
(cd "$DIST_DIR" && zip -qry Focus.ipa Payload && rm -rf Payload)

echo "✓ Fertig: $DIST_DIR/Focus.ipa"
