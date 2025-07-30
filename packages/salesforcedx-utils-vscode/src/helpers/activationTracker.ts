/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionContext } from 'vscode';
import { ActivationInfo, TelemetryServiceInterface } from '../types';
import { getExtensionInfo } from './activationTrackerUtils';
import { TimingUtils } from './timingUtils';

/**
 * Tracks extension activation time using TimingUtils
 */
export class ActivationTracker {
  private readonly extensionContext: ExtensionContext;
  private readonly telemetryService: TelemetryServiceInterface;
  private readonly startTime: number;
  private readonly activateStartDate: Date;

  constructor(extensionContext: ExtensionContext, telemetryService: TelemetryServiceInterface) {
    this.extensionContext = extensionContext;
    this.telemetryService = telemetryService;
    this.startTime = TimingUtils.getCurrentTime();
    this.activateStartDate = new Date(); // Store actual start date
  }

  public async markActivationStop(): Promise<void> {
    // capture date and elapsed HR time
    const endTime = TimingUtils.getCurrentTime();
    const activateEndDate = new Date(); // Store actual end date

    // getting extension info. This may take up to 10 seconds, as log record creation might be lagging from
    // this code. All needed data have been captured for telemetry, so a wait here should have no effect
    // on quality of telemetry data
    let extensionInfo;
    try {
      extensionInfo = await getExtensionInfo(this.extensionContext);
    } catch {
      // If getExtensionInfo fails (e.g., in test environments), continue without extension info
      extensionInfo = undefined;
    }

    const activationInfo: ActivationInfo = {
      startActivateHrTime: this.startTime,
      activateStartDate: this.activateStartDate,
      activateEndDate,
      extensionActivationTime: TimingUtils.getElapsedTime(this.startTime),
      markEndTime: endTime,
      // Include loadStartDate from extension info if available
      loadStartDate: extensionInfo?.loadStartDate
    };

    this.telemetryService.sendActivationEventInfo(activationInfo);
  }
}
