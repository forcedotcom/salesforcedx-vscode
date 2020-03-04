/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  CompositeCliCommandExecution,
  CompositeCliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  Row,
  Table
} from '@salesforce/salesforcedx-utils-vscode/out/src/output';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { ToolingDeploy, ToolingRetrieveResult } from '../deploys';
import { nls } from '../messages';
import { OrgAuthInfo, ToolingDeployParser } from '../util';
import { SfdxCommandletExecutor } from './util';

export class DeployRetrieveExecutor extends SfdxCommandletExecutor<{}> {
  public build(sourcePath: string): Command {
    const commandBuilder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_deploy_text'))
      .withArg('force:source:deploy')
      .withLogName('force_source_tooling_deploy')
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
      const usernameOrAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(true);
      let username: string | undefined;
      if (usernameOrAlias) {
        username = await OrgAuthInfo.getUsername(usernameOrAlias);
      }
      await deployLibrary.init(username!);
      const deployOutput = await deployLibrary.deploy({
        FilePathOpts: { filepath: response.data }
      });

      const parser = new ToolingDeployParser(deployOutput!);
      await this.outputResult(executionWrapper, parser);
    } catch (e) {
      const deployOutput = {
        State: 'Error',
        ErrorMsg: e.message
      } as ToolingRetrieveResult;
      const parser = new ToolingDeployParser(deployOutput);
      await this.outputResult(executionWrapper, parser, response.data);
    }
  }

  public async outputResult(
    executionWrapper: CompositeCliCommandExecution,
    parser: ToolingDeployParser,
    sourceUri?: string
  ) {
    const table = new Table();
    let title: string;
    switch (parser.result.State) {
      case 'Completed':
        title = nls.localize(`table_title_deployed_source`);
        const successRows = parser.buildSuccesses(
          parser.result.DeployDetails.componentSuccesses[0]
        );
        const successTable = table.createTable(
          (successRows as unknown) as Row[],
          [
            { key: 'state', label: nls.localize('table_header_state') },
            { key: 'fullName', label: nls.localize('table_header_full_name') },
            { key: 'type', label: nls.localize('table_header_type') },
            {
              key: 'filePath',
              label: nls.localize('table_header_project_path')
            }
          ],
          title
        );
        channelService.appendLine(successTable);
        executionWrapper.successfulExit();
        break;
      case 'Failed':
        const failedErrorRows = parser.buildErrors(
          parser.result.DeployDetails.componentFailures
        );
        const failedErrorTable = table.createTable(
          (failedErrorRows as unknown) as Row[],
          [
            {
              key: 'filePath',
              label: nls.localize('table_header_project_path')
            },
            { key: 'error', label: nls.localize('table_header_errors') }
          ],
          nls.localize(`table_title_deploy_errors`)
        );
        channelService.appendLine(failedErrorTable);
        executionWrapper.failureExit();
        break;
      case 'Queued':
        const queueError =
          'Unexpected error retrieving your ContainerAsyncRequest';
        const queueRows = [{ filePath: sourceUri, error: queueError }];
        const queueErrorTable = table.createTable(
          (queueRows as unknown) as Row[],
          [
            {
              key: 'filePath',
              label: nls.localize('table_header_project_path')
            },
            { key: 'error', label: nls.localize('table_header_errors') }
          ],
          nls.localize(`table_title_deploy_errors`)
        );
        channelService.appendLine(queueErrorTable);
        executionWrapper.failureExit();
        break;
      case 'Error':
        const error = parser.result.ErrorMsg!;
        const errorRows = [{ filePath: sourceUri, error }];
        const errorTable = table.createTable(
          (errorRows as unknown) as Row[],
          [
            {
              key: 'filePath',
              label: nls.localize('table_header_project_path')
            },
            { key: 'error', label: nls.localize('table_header_errors') }
          ],
          nls.localize(`table_title_deploy_errors`)
        );
        channelService.appendLine(errorTable);
        executionWrapper.failureExit();
        break;
    }
  }
}
