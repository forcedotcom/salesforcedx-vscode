/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  Measurements,
  Properties,
  TelemetryData,
  telemetryService
} from '../../telemetry';
import { CommandletExecutor } from './sfdxCommandlet';

export abstract class LibraryCommandletExecutor<T>
  implements CommandletExecutor<T> {
  protected showChannelOutput = true;
  protected executionName: string = '';
  protected startTime: [number, number] | undefined;
  protected telemetryName: string | undefined;

  public async build(
    execName: string,
    telemetryLogName: string
  ): Promise<void> {}

  public async execute(response: ContinueResponse<T>): Promise<void> {}

  public logMetric(properties?: Properties, measurements?: Measurements) {
    telemetryService.sendCommandEvent(
      this.telemetryName,
      this.startTime,
      properties,
      measurements
    );
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
