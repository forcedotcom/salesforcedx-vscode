/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Org } from '@salesforce/core';
import * as vscode from 'vscode';
import { telemetryService } from '../telemetry';
import { OrgAuthInfo, workspaceUtils } from '../util';
import { WorkspaceContext } from './workspaceContext';

export enum OrgType {
  SourceTracked,
  NonSourceTracked
}

export async function getWorkspaceOrgType(): Promise<OrgType> {
  const connection = await WorkspaceContext.getInstance().getConnection();
  const org: Org = await Org.create({ connection });
  const isSourceTracked = await org.tracksSource();
  return isSourceTracked ? OrgType.SourceTracked : OrgType.NonSourceTracked;
}

export function setWorkspaceOrgTypeWithOrgType(orgType: OrgType) {
  setDefaultUsernameHasChangeTracking(orgType === OrgType.SourceTracked);
  setDefaultUsernameHasNoChangeTracking(orgType === OrgType.NonSourceTracked);
}

export async function setupWorkspaceOrgType(defaultUsernameOrAlias?: string) {
  try {
    setHasDefaultUsername(!!defaultUsernameOrAlias);
    const orgType = await getWorkspaceOrgType();
    setWorkspaceOrgTypeWithOrgType(orgType);
  } catch (e) {
    console.error(e);
    if (e instanceof Error) {
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

function setHasDefaultUsername(val: boolean) {
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:has_default_username',
    val
  );
}

export async function getDefaultUsernameOrAlias(): Promise<string | undefined> {
  if (workspaceUtils.hasRootWorkspace()) {
    return await OrgAuthInfo.getDefaultUsernameOrAlias(true);
  }
}
