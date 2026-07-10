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
 *   - op (1Password CLI) signed in — the script fetches the shared SVC_IDEE ghcr pull token from
 *     1Password so no per-dev PAT is needed. (Falls back to a CR_PAT env var if you'd rather supply
 *     your own classic PAT with read:packages, SSO-authorized for forcedotcom.)
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

/*
 * ghcr pull auth: a dedicated read:packages-only PAT for the SVC_IDEE bot lives in 1Password (vault
 * "Platform Dev Tools Team", Secure Note SVC_IDE_BOT_GHCR_READ_TOKEN — token in the notesPlain field).
 * op read resolves it at runtime so the token never lands in the repo. --account pins the Salesforce
 * tenant (devs often have a personal account too, which makes a bare op read ambiguous). Override
 * either via env if they differ.
 */
const GHCR_BOT_USER = 'SVC_IDEE';
const OP_ACCOUNT = process.env.OP_ACCOUNT ?? 'salesforce.1password.com';
const OP_GHCR_ITEM = process.env.OP_GHCR_ITEM ?? 'op://Platform Dev Tools Team/SVC_IDE_BOT_GHCR_READ_TOKEN/notesPlain';

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

// Flipped once the container is actually started, so a preflight bail-out doesn't emit
// teardown noise for a container that never launched.
let containerStarted = false;
const teardown = (): void => {
  rmSync(vsixDir, { recursive: true, force: true });
  if (!containerStarted) {
    return;
  }
  if (opts.teardown) {
    log(`Tearing down container ${CONTAINER_NAME}`);
    spawnSync('docker', ['rm', '-f', CONTAINER_NAME], { stdio: 'ignore' });
  } else {
    log(`Leaving ${CONTAINER_NAME} up (--no-teardown). Workbench: ${CODE_BUILDER_URL}`);
    console.log(`    Remove it later with: docker rm -f ${CONTAINER_NAME}`);
  }
};
process.on('exit', teardown);

/* --- preflight -------------------------------------------------------------
 * Assume a teammate's box has none of the required tooling. Check every external
 * dependency up front, collect ALL problems, and print one consolidated report with
 * copy-paste fixes — a failure five minutes into a container pull is a bad first run.
 */
const onMac = process.platform === 'darwin';
const brewOr = (formula: string, other: string): string => (onMac ? `brew install ${formula}` : other);

const has = (file: string): boolean => spawnSync(file, ['--version'], { stdio: 'ignore' }).status === 0;

/* sf is npx-able (@salesforce/cli), so a missing global install is a warning, not a blocker —
 * fall back to `npx @salesforce/cli`. docker and gh are not npx-able and must be installed. */
const sfInstalled = has('sf');
const sfCmd = (): [string, string[]] => (sfInstalled ? ['sf', []] : ['npx', ['-y', '@salesforce/cli']]);
const runSf = (args: string[], opts: { cwd?: string; stdio?: 'inherit' | 'ignore' } = {}): number => {
  const [file, prefix] = sfCmd();
  return spawnSync(file, [...prefix, ...args], { stdio: opts.stdio ?? 'inherit', cwd: opts.cwd }).status ?? 1;
};
const captureSf = (args: string[]): string => {
  const [file, prefix] = sfCmd();
  return execFileSync(file, [...prefix, ...args], { encoding: 'utf-8' }).trim();
};

const problems: string[] = [];

if (!has('docker')) {
  problems.push(
    `docker — not installed. Needed to run the Code Builder image.\n` +
      `      Install Docker Desktop: ${brewOr('--cask docker', 'https://docs.docker.com/engine/install/')}`
  );
} else if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
  problems.push('docker — installed but the daemon is not running. Start Docker Desktop and re-run.');
}

/*
 * ghcr auth uses the shared SVC_IDEE bot PAT stored in 1Password, fetched via the op CLI — no
 * per-developer token. op is required unless the dev supplies their own CR_PAT override.
 */
if (!has('op') && !process.env.CR_PAT) {
  problems.push(
    `op (1Password CLI) — not installed. Used to fetch the shared ghcr pull token.\n` +
      `      Install: ${brewOr('--cask 1password-cli', 'https://developer.1password.com/docs/cli/get-started/')}\n` +
      `      then sign in (or enable Developer > CLI integration in the 1Password app).\n` +
      `      (Or set CR_PAT to a classic PAT with read:packages, SSO-authorized for forcedotcom.)`
  );
}

if (!sfInstalled) {
  log('sf CLI not found on PATH — falling back to `npx @salesforce/cli` (slower; consider a global install).');
}

if (problems.length > 0) {
  console.error('\nMissing prerequisites — fix these and re-run:\n');
  for (const p of problems) {
    console.error(`  • ${p}\n`);
  }
  process.exit(1);
}

/* --- ghcr login + pull: shared SVC_IDEE bot token from 1Password, no per-dev PAT --- */
const dockerLogin = (user: string, token: string): boolean =>
  // stdin must be a pipe for `input`/--password-stdin to land; 'ignore' would close it and log in blank.
  spawnSync('docker', ['login', 'ghcr.io', '-u', user, '--password-stdin'], {
    input: token,
    stdio: ['pipe', 'ignore', 'ignore']
  }).status === 0;

const OP_FIX =
  `Could not read the ghcr token from 1Password (${OP_GHCR_ITEM}, account ${OP_ACCOUNT}).\n` +
  '    Make sure the 1Password app CLI integration is on (Settings > Developer > "Integrate with 1Password CLI"),\n' +
  '    or run `op signin`, and that you have access to the "Platform Dev Tools Team" vault.\n' +
  '    Override with OP_GHCR_ITEM / OP_ACCOUNT if they differ. (Or set CR_PAT to your own classic PAT.)';

log('Logging in to ghcr.io');
if (process.env.CR_PAT) {
  // Explicit PAT wins if provided (classic PAT with read:packages, SSO-authorized for forcedotcom).
  if (!dockerLogin(GHCR_BOT_USER, process.env.CR_PAT)) {
    console.error('docker login with CR_PAT failed — check the token has read:packages and is SSO-authorized.');
    process.exit(1);
  }
} else {
  // Preflight guaranteed op is installed; fetch the shared bot token it holds.
  const token = tryCapture('op', ['read', '--account', OP_ACCOUNT, OP_GHCR_ITEM]);
  if (!token) {
    console.error(`\n${OP_FIX}`);
    process.exit(1);
  }
  if (!dockerLogin(GHCR_BOT_USER, token)) {
    console.error('docker login to ghcr.io failed with the SVC_IDEE bot token — the token may be expired.');
    process.exit(1);
  }
}

log(`Pulling ${image}`);
if (spawnSync('docker', ['pull', image], { stdio: 'inherit' }).status !== 0) {
  console.error(
    '\nCould not pull the Code Builder image. The SVC_IDEE bot token may be expired or lack read:packages / SSO.'
  );
  process.exit(1);
}

/*
 * The VSIX version isn't release-bumped, so it matches the marketplace build too — the semver can't
 * tell you whether you're testing shipping or pre-release bytes. Log the real provenance instead:
 * for --run-id, the source run's workflow/branch/commit/timestamp; for a local build, your git HEAD.
 */
const logRunProvenance = (runId: string): void => {
  const raw = tryCapture('gh', [
    'run',
    'view',
    runId,
    '-R',
    'forcedotcom/salesforcedx-vscode',
    '--json',
    'workflowName,displayTitle,headBranch,headSha,event,createdAt,url'
  ]);
  log('VSIX under test — provenance');
  if (raw) {
    const m = JSON.parse(raw);
    console.log('    Built by the upstream run:');
    console.log(`      Source run:   ${m.url}`);
    console.log(`      Workflow:     ${m.workflowName}`);
    console.log(`      Trigger:      ${m.event}`);
    console.log(`      Branch:       ${m.headBranch}`);
    console.log(`      Commit:       ${m.headSha}`);
    console.log(`      Commit title: ${m.displayTitle}`);
    console.log(`      Built at:     ${m.createdAt} (UTC)`);
  } else {
    console.log(`    Could not resolve run ${runId} metadata (run may be expired/deleted).`);
  }
  console.log('    NOTE: the VSIX semver is not release-bumped, so it also matches the marketplace build.');
};

const logLocalProvenance = (): void => {
  const sha = tryCapture('git', ['rev-parse', 'HEAD']) ?? 'unknown';
  const branch = tryCapture('git', ['rev-parse', '--abbrev-ref', 'HEAD']) ?? 'unknown';
  const dirty = tryCapture('git', ['status', '--porcelain']);
  log('VSIX under test — provenance');
  console.log('    Built locally from your working tree:');
  console.log(`      Branch:       ${branch}`);
  console.log(`      Commit:       ${sha}${dirty ? ' (+ uncommitted changes)' : ''}`);
  console.log('    NOTE: the VSIX semver is not release-bumped, so it also matches the marketplace build.');
};

/* --- gather the VSIX under test -------------------------------------------- */
if (opts.runId) {
  if (!has('gh')) {
    console.error('--run-id needs the gh CLI to download the artifact. Install gh and run: gh auth login');
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
  logRunProvenance(opts.runId);
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
  logLocalProvenance();
}
const vsixCount = readdirSync(vsixDir).filter(f => f.endsWith('.vsix')).length;
if (vsixCount === 0) {
  console.error('No VSIX found to test');
  process.exit(1);
}
log(`Testing ${vsixCount} VSIX from ${vsixDir}`);

/* --- scratch org ----------------------------------------------------------- */
if (runSf(['org', 'display', '-o', ORG_ALIAS], { stdio: 'ignore' }) === 0) {
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
  const created = runSf(['org', 'create', 'scratch', '-d', '-w', '30', '-a', ORG_ALIAS, '--edition', 'developer'], {
    cwd: proj
  });
  rmSync(proj, { recursive: true, force: true });
  if (created !== 0) {
    console.error('Scratch org create failed — is a dev hub set as default? (sf org login web --set-default-dev-hub)');
    process.exit(1);
  }
}

const orgJson = JSON.parse(captureSf(['org', 'display', '-o', ORG_ALIAS, '--json']));
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
containerStarted = true;

/*
 * Poll for reachability synchronously (the script reads top-to-bottom like the shell original) but
 * without a curl dependency — run the fetch in a short-lived node child. node is guaranteed present
 * since this script is running under it, so there's no extra tool to install.
 */
const reachable = (url: string): boolean =>
  spawnSync(
    process.execPath,
    ['-e', `fetch(process.argv[1]).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`, url],
    {
      stdio: 'ignore'
    }
  ).status === 0;
const sleep = (ms: number): void => {
  spawnSync(process.execPath, ['-e', `setTimeout(()=>{}, ${ms})`]);
};
const waitForWorkbench = (): void => {
  for (let i = 0; i < 60; i++) {
    if (reachable(CODE_BUILDER_URL)) {
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
