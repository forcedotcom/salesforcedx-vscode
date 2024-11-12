/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import { WorkspaceContext } from '../../context/workspaceContext';
import { SalesforceProjectConfig } from '../../salesforceProject';

const setApiVersion = async (componentSet: ComponentSet): Promise<void> => {
  // For a listing (and order of precedence) of how to retrieve the value of apiVersion,
  // see "apiVersion: Order of Precedence" in the "How API Version and Source API Version
  // Work in Salesforce CLI" doc.
  // https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_apiversion.htm

  // Check the SFDX configuration to see if there is an overridden api version.
  // Project level local config takes precedence over global config at system level.
  const userConfiguredApiVersion = await ConfigUtil.getUserConfiguredApiVersion();
  if (userConfiguredApiVersion) {
    componentSet.apiVersion = userConfiguredApiVersion;
    return;
  }

  // If no user-configured API Version is present, then get the version from the org.
  const orgApiVersion = await componentSetUtils.getOrgApiVersion();
  componentSet.apiVersion = orgApiVersion && orgApiVersion.length > 0 ? orgApiVersion : componentSet.apiVersion;
};

const setSourceApiVersion = async (componentSet: ComponentSet): Promise<void> => {
  // For a listing (and order of precedence) of how to retrieve the value of sourceApiVersion,
  // see "sourceApiVersion: Order of Precedence" in the "How API Version and Source API Version
  // Work in Salesforce CLI" doc.
  // https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_apiversion.htm

  // First, look for sourceApiVersion in a manifest file.  When LibraryRetrieveManifestExecutor.getComponents()
  // is called, or LibraryDeployManifestExecutor.getComponents() is called, ComponentSet.fromManifest()
  // is called and the component set returned usually has the sourceApiVersion set...
  if (componentSet.sourceApiVersion) {
    // ...and at this point there is nothing else left to do.
    return;
  }

  // Next, attempt to get sourceApiVersion from sfdx-project.json...
  let sourceApiVersion = await SalesforceProjectConfig.getValue<string>('sourceApiVersion');
  if (!sourceApiVersion) {
    // ...and if sourceApiVersion isn't defined, attempt to get the value from the config aggregator.
    sourceApiVersion = (await ConfigUtil.getUserConfiguredApiVersion())!;
  }

  // Next, if it still is not set, set it to the highest API version supported by the target org.
  if (!sourceApiVersion) {
    const orgApiVersion = await componentSetUtils.getOrgApiVersion();
    sourceApiVersion = orgApiVersion;
  }

  componentSet.sourceApiVersion = sourceApiVersion;
};

const getOrgApiVersion = async (): Promise<string> => {
  const connection = await WorkspaceContext.getInstance().getConnection();
  const apiVersion = connection.getApiVersion();

  return apiVersion;
};

export const componentSetUtils = {
  setApiVersion,
  setSourceApiVersion,
  getOrgApiVersion
};
