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
import { SfdxPackageDirectories } from '../sfdxProject';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, hasRootWorkspace } from '../util';

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

  public logMetric(
    logName: string | undefined,
    executionTime: [number, number],
    additionalData?: any
  ) {
    telemetryService.sendCommandEvent(logName, executionTime, additionalData);
  }

  public execute(response: ContinueResponse<T>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
    });
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
