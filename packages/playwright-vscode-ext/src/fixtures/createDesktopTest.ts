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
import { execSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { filterErrors } from '../utils/helpers';
import { resolveRepoRoot } from '../utils/repoRoot';
import { createTestWorkspace } from './desktopWorkspace';

/** Close timeout before force-kill. Electron on Mac CI can hang on graceful close. */
const CLOSE_TIMEOUT_MS = 50_000;

/** Collect all descendant PIDs (recursive). Must be called while the root process is still alive. */
const getDescendantPids = (pid: number): number[] => {
  try {
    if (process.platform === 'win32') return [];
    const children = execSync(`pgrep -P ${pid}`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(Number)
      .filter(n => !isNaN(n));
    return [...children, ...children.flatMap(getDescendantPids)];
  } catch {
    return [];
  }
};

/** SIGKILL a list of PIDs, ignoring already-exited processes. */
const killPids = (pids: number[]): void => {
  pids.forEach(p => {
    try { process.kill(p, 'SIGKILL'); } catch {}
  });
};

type CreateDesktopTestOptions = {
  /** __dirname from the calling extension's fixture file (e.g., '<pkg>/test/playwright/fixtures') */
  fixturesDir: string;
  orgAlias?: string;
  /** Additional extension directory names to load (ex: ['salesforcedx-vscode-metadata'] for apex-testing "SFDX: Create Apex Class") */
  additionalExtensionDirs?: string[];
  /** When false, do not pass --disable-extensions (needed when loading multiple dev extensions). Default true. */
  disableOtherExtensions?: boolean;
  /** Optional user settings to write to User/settings.json (e.g. to reduce GitHub/Git prompts). */
  userSettings?: Record<string, unknown>;
};

/** Creates a Playwright test instance configured for desktop Electron testing with services extension */
export const createDesktopTest = (options: CreateDesktopTestOptions) => {
  const { fixturesDir, orgAlias, additionalExtensionDirs = [], disableOtherExtensions = true, userSettings } = options;

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
      const dir = await createTestWorkspace(orgAlias);
      await use(dir);
    },

    // Launch fresh Electron instance per test
    electronApp: async ({ vscodeExecutable, workspaceDir }, use): Promise<void> => {
      // Use subdirectory of workspace for user data (keeps everything isolated and together)
      const userDataDir = path.join(workspaceDir, '.vscode-test-user-data');
      await fs.mkdir(userDataDir, { recursive: true });
      if (userSettings !== undefined && Object.keys(userSettings).length > 0) {
        const userSettingsDir = path.join(userDataDir, 'User');
        await fs.mkdir(userSettingsDir, { recursive: true });
        await fs.writeFile(path.join(userSettingsDir, 'settings.json'), JSON.stringify(userSettings, null, 2));
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
        // Snapshot the full process tree BEFORE close — once the parent exits, children are
        // reparented to PID 1 and pgrep -P can no longer find them.
        const pid = electronApp.process?.()?.pid;
        const descendants = typeof pid === 'number' ? [pid, ...getDescendantPids(pid)] : [];
        try {
          await Promise.race([
            electronApp.close(),
            new Promise<false>(resolve => setTimeout(() => resolve(false), CLOSE_TIMEOUT_MS))
          ]);
        } catch {}
        // Kill any survivors (GPU, crashpad, utility) that outlived close()
        killPids(descendants);
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
