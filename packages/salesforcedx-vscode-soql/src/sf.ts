/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DescribeSObjectResult } from './types';
import { ChannelService, OrgUserInfo, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as debounce from 'debounce';
import * as vscode from 'vscode';
import { nls } from './messages';

export const channelService = ChannelService.getInstance(nls.localize('soql_channel_name'));

export const workspaceContext = WorkspaceContextUtil.getInstance();

const showChannelAndErrorMessage = (e: string) => {
  channelService.appendLine(e);
  const message = nls.localize('error_connection');
  void vscode.window.showErrorMessage(message);
};

/** exported for test spy */
export const debouncedShowChannelAndErrorMessage = debounce(showChannelAndErrorMessage, 1000);

export const retrieveSObjects = async (): Promise<string[]> => {
  try {
    const conn = await workspaceContext.getConnection();
    return (await conn.describeGlobal$()).sobjects.filter(o => o.queryable).map(o => o.name);
  } catch (e) {
    debouncedShowChannelAndErrorMessage(e);
  }
};

export const retrieveSObject = async (sobjectName: string): Promise<DescribeSObjectResult> => {
  try {
    const conn = await workspaceContext.getConnection();
    return await conn.describe$(sobjectName);
  } catch (e) {
    debouncedShowChannelAndErrorMessage(e);
  }
};

export const onOrgChangeDefaultHandler = async (orgInfo: OrgUserInfo): Promise<void> => {
  try {
    const conn = await workspaceContext.getConnection();
    conn.describeGlobal$.clear();
    conn.describe$.clear();
  } catch (e) {
    if (Boolean(orgInfo.username)) {
      debouncedShowChannelAndErrorMessage(e);
    }
  }
};

workspaceContext.onOrgChange(onOrgChangeDefaultHandler);

export const onOrgChange = (f: (orgInfo: any) => Promise<void>): void => {
  workspaceContext.onOrgChange(f);
};

export const isDefaultOrgSet = (): boolean => !!workspaceContext.username;
