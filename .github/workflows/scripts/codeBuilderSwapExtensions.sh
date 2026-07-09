#!/usr/bin/env bash
# Swap the monorepo VSIX under test into a running Code Builder container, then verify.
#
# Runtime extension swap (no code-builder-images changes): for each in-scope extension, remove the
# baked (published-version) override dir, install the VSIX under test, then the caller restarts the
# container so the Node extension host boots holding the new versions. A filesystem version gate
# then asserts each in-scope extension resolves to exactly one dir at that version — activation
# independent, so it cannot false-green on a lazily-activated extension.
#
# Usage: codeBuilderSwapExtensions.sh <container> <vsix-dir>
#   <container>  running container name/id
#   <vsix-dir>   host dir holding the *.vsix under test (one per in-scope extension)

set -euo pipefail

CONTAINER="${1:?container name/id required}"
VSIX_DIR="${2:?vsix dir required}"
OVERRIDES_DIR="/base/extension-overrides"
# Where code-server serves; used to wait out the mid-swap restart.
CODE_BUILDER_URL="${CODE_BUILDER_URL:-http://localhost:8123}"

wait_for_workbench() {
  for _ in $(seq 1 60); do
    curl -fsS "$CODE_BUILDER_URL" >/dev/null 2>&1 && return 0
    sleep 2
  done
  echo "Code Builder never became reachable at $CODE_BUILDER_URL after restart" >&2
  return 1
}

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

# code-server refuses to reinstall an extension the live host still has registered
# ("Please restart VS Code before reinstalling ..."). Restart after clearing the overrides so
# the host boots without them, then install into a host with no conflicting registration.
echo "==> Restarting container to clear stale extension registrations"
docker restart "$CONTAINER" >/dev/null
wait_for_workbench

echo "==> Installing VSIX under test into ${OVERRIDES_DIR}"
for vsix in "$VSIX_DIR"/*.vsix; do
  [ -e "$vsix" ] || { echo "No VSIX found in $VSIX_DIR" >&2; exit 1; }
  base="$(basename "$vsix")"
  docker cp "$vsix" "$CONTAINER:/tmp/${base}"
  docker exec "$CONTAINER" bash -lc \
    "code-server --install-extension /tmp/${base} --extensions-dir ${OVERRIDES_DIR} --force"
done

echo "==> Swap complete. Caller must 'docker restart' before the version gate."
