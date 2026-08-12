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

const TRIGGER_EVENTS = [
  'before insert',
  'before update',
  'before delete',
  'after insert',
  'after update',
  'after delete',
  'after undelete'
] as const;

const promptForSObject = Effect.fn('promptForTriggerSObject')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  const sobjects = yield* api.services.MetadataDescribeService.listSObjects().pipe(Effect.orElseSucceed(() => []));

  if (sobjects.length === 0) {
    return yield* Effect.promise(() =>
      vscode.window.showInputBox({ prompt: nls.localize('apex_trigger_sobject_prompt') })
    ).pipe(
      Effect.map(raw => raw?.trim()),
      Effect.flatMap(promptService.considerUndefinedAsCancellation)
    );
  }

  const items: vscode.QuickPickItem[] = sobjects
    .filter(s => s.triggerable)
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map(s => ({ label: s.name, description: s.custom ? 'Custom' : '' }));

  return yield* Effect.promise(() =>
    vscode.window.showQuickPick(items, { placeHolder: nls.localize('apex_trigger_sobject_prompt') })
  ).pipe(
    Effect.flatMap(promptService.considerUndefinedAsCancellation),
    Effect.map(selected => selected.label)
  );
});

const promptForTriggerEvents = Effect.fn('promptForTriggerEvents')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  const items: vscode.QuickPickItem[] = TRIGGER_EVENTS.map(event => ({
    label: event,
    picked: event === 'before insert'
  }));

  return yield* Effect.promise(() =>
    vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('apex_trigger_events_prompt'),
      canPickMany: true
    })
  ).pipe(
    Effect.flatMap(promptService.considerEmptySelectionAsCancellation),
    Effect.map(selected => selected.map(item => item.label))
  );
});

const APEX_TRIGGER_TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  ApexTrigger: nls.localize('apex_trigger_default_template_description')
};

const promptForTemplate = Effect.fn('promptForTriggerTemplate')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  const customTemplateNames = yield* api.services.TemplateService.getCustomTemplateNames('apextrigger', '.trigger');
  const customItems = customTemplateNames.map(label => ({ label, description: '' }));

  if (customItems.length === 0) {
    return 'ApexTrigger';
  }

  const promptService = yield* api.services.PromptService;
  const builtInNames = yield* api.services.TemplateService.getBuiltInTemplateNames('apextrigger', /\.trigger$/);
  const builtInItems = builtInNames.map((label: string) => ({
    label,
    description: APEX_TRIGGER_TEMPLATE_DESCRIPTIONS[label] ?? ''
  }));

  const customNameSet = new Set(customTemplateNames);
  const nonOverriddenBuiltInItems = builtInItems.filter(item => !customNameSet.has(item.label));

  const items: vscode.QuickPickItem[] = [
    { kind: vscode.QuickPickItemKind.Separator, label: nls.localize('apex_trigger_builtin_templates_label') },
    ...nonOverriddenBuiltInItems,
    { kind: vscode.QuickPickItemKind.Separator, label: nls.localize('apex_trigger_custom_templates_label') },
    ...customItems
  ];

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

  const sobject = yield* promptForSObject();
  const triggerevents = yield* promptForTriggerEvents();

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
      triggerevents: triggerevents.join(', '),
      sobject,
      template
    }
  });

  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('apex_generate_trigger_success'));
  yield* fsService.showTextDocument(triggerUri);

  return undefined;
});
