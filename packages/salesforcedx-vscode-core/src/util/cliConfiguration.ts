/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { GlobalCliEnvironment } from '@salesforce/salesforcedx-utils';
import { execSync } from 'node:child_process';
import { ENV_NODE_EXTRA_CA_CERTS, ENV_SF_LOG_LEVEL } from '../constants';
import { salesforceCoreSettings } from '../settings';

export const isCLIInstalled = () => {
  try {
    const result = execSync('sfdx --version');
    console.log(result.toString());
    return true;
  } catch (e) {
    console.error('An error happened while looking for sfdx cli', e);
    return false;
  }
};

export const setNodeExtraCaCerts = () => {
  const extraCerts = salesforceCoreSettings.getNodeExtraCaCerts();
  if (extraCerts) {
    GlobalCliEnvironment.environmentVariables.set(ENV_NODE_EXTRA_CA_CERTS, extraCerts);
  }
};

export const setSfLogLevel = () => {
  GlobalCliEnvironment.environmentVariables.set(ENV_SF_LOG_LEVEL, salesforceCoreSettings.getSfLogLevel());
  process.env[ENV_SF_LOG_LEVEL] = salesforceCoreSettings.getSfLogLevel();
};
