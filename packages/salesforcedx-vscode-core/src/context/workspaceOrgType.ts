/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import { telemetryService } from '../telemetry';
import { hasRootWorkspace, OrgAuthInfo } from '../util';

export enum OrgType {
  SourceTracked,
  NonSourceTracked
}

export async function getWorkspaceOrgType(
  defaultUsernameOrAlias?: string
): Promise<OrgType> {
  console.log(
    '-- workspaceOrgType.getWorkspaceOrgType, defaultUsernameOrAlias =>',
    defaultUsernameOrAlias
  );
  if (isNullOrUndefined(defaultUsernameOrAlias)) {
    const e = new Error();
    e.name = 'NoDefaultusernameSet';
    throw e;
  }

  const email = /^\w+([\.$-]*\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(
    defaultUsernameOrAlias
  );
  const isUsername = email ? true : false;
  const username = await OrgAuthInfo.getUsername(defaultUsernameOrAlias);

  if (isNullOrUndefined(username)) {
    telemetryService.sendError(
      `workspaceOrgType.getWorkspaceOrgType ran into an undefined username. Username email format = ${isUsername}`
    );
  }

  const isScratchOrg = await OrgAuthInfo.isAScratchOrg(username!).catch(err =>
    telemetryService.sendError(err)
  );
  return isScratchOrg ? OrgType.SourceTracked : OrgType.NonSourceTracked;
}

export function setWorkspaceOrgTypeWithOrgType(orgType: OrgType) {
  console.log(
    '-- workspaceOrgType.setWorkspaceOrgTypeWithOrgInfo, orgInfo =>',
    orgType
  );
  setDefaultUsernameHasChangeTracking(orgType === OrgType.SourceTracked);
  setDefaultUsernameHasNoChangeTracking(orgType === OrgType.NonSourceTracked);
}

export async function setupWorkspaceOrgType(defaultUsernameOrAlias?: string) {
  try {
    const orgType = await getWorkspaceOrgType(defaultUsernameOrAlias);
    setWorkspaceOrgTypeWithOrgType(orgType);
  } catch (e) {
    telemetryService.sendErrorEvent(e.message, e.stack);
    switch (e.name) {
      case 'NamedOrgNotFound':
        // If the info for a default username cannot be found,
        // then assume that the org can be of either type
        setDefaultUsernameHasChangeTracking(true);
        setDefaultUsernameHasNoChangeTracking(true);
        break;
      case 'NoDefaultusernameSet':
        setDefaultUsernameHasChangeTracking(false);
        setDefaultUsernameHasNoChangeTracking(false);
        break;
      default:
        setDefaultUsernameHasChangeTracking(true);
        setDefaultUsernameHasNoChangeTracking(true);
    }
  }
}

function setDefaultUsernameHasChangeTracking(val: boolean) {
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:default_username_has_change_tracking',
    val
  );
}

function setDefaultUsernameHasNoChangeTracking(val: boolean) {
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:default_username_has_no_change_tracking',
    val
  );
}

export async function getDefaultUsernameOrAlias(): Promise<string | undefined> {
  if (hasRootWorkspace()) {
    return await OrgAuthInfo.getDefaultUsernameOrAlias(true);
  }
}
