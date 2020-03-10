/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  CompositeCliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import {
  DeployStatusEnum,
  ToolingDeploy,
  ToolingDeployParser,
  ToolingRetrieveResult
} from '../deploys';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { DeployQueue, sfdxCoreSettings } from '../settings';
import { telemetryService } from '../telemetry';
import { OrgAuthInfo } from '../util';
import { BaseDeployExecutor, DeployType } from './baseDeployCommand';
import { SourcePathChecker } from './forceSourceRetrieveSourcePath';
import { APEX_CLASS_EXTENSION } from './templates/metadataTypeConstants';
import { FilePathGatherer, SfdxCommandlet, SfdxWorkspaceChecker } from './util';

export class ForceSourceDeploySourcePathExecutor extends BaseDeployExecutor {
  public build(sourcePath: string): Command {
    const commandBuilder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_deploy_text'))
      .withArg('force:source:deploy')
      .withLogName('force_source_deploy_with_sourcepath')
      .withFlag('--sourcepath', sourcePath)
      .withJson();
    return commandBuilder.build();
  }

  public async execute(response: ContinueResponse<string>): Promise<void> {
    const betaDeployRetrieve = sfdxCoreSettings.getBetaDeployRetrieve();
    // this supported types logic is temporary until we have a way of generating the metadata type from the path
    // once we have the metadata type we can check to see if it is a toolingsupportedtype from that util
    const supportedType =
      path.extname(response.data) === APEX_CLASS_EXTENSION ||
      response.data.includes(`${APEX_CLASS_EXTENSION}-meta.xml`);
    const multipleSourcePaths = response.data.includes(',');

    if (betaDeployRetrieve && supportedType && !multipleSourcePaths) {
      const startTime = process.hrtime();
      const cancellationTokenSource = new vscode.CancellationTokenSource();
      const cancellationToken = cancellationTokenSource.token;

      const executionWrapper = new CompositeCliCommandExecutor(
        this.build(response.data)
      ).execute(cancellationToken);
      this.attachExecution(
        executionWrapper,
        cancellationTokenSource,
        cancellationToken
      );
      executionWrapper.processExitSubject.subscribe(() => {
        this.logMetric('force_source_deploy_with_sourcepath_beta', startTime);
      });

      try {
        const usernameOrAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(
          true
        );
        if (!usernameOrAlias) {
          throw new Error(nls.localize('error_no_default_username'));
        }
        const orgConnection = await OrgAuthInfo.getConnection(usernameOrAlias);
        const deployLibrary = new ToolingDeploy(orgConnection);
        const deployOutput = await deployLibrary.deploy(response.data);

        const parser = new ToolingDeployParser(deployOutput);
        const outputResult = await parser.outputResult();
        channelService.appendLine(outputResult);
        if (deployOutput.State === DeployStatusEnum.Completed) {
          executionWrapper.successfulExit();
        } else {
          executionWrapper.failureExit();
        }
      } catch (e) {
        telemetryService.sendException(
          'force_source_deploy_with_sourcepath_beta',
          e.message
        );
        const deployOutput = {
          State: 'Error',
          ErrorMsg: e.message
        } as ToolingRetrieveResult;
        const parser = new ToolingDeployParser(deployOutput);
        const errorResult = await parser.outputResult(response.data);
        channelService.appendLine(errorResult);
        executionWrapper.failureExit();
      } finally {
        await DeployQueue.get().unlock();
      }
    } else {
      super.execute(response);
    }
  }

  protected getDeployType() {
    return DeployType.Deploy;
  }
}

export class MultipleSourcePathsGatherer implements ParametersGatherer<string> {
  private uris: vscode.Uri[];
  public constructor(uris: vscode.Uri[]) {
    this.uris = uris;
  }
  public async gather(): Promise<ContinueResponse<string>> {
    const sourcePaths = this.uris.map(uri => uri.fsPath).join(',');
    return {
      type: 'CONTINUE',
      data: sourcePaths
    };
  }
}

export async function forceSourceDeploySourcePath(sourceUri: vscode.Uri) {
  if (!sourceUri) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId !== 'forcesourcemanifest') {
      sourceUri = editor.document.uri;
    } else {
      const errorMessage = nls.localize(
        'force_source_deploy_select_file_or_directory'
      );
      telemetryService.sendException(
        'force_source_deploy_with_sourcepath',
        errorMessage
      );
      notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
      return;
    }
  }
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(sourceUri),
    new ForceSourceDeploySourcePathExecutor(),
    new SourcePathChecker()
  );
  await commandlet.run();
}

export async function forceSourceDeployMultipleSourcePaths(uris: vscode.Uri[]) {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new MultipleSourcePathsGatherer(uris),
    new ForceSourceDeploySourcePathExecutor()
  );
  await commandlet.run();
}
