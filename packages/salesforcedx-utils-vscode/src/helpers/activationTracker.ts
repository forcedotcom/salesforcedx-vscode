/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ActivationInfo, TelemetryServiceInterface } from '@salesforce/vscode-service-provider';
import { ExtensionContext } from 'vscode';
import { getExtensionInfo } from './activationTrackerUtils';

export class ActivationTracker {
  private extensionContext: ExtensionContext;
  private telemetryService: TelemetryServiceInterface;
  private _activationInfo: ActivationInfo;

  constructor(extensionContext: ExtensionContext, telemetryService: TelemetryServiceInterface) {
    this.extensionContext = extensionContext;
    this.telemetryService = telemetryService;
    this._activationInfo = {
      startActivateHrTime: process.hrtime(),
      activateStartDate: new Date(),
      extensionActivationTime: 0
    };
  }

  async markActivationStop(activationEndDate?: Date): Promise<void> {
    // capture date and elapsed HR time
    const activateEndDate = activationEndDate ?? new Date();
    const hrEnd = this.telemetryService.getEndHRTime(this._activationInfo.startActivateHrTime);
    // getting extension info. This may take up to 10 seconds, as log record creation might be lagging from
    // this code. All needed data have been captured for telemetry, so a wait here should have no effect
    // on quality of telemetry data
    const extensionInfo = await getExtensionInfo(this.extensionContext);
    let extensionActivationTime = -1;
    if (extensionInfo?.loadStartDate && activateEndDate.getTime() >= extensionInfo.loadStartDate.getTime()) {
      // subtract activateEndDate from loadStartDate to get the time spent loading the extension if loadStartDate is not undefined
      extensionActivationTime = activateEndDate.getTime() - extensionInfo.loadStartDate.getTime();
    }
    if (extensionActivationTime < 0) {
      this.telemetryService.sendExtensionActivationEvent(this._activationInfo.startActivateHrTime);
    } else {
      this._activationInfo = {
        ...this._activationInfo,
        ...extensionInfo,
        extensionActivationTime,
        activateEndDate,
        markEndTime: hrEnd
      };
      this.telemetryService.sendActivationEventInfo(this.activationInfo);
    }
  }

  public get activationInfo(): ActivationInfo {
    return this._activationInfo;
  }
}
