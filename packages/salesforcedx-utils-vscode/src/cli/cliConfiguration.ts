/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { GlobalCliEnvironment } from './commandExecutor';
import { ConfigUtil } from './configUtil';

export const ENV_SFDX_DISABLE_TELEMETRY = 'SFDX_DISABLE_TELEMETRY';
export const SFDX_CONFIG_DISABLE_TELEMETRY = 'disableTelemetry';

export function disableCLITelemetry() {
  GlobalCliEnvironment.environmentVariables.set(
    ENV_SFDX_DISABLE_TELEMETRY,
    'true'
  );
}

export async function isCLITelemetryAllowed(): Promise<boolean> {
  try {
    const disabledConfig =
      (await ConfigUtil.getConfigValue(SFDX_CONFIG_DISABLE_TELEMETRY)) || '';
    return disabledConfig !== 'true';
  } catch (e) {
    console.log('Error checking cli settings: ' + e);
  }
  return true;
}
