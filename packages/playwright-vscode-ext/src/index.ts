/*
 * Copyright (c) 2026, salesforce.com, inc.
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
  waitForQuickInputFirstOption,
  selectFirstQuickInputOption,
  selectQuickInputOption,
  selectQuickInputOptionByTyping,
  closeWelcomeTabs,
  dismissSignInWalkthroughDialog,
  closeSettingsTab,
  waitForWorkspaceReady,
  typingSpeed,
  isDesktop,
  isMacDesktop,
  isWindowsDesktop,
  validateNoCriticalErrors
} from './utils/helpers';

export {
  removeAllDebugLevels,
  ensureSecondarySideBarHidden,
  waitForExtensionsActivated,
  closeWorkspaceToEmptyWindow,
  prepareNoFolderOpenForPaletteTests,
  disableMonacoAutoClosing
} from './utils/workflows';

export { activeQuickInputWidget, activeQuickInputTextField } from './utils/quickInput';

export {
  createFileWithContents,
  createApexClass,
  deployCurrentSourceToOrg,
  openFileByName,
  openFileFromExplorerTree,
  editAndSaveOpenFile as editOpenFile,
  replaceLineInOpenFile,
  goToLineCol,
  setupMinimalOrgAndAuth,
  setupNonTrackingOrgAndAuth,
  createAndDeployApexTestClass
} from './utils/fileHelpers';

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
  APEX_TRACE_FLAG_STATUS_BAR,
  NOTIFICATION_LIST_ITEM,
  SETTINGS_SEARCH_INPUT,
  CONTEXT_MENU,
  CODELENS_ITEM
} from './utils/locators';

export { CODE_BUILDER_WEB_SECTION, INSTANCE_URL_KEY, ACCESS_TOKEN_KEY, API_VERSION_KEY } from './constants';

export { createDreamhouseOrg, DREAMHOUSE_ORG_ALIAS } from './orgs/dreamhouseScratchOrgSetup';
export { createMinimalOrg, MINIMAL_ORG_ALIAS } from './orgs/minimalScratchOrgSetup';
export { createNonTrackingOrg, NON_TRACKING_ORG_ALIAS, HUB_ORG_ALIAS } from './orgs/nonTrackingScratchOrgSetup';
export { getTargetDevHub } from './orgs/devHub';
export { execAsync, env } from './orgs/shared';

// Pages
export { upsertScratchOrgAuthFieldsToSettings, openSettingsUI, upsertSettings } from './pages/settings';

export {
  executeCommandWithCommandPalette,
  openCommandPalette,
  verifyCommandDoesNotExist,
  verifyCommandExists
} from './pages/commands';
export type { OpenCommandPaletteOptions } from './pages/commands';

export {
  focusOnFilesExplorer,
  newUntitledTextFile,
  saveFile,
  clearAllNotifications,
  closeAllEditors,
  showExplorer,
  reloadWindow,
  goToFile,
  goToLineColumn,
  selectAll,
  paste,
  focusOnProblemsView,
  goToDefinition,
  focusActiveEditorGroup,
  find,
  hidePanel,
  clearOutput,
  closeEditor,
  insertSnippet,
  showRunningExtensions,
  hideSecondarySideBar,
  closeWorkspace
} from './pages/nativeCommands';

export { executeEditorContextMenuCommand, executeExplorerContextMenuCommand } from './pages/contextMenu';

export {
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  outputChannelContains,
  captureOutputChannelDetails
} from './pages/outputChannel';

export {
  ensureProblemsViewOpen,
  getProblemsCount,
  expectProblemsCount,
  expectProblemsCountAtLeast
} from './pages/problems';

export {
  waitForRunApexTestsProgressNotificationGone,
  waitForNotification,
  acceptNotification
} from './pages/notifications';

export { clickCodeLens } from './pages/codeLens';

export {
  clickOrgPickerStatusBar,
  expectOrgPickerStatusBar,
  expectOrgPickerActionItems,
  expectOrgPickerListsOrg,
  selectOrgInPicker
} from './pages/statusBar';

export { webviewActiveFrame, hasTitle, hasContent } from './pages/webview';
export type { ActiveFrameMatcher } from './pages/webview';

// Shared
export { saveScreenshot } from './shared/screenshotUtils';

// Fixtures
export { createEmptyTestWorkspace, createTestWorkspace } from './fixtures/desktopWorkspace';
export { createDesktopTest } from './fixtures/createDesktopTest';
export type { WorkerFixtures, TestFixtures } from './fixtures/desktopFixtureTypes';

// Web
export { createHeadlessServer, setupSignalHandlers } from './web/createHeadlessServer';

// Config factories
export { createWebConfig } from './config/createWebConfig';
export { createDesktopConfig } from './config/createDesktopConfig';
