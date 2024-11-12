/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigUtil, GlobalCliEnvironment } from '@salesforce/salesforcedx-utils-vscode';
import { which } from 'shelljs';
import { window } from 'vscode';
import {
  ENV_NODE_EXTRA_CA_CERTS,
  ENV_SF_DISABLE_TELEMETRY,
  ENV_SF_LOG_LEVEL,
  SF_CLI_DOWNLOAD_LINK
} from '../constants';
import { nls } from '../messages';
import { salesforceCoreSettings } from '../settings';

export const isCLIInstalled = () => {
  let isInstalled = false;
  try {
    if (which('sfdx')) {
      isInstalled = true;
    }
  } catch (e) {
    console.error('An error happened while looking for sfdx cli', e);
  }
  return isInstalled;
};

export const showCLINotInstalledMessage = () => {
  const showMessage = nls.localize('salesforce_cli_not_found', SF_CLI_DOWNLOAD_LINK, SF_CLI_DOWNLOAD_LINK);
  void window.showWarningMessage(showMessage);
};

export const disableCLITelemetry = () => {
  GlobalCliEnvironment.environmentVariables.set(ENV_SF_DISABLE_TELEMETRY, 'true');
};

export const isCLITelemetryAllowed = async () => {
  const isTelemetryDisabled = await ConfigUtil.isTelemetryDisabled();
  return !isTelemetryDisabled;
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
