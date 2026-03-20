/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SfProject } from '@salesforce/core/project';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { Utils, URI } from 'vscode-uri';
import { nls } from '../messages';

const LWC_EXTENSION_NAME = 'salesforcedx-vscode-lwc';
const LWC_PREVIEW_TYPESCRIPT_SUPPORT = 'preview.typeScriptSupport';

const getHasTypeScriptSupport = (): boolean =>
  vscode.workspace.getConfiguration(LWC_EXTENSION_NAME).get(LWC_PREVIEW_TYPESCRIPT_SUPPORT, false);

/** Prompt user to select output directory from available package directories (lwc subdir) */
const promptForOutputDir = Effect.fn('promptForOutputDir')(function* (project: SfProject) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const items = project.getPackageDirectories().map(pkg => ({
    label: `${pkg.path}/main/default/lwc`,
    description: pkg.default ? '(default)' : undefined,
    uri: Utils.joinPath(workspaceInfo.uri, pkg.path, 'main', 'default', 'lwc')
  }));

  return yield* Effect.promise(() =>
    vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('lwc_output_dir_prompt') ?? 'Select output directory',
      matchOnDescription: true
    })
  ).pipe(Effect.flatMap(selected => promptService.ensureValueOrThrow(selected)));
});

const promptForComponentName = Effect.fn('promptForComponentName')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('lwc_component_name_prompt'),
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) return nls.localize('lwc_component_name_empty_error');
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) return nls.localize('lwc_component_name_format_error');
        return undefined;
      }
    })
  ).pipe(
    Effect.map(n => n?.trim()),
    Effect.flatMap(promptService.ensureValueOrThrow)
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
    Effect.flatMap(selected => promptService.ensureValueOrThrow(selected)),
    Effect.map(selected => selected?.value)
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

  const outputDirUri = outputDirParam ?? (yield* promptForOutputDir(project)).uri;

  const hasTsSupport = getHasTypeScriptSupport();
  const template = hasTsSupport ? yield* promptForComponentType() : ('default' as const);

  yield* Effect.annotateCurrentSpan({
    componentName,
    outputDir: outputDirUri.toString(),
    template
  });

  const componentDirUri = Utils.joinPath(outputDirUri, componentName);
  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [componentDirUri] });
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
  // @salesforce/templates uses camelCase for LWC dir and filename (lightningComponentGenerator.js:69)
  const camelCaseName = `${componentName.substring(0, 1).toLowerCase()}${componentName.substring(1)}`;
  const actualDirUri = Utils.joinPath(outputDirUri, camelCaseName);
  const mainFileUri = Utils.joinPath(actualDirUri, `${camelCaseName}${ext}`);
  yield* fsService.showTextDocument(mainFileUri);

  return undefined;
});
