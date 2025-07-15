/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionContext } from 'vscode';
import { ActivationInfo, TelemetryServiceInterface } from '../types';
import { TimingUtils } from './timingUtils';

/**
 * Tracks extension activation time using TimingUtils
 */
export class ActivationTracker {
  private readonly telemetryService: TelemetryServiceInterface;
  private readonly startTime: number;

  constructor(extensionContext: ExtensionContext, telemetryService: TelemetryServiceInterface) {
    this.telemetryService = telemetryService;
    this.startTime = TimingUtils.getCurrentTime();
  }

  public markActivationStop(): void {
    const endTime = TimingUtils.getCurrentTime();
    const activationInfo: ActivationInfo = {
      startActivateHrTime: this.startTime,
      activateStartDate: new Date(this.startTime),
      activateEndDate: new Date(endTime),
      extensionActivationTime: TimingUtils.getElapsedTime(this.startTime),
      markEndTime: endTime
    };

    this.telemetryService.sendActivationEventInfo(activationInfo);
  }
}
