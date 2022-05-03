/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { sfdxCoreSettings } from '../settings';
import { telemetryService } from '../telemetry';
import { hasRootWorkspace, OrgAuthInfo } from '../util';


export enum OrgType {
  SourceTracked,
  NonSourceTracked
}

export async function getWorkspaceOrgType(
  defaultUsernameOrAlias?: string
): Promise<OrgType> {
  if (defaultUsernameOrAlias === null || defaultUsernameOrAlias === undefined) {
    const e = new Error();
    e.name = 'NoDefaultusernameSet';
    throw e;
  }

  const username = await OrgAuthInfo.getUsername(defaultUsernameOrAlias);
  const isScratchOrg = await OrgAuthInfo.isAScratchOrg(username).catch(err =>
    telemetryService.sendException(
      'get_workspace_org_type_scratch_org',
      err.message
    )
  );

  return isScratchOrg ? OrgType.SourceTracked : OrgType.NonSourceTracked;
}

export function setWorkspaceOrgTypeWithOrgType(orgType: OrgType) {
  if (orgType === OrgType.SourceTracked) {
    // Scratch org
    const deployAndRetrieveForSourceTrackedOrgs = sfdxCoreSettings.getDeployAndRetrieveForSourceTrackedOrgs();
    enableOrgBrowser(orgType, deployAndRetrieveForSourceTrackedOrgs);
    enablePushAndPullCommands(true);
    enableDeployAndRetrieveCommands(deployAndRetrieveForSourceTrackedOrgs);
  } else {
    // Developer edition org
    enableOrgBrowser(orgType);
    enablePushAndPullCommands(false);
    enableDeployAndRetrieveCommands(true);
  }
}

export async function setupWorkspaceOrgType(defaultUsernameOrAlias?: string) {
  try {
    setHasDefaultUsername(!!defaultUsernameOrAlias);
    const orgType = await getWorkspaceOrgType(defaultUsernameOrAlias);
    setWorkspaceOrgTypeWithOrgType(orgType);
  } catch (e) {
    telemetryService.sendException('send_workspace_org_type', e.message);
    switch (e.name) {
      case 'NamedOrgNotFound':
        // If the info for a default username cannot be found,
        // then assume that the org can be of either type
        setEnableOrgBrowser(true);
        enablePushAndPullCommands(true);
        enableDeployAndRetrieveCommands(true);
        break;
      case 'NoDefaultusernameSet':
        setEnableOrgBrowser(false);
        enablePushAndPullCommands(false);
        enableDeployAndRetrieveCommands(false);
        break;
      default:
        setEnableOrgBrowser(true);
        enablePushAndPullCommands(true);
        enableDeployAndRetrieveCommands(true);
    }
  }
}

export async function enableOrgBrowser(
  orgType: OrgType,
  deployAndRetrieveForSourceTrackedOrgs: boolean | undefined = undefined
) {
  if (orgType === OrgType.SourceTracked) {
    // Scratch org
    if (deployAndRetrieveForSourceTrackedOrgs === undefined) {
      deployAndRetrieveForSourceTrackedOrgs = sfdxCoreSettings.getDeployAndRetrieveForSourceTrackedOrgs();
    }
    setEnableOrgBrowser(deployAndRetrieveForSourceTrackedOrgs);
  } else {
    // Developer edition org
    setEnableOrgBrowser(true);
  }
}

function setEnableOrgBrowser(val: boolean) {
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:enable_org_browser',
    val
  );
}

function enablePushAndPullCommands(val: boolean) {
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:enable_push_and_pull_commands',
    val
  );
}

function enableDeployAndRetrieveCommands(val: boolean) {
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:enable_deploy_and_retrieve_commands',
    val
  );
}

function setHasDefaultUsername(val: boolean) {
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:has_default_username',
    val
  );
}

export async function getDefaultUsernameOrAlias(): Promise<string | undefined> {
  if (hasRootWorkspace()) {
    return await OrgAuthInfo.getDefaultUsernameOrAlias(true);
  }
}
