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

APP_VERSION="${MAJOR_MINOR}.${BUILD}"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "APP_VERSION=$APP_VERSION" >> "$GITHUB_ENV"
fi

echo "$APP_VERSION"
