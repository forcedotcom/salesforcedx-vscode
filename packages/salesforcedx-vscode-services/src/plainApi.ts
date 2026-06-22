/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type {
  ServicesContract,
  ServicesContractExtensions,
  ServicesEvents,
  ServicesSyncMethods,
  PromisifiedContract
} from './contract';
import type { DefaultOrgInfoSchema } from './core/schemas/defaultOrgInfo';
import type { TraceFlagItem, TraceFlagLogType } from './core/schemas/traceFlagSchemas';

type DefaultOrgInfo = Schema.Schema.Type<typeof DefaultOrgInfoSchema>;
import type { ComponentSet, MetadataMember } from '@salesforce/source-deploy-retrieve';
import type { TemplateType } from '@salesforce/templates';
import type * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import type * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type * as vscode from 'vscode';
import { EventEmitter } from 'vscode';
import type { URI } from 'vscode-uri';
import { AliasService } from './core/alias';
import { ComponentSetService, type NonEmptyComponentSet } from './core/componentSetService';
import { ConfigService } from './core/configService';
import { ConnectionService } from './core/connectionService';
import { getDefaultOrgRef } from './core/defaultOrgRef';
import { MetadataDeployService } from './core/metadataDeployService';
import { MetadataDescribeService } from './core/metadataDescribeService';
import { MetadataRetrieveService } from './core/metadataRetrieveService';
import { ProjectService } from './core/projectService';
import { SourceTrackingService, type SourceTrackingOptions } from './core/sourceTrackingService';
import { TemplateService, type TemplateOptionsFor } from './core/templateService';
import { TraceFlagService } from './core/traceFlagService';
import { TerminalService } from './terminal/terminalService';
import { ChannelService } from './vscode/channelService';
import { EditorService } from './vscode/editorService';
import { FsService } from './vscode/fsService';
import { SettingsService } from './vscode/settingsService';
import { WorkspaceService } from './vscode/workspaceService';

export type { DefaultOrgInfo };
export type { WorkspaceInfo } from './vscode/workspaceService';

type CreateParams<T extends TemplateType = TemplateType> = {
  cwd: string;
  templateType: T;
  outputdir?: URI;
  options: TemplateOptionsFor<T>;
};

/**
 * PlainServicesApi provides Promise-based wrappers for the Effect services.
 *
 * Composed of:
 * 1. PromisifiedContract<ServicesContract> - Core methods (~30 methods)
 * 2. PromisifiedContract<ServicesContractExtensions> - Extended methods with specialized signatures
 * 3. Event handlers from ServicesEvents
 * 4. Synchronous methods from ServicesSyncMethods
 *
 * All parts are enforced by the contract interfaces in contract.ts
 */
export type PlainServicesApi = PromisifiedContract<ServicesContract> &
  PromisifiedContract<ServicesContractExtensions> &
  ServicesSyncMethods & {
    // Event handlers (vscode.Event wrapper around contract event types)
    readonly onDidChangeTargetOrg: vscode.Event<ServicesEvents['onDidChangeTargetOrg']>;
    readonly onDidChangeActiveEditor: vscode.Event<ServicesEvents['onDidChangeActiveEditor']>;
    readonly onDidChangeTraceFlags: vscode.Event<ServicesEvents['onDidChangeTraceFlags']>;
  };

const toError = (failure: unknown): Error => {
  if (failure instanceof Error) return failure;
  if (typeof failure === 'object' && failure !== null && '_tag' in failure) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const { _tag, message } = failure as { _tag: string; message?: string };
    return new Error(message ? `${_tag}: ${message}` : _tag);
  }
  return new Error(String(failure));
};

// Using `any` here because a specific union type causes the generic `run` function's
// Effect.provide to fail type checking - it can't unify the provided context with the
// effect's requirements. The `any` is contained within this module and the public API
// is fully typed, so this is a safe compromise.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServicesContext = Context.Context<any>;

const run = <A, E, R>(builtContext: ServicesContext, effect: Effect.Effect<A, E, R>): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(Layer.succeedContext(builtContext)),
      Effect.catchAll(e => Effect.fail(toError(e)))
    )
  );

export const createPlainServicesApi = (
  builtContext: ServicesContext,
  extensionScope: Scope.CloseableScope
): PlainServicesApi => {
  const orgChangeEmitter = new EventEmitter<DefaultOrgInfo>();
  const editorChangeEmitter = new EventEmitter<vscode.TextEditor | undefined>();
  const traceFlagChangeEmitter = new EventEmitter<TraceFlagItem[]>();

  // Dispose emitters when the extension scope closes
  void Effect.runPromise(
    Scope.addFinalizer(
      extensionScope,
      Effect.sync(() => {
        orgChangeEmitter.dispose();
        editorChangeEmitter.dispose();
        traceFlagChangeEmitter.dispose();
      })
    )
  );

  void Effect.runPromise(
    Effect.forkIn(
      Effect.gen(function* () {
        const ref = yield* getDefaultOrgRef();
        yield* ref.changes.pipe(
          Stream.drop(1),
          Stream.runForEach(info => Effect.sync(() => orgChangeEmitter.fire(info)))
        );
      }),
      extensionScope
    )
  );

  void Effect.runPromise(
    Effect.forkIn(
      Effect.gen(function* () {
        const editorService = yield* EditorService;
        yield* Stream.fromPubSub(editorService.pubsub).pipe(
          Stream.runForEach(editor => Effect.sync(() => editorChangeEmitter.fire(editor)))
        );
      }).pipe(Effect.provide(Layer.succeedContext(builtContext))),
      extensionScope
    )
  );

  void Effect.runPromise(
    Effect.forkIn(
      Effect.gen(function* () {
        const traceFlagService = yield* TraceFlagService;
        yield* Stream.fromPubSub(traceFlagService.traceFlagsChanged).pipe(
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          Stream.runForEach(flags => Effect.sync(() => traceFlagChangeEmitter.fire(flags as TraceFlagItem[])))
        );
      }).pipe(Effect.provide(Layer.succeedContext(builtContext))),
      extensionScope
    )
  );

  return {
    getConnection: () => run(builtContext, ConnectionService.getConnection()),
    getTargetOrgInfo: () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const ref = yield* getDefaultOrgRef();
          return yield* SubscriptionRef.get(ref);
        })
      ),
    invalidateCachedConnections: () => run(builtContext, ConnectionService.invalidateCachedConnections()),
    withDefaultOrg: <R>(use: (org: import('./owned/servicesOrg').ServicesOrg) => R | Promise<R>) =>
      run(
        builtContext,
        Effect.gen(function* () {
          const svc = yield* ConnectionService;
          return yield* svc.withDefaultOrg(use);
        })
      ),
    getConnectionData: () =>
      run(
        builtContext,
        Effect.gen(function* () {
          const svc = yield* ConnectionService;
          return yield* svc.getConnectionData();
        })
      ),
    onDidChangeTargetOrg: orgChangeEmitter.event,

    getWorkspaceInfo: () => run(builtContext, WorkspaceService.getWorkspaceInfo()),

    isSalesforceProject: () => run(builtContext, ProjectService.isSalesforceProject()),
    getSfProject: () => run(builtContext, ProjectService.getSfProject()),
    getProjectInfo: () => run(builtContext, ProjectService.getProjectInfo()),
    isInPackageDirectories: (uri: URI) => run(builtContext, ProjectService.isInPackageDirectories(uri)),

    getSettingsValue: <T>(section: string, key: string, defaultValue?: T) =>
      run(
        builtContext,
        Effect.gen(function* () {
          const svc = yield* SettingsService;
          return yield* svc.getValue<T>(section, key, defaultValue);
        })
      ),
    setSettingsValue: (section: string, key: string, value: unknown) =>
      run(
        builtContext,
        Effect.gen(function* () {
          const svc = yield* SettingsService;
          yield* svc.setValue(section, key, value);
        })
      ),
    getApiVersion: () => run(builtContext, SettingsService.getApiVersion()),

    getTargetDevHub: () => run(builtContext, ConfigService.getTargetDevHub()),
    unsetTargetOrg: () => run(builtContext, ConfigService.unsetTargetOrg()),
    unsetTargetDevHub: () => run(builtContext, ConfigService.unsetTargetDevHub()),

    getAllAliases: () => run(builtContext, AliasService.getAllAliases()),
    getUsernameFromAlias: (alias: string) =>
      run(builtContext, AliasService.getUsernameFromAlias(alias).pipe(Effect.map(Option.getOrUndefined))),

    readFile: (filePath: string | URI) => run(builtContext, FsService.readFile(filePath)),
    writeFile: (filePath: string | URI, content: string) => run(builtContext, FsService.writeFile(filePath, content)),
    fileOrFolderExists: (filePath: string | URI) => run(builtContext, FsService.fileOrFolderExists(filePath)),
    findFiles: (include: vscode.GlobPattern, exclude?: vscode.GlobPattern | null, maxResults?: number) =>
      run(builtContext, FsService.findFiles(include, exclude, maxResults)),
    isDirectory: (path: string | URI) => run(builtContext, FsService.isDirectory(path)),
    isFile: (path: string | URI) => run(builtContext, FsService.isFile(path)),
    createDirectory: (dirPath: string | URI) => run(builtContext, FsService.createDirectory(dirPath)),
    deleteFile: (filePath: string) => run(builtContext, FsService.deleteFile(filePath)),
    readDirectory: (dirPath: string | URI) => run(builtContext, FsService.readDirectory(dirPath)),

    getActiveEditorUri: () => run(builtContext, EditorService.getActiveEditorUri()),
    getActiveEditorText: (selection = false) => run(builtContext, EditorService.getActiveEditorText(selection)),
    onDidChangeActiveEditor: editorChangeEmitter.event,

    appendToChannel: (message: string) => {
      void run(
        builtContext,
        Effect.gen(function* () {
          const svc = yield* ChannelService;
          yield* svc.appendToChannel(message);
        })
      );
    },
    clearChannel: () => {
      void run(
        builtContext,
        Effect.gen(function* () {
          const svc = yield* ChannelService;
          yield* svc.clearChannel;
        })
      );
    },

    describe: () => run(builtContext, MetadataDescribeService.describe()),
    listMetadata: (type: string, folder?: string) =>
      run(builtContext, MetadataDescribeService.listMetadata(type, folder)),

    deploy: (components: ComponentSet) => run(builtContext, MetadataDeployService.deploy(components)),
    deployFromSource: (spec: import('./owned/deploy').SourceSpec) =>
      run(builtContext, MetadataDeployService.deployFromSource(spec)),

    retrieve: (members: MetadataMember[], options?: SourceTrackingOptions) =>
      run(builtContext, MetadataRetrieveService.retrieve(members, options)),
    retrieveComponentSet: (components: ComponentSet, options?: SourceTrackingOptions) =>
      run(builtContext, MetadataRetrieveService.retrieveComponentSet(components, options)),
    retrieveToSource: (spec: import('./owned/deploy').SourceSpec, opts?: import('./owned/deploy').RetrieveOptions) =>
      run(builtContext, MetadataRetrieveService.retrieveToSource(spec, opts)),
    retrieveComponentSetToDirectory: (components: NonEmptyComponentSet, outputPath: URI) =>
      run(builtContext, MetadataRetrieveService.retrieveComponentSetToDirectory(components, outputPath)),

    hasTracking: () => run(builtContext, SourceTrackingService.hasTracking()),
    getLocalChangesAsComponentSet: () => run(builtContext, SourceTrackingService.getLocalChangesAsComponentSet()),
    getRemoteNonDeletesAsComponentSet: (options: { applyIgnore: boolean }) =>
      run(builtContext, SourceTrackingService.getRemoteNonDeletesAsComponentSet(options)),
    getConflicts: () => run(builtContext, SourceTrackingService.getConflicts()),
    checkConflicts: () => run(builtContext, SourceTrackingService.checkConflicts()),

    createFromTemplate: <T extends TemplateType>(params: CreateParams<T>) =>
      run(builtContext, TemplateService.create(params)),

    getTraceFlags: () => run(builtContext, TraceFlagService.getTraceFlags()),
    ensureTraceFlag: (userId: string, duration?: number, logType?: TraceFlagLogType, existingDebugLevelId?: string) =>
      run(builtContext, TraceFlagService.ensureTraceFlag(userId, duration, logType, existingDebugLevelId)),
    onDidChangeTraceFlags: traceFlagChangeEmitter.event,

    simpleExec: (command: string, parse?: (stdout: string) => string, timeoutMs?: number) =>
      run(
        builtContext,
        Effect.gen(function* () {
          const svc = yield* TerminalService;
          const timeout = timeoutMs ? { timeout: timeoutMs } : {};
          return yield* svc.simpleExec({
            command,
            parse: parse ?? (s => s),
            ...timeout
          });
        })
      ),

    getComponentSetFromUris: (uris: readonly URI[]) =>
      run(builtContext, ComponentSetService.getComponentSetFromUris(uris)),
    getComponentSetFromManifest: (manifestUri: URI) =>
      run(builtContext, ComponentSetService.getComponentSetFromManifest(manifestUri)),
    getComponentSetFromProjectDirectories: () =>
      run(builtContext, ComponentSetService.getComponentSetFromProjectDirectories()),
    describeProjectComponents: spec => run(builtContext, ComponentSetService.describeProjectComponents(spec))
  };
};
