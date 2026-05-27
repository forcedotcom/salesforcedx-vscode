/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is Node.js test infrastructure, not extension code
import type { WorkerFixtures, TestFixtures } from './desktopFixtureTypes';
import { test as base, _electron as electron } from '@playwright/test';
import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath } from '@vscode/test-electron';
import { spawnSync, type ChildProcess } from 'node:child_process';
import * as crypto from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { filterErrors } from '../utils/helpers';
import { resolveRepoRoot } from '../utils/repoRoot';
import { createEmptyTestWorkspace, createTestWorkspace } from './desktopWorkspace';

/** Close timeout before force-kill (non-macOS-CI path). */
const CLOSE_TIMEOUT_MS = 5000;

/**
 * Force-kill an Electron process tree on macOS/Linux. Playwright spawns Electron
 * with detached:true, giving it its own process group (PGID = PID). Sending
 * SIGKILL to -pid kills the entire group (main + GPU + crashpad + utility).
 * Then destroy stdio pipes so Node.js emits the ChildProcess 'exit' event —
 * without this, Playwright's worker teardown waits for pipe EOF and times out.
 */
const forceKillProcessGroup = (proc: ChildProcess): void => {
  const { pid } = proc;
  if (typeof pid !== 'number') return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {}
  proc.stdin?.destroy();
  proc.stdout?.destroy();
  proc.stderr?.destroy();
};

type CreateDesktopTestOptions = {
  /** __dirname from the calling extension's fixture file (e.g., '<pkg>/test/playwright/fixtures') */
  fixturesDir: string;
  /** Scratch alias for workspace `.sfdx/config.json` `target-org`. Omit or `undefined` → no `config.json` (no org). */
  orgAlias?: string;
  /** When true, use empty workspace (no sfdx-project.json). Default false. */
  emptyWorkspace?: boolean;
  /** Additional extension directory names to load (ex: ['salesforcedx-vscode-metadata'] for apex-testing "SFDX: Create Apex Class") */
  additionalExtensionDirs?: string[];
  /** Marketplace extension IDs (publisher.name) installed via `code --install-extension` once per worker. Use for hard `extensionDependencies` not built locally. */
  marketplaceExtensions?: string[];
  /** When false, do not pass --disable-extensions (needed when loading multiple dev extensions). Default true. */
  disableOtherExtensions?: boolean;
  /** Optional user settings to write to User/settings.json (e.g. to reduce GitHub/Git prompts). */
  userSettings?: Record<string, unknown>;
  /**
   * When true, install VSIXs and launch VS Code with --extensions-dir instead of --extensionDevelopmentPath.
   * Exercises the real shipping artifact (bundled dist/, packageUpdates, .vscodeignore).
   * Defaults to false; set E2E_FROM_VSIX=1 to enable without code changes.
   */
  useVsix?: boolean;
};

type ExtensionPackageJson = {
  name: string;
  publisher: string;
  extensionDependencies?: string[];
};

const unique = <T>(values: T[]): T[] => values.filter((value, index) => values.indexOf(value) === index);

const readExtensionPackageJson = (repoRoot: string, packageDir: string): ExtensionPackageJson =>
  JSON.parse(readFileSync(path.join(repoRoot, 'packages', packageDir, 'package.json'), 'utf8')) as ExtensionPackageJson;

const orderExtensionDirsForInstall = (repoRoot: string, packageDirs: string[]): string[] => {
  const dirs = unique(packageDirs);
  const packagesByDir = new Map(dirs.map(dir => [dir, readExtensionPackageJson(repoRoot, dir)]));
  const dirsByExtensionId = new Map(dirs.map(dir => [`${packagesByDir.get(dir)!.publisher}.${packagesByDir.get(dir)!.name}`, dir]));
  const orderedDirs: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (dir: string): void => {
    if (visited.has(dir) || visiting.has(dir)) return;
    visiting.add(dir);
    packagesByDir
      .get(dir)
      ?.extensionDependencies?.map(id => dirsByExtensionId.get(id))
      .filter((dependencyDir): dependencyDir is string => dependencyDir !== undefined)
      .forEach(visit);
    visiting.delete(dir);
    visited.add(dir);
    orderedDirs.push(dir);
  };

  dirs.forEach(visit);
  return orderedDirs;
};

/**
 * Resolve *.vsix files for the given package directories (relative to repo root packages/).
 * Fails loudly if a package has 0 or >1 VSIX (wireit should produce exactly one).
 */
const resolveVsixPaths = (repoRoot: string, packageDirs: string[]): string[] =>
  packageDirs.map(dir => {
    const pkgDir = path.join(repoRoot, 'packages', dir);
    const vsixFiles = existsSync(pkgDir) ? readdirSync(pkgDir).filter(f => f.endsWith('.vsix')) : [];
    if (vsixFiles.length !== 1) {
      throw new Error(
        `Expected exactly 1 VSIX in packages/${dir}/ but found ${vsixFiles.length}: [${vsixFiles.join(', ')}]. ` +
          `Run 'npm run vscode:package -w ${dir}' first.`
      );
    }
    return path.join(pkgDir, vsixFiles[0]);
  });

/**
 * Compute a cache key from the combined sha256 of all VSIX files.
 * Uses file sizes+mtimes as a fast proxy — avoids reading multi-MB VSIX bytes.
 * Marketplace IDs participate in the key so that adding/removing one busts the cache.
 */
const computeVsixCacheKey = async (vsixPaths: string[], marketplaceExtensions: string[]): Promise<string> => {
  const hash = crypto.createHash('sha256');
  for (const p of vsixPaths) {
    const stat = await fs.stat(p);
    hash.update(`${p}:${stat.size}:${stat.mtimeMs}`);
  }
  marketplaceExtensions.forEach(id => hash.update(`mkt:${id}`));
  return hash.digest('hex').slice(0, 16);
};

/**
 * Install marketplace extensions by ID into the given extensions dir using `code --install-extension <id>`.
 * Skips silently if `ids` is empty.
 */
const installMarketplaceExtensions = (
  extensionsDir: string,
  userDataDir: string,
  ids: string[],
  vscodeExecutable: string
): void => {
  if (ids.length === 0) return;
  const cli = resolveCliPathFromVSCodeExecutablePath(vscodeExecutable);
  const failed = ids
    .map(id => ({
      id,
      status: spawnSync(
        cli,
        ['--extensions-dir', extensionsDir, '--user-data-dir', userDataDir, '--install-extension', id, '--force'],
        { stdio: 'inherit', shell: process.platform === 'win32' }
      ).status
    }))
    .filter(r => r.status !== 0);
  if (failed.length > 0) {
    throw new Error(`Marketplace extension install failed: ${failed.map(r => `${r.id} (exit ${r.status})`).join(', ')}`);
  }
};

/**
 * Install VSIXs into a hash-keyed cache dir under <repoRoot>/.vscode-test/ext-<hash>/.
 * Each worker gets its own per-pid tmp dir to avoid concurrent install conflicts.
 * Atomic rename to final cache dir; second worker to finish sees the dir exists and cleans up.
 * Idempotent: skips if <dir>/extensions.json already exists (first worker won).
 */
const installVsixsToCache = async (
  cacheDir: string,
  vsixPaths: string[],
  marketplaceExtensions: string[],
  vscodeExecutable: string
): Promise<void> => {
  const extensionsJson = path.join(cacheDir, 'extensions.json');
  if (existsSync(extensionsJson)) {
    return; // already installed — fast path
  }

  // Per-pid tmp dir: avoids concurrent workers writing to the same directory
  const tmpDir = `${cacheDir}.tmp.${process.pid}`;
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(tmpDir, { recursive: true });

  const cli = resolveCliPathFromVSCodeExecutablePath(vscodeExecutable);
  // VS Code 1.115+ CLI auto-installs `extensionDependencies` from the marketplace gallery
  // when multiple --install-extension flags are passed in one invocation; the dep-resolver
  // queries gallery before sibling vsixs register in extensions.json, so the published
  // (potentially older) gallery version wins over our local vsix. Install one vsix per
  // spawn, in dependency order, so each registers before its dependents are processed.
  const failedInstalls = vsixPaths
    .map(p => ({
      p,
      status: spawnSync(
        cli,
        ['--extensions-dir', tmpDir, '--user-data-dir', path.join(tmpDir, '.ud'), '--install-extension', p],
        { stdio: 'inherit', shell: process.platform === 'win32' }
      ).status
    }))
    .filter(r => r.status !== 0);

  if (failedInstalls.length > 0) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    throw new Error(
      `VSIX install failed: ${failedInstalls.map(r => `${r.p} (exit ${r.status})`).join(', ')}`
    );
  }

  // Marketplace extensions install into the same dir — happens after VSIXs so locally-built deps win
  installMarketplaceExtensions(tmpDir, path.join(tmpDir, '.ud'), marketplaceExtensions, vscodeExecutable);

  // Atomic rename: first worker wins; others clean up their own tmp and use the winner's dir
  try {
    await fs.rename(tmpDir, cacheDir);
  } catch {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
};

/** Creates a Playwright test instance configured for desktop Electron testing with services extension */
export const createDesktopTest = (options: CreateDesktopTestOptions) => {
  const {
    fixturesDir,
    orgAlias,
    emptyWorkspace = false,
    additionalExtensionDirs = [],
    marketplaceExtensions = [],
    disableOtherExtensions = true,
    userSettings
  } = options;

  const useVsix = options.useVsix ?? process.env.E2E_FROM_VSIX === '1';

  // Current package name = the packages/<dir> that owns this fixture file.
  // fixturesDir is e.g. <repoRoot>/packages/salesforcedx-vscode-org-browser/test/playwright/fixtures
  const packageDir = path.basename(path.resolve(fixturesDir, '..', '..', '..'));

  const test = base.extend<TestFixtures, WorkerFixtures>({
    // Download VS Code once per worker (cached at repo root .vscode-test/)
    vscodeExecutable: [
      async ({}, use): Promise<void> => {
        const repoRoot = resolveRepoRoot(fixturesDir);
        const cachePath = path.join(repoRoot, '.vscode-test');
        const version = process.env.PLAYWRIGHT_VSCODE_VERSION ?? undefined;
        const executablePath = await downloadAndUnzipVSCode({ version, cachePath });
        await use(executablePath);
      },
      { scope: 'worker' }
    ],

    // Install VSIXs once per worker into a hash-keyed cache dir (VSIX mode only)
    installedExtensionsDir: [
      async ({ vscodeExecutable }, use): Promise<void> => {
        if (!useVsix) {
          await use(undefined);
          return;
        }
        const repoRoot = resolveRepoRoot(fixturesDir);
        const allDirs = orderExtensionDirsForInstall(repoRoot, [
          'salesforcedx-vscode-services',
          packageDir,
          ...additionalExtensionDirs
        ]);
        const vsixPaths = resolveVsixPaths(repoRoot, allDirs);
        const cacheKey = await computeVsixCacheKey(vsixPaths, marketplaceExtensions);
        const cacheDir = path.join(repoRoot, '.vscode-test', `ext-${cacheKey}`);
        await installVsixsToCache(cacheDir, vsixPaths, marketplaceExtensions, vscodeExecutable);
        await use(cacheDir);
      },
      { scope: 'worker' }
    ],

    // Create workspace directory (shared with electronApp so tests can access path)
    workspaceDir: async ({}, use): Promise<void> => {
      const dir = emptyWorkspace ? await createEmptyTestWorkspace() : await createTestWorkspace(orgAlias);
      await use(dir);
    },

    // Launch fresh Electron instance per test
    electronApp: async ({ vscodeExecutable, workspaceDir, installedExtensionsDir }, use): Promise<void> => {
      // Use subdirectory of workspace for user data (keeps everything isolated and together)
      const userDataDir = path.join(workspaceDir, '.vscode-test-user-data');
      await fs.mkdir(userDataDir, { recursive: true });
      const effectiveUserSettings = {
        'files.simpleDialog.enable': true, // Use VS Code's simple dialog instead of native OS dialog (visible in Electron)
        'window.menuStyle': 'custom', // Keep context menus in the DOM so Playwright can interact with them on macOS.
        'settingsSync.enabled': false, // Prevent Settings Sync from overwriting test settings
        'salesforcedx-vscode-salesforcedx.enableFileTraces': true,
        // Avoid GitHub/Git prompts opening the system browser during local E2E (oauth, autofetch, etc.)
        'github.gitAuthentication': false,
        'git.terminalAuthentication': false,
        'git.autofetch': false,
        'git.openRepositoryInParentFolders': 'never',
        // Suppress Copilot/Chat setup dialogs that trigger GitHub OAuth on startup
        'chat.commandCenter.enabled': false,
        'chat.setupFromDialog': false,
        'workbench.startupEditor': 'none',
        'workbench.enableExperiments': false,
        'extensions.autoCheckUpdates': false,
        'extensions.autoUpdate': false,
        'telemetry.telemetryLevel': 'off',
        'update.mode': 'none',
        // Tag e2e telemetry/spans so they can be filtered out from real-user analytics
        'salesforcedx-vscode-core.telemetry-tag': 'e2e-test',
        ...userSettings
      };
      if (Object.keys(effectiveUserSettings).length > 0) {
        const userSettingsDir = path.join(userDataDir, 'User');
        await fs.mkdir(userSettingsDir, { recursive: true });
        await fs.writeFile(path.join(userSettingsDir, 'settings.json'), JSON.stringify(effectiveUserSettings, null, 2));
      }

      const packageRoot = path.resolve(fixturesDir, '..', '..', '..');
      const videosDir = path.join(packageRoot, 'test-results', 'videos');
      await fs.mkdir(videosDir, { recursive: true });

      // Explicitly disable built-in GitHub/Microsoft/Copilot/Chat extensions that can trigger
      // sign-in modals or the GitHub OAuth browser tab on startup. `--disable-extensions` only
      // disables user-installed extensions; built-ins must be disabled individually.
      const disabledBuiltins = [
        'vscode.github',
        'vscode.github-authentication',
        'vscode.microsoft-authentication',
        'GitHub.vscode-pull-request-github',
        'GitHub.copilot',
        'GitHub.copilot-chat',
        // Azure MS sign-in prompts during local desktop E2E (not needed for Salesforce extension tests).
        'ms-vscode.azure-account'
      ].map(id => `--disable-extension=${id}`);

      const startupArgs = [
        // Align with `vscode-test`/runTest.ts: suppress welcome/release-notes churn and updates.
        // `--skip-welcome` is critical to avoid first-run sign-in modals blocking desktop Playwright runs.
        '--disable-updates',
        '--skip-welcome',
        '--skip-release-notes',
        '--disable-gpu-sandbox',
        '--disable-workspace-trust',
        '--no-sandbox',
        workspaceDir
      ];

      const launchArgs = useVsix
        ? [
          // VSIX mode: extensions installed into hash-keyed cache dir; no dev path needed
          `--user-data-dir=${userDataDir}`,
          `--extensions-dir=${installedExtensionsDir}`,
          ...disabledBuiltins,
          ...startupArgs
        ]
        : await (async (): Promise<string[]> => {
          const extensionsDir = path.join(workspaceDir, '.vscode-test-extensions');
          await fs.mkdir(extensionsDir, { recursive: true });
          // Install marketplace deps (e.g. extensionDependencies not built locally) into the per-test extensions dir
          installMarketplaceExtensions(extensionsDir, userDataDir, marketplaceExtensions, vscodeExecutable);
          const extensionArgs = [
            // Extension path is the package root (contains package.json and bundled dist/index.js)
            packageRoot,
            ...additionalExtensionDirs
              .concat(['salesforcedx-vscode-services'])
              .map(dir => path.resolve(packageRoot, '..', dir))
          ].map(p => `--extensionDevelopmentPath=${p}`);
          return [
            `--user-data-dir=${userDataDir}`,
            `--extensions-dir=${extensionsDir}`,
            ...extensionArgs,
            ...(disableOtherExtensions ? ['--disable-extensions'] : []),
            ...disabledBuiltins,
            ...startupArgs
          ];
        })();

      const electronApp = await electron.launch({
        executablePath: vscodeExecutable,
        args: launchArgs,
        env: { ...process.env, VSCODE_DESKTOP: '1' } as Record<string, string>,
        timeout: 60_000,
        recordVideo: {
          dir: videosDir,
          size: { width: 1920, height: 1080 }
        }
      });

      try {
        await use(electronApp);
      } finally {
        const proc = electronApp.process?.();
        console.log(`[teardown] pid=${proc?.pid} platform=${process.platform} CI=${process.env.CI}`);

        if (process.platform !== 'win32' && process.env.CI) {
          // macOS/Linux CI: electronApp.close() hangs via CDP, leaving a dangling Promise
          // that Playwright's worker teardown waits on (60s timeout). Kill the entire
          // process group and destroy stdio pipes so the ChildProcess 'exit' event fires.
          if (proc) {
            forceKillProcessGroup(proc);
            // Wait for Node.js to register the exit (pipes closed → 'close' event → 'exit' event)
            await new Promise<void>(resolve => {
              if (proc.exitCode !== null) {
                resolve();
                return;
              }
              proc.on('close', () => resolve());
              setTimeout(resolve, 10_000);
            });
          }
          console.log(`[teardown] exitCode=${proc?.exitCode} killed=${proc?.killed}`);
        } else {
          try {
            await Promise.race([
              electronApp.close(),
              new Promise<false>(resolve => setTimeout(() => resolve(false), CLOSE_TIMEOUT_MS))
            ]);
          } catch {}
          // Force-kill if close didn't work (Windows timeout fallback)
          if (proc?.exitCode === null && process.platform === 'win32') {
            try {
              process.kill(proc.pid!, 'SIGKILL');
            } catch {}
          }
        }
        console.log('[teardown] done');
      }
    },

    // Get first window from Electron app
    page: async ({ electronApp }, use) => {
      const page = await electronApp.firstWindow();

      // Grant clipboard permissions for desktop (Electron)
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

      // Capture console logs (especially errors) for debugging
      page.on('console', msg => {
        if (
          msg.type() !== 'error' ||
          filterErrors([{ text: msg.text(), url: msg.location()?.url || '' }]).length === 0
        ) {
          return;
        }
        console.log(`[Electron Console Error] ${msg.text()}`);
        // Also log the location if available
        const { url, lineNumber } = msg.location() ?? {};
        if (url) {
          console.log(`  at ${url}:${lineNumber}`);
        }
      });

      // Electron ignores config's use.viewport — set explicitly for consistent sizing across CI runners
      await page.setViewportSize({ width: 1920, height: 1080 });

      const { WORKBENCH } = await import('../utils/locators.js');
      await page.waitForSelector(WORKBENCH, { timeout: 60_000 });
      await use(page);
    }
  });
  test.afterEach(async ({ page }, testInfo) => {
    // When hooks time out or the page fixture tears down early, `page` can be null — guard all access
    if (!page) {
      return;
    }

    if (process.env.DEBUG_MODE && testInfo.status !== 'passed') {
      console.log('\n🔍 DEBUG_MODE: Test failed - pausing to keep VS Code window open.');
      console.log('Press Resume in Playwright Inspector or close VS Code window to continue.');
      await page.pause();
    }

    // Rename video with test name for easy identification
    const video = page.video();
    if (video) {
      const videoPath = await video.path();
      const safeName = testInfo.titlePath.join('-').replaceAll(/[^a-zA-Z0-9-]/g, '_');
      const newPath = path.join(path.dirname(videoPath), `${safeName}.webm`);
      await fs.rename(videoPath, newPath).catch(() => {});
    }
  });
  return test;
};
