/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApiResult, SourceClient } from '@salesforce/source-deploy-retrieve';
import { languages, ProgressLocation, window } from 'vscode';
import { channelService } from '../../channels';
import { handleDeployRetrieveLibraryDiagnostics } from '../../diagnostics';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { OrgAuthInfo } from '../../util';
import { LibraryCommandletExecutor } from './libraryCommandlet';
import { LibraryDeployResultParser } from './libraryDeployResultParser';
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

    const usernameOrAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(true);
    if (!usernameOrAlias) {
      throw new Error(nls.localize('error_no_default_username'));
    }
    const conn = await OrgAuthInfo.getConnection(usernameOrAlias);
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
