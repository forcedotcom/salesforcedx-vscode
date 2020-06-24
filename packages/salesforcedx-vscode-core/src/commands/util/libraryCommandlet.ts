/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  ApiResult,
  DeployResult,
  DeployStatusEnum,
  SourceClient
} from '@salesforce/source-deploy-retrieve';
import { languages, ProgressLocation, window } from 'vscode';
import { channelService } from '../../channels';
import { handleLibraryDiagnostics } from '../../diagnostics/diagnostics';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { Measurements, Properties, telemetryService } from '../../telemetry';
import { OrgAuthInfo } from '../../util';
import { LibraryDeployResultParser } from './libraryDeployResultParser';
import { outputRetrieveTable } from './retrieveParser';
import { CommandletExecutor } from './sfdxCommandlet';

export abstract class LibraryCommandletExecutor<T>
  implements CommandletExecutor<T> {
  protected showChannelOutput = true;
  protected executionName: string = '';
  protected startTime: [number, number] | undefined;
  protected telemetryName: string | undefined;

  public build(execName: string, telemetryLogName: string) {}

  public execute(response: ContinueResponse<T>): void {}

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
}
