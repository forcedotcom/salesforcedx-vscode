/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SfProject } from '@salesforce/core/project';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { Utils, URI } from 'vscode-uri';
import { APEX_CLASS_NAME_MAX_LENGTH } from '../constants';
import { nls } from '../messages';

const ApexClassTemplate = Schema.Literal('DefaultApexClass', 'ApexException', 'InboundEmailService');
type ApexClassTemplate = Schema.Schema.Type<typeof ApexClassTemplate>;

const UriSchema = Schema.Unknown.pipe(Schema.filter((u): u is URI => URI.isUri(u), { message: () => 'Expected URI' }));

const CreateApexClassParams = Schema.Struct({
  name: Schema.optional(Schema.String),
  outputDir: Schema.optional(UriSchema),
  template: Schema.optional(ApexClassTemplate)
});
type CreateApexClassParams = Schema.Schema.Type<typeof CreateApexClassParams>;

const getApiVersionFromProject = Effect.fn('getApiVersion.fromProject')(function* (project: SfProject) {
  const projectJson = yield* Effect.tryPromise(() => project.retrieveSfProjectJson());
  return String(projectJson.get<string>('sourceApiVersion'));
});

const getApiVersionFromConnection = Effect.fn('getApiVersion.fromConnection')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const connectionService = yield* api.services.ConnectionService;
  const connection = yield* connectionService.getConnection();
  return connection.version;
});

/** Get API version using waterfall: sfdx-project.json -> connection -> fallback */
const getApiVersion = Effect.fn('getApiVersion')(function* (project: SfProject) {
  return yield* getApiVersionFromProject(project).pipe(
    Effect.orElse(() => getApiVersionFromConnection()),
    Effect.catchAll(() => Effect.succeed('65.0'))
  );
});

/** Prompt user to select output directory from available package directories */
const promptForOutputDir = Effect.fn('promptForOutputDir')(function* (project: SfProject) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  // Build Quick Pick items for each package directory
  const items = project.getPackageDirectories().map(pkg => ({
    label: `${pkg.path}/main/default/classes`,
    description: pkg.default ? '(default)' : undefined,
    uri: Utils.joinPath(workspaceInfo.uri, pkg.path, 'main', 'default', 'classes')
  }));

  // Show Quick Pick - VS Code will automatically highlight the first item by default
  return yield* Effect.promise(() =>
    vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('apex_class_output_dir_prompt') || 'Select output directory',
      matchOnDescription: true
    })
  ).pipe(Effect.flatMap(selected => promptService.ensureValueOrThrow(selected?.uri)));
});

/** Prompt user for class name */
const promptForClassName = Effect.fn('promptForClassName')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('apex_class_name_prompt'),
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) return nls.localize('apex_class_name_empty_error');
        if (value.toLowerCase() === 'default') return nls.localize('apex_class_name_cannot_be_default');
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) return nls.localize('apex_class_name_format_error');
        if (value.length > APEX_CLASS_NAME_MAX_LENGTH)
          return nls.localize('apex_class_name_max_length_error', APEX_CLASS_NAME_MAX_LENGTH);
        return undefined;
      }
    })
  ).pipe(
    Effect.map(n => n?.trim()),
    Effect.flatMap(raw => promptService.ensureValueOrThrow(raw))
  );
});

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
    Effect.flatMap(choice => promptService.ensureValueOrThrow(choice)),
    Effect.map(s => s?.label)
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

  const className = params?.name ?? (yield* promptForClassName());

  const outputDirUri = params?.outputDir ?? outputDirFromContext ?? (yield* promptForOutputDir(project));

  const apiVersion = yield* getApiVersion(project);
  const cwd = workspaceInfo.uri.fsPath;
  const uris = [`${className}.cls`, `${className}.cls-meta.xml`].map(uri => Utils.joinPath(outputDirUri, uri));
  const fsService = yield* api.services.FsService;
  const channelService = yield* api.services.ChannelService;
  yield* promptService.ensureMetadataOverwriteOrThrow({ uris });

  yield* api.services.TemplateService.create({
    cwd,
    templateType: api.services.TemplateType.ApexClass,
    outputdir: outputDirUri,
    options: { template, classname: className, apiversion: apiVersion }
  });

  yield* channelService.appendToChannel(nls.localize('apex_generate_class_success'));

  yield* fsService.showTextDocument(uris[0]);

  return undefined;
});
