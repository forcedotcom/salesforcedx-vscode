/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';

export const telemetryService = TelemetryService.getInstance();

export type TelemetryModelJson = {
  fields: number;
  orderBy: number;
  limit: number;
  errors: number;
  unsupported: number;
};
