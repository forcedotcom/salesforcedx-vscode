import * as path from 'path';
import * as vscode from 'vscode';

import { SObjectCategory } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/describe';
import { getSObjectsFolderPath } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/utils';
import { callExternalCommand } from './commands/callExternalCommand';
import { openSObjectNodeCommand } from './commands/openSObjectNodeCommand';
import { CORE_EXTENTION_ID, REFRESH_SOBJECTS_COMMAND_NAME } from './constants';
import { SObjectDataProvider } from './sObjectExplorer';

export function activate(context: vscode.ExtensionContext) {
  const sObjectDataProvider = new SObjectDataProvider(context);

  const forceSObjectExplorerRefreshCmd = vscode.commands.registerCommand(
    'sfdx.force.internal.sobjectexplorerrefresh',
    () => callExternalCommand(CORE_EXTENTION_ID, REFRESH_SOBJECTS_COMMAND_NAME)
  );

  const forceOpenSObjectNodeCmd = vscode.commands.registerCommand(
    'sfdx.force.internal.opensobjectnode',
    openSObjectNodeCommand
  );

  const forceSObjectExplorerTree = vscode.window.registerTreeDataProvider(
    'sfdx.force.sobjectexplorer',
    sObjectDataProvider
  );

  const forceSOBjectTextDoc = vscode.workspace.registerTextDocumentContentProvider(
    'sobject',
    sObjectDataProvider
  );

  const sobjectPath = getSObjectsFolderPath(
    vscode.workspace.rootPath as string,
    SObjectCategory.ALL
  );
  const sobjectWatcher = vscode.workspace.createFileSystemWatcher(
    path.join(sobjectPath, '**/*.cls')
  );
  sobjectWatcher.onDidDelete(e => sObjectDataProvider.refresh());
  sobjectWatcher.onDidCreate(e => sObjectDataProvider.refresh());
  sobjectWatcher.onDidChange(e => sObjectDataProvider.refresh());

  console.log('sObject Explorer Extension Activated');

  return vscode.Disposable.from(
    forceSObjectExplorerRefreshCmd,
    forceOpenSObjectNodeCmd,
    forceSObjectExplorerTree,
    forceSOBjectTextDoc,
    sobjectWatcher
  );
}

export function deactivate() {
  console.log('SObject Explorer Extension Deactivated');
}
