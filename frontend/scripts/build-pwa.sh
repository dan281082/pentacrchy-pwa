#!/usr/bin/env bash
# Builds the production Pentarchy Vial PWA for app.ap3p-fitness.com.
# Usage: bash scripts/build-pwa.sh [https://app.ap3p-fitness.com]
# Output: /app/pwa-release/pentarchy-vial-pwa.zip — upload & extract into the
# subdomain's public_html (SiteGround File Manager).
set -euo pipefail
ORIGIN="${1:-https://app.ap3p-fitness.com}"
cd "$(dirname "$0")/.."
OUT=/tmp/pentarchy-pwa
rm -rf "$OUT"
# Bake the PRODUCTION API origin (same-domain /api/glp proxy). The temporary
# preview server is never referenced in this build.
EXPO_PUBLIC_BACKEND_URL="$ORIGIN" npx expo export -p web --output-dir "$OUT" --clear
cp -r pwa/api "$OUT/api"
cp pwa/.htaccess "$OUT/.htaccess"
if grep -rq "preview.emergentagent.com" "$OUT/_expo" "$OUT/index.html"; then
  echo "ERROR: build still references the preview server" >&2; exit 1
fi
mkdir -p /app/pwa-release
rm -f /app/pwa-release/pentarchy-vial-pwa.zip
(cd "$OUT" && zip -qr /app/pwa-release/pentarchy-vial-pwa.zip . -x "metadata.json")
echo "Built for $ORIGIN → /app/pwa-release/pentarchy-vial-pwa.zip"
