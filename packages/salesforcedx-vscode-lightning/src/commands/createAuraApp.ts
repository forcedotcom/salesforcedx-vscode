/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';

const promptForName = Effect.fn('createAuraApp.promptForName')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('aura_component_name_prompt'),
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) return nls.localize('aura_component_name_empty_error');
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) return nls.localize('aura_component_name_format_error');
        return undefined;
      }
    })
  ).pipe(
    Effect.map(raw => raw?.trim()),
    Effect.flatMap(promptService.considerUndefinedAsCancellation)
  );
});

export const createAuraAppCommand = Effect.fn('createAuraAppCommand')(function* (
  outputDirParam?: URI,
  options?: { internal?: boolean }
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const project = yield* api.services.ProjectService.getSfProject();
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const fsService = yield* api.services.FsService;

  const appName = yield* promptForName();

  const defaultUri = Utils.joinPath(workspaceInfo.uri, project.getDefaultPackage().path, 'main', 'default', 'aura');

  const outputDirUri =
    outputDirParam ??
    (yield* promptService.promptForOutputDir({
      defaultUri,
      folderName: 'aura',
      pickerPlaceHolder: nls.localize('aura_output_dir_prompt')
    }));

  const componentDirUri = Utils.joinPath(outputDirUri, appName);
  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [componentDirUri] });

  yield* api.services.TemplateService.create({
    cwd: yield* fsService.uriToPath(workspaceInfo.uri),
    templateType: api.services.TemplateType.LightningApp,
    outputdir: outputDirUri,
    options: {
      appname: appName,
      template: 'DefaultLightningApp',
      internal: options?.internal ?? false
    }
  });

  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('aura_generate_app_success'));
  yield* fsService.showTextDocument(Utils.joinPath(componentDirUri, `${appName}.app`));
});
