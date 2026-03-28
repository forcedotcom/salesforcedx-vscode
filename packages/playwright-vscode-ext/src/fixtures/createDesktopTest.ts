/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is Node.js test infrastructure, not extension code
import type { WorkerFixtures, TestFixtures } from './desktopFixtureTypes';
import { test as base, _electron as electron } from '@playwright/test';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import type { ChildProcess } from 'node:child_process';
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
  try { process.kill(-pid, 'SIGKILL'); } catch {}
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
  /** When false, do not pass --disable-extensions (needed when loading multiple dev extensions). Default true. */
  disableOtherExtensions?: boolean;
  /** Optional user settings to write to User/settings.json (e.g. to reduce GitHub/Git prompts). */
  userSettings?: Record<string, unknown>;
};

/** Creates a Playwright test instance configured for desktop Electron testing with services extension */
export const createDesktopTest = (options: CreateDesktopTestOptions) => {
  const {
    fixturesDir,
    orgAlias,
    emptyWorkspace = false,
    additionalExtensionDirs = [],
    disableOtherExtensions = true,
    userSettings
  } = options;

  const test = base.extend<TestFixtures, WorkerFixtures>({
    // Download VS Code once per worker (cached at repo root .vscode-test/)
    vscodeExecutable: [
      async ({}, use): Promise<void> => {
        const repoRoot = resolveRepoRoot(fixturesDir);
        const cachePath = path.join(repoRoot, '.vscode-test');
        const version = process.env.PLAYWRIGHT_DESKTOP_VSCODE_VERSION ?? undefined;
        const executablePath = await downloadAndUnzipVSCode({ version, cachePath });
        await use(executablePath);
      },
      { scope: 'worker' }
    ],

    // Create workspace directory (shared with electronApp so tests can access path)
    workspaceDir: async ({}, use): Promise<void> => {
      const dir = emptyWorkspace ? await createEmptyTestWorkspace() : await createTestWorkspace(orgAlias);
      await use(dir);
    },

    // Launch fresh Electron instance per test
    electronApp: async ({ vscodeExecutable, workspaceDir }, use): Promise<void> => {
      // Use subdirectory of workspace for user data (keeps everything isolated and together)
      const userDataDir = path.join(workspaceDir, '.vscode-test-user-data');
      await fs.mkdir(userDataDir, { recursive: true });
      const effectiveUserSettings = {
        ...(!process.env.CI ? { 'salesforcedx-vscode-salesforcedx.enableFileTraces': true } : {}),
        'files.simpleDialog.enable': true, // Use VS Code's simple dialog instead of native OS dialog (visible in Electron)
        ...userSettings
      };
      if (Object.keys(effectiveUserSettings).length > 0) {
        const userSettingsDir = path.join(userDataDir, 'User');
        await fs.mkdir(userSettingsDir, { recursive: true });
        await fs.writeFile(
          path.join(userSettingsDir, 'settings.json'),
          JSON.stringify(effectiveUserSettings, null, 2)
        );
      }
      const extensionsDir = path.join(workspaceDir, '.vscode-test-extensions');
      await fs.mkdir(extensionsDir, { recursive: true });

      const packageRoot = path.resolve(fixturesDir, '..', '..', '..');

      // Collect all extension paths: current extension + services + any additional

      const videosDir = path.join(packageRoot, 'test-results', 'videos');
      await fs.mkdir(videosDir, { recursive: true });

      const extensionArgs = [
        // Extension path is the package root (contains package.json and bundled dist/index.js)
        packageRoot,
        ...additionalExtensionDirs
          .concat(['salesforcedx-vscode-services'])
          .map(dir => path.resolve(packageRoot, '..', dir))
      ].map(p => `--extensionDevelopmentPath=${p}`);

      const launchArgs = [
        `--user-data-dir=${userDataDir}`,
        `--extensions-dir=${extensionsDir}`,
        ...extensionArgs,
        ...(disableOtherExtensions ? ['--disable-extensions'] : []),
        '--disable-workspace-trust',
        '--no-sandbox',
        workspaceDir
      ];

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
              if (proc.exitCode !== null) { resolve(); return; }
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
            try { process.kill(proc.pid!, 'SIGKILL'); } catch {}
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
