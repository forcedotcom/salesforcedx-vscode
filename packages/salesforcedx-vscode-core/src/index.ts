/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService, getServicesApi } from '@salesforce/effect-ext-utils';
import {
  ActivationTracker,
  ChannelService,
  ensureCurrentWorkingDirIsProjectPath,
  getRootWorkspacePath,
  notificationService,
  ProgressNotification,
  SFDX_CORE_CONFIGURATION_NAME,
  SfCommandlet,
  TelemetryService,
  TimingUtils
} from '@salesforce/salesforcedx-utils-vscode';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
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
import { SelectFileName, SelectOutputDir, SfCommandletExecutor } from './commands/util';

import { CommandEventDispatcher } from './commands/util/commandEventDispatcher';
import { ENABLE_SOBJECT_REFRESH_ON_STARTUP } from './constants';
import { WorkspaceContext, workspaceContextUtils } from './context';
import { MetadataHoverProvider } from './metadataSupport/metadataHoverProvider';
import { MetadataXmlSupport } from './metadataSupport/metadataXmlSupport';
import { SalesforceProjectConfig } from './salesforceProject/salesforceProjectConfig';
import { buildAllServicesLayer, setAllServicesLayer, AllServicesLayer } from './services/extensionProvider';
import { registerGetTelemetryServiceCommand } from './services/telemetry/telemetryServiceProvider';
import { salesforceCoreSettings } from './settings';
import { showTelemetryMessage, telemetryService } from './telemetry';
import { reportExtensionPackStatus } from './telemetry/metricsReporter';
import { isCLIInstalled, setNodeExtraCaCerts, setSfLogLevel } from './util';
import { getUserId, getAuthFields } from './util/orgAuthInfoExtensions';

const registerEffectCommands = () =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const registerCommand = api.services.registerCommandWithLayer(AllServicesLayer);
    yield* registerCommand('sf.alias.list', () => aliasListCommand());
  });

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
  const activationStartTime = TimingUtils.getCurrentTime();
  const activateTracker = new ActivationTracker(extensionContext, telemetryService);

  const rootWorkspacePath = getRootWorkspacePath();
  // Switch to the project directory so that the main @salesforce
  // node libraries work correctly.  @salesforce/core,
  // @salesforce/source-tracking, etc. all use process.cwd()
  // internally.  This causes issues when used from VSCE, as VSCE
  // processes can run with a path that does not reflect the current
  // project path (it often returns '/' from process.cwd()).
  // Switching to the project path here at activation time ensures that
  // commands are run with the project path returned from process.cwd(),
  // thus avoiding the potential errors surfaced when the libs call
  // process.cwd().
  await ensureCurrentWorkingDirIsProjectPath(rootWorkspacePath);
  setNodeExtraCaCerts();
  setSfLogLevel();
  await telemetryService.initializeService(extensionContext);
  void showTelemetryMessage(extensionContext);

  const internalDev = salesforceCoreSettings.getInternalDev();

  // Set shared Auth State
  const sharedAuthState = SharedAuthState.getInstance();

  const api: SalesforceVSCodeCoreApi = {
    channelService,
    getTargetOrgOrAlias: workspaceContextUtils.getTargetOrgOrAlias,
    getUserId,
    getAuthFields,
    isCLIInstalled,
    notificationService,
    ProgressNotification,
    SelectFileName,
    SelectOutputDir,
    SfCommandlet,
    SfCommandletExecutor,
    salesforceCoreSettings,
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

  if (internalDev) {
    telemetryService.sendExtensionActivationEvent(activationStartTime);
    reportExtensionPackStatus();
    console.log('SF CLI Extension Activated (internal dev mode)');
    return api;
  }

  // Context — ProjectService.isSalesforceProject() sets sf:project_opened as a side effect
  const salesforceProjectOpened = await Effect.runPromise(
    Effect.gen(function* () {
      const servicesApi = yield* getServicesApi;
      return yield* servicesApi.services.ProjectService.isSalesforceProject().pipe(
        Effect.provide(Layer.succeedContext(servicesApi.services.prebuiltServicesDependencies))
      );
    }).pipe(Effect.catchAllCause(() => Effect.succeed(false)))
  );

  // TODO: move this and the replay debugger commands to the apex extension
  void vscode.commands.executeCommand(
    'setContext',
    'sf:replay_debugger_extension',
    vscode.extensions.getExtension('salesforce.salesforcedx-vscode-apex-replay-debugger') !== undefined
  );

  // Set Code Builder context
  const codeBuilderEnabled = process.env.CODE_BUILDER === 'true';
  void vscode.commands.executeCommand('setContext', 'sf:code_builder_enabled', codeBuilderEnabled);

  if (salesforceProjectOpened) {
    await initializeProject(extensionContext);
  }

  setAllServicesLayer(buildAllServicesLayer(extensionContext));
  await Effect.runPromise(registerEffectCommands().pipe(Effect.provide(AllServicesLayer)));

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
    await initSObjectDefinitions(vscode.workspace.workspaceFolders[0].uri.fsPath, sobjectRefreshStartup);
  }

  void activateTracker.markActivationStop();
  reportExtensionPackStatus();

  setImmediate(() => {
    void WorkspaceContext.getInstance().initialize(extensionContext);
  });

  console.log('SF CLI Extension Activated');
  handleTheUnhandled();
  return api;
};

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

export const deactivate = async (): Promise<void> => {
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
  getTargetOrgOrAlias: typeof workspaceContextUtils.getTargetOrgOrAlias;
  getUserId: typeof getUserId;
  getAuthFields: typeof getAuthFields;
  isCLIInstalled: typeof isCLIInstalled;
  notificationService: typeof notificationService;
  ProgressNotification: typeof ProgressNotification;
  SelectFileName: typeof SelectFileName;
  SelectOutputDir: typeof SelectOutputDir;
  SfCommandlet: typeof SfCommandlet;
  SfCommandletExecutor: typeof SfCommandletExecutor;
  salesforceCoreSettings: typeof salesforceCoreSettings;
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
