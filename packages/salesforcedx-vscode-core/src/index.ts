/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CliStatusEnum,
  CliVersionStatus,
  ensureCurrentWorkingDirIsProjectPath
} from '@salesforce/salesforcedx-utils';
import {
  ChannelService,
  SFDX_CORE_CONFIGURATION_NAME,
  TelemetryService,
  getRootWorkspacePath
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from './channels';
import {
  aliasList,
  analyticsGenerateTemplate,
  apexGenerateClass,
  apexGenerateTrigger,
  apexGenerateUnitTestClass,
  checkSObjectsAndRefresh,
  configList,
  configSet,
  dataQuery,
  debuggerStop,
  deleteSource,
  orgLoginAccessToken,
  projectGenerateManifest,
  forceLightningLwcTestCreate,
  forcePackageInstall,
  forceRefreshSObjects,
  renameLightningComponent,
  forceSourceDeployManifest,
  forceSourceDeploySourcePaths,
  forceSourceDiff,
  forceSourceFolderDiff,
  forceSourceRetrieveCmp,
  forceSourceRetrieveManifest,
  forceSourceRetrieveSourcePaths,
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
  orgLoginWeb,
  orgLoginWebDevHub,
  orgLogoutAll,
  orgLogoutDefault,
  orgOpen,
  projectDeployStart,
  projectGenerateWithManifest,
  projectRetrieveStart,
  sfProjectGenerate,
  startApexDebugLogging,
  stopApexDebugLogging,
  taskStop,
  turnOffLogging,
  viewAllChanges,
  viewLocalChanges,
  viewRemoteChanges,
  visualforceGenerateComponent,
  visualforceGeneratePage
} from './commands';
import { RetrieveMetadataTrigger } from './commands/forceSourceRetrieveMetadata';
import { isvDebugBootstrap } from './commands/isvdebugging';
import { getUserId } from './commands/startApexDebugLogging';
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
  ORG_OPEN_COMMAND,
  SF_CLI_DOWNLOAD_LINK
} from './constants';
import { WorkspaceContext, workspaceContextUtils } from './context';
import {
  decorators,
  disposeTraceFlagExpiration,
  showDemoMode
} from './decorators';
import { nls } from './messages';
import { isDemoMode } from './modes/demo-mode';
import { ProgressNotification, notificationService } from './notifications';
import { orgBrowser } from './orgBrowser';
import { OrgList } from './orgPicker';
import { isSfdxProjectOpened } from './predicates';
import { registerPushOrDeployOnSave, sfdxCoreSettings } from './settings';
import { SfdxProjectConfig } from './sfdxProject';
import { taskViewService } from './statuses';
import { showTelemetryMessage, telemetryService } from './telemetry';
import {
  isCLIInstalled,
  setNodeExtraCaCerts,
  setSfLogLevel,
  setUpOrgExpirationWatcher
} from './util';
import { OrgAuthInfo } from './util/authInfo';

const flagIgnoreConflicts: FlagParameter<string> = {
  flag: '--ignore-conflicts'
};

function registerCommands(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extensionContext: vscode.ExtensionContext
): vscode.Disposable {
  // Customer-facing commands
  const orgLoginAccessTokenCmd = vscode.commands.registerCommand(
    'sfdx.org.login.access.token',
    orgLoginAccessToken
  );
  const orgLoginWebCmd = vscode.commands.registerCommand(
    'sfdx.org.login.web',
    orgLoginWeb
  );
  const orgLoginWebDevHubCmd = vscode.commands.registerCommand(
    'sfdx.org.login.web.dev.hub',
    orgLoginWebDevHub
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const orgLogoutAllCmd = vscode.commands.registerCommand(
    'sfdx.org.logout.all',
    orgLogoutAll
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const orgLogoutDefaultCmd = vscode.commands.registerCommand(
    'sfdx.org.logout.default',
    orgLogoutDefault
  );
  const openDocumentationCmd = vscode.commands.registerCommand(
    'sfdx.open.documentation',
    openDocumentation
  );
  const orgCreateCmd = vscode.commands.registerCommand(
    'sfdx.org.create',
    orgCreate
  );
  const orgOpenCmd = vscode.commands.registerCommand(ORG_OPEN_COMMAND, orgOpen);
  const deleteSourceCmd = vscode.commands.registerCommand(
    'sfdx.delete.source',
    deleteSource
  );
  const deleteSourceCurrentFileCmd = vscode.commands.registerCommand(
    'sfdx.delete.source.current.file',
    deleteSource
  );
  const forceSourceDeployCurrentSourceFileCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.current.source.file',
    forceSourceDeploySourcePaths
  );
  const forceSourceDeployInManifestCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.in.manifest',
    forceSourceDeployManifest
  );
  const forceSourceDeployMultipleSourcePathsCmd =
    vscode.commands.registerCommand(
      'sfdx.force.source.deploy.multiple.source.paths',
      forceSourceDeploySourcePaths
    );
  const forceSourceDeploySourcePathCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.source.path',
    forceSourceDeploySourcePaths
  );
  const projectRetrieveStartCmd = vscode.commands.registerCommand(
    'sfdx.project.retrieve.start',
    projectRetrieveStart
  );
  const projectDeployStartCmd = vscode.commands.registerCommand(
    'sfdx.project.deploy.start',
    projectDeployStart
  );
  const projectRetrieveStartIgnoreConflictsCmd =
    vscode.commands.registerCommand(
      'sfdx.project.retrieve.start.ignore.conflicts',
      projectRetrieveStart,
      flagIgnoreConflicts
    );
  const projectDeployStartIgnoreConflictsCmd = vscode.commands.registerCommand(
    'sfdx.project.deploy.start.ignore.conflicts',
    projectDeployStart,
    flagIgnoreConflicts
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
    'sfdx.view.all.changes',
    viewAllChanges
  );
  const forceSourceStatusLocalCmd = vscode.commands.registerCommand(
    'sfdx.view.local.changes',
    viewLocalChanges
  );
  const forceSourceStatusRemoteCmd = vscode.commands.registerCommand(
    'sfdx.view.remote.changes',
    viewRemoteChanges
  );
  const taskStopCmd = vscode.commands.registerCommand(
    'sfdx.task.stop',
    taskStop
  );
  const apexGenerateClassCmd = vscode.commands.registerCommand(
    'sfdx.apex.generate.class',
    apexGenerateClass
  );
  const apexGenerateUnitTestClassCmd = vscode.commands.registerCommand(
    'sfdx.apex.generate.unit.test.class',
    apexGenerateUnitTestClass
  );
  const analyticsGenerateTemplateCmd = vscode.commands.registerCommand(
    'sfdx.analytics.generate.template',
    analyticsGenerateTemplate
  );
  const visualforceGenerateComponentCmd = vscode.commands.registerCommand(
    'sfdx.visualforce.generate.component',
    visualforceGenerateComponent
  );
  const visualforceGeneratePageCmd = vscode.commands.registerCommand(
    'sfdx.visualforce.generate.page',
    visualforceGeneratePage
  );

  const lightningGenerateAppCmd = vscode.commands.registerCommand(
    'sfdx.lightning.generate.app',
    lightningGenerateApp
  );

  const lightningGenerateAuraComponentCmd = vscode.commands.registerCommand(
    'sfdx.lightning.generate.aura.component',
    lightningGenerateAuraComponent
  );

  const lightningGenerateEventCmd = vscode.commands.registerCommand(
    'sfdx.lightning.generate.event',
    lightningGenerateEvent
  );

  const lightningGenerateInterfaceCmd = vscode.commands.registerCommand(
    'sfdx.lightning.generate.interface',
    lightningGenerateInterface
  );

  const lightningGenerateLwcCmd = vscode.commands.registerCommand(
    'sfdx.lightning.generate.lwc',
    lightningGenerateLwc
  );

  const forceLightningLwcTestCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.lwc.test.create',
    forceLightningLwcTestCreate
  );

  const debuggerStopCmd = vscode.commands.registerCommand(
    'sfdx.debugger.stop',
    debuggerStop
  );
  const configListCmd = vscode.commands.registerCommand(
    'sfdx.config.list',
    configList
  );
  const forceAliasListCmd = vscode.commands.registerCommand(
    'sfdx.alias.list',
    aliasList
  );
  const orgDeleteDefaultCmd = vscode.commands.registerCommand(
    'sfdx.org.delete.default',
    orgDelete
  );
  const orgDeleteUsernameCmd = vscode.commands.registerCommand(
    'sfdx.org.delete.username',
    orgDelete,
    { flag: '--target-org' }
  );
  const orgDisplayDefaultCmd = vscode.commands.registerCommand(
    'sfdx.org.display.default',
    orgDisplay
  );
  const orgDisplayUsernameCmd = vscode.commands.registerCommand(
    'sfdx.org.display.username',
    orgDisplay,
    { flag: '--target-org' }
  );
  const orgListCleanCmd = vscode.commands.registerCommand(
    'sfdx.org.list.clean',
    orgList
  );
  const dataQueryInputCmd = vscode.commands.registerCommand(
    'sfdx.data.query.input',
    dataQuery
  );
  const dataQuerySelectionCmd = vscode.commands.registerCommand(
    'sfdx.data.query.selection',
    dataQuery
  );
  const projectGenerateCmd = vscode.commands.registerCommand(
    'sfdx.project.generate',
    sfProjectGenerate
  );

  const forcePackageInstallCmd = vscode.commands.registerCommand(
    'sfdx.force.package.install',
    forcePackageInstall
  );
  const projectGenerateWithManifestCmd = vscode.commands.registerCommand(
    'sfdx.project.generate.with.manifest',
    projectGenerateWithManifest
  );

  const apexGenerateTriggerCmd = vscode.commands.registerCommand(
    'sfdx.apex.generate.trigger',
    apexGenerateTrigger
  );

  const startApexDebugLoggingCmd = vscode.commands.registerCommand(
    'sfdx.start.apex.debug.logging',
    startApexDebugLogging
  );

  const stopApexDebugLoggingCmd = vscode.commands.registerCommand(
    'sfdx.stop.apex.debug.logging',
    stopApexDebugLogging
  );

  const isvDebugBootstrapCmd = vscode.commands.registerCommand(
    'sfdx.debug.isv.bootstrap',
    isvDebugBootstrap
  );

  const configSetCmd = vscode.commands.registerCommand(
    'sfdx.config.set',
    configSet
  );

  const forceDiffFile = vscode.commands.registerCommand(
    'sfdx.force.diff',
    forceSourceDiff
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const forceDiffFolder = vscode.commands.registerCommand(
    'sfdx.force.folder.diff',
    forceSourceFolderDiff
  );

  const forceRefreshSObjectsCmd = vscode.commands.registerCommand(
    'sfdx.force.internal.refreshsobjects',
    forceRefreshSObjects
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renameLightningComponentCmd = vscode.commands.registerCommand(
    'sfdx.rename.lightning.component',
    renameLightningComponent
  );

  return vscode.Disposable.from(
    renameLightningComponentCmd,
    forceDiffFolder,
    orgLoginAccessTokenCmd,
    dataQueryInputCmd,
    dataQuerySelectionCmd,
    forceDiffFile,
    openDocumentationCmd,
    orgCreateCmd,
    orgDeleteDefaultCmd,
    orgDeleteUsernameCmd,
    forceRefreshSObjectsCmd,
    deleteSourceCmd,
    deleteSourceCurrentFileCmd,
    forceSourceDeployCurrentSourceFileCmd,
    forceSourceDeployInManifestCmd,
    forceSourceDeployMultipleSourcePathsCmd,
    forceSourceDeploySourcePathCmd,
    projectDeployStartCmd,
    projectDeployStartIgnoreConflictsCmd,
    projectRetrieveStartCmd,
    projectRetrieveStartIgnoreConflictsCmd,
    forceSourceRetrieveCmd,
    forceSourceRetrieveCurrentFileCmd,
    forceSourceRetrieveInManifestCmd,
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
    forceLightningLwcTestCreateCmd,
    debuggerStopCmd,
    configListCmd,
    forceAliasListCmd,
    orgDisplayDefaultCmd,
    orgDisplayUsernameCmd,
    projectGenerateCmd,
    forcePackageInstallCmd,
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
    orgOpenCmd
  );
}

function registerInternalDevCommands(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extensionContext: vscode.ExtensionContext
): vscode.Disposable {
  const internalLightningGenerateAppCmd = vscode.commands.registerCommand(
    'sfdx.internal.lightning.generate.app',
    internalLightningGenerateApp
  );

  const internalLightningGenerateAuraComponentCmd =
    vscode.commands.registerCommand(
      'sfdx.internal.lightning.generate.aura.component',
      internalLightningGenerateAuraComponent
    );

  const internalLightningGenerateEventCmd = vscode.commands.registerCommand(
    'sfdx.internal.lightning.generate.event',
    internalLightningGenerateEvent
  );

  const internalLightningGenerateInterfaceCmd = vscode.commands.registerCommand(
    'sfdx.internal.lightning.generate.interface',
    internalLightningGenerateInterface
  );

  const internalLightningGenerateLwcCmd = vscode.commands.registerCommand(
    'sfdx.internal.lightning.generate.lwc',
    internalLightningGenerateLwc
  );

  return vscode.Disposable.from(
    internalLightningGenerateAuraComponentCmd,
    internalLightningGenerateLwcCmd,
    internalLightningGenerateAppCmd,
    internalLightningGenerateEventCmd,
    internalLightningGenerateInterfaceCmd
  );
}

function registerOrgPickerCommands(orgListParam: OrgList): vscode.Disposable {
  const setDefaultOrgCmd = vscode.commands.registerCommand(
    'sfdx.set.default.org',
    () => orgListParam.setDefaultOrg()
  );
  return vscode.Disposable.from(setDefaultOrgCmd);
}

async function setupOrgBrowser(
  extensionContext: vscode.ExtensionContext
): Promise<void> {
  await orgBrowser.init(extensionContext);

  vscode.commands.registerCommand(
    'sfdx.metadata.view.type.refresh',
    async node => {
      await orgBrowser.refreshAndExpand(node);
    }
  );

  vscode.commands.registerCommand(
    'sfdx.metadata.view.component.refresh',
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

  vscode.commands.registerCommand(
    'sfdx.project.generate.manifest',
    projectGenerateManifest
  );
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
  // validateCliInstallationAndVersion();
  setNodeExtraCaCerts();
  setSfLogLevel();
  await telemetryService.initializeService(extensionContext);
  showTelemetryMessage(extensionContext);

  // Task View
  const treeDataProvider = vscode.window.registerTreeDataProvider(
    'sfdx.tasks.view',
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
    telemetryService,
    services: {
      ChannelService,
      SfdxProjectConfig,
      TelemetryService,
      WorkspaceContext
    }
  };

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
  const newOrgList = new OrgList();
  extensionContext.subscriptions.push(registerOrgPickerCommands(newOrgList));

  await setupOrgBrowser(extensionContext);
  await setupConflictView(extensionContext);

  PersistentStorageService.initialize(extensionContext);

  // Register file watcher for push or deploy on save
  await registerPushOrDeployOnSave();
  await decorators.showOrg();

  await setUpOrgExpirationWatcher(newOrgList);

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

export function validateCliInstallationAndVersion(): void {
  // Check that the CLI is installed and that it is a supported version
  // If there is no CLI or it is an unsupported version then the Core extension will not activate
  const c = new CliVersionStatus();

  const sfdxCliVersionString = c.getCliVersion(true);
  const sfCliVersionString = c.getCliVersion(false);

  const sfdxCliVersionParsed = c.parseCliVersion(sfdxCliVersionString);
  const sfCliVersionParsed = c.parseCliVersion(sfCliVersionString);

  const cliInstallationResult = c.validateCliInstallationAndVersion(
    sfdxCliVersionParsed,
    sfCliVersionParsed
  );

  switch (cliInstallationResult) {
    case CliStatusEnum.cliNotInstalled: {
      showErrorNotification('sfdx_cli_not_found', [
        SF_CLI_DOWNLOAD_LINK,
        SF_CLI_DOWNLOAD_LINK
      ]);
      throw Error('No Salesforce CLI installed');
    }
    case CliStatusEnum.onlySFv1: {
      showErrorNotification('sf_v1_not_supported', [
        SF_CLI_DOWNLOAD_LINK,
        SF_CLI_DOWNLOAD_LINK
      ]);
      throw Error('Only SF v1 installed');
    }
    case CliStatusEnum.outdatedSFDXVersion: {
      showErrorNotification('sfdx_cli_not_supported', [
        SF_CLI_DOWNLOAD_LINK,
        SF_CLI_DOWNLOAD_LINK
      ]);
      throw Error('Outdated SFDX CLI version that is no longer supported');
    }
    case CliStatusEnum.bothSFDXAndSFInstalled: {
      showErrorNotification('both_sfdx_and_sf', []);
      throw Error('Both SFDX v7 and SF v2 are installed');
    }
    case CliStatusEnum.SFDXv7Valid: {
      showWarningNotification('sfdx_v7_deprecation', [
        SF_CLI_DOWNLOAD_LINK,
        SF_CLI_DOWNLOAD_LINK
      ]);
    }
  }
}

export function showErrorNotification(type: string, args: any[]) {
  const showMessage = nls.localize(type, ...args);
  vscode.window.showErrorMessage(showMessage);
}

export function showWarningNotification(type: string, args: any[]) {
  const showMessage = nls.localize(type, ...args);
  vscode.window.showWarningMessage(showMessage);
}
