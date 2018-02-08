/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandExecution,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as AdmZip from 'adm-zip';
import { ExecOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as querystring from 'querystring';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { channelService } from '../../channels';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { CancellableStatusBar, taskViewService } from '../../statuses';
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

export class IsvDebugBootstrapExecutor extends SfdxCommandletExecutor<{}> {
  protected readonly relativeMetdataTempPath = path.join(
    '.sfdx',
    'isvdebugger',
    'mdapitmp'
  );
  protected readonly relativeApexPackageXmlPath = path.join(
    this.relativeMetdataTempPath,
    'package.xml'
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

  public buildRetrieveOrgSourceCommand(data: IsvDebugBootstrapConfig): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('isv_debug_bootstrap_step3_retrieve_org_source')
      )
      .withArg('force:mdapi:retrieve')
      .withFlag('-r', this.relativeMetdataTempPath)
      .withFlag('-k', this.relativeApexPackageXmlPath)
      .withFlag('-u', data.sessionId)
      .build();
  }

  public buildMetadataApiConvertCommand(
    data: IsvDebugBootstrapConfig
  ): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('isv_debug_bootstrap_step4_convert_org_source')
      )
      .withArg('force:mdapi:convert')
      .withFlag('-r', path.join(this.relativeMetdataTempPath, 'unpackaged'))
      .withFlag('-d', 'force-app')
      .build();
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

    // 1: create project
    await this.executeCommand(
      this.buildCreateProjectCommand(response.data),
      {
        cwd: projectParentPath
      },
      cancellationTokenSource,
      cancellationToken
    );

    // 2: configure project
    await this.executeCommand(
      this.buildConfigureProjectCommand(response.data),
      {
        cwd: projectPath
      },
      cancellationTokenSource,
      cancellationToken
    );

    // 3a: create package.xml for downloading org apex
    try {
      this.mkdirSyncRecursive(projectMetadataTempPath);
      fs.writeFileSync(
        apexRetrievePackageXmlPath,
        `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <version>41.0</version>
  <types>
    <members>*</members>
    <name>ApexClass</name>
  </types>
  <types>
    <members>*</members>
    <name>ApexTrigger</name>
  </types>
</Package>`
      );
    } catch (error) {
      channelService.appendLine(
        nls.localize('error_creating_packagexml', error.toString())
      );
      notificationService.showErrorMessage(
        nls.localize('error_creating_packagexml', error.toString())
      );
      return;
    }

    // 3b: retrieve unmanged org source
    this.executeCommand(
      this.buildRetrieveOrgSourceCommand(response.data),
      {
        cwd: projectPath
      },
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
      this.buildMetadataApiConvertCommand(response.data),
      {
        cwd: projectPath
      },
      cancellationTokenSource,
      cancellationToken
    );

    // last step: open the folder in VS Code
    await vscode.commands.executeCommand(
      'vscode.openFolder',
      vscode.Uri.parse(projectPath)
    );
  }

  public async executeCommand(
    command: Command,
    options: ExecOptions,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ): Promise<string> {
    const execution = new CliCommandExecutor(command, options).execute(
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
    CancellableStatusBar.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }

  public mkdirSyncRecursive(dirPath: string) {
    dirPath = path.resolve(dirPath);

    try {
      fs.mkdirSync(dirPath);
    } catch (error) {
      switch (error.code) {
        case 'ENOENT':
          // make parent first
          this.mkdirSyncRecursive(path.dirname(dirPath));
          // try again
          this.mkdirSyncRecursive(dirPath);
          break;

        // catch path exists error, which is ok
        default:
          let dirStat;
          try {
            dirStat = fs.statSync(dirPath);
          } catch (statError) {
            throw error; // re-throw original error
          }
          if (!dirStat.isDirectory()) {
            throw error;
          }
          break;
      }
    }
  }
}

export type IsvDebugBootstrapConfig = ProjectNameAndPath & ForceIdeUri;

export interface ForceIdeUri {
  loginUrl: string;
  sessionId: string;
}

export class EnterForceIdeUri implements ParametersGatherer<ForceIdeUri> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ForceIdeUri>
  > {
    const forceIdeUri = await vscode.window.showInputBox({
      prompt: nls.localize('parameter_gatherer_paste_forceide_url')
    });

    if (forceIdeUri) {
      const url = Uri.parse(forceIdeUri);
      const parameter = querystring.parse(url.query);
      if (parameter.url && parameter.sessionId) {
        return {
          type: 'CONTINUE',
          data: {
            loginUrl: parameter.url,
            sessionId: parameter.sessionId
          }
        };
      }

      vscode.window.showErrorMessage(
        nls.localize('parameter_gatherer_invalid_forceide_url')
      );
    }

    return { type: 'CANCEL' };
  }
}

const workspaceChecker = new EmptyPreChecker();
const parameterGatherer = new CompositeParametersGatherer(
  new EnterForceIdeUri(),
  new SelectProjectName(),
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

export function isvDebugBootstrap() {
  commandlet.run();
}
