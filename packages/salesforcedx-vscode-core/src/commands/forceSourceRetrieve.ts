/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { nls } from '../messages';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

export class ForceSourceRetrieveExecutor extends SfdxCommandletExecutor<
  SelectedPath
> {
  public build(data: SelectedPath): Command {
    const commandBuilder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_retrieve_text'))
      .withArg('force:source:retrieve');
    if (data.type === FileType.Manifest) {
      commandBuilder.withFlag('--manifest', data.filePath);
      commandBuilder.withLogName('force_source_retrieve_with_manifest');
    } else {
      commandBuilder.withFlag('--sourcepath', data.filePath);
      commandBuilder.withLogName('force_source_retrieve_with_sourcepath');
    }
    return commandBuilder.build();
  }
}

export class ManifestOrSourcePathGatherer
  implements ParametersGatherer<SelectedPath> {
  private explorerPath: string;
  public constructor(explorerPath: any) {
    this.explorerPath = explorerPath.fsPath;
  }
  public async gather(): Promise<
    CancelResponse | ContinueResponse<SelectedPath>
  > {
    if (vscode.workspace && vscode.workspace.workspaceFolders) {
      // TODO: Replace the hardcoded workspaceFolders[0] with logic to find the workspaceFolder
      // corresponding to the explorer path when we begin supporting multiple workspace folders
      const workspaceRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const manifestPath = path.join(workspaceRootPath, 'manifest');
      const isManifest = this.explorerPath.includes(manifestPath);
      const type = isManifest ? FileType.Manifest : FileType.Source;

      // If the type is manifest check whether or not the user selected an actual
      // file or just the manifest directory. If the user selected the manifest
      // directory then check that directory for manifest files. If there's only
      // one manifest file then use it, if there none or more than one then give
      // them a file select dialog and make them select one.
      if (isManifest) {
        let manifestFile = this.explorerPath;
        const stat = fs.lstatSync(manifestFile);
        if (stat.isDirectory()) {
          const manifestFileList = this.getManifestFiles(manifestFile);
          if (manifestFileList.length === 1) {
            manifestFile = manifestFileList[0];
          } else {
            const localizedFilterButtonText = nls.localize(
              'select_manifest_filter_button_text'
            );
            const fileUris = await vscode.window.showOpenDialog({
              canSelectFiles: true,
              canSelectFolders: false,
              canSelectMany: false,
              openLabel: nls.localize('select_manifest_file_button_text'),
              filters: { [localizedFilterButtonText]: ['xml'] },
              defaultUri: vscode.Uri.file(manifestFile)
            });
            if (fileUris && fileUris.length === 1) {
              manifestFile = fileUris[0].fsPath;
            } else {
              return { type: 'CANCEL' };
            }
          }
        }
        return {
          type: 'CONTINUE',
          data: { filePath: manifestFile, type }
        };
      } else {
        return {
          type: 'CONTINUE',
          data: { filePath: this.explorerPath, type }
        };
      }
    }
    return { type: 'CANCEL' };
  }

  private getManifestFiles(manifestDir: string): string[] {
    const manifestFileExtension = '.xml';
    const manifestFiles: string[] = [];
    const files = fs.readdirSync(manifestDir);
    files.forEach(rawFile => {
      const fileName = path.join(manifestDir, rawFile);
      const stat = fs.lstatSync(fileName);
      if (!stat.isDirectory()) {
        if (path.extname(fileName).toLowerCase() === manifestFileExtension) {
          manifestFiles.push(fileName);
        }
      }
    });
    return manifestFiles;
  }
}

export interface SelectedPath {
  filePath: string;
  type: FileType;
}

export enum FileType {
  Manifest,
  Source
}

const workspaceChecker = new SfdxWorkspaceChecker();

export async function forceSourceRetrieve(explorerPath: any) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    new ManifestOrSourcePathGatherer(explorerPath),
    new ForceSourceRetrieveExecutor()
  );
  await commandlet.run();
}
