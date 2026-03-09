/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { O11yService } from '@salesforce/o11y-reporter';
import {
  ActivationTracker,
  ChannelService,
  ensureCurrentWorkingDirIsProjectPath,
  getRootWorkspacePath,
  isSalesforceProjectOpened,
  notificationService,
  ProgressNotification,
  SFDX_CORE_CONFIGURATION_NAME,
  SfCommandlet,
  SfWorkspaceChecker,
  TelemetryService,
  TimingUtils
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
  apexGenerateClass,
  apexGenerateTrigger,
  configList,
  deleteSource,
  deployManifest,
  deploySourcePaths,
  initSObjectDefinitions,
  internalLightningGenerateApp,
  internalLightningGenerateAuraComponent,
  internalLightningGenerateEvent,
  internalLightningGenerateInterface,
  internalLightningGenerateLwc,
  lightningGenerateApp,
  lightningGenerateAuraComponent,
  lightningGenerateEvent,
  lightningGenerateInterface,
  lightningGenerateLwc,
  openDocumentation,
  packageInstall,
  projectDeployStart,
  projectGenerateManifest,
  projectGenerateWithManifest,
  projectRetrieveStart,
  renameLightningComponent,
  retrieveComponent,
  retrieveManifest,
  retrieveSourcePaths,
  sfProjectGenerate,
  sourceDiff,
  sourceFolderDiff,
  viewAllChanges,
  viewLocalChanges,
  viewRemoteChanges,
  visualforceGenerateComponent,
  visualforceGeneratePage
} from './commands';
import { RetrieveMetadataTrigger } from './commands/retrieveMetadata';
import { SelectFileName, SelectOutputDir, SfCommandletExecutor } from './commands/util';

import { CommandEventDispatcher } from './commands/util/commandEventDispatcher';
import { PersistentStorageService, registerConflictView, setupConflictView } from './conflict';
import { ENABLE_SOBJECT_REFRESH_ON_STARTUP, USE_METADATA_EXTENSION_COMMANDS } from './constants';
import { WorkspaceContext, workspaceContextUtils } from './context';
import { MetadataHoverProvider } from './metadataSupport/metadataHoverProvider';
import { MetadataXmlSupport } from './metadataSupport/metadataXmlSupport';
import { orgBrowser } from './orgBrowser';
import { SalesforceProjectConfig } from './salesforceProject';
import { buildAllServicesLayer, setAllServicesLayer, AllServicesLayer } from './services/extensionProvider';
import { registerGetTelemetryServiceCommand } from './services/telemetry/telemetryServiceProvider';
import { registerPushOrDeployOnSave, salesforceCoreSettings } from './settings';
import { showTelemetryMessage, telemetryService } from './telemetry';
import { reportExtensionPackStatus } from './telemetry/metricsReporter';
import { isCLIInstalled, setNodeExtraCaCerts, setSfLogLevel } from './util';
import { getUserId, getAuthFields } from './util/orgAuthInfoExtensions';

/** Commands shared with metadata extension */
const registerSharedCommands = (): vscode.Disposable =>
  vscode.Disposable.from(
    vscode.commands.registerCommand('sf.deploy.current.source.file', deploySourcePaths),
    vscode.commands.registerCommand('sf.deploy.multiple.source.paths', deploySourcePaths),
    vscode.commands.registerCommand('sf.project.deploy.start', async (isDeployOnSave: boolean) =>
      projectDeployStart(isDeployOnSave, false)
    ),
    vscode.commands.registerCommand('sf.project.deploy.start.ignore.conflicts', async (isDeployOnSave: boolean) =>
      projectDeployStart(isDeployOnSave, true)
    ),
    vscode.commands.registerCommand('sf.project.retrieve.start', projectRetrieveStart),
    vscode.commands.registerCommand('sf.project.retrieve.start.ignore.conflicts', () => projectRetrieveStart(true)),
    vscode.commands.registerCommand('sf.view.all.changes', viewAllChanges),
    vscode.commands.registerCommand('sf.view.local.changes', viewLocalChanges),
    vscode.commands.registerCommand('sf.view.remote.changes', viewRemoteChanges),
    vscode.commands.registerCommand('sf.apex.generate.class', apexGenerateClass),
    vscode.commands.registerCommand('sf.delete.source', deleteSource),
    vscode.commands.registerCommand('sf.delete.source.current.file', deleteSource),
    vscode.commands.registerCommand('sf.deploy.source.path', deploySourcePaths),
    vscode.commands.registerCommand('sf.deploy.in.manifest', deployManifest),
    vscode.commands.registerCommand('sf.retrieve.source.path', retrieveSourcePaths),
    vscode.commands.registerCommand('sf.retrieve.current.source.file', retrieveSourcePaths),
    vscode.commands.registerCommand('sf.retrieve.in.manifest', retrieveManifest),
    vscode.commands.registerCommand('sf.project.generate.manifest', projectGenerateManifest)
  );

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
    vscode.commands.registerCommand('sf.folder.diff', sourceFolderDiff),
    vscode.commands.registerCommand('sf.diff', sourceDiff),
    vscode.commands.registerCommand('sf.open.documentation', openDocumentation),
    vscode.commands.registerCommand('sf.analytics.generate.template', analyticsGenerateTemplate),
    vscode.commands.registerCommand('sf.visualforce.generate.component', visualforceGenerateComponent),
    vscode.commands.registerCommand('sf.visualforce.generate.page', visualforceGeneratePage),
    vscode.commands.registerCommand('sf.lightning.generate.app', lightningGenerateApp),
    vscode.commands.registerCommand('sf.lightning.generate.aura.component', lightningGenerateAuraComponent),
    vscode.commands.registerCommand('sf.lightning.generate.event', lightningGenerateEvent),
    vscode.commands.registerCommand('sf.lightning.generate.interface', lightningGenerateInterface),
    vscode.commands.registerCommand('sf.lightning.generate.lwc', lightningGenerateLwc),
    vscode.commands.registerCommand('sf.config.list', configList),
    vscode.commands.registerCommand('sf.project.generate', sfProjectGenerate),
    vscode.commands.registerCommand('sf.package.install', packageInstall),
    vscode.commands.registerCommand('sf.project.generate.with.manifest', projectGenerateWithManifest),
    vscode.commands.registerCommand('sf.apex.generate.trigger', apexGenerateTrigger),
    registerGetTelemetryServiceCommand()
  );
const registerInternalDevCommands = (): vscode.Disposable =>
  vscode.Disposable.from(
    vscode.commands.registerCommand(
      'sf.internal.lightning.generate.aura.component',
      internalLightningGenerateAuraComponent
    ),
    vscode.commands.registerCommand('sf.internal.lightning.generate.lwc', internalLightningGenerateLwc),
    vscode.commands.registerCommand('sf.internal.lightning.generate.app', internalLightningGenerateApp),
    vscode.commands.registerCommand('sf.internal.lightning.generate.event', internalLightningGenerateEvent),
    vscode.commands.registerCommand('sf.internal.lightning.generate.interface', internalLightningGenerateInterface)
  );

const setupOrgBrowser = async (extensionContext: vscode.ExtensionContext): Promise<void> => {
  const useLegacyOrgBrowser = salesforceCoreSettings.getUseLegacyOrgBrowser();
  if (!useLegacyOrgBrowser) {
    return;
  }
  await orgBrowser.init(extensionContext);

  vscode.commands.registerCommand('sf.metadata.view.type.refresh', async node => {
    await orgBrowser.refreshAndExpand(node);
  });

  vscode.commands.registerCommand('sf.metadata.view.component.refresh', async node => {
    await orgBrowser.refreshAndExpand(node);
  });

  vscode.commands.registerCommand('sf.retrieve.component', async (trigger: RetrieveMetadataTrigger) => {
    await retrieveComponent(trigger);
  });

  vscode.commands.registerCommand('sf.retrieve.open.component', async (trigger: RetrieveMetadataTrigger) => {
    await retrieveComponent(trigger, true);
  });
};

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

  // Set internal dev context
  const internalDev = salesforceCoreSettings.getInternalDev();
  await vscode.commands.executeCommand('setContext', 'sf:internal_dev', internalDev);

  // Set shared commands visibility context (inverse of useMetadataExtensionCommands)
  // Only hide shared commands if metadata extension is installed AND config is enabled
  const metadataExtension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-metadata');
  const useMetadataCommands = metadataExtension && salesforceCoreSettings.getUseMetadataExtensionCommands();
  await vscode.commands.executeCommand('setContext', 'sf:show_shared_commands', !useMetadataCommands);
  // Set shared Auth State
  const sharedAuthState = SharedAuthState.getInstance();

  const api: SalesforceVSCodeCoreApi = {
    channelService,
    getO11yService: (extensionId: string) => O11yService.getInstance(extensionId),
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
    SfWorkspaceChecker,
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
    // Internal Dev commands
    extensionContext.subscriptions.push(registerInternalDevCommands());

    telemetryService.sendExtensionActivationEvent(activationStartTime);
    reportExtensionPackStatus();
    console.log('SF CLI Extension Activated (internal dev mode)');
    return api;
  }

  // Context
  const salesforceProjectOpened = (await isSalesforceProjectOpened()).result;

  // TODO: move this and the replay debugger commands to the apex extension
  void vscode.commands.executeCommand(
    'setContext',
    'sf:replay_debugger_extension',
    vscode.extensions.getExtension('salesforce.salesforcedx-vscode-apex-replay-debugger') !== undefined
  );

  void vscode.commands.executeCommand('setContext', 'sf:project_opened', salesforceProjectOpened);

  // Set Code Builder context
  const codeBuilderEnabled = process.env.CODE_BUILDER === 'true';
  void vscode.commands.executeCommand('setContext', 'sf:code_builder_enabled', codeBuilderEnabled);

  if (salesforceProjectOpened) {
    await initializeProject(extensionContext);
  }

  setAllServicesLayer(buildAllServicesLayer(extensionContext));
  await Effect.runPromise(registerEffectCommands().pipe(Effect.provide(AllServicesLayer)));

  extensionContext.subscriptions.push(
    registerCommands(extensionContext),
    registerSharedCommands(),
    // Register configuration change listener for shared commands visibility
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(`${SFDX_CORE_CONFIGURATION_NAME}.${USE_METADATA_EXTENSION_COMMANDS}`)) {
        void vscode.commands.executeCommand(
          'setContext',
          'sf:show_shared_commands',
          !metadataExtension || !salesforceCoreSettings.getUseMetadataExtensionCommands()
        );
      }
    }),
    registerConflictView(),
    CommandEventDispatcher.getInstance()
  );

  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    // Refresh SObject definitions if there aren't any faux classes
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
  PersistentStorageService.initialize(extensionContext);

  // Register file watcher for push or deploy on save
  registerPushOrDeployOnSave();

  // Initialize metadata hover provider
  const metadataHoverProvider = new MetadataHoverProvider();

  await Promise.all([
    setupOrgBrowser(extensionContext),
    setupConflictView(extensionContext),
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
  getO11yService: (extensionId: string) => O11yService;
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
  SfWorkspaceChecker: typeof SfWorkspaceChecker;
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
