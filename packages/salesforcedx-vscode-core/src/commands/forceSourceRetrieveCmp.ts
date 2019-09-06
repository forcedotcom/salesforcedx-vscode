/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
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
import { SfdxPackageDirectories } from '../sfdxProject';
import { TelemetryData, telemetryService } from '../telemetry';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';
import {
  BundlePathStrategy,
  DefaultPathStrategy,
  SourcePathStrategy
} from './templates/baseTemplateCommand';
import {
  AURA_DEFINITION_FILE_EXTS,
  LWC_DEFINITION_FILE_EXTS
} from './templates/metadataTypeConstants';

export class ForceSourceRetrieveExecutor extends SfdxCommandletExecutor<
  string
> {
  private typeName: string;
  private componentName: string;

  constructor(typeName: string, componentName: string) {
    super();
    this.typeName = typeName;
    this.componentName = componentName;
  }

  public build(): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_retrieve_text'))
      .withArg('force:source:retrieve')
      .withFlag('-m', `${this.typeName}:${this.componentName}`)
      .withLogName('force_source_retrieve')
      .build();
  }

  protected getTelemetryData(): TelemetryData {
    // needs to be updated when implementing support for multiple components/types
    const retrievedTypes: any = [{ type: this.typeName, quantity: 1 }];
    return {
      properties: {
        metadataCount: JSON.stringify(retrievedTypes)
      }
    };
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

const BUNDLE_TYPES = new Set([
  'AuraDefinitionBundle',
  'LightningComponentBundle',
  'WaveTemplateBundle',
  'ExperienceBundle',
  'CustomObject'
]);

export function generateSuffix(
  typeNode: BrowserNode,
  typeName: string
): string[] {
  let suffixes: string[];
  switch (typeName) {
    case 'LightningComponentBundle':
      suffixes = LWC_DEFINITION_FILE_EXTS;
      break;
    case 'AuraDefinitionBundle':
      suffixes = AURA_DEFINITION_FILE_EXTS;
      break;
    default:
      suffixes = [`.${typeNode.suffix!}`];
  }
  return suffixes.map(suffix => `${suffix!}-meta.xml`);
}

export async function forceSourceRetrieveCmp(componentNode: BrowserNode) {
  const typeNode =
    componentNode.parent!.type === NodeType.Folder
      ? componentNode.parent!.parent!
      : componentNode.parent!;
  const typeName = typeNode.fullName;
  const dirName = typeNode.directoryName!;
  const componentName = componentNode.fullName;
  const label =
    componentNode.parent!.type === NodeType.Folder
      ? componentName.substr(componentName.indexOf('/') + 1)
      : componentName;
  const fileExts = generateSuffix(typeNode, typeName);

  const sourcePathStrategy = BUNDLE_TYPES.has(typeName)
    ? new BundlePathStrategy()
    : new DefaultPathStrategy();

  const executor = new ForceSourceRetrieveExecutor(typeName, componentName);

  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor,
    new FilePathExistsChecker(
      fileExts,
      sourcePathStrategy,
      componentName,
      dirName,
      label
    )
  );
  await commandlet.run();
}

export class FilePathExistsChecker implements PostconditionChecker<{}> {
  private fileExts: string[];
  private sourcePathStrategy: SourcePathStrategy;
  private componentName: string;
  private dirName: string;
  private label: string;

  public constructor(
    fileExts: string[],
    sourcePathStrategy: SourcePathStrategy,
    componentName: string,
    dirName: string,
    label: string
  ) {
    this.fileExts = fileExts;
    this.sourcePathStrategy = sourcePathStrategy;
    this.componentName = componentName;
    this.dirName = dirName;
    this.label = label;
  }

  public async check(): Promise<ContinueResponse<{}> | CancelResponse> {
    const globs = await this.createFilesGlob(this.dirName, this.componentName);
    const allFiles = [];
    for (const glob of globs) {
      const files = await vscode.workspace.findFiles(glob);
      if (files.length > 0) {
        allFiles.push(files);
      }
    }

    if (allFiles.length === 0) {
      return { type: 'CONTINUE', data: {} };
    } else {
      const overwrite = await notificationService.showWarningMessage(
        nls.localize('warning_prompt_cmp_file_overwrite', this.label),
        nls.localize('warning_prompt_continue_confirm'),
        nls.localize('warning_prompt_overwrite_cancel')
      );
      if (overwrite === nls.localize('warning_prompt_continue_confirm')) {
        return { type: 'CONTINUE', data: {} };
      }
    }
    return { type: 'CANCEL' };
  }

  private async createFilesGlob(
    dirName: string,
    fileName: string
  ): Promise<vscode.GlobPattern[]> {
    const packageDirectories = await SfdxPackageDirectories.getPackageDirectoryPaths();
    telemetryService.sendEventData('Number of Package Directories', undefined, {
      packageDirectories: packageDirectories.length
    });

    const basePaths = packageDirectories.map(packageDir =>
      path.join(packageDir, 'main', 'default', dirName)
    );
    const globs = [];
    for (const bPath of basePaths) {
      const filePaths = this.fileExts.map(fileExt =>
        this.sourcePathStrategy.getPathToSource(bPath, fileName, fileExt)
      );
      globs.push(`{${filePaths.join(',')}}`);
    }
    return globs;
  }
}
