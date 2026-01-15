/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { telemetryService } from '../telemetry/telemetry';

/**
 * Simple activation tracker that measures activation time.
 * Replaces ActivationTracker from @salesforce/salesforcedx-utils-vscode
 */
export class ActivationTracker {
  private startTime: number;

  constructor(
    _context: vscode.ExtensionContext,
    private telemetry: typeof telemetryService
  ) {
    this.startTime = Date.now();
  }

  public markActivationStop(): void {
    const duration = Date.now() - this.startTime;
    this.telemetry.sendEventData('activation', {}, { duration });
  }
}
