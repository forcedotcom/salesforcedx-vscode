/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getServicesApi } from '@salesforce/effect-ext-utils';
import {
  ChannelService,
  SFDX_CORE_CONFIGURATION_NAME,
  SfCommandlet,
  TelemetryService
} from '@salesforce/salesforcedx-utils-vscode';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { SharedAuthState } from './auth/sharedAuthState';
import { channelService } from './channels';
import {
  aliasListCommand,
  analyticsGenerateTemplate,
  configList,
  initSObjectDefinitions,
  agentProjectGenerate,
  nativemobileProjectGenerate,
  openDocumentation,
  packageInstall,
  projectGenerateWithManifest,
  renameLightningComponent,
  sfProjectGenerate
} from './commands';
import { SfCommandletExecutor } from './commands/util';

import { CommandEventDispatcher } from './commands/util/commandEventDispatcher';
import { ENABLE_SOBJECT_REFRESH_ON_STARTUP } from './constants';
import { WorkspaceContext, workspaceContextUtils } from './context';
import { MetadataHoverProvider } from './metadataSupport/metadataHoverProvider';
import { MetadataXmlSupport } from './metadataSupport/metadataXmlSupport';
import { SalesforceProjectConfig } from './salesforceProject/salesforceProjectConfig';
import { buildAllServicesLayer, setAllServicesLayer, AllServicesLayer } from './services/extensionProvider';
import { getRuntime } from './services/runtime';
import { registerGetTelemetryServiceCommand } from './services/telemetry/telemetryServiceProvider';
import { salesforceCoreSettings } from './settings';
import { showTelemetryMessage, telemetryService } from './telemetry';
import { isCLIInstalled, setNodeExtraCaCerts, setSfLogLevel } from './util';
import { getUserId, getAuthFields } from './util/orgAuthInfoExtensions';
import { ensureCurrentWorkingDirIsProjectPath } from './util/workingDirectory';

/** Customer-facing commands */
const registerCommands = (_extensionContext: vscode.ExtensionContext): vscode.Disposable =>
  vscode.Disposable.from(
    vscode.commands.registerCommand('sf.rename.lightning.component', renameLightningComponent),
    vscode.commands.registerCommand('sf.open.documentation', openDocumentation),
    vscode.commands.registerCommand('sf.analytics.generate.template', analyticsGenerateTemplate),
    vscode.commands.registerCommand('sf.config.list', configList),
    vscode.commands.registerCommand('sf.project.generate', sfProjectGenerate),
    vscode.commands.registerCommand('sf.agent.generate.project', agentProjectGenerate),
    vscode.commands.registerCommand('sf.nativemobile.generate.project', nativemobileProjectGenerate),
    vscode.commands.registerCommand('sf.package.install', packageInstall),
    vscode.commands.registerCommand('sf.project.generate.with.manifest', projectGenerateWithManifest),
    registerGetTelemetryServiceCommand()
  );

export const activate = async (extensionContext: vscode.ExtensionContext): Promise<SalesforceVSCodeCoreApi> => {
  // Initialize services layer first so getRuntime() can use it.
  setAllServicesLayer(buildAllServicesLayer(extensionContext));

  // Set shared Auth State
  const sharedAuthState = SharedAuthState.getInstance();

  const api: SalesforceVSCodeCoreApi = {
    channelService,
    getUserId,
    getAuthFields,
    isCLIInstalled,
    SfCommandlet,
    SfCommandletExecutor,
    WorkspaceContext,
    telemetryService,
    workspaceContextUtils,
    sharedAuthState,
    services: {
      RegistryAccess,
      ChannelService,
      SalesforceProjectConfig,
      TelemetryService,
      WorkspaceContext,
      CommandEventDispatcher
    }
  };

  await getRuntime().runPromise(activateEffect(extensionContext));

  return api;
};

export const activateEffect = Effect.fn('activation:salesforcedx-vscode-core')(function* (
  extensionContext: vscode.ExtensionContext
) {
  yield* ensureCurrentWorkingDirIsProjectPath();

  setNodeExtraCaCerts();
  setSfLogLevel();
  yield* Effect.promise(() => telemetryService.initializeService(extensionContext));
  void showTelemetryMessage(extensionContext);

  // Set internal dev context
  const internalDev = salesforceCoreSettings.getInternalDev();
  yield* Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:internal_dev', internalDev));

  if (internalDev) {
    console.log('SF CLI Extension Activated (internal dev mode)');
    return;
  }

  // Context — ProjectService.isSalesforceProject() sets sf:project_opened as a side effect
  const servicesApi = yield* getServicesApi;
  const salesforceProjectOpened = yield* servicesApi.services.ProjectService.isSalesforceProject();

  // Set Code Builder context
  const codeBuilderEnabled = process.env.CODE_BUILDER === 'true';
  void vscode.commands.executeCommand('setContext', 'sf:code_builder_enabled', codeBuilderEnabled);

  if (salesforceProjectOpened) {
    yield* Effect.promise(() => initializeProject(extensionContext));
  }

  const registerCommand = servicesApi.services.registerCommandWithLayer(AllServicesLayer);
  yield* registerCommand('sf.alias.list', () => aliasListCommand());

  extensionContext.subscriptions.push(registerCommands(extensionContext), CommandEventDispatcher.getInstance());

  if (
    vscode.extensions.getExtension('salesforce.salesforcedx-vscode-metadata') &&
    salesforceProjectOpened &&
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    // Refresh SObject definitions only for an open Salesforce project
    // when faux classes are missing (metadata extension registers the command).
    const sobjectRefreshStartup: boolean = vscode.workspace
      .getConfiguration(SFDX_CORE_CONFIGURATION_NAME)
      .get<boolean>(ENABLE_SOBJECT_REFRESH_ON_STARTUP, false);
    yield* Effect.promise(() =>
      initSObjectDefinitions(vscode.workspace.workspaceFolders![0].uri.fsPath, sobjectRefreshStartup)
    );
  }

  setImmediate(() => {
    void WorkspaceContext.getInstance().initialize(extensionContext);
  });

  console.log('SF CLI Extension Activated');
  handleTheUnhandled();
});

const initializeProject = async (extensionContext: vscode.ExtensionContext) => {
  // Initialize metadata hover provider
  const metadataHoverProvider = new MetadataHoverProvider();

  await Promise.all([
    // Initialize metadata XML support
    MetadataXmlSupport.getInstance().initializeMetadataSupport(extensionContext),
    // Initialize metadata hover provider
    metadataHoverProvider.initialize()
  ]);

  // Register hover provider for XML files
  extensionContext.subscriptions.push(
    vscode.languages.registerHoverProvider({ scheme: 'file', language: 'xml' }, metadataHoverProvider)
  );
};

export const deactivate = (): void => {
  console.log('SF CLI Extension Deactivated');

  // Send metric data.
  telemetryService.sendExtensionDeactivationEvent();
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
      if (error instanceof Error) {
        collectedData.message = error.message;
        collectedData.stackTrace = error.stack ?? 'No stack trace available';
      } else if (typeof error === 'string') {
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

    const exceptionCatcher = salesforceCoreSettings.getEnableAllExceptionCatcher();
    // Send detailed telemetry data for only dx extensions by default.
    // If the exception catcher is enabled, send telemetry data for all extensions.
    if (dxExtension || exceptionCatcher) {
      collectedData.fromExtension = dxExtension;
      telemetryService.sendException('unhandledRejection', JSON.stringify(collectedData));
      if (exceptionCatcher) {
        console.log('Debug mode is enabled');
        console.log('error data: %s', JSON.stringify(collectedData));
      }
    }
  });
};

export type SalesforceVSCodeCoreApi = {
  channelService: typeof channelService;
  getUserId: typeof getUserId;
  getAuthFields: typeof getAuthFields;
  isCLIInstalled: typeof isCLIInstalled;
  SfCommandlet: typeof SfCommandlet;
  SfCommandletExecutor: typeof SfCommandletExecutor;
  WorkspaceContext: typeof WorkspaceContext;
  telemetryService: typeof telemetryService;
  workspaceContextUtils: typeof workspaceContextUtils;
  sharedAuthState: SharedAuthState;
  services: {
    RegistryAccess: typeof RegistryAccess;
    ChannelService: typeof ChannelService;
    SalesforceProjectConfig: typeof SalesforceProjectConfig;
    TelemetryService: typeof TelemetryService;
    WorkspaceContext: typeof WorkspaceContext;
    CommandEventDispatcher: typeof CommandEventDispatcher;
  };
};
