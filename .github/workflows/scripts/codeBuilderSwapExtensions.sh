#!/usr/bin/env bash
# Swap the monorepo VSIX under test into a Code Builder container, then verify.
#
# Runtime extension swap (no code-builder-images changes): for each in-scope extension, remove the
# baked (published-version) override dir and unpack the VSIX under test into a same-shaped dir. We
# unzip directly rather than `code-server --install-extension` because the CLI talks to the live
# extension host, which refuses to reinstall an already-registered Extension Pack ("Please restart
# VS Code before reinstalling ..."). Unzipping mirrors the baked layout exactly, so the caller's
# `docker restart` then boots the host holding the new versions. A filesystem version gate asserts
# each in-scope extension resolves to exactly one dir at that version.
#
# Usage: codeBuilderSwapExtensions.sh <container> <vsix-dir>
#   <container>  running container name/id
#   <vsix-dir>   host dir holding the *.vsix under test (one per in-scope extension)

set -euo pipefail

CONTAINER="${1:?container name/id required}"
VSIX_DIR="${2:?vsix dir required}"
OVERRIDES_DIR="/base/extension-overrides"
# Runtime extensions dir code-server actually loads from. start.sh symlinks each override here, but
# only when the override is a strictly-newer semver than what's already linked (see
# _extensions-to-replace.js). On a restart the published-version symlink is already present, so a
# same-or-lower VSIX-under-test would never re-link and the host would load nothing. Clearing the
# in-scope entries here makes start.sh treat each swapped override as new and link it fresh.
RUNTIME_EXT_DIR="/home/codebuilder/.local/share/code-server/extensions"

# In-scope: the monorepo-built extensions Code Builder installs. Publisher is always `salesforce`.
# Keep in sync with the VSIX produced by `vscode:package` across the monorepo.
IN_SCOPE_IDS=(
  salesforce.salesforcedx-vscode
  salesforce.salesforcedx-vscode-apex
  salesforce.salesforcedx-vscode-apex-oas
  salesforce.salesforcedx-vscode-apex-replay-debugger
  salesforce.salesforcedx-vscode-apex-testing
  salesforce.salesforcedx-vscode-core
  salesforce.salesforcedx-vscode-expanded
  salesforce.salesforcedx-vscode-lightning
  salesforce.salesforcedx-vscode-lwc
  salesforce.salesforcedx-vscode-org
  salesforce.salesforcedx-vscode-soql
  salesforce.salesforcedx-vscode-visualforce
)

echo "==> Removing baked overrides + runtime symlinks for in-scope extensions"
for id in "${IN_SCOPE_IDS[@]}"; do
  # Override dirs are named "<publisher>.<name>-<version>"; glob strips the version. Clear both the
  # override source and the runtime symlink so start.sh re-links the swapped version on restart.
  docker exec "$CONTAINER" bash -lc "rm -rf ${OVERRIDES_DIR}/${id}-* ${RUNTIME_EXT_DIR}/${id}-*" || true
done

echo "==> Unpacking VSIX under test into ${OVERRIDES_DIR}"
for vsix in "$VSIX_DIR"/*.vsix; do
  [ -e "$vsix" ] || { echo "No VSIX found in $VSIX_DIR" >&2; exit 1; }
  base="$(basename "$vsix" .vsix)"   # salesforcedx-vscode-core-67.4.0
  version="${base##*-}"              # 67.4.0
  name="${base%-*}"                  # salesforcedx-vscode-core
  dir="salesforce.${name}-${version}"

  # A VSIX is a zip with the extension rooted under extension/. Unpack that into a same-named
  # override dir so package.json lands at the dir root, matching the baked layout the host scans.
  docker cp "$vsix" "$CONTAINER:/tmp/${base}.vsix"
  docker exec "$CONTAINER" bash -lc "
    set -e
    rm -rf /tmp/x && mkdir -p /tmp/x
    if command -v unzip >/dev/null 2>&1; then
      unzip -q /tmp/${base}.vsix -d /tmp/x
    else
      python3 -c 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' /tmp/${base}.vsix /tmp/x
    fi
    rm -rf ${OVERRIDES_DIR}/${dir}
    mv /tmp/x/extension ${OVERRIDES_DIR}/${dir}
    rm -rf /tmp/x /tmp/${base}.vsix
  "
  echo "  unpacked ${dir}"
done

echo "==> Swap complete. Caller must 'docker restart' before the version gate."
