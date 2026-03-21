/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { Utils, URI } from 'vscode-uri';
import { nls } from '../messages';
import { promptForPackageMetadataSubdir } from '../templates-shared/sfTemplateProjectHelpers';

const LWC_EXTENSION_NAME = 'salesforcedx-vscode-lwc';
const LWC_PREVIEW_TYPESCRIPT_SUPPORT = 'preview.typeScriptSupport';

const getHasTypeScriptSupport = (): boolean =>
  vscode.workspace.getConfiguration(LWC_EXTENSION_NAME).get(LWC_PREVIEW_TYPESCRIPT_SUPPORT, false);

const promptForComponentName = Effect.fn('promptForComponentName')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('lwc_component_name_prompt'),
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) return nls.localize('lwc_component_name_empty_error');
        if (!/^[a-z][A-Za-z0-9_]*$/.test(value)) {
          return /^[A-Z]/.test(value)
            ? nls.localize('lwc_component_name_lowercase_error')
            : nls.localize('lwc_component_name_format_error');
        }
        return undefined;
      }
    })
  ).pipe(
    Effect.map(n => n?.trim()),
    Effect.flatMap(promptService.considerUndefinedAsCancellation)
  );
});

const promptForComponentType = Effect.fn('promptForComponentType')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* Effect.promise(() =>
    vscode.window.showQuickPick(
      [
        { label: 'JavaScript', value: 'default' as const },
        { label: 'TypeScript', value: 'typeScript' as const }
      ],
      { placeHolder: nls.localize('lwc_select_component_type') ?? 'Select component type' }
    )
  ).pipe(
    Effect.flatMap(selected => promptService.considerUndefinedAsCancellation(selected)),
    Effect.map(selected => selected.value)
  );
});

/** Create LWC via TemplateService from services extension.
 * outputDir: when invoked from explorer context (right-click lwc folder), VS Code passes the folder URI */
export const createLwcCommand = Effect.fn('createLwcCommand')(function* (outputDirParam?: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const project = yield* api.services.ProjectService.getSfProject();
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const componentName = yield* promptForComponentName();

  const outputDirUri =
    outputDirParam ??
    (yield* promptForPackageMetadataSubdir(
      project,
      'lwc',
      nls.localize('lwc_output_dir_prompt') ?? 'Select output directory'
    ));

  const template = getHasTypeScriptSupport() ? yield* promptForComponentType() : ('default' as const);

  yield* Effect.annotateCurrentSpan({
    componentName,
    outputDir: outputDirUri.toString(),
    template
  });

  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [Utils.joinPath(outputDirUri, componentName)] });

  const fsService = yield* api.services.FsService;

  yield* api.services.TemplateService.create({
    cwd: yield* fsService.uriToPath(workspaceInfo.uri),
    templateType: api.services.TemplateType.LightningComponent,
    outputdir: outputDirUri,
    options: {
      componentname: componentName,
      template,
      type: 'lwc',
      internal: false
    }
  });

  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('lwc_generate_success'));

  const ext = template === 'typeScript' ? '.ts' : '.js';
  const actualDirUri = Utils.joinPath(outputDirUri, componentName);
  const mainFileUri = Utils.joinPath(actualDirUri, `${componentName}${ext}`);
  yield* fsService.showTextDocument(mainFileUri);
});
