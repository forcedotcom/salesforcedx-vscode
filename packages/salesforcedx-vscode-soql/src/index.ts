/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { startLanguageClient, stopLanguageClient } from './client/client';
import { soqlBuilderToggle } from './commands/soqlBuilderToggle';
import { soqlOpenNew } from './commands/soqlFileCreate';
import { SOQLEditorProvider } from './editor/soqlEditorProvider';
import { QueryDataViewService } from './queryDataView/queryDataViewService';
import { channelService, workspaceContext } from './sfdx';
import { startTelemetry, stopTelemetry } from './telemetry/telemetry';

export async function activate(context: vscode.ExtensionContext): Promise<any> {
  const extensionHRStart = process.hrtime();
  context.subscriptions.push(SOQLEditorProvider.register(context));
  QueryDataViewService.register(context);
  await workspaceContext.initialize(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('soql.builder.open.new', soqlOpenNew)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('soql.builder.toggle', soqlBuilderToggle)
  );

  await startLanguageClient(context);
  startTelemetry(context, extensionHRStart).catch();
  console.log('SOQL Extension Activated');
  return { workspaceContext, channelService };
}

export function deactivate(): Thenable<void> | undefined {
  stopTelemetry().catch();
  return stopLanguageClient();
}

/*
 * Export from all modules here for webpack efficiency.
 */
export { startLanguageClient, stopLanguageClient, clearDiagnostics } from './client/client';
export { soqlBuilderToggle } from './commands/soqlBuilderToggle';
export { soqlOpenNew } from './commands/soqlFileCreate';
export { HtmlUtils } from './editor/htmlUtils';
export { QueryRunner } from './editor/queryRunner';
export { MessageType, SOQLEditorInstance, SoqlEditorEvent } from './editor/soqlEditorInstance';
export { SOQLEditorProvider } from './editor/soqlEditorProvider';
export { CsvDataProvider } from './queryDataView/dataProviders/csvDataProvider';
export { DataProvider } from './queryDataView/dataProviders/iDataProvider';
export { JsonDataProvider } from './queryDataView/dataProviders/jsonDataProvider';
export { FileFormat, QueryDataFileService } from './queryDataView/queryDataFileService';
export { extendQueryData } from './queryDataView/queryDataHelper';
export { DataViewEvent, QueryDataViewService } from './queryDataView/queryDataViewService';
export { TelemetryModelJson, startTelemetry, stopTelemetry, telemetryService } from './telemetry/telemetry';
export { getDocumentName, getRootWorkspacePath, trackErrorWithTelemetry } from './commonUtils';
export {
  BUILDER_VIEW_TYPE, DATA_CSV_EXT, DATA_JSON_EXT, DATA_VIEW_ICONS_PATH, DATA_VIEW_RESOURCE_ROOTS_PATH, DATA_VIEW_UI_PATH, EDITOR_VIEW_TYPE, HTML_FILE, IMAGES_DIR_NAME, OPEN_WITH_COMMAND,
  QUERY_DATA_VIEW_PANEL_TITLE, QUERY_DATA_VIEW_SCRIPT_FILENAME, QUERY_DATA_VIEW_STYLE_FILENAME, QUERY_DATA_VIEW_TYPE, SAVE_ICON_FILENAME, SOQL_BUILDER_UI_PATH, SOQL_BUILDER_WEB_ASSETS_PATH,
  SOQL_CONFIGURATION_NAME, SOQL_VALIDATION_CONFIG, TABULATOR_SCRIPT_FILENAME, TABULATOR_STYLE_FILENAME
} from './constants';
export { channelService, isDefaultOrgSet, onOrgChange, retrieveSObject, retrieveSObjects, withSFConnection, workspaceContext } from './sfdx';
