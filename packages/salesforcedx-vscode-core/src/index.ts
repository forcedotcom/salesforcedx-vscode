/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  buildAllServicesLayer,
  closeExtensionScope,
  ExtensionProviderService,
  getServicesApi
} from '@salesforce/effect-ext-utils';
import { ChannelService, SFDX_CORE_CONFIGURATION_NAME, TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import { isError, isString } from 'effect/Predicate';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { configListCommand, initSObjectDefinitions, openDocumentationCommand } from './commands';

import { CommandEventDispatcher } from './commands/util/commandEventDispatcher';
import { ENABLE_SOBJECT_REFRESH_ON_STARTUP } from './constants';
import { WorkspaceContext, workspaceContextUtils } from './context';
import { nls } from './messages';
import { MetadataHoverProvider } from './metadataSupport/metadataHoverProvider';
import { initializeMetadataSupport } from './metadataSupport/metadataXmlSupport';
import { buildCoreServicesLayer, setAllServicesLayer } from './services/extensionProvider';
import { getRuntime } from './services/runtime';
import { registerGetTelemetryServiceCommand } from './services/telemetry/telemetryServiceProvider';
import { salesforceCoreSettings } from './settings';
import { showTelemetryMessage, telemetryService } from './telemetry';
import { getUserId } from './util/orgAuthInfoExtensions';
import { ensureCurrentWorkingDirIsProjectPath } from './util/workingDirectory';

/** Customer-facing commands */
const registerCommands = (_extensionContext: vscode.ExtensionContext): vscode.Disposable =>
  vscode.Disposable.from(registerGetTelemetryServiceCommand());

export const activate = async (extensionContext: vscode.ExtensionContext): Promise<SalesforceVSCodeCoreApi> => {
  // Initialize services layer first so getRuntime() can use it.
  setAllServicesLayer(
    buildAllServicesLayer(extensionContext, nls.localize('channel_name')).pipe(buildCoreServicesLayer)
  );

  await getRuntime().runPromise(activateEffect(extensionContext));

  const api: SalesforceVSCodeCoreApi = {
    getUserId,
    telemetryService,
    workspaceContextUtils,
    services: {
      RegistryAccess,
      ChannelService,
      TelemetryService,
      WorkspaceContext,
      CommandEventDispatcher
    }
  };

  return api;
};

export const activateEffect = Effect.fn('activation:salesforcedx-vscode-core')(function* (
  extensionContext: vscode.ExtensionContext
) {
  yield* ensureCurrentWorkingDirIsProjectPath();

  // Dispose the services-owned output channel with the extension context.
  const servicesApi = yield* getServicesApi;
  const coreChannel = yield* (yield* servicesApi.services.ChannelService).getChannel;
  extensionContext.subscriptions.push(coreChannel);

  yield* Effect.promise(() => telemetryService.initializeService(extensionContext));
  void showTelemetryMessage(extensionContext);

  // Set internal dev context
  const internalDev = yield* salesforceCoreSettings.getInternalDev();
  yield* Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:internal_dev', internalDev));
  yield* Effect.promise(() => WorkspaceContext.getInstance().initialize(extensionContext));

  if (internalDev) {
    console.log('SF CLI Extension Activated (internal dev mode)');
    return;
  }

  const registerCommand = servicesApi.services.registerCommandWithRuntime(getRuntime());
  yield* registerCommand('sf.open.documentation', openDocumentationCommand);

  // Context — ProjectService.isSalesforceProject() sets sf:project_opened as a side effect
  const salesforceProjectOpened = yield* servicesApi.services.ProjectService.isSalesforceProject();

  yield* registerCommand('sf.config.list', () => configListCommand());

  extensionContext.subscriptions.push(registerCommands(extensionContext), CommandEventDispatcher.getInstance());

  if (salesforceProjectOpened) {
    yield* initializeProject();
  }

  if (
    vscode.extensions.getExtension('salesforce.salesforcedx-vscode-metadata') &&
    salesforceProjectOpened &&
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    // Refresh SObject definitions only for an open Salesforce project
    // when faux classes are missing (metadata extension registers the command).
    const sobjectRefreshStartup =
      (yield* servicesApi.services.SettingsService.getValue(
        SFDX_CORE_CONFIGURATION_NAME,
        ENABLE_SOBJECT_REFRESH_ON_STARTUP,
        false
      )) ?? false;
    yield* initSObjectDefinitions(vscode.workspace.workspaceFolders![0].uri.fsPath, sobjectRefreshStartup);
  }

  console.log('SF CLI Extension Activated');
  handleTheUnhandled();
});

const initializeProject = Effect.fn('initializeProject')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const extensionContext = yield* (yield* api.services.ExtensionContextService).getContext;
  const metadataHoverProvider = new MetadataHoverProvider();

  yield* Effect.all([initializeMetadataSupport(), Effect.promise(() => metadataHoverProvider.initialize())], {
    concurrency: 'unbounded'
  });

  yield* Effect.sync(() => {
    extensionContext.subscriptions.push(
      vscode.languages.registerHoverProvider({ scheme: 'file', language: 'xml' }, metadataHoverProvider)
    );
  });
});

export const deactivate = async (): Promise<void> => {
  console.log('SF CLI Extension Deactivated');

  WorkspaceContext.disposeInstance();
  await getRuntime().runPromise(
    Effect.void.pipe(
      Effect.withSpan('deactivationEvent', {
        attributes: { extensionName: 'salesforcedx-vscode-core' },
        root: true
      })
    )
  );
  await getRuntime().runPromise(closeExtensionScope());

  telemetryService.dispose();
};

const handleTheUnhandled = (): void => {
  process.on('unhandledRejection', (reason: Error, promise: Promise<any>) => {
    const collectedData: {
      message?: string;
      fromExtension?: string | undefined;
      stackTrace?: string | undefined;
    } = {};
    // Attach a catch handler to the promise to handle the rejection
    promise.catch(error => {
      // Collect relevant data
      if (isError(error)) {
        collectedData.message = error.message;
        collectedData.stackTrace = error.stack ?? 'No stack trace available';
      } else if (isString(error)) {
        collectedData.message = error;
      }
    });
    // Capture stack trace if available
    collectedData.stackTrace ??= reason ? reason.stack : 'No stack trace available';

    // make an attempt to isolate the first reference to one of our extensions from the stack
    const dxExtension = collectedData.stackTrace
      ?.split(os.EOL)
      .filter(l => l.includes('at '))
      .flatMap(l => l.split(path.sep))
      .find(w => w.startsWith('salesforcedx-vscode'));

    getRuntime().runFork(
      salesforceCoreSettings.getEnableAllExceptionCatcher().pipe(
        Effect.flatMap(exceptionCatcher => {
          // Send detailed telemetry data for only dx extensions by default.
          // If the exception catcher is enabled, send telemetry data for all extensions.
          if (!dxExtension && !exceptionCatcher) return Effect.void;

          collectedData.fromExtension = dxExtension;
          return (
            exceptionCatcher
              ? Effect.logDebug('Debug mode is enabled', { errorData: JSON.stringify(collectedData) })
              : Effect.void
          ).pipe(
            Effect.andThen(
              Effect.fail(reason).pipe(
                Effect.withSpan('unhandledRejection', {
                  attributes: { message: JSON.stringify(collectedData) },
                  root: true
                })
              )
            )
          );
        })
      )
    );
  });
};

export type SalesforceVSCodeCoreApi = {
  getUserId: typeof getUserId;
  telemetryService: typeof telemetryService;
  workspaceContextUtils: typeof workspaceContextUtils;
  services: {
    RegistryAccess: typeof RegistryAccess;
    ChannelService: typeof ChannelService;
    TelemetryService: typeof TelemetryService;
    WorkspaceContext: typeof WorkspaceContext;
    CommandEventDispatcher: typeof CommandEventDispatcher;
  };
};
