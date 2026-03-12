/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { BUILDER_VIEW_TYPE, OPEN_WITH_COMMAND } from '../constants';
import { nls } from '../messages';

const promptForFileName = Effect.fn('soqlFileCreate.promptForFileName')(function* () {
  const name = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('soql_file_name_prompt'),
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) {
          return nls.localize('soql_file_name_invalid');
        }
        if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(value.trim())) {
          return nls.localize('soql_file_name_invalid');
        }
        return undefined;
      }
    })
  );
  return name?.trim();
});

const CUSTOM_DIR_LABEL = `$(file-directory) ${nls.localize('soql_custom_output_directory')}`;

const promptForOutputDir = Effect.fn('soqlFileCreate.promptForOutputDir')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const defaultUri = Utils.joinPath(workspaceInfo.uri, 'scripts', 'soql');

  const selected = yield* Effect.promise(() =>
    vscode.window.showQuickPick(
      [
        { label: defaultUri.fsPath, description: '(default)', uri: defaultUri },
        { label: CUSTOM_DIR_LABEL, description: undefined, uri: undefined }
      ],
      {
        placeHolder: nls.localize('soql_output_dir_prompt'),
        matchOnDescription: true
      }
    )
  );

  if (!selected) return undefined;

  if (selected.label === CUSTOM_DIR_LABEL) {
    const folders = yield* Effect.promise(() =>
      vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: workspaceInfo.uri,
        openLabel: 'Select'
      })
    );
    return folders?.[0];
  }

  return selected.uri;
});

/** Returns false if the user cancelled the overwrite prompt, true otherwise. */
const confirmOverwrite = Effect.fn('soqlFileCreate.confirmOverwrite')(function* (fileUri: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const exists = yield* api.services.FsService.fileOrFolderExists(fileUri);
  if (!exists) return true;

  const choice = yield* Effect.promise(() =>
    vscode.window.showWarningMessage(
      nls.localize('soql_file_already_exists'),
      { modal: true },
      nls.localize('soql_overwrite_button')
    )
  );

  return choice === nls.localize('soql_overwrite_button');
});

const createAndOpenFile = Effect.fn('soqlFileCreate.createAndOpenFile')(function* (fileName: string, outputDir: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fileUri = Utils.joinPath(outputDir, `${fileName}.soql`);

  const confirmed = yield* confirmOverwrite(fileUri);
  if (!confirmed) return;

  yield* api.services.FsService.safeWriteFile(fileUri, '');
  yield* Effect.promise(() => vscode.commands.executeCommand(OPEN_WITH_COMMAND, fileUri, BUILDER_VIEW_TYPE));
});

export const soqlOpenNew = Effect.fn('soql_builder_open_new')(function* () {
  const fileName = yield* promptForFileName();
  if (!fileName) return;

  const outputDir = yield* promptForOutputDir();
  if (!outputDir) return;

  yield* createAndOpenFile(fileName, outputDir);
});
