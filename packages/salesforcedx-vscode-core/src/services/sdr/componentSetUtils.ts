/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';

import { WorkspaceContext } from '../../context/workspaceContext';

export async function setApiVersionOn(components: ComponentSet) {
  // Check the SFDX configuration to see if there is an overridden api version.
  // Project level local sfdx-config takes precedence over global sfdx-config at system level.
  const userConfiguredApiVersion = await ConfigUtil.getUserConfiguredApiVersion();

  if (userConfiguredApiVersion) {
    components.apiVersion = userConfiguredApiVersion;
    return;
  }

  // If no user-configured Api Version is present, then get the version from the Org.
  const orgApiVersion = await getOrgApiVersion();
  components.apiVersion = orgApiVersion ?? components.apiVersion;
}

async function getOrgApiVersion(): Promise<string> {
  const connection = await WorkspaceContext.getInstance().getConnection();
  const apiVersion = connection.getApiVersion();
  return apiVersion;
}
