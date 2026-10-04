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
import { promptForVfTypeName } from './vfTemplateProjectHelpers';

const VF_COMPONENT_TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  DefaultVFComponent: nls.localize('vf_component_default_template_description')
};

const promptForTemplate = Effect.fn('promptForVisualforceComponentTemplate')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  const customTemplateNames = yield* api.services.TemplateService.getCustomTemplateNames(
    'visualforcecomponent',
    '.component'
  );
  if (customTemplateNames.length === 0) {
    return 'DefaultVFComponent';
  }

  const promptService = yield* api.services.PromptService;
  const builtInNames = yield* api.services.TemplateService.getBuiltInTemplateNames(
    'visualforcecomponent',
    /\.component$/
  );
  const builtInItems = builtInNames.map(label => ({
    label,
    description: VF_COMPONENT_TEMPLATE_DESCRIPTIONS[label] ?? ''
  }));
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

export const createVisualforceComponentCommand = Effect.fn('createVisualforceComponentCommand')(function* (arg?: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const project = yield* api.services.ProjectService.getSfProject();
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const template = yield* promptForTemplate();
  const componentName = yield* promptForVfTypeName(nls.localize('vf_component_name_prompt'));

  const defaultUri = Utils.joinPath(
    workspaceInfo.uri,
    project.getDefaultPackage().path,
    'main',
    'default',
    'components'
  );

  const outputDirUri =
    arg ??
    (yield* promptService.promptForOutputDir({
      defaultUri,
      pickerPlaceHolder: nls.localize('output_dir_prompt')
    }));

  const uris = [`${componentName}.component`, `${componentName}.component-meta.xml`].map(f =>
    Utils.joinPath(outputDirUri, f)
  );
  const fsService = yield* api.services.FsService;
  yield* promptService.ensureMetadataOverwriteOrThrow({ uris });

  yield* api.services.TemplateService.create({
    cwd: yield* api.services.FsService.uriToPath(workspaceInfo.uri),
    templateType: api.services.TemplateType.VisualforceComponent,
    outputdir: outputDirUri,
    options: { componentname: componentName, label: componentName, template }
  });

  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('vf_generate_component_success'));
  yield* fsService.showTextDocument(uris[0]);

  return undefined;
});
