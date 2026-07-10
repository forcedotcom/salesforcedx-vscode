#! /usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * One-command local Code Builder e2e loop — the local twin of .github/workflows/codeBuilderE2E.yml.
 *
 * Stands up the real Code Builder container, swaps in the monorepo extensions under test, and runs
 * the container Playwright specs against it. By default it builds the VSIX from your working tree
 * (so you test your live edits); pass --run-id to pull the exact CI artifact instead.
 *
 * Prereqs:
 *   - docker running
 *   - gh CLI logged in (`gh auth login`) with read:packages — the script adds the scope for you if
 *     it's missing. No manually-managed PAT needed. (Falls back to a CR_PAT env var if gh is absent.)
 *   - sf CLI logged in to a dev hub (for the scratch org)
 *
 * Usage: ts-node scripts/codeBuilderLocalE2E.ts [options]
 *   --run-id <id>     Pull the VSIX from that Build All run instead of building locally.
 *   --grep <pattern>  Pass through to Playwright to run a subset of specs.
 *   --no-teardown     Leave the container + scratch org up for debugging (default tears down).
 *   --keep-org        Reuse an existing `minimalTestOrg` scratch org if present (default reuses).
 *   --image-tag <tag> Code Builder image tag (default: latest).
 *   --debug           Run Playwright headed with the inspector (PWDEBUG=1).
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_DIR = join(REPO_ROOT, 'scripts');
const CONTAINER_NAME = 'codebuilder-e2e-local';
const ORG_ALIAS = 'minimalTestOrg';
const CODE_BUILDER_URL = 'http://localhost:8123';
const ARTIFACT_NAME = 'VS Code Extensions';

type Options = {
  runId?: string;
  grep?: string;
  teardown: boolean;
  imageTag: string;
  debug: boolean;
};

const parseArgs = (argv: string[]): Options => {
  const opts: Options = { teardown: true, imageTag: 'latest', debug: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--run-id':
        opts.runId = argv[++i];
        break;
      case '--grep':
        opts.grep = argv[++i];
        break;
      case '--no-teardown':
        opts.teardown = false;
        break;
      case '--keep-org': // reuse is already the default; kept for discoverability
        break;
      case '--image-tag':
        opts.imageTag = argv[++i];
        break;
      case '--debug':
        opts.debug = true;
        break;
      case '-h':
      case '--help':
        console.log('See header of scripts/codeBuilderLocalE2E.ts for usage.');
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(2);
    }
  }
  return opts;
};

const log = (msg: string): void => console.log(`\n==> ${msg}`);

/* execFileSync wrappers: `run` inherits stdio (side-effect commands), `capture` returns stdout. */
const run = (file: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): void => {
  execFileSync(file, args, { stdio: 'inherit', ...opts });
};
const capture = (file: string, args: string[]): string => execFileSync(file, args, { encoding: 'utf-8' }).trim();
const tryCapture = (file: string, args: string[]): string | null => {
  try {
    return capture(file, args);
  } catch {
    return null;
  }
};

const opts = parseArgs(process.argv.slice(2));
const image = `ghcr.io/forcedotcom/code-builder-images/workspace-manager/codebuilder:${opts.imageTag}`;
const vsixDir = mkdtempSync(join(tmpdir(), 'cb-e2e-vsix-'));

const teardown = (): void => {
  rmSync(vsixDir, { recursive: true, force: true });
  if (opts.teardown) {
    log(`Tearing down container ${CONTAINER_NAME}`);
    spawnSync('docker', ['rm', '-f', CONTAINER_NAME], { stdio: 'ignore' });
  } else {
    log(`Leaving ${CONTAINER_NAME} up (--no-teardown). Workbench: ${CODE_BUILDER_URL}`);
    console.log(`    Remove it later with: docker rm -f ${CONTAINER_NAME}`);
  }
};
process.on('exit', teardown);

/* --- preflight ------------------------------------------------------------- */
if (!tryCapture('docker', ['--version'])) {
  console.error('docker is required');
  process.exit(1);
}
if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
  console.error('docker daemon is not running');
  process.exit(1);
}
if (!tryCapture('sf', ['--version'])) {
  console.error('sf CLI is required');
  process.exit(1);
}

/* --- ghcr login: reuse the dev's gh credential, no manual PAT --------------- */
const ghUser = (): string => tryCapture('gh', ['api', 'user', '-q', '.login']) ?? process.env.USER ?? 'unknown';
const dockerLogin = (token: string): boolean =>
  spawnSync('docker', ['login', 'ghcr.io', '-u', ghUser(), '--password-stdin'], { input: token, stdio: 'ignore' })
    .status === 0;

log('Logging in to ghcr.io');
if (process.env.CR_PAT) {
  // Explicit PAT wins if provided (classic PAT with read:packages, SSO-authorized for forcedotcom).
  if (!dockerLogin(process.env.CR_PAT)) {
    console.error('docker login with CR_PAT failed');
    process.exit(1);
  }
} else if (tryCapture('gh', ['--version'])) {
  const token = tryCapture('gh', ['auth', 'token']);
  if (!token) {
    console.error('gh is installed but not logged in. Run: gh auth login');
    process.exit(1);
  }
  // ghcr pull needs read:packages, which the default gh OAuth token lacks — add it once (browser flow).
  if (!dockerLogin(token)) {
    log('ghcr login failed — adding read:packages to your gh credential (one-time)');
    run('gh', ['auth', 'refresh', '--scopes', 'read:packages']);
    const refreshed = capture('gh', ['auth', 'token']);
    if (!dockerLogin(refreshed)) {
      console.error('ghcr login still failing after refresh — check SSO authorization for forcedotcom.');
      process.exit(1);
    }
  }
} else {
  console.error(
    'Need either the gh CLI (recommended) or a CR_PAT env var (classic PAT, read:packages, SSO-authorized).'
  );
  process.exit(1);
}

log(`Pulling ${image}`);
run('docker', ['pull', image]);

/* --- gather the VSIX under test -------------------------------------------- */
if (opts.runId) {
  if (!tryCapture('gh', ['--version'])) {
    console.error('--run-id needs the gh CLI');
    process.exit(1);
  }
  log(`Downloading VSIX artifact from Build All run ${opts.runId}`);
  run('gh', [
    'run',
    'download',
    opts.runId,
    '-n',
    ARTIFACT_NAME,
    '-D',
    vsixDir,
    '-R',
    'forcedotcom/salesforcedx-vscode'
  ]);
} else {
  log('Building VSIX from your working tree (npm run vscode:package)');
  run('npm', ['run', 'vscode:package'], { cwd: REPO_ROOT });
  // vscode:package drops a .vsix in each package dir; gather them the way CI's Build All does.
  const packagesDir = join(REPO_ROOT, 'packages');
  for (const pkg of readdirSync(packagesDir)) {
    const pkgDir = join(packagesDir, pkg);
    let entries: string[];
    try {
      entries = readdirSync(pkgDir);
    } catch {
      continue;
    }
    for (const f of entries.filter(e => e.endsWith('.vsix'))) {
      cpSync(join(pkgDir, f), join(vsixDir, f));
    }
  }
}
const vsixCount = readdirSync(vsixDir).filter(f => f.endsWith('.vsix')).length;
if (vsixCount === 0) {
  console.error('No VSIX found to test');
  process.exit(1);
}
log(`Testing ${vsixCount} VSIX from ${vsixDir}`);

/* --- scratch org ----------------------------------------------------------- */
if (spawnSync('sf', ['org', 'display', '-o', ORG_ALIAS], { stdio: 'ignore' }).status === 0) {
  log(`Reusing existing scratch org ${ORG_ALIAS}`);
} else {
  log(`Creating scratch org ${ORG_ALIAS}`);
  /*
   * Mirror the documented minimal-org shape (references/local-setup.md): a bare developer-edition
   * scratch org created from a throwaway project, no repo project-scratch-def needed.
   */
  const proj = mkdtempSync(join(tmpdir(), 'cb-e2e-proj-'));
  mkdirSync(join(proj, 'force-app'), { recursive: true });
  const sfdxProject = {
    packageDirectories: [{ path: 'force-app', default: true }],
    namespace: '',
    sfdcLoginUrl: 'https://login.salesforce.com',
    sourceApiVersion: '64.0'
  };
  writeFileSync(join(proj, 'sfdx-project.json'), JSON.stringify(sfdxProject));
  const created = spawnSync(
    'sf',
    ['org', 'create', 'scratch', '-d', '-w', '30', '-a', ORG_ALIAS, '--edition', 'developer'],
    { cwd: proj, stdio: 'inherit' }
  );
  rmSync(proj, { recursive: true, force: true });
  if (created.status !== 0) {
    console.error('Scratch org create failed — is a dev hub set as default? (sf org login ...)');
    process.exit(1);
  }
}

const orgJson = JSON.parse(capture('sf', ['org', 'display', '-o', ORG_ALIAS, '--json']));
const instanceUrl: string = orgJson.result.instanceUrl;
const accessToken: string = orgJson.result.accessToken;

/* --- run container --------------------------------------------------------- */
log(`Starting container ${CONTAINER_NAME}`);
spawnSync('docker', ['rm', '-f', CONTAINER_NAME], { stdio: 'ignore' });
run('docker', [
  'run',
  '-d',
  '--name',
  CONTAINER_NAME,
  '-e',
  `SF_ACCESS_TOKEN=${accessToken}`,
  '-e',
  `INSTANCE_URL=${instanceUrl}`,
  '-e',
  'SFDX_COBU_PROJECTNAME=e2e-project',
  '-e',
  'SFDX_COBU_TEMPLATE=standard',
  '-p',
  '8123:58080',
  image
]);

const sleep = (ms: number): void => {
  // Synchronous sleep so the linear script reads top-to-bottom like the shell original.
  spawnSync('sleep', [String(ms / 1000)]);
};
const waitForWorkbench = (): void => {
  for (let i = 0; i < 60; i++) {
    if (spawnSync('curl', ['-fsS', CODE_BUILDER_URL], { stdio: 'ignore' }).status === 0) {
      return;
    }
    sleep(2000);
  }
  console.error(`Code Builder never became reachable at ${CODE_BUILDER_URL}`);
  spawnSync('docker', ['logs', CONTAINER_NAME], { stdio: 'inherit' });
  process.exit(1);
};
log('Waiting for workbench');
waitForWorkbench();

/* --- swap, restart, gate (shared with CI) ---------------------------------- */
log('Disabling workspace trust');
run('docker', [
  'exec',
  CONTAINER_NAME,
  'bash',
  '-lc',
  `
  set -e
  f=/home/codebuilder/.local/share/code-server/User/settings.json
  mkdir -p "$(dirname "$f")"; [ -s "$f" ] || echo "{}" > "$f"
  tmp="$(mktemp)"; jq ".\\"security.workspace.trust.enabled\\" = false" "$f" > "$tmp" && mv "$tmp" "$f"
  chown codebuilder:codebuilder "$f"
`
]);

log('Swapping in built extensions');
run('ts-node', [join(SCRIPT_DIR, 'codeBuilderSwapExtensions.ts'), CONTAINER_NAME, vsixDir], { cwd: REPO_ROOT });

log('Restarting container (applies swap + re-auths org)');
run('docker', ['restart', CONTAINER_NAME]);
waitForWorkbench();

log('Verifying extension versions (gate)');
run('ts-node', [join(SCRIPT_DIR, 'codeBuilderVerifyExtensions.ts'), CONTAINER_NAME, vsixDir], { cwd: REPO_ROOT });

/* --- run the specs --------------------------------------------------------- */
log('Running container Playwright specs');
const testArgs = ['run', 'test:container', '-w', 'salesforcedx-vscode-core', '--', '--reporter=html'];
if (opts.grep) {
  testArgs.push('--grep', opts.grep);
}
const testEnv: NodeJS.ProcessEnv = { ...process.env, CODE_BUILDER_URL };
if (opts.debug) {
  testEnv.PWDEBUG = '1';
}
const specs = spawnSync('npm', testArgs, { cwd: REPO_ROOT, stdio: 'inherit', env: testEnv });
const rc = specs.status ?? 1;

if (rc !== 0) {
  log(`Specs failed (exit ${rc}). Container logs:`);
  const logs = tryCapture('docker', ['logs', CONTAINER_NAME]);
  if (logs) {
    console.log(logs.split('\n').slice(-40).join('\n'));
  }
  console.log('    HTML report: packages/salesforcedx-vscode-core/playwright-report/index.html');
}
process.exit(rc);
