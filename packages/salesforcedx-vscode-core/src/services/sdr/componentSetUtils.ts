/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { WorkspaceContext } from '../../context/workspaceContext';
import { SfdxProjectConfig } from '../../sfdxProject';

export async function setApiVersion(componentSet: ComponentSet): Promise<void> {
  // Check the SFDX configuration to see if there is an overridden api version.
  // Project level local sfdx-config takes precedence over global sfdx-config at system level.
  const userConfiguredApiVersion = await ConfigUtil.getUserConfiguredApiVersion();
  if (userConfiguredApiVersion) {
    componentSet.apiVersion = userConfiguredApiVersion;
    return;
  }

  // If no user-configured Api Version is present, then get the version from the Org.
  // const orgApiVersion = await getOrgApiVersion();
  // componentSet.apiVersion = orgApiVersion ?? componentSet.apiVersion;
  //
  // this is not needed, right?
  // confirm with Steve
}

export async function setSourceApiVersion(componentSet: ComponentSet): Promise<void> {
  // For a listing (and order of precedence) of how to retrieve the value of sourceApiVersion,
  // see "sourceApiVersion: Order of Precedence" in the "How API Version and Source API Version
  // Work in Salesforce CLI" doc.
  // https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_apiversion.htm

  // First, look for sourceApiVersion in a manifest file.  When LibrarySourceRetrieveManifestExecutor.getComponents()
  // is called, or LibrarySourceDeployManifestExecutor.getComponents() is called,  ComponentSet.fromManifest()
  // is called and the component set returned usually has the sourceApiVersion set...
  if (componentSet.sourceApiVersion) {
    // ...and at this point there is nothing else left to do.
    return;
  }

  // Next, attempt to get sourceApiVersion from sfdx-project.json...
  let sourceApiVersion = await SfdxProjectConfig.getValue<string>('sourceApiVersion');
  if (!sourceApiVersion) {
    // ...and if sourceApiVersion isn't defined, attempt to get the value from the config aggregator.
    sourceApiVersion = (await ConfigUtil.getUserConfiguredApiVersion())!;
  }

  // TODO: is #7 necessary?
  // and if so, is this the correct impl?
  if (!sourceApiVersion) {
    const orgApiVersion = await getOrgApiVersion();
    sourceApiVersion = orgApiVersion ?? componentSet.sourceApiVersion;
  }
  // confirm with Steve

  componentSet.sourceApiVersion = sourceApiVersion;
}

async function getOrgApiVersion(): Promise<string> {
  const connection = await WorkspaceContext.getInstance().getConnection();
  const apiVersion = connection.getApiVersion();
  return apiVersion;
}
