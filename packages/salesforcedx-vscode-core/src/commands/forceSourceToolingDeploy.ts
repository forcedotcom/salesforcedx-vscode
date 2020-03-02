/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  CompositeCliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { FilePathOpts, ToolingDeploy } from '../deploys';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';
import { OrgAuthInfo } from '../util';
import { SourcePathChecker } from './forceSourceRetrieveSourcePath';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

export class DeployRetrieveExecutor extends SfdxCommandletExecutor<{}> {
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
      this.logMetric(executionWrapper.command.logName, startTime);
    });

    try {
      const deployLibrary = new ToolingDeploy();
      // figure out username situation
      const usernameOrAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(true);
      let username: string | undefined;
      if (usernameOrAlias) {
        username = await OrgAuthInfo.getUsername(usernameOrAlias);
      }
      await deployLibrary.init(username!);
      await deployLibrary.deploy({ FilePathOpts: { filepath: response.data } });
      executionWrapper.successfulExit();
    } catch (e) {
      executionWrapper.failureExit(e);
    }
  }
}

export async function forceSourceToolingDeploy(sourceUri: vscode.Uri) {
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
    const commandlet = new SfdxCommandlet(
      new SfdxWorkspaceChecker(),
      new FilePathGatherer(sourceUri),
      new DeployRetrieveExecutor(),
      new SourcePathChecker()
    );
    await commandlet.run();
  }
}
