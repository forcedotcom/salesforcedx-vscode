/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as SfTemplates from '@salesforce/templates';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';

// eslint-disable-next-line no-restricted-imports -- memfs polyfill on web; @salesforce/templates expects fs path
import * as nodeFs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { Utils, type URI } from 'vscode-uri';
import { uriToPath } from '../vscode/paths';
import { ConnectionService } from './connectionService';
import { ProjectService } from './projectService';

/** Re-export for consumers that don't depend on @salesforce/templates */
export { TemplateType, type CreateOutput } from '@salesforce/templates';

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
                    ? SfTemplates.ProjectOptions
                    : T extends SfTemplates.TemplateType.VisualforceComponent
                      ? SfTemplates.VisualforceComponentOptions
                      : T extends SfTemplates.TemplateType.VisualforcePage
                        ? SfTemplates.VisualforcePageOptions
                        : T extends SfTemplates.TemplateType.StaticResource
                          ? SfTemplates.StaticResourceOptions
                          : T extends SfTemplates.TemplateType.WebApplication
                            ? SfTemplates.WebApplicationOptions
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
    return yield* new TemplatesRootPathNotAvailableError({ message: 'Extension context not available' });
  }
  return extensionUri;
});

/** Load template files from extension assets into the polyfilled fs (memfs on web).
 * Reads manifest.json (generated at build time) to get the file list, then reads each file
 * via vscode.workspace.fs (supported on HTTPS extension URIs) and writes to memfs. */
const ensureTemplatesInFs = (rootUri: URI, rootFsPath: string) =>
  Effect.gen(function* () {
    if (process.env.ESBUILD_PLATFORM !== 'web') return;
    const manifestContent = yield* Effect.tryPromise({
      try: () => vscode.workspace.fs.readFile(Utils.joinPath(rootUri, 'manifest.json')),
      catch: e =>
        new TemplatesManifestLoadError({
          message: `Failed to load templates manifest from extension assets. The extension bundle may be incomplete. (${e instanceof Error ? e.message : String(e)})`,
          cause: e
        })
    });
    const paths = yield* Schema.decodeUnknown(TemplateManifestSchema)(Buffer.from(manifestContent).toString()).pipe(
      Effect.mapError(
        error =>
          new TemplatesManifestLoadError({
            message: 'Failed to parse templates manifest from extension assets.',
            cause: error
          })
      )
    );
    const results = yield* Effect.promise(() =>
      Promise.allSettled(
        paths.map(async relativePath => {
          const dest = `${rootFsPath}/${relativePath}`;
          nodeFs.mkdirSync(dest.slice(0, dest.lastIndexOf('/')), { recursive: true });
          const content = await vscode.workspace.fs.readFile(Utils.joinPath(rootUri, relativePath));
          nodeFs.writeFileSync(dest, Buffer.from(content));
        })
      )
    );
    const failCount = results.filter(r => r.status === 'rejected').length;
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
    Effect.orElseFail(() => new MissingProjectSourceApiVersionError({ message: 'sourceApiVersion is not defined' }))
  );
});

const getApiVersionFromConnection = Effect.fn('TemplateService.getApiVersionFromConnection')(function* () {
  const connection = yield* (yield* ConnectionService).getConnection();
  return connection.version;
});

const resolveApiVersion = Effect.fn('TemplateService.resolveApiVersion')(function* () {
  return yield* getApiVersionFromProject().pipe(Effect.orElse(() => getApiVersionFromConnection()));
});

/**
 * Service that wraps @salesforce/templates TemplateService for creating templates.
 * Lives in services extension which has @salesforce/core and @salesforce/templates.
 */
export class TemplateService extends Effect.Service<TemplateService>()('TemplateService', {
  accessors: true,
  dependencies: [ProjectService.Default, ConnectionService.Default],
  effect: Effect.gen(function* () {
    const create = Effect.fn('TemplateService.create')(function* (params: CreateParams<SfTemplates.TemplateType>) {
      const extensionUri = yield* getExtensionUri();
      const templatesRootUri = Utils.joinPath(extensionUri, 'dist', 'templates');
      // fsPath on non-file URIs returns platform-specific path (e.g. backslashes on Windows);
      // memfs expects forward slashes. Use uri.path for http(s) extension URIs.
      const templatesRootPath = templatesRootUri.scheme === 'file' ? templatesRootUri.fsPath : templatesRootUri.path;
      yield* ensureTemplatesInFs(templatesRootUri, templatesRootPath);
      const templateService = SfTemplates.TemplateService.getInstance(params.cwd, {
        templatesRootPath,
        fs: nodeFs
      });
      const resolvedApiVersion = Option.fromNullable(params.options.apiversion ?? (yield* resolveApiVersion()));
      const optionsWithApiVersion = Option.match(resolvedApiVersion, {
        onNone: () => params.options,
        onSome: apiversion => ({ ...params.options, apiversion })
      });
      const templateOptions = params.outputdir
        ? {
            ...optionsWithApiVersion,
            outputdir: path.relative(params.cwd, uriToPath(params.outputdir))
          }
        : optionsWithApiVersion;
      return yield* Effect.tryPromise(() => templateService.create(params.templateType, templateOptions));
    });
    return { create };
  })
}) {}
