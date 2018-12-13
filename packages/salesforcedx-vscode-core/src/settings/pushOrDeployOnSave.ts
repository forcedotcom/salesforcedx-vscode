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
      if (fileEventType === FileEventType.Create) {
        vscode.commands.executeCommand(
          'sfdx.force.source.deploy.multiple.source.paths',
          filesToDeploy!.slice(0)
        );
      } else if (fileEventType === FileEventType.Change) {
        vscode.commands.executeCommand(
          'sfdx.force.source.deploy.source.path',
          filesToDeploy![0]
        );
      } else if (fileEventType === FileEventType.Delete) {
        const deleteError = nls.localize('error_change_not_deleted_text');
        const consoleError = `Error attempting to push or deploy: ${nls.localize(
          'error_change_not_deleted_text'
        )}`;
        displayError(deleteError, [consoleError]);
      }
    }
  } catch (e) {
    let errorMessage: string;
    if (e.name === 'NamedOrgNotFound') {
      errorMessage = `${nls.localize(
        'error_push_or_deploy_on_save'
      )}: ${nls.localize('error_fetching_auth_info_text')}`;
    } else if (e.name === 'NoDefaultusernameSet') {
      errorMessage = nls.localize(
        'error_push_or_deploy_on_save_no_default_username'
      );
    } else {
      errorMessage = `${nls.localize(
        'error_push_or_deploy_on_save'
      )}: ${e.message}`;
    }
    displayError(errorMessage, [errorMessage]);
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
    const globString = await getPackageDirectoriesGlobString();
    const fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
      globString
    );
    return Promise.resolve(fileSystemWatcher);
  } catch (error) {
    const errorSettingUp = nls.localize(
      'error_setting_up_push_or_deploy_on_save_text'
    );
    displayError(errorSettingUp, [
      `${errorSettingUp}: ${error.message}`,
      nls.localize('reference_salesforcedx_project_configuration_doc')
    ]);
  }
  return Promise.resolve(null);
}

export async function getPackageDirectoriesGlobString(): Promise<string> {
  try {
    const sfdxProjectPath = vscode.workspace!.workspaceFolders![0].uri.fsPath;
    const sfdxProjectJsonParser = new SfdxProjectJsonParser();
    const packageDirectoryPaths: string[] = await sfdxProjectJsonParser.getPackageDirectoryPaths(
      sfdxProjectPath
    );
    const globString = path.join(
      sfdxProjectPath,
      `{${packageDirectoryPaths.join(',')}}`,
      '**'
    );
    return Promise.resolve(globString);
  } catch (error) {
    if (error.name === 'NoPackageDirectoriesFound') {
      throw new Error(nls.localize('error_no_package_directories_found_text'));
    } else if (error.name === 'NoPackageDirectoryPathsFound') {
      throw new Error(
        nls.localize('error_no_package_directories_paths_found_text')
      );
    }
    throw error;
  }
}

function displayError(notifcationMessage: string, consoleMessages: string[]) {
  notificationService.showErrorMessage(notifcationMessage);
  consoleMessages.forEach(message => channelService.appendLine(message));
  channelService.showChannelOutput();
}

function ignorePath(uri: vscode.Uri) {
  return isDotFile(uri);
}

function isDotFile(uri: vscode.Uri) {
  return path.basename(uri.fsPath).startsWith('.');
}
