/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator, SfConfigProperties } from '@salesforce/core';
import { GlobalCliEnvironment } from '../cli';
import { getRootWorkspacePath } from '../workspaces';

export const ENV_SFDX_DISABLE_TELEMETRY = 'SFDX_DISABLE_TELEMETRY';

export function disableCLITelemetry() {
  GlobalCliEnvironment.environmentVariables.set(
    ENV_SFDX_DISABLE_TELEMETRY,
    'true'
  );
}

export async function isCLITelemetryAllowed(): Promise<boolean> {
  try {
    const rootWorkspacePath = getRootWorkspacePath();
    process.chdir(rootWorkspacePath);
    const configAggregator: ConfigAggregator = await ConfigAggregator.create();
    const disableTelemetry:
      | string
      | undefined = configAggregator.getPropertyValue(
      SfConfigProperties.DISABLE_TELEMETRY
    );
    return disableTelemetry !== 'true';
  } catch (e) {
    console.log('Error checking cli settings: ' + e);
  }
  return true;
}
