/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { Utils, URI } from 'vscode-uri';
import { APEX_CLASS_NAME_MAX_LENGTH } from '../constants';
import { nls } from '../messages';
import {
  getApiVersion,
  promptForApexTypeName,
  promptForPackageMetadataSubdir
} from '../templates-shared/sfTemplateProjectHelpers';
import { checkAndPromptOverwriteUris } from '../templates-shared/templateOverwrite';

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
const promptForTemplate = (): Promise<ApexClassTemplate | undefined> =>
  Promise.resolve(
    vscode.window
      .showQuickPick(
        [
          {
            label: 'DefaultApexClass' satisfies ApexClassTemplate,
            description: nls.localize('apex_class_default_template_description')
          },
          {
            label: 'ApexException' satisfies ApexClassTemplate,
            description: nls.localize('apex_class_exception_template_description')
          },
          {
            label: 'InboundEmailService' satisfies ApexClassTemplate,
            description: nls.localize('apex_class_inbound_email_template_description')
          }
        ],
        { placeHolder: nls.localize('apex_class_template_prompt') }
      )
      .then(sel => (sel?.label && Schema.is(ApexClassTemplate)(sel.label) ? sel.label : undefined))
  );

/** Create Apex class via TemplateService from services extension.
 * arg: when invoked from explorer context (right-click classes folder), VS Code passes the folder URI.
 * arg: when invoked programmatically, pass CreateApexClassParams to bypass prompts. */
export const createApexClassCommand = Effect.fn('createApexClassCommand')(function* (
  arg?: URI | CreateApexClassParams
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const project = yield* api.services.ProjectService.getSfProject();
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const outputDirFromContext = URI.isUri(arg) ? arg : undefined;
  const params = Schema.is(CreateApexClassParams)(arg) ? arg : undefined;

  const template = params?.template ?? (yield* Effect.promise(promptForTemplate));
  if (!template) return undefined;

  const className =
    params?.name ??
    Option.getOrUndefined(
      yield* promptForApexTypeName({
        prompt: nls.localize('apex_class_name_prompt'),
        placeHolder: nls.localize('apex_class_name_placeholder'),
        forbidLowercaseDefault: true,
        messages: {
          empty: nls.localize('apex_class_name_empty_error'),
          invalidFormat: nls.localize('apex_class_name_format_error'),
          maxLength: nls.localize('apex_class_name_max_length_error', APEX_CLASS_NAME_MAX_LENGTH),
          reservedDefault: nls.localize('apex_class_name_cannot_be_default')
        }
      })
    );
  if (!className) return undefined;

  const outputDirUri =
    params?.outputDir ??
    outputDirFromContext ??
    (yield* promptForPackageMetadataSubdir(
      project,
      'classes',
      nls.localize('apex_class_output_dir_prompt') || 'Select output directory'
    ));
  if (!outputDirUri) return undefined;

  const clsUri = Utils.joinPath(outputDirUri, `${className}.cls`);
  const clsMetaUri = Utils.joinPath(outputDirUri, `${className}.cls-meta.xml`);
  const overwriteOk = yield* checkAndPromptOverwriteUris([clsUri, clsMetaUri], nls.localize('apex_class_already_exists')).pipe(
    Effect.catchTag('UserCancelledOverwriteError', () => Effect.succeed(false))
  );
  if (!overwriteOk) return undefined;

  const apiVersion = yield* getApiVersion(project);
  const fsService = yield* api.services.FsService;
  const cwd = yield* fsService.uriToPath(workspaceInfo.uri);

  yield* api.services.TemplateService.create({
    cwd,
    templateType: api.services.TemplateType.ApexClass,
    outputdir: outputDirUri,
    options: { template, classname: className, apiversion: apiVersion }
  });

  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('apex_generate_class_success'));

  yield* fsService.showTextDocument(clsUri);

  return undefined;
});
