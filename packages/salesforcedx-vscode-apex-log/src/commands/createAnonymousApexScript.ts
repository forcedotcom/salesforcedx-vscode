/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { nls } from '../messages';

const promptForScriptName = Effect.fn('promptForScriptName')(function* () {
  const name = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('create_script_name_prompt'),
      placeHolder: nls.localize('create_script_name_placeholder'),
      validateInput: (value: string) =>
        !value?.trim()
          ? 'Script name cannot be empty'
          : !/^[A-Za-z][A-Za-z0-9_]*$/.test(value)
            ? 'Name must start with a letter and contain only letters, numbers, and underscores'
            : undefined
    })
  );
  return name?.trim() ? Option.some(name.trim()) : Option.none();
});

const checkAndPromptOverwrite = Effect.fn('checkAndPromptOverwrite')(function* (uri: vscode.Uri) {
  const fsService = yield* (yield* ExtensionProviderService).getServicesApi.pipe(
    Effect.flatMap(api => api.services.FsService)
  );
  const exists = yield* fsService.fileOrFolderExists(uri);
  if (!exists) return Option.some(true);
  const choice = yield* Effect.promise(() =>
    vscode.window.showWarningMessage(
      nls.localize('create_script_already_exists'),
      { modal: true },
      nls.localize('overwrite_button'),
      nls.localize('cancel_button')
    )
  );
  return choice === nls.localize('overwrite_button') ? Option.some(true) : Option.none();
});

export const createAnonymousApexScriptCommand = Effect.fn('ApexLog.Command.createAnonymousApexScript')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { uri } = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const fsService = yield* api.services.FsService;
  const scriptNameOpt = yield* promptForScriptName();
  if (Option.isNone(scriptNameOpt)) return;
  const scriptName = scriptNameOpt.value;
  const targetUri = Utils.joinPath(Utils.joinPath(uri, 'scripts'), `${scriptName}.apex`);
  const overwriteOpt = yield* checkAndPromptOverwrite(targetUri);
  if (Option.isNone(overwriteOpt)) return;
  yield* fsService.writeFile(targetUri, "System.debug('hello, world');\n");
  yield* fsService.showTextDocument(targetUri);
});
