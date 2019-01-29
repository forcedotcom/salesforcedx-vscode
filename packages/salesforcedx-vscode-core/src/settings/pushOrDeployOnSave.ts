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
import { SfdxPackageDirectories } from '../sfdxProject';

import * as path from 'path';
import * as vscode from 'vscode';

const WAIT_TIME_IN_MS = 4500;

export async function registerPushOrDeployOnSave() {
  if (sfdxCoreSettings.getPushOrDeployOnSaveEnabled()) {
    const savedFiles: Set<vscode.Uri> = new Set();
    let savedFilesTimeout: NodeJS.Timer;
    vscode.workspace.onDidSaveTextDocument(
      async (textDocument: vscode.TextDocument) => {
        if (
          sfdxCoreSettings.getPushOrDeployOnSaveEnabled() &&
          !await ignorePath(textDocument.uri)
        ) {
          savedFiles.add(textDocument.uri);
          clearTimeout(savedFilesTimeout);

          savedFilesTimeout = setTimeout(async () => {
            const files = Array.from(savedFiles);
            savedFiles.clear();
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

function displayError(message: string) {
  notificationService.showErrorMessage(message);
  channelService.appendLine(message);
  channelService.showChannelOutput();
}

async function ignorePath(uri: vscode.Uri) {
  return isDotFile(uri) || !await pathIsInPackageDirectory(uri);
}

async function pathIsInPackageDirectory(
  documentUri: vscode.Uri
): Promise<boolean> {
  const documentPath = documentUri.fsPath;
  try {
    return await SfdxPackageDirectories.isInPackageDirectory(documentPath);
  } catch (error) {
    switch (error.name) {
      case 'NoPackageDirectoriesFound':
        error.message = nls.localize('error_no_package_directories_found_text');
      case 'NoPackageDirectoryPathsFound':
        error.message = nls.localize(
          'error_no_package_directories_paths_found_text'
        );
      default:
        displayError(error.message);
        throw error;
    }
  }
}

function isDotFile(uri: vscode.Uri) {
  return path.basename(uri.fsPath).startsWith('.');
}
