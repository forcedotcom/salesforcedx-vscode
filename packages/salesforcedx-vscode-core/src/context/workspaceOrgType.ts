/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Org } from '@salesforce/core';
import * as vscode from 'vscode';
import { OrgAuthInfo, workspaceUtils } from '../util';
import { WorkspaceContext } from './workspaceContext';

export enum OrgType {
  SourceTracked,
  NonSourceTracked
}

/**
 * Determines whether the default org is source-tracked or not.
 * During dev it was observed that there were some potential issues with other options
 * (org.isScratch, org.tracksSource) related to cache-ing and a newly created
 * Scratch Org would sometimes return false.  Using org.supportsSourceTracking()
 * because it has been the most consistently accurate solution here.
 * @returns OrgType (SourceTracked or NonSourceTracked) of the current default org
 */
export async function getWorkspaceOrgType(): Promise<OrgType> {
  const workspaceContext = WorkspaceContext.getInstance();
  let connection;
  try {
    connection = await workspaceContext.getConnection();
  } catch (error) {
    console.warn(
      `An error was encountered while getting the org connection:\n ${error}`
    );
    return OrgType.NonSourceTracked;
  }
  const org = await Org.create({ connection });
  const isSourceTracked = await org.supportsSourceTracking();
  return isSourceTracked ? OrgType.SourceTracked : OrgType.NonSourceTracked;
}

export function setWorkspaceOrgTypeWithOrgType(orgType: OrgType) {
  setDefaultUsernameHasChangeTracking(orgType === OrgType.SourceTracked);
}

export async function setupWorkspaceOrgType(defaultUsernameOrAlias?: string) {
  setHasDefaultUsername(!!defaultUsernameOrAlias);
  const orgType = await getWorkspaceOrgType();
  setWorkspaceOrgTypeWithOrgType(orgType);
}

function setDefaultUsernameHasChangeTracking(val: boolean) {
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:default_username_has_change_tracking',
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
