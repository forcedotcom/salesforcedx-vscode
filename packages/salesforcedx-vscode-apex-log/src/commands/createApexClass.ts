/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { promptForApexTypeName } from './sfTemplateProjectHelpers';

const APEX_CLASS_TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  DefaultApexClass: nls.localize('apex_class_default_template_description'),
  ApexException: nls.localize('apex_class_exception_template_description'),
  InboundEmailService: nls.localize('apex_class_inbound_email_template_description'),
  ApexUnitTest: nls.localize('apex_class_unit_test_template_description'),
  BasicUnitTest: nls.localize('apex_class_basic_unit_test_template_description'),
  Batchable: nls.localize('apex_class_batchable_template_description'),
  Queueable: nls.localize('apex_class_queueable_template_description')
};

const UriSchema = Schema.declare<URI>(URI.isUri, { message: 'Expected URI' });

const CreateApexClassParams = Schema.Struct({
  name: Schema.optional(Schema.String),
  outputDir: Schema.optional(UriSchema),
  template: Schema.optional(Schema.String)
});
type CreateApexClassParams = Schema.Schema.Type<typeof CreateApexClassParams>;

const promptForTemplate = Effect.fn('promptForTemplate')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.v2.services.PromptService;

  const builtInNames = yield* api.v2.services.TemplateService.use(service =>
    service.getBuiltInTemplateNames('apexclass', /\.cls$/)
  );
  const sortedNames = ['DefaultApexClass', ...builtInNames.filter((n: string) => n !== 'DefaultApexClass')];
  const builtInItems = sortedNames.map((label: string) => ({
    label,
    description: APEX_CLASS_TEMPLATE_DESCRIPTIONS[label] ?? ''
  }));

  const customTemplateNames = yield* api.v2.services.TemplateService.use(service =>
    service.getCustomTemplateNames('apexclass', '.cls')
  );
  const customItems = customTemplateNames.map(label => ({ label, description: '' }));
  const customNameSet = new Set(customTemplateNames);
  const nonOverriddenBuiltInItems = builtInItems.filter(item => !customNameSet.has(item.label));

  const builtInSeparator: vscode.QuickPickItem = {
    kind: vscode.QuickPickItemKind.Separator,
    label: nls.localize('apex_class_builtin_templates_label')
  };
  const items: vscode.QuickPickItem[] =
    customItems.length > 0
      ? [
          builtInSeparator,
          ...nonOverriddenBuiltInItems,
          { kind: vscode.QuickPickItemKind.Separator, label: nls.localize('apex_class_custom_templates_label') },
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

/** arg: explorer context URI OR explicit command params. */
export const createApexClassCommand = Effect.fn('createApexClassCommand')(function* (
  arg?: URI | CreateApexClassParams
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.v2.services.PromptService;
  const project = yield* api.v2.services.ProjectService.use(service => service.getSfProject());
  const workspaceInfo = yield* api.v2.services.WorkspaceService.use(service => service.getWorkspaceInfoOrThrow());

  const params = Schema.is(CreateApexClassParams)(arg) ? arg : undefined;
  const template = params?.template ?? (yield* promptForTemplate());
  const className = params?.name ?? (yield* promptForApexTypeName({ prompt: nls.localize('apex_class_name_prompt') }));

  const defaultUri = Utils.joinPath(workspaceInfo.uri, project.getDefaultPackage().path, 'main', 'default', 'classes');

  const outputDirFromContext = URI.isUri(arg) ? arg : undefined;
  const outputDirUri =
    params?.outputDir ??
    outputDirFromContext ??
    (yield* promptService.promptForOutputDir({
      defaultUri,
      folderName: 'classes',
      pickerPlaceHolder: nls.localize('output_dir_prompt')
    }));

  const uris = [`${className}.cls`, `${className}.cls-meta.xml`].map(uri => Utils.joinPath(outputDirUri, uri));
  const fsService = yield* api.v2.services.FsService;
  const cwd = yield* fsService.uriToPath(workspaceInfo.uri);
  yield* promptService.ensureMetadataOverwriteOrThrow({ uris });

  yield* api.v2.services.TemplateService.use(service =>
    service.create({
      cwd,
      templateType: api.v2.services.TemplateType.ApexClass,
      outputdir: outputDirUri,
      options: { template, classname: className }
    })
  );

  const channelService = yield* api.v2.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('apex_generate_class_success'));
  yield* fsService.showTextDocument(uris[0]);

  return undefined;
});
