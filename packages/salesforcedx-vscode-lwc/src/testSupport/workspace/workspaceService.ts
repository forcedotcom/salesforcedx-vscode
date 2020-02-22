/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { shared as lspCommon } from 'lightning-lsp-common';
import { workspace } from 'vscode';
import * as vscode from 'vscode';

class WorkspaceService {
  private currentWorkspaceType: lspCommon.WorkspaceType =
    lspCommon.WorkspaceType.UNKNOWN;

  public register(
    context: vscode.ExtensionContext,
    workspaceType: lspCommon.WorkspaceType
  ) {
    this.setCurrentWorkspaceType(workspaceType);
    const handleDidChangeWorkspaceFolders = workspace.onDidChangeWorkspaceFolders(
      event => {
        if (!workspace.workspaceFolders) {
          return;
        }
        const workspaceUris: string[] = [];
        workspace.workspaceFolders.forEach(folder => {
          workspaceUris.push(folder.uri.fsPath);
        });
        const newWorkspaceType = lspCommon.detectWorkspaceType(workspaceUris);

        // TODO - set context?
        if (shouldActivateLwcTestSupport(newWorkspaceType)) {
          this.setCurrentWorkspaceType(newWorkspaceType);
        }
      }
    );
    context.subscriptions.push(handleDidChangeWorkspaceFolders);
  }

  public getCurrentWorkspaceType() {
    return this.currentWorkspaceType;
  }

  public setCurrentWorkspaceType(workspaceType: lspCommon.WorkspaceType) {
    this.currentWorkspaceType = workspaceType;
  }

  /**
   * @returns {String} workspace type name for telemetry
   */
  public getCurrentWorkspaceTypeForTelemetry(): string {
    return lspCommon.WorkspaceType[this.getCurrentWorkspaceType()];
  }
}
export const workspaceService = new WorkspaceService();

export function isSFDXWorkspace(workspaceType: lspCommon.WorkspaceType) {
  return workspaceType === lspCommon.WorkspaceType.SFDX;
}

export function isCoreWorkspace(workspaceType: lspCommon.WorkspaceType) {
  return (
    workspaceType === lspCommon.WorkspaceType.CORE_ALL ||
    workspaceType === lspCommon.WorkspaceType.CORE_PARTIAL
  );
}

/**
 * Activate LWC Test support for supported workspace types
 * @param workspaceType workspace type
 */
export function shouldActivateLwcTestSupport(
  workspaceType: lspCommon.WorkspaceType
) {
  return isSFDXWorkspace(workspaceType) || isCoreWorkspace(workspaceType);
}
