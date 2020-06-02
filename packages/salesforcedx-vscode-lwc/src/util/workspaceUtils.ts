/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { workspace } from 'vscode';

export class WorkspaceUtils {
  private context: vscode.ExtensionContext | undefined;
  private static instance: WorkspaceUtils;

  private constructor() {}

  public static getInstance(): WorkspaceUtils {
    if (!this.instance) {
      this.instance = new WorkspaceUtils();
    }
    return this.instance;
  }

  public init(extensionContext: vscode.ExtensionContext) {
    this.context = extensionContext;
  }

  public getGlobalStore(): vscode.Memento | undefined {
    if (this.context === undefined) {
      return undefined;
    }

    return this.context.globalState;
  }

  public getWorkspaceSettings(): vscode.WorkspaceConfiguration {
    return workspace.getConfiguration('salesforcedx-vscode-lwc');
  }
}
