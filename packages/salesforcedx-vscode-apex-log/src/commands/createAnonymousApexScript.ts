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

export const createAnonymousApexScriptCommand = Effect.fn('ApexLog.Command.createAnonymousApexScript')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;
  const promptService = yield* api.services.PromptService;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const scriptName = yield* promptForScriptName();

  const outputDir = yield* promptService.promptForOutputDir({
    defaultUri: Utils.joinPath(workspaceInfo.uri, 'scripts', 'apex'),
    description: nls.localize('create_script_output_dir_default_description'),
    pickerPlaceHolder: nls.localize('create_script_output_dir_prompt')
  });

  const targetUri = Utils.joinPath(outputDir, `${scriptName}.apex`);
  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [targetUri] });
  yield* fsService.writeFile(targetUri, "System.debug('hello, world');\n");
  yield* fsService.showTextDocument(targetUri);
});
