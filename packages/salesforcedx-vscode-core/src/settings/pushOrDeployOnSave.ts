import { SfdxProject } from '@salesforce/core';
import {
  getDefaultUsernameOrAlias,
  getUsername,
  isAScratchOrg
} from '../context';
import { sfdxCoreSettings } from '../settings';

import * as vscode from 'vscode';

interface SfdxProjectJson {
  packageDirectories: [PackageDirectory];
}

interface PackageDirectory {
  path: string;
  default?: boolean;
}

let createdFiles: vscode.Uri[] = [];
let createdFilesTimeout: any = null;

let deletedFiles: vscode.Uri[] = [];
let deletedFilesTimeout: any = null;

export async function registerPushOrDeployOnSave() {
  if (sfdxCoreSettings.getPushOrDeployOnSaveEnabled()) {
    const fileSystemWatcher = await createFileSystemWatcher();
    if (fileSystemWatcher) {
      fileSystemWatcher.onDidCreate(async uri => {
        createdFiles.push(uri);
        clearTimeout(createdFilesTimeout);

        createdFilesTimeout = setTimeout(async () => {
          const orgType = await getOrgType();
          if (orgType === OrgType.SourceTrackedOrg) {
            vscode.commands.executeCommand('sfdx.force.source.push');
            createdFiles = [];
          }

          if (orgType === OrgType.NonSourceTrackedOrg) {
            console.log(`created files: ${createdFiles}`);
            vscode.commands.executeCommand(
              'sfdx.force.source.deploy.multiple.paths',
              createdFiles
            );
            createdFiles = [];
          }
        }, 1000);
      });

      fileSystemWatcher.onDidChange(async uri => {
        const orgType = await getOrgType();
        if (orgType === OrgType.SourceTrackedOrg) {
          vscode.commands.executeCommand('sfdx.force.source.push');
        }

        if (orgType === OrgType.NonSourceTrackedOrg) {
          vscode.commands.executeCommand('sfdx.force.source.deploy', uri);
        }
      });

      fileSystemWatcher.onDidDelete(async uri => {
        deletedFiles.push(uri);
        clearTimeout(deletedFilesTimeout);

        deletedFilesTimeout = setTimeout(async () => {
          const orgType = await getOrgType();
          if (orgType === OrgType.SourceTrackedOrg) {
            vscode.commands.executeCommand('sfdx.force.source.push');
            deletedFiles = [];
          }

          if (orgType === OrgType.NonSourceTrackedOrg) {
            console.log(`deleted files: ${deletedFiles}`);
            vscode.commands.executeCommand('sfdx.force.source.delete', uri);
            deletedFiles = [];
          }
        });
      });
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
      throw new Error('Error finding default org type, please re-auth');
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

async function createFileSystemWatcher(): Promise<vscode.FileSystemWatcher | null> {
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
