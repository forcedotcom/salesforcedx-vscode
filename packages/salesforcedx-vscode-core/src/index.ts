/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ensureCurrentWorkingDirIsProjectPath } from '@salesforce/salesforcedx-utils';
import {
  getRootWorkspacePath,
  SFDX_CORE_CONFIGURATION_NAME
} from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { channelService } from './channels';
import {
  checkSObjectsAndRefresh,
  forceAliasList,
  forceAnalyticsTemplateCreate,
  forceApexClassCreate,
  forceApexTriggerCreate,
  forceAuthAccessToken,
  forceAuthDevHub,
  forceAuthLogoutAll,
  forceAuthLogoutDefault,
  forceAuthWebLogin,
  forceConfigList,
  forceConfigSet,
  forceCreateManifest,
  forceDataSoqlQuery,
  forceDebuggerStop,
  forceFunctionContainerlessStartCommand,
  forceFunctionCreate,
  forceFunctionDebugInvoke,
  forceFunctionInvoke,
  forceFunctionStop,
  forceInternalLightningAppCreate,
  forceInternalLightningComponentCreate,
  forceInternalLightningEventCreate,
  forceInternalLightningInterfaceCreate,
  forceInternalLightningLwcCreate,
  forceLightningAppCreate,
  forceLightningComponentCreate,
  forceLightningEventCreate,
  forceLightningInterfaceCreate,
  forceLightningLwcCreate,
  forceLightningLwcTestCreate,
  forceOpenDocumentation,
  forceOrgCreate,
  forceOrgDelete,
  forceOrgDisplay,
  forceOrgList,
  forceOrgOpen,
  forcePackageInstall,
  forceProjectWithManifestCreate,
  forceRefreshSObjects,
  forceRenameLightningComponent,
  forceSfdxProjectCreate,
  forceSourceDelete,
  forceSourceDeployManifest,
  forceSourceDeploySourcePaths,
  forceSourceDiff,
  forceSourceFolderDiff,
  forceSourcePull,
  forceSourcePush,
  forceSourceRetrieveCmp,
  forceSourceRetrieveManifest,
  forceSourceRetrieveSourcePaths,
  forceSourceStatus,
  forceStartApexDebugLogging,
  forceStopApexDebugLogging,
  forceTaskStop,
  forceVisualforceComponentCreate,
  forceVisualforcePageCreate,
  initSObjectDefinitions,
  registerFunctionInvokeCodeLensProvider,
  SourceStatusFlags,
  turnOffLogging
} from './commands';
import { RetrieveMetadataTrigger } from './commands/forceSourceRetrieveMetadata';
import { getUserId } from './commands/forceStartApexDebugLogging';
import { FunctionService } from './commands/functions/functionService';
import { isvDebugBootstrap } from './commands/isvdebugging';
import {
  CompositeParametersGatherer,
  EmptyParametersGatherer,
  FlagParameter,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands/util';
import {
  PersistentStorageService,
  registerConflictView,
  setupConflictView
} from './conflict';
import {
  ENABLE_SOBJECT_REFRESH_ON_STARTUP,
  ORG_OPEN_COMMAND
} from './constants';
import { WorkspaceContext, workspaceContextUtils } from './context';
import {
  decorators,
  disposeTraceFlagExpiration,
  showDemoMode
} from './decorators';
import { isDemoMode } from './modes/demo-mode';
import { notificationService, ProgressNotification } from './notifications';
import { orgBrowser } from './orgBrowser';
import { OrgList } from './orgPicker';
import { isSfdxProjectOpened } from './predicates';
import { registerPushOrDeployOnSave, sfdxCoreSettings } from './settings';
import { taskViewService } from './statuses';
import { showTelemetryMessage, telemetryService } from './telemetry';
import { isCLIInstalled, setUpOrgExpirationWatcher } from './util';
import { OrgAuthInfo } from './util/authInfo';

const flagOverwrite: FlagParameter<string> = {
  flag: '--forceoverwrite'
};
const flagStatusLocal: FlagParameter<SourceStatusFlags> = {
  flag: SourceStatusFlags.Local
};
const flagStatusRemote: FlagParameter<SourceStatusFlags> = {
  flag: SourceStatusFlags.Remote
};

function registerCommands(
  extensionContext: vscode.ExtensionContext
): vscode.Disposable {
  // Customer-facing commands
  const forceAuthAccessTokenCmd = vscode.commands.registerCommand(
    'sfdx.force.auth.accessToken',
    forceAuthAccessToken
  );
  const forceAuthWebLoginCmd = vscode.commands.registerCommand(
    'sfdx.force.auth.web.login',
    forceAuthWebLogin
  );
  const forceAuthDevHubCmd = vscode.commands.registerCommand(
    'sfdx.force.auth.dev.hub',
    forceAuthDevHub
  );
  const forceAuthLogoutAllCmd = vscode.commands.registerCommand(
    'sfdx.force.auth.logout.all',
    forceAuthLogoutAll
  );
  const forceAuthLogoutDefaultCmd = vscode.commands.registerCommand(
    'sfdx.force.auth.logout.default',
    forceAuthLogoutDefault
  );
  const forceOpenDocumentationCmd = vscode.commands.registerCommand(
    'sfdx.force.open.documentation',
    forceOpenDocumentation
  );
  const forceOrgCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.org.create',
    forceOrgCreate
  );
  const forceOrgOpenCmd = vscode.commands.registerCommand(
    ORG_OPEN_COMMAND,
    forceOrgOpen
  );
  const forceSourceDeleteCmd = vscode.commands.registerCommand(
    'sfdx.force.source.delete',
    forceSourceDelete
  );
  const forceSourceDeleteCurrentFileCmd = vscode.commands.registerCommand(
    'sfdx.force.source.delete.current.file',
    forceSourceDelete
  );
  const forceSourceDeployCurrentSourceFileCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.current.source.file',
    forceSourceDeploySourcePaths
  );
  const forceSourceDeployInManifestCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.in.manifest',
    forceSourceDeployManifest
  );
  const forceSourceDeployMultipleSourcePathsCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.multiple.source.paths',
    forceSourceDeploySourcePaths
  );
  const forceSourceDeploySourcePathCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.source.path',
    forceSourceDeploySourcePaths
  );
  const forceSourcePullCmd = vscode.commands.registerCommand(
    'sfdx.force.source.pull',
    forceSourcePull
  );
  const forceSourcePullForceCmd = vscode.commands.registerCommand(
    'sfdx.force.source.pull.force',
    forceSourcePull,
    flagOverwrite
  );
  const forceSourcePushCmd = vscode.commands.registerCommand(
    'sfdx.force.source.push',
    forceSourcePush
  );
  const forceSourcePushForceCmd = vscode.commands.registerCommand(
    'sfdx.force.source.push.force',
    forceSourcePush,
    flagOverwrite
  );
  const forceSourceRetrieveCmd = vscode.commands.registerCommand(
    'sfdx.force.source.retrieve.source.path',
    forceSourceRetrieveSourcePaths
  );
  const forceSourceRetrieveCurrentFileCmd = vscode.commands.registerCommand(
    'sfdx.force.source.retrieve.current.source.file',
    forceSourceRetrieveSourcePaths
  );
  const forceSourceRetrieveInManifestCmd = vscode.commands.registerCommand(
    'sfdx.force.source.retrieve.in.manifest',
    forceSourceRetrieveManifest
  );
  const forceSourceStatusCmd = vscode.commands.registerCommand(
    'sfdx.force.source.status',
    forceSourceStatus
  );
  const forceSourceStatusLocalCmd = vscode.commands.registerCommand(
    'sfdx.force.source.status.local',
    forceSourceStatus,
    flagStatusLocal
  );
  const forceSourceStatusRemoteCmd = vscode.commands.registerCommand(
    'sfdx.force.source.status.remote',
    forceSourceStatus,
    flagStatusRemote
  );
  const forceTaskStopCmd = vscode.commands.registerCommand(
    'sfdx.force.task.stop',
    forceTaskStop
  );
  const forceApexClassCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.class.create',
    forceApexClassCreate
  );
  const forceAnalyticsTemplateCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.analytics.template.create',
    forceAnalyticsTemplateCreate
  );
  const forceVisualforceComponentCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.visualforce.component.create',
    forceVisualforceComponentCreate
  );
  const forceVisualforcePageCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.visualforce.page.create',
    forceVisualforcePageCreate
  );

  const forceLightningAppCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.app.create',
    forceLightningAppCreate
  );

  const forceLightningComponentCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.component.create',
    forceLightningComponentCreate
  );

  const forceLightningEventCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.event.create',
    forceLightningEventCreate
  );

  const forceLightningInterfaceCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.interface.create',
    forceLightningInterfaceCreate
  );

  const forceLightningLwcCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.lwc.create',
    forceLightningLwcCreate
  );

  const forceLightningLwcTestCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.lwc.test.create',
    forceLightningLwcTestCreate
  );

  const forceDebuggerStopCmd = vscode.commands.registerCommand(
    'sfdx.force.debugger.stop',
    forceDebuggerStop
  );
  const forceConfigListCmd = vscode.commands.registerCommand(
    'sfdx.force.config.list',
    forceConfigList
  );
  const forceAliasListCmd = vscode.commands.registerCommand(
    'sfdx.force.alias.list',
    forceAliasList
  );
  const forceOrgDeleteDefaultCmd = vscode.commands.registerCommand(
    'sfdx.force.org.delete.default',
    forceOrgDelete
  );
  const forceOrgDeleteUsernameCmd = vscode.commands.registerCommand(
    'sfdx.force.org.delete.username',
    forceOrgDelete,
    { flag: '--targetusername' }
  );
  const forceOrgDisplayDefaultCmd = vscode.commands.registerCommand(
    'sfdx.force.org.display.default',
    forceOrgDisplay
  );
  const forceOrgDisplayUsernameCmd = vscode.commands.registerCommand(
    'sfdx.force.org.display.username',
    forceOrgDisplay,
    { flag: '--targetusername' }
  );
  const forceOrgListCleanCmd = vscode.commands.registerCommand(
    'sfdx.force.org.list.clean',
    forceOrgList
  );
  const forceDataSoqlQueryInputCmd = vscode.commands.registerCommand(
    'sfdx.force.data.soql.query.input',
    forceDataSoqlQuery
  );
  const forceDataSoqlQuerySelectionCmd = vscode.commands.registerCommand(
    'sfdx.force.data.soql.query.selection',
    forceDataSoqlQuery
  );
  const forceProjectCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.project.create',
    forceSfdxProjectCreate
  );

  const forcePackageInstallCmd = vscode.commands.registerCommand(
    'sfdx.force.package.install',
    forcePackageInstall
  );
  const forceProjectWithManifestCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.project.with.manifest.create',
    forceProjectWithManifestCreate
  );

  const forceApexTriggerCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.trigger.create',
    forceApexTriggerCreate
  );

  const forceStartApexDebugLoggingCmd = vscode.commands.registerCommand(
    'sfdx.force.start.apex.debug.logging',
    forceStartApexDebugLogging
  );

  const forceStopApexDebugLoggingCmd = vscode.commands.registerCommand(
    'sfdx.force.stop.apex.debug.logging',
    forceStopApexDebugLogging
  );

  const isvDebugBootstrapCmd = vscode.commands.registerCommand(
    'sfdx.debug.isv.bootstrap',
    isvDebugBootstrap
  );

  const forceConfigSetCmd = vscode.commands.registerCommand(
    'sfdx.force.config.set',
    forceConfigSet
  );

  const forceDiffFile = vscode.commands.registerCommand(
    'sfdx.force.diff',
    forceSourceDiff
  );

  const forceDiffFolder = vscode.commands.registerCommand(
    'sfdx.force.folder.diff',
    forceSourceFolderDiff
  );

  const forceFunctionCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.function.create',
    forceFunctionCreate
  );

  const forceFunctionStartCmd = vscode.commands.registerCommand(
    'sfdx.force.function.containerless.start',
    forceFunctionContainerlessStartCommand
  );

  const forceFunctionInvokeCmd = vscode.commands.registerCommand(
    'sfdx.force.function.invoke',
    forceFunctionInvoke
  );

  const forceFunctionDebugInvokeCmd = vscode.commands.registerCommand(
    'sfdx.force.function.debugInvoke',
    forceFunctionDebugInvoke
  );

  const forceFunctionStopCmd = vscode.commands.registerCommand(
    'sfdx.force.function.stop',
    forceFunctionStop
  );

  const forceRefreshSObjectsCmd = vscode.commands.registerCommand(
    'sfdx.force.internal.refreshsobjects',
    forceRefreshSObjects
  );

  const forceRenameComponentCmd = vscode.commands.registerCommand(
    'sfdx.lightning.rename',
    forceRenameLightningComponent
  );

  return vscode.Disposable.from(
    forceAuthAccessTokenCmd,
    forceAuthWebLoginCmd,
    forceAuthDevHubCmd,
    forceAuthLogoutAllCmd,
    forceAuthLogoutDefaultCmd,
    forceDataSoqlQueryInputCmd,
    forceDataSoqlQuerySelectionCmd,
    forceDiffFile,
    forceFunctionCreateCmd,
    forceFunctionInvokeCmd,
    forceFunctionDebugInvokeCmd,
    forceFunctionStartCmd,
    forceFunctionStopCmd,
    forceOpenDocumentationCmd,
    forceOrgCreateCmd,
    forceOrgOpenCmd,
    forceOrgDeleteDefaultCmd,
    forceOrgDeleteUsernameCmd,
    forceOrgListCleanCmd,
    forceRefreshSObjectsCmd,
    forceSourceDeleteCmd,
    forceSourceDeleteCurrentFileCmd,
    forceSourceDeployCurrentSourceFileCmd,
    forceSourceDeployInManifestCmd,
    forceSourceDeployMultipleSourcePathsCmd,
    forceSourceDeploySourcePathCmd,
    forceSourcePullCmd,
    forceSourcePullForceCmd,
    forceSourcePushCmd,
    forceSourcePushForceCmd,
    forceSourceRetrieveCmd,
    forceSourceRetrieveCurrentFileCmd,
    forceSourceRetrieveInManifestCmd,
    forceSourceStatusCmd,
    forceSourceStatusLocalCmd,
    forceSourceStatusRemoteCmd,
    forceTaskStopCmd,
    forceApexClassCreateCmd,
    forceAnalyticsTemplateCreateCmd,
    forceVisualforceComponentCreateCmd,
    forceVisualforcePageCreateCmd,
    forceLightningAppCreateCmd,
    forceLightningComponentCreateCmd,
    forceLightningEventCreateCmd,
    forceLightningInterfaceCreateCmd,
    forceLightningLwcCreateCmd,
    forceLightningLwcTestCreateCmd,
    forceDebuggerStopCmd,
    forceConfigListCmd,
    forceAliasListCmd,
    forceOrgDisplayDefaultCmd,
    forceOrgDisplayUsernameCmd,
    forceProjectCreateCmd,
    forcePackageInstallCmd,
    forceProjectWithManifestCreateCmd,
    forceApexTriggerCreateCmd,
    forceStartApexDebugLoggingCmd,
    forceStopApexDebugLoggingCmd,
    isvDebugBootstrapCmd,
    forceConfigSetCmd
  );
}

function registerInternalDevCommands(
  extensionContext: vscode.ExtensionContext
): vscode.Disposable {
  const forceInternalLightningAppCreateCmd = vscode.commands.registerCommand(
    'sfdx.internal.lightning.app.create',
    forceInternalLightningAppCreate
  );

  const forceInternalLightningComponentCreateCmd = vscode.commands.registerCommand(
    'sfdx.internal.lightning.component.create',
    forceInternalLightningComponentCreate
  );

  const forceInternalLightningEventCreateCmd = vscode.commands.registerCommand(
    'sfdx.internal.lightning.event.create',
    forceInternalLightningEventCreate
  );

  const forceInternalLightningInterfaceCreateCmd = vscode.commands.registerCommand(
    'sfdx.internal.lightning.interface.create',
    forceInternalLightningInterfaceCreate
  );

  const forceInternalLightningLwcCreateCmd = vscode.commands.registerCommand(
    'sfdx.internal.lightning.lwc.create',
    forceInternalLightningLwcCreate
  );

  return vscode.Disposable.from(
    forceInternalLightningComponentCreateCmd,
    forceInternalLightningLwcCreateCmd,
    forceInternalLightningAppCreateCmd,
    forceInternalLightningEventCreateCmd,
    forceInternalLightningInterfaceCreateCmd
  );
}

function registerOrgPickerCommands(orgList: OrgList): vscode.Disposable {
  const forceSetDefaultOrgCmd = vscode.commands.registerCommand(
    'sfdx.force.set.default.org',
    () => orgList.setDefaultOrg()
  );
  return vscode.Disposable.from(forceSetDefaultOrgCmd);
}

async function setupOrgBrowser(
  extensionContext: vscode.ExtensionContext
): Promise<void> {
  await orgBrowser.init(extensionContext);

  vscode.commands.registerCommand(
    'sfdx.force.metadata.view.type.refresh',
    async node => {
      await orgBrowser.refreshAndExpand(node);
    }
  );

  vscode.commands.registerCommand(
    'sfdx.force.metadata.view.component.refresh',
    async node => {
      await orgBrowser.refreshAndExpand(node);
    }
  );

  vscode.commands.registerCommand(
    'sfdx.force.source.retrieve.component',
    async (trigger: RetrieveMetadataTrigger) => {
      await forceSourceRetrieveCmp(trigger);
    }
  );

  vscode.commands.registerCommand(
    'sfdx.force.source.retrieve.open.component',
    async (trigger: RetrieveMetadataTrigger) => {
      await forceSourceRetrieveCmp(trigger, true);
    }
  );

  vscode.commands.registerCommand('sfdx.create.manifest', forceCreateManifest);
}

export async function activate(extensionContext: vscode.ExtensionContext) {
  const extensionHRStart = process.hrtime();
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
  ensureCurrentWorkingDirIsProjectPath(rootWorkspacePath);
  const { name, aiKey, version } = extensionContext.extension.packageJSON;
  await telemetryService.initializeService(
    extensionContext,
    name,
    aiKey,
    version
  );
  showTelemetryMessage(extensionContext);

  // Task View
  const treeDataProvider = vscode.window.registerTreeDataProvider(
    'sfdx.force.tasks.view',
    taskViewService
  );
  extensionContext.subscriptions.push(treeDataProvider);

  // Set internal dev context
  const internalDev = sfdxCoreSettings.getInternalDev();

  vscode.commands.executeCommand(
    'setContext',
    'sfdx:internal_dev',
    internalDev
  );

  if (internalDev) {
    // Internal Dev commands
    const internalCommands = registerInternalDevCommands(extensionContext);
    extensionContext.subscriptions.push(internalCommands);

    // Api
    const internalApi: any = {
      channelService,
      EmptyParametersGatherer,
      isCLIInstalled,
      notificationService,
      OrgAuthInfo,
      ProgressNotification,
      SfdxCommandlet,
      SfdxCommandletExecutor,
      sfdxCoreSettings,
      SfdxWorkspaceChecker,
      telemetryService
    };

    telemetryService.sendExtensionActivationEvent(extensionHRStart);
    console.log('SFDX CLI Extension Activated (internal dev mode)');
    return internalApi;
  }

  FunctionService.instance.handleDidStartTerminateDebugSessions(
    extensionContext
  );

  // Context
  const sfdxProjectOpened = isSfdxProjectOpened.apply(vscode.workspace).result;

  // TODO: move this and the replay debugger commands to the apex extension
  let replayDebuggerExtensionInstalled = false;
  if (
    vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-apex-replay-debugger'
    )
  ) {
    replayDebuggerExtensionInstalled = true;
  }
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:replay_debugger_extension',
    replayDebuggerExtensionInstalled
  );

  vscode.commands.executeCommand(
    'setContext',
    'sfdx:project_opened',
    sfdxProjectOpened
  );

  if (sfdxProjectOpened) {
    await initializeProject(extensionContext);
  }

  // Commands
  const commands = registerCommands(extensionContext);
  extensionContext.subscriptions.push(commands);
  extensionContext.subscriptions.push(registerConflictView());

  const api: any = {
    channelService,
    CompositeParametersGatherer,
    EmptyParametersGatherer,
    getDefaultUsernameOrAlias: workspaceContextUtils.getDefaultUsernameOrAlias,
    getUserId,
    isCLIInstalled,
    notificationService,
    OrgAuthInfo,
    ProgressNotification,
    SelectFileName,
    SelectOutputDir,
    SfdxCommandlet,
    SfdxCommandletExecutor,
    sfdxCoreSettings,
    SfdxWorkspaceChecker,
    WorkspaceContext,
    taskViewService,
    telemetryService
  };

  registerFunctionInvokeCodeLensProvider(extensionContext);

  telemetryService.sendExtensionActivationEvent(extensionHRStart);
  console.log('SFDX CLI Extension Activated');

  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    // Refresh SObject definitions if there aren't any faux classes
    const sobjectRefreshStartup: boolean = vscode.workspace
      .getConfiguration(SFDX_CORE_CONFIGURATION_NAME)
      .get<boolean>(ENABLE_SOBJECT_REFRESH_ON_STARTUP, false);

    if (sobjectRefreshStartup) {
      initSObjectDefinitions(
        vscode.workspace.workspaceFolders[0].uri.fsPath
      ).catch(e => telemetryService.sendException(e.name, e.message));
    } else {
      checkSObjectsAndRefresh(
        vscode.workspace.workspaceFolders[0].uri.fsPath
      ).catch(e => telemetryService.sendException(e.name, e.message));
    }
  }

  return api;
}

async function initializeProject(extensionContext: vscode.ExtensionContext) {
  await WorkspaceContext.getInstance().initialize(extensionContext);

  // Register org picker commands
  const orgList = new OrgList();
  extensionContext.subscriptions.push(registerOrgPickerCommands(orgList));

  await setupOrgBrowser(extensionContext);
  await setupConflictView(extensionContext);

  PersistentStorageService.initialize(extensionContext);

  // Register file watcher for push or deploy on save
  await registerPushOrDeployOnSave();
  await decorators.showOrg();

  await setUpOrgExpirationWatcher(orgList);

  // Demo mode decorator
  if (isDemoMode()) {
    showDemoMode();
  }
}

export function deactivate(): Promise<void> {
  console.log('SFDX CLI Extension Deactivated');

  // Send metric data.
  telemetryService.sendExtensionDeactivationEvent();
  telemetryService.dispose();

  disposeTraceFlagExpiration();
  return turnOffLogging();
}
