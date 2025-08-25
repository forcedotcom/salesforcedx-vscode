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
  ParametersGatherer,
  SFDX_LWC_EXTENSION_NAME,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import { globSync } from 'glob';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { coerceMessageKey, nls } from '../../messages';
import { SalesforcePackageDirectories } from '../../salesforceProject';
import { RetrieveDescriber } from '../retrieveMetadata';

export const CONTINUE = 'CONTINUE';
export const CANCEL = 'CANCEL';
const LWC_PREVIEW_TYPESCRIPT_SUPPORT = 'preview.typeScriptSupport';

export type FileNameParameter = {
  fileName: string;
};

export type OutputDirParameter = {
  outputdir: string;
};

export type MetadataTypeParameter = {
  type: string;
};

type ApexTestTemplateParameter = {
  template: string;
};

export class FilePathGatherer implements ParametersGatherer<string> {
  private filePath: string;
  constructor(uri: URI) {
    this.filePath = uri.fsPath;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<string>> {
    if (workspaceUtils.hasRootWorkspace()) {
      return { type: CONTINUE, data: this.filePath };
    }
    return { type: CANCEL };
  }
}

export type FileSelection = { file: string };
export class FileSelector implements ParametersGatherer<FileSelection> {
  private readonly displayMessage: string;
  private readonly errorMessage: string;
  private readonly include: string;
  private readonly exclude?: string;
  private readonly maxResults?: number;

  constructor(displayMessage: string, errorMessage: string, include: string, exclude?: string, maxResults?: number) {
    this.displayMessage = displayMessage;
    this.errorMessage = errorMessage;
    this.include = include;
    this.exclude = exclude;
    this.maxResults = maxResults;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<FileSelection>> {
    const files = await vscode.workspace.findFiles(this.include, this.exclude, this.maxResults);
    const fileItems = files.map(file => ({
      label: path.basename(file.toString()),
      description: file.fsPath
    }));
    if (fileItems.length === 0) {
      vscode.window.showErrorMessage(this.errorMessage);
      return { type: CANCEL };
    }
    const selection = await vscode.window.showQuickPick(fileItems, {
      placeHolder: this.displayMessage
    });
    return selection ? { type: CONTINUE, data: { file: selection.description.toString() } } : { type: CANCEL };
  }
}

export class SelectFileName implements ParametersGatherer<FileNameParameter> {
  private maxFileNameLength: number;

  constructor(maxFileNameLength?: number) {
    this.maxFileNameLength = maxFileNameLength ?? Infinity;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<{ fileName: string }>> {
    const fileNameInputBoxOptions: vscode.InputBoxOptions = {
      prompt: nls.localize('parameter_gatherer_enter_file_name'),
      ...(this.maxFileNameLength !== Infinity && {
        validateInput: value =>
          value.length > this.maxFileNameLength
            ? nls
                .localize('parameter_gatherer_file_name_max_length_validation_error_message')
                .replace('{0}', this.maxFileNameLength.toString())
            : null
      })
    };

    const fileName = await vscode.window.showInputBox(fileNameInputBoxOptions);
    return fileName ? { type: CONTINUE, data: { fileName } } : { type: CANCEL };
  }
}

export class SelectUsername implements ParametersGatherer<{ username: string }> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{ username: string }>> {
    const usernameInputOptions: vscode.InputBoxOptions = {
      prompt: nls.localize('parameter_gatherer_enter_username_name')
    } satisfies vscode.InputBoxOptions;
    const username = await vscode.window.showInputBox(usernameInputOptions);
    return username ? { type: CONTINUE, data: { username } } : { type: CANCEL };
  }
}

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
    } catch (e) {
      if (e.name !== 'NoPackageDirectoryPathsFound' && e.name !== 'NoPackageDirectoriesFound') {
        throw e;
      }
    }

    let dirOptions = this.getDefaultOptions(packageDirs);
    let outputdir = await this.showMenu(dirOptions);

    if (outputdir === SelectOutputDir.customDirOption) {
      dirOptions = this.getCustomOptions(packageDirs, workspaceUtils.getRootWorkspacePath());
      outputdir = await this.showMenu(dirOptions);
    }

    return outputdir ? { type: CONTINUE, data: { outputdir } } : { type: CANCEL };
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

export class SimpleGatherer<T> implements ParametersGatherer<T> {
  private input: T;

  constructor(input: T) {
    this.input = input;
  }

  public gather(): Promise<ContinueResponse<T>> {
    return Promise.resolve({
      type: CONTINUE,
      data: this.input
    });
  }
}

export class RetrieveComponentOutputGatherer implements ParametersGatherer<LocalComponent[]> {
  private describer: RetrieveDescriber;

  constructor(describer: RetrieveDescriber) {
    this.describer = describer;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<LocalComponent[]>> {
    return {
      type: CONTINUE,
      data: await this.describer.gatherOutputLocations()
    };
  }
}

export class MetadataTypeGatherer extends SimpleGatherer<{ type: string }> {
  constructor(metadataType: string) {
    super({ type: metadataType });
  }
}

export class ApexTestTemplateGatherer extends SimpleGatherer<ApexTestTemplateParameter> {
  constructor(template: string) {
    super({ template });
  }
}

export class PromptConfirmGatherer implements ParametersGatherer<{ choice: string }> {
  private question: string;

  constructor(question: string) {
    this.question = question;
  }
  public async gather(): Promise<CancelResponse | ContinueResponse<{ choice: string }>> {
    const confirmOpt = nls.localize('parameter_gatherer_prompt_confirm_option');
    const cancelOpt = nls.localize('parameter_gatherer_prompt_cancel_option');
    const choice = await this.showMenu([cancelOpt, confirmOpt]);
    return confirmOpt === choice ? { type: CONTINUE, data: { choice } } : { type: CANCEL };
  }

  public async showMenu(options: string[]): Promise<string | undefined> {
    return await vscode.window.showQuickPick(options, {
      placeHolder: this.question
    } satisfies vscode.QuickPickOptions);
  }
}

export class SelectLwcComponentType implements ParametersGatherer<{ extension: string }> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{ extension: string }>> {
    const hasTsSupport = vscode.workspace
      .getConfiguration(SFDX_LWC_EXTENSION_NAME)
      .get(LWC_PREVIEW_TYPESCRIPT_SUPPORT, false);
    if (hasTsSupport) {
      const lwcComponentTypes = ['TypeScript', 'JavaScript'];
      const lwcComponentType = await this.showMenu(lwcComponentTypes, 'parameter_gatherer_select_lwc_type');
      return lwcComponentType
        ? {
            type: CONTINUE,
            data: { extension: lwcComponentType }
          }
        : { type: CANCEL };
    }
    return { type: CONTINUE, data: { extension: 'JavaScript' } };
  }

  public async showMenu(options: string[], message: string): Promise<string | undefined> {
    return await vscode.window.showQuickPick(options, {
      placeHolder: nls.localize(coerceMessageKey(message))
    } satisfies vscode.QuickPickOptions);
  }
}
