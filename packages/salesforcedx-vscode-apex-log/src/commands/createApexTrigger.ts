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
import { promptForApexTypeName } from './sfTemplateProjectHelpers';

const APEX_TRIGGER_TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  ApexTrigger: nls.localize('apex_trigger_default_template_description')
};

const promptForTemplate = Effect.fn('promptForTriggerTemplate')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  const builtInNames = yield* api.services.TemplateService.getBuiltInTemplateNames('apextrigger', /\.trigger$/);
  const builtInItems = builtInNames.map((label: string) => ({
    label,
    description: APEX_TRIGGER_TEMPLATE_DESCRIPTIONS[label] ?? ''
  }));

  const configService = yield* api.services.ConfigService;
  const agg = yield* configService.getConfigAggregator();
  const customPath = agg.getPropertyValue<string>('org-custom-metadata-templates') ?? undefined;

  const fsService = yield* api.services.FsService;
  const apextriggerDir = customPath ? Utils.joinPath(URI.file(customPath), 'apextrigger') : undefined;
  const isDir = apextriggerDir ? yield* fsService.isDirectory(apextriggerDir) : false;
  const entries =
    isDir && apextriggerDir
      ? yield* fsService.readDirectoryWithTypes(apextriggerDir).pipe(Effect.orElseSucceed(() => []))
      : [];
  const customItems = entries
    .filter(({ uri }) => Utils.basename(uri).endsWith('.trigger'))
    .map(({ uri }) => ({ label: Utils.basename(uri).replace(/\.trigger$/, ''), description: '' }));

  const customNames = new Set(customItems.map(item => item.label));
  const nonOverriddenBuiltInItems = builtInItems.filter(item => !customNames.has(item.label));

  const items: vscode.QuickPickItem[] =
    customItems.length > 0
      ? [
          { kind: vscode.QuickPickItemKind.Separator, label: nls.localize('apex_trigger_builtin_templates_label') },
          ...nonOverriddenBuiltInItems,
          { kind: vscode.QuickPickItemKind.Separator, label: nls.localize('apex_trigger_custom_templates_label') },
          ...customItems
        ]
      : [...builtInItems];

  return yield* Effect.promise(() =>
    vscode.window.showQuickPick<vscode.QuickPickItem>(items, {
      placeHolder: nls.localize('template_type_prompt')
    })
  ).pipe(
    Effect.flatMap(choice => promptService.considerUndefinedAsCancellation(choice)),
    Effect.map(selected => selected.label)
  );
});

/** outputDirParam: explorer context (right-click triggers folder) */
export const createApexTriggerCommand = Effect.fn('createApexTriggerCommand')(function* (outputDirParam?: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const project = yield* api.services.ProjectService.getSfProject();

  const template = yield* promptForTemplate();

  const triggerName = yield* promptForApexTypeName({
    prompt: nls.localize('apex_trigger_name_prompt')
  });

  const defaultUri = Utils.joinPath(workspaceInfo.uri, project.getDefaultPackage().path, 'main', 'default', 'triggers');

  const outputDirUri =
    outputDirParam ??
    (yield* promptService.promptForOutputDir({
      defaultUri,
      folderName: 'triggers',
      pickerPlaceHolder: nls.localize('output_dir_prompt')
    }));

  const triggerUri = Utils.joinPath(outputDirUri, `${triggerName}.trigger`);
  const metaUri = Utils.joinPath(outputDirUri, `${triggerName}.trigger-meta.xml`);
  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [triggerUri, metaUri] });

  const fsService = yield* api.services.FsService;
  yield* api.services.TemplateService.create({
    cwd: yield* fsService.uriToPath(workspaceInfo.uri),
    templateType: api.services.TemplateType.ApexTrigger,
    outputdir: outputDirUri,
    options: {
      triggername: triggerName,
      triggerevents: ['before insert'],
      sobject: 'SOBJECT',
      template
    }
  });

  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('apex_generate_trigger_success'));
  yield* fsService.showTextDocument(triggerUri);

  return undefined;
});
