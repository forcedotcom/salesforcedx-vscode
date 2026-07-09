#!/usr/bin/env bash
# Version gate: assert each in-scope extension is installed at the built version, exactly once.
#
# Reads the on-disk package.json in each override dir (activation-independent — reflects what the
# host loads, unlike "Show Running Extensions" which omits un-activated extensions). Fails loud on
# any mismatch or leftover published-version dir, so specs never run against stale code.
#
# Usage: codeBuilderVerifyExtensions.sh <container> <vsix-dir>

set -euo pipefail

CONTAINER="${1:?container name/id required}"
VSIX_DIR="${2:?vsix dir required}"
OVERRIDES_DIR="/base/extension-overrides"

# Built versions come from the monorepo package.json values baked into the VSIX filenames
# (vsce names them "<name>-<version>.vsix"). Derive expected id→version from the VSIX dir so the
# gate has a single source of truth and needs no hardcoded version.
declare -A EXPECTED
for vsix in "$VSIX_DIR"/*.vsix; do
  [ -e "$vsix" ] || { echo "No VSIX found in $VSIX_DIR" >&2; exit 1; }
  base="$(basename "$vsix" .vsix)"          # e.g. salesforcedx-vscode-core-67.4.0
  version="${base##*-}"                     # 67.4.0
  name="${base%-*}"                         # salesforcedx-vscode-core
  EXPECTED["salesforce.${name}"]="$version"
done

fail=0
for id in "${!EXPECTED[@]}"; do
  want="${EXPECTED[$id]}"

  # Exactly one override dir per id (a leftover published-version dir would be a second match).
  dirs="$(docker exec "$CONTAINER" bash -lc "ls -d ${OVERRIDES_DIR}/${id}-* 2>/dev/null || true")"
  count="$(printf '%s\n' "$dirs" | grep -c . || true)"
  if [ "$count" -ne 1 ]; then
    echo "FAIL ${id}: expected exactly 1 override dir, found ${count}: ${dirs//$'\n'/ }"
    fail=1
    continue
  fi

  got="$(docker exec "$CONTAINER" bash -lc "cat ${dirs}/package.json | jq -r .version")"
  if [ "$got" != "$want" ]; then
    echo "FAIL ${id}: installed version ${got}, expected built version ${want}"
    fail=1
  else
    echo "OK   ${id}@${got}"
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "::error::Code Builder extension version gate failed — container is running wrong/mixed versions." >&2
  exit 1
fi
echo "==> Version gate passed: all in-scope extensions at built versions."
