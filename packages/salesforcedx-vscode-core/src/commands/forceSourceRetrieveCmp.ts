/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CancelResponse,
  ContinueResponse,
  PostconditionChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { BrowserNode, NodeType } from '../orgBrowser';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './commands';
import { ForceSourceRetrieveExecutor } from './index';
import {
  BundlePathStrategy,
  DefaultPathStrategy,
  SourcePathStrategy
} from './templates/baseTemplateCommand';
import {
  AURA_DEFINITION_FILE_EXTS,
  LWC_DEFINITION_FILE_EXTS
} from './templates/metadataTypeConstants';

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

const BUNDLE_TYPES = new Set([
  'AuraDefinitionBundle',
  'LightningComponentBundle',
  'WaveTemplateBundle',
  'ExperienceBundle'
]);

export async function forceSourceRetrieveCmp(componentNode: BrowserNode) {
  const typeNode =
    componentNode.parent!.type === NodeType.Folder
      ? componentNode.parent!.parent!
      : componentNode.parent!;
  const typeName = typeNode.fullName;
  const dirName = typeNode.directoryName!;
  const componentName = componentNode.fullName;
  // new func
  let suffixes: string[];
  switch (typeName) {
    case 'LightningComponentBundle':
      suffixes = LWC_DEFINITION_FILE_EXTS;
      break;
    case 'AuraDefinitionBundle':
      suffixes = AURA_DEFINITION_FILE_EXTS;
      break;
    default:
      suffixes = [typeNode.suffix!];
  }
  const fileExts = suffixes.map(suffix => `.${suffix!}-meta.xml`);

  const sourcePathStrategy = BUNDLE_TYPES.has(typeName)
    ? new BundlePathStrategy()
    : new DefaultPathStrategy();

  const metadataArg = `${typeName}:${componentName}`;
  const executor = new ForceSourceRetrieveExecutor(metadataArg);

  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor,
    new FilePathExistsChecker(
      fileExts,
      sourcePathStrategy,
      componentName,
      dirName
    )
  );
  await commandlet.run();
}

export class FilePathExistsChecker implements PostconditionChecker<{}> {
  private fileExts: string[];
  private sourcePathStrategy: SourcePathStrategy;
  private componentName: string;
  private dirName: string;

  public constructor(
    fileExts: string[],
    sourcePathStrategy: SourcePathStrategy,
    componentName: string,
    dirName: string
  ) {
    this.fileExts = fileExts;
    this.sourcePathStrategy = sourcePathStrategy;
    this.componentName = componentName;
    this.dirName = dirName;
  }

  public async check(): Promise<ContinueResponse<{}> | CancelResponse> {
    const files = await vscode.workspace.findFiles(
      this.createFilesGlob(this.dirName, this.componentName)
    );
    if (files.length === 0) {
      return { type: 'CONTINUE', data: {} };
    } else {
      const overwrite = await notificationService.showWarningMessage(
        nls.localize('warning_prompt_file_overwrite', this.componentName),
        nls.localize('warning_prompt_overwrite_confirm'),
        nls.localize('warning_prompt_overwrite_cancel')
      );
      if (overwrite === nls.localize('warning_prompt_overwrite_confirm')) {
        return { type: 'CONTINUE', data: {} };
      }
    }
    return { type: 'CANCEL' };
  }

  private createFilesGlob(dirName: string, fileName: string): string {
    // get package directory from util sfdx project
    const basePath = path.join('force-app', 'main', 'default', dirName);
    const filePaths = this.fileExts.map(fileExt =>
      this.sourcePathStrategy.getPathToSource(basePath, fileName, fileExt)
    );
    return `{${filePaths.join(',')}}`;
  }
}
