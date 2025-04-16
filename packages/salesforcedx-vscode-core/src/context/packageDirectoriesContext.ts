/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfProject } from '@salesforce/core-bundle';
import { workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
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

/**
 * Reads the packageDirectories array from sfdx-project.json and sets the VSCode context variable
 * `packageDirectoriesFolders` to the filepaths within the packageDirectories array and all their
 * subdirectories.
 */
export const checkPackageDirectoriesExplorerView = async () => {
  try {
    const projectPath = workspaceUtils.getRootWorkspacePath();
    const sfProject = await SfProject.resolve(projectPath);
    const sfdxProjectJson = sfProject.getSfProjectJson();
    const packageDirectories = await sfdxProjectJson.getPackageDirectories();
    const packageDirectoryPaths = packageDirectories.map(directory => projectPath + '/' + directory.path);
    const packageDirectoryPathsCopy = [...packageDirectoryPaths];
    for (const directory of packageDirectoryPaths) {
      const subdirectories = getAllSubdirectories(directory);
      packageDirectoryPathsCopy.push(...subdirectories);
    }
    void vscode.commands.executeCommand('setContext', 'packageDirectoriesFolders', packageDirectoryPathsCopy);
  } catch (error) {
    console.error('Error checking package directories:', error);
    void vscode.commands.executeCommand('setContext', 'packageDirectoriesFolders', []);
  }
};

/**
 * Recursively retrieves all subdirectories and files within a given directory.
 *
 * @param currentDirectory - The path of the directory to start the search from.
 * @returns An array of strings representing the paths of all subdirectories and files
 * within the given directory, including the directory itself.
 */
const getAllSubdirectories = (currentDirectory: string): string[] => {
  const subdirectories: string[] = [currentDirectory];
  const entries = fs.readdirSync(currentDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = `${currentDirectory}/${entry.name}`;
    if (entry.isDirectory()) {
      subdirectories.push(...getAllSubdirectories(fullPath));
    } else if (entry.isFile()) {
      subdirectories.push(fullPath);
    }
  }

  return subdirectories;
};
