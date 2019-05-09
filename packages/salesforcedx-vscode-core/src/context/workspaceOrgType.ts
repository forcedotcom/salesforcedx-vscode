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
  if (!isNullOrUndefined(defaultUsernameOrAlias)) {
    const username = await OrgAuthInfo.getUsername(defaultUsernameOrAlias!);
    const isScratchOrg = await OrgAuthInfo.isAScratchOrg(username).catch(err =>
      telemetryService.sendError(err)
    );
    return isScratchOrg ? OrgType.SourceTracked : OrgType.NonSourceTracked;
  }

  const e = new Error();
  e.name = 'NoDefaultusernameSet';
  throw e;
}

export async function setupWorkspaceOrgType(defaultUsernameOrAlias?: string) {
  try {
    const orgType = await getWorkspaceOrgType(defaultUsernameOrAlias);
    setDefaultUsernameHasChangeTracking(orgType === OrgType.SourceTracked);
    setDefaultUsernameHasNoChangeTracking(orgType === OrgType.NonSourceTracked);
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
