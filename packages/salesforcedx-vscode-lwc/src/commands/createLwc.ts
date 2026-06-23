/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { AURA_TYPE, LWC_TYPE } from '@salesforce/salesforcedx-lightning-lsp-common';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { promptForLwcName } from './promptForLwcName';

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
const determineComponentTemplate = Effect.fn('determineComponentTemplate')(function* (
  defaultLwcLanguage: string | undefined
) {
  return yield* Match.value(defaultLwcLanguage).pipe(
    Match.when('typescript', () => Effect.succeed('typeScript' as const)),
    Match.when('javascript', () => Effect.succeed('default' as const)),
    Match.orElse(() => promptForComponentType())
  );
});

/** Create LWC via TemplateService from services extension.
 * outputDir: when invoked from explorer context (right-click lwc folder), VS Code passes the folder URI
 * options.internal: passed to the template library.  Used for LWC on Salesforce Core, not for customer use  */
export const createLwcCommand = Effect.fn('createLwcCommand')(function* (
  outputDirParam?: URI,
  options?: { internal?: boolean }
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const projectInfo = yield* api.services.ProjectService.getProjectInfo();

  const template = yield* determineComponentTemplate(projectInfo.defaultLwcLanguage);
  const componentName = yield* api.services.ComponentSetService.describeProjectComponents({
    kind: 'projectDirectories',
    members: [
      { type: LWC_TYPE, fullName: '*' },
      { type: AURA_TYPE, fullName: '*' }
    ]
  }).pipe(
    Effect.map(info => new Set(info.components.map(c => c.fullName.toLowerCase()))),
    Effect.flatMap(existingNames => promptForLwcName({ existingNames }))
  );

  const outputDirUri =
    outputDirParam ??
    (yield* promptService.promptForOutputDir({
      defaultUri: Utils.joinPath(workspaceInfo.uri, projectInfo.defaultPackage.path, 'main', 'default', 'lwc'),
      folderName: 'lwc',
      pickerPlaceHolder: nls.localize('lwc_output_dir_prompt')
    }));

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
      internal: options?.internal ?? false
    }
  });

  const ext = template === 'typeScript' ? '.ts' : '.js';
  const mainFileUri = Utils.joinPath(outputDirUri, componentName, `${componentName}${ext}`);
  yield* fsService.showTextDocument(mainFileUri);
});
