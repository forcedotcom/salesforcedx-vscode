/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { GlobalCliEnvironment } from '../cli';
import { ConfigUtil } from '../config/configUtil';

export const ENV_SF_DISABLE_TELEMETRY = 'SF_DISABLE_TELEMETRY';

export const disableCLITelemetry = () => {
  GlobalCliEnvironment.environmentVariables.set(ENV_SF_DISABLE_TELEMETRY, 'true');
};

export const isCLITelemetryAllowed = async (): Promise<boolean> => {
  try {
    const isTelemetryDisabled = await ConfigUtil.isTelemetryDisabled();
    return !isTelemetryDisabled;
  } catch (e) {
    console.log('Error checking cli settings: ' + e);
  }
  return true;
};
