/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
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
    } else {
      commandBuilder.withFlag('--sourcepath', data.filePath);
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
      const isManifestFile = this.explorerPath.includes(manifestPath);
      const type = isManifestFile ? FileType.Manifest : FileType.Source;
      return { type: 'CONTINUE', data: { filePath: this.explorerPath, type } };
    }
    return { type: 'CANCEL' };
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
