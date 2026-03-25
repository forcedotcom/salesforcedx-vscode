/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { nls } from '../messages';

const promptForScriptName = Effect.fn('promptForScriptName')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  return yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('create_script_name_prompt'),
      validateInput: (value: string) => {
        const normalized = value.trim();
        if (!normalized) return nls.localize('create_script_name_empty_error');
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(normalized)) return nls.localize('create_script_name_format_error');
        return undefined;
      }
    })
  ).pipe(
    Effect.map(raw => raw?.trim()),
    Effect.flatMap(promptService.considerUndefinedAsCancellation)
  );
});

const CUSTOM_DIR_LABEL = `$(file-directory) ${nls.localize('create_script_custom_output_directory')}`;

const promptForOutputDir = Effect.fn('promptForOutputDir')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const defaultUri = Utils.joinPath(workspaceInfo.uri, 'scripts', 'apex');

  const selected = yield* Effect.promise(() =>
    vscode.window.showQuickPick(
      [
        {
          label: defaultUri.fsPath,
          description: nls.localize('create_script_output_dir_default_description'),
          uri: defaultUri
        },
        { label: CUSTOM_DIR_LABEL, description: undefined, uri: undefined }
      ],
      {
        placeHolder: nls.localize('create_script_output_dir_prompt'),
        matchOnDescription: true
      }
    )
  ).pipe(Effect.flatMap(choice => promptService.considerUndefinedAsCancellation(choice)));

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

export const createAnonymousApexScriptCommand = Effect.fn('ApexLog.Command.createAnonymousApexScript')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;
  const promptService = yield* api.services.PromptService;

  const scriptName = yield* promptForScriptName();

  const outputDir = yield* promptForOutputDir();
  if (!outputDir) return;

  const targetUri = Utils.joinPath(outputDir, `${scriptName}.apex`);
  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [targetUri] });
  yield* fsService.writeFile(targetUri, "System.debug('hello, world');\n");
  yield* fsService.showTextDocument(targetUri);
});
