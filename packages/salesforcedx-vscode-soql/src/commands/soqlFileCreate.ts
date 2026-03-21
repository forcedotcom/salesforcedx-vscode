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
import { BUILDER_VIEW_TYPE, EDITOR_VIEW_TYPE, OPEN_WITH_COMMAND } from '../constants';
import { nls } from '../messages';

const promptForFileName = Effect.fn('soqlFileCreate.promptForFileName')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* Effect.promise(() =>
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
  ).pipe(
    Effect.map(n => n?.trim()),
    Effect.flatMap(promptService.considerUndefinedAsCancellation)
  );
});

const CUSTOM_DIR_LABEL = `$(file-directory) ${nls.localize('soql_custom_output_directory')}`;

const promptForOutputDir = Effect.fn('soqlFileCreate.promptForOutputDir')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const defaultUri = Utils.joinPath(workspaceInfo.uri, 'scripts', 'soql');

  const selected = yield* Effect.promise(() =>
    vscode.window.showQuickPick(
      [
        {
          label: defaultUri.fsPath,
          description: nls.localize('soql_output_dir_default_description'),
          uri: defaultUri
        },
        { label: CUSTOM_DIR_LABEL, description: undefined, uri: undefined }
      ],
      {
        placeHolder: nls.localize('soql_output_dir_prompt'),
        matchOnDescription: true
      }
    )
  );

  if (selected?.label === CUSTOM_DIR_LABEL) {
    const folders = yield* Effect.promise(() =>
      vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: workspaceInfo.uri,
        openLabel: 'Select'
      })
    ).pipe(Effect.flatMap(choice => promptService.considerUndefinedAsCancellation(choice)));
    return folders[0];
  }

  return yield* Effect.succeed(selected?.uri).pipe(Effect.flatMap(choice => promptService.considerUndefinedAsCancellation(choice)));
});

const createAndOpenFile = Effect.fn('soqlFileCreate.createAndOpenFile')(function* (
  fileName: string,
  outputDir: URI,
  viewType: string
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const fileUri = Utils.joinPath(outputDir, `${fileName}.soql`);

  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [fileUri] });

  yield* api.services.FsService.safeWriteFile(fileUri, '');
  yield* Effect.promise(() => vscode.commands.executeCommand(OPEN_WITH_COMMAND, fileUri, viewType));
});

export const soqlOpenNewBuilder = Effect.fn('soql_open_new_builder')(function* () {
  const fileName = yield* promptForFileName();
  const outputDir = yield* promptForOutputDir();
  yield* createAndOpenFile(fileName, outputDir, BUILDER_VIEW_TYPE);
});

export const soqlOpenNewTextEditor = Effect.fn('soql_open_new_text_editor')(function* () {
  const fileName = yield* promptForFileName();
  const outputDir = yield* promptForOutputDir();
  yield* createAndOpenFile(fileName, outputDir, EDITOR_VIEW_TYPE);
});
