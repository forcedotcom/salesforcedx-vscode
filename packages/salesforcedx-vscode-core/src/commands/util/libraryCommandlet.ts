/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  DeployResult,
  DeployStatusEnum,
  SourceClient
} from '@salesforce/source-deploy-retrieve';
import { ProgressLocation, window } from 'vscode';
import { channelService } from '../../channels';
import { ToolingDeployParser } from '../../deploys';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { TelemetryData, telemetryService } from '../../telemetry';
import { OrgAuthInfo } from '../../util';
import { CommandletExecutor } from './sfdxCommandlet';

export abstract class LibraryCommandletExecutor<T>
  implements CommandletExecutor<T> {
  protected showChannelOutput = true;
  protected sourceClient: SourceClient | undefined;
  protected executionName: string = '';
  protected startTime: [number, number] | undefined;
  protected telemetryName: string | undefined;

  public execute(response: ContinueResponse<T>): void {}

  public async build(
    execName: string,
    telemetryLogName: string
  ): Promise<void> {
    this.executionName = execName;
    this.telemetryName = telemetryLogName;
    // initialize connection
    const usernameOrAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(true);
    if (!usernameOrAlias) {
      throw new Error(nls.localize('error_no_default_username'));
    }
    const conn = await OrgAuthInfo.getConnection(usernameOrAlias);
    this.sourceClient = new SourceClient(conn);
  }

  public deployWrapper(fn: (...args: any[]) => Promise<DeployResult>) {
    const commandName = this.executionName;

    return async function(...args: any[]): Promise<DeployResult> {
      channelService.showCommandWithTimestamp(`Starting ${commandName}`);

      const result = await window.withProgress(
        {
          title: commandName,
          location: ProgressLocation.Notification
        },
        async () => {
          // @ts-ignore
          return (await fn.call(this, ...args)) as DeployResult;
        }
      );

      const parser = new ToolingDeployParser(result);
      const outputResult = await parser.outputResult();
      channelService.appendLine(outputResult);
      channelService.showCommandWithTimestamp(`Finished ${commandName}`);

      if (
        result.State === DeployStatusEnum.Completed ||
        result.State === DeployStatusEnum.Queued
      ) {
        await notificationService.showSuccessfulExecution(commandName);
      } else {
        notificationService.showFailedExecution(commandName);
      }
      return result;
    };
  }

  public logMetric() {
    telemetryService.sendCommandEvent(this.telemetryName, this.startTime);
  }

  public setStartTime() {
    this.startTime = process.hrtime();
  }

  protected getTelemetryData(
    success: boolean,
    response: ContinueResponse<T>,
    output: string
  ): TelemetryData | undefined {
    return;
  }
}
