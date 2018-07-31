/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandExecution
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  DirFileNameSelection,
  ParametersGatherer,
  PostconditionChecker,
  PreconditionChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';
import * as vscode from 'vscode';
import glob = require('glob');
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { isSfdxProjectOpened } from '../predicates';
import { taskViewService } from '../statuses';

export class LightningFilePathExistsChecker
  implements PostconditionChecker<DirFileNameSelection> {
  public async check(
    inputs: ContinueResponse<DirFileNameSelection> | CancelResponse
  ): Promise<ContinueResponse<DirFileNameSelection> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      const baseFileName = path.join(
        inputs.data.outputdir,
        inputs.data.fileName,
        inputs.data.fileName
      );
      const files = await vscode.workspace.findFiles(
        `{${baseFileName}.app,${baseFileName}.cmp,${baseFileName}.intf,${baseFileName}.evt}`
      );
      // If file does not exist then create it, otherwise prompt user to overwrite the file
      if (files.length === 0) {
        return inputs;
      } else {
        const overwrite = await notificationService.showWarningMessage(
          nls.localize('warning_prompt_lightning_bundle_overwrite'),
          nls.localize('warning_prompt_overwrite_confirm'),
          nls.localize('warning_prompt_overwrite_cancel')
        );
        if (overwrite === nls.localize('warning_prompt_overwrite_confirm')) {
          return inputs;
        }
      }
    }
    return { type: 'CANCEL' };
  }
}

export class FilePathExistsChecker
  implements PostconditionChecker<DirFileNameSelection> {
  private fileExtension: string;

  public constructor(fileExtension: string) {
    this.fileExtension = fileExtension;
  }

  public async check(
    inputs: ContinueResponse<DirFileNameSelection> | CancelResponse
  ): Promise<ContinueResponse<DirFileNameSelection> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      const files = await vscode.workspace.findFiles(
        path.join(
          inputs.data.outputdir,
          inputs.data.fileName + this.fileExtension
        )
      );
      // If file does not exist then create it, otherwise prompt user to overwrite the file
      if (files.length === 0) {
        return inputs;
      } else {
        const overwrite = await notificationService.showWarningMessage(
          nls.localize('warning_prompt_file_overwrite'),
          nls.localize('warning_prompt_overwrite_confirm'),
          nls.localize('warning_prompt_overwrite_cancel')
        );
        if (overwrite === nls.localize('warning_prompt_overwrite_confirm')) {
          return inputs;
        }
      }
    }
    return { type: 'CANCEL' };
  }
}

export class EmptyPostChecker implements PostconditionChecker<any> {
  public async check(
    inputs: ContinueResponse<any> | CancelResponse
  ): Promise<ContinueResponse<any> | CancelResponse> {
    return inputs;
  }
}

export class SfdxWorkspaceChecker implements PreconditionChecker {
  public check(): boolean {
    const result = isSfdxProjectOpened.apply(vscode.workspace);
    if (!result.result) {
      notificationService.showErrorMessage(result.message);
      return false;
    }
    return true;
  }
}

export class EmptyPreChecker implements PreconditionChecker {
  public check(): boolean {
    return true;
  }
}

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

export type FileSelection = { file: string };
export class FileSelector implements ParametersGatherer<FileSelection> {
  private readonly include: string;
  private readonly exclude?: string;
  private readonly maxResults?: number;

  constructor(include: string, exclude?: string, maxResults?: number) {
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
    const selection = await vscode.window.showQuickPick(fileItems);
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

export abstract class SelectDirPath
  implements ParametersGatherer<{ outputdir: string }> {
  private explorerDir: string | undefined;
  private globKeyWord: string | undefined;

  public constructor(explorerDir?: vscode.Uri, globKeyWord?: string) {
    this.explorerDir = explorerDir ? explorerDir.fsPath : explorerDir;
    this.globKeyWord = globKeyWord;
  }

  public abstract globDirs(srcPath: string, priorityKeyword?: string): string[];

  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ outputdir: string }>
  > {
    const rootPath = vscode.workspace.rootPath;
    let outputdir;
    if (rootPath) {
      outputdir = this.explorerDir
        ? path.relative(rootPath, this.explorerDir)
        : await vscode.window.showQuickPick(
            this.globDirs(rootPath, this.globKeyWord),
            {
              placeHolder: nls.localize('parameter_gatherer_enter_dir_name')
            } as vscode.QuickPickOptions
          );
    }
    return outputdir
      ? { type: 'CONTINUE', data: { outputdir } }
      : { type: 'CANCEL' };
  }
}
export class SelectPrioritizedDirPath extends SelectDirPath {
  public globDirs(srcPath: string, priorityKeyword?: string): string[] {
    const unprioritizedRelDirs = new glob.GlobSync(
      path.join(srcPath, '**/')
    ).found.map(value => {
      let relativePath = path.relative(srcPath, path.join(value, '/'));
      relativePath = path.join(relativePath, '');
      return relativePath;
    });
    if (priorityKeyword) {
      const notPrioritized: string[] = [];
      const prioritized = unprioritizedRelDirs.filter(dir => {
        if (dir.includes(priorityKeyword)) {
          return true;
        } else {
          notPrioritized.push(dir);
        }
      });
      return prioritized.concat(notPrioritized);
    }
    return unprioritizedRelDirs;
  }
}

export class SelectStrictDirPath extends SelectDirPath {
  public globDirs(srcPath: string, priorityKeyword?: string): string[] {
    const globPattern = priorityKeyword
      ? path.join(srcPath, '**/', priorityKeyword + '/')
      : path.join(srcPath, '**/');
    const relativeDirs = new glob.GlobSync(globPattern).found.map(value => {
      let relativePath = path.relative(srcPath, path.join(value, '/'));
      relativePath = path.join(relativePath, '');
      return relativePath;
    });
    return relativeDirs;
  }
}

export interface FlagParameter<T> {
  flag: T;
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

// Command Execution
////////////////////
export interface CommandletExecutor<T> {
  execute(response: ContinueResponse<T>): void;
}

// Common

export abstract class SfdxCommandletExecutor<T>
  implements CommandletExecutor<T> {
  protected showChannelOutput = true;

  protected attachExecution(
    execution: CommandExecution,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ) {
    channelService.streamCommandOutput(execution);

    if (this.showChannelOutput) {
      channelService.showChannelOutput();
    }

    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }

  public execute(response: ContinueResponse<T>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }

  public abstract build(data: T): Command;
}

export class SfdxCommandlet<T> {
  private readonly prechecker: PreconditionChecker;
  private readonly postchecker: PostconditionChecker<T>;
  private readonly gatherer: ParametersGatherer<T>;
  private readonly executor: CommandletExecutor<T>;

  constructor(
    checker: PreconditionChecker,
    gatherer: ParametersGatherer<T>,
    executor: CommandletExecutor<T>,
    postchecker = new EmptyPostChecker()
  ) {
    this.prechecker = checker;
    this.gatherer = gatherer;
    this.executor = executor;
    this.postchecker = postchecker;
  }

  public async run(): Promise<void> {
    if (this.prechecker.check()) {
      let inputs = await this.gatherer.gather();
      inputs = await this.postchecker.check(inputs);
      switch (inputs.type) {
        case 'CONTINUE':
          return this.executor.execute(inputs);
        case 'CANCEL':
          if (inputs.msg) {
            notificationService.showErrorMessage(inputs.msg);
          }
          return;
      }
    }
  }
}
