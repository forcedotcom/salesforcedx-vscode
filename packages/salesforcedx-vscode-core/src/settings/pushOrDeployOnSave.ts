import { SfdxProject } from '@salesforce/core';

import * as vscode from 'vscode';

export async function registerPushOrDeployOnSave() {
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    const project = await SfdxProject.resolve(
      vscode.workspace.workspaceFolders[0].uri.fsPath
    );
    const projectJson = await project.resolveProjectConfig();
    console.log(projectJson);
  }
}
