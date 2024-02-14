/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';

export class ReplayDebuggerTelemetryService extends TelemetryService {
  constructor() {
    super();
  }

  public static getInstance(extensionName?: string | undefined): ReplayDebuggerTelemetryService {
    return TelemetryService.getInstance(extensionName) as ReplayDebuggerTelemetryService;
  }

  public sendLaunchEvent(logSizeStr: string, errorMsg: string): void {
    this.sendEventData('launchDebuggerSession', {
      logSize: logSizeStr,
      errorMessage: errorMsg
    });
  }

  public sendCheckpointEvent(errorMsg: string): void {
      this.sendEventData('updateCheckpoints', {
        errorMessage: errorMsg
      });
  }

  public sendErrorEvent(errorMsg: string, callstack: string): void {
      this.sendEventData('error', {
        errorMessage: errorMsg,
        errorStack: callstack
      });
  }
}
