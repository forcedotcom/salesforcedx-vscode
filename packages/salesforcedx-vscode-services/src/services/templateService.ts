/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { OrgConfigProperties } from '@salesforce/core';
import * as SfTemplates from '@salesforce/templates';
import {
  ConfigService,
  ConnectionService,
  ProjectService,
  TemplateService,
  TemplatesManifestLoadError,
  TemplatesRootPathNotAvailableError,
  type CreateParams
} from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { isError, isNullish } from 'effect/Predicate';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as Semaphore from 'effect/Semaphore';
import * as Stream from 'effect/Stream';
// eslint-disable-next-line no-restricted-imports -- The template SDK requires its Node/memfs fs interface, not workspace.fs.
import * as nodeFs from 'node:fs';
// The SDK requires a relative OS path; vscode-uri has no relative-path operation.
import { relative } from 'node:path';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';
import { TemplateMessages } from './templateMessages.js';
import { uriToPath } from './uriUtils.js';

class MissingProjectSourceApiVersionError extends Schema.TaggedError<MissingProjectSourceApiVersionError>()(
  'MissingProjectSourceApiVersionError',
  { message: Schema.String }
) {}
const TemplateManifestSchema = Schema.String.pipe(Schema.Array, Schema.fromJsonString);
const causeMessage = (cause: unknown) => (isError(cause) ? cause.message : String(cause));
const ProjectTemplateTypeSchema = Schema.Literal(SfTemplates.TemplateType.Project);
const isProjectParams = (params: CreateParams): params is CreateParams<SfTemplates.TemplateType.Project> =>
  Schema.is(ProjectTemplateTypeSchema)(params.templateType);
/** @salesforce/templates requires ns/loginurl as strings even when the caller omits them. */
const withProjectDefaults = (params: CreateParams): CreateParams =>
  isProjectParams(params)
    ? {
        ...params,
        options: {
          ...params.options,
          ns: params.options.ns ?? '',
          loginurl: params.options.loginurl ?? 'https://login.salesforce.com'
        }
      }
    : params;

export const TemplateServiceLayer = Layer.effect(
  TemplateService,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const projects = yield* ProjectService;
    const connections = yield* ConnectionService;
    const operations = yield* ServiceOperations;
    const messages = yield* TemplateMessages;
    const getTemplatesRoot = Effect.fn('TemplateService.getTemplatesRoot')(function* () {
      const extensionUri = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-services')?.extensionUri;
      if (!extensionUri)
        return yield* new TemplatesRootPathNotAvailableError({ message: messages.extensionUnavailable });
      const templatesRootUri = Utils.joinPath(extensionUri, 'dist', 'templates');
      // fsPath is OS-specific. HTTPS extension assets must use forward slashes for memfs.
      return { templatesRootUri, templatesRootPath: uriToPath(templatesRootUri) };
    });
    const root = yield* Effect.cached(getTemplatesRoot());
    const stagingDone = yield* Ref.make(false);
    const stagingLock = yield* Semaphore.make(1);
    const ensureTemplatesInFs = Effect.fn('TemplateService.ensureTemplatesInFs')(function* () {
      if (process.env.ESBUILD_PLATFORM !== 'web') return;
      const { templatesRootUri, templatesRootPath } = yield* root;
      const manifest = yield* Effect.tryPromise({
        try: () => vscode.workspace.fs.readFile(Utils.joinPath(templatesRootUri, 'manifest.json')),
        catch: cause =>
          new TemplatesManifestLoadError({ message: messages.manifestLoadFailed(causeMessage(cause)), cause })
      });
      const paths = yield* Schema.decodeUnknownEffect(TemplateManifestSchema)(Buffer.from(manifest).toString()).pipe(
        Effect.mapError(cause => new TemplatesManifestLoadError({ message: messages.manifestParseFailed, cause }))
      );
      const failed = yield* Stream.fromIterable(paths).pipe(
        Stream.mapEffect(
          relativePath =>
            Effect.tryPromise({
              try: async () => {
                const dest = `${templatesRootPath}/${relativePath}`;
                nodeFs.mkdirSync(dest.slice(0, dest.lastIndexOf('/')), { recursive: true });
                const content = await vscode.workspace.fs.readFile(Utils.joinPath(templatesRootUri, relativePath));
                nodeFs.writeFileSync(dest, Buffer.from(content));
              },
              catch: cause =>
                new TemplatesManifestLoadError({
                  message: messages.fileCopyFailed(relativePath, causeMessage(cause)),
                  cause
                })
            }).pipe(
              // Native reads/writes cannot abort. Retain the staging permit until every started copy settles.
              Effect.uninterruptible,
              Effect.as(0),
              Effect.catchTag('TemplatesManifestLoadError', error =>
                Effect.logWarning(error.message).pipe(Effect.as(1))
              )
            ),
          { concurrency: 20 }
        ),
        Stream.runFold(
          () => 0,
          (count, value) => count + value
        )
      );
      if (failed > 0) yield* Effect.logWarning(`${failed}/${paths.length} template files failed to copy to memfs`);
    });
    // Concurrent callers await staging. Failures are retryable, successes (including partial-copy warnings) are cached.
    const ensureTemplatesInFsOnce = stagingLock.withPermit(
      Ref.get(stagingDone).pipe(
        Effect.flatMap(done =>
          done ? Effect.void : ensureTemplatesInFs().pipe(Effect.andThen(Ref.set(stagingDone, true)))
        )
      )
    );
    const resolveCustomTemplatesPath = Effect.fn('TemplateService.resolveCustomTemplatesPath')(() =>
      config.getConfigAggregator().pipe(
        Effect.map(aggregator => {
          const value = aggregator.getPropertyValue<string>(OrgConfigProperties.ORG_CUSTOM_METADATA_TEMPLATES);
          return value ? Option.some(String(value)) : Option.none<string>();
        }),
        Effect.catchTags({
          FailedToCreateConfigAggregatorError: () => Effect.succeed(Option.none<string>()),
          NoWorkspaceOpenError: () => Effect.succeed(Option.none<string>())
        }),
        Effect.map(Option.getOrUndefined)
      )
    );
    const getApiVersionFromProject = Effect.fn('TemplateService.getApiVersionFromProject')(function* () {
      const project = yield* projects.getSfProject();
      const json = yield* Effect.tryPromise(() => project.retrieveSfProjectJson());
      const version = json.get<string | null>('sourceApiVersion');
      return isNullish(version)
        ? yield* new MissingProjectSourceApiVersionError({ message: messages.missingSourceApiVersion })
        : String(version);
    });
    const resolveApiVersion = Effect.fn('TemplateService.resolveApiVersion')(() =>
      getApiVersionFromProject().pipe(
        Effect.catchTags({
          NoWorkspaceOpenError: () => connections.getConnection().pipe(Effect.map(connection => connection.version)),
          FailedToResolveSfProjectError: () =>
            connections.getConnection().pipe(Effect.map(connection => connection.version)),
          UnknownError: () => connections.getConnection().pipe(Effect.map(connection => connection.version)),
          MissingProjectSourceApiVersionError: () =>
            connections.getConnection().pipe(Effect.map(connection => connection.version))
        }),
        Effect.option,
        Effect.map(Option.getOrUndefined)
      )
    );
    const readDirectoryOrEmpty = Effect.fn('TemplateService.readDirectoryOrEmpty')((uri: URI) =>
      Effect.tryPromise(() => vscode.workspace.fs.readDirectory(uri)).pipe(
        Effect.catchTag('UnknownError', error => {
          const cause = error.cause;
          return cause instanceof vscode.FileSystemError && (cause.code === 'FileNotFound' || cause.code === 'ENOENT')
            ? Effect.succeed<[string, vscode.FileType][]>([])
            : Effect.logWarning(`Failed to read custom templates from ${uri.fsPath}: ${causeMessage(cause)}`).pipe(
                Effect.as<[string, vscode.FileType][]>([])
              );
        })
      )
    );
    return TemplateService.of({
      getBuiltInTemplateNames: Effect.fn('TemplateService.getBuiltInTemplateNames')(function* (
        templateDir: string,
        filetype: RegExp
      ) {
        const { templatesRootPath } = yield* root;
        yield* ensureTemplatesInFsOnce;
        return yield* Effect.try(() =>
          SfTemplates.CreateUtil.getCommandTemplatesForFiletype(filetype, templateDir, nodeFs, templatesRootPath)
        );
      }, operations.run),
      getBuiltInTemplateSubdirNames: Effect.fn('TemplateService.getBuiltInTemplateSubdirNames')(function* (
        templateDir: string,
        subdir: string,
        filetype: RegExp
      ) {
        const { templatesRootPath } = yield* root;
        yield* ensureTemplatesInFsOnce;
        return yield* Effect.try(() =>
          SfTemplates.CreateUtil.getCommandTemplatesInSubdirs(
            templateDir,
            { filetype, subdir },
            nodeFs,
            templatesRootPath
          )
        );
      }, operations.run),
      getCustomTemplateNames: Effect.fn('TemplateService.getCustomTemplateNames')(function* (
        templateDir: string,
        ext: string
      ) {
        const customPath = yield* resolveCustomTemplatesPath();
        if (!customPath) return [];
        return (yield* readDirectoryOrEmpty(Utils.joinPath(URI.file(customPath), templateDir)))
          .filter(([name, type]) => type === vscode.FileType.File && name.endsWith(ext))
          .map(([name]) => name.slice(0, -ext.length));
      }, operations.run),
      getCustomTemplateSubdirNames: Effect.fn('TemplateService.getCustomTemplateSubdirNames')(function* (
        templateDir: string,
        subdir: string,
        filetype: RegExp
      ) {
        const customPath = yield* resolveCustomTemplatesPath();
        if (!customPath) return [];
        const uri = Utils.joinPath(URI.file(customPath), templateDir, subdir);
        const dirs = (yield* readDirectoryOrEmpty(uri))
          .filter(([, type]) => type === vscode.FileType.Directory)
          .map(([name]) => name);
        const matches = yield* Effect.forEach(dirs, name =>
          readDirectoryOrEmpty(Utils.joinPath(uri, name)).pipe(
            Effect.map(files => files.some(([file, type]) => type === vscode.FileType.File && filetype.test(file)))
          )
        );
        return dirs.filter((_, index) => matches[index]);
      }, operations.run),
      create: Effect.fn('TemplateService.create')(function* (params: CreateParams) {
        const { templatesRootPath } = yield* root;
        yield* ensureTemplatesInFsOnce;
        const defaults = withProjectDefaults(params);
        const apiversion = defaults.options.apiversion ?? (yield* resolveApiVersion());
        const options = apiversion ? { ...defaults.options, apiversion } : defaults.options;
        const templateOptions = params.outputdir
          ? { ...options, outputdir: relative(params.cwd, uriToPath(params.outputdir)) }
          : options;
        const customPath = yield* resolveCustomTemplatesPath();
        // Acquire the SDK singleton immediately before create: no async gap can change its cwd/context.
        return yield* Effect.tryPromise(() =>
          SfTemplates.TemplateService.getInstance(params.cwd, { templatesRootPath, fs: nodeFs }).create(
            params.templateType,
            templateOptions,
            customPath
          )
        ).pipe(Effect.uninterruptible);
      }, operations.run)
    });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
