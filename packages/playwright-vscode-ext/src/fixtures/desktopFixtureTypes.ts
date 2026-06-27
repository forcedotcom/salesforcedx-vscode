/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ElectronApplication, Page } from '@playwright/test';

/** Worker-scoped fixtures (shared across tests in same worker) */
export type WorkerFixtures = {
  vscodeExecutable: string;
  /** Resolved extensions dir: VSIX-install cache path (VSIX mode) or undefined (dev-path mode). */
  installedExtensionsDir: string | undefined;
};

/**
 * Launcher handle for the per-test Electron app. `app` is the current instance;
 * `relaunch` closes it best-effort and launches a fresh one (used by the page
 * fixture to recover from win32 launch instability). Teardown always kills the
 * latest launched app + cleans its temp dir.
 */
type ElectronAppHandle = {
  app: ElectronApplication;
  relaunch: () => Promise<ElectronApplication>;
};

/** Test-scoped fixtures (fresh for each test) */
export type TestFixtures = {
  workspaceDir: string;
  electronApp: ElectronAppHandle;
  page: Page;
};
