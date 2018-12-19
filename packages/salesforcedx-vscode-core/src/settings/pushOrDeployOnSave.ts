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

import { SfdxProjectJsonParser } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export enum FileEventType {
  Create,
  Change,
  Delete
}

const WAIT_TIME_IN_MS = 50;

export async function registerPushOrDeployOnSave() {
  const sourceFileWatcher = await createSourceFileWatcher();
  if (sourceFileWatcher) {
    setupFileCreateListener(sourceFileWatcher);
    setupFileChangeListener(sourceFileWatcher);
    setupFileDeleteListener(sourceFileWatcher);
  }
}

function setupFileCreateListener(sourceFileWatcher: vscode.FileSystemWatcher) {
  const createdFiles: vscode.Uri[] = [];
  let createdFilesTimeout: NodeJS.Timer;
  sourceFileWatcher.onDidCreate(async uri => {
    if (sfdxCoreSettings.getPushOrDeployOnSaveEnabled() && !ignorePath(uri)) {
      createdFiles.push(uri);
      clearTimeout(createdFilesTimeout);

      createdFilesTimeout = setTimeout(async () => {
        await pushOrDeploy(FileEventType.Create, createdFiles);
      }, WAIT_TIME_IN_MS);
    }
  });
}

function setupFileChangeListener(sourceFileWatcher: vscode.FileSystemWatcher) {
  sourceFileWatcher.onDidChange(async uri => {
    if (sfdxCoreSettings.getPushOrDeployOnSaveEnabled() && !ignorePath(uri)) {
      await pushOrDeploy(FileEventType.Change, [uri]);
    }
  });
}

function setupFileDeleteListener(sourceFileWatcher: vscode.FileSystemWatcher) {
  let deletedFilesTimeout: NodeJS.Timer;
  sourceFileWatcher.onDidDelete(async uri => {
    if (sfdxCoreSettings.getPushOrDeployOnSaveEnabled() && !ignorePath(uri)) {
      clearTimeout(deletedFilesTimeout);

      deletedFilesTimeout = setTimeout(async () => {
        await pushOrDeploy(FileEventType.Delete);
      }, WAIT_TIME_IN_MS);
    }
  });
}

export async function pushOrDeploy(
  fileEventType: FileEventType,
  filesToDeploy?: vscode.Uri[]
): Promise<void> {
  try {
    const orgType = await getWorkspaceOrgType();
    if (orgType === OrgType.SourceTracked) {
      vscode.commands.executeCommand('sfdx.force.source.push');
    }

    if (orgType === OrgType.NonSourceTracked) {
      switch (fileEventType) {
        case FileEventType.Create:
          vscode.commands.executeCommand(
            'sfdx.force.source.deploy.multiple.source.paths',
            filesToDeploy!.slice(0)
          );
          break;
        case FileEventType.Change:
          vscode.commands.executeCommand(
            'sfdx.force.source.deploy.source.path',
            filesToDeploy![0]
          );
          break;
        case FileEventType.Delete:
          displayError(
            nls.localize('error_deploy_delete_on_save_not_supported_text')
          );
          break;
      }
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
  } finally {
    if (filesToDeploy) {
      emptyCollectedFiles(filesToDeploy);
    }
  }
}

function emptyCollectedFiles(uris: vscode.Uri[]) {
  uris.length = 0;
}

async function createSourceFileWatcher(): Promise<vscode.FileSystemWatcher | null> {
  try {
    const relativePattern = await getPackageDirectoriesRelativePattern();
    const fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
      relativePattern
    );
    return Promise.resolve(fileSystemWatcher);
  } catch (error) {
    displayError(error.message);
  }
  return Promise.resolve(null);
}

export async function getPackageDirectoriesRelativePattern(): Promise<
  vscode.RelativePattern
> {
  try {
    const sfdxProjectPath = vscode.workspace!.workspaceFolders![0].uri.fsPath;
    const sfdxProjectJsonParser = new SfdxProjectJsonParser();
    const packageDirectoryPaths: string[] = await sfdxProjectJsonParser.getPackageDirectoryPaths(
      sfdxProjectPath
    );
    const relativePattern = new vscode.RelativePattern(
      sfdxProjectPath,
      `{${packageDirectoryPaths.join(',')}}/**`
    );
    return Promise.resolve(relativePattern);
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

function ignorePath(uri: vscode.Uri) {
  return isDotFile(uri) || isDirectory(uri);
}

function isDotFile(uri: vscode.Uri) {
  return path.basename(uri.fsPath).startsWith('.');
}

function isDirectory(uri: vscode.Uri) {
  return fs.lstatSync(uri.fsPath).isDirectory();
}
