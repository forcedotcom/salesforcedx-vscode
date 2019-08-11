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
  if (isNullOrUndefined(defaultUsernameOrAlias)) {
    const e = new Error();
    e.name = 'NoDefaultusernameSet';
    throw e;
  }

  const username = await OrgAuthInfo.getUsername(defaultUsernameOrAlias);

  if (isNullOrUndefined(username)) {
    telemetryService.sendException(
      'get_workspace_org_type',
      'workspaceOrgType.getWorkspaceOrgType ran into an undefined username.'
    );
  }

  const isScratchOrg = await OrgAuthInfo.isAScratchOrg(username!).catch(err =>
    telemetryService.sendException('get_workspace_org_type_scratch_org', err)
  );
  return isScratchOrg ? OrgType.SourceTracked : OrgType.NonSourceTracked;
}

export function setWorkspaceOrgTypeWithOrgType(orgType: OrgType) {
  setDefaultUsernameHasChangeTracking(orgType === OrgType.SourceTracked);
  setDefaultUsernameHasNoChangeTracking(orgType === OrgType.NonSourceTracked);
}

export async function setupWorkspaceOrgType(defaultUsernameOrAlias?: string) {
  try {
    const orgType = await getWorkspaceOrgType(defaultUsernameOrAlias);
    setWorkspaceOrgTypeWithOrgType(orgType);
  } catch (e) {
    telemetryService.sendException('send_workspace_org_type', e.message);
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
