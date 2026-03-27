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
        const normalized = value.trim();
        if (!normalized) return nls.localize('soql_file_name_empty_error');
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(normalized)) return nls.localize('soql_file_name_format_error');
        return undefined;
      }
    })
  ).pipe(
    Effect.map(n => n?.trim()),
    Effect.flatMap(raw => promptService.considerUndefinedAsCancellation(raw))
  );
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
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const fileName = yield* promptForFileName();

  const defaultUri = Utils.joinPath(workspaceInfo.uri, 'scripts', 'soql');
  const outputDir = yield* promptService.promptForOutputDir({
    defaultUri,
    description: nls.localize('soql_output_dir_default_description'),
    pickerPlaceHolder: nls.localize('soql_output_dir_prompt')
  });

  yield* createAndOpenFile(fileName, outputDir, BUILDER_VIEW_TYPE);
});

export const soqlOpenNewTextEditor = Effect.fn('soql_open_new_text_editor')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const fileName = yield* promptForFileName();

  const defaultUri = Utils.joinPath(workspaceInfo.uri, 'scripts', 'soql');
  const outputDir = yield* promptService.promptForOutputDir({
    defaultUri,
    description: nls.localize('soql_output_dir_default_description'),
    pickerPlaceHolder: nls.localize('soql_output_dir_prompt')
  });

  yield* createAndOpenFile(fileName, outputDir, EDITOR_VIEW_TYPE);
});
