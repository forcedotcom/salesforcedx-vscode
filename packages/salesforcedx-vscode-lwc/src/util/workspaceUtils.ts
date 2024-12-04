/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionContext, Memento, workspace, WorkspaceConfiguration } from 'vscode';

export class WorkspaceUtils {
  private extensionContext: ExtensionContext | undefined;
  private static _instance: WorkspaceUtils;

  public static get instance() {
    if (WorkspaceUtils._instance === undefined) {
      WorkspaceUtils._instance = new WorkspaceUtils();
    }
    return WorkspaceUtils._instance;
  }

  public init(extensionContext: ExtensionContext) {
    this.extensionContext = extensionContext;
  }

  public getGlobalStore(): Memento | undefined {
    return this.extensionContext && this.extensionContext.globalState;
  }

  public getWorkspaceSettings(): WorkspaceConfiguration {
    return workspace.getConfiguration('salesforcedx-vscode-lwc');
  }
}
