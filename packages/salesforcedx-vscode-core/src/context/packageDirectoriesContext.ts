/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfProject } from '@salesforce/core';
import { workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';

/**
 * Checks if the currently active editor's file is located within any of the filepaths in the
 * packageDirectories array defined in sfdx-project.json. Sets the VSCode context variable
 * `sf:in_package_directories` to `true` if the file is in a package directory, otherwise `false`.
 *
 * @returns {Promise<boolean>} A promise that resolves to `true` if the active file is in a filepath
 * located in the packageDirectories array, otherwise `false`.
 *
 * @throws Will log an error and set the context to `false` if an exception occurs during execution.
 */
export const checkPackageDirectoriesEditorView = async (): Promise<boolean> => {
  try {
    const projectPath = workspaceUtils.getRootWorkspacePath();
    const sfProject = await SfProject.resolve(projectPath);
    const sfdxProjectJson = sfProject.getSfProjectJson();
    const packageDirectories = await sfdxProjectJson.getPackageDirectories();
    const packageDirectoryPaths = packageDirectories.map(directory => path.join(projectPath, directory.path));

    // Get the URI from the active editor
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      // No active editor, can fail fast
      void vscode.commands.executeCommand('setContext', 'sf:in_package_directories', false);
      return false;
    }
    const uri = activeEditor.document.uri;

    // Check if the file is in any of the package directories
    const filePath = uri.fsPath;
    const inPackageDirectories = packageDirectoryPaths.some(directoryPath => filePath.includes(directoryPath));

    // Set the context for sf:in_package_directories
    void vscode.commands.executeCommand('setContext', 'sf:in_package_directories', inPackageDirectories);

    return inPackageDirectories;
  } catch (error) {
    console.error('Error checking package directories:', error);
    void vscode.commands.executeCommand('setContext', 'sf:in_package_directories', false);
    return false;
  }
};
