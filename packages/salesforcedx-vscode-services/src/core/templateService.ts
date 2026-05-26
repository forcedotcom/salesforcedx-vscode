/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrgConfigProperties } from '@salesforce/core';
import * as SfTemplates from '@salesforce/templates';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';

// eslint-disable-next-line no-restricted-imports -- memfs polyfill on web; @salesforce/templates expects fs path
import * as nodeFs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { Utils, type URI } from 'vscode-uri';
import { nls } from '../messages';
import { uriToPath } from '../vscode/paths';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { ProjectService } from './projectService';

/** Re-export for consumers that don't depend on @salesforce/templates */
export { TemplateType, type CreateOutput } from '@salesforce/templates';

/**
 * Project options where `ns` and `loginurl` may be omitted by callers; the
 * service fills defaults (no namespace, production login URL) before invoking
 * @salesforce/templates which requires both as strings
 */
type ProjectCreateOptions = Omit<SfTemplates.ProjectOptions, 'ns' | 'loginurl'> & {
  readonly ns?: string;
  readonly loginurl?: string;
};

/** Maps TemplateType to its options type for type-safe create params */
export type TemplateOptionsFor<T extends SfTemplates.TemplateType> =
  T extends SfTemplates.TemplateType.AnalyticsTemplate
    ? SfTemplates.AnalyticsTemplateOptions
    : T extends SfTemplates.TemplateType.ApexClass
      ? SfTemplates.ApexClassOptions
      : T extends SfTemplates.TemplateType.ApexTrigger
        ? SfTemplates.ApexTriggerOptions
        : T extends SfTemplates.TemplateType.LightningApp
          ? SfTemplates.LightningAppOptions
          : T extends SfTemplates.TemplateType.LightningComponent
            ? SfTemplates.LightningComponentOptions
            : T extends SfTemplates.TemplateType.LightningEvent
              ? SfTemplates.LightningEventOptions
              : T extends SfTemplates.TemplateType.LightningInterface
                ? SfTemplates.LightningInterfaceOptions
                : T extends SfTemplates.TemplateType.LightningTest
                  ? SfTemplates.LightningTestOptions
                  : T extends SfTemplates.TemplateType.Project
                    ? ProjectCreateOptions
                    : T extends SfTemplates.TemplateType.VisualforceComponent
                      ? SfTemplates.VisualforceComponentOptions
                      : T extends SfTemplates.TemplateType.VisualforcePage
                        ? SfTemplates.VisualforcePageOptions
                        : T extends SfTemplates.TemplateType.StaticResource
                          ? SfTemplates.StaticResourceOptions
                          : T extends SfTemplates.TemplateType.UIBundle
                            ? SfTemplates.UIBundleOptions
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

export class TemplatesManifestLoadError extends Schema.TaggedError<TemplatesManifestLoadError>()(
  'TemplatesManifestLoadError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown)
  }
) {}

class MissingProjectSourceApiVersionError extends Schema.TaggedError<MissingProjectSourceApiVersionError>()(
  'MissingProjectSourceApiVersionError',
  { message: Schema.String }
) {}

const TemplateManifestSchema = Schema.parseJson(Schema.Array(Schema.String));

const getExtensionUri = Effect.fn('getExtensionUri')(function* () {
  const ext = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-services');
  const extensionUri = ext?.extensionUri;
  if (!extensionUri) {
    return yield* new TemplatesRootPathNotAvailableError({
      message: nls.localize('template_service_extension_context_not_available')
    });
  }
  return extensionUri;
});

/** Load template files from extension assets into the polyfilled fs (memfs on web).
 * Reads manifest.json (generated at build time) to get the file list, then reads each file
 * via vscode.workspace.fs (supported on HTTPS extension URIs) and writes to memfs. */
const ensureTemplatesInFs = Effect.fn('TemplateService.ensureTemplatesInFs')(function* (
  rootUri: URI,
  rootFsPath: string
) {
  if (process.env.ESBUILD_PLATFORM !== 'web') return;
  const manifestContent = yield* Effect.tryPromise({
    try: () => vscode.workspace.fs.readFile(Utils.joinPath(rootUri, 'manifest.json')),
    catch: e =>
      new TemplatesManifestLoadError({
        message: nls.localize('template_service_manifest_load_failed', e instanceof Error ? e.message : String(e)),
        cause: e
      })
  });
  const paths = yield* Schema.decodeUnknown(TemplateManifestSchema)(Buffer.from(manifestContent).toString()).pipe(
    Effect.mapError(
      error =>
        new TemplatesManifestLoadError({
          message: nls.localize('template_service_manifest_parse_failed'),
          cause: error
        })
    )
  );
  const failCount = yield* Stream.fromIterable(paths).pipe(
    Stream.mapEffect(relativePath =>
      Effect.tryPromise({
        try: async () => {
          const dest = `${rootFsPath}/${relativePath}`;
          nodeFs.mkdirSync(dest.slice(0, dest.lastIndexOf('/')), { recursive: true });
          const content = await vscode.workspace.fs.readFile(Utils.joinPath(rootUri, relativePath));
          nodeFs.writeFileSync(dest, Buffer.from(content));
        },
        catch: e =>
          new TemplatesManifestLoadError({
            message: nls.localize(
              'template_service_file_copy_failed',
              relativePath,
              e instanceof Error ? e.message : String(e)
            ),
            cause: e
          })
      }).pipe(
        Effect.as(0),
        Effect.catchTag('TemplatesManifestLoadError', error => Effect.logWarning(error.message).pipe(Effect.as(1)))
      )
    ),
    Stream.runFold(0, (count, failed) => count + failed)
  );
  if (failCount > 0) {
    yield* Effect.logWarning(`${failCount}/${paths.length} template files failed to copy to memfs`);
  }
});

const getApiVersionFromProject = Effect.fn('TemplateService.getApiVersionFromProject')(function* () {
  const project = yield* ProjectService.getSfProject();
  const projectJson = yield* Effect.tryPromise(() => project.retrieveSfProjectJson());
  const sourceApiVersion = projectJson.get<string>('sourceApiVersion');
  return yield* Effect.fromNullable(sourceApiVersion).pipe(
    Effect.map(String),
    Effect.orElseFail(
      () =>
        new MissingProjectSourceApiVersionError({
          message: nls.localize('template_service_source_api_version_not_defined')
        })
    )
  );
});

const getApiVersionFromConnection = Effect.fn('TemplateService.getApiVersionFromConnection')(function* () {
  const connection = yield* (yield* ConnectionService).getConnection();
  return connection.version;
});

const getTemplatesRoot = Effect.fn('TemplateService.getTemplatesRoot')(function* () {
  const extensionUri = yield* getExtensionUri();
  const templatesRootUri = Utils.joinPath(extensionUri, 'dist', 'templates');
  // fsPath on non-file URIs returns platform-specific path (e.g. backslashes on Windows);
  // memfs expects forward slashes. Use uri.path for http(s) extension URIs.
  const templatesRootPath = templatesRootUri.scheme === 'file' ? templatesRootUri.fsPath : templatesRootUri.path;
  return { templatesRootUri, templatesRootPath } as const;
});

const resolveApiVersion = Effect.fn('TemplateService.resolveApiVersion')(function* () {
  return Option.getOrUndefined(
    yield* getApiVersionFromProject().pipe(
      Effect.orElse(() => getApiVersionFromConnection()),
      Effect.option
    )
  );
});

const resolveOptionsWithApiVersion = Effect.fn('TemplateService.resolveOptionsWithApiVersion')(function* (
  params: CreateParams<SfTemplates.TemplateType>
) {
  const apiversion = params.options.apiversion ?? (yield* resolveApiVersion());
  return apiversion ? { ...params.options, apiversion } : params.options;
});

/** @salesforce/templates requires ns/loginurl as strings; fill defaults so callers can omit them. */
const PROJECT_OPTION_DEFAULTS = {
  ns: '',
  loginurl: 'https://login.salesforce.com'
} as const;

const isProjectParams = (
  params: CreateParams<SfTemplates.TemplateType>
): params is CreateParams<SfTemplates.TemplateType.Project> => params.templateType === SfTemplates.TemplateType.Project;

const withProjectDefaults = (params: CreateParams<SfTemplates.TemplateType>): CreateParams<SfTemplates.TemplateType> =>
  isProjectParams(params)
    ? {
        ...params,
        options: {
          ...params.options,
          ns: params.options.ns ?? PROJECT_OPTION_DEFAULTS.ns,
          loginurl: params.options.loginurl ?? PROJECT_OPTION_DEFAULTS.loginurl
        }
      }
    : params;

/**
 * Service that wraps @salesforce/templates TemplateService for creating templates.
 * Lives in services extension which has @salesforce/core and @salesforce/templates.
 */
export class TemplateService extends Effect.Service<TemplateService>()('TemplateService', {
  accessors: true,
  dependencies: [ProjectService.Default, ConnectionService.Default, ConfigService.Default],
  effect: Effect.gen(function* () {
    const resolveCustomTemplatesPath = Effect.fn('TemplateService.resolveCustomTemplatesPath')(function* () {
      const configService = yield* ConfigService;
      const agg = yield* configService.getConfigAggregator();
      const value = agg.getPropertyValue<string>(OrgConfigProperties.ORG_CUSTOM_METADATA_TEMPLATES);
      return value ? String(value) : undefined;
    });

    const getTemplatesRootCached = yield* Effect.cached(getTemplatesRoot());
    const ensureTemplatesInFsOnce = yield* Effect.once(
      getTemplatesRootCached.pipe(
        Effect.flatMap(({ templatesRootUri, templatesRootPath }) =>
          ensureTemplatesInFs(templatesRootUri, templatesRootPath)
        )
      )
    );

    const create = Effect.fn('TemplateService.create')(function* (params: CreateParams<SfTemplates.TemplateType>) {
      const { templatesRootPath } = yield* getTemplatesRootCached;
      yield* ensureTemplatesInFsOnce;
      const templateService = SfTemplates.TemplateService.getInstance(params.cwd, {
        templatesRootPath,
        fs: nodeFs
      });
      const paramsWithDefaults = withProjectDefaults(params);
      const optionsWithApiVersion = yield* resolveOptionsWithApiVersion(paramsWithDefaults);
      const templateOptions = params.outputdir
        ? {
            ...optionsWithApiVersion,
            outputdir: path.relative(params.cwd, uriToPath(params.outputdir))
          }
        : optionsWithApiVersion;
      const customTemplatesPath = yield* resolveCustomTemplatesPath().pipe(Effect.orElseSucceed(() => undefined));
      return yield* Effect.tryPromise(() =>
        templateService.create(params.templateType, templateOptions, customTemplatesPath)
      );
    });
    return { create };
  })
}) {}
