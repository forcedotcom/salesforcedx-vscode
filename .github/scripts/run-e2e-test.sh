#!/bin/bash
set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <spec_path>"
    echo "Example: $0 packages/salesforcedx-vscode-automation-tests/lib/test/specs/mytest.e2e.js"
    exit 1
fi

SPEC_PATH="$1"

echo "Running E2E test for spec: $SPEC_PATH"
cd salesforcedx-vscode
npm run compile
npm run gha-automation-tests --spec "$SPEC_PATH"
echo "E2E test completed successfully"
