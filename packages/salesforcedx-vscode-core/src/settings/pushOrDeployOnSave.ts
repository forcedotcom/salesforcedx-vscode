/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { channelService } from '../channels';
import { getWorkspaceOrgType, OrgType } from '../context';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { sfdxCoreSettings } from '../settings';

import { SfdxProjectJsonParser } from '../sfdxProject';

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export enum FileEventType {
  Create,
  Change,
  Delete
}

const WAIT_TIME_IN_MS = 3000;

export async function registerPushOrDeployOnSave() {
  if (sfdxCoreSettings.getPushOrDeployOnSaveEnabled()) {
    const packageDirectories = await getPackageDirectoriesPaths();
    const savedFiles: Set<vscode.Uri> = new Set();
    let savedFilesTimeout: NodeJS.Timer;
    vscode.workspace.onDidSaveTextDocument(
      (textDocument: vscode.TextDocument) => {
        console.log(`saved: ${path.basename(textDocument.uri.fsPath)}`);
        if (
          sfdxCoreSettings.getPushOrDeployOnSaveEnabled() &&
          !ignorePath(textDocument.uri, packageDirectories)
        ) {
          savedFiles.add(textDocument.uri);
          clearTimeout(savedFilesTimeout);

          savedFilesTimeout = setTimeout(async () => {
            const files = Array.from(savedFiles);
            savedFiles.clear();
            console.log('files are: ', files);
            await pushOrDeploy(files);
          }, WAIT_TIME_IN_MS);
        }
      }
    );
  }
}

export async function pushOrDeploy(filesToDeploy: vscode.Uri[]): Promise<void> {
  try {
    const orgType = await getWorkspaceOrgType();
    if (orgType === OrgType.SourceTracked) {
      vscode.commands.executeCommand('sfdx.force.source.push');
    } else {
      vscode.commands.executeCommand(
        'sfdx.force.source.deploy.multiple.source.paths',
        filesToDeploy
      );
    }
  } catch (e) {
    switch (e.name) {
      case 'NamedOrgNotFound':
        displayError(nls.localize('error_fetching_auth_info_text'));
        break;
      case 'NoDefaultusernameSet':
        displayError(
          nls.localize('error_push_or_deploy_on_save_no_default_username')
        );
        break;
      default:
        displayError(e.message);
    }
  }
}

export async function getPackageDirectoriesPaths(): Promise<string[]> {
  try {
    const sfdxProjectPath = vscode.workspace!.workspaceFolders![0].uri.fsPath;
    const sfdxProjectJsonParser = new SfdxProjectJsonParser();
    const packageDirectoryPaths: string[] = await sfdxProjectJsonParser.getPackageDirectoryPaths(
      sfdxProjectPath
    );
    const absolutePackageDirectoryPaths = packageDirectoryPaths.map(
      relativePackageDirPath =>
        path.join(sfdxProjectPath, relativePackageDirPath)
    );
    return Promise.resolve(absolutePackageDirectoryPaths);
  } catch (error) {
    switch (error.name) {
      case 'NoPackageDirectoriesFound':
        throw new Error(
          nls.localize('error_no_package_directories_found_text')
        );
      case 'NoPackageDirectoryPathsFound':
        throw new Error(
          nls.localize('error_no_package_directories_paths_found_text')
        );
      default:
        throw error;
    }
  }
}

function displayError(message: string) {
  notificationService.showErrorMessage(message);
  channelService.appendLine(message);
  channelService.showChannelOutput();
}

function pathIsInPackageDirectory(
  documentUri: vscode.Uri,
  packageDirectoryPaths: string[]
): boolean {
  const documentPath = documentUri.fsPath;
  let sourcePathIsInPackageDirectory = false;
  for (const packagePath of packageDirectoryPaths) {
    if (documentPath.startsWith(packagePath)) {
      sourcePathIsInPackageDirectory = true;
      break;
    }
  }
  return sourcePathIsInPackageDirectory;
}

function ignorePath(uri: vscode.Uri, packageDirectories: string[]) {
  return (
    isDotFile(uri) ||
    isDirectory(uri) ||
    !pathIsInPackageDirectory(uri, packageDirectories)
  );
}

function isDotFile(uri: vscode.Uri) {
  return path.basename(uri.fsPath).startsWith('.');
}

function isDirectory(uri: vscode.Uri) {
  if (fs.existsSync(uri.fsPath)) {
    return fs.lstatSync(uri.fsPath).isDirectory();
  }
  return false;
}
