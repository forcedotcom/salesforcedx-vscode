/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as SfTemplates from '@salesforce/templates';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { Utils, type URI } from 'vscode-uri';

/** Re-export for consumers that don't depend on @salesforce/templates */
export { TemplateType, type CreateOutput } from '@salesforce/templates';

/** Maps TemplateType to its options type for type-safe create params */
export type TemplateOptionsFor<T extends SfTemplates.TemplateType> =
  T extends SfTemplates.TemplateType.AnalyticsTemplate ? SfTemplates.AnalyticsTemplateOptions
  : T extends SfTemplates.TemplateType.ApexClass ? SfTemplates.ApexClassOptions
  : T extends SfTemplates.TemplateType.ApexTrigger ? SfTemplates.ApexTriggerOptions
  : T extends SfTemplates.TemplateType.LightningApp ? SfTemplates.LightningAppOptions
  : T extends SfTemplates.TemplateType.LightningComponent ? SfTemplates.LightningComponentOptions
  : T extends SfTemplates.TemplateType.LightningEvent ? SfTemplates.LightningEventOptions
  : T extends SfTemplates.TemplateType.LightningInterface ? SfTemplates.LightningInterfaceOptions
  : T extends SfTemplates.TemplateType.LightningTest ? SfTemplates.LightningTestOptions
  : T extends SfTemplates.TemplateType.Project ? SfTemplates.ProjectOptions
  : T extends SfTemplates.TemplateType.VisualforceComponent ? SfTemplates.VisualforceComponentOptions
  : T extends SfTemplates.TemplateType.VisualforcePage ? SfTemplates.VisualforcePageOptions
  : T extends SfTemplates.TemplateType.StaticResource ? SfTemplates.StaticResourceOptions
  : T extends SfTemplates.TemplateType.WebApplication ? SfTemplates.WebApplicationOptions
  : SfTemplates.TemplateOptions;

/** Params for create - templateType discriminates which options are required */
export type CreateParams<T extends SfTemplates.TemplateType = SfTemplates.TemplateType> = {
  readonly cwd: string;
  readonly templateType: T;
  readonly outputdir?: URI;
  readonly options: TemplateOptionsFor<T>;
};

export class TemplatesRootPathNotAvailableError extends Schema.TaggedError<TemplatesRootPathNotAvailableError>()(
  'TemplatesRootPathNotAvailableError',
  { message: Schema.String }
) {}

const getExtensionUri = Effect.fn('getExtensionUri')(function* () {
  const ext = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-services');
  const extensionUri = ext?.extensionUri;
  if (!extensionUri) {
    return yield* Effect.fail(new TemplatesRootPathNotAvailableError({ message: 'Extension context not available' }));
  }
  return extensionUri;
});

/**
 * Service that wraps @salesforce/templates TemplateService for creating templates.
 * Lives in services extension which has @salesforce/core and @salesforce/templates.
 */
export class TemplateService extends Effect.Service<TemplateService>()('TemplateService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const create = Effect.fn('TemplateService.create')(function* (
      params: CreateParams<SfTemplates.TemplateType>
    ) {
      const extensionUri = yield* getExtensionUri();
      const templatesRootUri = Utils.joinPath(extensionUri, 'dist', 'templates');
      const readTemplateFile = (absolutePath: string): Promise<string> => {
        const relSegments = absolutePath.slice(templatesRootUri.fsPath.length).split(path.sep).filter(Boolean);
        const fileUri = Utils.joinPath(templatesRootUri, ...relSegments);
        return Promise.resolve(vscode.workspace.fs.readFile(fileUri)).then(b => Buffer.from(b).toString('utf8'));
      };
      const templateService = SfTemplates.TemplateService.getInstance(params.cwd, {
        templatesRootPath: templatesRootUri.fsPath,
        readTemplateFile
      });
      const templateOptions = params.outputdir
        ? { ...params.options, outputdir: path.relative(params.cwd, params.outputdir.fsPath) }
        : params.options;
      return yield* Effect.tryPromise(() =>
        templateService.create(params.templateType, templateOptions)
      );
    });
    return { create };
  })
}) {}
