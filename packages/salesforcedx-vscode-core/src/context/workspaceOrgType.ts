/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Org } from '@salesforce/core-bundle';
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
export const getWorkspaceOrgType = async (): Promise<OrgType> => {
  const workspaceContext = WorkspaceContext.getInstance();
  let connection;
  try {
    connection = await workspaceContext.getConnection();
  } catch (error) {
    console.warn(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `An error was encountered while getting the org connection:\n ${error}`
    );
    return OrgType.NonSourceTracked;
  }
  const org = await Org.create({ connection });
  const isSourceTracked = await org.supportsSourceTracking();
  return isSourceTracked ? OrgType.SourceTracked : OrgType.NonSourceTracked;
};

export const setWorkspaceOrgTypeWithOrgType = (orgType: OrgType): void => {
  setTargetOrgHasChangeTracking(orgType === OrgType.SourceTracked);
};

export const setupWorkspaceOrgType = async (targetOrgOrAlias?: string) => {
  setHasTargetOrg(!!targetOrgOrAlias);
  const orgType = await getWorkspaceOrgType();
  setWorkspaceOrgTypeWithOrgType(orgType);
};

const setTargetOrgHasChangeTracking = (val: boolean): void => {
  void vscode.commands.executeCommand('setContext', 'sf:target_org_has_change_tracking', val);
};

const setHasTargetOrg = (val: boolean): void => {
  void vscode.commands.executeCommand('setContext', 'sf:has_target_org', val);
};

export const getTargetOrgOrAlias = (): Promise<string | undefined> => {
  if (workspaceUtils.hasRootWorkspace()) {
    return OrgAuthInfo.getTargetOrgOrAlias(true);
  }
  return Promise.resolve(undefined);
};
