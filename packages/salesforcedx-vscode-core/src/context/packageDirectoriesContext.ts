/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfProject } from '@salesforce/core-bundle';
import { workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

export const checkPackageDirectoriesEditorView = async () => {
  try {
    const projectPath = workspaceUtils.getRootWorkspacePath();
    const sfProject = await SfProject.resolve(projectPath);
    const sfdxProjectJson = sfProject.getSfProjectJson();
    const packageDirectories = await sfdxProjectJson.getPackageDirectories();
    const packageDirectoryPaths = packageDirectories.map(directory => projectPath + '/' + directory.path);

    // Get the URI from the active editor
    const activeEditor = vscode.window.activeTextEditor;
    let uri: vscode.Uri;
    if (activeEditor) {
      uri = activeEditor.document.uri;
    } else {
      // No active editor, can fail fast
      void vscode.commands.executeCommand('setContext', 'sf:in_package_directories', false);
      return false;
    }

    // Check if the file is in any of the package directories
    const filePath = uri.fsPath;
    const inPackageDirectories = packageDirectoryPaths.some(path => filePath.includes(path));

    // Set the context for sf:in_package_directories
    void vscode.commands.executeCommand('setContext', 'sf:in_package_directories', inPackageDirectories);

    return inPackageDirectories;
  } catch (error) {
    console.error('Error checking package directories:', error);
    void vscode.commands.executeCommand('setContext', 'sf:in_package_directories', false);
    return false;
  }
};

export const checkPackageDirectoriesExplorerView = async () => {
  try {
    const projectPath = workspaceUtils.getRootWorkspacePath();
    const sfProject = await SfProject.resolve(projectPath);
    const sfdxProjectJson = sfProject.getSfProjectJson();
    const packageDirectories = await sfdxProjectJson.getPackageDirectories();
    const packageDirectoryPaths = packageDirectories.map(directory => projectPath + '/' + directory.path);
    void vscode.commands.executeCommand('setContext', 'packageDirectoriesFolders', packageDirectoryPaths);
  } catch (error) {
    console.error('Error checking package directories:', error);
    void vscode.commands.executeCommand('setContext', 'packageDirectoriesFolders', []);
  }
};
