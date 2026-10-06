/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { annotateRootSpan, ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { promptForVfTypeName } from './vfTemplateProjectHelpers';

const VF_PAGE_TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  DefaultVFPage: nls.localize('vf_page_default_template_description')
};

const promptForTemplate = Effect.fn('promptForVisualforcePageTemplate')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  const customTemplateNames = yield* api.services.TemplateService.getCustomTemplateNames('visualforcepage', '.page');
  if (customTemplateNames.length === 0) {
    return 'DefaultVFPage';
  }

  const promptService = yield* api.services.PromptService;
  const builtInNames = yield* api.services.TemplateService.getBuiltInTemplateNames('visualforcepage', /\.page$/);
  const builtInItems = builtInNames.map(label => ({ label, description: VF_PAGE_TEMPLATE_DESCRIPTIONS[label] ?? '' }));
  const customItems = customTemplateNames.map(label => ({ label, description: '' }));
  const customNameSet = new Set(customTemplateNames);
  const nonOverriddenBuiltInItems = builtInItems.filter(item => !customNameSet.has(item.label));

  const items: vscode.QuickPickItem[] = [
    { kind: vscode.QuickPickItemKind.Separator, label: nls.localize('vf_builtin_templates_label') },
    ...nonOverriddenBuiltInItems,
    { kind: vscode.QuickPickItemKind.Separator, label: nls.localize('vf_custom_templates_label') },
    ...customItems
  ];

  return yield* Effect.promise(() =>
    vscode.window.showQuickPick<vscode.QuickPickItem>(items, { placeHolder: nls.localize('template_type_prompt') })
  ).pipe(
    Effect.flatMap(choice => promptService.considerUndefinedAsCancellation(choice)),
    Effect.map(selected => selected.label)
  );
});

export const createVisualforcePageCommand = Effect.fn('createVisualforcePageCommand')(function* (arg?: URI) {
  yield* annotateRootSpan('overwriteOccurred', false);
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const project = yield* api.services.ProjectService.getSfProject();
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const template = yield* promptForTemplate();
  const pageName = yield* promptForVfTypeName(nls.localize('vf_page_name_prompt'));

  const defaultUri = Utils.joinPath(workspaceInfo.uri, project.getDefaultPackage().path, 'main', 'default', 'pages');

  const outputDirUri =
    arg ??
    (yield* promptService.promptForOutputDir({
      defaultUri,
      pickerPlaceHolder: nls.localize('output_dir_prompt')
    }));
  yield* annotateRootSpan({
    templateType: api.services.TemplateType.VisualforcePage,
    outputDirSource: arg ? 'arg' : 'prompt'
  });

  const uris = [`${pageName}.page`, `${pageName}.page-meta.xml`].map(f => Utils.joinPath(outputDirUri, f));
  const fsService = yield* api.services.FsService;
  yield* promptService.ensureMetadataOverwriteOrThrow({ uris }).pipe(
    Effect.flatMap(overwriteConfirmed =>
      fsService.uriToPath(workspaceInfo.uri).pipe(
        Effect.flatMap(cwd =>
          api.services.TemplateService.create({
            cwd,
            templateType: api.services.TemplateType.VisualforcePage,
            outputdir: outputDirUri,
            options: { pagename: pageName, label: pageName, template }
          })
        ),
        Effect.tap(() => annotateRootSpan('overwriteOccurred', overwriteConfirmed))
      )
    )
  );

  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('vf_generate_page_success'));
  yield* fsService.showTextDocument(uris[0]);

  return undefined;
});
