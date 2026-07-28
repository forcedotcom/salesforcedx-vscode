/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Resource } from '@effect/opentelemetry';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { SERVICES_CHANNEL_NAME } from './constants';
import { getActiveMetadataOperationRef } from './core/activeMetadataOperationRef';
import { AliasService } from './core/alias';
import { watchAliasFile } from './core/aliasFileWatcher';
import { ApexLogService } from './core/apexLogService';
import { ComponentSetService } from './core/componentSetService';
import { watchConfigFiles } from './core/configFileWatcher';
import { ConfigService } from './core/configService';
import { ConnectionService } from './core/connectionService';
import { getDefaultOrgRef } from './core/defaultOrgRef';
import { ExecuteAnonymousService } from './core/executeAnonymousService';
import { subscribeLifecycleWarnings } from './core/lifecycleWarningListener';
import { LightningComponentService } from './core/lightningComponentService';
import { MetadataChangeNotificationService } from './core/metadataChangeNotificationService';
import { MetadataDeleteService } from './core/metadataDeleteService';
import { MetadataDeployService } from './core/metadataDeployService';
import { MetadataDescribeService } from './core/metadataDescribeService';
import { MetadataRegistryService } from './core/metadataRegistryService';
import { MetadataRetrieveService } from './core/metadataRetrieveService';
import { ProjectService } from './core/projectService';
import { retrieveOnLoadEffect } from './core/retrieveOnLoad';
import { TraceFlagItemStruct } from './core/schemas/traceFlagSchemas';
import { watchSfProjectFile } from './core/sfProjectFileWatcher';
import { SourceTrackingService } from './core/sourceTrackingService';
import { TemplateService, TemplateType } from './core/templateService';
import { TraceFlagService } from './core/traceFlagService';
import { TransmogrifierService } from './core/transmogrifierService';
import { annotateExtensionPackType } from './observability/extensionPackStatus';
import { getSdkLayerConfigFromContext } from './observability/sdkLayerConfig';
import { seedTelemetryIdentities } from './observability/seedTelemetryIdentities';
import { SdkLayerFor, ServicesSdkLayer } from './observability/spans';
import { OrgDataDecorationProvider } from './orgVfs/orgDataDecorationProvider';
import { OrgDataFsProvider } from './orgVfs/orgDataFsProvider';
import { watchOrgDataLifecycle } from './orgVfs/orgDataLifecycle';
import {
  ORG_DATA_SCHEME,
  orgDataDocumentSelector,
  orgDataOwnerRoot,
  orgDataSegments,
  orgDataUri,
  orgRoot
} from './orgVfs/orgDataUris';
import { OrgMetadataChangePubSub } from './orgVfs/orgMetadataChangePubSub';
import { registerOrgMetadataCodeLensProvider } from './orgVfs/orgMetadataCodeLensProvider';
import { OrgMetadataResolver, orgMetadataUri } from './orgVfs/orgMetadataResolver';
import { watchOrgMetadataResolver } from './orgVfs/orgMetadataWatcher';
import { makeGlobalLayers } from './servicesLayers';
import { disposeServicesRuntime, setServicesRuntime } from './servicesRuntime';
import { TerminalService } from './terminal/terminalService';
import { isItReadOnlyLayer } from './virtualFsProvider/fileSystemProvider';
import {
  makeFileSystemProviderRegistry,
  type FileSystemProviderRegistry as FileSystemProviderRegistryType
} from './virtualFsProvider/fileSystemProviderRegistry';
import { fileSystemSetup } from './virtualFsProvider/fileSystemSetup';
import { IndexedDBStorageServiceShared } from './virtualFsProvider/indexedDbStorage';
import { ChannelServiceLayer, ChannelService } from './vscode/channelService';
import { watchSettingsService } from './vscode/configWatcher';
import { watchDefaultOrgContext } from './vscode/context';
import { watchEsrDecomposedContext, watchMuleDxApiInactiveContext } from './vscode/contextKeyWatchers';
import { watchApexTestContext, watchOrgDataOwnerContext, watchPackageDirectoriesContext } from './vscode/editorContext';
import { EditorService } from './vscode/editorService';
import { ErrorHandlerService, getErrorMessage } from './vscode/errorHandlerService';
import { watchLwcAuraExtensionActivation } from './vscode/extensionActivator';
import { setExtensionContext } from './vscode/extensionContext';
import { ExtensionContextService, ExtensionContextServiceLayer } from './vscode/extensionContextService';
import { closeExtensionScope, getExtensionScope } from './vscode/extensionScope';
import { FileChangePubSub } from './vscode/fileChangePubSub';
import { FileWatcherLayer } from './vscode/fileWatcherService';
import { FsService } from './vscode/fsService';
import { MediaService } from './vscode/mediaService';
import { PromptService, UserCancellationError } from './vscode/prompts/promptService';
import { registerCommandWithLayer, registerCommandWithRuntime } from './vscode/registerCommand';
import { runWebAuthEffect } from './vscode/runWebAuth';
import { SettingsChangePubSub } from './vscode/settingsChangePubSub';
import { SettingsService } from './vscode/settingsService';
import { SettingsWatcherLayer } from './vscode/settingsWatcherService';
import { closeMatchingTabs } from './vscode/tabs';
import { WorkspaceService } from './vscode/workspaceService';

export type SalesforceVSCodeServicesApi = {
  services: {
    /** contains most of the dependencies prebuilt in the services extension */
    prebuiltServicesDependencies: Context.Context<
      | AliasService
      | ApexLogService
      | ChannelService
      | ComponentSetService
      | LightningComponentService
      | ConfigService
      | ConnectionService
      | EditorService
      | ErrorHandlerService
      | ExecuteAnonymousService
      | FileChangePubSub
      | FileSystemProviderRegistryType
      | FsService
      | MediaService
      | MetadataChangeNotificationService
      | MetadataDeleteService
      | MetadataDeployService
      | MetadataDescribeService
      | PromptService
      | MetadataRegistryService
      | MetadataRetrieveService
      | OrgMetadataChangePubSub
      | OrgMetadataResolver
      | ProjectService
      | Resource.Resource
      | SettingsChangePubSub
      | SettingsService
      | SourceTrackingService
      | TemplateService
      | TerminalService
      | TraceFlagService
      | TransmogrifierService
      | WorkspaceService
    >;
    ApexLogService: typeof ApexLogService;
    AliasService: typeof AliasService;
    TemplateService: typeof TemplateService;
    TemplateType: typeof TemplateType;
    ChannelService: typeof ChannelService;
    ChannelServiceLayer: typeof ChannelServiceLayer;
    ComponentSetService: typeof ComponentSetService;
    LightningComponentService: typeof LightningComponentService;
    ConfigService: typeof ConfigService;
    ConnectionService: typeof ConnectionService;
    registerCommandWithLayer: typeof registerCommandWithLayer;
    registerCommandWithRuntime: typeof registerCommandWithRuntime;
    ExecuteAnonymousService: typeof ExecuteAnonymousService;
    EditorService: typeof EditorService;
    ErrorHandlerService: typeof ErrorHandlerService;
    ExtensionContextService: typeof ExtensionContextService;
    ExtensionContextServiceLayer: typeof ExtensionContextServiceLayer;
    FileChangePubSub: typeof FileChangePubSub;
    closeMatchingTabs: typeof closeMatchingTabs;
    orgDataDocumentSelector: typeof orgDataDocumentSelector;
    orgDataOwnerRoot: typeof orgDataOwnerRoot;
    orgDataSegments: typeof orgDataSegments;
    orgDataUri: typeof orgDataUri;
    orgRoot: typeof orgRoot;
    FsService: typeof FsService;
    getErrorMessage: typeof getErrorMessage;
    MediaService: typeof MediaService;
    MetadataChangeNotificationService: typeof MetadataChangeNotificationService;
    MetadataDeleteService: typeof MetadataDeleteService;
    MetadataDescribeService: typeof MetadataDescribeService;
    MetadataDeployService: typeof MetadataDeployService;
    PromptService: typeof PromptService;
    MetadataRegistryService: typeof MetadataRegistryService;
    MetadataRetrieveService: typeof MetadataRetrieveService;
    OrgMetadataChangePubSub: typeof OrgMetadataChangePubSub;
    OrgMetadataResolver: typeof OrgMetadataResolver;
    orgMetadataUri: typeof orgMetadataUri;
    ProjectService: typeof ProjectService;
    getSdkLayerConfigFromContext: typeof getSdkLayerConfigFromContext;
    SdkLayerFor: typeof SdkLayerFor;
    SettingsChangePubSub: typeof SettingsChangePubSub;
    SettingsService: typeof SettingsService;
    SourceTrackingService: typeof SourceTrackingService;
    ActiveMetadataOperationRef: typeof getActiveMetadataOperationRef;
    TargetOrgRef: typeof getDefaultOrgRef;
    TerminalService: typeof TerminalService;
    TransmogrifierService: typeof TransmogrifierService;
    TraceFlagItemStruct: typeof TraceFlagItemStruct;
    TraceFlagService: typeof TraceFlagService;
    WorkspaceService: typeof WorkspaceService;
    UserCancellationError: typeof UserCancellationError;
  };
};
export type { AliasService } from './core/alias';
export {
  TemplateService,
  type CreateOutput,
  type CreateParams,
  type TemplateOptionsFor,
  type TemplateType
} from './core/templateService';
export type { TemplatesManifestLoadError, TemplatesRootPathNotAvailableError } from './core/templateService';
export type {
  NonEmptyComponentSet,
  ComponentSetService,
  FailedToBuildComponentSetError,
  EmptyComponentSetError
} from './core/componentSetService';
export type { LightningComponentKind, RenameBundleParams } from './core/lightningComponentService';
export type { NoActiveEditorError, EditorService } from './vscode/editorService';
export type { GetOrgFromConnectionError } from './core/shared';
export type {
  SourceTrackingConflictError,
  SourceTrackingError,
  SourceTrackingNotEnabledError,
  SourceTrackingService
} from './core/sourceTrackingService';
export { HashableUri } from './vscode/hashableUri';
export type { FailedToResolveSfProjectError, NotInPackageDirectoryError } from './core/projectService';
export type { NoWorkspaceOpenError } from './vscode/workspaceService';
export type { FailedToCreateConfigAggregatorError } from './core/configService';
export type {
  FailedToCreateAuthInfoError,
  FailedToSaveAuthInfoError,
  FailedToCreateConnectionError,
  FailedToResolveUsernameError,
  NoTargetOrgConfiguredError,
  FailedToListAuthorizationsError,
  AccessTokenExpiredError
} from './core/connectionService';
export type { MetadataDeployError } from './core/metadataDeployService';
export type { MetadataRetrieveError } from './core/metadataRetrieveService';
export type { MetadataDeleteError } from './core/metadataDeleteService';
export type {
  MetadataDescribeError,
  ListMetadataError,
  SObjectGlobalDescribeItem
} from './core/metadataDescribeService';
export type {
  DescribeSObjectResult,
  SObject,
  SObjectField,
  ChildRelationship,
  TransmogrifierService
} from './core/transmogrifierService';
export {
  SObjectSchema,
  SObjectFieldSchema,
  ChildRelationshipSchema,
  PicklistValueSchema
} from './core/transmogrifierService';
export type { ExecuteAnonymousResult } from './core/executeAnonymousService';
export type { ExecuteAnonymousError } from './errors/executeAnonymousErrors';
export type { ApexLogBodyFetchError, ApexLogQueryError } from './errors/apexLogErrors';
export type {
  DebugLevelCreateError,
  DebugLevelDeleteError,
  TraceFlagCreateError,
  TraceFlagNotFoundError,
  TraceFlagUpdateError,
  UserIdNotFoundError
} from './errors/traceFlagErrors';
export type { GetRegistryAccessError } from './core/metadataRegistryService';
export type { FsServiceError } from './vscode/fsService';
export { ICONS } from './vscode/mediaService';
export type { IconId, MediaService } from './vscode/mediaService';
export type { SettingsError } from './vscode/settingsService';

/** Effect that runs when the extension is activated after FS setup */
const activationEffect = Effect.fn('activation:salesforcedx-vscode-services')(function* (
  _context: vscode.ExtensionContext,
  orgDataProvider: OrgDataFsProvider
) {
  yield* (yield* ChannelService).appendToChannel(`${SERVICES_CHANNEL_NAME} extension is activating!`);
  // seed populates defaultOrgRef.cliId + webUserId before connectionService and core can read it
  yield* seedTelemetryIdentities();
  const scope = yield* getExtensionScope();

  if (process.env.ESBUILD_PLATFORM === 'web') {
    // auth settings go before other things so retrieveOnLoad can use them

    yield* Effect.all(
      [
        Effect.forkIn(subscribeLifecycleWarnings(), scope),
        Effect.forkIn(retrieveOnLoadEffect(), scope),
        Effect.forkIn(watchSettingsService(), scope)
      ],
      { concurrency: 'unbounded' }
    );
  }
  yield* Effect.all(
    [
      Effect.fork(annotateExtensionPackType),
      // watch default org changes to update VS Code context variables and other services
      Effect.forkIn(watchDefaultOrgContext(), scope),
      // watch the config files for changes, which various services use to invalidate caches
      Effect.forkIn(watchConfigFiles(), scope),
      // watch active editor changes to update package directories context
      Effect.forkIn(watchPackageDirectoriesContext(), scope),
      // watch active editor changes to update apex test context
      Effect.forkIn(watchApexTestContext(), scope),
      // publish the owner of the active org-data virtual document
      Effect.forkIn(watchOrgDataOwnerContext(), scope),
      // close stale org-data tabs before purging their backing entries
      Effect.forkIn(watchOrgDataLifecycle(), scope),
      // invalidate canonical metadata presence when the org or workspace changes
      Effect.forkIn(
        watchOrgMetadataResolver(uri => orgDataProvider.notifyOwnerChanged(uri)),
        scope
      ),
      // watch active editor to activate LWC/Aura extensions on demand
      Effect.forkIn(watchLwcAuraExtensionActivation(), scope),
      // own sf:muleDxApiInactive context (was set once in apex-oas, now reactive)
      Effect.forkIn(watchMuleDxApiInactiveContext(), scope),
      // own sf:is_esr_decomposed context, react to sfdx-project.json changes
      Effect.forkIn(watchEsrDecomposedContext(), scope),
      // watch alias.json for changes and refresh defaultOrgRef.aliases accordingly
      Effect.forkIn(watchAliasFile(), scope),
      // watch sfdx-project.json for changes and invalidate the SfProject cache (fresh sourceApiVersion)
      Effect.forkIn(watchSfProjectFile(), scope)
    ],
    {
      concurrency: 'unbounded'
    }
  );
  // init the connection for all the consumers who might need it
  // no Connection is a possible state
  yield* Effect.forkIn(ConnectionService.getConnection().pipe(Effect.catchAll(() => Effect.void)), scope);
  // set sf:project_opened context before activation resolves so lazy-loaded extensions can show
  // their commands on startup — must be blocking (not forked) so the context key is set before
  // VS Code evaluates `when` clauses for command palette visibility
  yield* ProjectService.isSalesforceProject();
  // set sf:internal_dev context so internal commands are visible in explorer menus when enabled
  const internalDev = yield* SettingsService.getInternalDev();
  yield* Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:internal_dev', internalDev));
  // set sf:code_builder_enabled context so Code Builder-only commands are visible on web
  yield* Effect.promise(() =>
    vscode.commands.executeCommand('setContext', 'sf:code_builder_enabled', process.env.CODE_BUILDER === 'true')
  );
});

/**
 * Activates the Salesforce Services extension and returns API for other extensions to consume
 * Both service tags/types and their default Live implementations are exported.
 * Consumers should get both from the API, not via direct imports.
 */
export const activate = async (context: vscode.ExtensionContext): Promise<SalesforceVSCodeServicesApi> => {
  setExtensionContext(context);
  const extensionScope = Effect.runSync(getExtensionScope());

  const providerRegistry = makeFileSystemProviderRegistry();
  const orgDataProvider = new OrgDataFsProvider();
  providerRegistry.register(ORG_DATA_SCHEME, { provider: orgDataProvider });
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(ORG_DATA_SCHEME, orgDataProvider, {
      isCaseSensitive: true,
      isReadonly: true
    }),
    vscode.window.registerFileDecorationProvider(new OrgDataDecorationProvider())
  );

  if (process.env.ESBUILD_PLATFORM === 'web') {
    // load auth from local environment.  development only.
    if (process.env.ESBUILD_WEB_CONFIG) {
      await Effect.runPromise(runWebAuthEffect());
    }
    // first, before all other things, get the FS running.
    await Effect.runPromise(
      fileSystemSetup(context, providerRegistry).pipe(
        Effect.provide(
          Layer.mergeAll(
            SettingsService.Default,
            ChannelService.Default,
            IndexedDBStorageServiceShared,
            isItReadOnlyLayer,
            ServicesSdkLayer()
          )
        ),
        Scope.extend(extensionScope)
      )
    );
    // test-web has this on by default. vscode-dev does not
    if (vscode.workspace.getConfiguration('files').get<boolean>('autoSave', false)) {
      await vscode.workspace.getConfiguration('files').update('autoSave', 'off', vscode.ConfigurationTarget.Global);
    }

    const { getWebAppInsightsReporter } = await import('./observability/applicationInsightsWebExporter.js');
    context.subscriptions.push(getWebAppInsightsReporter());
  }
  const internalLayers = Layer.mergeAll(
    FileWatcherLayer,
    ServicesSdkLayer(),
    SettingsWatcherLayer,
    ErrorHandlerService.Default
  ).pipe(Layer.provideMerge(ChannelService.Default));

  const requirements = Layer.mergeAll(internalLayers).pipe(Layer.provideMerge(makeGlobalLayers(providerRegistry)));

  // Build the layer with extensionScope - scoped services live until extension deactivates
  const builtContext = await Effect.runPromise(Layer.buildWithScope(requirements, extensionScope));
  // Publish a runtime over the built context for imperative VS Code boundaries (e.g. the O11y span
  // exporter) that can't yield* into it directly — reuses these shared instances (one connection +
  // reauth cache) instead of Effect.provide(ConnectionService.Default), which builds a private
  // ConnectionService with its own reauth cache (a duplicate reauth modal on desktop). The exporter
  // fails fast until this is set, so it never blocks activation waiting on it.
  const servicesRuntime = ManagedRuntime.make(Layer.succeedContext(builtContext));
  setServicesRuntime(servicesRuntime);
  context.subscriptions.push(
    orgDataProvider.registerOwnerHandler('org-metadata', {
      stat: uri => servicesRuntime.runPromise(OrgMetadataResolver.stat(uri)),
      readDirectory: uri => servicesRuntime.runPromise(OrgMetadataResolver.readDirectory(uri)),
      readFile: uri => servicesRuntime.runPromise(OrgMetadataResolver.readFile(uri))
    })
  );
  registerOrgMetadataCodeLensProvider(
    context,
    uri => servicesRuntime.runPromise(OrgMetadataResolver.download(uri)),
    uri => servicesRuntime.runPromise(OrgMetadataResolver.isInWorkspace(uri)),
    uri => servicesRuntime.runPromise(closeMatchingTabs(tabUri => tabUri.toString() === uri.toString()))
  );

  await activationEffect(context, orgDataProvider).pipe(
    Effect.provide(builtContext),
    Effect.tapError(error => Effect.sync(() => console.error('❌ [Services] Activation failed:', error))),
    Effect.runPromise
  );

  console.log('Salesforce Services extension is now active!');

  // Return API for other extensions to consume
  return {
    services: {
      prebuiltServicesDependencies: builtContext,
      ApexLogService,
      AliasService,
      TemplateService,
      TemplateType,
      ChannelService,
      ChannelServiceLayer,
      ComponentSetService,
      LightningComponentService,
      ConfigService,
      ConnectionService,
      ExecuteAnonymousService,
      registerCommandWithLayer,
      registerCommandWithRuntime,
      EditorService,
      ErrorHandlerService,
      ExtensionContextService,
      ExtensionContextServiceLayer,
      FileChangePubSub,
      closeMatchingTabs,
      orgDataDocumentSelector,
      orgDataOwnerRoot,
      orgDataSegments,
      orgDataUri,
      orgRoot,
      FsService,
      getErrorMessage,
      MediaService,
      MetadataChangeNotificationService,
      MetadataDeleteService,
      MetadataDescribeService,
      MetadataDeployService,
      MetadataRegistryService,
      MetadataRetrieveService,
      OrgMetadataChangePubSub,
      OrgMetadataResolver,
      orgMetadataUri,
      ProjectService,
      getSdkLayerConfigFromContext,
      SdkLayerFor,
      SettingsChangePubSub,
      SettingsService,
      SourceTrackingService,
      ActiveMetadataOperationRef: getActiveMetadataOperationRef,
      TargetOrgRef: getDefaultOrgRef,
      TerminalService,
      TransmogrifierService,
      TraceFlagItemStruct,
      TraceFlagService,
      WorkspaceService,
      PromptService,
      UserCancellationError
    }
  };
};

/** Deactivates the Salesforce Services extension */
export const deactivate = async (): Promise<void> => {
  await Effect.runPromise(deactivateEffect);
  console.log('Salesforce Services extension is now deactivated!');
};

const deactivateEffect = Effect.gen(function* () {
  // dispose the runtime (interrupting in-flight fibers) BEFORE closing the scope that owns the services
  // those fibers touch, so nothing runs against a torn-down service.
  yield* disposeServicesRuntime();
  yield* closeExtensionScope();
  yield* ChannelService.pipe(
    Effect.flatMap(svc => svc.appendToChannel('Salesforce Services extension is now deactivated!'))
  );
}).pipe(
  Effect.withSpan('deactivation:salesforcedx-vscode-services'),
  Effect.provide(Layer.mergeAll(ChannelService.Default, ServicesSdkLayer()))
);

export { type DefaultOrgInfoSchema } from './core/schemas/defaultOrgInfo';
export { type ChannelService, type ChannelServiceLayer } from './vscode/channelService';
export { type ConfigService } from './core/configService';
export { type ConnectionService } from './core/connectionService';
export { type ErrorHandlerService } from './vscode/errorHandlerService';
export { type ExtensionContextService, type ExtensionContextServiceLayer } from './vscode/extensionContextService';
export { ExtensionContextNotAvailableError } from './vscode/extensionContextErrors';
export { type FileChangePubSub, type FileChangeEvent } from './vscode/fileChangePubSub';
export { type FsService } from './vscode/fsService';
export {
  MetadataDeleteService,
  type MetadataDeleteService as MetadataDeleteServiceType
} from './core/metadataDeleteService';
export { type ApexLogListItem, type ApexLogService, type ListLogsOptions } from './core/apexLogService';
export { type MetadataDescribeService } from './core/metadataDescribeService';
export {
  MetadataChangeNotificationService,
  MetadataChangeEvent,
  type MetadataChangeEvent as MetadataChangeEventType
} from './core/metadataChangeNotificationService';
export type { MetadataChangeType, RequestStatusValue } from './core/sdrGuards';
export {
  MetadataDeployService,
  type MetadataDeployService as MetadataDeployServiceType
} from './core/metadataDeployService';
export { type MetadataRegistryService } from './core/metadataRegistryService';
export { type MetadataRetrieveService } from './core/metadataRetrieveService';
export { type OrgMetadataChangePubSub } from './orgVfs/orgMetadataChangePubSub';
export {
  OrgMetadataResolutionError,
  OrgMetadataResolver,
  orgMetadataUri,
  type PresenceState
} from './orgVfs/orgMetadataResolver';
export { type ProjectService } from './core/projectService';
export { type SdkLayerFor } from './observability/spans';
export { type SettingsService } from './vscode/settingsService';
export { type SettingsChangePubSub } from './vscode/settingsChangePubSub';
export {
  CreateDebugLevelStruct,
  DebugLevelItemSchema,
  TraceFlagItemStruct,
  TraceFlagLogType,
  type CreateDebugLevelPayload,
  type DebugLevelItem,
  type TraceFlagItem
} from './core/schemas/traceFlagSchemas';
export { type TraceFlagService } from './core/traceFlagService';
export { type WorkspaceService } from './vscode/workspaceService';
export type { UserCancellationError } from './vscode/prompts/promptService';
export type { TerminalService, TerminalServiceError } from './terminal/terminalService';
