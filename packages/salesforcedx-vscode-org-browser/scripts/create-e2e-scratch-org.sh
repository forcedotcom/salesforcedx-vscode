#!/usr/bin/env bash
#
# Create a scratch org matching org-browser E2E test expectations.
# Alias, metadata, and permset match .github/workflows/orgBrowserE2E.yml and
# playwright-vscode-ext dreamhouseScratchOrgSetup.
#
# Prereqs: authenticated Dev Hub (sf org login web --set-default-dev-hub or similar)
#
# Usage: ./scripts/create-e2e-scratch-org.sh

set -euo pipefail

DREAMHOUSE_ORG_ALIAS="${DREAMHOUSE_ORG_ALIAS:-orgBrowserDreamhouseTestOrg}"
DREAMHOUSE_REPO="https://github.com/trailheadapps/dreamhouse-lwc"

REPO_DIR="$(mktemp -d -t dh-lwc-XXXXXX)"
trap 'rm -rf "$REPO_DIR"' EXIT

echo "Cloning dreamhouse-lwc..."
git clone --depth=1 "$DREAMHOUSE_REPO" "$REPO_DIR"

echo "Creating scratch org (alias=$DREAMHOUSE_ORG_ALIAS)..."
(cd "$REPO_DIR" && sf org create scratch -y 1 -d -f config/project-scratch-def.json -a "$DREAMHOUSE_ORG_ALIAS" --json --wait 30)

echo "Deploying metadata..."
(cd "$REPO_DIR" && sf project deploy start)

echo "Assigning permset dreamhouse..."
sf org assign permset -n dreamhouse -o "$DREAMHOUSE_ORG_ALIAS"

echo "Done. Org alias: $DREAMHOUSE_ORG_ALIAS"
echo "Run E2E: DREAMHOUSE_ORG_ALIAS=$DREAMHOUSE_ORG_ALIAS npm run test:web -w salesforcedx-vscode-org-browser"
