/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ActivationTracker,
  ChannelService,
  ProgressNotification,
  SFDX_CORE_CONFIGURATION_NAME,
  SfWorkspaceChecker,
  TelemetryService,
  TimingUtils,
  TraceFlags,
  WorkspaceContextUtil,
  ensureCurrentWorkingDirIsProjectPath,
  getRootWorkspacePath,
  isSalesforceProjectOpened
} from '@salesforce/salesforcedx-utils-vscode';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve-bundle';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { channelService } from './channels';
import {
  aliasList,
  analyticsGenerateTemplate,
  apexGenerateClass,
  apexGenerateTrigger,
  apexGenerateUnitTestClass,
  configList,
  configSet,
  dataQuery,
  debuggerStop,
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
  orgCreate,
  orgDelete,
  orgDisplay,
  orgList,
  orgLoginAccessToken,
  orgLoginWeb,
  orgLoginWebDevHub,
  orgLogoutAll,
  orgLogoutDefault,
  orgOpen,
  packageInstall,
  projectDeployStart,
  projectGenerateManifest,
  projectGenerateWithManifest,
  projectRetrieveStart,
  refreshSObjects,
  renameLightningComponent,
  retrieveComponent,
  retrieveManifest,
  retrieveSourcePaths,
  sfProjectGenerate,
  sourceDiff,
  sourceFolderDiff,
  taskStop,
  turnOffLogging,
  turnOnLogging,
  viewAllChanges,
  viewLocalChanges,
  viewRemoteChanges,
  visualforceGenerateComponent,
  visualforceGeneratePage
} from './commands';
import { isvDebugBootstrap } from './commands/isvdebugging';
import { RetrieveMetadataTrigger } from './commands/retrieveMetadata';
import { FlagParameter, SelectFileName, SelectOutputDir, SfCommandlet, SfCommandletExecutor } from './commands/util';

import { CommandEventDispatcher } from './commands/util/commandEventDispatcher';
import { PersistentStorageService, registerConflictView, setupConflictView } from './conflict';
import { ENABLE_SOBJECT_REFRESH_ON_STARTUP, ORG_OPEN_COMMAND } from './constants';
import { WorkspaceContext, workspaceContextUtils } from './context';
import { checkPackageDirectoriesEditorView } from './context/packageDirectoriesContext';
import { decorators, showDemoMode } from './decorators';
import { isDemoMode } from './modes/demoMode';
import { notificationService } from './notifications';
import { orgBrowser } from './orgBrowser';
import { OrgList } from './orgPicker';
import { SalesforceProjectConfig } from './salesforceProject';
import { getCoreLoggerService, registerGetTelemetryServiceCommand } from './services';
import { registerPushOrDeployOnSave, salesforceCoreSettings } from './settings';
import { taskViewService } from './statuses';
import { showTelemetryMessage, telemetryService } from './telemetry';
import { MetricsReporter } from './telemetry/metricsReporter';
import { isCLIInstalled, setNodeExtraCaCerts, setSfLogLevel, setUpOrgExpirationWatcher } from './util';
import { OrgAuthInfo } from './util/authInfo';

const flagIgnoreConflicts: FlagParameter<string> = {
  flag: '--ignore-conflicts'
};

const registerCommands = (extensionContext: vscode.ExtensionContext): vscode.Disposable => {
  // Customer-facing commands
  const orgLoginAccessTokenCmd = vscode.commands.registerCommand('sf.org.login.access.token', orgLoginAccessToken);
  const orgLoginWebCmd = vscode.commands.registerCommand('sf.org.login.web', orgLoginWeb);
  const orgLoginWebDevHubCmd = vscode.commands.registerCommand('sf.org.login.web.dev.hub', orgLoginWebDevHub);

  const orgLogoutAllCmd = vscode.commands.registerCommand('sf.org.logout.all', orgLogoutAll);

  const orgLogoutDefaultCmd = vscode.commands.registerCommand('sf.org.logout.default', orgLogoutDefault);
  const openDocumentationCmd = vscode.commands.registerCommand('sf.open.documentation', openDocumentation);
  const orgCreateCmd = vscode.commands.registerCommand('sf.org.create', orgCreate);
  const orgOpenCmd = vscode.commands.registerCommand(ORG_OPEN_COMMAND, orgOpen);
  const deleteSourceCmd = vscode.commands.registerCommand('sf.delete.source', deleteSource);
  const deleteSourceCurrentFileCmd = vscode.commands.registerCommand('sf.delete.source.current.file', deleteSource);
  const deployCurrentSourceFileCmd = vscode.commands.registerCommand(
    'sf.deploy.current.source.file',
    deploySourcePaths
  );
  const deployInManifestCmd = vscode.commands.registerCommand('sf.deploy.in.manifest', deployManifest);
  const deployMultipleSourcePathsCmd = vscode.commands.registerCommand(
    'sf.deploy.multiple.source.paths',
    deploySourcePaths
  );
  const deploySourcePathCmd = vscode.commands.registerCommand('sf.deploy.source.path', deploySourcePaths);
  const projectRetrieveStartCmd = vscode.commands.registerCommand('sf.project.retrieve.start', projectRetrieveStart);
  const projectDeployStartCmd = vscode.commands.registerCommand(
    'sf.project.deploy.start',
    async (isDeployOnSave: boolean) => projectDeployStart(isDeployOnSave, false)
  );
  const projectRetrieveStartIgnoreConflictsCmd = vscode.commands.registerCommand(
    'sf.project.retrieve.start.ignore.conflicts',
    projectRetrieveStart,
    flagIgnoreConflicts
  );
  const projectDeployStartIgnoreConflictsCmd = vscode.commands.registerCommand(
    'sf.project.deploy.start.ignore.conflicts',
    async (isDeployOnSave: boolean) => projectDeployStart(isDeployOnSave, true)
  );
  const retrieveCmd = vscode.commands.registerCommand('sf.retrieve.source.path', retrieveSourcePaths);
  const retrieveCurrentFileCmd = vscode.commands.registerCommand(
    'sf.retrieve.current.source.file',
    retrieveSourcePaths
  );
  const retrieveInManifestCmd = vscode.commands.registerCommand('sf.retrieve.in.manifest', retrieveManifest);
  const forceSourceStatusCmd = vscode.commands.registerCommand('sf.view.all.changes', viewAllChanges);
  const forceSourceStatusLocalCmd = vscode.commands.registerCommand('sf.view.local.changes', viewLocalChanges);
  const forceSourceStatusRemoteCmd = vscode.commands.registerCommand('sf.view.remote.changes', viewRemoteChanges);
  const taskStopCmd = vscode.commands.registerCommand('sf.task.stop', taskStop);
  const apexGenerateClassCmd = vscode.commands.registerCommand('sf.apex.generate.class', apexGenerateClass);
  const apexGenerateUnitTestClassCmd = vscode.commands.registerCommand(
    'sf.apex.generate.unit.test.class',
    apexGenerateUnitTestClass
  );
  const analyticsGenerateTemplateCmd = vscode.commands.registerCommand(
    'sf.analytics.generate.template',
    analyticsGenerateTemplate
  );
  const visualforceGenerateComponentCmd = vscode.commands.registerCommand(
    'sf.visualforce.generate.component',
    visualforceGenerateComponent
  );
  const visualforceGeneratePageCmd = vscode.commands.registerCommand(
    'sf.visualforce.generate.page',
    visualforceGeneratePage
  );

  const lightningGenerateAppCmd = vscode.commands.registerCommand('sf.lightning.generate.app', lightningGenerateApp);

  const lightningGenerateAuraComponentCmd = vscode.commands.registerCommand(
    'sf.lightning.generate.aura.component',
    lightningGenerateAuraComponent
  );

  const lightningGenerateEventCmd = vscode.commands.registerCommand(
    'sf.lightning.generate.event',
    lightningGenerateEvent
  );

  const lightningGenerateInterfaceCmd = vscode.commands.registerCommand(
    'sf.lightning.generate.interface',
    lightningGenerateInterface
  );

  const lightningGenerateLwcCmd = vscode.commands.registerCommand('sf.lightning.generate.lwc', lightningGenerateLwc);

  const debuggerStopCmd = vscode.commands.registerCommand('sf.debugger.stop', debuggerStop);
  const configListCmd = vscode.commands.registerCommand('sf.config.list', configList);
  const forceAliasListCmd = vscode.commands.registerCommand('sf.alias.list', aliasList);
  const orgDeleteDefaultCmd = vscode.commands.registerCommand('sf.org.delete.default', orgDelete);
  const orgDeleteUsernameCmd = vscode.commands.registerCommand('sf.org.delete.username', orgDelete, {
    flag: '--target-org'
  });
  const orgDisplayDefaultCmd = vscode.commands.registerCommand('sf.org.display.default', orgDisplay);
  const orgDisplayUsernameCmd = vscode.commands.registerCommand('sf.org.display.username', orgDisplay, {
    flag: '--target-org'
  });
  const orgListCleanCmd = vscode.commands.registerCommand('sf.org.list.clean', orgList);
  const dataQueryInputCmd = vscode.commands.registerCommand('sf.data.query.input', dataQuery);
  const dataQuerySelectionCmd = vscode.commands.registerCommand('sf.data.query.selection', dataQuery);
  const projectGenerateCmd = vscode.commands.registerCommand('sf.project.generate', sfProjectGenerate);

  const packageInstallCmd = vscode.commands.registerCommand('sf.package.install', packageInstall);
  const projectGenerateWithManifestCmd = vscode.commands.registerCommand(
    'sf.project.generate.with.manifest',
    projectGenerateWithManifest
  );

  const apexGenerateTriggerCmd = vscode.commands.registerCommand('sf.apex.generate.trigger', apexGenerateTrigger);

  const startApexDebugLoggingCmd = vscode.commands.registerCommand('sf.start.apex.debug.logging', () =>
    turnOnLogging(extensionContext)
  );

  const stopApexDebugLoggingCmd = vscode.commands.registerCommand('sf.stop.apex.debug.logging', () =>
    turnOffLogging(extensionContext)
  );

  const isvDebugBootstrapCmd = vscode.commands.registerCommand('sf.debug.isv.bootstrap', isvDebugBootstrap);

  const configSetCmd = vscode.commands.registerCommand('sf.config.set', configSet);

  const diffFile = vscode.commands.registerCommand('sf.diff', sourceDiff);

  const diffFolder = vscode.commands.registerCommand('sf.folder.diff', sourceFolderDiff);

  const forceRefreshSObjectsCmd = vscode.commands.registerCommand('sf.internal.refreshsobjects', refreshSObjects);

  const renameLightningComponentCmd = vscode.commands.registerCommand(
    'sf.rename.lightning.component',
    renameLightningComponent
  );

  const getCoreLoggerServiceCmd = vscode.commands.registerCommand(
    'sf.vscode.core.logger.get.instance',
    getCoreLoggerService
  );

  const getTelemetryServiceForKeyCmd = registerGetTelemetryServiceCommand();

  return vscode.Disposable.from(
    renameLightningComponentCmd,
    diffFolder,
    orgLoginAccessTokenCmd,
    dataQueryInputCmd,
    dataQuerySelectionCmd,
    diffFile,
    openDocumentationCmd,
    orgCreateCmd,
    orgDeleteDefaultCmd,
    orgDeleteUsernameCmd,
    forceRefreshSObjectsCmd,
    deleteSourceCmd,
    deleteSourceCurrentFileCmd,
    deployCurrentSourceFileCmd,
    deployInManifestCmd,
    deployMultipleSourcePathsCmd,
    deploySourcePathCmd,
    projectDeployStartCmd,
    projectDeployStartIgnoreConflictsCmd,
    projectRetrieveStartCmd,
    projectRetrieveStartIgnoreConflictsCmd,
    retrieveCmd,
    retrieveCurrentFileCmd,
    retrieveInManifestCmd,
    forceSourceStatusCmd,
    forceSourceStatusLocalCmd,
    forceSourceStatusRemoteCmd,
    taskStopCmd,
    apexGenerateClassCmd,
    apexGenerateUnitTestClassCmd,
    analyticsGenerateTemplateCmd,
    visualforceGenerateComponentCmd,
    visualforceGeneratePageCmd,
    lightningGenerateAppCmd,
    lightningGenerateAuraComponentCmd,
    lightningGenerateEventCmd,
    lightningGenerateInterfaceCmd,
    lightningGenerateLwcCmd,
    debuggerStopCmd,
    configListCmd,
    forceAliasListCmd,
    orgDisplayDefaultCmd,
    orgDisplayUsernameCmd,
    projectGenerateCmd,
    packageInstallCmd,
    projectGenerateWithManifestCmd,
    apexGenerateTriggerCmd,
    startApexDebugLoggingCmd,
    stopApexDebugLoggingCmd,
    isvDebugBootstrapCmd,
    configSetCmd,
    orgListCleanCmd,
    orgLoginWebCmd,
    orgLoginWebDevHubCmd,
    orgLogoutAllCmd,
    orgLogoutDefaultCmd,
    orgOpenCmd,
    getCoreLoggerServiceCmd,
    getTelemetryServiceForKeyCmd
  );
};

const registerInternalDevCommands = (): vscode.Disposable => {
  const internalLightningGenerateAppCmd = vscode.commands.registerCommand(
    'sf.internal.lightning.generate.app',
    internalLightningGenerateApp
  );

  const internalLightningGenerateAuraComponentCmd = vscode.commands.registerCommand(
    'sf.internal.lightning.generate.aura.component',
    internalLightningGenerateAuraComponent
  );

  const internalLightningGenerateEventCmd = vscode.commands.registerCommand(
    'sf.internal.lightning.generate.event',
    internalLightningGenerateEvent
  );

  const internalLightningGenerateInterfaceCmd = vscode.commands.registerCommand(
    'sf.internal.lightning.generate.interface',
    internalLightningGenerateInterface
  );

  const internalLightningGenerateLwcCmd = vscode.commands.registerCommand(
    'sf.internal.lightning.generate.lwc',
    internalLightningGenerateLwc
  );

  return vscode.Disposable.from(
    internalLightningGenerateAuraComponentCmd,
    internalLightningGenerateLwcCmd,
    internalLightningGenerateAppCmd,
    internalLightningGenerateEventCmd,
    internalLightningGenerateInterfaceCmd
  );
};

const registerOrgPickerCommands = (orgListParam: OrgList): vscode.Disposable => {
  const setDefaultOrgCmd = vscode.commands.registerCommand('sf.set.default.org', () => orgListParam.setDefaultOrg());
  return vscode.Disposable.from(setDefaultOrgCmd);
};

const setupOrgBrowser = async (extensionContext: vscode.ExtensionContext): Promise<void> => {
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

  vscode.commands.registerCommand('sf.project.generate.manifest', projectGenerateManifest);
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

  // Task View
  const treeDataProvider = vscode.window.registerTreeDataProvider('sf.tasks.view', taskViewService);
  extensionContext.subscriptions.push(treeDataProvider);

  // Set internal dev context
  const internalDev = salesforceCoreSettings.getInternalDev();

  void vscode.commands.executeCommand('setContext', 'sf:internal_dev', internalDev);

  if (internalDev) {
    // Internal Dev commands
    const internalCommands = registerInternalDevCommands();
    extensionContext.subscriptions.push(internalCommands);

    // Api
    const internalApi: any = {
      channelService,
      isCLIInstalled,
      notificationService,
      OrgAuthInfo,
      ProgressNotification,
      SfCommandlet,
      SfCommandletExecutor,
      salesforceCoreSettings,
      SfWorkspaceChecker,
      telemetryService
    };

    telemetryService.sendExtensionActivationEvent(activationStartTime);
    MetricsReporter.extensionPackStatus();
    console.log('SF CLI Extension Activated (internal dev mode)');
    return internalApi;
  }

  // Context
  const salesforceProjectOpened = (await isSalesforceProjectOpened()).result;

  // TODO: move this and the replay debugger commands to the apex extension
  let replayDebuggerExtensionInstalled = false;
  if (vscode.extensions.getExtension('salesforce.salesforcedx-vscode-apex-replay-debugger')) {
    replayDebuggerExtensionInstalled = true;
  }
  void vscode.commands.executeCommand('setContext', 'sf:replay_debugger_extension', replayDebuggerExtensionInstalled);

  void vscode.commands.executeCommand('setContext', 'sf:project_opened', salesforceProjectOpened);

  // Set initial context
  await checkPackageDirectoriesEditorView();

  // Register editor change listener
  const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(async () => {
    await checkPackageDirectoriesEditorView();
  });

  // Add to subscriptions
  extensionContext.subscriptions.push(editorChangeDisposable);

  if (salesforceProjectOpened) {
    await initializeProject(extensionContext);
  }

  // Commands
  const commands = registerCommands(extensionContext);
  extensionContext.subscriptions.push(commands);
  extensionContext.subscriptions.push(registerConflictView());
  extensionContext.subscriptions.push(CommandEventDispatcher.getInstance());

  const api: SalesforceVSCodeCoreApi = {
    channelService,
    getTargetOrgOrAlias: workspaceContextUtils.getTargetOrgOrAlias,
    getUserId: OrgAuthInfo.getUserId,
    isCLIInstalled,
    notificationService,
    OrgAuthInfo,
    ProgressNotification,
    SelectFileName,
    SelectOutputDir,
    SfCommandlet,
    SfCommandletExecutor,
    salesforceCoreSettings,
    SfWorkspaceChecker,
    WorkspaceContext,
    taskViewService,
    telemetryService,
    services: {
      RegistryAccess,
      ChannelService,
      SalesforceProjectConfig,
      TelemetryService,
      WorkspaceContext,
      CommandEventDispatcher
    }
  };

  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    // Refresh SObject definitions if there aren't any faux classes
    const sobjectRefreshStartup: boolean = vscode.workspace
      .getConfiguration(SFDX_CORE_CONFIGURATION_NAME)
      .get<boolean>(ENABLE_SOBJECT_REFRESH_ON_STARTUP, false);

    await initSObjectDefinitions(vscode.workspace.workspaceFolders[0].uri.fsPath, sobjectRefreshStartup);
  }

  void activateTracker.markActivationStop();
  MetricsReporter.extensionPackStatus();

  // Handle trace flag cleanup after setting target org
  try {
    const connection = await WorkspaceContextUtil.getInstance().getConnection();

    const traceFlags = new TraceFlags(connection);
    await traceFlags.handleTraceFlagCleanup(extensionContext);
  } catch (error) {
    console.log('Trace flag cleanup not completed during activation of CLI Integration extension', error);
  }

  console.log('SF CLI Extension Activated');
  handleTheUnhandled();
  return api;
};

const initializeProject = async (extensionContext: vscode.ExtensionContext) => {
  await WorkspaceContext.getInstance().initialize(extensionContext);

  // Register org picker commands
  const newOrgList = new OrgList();
  extensionContext.subscriptions.push(registerOrgPickerCommands(newOrgList));

  await setupOrgBrowser(extensionContext);
  await setupConflictView(extensionContext);

  PersistentStorageService.initialize(extensionContext);

  // Register file watcher for push or deploy on save
  registerPushOrDeployOnSave();
  await decorators.showOrg();

  await setUpOrgExpirationWatcher(newOrgList);

  // Demo mode decorator
  if (isDemoMode()) {
    showDemoMode();
  }
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
  getUserId: typeof OrgAuthInfo.getUserId;
  isCLIInstalled: typeof isCLIInstalled;
  notificationService: typeof notificationService;
  OrgAuthInfo: typeof OrgAuthInfo;
  ProgressNotification: typeof ProgressNotification;
  SelectFileName: typeof SelectFileName;
  SelectOutputDir: typeof SelectOutputDir;
  SfCommandlet: typeof SfCommandlet;
  SfCommandletExecutor: typeof SfCommandletExecutor;
  salesforceCoreSettings: typeof salesforceCoreSettings;
  SfWorkspaceChecker: typeof SfWorkspaceChecker;
  WorkspaceContext: typeof WorkspaceContext;
  taskViewService: typeof taskViewService;
  telemetryService: typeof telemetryService;
  services: {
    RegistryAccess: typeof RegistryAccess;
    ChannelService: typeof ChannelService;
    SalesforceProjectConfig: typeof SalesforceProjectConfig;
    TelemetryService: typeof TelemetryService;
    WorkspaceContext: typeof WorkspaceContext;
    CommandEventDispatcher: typeof CommandEventDispatcher;
  };
};
