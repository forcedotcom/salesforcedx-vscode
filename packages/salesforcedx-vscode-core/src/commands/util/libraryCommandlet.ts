/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
// import {
//   ApiResult,
//   DeployResult,
//   DeployStatusEnum,
//   SourceClient
// } from '@salesforce/source-deploy-retrieve';
// import { languages, ProgressLocation, window } from 'vscode';
// import { channelService } from '../../channels';
// import { handleLibraryDiagnostics } from '../../diagnostics/diagnostics';
// import { nls } from '../../messages';
// import { notificationService } from '../../notifications';
import {
  Measurements,
  Properties,
  TelemetryData,
  telemetryService
} from '../../telemetry';
// import { OrgAuthInfo } from '../../util';
// import { LibraryDeployResultParser } from './libraryDeployResultParser';
// import { outputRetrieveTable } from './retrieveParser';
import { CommandletExecutor } from './sfdxCommandlet';

export abstract class LibraryCommandletExecutor<T>
  implements CommandletExecutor<T> {
  // public static errorCollection = languages.createDiagnosticCollection(
  //   'deploy-errors'
  // );
  protected showChannelOutput = true;
  // protected sourceClient: SourceClient | undefined;
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
