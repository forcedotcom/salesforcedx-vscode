/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Seed the workspace before specs run. One brick owning BOTH post-boot docker-exec writes (plan §7.3):
 *  1. coder.json — point code-server at the bind-mounted fixture project (bypasses the image's
 *     first-boot SFDX_COBU_* generate path, which the CB team owns and can change — ADR 0022).
 *  2. workspace-trust setting — an untrusted workspace opens in Restricted Mode where the Salesforce
 *     extensions don't activate and their commands never register. The setting is workspace-agnostic,
 *     so it covers the mount.
 *
 * The bind MOUNT itself is a `run` param (lifecycle), not seeded here — seed only does the exec
 * writes. Run this AFTER the workbench is up and BEFORE the swap restart, so the host boots opening
 * the fixture in trusted mode.
 */

import type { ContainerHandle } from './lifecycle';
import { defaultRunner, type CommandRunner } from './runner';

/** Default path the fixture project is bind-mounted to (keep in sync with the lifecycle run mount). */
export const FIXTURE_MOUNT_PATH = '/home/codebuilder/fixture-project';

const CODER_JSON = '/home/codebuilder/.local/share/code-server/coder.json';
const USER_SETTINGS = '/home/codebuilder/.local/share/code-server/User/settings.json';

/*
 * The write script. Reads the fixture path from the env var $FIXTURE_PATH (passed via `docker exec
 * -e`), so it's a DATA value — never interpolated into the script and safe for any path. jq -n --arg
 * builds coder.json; jq edits settings.json. Both files are written as the codebuilder user (docker
 * exec runs as root) since start.sh reads them from that home.
 */
const SEED_SCRIPT = `
set -e
coder=${CODER_JSON}
settings=${USER_SETTINGS}
mkdir -p "$(dirname "$coder")" "$(dirname "$settings")"
jq -n --arg folder "$FIXTURE_PATH" '{query: {folder: $folder}}' > "$coder"
# Start from a valid object if settings.json is absent OR not valid JSON (whitespace-only, corrupt),
# so the trust edit below can't silently no-op. Bare 'jq' statements (NOT 'jq ... && mv') so 'set -e'
# aborts loud on a jq failure — with '&&' the jq is the left operand and errexit would NOT fire, and
# the trust setting would be silently skipped (workspace opens Restricted, extensions never activate).
jq -e . "$settings" > /dev/null 2>&1 || echo '{}' > "$settings"
tmp="$(mktemp)"
jq '.["security.workspace.trust.enabled"] = false' "$settings" > "$tmp"
mv "$tmp" "$settings"
chown codebuilder:codebuilder "$coder" "$settings"
`;

export type SeedOptions = {
  /** Where the fixture project is mounted in the container. Defaults to FIXTURE_MOUNT_PATH. */
  fixturePath?: string;
  /** Command runner (injectable for tests). Defaults to real docker via execFileSync. */
  runner?: CommandRunner;
};

/*
 * Write coder.json + disable workspace trust in the container. The fixture path is passed as a
 * container env var (`docker exec -e FIXTURE_PATH=…`), a single argv token — no shell interpolation,
 * so any path is safe.
 */
export const seedWorkspace = (handle: ContainerHandle, options: SeedOptions = {}): void => {
  const runner = options.runner ?? defaultRunner;
  const fixturePath = options.fixturePath ?? FIXTURE_MOUNT_PATH;

  runner('docker', ['exec', '-e', `FIXTURE_PATH=${fixturePath}`, handle.name, 'bash', '-c', SEED_SCRIPT]);
};
