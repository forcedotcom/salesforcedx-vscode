/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionContext, ExtensionKind, Uri } from 'vscode';
import { TelemetryService } from '..';
import { getExtensionInfo } from './activationTrackerUtils';

export type ExtensionInfo = {
  isActive: boolean;
  path: string;
  kind: ExtensionKind;
  uri: Uri;
  loadStartDate: Date;
};

export type ExtensionsInfo = {
  [extensionId: string]: ExtensionInfo;
};

export type ActivationInfo = Partial<ExtensionInfo> & {
  startActivateHrTime: [number, number];
  activateStartDate: Date;
  activationTime: number;
};

export class ActivationTracker {
  private extensionContext: ExtensionContext;
  private telemetryService: TelemetryService;
  private _activationInfo: ActivationInfo;

  constructor(
    extensionContext: ExtensionContext,
    telemetryService: TelemetryService
  ) {
    this.extensionContext = extensionContext;
    this.telemetryService = telemetryService;
    this._activationInfo = {
      startActivateHrTime: process.hrtime(),
      activateStartDate: new Date(),
      activationTime: 0
    };
  }

  async markActivationStop(): Promise<void> {
    const extensionInfo = await getExtensionInfo(this.extensionContext);
    // subtract Date.now from loadStartDate to get the time spent loading the extension if loadStartDate is not undefined
    const activationTime = extensionInfo?.loadStartDate
      ? Date.now() - extensionInfo.loadStartDate.getTime()
      : -1;

    this._activationInfo = {
      ...this._activationInfo,
      ...extensionInfo,
      activationTime
    };
    this.telemetryService.sendActivationEventInfo(this.activationInfo);
  }

  public get activationInfo(): ActivationInfo {
    return this._activationInfo;
  }
}
