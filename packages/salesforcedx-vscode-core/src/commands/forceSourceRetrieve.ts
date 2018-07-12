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

const workspaceChecker = new SfdxWorkspaceChecker();

export class ForceSourceRetrieveMetadataExecutor extends SfdxCommandletExecutor<
  Metadata
> {
  public build(data: Metadata): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_retrieve_text'))
      .withArg('force:source:retrieve')
      .withFlag('--metadata', data.metadata)
      .build();
  }
}

export class ForceSourceRetrieveFilePathExecutor extends SfdxCommandletExecutor<
  SelectedFile
> {
  public build(data: SelectedFile): Command {
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

export class MetadataGatherer implements ParametersGatherer<Metadata> {
  public async gather(): Promise<CancelResponse | ContinueResponse<Metadata>> {
    const metadataInputOptions = {
      prompt: nls.localize('parameter_gatherer_enter_metadata_component_names')
    } as vscode.InputBoxOptions;

    const metadata = await vscode.window.showInputBox(metadataInputOptions);

    if (!metadata) {
      return { type: 'CANCEL' };
    }
    return { type: 'CONTINUE', data: { metadata } };
  }
}

export class ManifestOrSourcePathGatherer
  implements ParametersGatherer<SelectedFile> {
  private explorerPath: string;
  public constructor(explorerPath: any) {
    this.explorerPath = explorerPath.fsPath;
  }
  public async gather(): Promise<
    CancelResponse | ContinueResponse<SelectedFile>
  > {
    const rootPath = vscode.workspace.rootPath;
    if (rootPath) {
      const manifestPath = path.join(rootPath, 'manifest');
      const isManifestFile = this.explorerPath.includes(manifestPath);
      const type = isManifestFile ? FileType.Manifest : FileType.Source;
      return { type: 'CONTINUE', data: { filePath: this.explorerPath, type } };
    }
    return { type: 'CANCEL' };
  }
}

export interface Metadata {
  metadata: string;
}

export interface SelectedFile {
  filePath: string;
  type: FileType;
}

export enum FileType {
  Manifest,
  Source
}

export function createParameterGatherer(
  explorerPath?: any
): ParametersGatherer<SelectedFile | Metadata> {
  if (explorerPath) {
    return new ManifestOrSourcePathGatherer(explorerPath);
  }
  return new MetadataGatherer();
}

export function createExecutor(
  explorerPath?: any
): SfdxCommandletExecutor<Metadata | SelectedFile> {
  if (explorerPath) {
    return new ForceSourceRetrieveFilePathExecutor();
  }
  return new ForceSourceRetrieveMetadataExecutor();
}

export async function forceSourceRetrieve(explorerPath?: any) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    createParameterGatherer(explorerPath),
    createExecutor(explorerPath)
  );
  await commandlet.run();
}
