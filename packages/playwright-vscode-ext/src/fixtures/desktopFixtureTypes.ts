/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ElectronApplication, Page } from '@playwright/test';

/** Worker-scoped fixtures (shared across tests in same worker) */
export type WorkerFixtures = {
  vscodeExecutable: string;
};

/** Test-scoped fixtures (fresh for each test) */
export type TestFixtures = {
  electronApp: ElectronApplication;
  page: Page;
};
