/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, type SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { Utils, URI } from 'vscode-uri';
import { APEX_CLASS_NAME_MAX_LENGTH } from '../constants';
import { nls } from '../messages';

type SfProject = Effect.Effect.Success<
  ReturnType<SalesforceVSCodeServicesApi['services']['ProjectService']['getSfProject']>
>;

type ApexGenerateUnitTestClassParams = {
  readonly name?: string;
  readonly outputDir?: URI;
  readonly template?: 'BasicUnitTest' | 'ApexUnitTest';
};

const fromProject = Effect.fn('getApiVersion.fromProject')(function* (project: SfProject) {
  const projectJson = yield* Effect.tryPromise(() => project.retrieveSfProjectJson());
  return String(projectJson.get<string>('sourceApiVersion'));
});

const fromConnection = Effect.fn('getApiVersion.fromConnection')(function* () {
  const connectionService = yield* (yield* (yield* ExtensionProviderService).getServicesApi).services.ConnectionService;
  const connection = yield* connectionService.getConnection();
  return connection.version;
});

const getApiVersion = Effect.fn('getApiVersion')(function* (project: SfProject) {
  return yield* fromProject(project).pipe(
    Effect.orElse(() => fromConnection()),
    Effect.catchAll(err =>
      Effect.log('Could not determine API version, using default', { error: err }).pipe(Effect.as('65.0'))
    )
  );
});

const getDefaultOutputDir = Effect.fn('getDefaultOutputDir')(function* (project: SfProject) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const defaultPkg = project.getDefaultPackage();
  return Utils.joinPath(workspaceInfo.uri, defaultPkg.path, 'main', 'default', 'classes');
});

const promptForClassName = (): Promise<string | undefined> =>
  Promise.resolve(
    vscode.window
      .showInputBox({
        prompt: nls.localize('apex_test_class_name_prompt'),
        placeHolder: nls.localize('apex_test_class_name_placeholder'),
        validateInput: (value: string) => {
          if (!value || value.trim().length === 0) return nls.localize('apex_test_class_name_empty_error');
          if (value.toLowerCase() === 'default') return nls.localize('apex_test_class_name_cannot_be_default');
          if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value))
            return nls.localize('apex_test_class_name_format_error');
          if (value.length > APEX_CLASS_NAME_MAX_LENGTH)
            return nls.localize('apex_test_class_name_max_length_error', APEX_CLASS_NAME_MAX_LENGTH);
          return undefined;
        }
      })
      .then(n => n?.trim())
  );

const promptForTemplate = (): Promise<'BasicUnitTest' | 'ApexUnitTest' | undefined> =>
  Promise.resolve(
    vscode.window
      .showQuickPick(
        [
          { label: 'ApexUnitTest', description: nls.localize('apex_unit_test_template_description') },
          { label: 'BasicUnitTest', description: nls.localize('basic_unit_test_template_description') }
        ],
        { placeHolder: nls.localize('apex_test_template_prompt') }
      )
      .then(sel => (sel?.label === 'ApexUnitTest' || sel?.label === 'BasicUnitTest' ? sel.label : undefined))
  );

/** Create Apex unit test class via TemplateService from services extension */
export const apexGenerateUnitTestClassCommand = Effect.fn('apexGenerateUnitTestClassCommand')(function* (
  params?: ApexGenerateUnitTestClassParams,
  outputDirectory?: URI
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const project = yield* api.services.ProjectService.getSfProject();
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const className = params?.name ?? (yield* Effect.promise(promptForClassName));
  if (!className) return undefined;

  const outputDirUri = params?.outputDir ?? outputDirectory ?? (yield* getDefaultOutputDir(project));
  if (!outputDirUri) return undefined;

  const template = params?.template ?? (yield* Effect.promise(promptForTemplate));
  if (!template) return undefined;

  const apiVersion = yield* getApiVersion(project);
  const cwd = workspaceInfo.uri.fsPath;

  const result = yield* api.services.TemplateService.create({
    cwd,
    templateType: api.services.TemplateType.ApexClass,
    outputdir: outputDirUri,
    options: { template, classname: className, apiversion: apiVersion }
  });

  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(nls.localize('apex_generate_class_success'));

  const clsUri = Utils.joinPath(outputDirUri, `${className}.cls`);
  const fsService = yield* api.services.FsService;
  yield* fsService.showTextDocument(clsUri);

  return result;
});
