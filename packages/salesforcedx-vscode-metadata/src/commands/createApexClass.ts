/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { Utils, URI } from 'vscode-uri';
import { nls } from '../messages';
import { getApiVersion, promptForApexTypeName } from '../templates-shared/sfTemplateProjectHelpers';

const ApexClassTemplate = Schema.Literal('DefaultApexClass', 'ApexException', 'InboundEmailService');
type ApexClassTemplate = Schema.Schema.Type<typeof ApexClassTemplate>;

const UriSchema = Schema.Unknown.pipe(Schema.filter((u): u is URI => URI.isUri(u), { message: () => 'Expected URI' }));

const CreateApexClassParams = Schema.Struct({
  name: Schema.optional(Schema.String),
  outputDir: Schema.optional(UriSchema),
  template: Schema.optional(ApexClassTemplate)
});
type CreateApexClassParams = Schema.Schema.Type<typeof CreateApexClassParams>;

/** Prompt user to select template */
const promptForTemplate = Effect.fn('promptForTemplate')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* Effect.promise(() =>
    vscode.window.showQuickPick<{ label: ApexClassTemplate; description: string }>(
      [
        {
          label: 'DefaultApexClass',
          description: nls.localize('apex_class_default_template_description')
        },
        {
          label: 'ApexException',
          description: nls.localize('apex_class_exception_template_description')
        },
        {
          label: 'InboundEmailService',
          description: nls.localize('apex_class_inbound_email_template_description')
        }
      ],
      { placeHolder: nls.localize('apex_class_template_prompt') }
    )
  ).pipe(
    Effect.flatMap(choice => promptService.considerUndefinedAsCancellation(choice)),
    Effect.map(s => s.label)
  );
});

/** Create Apex class via TemplateService from services extension.
 * arg: when invoked from explorer context (right-click classes folder), VS Code passes the folder URI.
 * arg: when invoked programmatically, pass CreateApexClassParams to bypass prompts. */
export const createApexClassCommand = Effect.fn('createApexClassCommand')(function* (
  arg?: URI | CreateApexClassParams
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const project = yield* api.services.ProjectService.getSfProject();
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const outputDirFromContext = URI.isUri(arg) ? arg : undefined;
  const params = Schema.is(CreateApexClassParams)(arg) ? arg : undefined;

  const template = params?.template ?? (yield* promptForTemplate());
  const className = params?.name ?? (yield* promptForApexTypeName({ prompt: nls.localize('apex_class_name_prompt') }));

  const defaultPkg = project.getPackageDirectories().find(p => p.default) ?? project.getPackageDirectories()[0];
  const defaultUri = Utils.joinPath(workspaceInfo.uri, defaultPkg.path, 'main', 'default', 'classes');
  const outputDirUri =
    params?.outputDir ??
    outputDirFromContext ??
    (yield* promptService.promptForOutputDir({
      defaultUri,
      pickerPlaceHolder: nls.localize('apex_class_output_dir_prompt')
    }));

  const apiVersion = yield* getApiVersion(project);
  const uris = [`${className}.cls`, `${className}.cls-meta.xml`].map(uri => Utils.joinPath(outputDirUri, uri));
  const fsService = yield* api.services.FsService;
  const channelService = yield* api.services.ChannelService;

  yield* promptService.ensureMetadataOverwriteOrThrow({ uris });

  yield* api.services.TemplateService.create({
    cwd: yield* fsService.uriToPath(workspaceInfo.uri),
    templateType: api.services.TemplateType.ApexClass,
    outputdir: outputDirUri,
    options: { template, classname: className, apiversion: apiVersion }
  });

  yield* channelService.appendToChannel(nls.localize('apex_generate_class_success'));
  yield* fsService.showTextDocument(uris[0]);

  return undefined;
});
