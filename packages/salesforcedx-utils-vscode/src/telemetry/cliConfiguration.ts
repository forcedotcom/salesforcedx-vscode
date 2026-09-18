/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SF_CONFIG_DISABLE_TELEMETRY } from '../constants';
import { ConfigAggregatorProvider } from '../providers/configAggregatorProvider';

export const isCLITelemetryAllowed = async (): Promise<boolean> => {
  // In web mode, ConfigAggregator may not work correctly, so default to allowing telemetry
  if (process.env.ESBUILD_PLATFORM === 'web') {
    return true;
  }
  try {
    const configAggregator = await ConfigAggregatorProvider.getInstance().getConfigAggregator();
    return configAggregator.getPropertyValue(SF_CONFIG_DISABLE_TELEMETRY) !== 'true';
  } catch (e) {
    console.log(`Error checking cli settings: ${e}`);
  }
  return true;
};
