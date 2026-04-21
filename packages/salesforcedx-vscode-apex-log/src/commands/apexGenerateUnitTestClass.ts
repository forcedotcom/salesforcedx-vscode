/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, type SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { promptForApexTypeName } from './sfTemplateProjectHelpers';

type SfProject = Effect.Effect.Success<
  ReturnType<SalesforceVSCodeServicesApi['services']['ProjectService']['getSfProject']>
>;

const ApexTestTemplate = Schema.Literal('BasicUnitTest', 'ApexUnitTest');
type ApexTestTemplate = Schema.Schema.Type<typeof ApexTestTemplate>;

type ApexGenerateUnitTestClassParams = {
  readonly name?: string;
  readonly outputDir?: URI;
  readonly template?: ApexTestTemplate;
};

const promptForOutputDir = Effect.fn('promptForOutputDir')(function* (project: SfProject) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const defaultPkg = project.getDefaultPackage();
  const defaultUri = Utils.joinPath(workspaceInfo.uri, defaultPkg.path, 'main', 'default', 'classes');
  return yield* promptService.promptForOutputDir({
    defaultUri,
    folderName: 'classes',
    pickerPlaceHolder: nls.localize('output_dir_prompt')
  });
});

const promptForTemplate = Effect.fn('promptForTemplate')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* Effect.promise(() =>
    vscode.window.showQuickPick<{ label: ApexTestTemplate; description: string }>(
      [
        {
          label: 'ApexUnitTest',
          description: nls.localize('apex_unit_test_template_description')
        },
        {
          label: 'BasicUnitTest',
          description: nls.localize('basic_unit_test_template_description')
        }
      ],
      { placeHolder: nls.localize('template_type_prompt') }
    )
  ).pipe(
    Effect.flatMap(selected => promptService.considerUndefinedAsCancellation(selected)),
    Effect.map(selected => selected.label)
  );
});

/** Create Apex unit test class via TemplateService from services extension */
export const apexGenerateUnitTestClassCommand = Effect.fn('apexGenerateUnitTestClassCommand')(function* (
  params?: ApexGenerateUnitTestClassParams,
  outputDirectory?: URI
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const fsService = yield* api.services.FsService;
  const project = yield* api.services.ProjectService.getSfProject();

  const template = params?.template ?? (yield* promptForTemplate());
  const className =
    params?.name ??
    (yield* promptForApexTypeName({
      prompt: nls.localize('apex_test_class_name_prompt')
    }));
  const outputDirUri = params?.outputDir ?? outputDirectory ?? (yield* promptForOutputDir(project));

  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const uris = [`${className}.cls`, `${className}.cls-meta.xml`].map(uri => Utils.joinPath(outputDirUri, uri));
  yield* promptService.ensureMetadataOverwriteOrThrow({ uris });

  const result = yield* api.services.TemplateService.create({
    cwd: yield* fsService.uriToPath(workspaceInfo.uri),
    templateType: api.services.TemplateType.ApexClass,
    outputdir: outputDirUri,
    options: { template, classname: className }
  });

  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('apex_generate_class_success'));
  yield* api.services.FsService.showTextDocument(uris[0]);

  return result;
});
