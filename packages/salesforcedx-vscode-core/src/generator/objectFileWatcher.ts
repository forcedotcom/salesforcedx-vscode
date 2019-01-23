import {
  CUSTOMOBJECTS_DIR,
  SFDX_DIR,
  SOBJECTS_DIR,
  STANDARDOBJECTS_DIR,
  TOOLS_DIR
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/constants';
import {
  FauxClassGenerator,
  RefreshStatus
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/generator/fauxClassGenerator';
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
        doSobjectRefresh(createdFiles, FileEventType.Create);
      }, WAIT_TIME_IN_MS);
    }
  });
}

function setupFileChangeListener(sourceFileWatcher: vscode.FileSystemWatcher) {
  sourceFileWatcher.onDidChange(async uri => {
    if (!ignorePath(uri)) {
      doSobjectRefresh([uri], FileEventType.Change);
    }
  });
}

function setupFileDeleteListener(sourceFileWatcher: vscode.FileSystemWatcher) {
  sourceFileWatcher.onDidDelete(async uri => {
    if (!ignorePath(uri)) {
      doSobjectRefresh([uri], FileEventType.Delete);
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

// function getObjectFields(filesForRefresh: vscode.Uri[]): ObjectFieldMap[] {
//   const objectsAndFields: ObjectFieldMap[] = [];
//   const sobjectNames = new Set<string>(); // used to filter duplicate sobjects
//   filesForRefresh.forEach(uri => {
//     const matches = uri.path.match(/.+\/objects\/(\w+)/);
//     if (matches && matches.length === 2) {
//       const name = matches[1];
//       if (!sobjectNames.has(name)) {
//         const objectFieldMap: ObjectFieldMap = { name, fields: {} };
//         const fieldDir = path.join(matches[0], 'fields');
//         if (fs.existsSync(fieldDir)) {
//           fs.readdirSync(fieldDir).forEach(fieldName => {
//             const nameAndTypePattern = /<fullName>(\w+__c)<\/fullName>(?:.|\n)*<type>(\w+)<\/type>/;
//             const fieldContents = fs
//               .readFileSync(path.join(fieldDir, fieldName))
//               .toString();
//             const nameAndType = fieldContents.match(nameAndTypePattern);
//             if (objectFieldMap && nameAndType && nameAndType.length === 3) {
//               objectFieldMap.fields[nameAndType[1]] = nameAndType[2];
//             }
//           });
//         }
//         objectsAndFields.push(objectFieldMap);
//         sobjectNames.add(name);
//       }
//     }
//   });

//   return objectsAndFields;
// }

// function generateField(fieldPath: string) {
//   const fieldContents = fs.readFileSync(fieldPath).toString();
//   const nameAndTypePattern = /<fullName>(\w+__c)<\/fullName>(?:.|\n)*<type>(\w+)<\/type>/;
//   const nameAndType = fieldContents.match(nameAndTypePattern);
//   if (nameAndType && nameAndType.length === 3) {
//     const type = nameAndType[2];
//     if (type === 'Lookup' || type === 'MasterDetail') {
//       const referenceToMatch = fieldContents.match(/<referenceTo>(\w+)<\/referenceTo>/);
//       if (referenceToMatch && referenceToMatch.length === 2) {

//       }
//     }
//   }
// }

function doSobjectRefresh(
  filesForRefresh: vscode.Uri[],
  fileEventType: FileEventType
) {
  const generator = new FauxClassGenerator(new EventEmitter());
  const projectPath = vscode.workspace!.workspaceFolders![0].uri.fsPath;
  const sobjectsPath = generator.getSobjectsFolder(projectPath);

  if (!fs.existsSync(sobjectsPath) && fileEventType !== FileEventType.Delete) {
    // do a first time setup describe. Long running...
    vscode.commands.executeCommand('sfdx.force.internal.refreshsobjects');
  } else {
    const remoteRefreshObjects: Set<string> = new Set<string>();
    filesForRefresh.map(uri => uri.fsPath).forEach(fsPath => {
      const status = generator.updateFauxClass(projectPath, fsPath);
      if (status && !status.localRefresh) {
        remoteRefreshObjects.add(status.sobjectName);
      }
    });
    if (
      remoteRefreshObjects.size > 0 &&
      fileEventType !== FileEventType.Delete
    ) {
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
