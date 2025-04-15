/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfProject } from '@salesforce/core-bundle';
import { workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

export const checkPackageDirectories = async (uri?: vscode.Uri) => {
  try {
    // If no URI is provided, try to get it from the active editor
    if (!uri) {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        uri = activeEditor.document.uri;
      } else {
        // No active editor and no URI provided, can't determine if in package directories
        void vscode.commands.executeCommand('setContext', 'sf:in_package_directories', false);
        return false;
      }
    }

    const projectPath = workspaceUtils.getRootWorkspacePath();
    const sfProject = await SfProject.resolve(projectPath);
    const sfdxProjectJson = sfProject.getSfProjectJson();
    const packageDirectories = await sfdxProjectJson.getPackageDirectories();
    const packageDirectoryPaths = packageDirectories.map(directory => projectPath + '/' + directory.path);

    // Check if the file is in any of the package directories
    const filePath = uri.fsPath;
    const inPackageDirectories = packageDirectoryPaths.some(path => filePath.includes(path));

    // Set the context
    void vscode.commands.executeCommand('setContext', 'sf:in_package_directories', inPackageDirectories);
    void vscode.commands.executeCommand('setContext', 'packageDirectoriesFolders', packageDirectoryPaths);

    return inPackageDirectories;
  } catch (error) {
    console.error('Error checking package directories:', error);
    void vscode.commands.executeCommand('setContext', 'sf:in_package_directories', false);
    return false;
  }
};
