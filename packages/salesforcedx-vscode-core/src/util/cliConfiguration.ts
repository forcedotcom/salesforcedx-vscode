/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ForceConfigGet,
  GlobalCliEnvironment
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { which } from 'shelljs';
import { window } from 'vscode';
import {
  ENV_SFDX_DISABLE_TELEMETRY,
  SFDX_CLI_DOWNLOAD_LINK,
  SFDX_CONFIG_DISABLE_TELEMETRY
} from '../constants';
import { nls } from '../messages';

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

export function isSFDXContainerMode(): boolean {
  return process.env.SFDX_CONTAINER_MODE ? true : false;
}

export function disableCLITelemetry() {
  GlobalCliEnvironment.environmentVariables.set(
    ENV_SFDX_DISABLE_TELEMETRY,
    'true'
  );
}

export async function isCLITelemetryAllowed(
  projectPath: string
): Promise<boolean> {
  // if (isCLIInstalled()) {
  //   const forceConfig = await new ForceConfigGet().getConfig(
  //     projectPath,
  //     SFDX_CONFIG_DISABLE_TELEMETRY
  //   );
  //   const disabledConfig = forceConfig.get(SFDX_CONFIG_DISABLE_TELEMETRY) || '';
  //   return disabledConfig !== 'true';
  // }
  return true;
}
