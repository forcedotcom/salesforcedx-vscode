/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { shared as lspCommon } from '@salesforce/lightning-lsp-common';
import { ExtensionContext } from 'vscode';
import { registerLwcTestCodeLensProvider } from './codeLens/lwcTestCodeLensProvider';
import { registerCommands } from './commands';
import { registerLwcTestExplorerTreeView } from './testExplorer/testOutlineProvider';
import { lwcTestIndexer } from './testIndexer';
import { taskService } from './testRunner/taskService';
import { testResultsWatcher } from './testRunner/testResultsWatcher';
import { startWatchingEditorFocusChange } from './utils/context';
import { workspaceService } from './workspace';

/**
 * Activate LWC Test support for supported workspace types
 * @param workspaceType workspace type
 */
export const shouldActivateLwcTestSupport = (workspaceType: lspCommon.WorkspaceType) => {
  return workspaceService.isSFDXWorkspace(workspaceType) || workspaceService.isCoreWorkspace(workspaceType);
};

export const activateLwcTestSupport = (extensionContext: ExtensionContext, workspaceType: lspCommon.WorkspaceType) => {
  workspaceService.register(extensionContext, workspaceType);
  registerCommands(extensionContext);
  registerLwcTestCodeLensProvider(extensionContext);
  registerLwcTestExplorerTreeView(extensionContext);
  startWatchingEditorFocusChange(extensionContext);
  taskService.registerTaskService(extensionContext);
  testResultsWatcher.register(extensionContext);
  lwcTestIndexer.register(extensionContext);
};
