/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type * as SfTemplates from '@salesforce/templates';
import type * as Cause from 'effect/Cause';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import type { URI } from 'vscode-uri';

/** The SDK requires namespace/login URL strings; the service fills defaults when omitted. */
export type ProjectCreateOptions = Omit<SfTemplates.ProjectOptions, 'ns' | 'loginurl'> & {
  readonly ns?: string;
  readonly loginurl?: string;
};
/** Custom template names are not restricted to the SDK's built-in literal union. */
export type ApexClassCreateOptions = {
  readonly template: string;
  readonly classname: string;
  readonly apiversion?: string;
  readonly outputdir?: string;
  readonly sobjecttype?: string;
};
export type ApexTriggerCreateOptions = {
  readonly template: string;
  readonly triggername: string;
  readonly sobject: string;
  readonly triggerevents: string;
  readonly apiversion?: string;
  readonly outputdir?: string;
};
export type LightningComponentCreateOptions = Omit<SfTemplates.LightningComponentOptions, 'template'> & {
  readonly template: string;
};
export type LightningAppCreateOptions = Omit<SfTemplates.LightningAppOptions, 'template'> & {
  readonly template: string;
};
export type LightningEventCreateOptions = Omit<SfTemplates.LightningEventOptions, 'template'> & {
  readonly template: string;
};
export type LightningInterfaceCreateOptions = Omit<SfTemplates.LightningInterfaceOptions, 'template'> & {
  readonly template: string;
};
export type VisualforceComponentCreateOptions = Omit<SfTemplates.VisualforceComponentOptions, 'template'> & {
  readonly template: string;
};
export type VisualforcePageCreateOptions = Omit<SfTemplates.VisualforcePageOptions, 'template'> & {
  readonly template: string;
};

/** TemplateType selects the SDK options, with custom template names retained. */
export type TemplateOptionsFor<T extends SfTemplates.TemplateType> =
  T extends SfTemplates.TemplateType.AnalyticsTemplate
    ? SfTemplates.AnalyticsTemplateOptions
    : T extends SfTemplates.TemplateType.ApexClass
      ? ApexClassCreateOptions
      : T extends SfTemplates.TemplateType.ApexTrigger
        ? ApexTriggerCreateOptions
        : T extends SfTemplates.TemplateType.LightningApp
          ? LightningAppCreateOptions
          : T extends SfTemplates.TemplateType.LightningComponent
            ? LightningComponentCreateOptions
            : T extends SfTemplates.TemplateType.LightningEvent
              ? LightningEventCreateOptions
              : T extends SfTemplates.TemplateType.LightningInterface
                ? LightningInterfaceCreateOptions
                : T extends SfTemplates.TemplateType.LightningTest
                  ? SfTemplates.LightningTestOptions
                  : T extends SfTemplates.TemplateType.Project
                    ? ProjectCreateOptions
                    : T extends SfTemplates.TemplateType.VisualforceComponent
                      ? VisualforceComponentCreateOptions
                      : T extends SfTemplates.TemplateType.VisualforcePage
                        ? VisualforcePageCreateOptions
                        : T extends SfTemplates.TemplateType.StaticResource
                          ? SfTemplates.StaticResourceOptions
                          : T extends SfTemplates.TemplateType.UIBundle
                            ? SfTemplates.UIBundleOptions
                            : SfTemplates.TemplateOptions;

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
export class TemplatesManifestLoadError extends Schema.TaggedError<TemplatesManifestLoadError>()(
  'TemplatesManifestLoadError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown)
  }
) {}
export type TemplateReadError = TemplatesRootPathNotAvailableError | TemplatesManifestLoadError | Cause.UnknownError;
export class TemplateService extends Context.Service<
  TemplateService,
  {
    readonly create: (params: CreateParams) => Effect.Effect<SfTemplates.CreateOutput, TemplateReadError>;
    readonly getBuiltInTemplateNames: (
      templateDir: string,
      filetype: RegExp
    ) => Effect.Effect<string[], TemplateReadError>;
    readonly getBuiltInTemplateSubdirNames: (
      templateDir: string,
      subdir: string,
      filetype: RegExp
    ) => Effect.Effect<string[], TemplateReadError>;
    readonly getCustomTemplateNames: (templateDir: string, ext: string) => Effect.Effect<string[]>;
    readonly getCustomTemplateSubdirNames: (
      templateDir: string,
      subdir: string,
      filetype: RegExp
    ) => Effect.Effect<string[]>;
  }
>()('@salesforce/vscode-services/v2/TemplateService') {}
