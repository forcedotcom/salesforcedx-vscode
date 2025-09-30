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
import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
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
import { isvDebugBootstrap } from './commands/isvdebugging/bootstrapCmd';
import { RetrieveMetadataTrigger } from './commands/retrieveMetadata';
import { SelectFileName, SelectOutputDir, SfCommandlet, SfCommandletExecutor } from './commands/util';

import { CommandEventDispatcher } from './commands/util/commandEventDispatcher';
import { PersistentStorageService, registerConflictView, setupConflictView } from './conflict';
import { ENABLE_SOBJECT_REFRESH_ON_STARTUP, ORG_OPEN_COMMAND } from './constants';
import { WorkspaceContext, workspaceContextUtils } from './context';
import { checkPackageDirectoriesEditorView } from './context/packageDirectoriesContext';
import { decorators } from './decorators';
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

/** Customer-facing commands */
const registerCommands = (extensionContext: vscode.ExtensionContext): vscode.Disposable =>
  vscode.Disposable.from(
    vscode.commands.registerCommand('sf.rename.lightning.component', renameLightningComponent),
    vscode.commands.registerCommand('sf.folder.diff', sourceFolderDiff),
    vscode.commands.registerCommand('sf.org.login.access.token', orgLoginAccessToken),
    vscode.commands.registerCommand('sf.data.query.input', dataQuery),
    vscode.commands.registerCommand('sf.data.query.selection', dataQuery),
    vscode.commands.registerCommand('sf.diff', sourceDiff),
    vscode.commands.registerCommand('sf.open.documentation', openDocumentation),
    vscode.commands.registerCommand('sf.org.create', orgCreate),
    vscode.commands.registerCommand('sf.org.delete.default', orgDelete),
    vscode.commands.registerCommand('sf.org.delete.username', orgDelete, {
      flag: '--target-org'
    }),
    vscode.commands.registerCommand('sf.internal.refreshsobjects', refreshSObjects),
    vscode.commands.registerCommand('sf.delete.source', deleteSource),
    vscode.commands.registerCommand('sf.delete.source.current.file', deleteSource),
    vscode.commands.registerCommand('sf.deploy.current.source.file', deploySourcePaths),
    vscode.commands.registerCommand('sf.deploy.in.manifest', deployManifest),
    vscode.commands.registerCommand('sf.deploy.multiple.source.paths', deploySourcePaths),
    vscode.commands.registerCommand('sf.deploy.source.path', deploySourcePaths),
    vscode.commands.registerCommand('sf.project.deploy.start', async (isDeployOnSave: boolean) =>
      projectDeployStart(isDeployOnSave, false)
    ),
    vscode.commands.registerCommand('sf.project.deploy.start.ignore.conflicts', async (isDeployOnSave: boolean) =>
      projectDeployStart(isDeployOnSave, true)
    ),
    vscode.commands.registerCommand('sf.project.retrieve.start', projectRetrieveStart),
    vscode.commands.registerCommand('sf.project.retrieve.start.ignore.conflicts', () => projectRetrieveStart(true)),
    vscode.commands.registerCommand('sf.retrieve.source.path', retrieveSourcePaths),
    vscode.commands.registerCommand('sf.retrieve.current.source.file', retrieveSourcePaths),
    vscode.commands.registerCommand('sf.retrieve.in.manifest', retrieveManifest),
    vscode.commands.registerCommand('sf.view.all.changes', viewAllChanges),
    vscode.commands.registerCommand('sf.view.local.changes', viewLocalChanges),
    vscode.commands.registerCommand('sf.view.remote.changes', viewRemoteChanges),
    vscode.commands.registerCommand('sf.task.stop', taskStop),
    vscode.commands.registerCommand('sf.apex.generate.class', apexGenerateClass),
    vscode.commands.registerCommand('sf.apex.generate.unit.test.class', apexGenerateUnitTestClass),
    vscode.commands.registerCommand('sf.analytics.generate.template', analyticsGenerateTemplate),
    vscode.commands.registerCommand('sf.visualforce.generate.component', visualforceGenerateComponent),
    vscode.commands.registerCommand('sf.visualforce.generate.page', visualforceGeneratePage),
    vscode.commands.registerCommand('sf.lightning.generate.app', lightningGenerateApp),
    vscode.commands.registerCommand('sf.lightning.generate.aura.component', lightningGenerateAuraComponent),
    vscode.commands.registerCommand('sf.lightning.generate.event', lightningGenerateEvent),
    vscode.commands.registerCommand('sf.lightning.generate.interface', lightningGenerateInterface),
    vscode.commands.registerCommand('sf.lightning.generate.lwc', lightningGenerateLwc),
    vscode.commands.registerCommand('sf.debugger.stop', debuggerStop),
    vscode.commands.registerCommand('sf.config.list', configList),
    vscode.commands.registerCommand('sf.alias.list', aliasList),
    vscode.commands.registerCommand('sf.org.display.default', orgDisplay),
    vscode.commands.registerCommand('sf.org.display.username', orgDisplay, {
      flag: '--target-org'
    }),
    vscode.commands.registerCommand('sf.project.generate', sfProjectGenerate),
    vscode.commands.registerCommand('sf.package.install', packageInstall),
    vscode.commands.registerCommand('sf.project.generate.with.manifest', projectGenerateWithManifest),
    vscode.commands.registerCommand('sf.apex.generate.trigger', apexGenerateTrigger),
    vscode.commands.registerCommand('sf.start.apex.debug.logging', () => turnOnLogging(extensionContext)),
    vscode.commands.registerCommand('sf.stop.apex.debug.logging', () => turnOffLogging(extensionContext)),
    vscode.commands.registerCommand('sf.debug.isv.bootstrap', isvDebugBootstrap),
    vscode.commands.registerCommand('sf.config.set', configSet),
    vscode.commands.registerCommand('sf.org.list.clean', orgList),
    vscode.commands.registerCommand('sf.org.login.web', orgLoginWeb),
    vscode.commands.registerCommand('sf.org.login.web.dev.hub', orgLoginWebDevHub),
    vscode.commands.registerCommand('sf.org.logout.all', orgLogoutAll),
    vscode.commands.registerCommand('sf.org.logout.default', orgLogoutDefault),
    vscode.commands.registerCommand(ORG_OPEN_COMMAND, orgOpen),
    vscode.commands.registerCommand('sf.vscode.core.logger.get.instance', getCoreLoggerService),
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

  if (internalDev) {
    // Internal Dev commands
    extensionContext.subscriptions.push(registerInternalDevCommands());

    telemetryService.sendExtensionActivationEvent(activationStartTime);
    MetricsReporter.extensionPackStatus();
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

  // Set initial context
  await checkPackageDirectoriesEditorView();

  if (salesforceProjectOpened) {
    await initializeProject(extensionContext);
  }

  extensionContext.subscriptions.push(
    registerCommands(extensionContext),
    // Register editor change listener
    vscode.window.onDidChangeActiveTextEditor(async () => {
      await checkPackageDirectoriesEditorView();
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
  MetricsReporter.extensionPackStatus();

  // Handle trace flag cleanup after setting target org
  try {
    const connection = await WorkspaceContextUtil.getInstance().getConnection();
    await new TraceFlags(connection).handleTraceFlagCleanup(extensionContext);
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
