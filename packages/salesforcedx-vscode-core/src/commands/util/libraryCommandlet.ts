/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { channelService } from '../../channels';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { TelemetryBuilder, telemetryService } from '../../telemetry';
import { CommandletExecutor } from './sfdxCommandlet';

export abstract class LibraryCommandletExecutor<T>
  implements CommandletExecutor<T> {
  protected readonly telemetry = new TelemetryBuilder();
  protected readonly revealChannelOutput = false;
  protected abstract readonly logName: string;
  protected abstract readonly executionName: string;

  protected abstract run(
    response: ContinueResponse<T>
  ): Promise<boolean>;

  public async execute(
    response: ContinueResponse<T>
  ): Promise<void> {
    const startTime = process.hrtime();

    channelService.showCommandWithTimestamp(`Starting ${this.executionName}\n`);

    if (this.revealChannelOutput) {
      channelService.showChannelOutput();
    }

    try {
      const success = await vscode.window.withProgress(
        {
          title: nls.localize('progress_notification_text', this.executionName),
          location: vscode.ProgressLocation.Notification
        },
        () => this.run(response)
      );

      channelService.showCommandWithTimestamp(`Finished ${this.executionName}`);

      if (success) {
        notificationService
          .showSuccessfulExecution(this.executionName)
          .catch(e => console.error(e));
      } else {
        notificationService.showFailedExecution(this.executionName);
      }

      this.telemetry.addProperty('success', String(success));
      const { properties, measurements } = this.telemetry.build();
      telemetryService.sendCommandEvent(
        this.logName,
        startTime,
        properties,
        measurements
      );

    } catch (e) {
      telemetryService.sendException(e.name, e.message);
      notificationService.showFailedExecution(this.executionName);
      channelService.appendLine(e.message);
      channelService.showChannelOutput();
    }
  }
}
