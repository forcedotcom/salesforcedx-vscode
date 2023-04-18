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

/**
 * @description determines whether the default org is source-tracked or not.
 * During dev it was observed that there were some potential issues with other options
 * (org.isScratch, org.tracksSource) related to cache-ing and a newly created
 * Scratch Org would sometimes return false.  Using org.supportsSourceTracking()
 * because it has been the most consistently accurate solution here.
 * @returns OrgType (SourceTracked or NonSourceTracked) of the current default org
 */
export async function getWorkspaceOrgType(): Promise<OrgType> {
  const workspaceContext = WorkspaceContext.getInstance();
  const connection = await workspaceContext.getConnection();
  const org = await Org.create({ connection });
  const isSourceTracked = await org.supportsSourceTracking();
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
        case 'NoUsernameFoundError':
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
