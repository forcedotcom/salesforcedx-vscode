/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SalesforceVSCodeServicesApi as SalesforceVSCodeServicesApiV3 } from '@salesforce/vscode-services';
import {
  ChannelService,
  ConnectionService,
  FsService,
  ProjectService,
  SettingsService,
  TargetOrgRef,
  type SalesforceVSCodeServicesApiV2
} from '@salesforce/vscode-services/v2';
import { createCompatibleConnectionServices } from '@salesforce/vscode-services-v3-compat';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { ActivationWatchersLayer } from './activationWatchers.js';
import { LifecycleWarningsLayer } from './core/lifecycleWarningListener.js';
import { retrieveOnLoadEffect } from './core/retrieveOnLoad.js';
import { nls } from './messages/index.js';
import { annotateExtensionPackType } from './observability/extensionPackStatus.js';
import { redactSensitiveData } from './observability/redactSensitiveData.js';
import { seedTelemetryIdentities } from './observability/seedTelemetryIdentities.js';
import { ServicesSdkLayer } from './observability/spans.js';
import { makeActivationHostLayers } from './services/activationHostLayers.js';
import { bootstrapServiceLayers } from './services/bootstrapLayers.js';
import { catalogProviderLayers } from './services/catalogLayers.js';
import { createCatalogRuntime } from './services/catalogRuntime.js';
import { getErrorMessage, makeErrorHandlerServiceLayer } from './services/errorHandlerService.js';
import { OrgCatalogCloseWatcherLayer } from './services/orgCatalog/orgCatalogCloseWatcher.js';
import { OrgMetadataCatalogStore } from './services/orgCatalog/orgMetadataCatalogStore.js';
import { registerCommandWithRuntime } from './services/registerCommand.js';
import { WebFileSystemProvider, WebFileSystemProviderNoopLayer } from './services/webFileSystemProvider.js';
import { clearServicesRuntime, getServicesRuntime, setServicesRuntime } from './servicesRuntime.js';
import { WebFileSystemProviderLayer } from './virtualFsProvider/fileSystemSetup.js';
import { setExtensionContext } from './vscode/extensionContext.js';
import { runWebAuthEffect } from './vscode/runWebAuth.js';

export type SalesforceVSCodeServicesApi = SalesforceVSCodeServicesApiV3 & SalesforceVSCodeServicesApiV2;

type ActiveServices = {
  readonly deactivate: () => Promise<void>;
};

const activeServices: { value: ActiveServices | undefined } = { value: undefined };
const isWeb = process.env.ESBUILD_PLATFORM === 'web';

type ActivationLayer = ReturnType<typeof activationLayers>;
type ActivationRuntime = ManagedRuntime.ManagedRuntime<Layer.Success<ActivationLayer>, Layer.Error<ActivationLayer>>;

const activationEffect = (context: vscode.ExtensionContext, runtime: ActivationRuntime) =>
  Effect.gen(function* () {
    yield* ChannelService.use(channel => channel.appendToChannel('Salesforce Services extension is activating!'));

    yield* registerCommandWithRuntime(runtime)('sf.internal.showOrgMetadataCatalogState', () =>
      Effect.gen(function* () {
        const [catalogStore, fs] = yield* Effect.all([OrgMetadataCatalogStore, FsService]);
        const { orgId } = yield* TargetOrgRef.pipe(Effect.flatMap(SubscriptionRef.get));
        if (!orgId) {
          yield* Effect.sync(() => {
            void vscode.window.showInformationMessage(nls.localize('org_metadata_catalog_no_default_org'));
          });
          return;
        }
        const snapshotUri = yield* catalogStore.getSnapshotUri(orgId);
        if (!(yield* fs.fileOrFolderExists(snapshotUri))) {
          yield* Effect.sync(() => {
            void vscode.window.showInformationMessage(nls.localize('org_metadata_catalog_state_missing'));
          });
          return;
        }
        yield* fs.showTextDocument(snapshotUri, { preview: false });
      }).pipe(
        Effect.withSpan('OrgMetadataCatalog.showPersistedState'),
        Effect.catch(error =>
          Effect.sync(() => {
            void vscode.window.showErrorMessage(
              nls.localize('org_metadata_catalog_state_open_failed', getErrorMessage(error))
            );
          })
        )
      )
    );

    if (
      context.extensionMode === vscode.ExtensionMode.Development ||
      context.extensionMode === vscode.ExtensionMode.Test
    ) {
      yield* registerCommandWithRuntime(runtime)('sf.internal.testRedactingConsoleLogger', () =>
        Effect.logInfo('runtime logger test 00D000000000000!playwright-secret')
      );
    }

    yield* ProjectService.use(service => service.isSalesforceProject());
    const internalDev = yield* SettingsService.use(service => service.getInternalDev());
    yield* Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:internal_dev', internalDev));
    yield* Effect.promise(() =>
      vscode.commands.executeCommand('setContext', 'sf:code_builder_enabled', process.env.CODE_BUILDER === 'true')
    );
  }).pipe(Effect.withSpan('activation:salesforcedx-vscode-services'));

const startRuntimeWork = (runtime: ActivationRuntime) => {
  runtime.runFork(ConnectionService.use(service => service.getConnection()).pipe(Effect.catch(() => Effect.void)));
  runtime.runFork(annotateExtensionPackType);
  if (isWeb) runtime.runFork(retrieveOnLoadEffect());
};

const activationLayers = (host: ReturnType<typeof makeActivationHostLayers>) => {
  const fileSystemLayer = isWeb ? WebFileSystemProviderLayer : WebFileSystemProviderNoopLayer;
  const domain = Layer.mergeAll(ActivationWatchersLayer, LifecycleWarningsLayer, OrgCatalogCloseWatcherLayer).pipe(
    Layer.provideMerge(catalogProviderLayers)
  );
  const errors = makeErrorHandlerServiceLayer(host.errorHandlerMessages).pipe(Layer.provideMerge(domain));
  const hosted = errors.pipe(Layer.provideMerge(host.layer));
  return ServicesSdkLayer().pipe(
    Layer.provideMerge(hosted),
    Layer.provideMerge(fileSystemLayer),
    Layer.provideMerge(bootstrapServiceLayers)
  );
};

/** Build the web filesystem first; a shared memo map gives bootstrap and the provider graph one service graph. */
export const activate = async (context: vscode.ExtensionContext): Promise<SalesforceVSCodeServicesApi> => {
  setExtensionContext(context);
  const memoMap = Layer.makeMemoMapUnsafe();
  const host = makeActivationHostLayers(context);
  const fileSystemLayer = isWeb ? WebFileSystemProviderLayer : WebFileSystemProviderNoopLayer;
  const bootstrapLayer = Layer.mergeAll(host.layer, fileSystemLayer).pipe(Layer.provideMerge(bootstrapServiceLayers));
  const bootstrapRuntime = ManagedRuntime.make(bootstrapLayer, { memoMap });

  // eslint-disable-next-line functional/no-try-statements -- VS Code activation must await bootstrap cleanup before restoring its original rejection.
  try {
    if (isWeb && process.env.ESBUILD_WEB_CONFIG) await Effect.runPromise(runWebAuthEffect());
    if (isWeb) await bootstrapRuntime.runPromise(WebFileSystemProvider);
    if (isWeb && vscode.workspace.getConfiguration('files').get<boolean>('autoSave', false)) {
      await Promise.resolve(
        vscode.workspace.getConfiguration('files').update('autoSave', 'off', vscode.ConfigurationTarget.Global)
      );
    }
    await bootstrapRuntime.runPromise(seedTelemetryIdentities());

    const layer = activationLayers(host);
    const compatible = await createCompatibleConnectionServices(async () => {
      const owner = await createCatalogRuntime(
        layer,
        redactSensitiveData,
        host.errorHandlerMessages,
        host.orgChangedMessage,
        undefined,
        memoMap
      );
      const runtime = owner.runtime;
      setServicesRuntime(runtime);
      // eslint-disable-next-line functional/no-try-statements -- Failed activation must unpublish and dispose the acquired graph before rejecting.
      try {
        await runtime.runPromise(activationEffect(context, runtime));
        startRuntimeWork(runtime);
        return owner;
      } catch (error) {
        const close = await owner.close();
        clearServicesRuntime(runtime);
        const disposal = await owner.dispose();
        if (close._tag === 'Failure' || disposal._tag === 'Failure') {
          // eslint-disable-next-line functional/no-throw-statements -- Preserve both activation and native owner cleanup failures.
          throw new AggregateError([error, close, disposal], 'Services activation and V4 owner cleanup failed');
        }
        // eslint-disable-next-line functional/no-throw-statements -- Preserve the original activation rejection.
        throw error;
      }
    });

    const deactivateServices = async () => {
      const runtime = await Effect.runPromise(getServicesRuntime());
      await runtime.runPromise(Effect.log('Salesforce Services extension is deactivating!'));
      await runtime.runPromise(
        ChannelService.use(channel => channel.appendToChannel('Salesforce Services extension is deactivating!'))
      );
      // eslint-disable-next-line functional/no-try-statements -- The bootstrap scope must close after owner teardown, even if it fails.
      try {
        await compatible.dispose();
      } finally {
        await bootstrapRuntime.dispose();
      }
    };
    activeServices.value = { deactivate: deactivateServices };
    const api: SalesforceVSCodeServicesApi = compatible;
    return api;
  } catch (error) {
    // eslint-disable-next-line functional/no-try-statements -- Preserve startup failure while awaiting bootstrap-scope cleanup.
    try {
      await bootstrapRuntime.dispose();
    } catch (cleanup) {
      // eslint-disable-next-line functional/no-throw-statements -- Report startup and cleanup failures together at the native boundary.
      throw new AggregateError([error, cleanup], 'Services activation and bootstrap cleanup failed');
    }
    // eslint-disable-next-line functional/no-throw-statements -- Preserve the original activation rejection.
    throw error;
  }
};

export const deactivate = async (): Promise<void> => {
  const active = activeServices.value;
  activeServices.value = undefined;
  if (active) await active.deactivate();
};
