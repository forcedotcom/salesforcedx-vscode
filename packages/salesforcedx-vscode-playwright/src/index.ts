/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  filterErrors,
  filterNetworkErrors,
  waitForVSCodeWorkbench,
  typingSpeed
} from './utils/helpers';

export { create, DREAMHOUSE_ORG_ALIAS } from './utils/dreamhouseScratchOrgSetup';

// Pages
export { upsertScratchOrgAuthFieldsToSettings } from './pages/settings';

export { executeCommandWithCommandPalette, openCommandPalette, executeCommand } from './pages/commands';

// Shared
export { saveScreenshot } from './shared/screenshotUtils';

// Fixtures
export { createTestWorkspace } from './fixtures/desktopWorkspace';
export { createDesktopTest } from './fixtures/createDesktopTest';
export type { WorkerFixtures, TestFixtures } from './fixtures/desktopFixtureTypes';

// Web
export { createHeadlessServer, setupSignalHandlers } from './web/createHeadlessServer';
