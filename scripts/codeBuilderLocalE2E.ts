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
 * This script is the thin, IDEx-specific orchestrator (plan §9.2): the docker lifecycle, org
 * boot-env, seed, swap, and verify gate all live as reusable utilities in the published
 * `@salesforce/playwright-vscode-ext` package (stories 1–3). Everything that stays here is
 * repo-specific wiring — ghcr auth as the dev's own GitHub user, VSIX sourcing/dedup, the scratch
 * org, and the constants (publisher prefix, image ref, fixture path). Because it composes the real
 * utilities against the real image, this script IS the real-docker integration test (plan §15).
 *
 * Prereqs:
 *   - docker running
 *   - gh (GitHub CLI) logged in to github.com — the script pulls the private image as your own
 *     GitHub user (your team has read on the image repo; the package inherits it). Your gh token
 *     needs the read:packages scope; if it doesn't, the script tells you the one-line refresh.
 *     (Falls back to a CR_PAT env var if you'd rather supply your own classic PAT.)
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

import {
  assertVerified,
  FIXTURE_MOUNT_PATH,
  pull,
  resolveOrgBootEnv,
  restart,
  run as runContainer,
  seedWorkspace,
  swap,
  teardown,
  type CommandRunner,
  type ContainerHandle
} from '@salesforce/playwright-vscode-ext';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');
const CONTAINER_NAME = 'codebuilder-e2e-local';
const ORG_ALIAS = 'minimalTestOrg';
// Host port the workbench is published on. The container serves code-server on CONTAINER_PORT
// (58080); the lifecycle `run` maps this host port to it.
const PUBLISHED_PORT = 8123;
const CODE_BUILDER_URL = `http://localhost:${PUBLISHED_PORT}`;
// Publisher prefix swap wipes + installs under (plan §9.2 — repo-specific, not in the utilities).
const PUBLISHER_PREFIX = 'salesforce';
const ARTIFACT_NAME = 'VS Code Extensions';

/*
 * Checked-in fixture project bind-mounted into the container so specs open a workspace with real
 * metadata. The mount path is FIXTURE_MOUNT_PATH from the toolkit (seedWorkspace writes coder.json
 * to point code-server at it), so host and container agree on one constant. The fixture itself is
 * delivered with the container specs (story 6); this orchestrator only mounts it.
 */
const FIXTURE_HOST_DIR = join(
  REPO_ROOT,
  'packages',
  'salesforcedx-vscode-core',
  'test',
  'playwright',
  'fixtures',
  'container-workspace'
);

type Options = {
  runId?: string;
  grep?: string;
  teardown: boolean;
  imageTag: string;
  debug: boolean;
};

const parseArgs = (argv: string[]): Options => {
  const parsed: Options = { teardown: true, imageTag: 'latest', debug: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--run-id':
        parsed.runId = argv[++i];
        break;
      case '--grep':
        parsed.grep = argv[++i];
        break;
      case '--no-teardown':
        parsed.teardown = false;
        break;
      case '--keep-org': // reuse is already the default; kept for discoverability
        break;
      case '--image-tag':
        parsed.imageTag = argv[++i];
        break;
      case '--debug':
        parsed.debug = true;
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
  return parsed;
};

const log = (msg: string): void => console.log(`\n==> ${msg}`);

/* execFileSync wrappers: `sh` inherits stdio (side-effect commands), `capture` returns stdout. */
const sh = (file: string, args: string[], shOpts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): void => {
  execFileSync(file, args, { stdio: 'inherit', ...shOpts });
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

// Set once the container is actually started, so a preflight bail-out doesn't emit teardown noise
// for a container that never launched. Holds the typed handle the toolkit teardown needs.
let handle: ContainerHandle | undefined;
const cleanup = (): void => {
  rmSync(vsixDir, { recursive: true, force: true });
  if (!handle) {
    return;
  }
  if (opts.teardown) {
    log(`Tearing down container ${CONTAINER_NAME}`);
    teardown(handle);
  } else {
    log(`Leaving ${CONTAINER_NAME} up (--no-teardown). Workbench: ${CODE_BUILDER_URL}`);
    console.log(`    Remove it later with: docker rm -f ${CONTAINER_NAME}`);
  }
};
process.on('exit', cleanup);

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
const runSf = (args: string[], sfOpts: { cwd?: string; stdio?: 'inherit' | 'ignore' } = {}): number => {
  const [file, prefix] = sfCmd();
  return spawnSync(file, [...prefix, ...args], { stdio: sfOpts.stdio ?? 'inherit', cwd: sfOpts.cwd }).status ?? 1;
};
/*
 * A CommandRunner (the toolkit's injection seam) that routes `sf` through the npx fallback when sf
 * isn't on PATH, so resolveOrgBootEnv works on a box without a global sf install — the same
 * convenience the scratch-org helpers below rely on. Non-`sf` files pass straight through.
 */
const sfRunner: CommandRunner = (file, args) => {
  if (file === 'sf') {
    const [f, prefix] = sfCmd();
    return execFileSync(f, [...prefix, ...args], { encoding: 'utf-8' });
  }
  return execFileSync(file, args, { encoding: 'utf-8' });
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
 * ghcr auth uses your own GitHub identity via the gh CLI — the team has read on the image repo and
 * the package inherits it, so no shared token. gh is required unless the dev supplies a CR_PAT.
 */
if (!process.env.CR_PAT) {
  if (!has('gh')) {
    problems.push(
      `gh (GitHub CLI) — not installed. Used to authenticate the image pull as your GitHub user.\n` +
        `      Install: ${brewOr('gh', 'https://github.com/cli/cli#installation')}, then: gh auth login\n` +
        `      (Or set CR_PAT to a classic PAT with read:packages, SSO-authorized for forcedotcom.)`
    );
  } else if (spawnSync('gh', ['auth', 'status', '-h', 'github.com'], { stdio: 'ignore' }).status !== 0) {
    problems.push('gh (GitHub CLI) — not logged in to github.com. Run: gh auth login');
  }
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

/* --- ghcr login: your own GitHub identity via gh, no shared token ---------- */
const dockerLogin = (user: string, token: string): boolean =>
  // stdin must be a pipe for `input`/--password-stdin to land; 'ignore' would close it and log in blank.
  spawnSync('docker', ['login', 'ghcr.io', '-u', user, '--password-stdin'], {
    input: token,
    stdio: ['pipe', 'ignore', 'ignore']
  }).status === 0;

log('Logging in to ghcr.io');
if (process.env.CR_PAT) {
  // Explicit PAT wins if provided (classic PAT with read:packages, SSO-authorized for forcedotcom).
  // GitHub accepts any non-empty username with a PAT, so 'oauth' is a safe placeholder here.
  if (!dockerLogin('oauth', process.env.CR_PAT)) {
    console.error('docker login with CR_PAT failed — the token is empty or malformed.');
    process.exit(1);
  }
} else {
  // Preflight guaranteed gh is installed and logged in to github.com. Pull as the dev's own user.
  const user = tryCapture('gh', ['api', 'user', '-q', '.login']);
  const token = tryCapture('gh', ['auth', 'token', '-h', 'github.com']);
  if (!user || !token) {
    console.error('Could not read your GitHub identity from gh — run `gh auth login` and re-run.');
    process.exit(1);
  }
  // Login validates the credential, not its scopes — it succeeds even without read:packages. The
  // scope (and repo-access) check happens at pull time below, so a scope problem surfaces there.
  if (!dockerLogin(user, token)) {
    console.error('docker login to ghcr.io failed — your gh credential looks invalid. Try `gh auth login`.');
    process.exit(1);
  }
}

/* --- pull the image (toolkit lifecycle) ------------------------------------ */
log(`Pulling ${image}`);
try {
  pull(image);
} catch {
  console.error(
    '\nCould not pull the Code Builder image (a 403 here is usually a missing scope, not bad creds).\n' +
      '    ghcr requires the read:packages scope, which a default `gh auth login` does not request. Add it:\n' +
      '        gh auth refresh -h github.com -s read:packages\n' +
      '    then re-run. If it still fails, your GitHub account may lack read on the image repo.\n' +
      '    (Or set CR_PAT to a classic PAT with read:packages, SSO-authorized for forcedotcom.)'
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

/*
 * vsce names the VSIX "<name>-<version>.vsix" from package.json (not the dir name). Some packages
 * (core, lwc, lightning, apex-debugger, apex-oas) also build a legacy VSIX pinned to an older
 * version (e.g. 67.0.0) alongside the modern one; collecting both would unpack two override dirs
 * per extension and fail the verify gate ("found 2 override dirs"). So resolve each package's own
 * modern (own-version) VSIX name and keep only that, skipping the legacy dupe. Returns null for a
 * dir with no readable package.json (not an extension dir).
 */
const modernVsixName = (pkgDir: string): string | null => {
  try {
    const { name, version } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf-8'));
    if (!name || !version) {
      return null;
    }
    return `${name}-${version}.vsix`;
  } catch {
    return null;
  }
};

/* --- gather the VSIX under test -------------------------------------------- */
if (opts.runId) {
  if (!has('gh')) {
    console.error('--run-id needs the gh CLI to download the artifact. Install gh and run: gh auth login');
    process.exit(1);
  }
  log(`Downloading VSIX artifact from Build All run ${opts.runId}`);
  sh('gh', [
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
  sh('npm', ['run', 'vscode:package'], { cwd: REPO_ROOT });
  // vscode:package drops a .vsix in each package dir; gather them the way CI's Build All does,
  // keeping only each package's own-version (modern) VSIX (see modernVsixName).
  const packagesDir = join(REPO_ROOT, 'packages');
  for (const pkg of readdirSync(packagesDir)) {
    const pkgDir = join(packagesDir, pkg);
    let entries: string[];
    try {
      entries = readdirSync(pkgDir);
    } catch {
      continue;
    }
    const modernVsix = modernVsixName(pkgDir);
    for (const f of entries.filter(e => e === modernVsix)) {
      cpSync(join(pkgDir, f), join(vsixDir, f));
    }
  }
  logLocalProvenance();
}
const vsixPaths = readdirSync(vsixDir)
  .filter(f => f.endsWith('.vsix'))
  .map(f => join(vsixDir, f));
if (vsixPaths.length === 0) {
  console.error('No VSIX found to test');
  process.exit(1);
}
log(`Testing ${vsixPaths.length} VSIX from ${vsixDir}`);

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

// Boot env for the container's start-time org login. resolveOrgBootEnv reads the REAL access token
// from `sf org auth show-access-token` (not the redacted `org display`) — the #7718 lesson, now
// encapsulated in the toolkit. Routed through sfRunner for the npx-sf fallback.
const bootEnv = resolveOrgBootEnv(ORG_ALIAS, { runner: sfRunner });

/* --- stand up + swap + gate (all via the toolkit) -------------------------- */
const main = async (): Promise<number> => {
  log(`Starting container ${CONTAINER_NAME}`);
  // A stale container from a prior --no-teardown run would collide on the name; clear it first.
  spawnSync('docker', ['rm', '-f', CONTAINER_NAME], { stdio: 'ignore' });
  // run resolves only once the workbench answers (readiness is folded into the toolkit lifecycle),
  // and tears its own container down if it never comes up — so a returned handle is always healthy.
  handle = await runContainer({
    name: CONTAINER_NAME,
    imageRef: image,
    publishedPort: PUBLISHED_PORT,
    url: CODE_BUILDER_URL,
    bootEnv,
    // No SFDX_COBU_PROJECTNAME — that generate path would collide with the mount and only runs first
    // boot. seedWorkspace points code-server at the mount instead.
    mounts: [{ hostPath: FIXTURE_HOST_DIR, containerPath: FIXTURE_MOUNT_PATH }]
  });

  // Point code-server at the mounted fixture + disable workspace trust (one toolkit exec does both).
  log('Seeding workspace (point code-server at the mounted fixture, disable workspace trust)');
  seedWorkspace(handle);

  // Swap the built VSIXes into the override dirs and capture the manifest the gate checks against.
  log('Swapping in built extensions');
  const manifest = swap(handle.name, vsixPaths, { publisherPrefix: PUBLISHER_PREFIX });

  // One restart re-scans the overrides (applies the swap) AND re-runs the image's org auth.
  log('Restarting container (applies swap + re-auths org)');
  await restart(handle);

  // Gate: assert every extension is present exactly once at the expected version AND bytes. A
  // mismatch means the swap did not take, not a spec bug — assertVerified throws loud saying so.
  log('Verifying extension versions (gate)');
  assertVerified(handle.name, manifest);

  /* --- run the specs ------------------------------------------------------- */
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
  return rc;
};

main()
  .then(rc => process.exit(rc))
  .catch(err => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
