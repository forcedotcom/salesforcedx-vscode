/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { nls } from '../messages';

const WAVE_TEMPLATES_FOLDER = 'waveTemplates';
const TEMPLATE_INFO_FILE = 'template-info.json';

const promptForTemplateName = Effect.fn('promptForAnalyticsTemplateName')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  return yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('analytics_template_name_text')
    })
  ).pipe(
    Effect.map(value => value?.trim()),
    Effect.flatMap(promptService.considerUndefinedAsCancellation)
  );
});

export const analyticsGenerateTemplate = Effect.fn('analyticsGenerateTemplate')(function* (outputDirParam?: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const project = yield* api.services.ProjectService.getSfProject();
  const fsService = yield* api.services.FsService;

  const templateName = yield* promptForTemplateName();
  const defaultUri = Utils.joinPath(
    workspaceInfo.uri,
    project.getDefaultPackage().path,
    'main',
    'default',
    WAVE_TEMPLATES_FOLDER
  );
  const outputDirUri =
    outputDirParam ??
    (yield* promptService.promptForOutputDir({
      defaultUri,
      folderName: WAVE_TEMPLATES_FOLDER,
      pickerPlaceHolder: nls.localize('analytics_output_dir_prompt')
    }));
  const templateDirUri = Utils.joinPath(outputDirUri, templateName);

  yield* Effect.annotateCurrentSpan({
    templateName,
    outputDir: outputDirUri.toString()
  });
  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [templateDirUri] });

  yield* api.services.TemplateService.create({
    cwd: yield* fsService.uriToPath(workspaceInfo.uri),
    templateType: api.services.TemplateType.AnalyticsTemplate,
    outputdir: outputDirUri,
    options: {
      templatename: templateName
    }
  }).pipe(promptService.withProgress(nls.localize('analytics_generate_template_text')));

  yield* fsService.showTextDocument(Utils.joinPath(templateDirUri, TEMPLATE_INFO_FILE));
});
