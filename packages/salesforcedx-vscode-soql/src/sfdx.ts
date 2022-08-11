/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode/out/src';
import { ChannelService } from '@salesforce/salesforcedx-utils-vscode/out/src/commands';
import * as debounce from 'debounce';
import { DescribeSObjectResult } from 'jsforce';
import * as vscode from 'vscode';
import { nls } from './messages';

export const channelService = ChannelService.getInstance(
  nls.localize('soql_channel_name')
);

export const workspaceContext = WorkspaceContextUtil.getInstance();

function showChannelAndErrorMessage(e: any) {
  channelService.appendLine(e);
  const message = nls.localize('error_connection');
  vscode.window.showErrorMessage(message);
}

export const debouncedShowChannelAndErrorMessage = debounce(
  showChannelAndErrorMessage,
  1000
);

export async function withSFConnection(
  f: (conn: Connection) => void
): Promise<void> {
  try {
    const conn = await workspaceContext.getConnection();
    return f((conn as unknown) as Connection);
  } catch (e) {
    debouncedShowChannelAndErrorMessage(e);
  }
}
export async function retrieveSObjects(): Promise<string[]> {
  let foundSObjectNames: string[] = [];
  await withSFConnection(async conn => {
    const describeGlobalResult = await conn.describeGlobal$();
    if (describeGlobalResult) {
      const sobjectNames: string[] = describeGlobalResult.sobjects
        .filter(o => o.queryable)
        .map(o => o.name);
      foundSObjectNames = sobjectNames;
    }
  });

  return foundSObjectNames;
}

export async function retrieveSObject(
  sobjectName: string
): Promise<DescribeSObjectResult> {
  let name: DescribeSObjectResult;
  await withSFConnection(async conn => {
    name = await conn.describe$(sobjectName);
  });
  return name;
}

workspaceContext.onOrgChange(async (orgInfo: any) => {
  await withSFConnection(conn => {
    conn.describeGlobal$.clear();
    conn.describe$.clear();
  });
});

export function onOrgChange(f: (orgInfo: any) => Promise<void>): void {
  workspaceContext.onOrgChange(f);
}

export function isDefaultOrgSet(): boolean {
  return !!workspaceContext.username;
}
