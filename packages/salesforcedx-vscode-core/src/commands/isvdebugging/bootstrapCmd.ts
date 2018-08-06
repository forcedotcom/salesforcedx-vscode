/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ENV_SFDX_DEFAULTUSERNAME,
  ENV_SFDX_INSTANCE_URL,
  SFDX_CONFIG_ISV_DEBUGGER_SID,
  SFDX_CONFIG_ISV_DEBUGGER_URL
} from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  CliCommandExecutor,
  Command,
  CommandExecution,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ForceConfigGet,
  GlobalCliEnvironment
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as AdmZip from 'adm-zip';
import { SpawnOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as sanitizeFilename from 'sanitize-filename';
import * as shell from 'shelljs';
import { URL } from 'url';
import * as vscode from 'vscode';
import { channelService } from '../../channels';
import { nls } from '../../messages';
import { notificationService, ProgressNotification } from '../../notifications';
import { taskViewService } from '../../statuses';
import {
  CompositeParametersGatherer,
  EmptyPreChecker,
  SfdxCommandlet,
  SfdxCommandletExecutor
} from '../commands';
import {
  PathExistsChecker,
  ProjectNameAndPath,
  SelectProjectFolder,
  SelectProjectName
} from '../forceProjectCreate';

export interface InstalledPackageInfo {
  id: string;
  name: string;
  namespace: string;
  versionId: string;
  versionName: string;
  versionNumber: string;
}

export class IsvDebugBootstrapExecutor extends SfdxCommandletExecutor<{}> {
  public readonly relativeMetdataTempPath = path.join(
    '.sfdx',
    'tools',
    'isvdebuggermdapitmp'
  );
  public readonly relativeApexPackageXmlPath = path.join(
    this.relativeMetdataTempPath,
    'package.xml'
  );
  public readonly relativeInstalledPackagesPath = path.join(
    '.sfdx',
    'tools',
    'installed-packages'
  );

  public build(data: {}): Command {
    throw new Error('not in use');
  }

  public buildCreateProjectCommand(data: IsvDebugBootstrapConfig): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('isv_debug_bootstrap_step1_create_project'))
      .withArg('force:project:create')
      .withFlag('--projectname', data.projectName)
      .withFlag('--outputdir', data.projectUri)
      .build();
  }

  public buildConfigureProjectCommand(data: IsvDebugBootstrapConfig): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('isv_debug_bootstrap_step2_configure_project')
      )
      .withArg('force:config:set')
      .withArg(`isvDebuggerSid=${data.sessionId}`)
      .withArg(`isvDebuggerUrl=${data.loginUrl}`)
      .withArg(`instanceUrl=${data.loginUrl}`)
      .build();
  }

  public buildQueryForOrgNamespacePrefixCommand(
    data: IsvDebugBootstrapConfig
  ): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize(
          'isv_debug_bootstrap_step2_configure_project_retrieve_namespace'
        )
      )
      .withArg('force:data:soql:query')
      .withFlag('--query', 'SELECT NamespacePrefix FROM Organization LIMIT 1')
      .withFlag('--targetusername', data.sessionId)
      .withJson()
      .build();
  }

  public parseOrgNamespaceQueryResultJson(
    orgNamespaceQueryJson: string
  ): string {
    const orgNamespaceQueryResponse = JSON.parse(orgNamespaceQueryJson);
    if (
      orgNamespaceQueryResponse.result &&
      orgNamespaceQueryResponse.result.records &&
      orgNamespaceQueryResponse.result.records[0] &&
      typeof orgNamespaceQueryResponse.result.records[0].NamespacePrefix ===
        'string'
    ) {
      return orgNamespaceQueryResponse.result.records[0].NamespacePrefix;
    }
    return '';
  }

  public buildRetrieveOrgSourceCommand(data: IsvDebugBootstrapConfig): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('isv_debug_bootstrap_step3_retrieve_org_source')
      )
      .withArg('force:mdapi:retrieve')
      .withFlag('--retrievetargetdir', this.relativeMetdataTempPath)
      .withFlag('--unpackaged', this.relativeApexPackageXmlPath)
      .withFlag('--targetusername', data.sessionId)
      .build();
  }

  public buildMetadataApiConvertOrgSourceCommand(
    data: IsvDebugBootstrapConfig
  ): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('isv_debug_bootstrap_step4_convert_org_source')
      )
      .withArg('force:mdapi:convert')
      .withFlag(
        '--rootdir',
        path.join(this.relativeMetdataTempPath, 'unpackaged')
      )
      .withFlag('--outputdir', 'force-app')
      .build();
  }

  public buildPackageInstalledListAsJsonCommand(
    data: IsvDebugBootstrapConfig
  ): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('isv_debug_bootstrap_step5_list_installed_packages')
      )
      .withArg('force:package:installed:list')
      .withFlag('--targetusername', data.sessionId)
      .withJson()
      .build();
  }

  public buildRetrievePackagesSourceCommand(
    data: IsvDebugBootstrapConfig,
    packageNames: string[]
  ): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('isv_debug_bootstrap_step6_retrieve_packages_source')
      )
      .withArg('force:mdapi:retrieve')
      .withFlag('--retrievetargetdir', this.relativeMetdataTempPath)
      .withFlag('--packagenames', packageNames.join(','))
      .withFlag('--targetusername', data.sessionId)
      .build();
  }

  public buildMetadataApiConvertPackageSourceCommand(
    packageName: string
  ): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize(
          'isv_debug_bootstrap_step7_convert_package_source',
          packageName
        )
      )
      .withArg('force:mdapi:convert')
      .withFlag(
        '--rootdir',
        path.join(this.relativeMetdataTempPath, 'packages', packageName)
      )
      .withFlag(
        '--outputdir',
        path.join(this.relativeInstalledPackagesPath, packageName)
      )
      .build();
  }

  public parsePackageInstalledListJson(
    packagesJson: string
  ): InstalledPackageInfo[] {
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

  public async execute(
    response: ContinueResponse<IsvDebugBootstrapConfig>
  ): Promise<void> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const projectParentPath = response.data.projectUri;
    const projectPath = path.join(projectParentPath, response.data.projectName);
    const projectMetadataTempPath = path.join(
      projectPath,
      this.relativeMetdataTempPath
    );
    const apexRetrievePackageXmlPath = path.join(
      projectPath,
      this.relativeApexPackageXmlPath
    );
    const projectInstalledPackagesPath = path.join(
      projectPath,
      this.relativeInstalledPackagesPath
    );

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
      const sfdxProjectJsonFile = path.join(projectPath, 'sfdx-project.json');
      const sfdxProjectConfig = JSON.parse(
        fs.readFileSync(sfdxProjectJsonFile, { encoding: 'utf-8' })
      );
      sfdxProjectConfig.namespace = this.parseOrgNamespaceQueryResultJson(
        orgNamespaceInfoResponseJson
      );
      fs.writeFileSync(
        sfdxProjectJsonFile,
        JSON.stringify(sfdxProjectConfig, null, 2),
        { encoding: 'utf-8' }
      );
    } catch (error) {
      console.error(error);
      channelService.appendLine(
        nls.localize('error_updating_sfdx_project', error.toString())
      );
      notificationService.showErrorMessage(
        nls.localize('error_updating_sfdx_project', error.toString())
      );
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
      channelService.appendLine(
        nls.localize('error_creating_packagexml', error.toString())
      );
      notificationService.showErrorMessage(
        nls.localize('error_creating_packagexml', error.toString())
      );
      return;
    }

    // 3b: retrieve unmanged org source
    await this.executeCommand(
      this.buildRetrieveOrgSourceCommand(response.data),
      { cwd: projectPath },
      cancellationTokenSource,
      cancellationToken
    );

    // 4a: unzip retrieved source
    try {
      const zip = new AdmZip(
        path.join(projectMetadataTempPath, 'unpackaged.zip')
      );
      zip.extractAllTo(projectMetadataTempPath, true);
    } catch (error) {
      console.error(error);
      channelService.appendLine(
        nls.localize('error_extracting_org_source', error.toString())
      );
      notificationService.showErrorMessage(
        nls.localize('error_extracting_org_source', error.toString())
      );
      return;
    }

    // 4b: convert org source
    await this.executeCommand(
      this.buildMetadataApiConvertOrgSourceCommand(response.data),
      { cwd: projectPath },
      cancellationTokenSource,
      cancellationToken
    );

    // 5: get list of installed packages
    const packagesJson = await this.executeCommand(
      this.buildPackageInstalledListAsJsonCommand(response.data),
      { cwd: projectPath },
      cancellationTokenSource,
      cancellationToken
    );
    const packageInfos = this.parsePackageInstalledListJson(packagesJson);

    // 6: fetch packages
    await this.executeCommand(
      this.buildRetrievePackagesSourceCommand(
        response.data,
        packageInfos.map(entry => entry.name)
      ),
      { cwd: projectPath },
      cancellationTokenSource,
      cancellationToken
    );

    // 7a: unzip downloaded packages into temp location
    try {
      const packagesTempPath = path.join(projectMetadataTempPath, 'packages');
      shell.mkdir('-p', packagesTempPath);
      shell.mkdir('-p', projectInstalledPackagesPath);
      const zip = new AdmZip(
        path.join(projectMetadataTempPath, 'unpackaged.zip')
      );
      zip.extractAllTo(packagesTempPath, true);
    } catch (error) {
      console.error(error);
      channelService.appendLine(
        nls.localize('error_extracting_packages', error.toString())
      );
      notificationService.showErrorMessage(
        nls.localize('error_extracting_packages', error.toString())
      );
      return;
    }

    // 7b: convert packages into final location
    for (const packageInfo of packageInfos) {
      channelService.appendLine(
        nls.localize('isv_debug_bootstrap_processing_package', packageInfo.name)
      );
      await this.executeCommand(
        this.buildMetadataApiConvertPackageSourceCommand(packageInfo.name),
        { cwd: projectPath },
        cancellationTokenSource,
        cancellationToken
      );

      // generate installed-package.json file
      try {
        fs.writeFileSync(
          path.join(
            projectInstalledPackagesPath,
            packageInfo.name,
            'installed-package.json'
          ),
          JSON.stringify(packageInfo, null, 2),
          { encoding: 'utf-8' }
        );
      } catch (error) {
        console.error(error);
        channelService.appendLine(
          nls.localize('error_writing_installed_package_info', error.toString())
        );
        notificationService.showErrorMessage(
          nls.localize('error_writing_installed_package_info', error.toString())
        );
        return;
      }
    }

    // 7c: cleanup temp files
    try {
      shell.rm('-rf', projectMetadataTempPath);
    } catch (error) {
      console.error(error);
      channelService.appendLine(
        nls.localize('error_cleanup_temp_files', error.toString())
      );
      notificationService.showErrorMessage(
        nls.localize('error_cleanup_temp_files', error.toString())
      );
      return;
    }

    // 8: generate launch configuration
    channelService.appendLine(
      nls.localize('isv_debug_bootstrap_generate_launchjson')
    );
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
                sfdxProject: '${workspaceRoot}',
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
      channelService.appendLine(
        nls.localize('error_creating_launchjson', error.toString())
      );
      notificationService.showErrorMessage(
        nls.localize('error_creating_launchjson', error.toString())
      );
      return;
    }

    // last step: open the folder in VS Code
    channelService.appendLine(nls.localize('isv_debug_bootstrap_open_project'));
    await vscode.commands.executeCommand(
      'vscode.openFolder',
      vscode.Uri.file(projectPath)
    );
  }

  public async executeCommand(
    command: Command,
    options: SpawnOptions,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ): Promise<string> {
    // do not inherit global env because we are setting our own auth
    const execution = new CliCommandExecutor(command, options, false).execute(
      cancellationToken
    );

    const result = new CommandOutput().getCmdResult(execution);

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);

    return result;
  }

  protected attachExecution(
    execution: CommandExecution,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ) {
    channelService.streamCommandOutput(execution);
    channelService.showChannelOutput();
    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.stderrSubject as any) as Observable<Error | undefined>
    );
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

export type IsvDebugBootstrapConfig = ProjectNameAndPath & ForceIdeUri;

export interface ForceIdeUri {
  loginUrl: string;
  sessionId: string;
  orgName: string;
}

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
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ForceIdeUri>
  > {
    const forceIdeUri = await vscode.window.showInputBox({
      prompt: nls.localize('parameter_gatherer_paste_forceide_url'),
      placeHolder: nls.localize(
        'parameter_gatherer_paste_forceide_url_placeholder'
      ),
      ignoreFocusOut: true,
      validateInput: EnterForceIdeUri.uriValidator
    });

    if (forceIdeUri) {
      const url = new URL(forceIdeUri);
      const parameter = url.searchParams;
      const loginUrl = parameter.get('url');
      const sessionId = parameter.get('sessionId');
      if (loginUrl && sessionId) {
        const protocolPrefix =
          parameter.get('secure') === '0' ? 'http://' : 'https://';
        this.forceIdUrl = {
          loginUrl: loginUrl.toLowerCase().startsWith('http')
            ? loginUrl
            : protocolPrefix + loginUrl,
          sessionId,
          orgName: url.hostname
        };
        return {
          type: 'CONTINUE',
          data: this.forceIdUrl
        };
      }

      vscode.window.showErrorMessage(
        nls.localize('parameter_gatherer_invalid_forceide_url')
      );
    }

    return { type: 'CANCEL' };
  }
}

const forceIdeUrlGatherer = new EnterForceIdeUri();
const workspaceChecker = new EmptyPreChecker();
const parameterGatherer = new CompositeParametersGatherer(
  forceIdeUrlGatherer,
  new SelectProjectName(() => {
    if (
      forceIdeUrlGatherer.forceIdUrl &&
      forceIdeUrlGatherer.forceIdUrl.orgName
    ) {
      return sanitizeFilename(
        forceIdeUrlGatherer.forceIdUrl.orgName.replace(/[\+]/g, '_')
      );
    }
    return '';
  }),
  new SelectProjectFolder()
);
const pathExistsChecker = new PathExistsChecker();

const executor = new IsvDebugBootstrapExecutor();
const commandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  executor,
  pathExistsChecker
);

export async function isvDebugBootstrap() {
  await commandlet.run();
}

export async function setupGlobalDefaultUserIsvAuth() {
  if (
    vscode.workspace.workspaceFolders instanceof Array &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    const forceConfig = await new ForceConfigGet().getConfig(
      vscode.workspace.workspaceFolders[0].uri.fsPath,
      SFDX_CONFIG_ISV_DEBUGGER_SID,
      SFDX_CONFIG_ISV_DEBUGGER_URL
    );
    const isvDebuggerSid = forceConfig.get(SFDX_CONFIG_ISV_DEBUGGER_SID);
    const isvDebuggerUrl = forceConfig.get(SFDX_CONFIG_ISV_DEBUGGER_URL);
    if (
      typeof isvDebuggerSid !== 'undefined' &&
      typeof isvDebuggerUrl !== 'undefined'
    ) {
      // set auth context
      GlobalCliEnvironment.environmentVariables.set(
        ENV_SFDX_DEFAULTUSERNAME,
        isvDebuggerSid
      );
      GlobalCliEnvironment.environmentVariables.set(
        ENV_SFDX_INSTANCE_URL,
        isvDebuggerUrl
      );
      // enable ISV project
      vscode.commands.executeCommand(
        'setContext',
        'sfdx:isv_debug_project',
        true
      );
      console.log(
        `Configured ${ENV_SFDX_DEFAULTUSERNAME} and ${ENV_SFDX_INSTANCE_URL} for ISV Project Authentication`
      );
      return;
    } else {
      // disable ISV project
      vscode.commands.executeCommand(
        'setContext',
        'sfdx:isv_debug_project',
        false
      );
      console.log('Project is not for ISV Debugger');
    }
  }

  // reset any auth
  GlobalCliEnvironment.environmentVariables.delete(ENV_SFDX_DEFAULTUSERNAME);
  GlobalCliEnvironment.environmentVariables.delete(ENV_SFDX_INSTANCE_URL);
  console.log(
    `Deleted environment variables ${ENV_SFDX_DEFAULTUSERNAME} and ${ENV_SFDX_INSTANCE_URL}`
  );
}
