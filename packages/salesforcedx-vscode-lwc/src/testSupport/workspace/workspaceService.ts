/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { shared as lspCommon } from '@salesforce/lightning-lsp-common';
import * as vscode from 'vscode';

/**
 * Provide capabilities for VS Code regarding LWC workspace types defined in lightning-lsp-common
 */
class WorkspaceService {
  private currentWorkspaceType: lspCommon.WorkspaceType = lspCommon.WorkspaceType.UNKNOWN;

  /**
   * Setup current workspace type
   * @param extensionContext extension context
   * @param workspaceType
   */
  public register(extensionContext: vscode.ExtensionContext, workspaceType: lspCommon.WorkspaceType) {
    this.setCurrentWorkspaceType(workspaceType);

    const isInternalDev = this.isCoreWorkspace(workspaceType);
    vscode.commands.executeCommand('setContext', 'sf:internal_dev', isInternalDev);
  }

  public getCurrentWorkspaceType() {
    return this.currentWorkspaceType;
  }

  public setCurrentWorkspaceType(workspaceType: lspCommon.WorkspaceType) {
    this.currentWorkspaceType = workspaceType;
  }

  public isSFDXWorkspace(workspaceType: lspCommon.WorkspaceType) {
    return workspaceType === lspCommon.WorkspaceType.SFDX;
  }

  public isCoreWorkspace(workspaceType: lspCommon.WorkspaceType) {
    return workspaceType === lspCommon.WorkspaceType.CORE_ALL || workspaceType === lspCommon.WorkspaceType.CORE_PARTIAL;
  }

  /**
   * @returns {String} workspace type name for telemetry
   */
  public getCurrentWorkspaceTypeForTelemetry(): string {
    return lspCommon.WorkspaceType[this.getCurrentWorkspaceType()];
  }
}
export const workspaceService = new WorkspaceService();
