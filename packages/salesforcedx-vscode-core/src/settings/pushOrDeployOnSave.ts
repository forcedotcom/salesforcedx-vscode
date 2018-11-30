import { SfdxProject } from '@salesforce/core';
import { getWorkspaceOrgType, OrgType } from '../context';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { sfdxCoreSettings } from '../settings';

import * as vscode from 'vscode';

interface SfdxProjectJson {
  packageDirectories: [PackageDirectory];
}

interface PackageDirectory {
  path: string;
  default?: boolean;
}

enum FileEventType {
  Create,
  Change,
  Delete
}

const WAIT_TIME_IN_MS = 1000;

export async function registerPushOrDeployOnSave() {
  if (sfdxCoreSettings.getPushOrDeployOnSaveEnabled()) {
    const sourceFileWatcher = await createSourceFileWatcher();
    if (sourceFileWatcher) {
      setupFileCreateListener(sourceFileWatcher);
      setupFileChangeListener(sourceFileWatcher);
      setupFileDeleteListener(sourceFileWatcher);
    }
  }
}

function setupFileCreateListener(sourceFileWatcher: vscode.FileSystemWatcher) {
  const createdFiles: vscode.Uri[] = [];
  let createdFilesTimeout: NodeJS.Timer;
  sourceFileWatcher.onDidCreate(async uri => {
    createdFiles.push(uri);
    clearTimeout(createdFilesTimeout);

    createdFilesTimeout = setTimeout(async () => {
      await pushOrDeploy(FileEventType.Create, createdFiles);
    }, WAIT_TIME_IN_MS);
  });
}

function setupFileChangeListener(sourceFileWatcher: vscode.FileSystemWatcher) {
  sourceFileWatcher.onDidChange(async uri => {
    await pushOrDeploy(FileEventType.Change, [uri]);
  });
}

function setupFileDeleteListener(sourceFileWatcher: vscode.FileSystemWatcher) {
  let deletedFilesTimeout: NodeJS.Timer;
  sourceFileWatcher.onDidDelete(async uri => {
    clearTimeout(deletedFilesTimeout);

    deletedFilesTimeout = setTimeout(async () => {
      await pushOrDeploy(FileEventType.Delete);
    }, WAIT_TIME_IN_MS);
  });
}

async function pushOrDeploy(
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
          'sfdx.force.source.deploy',
          filesToDeploy![0]
        );
      } else if (fileEventType === FileEventType.Delete) {
        notificationService.showErrorMessage(
          nls.localize('error_change_not_deleted_text')
        );
      }
    }
  } catch (e) {
    if (e.name === 'NamedOrgNotFound') {
      notificationService.showErrorMessage(
        nls.localize('error_fetching_auth_info_text')
      );
    } else if (e.name === 'NoDefaultusernameSet') {
      // Do nothing.
    } else {
      notificationService.showErrorMessage(e);
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
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    const sfdxProjectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const sfdxProject = await SfdxProject.resolve(sfdxProjectPath);
    const sfdxProjectJson = (await sfdxProject.resolveProjectConfig()) as SfdxProjectJson;
    const packageDirectoryPaths = sfdxProjectJson.packageDirectories.map(
      packageDir => packageDir.path
    );
    const globString = `${sfdxProjectPath}/{${packageDirectoryPaths.join(
      ','
    )}}/**`;
    const fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
      globString
    );
    return Promise.resolve(fileSystemWatcher);
  }
  return Promise.resolve(null);
}
