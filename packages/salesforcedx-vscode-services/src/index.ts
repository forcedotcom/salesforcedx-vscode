/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Resource } from '@effect/opentelemetry';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { SERVICES_CHANNEL_NAME } from './constants';
import { getActiveMetadataOperationRef } from './core/activeMetadataOperationRef';
import { AliasService } from './core/alias';
import { AliasFileWatcherService, watchDefaultOrgAliases } from './core/aliasFileWatcher';
import { ApexLogService } from './core/apexLogService';
import { ComponentSetService } from './core/componentSetService';
import { watchConfigFiles } from './core/configFileWatcher';
import { ConfigService } from './core/configService';
import { ConnectionService } from './core/connectionService';
import { getDefaultOrgRef } from './core/defaultOrgRef';
import { ExecuteAnonymousService } from './core/executeAnonymousService';
import { subscribeLifecycleWarnings } from './core/lifecycleWarningListener';
import { MetadataDeleteService } from './core/metadataDeleteService';
import { MetadataDeployService } from './core/metadataDeployService';
import { MetadataDescribeService } from './core/metadataDescribeService';
import { MetadataRegistryService } from './core/metadataRegistryService';
import { MetadataRetrieveService } from './core/metadataRetrieveService';
import { ProjectService } from './core/projectService';
import { retrieveOnLoadEffect } from './core/retrieveOnLoad';
import { SourceTrackingService } from './core/sourceTrackingService';
import { TemplateService, TemplateType } from './core/templateService';
import { TraceFlagItemStruct, TraceFlagService } from './core/traceFlagService';
import { TransmogrifierService } from './core/transmogrifierService';
import { SdkLayerFor, ServicesSdkLayer } from './observability/spans';
import { updateTelemetryUserIds } from './observability/webUserId';
import { isItReadOnlyLayer } from './virtualFsProvider/fileSystemProvider';
import { fileSystemSetup } from './virtualFsProvider/fileSystemSetup';
import { IndexedDBStorageServiceShared } from './virtualFsProvider/indexedDbStorage';
import { ChannelServiceLayer, ChannelService } from './vscode/channelService';
import { watchSettingsService } from './vscode/configWatcher';
import { watchDefaultOrgContext } from './vscode/context';
import { watchApexTestContext, watchPackageDirectoriesContext } from './vscode/editorContext';
import { EditorService } from './vscode/editorService';
import { ErrorHandlerService, getErrorMessage } from './vscode/errorHandlerService';
import { setExtensionContext } from './vscode/extensionContext';
import { ExtensionContextService, ExtensionContextServiceLayer } from './vscode/extensionContextService';
import { closeExtensionScope, getExtensionScope } from './vscode/extensionScope';
import { FileWatcherService } from './vscode/fileWatcherService';
import { FsService } from './vscode/fsService';
import { MediaService } from './vscode/mediaService';
import { PromptService, UserCancellationError } from './vscode/prompts/promptService';
import { registerCommandWithLayer, registerCommandWithRuntime } from './vscode/registerCommand';
import { runWebAuthEffect } from './vscode/runWebAuth';
import { SettingsService } from './vscode/settingsService';
import { SettingsWatcherService } from './vscode/settingsWatcherService';
import { WorkspaceService } from './vscode/workspaceService';

export type SalesforceVSCodeServicesApi = {
  services: {
    /** contains most of the dependencies prebuilt in the services extension */
    prebuiltServicesDependencies: Context.Context<
      | AliasService
      | ApexLogService
      | ChannelService
      | ComponentSetService
      | ConfigService
      | ConnectionService
      | EditorService
      | ErrorHandlerService
      | FileWatcherService
      | FsService
      | MediaService
      | MetadataDeleteService
      | MetadataDeployService
      | MetadataDescribeService
      | PromptService
      | MetadataRegistryService
      | MetadataRetrieveService
      | ProjectService
      | Resource.Resource
      | SettingsService
      | SettingsWatcherService
      | SourceTrackingService
      | TemplateService
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
    ConfigService: typeof ConfigService;
    ConnectionService: typeof ConnectionService;
    registerCommandWithLayer: typeof registerCommandWithLayer;
    registerCommandWithRuntime: typeof registerCommandWithRuntime;
    ExecuteAnonymousService: typeof ExecuteAnonymousService;
    EditorService: typeof EditorService;
    ErrorHandlerService: typeof ErrorHandlerService;
    ExtensionContextService: typeof ExtensionContextService;
    ExtensionContextServiceLayer: typeof ExtensionContextServiceLayer;
    FileWatcherService: typeof FileWatcherService;
    FsService: typeof FsService;
    getErrorMessage: typeof getErrorMessage;
    MediaService: typeof MediaService;
    MetadataDeleteService: typeof MetadataDeleteService;
    MetadataDescribeService: typeof MetadataDescribeService;
    MetadataDeployService: typeof MetadataDeployService;
    PromptService: typeof PromptService;
    MetadataRegistryService: typeof MetadataRegistryService;
    MetadataRetrieveService: typeof MetadataRetrieveService;
    ProjectService: typeof ProjectService;
    SdkLayerFor: typeof SdkLayerFor;
    SettingsService: typeof SettingsService;
    SettingsWatcherService: typeof SettingsWatcherService;
    SourceTrackingService: typeof SourceTrackingService;
    ActiveMetadataOperationRef: typeof getActiveMetadataOperationRef;
    TargetOrgRef: typeof getDefaultOrgRef;
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
export type { NoActiveEditorError, EditorService } from './vscode/editorService';
export type { GetOrgFromConnectionError } from './core/shared';
export type {
  SourceTrackingConflictError,
  SourceTrackingError,
  SourceTrackingNotEnabledError,
  SourceTrackingService
} from './core/sourceTrackingService';
export type { HashableUri } from './vscode/hashableUri';
export type { FailedToResolveSfProjectError, NotInPackageDirectoryError } from './core/projectService';
export type { NoWorkspaceOpenError } from './vscode/workspaceService';
export type { FailedToCreateConfigAggregatorError } from './core/configService';
export type {
  FailedToCreateAuthInfoError,
  FailedToSaveAuthInfoError,
  FailedToCreateConnectionError,
  FailedToResolveUsernameError,
  NoTargetOrgConfiguredError
} from './core/connectionService';
export { invalidateCachedConnections } from './core/connectionService';
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
  context: vscode.ExtensionContext
) {
  yield* (yield* ChannelService).appendToChannel(`${SERVICES_CHANNEL_NAME} extension is activating!`);
  // do this first to prevent Connection issues.
  yield* updateTelemetryUserIds(context);
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
  // watch default org changes to update VS Code context variables and other services
  yield* Effect.all(
    [
      // watch default org changes to update VS Code context variables and other services
      Effect.forkIn(watchDefaultOrgContext(), scope),
      // watch the config files for changes, which various services use to invalidate caches
      Effect.forkIn(watchConfigFiles(), scope),
      // watch active editor changes to update package directories context
      Effect.forkIn(watchPackageDirectoriesContext(), scope),
      // watch active editor changes to update apex test context
      Effect.forkIn(watchApexTestContext(), scope),
      // watch alias.json for changes and refresh defaultOrgRef.aliases accordingly
      Effect.forkIn(watchDefaultOrgAliases(), scope)
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
});

/**
 * Activates the Salesforce Services extension and returns API for other extensions to consume
 * Both service tags/types and their default Live implementations are exported.
 * Consumers should get both from the API, not via direct imports.
 */
export const activate = async (context: vscode.ExtensionContext): Promise<SalesforceVSCodeServicesApi> => {
  setExtensionContext(context);
  const extensionScope = Effect.runSync(getExtensionScope());

  if (process.env.ESBUILD_PLATFORM === 'web') {
    if (process.env.ESBUILD_WEB_CONFIG) {
      await Effect.runPromise(runWebAuthEffect());
    }
    // first, before all other things, get the FS running.
    await Effect.runPromise(
      fileSystemSetup(context).pipe(
        Effect.provide(
          Layer.mergeAll(
            SettingsService.Default,
            ChannelService.Default,
            IndexedDBStorageServiceShared,
            isItReadOnlyLayer
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

  // ErrorHandlerService depends on ChannelService, so provide it explicitly
  const errorHandlerWithChannel = Layer.provide(ErrorHandlerService.Default, ChannelService.Default);

  /** they're global in the sense that they should be the same for all extension */
  const globalLayers = Layer.mergeAll(
    Layer.provide(AliasFileWatcherService.Default, FileWatcherService.Default),
    AliasService.Default,
    TemplateService.Default,
    ExtensionContextService.Default,
    ExecuteAnonymousService.Default,
    ApexLogService.Default,
    ComponentSetService.Default,
    ConfigService.Default,
    ConnectionService.Default,
    EditorService.Default,
    FileWatcherService.Default,
    FsService.Default,
    MediaService.Default,
    MetadataDescribeService.Default,
    MetadataDeleteService.Default,
    MetadataDeployService.Default,
    PromptService.Default,
    MetadataRegistryService.Default,
    MetadataRetrieveService.Default,
    ProjectService.Default,
    ServicesSdkLayer(),
    SettingsService.Default,
    SettingsWatcherService.Default,
    SourceTrackingService.Default,
    TransmogrifierService.Default,
    TraceFlagService.Default,
    WorkspaceService.Default
  );

  const requirements = Layer.mergeAll(
    globalLayers,
    ChannelService.Default,
    errorHandlerWithChannel,
    ServicesSdkLayer()
  );

  // Build the layer with extensionScope - scoped services live until extension deactivates
  const builtContext = await Effect.runPromise(
    Layer.buildWithScope(requirements, extensionScope).pipe(Scope.extend(extensionScope))
  );

  await Effect.runPromise(
    Effect.provide(
      activationEffect(context).pipe(
        Effect.tapError(error => Effect.sync(() => console.error('❌ [Services] Activation failed:', error))),
        Effect.withSpan('activation:salesforcedx-vscode-services', {
          attributes: { isWeb: process.env.ESBUILD_PLATFORM === 'web' }
        })
      ),
      builtContext
    ).pipe(
      Scope.extend(extensionScope),
      Effect.tapError(error => Effect.sync(() => console.error('❌ [Services] Activation failed:', error)))
    )
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
      ConfigService,
      ConnectionService,
      ExecuteAnonymousService,
      registerCommandWithLayer,
      registerCommandWithRuntime,
      EditorService,
      ErrorHandlerService,
      ExtensionContextService,
      ExtensionContextServiceLayer,
      FileWatcherService,
      FsService,
      getErrorMessage,
      MediaService,
      MetadataDeleteService,
      MetadataDescribeService,
      MetadataDeployService,
      MetadataRegistryService,
      MetadataRetrieveService,
      ProjectService,
      SdkLayerFor,
      SettingsService,
      SettingsWatcherService,
      SourceTrackingService,
      ActiveMetadataOperationRef: getActiveMetadataOperationRef,
      TargetOrgRef: getDefaultOrgRef,
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
export {
  type ExtensionContextService,
  type ExtensionContextServiceLayer,
  ExtensionContextNotAvailableError
} from './vscode/extensionContextService';
export { type FileWatcherService } from './vscode/fileWatcherService';
export { type FsService } from './vscode/fsService';
export {
  MetadataDeleteService,
  type MetadataDeleteService as MetadataDeleteServiceType
} from './core/metadataDeleteService';
export { type ApexLogListItem, type ApexLogService, type ListLogsOptions } from './core/apexLogService';
export { type MetadataDescribeService } from './core/metadataDescribeService';
export {
  MetadataDeployService,
  type MetadataDeployService as MetadataDeployServiceType
} from './core/metadataDeployService';
export { type MetadataRegistryService } from './core/metadataRegistryService';
export { type MetadataRetrieveService } from './core/metadataRetrieveService';
export { type ProjectService } from './core/projectService';
export { type SdkLayerFor } from './observability/spans';
export { type SettingsService } from './vscode/settingsService';
export { type SettingsWatcherService } from './vscode/settingsWatcherService';
export { type DebugLevelItem, type TraceFlagItem, type TraceFlagService } from './core/traceFlagService';
export { type WorkspaceService } from './vscode/workspaceService';
export type { UserCancellationError } from './vscode/prompts/promptService';
