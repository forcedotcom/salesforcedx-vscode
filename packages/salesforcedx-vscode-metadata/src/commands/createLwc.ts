/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SfProject } from '@salesforce/core/project';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';

const promptForComponentName = Effect.fn('promptForComponentName')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('lwc_component_name_prompt'),
      placeHolder: nls.localize('lwc_component_name_placeholder'),
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) return nls.localize('lwc_component_name_empty_error');
        if (!/^[a-z][A-Za-z0-9_]*$/.test(value)) return nls.localize('lwc_component_name_format_error');
        return undefined;
      }
    })
  ).pipe(
    Effect.map(raw => raw?.trim()),
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
      { placeHolder: nls.localize('lwc_select_component_type') }
    )
  ).pipe(
    Effect.flatMap(selected => promptService.considerUndefinedAsCancellation(selected)),
    Effect.map(selected => selected.value)
  );
});

/** Determine component template based on priority:
 * 1. sfdx-project.json defaultLwcLanguage
 * 2. Prompt user (TypeScript always visible) */
const determineComponentTemplate = Effect.fn('determineComponentTemplate')(function* (project: SfProject) {
  const projectJson = yield* Effect.tryPromise(() => project.retrieveSfProjectJson());
  return yield* Match.value(projectJson.get('defaultLwcLanguage')).pipe(
    Match.when('typescript', () => Effect.succeed('typeScript' as const)),
    Match.when('javascript', () => Effect.succeed('default' as const)),
    Match.when(Match.undefined, () => promptForComponentType()),
    Match.exhaustive
  );
});

/** Create LWC via TemplateService from services extension.
 * outputDir: when invoked from explorer context (right-click lwc folder), VS Code passes the folder URI */
export const createLwcCommand = Effect.fn('createLwcCommand')(function* (outputDirParam?: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const project = yield* api.services.ProjectService.getSfProject();
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const template = yield* determineComponentTemplate(project);
  const componentName = yield* promptForComponentName();

  const defaultUri = Utils.joinPath(workspaceInfo.uri, project.getDefaultPackage().path, 'main', 'default', 'lwc');

  const outputDirUri =
    outputDirParam ??
    (yield* promptService.promptForOutputDir({
      defaultUri,
      folderName: 'lwc',
      pickerPlaceHolder: nls.localize('lwc_output_dir_prompt')
    }));

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

  const ext = template === 'typeScript' ? '.ts' : '.js';
  const mainFileUri = Utils.joinPath(outputDirUri, componentName, `${componentName}${ext}`);
  yield* fsService.showTextDocument(mainFileUri);
});
