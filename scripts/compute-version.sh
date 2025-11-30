#!/usr/bin/env sh
set -eu

error() {
  echo "compute-version: $1" >&2
  exit 1
}

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE_JSON="$ROOT_DIR/package.json"

[ -f "$PACKAGE_JSON" ] || error "package.json not found at $PACKAGE_JSON"

BASE_VERSION="$(grep -m1 '"version"' "$PACKAGE_JSON" | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')"
[ -n "$BASE_VERSION" ] || error "could not read version from package.json"

MAJOR_MINOR="$(printf "%s" "$BASE_VERSION" | awk -F. '{print $1 "." $2}')"
[ -n "$MAJOR_MINOR" ] || error "could not parse MAJOR.MINOR from $BASE_VERSION"

if BUILD="$(git rev-list --count HEAD 2>/dev/null)"; then
  :
else
  BUILD="${CI_BUILD_NUMBER:-}"
fi

[ -n "${BUILD:-}" ] || error "could not determine BUILD number (git or CI_BUILD_NUMBER required)"

SHORT_HASH="$(git rev-parse --short=6 HEAD 2>/dev/null || true)"

APP_VERSION="${MAJOR_MINOR}.${BUILD}"
if [ -n "$SHORT_HASH" ]; then
  APP_VERSION="${APP_VERSION}-${SHORT_HASH}"
fi

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "APP_VERSION=$APP_VERSION" >> "$GITHUB_ENV"
fi

mkdir -p "$ROOT_DIR/dist" 2>/dev/null || true
echo "$APP_VERSION" > "$ROOT_DIR/dist/version.txt" 2>/dev/null || true

echo "$APP_VERSION"
