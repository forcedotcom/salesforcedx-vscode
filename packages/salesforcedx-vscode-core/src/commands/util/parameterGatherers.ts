/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import { globSync } from 'glob';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { default as SalesforcePackageDirectories } from '../../salesforceProject/salesforcePackageDirectories';

type OutputDirParameter = {
  outputdir: string;
};

export class SelectOutputDir implements ParametersGatherer<OutputDirParameter> {
  private typeDir: string;
  private typeDirRequired: boolean | undefined;
  public static readonly defaultOutput = path.join('main', 'default');
  public static readonly customDirOption = `$(file-directory) ${nls.localize('custom_output_directory')}`;

  constructor(typeDir: string, typeDirRequired?: boolean) {
    this.typeDir = typeDir;
    this.typeDirRequired = typeDirRequired;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<OutputDirParameter>> {
    let packageDirs: string[] = [];
    try {
      packageDirs = await SalesforcePackageDirectories.getPackageDirectoryPaths();
    } catch (e: unknown) {
      if (
        e &&
        typeof e === 'object' &&
        'name' in e &&
        e.name !== 'NoPackageDirectoryPathsFound' &&
        e.name !== 'NoPackageDirectoriesFound'
      ) {
        throw e;
      }
    }

    let dirOptions = this.getDefaultOptions(packageDirs);
    let outputdir = await this.showMenu(dirOptions);

    if (outputdir === SelectOutputDir.customDirOption) {
      dirOptions = this.getCustomOptions(packageDirs, workspaceUtils.getRootWorkspacePath());
      outputdir = await this.showMenu(dirOptions);
    }

    return outputdir ? { type: 'CONTINUE', data: { outputdir } } : { type: 'CANCEL' };
  }

  public getDefaultOptions(packageDirectories: string[]): string[] {
    const options = packageDirectories.map(packageDir =>
      path.join(packageDir, SelectOutputDir.defaultOutput, this.typeDir)
    );
    options.push(SelectOutputDir.customDirOption);
    return options;
  }

  public getCustomOptions(packageDirs: string[], rootPath: string): string[] {
    const packages = packageDirs.length > 1 ? `{${packageDirs.join(',')}}` : packageDirs[0];
    return globSync(path.join(rootPath, packages, '**', path.sep))
      .map(p => path.relative(rootPath, path.join(p, '/')))
      .map(p => path.join(p, this.typeDirRequired && !p.endsWith(this.typeDir) ? this.typeDir : ''));
  }

  public async showMenu(options: string[]): Promise<string | undefined> {
    return await vscode.window.showQuickPick(options, {
      placeHolder: nls.localize('parameter_gatherer_enter_dir_name')
    } satisfies vscode.QuickPickOptions);
  }
}
