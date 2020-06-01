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
