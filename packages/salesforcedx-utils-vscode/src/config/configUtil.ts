/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ConfigAggregator,
  OrgConfigProperties,
  SfConfigProperties
} from '@salesforce/core';
import * as path from 'path';
import { GlobalCliEnvironment } from '../cli';
import { TelemetryService } from '../telemetry/telemetry';
import { getRootWorkspacePath } from '../workspaces';

export enum ConfigSource {
  Local,
  Global,
  None
}

export function disableCLITelemetry() {
  const ENV_SFDX_DISABLE_TELEMETRY = 'SFDX_DISABLE_TELEMETRY';
  GlobalCliEnvironment.environmentVariables.set(
    ENV_SFDX_DISABLE_TELEMETRY,
    'true'
  );
}

async function getConfigAggregator(): Promise<ConfigAggregator> {
  const origCurrentWorkingDirectory = process.cwd();
  const rootWorkspacePath = getRootWorkspacePath();
  // Change the current working directory to the project path,
  // so that ConfigAggregator reads the local project values
  process.chdir(rootWorkspacePath);
  const configAggregator = await ConfigAggregator.create();
  // Change the current working directory back to what it was
  // before returning
  process.chdir(origCurrentWorkingDirectory);
  return configAggregator;
}

export async function isCLITelemetryAllowed(): Promise<boolean> {
  try {
    const configAggregator = await getConfigAggregator();
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

export async function getDefaultUsernameOrAlias(): Promise<string | undefined> {
  try {
    const configAggregator = await getConfigAggregator();
    const defaultUserNameOrAlias = configAggregator.getPropertyValue(
      OrgConfigProperties.TARGET_ORG
    );
    if (defaultUserNameOrAlias === undefined) {
      return undefined;
    }
    return JSON.stringify(defaultUserNameOrAlias).replace(/\"/g, '');
  } catch (err) {
    console.error(err);
    TelemetryService.getInstance().sendException(
      'get_default_username_alias',
      err.message
    );
    return undefined;
  }
}

export async function getApiVersion(): Promise<string> {
  const configAggregator = await getConfigAggregator();
  return configAggregator.getPropertyValue(
    OrgConfigProperties.ORG_API_VERSION
  ) as string;
}
