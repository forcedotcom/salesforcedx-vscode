/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode/out/src';
import * as vscode from 'vscode';

export class WorkspaceContext {
  protected static instance?: WorkspaceContext;

  public async initialize(context: vscode.ExtensionContext) {
    await WorkspaceContextUtil.getInstance().initialize(context);
  }

  public static getInstance(forceNew = false): WorkspaceContext {
    if (!this.instance || forceNew) {
      this.instance = new WorkspaceContext();
    }
    return this.instance;
  }

  public async getConnection(): Promise<Connection> {
    // @ts-ignore
    return await WorkspaceContextUtil.getInstance().getConnection();
  }
}
