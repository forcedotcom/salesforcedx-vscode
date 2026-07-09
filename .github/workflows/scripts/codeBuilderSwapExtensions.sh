#!/usr/bin/env bash
# Swap freshly-built monorepo VSIX into a running Code Builder container, then verify.
#
# Runtime extension swap (no code-builder-images changes): for each in-scope extension, remove the
# baked (published-version) override dir, install the built VSIX, then the caller restarts the
# container so the Node extension host boots holding the new versions. A filesystem version gate
# then asserts each in-scope extension resolves to exactly one dir at the built version — activation
# independent, so it cannot false-green on a lazily-activated extension.
#
# Usage: codeBuilderSwapExtensions.sh <container> <vsix-dir>
#   <container>  running container name/id
#   <vsix-dir>   host dir holding the built *.vsix (one per in-scope extension)

set -euo pipefail

CONTAINER="${1:?container name/id required}"
VSIX_DIR="${2:?vsix dir required}"
OVERRIDES_DIR="/base/extension-overrides"

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

echo "==> Removing baked overrides for in-scope extensions"
for id in "${IN_SCOPE_IDS[@]}"; do
  # Override dirs are named "<publisher>.<name>-<version>"; glob strips the version.
  docker exec "$CONTAINER" bash -lc "rm -rf ${OVERRIDES_DIR}/${id}-*" || true
done

echo "==> Installing built VSIX into ${OVERRIDES_DIR}"
for vsix in "$VSIX_DIR"/*.vsix; do
  [ -e "$vsix" ] || { echo "No VSIX found in $VSIX_DIR" >&2; exit 1; }
  base="$(basename "$vsix")"
  docker cp "$vsix" "$CONTAINER:/tmp/${base}"
  docker exec "$CONTAINER" bash -lc \
    "code-server --install-extension /tmp/${base} --extensions-dir ${OVERRIDES_DIR} --force"
done

echo "==> Swap complete. Caller must 'docker restart' before the version gate."
