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
import { promptForAuraName } from './promptForAuraName';

const AURA_APP_TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  DefaultLightningApp: nls.localize('aura_app_default_template_description')
};

const promptForTemplate = Effect.fn('promptForAuraAppTemplate')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  const customTemplateNames = yield* api.services.TemplateService.getCustomTemplateNames('lightningapp', '.app');
  if (customTemplateNames.length === 0) {
    return 'DefaultLightningApp';
  }

  const promptService = yield* api.services.PromptService;
  const builtInNames = yield* api.services.TemplateService.getBuiltInTemplateNames('lightningapp', /\.app$/);
  const builtInItems = builtInNames.map(label => ({
    label,
    description: AURA_APP_TEMPLATE_DESCRIPTIONS[label] ?? ''
  }));
  const customItems = customTemplateNames.map(label => ({ label, description: '' }));
  const customNameSet = new Set(customTemplateNames);
  const nonOverriddenBuiltInItems = builtInItems.filter(item => !customNameSet.has(item.label));

  const items: vscode.QuickPickItem[] = [
    { kind: vscode.QuickPickItemKind.Separator, label: nls.localize('aura_builtin_templates_label') },
    ...nonOverriddenBuiltInItems,
    { kind: vscode.QuickPickItemKind.Separator, label: nls.localize('aura_custom_templates_label') },
    ...customItems
  ];

  return yield* Effect.promise(() =>
    vscode.window.showQuickPick<vscode.QuickPickItem>(items, { placeHolder: nls.localize('template_type_prompt') })
  ).pipe(
    Effect.flatMap(choice => promptService.considerUndefinedAsCancellation(choice)),
    Effect.map(selected => selected.label)
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

  const template = yield* promptForTemplate();
  const appName = yield* promptForAuraName({ promptKey: 'aura_app_name_prompt' });

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
      template,
      internal: options?.internal ?? false
    }
  });

  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('aura_generate_app_success'));
  yield* fsService.showTextDocument(Utils.joinPath(componentDirUri, `${appName}.app`));
});
