/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CancelResponse,
  CliCommandExecutor,
  Command,
  CommandExecution,
  CommandOutput,
  ContinueResponse,
  ParametersGatherer,
  projectPaths,
  SfCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import { SpawnOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import sanitize = require('sanitize-filename'); // NOTE: Do not follow the instructions in the Quick Fix to use the default import because that causes an error popup when you use Launch Extensions
import * as shell from 'shelljs';
import { URL } from 'url';
import * as vscode from 'vscode';
import { channelService } from '../../channels';
import { nls } from '../../messages';
import { notificationService, ProgressNotification } from '../../notifications';
import { taskViewService } from '../../statuses';
import {
  PathExistsChecker,
  ProjectNameAndPathAndTemplate,
  SelectProjectFolder,
  SelectProjectName
} from '../projectGenerate';
import { CompositeParametersGatherer, EmptyPreChecker, SfCommandlet, SfCommandletExecutor } from '../util';
// below uses require due to bundling restrictions
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdmZip = require('adm-zip');

export type InstalledPackageInfo = {
  id: string;
  name: string;
  namespace: string;
  versionId: string;
  versionName: string;
  versionNumber: string;
};

export const ISVDEBUGGER = 'isvdebuggermdapitmp';
export const INSTALLED_PACKAGES = 'installed-packages';
export const PACKAGE_XML = 'package.xml';

export class IsvDebugBootstrapExecutor extends SfCommandletExecutor<{}> {
  public readonly relativeMetadataTempPath = path.join(projectPaths.relativeToolsFolder(), ISVDEBUGGER);
  public readonly relativeApexPackageXmlPath = path.join(this.relativeMetadataTempPath, PACKAGE_XML);
  public readonly relativeInstalledPackagesPath = path.join(projectPaths.relativeToolsFolder(), INSTALLED_PACKAGES);

  public build(data: {}): Command {
    throw new Error('not in use');
  }

  public buildCreateProjectCommand(data: IsvDebugBootstrapConfig): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('isv_debug_bootstrap_create_project'))
      .withArg('project:generate')
      .withFlag('--name', data.projectName)
      .withFlag('--output-dir', data.projectUri)
      .withFlag('--template', 'standard')
      .withLogName('isv_debug_bootstrap_create_project')
      .build();
  }

  public buildConfigureProjectCommand(data: IsvDebugBootstrapConfig): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('isv_debug_bootstrap_configure_project'))
      .withArg('config:set')
      .withArg(`org-isv-debugger-sid=${data.sessionId}`)
      .withArg(`org-isv-debugger-url=${data.loginUrl}`)
      .withArg(`org-instance-url=${data.loginUrl}`)
      .withLogName('isv_debug_bootstrap_configure_project')
      .build();
  }

  public buildQueryForOrgNamespacePrefixCommand(data: IsvDebugBootstrapConfig): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('isv_debug_bootstrap_configure_project_retrieve_namespace'))
      .withArg('data:query')
      .withFlag('--query', 'SELECT NamespacePrefix FROM Organization LIMIT 1')
      .withFlag('--target-org', data.sessionId)
      .withJson()
      .withLogName('isv_debug_bootstrap_configure_project_retrieve_namespace')
      .build();
  }

  public parseOrgNamespaceQueryResultJson(orgNamespaceQueryJson: string): string {
    const orgNamespaceQueryResponse = JSON.parse(orgNamespaceQueryJson);
    if (
      orgNamespaceQueryResponse.result &&
      orgNamespaceQueryResponse.result.records &&
      orgNamespaceQueryResponse.result.records[0] &&
      typeof orgNamespaceQueryResponse.result.records[0].NamespacePrefix === 'string'
    ) {
      return orgNamespaceQueryResponse.result.records[0].NamespacePrefix;
    }
    return '';
  }

  public buildRetrieveOrgSourceCommand(data: IsvDebugBootstrapConfig): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('isv_debug_bootstrap_retrieve_org_source'))
      .withArg('project:retrieve:start')
      .withFlag('--manifest', this.relativeApexPackageXmlPath)
      .withFlag('--target-org', data.sessionId)
      .withLogName('isv_debug_bootstrap_retrieve_org_source')
      .build();
  }

  public buildPackageInstalledListAsJsonCommand(data: IsvDebugBootstrapConfig): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('isv_debug_bootstrap_list_installed_packages'))
      .withArg('package:installed:list')
      .withFlag('--target-org', data.sessionId)
      .withJson()
      .withLogName('isv_debug_bootstrap_list_installed_packages')
      .build();
  }

  public buildRetrievePackageSourceCommand(data: IsvDebugBootstrapConfig, packageName: string): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('isv_debug_bootstrap_retrieve_package_source', packageName))
      .withArg('project:retrieve:start')
      .withFlag('--package-name', packageName)
      .withFlag('--target-org', data.sessionId)
      .withFlag('--target-metadata-dir', this.relativeInstalledPackagesPath)
      .withArg('--unzip')
      .withFlag('--zip-file-name', packageName.replaceAll('.', '-')) // with '.' in packagename it trims the string at index('.') and name the folder after substring e.g. salesforce.fth becomes salesforce
      .withLogName('isv_debug_bootstrap_retrieve_packages_source')
      .build();
  }

  public parsePackageInstalledListJson(packagesJson: string): InstalledPackageInfo[] {
    const packagesData = JSON.parse(packagesJson);
    return packagesData.result.map((entry: any) => {
      return {
        id: entry.SubscriberPackageId,
        name: entry.SubscriberPackageName,
        namespace: entry.SubscriberPackageNamespace,
        versionId: entry.SubscriberPackageVersionId,
        versionName: entry.SubscriberPackageVersionName,
        versionNumber: entry.SubscriberPackageVersionNumber
      } as InstalledPackageInfo;
    });
  }

  public async execute(response: ContinueResponse<IsvDebugBootstrapConfig>): Promise<void> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const projectParentPath = response.data.projectUri;
    const projectPath = path.join(projectParentPath, response.data.projectName);
    const projectMetadataTempPath = path.join(projectPath, this.relativeMetadataTempPath);
    const apexRetrievePackageXmlPath = path.join(projectPath, this.relativeApexPackageXmlPath);
    const projectInstalledPackagesPath = path.join(projectPath, this.relativeInstalledPackagesPath);

    // remove any previous project at this path location
    shell.rm('-rf', projectPath);

    // 1: create project
    await this.executeCommand(
      this.buildCreateProjectCommand(response.data),
      { cwd: projectParentPath },
      cancellationTokenSource,
      cancellationToken
    );

    // 2: configure project
    await this.executeCommand(
      this.buildConfigureProjectCommand(response.data),
      { cwd: projectPath },
      cancellationTokenSource,
      cancellationToken
    );

    // 2b: update sfdx-project.json with namespace
    const orgNamespaceInfoResponseJson = await this.executeCommand(
      this.buildQueryForOrgNamespacePrefixCommand(response.data),
      { cwd: projectPath },
      cancellationTokenSource,
      cancellationToken
    );
    try {
      const salesforceProjectJsonFile = path.join(projectPath, 'sfdx-project.json');
      const salesforceProjectConfig = JSON.parse(fs.readFileSync(salesforceProjectJsonFile, { encoding: 'utf-8' }));
      salesforceProjectConfig.namespace = this.parseOrgNamespaceQueryResultJson(orgNamespaceInfoResponseJson);
      fs.writeFileSync(salesforceProjectJsonFile, JSON.stringify(salesforceProjectConfig, null, 2), {
        encoding: 'utf-8'
      });
    } catch (error) {
      console.error(error);
      channelService.appendLine(nls.localize('error_updating_salesforce_project', error.toString()));
      notificationService.showErrorMessage(nls.localize('error_updating_salesforce_project', error.toString()));
      return;
    }

    // 3a: create package.xml for downloading org apex
    try {
      shell.mkdir('-p', projectMetadataTempPath);
      fs.writeFileSync(
        apexRetrievePackageXmlPath,
        `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>*</members>
    <name>ApexClass</name>
  </types>
  <types>
    <members>*</members>
    <name>ApexTrigger</name>
  </types>
</Package>`,
        { encoding: 'utf-8' }
      );
    } catch (error) {
      console.error(error);
      channelService.appendLine(nls.localize('error_creating_packagexml', error.toString()));
      notificationService.showErrorMessage(nls.localize('error_creating_packagexml', error.toString()));
      return;
    }

    // 3b: retrieve unmanaged org source
    await this.executeCommand(
      this.buildRetrieveOrgSourceCommand(response.data),
      { cwd: projectPath },
      cancellationTokenSource,
      cancellationToken
    );

    // 4: get list of installed packages
    const packagesJson = await this.executeCommand(
      this.buildPackageInstalledListAsJsonCommand(response.data),
      { cwd: projectPath },
      cancellationTokenSource,
      cancellationToken
    );
    const packageInfos = this.parsePackageInstalledListJson(packagesJson);

    // 5a: create directory where packages are to be retrieved
    shell.mkdir('-p', projectInstalledPackagesPath); // .sfdx/tools/installed-packages
    const packageNames = packageInfos.map(entry => entry.name);

    // 5b: retrieve packages
    // TODO: what if packageNames.length is 0?
    for (const packageName of packageNames) {
      await this.executeCommand(
        this.buildRetrievePackageSourceCommand(response.data, packageName),
        { cwd: projectPath },
        cancellationTokenSource,
        cancellationToken
      );
    }

    for (const packageInfo of packageInfos) {
      channelService.appendLine(nls.localize('isv_debug_bootstrap_processing_package', packageInfo.name));

      // generate installed-package.json file
      try {
        fs.writeFileSync(
          path.join(projectInstalledPackagesPath, packageInfo.name.replaceAll('.', '-'), 'installed-package.json'),
          JSON.stringify(packageInfo, null, 2),
          { encoding: 'utf-8' }
        );
      } catch (error) {
        console.error(error);
        channelService.appendLine(nls.localize('error_writing_installed_package_info', error.toString()));
        notificationService.showErrorMessage(nls.localize('error_writing_installed_package_info', error.toString()));
        return;
      }
    }

    // 5c: cleanup temp files
    try {
      shell.rm('-rf', projectMetadataTempPath);
    } catch (error) {
      console.error(error);
      channelService.appendLine(nls.localize('error_cleanup_temp_files', error.toString()));
      notificationService.showErrorMessage(nls.localize('error_cleanup_temp_files', error.toString()));
      return;
    }

    // 6: generate launch configuration
    channelService.appendLine(nls.localize('isv_debug_bootstrap_generate_launchjson'));
    try {
      const projectVsCodeFolder = path.join(projectPath, '.vscode');
      shell.mkdir('-p', projectVsCodeFolder);
      fs.writeFileSync(
        path.join(projectVsCodeFolder, 'launch.json'),
        // mostly duplicated from ApexDebuggerConfigurationProvider to avoid hard dependency from core to debugger module
        JSON.stringify(
          {
            version: '0.2.0',
            configurations: [
              {
                name: 'Launch Apex Debugger',
                type: 'apex',
                request: 'launch',
                userIdFilter: [],
                requestTypeFilter: [],
                entryPointFilter: '',
                salesforceProject: '${workspaceRoot}',
                connectType: 'ISV_DEBUGGER'
              }
            ]
          },
          null,
          2
        ),
        { encoding: 'utf-8' }
      );
    } catch (error) {
      console.error(error);
      channelService.appendLine(nls.localize('error_creating_launchjson', error.toString()));
      notificationService.showErrorMessage(nls.localize('error_creating_launchjson', error.toString()));
      return;
    }

    // last step: open the folder in VS Code
    channelService.appendLine(nls.localize('isv_debug_bootstrap_open_project'));
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath));
  }

  public async executeCommand(
    command: Command,
    options: SpawnOptions,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ): Promise<string> {
    const startTime = process.hrtime();
    // do not inherit global env because we are setting our own auth
    const execution = new CliCommandExecutor(command, options, false).execute(cancellationToken);

    const result = new CommandOutput().getCmdResult(execution);

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
    });
    return result;
  }

  protected attachExecution(
    execution: CommandExecution,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ) {
    channelService.streamCommandOutput(execution);
    channelService.showChannelOutput();
    notificationService.reportCommandExecutionStatus(execution, cancellationToken);
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

export type IsvDebugBootstrapConfig = ProjectNameAndPathAndTemplate & ForceIdeUri;

export type ForceIdeUri = {
  loginUrl: string;
  sessionId: string;
  orgName: string;
};

export class EnterForceIdeUri implements ParametersGatherer<ForceIdeUri> {
  public static readonly uriValidator = (value: string) => {
    try {
      const url = new URL(value);
      const parameter = url.searchParams;
      const loginUrl = parameter.get('url');
      const sessionId = parameter.get('sessionId');
      if (typeof loginUrl !== 'string' || typeof sessionId !== 'string') {
        return nls.localize('parameter_gatherer_invalid_forceide_url');
      }
    } catch (e) {
      return nls.localize('parameter_gatherer_invalid_forceide_url');
    }

    return null; // all good
  };

  public forceIdUrl?: ForceIdeUri;
  public async gather(): Promise<CancelResponse | ContinueResponse<ForceIdeUri>> {
    const forceIdeUri = await vscode.window.showInputBox({
      prompt: nls.localize('parameter_gatherer_paste_forceide_url'),
      placeHolder: nls.localize('parameter_gatherer_paste_forceide_url_placeholder'),
      ignoreFocusOut: true,
      validateInput: EnterForceIdeUri.uriValidator
    });

    if (forceIdeUri) {
      const url = new URL(forceIdeUri);
      const parameter = url.searchParams;
      const loginUrl = parameter.get('url');
      const sessionId = parameter.get('sessionId');
      if (loginUrl && sessionId) {
        const protocolPrefix = parameter.get('secure') === '0' ? 'http://' : 'https://';
        this.forceIdUrl = {
          loginUrl: loginUrl.toLowerCase().startsWith('http') ? loginUrl : protocolPrefix + loginUrl,
          sessionId,
          orgName: url.hostname
        };
        return {
          type: 'CONTINUE',
          data: this.forceIdUrl
        };
      }

      vscode.window.showErrorMessage(nls.localize('parameter_gatherer_invalid_forceide_url'));
    }

    return { type: 'CANCEL' };
  }
}

const forceIdeUrlGatherer = new EnterForceIdeUri();
const workspaceChecker = new EmptyPreChecker();
const parameterGatherer = new CompositeParametersGatherer(
  forceIdeUrlGatherer,
  new SelectProjectName(() => {
    if (forceIdeUrlGatherer.forceIdUrl && forceIdeUrlGatherer.forceIdUrl.orgName) {
      return sanitize(forceIdeUrlGatherer.forceIdUrl.orgName.replace(/[+]/g, '_'));
    }
    return '';
  }),
  new SelectProjectFolder()
);
const pathExistsChecker = new PathExistsChecker();

const executor = new IsvDebugBootstrapExecutor();
const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, executor, pathExistsChecker);

export const isvDebugBootstrap = async (): Promise<void> => {
  await commandlet.run();
};
