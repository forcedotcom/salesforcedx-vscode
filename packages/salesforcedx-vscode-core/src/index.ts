/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { channelService } from './channels';
import {
  forceAliasList,
  forceApexClassCreate,
  forceApexExecute,
  forceApexLogGet,
  forceApexTestRun,
  forceApexTriggerCreate,
  forceAuthDevHub,
  forceAuthLogoutAll,
  forceAuthWebLogin,
  forceConfigList,
  forceConfigSet,
  forceDataSoqlQuery,
  forceDebuggerStop,
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
  forceOrgCreate,
  forceOrgDisplay,
  forceOrgOpen,
  forceProjectWithManifestCreate,
  forceSfdxProjectCreate,
  forceSourceDelete,
  forceSourceDeployManifest,
  forceSourceDeployMultipleSourcePaths,
  forceSourceDeploySourcePath,
  forceSourceDiff,
  forceSourcePull,
  forceSourcePush,
  forceSourceRetrieveCmp,
  forceSourceRetrieveManifest,
  forceSourceRetrieveSourcePath,
  forceSourceStatus,
  forceStartApexDebugLogging,
  forceStopApexDebugLogging,
  forceTaskStop,
  forceVisualforceComponentCreate,
  forceVisualforcePageCreate,
  turnOffLogging
} from './commands';
import { RetrieveMetadataTrigger } from './commands/forceSourceRetrieveMetadata';
import { getUserId } from './commands/forceStartApexDebugLogging';
import { isvDebugBootstrap } from './commands/isvdebugging/bootstrapCmd';
import {
  CompositeParametersGatherer,
  CompositePreconditionChecker,
  EmptyParametersGatherer,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands/util';
import { getDefaultUsernameOrAlias, setupWorkspaceOrgType } from './context';
import * as decorators from './decorators';
import { isDemoMode } from './modes/demo-mode';
import { notificationService, ProgressNotification } from './notifications';
import { orgBrowser } from './orgBrowser';
import { OrgList } from './orgPicker';
import { registerPushOrDeployOnSave, sfdxCoreSettings } from './settings';
import { taskViewService } from './statuses';
import { telemetryService } from './telemetry';
import {
  hasRootWorkspace,
  isCLIInstalled,
  showCLINotInstalledMessage
} from './util';
import { OrgAuthInfo } from './util/authInfo';

function registerCommands(
  extensionContext: vscode.ExtensionContext
): vscode.Disposable {
  // Customer-facing commands
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
  const forceOrgCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.org.create',
    forceOrgCreate
  );
  const forceOrgOpenCmd = vscode.commands.registerCommand(
    'sfdx.force.org.open',
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
    forceSourceDeploySourcePath
  );
  const forceSourceDeployInManifestCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.in.manifest',
    forceSourceDeployManifest
  );
  const forceSourceDeployMultipleSourcePathsCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.multiple.source.paths',
    forceSourceDeployMultipleSourcePaths
  );
  const forceSourceDeploySourcePathCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.source.path',
    forceSourceDeploySourcePath
  );
  const forceSourcePullCmd = vscode.commands.registerCommand(
    'sfdx.force.source.pull',
    forceSourcePull
  );
  const forceSourcePullForceCmd = vscode.commands.registerCommand(
    'sfdx.force.source.pull.force',
    forceSourcePull,
    { flag: '--forceoverwrite' }
  );
  const forceSourcePushCmd = vscode.commands.registerCommand(
    'sfdx.force.source.push',
    forceSourcePush
  );
  const forceSourcePushForceCmd = vscode.commands.registerCommand(
    'sfdx.force.source.push.force',
    forceSourcePush,
    { flag: '--forceoverwrite' }
  );
  const forceSourceRetrieveCmd = vscode.commands.registerCommand(
    'sfdx.force.source.retrieve.source.path',
    forceSourceRetrieveSourcePath
  );
  const forceSourceRetrieveCurrentFileCmd = vscode.commands.registerCommand(
    'sfdx.force.source.retrieve.current.source.file',
    forceSourceRetrieveSourcePath
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
    { flag: '--local' }
  );
  const forceSourceStatusRemoteCmd = vscode.commands.registerCommand(
    'sfdx.force.source.status.remote',
    forceSourceStatus,
    { flag: '--remote' }
  );
  const forceApexTestRunCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.run',
    forceApexTestRun
  );

  const forceTaskStopCmd = vscode.commands.registerCommand(
    'sfdx.force.task.stop',
    forceTaskStop
  );
  const forceApexClassCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.class.create',
    forceApexClassCreate
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
  const forceOrgDisplayDefaultCmd = vscode.commands.registerCommand(
    'sfdx.force.org.display.default',
    forceOrgDisplay
  );
  const forceOrgDisplayUsernameCmd = vscode.commands.registerCommand(
    'sfdx.force.org.display.username',
    forceOrgDisplay,
    { flag: '--targetusername' }
  );
  const forceDataSoqlQueryInputCmd = vscode.commands.registerCommand(
    'sfdx.force.data.soql.query.input',
    forceDataSoqlQuery
  );
  const forceDataSoqlQuerySelectionCmd = vscode.commands.registerCommand(
    'sfdx.force.data.soql.query.selection',
    forceDataSoqlQuery
  );

  const forceApexExecuteDocumentCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.execute.document',
    forceApexExecute,
    false
  );
  const forceApexExecuteSelectionCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.execute.selection',
    forceApexExecute,
    true
  );

  const forceProjectCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.project.create',
    forceSfdxProjectCreate
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

  const forceApexLogGetCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.log.get',
    forceApexLogGet
  );

  const forceConfigSetCmd = vscode.commands.registerCommand(
    'sfdx.force.config.set',
    forceConfigSet
  );

  const forceDiffFile = vscode.commands.registerCommand(
    'sfdx.force.diff',
    forceSourceDiff
  );

  return vscode.Disposable.from(
    forceApexExecuteDocumentCmd,
    forceApexExecuteSelectionCmd,
    forceApexTestRunCmd,
    forceAuthWebLoginCmd,
    forceAuthDevHubCmd,
    forceAuthLogoutAllCmd,
    forceDataSoqlQueryInputCmd,
    forceDataSoqlQuerySelectionCmd,
    forceDiffFile,
    forceOrgCreateCmd,
    forceOrgOpenCmd,
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
    forceTaskStopCmd,
    forceApexClassCreateCmd,
    forceVisualforceComponentCreateCmd,
    forceVisualforcePageCreateCmd,
    forceLightningAppCreateCmd,
    forceLightningComponentCreateCmd,
    forceLightningEventCreateCmd,
    forceLightningInterfaceCreateCmd,
    forceLightningLwcCreateCmd,
    forceSourceStatusLocalCmd,
    forceSourceStatusRemoteCmd,
    forceDebuggerStopCmd,
    forceConfigListCmd,
    forceAliasListCmd,
    forceOrgDisplayDefaultCmd,
    forceOrgDisplayUsernameCmd,
    forceProjectCreateCmd,
    forceProjectWithManifestCreateCmd,
    forceApexTriggerCreateCmd,
    forceStartApexDebugLoggingCmd,
    forceStopApexDebugLoggingCmd,
    isvDebugBootstrapCmd,
    forceApexLogGetCmd,
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
}

export async function activate(context: vscode.ExtensionContext) {
  const extensionHRStart = process.hrtime();
  // Telemetry
  const machineId =
    vscode && vscode.env ? vscode.env.machineId : 'someValue.machineId';
  telemetryService.initializeService(context, machineId);
  telemetryService.showTelemetryMessage();

  // Task View
  const treeDataProvider = vscode.window.registerTreeDataProvider(
    'sfdx.force.tasks.view',
    taskViewService
  );
  context.subscriptions.push(treeDataProvider);

  // Set internal dev context
  const internalDev = sfdxCoreSettings.getInternalDev();

  vscode.commands.executeCommand(
    'setContext',
    'sfdx:internal_dev',
    internalDev
  );

  if (internalDev) {
    // Internal Dev commands
    const internalCommands = registerInternalDevCommands(context);
    context.subscriptions.push(internalCommands);

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

    if (!isCLIInstalled()) {
      showCLINotInstalledMessage();
      telemetryService.sendException(
        'core_internal_no_cli',
        'Salesforce CLI is not installed, internal dev mode'
      );
    }

    telemetryService.sendExtensionActivationEvent(extensionHRStart);
    console.log('SFDX CLI Extension Activated (internal dev mode)');
    return internalApi;
  }

  // Context
  let sfdxProjectOpened = false;
  if (hasRootWorkspace()) {
    const files = await vscode.workspace.findFiles('**/sfdx-project.json');
    sfdxProjectOpened = files && files.length > 0;
  }

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

  let defaultUsernameorAlias: string | undefined;
  if (hasRootWorkspace()) {
    defaultUsernameorAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(false);
  }

  // register org picker commands and set up filewatcher for defaultusername
  const orgList = new OrgList();
  orgList.displayDefaultUsername(defaultUsernameorAlias);
  context.subscriptions.push(registerOrgPickerCommands(orgList));

  await setupOrgBrowser(context);
  if (isCLIInstalled()) {
    // Set context for defaultusername org
    await setupWorkspaceOrgType(defaultUsernameorAlias);
    await orgList.registerDefaultUsernameWatcher(context);
  } else {
    showCLINotInstalledMessage();
    telemetryService.sendException(
      'core_no_cli',
      'Salesforce CLI is not installed'
    );
  }

  // Register filewatcher for push or deploy on save
  await registerPushOrDeployOnSave();
  // Commands
  const commands = registerCommands(context);
  context.subscriptions.push(commands);

  // Scratch Org Decorator
  if (hasRootWorkspace()) {
    decorators.showOrg();
    decorators.monitorOrgConfigChanges();
  }

  // Demo mode Decorator
  if (hasRootWorkspace() && isDemoMode()) {
    decorators.showDemoMode();
  }

  const api: any = {
    channelService,
    CompositeParametersGatherer,
    EmptyParametersGatherer,
    getDefaultUsernameOrAlias,
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
    CompositePreconditionChecker,
    SfdxWorkspaceChecker,
    taskViewService,
    telemetryService
  };

  telemetryService.sendExtensionActivationEvent(extensionHRStart);
  console.log('SFDX CLI Extension Activated');
  return api;
}

export function deactivate(): Promise<void> {
  console.log('SFDX CLI Extension Deactivated');

  // Send metric data.
  telemetryService.sendExtensionDeactivationEvent();
  telemetryService.dispose();

  decorators.disposeTraceFlagExpiration();
  return turnOffLogging();
}
