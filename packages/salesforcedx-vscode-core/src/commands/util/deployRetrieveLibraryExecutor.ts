/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApiResult, SourceClient } from '@salesforce/source-deploy-retrieve';
import { languages, ProgressLocation, window } from 'vscode';
import { channelService } from '../../channels';
import { WorkspaceContext } from '../../context';
import { notificationService } from '../../notifications';
import { LibraryCommandletExecutor } from './libraryCommandlet';
import { outputRetrieveTable } from './retrieveParser';

export class DeployRetrieveLibraryExecutor extends LibraryCommandletExecutor<
  string
> {
  protected sourceClient: SourceClient | undefined;

  public static errorCollection = languages.createDiagnosticCollection(
    'deploy-errors'
  );

  public async build(
    execName: string,
    telemetryLogName: string
  ): Promise<void> {
    this.executionName = execName;
    this.telemetryName = telemetryLogName;
    const conn = await WorkspaceContext.get().getConnection();
    this.sourceClient = new SourceClient(conn);
  }

  public retrieveWrapper(fn: (...args: any[]) => Promise<ApiResult>) {
    const commandName = this.executionName;

    return async function(...args: any[]): Promise<ApiResult> {
      channelService.showCommandWithTimestamp(`Starting ${commandName}`);

      const result = await window.withProgress(
        {
          title: commandName,
          location: ProgressLocation.Notification
        },
        async () => {
          // @ts-ignore
          return (await fn.call(this, ...args)) as ApiResult;
        }
      );

      channelService.appendLine(outputRetrieveTable(result));
      channelService.showCommandWithTimestamp(`Finished ${commandName}`);
      await notificationService.showSuccessfulExecution(commandName);
      return result;
    };
  }
}
