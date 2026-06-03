/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DefaultOrgInfo } from './core/schemas/defaultOrgInfoPlain';
import type { FilePropertiesPlain } from './core/schemas/fileProperties';
import type { TraceFlagItem, TraceFlagLogType } from './core/schemas/traceFlagSchemas';
import type { Connection, SfProject } from '@salesforce/core';
import type { ComponentSet, DeployResult, MetadataMember, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import type { ChangeResult } from '@salesforce/source-tracking';
import type { CreateOutput, TemplateType } from '@salesforce/templates';
import type * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { DescribeMetadataObject } from 'jsforce/lib/api/metadata/schema';
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
import { WorkspaceService, type WorkspaceInfo } from './vscode/workspaceService';

export type { DefaultOrgInfo } from './core/schemas/defaultOrgInfoPlain';
export type { WorkspaceInfo } from './vscode/workspaceService';

type CreateParams<T extends TemplateType = TemplateType> = {
  cwd: string;
  templateType: T;
  outputdir?: URI;
  options: TemplateOptionsFor<T>;
};

export type PlainServicesApi = {
  readonly getConnection: () => Promise<Connection>;
  readonly getTargetOrgInfo: () => Promise<DefaultOrgInfo>;
  readonly invalidateCachedConnections: () => Promise<void>;
  readonly onDidChangeTargetOrg: vscode.Event<DefaultOrgInfo>;

  readonly getWorkspaceInfo: () => Promise<WorkspaceInfo>;

  readonly isSalesforceProject: () => Promise<boolean>;
  readonly getSfProject: () => Promise<SfProject>;
  readonly isInPackageDirectories: (uri: URI) => Promise<boolean>;

  readonly getSettingsValue: <T>(section: string, key: string, defaultValue?: T) => Promise<T | undefined>;
  readonly setSettingsValue: (section: string, key: string, value: unknown) => Promise<void>;
  readonly getApiVersion: () => Promise<string>;

  readonly getTargetDevHub: () => Promise<string | undefined>;
  readonly unsetTargetOrg: () => Promise<void>;
  readonly unsetTargetDevHub: () => Promise<void>;

  readonly getAllAliases: () => Promise<Record<string, string>>;
  readonly getUsernameFromAlias: (alias: string) => Promise<string | undefined>;

  readonly readFile: (filePath: string | URI) => Promise<string>;
  readonly writeFile: (filePath: string | URI, content: string) => Promise<void>;
  readonly fileOrFolderExists: (filePath: string | URI) => Promise<boolean>;
  readonly findFiles: (
    include: vscode.GlobPattern,
    exclude?: vscode.GlobPattern | null,
    maxResults?: number
  ) => Promise<URI[]>;
  readonly isDirectory: (path: string | URI) => Promise<boolean>;
  readonly isFile: (path: string | URI) => Promise<boolean>;
  readonly createDirectory: (dirPath: string | URI) => Promise<void>;
  readonly deleteFile: (filePath: string) => Promise<void>;
  readonly readDirectory: (dirPath: string | URI) => Promise<URI[]>;

  readonly getActiveEditorUri: () => Promise<URI>;
  readonly getActiveEditorText: (selection?: boolean) => Promise<string>;
  readonly onDidChangeActiveEditor: vscode.Event<vscode.TextEditor | undefined>;

  readonly appendToChannel: (message: string) => void;
  readonly clearChannel: () => void;

  readonly describe: () => Promise<DescribeMetadataObject[]>;
  readonly listMetadata: (type: string, folder?: string) => Promise<readonly FilePropertiesPlain[]>;

  readonly deploy: (components: ComponentSet) => Promise<DeployResult>;

  readonly retrieve: (members: MetadataMember[], options?: SourceTrackingOptions) => Promise<RetrieveResult>;
  readonly retrieveComponentSet: (components: ComponentSet, options?: SourceTrackingOptions) => Promise<RetrieveResult>;
  readonly retrieveComponentSetToDirectory: (
    components: NonEmptyComponentSet,
    outputPath: URI
  ) => Promise<RetrieveResult>;

  readonly hasTracking: () => Promise<boolean>;
  readonly getLocalChangesAsComponentSet: () => Promise<ComponentSet[]>;
  readonly getRemoteNonDeletesAsComponentSet: (options: { applyIgnore: boolean }) => Promise<ComponentSet>;
  readonly getConflicts: () => Promise<ChangeResult[]>;
  readonly checkConflicts: () => Promise<void>;

  readonly createFromTemplate: <T extends TemplateType>(params: CreateParams<T>) => Promise<CreateOutput>;

  readonly getTraceFlags: () => Promise<TraceFlagItem[]>;
  readonly ensureTraceFlag: (
    userId: string,
    duration?: number,
    logType?: TraceFlagLogType,
    existingDebugLevelId?: string
  ) => Promise<{ created: boolean; traceFlagId: string }>;
  readonly onDidChangeTraceFlags: vscode.Event<TraceFlagItem[]>;

  readonly simpleExec: (command: string, parse?: (stdout: string) => string) => Promise<string>;

  readonly getComponentSetFromUris: (uris: readonly URI[]) => Promise<ComponentSet>;
  readonly getComponentSetFromManifest: (manifestUri: URI) => Promise<ComponentSet>;
  readonly getComponentSetFromProjectDirectories: () => Promise<ComponentSet>;
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
    onDidChangeTargetOrg: orgChangeEmitter.event,

    getWorkspaceInfo: () => run(builtContext, WorkspaceService.getWorkspaceInfo()),

    isSalesforceProject: () => run(builtContext, ProjectService.isSalesforceProject()),
    getSfProject: () => run(builtContext, ProjectService.getSfProject()),
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

    retrieve: (members: MetadataMember[], options?: SourceTrackingOptions) =>
      run(builtContext, MetadataRetrieveService.retrieve(members, options)),
    retrieveComponentSet: (components: ComponentSet, options?: SourceTrackingOptions) =>
      run(builtContext, MetadataRetrieveService.retrieveComponentSet(components, options)),
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

    simpleExec: (command: string, parse?: (stdout: string) => string) =>
      run(
        builtContext,
        Effect.gen(function* () {
          const svc = yield* TerminalService;
          return yield* svc.simpleExec(command, parse);
        })
      ),

    getComponentSetFromUris: (uris: readonly URI[]) =>
      run(builtContext, ComponentSetService.getComponentSetFromUris(uris)),
    getComponentSetFromManifest: (manifestUri: URI) =>
      run(builtContext, ComponentSetService.getComponentSetFromManifest(manifestUri)),
    getComponentSetFromProjectDirectories: () =>
      run(builtContext, ComponentSetService.getComponentSetFromProjectDirectories())
  };
};
