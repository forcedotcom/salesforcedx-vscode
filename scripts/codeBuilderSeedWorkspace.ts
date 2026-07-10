#! /usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Point code-server at the mounted fixture project so container specs open a workspace with real
 * metadata. The fixture is bind-mounted into the container by the caller's `docker run -v` (at
 * FIXTURE_MOUNT_PATH); this script just writes coder.json so the workbench opens that folder.
 *
 * We deliberately bypass the image's SFDX_COBU_PROJECTNAME generate path: that runs once on first
 * boot behind the ~/.codebuilder gate, generates a bare empty project, and lives in image code the
 * CB team owns and can change. Writing coder.json ourselves — the same docker-exec lever used to
 * disable workspace trust and swap extensions — is applied every run and depends on nothing inside
 * the image except that code-server reads coder.json. See ADR 0022.
 *
 * Call this AFTER the workbench is reachable and BEFORE the swap restart, so the restart boots the
 * host already pointed at the fixture. Changing the opened folder means the disable-trust step and
 * the workbench-ready wait must target this same path, or the workspace opens untrusted and the
 * Salesforce extensions never activate.
 *
 * Usage: ts-node scripts/codeBuilderSeedWorkspace.ts <container>
 */

import { execFileSync } from 'node:child_process';

/*
 * Where the caller bind-mounts test/playwright/fixtures/container-workspace. NOT /home/codebuilder/
 * e2e-project: mounting over that path would collide with `sfdx project generate --output-dir
 * /home/codebuilder` (a non-empty dir aborts generate under `set -eo pipefail`), so we mount to a
 * fresh path and skip SFDX_COBU_PROJECTNAME entirely. Keep in sync with the -v flag in the workflow
 * and codeBuilderLocalE2E.ts.
 */
export const FIXTURE_MOUNT_PATH = '/home/codebuilder/fixture-project';

const container = process.argv[2];
if (!container) {
  console.error('Usage: codeBuilderSeedWorkspace.ts <container>');
  process.exit(2);
}

console.log(`==> Pointing code-server at the mounted fixture (${FIXTURE_MOUNT_PATH})`);
execFileSync(
  'docker',
  [
    'exec',
    container,
    'bash',
    '-lc',
    `
    set -e
    # docker exec runs as root; write the codebuilder user's coder.json (the file start.sh reads),
    # not root's. jq builds the JSON so the mount path is a data value, never interpolated as script.
    f=/home/codebuilder/.local/share/code-server/coder.json
    mkdir -p "$(dirname "$f")"
    jq -n --arg folder "${FIXTURE_MOUNT_PATH}" '{query: {folder: $folder}}' > "$f"
    chown codebuilder:codebuilder "$f"
  `
  ],
  { stdio: 'inherit' }
);
console.log('==> Fixture wired. Caller must restart before specs so the workbench opens it.');
