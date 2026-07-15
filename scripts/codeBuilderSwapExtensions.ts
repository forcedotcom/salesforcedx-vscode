#! /usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Swap the monorepo VSIX under test into a running Code Builder container.
 *
 * Runtime extension swap (no code-builder-images changes): for each in-scope extension, remove the
 * baked (published-version) override dir and unpack the VSIX under test into a same-shaped dir. We
 * unzip directly rather than `code-server --install-extension` because the CLI talks to the live
 * extension host, which refuses to reinstall an already-registered Extension Pack ("Please restart
 * VS Code before reinstalling ..."). Unzipping mirrors the baked layout exactly, so the caller's
 * `docker restart` then boots the host holding the new versions. Run codeBuilderVerifyExtensions.ts
 * after the restart to gate on the swapped versions.
 *
 * Usage: ts-node scripts/codeBuilderSwapExtensions.ts <container> <vsix-dir>
 *   <container>  running container name/id
 *   <vsix-dir>   host dir holding the *.vsix under test (one per in-scope extension)
 */

import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { readdirSync } from 'node:fs';

const OVERRIDES_DIR = '/base/extension-overrides';

/*
 * Runtime extensions dir code-server actually loads from. start.sh symlinks each override here, but
 * only when the override is a strictly-newer semver than what's already linked (see
 * _extensions-to-replace.js). On a restart the published-version symlink is already present, so a
 * same-or-lower VSIX-under-test would never re-link and the host would load nothing. Clearing the
 * in-scope entries here makes start.sh treat each swapped override as new and link it fresh.
 */
const RUNTIME_EXT_DIR = '/home/codebuilder/.local/share/code-server/extensions';

/*
 * In-scope: the monorepo-built extensions Code Builder installs. Publisher is always `salesforce`.
 * Keep in sync with the VSIX produced by `vscode:package` across the monorepo.
 */
const IN_SCOPE_IDS = [
  'salesforce.salesforcedx-vscode',
  'salesforce.salesforcedx-vscode-apex',
  'salesforce.salesforcedx-vscode-apex-oas',
  'salesforce.salesforcedx-vscode-apex-replay-debugger',
  'salesforce.salesforcedx-vscode-apex-testing',
  'salesforce.salesforcedx-vscode-core',
  'salesforce.salesforcedx-vscode-expanded',
  'salesforce.salesforcedx-vscode-lightning',
  'salesforce.salesforcedx-vscode-lwc',
  'salesforce.salesforcedx-vscode-org',
  'salesforce.salesforcedx-vscode-soql',
  'salesforce.salesforcedx-vscode-visualforce'
];

const container = process.argv[2];
const vsixDir = process.argv[3];
if (!container || !vsixDir) {
  console.error('Usage: codeBuilderSwapExtensions.ts <container> <vsix-dir>');
  process.exit(2);
}

/* Run a shell one-liner inside the container as a single login shell. */
const dockerBash = (script: string, opts: { allowFail?: boolean } = {}): void => {
  try {
    execFileSync('docker', ['exec', container, 'bash', '-lc', script], { stdio: 'inherit' });
  } catch (err) {
    if (!opts.allowFail) {
      throw err;
    }
  }
};

const vsixFiles = readdirSync(vsixDir)
  .filter(f => f.endsWith('.vsix'))
  .map(f => `${vsixDir}/${f}`);
if (vsixFiles.length === 0) {
  console.error(`No VSIX found in ${vsixDir}`);
  process.exit(1);
}

console.log('==> Removing baked overrides + runtime symlinks for in-scope extensions');
for (const id of IN_SCOPE_IDS) {
  /*
   * Override dirs are named "<publisher>.<name>-<version>"; glob strips the version. Clear both the
   * override source and the runtime symlink so start.sh re-links the swapped version on restart.
   */
  dockerBash(`rm -rf ${OVERRIDES_DIR}/${id}-* ${RUNTIME_EXT_DIR}/${id}-*`, { allowFail: true });
}

console.log(`==> Unpacking VSIX under test into ${OVERRIDES_DIR}`);
for (const vsix of vsixFiles) {
  const base = basename(vsix, '.vsix'); // salesforcedx-vscode-core-67.4.0
  const version = base.slice(base.lastIndexOf('-') + 1); // 67.4.0
  const name = base.slice(0, base.lastIndexOf('-')); // salesforcedx-vscode-core
  const dir = `salesforce.${name}-${version}`;

  /*
   * A VSIX is a zip with the extension rooted under extension/. Unpack that into a same-named
   * override dir so package.json lands at the dir root, matching the baked layout the host scans.
   */
  execFileSync('docker', ['cp', vsix, `${container}:/tmp/${base}.vsix`], { stdio: 'inherit' });
  dockerBash(`
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
  `);
  console.log(`  unpacked ${dir}`);
}

console.log("==> Swap complete. Caller must 'docker restart' before the version gate.");
