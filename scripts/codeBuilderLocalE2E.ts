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
 * Env: set CB_SKIP_GHCR_LOGIN=1 when the caller has already `docker login`-ed to ghcr (e.g. CI,
 * which authenticates with its GITHUB_TOKEN) so this script skips its own gh/CR_PAT login.
 *
 * Usage: ts-node scripts/codeBuilderLocalE2E.ts [options]
 *   --run-id <id>     Pull the VSIX from that Build All run instead of building locally.
 *   --grep <pattern>  Pass through to Playwright to run a subset of specs.
 *   --only <pkgs>     Run only these package suite(s) (comma-separated, e.g. salesforcedx-vscode-lwc).
 *                     The CI matrix passes one per job to shard the suite under the job timeout.
 *   --no-teardown     Leave the container + scratch org up for debugging (default tears down).
 *   --keep-org        Reuse an existing `minimalTestOrg` scratch org if present (default reuses).
 *   --image-tag <tag> Code Builder image tag (default: latest).
 *   --debug           Run Playwright headed with the inspector (PWDEBUG=1).
 */

import {
  assertVerified,
  createMinimalOrg,
  FIXTURE_MOUNT_PATH,
  MINIMAL_ORG_ALIAS,
  resolveOrgBootEnv,
  restart,
  run as runContainer,
  seedWorkspace,
  swap,
  teardown,
  type BootEnv,
  type CommandRunner,
  type ContainerHandle
} from '@salesforce/playwright-vscode-ext';
import { type ChildProcess, execFileSync, spawn, spawnSync } from 'node:child_process';
import { closeSync, cpSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');
// Read from env so the orchestrator and the CI workflow's cleanup step (`docker rm -f
// "$CONTAINER_NAME"`) share one name — mirroring ORG_ALIAS below. Otherwise a rename in one file
// silently desyncs from the other and the cleanup's `|| true` quietly no-ops against a stale name,
// leaking an orphaned container on the runner. Falls back to the local default.
const CONTAINER_NAME = process.env.CONTAINER_NAME ?? 'codebuilder-e2e-local';
// Reuse the toolkit's minimal-org alias so createMinimalOrg (used below) and this orchestrator agree
// on one org, and so the CI workflow's create + cleanup steps target the same alias (the workflow
// sets MINIMAL_ORG_ALIAS to this same literal). createMinimalOrg pins this alias internally, so we
// adopt its exported constant rather than an env override it would ignore.
const ORG_ALIAS = MINIMAL_ORG_ALIAS;
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

/*
 * A SECOND, deliberately non-SFDX fixture (no sfdx-project.json). Mounted alongside the DX fixture so
 * the orchestrator can, after the standard container suites run, re-seed coder.json to point
 * code-server here + restart() — giving the "no project open" visibility suites
 * (test:container:noproject) the workspace shape they need. Kept as its own mount (not a subfolder of
 * the DX fixture) so opening it never sees the DX project's sfdx-project.json up the tree.
 */
const NOPROJECT_FIXTURE_HOST_DIR = join(
  REPO_ROOT,
  'packages',
  'salesforcedx-vscode-core',
  'test',
  'playwright',
  'fixtures',
  'container-noproject'
);
/** Where the non-project fixture is bind-mounted in the container (distinct from FIXTURE_MOUNT_PATH). */
const NOPROJECT_MOUNT_PATH = '/home/codebuilder/noproject-workspace';

/*
 * A THIRD fixture: a DX project whose sfdx-project.json lists TWO packageDirectories (force-app +
 * extra-pkg), each with a `classes` folder. Mounted alongside the other two so the orchestrator can,
 * after the standard suites run, re-seed coder.json to point code-server here + restart() — giving the
 * multi-package suites (test:container:multipackage, e.g. apex-log apexGenerateClassMultiPackageDirs)
 * the workspace shape they need (the output-dir picker must list BOTH package dirs' classes folders).
 * Kept as its own mount (not a second packageDirectories entry on the SHARED container-workspace
 * fixture) so the other apex specs' single-package class/trigger-create flows never start prompting a
 * dir picker.
 */
const MULTIPACKAGE_FIXTURE_HOST_DIR = join(
  REPO_ROOT,
  'packages',
  'salesforcedx-vscode-core',
  'test',
  'playwright',
  'fixtures',
  'container-multipackage'
);
/** Where the multi-package fixture is bind-mounted in the container (distinct from the other mounts). */
const MULTIPACKAGE_MOUNT_PATH = '/home/codebuilder/multipackage-workspace';

type Options = {
  runId?: string;
  grep?: string;
  teardown: boolean;
  imageTag: string;
  debug: boolean;
  // Restrict the run to these package(s) (comma-separated). Undefined runs every discovered suite.
  // The CI workflow shards per-package by passing one name per matrix job so the full suite fits in
  // the job timeout; locally you can scope to the package you're iterating on.
  only?: string[];
};

const parseArgs = (argv: string[]): Options => {
  const parsed: Options = { teardown: true, imageTag: 'latest', debug: false };
  // A value-consuming flag given without its value (e.g. trailing `--run-id`) would otherwise read
  // `undefined` and fall through silently — `--run-id` with no value would quietly do a local build
  // instead of the intended artifact run. A flag directly followed by another flag (`--run-id
  // --debug`) is the same mistake: it would swallow `--debug` as the value. Reject both by rejecting a
  // value that begins with `--`, since every flag here is `--xxx`. We deliberately do NOT reject a
  // single leading `-`: that is a legitimate value (e.g. `--grep '-@slow'`, a regex starting with a
  // hyphen), which the stricter `startsWith('-')` check wrongly refused.
  const need = (flag: string, value: string | undefined): string => {
    if (value === undefined || value.startsWith('--')) {
      console.error(`Option ${flag} requires a value.`);
      process.exit(2);
    }
    return value;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--run-id':
        parsed.runId = need('--run-id', argv[++i]);
        break;
      case '--grep':
        parsed.grep = need('--grep', argv[++i]);
        break;
      case '--only':
        parsed.only = need('--only', argv[++i])
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
        break;
      case '--no-teardown':
        parsed.teardown = false;
        break;
      case '--keep-org': // reuse is already the default; kept for discoverability
        break;
      case '--image-tag':
        parsed.imageTag = need('--image-tag', argv[++i]);
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

/*
 * Every external command carries a timeout so a wedged `gh`/`git`/`sf`/`docker` call can't hang the
 * whole loop forever (the toolkit's own CommandRunner does the same). Metadata reads are quick, so a
 * couple of minutes is a generous ceiling; the long-running VSIX build/download get their own larger
 * ceilings where they're spawned.
 */
const CAPTURE_TIMEOUT_MS = 2 * 60_000;
const BUILD_TIMEOUT_MS = 30 * 60_000;
const DOWNLOAD_TIMEOUT_MS = 15 * 60_000;
// The image pull and the per-package spec run get generous ceilings — high enough never to trip a
// healthy run, low enough to kill a truly wedged child instead of hanging the loop forever (the
// header's "every external command carries a timeout" guarantee). The pull runs async (see runAsync)
// so its timer fires on time; the specs spawnSync timeout is OS-enforced on the child.
const PULL_TIMEOUT_MS = 15 * 60_000;
const SPECS_TIMEOUT_MS = 35 * 60_000;

/* execFileSync wrappers: `capture` returns stdout; both bound by a timeout so nothing hangs forever. */
const capture = (file: string, args: string[]): string =>
  execFileSync(file, args, { encoding: 'utf-8', timeout: CAPTURE_TIMEOUT_MS }).trim();
const tryCapture = (file: string, args: string[]): string | null => {
  try {
    return capture(file, args);
  } catch {
    return null;
  }
};

/*
 * Async, timeout-guarded child runner for the long, backgroundable steps (VSIX build/download and
 * the image pull). Several can be in flight at once (build + pull overlap), so we track them in a Set
 * and SIGKILL any survivors in cleanup. Output goes straight to a per-child log file (not a pipe we'd
 * have to drain) to avoid pipe-buffer backpressure stalling the child, and is surfaced only on
 * failure. Logs live under vsixDir, which cleanup removes.
 */
const activeChildren = new Set<ChildProcess>();
const runAsync = (file: string, args: string[], asyncOpts: { cwd?: string; timeoutMs: number }): Promise<void> =>
  new Promise((res, rej) => {
    const logFile = join(vsixDir, `child-${activeChildren.size}-${Date.now()}.log`);
    const fd = openSync(logFile, 'w');
    const child = spawn(file, args, { cwd: asyncOpts.cwd, stdio: ['ignore', fd, fd] });
    activeChildren.add(child);
    let settled = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, asyncOpts.timeoutMs);
    const finish = (err?: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      closeSync(fd);
      activeChildren.delete(child);
      if (err) {
        try {
          process.stderr.write(readFileSync(logFile, 'utf-8'));
        } catch {
          /* best-effort log dump */
        }
        rej(err);
      } else {
        res();
      }
    };
    child.on('error', err => finish(err));
    child.on('close', code => {
      if (timedOut) {
        finish(new Error(`${file} ${args.join(' ')} timed out after ${asyncOpts.timeoutMs}ms`));
      } else if (code === 0) {
        finish();
      } else {
        finish(new Error(`${file} ${args.join(' ')} exited ${code ?? 'null'}`));
      }
    });
  });

const opts = parseArgs(process.argv.slice(2));
const image = `ghcr.io/forcedotcom/code-builder-images/workspace-manager/codebuilder:${opts.imageTag}`;
const vsixDir = mkdtempSync(join(tmpdir(), 'cb-e2e-vsix-'));

// Set once the container is actually started, so a preflight bail-out doesn't emit teardown noise
// for a container that never launched. Holds the typed handle the toolkit teardown needs.
let handle: ContainerHandle | undefined;
const cleanup = (): void => {
  // Backgrounded children (VSIX build/download, image pull) may still be running if setup failed out
  // from under them; SIGKILL any survivors so a fatal path doesn't orphan a multi-minute child.
  for (const child of activeChildren) {
    child.kill('SIGKILL');
  }
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
// Node's 'exit' event does NOT fire on a default-disposition signal, so a Ctrl-C (SIGINT) or a
// `docker`/CI kill (SIGTERM) mid-run would otherwise leave the container up (holding the port and a
// live org token) and the temp dir on disk. Route both through process.exit so `cleanup` runs.
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

/* --- preflight -------------------------------------------------------------
 * Assume a teammate's box has none of the required tooling. Check every external
 * dependency up front, collect ALL problems, and print one consolidated report with
 * copy-paste fixes — a failure five minutes into a container pull is a bad first run.
 */
const onMac = process.platform === 'darwin';
const brewOr = (formula: string, other: string): string => (onMac ? `brew install ${formula}` : other);

const has = (file: string): boolean => spawnSync(file, ['--version'], { stdio: 'ignore' }).status === 0;

/* sf is npx-able (@salesforce/cli), so a missing global install is a warning, not a blocker for the
 * calls this script makes directly (resolveOrgBootEnv, via sfRunner below) — fall back to
 * `npx @salesforce/cli`. Note: the toolkit's createMinimalOrg invokes `sf` directly, so org
 * create/reuse still needs a real sf install. docker and gh are not npx-able and must be installed. */
const sfInstalled = has('sf');
const sfCmd = (): [string, string[]] => (sfInstalled ? ['sf', []] : ['npx', ['-y', '@salesforce/cli']]);
/*
 * A CommandRunner (the toolkit's injection seam) that routes `sf` through the npx fallback when sf
 * isn't on PATH, so resolveOrgBootEnv works on a box without a global sf install — the same
 * convenience the scratch-org helpers below rely on. Non-`sf` files pass straight through.
 */
const sfRunner: CommandRunner = (file, args) => {
  // Bound like capture() above — resolveOrgBootEnv's `sf org auth show-access-token` is a quick
  // metadata read, so CAPTURE_TIMEOUT_MS is a generous ceiling that still prevents an indefinite hang.
  if (file === 'sf') {
    const [f, prefix] = sfCmd();
    return execFileSync(f, [...prefix, ...args], { encoding: 'utf-8', timeout: CAPTURE_TIMEOUT_MS });
  }
  return execFileSync(file, args, { encoding: 'utf-8', timeout: CAPTURE_TIMEOUT_MS });
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
 *
 * CB_SKIP_GHCR_LOGIN opts out entirely: the caller has already `docker login`-ed to ghcr (CI does
 * this with its GITHUB_TOKEN), so this script relies on that ambient auth and neither logs in nor
 * requires gh for login. gh may still be needed for --run-id, which re-checks it at download time.
 */
if (!process.env.CB_SKIP_GHCR_LOGIN && !process.env.CR_PAT) {
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

/*
 * Every package whose package.json declares a `test:container` script. The orchestrator swaps ALL
 * built extensions into the ONE running container, so each package's container specs drive that same
 * live workbench. Discovering the suites from the packages themselves keeps this self-maintaining —
 * adding a container suite to a new package wires it in with no edit here. core sorts first (its
 * specs smoke-test the mounted fixture), the rest alphabetically.
 */
const discoverPackagesWithScript = (scriptName: string): string[] => {
  const packagesDir = join(REPO_ROOT, 'packages');
  const CORE = 'salesforcedx-vscode-core';
  return readdirSync(packagesDir)
    .filter(pkg => {
      try {
        // Untyped JSON.parse to match this file's other package.json reads (e.g. modernVsixName).
        const { scripts } = JSON.parse(readFileSync(join(packagesDir, pkg, 'package.json'), 'utf-8'));
        return Boolean(scripts?.[scriptName]);
      } catch {
        return false;
      }
    })
    .toSorted((a, b) => (a === CORE ? -1 : b === CORE ? 1 : a.localeCompare(b)));
};

/** The standard (DX-project-shape) container suites — every package declaring `test:container`. */
const discoverContainerPackages = (): string[] => discoverPackagesWithScript('test:container');

/* --- gather the VSIX under test (backgroundable) --------------------------- */
const acquireVsix = async (): Promise<string[]> => {
  if (opts.runId) {
    // `gh run download` needs gh both INSTALLED and AUTHENTICATED. The preflight only checks gh auth
    // when it owns the login (skipped under CB_SKIP_GHCR_LOGIN / CR_PAT — exactly the CI path, which
    // always passes --run-id), so re-check both here. Otherwise an expired/under-scoped token sails
    // through and surfaces only as a raw crash from `gh run download` mid-run.
    if (!has('gh')) {
      console.error('--run-id needs the gh CLI to download the artifact. Install gh and run: gh auth login');
      process.exit(1);
    }
    if (spawnSync('gh', ['auth', 'status', '-h', 'github.com'], { stdio: 'ignore' }).status !== 0) {
      console.error(
        '--run-id needs gh authenticated to github.com — run `gh auth login` (or refresh an expired token).'
      );
      process.exit(1);
    }
    log(`Downloading VSIX artifact from Build All run ${opts.runId}`);
    await runAsync(
      'gh',
      ['run', 'download', opts.runId, '-n', ARTIFACT_NAME, '-D', vsixDir, '-R', 'forcedotcom/salesforcedx-vscode'],
      { timeoutMs: DOWNLOAD_TIMEOUT_MS }
    );
    logRunProvenance(opts.runId);
  } else {
    log('Building VSIX from your working tree (npm run vscode:package) — running alongside docker + org setup');
    await runAsync('npm', ['run', 'vscode:package'], { cwd: REPO_ROOT, timeoutMs: BUILD_TIMEOUT_MS });
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
  return vsixPaths;
};

/*
 * Pull the image asynchronously (via spawn) rather than the toolkit's synchronous `pull`: an async
 * child doesn't block the event loop — so the concurrent VSIX build/download timer fires on time —
 * and it can overlap the org create/reuse below. Retry a few times to ride out a transient ghcr
 * hiccup, matching the retry the toolkit's synchronous runner gave the old `pull` call.
 */
const pullImage = async (): Promise<void> => {
  log(`Pulling ${image}`);
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await runAsync('docker', ['pull', image], { timeoutMs: PULL_TIMEOUT_MS });
      return;
    } catch {
      if (attempt < attempts) {
        log(`Image pull attempt ${attempt}/${attempts} failed; retrying…`);
      }
    }
  }
  if (process.env.CB_SKIP_GHCR_LOGIN) {
    // Login here was the caller's ambient `docker login` (in CI, the job GITHUB_TOKEN), not gh/CR_PAT,
    // so the gh/CR_PAT remediation would point at the wrong cause. A 403 means that ambient login lacks
    // read on the image repo, or the requested tag does not exist.
    console.error(
      `\nCould not pull ${image} (CB_SKIP_GHCR_LOGIN set — relying on the caller's ambient docker login).\n` +
        '    A 403 here means that login (in CI, the job GITHUB_TOKEN) lacks read on the image repo, or the\n' +
        "    image tag does not exist. Check the job's packages:read permission and the --image-tag value."
    );
  } else {
    console.error(
      '\nCould not pull the Code Builder image (a 403 here is usually a missing scope, not bad creds).\n' +
        '    ghcr requires the read:packages scope, which a default `gh auth login` does not request. Add it:\n' +
        '        gh auth refresh -h github.com -s read:packages\n' +
        '    then re-run. If it still fails, your GitHub account may lack read on the image repo.\n' +
        '    (Or set CR_PAT to a classic PAT with read:packages, SSO-authorized for forcedotcom.)'
    );
  }
  process.exit(1);
};

/*
 * Ensure the minimal scratch org exists, delegating to the toolkit's createMinimalOrg (used by nearly
 * every other package's fixtures) instead of hand-rolling the temp-project + `sf org create scratch`
 * scaffolding. It reuses an existing minimalTestOrg when present and otherwise creates one — EXCEPT in
 * CI, where createMinimalOrg's requireOrgInCI intentionally refuses to create, so the
 * codeBuilderE2E.yml workflow creates the org up front (matching coreE2E et al.) and this call just
 * reuses it. Async, so it overlaps the image pull.
 */
const ensureOrg = async (): Promise<void> => {
  log(`Ensuring scratch org ${ORG_ALIAS} (reuse if present, else create)`);
  await createMinimalOrg();
};

/* --- ghcr login (sync, quick) + image pull + scratch org (async, overlapped) --- */
const setUpInfra = async (): Promise<BootEnv> => {
  if (process.env.CB_SKIP_GHCR_LOGIN) {
    // The caller already authenticated docker to ghcr (e.g. CI's `docker login` with GITHUB_TOKEN).
    log('Skipping ghcr login (CB_SKIP_GHCR_LOGIN set — using ambient docker auth)');
  } else if (process.env.CR_PAT) {
    log('Logging in to ghcr.io');
    // Explicit PAT wins if provided (classic PAT with read:packages, SSO-authorized for forcedotcom).
    // GitHub accepts any non-empty username with a PAT, so 'oauth' is a safe placeholder here.
    if (!dockerLogin('oauth', process.env.CR_PAT)) {
      console.error('docker login with CR_PAT failed — the token is empty or malformed.');
      process.exit(1);
    }
  } else {
    log('Logging in to ghcr.io');
    // Preflight guaranteed gh is installed and logged in to github.com. Pull as the dev's own user.
    const user = tryCapture('gh', ['api', 'user', '-q', '.login']);
    const token = tryCapture('gh', ['auth', 'token', '-h', 'github.com']);
    if (!user || !token) {
      console.error('Could not read your GitHub identity from gh — run `gh auth login` and re-run.');
      process.exit(1);
    }
    // Login validates the credential, not its scopes — it succeeds even without read:packages. The
    // scope (and repo-access) check happens at pull time, so a scope problem surfaces there.
    if (!dockerLogin(user, token)) {
      console.error('docker login to ghcr.io failed — your gh credential looks invalid. Try `gh auth login`.');
      process.exit(1);
    }
  }

  // The image pull and the org create/reuse are independent multi-minute operations — run them
  // concurrently (both async, so neither blocks the event loop or the other). pullImage exits the
  // process on its own failure; a failure from createMinimalOrg surfaces here.
  try {
    await Promise.all([pullImage(), ensureOrg()]);
  } catch (err) {
    console.error(`Scratch org setup failed: ${err instanceof Error ? err.message : String(err)}`);
    console.error(
      '    In CI the org must be created by the workflow first; locally, ensure a dev hub is set as default\n' +
        '    (sf org login web --set-default-dev-hub).'
    );
    process.exit(1);
  }

  // Boot env for the container's start-time org login. resolveOrgBootEnv reads the REAL access token
  // from `sf org auth show-access-token` (not the redacted `org display`) — the #7718 lesson, now
  // encapsulated in the toolkit. Routed through sfRunner for the npx-sf fallback.
  return resolveOrgBootEnv(ORG_ALIAS, { runner: sfRunner });
};

/*
 * Auth additional pre-created orgs INTO the running container (beyond the boot org). The image's boot
 * script authenticates only one org (SF_ACCESS_TOKEN/INSTANCE_URL); multi-org specs (org picker/switch,
 * non-tracking, Dreamhouse) need more. `CB_EXTRA_ORG_ALIASES` (comma-separated host aliases the CI
 * workflow pre-created) drives this: for each we resolve its access token + instance URL on the host
 * and run `sf org login access-token` INSIDE the container so the alias resolves there too. Called
 * AFTER the restart (the restart re-runs the image's boot org auth, which re-initializes the auth dir
 * and would wipe an earlier login); the org extension reads the org list fresh on each picker open, so
 * a login before the specs run is enumerated without a window reload. No-op when the env var is unset.
 * The boot org stays the default; specs that switch to an extra org save/restore the default themselves.
 */
const authExtraOrgsIntoContainer = (containerName: string): void => {
  const aliases = (process.env.CB_EXTRA_ORG_ALIASES ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (aliases.length === 0) {
    return;
  }
  // Exec as the `codebuilder` user (NOT the default root): the workbench/extension run as codebuilder
  // and read its ~/.sf, so a login done as root (in /root/.sf) is invisible to the org picker. A bash
  // LOGIN shell (`-lc`) sources codebuilder's profile so `sf` is on PATH and HOME=/home/codebuilder.
  // SF_*_DISABLE_TELEMETRY suppresses the CLI first-run notice; extraEnv carries the org access token.
  const execInContainer = (script: string, extraEnv: Record<string, string> = {}) => {
    const envArgs = Object.entries({
      SF_DISABLE_TELEMETRY: 'true',
      SFDX_DISABLE_TELEMETRY: 'true',
      ...extraEnv
    }).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
    return spawnSync('docker', ['exec', '-i', '-u', 'codebuilder', ...envArgs, containerName, 'bash', '-lc', script], {
      encoding: 'utf-8',
      timeout: CAPTURE_TIMEOUT_MS
    });
  };

  for (const alias of aliases) {
    log(`Authenticating extra org '${alias}' into the container`);
    // Auth each extra org the SAME way the image boots the default org: via its real access token +
    // instance URL (`sf org login access-token`), NOT sfdx-url. `sf org display --verbose --json`
    // REDACTS sfdxAuthUrl on recent CLIs (the #7718 redaction class), so a url-based login fails
    // INVALID_SFDX_AUTH_URL. resolveOrgBootEnv reads the UN-redacted token via `sf org auth
    // show-access-token` — exactly the source the boot env uses — routed through sfRunner (npx-sf
    // fallback). A resolve failure is a warning, not fatal (that org's specs will then fail loudly).
    let orgEnv: BootEnv;
    try {
      orgEnv = resolveOrgBootEnv(alias, { runner: sfRunner });
    } catch (err) {
      console.warn(
        `    WARNING: could not resolve access token / instance URL for '${alias}' on the host — skipping. ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      continue;
    }
    // Token via SF_ACCESS_TOKEN env, instance URL via flag; --no-prompt skips the "access tokens are
    // less secure" confirmation. This mirrors the container's own boot-time org login.
    const login = execInContainer(
      `sf org login access-token --instance-url ${orgEnv.instanceUrl} --alias ${alias} --no-prompt`,
      { SF_ACCESS_TOKEN: orgEnv.accessToken }
    );
    if (login.status !== 0) {
      console.warn(`    WARNING: 'sf org login access-token' for '${alias}' failed inside the container:`);
      if (login.stdout?.trim()) {
        console.warn(`      stdout: ${login.stdout.trim()}`);
      }
      if (login.stderr?.trim()) {
        console.warn(`      stderr: ${login.stderr.trim()}`);
      }
    }
  }
};

/*
 * Re-seed coder.json to a NO-FOLDER window (empty query, no `folder` key) for the nofolder phase.
 * seedWorkspace always writes `{query: {folder: …}}` against a recorded mount, so it can't express
 * "open with no folder at all" — the shape the emptyWorkspaceSfdxCommands case A (no folder open)
 * needs. This mirrors seed.ts's SEED_SCRIPT (atomic writes via mktemp+mv, disable workspace trust,
 * chown to codebuilder) but sets an empty query. Writes as root (docker exec default); a failure is
 * fatal for the phase, surfaced by the caller. Kept here (orchestrator re-seed logic), NOT in the
 * toolkit, per the no-folder-case scope.
 */
const NO_FOLDER_SEED_SCRIPT = `
set -e
command -v jq >/dev/null 2>&1 || { echo "seed: jq not found in container (nofolder seed requires jq)" >&2; exit 127; }
coder=/home/codebuilder/.local/share/code-server/coder.json
settings=/home/codebuilder/.local/share/code-server/User/settings.json
mkdir -p "$(dirname "$coder")" "$(dirname "$settings")"
ctmp="$(mktemp)"
jq -n '{query: {}}' > "$ctmp"
mv "$ctmp" "$coder"
stmp="$(mktemp)"
current="$(jq . "$settings" 2>/dev/null || echo '{}')"
printf '%s' "$current" | jq '.["security.workspace.trust.enabled"] = false' > "$stmp"
mv "$stmp" "$settings"
chown codebuilder:codebuilder "$coder" "$settings"
`;

const seedNoFolder = (containerName: string): void => {
  const res = spawnSync('docker', ['exec', containerName, 'bash', '-c', NO_FOLDER_SEED_SCRIPT], {
    encoding: 'utf-8',
    timeout: CAPTURE_TIMEOUT_MS
  });
  if ((res.status ?? 1) !== 0) {
    throw new Error(
      `seedNoFolder failed for container "${containerName}" (status ${res.status ?? 'null'}): ${
        res.stderr?.trim() || res.stdout?.trim() || 'no output'
      }`
    );
  }
};

/* --- stand up + swap + gate (all via the toolkit) -------------------------- */
const main = async (): Promise<number> => {
  // The three slow, independent operations — VSIX build/download, image pull, and org create/reuse —
  // all run concurrently: acquireVsix() and setUpInfra() are both async (setUpInfra overlaps the pull
  // and the org internally), and none blocks the event loop, so the loop's expensive halves overlap
  // instead of running back-to-back. Collect both results together.
  const [vsixPaths, bootEnv] = await Promise.all([acquireVsix(), setUpInfra()]);

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
    // boot. seedWorkspace points code-server at a mount instead. Both fixture shapes are mounted up
    // front (the DX project the standard suites use, and the non-project folder the noproject phase
    // re-seeds to); seedWorkspace validates its fixturePath against these recorded mounts.
    mounts: [
      { hostPath: FIXTURE_HOST_DIR, containerPath: FIXTURE_MOUNT_PATH },
      { hostPath: NOPROJECT_FIXTURE_HOST_DIR, containerPath: NOPROJECT_MOUNT_PATH },
      { hostPath: MULTIPACKAGE_FIXTURE_HOST_DIR, containerPath: MULTIPACKAGE_MOUNT_PATH }
    ]
  });

  // A bind mount keeps the host's ownership, so the container's workbench user can't write into the
  // fixture — VS Code's attempt to persist workspace settings (`.vscode/settings.json`) then fails
  // with EACCES, which breaks any spec that upserts a setting AND the metadata-XML (Red Hat) setup
  // that writes one on activation. Make the mounted tree writable by any uid so those writes land.
  // `a+rwX` only adds the execute bit to dirs/already-exec files, so it doesn't flip tracked file
  // modes (git sees no change). Runs as root inside the container; a failure is a warning, not fatal.
  log('Making the mounted fixtures writable by the container user (chmod a+rwX)');
  for (const mountPath of [FIXTURE_MOUNT_PATH, NOPROJECT_MOUNT_PATH, MULTIPACKAGE_MOUNT_PATH]) {
    const chmodMount = spawnSync('docker', ['exec', '-u', 'root', handle.name, 'chmod', '-R', 'a+rwX', mountPath], {
      stdio: 'ignore'
    });
    if (chmodMount.status !== 0) {
      console.warn(`    WARNING: could not chmod ${mountPath} — settings-writing specs may hit EACCES.`);
    }
  }

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

  // Auth extra orgs AFTER the restart: the restart re-runs the image's boot org auth, which
  // re-initializes the auth dir and would wipe a login done earlier. The org extension reads the org
  // list fresh on every picker open, so a login now (before the specs run) is enumerated without any
  // window reload. No-op unless CB_EXTRA_ORG_ALIASES is set.
  authExtraOrgsIntoContainer(handle.name);

  /* --- run the specs ------------------------------------------------------- */
  // Run every package's container suite against the one shared container, SEQUENTIALLY: a single
  // container serves a single browser session, so concurrent Playwright runs would fight over the
  // same workbench. Every suite runs even if an earlier one fails, so one invocation surfaces all
  // failures rather than stopping at the first. No --reporter override: a CLI --reporter REPLACES
  // the config's reporter list, which would drop the CI junit reporter createContainerConfig selects.
  const discovered = discoverContainerPackages();
  // --only shards the run to the named package(s); the CI matrix passes one per job so the whole
  // suite fits in the per-job timeout. An --only name that matches nothing is a typo/misconfig — fail
  // loud rather than silently running zero specs (which would look like a spurious pass).
  const containerPackages = opts.only ? discovered.filter(p => opts.only!.includes(p)) : discovered;
  if (opts.only) {
    const unknown = opts.only.filter(p => !discovered.includes(p));
    if (unknown.length > 0) {
      console.error(`--only names have no container suite: ${unknown.join(', ')}. Known: ${discovered.join(', ')}`);
      return 1;
    }
  }
  log(`Running container Playwright specs for ${containerPackages.length} package(s): ${containerPackages.join(', ')}`);

  // CB_FIXTURE_HOST_DIR: the HOST side of the bind mount. Specs that need to place files INTO the
  // opened workspace (e.g. metadata manifestCommandVisibility, which writes a *Package.xml + a plain
  // .xml at the project root) write here with node:fs — the bind mount reflects the write into the
  // container's opened folder. The container path (FIXTURE_MOUNT_PATH) is where code-server reads;
  // the host path is where a host-side spec can write. Both local and CI drive this orchestrator, so
  // this one env var covers both.
  const testEnv: NodeJS.ProcessEnv = { ...process.env, CODE_BUILDER_URL, CB_FIXTURE_HOST_DIR: FIXTURE_HOST_DIR };
  if (opts.debug) {
    testEnv.PWDEBUG = '1';
  }
  // --grep is forwarded to Playwright via CB_GREP (an env var), NOT a `--grep` CLI arg: the suites run
  // through `npm run … -w <pkg>` → wireit, which does not shell-quote forwarded args, so a title regex
  // with spaces or a `|` alternation would be split/mis-parsed. createContainerConfig reads CB_GREP.
  if (opts.grep) {
    testEnv.CB_GREP = opts.grep;
  }

  // Run one npm script across the given packages sequentially, returning the ones that failed.
  // `label` distinguishes the phases in the log (DX-project vs no-project). Shared by both phases so
  // the run-a-suite mechanics (grep passthrough, SPECS_TIMEOUT_MS backstop, per-package failure
  // collection) live in one place.
  const runSuites = (packages: string[], scriptName: string, label: string): string[] => {
    const suiteFailed: string[] = [];
    for (const pkg of packages) {
      log(`Specs [${label}]: ${pkg}`);
      // grep is passed via testEnv.CB_GREP (see above), not a forwarded --grep arg, so the argv is a
      // fixed, quoting-safe token list.
      const testArgs = ['run', scriptName, '-w', pkg];
      // SPECS_TIMEOUT_MS backstop: a single stuck browser/page is a routine Playwright failure mode,
      // and this is the most expensive step (after the pull + org setup). Without it a wedged run
      // hangs the loop forever here; on timeout the child is killed and the package counts as failed.
      const specs = spawnSync('npm', testArgs, {
        cwd: REPO_ROOT,
        stdio: 'inherit',
        env: testEnv,
        timeout: SPECS_TIMEOUT_MS
      });
      if ((specs.status ?? 1) !== 0) {
        suiteFailed.push(pkg);
      }
    }
    return suiteFailed;
  };

  // Phase 1 — standard container suites against the DX-project shape (the seeded fixture).
  const failed = runSuites(containerPackages, 'test:container', 'dx-project');

  // Phase 2 — no-project shape. Any package declaring `test:container:noproject` needs a workspace
  // with NO sfdx-project.json open (project-gated commands must be hidden). Change the shape at a
  // phase boundary — re-seed coder.json to the non-project mount + restart() — never mid-suite in the
  // shared session. Discovered self-maintaining like phase 1; a no-op when no package declares it.
  const noProjectPackages = opts.only
    ? discoverPackagesWithScript('test:container:noproject').filter(p => opts.only!.includes(p))
    : discoverPackagesWithScript('test:container:noproject');
  if (noProjectPackages.length > 0) {
    log(`Re-seeding code-server at the non-project folder (${NOPROJECT_MOUNT_PATH}) + restarting`);
    seedWorkspace(handle, { fixturePath: NOPROJECT_MOUNT_PATH });
    // restart() resolves only once the workbench URL answers again, so returning from it is the proof
    // code-server reopened the re-seeded non-project folder cleanly (the workspace-shape re-seed spike).
    await restart(handle);
    log(`Workbench came up after re-seed+restart to the non-project shape (re-seed spike: PASS)`);
    // Re-run the verify gate: the restart re-scans the overrides, so confirm the swapped extensions
    // are STILL present at the expected bytes. Without this a lost extension would make the
    // "commands hidden" assertions pass for the wrong reason (no extension = no commands either).
    assertVerified(handle.name, manifest);
    failed.push(...runSuites(noProjectPackages, 'test:container:noproject', 'no-project'));
  }

  // Phase 3 — no-folder shape. Any package declaring `test:container:nofolder` needs a window with NO
  // folder open at all (e.g. metadata emptyWorkspaceSfdxCommands case A: the Create Project commands
  // must still be contributed). Change the shape at a phase boundary — re-seed coder.json to an empty
  // query (no `folder` key) + restart() — never mid-suite in the shared session. Discovered
  // self-maintaining like phases 1–2; a no-op when no package declares it.
  const noFolderPackages = opts.only
    ? discoverPackagesWithScript('test:container:nofolder').filter(p => opts.only!.includes(p))
    : discoverPackagesWithScript('test:container:nofolder');
  if (noFolderPackages.length > 0) {
    log('Re-seeding code-server to a no-folder window (empty coder.json query) + restarting');
    seedNoFolder(handle.name);
    // restart() resolves only once the workbench URL answers again, so returning from it is the proof
    // code-server reopened cleanly with no folder.
    await restart(handle);
    log('Workbench came up after re-seed+restart to the no-folder shape');
    // Re-run the verify gate: the restart re-scans the overrides, so confirm the swapped extensions
    // are STILL present at the expected bytes. Without this a lost extension would make the
    // "commands present" assertions fail for the wrong reason (or a hidden-command regression hide).
    assertVerified(handle.name, manifest);
    failed.push(...runSuites(noFolderPackages, 'test:container:nofolder', 'no-folder'));
  }

  // Phase 4 — multi-package shape. Any package declaring `test:container:multipackage` needs a DX
  // project with TWO packageDirectories open (e.g. apex-log apexGenerateClassMultiPackageDirs: the
  // output-dir picker must list BOTH package dirs' classes folders). Change the shape at a phase
  // boundary — re-seed coder.json to the multi-package mount + restart() — never mid-suite in the
  // shared session. Discovered self-maintaining like phases 1–3; a no-op when no package declares it.
  const multiPackagePackages = opts.only
    ? discoverPackagesWithScript('test:container:multipackage').filter(p => opts.only!.includes(p))
    : discoverPackagesWithScript('test:container:multipackage');
  if (multiPackagePackages.length > 0) {
    log(`Re-seeding code-server at the multi-package project (${MULTIPACKAGE_MOUNT_PATH}) + restarting`);
    seedWorkspace(handle, { fixturePath: MULTIPACKAGE_MOUNT_PATH });
    // restart() resolves only once the workbench URL answers again, so returning from it is the proof
    // code-server reopened the re-seeded multi-package project cleanly.
    await restart(handle);
    log('Workbench came up after re-seed+restart to the multi-package shape');
    // Re-run the verify gate: the restart re-scans the overrides, so confirm the swapped extensions
    // are STILL present at the expected bytes. Without this a lost extension would make the picker
    // assertions fail for the wrong reason (no extension = no command = no picker at all).
    assertVerified(handle.name, manifest);
    failed.push(...runSuites(multiPackagePackages, 'test:container:multipackage', 'multi-package'));
  }

  if (failed.length > 0) {
    log(`Container specs failed for ${failed.length} package(s): ${failed.join(', ')}. Recent container logs:`);
    const logs = tryCapture('docker', ['logs', CONTAINER_NAME]);
    if (logs) {
      console.log(logs.split('\n').slice(-40).join('\n'));
    }
    for (const pkg of failed) {
      console.log(`    HTML report: packages/${pkg}/playwright-report/index.html`);
    }
    return 1;
  }
  return 0;
};

main()
  .then(rc => process.exit(rc))
  .catch(err => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
