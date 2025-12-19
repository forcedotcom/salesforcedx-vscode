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
  closeWelcomeTabs,
  closeSettingsTab,
  waitForWorkspaceReady,
  typingSpeed,
  isMacDesktop
} from './utils/helpers';

export { createFileWithContents, createApexClass, openFileByName, editOpenFile } from './utils/fileHelpers';

export {
  WORKBENCH,
  EDITOR,
  EDITOR_WITH_URI,
  DIRTY_EDITOR,
  QUICK_INPUT_WIDGET,
  QUICK_INPUT_LIST_ROW,
  TAB,
  TAB_CLOSE_BUTTON,
  STATUS_BAR_ITEM_LABEL,
  NOTIFICATION_LIST_ITEM,
  SETTINGS_SEARCH_INPUT,
  CONTEXT_MENU
} from './utils/locators';

export { CODE_BUILDER_WEB_SECTION, INSTANCE_URL_KEY, ACCESS_TOKEN_KEY, API_VERSION_KEY } from './constants';

export { create, DREAMHOUSE_ORG_ALIAS } from './orgs/dreamhouseScratchOrgSetup';
export { createMinimalOrg, MINIMAL_ORG_ALIAS } from './orgs/minimalScratchOrgSetup';

// Pages
export { upsertScratchOrgAuthFieldsToSettings, openSettingsUI, upsertSettings } from './pages/settings';

export { executeCommandWithCommandPalette, openCommandPalette, executeCommand, reloadWindow } from './pages/commands';

export { executeEditorContextMenuCommand, executeExplorerContextMenuCommand } from './pages/contextMenu';

export {
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  outputChannelContains
} from './pages/outputChannel';

// Shared
export { saveScreenshot } from './shared/screenshotUtils';

// Fixtures
export { createTestWorkspace } from './fixtures/desktopWorkspace';
export { createDesktopTest } from './fixtures/createDesktopTest';
export type { WorkerFixtures, TestFixtures } from './fixtures/desktopFixtureTypes';

// Web
export { createHeadlessServer, setupSignalHandlers } from './web/createHeadlessServer';

// Config factories
export { createWebConfig } from './config/createWebConfig';
export { createDesktopConfig } from './config/createDesktopConfig';
