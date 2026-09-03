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
# jq preflight: the whole script hard-depends on jq and the CB image is team-owned + changeable
# (ADR 0022). Without this, an image missing jq aborts with an opaque "jq: command not found"; fail
# early with a clear, greppable message instead.
command -v jq >/dev/null 2>&1 || { echo "seed: jq not found in container (SEED_SCRIPT requires jq)" >&2; exit 127; }
coder=${CODER_JSON}
settings=${USER_SETTINGS}
mkdir -p "$(dirname "$coder")" "$(dirname "$settings")"

# coder.json: build in a temp then atomically mv into place so a concurrent reader never sees a
# partial file. Bare statements (NOT 'jq ... && mv') so 'set -e' aborts loud on a jq failure.
ctmp="$(mktemp)"
jq -n --arg folder "$FIXTURE_PATH" '{query: {folder: $folder}}' > "$ctmp"
mv "$ctmp" "$coder"

# settings.json (disable workspace trust): ONE atomic read-modify-write. Read the current settings,
# defaulting to {} if the file is absent OR not valid JSON (so the edit can't silently no-op), apply
# the trust edit in a single jq, then mv into place. The mv is the ONLY mutation of settings.json —
# there is no separate truncating 'echo > settings' that could clobber a concurrent code-server
# write (the check-then-write race). Bare statements so 'set -e' catches a jq failure.
stmp="$(mktemp)"
current="$(jq . "$settings" 2>/dev/null || echo '{}')"
printf '%s' "$current" | jq '.["security.workspace.trust.enabled"] = false' > "$stmp"
mv "$stmp" "$settings"

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

  // Cross-check the fixture path against the container's REAL mounts (recorded by `run`) instead of
  // trusting the FIXTURE_MOUNT_PATH "keep in sync" comment. A caller who mounts the fixture at a
  // custom containerPath but forgets to pass the matching fixturePath here would otherwise write a
  // coder.json pointing at a non-mounted folder — code-server opens an empty dir and specs fail with
  // a confusing "no SFDX project" far from the cause. Skip when no mounts were recorded.
  const mountPaths = handle.mounts.map(m => m.containerPath);
  if (mountPaths.length > 0 && !mountPaths.includes(fixturePath)) {
    throw new Error(
      `seedWorkspace: fixturePath "${fixturePath}" is not a container mount (mounted: ${mountPaths.join(', ')}). ` +
        'Pass the same containerPath you gave run()\'s mounts, or omit fixturePath to use the default.'
    );
  }

  try {
    runner('docker', ['exec', '-e', `FIXTURE_PATH=${fixturePath}`, handle.name, 'bash', '-c', SEED_SCRIPT]);
  } catch (err) {
    // Parity with waitForWorkbench's diagnostics: a bare exec failure (jq missing, chown/mkdir fails)
    // otherwise surfaces downstream as "extensions didn't activate" with no context. Append docker
    // logs (best-effort) so the real cause travels with the thrown error.
    let logs = '';
    try {
      logs = runner('docker', ['logs', handle.name]);
    } catch {
      /* best-effort */
    }
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`seedWorkspace failed for container "${handle.name}": ${detail}\n${logs}`);
  }
};
