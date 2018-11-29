import { SfdxProject } from '@salesforce/core';
import {
  getDefaultUsernameOrAlias,
  getUsername,
  isAScratchOrg
} from '../context';
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

enum EventType {
  Create,
  Change,
  Delete
}

const WAIT_TIME_IN_MS = 1000;

export async function registerPushOrDeployOnSave() {
  if (sfdxCoreSettings.getPushOrDeployOnSaveEnabled()) {
    const createdFiles: vscode.Uri[] = [];
    let createdFilesTimeout: NodeJS.Timer;

    const deletedFiles: vscode.Uri[] = [];
    let deletedFilesTimeout: NodeJS.Timer;
    const sourceFilesWatcher = await createSourceFilesWatcher();
    if (sourceFilesWatcher) {
      sourceFilesWatcher.onDidCreate(async uri => {
        createdFiles.push(uri);
        clearTimeout(createdFilesTimeout);

        createdFilesTimeout = setTimeout(async () => {
          await pushOrDeploy(EventType.Create, createdFiles);
        }, WAIT_TIME_IN_MS);
      });

      sourceFilesWatcher.onDidChange(async uri => {
        await pushOrDeploy(EventType.Change, [uri]);
      });

      sourceFilesWatcher.onDidDelete(async uri => {
        deletedFiles.push(uri);
        clearTimeout(deletedFilesTimeout);

        deletedFilesTimeout = setTimeout(async () => {
          await pushOrDeploy(EventType.Delete, deletedFiles);
        }, WAIT_TIME_IN_MS);
      });
    }
  }
}

async function pushOrDeploy(
  eventType: EventType,
  uris: vscode.Uri[]
): Promise<void> {
  try {
    const orgType = await getOrgType();
    if (orgType === OrgType.SourceTrackedOrg) {
      vscode.commands.executeCommand('sfdx.force.source.push');
    }

    if (orgType === OrgType.NonSourceTrackedOrg) {
      if (eventType === EventType.Create) {
        vscode.commands.executeCommand(
          'sfdx.force.source.deploy.multiple.paths',
          uris
        );
      } else if (eventType === EventType.Change) {
        vscode.commands.executeCommand('sfdx.force.source.deploy', uris[0]);
      } else {
        notificationService.showErrorMessage(
          nls.localize('error_change_not_deleted_text')
        );
      }
    }
    uris = [];
  } catch (e) {
    uris = [];
    if (e.name === 'NamedOrgNotFound') {
      notificationService.showErrorMessage(
        nls.localize('error_fetching_auth_info_text')
      );
    } else {
      notificationService.showErrorMessage(e);
    }
  }
}

enum OrgType {
  SourceTrackedOrg,
  NonSourceTrackedOrg,
  NoOrgSet
}

async function getOrgType(): Promise<OrgType> {
  const defaultUsernameOrAlias = await getDefaultUsernameOrAlias();
  const defaultUsernameIsSet = typeof defaultUsernameOrAlias !== 'undefined';
  let isScratchOrg = false;
  if (defaultUsernameIsSet) {
    const username = await getUsername(defaultUsernameOrAlias!);
    try {
      isScratchOrg = await isAScratchOrg(username);
    } catch (e) {
      throw e;
    }

    if (defaultUsernameIsSet && isScratchOrg) {
      return Promise.resolve(OrgType.SourceTrackedOrg);
    }

    if (defaultUsernameIsSet && !isScratchOrg) {
      return Promise.resolve(OrgType.NonSourceTrackedOrg);
    }
  }
  return Promise.resolve(OrgType.NoOrgSet);
}

async function createSourceFilesWatcher(): Promise<vscode.FileSystemWatcher | null> {
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const project = await SfdxProject.resolve(projectPath);
    const projectJson = (await project.resolveProjectConfig()) as SfdxProjectJson;
    const packageDirectoryPaths = projectJson.packageDirectories.map(
      packageDir => packageDir.path
    );
    const globString = `${projectPath}/{${packageDirectoryPaths.join(',')}}/**`;
    const fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
      globString
    );
    return Promise.resolve(fileSystemWatcher);
  }
  return Promise.resolve(null);
}
