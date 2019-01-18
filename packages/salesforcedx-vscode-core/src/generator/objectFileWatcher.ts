import {
  CUSTOMOBJECTS_DIR,
  SFDX_DIR,
  SOBJECTS_DIR,
  STANDARDOBJECTS_DIR,
  TOOLS_DIR
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/constants';
import { FauxClassGenerator } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/generator';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { sfdxCoreSettings } from '../settings';
import { SfdxProjectJsonParser } from '../util';

const WAIT_TIME_IN_MS = 50;

interface ObjectFieldMap {
  name: string;
  fields: {
    [key: string]: string;
  };
}

export async function registerClassGeneratorOnFieldEdits() {
  const sourceFileWatcher = await createSourceFileWatcher();
  if (sourceFileWatcher) {
    setupFileCreateListener(sourceFileWatcher);
    setupFileChangeListener(sourceFileWatcher);
    // setupFileDeleteListener(sourceFileWatcher);
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
        doSobjectRefresh(createdFiles);
      }, WAIT_TIME_IN_MS);
    }
  });
}

function setupFileChangeListener(sourceFileWatcher: vscode.FileSystemWatcher) {
  sourceFileWatcher.onDidChange(async uri => {
    if (!ignorePath(uri)) {
      doSobjectRefresh([uri]);
      // const objectFields = getObjectFields([uri]);
      // if (objectFields.length > 0) {
      //   const generator = new FauxClassGenerator(new EventEmitter());
      //   const sfdxProjectPath = vscode.workspace!.workspaceFolders![0].uri
      //     .fsPath;
      //   generator.updateSobjectDefinitions(sfdxProjectPath, objectFields[0]);
      // }
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

function getObjectFields(filesForRefresh: vscode.Uri[]): ObjectFieldMap[] {
  const objectsAndFields: ObjectFieldMap[] = [];
  const pattern = /\/objects\/(\w+)\/fields\/(\w+__c).field-meta.xml/; // windows?

  filesForRefresh.forEach(uri => {
    const matches = uri.path.match(pattern);
    if (matches && matches.length === 3) {
      const sobjectName = matches[1];
      const fieldDir = path.dirname(uri.fsPath);
      const objectFieldMap: ObjectFieldMap = { name: sobjectName, fields: {} };
      fs.readdirSync(fieldDir).forEach(fieldName => {
        const nameAndTypePattern = /<fullName>(\w+__c)<\/fullName>(?:.|\n)*<type>(\w+)<\/type>/;
        const fieldContents = fs
          .readFileSync(path.join(fieldDir, fieldName))
          .toString();
        const nameAndType = fieldContents.match(nameAndTypePattern);
        if (objectFieldMap && nameAndType && nameAndType.length === 3) {
          objectFieldMap.fields[nameAndType[1]] = nameAndType[2];
        }
      });
      objectsAndFields.push(objectFieldMap);
    }
  });

  return objectsAndFields;
}

function doSobjectRefresh(filesForRefresh: vscode.Uri[]) {
  const sfdxProjectPath = vscode.workspace!.workspaceFolders![0].uri.fsPath;
  const sobjectsDir = path.join(
    sfdxProjectPath,
    SFDX_DIR,
    TOOLS_DIR,
    SOBJECTS_DIR
  );
  if (!fs.existsSync(sobjectsDir)) {
    // do a first time setup describe. Long running...
    vscode.commands.executeCommand('sfdx.force.internal.refreshsobjects');
  } else {
    const objectFields = getObjectFields(filesForRefresh);
    const remoteRefreshObjects: string[] = [];
    objectFields.forEach(sobject => {
      const { name } = sobject;
      const typeDir = name.endsWith('__c')
        ? CUSTOMOBJECTS_DIR
        : STANDARDOBJECTS_DIR;
      const fauxClassPath = path.join(sobjectsDir, typeDir, `${name}.cls`);
      if (fs.existsSync(fauxClassPath)) {
        // local refresh
        console.log('DO LOCAL REFRESH: ' + name);
      } else {
        remoteRefreshObjects.push(name);
      }
    });
    if (remoteRefreshObjects.length > 0) {
      // remote refresh
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
      `{${packageDirectoryPaths.join(',')}}/**/objects/**/fields/**.xml`
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
