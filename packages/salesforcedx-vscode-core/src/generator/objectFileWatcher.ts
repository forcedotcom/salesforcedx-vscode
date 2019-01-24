import {
  FauxClassGenerator,
  GeneratorUtil
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/generator';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { SfdxProjectJsonParser } from '../util';

const WAIT_TIME_IN_MS = 50;

export enum FileEventType {
  Create,
  Change,
  Delete
}

export async function registerClassGeneratorOnFieldEdits() {
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
    if (!ignorePath(uri)) {
      createdFiles.push(uri);
      clearTimeout(createdFilesTimeout);

      createdFilesTimeout = setTimeout(async () => {
        doSObjectRefresh(createdFiles, FileEventType.Create);
      }, WAIT_TIME_IN_MS);
    }
  });
}

function setupFileChangeListener(sourceFileWatcher: vscode.FileSystemWatcher) {
  sourceFileWatcher.onDidChange(async uri => {
    if (!ignorePath(uri)) {
      doSObjectRefresh([uri], FileEventType.Change);
    }
  });
}

function setupFileDeleteListener(sourceFileWatcher: vscode.FileSystemWatcher) {
  sourceFileWatcher.onDidDelete(async uri => {
    if (!ignorePath(uri)) {
      doSObjectRefresh([uri], FileEventType.Delete);
    }
  });
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

function doSObjectRefresh(
  filesForRefresh: vscode.Uri[],
  fileEventType: FileEventType
) {
  const generator = new FauxClassGenerator(new EventEmitter());
  const projectPath = vscode.workspace!.workspaceFolders![0].uri.fsPath;
  const sobjectsPath = GeneratorUtil.getSObjectsFolder(projectPath);

  if (!fs.existsSync(sobjectsPath) && fileEventType !== FileEventType.Delete) {
    // do a first time setup describe. Long running...
    vscode.commands.executeCommand('sfdx.force.internal.refreshsobjects');
  } else {
    const remoteRefreshObjects: Set<string> = new Set<string>();
    filesForRefresh.map(uri => uri.fsPath).forEach(modifiedFilePath => {
      const objectsToRemote = generator.doLocalRefresh(
        projectPath,
        modifiedFilePath
      );
      if (!!objectsToRemote) {
        objectsToRemote.forEach(sobject => remoteRefreshObjects.add(sobject));
      }
    });
    if (remoteRefreshObjects.size > 0) {
      // remote refresh
      vscode.commands.executeCommand(
        'sfdx.force.internal.refreshsobjects',
        Array.from(remoteRefreshObjects)
      );
      console.log('DO REMOTE REFRESH: ' + remoteRefreshObjects.toString());
    }
  }
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
      `{${packageDirectoryPaths.join(',')}}/**/objects/**`
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
  if (fs.existsSync(uri.fsPath)) {
    return fs.lstatSync(uri.fsPath).isDirectory();
  }
  return false;
}
