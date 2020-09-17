/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CancelResponse,
  ContinueResponse,
  LocalComponent,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  RegistryAccess,
  registryData
} from '@salesforce/source-deploy-retrieve';
import glob = require('glob');
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { SfdxPackageDirectories } from '../../sfdxProject';
import { getRootWorkspacePath, hasRootWorkspace } from '../../util';
import { RetrieveDescriber } from '../forceSourceRetrieveMetadata';

export class CompositeParametersGatherer<T> implements ParametersGatherer<T> {
  private readonly gatherers: Array<ParametersGatherer<any>>;
  public constructor(...gatherers: Array<ParametersGatherer<any>>) {
    this.gatherers = gatherers;
  }
  public async gather(): Promise<CancelResponse | ContinueResponse<T>> {
    const aggregatedData: any = {};
    for (const gatherer of this.gatherers) {
      const input = await gatherer.gather();
      if (input.type === 'CONTINUE') {
        Object.keys(input.data).map(
          key => (aggregatedData[key] = input.data[key])
        );
      } else {
        return {
          type: 'CANCEL'
        };
      }
    }
    return {
      type: 'CONTINUE',
      data: aggregatedData
    };
  }
}

export class EmptyParametersGatherer implements ParametersGatherer<{}> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
    return { type: 'CONTINUE', data: {} };
  }
}

export class FilePathGatherer implements ParametersGatherer<string> {
  private filePath: string;
  public constructor(uri: vscode.Uri) {
    this.filePath = uri.fsPath;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<string>> {
    if (hasRootWorkspace()) {
      return { type: 'CONTINUE', data: this.filePath };
    }
    return { type: 'CANCEL' };
  }
}

export type FileSelection = { file: string };
export class FileSelector implements ParametersGatherer<FileSelection> {
  private readonly displayMessage: string;
  private readonly errorMessage: string;
  private readonly include: string;
  private readonly exclude?: string;
  private readonly maxResults?: number;

  constructor(
    displayMessage: string,
    errorMessage: string,
    include: string,
    exclude?: string,
    maxResults?: number
  ) {
    this.displayMessage = displayMessage;
    this.errorMessage = errorMessage;
    this.include = include;
    this.exclude = exclude;
    this.maxResults = maxResults;
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<FileSelection>
  > {
    const files = await vscode.workspace.findFiles(
      this.include,
      this.exclude,
      this.maxResults
    );
    const fileItems = files.map(file => {
      return {
        label: path.basename(file.toString()),
        description: file.fsPath
      };
    });
    if (fileItems.length === 0) {
      vscode.window.showErrorMessage(this.errorMessage);
      return { type: 'CANCEL' };
    }
    const selection = await vscode.window.showQuickPick(fileItems, {
      placeHolder: this.displayMessage
    });
    return selection
      ? { type: 'CONTINUE', data: { file: selection.description.toString() } }
      : { type: 'CANCEL' };
  }
}

export class SelectFileName
  implements ParametersGatherer<{ fileName: string }> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ fileName: string }>
  > {
    const fileNameInputOptions = {
      prompt: nls.localize('parameter_gatherer_enter_file_name')
    } as vscode.InputBoxOptions;
    const fileName = await vscode.window.showInputBox(fileNameInputOptions);
    return fileName
      ? { type: 'CONTINUE', data: { fileName } }
      : { type: 'CANCEL' };
  }
}

export class SelectUsername
  implements ParametersGatherer<{ username: string }> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ username: string }>
  > {
    const usernameInputOptions = {
      prompt: nls.localize('parameter_gatherer_enter_username_name')
    } as vscode.InputBoxOptions;
    const username = await vscode.window.showInputBox(usernameInputOptions);
    return username
      ? { type: 'CONTINUE', data: { username } }
      : { type: 'CANCEL' };
  }
}

export class DemoModePromptGatherer implements ParametersGatherer<{}> {
  private readonly LOGOUT_RESPONSE = 'Cancel';
  private readonly DO_NOT_LOGOUT_RESPONSE = 'Authorize Org';
  private readonly prompt = nls.localize('demo_mode_prompt');

  public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
    const response = await vscode.window.showInformationMessage(
      this.prompt,
      this.DO_NOT_LOGOUT_RESPONSE,
      this.LOGOUT_RESPONSE
    );

    return response && response === this.LOGOUT_RESPONSE
      ? { type: 'CONTINUE', data: {} }
      : { type: 'CANCEL' };
  }
}

export class SelectLwcComponentDir
  implements ParametersGatherer<{ fileName: string; outputdir: string }> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ fileName: string; outputdir: string }>
  > {
    let packageDirs: string[] = [];
    try {
      packageDirs = await SfdxPackageDirectories.getPackageDirectoryPaths();
    } catch (e) {
      if (
        e.name !== 'NoPackageDirectoryPathsFound' &&
        e.name !== 'NoPackageDirectoriesFound'
      ) {
        throw e;
      }
    }
    const packageDir = await this.showMenu(
      packageDirs,
      'parameter_gatherer_enter_dir_name'
    );
    let outputdir;
    const namePathMap = new Map();
    let fileName;
    if (packageDir) {
      const pathToPkg = path.join(getRootWorkspacePath(), packageDir);
      const registry = new RegistryAccess();
      const components = registry.getComponentsFromPath(pathToPkg);
      const lwcNames = [];
      for (const component of components) {
        const { fullName, type } = component;
        if (type.name === registryData.types.lightningcomponentbundle.name) {
          namePathMap.set(fullName, component.xml);
          lwcNames.push(fullName);
        }
      }
      const chosenLwcName = await this.showMenu(
        lwcNames,
        'parameter_gatherer_enter_lwc_name'
      );
      const filePathToXml = namePathMap.get(chosenLwcName);
      fileName = path.basename(filePathToXml, '.js-meta.xml');
      // Path strategy expects a relative path to the output folder
      outputdir = path.dirname(filePathToXml).replace(pathToPkg, packageDir);
    }

    return outputdir && fileName
      ? {
          type: 'CONTINUE',
          data: { fileName, outputdir }
        }
      : { type: 'CANCEL' };
  }

  public async showMenu(
    options: string[],
    message: string
  ): Promise<string | undefined> {
    return await vscode.window.showQuickPick(options, {
      placeHolder: nls.localize(message)
    } as vscode.QuickPickOptions);
  }
}

export class SelectOutputDir
  implements ParametersGatherer<{ outputdir: string }> {
  private typeDir: string;
  private typeDirRequired: boolean | undefined;
  public static readonly defaultOutput = path.join('main', 'default');
  public static readonly customDirOption = `$(file-directory) ${nls.localize(
    'custom_output_directory'
  )}`;

  public constructor(typeDir: string, typeDirRequired?: boolean) {
    this.typeDir = typeDir;
    this.typeDirRequired = typeDirRequired;
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ outputdir: string }>
  > {
    let packageDirs: string[] = [];
    try {
      packageDirs = await SfdxPackageDirectories.getPackageDirectoryPaths();
    } catch (e) {
      if (
        e.name !== 'NoPackageDirectoryPathsFound' &&
        e.name !== 'NoPackageDirectoriesFound'
      ) {
        throw e;
      }
    }

    let dirOptions = this.getDefaultOptions(packageDirs);
    let outputdir = await this.showMenu(dirOptions);

    if (outputdir === SelectOutputDir.customDirOption) {
      dirOptions = this.getCustomOptions(packageDirs, getRootWorkspacePath());
      outputdir = await this.showMenu(dirOptions);
    }

    return outputdir
      ? { type: 'CONTINUE', data: { outputdir } }
      : { type: 'CANCEL' };
  }

  public getDefaultOptions(packageDirectories: string[]): string[] {
    const options = packageDirectories.map(packageDir =>
      path.join(packageDir, SelectOutputDir.defaultOutput, this.typeDir)
    );
    options.push(SelectOutputDir.customDirOption);
    return options;
  }

  public getCustomOptions(packageDirs: string[], rootPath: string): string[] {
    const packages =
      packageDirs.length > 1 ? `{${packageDirs.join(',')}}` : packageDirs[0];
    return new glob.GlobSync(
      path.join(rootPath, packages, '**', path.sep)
    ).found.map(value => {
      let relativePath = path.relative(rootPath, path.join(value, '/'));
      relativePath = path.join(
        relativePath,
        this.typeDirRequired && !relativePath.endsWith(this.typeDir)
          ? this.typeDir
          : ''
      );
      return relativePath;
    });
  }

  public async showMenu(options: string[]): Promise<string | undefined> {
    return await vscode.window.showQuickPick(options, {
      placeHolder: nls.localize('parameter_gatherer_enter_dir_name')
    } as vscode.QuickPickOptions);
  }
}

export class SimpleGatherer<T> implements ParametersGatherer<T> {
  private input: T;

  constructor(input: T) {
    this.input = input;
  }

  public async gather(): Promise<ContinueResponse<T>> {
    return {
      type: 'CONTINUE',
      data: this.input
    };
  }
}

export class RetrieveComponentOutputGatherer
  implements ParametersGatherer<LocalComponent[]> {
  private describer: RetrieveDescriber;

  constructor(describer: RetrieveDescriber) {
    this.describer = describer;
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<LocalComponent[]>
  > {
    return {
      type: 'CONTINUE',
      data: await this.describer.gatherOutputLocations()
    };
  }
}

export class MetadataTypeGatherer extends SimpleGatherer<{ type: string }> {
  constructor(metadataType: string) {
    super({ type: metadataType });
  }
}

export class PromptConfirmGatherer
  implements ParametersGatherer<{ choice: string }> {
  private question: string;

  constructor(question: string) {
    this.question = question;
  }
  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ choice: string }>
  > {
    const confirmOpt = nls.localize('parameter_gatherer_prompt_confirm_option');
    const cancelOpt = nls.localize('parameter_gatherer_prompt_cancel_option');
    const choice = await this.showMenu([confirmOpt, cancelOpt]);
    return confirmOpt === choice
      ? { type: 'CONTINUE', data: { choice } }
      : { type: 'CANCEL' };
  }

  public async showMenu(options: string[]): Promise<string | undefined> {
    return await vscode.window.showQuickPick(options, {
      placeHolder: this.question
    } as vscode.QuickPickOptions);
  }
}
