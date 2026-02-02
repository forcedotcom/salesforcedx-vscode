/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { SERVICES_CHANNEL_NAME } from './constants';
import { ComponentSetService } from './core/componentSetService';
import { watchConfigFiles } from './core/configFileWatcher';
import { ConfigService } from './core/configService';
import { ConnectionService } from './core/connectionService';
import { getDefaultOrgRef } from './core/defaultOrgRef';
import { subscribeLifecycleWarnings } from './core/lifecycleWarningListener';
import { MetadataDeleteService } from './core/metadataDeleteService';
import { MetadataDeployService } from './core/metadataDeployService';
import { MetadataDescribeService } from './core/metadataDescribeService';
import { MetadataRegistryService } from './core/metadataRegistryService';
import { MetadataRetrieveService } from './core/metadataRetrieveService';
import { ProjectService } from './core/projectService';
import { retrieveOnLoadEffect } from './core/retrieveOnLoad';
import { SourceTrackingService } from './core/sourceTrackingService';
import { globalLayers } from './layers';
import { SdkLayerFor, ServicesSdkLayer } from './observability/spans';
import { updateTelemetryUserIds } from './observability/webUserId';
import { fileSystemSetup } from './virtualFsProvider/fileSystemSetup';
import { ChannelServiceLayer, ChannelService } from './vscode/channelService';
import { watchSettingsService } from './vscode/configWatcher';
import { watchDefaultOrgContext } from './vscode/context';
import { EditorService } from './vscode/editorService';
import { ErrorHandlerService, getErrorMessage } from './vscode/errorHandlerService';
import { ExtensionContextService, ExtensionContextServiceLayer } from './vscode/extensionContextService';
import { closeExtensionScope, getExtensionScope } from './vscode/extensionScope';
import { FileWatcherService } from './vscode/fileWatcherService';
import { FsService } from './vscode/fsService';
import { registerCommand } from './vscode/registerCommand';
import { SettingsService } from './vscode/settingsService';
import { WorkspaceService } from './vscode/workspaceService';

export type SalesforceVSCodeServicesApi = {
  services: {
    ChannelService: typeof ChannelService;
    ChannelServiceLayer: typeof ChannelServiceLayer;
    ComponentSetService: typeof ComponentSetService;
    ConfigService: typeof ConfigService;
    ConnectionService: typeof ConnectionService;
    EditorService: typeof EditorService;
    ErrorHandlerService: typeof ErrorHandlerService;
    ExtensionContextService: typeof ExtensionContextService;
    ExtensionContextServiceLayer: typeof ExtensionContextServiceLayer;
    FileWatcherService: typeof FileWatcherService;
    FsService: typeof FsService;
    getErrorMessage: typeof getErrorMessage;
    MetadataDeleteService: typeof MetadataDeleteService;
    MetadataDescribeService: typeof MetadataDescribeService;
    MetadataDeployService: typeof MetadataDeployService;
    MetadataRegistryService: typeof MetadataRegistryService;
    MetadataRetrieveService: typeof MetadataRetrieveService;
    ProjectService: typeof ProjectService;
    registerCommand: typeof registerCommand;
    SdkLayerFor: typeof SdkLayerFor;
    SettingsService: typeof SettingsService;
    SourceTrackingService: typeof SourceTrackingService;
    TargetOrgRef: typeof getDefaultOrgRef;
    WorkspaceService: typeof WorkspaceService;
  };
};
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
export type { FailedToResolveSfProjectError } from './core/projectService';
export type { NoWorkspaceOpenError } from './vscode/workspaceService';
export type { FailedToCreateConfigAggregatorError } from './core/configService';
export type {
  FailedToCreateAuthInfoError,
  FailedToSaveAuthInfoError,
  FailedToCreateConnectionError,
  FailedToResolveUsernameError,
  NoTargetOrgConfiguredError
} from './core/connectionService';
export type { MetadataDeployError } from './core/metadataDeployService';
export type { MetadataRetrieveError } from './core/metadataRetrieveService';
export type { MetadataDeleteError } from './core/metadataDeleteService';
export type { MetadataDescribeError, ListMetadataError } from './core/metadataDescribeService';
export type { GetRegistryAccessError } from './core/metadataRegistryService';
export type { FsServiceError } from './vscode/fsService';
export type { SettingsError } from './vscode/settingsService';

/** Effect that runs when the extension is activated */
const activationEffect = (context: vscode.ExtensionContext) =>
  Effect.gen(function* () {
    yield* (yield* ChannelService).appendToChannel(`${SERVICES_CHANNEL_NAME} extension is activating!`);

    if (process.env.ESBUILD_PLATFORM === 'web') {
      yield* Effect.forkIn(subscribeLifecycleWarnings(), yield* getExtensionScope());
      yield* fileSystemSetup(context);
      yield* retrieveOnLoadEffect();
      yield* Effect.forkIn(watchSettingsService(), yield* getExtensionScope());
    }
    // watch default org changes to update VS Code context variables and other services
    yield* Effect.forkIn(watchDefaultOrgContext(), yield* getExtensionScope());
    // watch the config files for changes, which various serices use to invalidate caches
    yield* Effect.forkIn(watchConfigFiles(), yield* getExtensionScope());
    yield* updateTelemetryUserIds(context);
  }).pipe(Effect.tapError(error => Effect.sync(() => console.error('❌ [Services] Activation failed:', error))));

/**
 * Activates the Salesforce Services extension and returns API for other extensions to consume
 * Both service tags/types and their default Live implementations are exported.
 * Consumers should get both from the API, not via direct imports.
 */
export const activate = async (context: vscode.ExtensionContext): Promise<SalesforceVSCodeServicesApi> => {
  if (process.env.ESBUILD_PLATFORM === 'web') {
    // test-web has this on by default. vscode-dev does not
    const autoSave = vscode.workspace.getConfiguration('files').get<boolean>('autoSave', false);
    if (autoSave) {
      await vscode.workspace.getConfiguration('files').update('autoSave', 'off', vscode.ConfigurationTarget.Global);
    }
    const { getWebAppInsightsReporter } = await import('./observability/applicationInsightsWebExporter.js');
    context.subscriptions.push(getWebAppInsightsReporter());
  }

  const extensionScope = Effect.runSync(getExtensionScope());

  // ErrorHandlerService depends on ChannelService, so provide it explicitly
  const errorHandlerWithChannel = Layer.provide(ErrorHandlerService.Default, ChannelService.Default);

  const requirements = Layer.mergeAll(
    globalLayers,
    ChannelService.Default,
    errorHandlerWithChannel,
    ServicesSdkLayer()
  );

  // Build the layer with extensionScope - scoped services live until extension deactivates
  await Effect.runPromise(
    Effect.provide(
      activationEffect(context).pipe(
        Effect.withSpan('activation:salesforcedx-vscode-services', {
          attributes: { isWeb: process.env.ESBUILD_PLATFORM === 'web' }
        })
      ),
      await Effect.runPromise(Layer.buildWithScope(requirements, extensionScope).pipe(Scope.extend(extensionScope)))
    ).pipe(Scope.extend(extensionScope))
  );

  console.log('Salesforce Services extension is now active!');
  // Return API for other extensions to consume
  return {
    services: {
      ChannelService,
      ChannelServiceLayer,
      ComponentSetService,
      ConfigService,
      ConnectionService,
      EditorService,
      ErrorHandlerService,
      ExtensionContextService,
      ExtensionContextServiceLayer,
      FileWatcherService,
      FsService,
      getErrorMessage,
      MetadataDeleteService,
      MetadataDescribeService,
      MetadataDeployService,
      MetadataRegistryService,
      MetadataRetrieveService,
      ProjectService,
      registerCommand,
      SdkLayerFor,
      SettingsService,
      SourceTrackingService,
      TargetOrgRef: getDefaultOrgRef,
      WorkspaceService
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
export { type WorkspaceService } from './vscode/workspaceService';
