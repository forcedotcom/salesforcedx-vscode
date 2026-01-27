/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { closeExtensionScope, getExtensionScope, setExtensionContext } from '@salesforce/effect-ext-utils';
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
import { SdkLayerFor, ServicesSdkLayer } from './observability/spans';
import { updateTelemetryUserIds } from './observability/webUserId';
import { fileSystemSetup } from './virtualFsProvider/fileSystemSetup';
import { IndexedDBStorageServiceShared } from './virtualFsProvider/indexedDbStorage';
import { ChannelServiceLayer, ChannelService } from './vscode/channelService';
import { watchSettingsService } from './vscode/configWatcher';
import { watchDefaultOrgContext } from './vscode/context';
import { EditorService } from './vscode/editorService';
import { FileWatcherService } from './vscode/fileWatcherService';
import { FsService } from './vscode/fsService';
import { SettingsService } from './vscode/settingsService';
import { SettingsWatcherService } from './vscode/settingsWatcherService';
import { WorkspaceService } from './vscode/workspaceService';

export type SalesforceVSCodeServicesApi = {
  services: {
    ChannelService: typeof ChannelService;
    ChannelServiceLayer: typeof ChannelServiceLayer;
    ComponentSetService: typeof ComponentSetService;
    ConfigService: typeof ConfigService;
    ConnectionService: typeof ConnectionService;
    EditorService: typeof EditorService;
    FileWatcherService: typeof FileWatcherService;
    FsService: typeof FsService;
    MetadataDeleteService: typeof MetadataDeleteService;
    MetadataDescribeService: typeof MetadataDescribeService;
    MetadataDeployService: typeof MetadataDeployService;
    MetadataRegistryService: typeof MetadataRegistryService;
    MetadataRetrieveService: typeof MetadataRetrieveService;
    ProjectService: typeof ProjectService;
    SdkLayerFor: typeof SdkLayerFor;
    SettingsService: typeof SettingsService;
    SourceTrackingService: typeof SourceTrackingService;
    TargetOrgRef: typeof getDefaultOrgRef;
    WorkspaceService: typeof WorkspaceService;
  };
};
export type { NonEmptyComponentSet } from './core/componentSetService';
export type { NoActiveEditorError } from './vscode/editorService';
// export type { FailedToResolveSfProjectError } from './core/projectService';
export type { GetOrgFromConnectionError } from './core/shared';
export type { SourceTrackingConflictError } from './core/sourceTrackingService';
export type { HashableUri } from './vscode/hashableUri';

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
  setExtensionContext(context);

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

  const requirements = Layer.mergeAll(
    ChannelService.Default,
    ComponentSetService.Default,
    ConfigService.Default,
    ConnectionService.Default,
    FileWatcherService.Default,
    IndexedDBStorageServiceShared,
    MetadataDeleteService.Default,
    MetadataRegistryService.Default,
    MetadataRetrieveService.Default,
    ProjectService.Default,
    ServicesSdkLayer(),
    SettingsService.Default,
    SettingsWatcherService.Default,
    SourceTrackingService.Default,
    WorkspaceService.Default
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
      FileWatcherService,
      FsService,
      MetadataDeleteService,
      MetadataDescribeService,
      MetadataDeployService,
      MetadataRegistryService,
      MetadataRetrieveService,
      ProjectService,
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

export { type ChannelService } from './vscode/channelService';
