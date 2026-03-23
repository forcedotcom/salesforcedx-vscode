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
      validateInput: (value: string) =>
        !value?.trim()
          ? nls.localize('create_script_name_empty_error')
          : !/^[A-Za-z][A-Za-z0-9_]*$/.test(value)
            ? nls.localize('create_script_name_format_error')
            : undefined
    })
  );
  return name?.trim() ? Option.some(name.trim()) : Option.none();
});

export const createAnonymousApexScriptCommand = Effect.fn('ApexLog.Command.createAnonymousApexScript')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { uri } = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const fsService = yield* api.services.FsService;
  const promptService = yield* api.services.PromptService;
  const scriptNameOpt = yield* promptForScriptName();
  if (Option.isNone(scriptNameOpt)) return;
  const scriptName = scriptNameOpt.value;
  const targetUri = Utils.joinPath(Utils.joinPath(uri, 'scripts'), `${scriptName}.apex`);
  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [targetUri] });
  yield* fsService.writeFile(targetUri, "System.debug('hello, world');\n");
  yield* fsService.showTextDocument(targetUri);
});
