/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ConfigUtil,
  GlobalCliEnvironment
} from '@salesforce/salesforcedx-utils-vscode';
import { which } from 'shelljs';
import { window } from 'vscode';
import {
  ENV_NODE_EXTRA_CA_CERTS,
  ENV_SF_DISABLE_TELEMETRY,
  SFDX_CLI_DOWNLOAD_LINK
} from '../constants';
import { nls } from '../messages';
import { sfdxCoreSettings } from '../settings';

export function isCLIInstalled(): boolean {
  let isInstalled = false;
  try {
    if (which('sfdx')) {
      isInstalled = true;
    }
  } catch (e) {
    console.error('An error happened while looking for sfdx cli', e);
  }
  return isInstalled;
}

export function showCLINotInstalledMessage() {
  const showMessage = nls.localize(
    'sfdx_cli_not_found',
    SFDX_CLI_DOWNLOAD_LINK,
    SFDX_CLI_DOWNLOAD_LINK
  );
  window.showWarningMessage(showMessage);
}

export function disableCLITelemetry() {
  GlobalCliEnvironment.environmentVariables.set(
    ENV_SF_DISABLE_TELEMETRY,
    'true'
  );
}

export async function isCLITelemetryAllowed() {
  const isTelemetryDisabled = await ConfigUtil.isTelemetryDisabled();
  return !isTelemetryDisabled;
}

export function setNodeExtraCaCerts() {
  GlobalCliEnvironment.environmentVariables.set(
    ENV_NODE_EXTRA_CA_CERTS,
    sfdxCoreSettings.getNodeExtraCaCerts()
  );
}
