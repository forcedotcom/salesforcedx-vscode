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
  const connectionService = yield* (yield* (yield* ExtensionProviderService).getServicesApi).services.ConnectionService;
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
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  // Build Quick Pick items for each package directory
  const items = project.getPackageDirectories().map(pkg => ({
    label: `${pkg.path}/main/default/classes`,
    description: pkg.default ? '(default)' : undefined,
    uri: Utils.joinPath(workspaceInfo.uri, pkg.path, 'main', 'default', 'classes')
  }));

  // Show Quick Pick - VS Code will automatically highlight the first item by default
  const selected = yield* Effect.promise(() =>
    vscode.window.showQuickPick(items, {
      placeHolder: nls.localize('apex_class_output_dir_prompt') || 'Select output directory',
      matchOnDescription: true
    })
  );

  return selected?.uri;
});

/** Prompt user for class name */
const promptForClassName = (): Promise<string | undefined> =>
  Promise.resolve(
    vscode.window
      .showInputBox({
        prompt: nls.localize('apex_class_name_prompt'),
        placeHolder: nls.localize('apex_class_name_placeholder'),
        validateInput: (value: string) => {
          if (!value || value.trim().length === 0) return nls.localize('apex_class_name_empty_error');
          if (value.toLowerCase() === 'default') return nls.localize('apex_class_name_cannot_be_default');
          if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value))
            return nls.localize('apex_class_name_format_error');
          if (value.length > APEX_CLASS_NAME_MAX_LENGTH)
            return nls.localize('apex_class_name_max_length_error', APEX_CLASS_NAME_MAX_LENGTH);
          return undefined;
        }
      })
      .then(n => n?.trim())
  );

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

  const className = params?.name ?? (yield* Effect.promise(promptForClassName));
  if (!className) return undefined;

  const outputDirUri = params?.outputDir ?? outputDirFromContext ?? (yield* promptForOutputDir(project));
  if (!outputDirUri) return undefined;

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

  const clsUri = Utils.joinPath(outputDirUri, `${className}.cls`);
  yield* fsService.showTextDocument(clsUri);

  return undefined;
});
